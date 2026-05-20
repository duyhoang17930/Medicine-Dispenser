import React, { useState, useEffect, useCallback, useRef } from 'react';
import Chart from 'react-apexcharts';
import mqtt from 'mqtt';
import { Card, CardHeader } from './components/shadcn/components';
import { Button, StatusItem, LogItem, EmptyState, ActivityLog, VoiceButton } from './components/shadcn/components';

const MQTT_URL = process.env.REACT_APP_MQTT_URL || 'mqtt://localhost:1883';
const STATUS_TOPIC = 'medicine/status';
const LOGS_TOPIC = 'medicine/logs';
const COMMAND_TOPIC = 'medicine/command';
const COMMAND_ACK_TOPIC = 'medicine/command/ack';

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
  const [espStatus, setEspStatus] = useState({ connected: false, lastSeen: null });
  const [dispensing, setDispensing] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [activityLog, setActivityLog] = useState([]);
  const [dailyStats, setDailyStats] = useState([]);

  const clientRef = useRef(null);
  const dispatchRef = useRef({ lastTime: 0, slot: null });

  // Helper to add log
  const addLog = useCallback((msg) => {
    const timestamp = new Date().toLocaleTimeString();
    setActivityLog((prev) => [`[${timestamp}] ${msg}`, ...prev].slice(0, 20));
  }, []);

  // Connect MQTT
  useEffect(() => {
    const client = mqtt.connect(MQTT_URL);

    client.on('connect', () => {
      addLog('FRONTEND: MQTT Connected');
      setMqttStatus({ connected: true });
      client.subscribe(STATUS_TOPIC);
      client.subscribe(LOGS_TOPIC);
      // Don't subscribe to COMMAND_TOPIC - we only publish to it
      // Subscribe to ack topic instead
      client.subscribe(COMMAND_ACK_TOPIC);
    });

    client.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        addLog(`FRONTEND: RX ${JSON.stringify(data)}`);

        // Track ESP32 status
        if (topic === STATUS_TOPIC && (data.type === 'status' || data.device === 'esp32')) {
          setEspStatus({ connected: true, lastSeen: new Date() });
        }

        // Handle real-time log updates from DB
        if (topic === LOGS_TOPIC && data.type === 'log') {
          addLog(`FRONTEND: DB Update - slot ${data.data.slot} ${data.data.status}`);

          // Update pending log to success (or add new if no pending exists)
          setLogs((prev) => {
            const pendingIndex = prev.findIndex(
              (log) => log.slot === data.data.slot && log.status === 'pending'
            );
            if (pendingIndex >= 0) {
              // Convert pending to the actual status from ESP32
              const updated = [...prev];
              updated[pendingIndex] = data.data;
              return updated;
            }
            return [data.data, ...prev].slice(0, 50);
          });
        }

        // Add log to history (update pending to success)
        if (data.status && topic === STATUS_TOPIC) {
          setLogs((prev) => {
            const pendingIndex = prev.findIndex(
              (log) => log.slot === data.slot && log.status === 'pending'
            );
            if (pendingIndex >= 0) {
              const updated = [...prev];
              updated[pendingIndex] = { slot: data.slot, status: data.status, message: data.message, time: new Date().toISOString() };
              return updated;
            }
            return [data, ...prev];
          });
        }

        // Handle command response (backend confirms command sent)
        if (topic === COMMAND_ACK_TOPIC && data.type === 'command_ack') {
          addLog(`FRONTEND: Command ${data.slot} acknowledged - ${data.status}`);
          setDispensing(false);
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

    return () => {
      client.end();
    };
  }, [addLog]);

  // Fetch initial history from API (fallback)
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('http://localhost:3000/api/medicine/logs');
        const json = await res.json();
        if (json.success && json.data) {
          setLogs(json.data);
          addLog('FRONTEND: Initial history loaded');
        }
      } catch (e) {
        // Silent fail - MQTT will provide updates
      }
    };

    fetchHistory();

    // Request history via MQTT (backend will respond on logs topic)
    const client = clientRef.current;
    if (client && client.connected) {
      client.publish(LOGS_TOPIC, JSON.stringify({ type: 'history_request' }));
    }

    // Periodic refresh as fallback (every 60s)
    const interval = setInterval(fetchHistory, 60000);
    return () => clearInterval(interval);
  }, [addLog]);

  // Fetch daily stats for chart
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('http://localhost:3000/api/medicine/stats');
        const json = await res.json();
        if (json.success && json.data) {
          const formatted = json.data.map((d) => ({
            ...d,
            date: new Date(d.date).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' }),
          }));
          setDailyStats(formatted);
        }
      } catch (e) {
        console.log('Stats fetch error:', e.message);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  // Check ESP32 online status
  useEffect(() => {
    const checkEspStatus = () => {
      if (espStatus.lastSeen) {
        const elapsed = Date.now() - espStatus.lastSeen.getTime();
        if (elapsed > 15000) {
          setEspStatus((prev) => ({ ...prev, connected: false }));
        }
      }
    };

    const interval = setInterval(checkEspStatus, 5000);
    return () => clearInterval(interval);
  }, [espStatus.lastSeen]);

  // Auto-timeout: fail pending logs after 10 seconds
  useEffect(() => {
    const timeout = setInterval(() => {
      setLogs((prev) =>
        prev.map((log) => {
          if (log.status === 'pending') {
            const elapsed = Date.now() - new Date(log.time).getTime();
            if (elapsed > 60000) {
              addLog(`FRONTEND: Timeout - slot ${log.slot} no response`);
              return { ...log, status: 'error', message: 'ESP32 không phản hồi' };
            }
          }
          return log;
        })
      );
    }, 1000);
    return () => clearInterval(timeout);
  }, [addLog]);

  // Dispense
  const dispense = useCallback(
    async (slot) => {
      // Debounce: ignore clicks within 3 seconds
      const now = Date.now();
      if (dispatchRef.current.slot === slot && now - dispatchRef.current.lastTime < 3000) {
        addLog(`FRONTEND: Ignored duplicate click (debounce)`);
        return;
      }
      dispatchRef.current = { lastTime: now, slot };

      setDispensing(true);

      // Instant UI: Add pending log immediately
      const pendingLog = { slot, status: 'pending', time: new Date().toISOString() };
      setLogs((prev) => [pendingLog, ...prev].slice(0, 50));
      addLog(`FRONTEND: Sending MQTT command slot ${slot}...`);

      // Send via MQTT instead of HTTP
      const client = clientRef.current;
      if (client && client.connected) {
        const payload = JSON.stringify({ slot, timestamp: new Date().toISOString() });
        client.publish(COMMAND_TOPIC, payload);
        addLog(`FRONTEND: Published to ${COMMAND_TOPIC}`);
        // Don't set dispensing false yet - wait for ESP32 response
      } else {
        // Fallback to HTTP if MQTT not connected
        try {
          await fetch('http://localhost:3000/api/medicine/dispense', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slot }),
          });
        } catch (error) {
          setLogs((prev) =>
            prev.map((log) =>
              log.slot === slot && log.status === 'pending'
                ? { ...log, status: 'error', message: error.message }
                : log
            )
          );
          addLog(`FRONTEND: Error - ${error.message}`);
        }
        setDispensing(false);
      }
    },
    [addLog]
  );

  // Voice - use backend whisper
  const startListening = useCallback(async () => {
    if (listening) return;
    setListening(true);
    setVoiceTranscript('Đang nghe...');
    addLog('FRONTEND: Requesting voice from backend...');

    try {
      const response = await fetch('http://localhost:3000/api/medicine/listen', {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success && data.data) {
        const { transcript, slot } = data.data;
        setVoiceTranscript(transcript);
        addLog(`FRONTEND: Backend result - "${transcript}" -> slot ${slot}`);

        if (slot) {
          await dispense(slot);
          setVoiceTranscript(`Đã phát thuốc số ${slot}`);
        } else {
          setVoiceTranscript(`Không hiểu: ${transcript}`);
        }
      }
    } catch (error) {
      addLog(`FRONTEND: Voice error - ${error.message}`);
      setVoiceTranscript('Lỗi kết nối');
    }

    setTimeout(() => setListening(false), 2000);
  }, [addLog, listening]);

  const handleVoiceResult = useCallback(
    async (event) => {
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
    },
    [dispense, addLog]
  );

  const handleVoiceError = useCallback(
    (event) => {
      addLog(`FRONTEND: Voice error - ${event.error}`);
      setListening(false);
    },
    [addLog]
  );

  useEffect(() => {
    if (recognition) {
      recognition.onresult = handleVoiceResult;
      recognition.onerror = handleVoiceError;
      recognition.onend = () => setListening(false);
    }
  }, [handleVoiceResult, handleVoiceError]);

  const formatTime = (t) => (t ? new Date(t).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN'));

  return (
    <div id="app">
      <header className="header">
        <h1>Hộp Thuốc Thông Minh</h1>
        <p>MQTT Realtime</p>
      </header>

      <div className="container">
        {/* Activity Log */}
        <Card style={{ marginBottom: 20 }}>
          <CardHeader title="System Log" />
          <ActivityLog logs={activityLog} />
        </Card>

        {/* Status & Control */}
        <div className="dashboard">
          <Card>
            <CardHeader title="Trạng Thái" />
            <div className="status-grid">
              <StatusItem label="MQTT" online={mqttStatus.connected} />
              <StatusItem label="ESP32" online={espStatus.connected} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Điều Khiển" />
            <div className="control-buttons">
              <Button variant="primary" onClick={() => dispense(1)} disabled={dispensing}>
                Phát Thuốc 1
              </Button>
              <Button variant="secondary" onClick={() => dispense(2)} disabled={dispensing}>
                Phát Thuốc 2
              </Button>
            </div>
            {listening && (
              <div className="voice-status">{voiceTranscript}</div>
            )}
            {recognition && (
              <VoiceButton listening={listening} onClick={startListening} disabled={listening} />
            )}
          </Card>
        </div>

        {/* Stats Chart */}
        <Card>
          <CardHeader title="Thống Kê 30 Ngày" />
          {dailyStats.length === 0 ? (
            <EmptyState message="Chưa có dữ liệu" />
          ) : (
            <div className="chart-container">
              <Chart
                type="bar"
                height={300}
                options={{
                  chart: {
                    type: 'bar',
                    stacked: true,
                    background: 'transparent',
                    toolbar: { show: false },
                    animations: { enabled: true, speed: 800 },
                    fontFamily: 'inherit',
                  },
                  plotOptions: {
                    bar: {
                      horizontal: false,
                      columnWidth: '70%',
                      borderRadius: 4,
                      distributed: false,
                      rangeBarGroupRows: false,
                    },
                  },
                  colors: ['#fbbf24', '#60a5fa'],
                  grid: {
                    borderColor: 'rgba(255,255,255,0.05)',
                    strokeDashArray: 3,
                    yaxis: { lines: { show: true } },
                    xaxis: { lines: { show: false } },
                  },
                  xaxis: {
                    categories: dailyStats.map(d => d.date),
                    labels: {
                      style: { colors: '#94a3b8', fontSize: '12px' },
                    },
                    axisBorder: { show: false },
                    axisTicks: { show: false },
                    tickPlacement: 'between',
                  },
                  yaxis: {
                    labels: {
                      style: { colors: '#94a3b8', fontSize: '12px' },
                    },
                    tickAmount: 5,
                    forceNiceTicks: true,
                    min: 0,
                    decimalsInFloat: false,
                  },
                  tooltip: {
                    theme: 'dark',
                    style: { fontSize: '12px' },
                    y: {
                      formatter: (val) => Number(val) || 0,
                    },
                  },
                  legend: {
                    position: 'top',
                    horizontalAlign: 'right',
                    fontSize: '12px',
                    markers: { radius: 4 },
                    labels: { colors: '#94a3b8' },
                    itemMargin: { horizontal: 12 },
                  },
                  dataLabels: { enabled: false },
                  stroke: { show: true, width: 0 },
                  states: {
                    hover: { filter: { type: 'brighten', value: 0.15 } },
                  },
                }}
                series={[
                  { name: 'Thuốc 1', data: dailyStats.map(d => d.slot1) },
                  { name: 'Thuốc 2', data: dailyStats.map(d => d.slot2) },
                ]}
              />
            </div>
          )}
        </Card>

        {/* Logs */}
        <Card>
          <CardHeader title="Lịch Sử Phát Thuốc" />
          {logs.length === 0 ? (
            <EmptyState message="Chưa có lịch sử" />
          ) : (
            <div className="btn-list">
              {logs.map((log, i) => (
                <LogItem key={i} slot={log.slot} time={formatTime(log.time)} status={log.status} />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default App;