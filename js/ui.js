// =====================================================================
//  BENUTZEROBERFLÄCHE: HUD, Dialoge, Menü (Inventar/Ausrüstung/Handwerk), Shop
//  In Godot: CanvasLayer mit Control-Nodes (Panel, TabContainer, ItemList ...)
// =====================================================================

const TYPE_LABEL = { material: 'Material', consumable: 'Trank', tool: 'Werkzeug', weapon: 'Waffe', armor: 'Rüstung', accessory: 'Accessoire' };
const SLOT_LABEL = { weapon: 'Waffe', armor: 'Rüstung', accessory: 'Accessoire' };
const STAT_LABEL = { atk: 'ANG', def: 'VER', mag: 'MAG', spd: 'TEMPO', hp: 'LP', mp: 'MP' };

function statText(st) {
  return Object.entries(st || {}).map(([k, v]) => `${STAT_LABEL[k]} +${v}`).join(' · ');
}
function itemLabel(id) { return `${ITEMS[id].icon} ${ITEMS[id].name}`; }

const UI = {
  dialogQueue: [], dialogDone: null,
  panelTab: null, atStation: false, panelKind: null,
};

// ---------------- HUD ----------------
UI.updateHud = function () {
  const p = S.player, s = stats();
  $('hud-zone').textContent = World.zone ? World.zone.name : '';
  $('hud-hp-fill').style.width = (100 * p.hp / s.maxHp) + '%';
  $('hud-hp-text').textContent = `LP ${p.hp}/${s.maxHp}${p.poison > 0 ? ' ☠️' : ''}`;
  $('hud-mp-fill').style.width = (100 * p.mp / s.maxMp) + '%';
  $('hud-mp-text').textContent = `MP ${p.mp}/${s.maxMp}`;
  $('hud-level').textContent = `Lv ${p.level}`;
  $('hud-gold').textContent = `🪙 ${p.gold}`;
};

