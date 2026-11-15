// HADAL DIVE — procedural WebAudio sound, no audio files.
// Every sound is synthesized: sonar pings, bubble blips, harpoon snaps, hull impacts,
// the draft chime and the Leviathan's low roar. The context starts on the first
// gesture (browsers block audio before that) and stays silent in screenshot mode.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let pingTimer = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  return {
    /** Call from any user gesture so later sounds are allowed. */
    unlock() {
      ensure();
    },
    setMuted(value) {
      muted = value;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      tone(880, 0.07, 'square', 0.08, 320);
    },
    dash() {
      noise(0.16, 0.12, 1600);
      tone(300, 0.16, 'sine', 0.08, 620);
    },
    hit() {
      noise(0.09, 0.16, 900);
      tone(160, 0.09, 'triangle', 0.12, 70);
    },
    hurt() {
      tone(110, 0.25, 'sawtooth', 0.2, 55);
      noise(0.2, 0.2, 500);
    },
    pickup() {
      tone(1180, 0.09, 'sine', 0.1, 1760);
    },
    heal() {
      tone(520, 0.3, 'sine', 0.09, 1040);
    },
    levelup() {
      tone(660, 0.12, 'sine', 0.14);
      setTimeout(() => tone(990, 0.18, 'sine', 0.14), 90);
    },
    draft() {
      [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.12), i * 80));
    },
    depth() {
      tone(392, 0.2, 'sine', 0.12, 784);
      tone(196, 0.35, 'sine', 0.1, 98);
    },
    elite() {
      tone(220, 0.4, 'sawtooth', 0.14, 110);
    },
    roar() {
      tone(70, 0.9, 'sawtooth', 0.25, 38);
      noise(0.8, 0.18, 300);
    },
    victory() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.13), i * 130));
    },
    gameover() {
      [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.35, 'triangle', 0.12), i * 160));
    },
    /** A slow sonar ping while playing; call every frame with dt. */
    tick(dt) {
      if (!ctx || muted) return;
      pingTimer += dt;
      if (pingTimer > 4.5) {
        pingTimer = 0;
        tone(1240, 0.7, 'sine', 0.05, 1180);
      }
    },
  };
}
