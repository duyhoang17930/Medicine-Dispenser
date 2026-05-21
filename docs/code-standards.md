# Medicine Dispenser - Code Standards

## 1. Project Structure

### Directory Layout
```
medicine-dispenser/
├── backend/                    # Node.js/Express API server
│   ├── database/             # Database layer
│   │   ├── db.js           # MySQL connection and queries
│   │   └── schema.sql     # Database schema
│   ├── esp32/              # ESP32 firmware source
│   │   └── medicine_dispenser_fsm/
│   │       └── medicine_dispenser_fsm.ino
│   ├── mqtt/               # MQTT client
│   │   └── mqttClient.js
│   ├── routes/             # API routes
│   │   └── medicine.js
│   ├── .env               # Environment configuration
│   ├── package.json
│   └── server.js          # Entry point
├── frontend/               # React application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── index.css     # Global styles
│   │   ├── App.js        # Main component
│   │   └── index.js     # Entry point
│   ├── .env
│   └── package.json
├── docs/                   # Documentation
├── SETUP.md              # Setup guide
└── voice-control.py       # Voice control script
```

---

## 2. Coding Standards

### 2.1 JavaScript/Node.js

#### Naming Conventions
- **Variables**: camelCase (`mqttClient`, `systemStatus`)
- **Constants**: SCREAMING_SNAKE_CASE (`MQTT_BROKER_URL`, `STATUS_TOPIC`)
- **Functions**: camelCase (`getLogs`, `publishCommand`)
- **Classes**: PascalCase (`MedicineDispenser`, `MqttClient`)
- **Files**: camelCase for modules (`mqttClient.js`), PascalCase for React components (`App.js`)

#### ESLint Configuration
```javascript
{
  "env": {
    "node": true,
    "es2021": true
  },
  "extends": "eslint:recommended",
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  },
  "rules": {
    "indent": ["error", 4],
    "semi": ["error", "always"],
    "quotes": ["error", "single"],
    "no-unused-vars": "warn",
    "no-console": "off"
  }
}
```

#### Best Practices
- Use `const` over `let`, never use `var`
- Use async/await for asynchronous operations
- Use template literals for string concatenation
- Use destructuring for object/array access
- Always validate API inputs
- Use meaningful variable names

---

### 2.2 React

#### Component Structure
```javascript
import React, { useState, useEffect } from 'react';

function ComponentName({ prop1, prop2 }) {
  // Hooks
  const [state, setState] = useState(initialValue);

  // Effects
  useEffect(() => {
    // Cleanup
    return () => cleanup();
  }, [dependency]);

  // Render
  return (
    <div className="component">
      {/* JSX */}
    </div>
  );
}

export default ComponentName;
```

#### Best Practices
- Use functional components with hooks
- Keep components focused and small
- Extract reusable logic to custom hooks
- Use proper key props in lists
- Memoize expensive calculations with `useMemo`/`useCallback`
- Define prop types with comments

---

### 2.3 SQL/Database

#### Naming Conventions
- **Tables**: snake_case (`medicine_logs`, `system_status`)
- **Columns**: snake_case (`created_at`, `last_update`)
- **Indexes**: `idx_<table>_<column>` format

#### Query Guidelines
- Use parameterized queries to prevent SQL injection
- Use connection pooling for MySQL
- Add appropriate indexes for query performance
- Use transactions for multi-step operations

---

### 2.4 ESP32/Arduino

#### Firmware Structure
```cpp
// ==================== DEFINES ====================
#define PIN_NUMBER  13

// ==================== CONSTANTS ====================
const int STEPS_PER_REV = 2048;

// ==================== STATE MACHINE ====================
enum State {
  STATE_IDLE,
  STATE_DISPENSE,
  STATE_WAIT_SENSOR,
  STATE_SUCCESS,
  STATE_ERROR
};

// ==================== VARIABLES ====================
State currentState = STATE_IDLE;

// ==================== SETUP ====================
void setup() {
  // Initialize pins
  pinMode(PIN_NUMBER, OUTPUT);
}

// ==================== LOOP ====================
void loop() {
  // FSM logic
}
```

