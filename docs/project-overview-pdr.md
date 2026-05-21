# Medicine Dispenser - Project Overview and PDR

## 1. Project Overview

### Project Name
**Medicine Dispenser** (Máy Phát Thuốc Tự Động)

### Project Type
IoT-enabled medicine dispensing system with voice control

### Core Functionality
An automated two-slot medicine dispenser controlled via web interface and voice commands. The system integrates ESP32 hardware with a Node.js/Express backend and React frontend to provide real-time medicine dispensing control, tracking, and statistics.

### Target Users
- Patients who need automated medication reminders
- Caregivers monitoring elderly or ill patients
- Medical facilities requiring automated dispensing

---

## 2. Product Development Requirements (PDR)

### 2.1 Functional Requirements

#### FR-001: Medicine Dispensing Control
- **Description**: Users must be able to dispense medicine from two slots (Slot 1: Thuốc Ho/Cough Medicine, Slot 2: Thuốc Sốt/Fever Medicine)
- **Priority**: High
- **Acceptance Criteria**:
  - API endpoint `/api/medicine/dispense` accepts POST with `{ slot: 1|2 }`
  - MQTT command published to `medicine/command` topic
  - ESP32 receives command and activates servo motor

#### FR-002: Real-time Status Updates
- **Description**: System must provide real-time status updates via MQTT
- **Priority**: High
- **Acceptance Criteria**:
  - MQTT topics: `medicine/status`, `medicine/logs`, `medicine/command`
  - Frontend receives status within 2 seconds of action

#### FR-003: Activity/History Logging
- **Description**: All dispense events must be logged with timestamps and status
- **Priority**: High
- **Acceptance Criteria**:
  - Logs stored in `medicine_logs` table
  - API endpoint `/api/medicine/logs` returns history
  - Display shows pending/success/error status

#### FR-004: 30-Day Statistics
- **Description**: Daily dispensing statistics must be available for 30 days
- **Priority**: Medium
- **Acceptance Criteria**:
  - API endpoint `/api/medicine/stats` returns daily counts
  - Frontend displays ApexCharts bar chart
  - Separate counts for slot 1 and slot 2

#### FR-005: System Status Monitoring
- **Description**: Real-time monitoring of system components
- **Priority**: Medium
- **Acceptance Criteria**:
  - API endpoint `/api/medicine/status` returns component states
  - Components tracked: esp32, mqtt, servo1, servo2, ir_sensor

#### FR-006: Voice Control - Web Speech API
- **Description**: Voice command recognition using browser Web Speech API
- **Priority**: Medium
- **Acceptance Criteria**:
  - Language set to Vietnamese (vi-VN)
  - Recognized commands trigger dispense action
  - Visual feedback during listening

#### FR-007: Voice Control - Backend Whisper
- **Description**: Backend voice recognition via external API
- **Priority**: Low
- **Acceptance Criteria**:
  - POST `/api/medicine/listen` calls external voice API
  - Returns recognized slot and confidence score

#### FR-008: Offline Support
- **Description**: Application must work offline with cached data
- **Priority**: Medium
- **Acceptance Criteria**:
  - localStorage caches logs and stats
  - UI displays cached data when offline

### 2.2 Non-Functional Requirements

#### NFR-001: Performance
- **Response Time**: API responses within 500ms
- **MQTT Latency**: End-to-end command under 2 seconds

#### NFR-002: Reliability
- **Uptime**: 99% during operation hours
- **Error Handling**: All errors logged with meaningful messages

#### NFR-003: Security
- **Input Validation**: All API inputs validated
- **Environment Variables**: Sensitive data in .env files

#### NFR-004: Maintainability
- **Modular Architecture**: Separate backend/frontend/ESP32 firmware
- **Logging**: Consistent logging format across all modules

---

## 3. Technical Stack

| Layer | Technology | Version |
|-------|-------------|---------|
| Backend Runtime | Node.js | 18.x+ |
| Backend Framework | Express.js | 4.18.2 |
| Frontend Framework | React | 18.2.0 |
| Real-time Communication | MQTT | 5.3.4 |
| Database | MySQL (mysql2) | 8.x |
| Charts | ApexCharts | - |
| IoT Device | ESP32 | - |
| Firmware | Arduino | - |

---

## 4. Database Schema

### Tables
- `medicine_logs`: Dispense history
- `system_status`: Component states
- `voice_commands`: Voice command history

---

## 5. MQTT Topics

| Topic | Direction | Purpose |
|-------|------------|---------|
| `medicine/status` | ESP32 → Backend | Device status updates |
| `medicine/logs` | Backend → Frontend | Real-time log notifications |
| `medicine/command` | Frontend/Backend → ESP32 | Dispense commands |

---

## 6. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/medicine/dispense` | Dispense medicine (slot 1 or 2) |
| GET | `/api/medicine/logs` | Get medicine history |
| GET | `/api/medicine/stats` | Get daily statistics |
| GET | `/api/medicine/status` | Get system status |
| POST | `/api/medicine/voice` | Save voice command |
| POST | `/api/medicine/listen` | Voice recognition |
| GET | `/health` | Health check |

---

## 7. Acceptance Criteria Summary

| ID | Feature | Success Condition |
|----|---------|-------------------|
| AC-1 | Dispense Slot 1 | Command sent to ESP32, servo activates |
| AC-2 | Dispense Slot 2 | Command sent to ESP32, servo activates |
| AC-3 | Real-time Updates | Frontend receives status within 2s |
| AC-4 | View History | Logs displayed with correct status |
| AC-5 | View Statistics | 30-day chart displays correctly |
| AC-6 | Voice Control | Vietnamese voice triggers dispense |
| AC-7 | Offline Mode | App loads cached data when offline |

---

## 8. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-05-20 | Initial PDR |

---

*Document Created: 2026-05-20*