UI.toast = function (text, kind) {
  const el = document.createElement('div');
  el.className = 'toast ' + (kind || '');
  el.textContent = text;
  $('toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 1800);
  setTimeout(() => el.remove(), 2300);
};

// ---------------- Dialog ----------------
UI.dialog = function (name, lines, onDone) {
  this.dialogQueue = [...lines];
  this.dialogDone = onDone || null;
  $('dialog-name').textContent = name || '';
  $('dialog-name').style.display = name ? '' : 'none';
  $('dialog').classList.remove('hidden');
  Game.mode = 'dialog';
  this.nextLine();
};
UI.nextLine = function () {
  if (!this.dialogQueue.length) {
    $('dialog').classList.add('hidden');
    Game.mode = 'world';
    const cb = this.dialogDone; this.dialogDone = null;
    if (cb) cb();
    return;
  }
  $('dialog-text').textContent = this.dialogQueue.shift();
};

// ---------------- Panel (Menü & Shop) ----------------
UI.openPanel = function (kind, tabs, tab) {
  this.panelKind = kind;
  this.panelTabs = tabs;
  this.panelTab = tab || tabs[0][0];
  $('panel').classList.remove('hidden');
  Game.mode = 'menu';
  this.renderPanel();
};
UI.closePanel = function () {
  $('panel').classList.add('hidden');
  this.atStation = false;
  Game.mode = 'world';
  UI.updateHud();
};

UI.openMenu = function (tab, atStation) {
  this.atStation = !!atStation;
  this.openPanel('menu', [['status', '🧍 Held'], ['inv', '🎒 Inventar'], ['craft', '🛠️ Handwerk'], ['system', '⚙️ System']], tab);
};
UI.openShop = function () {
  this.openPanel('shop', [['buy', '🛒 Kaufen'], ['sell', '💰 Verkaufen']]);
};

UI.renderPanel = function () {
  const tabs = $('panel-tabs');
  tabs.innerHTML = '';
  for (const [id, label] of this.panelTabs) {
    const b = document.createElement('button');
    b.textContent = label;
    b.className = id === this.panelTab ? 'active' : '';
    b.onclick = () => { this.panelTab = id; this.renderPanel(); };
    tabs.appendChild(b);
  }
  const body = $('panel-body');
  body.innerHTML = '';
  const fn = {
    status: this.renderStatus, inv: this.renderInventory, craft: this.renderCraft,
    system: this.renderSystem, buy: this.renderBuy, sell: this.renderSell,
  }[this.panelTab];
  fn.call(this, body);
  UI.updateHud();
};

// Hilfsfunktion für eine Listenzeile
function row(parent, { icon, title, sub, right, buttons = [], dim }) {
  const r = document.createElement('div');
  r.className = 'row' + (dim ? ' dim' : '');
  r.innerHTML = `<div class="ic">${icon || ''}</div><div class="txt"><div class="t">${title}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>${right ? `<div class="r">${right}</div>` : ''}`;
  const bw = document.createElement('div'); bw.className = 'btns';
  for (const [label, fn, disabled] of buttons) {
    const b = document.createElement('button');
    b.textContent = label; b.disabled = !!disabled; b.onclick = fn;
    bw.appendChild(b);
  }
  r.appendChild(bw);
  parent.appendChild(r);
  return r;
}
function heading(parent, text) {
  const h = document.createElement('h3'); h.textContent = text; parent.appendChild(h);
}

UI.renderStatus = function (body) {
  const p = S.player, s = stats();
  const box = document.createElement('div');
  box.className = 'stats';
  box.innerHTML = `
    <div><b>Level ${p.level}</b> · EP ${p.xp} / ${xpToNext(p.level)}</div>
    <div class="xpbar"><div style="width:${100 * p.xp / xpToNext(p.level)}%"></div></div>
    <div class="grid">
      <span>LP</span><b>${p.hp} / ${s.maxHp}</b>
      <span>MP</span><b>${p.mp} / ${s.maxMp}</b>
      <span>Angriff</span><b>${s.atk}</b>
      <span>Verteidigung</span><b>${s.def}</b>
      <span>Magie</span><b>${s.mag}</b>
      <span>Tempo</span><b>${s.spd}</b>
      <span>Gold</span><b>🪙 ${p.gold}</b>
    </div>`;
  body.appendChild(box);

  heading(body, 'Ausrüstung');
  for (const slot of ['weapon', 'armor', 'accessory']) {
    const id = p.equip[slot];
    row(body, {
      icon: id ? ITEMS[id].icon : '▫️',
      title: id ? ITEMS[id].name : `<i>keine ${SLOT_LABEL[slot]}</i>`,
      sub: id ? `${SLOT_LABEL[slot]} · ${statText(ITEMS[id].stats)}` : SLOT_LABEL[slot],
      buttons: id ? [['Ablegen', () => { unequip(slot); this.renderPanel(); }]] : [],
    });
  }

  heading(body, 'Fähigkeiten');
  for (const sk of SKILLS) {
    const known = sk.level <= p.level;
    row(body, { icon: known ? '✨' : '🔒', title: sk.name, sub: known ? `${sk.mp} MP · ${sk.desc}` : `Ab Level ${sk.level}`, dim: !known });
  }

  heading(body, 'Ziel');
  const goal = document.createElement('p');
  goal.className = 'goal';
  goal.textContent = S.bosses.kristallgolem
    ? '✅ Kristallgolem besiegt! Baue den Kristallpanzer und erkunde weiter.'
    : '🎯 Werde stärker und besiege den Kristallgolem in der Kristallhöhle (hinter dem Flüsterwald).';
  body.appendChild(goal);
};

UI.renderInventory = function (body) {
  const ids = Object.keys(S.inv);
  if (!ids.length) { body.innerHTML = '<p class="empty">Dein Rucksack ist leer.</p>'; return; }
  const order = ['consumable', 'weapon', 'armor', 'accessory', 'tool', 'material'];
  for (const type of order) {
    const list = ids.filter(id => ITEMS[id].type === type);
    if (!list.length) continue;
    heading(body, TYPE_LABEL[type]);
    for (const id of list) {
      const it = ITEMS[id], buttons = [];
      if (type === 'consumable' && !it.battleOnly)
        buttons.push(['Benutzen', () => { UI.toast(useConsumable(id), 'loot'); this.renderPanel(); }]);
      if (['weapon', 'armor', 'accessory'].includes(type))
        buttons.push(['Anlegen', () => { equip(id); UI.toast(`${it.name} angelegt`); this.renderPanel(); }]);
      row(body, {
        icon: it.icon, title: it.name, right: `×${count(id)}`,
        sub: it.stats ? statText(it.stats) : (it.desc || ''), buttons,
      });
    }
  }
};

UI.renderCraft = function (body) {
  const note = document.createElement('p');
  note.className = this.atStation ? 'note ok' : 'note';
  note.textContent = this.atStation
    ? '🛠️ Du bist an einer Werkstatt – du kannst herstellen.'
    : '📖 Rezeptbuch. Herstellen geht nur an der Werkbank (Dorf) oder am Lagerfeuer (Wald).';
  body.appendChild(note);

  for (const r of RECIPES) {
    const it = ITEMS[r.result];
    const needs = Object.entries(r.needs).map(([id, n]) => {
      const have = count(id);
      return `<span class="${have >= n ? 'have' : 'miss'}">${ITEMS[id].icon} ${ITEMS[id].name} ${have}/${n}</span>`;
    }).join(' ');
    const ok = canCraft(r);
    row(body, {
      icon: it.icon,
      title: `${it.name}${r.count > 1 ? ' ×' + r.count : ''}`,
      sub: (it.stats ? `<span class="st">${statText(it.stats)}</span><br>` : '') + needs,
      dim: !ok,
      buttons: [['Herstellen', () => {
        if (craft(r)) { UI.toast(`Hergestellt: ${it.icon} ${it.name}`, 'loot'); this.renderPanel(); }
      }, !ok || !this.atStation]],
    });
  }
};

UI.renderSystem = function (body) {
  row(body, { icon: '💾', title: 'Spiel speichern', sub: 'Auch automatisch beim Zonenwechsel und bei der Heilerin.',
    buttons: [['Speichern', () => UI.toast(saveGame() ? 'Gespeichert!' : 'Speichern fehlgeschlagen', 'loot')]] });
  row(body, { icon: '🔄', title: 'Neues Spiel', sub: 'Löscht den aktuellen Spielstand.',
    buttons: [['Neustart', () => { if (confirm('Wirklich neu beginnen? Der Spielstand wird gelöscht.')) { deleteSave(); location.reload(); } }]] });
  const help = document.createElement('div');
  help.className = 'help';
  help.innerHTML = `
    <h3>Steuerung</h3>
    <p><b>Laptop:</b> Pfeiltasten / WASD laufen · Leertaste / E / Enter interagieren · M / Esc Menü · im Kampf Tasten 1–5</p>
    <p><b>Handy/Tablet:</b> Steuerkreuz links · A-Knopf rechts · ☰ oben rechts für das Menü</p>
    <h3>Tipps</h3>
    <p>Im hohen Gras und auf dunklem Höhlenboden lauern Gegner. Rohstoffe (🌿 Kräuter, helle Birken, Erzbrocken, 💎) wachsen nach ca. 45 Sekunden nach.
    Für Holz brauchst du eine Axt, für Erz und Kristalle eine Spitzhacke.</p>`;
  body.appendChild(help);
};

UI.renderBuy = function (body) {
  const p = S.player;
  for (const id of SHOP_STOCK) {
    const it = ITEMS[id];
    row(body, {
      icon: it.icon, title: it.name, right: `🪙 ${it.value}`,
      sub: (it.stats ? statText(it.stats) : it.desc || '') + (count(id) ? ` · im Besitz: ${count(id)}` : ''),
      buttons: [['Kaufen', () => {
        p.gold -= it.value; addItem(id);
        UI.toast(`Gekauft: ${it.icon} ${it.name}`, 'loot'); this.renderPanel();
      }, p.gold < it.value]],
    });
  }
};

UI.renderSell = function (body) {
  const ids = Object.keys(S.inv);
  if (!ids.length) { body.innerHTML = '<p class="empty">Du hast nichts zu verkaufen.</p>'; return; }
  for (const id of ids) {
    const it = ITEMS[id], price = Math.max(1, Math.floor(it.value / 2));
    const sell = (n) => { removeItem(id, n); S.player.gold += price * n; this.renderPanel(); };
    const n = count(id);
    row(body, {
      icon: it.icon, title: it.name, right: `×${n}`, sub: `🪙 ${price} pro Stück`,
      buttons: [['1 verkaufen', () => sell(1)], ...(n > 1 ? [['Alle', () => sell(n)]] : [])],
    });
  }
};
