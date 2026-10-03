// Tiny WebAudio synth: every sound in the game is generated, no audio files needed.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

function ac() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "square", vol = 0.25, slide = 0) {
  if (muted) return;
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime + start);
  if (slide) o.frequency.linearRampToValueAtTime(freq + slide, c.currentTime + start + dur);
  g.gain.setValueAtTime(0, c.currentTime + start);
  g.gain.linearRampToValueAtTime(vol, c.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + dur);
  o.connect(g).connect(master!);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.05);
}

export const sfx = {
  step: () => tone(90 + Math.random() * 30, 0, 0.05, "triangle", 0.08),
  splash: () => tone(300 + Math.random() * 80, 0, 0.12, "sine", 0.08, -200),
  blip: () => tone(660, 0, 0.04, "square", 0.06),
  talk: () => tone(420 + Math.random() * 120, 0, 0.035, "square", 0.04),
  open: () => { tone(520, 0, 0.08, "square", 0.12); tone(780, 0.07, 0.1, "square", 0.12); },
  bump: () => tone(110, 0, 0.08, "square", 0.08, -40),
  deliver: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.18, "triangle", 0.22)),
  coin: () => { tone(988, 0, 0.06, "square", 0.12); tone(1319, 0.06, 0.16, "square", 0.12); },
  befriend: () => [392, 494, 587, 784, 988].forEach((f, i) => tone(f, i * 0.07, 0.25, "sine", 0.25)),
  smash: () => { tone(80, 0, 0.25, "sawtooth", 0.3, -50); tone(60, 0.05, 0.3, "square", 0.2, -30); },
  unlock: () => [523, 784, 659, 1047, 1319].forEach((f, i) => tone(f, i * 0.1, 0.3, "triangle", 0.22)),
  sleep: () => [659, 523, 392, 330].forEach((f, i) => tone(f, i * 0.18, 0.4, "sine", 0.2)),
  morning: () => [392, 523, 659, 784].forEach((f, i) => tone(f, i * 0.12, 0.35, "sine", 0.2)),
};

/** Tap the master mix as a MediaStream (used for recording trailers). */
export function audioStream(): MediaStream {
  const c = ac();
  const dest = c.createMediaStreamDestination();
  master!.connect(dest);
  return dest.stream;
}

export const isMuted = () => muted;

export function toggleMute() {
  muted = !muted;
  return muted;
}

// Gentle background loop: a slow pentatonic music box.
let musicTimer: number | null = null;
export function startMusic() {
  if (musicTimer !== null) return;
  const scale = [392, 440, 523, 587, 659, 784, 880];
  const bass = [196, 220, 262, 175];
  let step = 0;
  musicTimer = window.setInterval(() => {
    if (muted) { step++; return; }
    if (step % 8 === 0) tone(bass[(step / 8) % bass.length], 0, 1.6, "sine", 0.07);
    if (Math.random() < 0.7) {
      const n = scale[Math.floor(Math.abs(Math.sin(step * 1.7)) * scale.length)];
      tone(n, 0, 0.6, "triangle", 0.045);
    }
    step++;
  }, 380);
}
