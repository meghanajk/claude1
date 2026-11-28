"""Generate the FACTMAN narration with Microsoft Edge neural TTS (edge-tts, no API key needed).

For every narration line in scripts/narration.json this writes
  public/audio/voice/<program>/<lineId>.mp3   - the spoken line
  public/audio/voice/<program>/<lineId>.json  - word-level timings reported by the TTS engine
Lines are cached by a hash of (text, voice, rate, pitch), so re-running only regenerates changed lines.

Usage:  python3 scripts/generate_voice.py [program ...]     (default: all programs)
"""
import asyncio, hashlib, json, os, ssl, sys, time
from pathlib import Path

import edge_tts
import edge_tts.communicate as _comm

ROOT = Path(__file__).resolve().parent.parent
CFG = json.loads((ROOT / "scripts" / "narration.json").read_text())

# Use the sandbox proxy CA bundle when present (harmless elsewhere).
_CA = "/root/.ccr/ca-bundle.crt"
if os.path.exists(_CA):
    _comm._SSL_CTX = ssl.create_default_context(cafile=_CA)


def voice_for(line):
    v = dict(CFG["voice"])
    if line.get("voice"):
        v = dict(CFG["altVoices"][line["voice"]])
    if line.get("rate"):
        v["rate"] = line["rate"]
    if line.get("pitch"):
        v["pitch"] = line["pitch"]
    return v


async def synth(text, v, mp3_path):
    comm = edge_tts.Communicate(text, v["name"], rate=v["rate"], pitch=v["pitch"], boundary="WordBoundary")
    words, audio = [], bytearray()
    async for ch in comm.stream():
        if ch["type"] == "audio":
            audio += ch["data"]
        elif ch["type"] == "WordBoundary":
            words.append({"text": ch["text"],
                          "start": ch["offset"] / 1e7,
                          "end": (ch["offset"] + ch["duration"]) / 1e7})
    if not audio or not words:
        raise RuntimeError("empty TTS response")
    mp3_path.write_bytes(bytes(audio))
    return words


async def main(programs):
    for pid in programs:
        prog = CFG["programs"][pid]
        out = ROOT / "public" / "audio" / "voice" / pid
        out.mkdir(parents=True, exist_ok=True)
        for scene in prog["scenes"]:
            for line in scene["lines"]:
                say = line.get("say", line["text"])
                v = voice_for(line)
                key = hashlib.sha1(json.dumps([say, v], sort_keys=True).encode()).hexdigest()[:12]
                mp3, js = out / f"{line['id']}.mp3", out / f"{line['id']}.json"
                if mp3.exists() and js.exists() and json.loads(js.read_text()).get("key") == key:
                    continue
                for attempt in range(5):
                    try:
                        words = await synth(say, v, mp3)
                        break
                    except Exception as e:  # network hiccups: back off and retry
                        print(f"  retry {line['id']} ({e})")
                        time.sleep(2 * (attempt + 1))
                else:
                    raise SystemExit(f"TTS failed for {pid}/{line['id']}")
                js.write_text(json.dumps({"key": key, "say": say, "voice": v, "words": words}, indent=1))
                print(f"{pid}/{line['id']}: {len(words)} words  [{v['name']} {v['rate']} {v['pitch']}]")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:] or list(CFG["programs"].keys())))
