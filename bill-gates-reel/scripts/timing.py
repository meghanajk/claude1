"""Card timing, read from src/script.json (same source as Remotion)."""
import json
from pathlib import Path

FPS = 30
SCRIPT = Path(__file__).resolve().parent.parent / "src/script.json"

def cards():
    return [c["text"] for c in json.loads(SCRIPT.read_text())["cards"]]

def card_seconds(text, index):
    return json.loads(SCRIPT.read_text())["cards"][index]["seconds"]
