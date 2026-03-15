/* ============================================================
   DIE WELLE – Aufgaben (Task Engine)
   Handles rendering & validation for all task types.
   ============================================================ */

const Aufgaben = (() => {

  /* ---- Helpers ---- */
  function feedback(containerEl, type, msg) {
    let el = containerEl.querySelector('.feedback');
    if (!el) {
      el = document.createElement('div');
      el.className = 'feedback';
      containerEl.appendChild(el);
    }
    el.className = 'feedback show feedback--' + type;
    el.innerHTML = `<span class="feedback__icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span><span>${msg}</span>`;
  }

  function disableChildren(el, sel) {
    el.querySelectorAll(sel).forEach(e => e.disabled = true);
  }

  function showRetryButton(block, retryFn) {
    const existing = block.querySelector('.retry-btn');
    if (existing) existing.remove();
    const btn = document.createElement('button');
    btn.className = 'btn btn--ghost retry-btn';
    btn.textContent = '↺ Erneut versuchen';
    btn.addEventListener('click', () => {
      btn.remove();
      const fb = block.querySelector('.feedback');
      if (fb) fb.classList.remove('show');
      retryFn();
    });
    const fb = block.querySelector('.feedback');
    if (fb) fb.after(btn);
    else block.appendChild(btn);
  }

  function showNextTaskUnlock(waveN, taskN) {
    const nextBlock = document.getElementById('task-block-' + (taskN + 1));
    if (nextBlock) {
      nextBlock.classList.remove('task--locked');
      nextBlock.classList.add('unlocking');
      SoundManager.playUnlock();
      nextBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
      nextBlock.addEventListener('animationend', () => nextBlock.classList.remove('unlocking'), { once: true });
    } else {
      // All tasks done – show code challenge if present
      const codeSection = document.getElementById('code-challenge-section');
      if (codeSection) {
        codeSection.classList.remove('hidden');
        codeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        SoundManager.playUnlock();
      }
    }
  }

  function markAndAdvance(waveN, taskN, blockEl) {
    DW.markTaskDone(waveN, taskN);
    blockEl.classList.add('task--completed');
    DW.showStamp(blockEl, 'Welle ' + waveN);
    setTimeout(() => showNextTaskUnlock(waveN, taskN), 600);
  }

  /* ---- Multiple Choice ---- */
  function initMC(waveN, taskN, correctIdx) {
    const block = document.getElementById('task-block-' + taskN);
    if (!block) return;
    if (DW.isTaskDone(waveN, taskN)) { unlockCompleted(block, waveN, taskN); return; }

    const options = block.querySelectorAll('.mc-option');
    const btn = block.querySelector('.mc-submit');
    if (!btn) return;

    btn.addEventListener('click', () => {
      const checked = block.querySelector('input[type="radio"]:checked');
      if (!checked) { feedback(block, 'info', 'Bitte wähle eine Antwort aus.'); return; }
      const idx = parseInt(checked.value, 10);
      disableChildren(block, 'input[type="radio"]');
      btn.disabled = true;
      if (idx === correctIdx) {
        options.forEach((opt, i) => {
          opt.classList.remove('correct','wrong');
          if (i === correctIdx) opt.classList.add('correct');
        });
        feedback(block, 'success', 'Richtig! Sehr gut.');
        SoundManager.playSuccess();
        markAndAdvance(waveN, taskN, block);
      } else {
        options.forEach((opt, i) => {
          opt.classList.remove('correct','wrong');
          if (i === idx) opt.classList.add('wrong');
        });
        feedback(block, 'error', 'Leider falsch. Versuche es noch einmal!');
        SoundManager.playError();
        DW.shakeEl(block);
        showRetryButton(block, () => {
          options.forEach(opt => opt.classList.remove('correct', 'wrong'));
          block.querySelectorAll('input[type="radio"]').forEach(r => { r.disabled = false; r.checked = false; });
          btn.disabled = false;
        });
      }
    });
  }

  /* ---- True/False ---- */
  function initTF(waveN, taskN, answers) {
    // answers: array of 'r' or 'f'
    const block = document.getElementById('task-block-' + taskN);
    if (!block) return;
    if (DW.isTaskDone(waveN, taskN)) { unlockCompleted(block, waveN, taskN); return; }

    const rows = block.querySelectorAll('.tf-row');
    const btn = block.querySelector('.tf-submit');
    if (!btn) return;

    rows.forEach(row => {
      row.querySelectorAll('.tf-btn').forEach(b => {
        b.addEventListener('click', () => {
          row.querySelectorAll('.tf-btn').forEach(x => x.classList.remove('selected-r','selected-f'));
          b.classList.add(b.dataset.val === 'r' ? 'selected-r' : 'selected-f');
        });
      });
    });

    btn.addEventListener('click', () => {
      let allCorrect = true;
      const rowResults = [];
      rows.forEach((row, i) => {
        const sel = row.querySelector('.tf-btn.selected-r, .tf-btn.selected-f');
        if (!sel) { allCorrect = false; rowResults.push(null); return; }
        const val = sel.dataset.val;
        const correct = answers[i];
        rowResults.push({ val, correct });
        if (val !== correct) allCorrect = false;
      });

      rows.forEach(row => row.querySelectorAll('.tf-btn').forEach(b => b.disabled = true));
      btn.disabled = true;

      if (allCorrect) {
        rows.forEach((row, i) => {
          const r = rowResults[i];
          if (!r) return;
          row.querySelectorAll('.tf-btn').forEach(b => {
            if (b.dataset.val === r.correct) b.classList.add('correct-final');
          });
          row.classList.add('correct-row');
        });
        feedback(block, 'success', 'Alle Aussagen richtig bewertet!');
        SoundManager.playSuccess();
        markAndAdvance(waveN, taskN, block);
      } else {
        rows.forEach((row, i) => {
          const r = rowResults[i];
          if (!r) return;
          if (r.val !== r.correct) {
            row.querySelectorAll('.tf-btn').forEach(b => {
              if (b.dataset.val === r.val) b.classList.add('wrong-final');
            });
            row.classList.add('wrong-row');
          }
        });
        feedback(block, 'error', 'Nicht alle Antworten sind korrekt. Versuche es noch einmal!');
        SoundManager.playError();
        DW.shakeEl(block);
        showRetryButton(block, () => {
          rows.forEach(row => {
            row.classList.remove('wrong-row', 'correct-row');
            row.querySelectorAll('.tf-btn').forEach(b => {
              b.disabled = false;
              b.classList.remove('selected-r', 'selected-f', 'correct-final', 'wrong-final');
            });
          });
          btn.disabled = false;
        });
      }
    });
  }

  /* ---- Assignment (Drag & Drop with touch) ---- */
  function initAssignment(waveN, taskN, pairs) {
    // pairs: [{label, value}] – label is the target description, value is the draggable
    const block = document.getElementById('task-block-' + taskN);
    if (!block) return;
    if (DW.isTaskDone(waveN, taskN)) { unlockCompleted(block, waveN, taskN); return; }

    setupDragDrop(block, 'assign');

    const btn = block.querySelector('.assign-submit');
    if (!btn) return;

    btn.addEventListener('click', () => {
      let allCorrect = true;
      const drops = block.querySelectorAll('.assign-drop');
      drops.forEach((drop) => {
        const expected = drop.dataset.expected;
        const item = drop.querySelector('.dnd-item');
        const got = item ? item.dataset.value : '';
        if (got !== expected) allCorrect = false;
      });

      btn.disabled = true;
      block.querySelectorAll('.dnd-item').forEach(i => { i.draggable = false; i.style.cursor = 'default'; });

      if (allCorrect) {
        drops.forEach(drop => drop.classList.add('correct-drop'));
        feedback(block, 'success', 'Alle Zuordnungen korrekt!');
        SoundManager.playSuccess();
        markAndAdvance(waveN, taskN, block);
      } else {
        drops.forEach((drop) => {
          const expected = drop.dataset.expected;
          const item = drop.querySelector('.dnd-item');
          const got = item ? item.dataset.value : '';
          drop.classList.remove('correct-drop','wrong-drop');
          if (got !== expected) drop.classList.add('wrong-drop');
        });
        feedback(block, 'error', 'Einige Zuordnungen sind falsch. Versuche es noch einmal!');
        SoundManager.playError();
        DW.shakeEl(block);
        showRetryButton(block, () => {
          block.querySelectorAll('.assign-drop').forEach(d => d.classList.remove('correct-drop', 'wrong-drop'));
          block.querySelectorAll('.dnd-item').forEach(i => { i.draggable = true; i.style.cursor = ''; });
          btn.disabled = false;
        });
      }
    });
  }

  /* ---- Sorting (Drag & Drop) ---- */
  function initSorting(waveN, taskN, correctOrder) {
    // correctOrder: array of strings representing text content in correct order
    const block = document.getElementById('task-block-' + taskN);
    if (!block) return;
    if (DW.isTaskDone(waveN, taskN)) { unlockCompleted(block, waveN, taskN); return; }

    setupSortDrag(block);

    const btn = block.querySelector('.sort-submit');
    if (!btn) return;

    btn.addEventListener('click', () => {
      const items = block.querySelectorAll('.sort-item');
      let allCorrect = true;
      items.forEach((item, i) => {
        if (item.dataset.value !== correctOrder[i]) allCorrect = false;
      });
      btn.disabled = true;
      block.querySelectorAll('.sort-item').forEach(i => { i.draggable = false; i.style.cursor = 'default'; });

      if (allCorrect) {
        items.forEach(item => { item.classList.remove('sort-correct','sort-wrong'); item.classList.add('sort-correct'); });
        feedback(block, 'success', 'Richtige Reihenfolge!');
        SoundManager.playSuccess();
        markAndAdvance(waveN, taskN, block);
      } else {
        items.forEach((item, i) => {
          item.classList.remove('sort-correct','sort-wrong');
          if (item.dataset.value !== correctOrder[i]) item.classList.add('sort-wrong');
        });
        feedback(block, 'error', 'Die Reihenfolge ist nicht ganz korrekt. Versuche es noch einmal!');
        SoundManager.playError();
        DW.shakeEl(block);
        showRetryButton(block, () => {
          block.querySelectorAll('.sort-item').forEach(i => {
            i.classList.remove('sort-correct', 'sort-wrong');
            i.draggable = true;
            i.style.cursor = '';
          });
          btn.disabled = false;
        });
      }
    });
  }

  /* ---- Multiple Selection ---- */
  function initMS(waveN, taskN, correctIndices, requiresText) {
    const block = document.getElementById('task-block-' + taskN);
    if (!block) return;
    if (DW.isTaskDone(waveN, taskN)) { unlockCompleted(block, waveN, taskN); return; }

    // Tip system (60s + 120s)
    setupTips(block, waveN, taskN);

    const btn = block.querySelector('.ms-submit');
    if (!btn) return;

    btn.addEventListener('click', () => {
      if (requiresText) {
        const ta = block.querySelector('.ms-textarea');
        if (ta && ta.value.trim().length < 10) {
          feedback(block, 'info', 'Bitte begründe deine Auswahl in mindestens einem Satz.');
          return;
        }
      }

      const options = block.querySelectorAll('.ms-option');
      let allCorrect = true;
      options.forEach((opt, i) => {
        const cb = opt.querySelector('input[type="checkbox"]');
        const shouldBeChecked = correctIndices.includes(i);
        if (shouldBeChecked && cb && !cb.checked) allCorrect = false;
        if (!shouldBeChecked && cb && cb.checked) allCorrect = false;
      });

      options.forEach(opt => { const cb = opt.querySelector('input[type="checkbox"]'); if (cb) cb.disabled = true; });
      btn.disabled = true;

      if (allCorrect) {
        options.forEach((opt, i) => {
          opt.classList.remove('ms-correct','ms-wrong');
          if (correctIndices.includes(i)) opt.classList.add('ms-correct');
        });
        feedback(block, 'success', 'Alle richtigen Antworten ausgewählt!');
        SoundManager.playSuccess();
        markAndAdvance(waveN, taskN, block);
      } else {
        options.forEach((opt, i) => {
          const cb = opt.querySelector('input[type="checkbox"]');
          opt.classList.remove('ms-correct','ms-wrong');
          if (!correctIndices.includes(i) && cb && cb.checked) opt.classList.add('ms-wrong');
        });
        feedback(block, 'error', 'Nicht alle Antworten stimmen. Versuche es noch einmal!');
        SoundManager.playError();
        DW.shakeEl(block);
        showRetryButton(block, () => {
          block.querySelectorAll('.ms-option').forEach(opt => {
            opt.classList.remove('ms-correct', 'ms-wrong');
            const cb = opt.querySelector('input[type="checkbox"]');
            if (cb) { cb.disabled = false; cb.checked = false; }
          });
          btn.disabled = false;
        });
      }
    });
  }

  /* ---- Tip System ---- */
  function setupTips(block, waveN, taskN) {
    const tip1Btn = block.querySelector('.tip-btn-1');
    const tip2Btn = block.querySelector('.tip-btn-2');
    const tip1Box = block.querySelector('.tip-box-1');
    const tip2Box = block.querySelector('.tip-box-2');

    if (tip1Btn && tip1Box) {
      let t1 = setTimeout(() => {
        tip1Btn.style.display = 'inline-block';
        SoundManager.playTip();
      }, 60000);
      tip1Btn.addEventListener('click', () => {
        tip1Box.classList.add('show');
        tip1Btn.style.display = 'none';
      });
    }
    if (tip2Btn && tip2Box) {
      let t2 = setTimeout(() => {
        tip2Btn.style.display = 'inline-block';
        SoundManager.playTip();
      }, 120000);
      tip2Btn.addEventListener('click', () => {
        tip2Box.classList.add('show');
        tip2Btn.style.display = 'none';
      });
    }
  }

  /* ---- Code Challenge ---- */
  function initCodeChallenge(waveN, codeWord) {
    const section = document.getElementById('code-challenge-section');
    if (!section) return;

    // If all 5 tasks done, show it immediately
    let allDone = true;
    for (let i = 1; i <= 5; i++) if (!DW.isTaskDone(waveN, i)) { allDone = false; break; }
    if (allDone) section.classList.remove('hidden');

    const input = section.querySelector('.code-input');
    const btn   = section.querySelector('.code-submit');
    const fb    = section.querySelector('.code-feedback');

    // Already solved?
    if (DW.isWaveDone(waveN)) {
      if (input) input.value = codeWord;
      showWaveComplete(waveN, codeWord);
      return;
    }

    if (!btn) return;
    btn.addEventListener('click', () => checkCode(waveN, codeWord, input, fb));
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') checkCode(waveN, codeWord, input, fb);
      });
    }
  }

  function checkCode(waveN, codeWord, input, fb) {
    if (!input) return;
    const val = input.value.trim().toUpperCase();
    if (val === codeWord.toUpperCase()) {
      // Correct
      if (fb) {
        fb.className = 'feedback show feedback--success';
        fb.innerHTML = '<span class="feedback__icon">✓</span><span>Das Codewort ist korrekt!</span>';
      }
      input.disabled = true;
      document.querySelector('.code-submit') && (document.querySelector('.code-submit').disabled = true);
      SoundManager.playComplete();
      DW.markWaveDone(waveN);
      DW.storeCode(waveN, codeWord);
      DW.launchConfetti();
      setTimeout(() => showWaveComplete(waveN, codeWord), 600);
    } else {
      if (fb) {
        fb.className = 'feedback show feedback--error';
        fb.innerHTML = '<span class="feedback__icon">✕</span><span>Falsches Codewort. Lies den Hinweistext noch einmal genau.</span>';
      }
      SoundManager.playError();
      DW.shakeEl(input);
    }
  }

  function showWaveComplete(waveN, codeWord) {
    const banner = document.getElementById('wave-complete-banner');
    if (!banner) return;
    banner.classList.add('show');
    const codeDisplay = banner.querySelector('.unlock-code-display');
    if (codeDisplay) codeDisplay.textContent = codeWord;
    banner.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Show "next wave" button if applicable
    const nextBtn = banner.querySelector('.next-wave-btn');
    if (nextBtn) {
      const nextN = waveN + 1;
      if (nextN <= 7) {
        nextBtn.href = 'welle' + nextN + '.html';
        nextBtn.classList.remove('hidden');
      }
    }
  }

  /* ---- Unlock completed tasks on page load ---- */
  function unlockCompleted(block, waveN, taskN) {
    block.classList.remove('task--locked');
    block.classList.add('task--completed');
    disableChildren(block, 'input[type="radio"], input[type="checkbox"]');
    disableChildren(block, 'button');
    block.querySelectorAll('.dnd-item').forEach(i => { i.draggable = false; i.style.cursor = 'default'; });
    block.querySelectorAll('.tf-btn').forEach(b => b.disabled = true);
    // Show "already solved" banner
    if (!block.querySelector('.already-solved')) {
      const banner = document.createElement('div');
      banner.className = 'already-solved';
      banner.innerHTML = '<span>✓</span> Aufgabe bereits gelöst';
      block.insertBefore(banner, block.firstChild);
    }
  }

  /* ---- Init wave page ---- */
  function initWavePage(waveN) {
    // Unlock task 1 always; subsequent tasks based on saved state
    for (let t = 1; t <= 5; t++) {
      const block = document.getElementById('task-block-' + t);
      if (!block) continue;
      if (t === 1) {
        block.classList.remove('task--locked');
      } else {
        if (DW.isTaskDone(waveN, t - 1)) {
          block.classList.remove('task--locked');
        } else {
          block.classList.add('task--locked');
        }
      }
    }
  }

  /* ====================================================
     Drag & Drop Implementation (Desktop + Touch)
     ==================================================== */

  let dragSrc = null;

  function setupDragDrop(block, mode) {
    const items = block.querySelectorAll('.dnd-item[draggable]');
    const drops = block.querySelectorAll('.assign-drop');

    items.forEach(item => {
      // Desktop
      item.addEventListener('dragstart', e => {
        dragSrc = item;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => item.classList.add('dragging'), 0);
      });
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        drops.forEach(d => d.classList.remove('drag-over'));
        dragSrc = null;
      });

      // Touch
      let touchClone = null;
      let offsetX = 0, offsetY = 0;

      item.addEventListener('touchstart', e => {
        dragSrc = item;
        const touch = e.touches[0];
        const rect = item.getBoundingClientRect();
        offsetX = touch.clientX - rect.left;
        offsetY = touch.clientY - rect.top;
        touchClone = item.cloneNode(true);
        touchClone.style.cssText = `position:fixed;opacity:0.75;pointer-events:none;z-index:9999;width:${rect.width}px;`;
        document.body.appendChild(touchClone);
        item.classList.add('dragging');
        e.preventDefault();
      }, { passive: false });

      item.addEventListener('touchmove', e => {
        if (!touchClone) return;
        const touch = e.touches[0];
        touchClone.style.left = (touch.clientX - offsetX) + 'px';
        touchClone.style.top  = (touch.clientY - offsetY) + 'px';
        drops.forEach(d => d.classList.remove('drag-over'));
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        const drop = el && el.closest('.assign-drop');
        if (drop) drop.classList.add('drag-over');
        e.preventDefault();
      }, { passive: false });

      item.addEventListener('touchend', e => {
        if (touchClone) { touchClone.remove(); touchClone = null; }
        item.classList.remove('dragging');
        const touch = e.changedTouches[0];
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        const drop = el && el.closest('.assign-drop');
        drops.forEach(d => d.classList.remove('drag-over'));
        if (drop && dragSrc) {
          dropInto(drop, dragSrc);
        }
        dragSrc = null;
      });
    });

    drops.forEach(drop => {
      drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag-over'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
      drop.addEventListener('drop', e => {
        e.preventDefault();
        drop.classList.remove('drag-over');
        if (dragSrc) dropInto(drop, dragSrc);
      });
    });
  }

  function dropInto(drop, item) {
    // If drop already has an item, swap back to source container
    const existing = drop.querySelector('.dnd-item');
    const srcParent = item.parentNode;
    if (existing && existing !== item) {
      srcParent.appendChild(existing);
    }
    drop.appendChild(item);
  }

  /* ---- Sort Drag ---- */
  function setupSortDrag(block) {
    const list = block.querySelector('.sort-list');
    if (!list) return;
    let dragItem = null;
    let touchClone = null;

    function getItems() { return [...list.querySelectorAll('.sort-item')]; }

    function updateNumbers() {
      getItems().forEach((item, i) => {
        const num = item.querySelector('.sort-num');
        if (num) num.textContent = i + 1;
      });
    }

    function insertBefore(target, src) {
      if (target && src !== target) {
        list.insertBefore(src, target);
        updateNumbers();
      }
    }

    getItems().forEach(item => {
      item.setAttribute('draggable', 'true');

      item.addEventListener('dragstart', () => {
        dragItem = item;
        setTimeout(() => item.classList.add('dragging'), 0);
      });
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        getItems().forEach(i => i.classList.remove('drag-over'));
        dragItem = null;
      });
      item.addEventListener('dragover', e => {
        e.preventDefault();
        if (dragItem && dragItem !== item) {
          getItems().forEach(i => i.classList.remove('drag-over'));
          item.classList.add('drag-over');
        }
      });
      item.addEventListener('drop', e => {
        e.preventDefault();
        item.classList.remove('drag-over');
        if (dragItem) insertBefore(item, dragItem);
      });

      // Touch
      let offX = 0, offY = 0;
      item.addEventListener('touchstart', e => {
        dragItem = item;
        const touch = e.touches[0];
        const rect = item.getBoundingClientRect();
        offX = touch.clientX - rect.left;
        offY = touch.clientY - rect.top;
        touchClone = item.cloneNode(true);
        touchClone.style.cssText = `position:fixed;opacity:0.7;pointer-events:none;z-index:9999;width:${rect.width}px;`;
        document.body.appendChild(touchClone);
        item.classList.add('dragging');
        e.preventDefault();
      }, { passive: false });

      item.addEventListener('touchmove', e => {
        if (!touchClone) return;
        const touch = e.touches[0];
        touchClone.style.left = (touch.clientX - offX) + 'px';
        touchClone.style.top  = (touch.clientY - offY) + 'px';
        e.preventDefault();
      }, { passive: false });

      item.addEventListener('touchend', e => {
        if (touchClone) { touchClone.remove(); touchClone = null; }
        item.classList.remove('dragging');
        const touch = e.changedTouches[0];
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        const target = el && el.closest('.sort-item');
        if (target && target !== dragItem) insertBefore(target, dragItem);
        dragItem = null;
      });
    });
  }

  /* ---- Public API ---- */
  return {
    initMC,
    initTF,
    initAssignment,
    initSorting,
    initMS,
    initCodeChallenge,
    initWavePage,
    setupTips,
  };

})();
