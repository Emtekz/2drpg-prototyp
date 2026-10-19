// =====================================================================
//  SPIELSTAND  (in Godot: ein Autoload-Singleton "GameState")
// =====================================================================

const SAVE_KEY = 'eichenhain_save_v1';

let S = null; // aktueller Spielstand

function newGame() {
  S = {
    zone: START.zone, x: START.x, y: START.y, dir: START.dir,
    player: {
      level: 1, xp: 0, gold: 20,
      hp: 40, mp: 15,
      base: { hp: 40, mp: 15, atk: 6, def: 3, mag: 4, spd: 6 },
      equip: { weapon: null, armor: 'stoffhemd', accessory: null },
      poison: 0,
    },
    inv: { heiltrank: 1 },
    chests: {},   // geöffnete Truhen
    bosses: {},   // besiegte Bosse
    nodes: {},    // abgebaute Vorkommen -> Zeitpunkt der Rückkehr
    introSeen: false,
  };
}

// ---- Werte inkl. Ausrüstung ----
function stats() {
  const p = S.player;
  const s = { ...p.base };
  for (const slot of ['weapon', 'armor', 'accessory']) {
    const id = p.equip[slot];
    if (!id) continue;
    const bonus = ITEMS[id].stats || {};
    for (const k in bonus) s[k] = (s[k] || 0) + bonus[k];
  }
  s.maxHp = s.hp; s.maxMp = s.mp;
  return s;
}

function clampVitals() {
  const s = stats();
  S.player.hp = Math.min(S.player.hp, s.maxHp);
  S.player.mp = Math.min(S.player.mp, s.maxMp);
}

function xpToNext(level) { return Math.floor(15 * Math.pow(level, 1.6)); }

// Gibt eine Liste von Texten zurück (Level-Ups)
function gainXp(amount) {
  const p = S.player, msgs = [];
  p.xp += amount;
  while (p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    p.level++;
    const b = p.base;
    b.hp += 9; b.mp += 3; b.atk += 2; b.def += 1; b.mag += 2; b.spd += 1;
    const s = stats();
    p.hp = s.maxHp; p.mp = s.maxMp;
    msgs.push(`Level ${p.level} erreicht! LP und MP vollständig aufgefüllt.`);
    for (const sk of SKILLS) if (sk.level === p.level) msgs.push(`Neue Fähigkeit gelernt: ${sk.name}!`);
  }
  return msgs;
}

function knownSkills() { return SKILLS.filter(s => s.level <= S.player.level); }

// ---- Inventar ----
function count(id) { return S.inv[id] || 0; }
function addItem(id, n = 1) { S.inv[id] = count(id) + n; }
function removeItem(id, n = 1) {
  S.inv[id] = count(id) - n;
  if (S.inv[id] <= 0) delete S.inv[id];
}
function hasTool(id) { return count(id) > 0; }

function canCraft(recipe) {
  return Object.entries(recipe.needs).every(([id, n]) => count(id) >= n);
}
function craft(recipe) {
  if (!canCraft(recipe)) return false;
  for (const [id, n] of Object.entries(recipe.needs)) removeItem(id, n);
  addItem(recipe.result, recipe.count);
  return true;
}

function equip(id) {
  const slot = ITEMS[id].type;
  const p = S.player;
  if (p.equip[slot]) addItem(p.equip[slot]);
  removeItem(id);
  p.equip[slot] = id;
  clampVitals();
}
function unequip(slot) {
  const p = S.player;
  if (!p.equip[slot]) return;
  addItem(p.equip[slot]);
  p.equip[slot] = null;
  clampVitals();
}

// Benutzen außerhalb/innerhalb des Kampfes. Gibt Text zurück oder null.
function useConsumable(id) {
  const it = ITEMS[id], e = it.effect, p = S.player, s = stats();
  if (!e || count(id) <= 0) return null;
  const parts = [];
  if (e.heal) {
    const before = p.hp;
    p.hp = Math.min(s.maxHp, p.hp + e.heal);
    parts.push(`+${p.hp - before} LP`);
  }
  if (e.cure && p.poison > 0) { p.poison = 0; parts.push('Gift geheilt'); }
  if (e.mana) {
    const before = p.mp;
    p.mp = Math.min(s.maxMp, p.mp + e.mana);
    parts.push(`+${p.mp - before} MP`);
  }
  removeItem(id);
  return `${it.name} benutzt: ${parts.join(', ') || 'keine Wirkung'}.`;
}

// ---- Speichern / Laden (localStorage; in Godot: FileAccess + JSON) ----
function saveGame() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); return true; }
  catch (e) { return false; }
}
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    S = JSON.parse(raw);
    return true;
  } catch (e) { return false; }
}
function deleteSave() { localStorage.removeItem(SAVE_KEY); }
