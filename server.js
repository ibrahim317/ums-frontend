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

const getCulturedCookies = (cookies, lang) => {
    const cleaned = cookies.split(/;\s*/).filter(c => !c.trim().startsWith('Culture=')).join('; ');
    return `${cleaned}; Culture=${lang}`;
};

// --- ACADEMIC YEARS ENDPOINT ---
app.get('/api/academic-years', authenticateToken, async (req, res) => {
    const username = req.user.username;
    const lang = req.headers['x-culture'] || 'ar';
    const cacheKey = `${username}_${lang}`;

    try {
        let cacheRecord = db.prepare('SELECT data, updated_at FROM academic_years_cache WHERE username = ?').get(cacheKey);
        
        // Backward compatibility for Arabic
        if (!cacheRecord && lang === 'ar') {
            cacheRecord = db.prepare('SELECT data, updated_at FROM academic_years_cache WHERE username = ?').get(username);
            if (cacheRecord) {
                // Migrate to new key
                db.prepare('INSERT OR IGNORE INTO academic_years_cache (username, data, updated_at) VALUES (?, ?, ?)').run(cacheKey, cacheRecord.data, cacheRecord.updated_at);
            }
        }

        if (cacheRecord) {
            const updatedAt = new Date(cacheRecord.updated_at + 'Z');
            const diffSeconds = (new Date() - updatedAt) / 1000;

            if (diffSeconds < 86400) { // 24 hours
                console.log(`Serving cached academic years for user: ${cacheKey}`);
                return res.json({ success: true, data: JSON.parse(cacheRecord.data), cached: true });
            }
        }

        console.log(`Cache miss for academic years for ${cacheKey}. Fetching from UMS...`);
        const cookies = await getValidCookies(username);
        const culturedCookies = getCulturedCookies(cookies, lang);
        const yearsData = await gradesService.fetchAcademicYears(culturedCookies);

        db.prepare(`
            INSERT INTO academic_years_cache (username, data, updated_at) 
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(username) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP
        `).run(cacheKey, JSON.stringify(yearsData));

        res.json({ success: true, data: yearsData, cached: false });
    } catch (error) {
        console.error(`Error fetching academic years for ${cacheKey}:`, error.message);
        res.status(500).json({ success: false, error: error.message || 'Failed to retrieve academic years.' });
    }
});

