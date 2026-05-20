"""
Voice-controlled medicine dispenser
- Receives audio via MQTT or HTTP from frontend
- Transcribes speech to text using Faster Whisper
- Publishes result to MQTT for ESP32
- Debounce to prevent double trigger
"""

import sys
import os
import json
import base64
import difflib
import readchar
import unicodedata
import time
from pathlib import Path

# Audio config
SAMPLE_RATE = 16000
DURATION = int(os.environ.get("VOICE_DURATION", "5"))
AUDIO_FILE = Path(__file__).parent / "record.wav"
INPUT_DEVICE = os.environ.get("VOICE_INPUT_DEVICE") or None

# Keywords - order matters (compound first, single chars last)
KEYWORDS_MAP = {
    "thuốc ho": 1,
    "thuốc hò": 1,
    "thuốc sốt": 2,
    "sốt": 2,
    "họ": 1,
    "hò": 1,
    # English
    "medicine": 1,
    "fever": 2,
    "cough": 1,
    "give me medicine": 1,
}

# MQTT config
MQTT_BROKER = os.environ.get("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.environ.get("MQTT_PORT", "1883"))
MQTT_AUDIO_TOPIC = os.environ.get("MQTT_AUDIO_TOPIC", "medicine/audio")  # frontend -> this
MQTT_VOICE_TOPIC = os.environ.get("MQTT_VOICE_TOPIC", "medicine/command")  # this -> ESP32

# HTTP API config
API_HOST = os.environ.get("VOICE_API_HOST", "localhost")
API_PORT = int(os.environ.get("VOICE_API_PORT", "8765"))

# Whisper config
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "large-v3-turbo")
WHISPER_DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")

try:
    import paho.mqtt.client as mqtt
    MQTT_AVAILABLE = True
except ImportError:
    MQTT_AVAILABLE = False

# Global state - init once
mqtt_client = None
mqtt_connected = False
whisper_model = None  # Load once

# Debounce to prevent double trigger
last_trigger_time = 0
DEBOUNCE_SECONDS = 2


def mqtt_on_connect(client, userdata, flags, rc):
    global mqtt_connected
    if rc == 0:
        mqtt_connected = True
        print("[MQTT] Connected")
        client.subscribe(MQTT_AUDIO_TOPIC)
        print(f"[MQTT] Subscribed to {MQTT_AUDIO_TOPIC}")
    else:
        print(f"[MQTT] Connection failed: {rc}")


def mqtt_on_message(client, userdata, msg):
    """Handle incoming audio from frontend via MQTT"""
    print(f"[MQTT] Received on {msg.topic}")
    process_audio_from_mqtt(msg.payload)


def process_audio_from_mqtt(payload_bytes):
    """Process audio data from MQTT message"""
    try:
        payload = json.loads(payload_bytes.decode())
        audio_b64 = payload.get("audio", "")
        if not audio_b64:
            print("[MQTT] No audio in payload")
            return

        audio_data = base64.b64decode(audio_b64)
        if not audio_data:
            print("[MQTT] Empty audio data")
            return

        # Save and process
        AUDIO_FILE.write_bytes(audio_data)
        process_audio()

    except Exception as e:
        print(f"[MQTT] Error: {e}")


def process_audio():
    """Process saved audio file"""
    global last_trigger_time, whisper_model

    # Debounce check
    now = time.time()
    if now - last_trigger_time < DEBOUNCE_SECONDS:
        print("[SKIP] Debounce - too soon")
        return

    if not whisper_model:
        print("[ERROR] Model not loaded")
        return

    print("Processing audio...")

    transcript = transcribe_audio(whisper_model)
    slot = detect_keyword(transcript)

    print(f"You said: {transcript}")
    if slot:
        print(f"=> Detected: Slot {slot}")
        # Debounce
        last_trigger_time = now
    else:
        print("=> No keyword detected")

    publish_result(slot, transcript)
    clean_up()


