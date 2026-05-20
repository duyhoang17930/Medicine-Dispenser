"""
Voice-controlled medicine dispenser.

- Interactive mode: press ENTER to record.
- Server mode: POST /record for the backend/frontend flow.
- API mode: record once and print a JSON result.
"""

import argparse
import difflib
import json
import os
import sys
import time
import unicodedata
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path


SAMPLE_RATE = 16000
DURATION = int(os.environ.get("VOICE_DURATION", "7"))
AUDIO_FILE = Path(__file__).parent / "record.wav"
INPUT_DEVICE = os.environ.get("VOICE_INPUT_DEVICE") or None
API_HOST = os.environ.get("VOICE_API_HOST", "localhost")
API_PORT = int(os.environ.get("VOICE_API_PORT", "8765"))
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "large-v3-turbo")
WHISPER_DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")
MQTT_BROKER = os.environ.get("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.environ.get("MQTT_PORT", "1883"))
MQTT_VOICE_TOPIC = os.environ.get("MQTT_VOICE_TOPIC", "medicine/voice")


KEYWORDS = [
    ("thuốc ho", 1),
    ("thuốc sốt", 2),
    ("ho", 1),
    ("sốt", 2),
    ("cough", 1),
    ("fever", 2),
    ("medicine", 1),
    ("give me medicine", 1),
]


try:
    import paho.mqtt.client as mqtt

    MQTT_AVAILABLE = True
except ImportError:
    MQTT_AVAILABLE = False


mqtt_client = None
mqtt_connected = False


def mqtt_on_connect(client, userdata, flags, rc):
    global mqtt_connected
    mqtt_connected = rc == 0
    if mqtt_connected:
        print("[MQTT] Connected")
    else:
        print(f"[MQTT] Connection failed: {rc}")


def init_mqtt():
    if not MQTT_AVAILABLE:
        print("[MQTT] paho-mqtt is not installed; skipping MQTT publish")
        return None

    client = mqtt.Client()
    client.on_connect = mqtt_on_connect

    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_start()
        time.sleep(0.5)
        return client
    except Exception as exc:
        print(f"[MQTT] Error: {exc}")
        return None


def normalize_text(text: str) -> str:
    text = text.lower().strip()
    text = unicodedata.normalize("NFC", text)
    return " ".join(text.split())


def is_match(text: str, keyword: str, threshold: float = 0.75) -> bool:
    text = normalize_text(text)
    keyword = normalize_text(keyword)

    if keyword in text:
        return True

    words = text.split()
    keyword_len = len(keyword.split())

    for index in range(len(words) - keyword_len + 1):
        phrase = " ".join(words[index : index + keyword_len])
        ratio = difflib.SequenceMatcher(None, phrase, keyword).ratio()

        if ratio >= threshold:
            print(f"Gần khớp: '{phrase}' ~ '{keyword}' ({ratio:.2f})")
            return True

    return False


def detect_keyword(text: str) -> tuple[int | None, str | None]:
    normalized = normalize_text(text)

    for keyword, slot in KEYWORDS:
        if is_match(normalized, keyword):
            return slot, keyword

    return None, None


def load_whisper_model():
    from faster_whisper import WhisperModel

    return WhisperModel(
        WHISPER_MODEL,
        device=WHISPER_DEVICE,
        compute_type=WHISPER_COMPUTE_TYPE,
    )


def record_and_transcribe(model) -> str:
    import numpy as np
    import sounddevice as sd
    from scipy.io.wavfile import write

    print(f"Đang ghi âm {DURATION} giây...")

    kwargs = {
        "samplerate": SAMPLE_RATE,
        "channels": 1,
        "dtype": "int16",
    }

    if INPUT_DEVICE is not None:
        kwargs["device"] = int(INPUT_DEVICE) if INPUT_DEVICE.isdigit() else INPUT_DEVICE
        print(f"Using input device: {INPUT_DEVICE}")

    audio = sd.rec(int(DURATION * SAMPLE_RATE), **kwargs)
    sd.wait()

    max_val = np.abs(audio).max()
    if max_val > 0 and max_val < 500:
        gain = min(5000 / max_val, 10)
        audio = (audio * gain).clip(-32768, 32767).astype(np.int16)
        print(f"Amplified by {gain:.1f}x")

    write(AUDIO_FILE, SAMPLE_RATE, audio)
    print("Đang nhận diện giọng nói...")

    segments, _ = model.transcribe(
        str(AUDIO_FILE),
        language="vi",
        beam_size=5,
        vad_filter=False,
    )

    transcript = " ".join(segment.text for segment in segments)
    return normalize_text(transcript)


def clean_up():
    try:
        if AUDIO_FILE.exists():
            AUDIO_FILE.unlink()
    except OSError:
        pass


def publish_result(slot: int | None, transcript: str, matched_keyword: str | None = None):
    payload = {
        "type": "voice_command",
        "slot": slot,
        "matched_keyword": matched_keyword,
        "transcript": transcript,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }

    print("\n---RESULT---")
    print(json.dumps(payload, ensure_ascii=False))
    print("---END---\n")

    if mqtt_client and mqtt_connected:
        mqtt_client.publish(MQTT_VOICE_TOPIC, json.dumps(payload, ensure_ascii=False))
        print("[MQTT] Published")


def handle_record(model) -> dict:
    transcript = record_and_transcribe(model)
    slot, matched_keyword = detect_keyword(transcript)

    print("=" * 40)
    print("Bạn nói:", transcript)

    if slot:
        print(f"Phát hiện: {matched_keyword} -> Slot {slot}")
    else:
        print("Không có từ khóa phù hợp.")

    publish_result(slot, transcript, matched_keyword)
    clean_up()

    return {
        "transcript": transcript,
        "slot": slot,
        "matched_keyword": matched_keyword,
    }


def run_once(model):
    try:
        return handle_record(model)
    except Exception as exc:
        clean_up()
        print(f"Error: {exc}", file=sys.stderr)
        return {"error": str(exc)}


def run_interactive(model):
    try:
        import readchar
    except ImportError:
        print("Thiếu thư viện readchar. Cài bằng: pip install readchar")
        return

    print("\n=== Voice Medicine Controller ===")
    print("Từ khóa: 'thuốc ho'/'ho' -> Slot 1, 'thuốc sốt'/'sốt' -> Slot 2")
    print("Nhấn ENTER để ghi âm, ESC hoặc Ctrl+C để thoát.\n")

    while True:
        try:
            sys.stdout.write("> ")
            sys.stdout.flush()
            key = readchar.readkey()

            if key in ("\r", "\n"):
                print()
                run_once(model)
            elif key in ("\x1b", "\x03"):
                print("\nQuit")
                break
        except KeyboardInterrupt:
            print("\nQuit")
            break


def run_server(model):
    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            if self.path != "/record":
                self.send_response(404)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Not found"}).encode("utf-8"))
                return

            try:
                result = handle_record(model)
                status = 200
            except Exception as exc:
                clean_up()
                result = {"error": str(exc)}
                status = 500

            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps(result, ensure_ascii=False).encode("utf-8"))

        def log_message(self, format, *args):
            return

    print("=== Voice API Server ===")
    print(f"Server ready on http://{API_HOST}:{API_PORT}/record")
    server = HTTPServer((API_HOST, API_PORT), Handler)
    server.serve_forever()


def main():
    global mqtt_client

    parser = argparse.ArgumentParser()
    parser.add_argument("--api", action="store_true", help="Record once and print JSON")
    parser.add_argument("--server", action="store_true", help="Run HTTP voice server")
    args = parser.parse_args()

    mqtt_client = init_mqtt()

    print(f"Loading Whisper model: {WHISPER_MODEL}...")
    model = load_whisper_model()
    print("Ready!")

    try:
        if args.server:
            run_server(model)
        elif args.api:
            run_once(model)
        else:
            run_interactive(model)
    finally:
        if mqtt_client:
            mqtt_client.disconnect()
        clean_up()


if __name__ == "__main__":
    main()
