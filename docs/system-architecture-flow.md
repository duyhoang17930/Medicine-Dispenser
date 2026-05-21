# System Architecture Flow - Corrected

## Application Layer

```json
{
  "user": {
    "inputs": [
      "button_press",
      "voice_input"
    ]
  },
  "web_app": {
    "tech": [
      "React",
      "ApexCharts"
    ],
    "api": "HTTP REST GET/POST /api/...",
    "mqtt": "mqtt.js (direct subscription)"
  }
}
```

---

## Service/Data Layer

### Backend (Node.js + Express)

| Component | Detail |
|-----------|--------|
| **Tech** | Node.js, Express |
| **HTTP** | `POST /record` → Voice Module |
| **MQTT TCP** | `medicine/command`, `medicine/logs`, `medicine/status` |
| **Database** | INSERT log, SELECT stats |

### Voice Module (Python)

| Component | Detail |
|-----------|--------|
| **Tech** | Python, Faster Whisper |
| **Input** | Microphone recording |
| **Output** | HTTP JSON response |
| **Connection** | HTTP POST from backend (NOT MQTT) |

### Database

| Component | Detail |
|-----------|--------|
| **Type** | MySQL |

---

## Network Layer

### MQTT Broker (Mosquitto)

| Property | Value |
|----------|-------|
| **Software** | Mosquitto |
| **Port** | 1883 |
| **Topics** | `medicine/command`, `medicine/status`, `medicine/command/ack`, `medicine/logs` |
| **Protocol** | TCP MQTT (mqtt.js) |

---

## Hardware Layer

### ESP32

| Component | Detail |
|-----------|--------|
| **Framework** | Arduino |
| **Devices** | |
| - Stepper (x2) | 28BYJ-48, GPIO |
| - IR Sensor (x2) | Digital IN, detect medicine |
| - TTP224 | Touch sensor (x4), Digital IN |

---

## Corrected Data Flows

### Flow 1: Button Press Dispense

```
User Click
    │
    ▼
┌─────────────────────────────────┐
│         Frontend (React)           │
│  - mqtt.js subscribe            │
└─────────────────────────────────┘
    │ HTTP POST /api/medicine/dispense
    ▼
┌─────────────────────────────────┐
│       Backend (Express)          │
│  - Validate slot (1 or 2)       │
│  - mqtt.publish(command)        │
└─────────────────────────────────┘
    │ MQTT TCP
    ▼
┌─────────────────────────────────┐
│       MQTT Broker               │
│  - Topic: medicine/command      │
└─────────────────────────────────┘
    │ MQTT TCP
    ▼
┌─────────────────────────────────┐
│         ESP32                    │
│  - FSM: IDLE → DISPENSE        │
│  - Activate stepper motor       │
│  - IR sensor check            │
└─────────────────────────────────┘
    │ MQTT TCP
    ▼
┌─────────────────────────────────┐
│       MQTT Broker               │
│  - Topic: medicine/status     │
└─────────────────────────────────┘
    │ MQTT TCP
    ▼
┌─────────────────────────────────┐
│       Backend                  │
│  - Save to MySQL            │
│  - mqtt.publish(logs)       │
└────────────���────────────────────┘
    │ MQTT TCP broadcast
    ▼
┌─────────────────────────────────┐
│      Frontend (React)          │
│  - Update UI (real-time)    │
└─────────────────────────────────┘
```

### Flow 2: Voice Input Dispense

```
User Speak
    │
    ▼
┌─────────────────────────────────┐
│         Frontend (React)         │
│  - Web Speech API capture       │
│  - HTTP POST /api/medicine/listen
└─────────────────────────────────┘
    │ HTTP POST
    ▼
┌─────────────────────────────────┐
│       Backend (Express)          │
│  - HTTP POST /record           │
│  (to Voice Module)           │
└─────────────────────────────────┘
    │ HTTP POST
    ▼
┌─────────────────────────────────┐
│     Voice Module (Python)         │
│  - Record audio (pyaudio)     │
│  - Faster Whisper transcribe   │
│  - Return JSON {slot, error} │
└─────────────────────────────────┘
    │ HTTP response
    ▼
┌─────────────────────────────────┐
│       Backend (Express)          │
│  - If slot detected:          │
│  - mqtt.publish(command)    │
└─────────────────────────────────┘
    │ (same as Flow 1 from here)
    ▼
    MQTT Broker → ESP32 → Backend → Frontend
```

---

## Connections Summary

| From | To | Protocol |
|------|-----|---------|
| Frontend | Backend | HTTP |
| Frontend | MQTT Broker | MQTT (mqtt.js) |
| Backend | Voice Module | HTTP |
| Backend | MQTT Broker | MQTT TCP |
| Backend | Database | MySQL |
| MQTT Broker | ESP32 | MQTT TCP |