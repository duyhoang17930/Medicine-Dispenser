const mqtt = require('mqtt');
require('dotenv').config();

let client = null;

function init() {
    const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';

    client = mqtt.connect(brokerUrl, {
        clientId: 'medicine_backend_' + Math.random().toString(16).substr(2, 8),
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 1000,
    });

    client.on('connect', () => {
        console.log('');
        console.log('========================================');
        console.log('[BACKEND] MQTT Connected to broker');
        console.log('========================================');

        const statusTopic = process.env.MEDICINE_STATUS_TOPIC || 'medicine/status';
        client.subscribe(statusTopic, (err) => {
            if (err) {
                console.error('[BACKEND] Subscribe error:', err);
            } else {
                console.log(`[BACKEND] Subscribed to ${statusTopic}`);
            }
        });
    });

    client.on('message', async (topic, message) => {
        const timestamp = new Date().toISOString();
        console.log('');
        console.log('========================================');
        console.log(`[BACKEND] ${timestamp}`);
        console.log(`[BACKEND] MQTT RX: ${message.toString()}`);
        console.log('========================================');

        try {
            const data = JSON.parse(message.toString());
            console.log(`[BACKEND] Slot: ${data.slot}, Status: ${data.status}`);

            // Save to database
            const db = require('../database/db');
            await db.logMedicine(data.slot, data.status, data.message || null);
            await db.updateSystemStatus('esp32', 'online', 'ESP32 connected');
            console.log('[BACKEND] Saved to DB');

        } catch (error) {
            console.error('[BACKEND] Error:', error.message);
        }
    });

    client.on('error', (err) => {
        console.error('[BACKEND] MQTT Error:', err.message);
    });

    client.on('offline', () => {
        console.log('[BACKEND] MQTT Offline');
    });

    return client;
}

function publishCommand(slot) {
    const commandTopic = process.env.MEDICINE_COMMAND_TOPIC || 'medicine/command';
    const payload = JSON.stringify({ slot, timestamp: new Date().toISOString() });

    if (client && client.connected) {
        console.log('');
        console.log('========================================');
        console.log(`[BACKEND] MQTT TX: ${payload}`);
        console.log(`[BACKEND] Sending command for slot ${slot}`);
        console.log('========================================');

        client.publish(commandTopic, payload);
        return true;
    } else {
        console.error('[BACKEND] MQTT not connected');
        return false;
    }
}

function getClient() {
    return client;
}

function isConnected() {
    return client && client.connected;
}

module.exports = {
    init,
    publishCommand,
    getClient,
    isConnected
};