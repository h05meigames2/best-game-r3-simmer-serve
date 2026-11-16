// All sound is synthesized with WebAudio: no audio files, no network.
// Every effect is a short oscillator or noise burst; the stove sizzles while
// something cooks. Created lazily on the first user gesture.
let ctx = null;
let muted = false;
let sizzleNodes = null;

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  if (muted) stopSizzle();
  return muted;
}

function audio() {
  if (ctx === null) {
    const AC = window.AudioContext ?? window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq, dur, type, gain, when = 0, slideTo = null) {
  if (muted) return;
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise(dur, gain, filterFreq) {
  if (muted) return;
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime;
  const len = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buffer = ac.createBuffer(1, len, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = filterFreq;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(ac.destination);
  src.start(t0);
}

/** Play one named effect. Unknown names are silent. */
export function playSound(name) {
  switch (name) {
    case 'pickup': tone(520, 0.09, 'sine', 0.16, 0, 780); break;
    case 'place': tone(340, 0.08, 'triangle', 0.16, 0, 260); break;
    case 'chop': noise(0.06, 0.22, 2400); break;
    case 'chopped': tone(660, 0.1, 'sine', 0.18, 0, 880); break;
    case 'cooked': tone(587, 0.12, 'sine', 0.18, 0, 880); tone(880, 0.14, 'sine', 0.14, 0.1); break;
    case 'serve': tone(523, 0.1, 'sine', 0.2); tone(659, 0.1, 'sine', 0.2, 0.09); tone(784, 0.16, 'sine', 0.2, 0.18); break;
    case 'coin': tone(988, 0.09, 'sine', 0.16, 0, 1319); break;
    case 'walkout': tone(220, 0.28, 'sawtooth', 0.14, 0, 110); break;
    case 'burnt': tone(180, 0.3, 'square', 0.1, 0, 90); break;
    case 'error': tone(160, 0.12, 'square', 0.12, 0, 120); break;
    case 'wash': noise(0.18, 0.12, 900); break;
    case 'washed': tone(740, 0.1, 'sine', 0.16, 0, 990); break;
    case 'upgrade': tone(523, 0.1, 'sine', 0.18); tone(784, 0.14, 'sine', 0.18, 0.1); break;
    case 'win': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'sine', 0.2, i * 0.13)); break;
    case 'lose': [392, 330, 262, 196].forEach((f, i) => tone(f, 0.26, 'triangle', 0.18, i * 0.16)); break;
    case 'click': tone(700, 0.05, 'sine', 0.12); break;
    default: break;
  }
}

/** A soft looping sizzle while anything cooks; call every frame. */
export function updateSizzle(cooking) {
  if (muted || !cooking) {
    stopSizzle();
    return;
  }
  const ac = audio();
  if (!ac) return;
  if (sizzleNodes) return;
  const len = Math.floor(ac.sampleRate * 0.4);
  const buffer = ac.createBuffer(1, len, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const filter = ac.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 3200;
  const g = ac.createGain();
  g.gain.value = 0.035;
  src.connect(filter).connect(g).connect(ac.destination);
  src.start();
  sizzleNodes = { src, g };
}

export function stopSizzle() {
  if (!sizzleNodes) return;
  try { sizzleNodes.src.stop(); } catch { /* already stopped */ }
  sizzleNodes = null;
}
