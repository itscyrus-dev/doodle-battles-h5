// 音效与配乐：全部用 WebAudio 实时合成，不依赖任何音频文件。
// 浏览器要求先有一次用户操作才能发声，所以要在第一次点按时调用 unlock()。
let ctx = null, master = null, musicBus = null, sfxBus = null, noiseBuffer = null, trackGain = null;
let timer = null, current = null, step = 0, nextTime = 0, wanted = null;
const settings = { music: true, sfx: true };
const lastPlayed = {};

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function freq(name) {
  const m = /^([A-G])([#b]?)(\d)$/.exec(name); if (!m) return 440;
  const semis = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) - 4) * 12 - 9;
  return 440 * 2 ** (semis / 12);
}

function ensure() {
  if (ctx) return ctx;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = .9; master.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = settings.music ? .2 : 0; musicBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = settings.sfx ? .6 : 0; sfxBus.connect(master);
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuffer.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}
export function unlock() {
  const c = ensure(); if (!c) return;
  if (c.state !== 'running') c.resume().catch(() => {});
  if (wanted !== current) startTrack(wanted);
}
export function configure({ music, sfx }) {
  if (music !== undefined) settings.music = !!music;
  if (sfx !== undefined) settings.sfx = !!sfx;
  if (!ctx) return;
  musicBus.gain.setTargetAtTime(settings.music ? .2 : 0, ctx.currentTime, .05);
  sfxBus.gain.setTargetAtTime(settings.sfx ? .6 : 0, ctx.currentTime, .02);
}
export function setHidden(hidden) {
  if (!ctx) return;
  if (hidden) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {});
}

// ---------- 基础发声 ----------
function tone(bus, type, f0, f1, dur, vol, at = 0, attack = .005) {
  const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + .03);
}
function noise(bus, dur, vol, hz, { type = 'lowpass', sweep = .2, at = 0, q = .7 } = {}) {
  const t = ctx.currentTime + at, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuffer; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(hz, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, hz * sweep), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
  s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random() * .5, dur + .03);
}

const SFX = {
  tap: b => tone(b, 'sine', 700, 940, .05, .05),
  place: b => { tone(b, 'sine', 520, 820, .08, .07); noise(b, .03, .03, 3000); },
  pickup: b => tone(b, 'triangle', 600, 760, .06, .05),
  recycle: b => tone(b, 'triangle', 520, 260, .12, .06),
  invalid: b => { tone(b, 'square', 170, 150, .07, .035); tone(b, 'square', 150, 130, .09, .035, .09); },
  undo: b => tone(b, 'sine', 560, 380, .09, .05),
  open: b => { tone(b, 'sine', 500, 760, .09, .04); tone(b, 'sine', 760, 1000, .08, .03, .05); },
  close: b => tone(b, 'sine', 760, 480, .08, .035),
  start: b => { for (const [f, at] of [[196, 0], [294, .16], [392, .32]]) { tone(b, 'sawtooth', f, f * 1.01, .34, .035, at, .03); tone(b, 'triangle', f * 2, f * 2.01, .34, .04, at, .03); } noise(b, .5, .02, 900, { at: 0 }); },
  swing: b => noise(b, .1, .09, 2600, { type: 'bandpass', sweep: .35, q: 1.2 }),
  thrust: b => noise(b, .09, .09, 4200, { type: 'bandpass', sweep: .4, q: 1.6 }),
  shoot: b => { tone(b, 'triangle', 920, 430, .09, .05); noise(b, .04, .04, 5000, { type: 'highpass', sweep: 1 }); },
  toss: b => tone(b, 'sine', 300, 560, .13, .05),
  cast: b => { tone(b, 'sine', 1200, 1900, .2, .035); tone(b, 'sine', 1800, 2500, .16, .02, .05); },
  hit: b => { noise(b, .07, .1, 2400); tone(b, 'triangle', 200, 110, .08, .06); },
  block: b => { tone(b, 'square', 1350, 1200, .06, .025); tone(b, 'sine', 2100, 1900, .09, .03); },
  slam: b => { noise(b, .2, .16, 650); tone(b, 'sine', 125, 48, .24, .14); },
  charge: b => { noise(b, .16, .12, 3400, { type: 'bandpass', sweep: .3, q: 1 }); tone(b, 'triangle', 240, 120, .12, .08, .04); },
  boom: b => { noise(b, .55, .26, 1200); tone(b, 'sine', 100, 36, .45, .18); noise(b, .12, .1, 6000, { type: 'highpass', sweep: 1 }); },
  frost: b => { for (const [f, at] of [[2200, 0], [1760, .04], [1480, .08]]) tone(b, 'sine', f, f * .92, .22, .03, at); noise(b, .2, .05, 7000, { type: 'highpass', sweep: 1 }); },
  thunder: b => { noise(b, .12, .3, 8000, { type: 'highpass', sweep: .6 }); noise(b, .8, .24, 500, { sweep: .15 }); tone(b, 'sine', 80, 32, .7, .16); },
  freeze: b => { for (let i = 0; i < 5; i++) tone(b, 'sine', 900 + i * 320, 940 + i * 320, .28, .03, i * .045); noise(b, .4, .06, 6000, { type: 'highpass', sweep: 1 }); },
  mend: b => { tone(b, 'sine', 880, 884, .2, .04); tone(b, 'sine', 1320, 1326, .24, .035, .09); },
  death: b => { tone(b, 'sine', 330, 110, .16, .05); noise(b, .09, .05, 5200, { type: 'highpass', sweep: 1 }); tone(b, 'triangle', 980, 1500, .1, .028, .04); },
  item: b => { for (const [i, f] of [660, 880, 1100, 1320].entries()) tone(b, 'triangle', f, f, .14, .045, i * .05); },
  star: (b, n = 0) => { const f = [784, 988, 1175][Math.min(2, n)]; tone(b, 'triangle', f, f, .32, .08); tone(b, 'sine', f * 2, f * 2, .4, .04, .02); },
  coin: b => { tone(b, 'square', 1320, 1320, .05, .025); tone(b, 'square', 1760, 1760, .12, .025, .06); },
  unlock: b => { for (const [i, f] of [523, 659, 784, 1047, 1319].entries()) tone(b, 'triangle', f, f, .22, .055, i * .08); },
  won: b => { for (const [f, at, dur] of [[523, 0, .16], [659, .14, .16], [784, .28, .16], [1047, .42, .5], [784, .42, .5], [1319, .6, .6]]) { tone(b, 'triangle', f, f, dur, .075, at, .01); tone(b, 'sawtooth', f / 2, f / 2, dur, .02, at, .02); } },
  lost: b => { for (const [f, at] of [[392, 0], [349, .2], [311, .4], [262, .62]]) tone(b, 'triangle', f, f * .97, .34, .06, at, .02); }
};
// 同一种音效在很短时间内只响一次，避免几十个士兵同时出手时变成噪音。
export function sfx(name, arg) {
  if (!settings.sfx || !ctx || ctx.state !== 'running' || !SFX[name]) return;
  const now = ctx.currentTime; if (now - (lastPlayed[name] ?? -1) < .045) return; lastPlayed[name] = now;
  try { SFX[name](sfxBus, arg); } catch { /* 个别浏览器在后台时会拒绝创建节点 */ }
}

