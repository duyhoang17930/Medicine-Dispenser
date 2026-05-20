const express = require('express');
const router = express.Router();
const mqttClient = require('../mqtt/mqttClient');
const db = require('../database/db');

// Voice API server URL
const VOICE_API_URL = 'http://localhost:8765/record';

// POST /api/medicine/listen - Nghe và nhận diện giọng nói
router.post('/listen', async (req, res) => {
    try {
        // Call voice API server
        const response = await fetch(VOICE_API_URL, {
            method: 'POST'
        });

        const result = await response.json();

        if (result.error) {
            throw new Error(result.error);
        }

        // Publish to MQTT if slot detected
        if (result.slot) {
            mqttClient.publishCommand(result.slot);
        }

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Voice listen error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST /api/medicine/dispense - Phát thuốc
router.post('/dispense', async (req, res) => {
    try {
        const { slot } = req.body;

        // Validate slot
        if (!slot || (slot !== 1 && slot !== 2)) {
            return res.status(400).json({
                success: false,
                error: 'Slot phải là 1 hoặc 2'
            });
        }

        // Publish MQTT command
        const published = mqttClient.publishCommand(slot);

        if (published) {
            res.json({
                success: true,
                message: `Đã gửi lệnh phát thuốc số ${slot}`
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Không thể kết nối MQTT broker'
            });
        }
    } catch (error) {
        console.error('Dispense error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET /api/medicine/logs - Lấy lịch sử phát thuốc
router.get('/logs', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const logs = await db.getLogs(limit);
        res.json({ success: true, data: logs });
    } catch (error) {
        console.error('Get logs error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/medicine/stats - Lấy thống kê phát thuốc theo ngày trong tháng
router.get('/stats', async (req, res) => {
    try {
        const stats = await db.getDailyStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/medicine/status - Lấy trạng thái hệ thống
router.get('/status', async (req, res) => {
    try {
        const status = await db.getSystemStatus();
        res.json({ success: true, data: status });
    } catch (error) {
        console.error('Get status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/medicine/voice - Lưu lệnh giọng nói
router.post('/voice', async (req, res) => {
    try {
        const { command, slot, confidence } = req.body;

        if (!command || !slot) {
            return res.status(400).json({
                success: false,
                error: 'Thiếu command hoặc slot'
            });
        }

        const sql = 'INSERT INTO voice_commands (command_text, slot, confidence) VALUES (?, ?, ?)';
        await db.query(sql, [command, slot, confidence || 1.0]);

        res.json({ success: true, message: 'Đã lưu lệnh giọng nói' });
    } catch (error) {
        console.error('Voice command error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;