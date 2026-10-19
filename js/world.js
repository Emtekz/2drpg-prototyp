// =====================================================================
//  OBERWELT: Zonen laden, Bewegung auf dem Raster, Interaktion, Zeichnen
//  In Godot: Zone = Szene mit TileMap + Objekt-Nodes, Spieler = CharacterBody2D
//  mit Raster-Bewegung (Tween von Kachel zu Kachel).
// =====================================================================

const MOVE_SPEED = 5.5; // Kacheln pro Sekunde
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

const World = {
  zoneId: null, zone: null, map: [], w: 0, h: 0,
  objects: [], objMap: new Map(),
  px: 0, py: 0,           // gezeichnete Position (Kacheln, Kommazahl)
  moving: null,           // { fx, fy, tx, ty, t }
  stepGrace: 0,           // Schritte ohne Zufallskampf
  time: 0,
  canvas: null, ctx: null, scale: 1, viewW: 0, viewH: 0,
};

const key = (x, y) => x + ',' + y;
const hash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000;

function loadZone(id, x, y, dir) {
  const z = ZONES[id];
  World.zoneId = id; World.zone = z;
  World.h = z.map.length; World.w = z.map[0].length;
  World.map = []; World.objects = []; World.objMap.clear();
  let chestIdx = 0;
  for (let ty = 0; ty < World.h; ty++) {
    const row = [];
    for (let tx = 0; tx < World.w; tx++) {
      const ch = z.map[ty][tx] || 'T';
      if (OBJECT_CHARS.has(ch)) {
        row.push(z.ground);
        const obj = { type: ch, x: tx, y: ty, id: `${id}:${tx},${ty}` };
        if (ch === 'C') obj.loot = (z.chests || [])[chestIdx++] || [{ gold: 10 }];
        if (ch === 'G') { obj.enemy = 'kristallgolem'; if (S.bosses[obj.enemy]) continue; }
        World.objects.push(obj);
        World.objMap.set(key(tx, ty), obj);
      } else row.push(ch);
    }
    World.map.push(row);
  }
  S.zone = id; S.x = x; S.y = y; S.dir = dir || S.dir;
  World.px = x; World.py = y; World.moving = null;
  World.stepGrace = 3;
  UI.updateHud();
  UI.toast(z.name, 'zone');
}

function tileAt(x, y) {
  if (y < 0 || y >= World.h || x < 0 || x >= World.w) return 'T';
  return World.map[y][x];
}
function isBlocked(x, y) {
  return SOLID_TILES.has(tileAt(x, y)) || World.objMap.has(key(x, y));
}
function nodeDepleted(obj) {
  const until = S.nodes[obj.id];
  if (!until) return false;
  if (Date.now() >= until) { delete S.nodes[obj.id]; return false; }
  return true;
}

// ---------------------------------------------------------------------
//  Update
// ---------------------------------------------------------------------
function updateWorld(dt) {
  World.time += dt;
  const m = World.moving;
  if (m) {
    m.t += dt * MOVE_SPEED;
    if (m.t >= 1) {
      S.x = m.tx; S.y = m.ty;
      World.px = S.x; World.py = S.y;
      World.moving = null;
      if (onStep()) return; // Zonenwechsel oder Kampf
    } else {
      World.px = m.fx + (m.tx - m.fx) * m.t;
      World.py = m.fy + (m.ty - m.fy) * m.t;
    }
  }
  if (!World.moving && Game.mode === 'world') {
    const d = Input.dir();
    if (d) tryMove(d);
  }
}

function tryMove(d) {
  S.dir = d;
  const [dx, dy] = DIRS[d];
  const nx = S.x + dx, ny = S.y + dy;
  if (isBlocked(nx, ny)) return;
  World.moving = { fx: S.x, fy: S.y, tx: nx, ty: ny, t: 0 };
}

