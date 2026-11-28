# FACTMAN — *How Easily Can Someone Control Your Mind?*

An animated stickman psychology documentary (4–5 min, 16:9) plus three vertical YouTube Shorts (9:16).
Everything is generated in code: the SVG stickman animation in **Remotion** (React), and the narration timings,
music, sound effects, mix and subtitles in **Python**.

```
output/                                   <- final deliverables (repo root)
  FACTMAN_Mind_Control_Full_Video.mp4     1920x1080, 30 fps, ~4:23
  FACTMAN_Mind_Control_Subtitles.srt
  FACTMAN_Short_01_Conformity.mp4         1080x1920, 30 fps
  FACTMAN_Short_02_Illusory_Truth.mp4     1080x1920, 30 fps
  FACTMAN_Short_03_Gaslighting.mp4        1080x1920, 30 fps
  FACTMAN_Short_0x_*.srt                  subtitles for each Short
  FACTMAN_Thumbnail.png                   1280x720

project/
  scripts/narration.json    SINGLE SOURCE OF TRUTH: script lines, pauses, voice, highlighted words,
                            named beats (visual events + sound-effect cues) for main video and Shorts
  scripts/generate_voice.py TTS narration (edge-tts, Microsoft neural voice, word-level timings)
  scripts/generate_audio.py timeline builder + music + SFX + ducking mix + loudness + captions + SRT
  scripts/audio_lib.py      original synthesized sound effects and music (numpy/scipy)
  scripts/render.mjs        renders the videos and the thumbnail to ../output
  scripts/stills.mjs        renders single frames for visual QA
  scripts/qc.py             automated quality control of the rendered files
  src/
    Root.tsx                compositions: FactmanMain, Short01..03, Thumbnail
    MainVideo.tsx           assembles the 8 scenes with cross-dissolves, captions, watermark, audio
    scenes/Scene1..8*.tsx   one component per scene (hook, setup, conformity, illusory truth,
                            emotions, gaslighting, revelation, ending)
    shorts/*.tsx            dedicated vertical layouts for the Shorts (+ ShortFrame branding wrapper)
    components/             reusable building blocks
      Stickman.tsx          rig with joints, poses, walk cycle, idle motion, faces, 5 character variants
      Props.tsx             puppet strings, speech/thought bubbles, screens, meters, icons, Asch cards
      Atmosphere.tsx        backgrounds, particles, film grain, vignette, camera rig, flashes, glitches
      Typography.tsx        impact titles, glitch text, chapter cards, tags
      Subtitles.tsx         word-synchronised animated captions (landscape + vertical styles)
      Brand.tsx             FACTMAN emblem, logo reveal, watermark, subscribe pill
    lib/timeline.tsx        timing hooks: L(line) / E(line) / W(line, word) / B(beat) -> frames
    data/*.json             generated timelines (do not edit by hand)
  public/audio/voice/       narration clips + word timings per line
  public/audio/*_mix.wav    final mixes used by the renderer (generated, git-ignored)
  assets/audio/             voiceover / music / sfx stems (mp3) + the SFX library (wav)
```

## Characters & visual identity
* **Hero** – black stickman with a white outline and a white round head (expressive eyes, brows, mouth, sweat).
* **Crowd** – grey stickmen. **Manipulator** – dark body with red outline and red glowing face.
* **Shadow** – blurred black giant with red eyes (the puppeteer). Dark backgrounds, red = danger/manipulation,
  blue = information/thinking, yellow = key concepts.

## Reproduce everything

Requirements: Node 18+ (tested 22), Python 3.10+ with `numpy scipy edge-tts`, `ffmpeg`, and a Chromium
(Remotion downloads one automatically; set `REMOTION_CHROME=/path/to/chrome-headless-shell` to use your own).

```bash
cd project
npm install
pip install numpy scipy edge-tts

# 1. narration (needs internet; cached per line, so only changed lines are re-generated)
npm run voice                 # python3 scripts/generate_voice.py

# 2. timelines + music + sfx + mix + subtitles (offline)
npm run audio                 # python3 scripts/generate_audio.py

# 3. render the videos and the thumbnail into ../output
npm run render:all            # or render:full / render:shorts ; node scripts/render.mjs thumb

# 4. quality control (+ optional contact sheets)
python3 scripts/qc.py --sheets /tmp/factman_sheets

# live preview / editing
npm run studio
```

The committed voice clips mean steps 2–4 work offline. Re-run step 2 whenever `narration.json` changes.

## How timing works
`narration.json` lists every narration line and named **beats** such as
`"titleHit": {"line": "h5", "anchor": "end", "offset": 0.35, "sfx": "impact"}` or
`"guiltHit": {"line": "e4", "word": "guilty", "sfx": "boom"}`.
`generate_audio.py` measures the real TTS audio, places each line, resolves every beat to an exact time,
drops the sound effect there and writes `src/data/<program>.json`. Scenes call `B('guiltHit')` to get the
same moment in frames, so visuals, sound effects and narration stay in sync automatically, even after
changing the script or the voice.

## Audio
* Voice: `en-US-AndrewNeural` (deep pitch shift; slower delivery for the hook and gaslighting; an alternate
  voice, `en-US-EricNeural`, for the manipulator quotes in Short 3). No API key is required.
* Music: six original moods (dark, suspense, pulse, tense, build, inspire) synthesized per scene and cross-faded.
* SFX: impacts, risers, whooshes, glitches, heartbeats, string twangs/snaps, mirror crack, etc. — all synthesized.
* Mix: music is side-chain ducked under the voice, normalized to about -15 LUFS with a peak limiter at -1 dBFS.
* All music and effects are generated by `audio_lib.py`, so they carry no third-party licence. The narration
  comes from Microsoft's neural TTS service through edge-tts. Review Microsoft's terms for commercial use, or
  swap in another voice by changing `voice` in `narration.json` or replacing the clips.

## Editing tips
* Change wording/pauses/voice: edit `scripts/narration.json`, then `npm run voice && npm run audio`.
* Change highlighted caption words: `highlights` in `narration.json`, then `npm run audio`.
* Re-time an animation: move the beat in `narration.json` (visual + SFX move together).
* Scene visuals: `src/scenes/*.tsx`; characters/poses: `src/components/Stickman.tsx`.
