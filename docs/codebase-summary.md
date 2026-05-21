# Medicine Dispenser - Codebase Summary

## Overview

This document provides a comprehensive summary of the Medicine Dispenser project's codebase structure, generated from the repomix output.

**Total Files**: 25 files
**Total Tokens**: 34,397 tokens
**Generated**: 2026-05-20

---

## Directory Structure

```
.
├── .gitignore
├── backend/
│   ├── .env
│   ├── database/
│   │   ├── db.js
│   │   └── schema.sql
│   ├── esp32/
│   │   └── medicine_dispenser_fsm/
│   │       └── medicine_dispenser_fsm.ino
│   ├── mqtt/
│   │   └── mqttClient.js
│   ├── package.json
│   ├── README.md
│   ├── routes/
│   │   └── medicine.js
│   └── server.js
├── docs/
│   └── project-overview-pdr.md
├── frontend/
│   ├── .env
│   ├── .gitignore
│   ├── package.json
│   ├── public/
│   │   ├── index.html
│   │   └── manifest.json
│   ├── README.md
│   └── src/
│       ├── App.js
│       ├── components/
│       │   └── shadcn/
│       │       └── components.js
│       ├── index.css
│       └── index.js
├── run-voice.bat
├── SETUP.md
├── voice-control.py
└── example.py
```

---

## Top Files by Token Count

| Rank | File | Tokens | Percentage |
|------|------|--------|------------|
| 1 | backend/esp32/medicine_dispenser_fsm/medicine_dispenser_fsm.ino | 5,390 | 15.7% |
| 2 | frontend/src/index.css | 4,499 | 13.1% |
| 3 | frontend/src/App.js | 4,393 | 12.8% |
| 4 | frontend/README.md | 3,521 | 10.2% |
| 5 | voice-control.py | 3,055 | 8.9% |

---

## Backend Components

### Entry Point
- **backend/server.js** - Express server initialization with middleware and routes

### API Routes
- **backend/routes/medicine.js** - All REST API endpoints
  - POST `/api/medicine/dispense` - Dispense medicine
  - GET `/api/medicine/logs` - Get history
  - GET `/api/medicine/stats` - Daily statistics
  - GET `/api/medicine/status` - System status
  - POST `/api/medicine/voice` - Save voice command
  - POST `/api/medicine/listen` - Voice recognition

### Database
- **backend/database/db.js** - MySQL connection pool and queries
  - `getPool()`, `query()`, `logMedicine()`, `getLogs()`, `updateSystemStatus()`, `getSystemStatus()`, `getDailyStats()`
- **backend/database/schema.sql** - Database schema
  - Tables: `medicine_logs`, `system_status`, `voice_commands`

### MQTT
- **backend/mqtt/mqttClient.js** - MQTT client for real-time communication
  - `init()`, `publishCommand()`, `publishLogUpdate()`, `getClient()`, `isConnected()`

### ESP32 Firmware
- **backend/esp32/medicine_dispenser_fsm/medicine_dispenser_fsm.ino**
  - State machine: IDLE → DISPENSE → WAIT_SENSOR → SUCCESS/ERROR
  - Hardware: 2x Stepper 28BYJ-48, 2x IR sensors, TTP224 touch sensor

---

## Frontend Components

### Entry Point
- **frontend/src/index.js** - React app initialization

### Main Application
- **frontend/src/App.js** - Main React component
  - MQTT connection and message handling
  - Two-slot medicine control
  - Voice control (Web Speech API)
  - Activity logging
  - Offline support via localStorage

### Styles
- **frontend/src/index.css** - Global styles with CSS variables

### Components
- **frontend/src/components/shadcn/components.js** - Custom UI components

---

## Configuration Files

### Backend Environment (backend/.env)
```
PORT=3000
MQTT_BROKER_URL=mqtt://localhost:1883
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=123456
DB_NAME=medicine_dispenser
MEDICINE_COMMAND_TOPIC=medicine/command
MEDICINE_STATUS_TOPIC=medicine/status
```

### Frontend Environment (frontend/.env)
```
REACT_APP_MQTT_URL=mqtt://localhost:1883
```

---

## Technology Stack Summary

| Layer | Technology | Version |
|-------|------------|---------|
| Backend | Node.js | 18.x+ |
| Backend Framework | Express.js | 4.18.2 |
| Database | MySQL | 8.x |
| Database Driver | mysql2 | - |
| MQTT Broker | MQTT.js | - |
| Frontend | React | 18.2.0 |
| Charts | ApexCharts | - |
| MQTT Client | mqtt | 5.3.4 |
| IoT Device | ESP32 | - |
| Firmware | Arduino | - |

---

## MQTT Topic Structure

| Topic | Direction | Purpose |
|-------|------------|---------|
| `medicine/status` | ESP32 → Backend | Device status |
| `medicine/logs` | Backend → Frontend | Real-time log updates |
| `medicine/command` | Frontend/Backend → ESP32 | Dispense commands |
| `medicine/command/ack` | Backend → Frontend | Command acknowledgment |

---

## API Summary

### Backend API Endpoints

| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|---------------|
| GET | `/health` | Health check | - |
| POST | `/api/medicine/dispense` | Dispense medicine | `{ slot: 1\|2 }` |
| GET | `/api/medicine/logs` | Get history | `?limit=N` |
| GET | `/api/medicine/stats` | Daily statistics (30 days) | - |
| GET | `/api/medicine/status` | System component status | - |
| POST | `/api/medicine/voice` | Save voice command | `{ command, slot, confidence }` |
| POST | `/api/medicine/listen` | Voice recognition | - |

---

## Database Schema

### medicine_logs
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| slot | INT | Slot number (1 or 2) |
| status | VARCHAR(20) | success, fail, no_pill_detected |
| message | VARCHAR(255) | Additional message |
| created_at | TIMESTAMP | Creation timestamp |

### system_status
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| component | VARCHAR(50) | esp32, mqtt, servo1, servo2, ir_sensor |
| status | VARCHAR(20) | online, offline, error |
| last_update | TIMESTAMP | Last update timestamp |
| details | TEXT | Additional details |

### voice_commands
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| command_text | VARCHAR(255) | Original command |
| slot | INT | Associated slot |
| confidence | FLOAT | Recognition confidence |
| created_at | TIMESTAMP | Creation timestamp |

---

## Key Features

1. **Two-Slot Medicine Dispensing** - Control panel for Thuốc Ho (Slot 1) and Thuốc Sốt (Slot 2)
2. **Real-time MQTT Communication** - Live status updates between ESP32, backend, and frontend
3. **30-Day Statistics Chart** - Daily dispensing history visualization with ApexCharts
4. **Activity/History Log** - Track all dispense events with status (pending/success/error)
5. **Voice Control** - Web Speech API (Vietnamese) + backend Whisper integration
6. **Offline Support** - localStorage caching for offline operation

---

## Hardware Configuration

### ESP32 Connections

| GPIO | Component |
|------|-----------|
| 26, 27, 14, 13 | Stepper Motor 1 (Slot 1) |
| 16, 17, 18, 19 | Stepper Motor 2 (Slot 2) |
| 35 | IR Sensor 1 |
| 34 | IR Sensor 2 |
| 32 | Touch Sensor A1 |
| 33 | Touch Sensor A2 |

---

*Generated from repomix-output.xml*