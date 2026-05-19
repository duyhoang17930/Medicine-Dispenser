require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mqttClient = require('./mqtt/mqttClient');
const medicineRoutes = require('./routes/medicine');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/medicine', medicineRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize MQTT (sẽ emit events)
mqttClient.init();

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;