def transcribe_audio(model):
    """Transcribe saved audio file"""
    segments, _ = model.transcribe(
        str(AUDIO_FILE),
        language="vi",
        beam_size=2,
        vad_filter=True,
    )
    text = " ".join(s.text for s in segments)
    return normalize_text(text.strip())


def init_mqtt():
    """Init MQTT - called only once"""
    global mqtt_client
    if not MQTT_AVAILABLE:
        print("[MQTT] paho-mqtt not installed")
        return None

    if mqtt_client is not None:
        print("[MQTT] Already initialized")
        return mqtt_client

    client = mqtt.Client()
    client.on_connect = mqtt_on_connect
    client.on_message = mqtt_on_message

    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_start()
        time.sleep(0.5)
        mqtt_client = client
        return client
    except Exception as e:
        print(f"[MQTT] Error: {e}")
        return None


def remove_tones(text: str) -> str:
    """Remove Vietnamese tones for matching (hò -> ho, sốt -> sot)"""
    # Vietnamese tone marks to remove
    tone_map = {
        "àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổõộùúủũụưừứửữựỳýỷỹỵđ"
        "àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổõộùúủũụưừứửữựỳýỷỹỵđ": "",
    }
    result = text.lower()
    for tones, plain in tone_map.items():
        for char in tones:
            if char in result:
                result = result.replace(char, plain)
    return result


def normalize_text(text: str) -> str:
    """Normalize text for comparison"""
    text = text.lower().strip()
    text = unicodedata.normalize("NFC", text)
    return " ".join(text.split())


def is_match(text: str, keyword: str, threshold: float = 0.6) -> bool:
    """Fuzzy match text with keyword - word based, not substring"""
    text = normalize_text(text)
    keyword = normalize_text(keyword)

    # Remove tones for matching (hò -> ho, sốt -> sot)
    text_no_tone = remove_tones(text)
    keyword_no_tone = remove_tones(keyword)

    words = text.split()
    words_no_tone = text_no_tone.split()
    keyword_words = keyword.split()  # e.g., ["thuốc", "ho"]
    keyword_words_no_tone = keyword_no_tone.split()

    # Check each keyword word against each text word
    for i, kw in enumerate(keyword_words):
        kw_no_tone = keyword_words_no_tone[i]
        matched = False
        for j, word in enumerate(words):
            # Exact match
            if kw == word:
                matched = True
                break
            # Tone-agnostic match (ho ~ hò, sốt ~ sot)
            word_no_tone = words_no_tone[j]
            if kw_no_tone == word_no_tone:
                print(f"  [Tone] '{word}' ~ '{kw}'")
                matched = True
                break
            # Fuzzy match
            ratio = difflib.SequenceMatcher(None, word, kw).ratio()
            if ratio >= threshold:
                print(f"  [Fuzzy] '{word}' ~ '{kw}' ({ratio:.2f})")
                matched = True
                break
        if not matched:
            return False

    return True


def publish_result(slot: int | None, transcript: str):
    """Publish result to MQTT"""
    global mqtt_connected

    if not mqtt_connected or not mqtt_client:
        print("[MQTT] Not connected")
        return

    payload = {
        "type": "voice_command",
        "slot": slot,
        "transcript": transcript,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }

    print("\n---RESULT---")
    print(json.dumps(payload, ensure_ascii=False))
    print("---END---\n")

    mqtt_client.publish(MQTT_VOICE_TOPIC, json.dumps(payload, ensure_ascii=False))
    print(f"[MQTT] Published to {MQTT_VOICE_TOPIC}")


def detect_keyword(text: str) -> int | None:
    """Detect medicine keyword with fuzzy matching"""
    normalized = normalize_text(text)

    # Check compound keywords first (higher priority)
    for keyword, slot in KEYWORDS_MAP.items():
        if is_match(normalized, keyword):
            return slot

    return None


def clean_up():
    """Clean up temp files"""
    try:
        if AUDIO_FILE.exists():
            AUDIO_FILE.unlink()
    except OSError:
        pass


def load_whisper_model():
    """Load whisper model"""
    from faster_whisper import WhisperModel
    return WhisperModel(WHISPER_MODEL, device=WHISPER_DEVICE, compute_type=WHISPER_COMPUTE_TYPE)


