const mqtt = require('mqtt');
require('dotenv').config();

let client = null;

// Topic names at module scope
const STATUS_TOPIC = process.env.MEDICINE_STATUS_TOPIC || 'medicine/status';
const LOGS_TOPIC = process.env.MEDICINE_LOGS_TOPIC || 'medicine/logs';
const COMMAND_TOPIC = process.env.MEDICINE_COMMAND_TOPIC || 'medicine/command';
const COMMAND_ACK_TOPIC = COMMAND_TOPIC + '/ack';

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

        // Use module-level topic constants
        client.subscribe(STATUS_TOPIC, (err) => {
            if (err) {
                console.error('[BACKEND] Subscribe error:', err);
            } else {
                console.log(`[BACKEND] Subscribed to ${STATUS_TOPIC}`);
            }
        });
        client.subscribe(LOGS_TOPIC, (err) => {
            if (err) {
                console.error('[BACKEND] Subscribe logs error:', err);
            }
        });
        client.subscribe(COMMAND_TOPIC, (err) => {
            if (err) {
                console.error('[BACKEND] Subscribe command error:', err);
            } else {
                console.log(`[BACKEND] Subscribed to ${COMMAND_TOPIC}`);
            }
        });
    });

    client.on('message', async (topic, message) => {
        const timestamp = new Date().toISOString();
        console.log('');
        console.log('========================================');
        console.log(`[BACKEND] ${timestamp}`);
        console.log(`[BACKEND] MQTT RX [${topic}]: ${message.toString()}`);
        console.log('========================================');

        try {
            const data = JSON.parse(message.toString());
            const commandTopic = process.env.MEDICINE_COMMAND_TOPIC || 'medicine/command';

            // Handle command from frontend (has timestamp, no status, no type=command_ack)
            // Also ignore messages we already processed (source: 'backend')
            if (topic === COMMAND_TOPIC && data.timestamp && !data.status && data.type !== 'command_ack' && data.source !== 'backend') {
                console.log(`[BACKEND] Command for slot ${data.slot} from frontend`);

                // Add source to prevent loop when we re-publish
                const payload = JSON.stringify({ slot: data.slot, timestamp: data.timestamp, source: 'backend' });
                client.publish(COMMAND_TOPIC, payload); // ESP32 listens on this too

                // Send acknowledge back to frontend via separate topic (avoid loop)
                const ack = { type: 'command_ack', slot: data.slot, status: 'sent', timestamp: new Date().toISOString() };
                client.publish(COMMAND_ACK_TOPIC, JSON.stringify(ack));

                console.log(`[BACKEND] Forwarded command to ESP32`);
                return;
            }

            // Handle status from ESP32 (has status field)
            if (data.status) {
                console.log(`[BACKEND] Slot: ${data.slot}, Status: ${data.status}`);

                // Save to database
                const db = require('../database/db');
                await db.logMedicine(data.slot, data.status, data.message || null);
                await db.updateSystemStatus('esp32', 'online', 'ESP32 connected');
                console.log('[BACKEND] Saved to DB');

                // Publish log update to frontend
                const logUpdate = {
                    slot: data.slot,
                    status: data.status,
                    message: data.message,
                    time: new Date().toISOString()
                };
                require('./mqttClient').publishLogUpdate(logUpdate);
            }

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

// Publish log update to notify frontend of DB changes
function publishLogUpdate(log) {
    const logsTopic = process.env.MEDICINE_LOGS_TOPIC || 'medicine/logs';
    const payload = JSON.stringify({
        type: 'log',
        data: log,
        timestamp: new Date().toISOString()
    });

    if (client && client.connected) {
        client.publish(logsTopic, payload);
        console.log(`[BACKEND] Published log update: slot ${log.slot}, status ${log.status}`);
    }
}

module.exports = {
    init,
    publishCommand,
    publishLogUpdate,
    getClient,
    isConnected
};