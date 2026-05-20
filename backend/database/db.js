const mysql = require('mysql2/promise');
require('dotenv').config();

let pool = null;

async function getPool() {
    if (!pool) {
        pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'medicine_dispenser',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
    }
    return pool;
}

async function query(sql, params = []) {
    const pool = await getPool();
    // Use query() instead of execute() for dynamic LIMIT
    const [rows] = await pool.query(sql, params);
    return rows;
}

async function logMedicine(slot, status, message = null) {
    const sql = 'INSERT INTO medicine_logs (slot, status, message) VALUES (?, ?, ?)';
    return query(sql, [slot, status, message]);
}

async function getLogs(limit = 50) {
    const sql = 'SELECT id, slot, status, message,created_at AS time FROM medicine_logs ORDER BY created_at DESC LIMIT ' + parseInt(limit);
    return query(sql, []);
}

async function updateSystemStatus(component, status, details = null) {
    const sql = 'UPDATE system_status SET status = ?, details = ? WHERE component = ?';
    return query(sql, [status, details, component]);
}

async function getSystemStatus() {
    const sql = 'SELECT * FROM system_status';
    return query(sql);
}

async function getDailyStats() {
    const sql = `
        SELECT
            DATE(created_at) as date,
            SUM(CASE WHEN slot = 1 THEN 1 ELSE 0 END) as slot1,
            SUM(CASE WHEN slot = 2 THEN 1 ELSE 0 END) as slot2,
            COUNT(*) as total
        FROM medicine_logs
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND status = 'success'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
    `;
    return query(sql);
}

module.exports = {
    getPool,
    query,
    logMedicine,
    getLogs,
    updateSystemStatus,
    getSystemStatus,
    getDailyStats
};