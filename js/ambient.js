/* ============================================================
   DIE WELLE – Ambient Music Engine (Web Audio API, no files)
   Procedurally generated atmosphere, intensity rises per wave.
   ============================================================ */

const AmbientMusic = (() => {
  'use strict';

  let ctx        = null;
  let master     = null;
  let nodes      = [];
  let pulseTimer = null;
  let running    = false;
  let enabled    = true;
  let scheduledWave = null;

  /* ----------------------------------------------------------
     Wave profiles – each wave gets darker / more tense
     All frequencies in Hz, minor tonality rooted on C/Bb/Ab
     ---------------------------------------------------------- */
  const PROFILES = {
    // Wave 1 – Der Funke: calm, curious, open
    1: {
      drones:  [32.70, 65.41, 98.00],
      pads:    [130.81, 155.56, 196.00],
      shimmer: [1046.50, 1174.66],
      padCycle: 14, shimCycle: 9,
      vol: 0.14, filterHz: 380, filterQ: 1.0,
      lfoHz: 0.20, lfoDepth: 0.22,
      pulse: false, pulseHz: 65.41, pulseMs: 4000,
      noiseAmt: 0
    },
    // Wave 2 – Stärke durch Disziplin: ordered, march-like
    2: {
      drones:  [32.70, 65.41, 98.00, 130.81],
      pads:    [130.81, 155.56, 196.00, 233.08],
      shimmer: [1046.50, 1244.51],
      padCycle: 12, shimCycle: 8,
      vol: 0.18, filterHz: 560, filterQ: 1.1,
      lfoHz: 0.38, lfoDepth: 0.28,
      pulse: true,  pulseHz: 65.41, pulseMs: 3200,
      noiseAmt: 0
    },
    // Wave 3 – Stärke durch Gemeinschaft: growing, minor chord movement
    3: {
      drones:  [32.70, 65.41, 77.78, 98.00],
      pads:    [130.81, 155.56, 207.65, 261.63],
      shimmer: [1174.66, 1396.91],
      padCycle: 10, shimCycle: 7,
      vol: 0.22, filterHz: 750, filterQ: 1.2,
      lfoHz: 0.58, lfoDepth: 0.32,
      pulse: true,  pulseHz: 77.78, pulseMs: 2600,
      noiseAmt: 0
    },
    // Wave 4 – Stärke durch Handeln: tritone enters, tension rises
    4: {
      drones:  [32.70, 46.25, 65.41, 92.50],
      pads:    [130.81, 155.56, 184.99, 246.94],   // Gb3 = tritone!
      shimmer: [1244.51, 1480.00],
      padCycle: 9, shimCycle: 6,
      vol: 0.26, filterHz: 960, filterQ: 1.4,
      lfoHz: 0.85, lfoDepth: 0.38,
      pulse: true,  pulseHz: 92.50, pulseMs: 2100,
      noiseAmt: 0.015
    },
    // Wave 5 – Die Andersdenkenden: conflict, dissonance, unease
    5: {
      drones:  [29.14, 58.27, 87.31, 116.54],     // Bb root, dimished cluster
      pads:    [116.54, 138.59, 174.61, 246.94],
      shimmer: [1318.51, 1567.98],
      padCycle: 8, shimCycle: 5,
      vol: 0.30, filterHz: 1150, filterQ: 1.6,
      lfoHz: 1.20, lfoDepth: 0.44,
      pulse: true,  pulseHz: 87.31, pulseMs: 1700,
      noiseAmt: 0.04
    },
    // Wave 6 – Der Sog: pulled under, heavy cluster
    6: {
      drones:  [25.96, 51.91, 73.42, 116.54],     // Ab root + tritone layers
      pads:    [103.83, 138.59, 185.00, 246.94],
      shimmer: [1396.91, 1661.22],
      padCycle: 7, shimCycle: 5,
      vol: 0.35, filterHz: 1400, filterQ: 1.8,
      lfoHz: 1.70, lfoDepth: 0.50,
      pulse: true,  pulseHz: 73.42, pulseMs: 1300,
      noiseAmt: 0.07
    },
    // Wave 7 – Das Ende der Welle: climax, full weight, chromatic chaos
    7: {
      drones:  [21.83, 43.65, 65.41, 92.50, 130.81],  // F1 to C3
      pads:    [87.31, 116.54, 155.56, 207.65, 277.18],
      shimmer: [1480.00, 1760.00, 1975.53],
      padCycle: 6, shimCycle: 4,
      vol: 0.42, filterHz: 1800, filterQ: 2.0,
      lfoHz: 2.20, lfoDepth: 0.58,
      pulse: true,  pulseHz: 65.41, pulseMs: 950,
      noiseAmt: 0.11
    }
  };

  /* ----------------------------------------------------------
     Helpers
     ---------------------------------------------------------- */

  function getCtx() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function reg(n) { nodes.push(n); return n; }

  /* Simple reverb via parallel delay+feedback network */
  function makeReverb(c, input) {
    const TAPS = [0.17, 0.29, 0.41, 0.53];
    TAPS.forEach(time => {
      const d  = c.createDelay(1.0);
      const fb = c.createGain();
      const hp = c.createBiquadFilter();
      d.delayTime.value = time;
      fb.gain.value = 0.28;
      hp.type = 'highpass'; hp.frequency.value = 120;
      input.connect(d);
      d.connect(fb); fb.connect(d);   // feedback loop
      d.connect(hp); hp.connect(c.destination);
    });
  }

  /* White-noise buffer source */
  function makeNoise(c, amount, dest) {
    const len  = c.sampleRate * 3;
    const buf  = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf; src.loop = true;
    const g    = c.createGain();     g.gain.value = amount;
    const bp   = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 250; bp.Q.value = 0.6;
    src.connect(bp); bp.connect(g); g.connect(dest);
    src.start();
    reg(src);
  }

  /* Schedule breathing pads: soft swell in / swell out cycles */
  function schedulePad(g, c, maxGain, cycle, offset, cycles) {
    g.gain.setValueAtTime(0, c.currentTime + offset);
    for (let k = 0; k < cycles; k++) {
      const t = c.currentTime + offset + k * cycle;
      g.gain.linearRampToValueAtTime(0,        t);
      g.gain.linearRampToValueAtTime(maxGain,  t + cycle * 0.38);
      g.gain.linearRampToValueAtTime(maxGain * 0.65, t + cycle * 0.62);
      g.gain.linearRampToValueAtTime(0,        t + cycle);
    }
  }

  /* ----------------------------------------------------------
     Core – stop all currently playing nodes
     ---------------------------------------------------------- */

  function stopAll(fadeOut = 2.5) {
    if (pulseTimer) { clearInterval(pulseTimer); pulseTimer = null; }
    if (master && ctx) {
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.linearRampToValueAtTime(0, t + fadeOut);
      const captured = nodes.slice();
      setTimeout(() => {
        captured.forEach(n => { try { n.stop ? n.stop() : n.disconnect(); } catch (e) {} });
        if (master) { master.disconnect(); master = null; }
      }, (fadeOut + 0.3) * 1000);
    }
    nodes   = [];
    running = false;
  }

  /* ----------------------------------------------------------
     Core – build and start audio graph for a wave
     ---------------------------------------------------------- */

  function build(waveN) {
    const c = getCtx();
    if (!c || !enabled) return;
    const p = PROFILES[waveN];
    if (!p) return;

    /* Master gain – fade in slowly */
    master = c.createGain();
    master.gain.setValueAtTime(0, c.currentTime);
    master.gain.linearRampToValueAtTime(p.vol, c.currentTime + 6);

    /* Main low-pass filter (warms / darkens the sound) */
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = p.filterHz; lp.Q.value = p.filterQ;
    master.connect(lp); lp.connect(c.destination);

    /* Reverb send */
    const revSend = c.createGain(); revSend.gain.value = 0.32;
    master.connect(revSend);
    makeReverb(c, revSend);

    /* Slow LFO – modulates master gain for breathing feel */
    const lfo  = reg(c.createOscillator());
    const lfoG = c.createGain();
    lfo.type = 'sine'; lfo.frequency.value = p.lfoHz;
    lfoG.gain.value = p.lfoDepth * p.vol * 0.4;
    lfo.connect(lfoG); lfoG.connect(master.gain);
    lfo.start();

    /* Second LFO slightly detuned – creates organic shimmer */
    const lfo2  = reg(c.createOscillator());
    const lfo2G = c.createGain();
    lfo2.type = 'sine'; lfo2.frequency.value = p.lfoHz * 1.13;
    lfo2G.gain.value = p.lfoDepth * p.vol * 0.18;
    lfo2.connect(lfo2G); lfo2G.connect(master.gain);
    lfo2.start();

    /* ---- Drone layer (low, sustained oscillators) ---- */
    p.drones.forEach((freq, i) => {
      const o = reg(c.createOscillator());
      const g = c.createGain();
      o.type = i === 0 ? 'sine' : i === 1 ? 'sine' : 'triangle';
      o.frequency.value = freq;
      o.detune.value = (Math.random() - 0.5) * 7; // organic micro-detune
      /* Gain falls off with each layer */
      g.gain.value = i === 0 ? 0.75 : i === 1 ? 0.45 : 0.22 / i;
      o.connect(g); g.connect(master); g.connect(revSend);
      o.start();
    });

    /* ---- Pad layer (mid-range, breathing) ---- */
    p.pads.forEach((freq, i) => {
      const o    = reg(c.createOscillator());
      const g    = c.createGain();
      const maxG = Math.max(0.004, 0.055 - i * 0.009);
      o.type = 'sine';
      o.frequency.value = freq;
      o.detune.value = (Math.random() - 0.5) * 5;
      schedulePad(g, c, maxG, p.padCycle, i * (p.padCycle / p.pads.length) * 0.5, 20);
      o.connect(g); g.connect(master); g.connect(revSend);
      o.start();
    });

    /* ---- Shimmer layer (very high, soft) ---- */
    p.shimmer.forEach((freq, i) => {
      const o    = reg(c.createOscillator());
      const g    = c.createGain();
      const maxG = Math.max(0.002, 0.018 - i * 0.005);
      o.type = 'sine';
      o.frequency.value = freq;
      o.detune.value = (Math.random() - 0.5) * 12;
      schedulePad(g, c, maxG, p.shimCycle, i * 2.5, 25);
      o.connect(g); g.connect(master);
      o.start();
    });

    /* ---- Noise layer (waves 4+) ---- */
    if (p.noiseAmt > 0) makeNoise(c, p.noiseAmt, master);

    /* ---- Pulse layer (waves 2+) – heartbeat sub-pulse ---- */
    if (p.pulse) {
      let beat = 0;
      pulseTimer = setInterval(() => {
        if (!running || !ctx || !master) return;
        const now = ctx.currentTime;
        const o   = ctx.createOscillator();
        const g   = ctx.createGain();
        /* Every 4th beat gets a slightly louder accent */
        const accent = (beat % 4 === 0) ? 1.5 : 1.0;
        o.type = 'sine';
        o.frequency.value = p.pulseHz;
        o.detune.value = -1200; // one octave below
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.09 * p.vol * accent, now + 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
        o.connect(g); g.connect(master);
        o.start(now); o.stop(now + 1.0);
        beat++;
      }, p.pulseMs);
    }

    running = true;
  }

  /* ----------------------------------------------------------
     Public API
     ---------------------------------------------------------- */

  function start(waveN) {
    scheduledWave = waveN;
    if (running) {
      stopAll(1.8);
      setTimeout(() => { if (scheduledWave === waveN) build(waveN); }, 2000);
    } else {
      build(waveN);
    }
  }

  function stop() { stopAll(2); }

  /* Called by sound toggle – mirrors SoundManager state */
  function setEnabled(on) {
    enabled = on;
    if (!on && running) stopAll(1.5);
    if (on && scheduledWave && !running) {
      setTimeout(() => build(scheduledWave), 200);
    }
  }

  /* ----------------------------------------------------------
     Auto-start on first user interaction (browser policy)
     ---------------------------------------------------------- */
  function waitForInteraction(waveN) {
    scheduledWave = waveN;
    const handler = () => {
      if (enabled && !running && scheduledWave) {
        build(scheduledWave);
      }
      document.removeEventListener('click',   handler);
      document.removeEventListener('keydown', handler);
      document.removeEventListener('touchstart', handler);
    };
    document.addEventListener('click',      handler, { once: false });
    document.addEventListener('keydown',    handler, { once: false });
    document.addEventListener('touchstart', handler, { once: false });
    /* Also try immediately (may work if AudioContext already unlocked) */
    setTimeout(() => { if (!running && enabled && scheduledWave) { try { build(scheduledWave); } catch(e) {} } }, 300);
  }

  return { start, stop, waitForInteraction, setEnabled };
})();
