# Backend API Documentation

## Base URL
`http://localhost:3000`

## API Endpoints

### 1. Phát thuốc
```
POST /api/medicine/dispense
Content-Type: application/json

Body:
{
    "slot": 1  // hoặc 2
}

Response:
{
    "success": true,
    "message": "Đã gửi lệnh phát thuốc số 1"
}
```

### 2. Lấy lịch sử phát thuốc
```
GET /api/medicine/logs?limit=50
```

### 3. Lấy trạng thái hệ thống
```
GET /api/medicine/status
```

### 4. Lưu lệnh giọng nói
```
POST /api/medicine/voice
Content-Type: application/json

Body:
{
    "command": "Uống thuốc sáng",
    "slot": 1,
    "confidence": 0.95
}
```

### 5. Health Check
```
GET /health
```

## Socket.io Events

### Client listening:
- `medicine:status` - Trạng thái phát thuốc
- `medicine:logs` - Lịch sử phát thuốc
- `system:status` - Trạng thái hệ thống
- `mqtt:status` - Trạng thái MQTT

### Client emitting:
- `request:initial-data` - Yêu cầu dữ liệu ban đầu

## MQTT Topics

### Subscribe
- `medicine/status` - Nhận trạng thái từ ESP32

### Publish
- `medicine/command` - Gửi lệnh tới ESP32

## Cài đặt

```bash
cd backend
npm install
cp .env.example .env
# Chỉnh sửa .env với thông tin MySQL và MQTT broker
npm start
```