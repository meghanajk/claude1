"""Narration with edge-tts, one file per section, plus word timings (WordBoundary)."""
import asyncio, ssl, sys, json, edge_tts, edge_tts.communicate as c
c._SSL_CTX = ssl.create_default_context(cafile="/root/.ccr/ca-bundle.crt")
VOICE, RATE = sys.argv[2], sys.argv[3]
async def one(key, text, out):
    com = edge_tts.Communicate(text, VOICE, rate=RATE, boundary="WordBoundary")
    words = []
    with open(f"{out}/{key}.mp3", "wb") as f:
        async for ch in com.stream():
            if ch["type"] == "audio": f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append({"w": ch["text"], "s": ch["offset"] / 1e7, "e": (ch["offset"] + ch["duration"]) / 1e7})
    json.dump(words, open(f"{out}/{key}.json", "w"), indent=0)
async def main():
    for line in open(sys.argv[1]).read().strip().split("\n"):
        k, t = line.split("|", 1)
        for attempt in range(5):
            try: await one(k, t, sys.argv[4]); break
            except Exception as e: print(k, "retry", attempt, e); await asyncio.sleep(2 + 2 * attempt)
        else: raise SystemExit(f"TTS failed for {k}")
asyncio.run(main())