def run_http_server(model):
    """HTTP server mode - receives audio from frontend"""
    from http.server import HTTPServer, BaseHTTPRequestHandler
    import numpy as np

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            if self.path != "/record":
                self.send_response(404)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Not found"}).encode())
                return

            try:
                content_length = int(self.headers.get("Content-Length", 0))

                # Check if audio provided in body
                audio_data = None
                if content_length > 0:
                    body = self.rfile.read(content_length)
                    payload = json.loads(body.decode())
                    audio_b64 = payload.get("audio", "")
                    if audio_b64:
                        audio_data = base64.b64decode(audio_b64)

                # Record from local mic if no audio provided
                if not audio_data:
                    print("[HTTP] Recording from local mic...")
                    import sounddevice as sd
                    from scipy.io.wavfile import write

                    audio = sd.rec(int(DURATION * SAMPLE_RATE), samplerate=SAMPLE_RATE, channels=1, dtype=np.int16)
                    sd.wait()
                    write(AUDIO_FILE, SAMPLE_RATE, audio.astype(np.int16))
                else:
                    AUDIO_FILE.write_bytes(audio_data)

                process_audio()

                result = {
                    "transcript": transcribe_audio(model) if AUDIO_FILE.exists() else "",
                    "slot": detect_keyword(transcribe_audio(model)) if AUDIO_FILE.exists() else None
                }

                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps(result, ensure_ascii=False).encode())

            except Exception as e:
                print(f"Error: {e}")
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())

        def log_message(self, format, *args):
            pass

    print("=== Voice API Server ===")
    print(f"HTTP: http://{API_HOST}:{API_PORT}/record")
    print(f"MQTT: {MQTT_BROKER}:{MQTT_PORT}")
    print(f"  Publish: {MQTT_VOICE_TOPIC} (to ESP32)")

    server = HTTPServer((API_HOST, API_PORT), Handler)
    server.serve_forever()


def run_interactive(model):
    """Interactive mode with local mic"""
    import sounddevice as sd
    from scipy.io.wavfile import write
    import numpy as np

    print("\n=== Voice Medicine Controller ===")
    print("Keywords: 'thuốc ho'/'ho' -> Slot 1, 'sốt' -> Slot 2")
    print("Press ENTER to record from local mic...")
    print("Press ESC or Ctrl+C to quit\n")

    while True:
        try:
            sys.stdout.write("> ")
            sys.stdout.flush()
            key = readchar.readkey()

            if key in ("\r", "\n"):
                print()
                print(f"Recording {DURATION}s from local mic...")

                audio = sd.rec(int(DURATION * SAMPLE_RATE), samplerate=SAMPLE_RATE, channels=1, dtype=np.int16)
                sd.wait()
                write(AUDIO_FILE, SAMPLE_RATE, audio.astype(np.int16))

                process_audio()

            elif key in ("\x1b", "\x03"):
                print("\nQuit")
                break

        except KeyboardInterrupt:
            print("\nQuit")
            break


def main():
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--server", action="store_true", help="Run HTTP server")
    args = parser.parse_args()

    global whisper_model
    global mqtt_client

    print(f"Loading Whisper model: {WHISPER_MODEL}...")
    whisper_model = load_whisper_model()
    print("Ready!")

    # Init MQTT ONLY ONCE
    mqtt_client = init_mqtt()

    if args.server:
        run_http_server(whisper_model)
        return

    print("\n=== Listening for audio via MQTT ===")
    print(f"  Subscribe: {MQTT_AUDIO_TOPIC}")
    print(f"  Publish:  {MQTT_VOICE_TOPIC}")
    print(f"  Debounce: {DEBOUNCE_SECONDS}s")
    print("  Press ENTER to record from local mic")
    print("  Press ESC to quit\n")

    run_interactive(whisper_model)

    if mqtt_client:
        mqtt_client.disconnect()

    clean_up()


if __name__ == "__main__":
    main()