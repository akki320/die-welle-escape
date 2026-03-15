/* ============================================================
   DIE WELLE – Sound Manager (Web Audio API, no external files)
   ============================================================ */

const SoundManager = (() => {
  let ctx = null;
  let enabled = true;

  function getCtx() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        return null;
      }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /* Low-level helpers */
  function osc(type, freq, start, dur, gainVal, c) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(gainVal, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  /* Success: pleasant ascending chime */
  function playSuccess() {
    const c = getCtx(); if (!c || !enabled) return;
    const t = c.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((f, i) => osc('sine', f, t + i * 0.12, 0.5, 0.25, c));
  }

  /* Error: low two-tone buzz */
  function playError() {
    const c = getCtx(); if (!c || !enabled) return;
    const t = c.currentTime;
    osc('sawtooth', 180, t,       0.18, 0.18, c);
    osc('sawtooth', 120, t + 0.2, 0.22, 0.15, c);
  }

  /* Unlock: rising sweep */
  function playUnlock() {
    const c = getCtx(); if (!c || !enabled) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(300, t);
    o.frequency.exponentialRampToValueAtTime(900, t + 0.4);
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    o.connect(g);
    g.connect(c.destination);
    o.start(t);
    o.stop(t + 0.5);
  }

  /* Wave complete: fanfare */
  function playComplete() {
    const c = getCtx(); if (!c || !enabled) return;
    const t = c.currentTime;
    const fanfare = [
      [523.25, 0],
      [523.25, 0.12],
      [523.25, 0.24],
      [659.25, 0.36],
      [783.99, 0.50],
      [783.99, 0.62],
      [783.99, 0.74],
      [1046.5, 0.90],
    ];
    fanfare.forEach(([f, d]) => osc('sine', f, t + d, 0.35, 0.22, c));
  }

  /* Tip reveal: soft ping */
  function playTip() {
    const c = getCtx(); if (!c || !enabled) return;
    const t = c.currentTime;
    osc('sine', 880, t, 0.3, 0.12, c);
    osc('sine', 1100, t + 0.1, 0.25, 0.08, c);
  }

  function toggle() {
    enabled = !enabled;
    localStorage.setItem('DW_sound', enabled ? '1' : '0');
    return enabled;
  }

  function init() {
    const stored = localStorage.getItem('DW_sound');
    if (stored !== null) enabled = stored === '1';
  }

  function isEnabled() { return enabled; }

  return { init, toggle, isEnabled, playSuccess, playError, playUnlock, playComplete, playTip };
})();
