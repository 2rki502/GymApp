/**
 * Audio + haptic feedback. iOS Safari only allows audio after a user gesture, so
 * `unlockAudio()` is called from tap handlers (e.g. completing a set) and the rest
 * timer beep can then play later.
 */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

export function unlockAudio() {
  const c = audio();
  if (c && c.state === 'suspended') void c.resume();
}

function tone(freq: number, start: number, dur: number, gain = 0.18) {
  const c = audio();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  osc.connect(g).connect(c.destination);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + dur + 0.02);
}

export function restDoneChime() {
  tone(880, 0, 0.18);
  tone(1175, 0.2, 0.28);
  vibrate([60, 40, 60]);
}

export function vibrate(pattern: number | number[] = 12) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported (iOS) */
  }
}
