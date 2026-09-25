/**
 * Zero-latency Web Audio API Procedural Sound Engine
 * Synthesizes clean trading chimes & notification tones without downloading external files.
 */

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isSoundEnabled() {
  const saved = localStorage.getItem('shortmarket_sound_enabled');
  return saved === null ? true : saved === 'true';
}

export function setSoundEnabled(enabled) {
  localStorage.setItem('shortmarket_sound_enabled', String(enabled));
}

export function getSoundVolume() {
  const saved = localStorage.getItem('shortmarket_sound_volume');
  return saved !== null ? Math.max(0, Math.min(1, parseFloat(saved))) : 0.8;
}

export function setSoundVolume(volume) {
  const vol = Math.max(0, Math.min(1, parseFloat(volume) || 0));
  localStorage.setItem('shortmarket_sound_volume', String(vol));
}

export function getSoundConfig() {
  return {
    enabled: isSoundEnabled(),
    volume: getSoundVolume(),
    targetHit: localStorage.getItem('shortmarket_sound_target') !== 'false',
    stopLoss: localStorage.getItem('shortmarket_sound_sl') !== 'false',
    orderExecuted: localStorage.getItem('shortmarket_sound_exec') !== 'false',
    riskAlert: localStorage.getItem('shortmarket_sound_risk') !== 'false'
  };
}

export function setSoundConfig(key, value) {
  localStorage.setItem(`shortmarket_sound_${key}`, String(value));
}

/**
 * 🎯 Target / Take-Profit Hit Sound (Bright, positive 2-tone chime)
 */
export function playTargetHitSound() {
  if (!isSoundEnabled() || localStorage.getItem('shortmarket_sound_target') === 'false') return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const masterVol = getSoundVolume();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now); // A5
    osc1.frequency.setValueAtTime(1174.66, now + 0.1); // D6

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1318.51, now); // E6
    osc2.frequency.setValueAtTime(1760, now + 0.1); // A6

    gain.gain.setValueAtTime(0.18 * masterVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.45);
    osc2.stop(now + 0.45);
  } catch (e) {}
}

/**
 * 🛑 Stop-Loss Hit Sound (Warning alert tone)
 */
export function playStopLossHitSound() {
  if (!isSoundEnabled() || localStorage.getItem('shortmarket_sound_sl') === 'false') return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const masterVol = getSoundVolume();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, now); // A4
    osc.frequency.setValueAtTime(329.63, now + 0.12); // E4

    gain.gain.setValueAtTime(0.15 * masterVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  } catch (e) {}
}

/**
 * 🔔 Order Executed Sound (Subtle crisp confirmation pop)
 */
export function playOrderExecutedSound() {
  if (!isSoundEnabled() || localStorage.getItem('shortmarket_sound_exec') === 'false') return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const masterVol = getSoundVolume();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.08); // C6

    gain.gain.setValueAtTime(0.18 * masterVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  } catch (e) {}
}

/**
 * ⚠️ Risk Guardian Limit Sound
 */
export function playRiskAlertSound() {
  if (!isSoundEnabled() || localStorage.getItem('shortmarket_sound_risk') === 'false') return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const masterVol = getSoundVolume();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.setValueAtTime(739.99, now + 0.1); // F#5
    osc.frequency.setValueAtTime(880, now + 0.2); // A5

    gain.gain.setValueAtTime(0.22 * masterVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);
  } catch (e) {}
}
