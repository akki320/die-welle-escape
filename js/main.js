/* ============================================================
   DIE WELLE – Main JS
   localStorage management, progress, stamps, unlock logic
   ============================================================ */

const DW = (() => {

  const WAVES = 7;
  const CODE_WORDS = ['GEHORSAM','DISZIPLIN','EINHEIT','AKTION','WIDERSTAND','KONTROLLE','FREIHEIT'];
  const PREFIX = 'DW_';

  /* --- Storage helpers --- */
  function save(key, val) { localStorage.setItem(PREFIX + key, val); }
  function load(key, def) { const v = localStorage.getItem(PREFIX + key); return v !== null ? v : def; }
  function clear() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(PREFIX));
    keys.forEach(k => localStorage.removeItem(k));
  }

  /* --- Wave state --- */
  function isWaveDone(n)      { return load('wave' + n + '_done', '0') === '1'; }
  function markWaveDone(n)    { save('wave' + n + '_done', '1'); }
  function isWaveUnlocked(n)  {
    if (n === 1) return true;
    return isWaveDone(n - 1);
  }
  function getStoredCode(n)   { return load('wave' + n + '_code', ''); }
  function storeCode(n, code) { save('wave' + n + '_code', code); }

  /* Task state within a wave */
  function isTaskDone(waveN, taskN) { return load('w' + waveN + '_t' + taskN + '_done', '0') === '1'; }
  function markTaskDone(waveN, taskN) { save('w' + waveN + '_t' + taskN + '_done', '1'); }

  /* --- Progress --- */
  function countDone() {
    let n = 0;
    for (let i = 1; i <= WAVES; i++) if (isWaveDone(i)) n++;
    return n;
  }

  /* --- Render progress on index page --- */
  function renderProgress() {
    const bar = document.getElementById('progress-fill');
    const label = document.getElementById('progress-label');
    const done = countDone();
    if (bar)   bar.style.width = (done / WAVES * 100) + '%';
    if (label) label.textContent = done + ' / ' + WAVES + ' Wellen abgeschlossen';
  }

  /* --- Render stamps --- */
  function renderStamps() {
    for (let i = 1; i <= WAVES; i++) {
      const el = document.getElementById('stamp-' + i);
      if (!el) continue;
      if (isWaveDone(i)) el.classList.add('earned');
      else el.classList.remove('earned');
    }
  }

  /* --- Render wave tiles on index --- */
  function renderTiles() {
    for (let i = 1; i <= WAVES; i++) {
      const tile = document.getElementById('wave-tile-' + i);
      if (!tile) continue;
      tile.classList.remove('wave-tile--locked','wave-tile--done','wave-tile--available');
      const statusEl = tile.querySelector('.wave-tile__status-text');
      const iconEl   = tile.querySelector('.wave-tile__status-icon');
      if (isWaveDone(i)) {
        tile.classList.add('wave-tile--done');
        tile.removeAttribute('aria-disabled');
        if (iconEl)   iconEl.innerHTML = '<div class="check-icon">✓</div>';
        if (statusEl) statusEl.textContent = 'Abgeschlossen';
        tile.onclick = null;
      } else if (isWaveUnlocked(i)) {
        tile.classList.add('wave-tile--available');
        tile.removeAttribute('aria-disabled');
        if (iconEl)   iconEl.innerHTML = '<div class="open-icon">▶</div>';
        if (statusEl) statusEl.textContent = 'Offen – betreten';
        tile.onclick = null;
      } else {
        tile.classList.add('wave-tile--locked');
        tile.setAttribute('aria-disabled','true');
        if (iconEl)   iconEl.innerHTML = '<div class="seal-icon"></div>';
        if (statusEl) statusEl.textContent = 'Gesperrt – löse Welle ' + (i-1);
        tile.onclick = (e) => { e.preventDefault(); shakeEl(tile); };
      }
    }
  }

  /* --- Shake helper --- */
  function shakeEl(el) {
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
    el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true });
  }

  /* --- Sound toggle button --- */
  function initSoundBtn() {
    const btn = document.getElementById('sound-toggle');
    if (!btn) return;
    function updateBtn() {
      btn.textContent = SoundManager.isEnabled() ? '🔊' : '🔇';
      btn.title = SoundManager.isEnabled() ? 'Sound ausschalten' : 'Sound einschalten';
    }
    updateBtn();
    btn.addEventListener('click', () => {
      const on = SoundManager.toggle();
      updateBtn();
      if (typeof AmbientMusic !== 'undefined') AmbientMusic.setEnabled(on);
    });
  }

  /* --- Confetti --- */
  function launchConfetti() {
    const canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    document.body.appendChild(canvas);
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');

    const COLORS = ['#f5f0e8','#8b0000','#c0c0c0','#4a8f42','#cc4400','#fff'];
    const pieces = Array.from({length: 130}, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height * 0.5,
      w: 6 + Math.random() * 8,
      h: 3 + Math.random() * 5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      angle: Math.random() * Math.PI * 2,
      vx: (Math.random() - 0.5) * 3,
      vy: 2 + Math.random() * 4,
      vr: (Math.random() - 0.5) * 0.2,
      fade: 0,
    }));

    let frame;
    let elapsed = 0;
    const start = performance.now();

    function draw(now) {
      elapsed = now - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = 0;
      pieces.forEach(p => {
        p.x  += p.vx;
        p.y  += p.vy;
        p.vy += 0.08;
        p.angle += p.vr;
        if (elapsed > 2200) p.fade += 0.015;
        const alpha = Math.max(0, 1 - p.fade);
        if (alpha > 0 && p.y < canvas.height + 20) { alive++; }
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
        ctx.restore();
      });
      if (alive > 0 && elapsed < 5000) {
        frame = requestAnimationFrame(draw);
      } else {
        canvas.remove();
      }
    }
    frame = requestAnimationFrame(draw);
  }

  /* --- Stamp animation in task block --- */
  function showStamp(containerEl, text) {
    const existing = containerEl.querySelector('.stamp-overlay');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.className = 'stamp-overlay';
    div.innerHTML = `
      <svg class="stamp-svg" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <circle cx="60" cy="60" r="54" fill="none" stroke="#2d5a27" stroke-width="4" stroke-dasharray="8 4"/>
        <circle cx="60" cy="60" r="44" fill="rgba(45,90,39,0.18)" stroke="#4a8f42" stroke-width="2"/>
        <text x="60" y="55" text-anchor="middle" font-family="Courier New" font-size="12" font-weight="bold" fill="#4a8f42" text-transform="uppercase">RICHTIG</text>
        <text x="60" y="72" text-anchor="middle" font-family="Courier New" font-size="10" fill="#4a8f42">${text || '✓'}</text>
      </svg>`;
    containerEl.style.position = 'relative';
    containerEl.appendChild(div);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        div.classList.add('stamp-show');
        setTimeout(() => {
          div.classList.add('stamp-fade');
          setTimeout(() => div.remove(), 400);
        }, 1200);
      });
    });
  }

  /* --- Init on page load --- */
  function init() {
    SoundManager.init();
    initSoundBtn();
    renderProgress();
    renderStamps();
    renderTiles();
  }

  return {
    init,
    isWaveDone, markWaveDone,
    isWaveUnlocked,
    isTaskDone, markTaskDone,
    getStoredCode, storeCode,
    CODE_WORDS,
    shakeEl,
    launchConfetti,
    showStamp,
    renderProgress, renderStamps, renderTiles,
    countDone,
    clear,
  };
})();

document.addEventListener('DOMContentLoaded', DW.init);
