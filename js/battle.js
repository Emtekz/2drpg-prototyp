// =====================================================================
//  RUNDENBASIERTER KAMPF
//  In Godot: eigene Szene "Battle.tscn", die über die Oberwelt gelegt wird
//  (oder per change_scene). Ablauf als State-Machine bzw. mit await/Signals.
// =====================================================================

const Battle = {
  enemy: null, bossObj: null, busy: false, defending: false, over: false,
};

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

function dmgCalc(power, def) {
  return Math.max(1, Math.round(power * (0.9 + Math.random() * 0.2) - def * 0.5));
}

Battle.start = function (enemyId, bossObj) {
  const d = ENEMIES[enemyId];
  const hp = d.boss ? d.hp : Math.round(d.hp * (0.9 + Math.random() * 0.2));
  this.enemy = { ...d, id: enemyId, hp, maxHp: hp, charged: false };
  this.bossObj = bossObj || null;
  this.busy = false; this.defending = false; this.over = false;

  $('battle').className = World.zone.dark ? 'cave' : (World.zoneId === 'wald' ? 'forest' : 'meadow');
  $('enemy-name').textContent = `${d.name}${d.boss ? ' 👑' : ''}`;
  const sp = $('enemy-sprite');
  sp.textContent = d.icon;
  sp.classList.toggle('boss', !!d.boss);
  sp.classList.remove('dead');
  $('battle-log').innerHTML = '';
  this.updateBars();
  this.log(d.boss ? `Der ${d.name} greift an!` : `Ein wilder ${d.name} erscheint!`);
  this.menu('main');
};

Battle.updateBars = function () {
  const e = this.enemy, p = S.player, s = stats();
  $('enemy-hp-fill').style.width = (100 * Math.max(0, e.hp) / e.maxHp) + '%';
  $('enemy-hp-text').textContent = `${Math.max(0, e.hp)} / ${e.maxHp}`;
  $('enemy-status').textContent = e.charged ? '⚡ lädt auf' : '';
  $('b-level').textContent = p.level;
  $('b-hp-fill').style.width = (100 * p.hp / s.maxHp) + '%';
  $('b-hp-text').textContent = `LP ${p.hp} / ${s.maxHp}`;
  $('b-mp-fill').style.width = (100 * p.mp / s.maxMp) + '%';
  $('b-mp-text').textContent = `MP ${p.mp} / ${s.maxMp}`;
  $('player-status').textContent = (p.poison > 0 ? '☠️ Gift ' : '') + (this.defending ? '🛡️' : '');
};

Battle.log = function (text) {
  const box = $('battle-log');
  const line = document.createElement('div');
  line.textContent = text;
  box.appendChild(line);
  while (box.children.length > 4) box.removeChild(box.firstChild);
};

function floatText(targetId, text, cls) {
  const el = document.createElement('div');
  el.className = 'float ' + (cls || '');
  el.textContent = text;
  $(targetId).appendChild(el);
  setTimeout(() => el.remove(), 1000);
}
function flash(id, cls) {
  const el = $(id);
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
}

// ---------------------------------------------------------------------
//  Menüs
// ---------------------------------------------------------------------
Battle.menu = function (which) {
  const box = $('battle-actions');
  box.innerHTML = '';
  const btn = (label, fn, disabled, sub) => {
    const b = document.createElement('button');
    b.innerHTML = label + (sub ? `<small>${sub}</small>` : '');
    b.disabled = !!disabled;
    b.onclick = fn;
    box.appendChild(b);
  };
  const p = S.player;

  if (which === 'main') {
    btn('⚔️ Angriff', () => this.act(() => this.attack()));
    btn('✨ Magie', () => this.menu('magic'));
    btn('🎒 Items', () => this.menu('items'));
    btn('🛡️ Verteidigen', () => this.act(() => this.defend()), false, '½ Schaden, +3 MP');
    btn('🏃 Flucht', () => this.act(() => this.flee()), this.enemy.boss);
  } else if (which === 'magic') {
    for (const sk of knownSkills())
      btn(sk.name, () => this.act(() => this.skill(sk)), p.mp < sk.mp, `${sk.mp} MP`);
    btn('↩ Zurück', () => this.menu('main'));
  } else if (which === 'items') {
    const items = Object.keys(S.inv).filter(id => ITEMS[id].type === 'consumable');
    if (!items.length) { const d = document.createElement('div'); d.className = 'empty'; d.textContent = 'Keine Tränke dabei.'; box.appendChild(d); }
    for (const id of items)
      btn(`${ITEMS[id].icon} ${ITEMS[id].name}`, () => this.act(() => this.item(id)), false, `×${count(id)}`);
    btn('↩ Zurück', () => this.menu('main'));
  } else if (which === 'end') {
    btn('Weiter ▶', () => this.finish());
  }
};

