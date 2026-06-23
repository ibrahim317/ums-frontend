const Database = require('better-sqlite3');
const path = require('path');

// Detect if running inside a packaged binary (pkg)
const isPkg = typeof process.pkg !== 'undefined';
const baseDir = isPkg ? path.dirname(process.execPath) : path.join(__dirname, '../../');
const dbPath = path.join(baseDir, 'auth.db');

let db;
if (isPkg) {
    const bindingPath = path.join(baseDir, 'better_sqlite3.node');
    db = new Database(dbPath, { nativeBinding: bindingPath });
} else {
    db = new Database(dbPath);
}

// Initialization script to ensure tables exist and schema is correct
const initDb = () => {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS cache (
            cache_key TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            data TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS academic_years_cache (
            username TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
    
    console.log('Database initialized successfully with new schema.');
};

initDb();

module.exports = db;
