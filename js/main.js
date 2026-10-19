// =====================================================================
//  HAUPTPROGRAMM: Spielmodus, Eingabe (Tastatur + Touch), Spielschleife
// =====================================================================

const Game = {
  mode: 'world', // world | dialog | menu | battle | transition
};

// ---------------- Eingabe ----------------
const Input = {
  stack: [], // gedrückte Richtungen, letzte gewinnt
  press(d) {
    if (!this.stack.includes(d)) this.stack.push(d);
    // sofort loslaufen, damit auch kurzes Antippen einen Schritt macht
    if (Game.mode === 'world' && !World.moving) tryMove(d);
  },
  release(d) { this.stack = this.stack.filter(x => x !== d); },
  dir() { return this.stack[this.stack.length - 1] || null; },
};

const KEY_DIRS = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };

window.addEventListener('keydown', (e) => {
  const d = KEY_DIRS[e.code];
  if (d) { Input.press(d); e.preventDefault(); return; }
  if (e.repeat) return;
  if (['Space', 'Enter', 'KeyE'].includes(e.code)) { e.preventDefault(); pressA(); }
  else if (['Escape', 'KeyM', 'KeyI', 'Tab'].includes(e.code)) { e.preventDefault(); pressMenu(); }
  else if (Game.mode === 'battle' && /^Digit[1-9]$/.test(e.code)) {
    const btns = document.querySelectorAll('#battle-actions button');
    const b = btns[+e.code.slice(5) - 1];
    if (b && !b.disabled) b.click();
  }
});
window.addEventListener('keyup', (e) => { const d = KEY_DIRS[e.code]; if (d) Input.release(d); });
window.addEventListener('blur', () => { Input.stack = []; });

function pressA() {
  if (Game.mode === 'dialog') UI.nextLine();
  else if (Game.mode === 'world') interact();
}
function pressMenu() {
  if (Game.mode === 'world') UI.openMenu('status');
  else if (Game.mode === 'menu') UI.closePanel();
}

function setupTouch() {
  for (const b of document.querySelectorAll('#dpad button')) {
    const d = b.dataset.dir;
    const down = (e) => { e.preventDefault(); Input.press(d); b.classList.add('on'); };
    const up = (e) => { e.preventDefault(); Input.release(d); b.classList.remove('on'); };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('pointerleave', up);
  }
  $('btn-a').addEventListener('pointerdown', (e) => { e.preventDefault(); pressA(); });
  $('btn-menu').addEventListener('click', pressMenu);
  $('panel-close').addEventListener('click', () => UI.closePanel());
  $('dialog').addEventListener('pointerdown', (e) => { e.preventDefault(); UI.nextLine(); });
  // Tippen auf die Spielwelt = interagieren (praktisch am Tablet)
  World.canvas.addEventListener('pointerdown', () => { if (Game.mode === 'world') interact(); });
}

// ---------------- Zonenwechsel & Kampf ----------------
Game.changeZone = function (zone, x, y, dir) {
  this.mode = 'transition';
  Input.stack = [];
  const fade = $('fade');
  fade.classList.add('on');
  setTimeout(() => {
    loadZone(zone, x, y, dir);
    saveGame();
    fade.classList.remove('on');
    setTimeout(() => { this.mode = 'world'; }, 250);
  }, 300);
};

Game.startBattle = function (enemyId, bossObj) {
  this.mode = 'transition';
  Input.stack = [];
  const fade = $('fade');
  fade.classList.add('on', 'battle');
  setTimeout(() => {
    this.mode = 'battle';
    $('battle').classList.remove('hidden');
    $('touch').classList.add('hidden-in-battle');
    Battle.start(enemyId, bossObj);
    fade.classList.remove('on', 'battle');
  }, 450);
};

Game.endBattle = function () {
  $('battle').classList.add('hidden');
  $('touch').classList.remove('hidden-in-battle');
  this.mode = 'world';
  World.stepGrace = 3;
  UI.updateHud();
  saveGame();
};

Game.onDefeat = function () {
  const p = S.player;
  const lost = Math.floor(p.gold / 2);
  p.gold -= lost;
  p.hp = stats().maxHp; p.mp = stats().maxMp; p.poison = 0;
  loadZone(RESPAWN.zone, RESPAWN.x, RESPAWN.y, RESPAWN.dir);
  saveGame();
  UI.dialog('Heilerin Lina', ['Man hat dich bewusstlos ins Dorf gebracht...', `Du hast ${lost} Gold verloren. Ruh dich aus und versuch es erneut!`]);
};

// ---------------- Spielschleife ----------------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (Game.mode === 'world' || World.moving) updateWorld(dt);
  else World.time += dt;
  if (Game.mode !== 'battle') renderWorld();
  requestAnimationFrame(loop);
}

function boot() {
  World.canvas = $('game');
  World.ctx = World.canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  setupTouch();

  const loaded = loadGame();
  if (!loaded) newGame();
  loadZone(S.zone, S.x, S.y, S.dir);
  if (!S.introSeen) {
    S.introSeen = true;
    UI.dialog(null, [
      'Willkommen in Eichenhain! ⚔️',
      'Erkunde die Zonen, sammle Rohstoffe, baue dir Ausrüstung – und besiege am Ende den Kristallgolem.',
      'Steuerung: Pfeiltasten/WASD bzw. Steuerkreuz. Interagieren mit Leertaste oder A. Menü mit M bzw. ☰.',
      'Tipp: In der Truhe unten rechts im Dorf liegt etwas Nützliches!',
    ]);
  } else UI.toast('Spielstand geladen', 'loot');
  requestAnimationFrame(loop);
}

boot();