#### Best Practices
- Use state machine for complex logic
- Define all pin numbers at the top
- Use constants for magic numbers
- Add proper comments in Vietnamese/English
- Handle errors gracefully

---

### 2.5 CSS

#### Naming Conventions
- Use BEM-like naming: `block__element--modifier`
- Example: `.card__header--active`

#### Best Practices
- Use CSS variables for theming
- Use semantic class names
- Keep specificity low
- Use Flexbox/Grid for layouts

---

## 3. API Design Guidelines

### 3.1 REST Endpoints

#### Request Format
```
POST /api/medicine/dispense
Content-Type: application/json

{
  "slot": 1
}
```

#### Response Format
```json
{
  "success": true,
  "message": "Command sent successfully"
}
```

```json
{
  "success": false,
  "error": "Error message"
}
```

### 3.2 Error Handling
- Use appropriate HTTP status codes:
  - `200` - Success
  - `400` - Bad Request (validation error)
  - `500` - Internal Server Error
- Include meaningful error messages
- Log errors on server side

---

## 4. MQTT Communication

### 4.1 Topic Naming
- Use forward slashes for hierarchy: `medicine/<component>/<action>`
- Examples: `medicine/command`, `medicine/status`, `medicine/logs`

### 4.2 Message Format
```json
{
  "slot": 1,
  "status": "success",
  "message": "Medicine dispensed",
  "timestamp": "2026-05-20T10:00:00.000Z"
}
```

### 4.3 QoS Levels
- Use QoS 0 for status updates (at most once)
- Use QoS 1 for commands (at least once)
- Use QoS 2 for critical commands (exactly once)

---

## 5. Database Queries

### 5.1 Connection Pool
```javascript
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
```

### 5.2 Query Execution
```javascript
async function query(sql, params = []) {
  const pool = await getPool();
  const [rows] = await pool.query(sql, params);
  return rows;
}
```

---

## 6. Version Control

### 6.1 Git Conventions

#### Commit Messages
- Use imperative mood: "Add feature" not "Added feature"
- Keep first line under 72 characters
- Reference issues: "Fix #123"

#### Branch Naming
- `main` - Production branch
- `feature/<name>` - New features
- `fix/<name>` - Bug fixes
- `docs/<name>` - Documentation

### 6.2 File Headers
```javascript
/**
 * Medicine Dispenser - Backend Server
 * Description: Express server entry point
 * Author: Your Name
 * Date: 2026-05-20
 */
```

---

## 7. Security

### 7.1 Environment Variables
- Never commit `.env` files
- Use `.env.example` as template
- Validate all inputs
- Use parameterized queries

### 7.2 MQTT Security
- Use authentication if available
- Use TLS/SSL for production
- Validate topic names

---

## 8. Testing

### 8.1 Backend Tests
```javascript
// Test example using Jest
describe('API Endpoints', () => {
  test('GET /api/medicine/logs returns history', async () => {
    const response = await request(app).get('/api/medicine/logs');
    expect(response.status).toBe(200);
  });
});
```

### 8.2 Integration Tests
- Test MQTT message flow
- Test database operations
- Test ESP32 communication

---

## 9. Logging

### 9.1 Log Format
```
[BACKEND] 2026-05-20T10:00:00.000Z MQTT Connected
[BACKEND] 2026-05-20T10:00:00.001Z Command sent to slot 1
```

### 9.2 Log Levels
- `ERROR` - Critical errors requiring attention
- `WARN` - Warnings that don't break functionality
- `INFO` - Important events
- `DEBUG` - Development debugging

---

## 10. File Organization

### 10.1 Import Order
```javascript
// 1. Node built-ins
const path = require('path');
const fs = require('fs');

// 2. External packages
const express = require('express');
const mqtt = require('mqtt');

// 3. Internal modules
const db = require('./database/db');
const mqttClient = require('./mqtt/mqttClient');

// 4. Local files (if any)
// import './utils';
```

### 10.2 Export Patterns
- Use module.exports for single functions/objects
- Use named exports for utility modules

---

*Document Last Updated: 2026-05-20*