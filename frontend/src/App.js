import React, { useState, useEffect, useCallback, useRef } from 'react';
import mqtt from 'mqtt';

const MQTT_URL = process.env.REACT_APP_MQTT_URL || 'mqtt://localhost:1883';
const STATUS_TOPIC = 'medicine/status';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'vi-VN';
    recognition.interimResults = false;
}

function App() {
    const [logs, setLogs] = useState([]);
    const [mqttStatus, setMqttStatus] = useState({ connected: false });
    const [dispensing, setDispensing] = useState(false);
    const [listening, setListening] = useState(false);
    const [voiceTranscript, setVoiceTranscript] = useState('');
    const [activityLog, setActivityLog] = useState([]);

    const clientRef = useRef(null);

    // Helper to add log
    const addLog = useCallback((msg) => {
        const timestamp = new Date().toLocaleTimeString();
        setActivityLog(prev => [`[${timestamp}] ${msg}`, ...prev].slice(0, 20));
    }, []);

    // Connect MQTT
    useEffect(() => {
        const client = mqtt.connect(MQTT_URL);

        client.on('connect', () => {
            addLog('FRONTEND: MQTT Connected');
            setMqttStatus({ connected: true });
            client.subscribe(STATUS_TOPIC);
        });

        client.on('message', (topic, message) => {
            try {
                const data = JSON.parse(message.toString());
                addLog(`FRONTEND: RX ${JSON.stringify(data)}`);
                if (data.status) {
                    setLogs(prev => [data, ...prev]);
                }
            } catch (e) {
                addLog(`FRONTEND: Parse error - ${e.message}`);
            }
        });

        client.on('error', (err) => {
            addLog(`FRONTEND: MQTT Error - ${err.message}`);
            setMqttStatus({ connected: false });
        });

        client.on('offline', () => {
            addLog('FRONTEND: MQTT Offline');
            setMqttStatus({ connected: false });
        });

        clientRef.current = client;

        return () => { client.end(); };
    }, [addLog]);

    // Dispense
    const dispense = useCallback(async (slot) => {
        setDispensing(true);
        addLog(`FRONTEND: Click dispense slot ${slot}`);
        try {
            const response = await fetch('http://localhost:3000/api/medicine/dispense', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slot })
            });
            const data = await response.json();
            addLog(`FRONTEND: HTTP Response - ${JSON.stringify(data)}`);
        } catch (error) {
            addLog(`FRONTEND: Error - ${error.message}`);
        } finally {
            setDispensing(false);
        }
    }, [addLog]);

    // Voice
    const startListening = useCallback(() => {
        if (!recognition) {
            addLog('FRONTEND: Voice not supported');
            return;
        }
        setListening(true);
        setVoiceTranscript('Đang nghe...');
        addLog('FRONTEND: Voice started');
        recognition.start();
    }, [addLog]);

    const handleVoiceResult = useCallback(async (event) => {
        const transcript = event.results[0][0].transcript;
        addLog(`FRONTEND: Voice result - "${transcript}"`);
        setVoiceTranscript(transcript);

        const text = transcript.toLowerCase();
        let slot = null;
        if (text.includes('thuốc 1') || text.includes('1')) slot = 1;
        else if (text.includes('thuốc 2') || text.includes('2')) slot = 2;
        else if (text.includes('thuốc')) slot = 1;

        if (slot) {
            dispense(slot);
            setVoiceTranscript(`Đã phát thuốc số ${slot}`);
        } else {
            setVoiceTranscript(`Không hiểu: ${transcript}`);
        }
        setTimeout(() => setListening(false), 2000);
    }, [dispense, addLog]);

    const handleVoiceError = useCallback((event) => {
        addLog(`FRONTEND: Voice error - ${event.error}`);
        setListening(false);
    }, [addLog]);

    useEffect(() => {
        if (recognition) {
            recognition.onresult = handleVoiceResult;
            recognition.onerror = handleVoiceError;
            recognition.onend = () => setListening(false);
        }
    }, [handleVoiceResult, handleVoiceError]);

    const formatTime = (t) => t ? new Date(t).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN');

    return (
        <div id="app">
            <header className="header">
                <h1>Hộp Thuốc Thông Minh</h1>
                <p>MQTT Realtime</p>
            </header>

            <div className="container">
                {/* Activity Log */}
                <div className="card" style={{marginBottom: 20}}>
                    <h2>Activity Log</h2>
                    <div style={{background: '#1a1a1a', color: '#0f0', padding: 10, borderRadius: 8, fontFamily: 'monospace', fontSize: 12, maxHeight: 150, overflow: 'auto'}}>
                        {activityLog.map((log, i) => (
                            <div key={i}>{log}</div>
                        ))}
                    </div>
                </div>

                {/* Status */}
                <div className="dashboard">
                    <div className="card">
                        <h2>Trạng Thái</h2>
                        <div className="status-grid">
                            <div className="status-item">
                                <span className={`status-dot ${mqttStatus.connected ? 'online' : 'offline'}`}></span>
                                <span className="status-label">MQTT</span>
                            </div>
                            <div className="status-item">
                                <span className={`status-dot ${mqttStatus.connected ? 'online' : 'offline'}`}></span>
                                <span className="status-label">ESP32</span>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <h2>Điều Khiển</h2>
                        <div className="control-buttons">
                            <button className="btn btn-primary" onClick={() => dispense(1)} disabled={dispensing}>
                                Phát Thuốc 1
                            </button>
                            <button className="btn btn-secondary" onClick={() => dispense(2)} disabled={dispensing}>
                                Phát Thuốc 2
                            </button>
                        </div>
                        {listening && <div className="voice-status">{voiceTranscript}</div>}
                        {recognition && (
                            <button className={`btn voice-btn ${listening ? 'listening' : ''}`} onClick={startListening} disabled={listening}>
                                🎤 Giọng nói
                            </button>
                        )}
                    </div>
                </div>

                {/* Logs */}
                <div className="card">
                    <h2>Lịch Sử Phát Thuốc</h2>
                    {logs.length === 0 ? (
                        <div className="empty-state">Chưa có lịch sử</div>
                    ) : (
                        <div className="btn-list">
                            {logs.map((log, i) => (
                                <div key={i} className={`log-item ${log.status}`}>
                                    <span className="log-slot">Thuốc {log.slot}</span>
                                    <span className="log-time">{formatTime(log.time)}</span>
                                    <span className={`log-status ${log.status}`}>
                                        {log.status === 'success' ? 'OK' : 'Lỗi'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default App;