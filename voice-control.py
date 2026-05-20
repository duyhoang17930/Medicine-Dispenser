"""
Voice-controlled medicine dispenser
- Press ENTER to record audio (5 seconds)
- Transcribes speech to text using Faster Whisper
- Detects keywords and publishes to MQTT
- Outputs JSON result
"""

import sys
import os
import json
import threading
import time
import readchar
from pathlib import Path

# Audio config
SAMPLE_RATE = 16000
DURATION = 5
AUDIO_FILE = Path(__file__).parent / "record.wav"
INPUT_DEVICE = None  # Let system choose

# Keywords
KEYWORDS_MAP = {
    "thuốc ho": 1,
    "ho": 1,
    "thuốc sốt": 2,
    "sốt": 2,
    # English
    "medicine": 1,
    "cough": 1,
    "fever": 2,
    "give me medicine": 1,
}

# MQTT config
MQTT_BROKER = os.environ.get("MQTT_BROKER", "localhost")

# API server mode - uses long-running process
API_PORT = 8765

try:
    import paho.mqtt.client as mqtt
    MQTT_AVAILABLE = True
except ImportError:
    MQTT_AVAILABLE = False

# Global MQTT client
mqtt_client = None
mqtt_connected = False


def mqtt_on_connect(client, userdata, flags, rc):
    global mqtt_connected
    if rc == 0:
        mqtt_connected = True
        print("[MQTT] Connected")
    else:
        print(f"[MQTT] Connection failed: {rc}")


def init_mqtt():
    global mqtt_client
    if not MQTT_AVAILABLE:
        return None

    client = mqtt.Client()
    client.on_connect = mqtt_on_connect
    try:
        client.connect(MQTT_BROKER, 1883, 60)
        client.loop_start()
        time.sleep(0.5)
        return client
    except Exception as e:
        print(f"[MQTT] Error: {e}")
        return None


def publish_result(slot: int | None, transcript: str):
    payload = {
        "type": "voice_command",
        "slot": slot,
        "transcript": transcript,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }

    # Print JSON to stdout
    print("\n---RESULT---")
    print(json.dumps(payload))
    print("---END---\n")

    # Send to MQTT if available
    if mqtt_client and mqtt_connected:
        mqtt_client.publish("medicine/voice", json.dumps(payload))
        print("[MQTT] Published")


def load_whisper_model():
    """Lazy load whisper model"""
    from faster_whisper import WhisperModel
    return WhisperModel("base", device="cpu", compute_type="int8")


def record_and_transcribe(model):
    """Record audio and transcribe"""
    import sounddevice as sd
    from scipy.io.wavfile import write
    import numpy as np

    print(f"Recording {DURATION}s...")

    # Record audio - try specific device if set
    kwargs = {
        'samplerate': SAMPLE_RATE,
        'channels': 1,
        'dtype': np.int16
    }
    if INPUT_DEVICE is not None:
        kwargs['device'] = INPUT_DEVICE
        print(f"Using input device: {INPUT_DEVICE}")

    audio = sd.rec(int(DURATION * SAMPLE_RATE), **kwargs)
    sd.wait()

    # Amplify if too quiet
    max_val = np.abs(audio).max()
    if max_val > 0 and max_val < 500:
        gain = min(5000 / max_val, 10)
        audio = (audio * gain).clip(-32768, 32767).astype(np.int16)
        print(f"Amplified by {gain:.1f}x")

    # Save to file
    write(AUDIO_FILE, SAMPLE_RATE, audio)
    print("Transcribing...")

    # Transcribe
    segments, _ = model.transcribe(
        str(AUDIO_FILE),
        language="vi",
        beam_size=2,
        vad_filter=True
    )

    text = " ".join(s.text for s in segments)
    return text.strip()


def detect_keyword(text: str) -> int | None:
    """Detect medicine keyword"""
    lower = text.lower()

    # Check compound keywords first (Vietnamese)
    if "thuốc ho" in lower:
        return 1
    if "thuốc sốt" in lower or "sốt" in lower:
        return 2
    if "ho" in lower:  # "ho" alone = cough = slot 1
        return 1

    # Use KEYWORDS_MAP for other matches
    for keyword, slot in KEYWORDS_MAP.items():
        if keyword in lower:
            return slot

    return None


