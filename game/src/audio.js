// Tiny WebAudio sounds, synthesised on the spot: no audio files, no network.
// Footsteps, coin clinks, pickup chimes, alarms and a soft ambient hum.
export function createSoundBank() {
  let context = null;
  let enabled = true;
  let humNodes = null;

  function ensure() {
    if (context) return context;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    context = new AudioContext();
    return context;
  }

  function tone(frequency, duration, type, volume, slideTo) {
    if (!enabled) return;
    const ctx = ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + duration);
  }

  return {
    unlock() {
      ensure();
    },
    toggle() {
      enabled = !enabled;
      if (!enabled) this.stopHum();
      return enabled;
    },
    get enabled() {
      return enabled;
    },
    step(sneaking) {
      tone(sneaking ? 90 : 140, 0.05, 'sine', sneaking ? 0.03 : 0.06, 70);
    },
    coin() {
      tone(1900, 0.12, 'sine', 0.12, 2400);
      setTimeout(() => tone(2600, 0.1, 'sine', 0.08, 2100), 70);
    },
    pickup() {
      tone(660, 0.1, 'triangle', 0.12);
      setTimeout(() => tone(990, 0.14, 'triangle', 0.12), 90);
    },
    spotted() {
      tone(220, 0.35, 'sawtooth', 0.1, 440);
    },
    searchTick() {
      // A soft tap while a guard sweeps the area it lost you in.
      tone(180, 0.08, 'sine', 0.05, 140);
    },
    alarm() {
      tone(520, 0.25, 'square', 0.07, 780);
      setTimeout(() => tone(780, 0.25, 'square', 0.07, 520), 220);
    },
    caught() {
      tone(330, 0.5, 'sawtooth', 0.12, 110);
    },
    win() {
      [523, 659, 784, 1046].forEach((note, i) => setTimeout(() => tone(note, 0.22, 'triangle', 0.12), i * 130));
    },
    startHum() {
      if (humNodes) return;
      const ctx = ensure();
      if (!ctx) return;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 55;
      gain.gain.value = 0.02;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      humNodes = { oscillator, gain };
    },
    stopHum() {
      if (!humNodes) return;
      try {
        humNodes.oscillator.stop();
      } catch {
        // Already stopped.
      }
      humNodes = null;
    },
  };
}
