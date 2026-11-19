import asyncio, ssl, sys
import edge_tts, edge_tts.communicate as c
c._SSL_CTX = ssl.create_default_context(cafile="/root/.ccr/ca-bundle.crt")
VOICE, RATE = "en-IN-PrabhatNeural", "-12%"
async def main():
    lines = open(sys.argv[1]).read().strip().split("\n")
    for i, l in enumerate(lines, 1):
        await edge_tts.Communicate(l, VOICE, rate=RATE).save(f"{sys.argv[2]}/line{i:02d}.mp3")
asyncio.run(main())