def clean_up():
    """Clean up temp files"""
    if AUDIO_FILE.exists():
        AUDIO_FILE.unlink()


def run_once(model):
    """Run single recording/transcription (non-interactive mode for API)"""
    import sys
    print("run_once started", file=sys.stderr, flush=True)
    try:
        print("Recording audio...", file=sys.stderr, flush=True)
        # Record and transcribe
        transcript = record_and_transcribe(model)

        # Debug: if empty, save audio
        if not transcript.strip():
            debug_file = Path(__file__).parent / "debug_empty.wav"
            import shutil
            shutil.copy(AUDIO_FILE, debug_file)
            print(f"DEBUG: saved empty audio to {debug_file}", file=sys.stderr, flush=True)

        print(f"You said: {transcript}")

        # Detect keyword
        slot = detect_keyword(transcript)

        if slot:
            print(f"=> Detected: Slot {slot}")
        else:
            print("=> No keyword detected")

        # Publish result
        publish_result(slot, transcript)

        # Clean up
        clean_up()

    except Exception as e:
        print(f"Error: {e}")
        clean_up()


def main():
    global mqtt_client

    print("\n=== Voice Medicine Controller ===")
    print("Keywords: 'thuốc ho'/'ho' -> Slot 1, 'sốt' -> Slot 2")
    print("Press ENTER to record...")
    print("Press ESC or Ctrl+C to quit\n")

    # Init MQTT
    mqtt_client = init_mqtt()

    # Load model once
    print("Loading Whisper model...")
    model = load_whisper_model()
    print("Ready!\n")

    while True:
        try:
            sys.stdout.write("> ")
            sys.stdout.flush()

            # Read single key
            key = readchar.readkey()

            # Enter key
            if key in ('\r', '\n'):
                print()  # New line after Enter

                try:
                    # Record and transcribe
                    transcript = record_and_transcribe(model)
                    print(f"You said: {transcript}")

                    # Detect keyword
                    slot = detect_keyword(transcript)

                    if slot:
                        print(f"=> Detected: Slot {slot}")
                    else:
                        print("=> No keyword detected")

                    # Publish result
                    publish_result(slot, transcript)

                    # Clean up
                    clean_up()

                except Exception as e:
                    print(f"Error: {e}")
                    clean_up()

            # ESC or Ctrl+C
            elif key == '\x1b' or key == '\x03':
                print("\nQuit")
                break

        except KeyboardInterrupt:
            print("\nQuit")
            break

    # Cleanup
    if mqtt_client:
        mqtt_client.disconnect()
    clean_up()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--api", action="store_true", help="Run once for API (non-interactive)")
    parser.add_argument("--server", action="store_true", help="Run as HTTP server")
    args = parser.parse_args()

    if args.server:
        # HTTP server mode - keeps process alive for mic access
        from http.server import HTTPServer, BaseHTTPRequestHandler
        import threading
        import json

        mqtt_client = None
        model = None

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                if self.path == "/record":
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()

                    try:
                        transcript = record_and_transcribe(model)
                        slot = detect_keyword(transcript)

                        result = {
                            "transcript": transcript,
                            "slot": slot
                        }

                        if slot:
                            publish_result(slot, transcript)

                        self.wfile.write(json.dumps(result).encode())
                    except Exception as e:
                        self.wfile.write(json.dumps({"error": str(e)}).encode())

            def log_message(self, format, *args):
                pass  # Suppress logs

        # Initialize once
        print("=== Voice API Server ===")
        mqtt_client = init_mqtt()
        print("Loading Whisper model...")
        model = load_whisper_model()
        print(f"Server ready on port {API_PORT}")

        server = HTTPServer(("localhost", API_PORT), Handler)
        server.serve_forever()

    elif args.api:
        # API mode - single run
        mqtt_client = init_mqtt()
        print("Loading Whisper model...")
        model = load_whisper_model()
        run_once(model)
        if mqtt_client:
            mqtt_client.disconnect()
    else:
        # Interactive mode
        main()