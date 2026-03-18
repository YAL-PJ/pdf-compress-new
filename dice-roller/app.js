// === STATE ===
const tray = {}; // { sides: count }
const history = [];
const DICE_COLORS = {
  4: '#c9a84c',
  6: '#c9a84c',
  8: '#c9a84c',
  10: '#c9a84c',
  12: '#c9a84c',
  20: '#cc3333',
  100: '#7b3fa0'
};

// === DOM REFS ===
const trayContents = document.getElementById('tray-contents');
const rollAllBtn = document.getElementById('roll-all-btn');
const clearTrayBtn = document.getElementById('clear-tray-btn');
const resultsArea = document.getElementById('results-area');
const resultsList = document.getElementById('results-list');
const totalEl = document.getElementById('total');
const historySection = document.getElementById('history-section');
const historyList = document.getElementById('history-list');

// === SOUNDS (Web Audio API) ===
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playRollSound() {
  // Short percussive click-roll sound
  const duration = 0.15;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const noise = audioCtx.createOscillator();
  const noiseGain = audioCtx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(200, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + duration);
  gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

  noise.type = 'sawtooth';
  noise.frequency.setValueAtTime(800, audioCtx.currentTime);
  noise.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + duration);
  noiseGain.gain.setValueAtTime(0.04, audioCtx.currentTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

  osc.connect(gain).connect(audioCtx.destination);
  noise.connect(noiseGain).connect(audioCtx.destination);
  osc.start(); noise.start();
  osc.stop(audioCtx.currentTime + duration);
  noise.stop(audioCtx.currentTime + duration);
}

function playCritSound() {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(523, audioCtx.currentTime);
  osc.frequency.setValueAtTime(659, audioCtx.currentTime + 0.1);
  osc.frequency.setValueAtTime(784, audioCtx.currentTime + 0.2);
  osc.frequency.setValueAtTime(1047, audioCtx.currentTime + 0.3);
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.5);
}

function playFumbleSound() {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.4);
  gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.4);
}

// === ADD DIE TO TRAY ===
function addDie(sides) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  tray[sides] = (tray[sides] || 0) + 1;
  renderTray();
  playRollSound();
}

function removeDie(sides) {
  if (tray[sides]) {
    tray[sides]--;
    if (tray[sides] <= 0) delete tray[sides];
    renderTray();
  }
}

function clearTray() {
  Object.keys(tray).forEach(k => delete tray[k]);
  renderTray();
  resultsArea.classList.add('hidden');
}

// === RENDER TRAY ===
function renderTray() {
  const hasDice = Object.keys(tray).length > 0;
  rollAllBtn.disabled = !hasDice;
  clearTrayBtn.disabled = !hasDice;

  trayContents.innerHTML = '';

  const sortedDice = Object.keys(tray).map(Number).sort((a, b) => a - b);

  sortedDice.forEach(sides => {
    const count = tray[sides];
    const el = document.createElement('div');
    el.className = 'tray-die';
    el.dataset.sides = sides;

    const color = DICE_COLORS[sides] || '#c9a84c';
    el.innerHTML = `
      <div class="tray-die-icon" style="color: ${color}">
        ${getDiceIcon(sides)}
      </div>
      <span class="tray-die-count" style="color: ${color}">${count > 1 ? count : ''}d${sides}</span>
      <div class="tray-die-btns">
        <button onclick="addDie(${sides})" title="Add another d${sides}">+</button>
        <button onclick="removeDie(${sides})" title="Remove one d${sides}">−</button>
      </div>
    `;
    trayContents.appendChild(el);
  });
}

function getDiceIcon(sides) {
  const icons = {
    4: '▲',
    6: '⬡',
    8: '◆',
    10: '⬠',
    12: '⬟',
    20: '⏣',
    100: '💯'
  };
  return `<span style="font-size: 1.4rem">${icons[sides] || '🎲'}</span>`;
}

// === ROLL ALL ===
let isRolling = false;

function rollAll() {
  if (isRolling) return;
  const diceInTray = Object.keys(tray);
  if (diceInTray.length === 0) return;

  isRolling = true;
  rollAllBtn.classList.add('rolling');
  resultsArea.classList.remove('hidden');
  resultsList.innerHTML = '';
  totalEl.textContent = '';
  totalEl.className = 'total';

  // Add rolling animation to all tray dice
  document.querySelectorAll('.tray-die').forEach(el => {
    el.classList.add('rolling');
  });

  playRollSound();

  // Simulate multiple rapid number changes
  const rollDuration = 800;
  const intervalTime = 60;
  let elapsed = 0;

  const interval = setInterval(() => {
    elapsed += intervalTime;

    // Show random numbers rapidly
    resultsList.innerHTML = '';
    let tempTotal = 0;
    const sortedDice = Object.keys(tray).map(Number).sort((a, b) => a - b);

    sortedDice.forEach(sides => {
      const count = tray[sides];
      for (let i = 0; i < count; i++) {
        const val = Math.floor(Math.random() * sides) + 1;
        tempTotal += val;
        const chip = document.createElement('div');
        chip.className = 'result-chip';
        chip.innerHTML = `<span class="die-type">d${sides}</span><span class="die-value">${val}</span>`;
        resultsList.appendChild(chip);
      }
    });
    totalEl.textContent = `= ${tempTotal}`;

    if (elapsed >= rollDuration) {
      clearInterval(interval);
      finishRoll();
    }
  }, intervalTime);
}

