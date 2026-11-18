// Meridian Heat — synthesized sound: WebAudio only, no audio files.
// A small synth for effects plus a looping bass-and-hat groove that starts
// once the player presses a key (browsers require a user gesture for audio).

let ctx = null;
let musicTimer = null;
let musicOn = false;
let muted = false;

export function ensureAudio() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, type, vol, slideTo) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || 'square';
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  gain.gain.setValueAtTime(vol || 0.12, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noiseBurst(dur, vol, lowpass) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpass || 1200;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol || 0.2, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(t0);
}

export const sfx = {
  shoot() { noiseBurst(0.09, 0.25, 3000); tone(180, 0.08, 'square', 0.1, 60); },
  punch() { noiseBurst(0.07, 0.2, 900); },
  pickup() { tone(660, 0.09, 'sine', 0.14); setTimeout(() => tone(990, 0.12, 'sine', 0.14), 70); },
  cash() { tone(880, 0.1, 'triangle', 0.16); setTimeout(() => tone(1320, 0.16, 'triangle', 0.16), 90); },
  siren() { tone(700, 0.35, 'sawtooth', 0.05, 1100); },
  crash() { noiseBurst(0.25, 0.3, 500); },
  engine() { tone(90, 0.2, 'sawtooth', 0.05, 140); },
  mission() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.16), i * 110)); },
  wanted() { tone(220, 0.3, 'sawtooth', 0.09, 440); },
  door() { tone(300, 0.08, 'square', 0.08, 180); },
  click() { tone(1200, 0.04, 'sine', 0.08); },
};

// A lazy four-on-the-floor groove: root notes walk a minor scale, hats tick.
const BASS_LINE = [55, 55, 65.4, 49, 55, 55, 82.4, 73.4];
let beat = 0;
export function startMusic() {
  if (!ctx || musicOn) return;
  musicOn = true;
  musicTimer = setInterval(() => {
    if (muted || !ctx) return;
    const root = BASS_LINE[beat % BASS_LINE.length];
    tone(root, 0.22, 'triangle', 0.11);
    if (beat % 2 === 0) noiseBurst(0.03, 0.05, 6000);
    if (beat % 4 === 0) tone(root * 2, 0.1, 'square', 0.03);
    beat += 1;
  }, 210);
}
export function stopMusic() {
  musicOn = false;
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
}
export function toggleMute() { muted = !muted; return muted; }
export function isMuted() { return muted; }
