#!/usr/bin/env bash
# Render one still per card (60% into each card) and tile them into out/check/grid.jpg
set -e
cd "$(dirname "$0")/.."
mkdir -p out/check
FRAMES=$(node -e '
const s=require("./src/data/script.json");const t=s.timing;let f=0,o=[];
s.cards.forEach((c,i)=>{const w=c.replace(/\*\*/g,"").trim().split(/\s+/).length;
const sec=i===0?t.hookSeconds:Math.max(t.minSeconds,Math.min(t.maxSeconds,w*t.secondsPerWord));
const d=Math.round(sec*s.fps);o.push(f+Math.round(d*0.6));f+=d;});console.log(o.join(" "))')
i=0; for f in $FRAMES; do i=$((i+1)); n=$(printf %02d $i)
  npx remotion still src/index.ts Reel out/check/card$n.png --frame=$f --scale=0.5 \
    --browser-executable=/opt/pw-browsers/chromium_headless_shell --log=error; done
ffmpeg -v error -y $(for n in $(seq -w 1 18); do echo -i out/check/card$n.png; done) \
  -filter_complex "$(for k in $(seq 0 17); do echo -n "[$k]scale=270:480[s$k];"; done)$(for k in $(seq 0 17); do echo -n "[s$k]"; done)xstack=inputs=18:layout=$(node -e 'console.log([...Array(18)].map((_,i)=>`${(i%6)*270}_${Math.floor(i/6)*480}`).join("|"))')" out/check/grid.jpg
echo out/check/grid.jpg
