# Medicine Dispenser - System Architecture

## 1. Overview

The Medicine Dispenser is a full-stack IoT application with the following architecture:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER INTERFACE                                 │
│                              (React)                                     │
│            ┌──────────────┬──────────────┬──────────────┐                │
│            │   Control    │   Status    │   Charts    │                │
│            │   Panel     │   Display   │   (Apex)   │                │
│            └──────────────┴──────────────┴──────────────┘                │
└─────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ MQTT / HTTP
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BACKEND SERVER                                    │
│                        (Node.js/Express)                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │  REST API   │  │   MQTT     │  │  Database  │                  │
│  │  Routes    │  │  Client    │  │  (MySQL)   │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ MQTT
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        ESP32 DEVICE                                     │
│                    (Arduino Firmware)                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │   FSM      │  │  Stepper    │  │   IR/      │                  │
│  │  Logic     │  │  Motors     │  │  Touch     │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. System Components

### 2.1 Frontend (React)

| Component | File | Description |
|-----------|------|-------------|
| App | `frontend/src/App.js` | Main React application |
| Index | `frontend/src/index.js` | Entry point |
| Styles | `frontend/src/index.css` | Global CSS styles |
| UI Components | `frontend/src/components/shadcn/components.js` | Custom UI library |

**Features Implemented:**
- Medicine slot control panel (2 slots)
- Real-time MQTT subscription
- 30-day statistics chart (ApexCharts)
- Activity log display
- Voice control (Web Speech API)
- Offline support (localStorage)

---

### 2.2 Backend (Node.js/Express)

| Component | File | Description |
|-----------|------|-------------|
| Server | `backend/server.js` | Express app entry point |
| Routes | `backend/routes/medicine.js` | All API endpoints |
| Database | `backend/database/db.js` | MySQL connection layer |
| MQTT | `backend/mqtt/mqttClient.js` | MQTT client wrapper |

**API Endpoints:**
```
GET    /health                    # Health check
POST   /api/medicine/dispense    # Dispense medicine (slot 1|2)
GET    /api/medicine/logs       # Get history
GET    /api/medicine/stats      # Get daily statistics
GET    /api/medicine/status     # Get system status
POST   /api/medicine/voice     # Save voice command
POST   /api/medicine/listen     # Voice recognition
```

---

### 2.3 Database (MySQL)

| Table | Purpose |
|-------|---------|
| `medicine_logs` | Dispense event history |
| `system_status` | Component status tracking |
| `voice_commands` | Voice command history |

---

### 2.4 ESP32 Firmware

| Component | Description |
|-----------|-------------|
| State Machine | FSM: IDLE → DISPENSE → WAIT_SENSOR → SUCCESS/ERROR |
| Stepper Motors | 2x 28BYJ-48 with ULN2003 driver |
| IR Sensors | Slot presence detection |
| Touch Sensor | TTP224 capacitive touch |

---

## 3. Communication Flow

### 3.1 Dispense Command Flow

```
User Click
    │
    ▼
┌─────────────┐
│  Frontend  │
│  (App.js)  │
└─────────────┘
    │ POST /api/medicine/dispense
    ▼
┌─────────────┐
│   Backend   │
│  (server)   │
└─────────────┘
    │ Publish to MQTT topic
    ▼
┌─────────────┐
│    ESP32    │
│  (firmware) │
└─────────────┘
    │ Activate stepper motor
    │ Read IR sensor
    ▼
┌─────────────┐
│    ESP32    │
│  Publishes  │
│  status    │
└─────────────┘
    │ MQTT message to backend
    ▼
┌─────────────┐
│   Backend  │
│  Save to   │
│  Database  │
└─────────────┘
    │ MQTT broadcast
    ▼
┌─────────────┐
│  Frontend  │
│ Update UI  │
└─────────────┘
```

### 3.2 MQTT Topics

| Topic | Publisher | Subscribers | Purpose |
|-------|-----------|------------|---------|
| `medicine/command` | Frontend, Backend | ESP32 | Dispense commands |
| `medicine/command/ack` | Backend | Frontend | Command acknowledgment |
| `medicine/status` | ESP32 | Backend | Device status |
| `medicine/logs` | Backend | Frontend | Real-time log updates |

### 3.3 Message Formats

#### Command Message
```json
{
  "slot": 1,
  "timestamp": "2026-05-20T10:00:00.000Z"
}
```

#### Status Message
```json
{
  "slot": 1,
  "status": "success",
  "message": "Medicine dispensed",
  "time": "2026-05-20T10:00:00.000Z"
}
```

---

## 4. Data Flow

### 4.1 Data Persistence