// Führt eine Spieleraktion aus, danach ist der Gegner dran
Battle.act = async function (fn) {
  if (this.busy || this.over) return;
  this.busy = true;
  $('battle-actions').innerHTML = '';
  this.defending = false;
  const consumedTurn = await fn();
  this.updateBars();
  if (this.over) return;
  if (this.enemy.hp <= 0) return this.victory();
  if (consumedTurn !== false) {
    await wait(450);
    await this.enemyTurn();
    if (S.player.hp <= 0) return this.defeat();
    await this.poisonTick();
    if (S.player.hp <= 0) return this.defeat();
  }
  this.busy = false;
  this.menu('main');
};

// ---------------------------------------------------------------------
//  Aktionen des Spielers  (return false = Zug nicht verbraucht)
// ---------------------------------------------------------------------
Battle.hitEnemy = async function (dmg, crit) {
  this.enemy.hp -= dmg;
  flash('enemy-sprite', 'hit');
  floatText('enemy-area', (crit ? 'KRIT! ' : '') + dmg, crit ? 'crit' : '');
  this.updateBars();
  await wait(650);
};

Battle.attack = async function () {
  const s = stats();
  const crit = Math.random() < 0.08;
  let dmg = dmgCalc(s.atk, this.enemy.def);
  if (crit) dmg = Math.round(dmg * 1.6);
  this.log(`Du greifst an! ${crit ? 'Volltreffer! ' : ''}${dmg} Schaden.`);
  await this.hitEnemy(dmg, crit);
};

Battle.skill = async function (sk) {
  const s = stats(), p = S.player;
  p.mp -= sk.mp;
  if (sk.kind === 'heal') {
    const amount = Math.round(s.maxHp * 0.35 + s.mag * 2);
    const before = p.hp;
    p.hp = Math.min(s.maxHp, p.hp + amount);
    this.log(`Du wirkst ${sk.name}: +${p.hp - before} LP.`);
    floatText('player-box', '+' + (p.hp - before), 'heal');
    this.updateBars();
    await wait(650);
    return;
  }
  let dmg;
  if (sk.kind === 'magic') dmg = dmgCalc((s.mag + s.atk * 0.4) * sk.mult, this.enemy.def * 0.5);
  else dmg = dmgCalc(s.atk * sk.mult, this.enemy.def);
  this.log(`${sk.name}! ${dmg} Schaden.`);
  await this.hitEnemy(dmg, false);
};

Battle.item = async function (id) {
  const it = ITEMS[id];
  if (it.effect.escape) {
    if (this.enemy.boss) { this.log('Die Rauchbombe wirkt nicht gegen Bosse!'); await wait(700); return false; }
    removeItem(id);
    this.log('Du wirfst eine Rauchbombe und verschwindest!');
    await wait(800);
    this.over = true;
    this.finish();
    return;
  }
  const txt = useConsumable(id);
  this.log(txt);
  if (it.effect.heal) floatText('player-box', '+LP', 'heal');
  this.updateBars();
  await wait(600);
};

Battle.defend = async function () {
  this.defending = true;
  const s = stats();
  S.player.mp = Math.min(s.maxMp, S.player.mp + 3);
  this.log('Du gehst in Verteidigungshaltung.');
  this.updateBars();
  await wait(500);
};

Battle.flee = async function () {
  const chance = Math.max(0.2, Math.min(0.95, 0.55 + (stats().spd - this.enemy.spd) * 0.04));
  if (Math.random() < chance) {
    this.log('Du konntest fliehen!');
    await wait(700);
    this.over = true;
    this.finish();
    return;
  }
  this.log('Flucht gescheitert!');
  await wait(600);
};

