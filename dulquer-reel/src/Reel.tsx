import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import script from "./data/script.json";
import manifest from "./data/media_manifest.json";
import { cardFrames } from "./timing";

const FONT = "Inter, sans-serif";
// Caption style follows the reference reel: left-aligned white text on a solid
// black box; highlights are a marker bar (orange -> white -> green) with black text.
const marker = (a: number) =>
  `linear-gradient(90deg, rgba(255,138,42,${a}) 0%, rgba(255,233,214,${a}) 50%, rgba(76,227,90,${a}) 100%)`;
const SIDE_MARGIN = 72; // safe area left/right
const BOTTOM_SAFE = 470; // keep clear of platform UI (captions, buttons)

type MediaEntry = { file: string; type: "image" | "video" } | null;
type Segment = { text: string; highlight: boolean; group: number };

// "**a b** c" -> segments with original spacing kept; group = highlight index.
const parse = (line: string): Segment[] => {
  let group = -1;
  return line
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part) => {
      const hl = part.startsWith("**") && part.endsWith("**");
      if (hl) group++;
      return { text: hl ? part.slice(2, -2) : part, highlight: hl, group: hl ? group : -1 };
    });
};

const useFonts = () => {
  const [handle] = useState(() => delayRender("Loading Montserrat"));
  useEffect(() => {
    Promise.all([
      document.fonts.load(`800 100px Inter`),
      document.fonts.load(`700 100px Inter`),
    ]).then(() => continueRender(handle));
  }, [handle]);
};

const Media: React.FC<{ entry: MediaEntry; index: number; duration: number }> = ({
  entry,
  index,
  duration,
}) => {
  const frame = useCurrentFrame();
  if (!entry) {
    return (
      <AbsoluteFill
        style={{ background: "radial-gradient(circle at 50% 35%, #2a2520 0%, #0d0c0b 75%)" }}
      />
    );
  }
  const src = staticFile(entry.file);
  if (entry.type === "video") {
    return (
      <AbsoluteFill>
        <OffthreadVideo
          src={src}
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>
    );
  }
  // Slow Ken Burns: zoom in on even cards, out on odd ones, slight drift.
  const p = frame / duration;
  const zoomIn = index % 2 === 0;
  const scale = zoomIn ? 1.0 + 0.09 * p : 1.09 - 0.09 * p;
  const driftY = interpolate(p, [0, 1], [0, zoomIn ? -18 : 18]);
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `translateY(${driftY}px) scale(${scale})`,
          transformOrigin: "50% 38%",
        }}
      />
    </AbsoluteFill>
  );
};

const Caption: React.FC<{ line: string; isHook: boolean; duration: number }> = ({
  line,
  isHook,
  duration,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const segments = parse(line);

  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 12 });
  const exit = interpolate(frame, [duration - 6, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fontSize = isHook ? 92 : 64;

  return (
    <AbsoluteFill
      style={{
        justifyContent: isHook ? "center" : "flex-end",
        alignItems: isHook ? "center" : "flex-start",
        padding: `0 ${SIDE_MARGIN}px ${isHook ? 80 : BOTTOM_SAFE}px`,
      }}
    >
      <div
        style={{
          opacity: enter * exit,
          transform: `translateY(${(1 - enter) * 40}px)`,
          maxWidth: 1080 - SIDE_MARGIN * 2,
          background: "rgba(0,0,0,0.92)",
          borderRadius: 8,
          padding: isHook ? "26px 34px 30px" : "18px 26px 22px",
          fontFamily: FONT,
          fontWeight: isHook ? 800 : 700,
          fontSize,
          lineHeight: 1.22,
          letterSpacing: "-0.025em",
          color: "white",
          textAlign: isHook ? "center" : "left",
        }}
      >
        {segments.map((seg, i) => {
          if (!seg.highlight) return <span key={i}>{seg.text}</span>;
          // quick marker fade-in for each highlight, staggered; text goes white -> black with it
          const t = frame - (6 + seg.group * 5);
          const k = interpolate(t, [0, 6], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const c = Math.round(255 - 244 * k);
          return (
            <span
              key={i}
              style={{
                backgroundImage: marker(k),
                WebkitBoxDecorationBreak: "clone",
                boxDecorationBreak: "clone",
                borderRadius: 7,
                padding: "0 0.08em",
                margin: "0 -0.03em",
                color: `rgb(${c},${c},${c})`,
                fontWeight: 800,
                display: "inline",
              }}
            >
              {seg.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const Card: React.FC<{ line: string; index: number; duration: number }> = ({
  line,
  index,
  duration,
}) => {
  const frame = useCurrentFrame();
  const entry = (manifest as Record<string, MediaEntry>)[
    `card${String(index + 1).padStart(2, "0")}`
  ];
  const isHook = index === 0;
  // soft fade in, quick fade out (dip through black between cards)
  const mediaOpacity =
    interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" }) *
    interpolate(frame, [duration - 5, duration], [1, 0], { extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <AbsoluteFill style={{ opacity: mediaOpacity }}>
        <Media entry={entry} index={index} duration={duration} />
      </AbsoluteFill>
      {/* subtle dark gradient so text is always readable */}
      <AbsoluteFill
        style={{
          background: isHook
            ? "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.15) 100%)"
            : "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.35) 100%)",
        }}
      />
      <Caption line={line} isHook={isHook} duration={duration} />
    </AbsoluteFill>
  );
};

export const Reel: React.FC = () => {
  useFonts();
  let from = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {script.cards.map((line, i) => {
        const duration = cardFrames(i, line);
        const seq = (
          <Sequence key={i} from={from} durationInFrames={duration}>
            <Card line={line} index={i} duration={duration} />
          </Sequence>
        );
        from += duration;
        return seq;
      })}
    </AbsoluteFill>
  );
};
