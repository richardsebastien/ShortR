import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

export const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DB,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Self-healing database migration
export async function runMigrations() {
    try {
        // Check if users table exists
        const [tables] = await pool.query("SHOW TABLES LIKE 'users'");
        if (tables.length === 0) {
            console.log("Database tables do not exist yet. Skipping column check.");
            return;
        }

        // Check columns in users table
        const [columns] = await pool.query("SHOW COLUMNS FROM users");
        const columnNames = columns.map(c => c.Field);

        if (!columnNames.includes('reset_token')) {
            console.log("Migrating database: Adding reset_token column to users table...");
            await pool.query("ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) NULL");
        }
        if (!columnNames.includes('reset_token_expires')) {
            console.log("Migrating database: Adding reset_token_expires column to users table...");
            await pool.query("ALTER TABLE users ADD COLUMN reset_token_expires DATETIME NULL");
        }

        // Check columns in urls table
        const [urlColumns] = await pool.query("SHOW COLUMNS FROM urls");
        const urlColumnNames = urlColumns.map(c => c.Field);

        if (!urlColumnNames.includes('expires_at')) {
            console.log("Migrating database: Adding expires_at column to urls table...");
            await pool.query("ALTER TABLE urls ADD COLUMN expires_at DATETIME NULL");
        }
        if (!urlColumnNames.includes('max_clicks')) {
            console.log("Migrating database: Adding max_clicks column to urls table...");
            await pool.query("ALTER TABLE urls ADD COLUMN max_clicks INT UNSIGNED NULL");
        }
        if (!urlColumnNames.includes('password_hash')) {
            console.log("Migrating database: Adding password_hash column to urls table...");
            await pool.query("ALTER TABLE urls ADD COLUMN password_hash VARCHAR(255) NULL");
        }
        if (!urlColumnNames.includes('mobile_target')) {
            console.log("Migrating database: Adding mobile_target column to urls table...");
            await pool.query("ALTER TABLE urls ADD COLUMN mobile_target TEXT NULL");
        }

        console.log("Database migrations checked and up-to-date.");
    } catch (err) {
        console.error("Database migration check failed:", err);
    }
}