// ---------------------------------------------------------------------
//  Gegnerzug
// ---------------------------------------------------------------------
Battle.enemyTurn = async function () {
  const e = this.enemy, p = S.player, s = stats();
  let move;
  if (e.charged) {
    move = { name: 'KRISTALLEXPLOSION', mult: 2.2 };
    e.charged = false;
  } else {
    const total = e.moves.reduce((a, m) => a + m.w, 0);
    let r = Math.random() * total;
    move = e.moves[0];
    for (const m of e.moves) { r -= m.w; if (r <= 0) { move = m; break; } }
  }

  if (move.charge) {
    e.charged = true;
    this.log(`${e.name} lädt Energie auf! ⚡ (Tipp: Verteidigen!)`);
    flash('enemy-sprite', 'charge');
    this.updateBars();
    await wait(900);
    return;
  }

  const dodge = Math.max(0, Math.min(0.25, 0.03 + (s.spd - e.spd) * 0.02));
  flash('enemy-sprite', 'lunge');
  await wait(250);
  if (Math.random() < dodge) {
    this.log(`${e.name} nutzt ${move.name} – du weichst aus!`);
    floatText('player-box', 'Ausgewichen', 'miss');
    await wait(700);
    return;
  }
  let dmg = dmgCalc(e.atk * move.mult, s.def);
  if (this.defending) dmg = Math.ceil(dmg / 2);
  p.hp = Math.max(0, p.hp - dmg);
  let txt = `${e.name} nutzt ${move.name}: ${dmg} Schaden${this.defending ? ' (abgewehrt)' : ''}.`;
  if (move.drain) { e.hp = Math.min(e.maxHp, e.hp + dmg); txt += ' Er heilt sich!'; }
  if (move.poison && p.hp > 0 && Math.random() < 0.6) { p.poison = 3; txt += ' Du bist vergiftet!'; }
  this.log(txt);
  flash('player-box', 'hurt');
  floatText('player-box', '-' + dmg, 'dmg');
  this.updateBars();
  await wait(700);
};

Battle.poisonTick = async function () {
  const p = S.player;
  if (p.poison <= 0) return;
  const dmg = Math.max(1, Math.round(stats().maxHp * 0.06));
  p.hp = Math.max(0, p.hp - dmg);
  p.poison--;
  this.log(`Das Gift schadet dir: ${dmg} Schaden.`);
  floatText('player-box', '-' + dmg, 'poison');
  this.updateBars();
  await wait(600);
};

// ---------------------------------------------------------------------
//  Ende des Kampfes
// ---------------------------------------------------------------------
Battle.victory = async function () {
  const e = this.enemy;
  this.over = true;
  $('enemy-sprite').classList.add('dead');
  this.log(`${e.name} wurde besiegt!`);
  await wait(700);

  const gold = rnd(e.gold[0], e.gold[1]);
  S.player.gold += gold;
  const loot = [];
  for (const [id, chance, min, max] of e.drops)
    if (Math.random() < chance) { const n = rnd(min, max); addItem(id, n); loot.push(`${n}× ${ITEMS[id].icon} ${ITEMS[id].name}`); }
  this.log(`+${e.xp} EP, +${gold} Gold${loot.length ? ', ' + loot.join(', ') : ''}`);
  await wait(500);
  for (const m of gainXp(e.xp)) { this.log('⭐ ' + m); await wait(700); }

  if (e.boss) {
    S.bosses[e.id] = true;
    if (this.bossObj) {
      World.objects = World.objects.filter(o => o !== this.bossObj);
      World.objMap.delete(key(this.bossObj.x, this.bossObj.y));
    }
  }
  this.updateBars();
  this.menu('end');
};

Battle.defeat = async function () {
  this.over = true;
  this.log('Du wurdest besiegt...');
  await wait(600);
  this.menu('end');
};

Battle.finish = function () {
  const lost = S.player.hp <= 0;
  const bossWon = this.enemy.boss && this.enemy.hp <= 0;
  Game.endBattle();
  if (lost) Game.onDefeat();
  else if (bossWon) UI.dialog(null, [
    'Der Kristallgolem zerfällt zu glitzerndem Staub...',
    'Du hast die Kristallhöhle befreit! 🎉',
    'Mit dem Golemkern kannst du jetzt den Kristallpanzer bauen.',
    'Danke fürs Spielen dieses Prototyps!',
  ]);
};