```
┌────────────��─┐      ┌──────────────┐
│   Frontend  │──────│  localStorage │
│            │      │  (cache)     │
└──────────────┘      └──────────────┘
        │                      │
        │ HTTP               │
        ▼                   │ (offline)
┌──────────────┐      ┌──────────────┐
│   Backend   │──────│    MySQL    │
│            │      │  Database   │
└──────────────┘      └──────────────┘
```

### 4.2 Statistics Data

- Endpoint: `GET /api/medicine/stats`
- Returns: 30-day daily counts by slot
- Cached by frontend in localStorage for offline access

---

## 5. State Machine (ESP32)

### FSM States

```
┌─────────┐
│  IDLE   │◄─────────────────────────────┐
└─────────┘                            │
    │ Receive command                   │
    ▼                                  │
┌──────────────┐        ┌──────────────┤
│  DISPENSE   │───────►│    ERROR     │
│ (activate   │        │ (timeout or  │
│  stepper)   │        │  no pill)    │
└──────────────┘        └──────────────┘
    │
    │ Sensor triggered
    ▼
┌─────────────────┐
│ WAIT_SENSOR     │
│ (read IR for    │
│  presence)      │
└─────────────────┘
    │
    │ Pill detected
    ▼
┌─────────────┐
│  SUCCESS   │──────────────────────────┘
└─────────────┘
```

### State Transitions

| Current State | Event | Next State |
|--------------|-------|-----------|
| IDLE | Command received | DISPENSE |
| DISPENSE | Motor complete | WAIT_SENSOR |
| DISPENSE | Error | ERROR |
| WAIT_SENSOR | Pill detected | SUCCESS |
| WAIT_SENSOR | Timeout | ERROR |
| SUCCESS | Complete | IDLE |
| ERROR | Reset | IDLE |

---

## 6. Hardware Architecture

### 6.1 ESP32 Pin Assignment

```
┌────────────────────────────────────────────────────────────┐
│                         ESP32                              │
├────────────────────────────────────────────────────────────┤
│ GPIO 26 ───► IN1_A (Stepper 1)                             │
│ GPIO 27 ───► IN2_A                                         │
│ GPIO 14 ───► IN3_A                                         │
│ GPIO 13 ───► IN4_A                                         │
├────────────────────────────────────────────────────────────┤
│ GPIO 16 ───► IN1_B (Stepper 2)                             │
│ GPIO 17 ───► IN2_B                                         │
│ GPIO 18 ───► IN3_B                                         │
│ GPIO 19 ───► IN4_B                                         │
├────────────────────────────────────────────────────────────┤
│ GPIO 35 ───► IR1 (Slot 1 sensor)                           │
│ GPIO 34 ───► IR2 (Slot 2 sensor)                           │
├────────────────────────────────────────────────────────────┤
│ GPIO 32 ───► TOUCH_A1 (Slot 1 touch)                       │
│ GPIO 33 ───► TOUCH_A2 (Slot 2 touch)                       │
└────────────────────────────────────────────────────────────┘
```

### 6.2 Power Requirements

| Component | Voltage | Current |
|-----------|---------|---------|
| ESP32 | 3.3V | 500mA max |
| Stepper Motors | 5V | 500mA each |
| ULN2003 | 5V | - |

---

## 7. Security Architecture

### 7.1 Network Isolation
- MQTT broker on local network
- Backend accessible via localhost (development)
- No authentication currently implemented

### 7.2 Input Validation
- Slot validation (1 or 2 only)
- SQL injection prevention via parameterized queries
- JSON validation on all endpoints

---

## 8. Scalability Considerations

### 8.1 Current Limitations
- Single ESP32 device support
- Local MQTT broker
- Single MySQL instance

### 8.2 Future Improvements
- Multiple device support via device ID
- Cloud MQTT broker
- Database clustering
- User authentication

---

## 9. Deployment Architecture

### 9.1 Development Setup
```

[Browser] ───► [localhost:3000] ───► [localhost:1883 (MQTT)]
                              │
                              ▼
                        [localhost:3306 (MySQL)]
```

### 9.2 Production Considerations
- Reverse proxy (nginx) for frontend
- PM2 for backend process management
- TLS for MQTT (if supported by broker)

---

## 10. Error Handling

### 10.1 Frontend Errors
- MQTT connection failure: Show offline indicator
- API failure: Display error Toast
- Voice recognition failure: Fallback to manual input

### 10.2 Backend Errors
- Database error: Log and return 500
- MQTT error: Log and return 500
- Validation error: Return 400 with message

### 10.3 ESP32 Errors
- Motor failure: Publish error status
- Sensor timeout: Publish error status
- WiFi disconnect: Attempt reconnection

---

*Document Last Updated: 2026-05-20*