// --- YEAR WORK GRADES ENDPOINT ---
app.get('/api/grades/year-work', authenticateToken, async (req, res) => {
    const username = req.user.username;
    const yearId = req.query.yearId || 'default';
    const lang = req.headers['x-culture'] || 'ar';
    const cacheKey = `${username}_yearwork_${yearId}_${lang}`;
    const oldCacheKey = `${username}_yearwork_${yearId}`;

    try {
        const force = req.query.force === 'true';

        if (!force) {
            let cacheRecord = db.prepare('SELECT data, updated_at FROM cache WHERE cache_key = ?').get(cacheKey);
            
            // Backward compatibility for Arabic
            if (!cacheRecord && lang === 'ar') {
                cacheRecord = db.prepare('SELECT data, updated_at FROM cache WHERE cache_key = ?').get(oldCacheKey);
                if (cacheRecord) {
                    db.prepare('INSERT OR IGNORE INTO cache (cache_key, username, data, updated_at) VALUES (?, ?, ?, ?)').run(cacheKey, username, cacheRecord.data, cacheRecord.updated_at);
                }
            }

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
        const culturedCookies = getCulturedCookies(cookies, lang);
        const gradesData = await gradesService.fetchYearWorkGrades(culturedCookies, req.query.yearId);

        db.prepare(`
            INSERT INTO cache (cache_key, username, data, updated_at) 
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(cache_key) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP
        `).run(cacheKey, username, JSON.stringify(gradesData));

        const updatedRecord = db.prepare('SELECT updated_at FROM cache WHERE cache_key = ?').get(cacheKey);

        res.json({ success: true, data: gradesData, cached: false, updatedAt: updatedRecord.updated_at });
    } catch (error) {
        console.error(`Error fetching year work grades for ${username}:`, error.message);
        
        // Attempt to serve expired cache on UMS failure
        let cacheRecord = db.prepare('SELECT data, updated_at FROM cache WHERE cache_key = ?').get(cacheKey);
        if (!cacheRecord && lang === 'ar') {
            cacheRecord = db.prepare('SELECT data, updated_at FROM cache WHERE cache_key = ?').get(oldCacheKey);
        }

        if (cacheRecord) {
            console.log(`Serving stale cached year work grades for ${cacheKey} as fallback due to UMS error.`);
            return res.json({ 
                success: true, 
                data: JSON.parse(cacheRecord.data), 
                cached: true, 
                fallback: true,
                updatedAt: cacheRecord.updated_at 
            });
        }

        const isAr = lang === 'ar';
        const errorMsg = isAr 
            ? 'نظام UMS الرسمي غير متاح حالياً لعرض درجات أعمال السنة. يرجى المحاولة لاحقاً.' 
            : 'The official UMS is currently down for this functionality. Please try again later.';
        res.status(503).json({ success: false, error: errorMsg });
    }
});

// --- GPA ENDPOINT ---
app.get('/api/grades/gpa', authenticateToken, async (req, res) => {
    const username = req.user.username;
    const lang = req.headers['x-culture'] || 'ar';
    const cacheKey = `${username}_gpa_${lang}`;
    const oldCacheKey = `${username}_gpa`;

    try {
        const force = req.query.force === 'true';

        if (!force) {
            let cacheRecord = db.prepare('SELECT data, updated_at FROM cache WHERE cache_key = ?').get(cacheKey);
            
            // Backward compatibility for Arabic
            if (!cacheRecord && lang === 'ar') {
                cacheRecord = db.prepare('SELECT data, updated_at FROM cache WHERE cache_key = ?').get(oldCacheKey);
                if (cacheRecord) {
                    db.prepare('INSERT OR IGNORE INTO cache (cache_key, username, data, updated_at) VALUES (?, ?, ?, ?)').run(cacheKey, username, cacheRecord.data, cacheRecord.updated_at);
                }
            }

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
        const culturedCookies = getCulturedCookies(cookies, lang);
        const gpaData = await gradesService.fetchGPA(culturedCookies);

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

// --- CURRENT COURSES ENDPOINT ---
app.get('/api/grades/current-courses', authenticateToken, async (req, res) => {
    const username = req.user.username;
    const lang = req.headers['x-culture'] || 'ar';
    const cacheKey = `${username}_currentcourses_${lang}`;

    try {
        const force = req.query.force === 'true';

        if (!force) {
            let cacheRecord = db.prepare('SELECT data, updated_at FROM cache WHERE cache_key = ?').get(cacheKey);

            if (cacheRecord) {
                const updatedAt = new Date(cacheRecord.updated_at + 'Z');
                const diffSeconds = (new Date() - updatedAt) / 1000;

                if (diffSeconds < 60 * 60) { // 1 hour
                    console.log(`Serving cached current courses for ${cacheKey}`);
                    return res.json({ success: true, data: JSON.parse(cacheRecord.data), cached: true, updatedAt: cacheRecord.updated_at });
                }
            }
        }

        console.log(`Cache miss for ${cacheKey}. Scraping from UMS...`);
        const cookies = await getValidCookies(username);
        const culturedCookies = getCulturedCookies(cookies, lang);
        const coursesData = await gradesService.fetchCurrentCourses(culturedCookies);

        db.prepare(`
            INSERT INTO cache (cache_key, username, data, updated_at) 
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(cache_key) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP
        `).run(cacheKey, username, JSON.stringify(coursesData));

        const updatedRecord = db.prepare('SELECT updated_at FROM cache WHERE cache_key = ?').get(cacheKey);

        res.json({ success: true, data: coursesData, cached: false, updatedAt: updatedRecord.updated_at });
    } catch (error) {
        console.error(`Error fetching current courses for ${username}:`, error.message);
        res.status(500).json({ success: false, error: error.message || 'Failed to retrieve current courses.' });
    }
});

// --- MY ACCOUNT ENDPOINT ---
app.get('/api/grades/my-account', authenticateToken, async (req, res) => {
    const username = req.user.username;
    const lang = req.headers['x-culture'] || 'ar';
    const cacheKey = `${username}_myaccount_${lang}`;

    try {
        const force = req.query.force === 'true';

        if (!force) {
            let cacheRecord = db.prepare('SELECT data, updated_at FROM cache WHERE cache_key = ?').get(cacheKey);

            if (cacheRecord) {
                const updatedAt = new Date(cacheRecord.updated_at + 'Z');
                const diffSeconds = (new Date() - updatedAt) / 1000;

                if (diffSeconds < 24 * 60 * 60) { // 24 hours
                    return res.json({ success: true, data: JSON.parse(cacheRecord.data), cached: true, updatedAt: cacheRecord.updated_at });
                }
            }
        }

        const cookies = await getValidCookies(username);
        const culturedCookies = getCulturedCookies(cookies, lang);
        const accountData = await gradesService.fetchMyAccountInfo(culturedCookies);

        db.prepare(`
            INSERT INTO cache (cache_key, username, data, updated_at) 
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(cache_key) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP
        `).run(cacheKey, username, JSON.stringify(accountData));

        const updatedRecord = db.prepare('SELECT updated_at FROM cache WHERE cache_key = ?').get(cacheKey);

        res.json({ success: true, data: accountData, cached: false, updatedAt: updatedRecord.updated_at });
    } catch (error) {
        console.error(`Error fetching my account for ${username}:`, error.message);
        res.status(500).json({ success: false, error: error.message || 'Failed to retrieve account info.' });
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