// ---------- 配乐 ----------
// 每小节 16 步（十六分音符）。旋律写成 [步, 音名, 持续步数]。
const TRACKS = {
  menu: {
    bpm: 96, swing: 0,
    chords: [['C3', 'E3', 'G3'], ['B2', 'D3', 'G3'], ['A2', 'C3', 'E3'], ['F2', 'A2', 'C3'], ['C3', 'E3', 'G3'], ['G2', 'B2', 'D3'], ['F2', 'A2', 'C3'], ['G2', 'B2', 'D3']],
    melody: [
      [[0, 'E5', 2], [2, 'G5', 2], [4, 'C6', 4], [8, 'G5', 2], [10, 'E5', 2], [12, 'G5', 4]],
      [[0, 'D5', 2], [2, 'G5', 2], [4, 'B5', 4], [8, 'G5', 2], [10, 'D5', 2], [12, 'G5', 4]],
      [[0, 'C5', 2], [2, 'E5', 2], [4, 'A5', 4], [8, 'E5', 2], [10, 'C5', 2], [12, 'E5', 4]],
      [[0, 'F5', 2], [2, 'A5', 2], [4, 'C6', 4], [8, 'A5', 4], [12, 'G5', 4]],
      [[0, 'E5', 2], [2, 'G5', 2], [4, 'C6', 4], [8, 'D6', 2], [10, 'C6', 2], [12, 'G5', 4]],
      [[0, 'D5', 2], [2, 'G5', 2], [4, 'B5', 4], [8, 'D6', 4], [12, 'B5', 4]],
      [[0, 'A5', 4], [4, 'C6', 4], [8, 'A5', 4], [12, 'F5', 4]],
      [[0, 'G5', 4], [4, 'B5', 4], [8, 'D6', 6]]
    ],
    kick: [0, 8], snare: [], hat: [4, 12], arp: true, bassSteps: [0, 8]
  },
  battle: {
    bpm: 132, swing: 0,
    chords: [['A2', 'C3', 'E3'], ['A2', 'C3', 'E3'], ['F2', 'A2', 'C3'], ['G2', 'B2', 'D3'], ['A2', 'C3', 'E3'], ['A2', 'C3', 'E3'], ['F2', 'A2', 'C3'], ['E2', 'G#2', 'B2']],
    melody: [
      [[0, 'A4', 2], [2, 'C5', 2], [4, 'E5', 2], [6, 'A5', 2], [8, 'G5', 2], [10, 'E5', 2], [12, 'C5', 2], [14, 'E5', 2]],
      [[0, 'A5', 4], [4, 'G5', 2], [6, 'E5', 2], [8, 'G5', 4], [12, 'E5', 4]],
      [[0, 'F5', 2], [2, 'A5', 2], [4, 'C6', 4], [8, 'A5', 2], [10, 'F5', 2], [12, 'A5', 4]],
      [[0, 'G5', 2], [2, 'B5', 2], [4, 'D6', 4], [8, 'B5', 2], [10, 'G5', 2], [12, 'D5', 4]],
      [[0, 'A4', 2], [2, 'C5', 2], [4, 'E5', 2], [6, 'A5', 2], [8, 'C6', 2], [10, 'A5', 2], [12, 'E5', 2], [14, 'A5', 2]],
      [[0, 'C6', 4], [4, 'B5', 2], [6, 'A5', 2], [8, 'G5', 4], [12, 'E5', 4]],
      [[0, 'F5', 2], [2, 'A5', 2], [4, 'C6', 2], [6, 'F6', 2], [8, 'E6', 4], [12, 'C6', 4]],
      [[0, 'E5', 2], [2, 'G#5', 2], [4, 'B5', 4], [8, 'E6', 6]]
    ],
    kick: [0, 6, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], arp: false, bassSteps: [0, 2, 4, 6, 8, 10, 12, 14]
  }
};
function voice(type, f, t, dur, vol, attack = .008, cutoff = 0) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0004, t + dur);
  if (cutoff) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff; o.connect(lp); lp.connect(g); } else o.connect(g);
  g.connect(trackGain); o.start(t); o.stop(t + dur + .05);
}
function drum(kind, t) {
  if (kind === 'kick') { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + .13); g.gain.setValueAtTime(.5, t); g.gain.exponentialRampToValueAtTime(.001, t + .16); o.connect(g); g.connect(trackGain); o.start(t); o.stop(t + .2); return; }
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuffer;
  f.type = kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'hat' ? 7000 : 1800; const dur = kind === 'hat' ? .035 : .11;
  g.gain.setValueAtTime(kind === 'hat' ? .09 : .22, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  s.connect(f); f.connect(g); g.connect(trackGain); s.start(t, Math.random() * .5, dur + .02);
}
function scheduleStep(track, index, t) {
  const bar = Math.floor(index / 16) % track.chords.length, s = index % 16, stepDur = 60 / track.bpm / 4, chord = track.chords[bar];
  if (s === 0) for (const n of chord) { voice('triangle', freq(n) * 2, t, stepDur * 15.5, .11, .12, 1400); voice('sine', freq(n), t, stepDur * 15.5, .12, .1); }
  if (track.bassSteps.includes(s)) voice('triangle', freq(chord[0]) / (track.arp ? 1 : (s % 4 === 2 ? .5 : 1)), t, stepDur * (track.arp ? 6 : 1.7), track.arp ? .3 : .26, .01, 500);
  if (track.arp && s % 2 === 0) voice('triangle', freq(chord[(s / 2) % 3]) * 2, t, stepDur * 1.8, .09, .005, 2400);
  for (const [at, n, len] of track.melody[bar]) if (at === s) { voice('triangle', freq(n), t, stepDur * len * .95, .2, .008, 3600); voice('sine', freq(n) * 2, t, stepDur * len * .5, .045); }
  if (track.kick.includes(s)) drum('kick', t);
  if (track.snare.includes(s)) drum('snare', t);
  if (track.hat.includes(s)) drum('hat', t);
}
function tick() {
  if (!ctx || !current || ctx.state !== 'running') return;
  const track = TRACKS[current], stepDur = 60 / track.bpm / 4;
  if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + .05;
  while (nextTime < ctx.currentTime + .3) { scheduleStep(track, step, nextTime); nextTime += stepDur; step = (step + 1) % (track.chords.length * 16); }
}
function startTrack(name) {
  if (!ctx) return;
  if (trackGain) { const old = trackGain; old.gain.setTargetAtTime(0, ctx.currentTime, .12); setTimeout(() => old.disconnect(), 900); }
  current = name; trackGain = null;
  if (!name) return;
  trackGain = ctx.createGain(); trackGain.gain.setValueAtTime(0, ctx.currentTime); trackGain.gain.setTargetAtTime(1, ctx.currentTime + .1, .25); trackGain.connect(musicBus);
  step = 0; nextTime = ctx.currentTime + .12;
  if (!timer) timer = setInterval(tick, 70);
}
// 切换配乐：'menu'、'battle' 或 null（停止）。还没解锁音频时先记下，解锁后再开始。
export function music(name) {
  wanted = name;
  if (!ctx || ctx.state !== 'running' || name === current) return;
  startTrack(name);
}
