// Polyfill for File to prevent undici crashes on Node 18 pkg binaries
if (typeof global.File === 'undefined') {
    global.File = class File {};
}

const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');

const db = require('./src/db/database');
const umsClient = require('./src/services/umsClient');
const gradesService = require('./src/services/gradesService');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'super_secret_ums_key_123'; // In production, use environment variables

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// --- JWT MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ success: false, error: 'Access denied. No token provided.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, error: 'Invalid or expired token.' });
        req.user = user;
        next();
    });
};

// --- AUTHENTICATION ENDPOINT ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Username and password are required.' });
    }

    try {
        // Attempt live login with UMS to verify credentials
        await umsClient.loginToUMS(username, password);

        // If successful, upsert the credentials in SQLite
        const stmt = db.prepare(`
            INSERT INTO users (username, password) 
            VALUES (?, ?)
            ON CONFLICT(username) DO UPDATE SET password = excluded.password
        `);
        stmt.run(username, password);

        // Generate JWT token
        const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });

        res.json({ success: true, token });
    } catch (error) {
        console.error('Login Error:', error.message);
        res.status(401).json({ success: false, error: 'Invalid credentials or UMS unavailable.' });
    }
});

// Helper function to get valid cookies for a user
const getValidCookies = async (username) => {
    const userRecord = db.prepare('SELECT password FROM users WHERE username = ?').get(username);
    if (!userRecord) {
        throw new Error('User credentials not found. Please log in again.');
    }
    return await umsClient.loginToUMS(username, userRecord.password);
};

// --- ACADEMIC YEARS ENDPOINT ---
app.get('/api/academic-years', authenticateToken, async (req, res) => {
    const username = req.user.username;

    try {
        // Check SQLite cache first (academic_years_cache is updated once per year, let's say TTL is 1 day = 86400s)
        const cacheRecord = db.prepare('SELECT data, updated_at FROM academic_years_cache WHERE username = ?').get(username);
        if (cacheRecord) {
            const updatedAt = new Date(cacheRecord.updated_at + 'Z');
            const diffSeconds = (new Date() - updatedAt) / 1000;

            if (diffSeconds < 86400) { // 24 hours
                console.log(`Serving cached academic years for user: ${username}`);
                return res.json({ success: true, data: JSON.parse(cacheRecord.data), cached: true });
            }
        }

        console.log(`Cache miss for academic years for ${username}. Fetching from UMS...`);
        const cookies = await getValidCookies(username);
        const yearsData = await gradesService.fetchAcademicYears(cookies);

        db.prepare(`
            INSERT INTO academic_years_cache (username, data, updated_at) 
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(username) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP
        `).run(username, JSON.stringify(yearsData));

        res.json({ success: true, data: yearsData, cached: false });
    } catch (error) {
        console.error(`Error fetching academic years for ${username}:`, error.message);
        res.status(500).json({ success: false, error: error.message || 'Failed to retrieve academic years.' });
    }
});

// --- YEAR WORK GRADES ENDPOINT ---
app.get('/api/grades/year-work', authenticateToken, async (req, res) => {
    const username = req.user.username;
    const yearId = req.query.yearId || 'default';
    const cacheKey = `${username}_yearwork_${yearId}`;

    try {
        const force = req.query.force === 'true';

        if (!force) {
            const cacheRecord = db.prepare('SELECT data, updated_at FROM cache WHERE cache_key = ?').get(cacheKey);
            if (cacheRecord) {
                const updatedAt = new Date(cacheRecord.updated_at + 'Z');
                const diffSeconds = (new Date() - updatedAt) / 1000;

                if (diffSeconds < 300) { // 5 minutes TTL
                    console.log(`Serving cached year work grades for ${cacheKey}`);
                    return res.json({ success: true, data: JSON.parse(cacheRecord.data), cached: true, updatedAt: cacheRecord.updated_at });
                }
            }
        }

        console.log(`Cache miss for ${cacheKey}. Scraping from UMS...`);
        const cookies = await getValidCookies(username);
        const gradesData = await gradesService.fetchYearWorkGrades(cookies, req.query.yearId);

        db.prepare(`
            INSERT INTO cache (cache_key, username, data, updated_at) 
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(cache_key) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP
        `).run(cacheKey, username, JSON.stringify(gradesData));

        const updatedRecord = db.prepare('SELECT updated_at FROM cache WHERE cache_key = ?').get(cacheKey);

        res.json({ success: true, data: gradesData, cached: false, updatedAt: updatedRecord.updated_at });
    } catch (error) {
        console.error(`Error fetching year work grades for ${username}:`, error.message);
        res.status(500).json({ success: false, error: error.message || 'Failed to retrieve year work grades.' });
    }
});

// --- GPA ENDPOINT ---
app.get('/api/grades/gpa', authenticateToken, async (req, res) => {
    const username = req.user.username;
    const cacheKey = `${username}_gpa`;

    try {
        const force = req.query.force === 'true';

        if (!force) {
            const cacheRecord = db.prepare('SELECT data, updated_at FROM cache WHERE cache_key = ?').get(cacheKey);
            if (cacheRecord) {
                const updatedAt = new Date(cacheRecord.updated_at + 'Z');
                const diffSeconds = (new Date() - updatedAt) / 1000;

                if (diffSeconds < 60 * 60 * 24 * 30 * 6) { // 6 Months
                    console.log(`Serving cached GPA for ${cacheKey}`);
                    return res.json({ success: true, data: JSON.parse(cacheRecord.data), cached: true, updatedAt: cacheRecord.updated_at });
                }
            }
        }

        console.log(`Cache miss for ${cacheKey}. Scraping from UMS...`);
        const cookies = await getValidCookies(username);
        const gpaData = await gradesService.fetchGPA(cookies);

        db.prepare(`
            INSERT INTO cache (cache_key, username, data, updated_at) 
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(cache_key) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP
        `).run(cacheKey, username, JSON.stringify(gpaData));

        const updatedRecord = db.prepare('SELECT updated_at FROM cache WHERE cache_key = ?').get(cacheKey);

        res.json({ success: true, data: gpaData, cached: false, updatedAt: updatedRecord.updated_at });
    } catch (error) {
        console.error(`Error fetching GPA for ${username}:`, error.message);
        res.status(500).json({ success: false, error: error.message || 'Failed to retrieve GPA.' });
    }
});

// --- VERSION ENDPOINT ---
app.get('/api/version', (req, res) => {
    try {
        const pkg = require('./package.json');
        res.json({ success: true, version: pkg.version });
    } catch (e) {
        res.json({ success: true, version: '1.0.0' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