function finishRoll() {
  const results = [];
  let total = 0;
  const sortedDice = Object.keys(tray).map(Number).sort((a, b) => a - b);

  sortedDice.forEach(sides => {
    const count = tray[sides];
    for (let i = 0; i < count; i++) {
      const value = Math.floor(Math.random() * sides) + 1;
      results.push({ sides, value });
      total += value;
    }
  });

  // Render final results
  resultsList.innerHTML = '';
  results.forEach((r, idx) => {
    setTimeout(() => {
      const chip = document.createElement('div');
      const isMax = r.value === r.sides;
      const isMin = r.value === 1;
      chip.className = `result-chip${isMax ? ' max-roll' : ''}${isMin ? ' min-roll' : ''}`;
      chip.innerHTML = `<span class="die-type">d${r.sides}</span><span class="die-value">${r.value}</span>`;
      resultsList.appendChild(chip);
    }, idx * 80);
  });

  // Show total with delay
  setTimeout(() => {
    totalEl.textContent = `= ${total}`;

    // Check for nat 20 / nat 1 on single d20
    const isSingleD20 = results.length === 1 && results[0].sides === 20;
    if (isSingleD20 && results[0].value === 20) {
      totalEl.className = 'total nat20';
      totalEl.textContent = `= 20 — NATURAL 20! ⚔️`;
      screenFlash('crit');
      playCritSound();
    } else if (isSingleD20 && results[0].value === 1) {
      totalEl.className = 'total nat1';
      totalEl.textContent = `= 1 — CRITICAL FAIL! 💀`;
      screenFlash('fumble');
      playFumbleSound();
    } else {
      // Check if ALL dice rolled max
      const allMax = results.every(r => r.value === r.sides);
      if (allMax && results.length > 1) {
        totalEl.className = 'total nat20';
        playCritSound();
        screenFlash('crit');
      }
      // Check if ALL dice rolled 1
      const allMin = results.every(r => r.value === 1);
      if (allMin && results.length > 1) {
        totalEl.className = 'total nat1';
        playFumbleSound();
        screenFlash('fumble');
      }
    }
  }, results.length * 80 + 100);

  // Remove rolling state
  document.querySelectorAll('.tray-die').forEach(el => {
    el.classList.remove('rolling');
  });
  rollAllBtn.classList.remove('rolling');
  isRolling = false;

  // Add to history
  const diceStr = sortedDice.map(s => `${tray[s]}d${s}`).join(' + ');
  const resultStr = results.map(r => r.value).join(', ');
  addToHistory(diceStr, resultStr, total);
}

function screenFlash(type) {
  const flash = document.createElement('div');
  flash.className = `screen-flash ${type}`;
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 600);
}

// === HISTORY ===
function addToHistory(dice, results, total) {
  history.unshift({ dice, results, total, time: new Date() });
  if (history.length > 20) history.pop();
  renderHistory();
}

function renderHistory() {
  historySection.classList.remove('hidden');
  historyList.innerHTML = '';

  history.forEach((h, i) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.style.animationDelay = `${i * 0.05}s`;
    item.innerHTML = `
      <span class="history-dice">${h.dice}</span>
      <span class="history-results">[${h.results}]</span>
      <span class="history-total">= ${h.total}</span>
    `;
    historyList.appendChild(item);
  });
}

// === EVENT LISTENERS ===
rollAllBtn.addEventListener('click', rollAll);
clearTrayBtn.addEventListener('click', clearTray);

// Keyboard shortcut: Space/Enter to roll
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') {
    if (e.target.tagName !== 'BUTTON') {
      e.preventDefault();
      rollAll();
    }
  }
});

// Quick-add: number keys add dice
document.addEventListener('keydown', (e) => {
  const keyMap = {
    '1': 4,   // 1 -> d4
    '2': 6,   // 2 -> d6
    '3': 8,   // 3 -> d8
    '4': 10,  // 4 -> d10
    '5': 12,  // 5 -> d12
    '6': 20,  // 6 -> d20
    '7': 100  // 7 -> d100
  };
  if (e.target.tagName !== 'INPUT' && keyMap[e.key]) {
    addDie(keyMap[e.key]);
  }
});

// Initialize
renderTray();