// Wird nach jedem vollständigen Schritt aufgerufen. true = Weltlogik pausieren
function onStep() {
  const t = tileAt(S.x, S.y);
  const exit = World.zone.exits[t];
  if (exit) { Game.changeZone(exit.zone, exit.x, exit.y, exit.dir); return true; }

  if (World.stepGrace > 0) { World.stepGrace--; return false; }
  const z = World.zone;
  if (z.encounterTile && t === z.encounterTile && Math.random() < z.encounterRate) {
    const total = z.encounters.reduce((a, e) => a + e.w, 0);
    let r = Math.random() * total, pick = z.encounters[0].id;
    for (const e of z.encounters) { r -= e.w; if (r <= 0) { pick = e.id; break; } }
    World.stepGrace = 4;
    Game.startBattle(pick);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------
//  Interaktion mit dem Objekt vor dem Spieler
// ---------------------------------------------------------------------
function interact() {
  if (World.moving) return;
  const [dx, dy] = DIRS[S.dir];
  const obj = World.objMap.get(key(S.x + dx, S.y + dy));
  if (!obj) return;

  switch (obj.type) {
    case 'S':
      UI.dialog('Händlerin Mara', ['Willkommen! Schau dich ruhig um.'], () => UI.openShop());
      break;
    case 'I':
      S.player.hp = stats().maxHp; S.player.mp = stats().maxMp; S.player.poison = 0;
      saveGame();
      UI.updateHud();
      UI.dialog('Heilerin Lina', ['Ruh dich kurz aus...', 'LP und MP vollständig wiederhergestellt. Dein Fortschritt wurde gespeichert.']);
      break;
    case 'W':
      UI.dialog('Werkbank', ['Hier kannst du Ausrüstung und Tränke herstellen.'], () => UI.openMenu('craft', true));
      break;
    case 'F':
      UI.dialog('Lagerfeuer', ['Ein warmes Feuer. Du kannst hier Dinge herstellen.'], () => UI.openMenu('craft', true));
      break;
    case 'N': {
      const lines = World.zone.npcText || ['...'];
      UI.dialog(World.zoneId === 'wald' ? 'Jäger Bram' : 'Dorfältester', lines);
      break;
    }
    case 'C': {
      if (S.chests[obj.id]) { UI.dialog(null, ['Die Truhe ist leer.']); break; }
      S.chests[obj.id] = true;
      const got = [];
      for (const l of obj.loot) {
        if (l.gold) { S.player.gold += l.gold; got.push(`${l.gold} Gold`); }
        else { addItem(l.item, l.n); got.push(`${l.n}× ${ITEMS[l.item].icon} ${ITEMS[l.item].name}`); }
      }
      UI.updateHud();
      UI.dialog(null, ['Du öffnest die Truhe...', 'Gefunden: ' + got.join(', ') + '!']);
      break;
    }
    case 'G':
      UI.dialog('???', ['Der Boden bebt...', 'Ein riesiger KRISTALLGOLEM erhebt sich vor dir!'], () => Game.startBattle(obj.enemy, obj));
      break;
    case 'w': case 'h': case 'o': case 'c': {
      const n = NODES[obj.type];
      if (nodeDepleted(obj)) { UI.toast('Hier wächst gerade nichts nach...'); break; }
      if (n.tool && !hasTool(n.tool)) { UI.toast(`Du brauchst eine ${ITEMS[n.tool].name}!`, 'warn'); break; }
      const amount = n.min + Math.floor(Math.random() * (n.max - n.min + 1));
      addItem(n.item, amount);
      S.nodes[obj.id] = Date.now() + NODE_RESPAWN_MS;
      UI.toast(`${n.verb}: +${amount} ${ITEMS[n.item].icon} ${ITEMS[n.item].name}`, 'loot');
      break;
    }
  }
}

// ---------------------------------------------------------------------
//  Zeichnen
// ---------------------------------------------------------------------
function resizeCanvas() {
  const c = World.canvas, dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth, h = window.innerHeight;
  c.width = Math.floor(w * dpr); c.height = Math.floor(h * dpr);
  c.style.width = w + 'px'; c.style.height = h + 'px';
  // ca. 11 Kacheln auf der kürzeren Seite – passt für Handy und Laptop
  const tilePx = Math.max(28, Math.floor(Math.min(w, h) / 11));
  World.scale = (tilePx / TILE) * dpr;
  World.viewW = c.width / World.scale;
  World.viewH = c.height / World.scale;
}

function renderWorld() {
  const ctx = World.ctx, c = World.canvas;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = World.zone.dark ? '#0b0910' : '#1c2a1a';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.setTransform(World.scale, 0, 0, World.scale, 0, 0);
  ctx.imageSmoothingEnabled = false;

  // Kamera
  const mapW = World.w * TILE, mapH = World.h * TILE;
  let camX = World.px * TILE + TILE / 2 - World.viewW / 2;
  let camY = World.py * TILE + TILE / 2 - World.viewH / 2;
  camX = mapW > World.viewW ? Math.max(0, Math.min(camX, mapW - World.viewW)) : (mapW - World.viewW) / 2;
  camY = mapH > World.viewH ? Math.max(0, Math.min(camY, mapH - World.viewH)) : (mapH - World.viewH) / 2;
  camX = Math.round(camX); camY = Math.round(camY);
  ctx.translate(-camX, -camY);

  const x0 = Math.max(0, Math.floor(camX / TILE)), y0 = Math.max(0, Math.floor(camY / TILE));
  const x1 = Math.min(World.w - 1, Math.ceil((camX + World.viewW) / TILE));
  const y1 = Math.min(World.h - 1, Math.ceil((camY + World.viewH) / TILE));

  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) drawTile(ctx, World.map[y][x], x, y);

  for (const o of World.objects)
    if (o.x >= x0 - 1 && o.x <= x1 + 1 && o.y >= y0 - 1 && o.y <= y1 + 1) drawObject(ctx, o);

  drawPlayer(ctx);

  if (World.zone.dark) drawDarkness(ctx, camX, camY, x0, y0, x1, y1);
}

function drawTile(ctx, ch, x, y) {
  const px = x * TILE, py = y * TILE, h = hash(x, y), t = World.time;
  const grass = () => {
    ctx.fillStyle = (h % 7 === 0) ? '#5c9c4b' : '#62a551';
    ctx.fillRect(px, py, TILE, TILE);
    if (h % 5 === 0) { ctx.fillStyle = '#4f8c40'; ctx.fillRect(px + (h % 20) + 4, py + (h % 13) + 8, 2, 4); ctx.fillRect(px + (h % 20) + 7, py + (h % 13) + 6, 2, 6); }
  };
  switch (ch) {
    case '.': grass(); break;
    case 'f': {
      grass();
      const cols = ['#ffe066', '#ff8fab', '#ffffff', '#a0c4ff'];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = cols[(h + i) % 4];
        const fx = px + 6 + ((h * (i + 3)) % 20), fy = py + 6 + ((h * (i + 7)) % 20);
        ctx.fillRect(fx, fy, 4, 4);
        ctx.fillStyle = '#c9a227'; ctx.fillRect(fx + 1, fy + 1, 2, 2);
      }
      break;
    }
    case '"': {
      ctx.fillStyle = '#4b8a3c'; ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = '#356e2b';
      const sway = Math.sin(t * 2 + x * 0.7 + y) * 1.5;
      for (let i = 0; i < 4; i++) {
        const bx = px + 3 + i * 7 + (h % 3), by = py + (i % 2 ? 14 : 28);
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + 3 + sway, by - 12); ctx.lineTo(bx + 6, by); ctx.fill();
      }
      ctx.fillStyle = '#5fa04a';
      for (let i = 0; i < 3; i++) {
        const bx = px + 6 + i * 8, by = py + 22;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + 2 + sway, by - 10); ctx.lineTo(bx + 5, by); ctx.fill();
      }
      break;
    }
    case '=': case '1': case '2': {
      if (ch !== '=' && World.zone.dark) { drawTile(ctx, ':', x, y); drawExitGlow(ctx, px, py); break; }
      if (ch === '2' && World.zoneId === 'wald') {
        ctx.fillStyle = '#6d6a72'; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = '#121016'; ctx.beginPath(); ctx.ellipse(px + 16, py + 24, 15, 20, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(px + 1, py + 24, 30, 8);
        drawExitGlow(ctx, px, py); break;
      }
      ctx.fillStyle = '#d6bd85'; ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = '#c4a96f';
      if (h % 3 === 0) ctx.fillRect(px + (h % 24) + 2, py + (h % 17) + 5, 3, 3);
      if (h % 4 === 1) ctx.fillRect(px + (h % 11) + 15, py + (h % 21) + 4, 2, 2);
      if (ch !== '=') drawExitGlow(ctx, px, py);
      break;
    }
    case 'T': {
      grass();
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(px + 16, py + 28, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6b4423'; ctx.fillRect(px + 13, py + 18, 6, 11);
      ctx.fillStyle = h % 2 ? '#2e6b2a' : '#2a6326';
      ctx.beginPath(); ctx.arc(px + 16, py + 13, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3d8a36'; ctx.beginPath(); ctx.arc(px + 12, py + 9, 6, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case '#': {
      grass();
      ctx.fillStyle = '#7d7a80'; ctx.beginPath(); ctx.moveTo(px + 3, py + 28); ctx.lineTo(px + 8, py + 6); ctx.lineTo(px + 24, py + 4); ctx.lineTo(px + 30, py + 28); ctx.fill();
      ctx.fillStyle = '#9b989e'; ctx.beginPath(); ctx.moveTo(px + 9, py + 8); ctx.lineTo(px + 22, py + 6); ctx.lineTo(px + 18, py + 16); ctx.fill();
      break;
    }
    case '~': {
      ctx.fillStyle = '#3a7bd5'; ctx.fillRect(px, py, TILE, TILE);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
      const o = Math.sin(t * 1.5 + x + y * 0.5) * 3;
      ctx.beginPath(); ctx.moveTo(px + 4 + o, py + 10); ctx.quadraticCurveTo(px + 9 + o, py + 6, px + 14 + o, py + 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px + 16 - o, py + 22); ctx.quadraticCurveTo(px + 21 - o, py + 18, px + 26 - o, py + 22); ctx.stroke();
      break;
    }
    case 'R': {
      ctx.fillStyle = '#b5483a'; ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = '#93362b';
      for (let i = 0; i < 4; i++) ctx.fillRect(px, py + i * 8 + 6, TILE, 2);
      break;
    }
    case 'H': case 'D': {
      ctx.fillStyle = '#c99a63'; ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = '#b3854f'; ctx.fillRect(px, py + 10, TILE, 2); ctx.fillRect(px, py + 21, TILE, 2);
      if (ch === 'D') {
        ctx.fillStyle = '#5b3a1e'; ctx.fillRect(px + 8, py + 4, 16, 28);
        ctx.fillStyle = '#e0b84d'; ctx.fillRect(px + 19, py + 18, 3, 3);
      } else if (h % 2 === 0) {
        ctx.fillStyle = '#5b3a1e'; ctx.fillRect(px + 8, py + 8, 16, 14);
        ctx.fillStyle = '#9fd3ff'; ctx.fillRect(px + 10, py + 10, 12, 10);
        ctx.fillStyle = '#5b3a1e'; ctx.fillRect(px + 15, py + 10, 2, 10);
      }
      break;
    }
    case 'X': {
      ctx.fillStyle = '#2d2733'; ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = '#3b3443'; ctx.fillRect(px + (h % 12), py + (h % 9), 12, 8);
      ctx.fillStyle = '#231e28'; ctx.fillRect(px + (h % 17) + 4, py + 20, 10, 6);
      break;
    }
    case ',': case ':': {
      ctx.fillStyle = ch === ',' ? '#5a5163' : '#6e6577'; ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      if (h % 3 === 0) ctx.fillRect(px + (h % 22) + 3, py + (h % 19) + 4, 4, 3);
      if (h % 4 === 0) ctx.fillRect(px + (h % 9) + 16, py + (h % 14) + 12, 3, 2);
      break;
    }
    default: grass();
  }
}

function drawExitGlow(ctx, px, py) {
  const a = 0.15 + Math.sin(World.time * 3) * 0.1;
  ctx.fillStyle = `rgba(255,240,170,${a})`;
  ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
}

function emoji(ctx, ch, x, y, size) {
  ctx.font = `${size}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(ch, x, y);
}

function drawPerson(ctx, x, y, dir, c, bob = 0) {
  // x,y = linke obere Ecke der Kachel
  const cx = x + 16, by = y + bob;
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(cx, y + 29, 9, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  // Beine
  ctx.fillStyle = '#3b2f2a';
  const step = bob !== 0 ? Math.sign(Math.sin(World.time * 18)) * 2 : 0;
  ctx.fillRect(cx - 5, by + 23, 4, 6 + step); ctx.fillRect(cx + 1, by + 23, 4, 6 - step);
  // Körper
  ctx.fillStyle = c.body; ctx.fillRect(cx - 7, by + 13, 14, 12);
  ctx.fillStyle = c.belt || '#6b4423'; ctx.fillRect(cx - 7, by + 20, 14, 2);
  // Kopf
  ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(cx, by + 9, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = c.hair;
  if (dir === 'up') { ctx.beginPath(); ctx.arc(cx, by + 9, 7, 0, Math.PI * 2); ctx.fill(); }
  else { ctx.beginPath(); ctx.arc(cx, by + 7, 7, Math.PI, 0); ctx.fill(); }
  // Augen
  ctx.fillStyle = '#222';
  if (dir === 'down') { ctx.fillRect(cx - 4, by + 9, 2, 2); ctx.fillRect(cx + 2, by + 9, 2, 2); }
  if (dir === 'left') ctx.fillRect(cx - 5, by + 9, 2, 2);
  if (dir === 'right') ctx.fillRect(cx + 3, by + 9, 2, 2);
}

function drawPlayer(ctx) {
  const moving = !!World.moving;
  const bob = moving ? -Math.abs(Math.sin(World.time * 14)) * 2 : 0;
  const x = World.px * TILE, y = World.py * TILE;
  drawPerson(ctx, x, y, S.dir, { body: '#3a6fd8', hair: '#6b3d1f', belt: '#d8b23a' }, bob);
  // Waffe sichtbar machen
  const wpn = S.player.equip.weapon;
  if (wpn && S.dir !== 'up') emoji(ctx, ITEMS[wpn].icon, x + (S.dir === 'left' ? 6 : 26), y + 20 + bob, 11);
}

function drawObject(ctx, o) {
  const px = o.x * TILE, py = o.y * TILE, t = World.time;
  const bubble = (ic) => {
    const by = py - 8 + Math.sin(t * 3 + o.x) * 1.5;
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(px + 16, by, 8, 0, Math.PI * 2); ctx.fill();
    emoji(ctx, ic, px + 16, by + 1, 10);
  };
  switch (o.type) {
    case 'S': drawPerson(ctx, px, py, 'down', { body: '#9b4fc9', hair: '#d9a441' }); bubble('💰'); break;
    case 'I': drawPerson(ctx, px, py, 'down', { body: '#f2f2f2', hair: '#e07a5f', belt: '#e63946' }); bubble('❤️'); break;
    case 'N': drawPerson(ctx, px, py, 'down', World.zoneId === 'wald' ? { body: '#4a6b2a', hair: '#3b2a1a' } : { body: '#8a6e4b', hair: '#cfcfcf' }); bubble('💬'); break;
    case 'W': {
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(px + 3, py + 26, 26, 4);
      ctx.fillStyle = '#8b5a2b'; ctx.fillRect(px + 2, py + 12, 28, 6);
      ctx.fillStyle = '#6b4423'; ctx.fillRect(px + 4, py + 18, 4, 10); ctx.fillRect(px + 24, py + 18, 4, 10);
      emoji(ctx, '🔨', px + 12, py + 7, 13); emoji(ctx, '⚙️', px + 23, py + 8, 10);
      bubble('🛠️'); break;
    }
    case 'F': {
      ctx.fillStyle = '#5b3a1e'; ctx.fillRect(px + 6, py + 24, 20, 4);
      const s = 18 + Math.sin(t * 10) * 1.5;
      emoji(ctx, '🔥', px + 16, py + 17, s);
      bubble('🛠️'); break;
    }
    case 'C': {
      const open = S.chests[o.id];
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(px + 5, py + 26, 22, 4);
      ctx.fillStyle = '#8b5a2b'; ctx.fillRect(px + 5, py + 13, 22, 14);
      ctx.fillStyle = open ? '#3b2412' : '#a86d36'; ctx.fillRect(px + 5, py + 8, 22, 7);
      ctx.fillStyle = '#e0b84d'; ctx.fillRect(px + 5, py + 15, 22, 2); ctx.fillRect(px + 14, py + 13, 4, 6);
      break;
    }
    case 'G': {
      const pulse = 1 + Math.sin(t * 2) * 0.05;
      ctx.fillStyle = 'rgba(120,220,255,0.25)'; ctx.beginPath(); ctx.arc(px + 16, py + 16, 22 * pulse, 0, Math.PI * 2); ctx.fill();
      emoji(ctx, '💠', px + 16, py + 14, 30 * pulse);
      break;
    }
    case 'w': {
      ctx.fillStyle = (hash(o.x, o.y) % 7 === 0) ? '#5c9c4b' : '#62a551'; // Gras darunter wurde schon gezeichnet
      if (nodeDepleted(o)) {
        ctx.fillStyle = '#7a5230'; ctx.beginPath(); ctx.ellipse(px + 16, py + 24, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c49a6c'; ctx.beginPath(); ctx.ellipse(px + 16, py + 22, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(px + 16, py + 28, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e8e2d0'; ctx.fillRect(px + 13, py + 16, 6, 13);
        ctx.fillStyle = '#333'; ctx.fillRect(px + 14, py + 20, 3, 1); ctx.fillRect(px + 16, py + 24, 2, 1);
        ctx.fillStyle = '#7fbf4d'; ctx.beginPath(); ctx.arc(px + 16, py + 11, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#9ad35f'; ctx.beginPath(); ctx.arc(px + 12, py + 8, 5, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'h':
      if (nodeDepleted(o)) { ctx.fillStyle = '#3f7a33'; ctx.fillRect(px + 14, py + 20, 4, 6); }
      else emoji(ctx, '🌿', px + 16, py + 17 + Math.sin(t * 2 + o.x) * 0.8, 20);
      break;
    case 'o': {
      const dep = nodeDepleted(o);
      ctx.fillStyle = '#6f6a73';
      if (dep) { ctx.fillRect(px + 8, py + 22, 6, 4); ctx.fillRect(px + 18, py + 20, 5, 5); break; }
      ctx.beginPath(); ctx.moveTo(px + 4, py + 28); ctx.lineTo(px + 9, py + 9); ctx.lineTo(px + 22, py + 6); ctx.lineTo(px + 29, py + 28); ctx.fill();
      ctx.fillStyle = '#d98b3a'; ctx.fillRect(px + 11, py + 14, 4, 4); ctx.fillRect(px + 19, py + 18, 4, 3); ctx.fillRect(px + 14, py + 22, 3, 3);
      break;
    }
    case 'c': {
      if (nodeDepleted(o)) { ctx.fillStyle = '#4fb3c8'; ctx.fillRect(px + 12, py + 22, 4, 4); ctx.fillRect(px + 18, py + 23, 3, 3); break; }
      ctx.fillStyle = '#5fd4ea';
      ctx.beginPath(); ctx.moveTo(px + 16, py + 3); ctx.lineTo(px + 22, py + 16); ctx.lineTo(px + 16, py + 28); ctx.lineTo(px + 10, py + 16); ctx.fill();
      ctx.fillStyle = '#9ae8f7';
      ctx.beginPath(); ctx.moveTo(px + 8, py + 14); ctx.lineTo(px + 11, py + 22); ctx.lineTo(px + 7, py + 28); ctx.lineTo(px + 4, py + 22); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + 25, py + 12); ctx.lineTo(px + 28, py + 20); ctx.lineTo(px + 25, py + 28); ctx.lineTo(px + 22, py + 20); ctx.fill();
      break;
    }
  }
}

function drawDarkness(ctx, camX, camY, x0, y0, x1, y1) {
  const cx = World.px * TILE + 16, cy = World.py * TILE + 16;
  const r = TILE * 5.5;
  const g = ctx.createRadialGradient(cx, cy, TILE * 1.2, cx, cy, r);
  g.addColorStop(0, 'rgba(5,3,10,0)');
  g.addColorStop(1, 'rgba(5,3,10,0.8)');
  ctx.fillStyle = g;
  ctx.fillRect(camX, camY, World.viewW + 1, World.viewH + 1);
  // Kristalle und Boss leuchten im Dunkeln
  ctx.globalCompositeOperation = 'lighter';
  for (const o of World.objects) {
    if ((o.type !== 'c' && o.type !== 'G') || (o.type === 'c' && nodeDepleted(o))) continue;
    const ox = o.x * TILE + 16, oy = o.y * TILE + 16;
    const gl = ctx.createRadialGradient(ox, oy, 2, ox, oy, TILE * (o.type === 'G' ? 2.5 : 1.3));
    gl.addColorStop(0, 'rgba(90,200,255,0.45)');
    gl.addColorStop(1, 'rgba(90,200,255,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(ox - TILE * 3, oy - TILE * 3, TILE * 6, TILE * 6);
  }
  ctx.globalCompositeOperation = 'source-over';
}
