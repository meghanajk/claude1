import React, {createContext, useContext} from 'react';
import mainTl from '../data/main.json';
import short1Tl from '../data/short1.json';
import short2Tl from '../data/short2.json';
import short3Tl from '../data/short3.json';
import {FPS} from './anim';

export type Word = {text: string; start: number; end: number; color: string};
export type Caption = {start: number; end: number; words: Word[]};
export type Line = {id: string; scene: string; text: string; start: number; end: number; words: Word[]};
export type SceneInfo = {id: string; start: number; end: number; music: string};
export type Timeline = {
  program: string;
  fps: number;
  duration: number;
  durationInFrames: number;
  title: string;
  scenes: SceneInfo[];
  lines: Record<string, Line>;
  lineOrder: string[];
  beats: Record<string, number>;
  captions: Caption[];
};

export const TIMELINES: Record<string, Timeline> = {
  main: mainTl as Timeline,
  short1: short1Tl as Timeline,
  short2: short2Tl as Timeline,
  short3: short3Tl as Timeline,
};

type Ctx = {tl: Timeline; offset: number};
const TimelineCtx = createContext<Ctx>({tl: TIMELINES.main, offset: 0});

/** Provides a timeline and the absolute frame at which the current <Sequence> starts. */
export const TimelineProvider: React.FC<{tl: Timeline; offset: number; children: React.ReactNode}> = ({tl, offset, children}) => (
  <TimelineCtx.Provider value={{tl, offset}}>{children}</TimelineCtx.Provider>
);

const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Timing helpers that convert narration events into frames local to the current scene.
 *   L('h1')            -> frame where line h1 starts
 *   E('h1')            -> frame where line h1 ends
 *   W('h1', 'control') -> frame where that word is spoken
 *   B('titleHit')      -> frame of a named beat (shared with the sound-effects mix)
 */
export const useTimeline = () => {
  const {tl, offset} = useContext(TimelineCtx);
  const f = (sec: number) => Math.round(sec * FPS) - offset;
  const line = (id: string) => {
    const l = tl.lines[id];
    if (!l) throw new Error(`Unknown line ${id}`);
    return l;
  };
  return {
    tl,
    f,
    L: (id: string) => f(line(id).start),
    E: (id: string) => f(line(id).end),
    W: (id: string, word: string, nth = 0) => {
      const ws = line(id).words.filter((w) => norm(w.text) === norm(word));
      if (!ws.length) throw new Error(`Word ${word} not in ${id}`);
      return f(ws[Math.min(nth, ws.length - 1)].start);
    },
    B: (name: string) => {
      const b = tl.beats[name];
      if (b === undefined) throw new Error(`Unknown beat ${name}`);
      return f(b);
    },
  };
};

export const sceneFrames = (tl: Timeline, id: string) => {
  const s = tl.scenes.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scene ${id}`);
  return {from: Math.round(s.start * FPS), to: Math.round(s.end * FPS)};
};
