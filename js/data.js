// =====================================================================
//  SPIELDATEN
//  Alles, was "Inhalt" ist, steht hier – getrennt von der Spiellogik.
//  In Godot: Items/Gegner/Rezepte als Resources (.tres) oder JSON,
//  Karten als TileMap-Szenen (eine Szene pro Zone).
// =====================================================================

const TILE = 32; // logische Kachelgröße in Pixeln

// ---------------------------------------------------------------------
//  Kachel-Legende (Karten unten)
//   .  Gras            "  hohes Gras (Zufallskämpfe)   f  Blumen
//   =  Weg             T  Baum (blockiert)             #  Fels
//   ~  Wasser          R  Dach    H  Hauswand    D  Tür
//   X  Höhlenwand      ,  Höhlenboden (Kämpfe)   :  sicherer Höhlenboden
//   1,2 Ausgänge in andere Zonen
//  Objekte (werden beim Laden der Zone zu Objekten):
//   S Händler  I Heilerin  W Werkbank  F Lagerfeuer  N Dorfbewohner
//   C Truhe    G Boss      w Fällbarer Baum  h Kräuter  o Erz  c Kristall
// ---------------------------------------------------------------------
const SOLID_TILES = new Set(['T', '#', '~', 'H', 'R', 'D', 'X']);
const OBJECT_CHARS = new Set(['S', 'I', 'W', 'F', 'N', 'C', 'G', 'w', 'h', 'o', 'c']);

const ITEMS = {
  // --- Materialien ---
  holz:      { name: 'Holz',             icon: '🪵', type: 'material', value: 3,  desc: 'Mit der Axt von Bäumen geschlagen.' },
  kraeuter:  { name: 'Kräuter',          icon: '🌿', type: 'material', value: 4,  desc: 'Heilkräftige Pflanzen.' },
  schleim:   { name: 'Schleimklumpen',   icon: '🫧', type: 'material', value: 3,  desc: 'Klebrig. Guter Kleber!' },
  leder:     { name: 'Leder',            icon: '🟫', type: 'material', value: 8,  desc: 'Von Wölfen und Wildtieren.' },
  pilz:      { name: 'Leuchtpilz',       icon: '🍄', type: 'material', value: 6,  desc: 'Leuchtet schwach im Dunkeln.' },
  erz:       { name: 'Eisenerz',         icon: '🪨', type: 'material', value: 10, desc: 'Braucht eine Spitzhacke.' },
  kristall:  { name: 'Kristall',         icon: '💎', type: 'material', value: 20, desc: 'Magisch aufgeladen.' },
  fluegel:   { name: 'Fledermausflügel', icon: '🪶', type: 'material', value: 7,  desc: 'Leicht wie Luft.' },
  golemkern: { name: 'Golemkern',        icon: '🔮', type: 'material', value: 150, desc: 'Das pulsierende Herz des Kristallgolems.' },

  // --- Verbrauchsgegenstände ---
  heiltrank:   { name: 'Heiltrank',        icon: '🧪', type: 'consumable', value: 15, effect: { heal: 40, cure: true }, desc: 'Heilt 40 LP und Gift.' },
  grheiltrank: { name: 'Großer Heiltrank', icon: '⚗️', type: 'consumable', value: 45, effect: { heal: 120, cure: true }, desc: 'Heilt 120 LP und Gift.' },
  manatrank:   { name: 'Manatrank',        icon: '🔷', type: 'consumable', value: 25, effect: { mana: 20 }, desc: 'Stellt 20 MP wieder her.' },
  rauchbombe:  { name: 'Rauchbombe',       icon: '💨', type: 'consumable', value: 30, effect: { escape: true }, battleOnly: true, desc: 'Garantierte Flucht (nicht bei Bossen).' },

  // --- Werkzeuge ---
  axt:        { name: 'Axt',        icon: '🪓', type: 'tool', value: 30, desc: 'Damit kannst du Bäume fällen.' },
  spitzhacke: { name: 'Spitzhacke', icon: '⛏️', type: 'tool', value: 60, desc: 'Damit kannst du Erz und Kristalle abbauen.' },

  // --- Ausrüstung ---
  holzschwert:     { name: 'Holzschwert',     icon: '🗡️', type: 'weapon',    value: 40,  stats: { atk: 3 } },
  eisenschwert:    { name: 'Eisenschwert',    icon: '⚔️', type: 'weapon',    value: 220, stats: { atk: 8 } },
  kristallklinge:  { name: 'Kristallklinge',  icon: '🔱', type: 'weapon',    value: 600, stats: { atk: 14, mag: 4 } },
  kristallstab:    { name: 'Kristallstab',    icon: '🪄', type: 'weapon',    value: 450, stats: { atk: 4, mag: 11 } },
  stoffhemd:       { name: 'Stoffhemd',       icon: '👕', type: 'armor',     value: 5,   stats: { def: 1 } },
  lederruestung:   { name: 'Lederrüstung',    icon: '🦺', type: 'armor',     value: 90,  stats: { def: 4 } },
  eisenruestung:   { name: 'Eisenrüstung',    icon: '🛡️', type: 'armor',     value: 300, stats: { def: 9 } },
  kristallpanzer:  { name: 'Kristallpanzer',  icon: '💠', type: 'armor',     value: 800, stats: { def: 15, hp: 25 } },
  kraeuteramulett: { name: 'Kräuteramulett',  icon: '📿', type: 'accessory', value: 60,  stats: { hp: 15 } },
  kristallring:    { name: 'Kristallring',    icon: '💍', type: 'accessory', value: 120, stats: { mp: 15, mag: 2 } },
  fluegelring:     { name: 'Flügelring',      icon: '🪽', type: 'accessory', value: 90,  stats: { spd: 4 } },
};

// Was man bauen kann. Handwerk nur an Werkbank (Dorf) oder Lagerfeuer (Wald).
const RECIPES = [
  { result: 'heiltrank',       count: 1, needs: { kraeuter: 2 } },
  { result: 'manatrank',       count: 1, needs: { kraeuter: 1, pilz: 1 } },
  { result: 'grheiltrank',     count: 1, needs: { kraeuter: 3, kristall: 1 } },
  { result: 'rauchbombe',      count: 2, needs: { fluegel: 1, schleim: 1 } },
  { result: 'spitzhacke',      count: 1, needs: { holz: 4, schleim: 2 } },
  { result: 'holzschwert',     count: 1, needs: { holz: 3 } },
  { result: 'eisenschwert',    count: 1, needs: { erz: 3, holz: 2 } },
  { result: 'kristallklinge',  count: 1, needs: { kristall: 3, erz: 2, leder: 1 } },
  { result: 'kristallstab',    count: 1, needs: { kristall: 2, holz: 3, pilz: 2 } },
  { result: 'lederruestung',   count: 1, needs: { leder: 4 } },
  { result: 'eisenruestung',   count: 1, needs: { erz: 5, leder: 2 } },
  { result: 'kristallpanzer',  count: 1, needs: { kristall: 4, erz: 3, golemkern: 1 } },
  { result: 'kraeuteramulett', count: 1, needs: { kraeuter: 3, schleim: 1 } },
  { result: 'kristallring',    count: 1, needs: { kristall: 1, erz: 1 } },
  { result: 'fluegelring',     count: 1, needs: { fluegel: 3, erz: 1 } },
];

// Sortiment des Händlers (Kaufpreis = value, Verkauf = value / 2)
const SHOP_STOCK = ['heiltrank', 'manatrank', 'rauchbombe', 'axt', 'spitzhacke',
  'holzschwert', 'lederruestung', 'kraeuteramulett', 'eisenschwert', 'eisenruestung'];

// Rohstoff-Vorkommen: was man bekommt und welches Werkzeug nötig ist
const NODES = {
  w: { item: 'holz',     min: 1, max: 2, tool: 'axt',        verb: 'Du fällst den Baum' },
  h: { item: 'kraeuter', min: 1, max: 2, tool: null,         verb: 'Du sammelst Kräuter' },
  o: { item: 'erz',      min: 1, max: 2, tool: 'spitzhacke', verb: 'Du baust Erz ab' },
  c: { item: 'kristall', min: 1, max: 1, tool: 'spitzhacke', verb: 'Du schlägst einen Kristall heraus' },
};
const NODE_RESPAWN_MS = 45000;

// Fähigkeiten des Spielers (werden mit Level freigeschaltet)
const SKILLS = [
  { id: 'feuerball',   name: 'Feuerball',   mp: 4, level: 1, kind: 'magic', mult: 1.6, desc: 'Magischer Schaden, ignoriert viel Verteidigung.' },
  { id: 'heilung',     name: 'Heilung',     mp: 5, level: 3, kind: 'heal',  desc: 'Heilt 35% LP + Magie.' },
  { id: 'kraftschlag', name: 'Kraftschlag', mp: 6, level: 5, kind: 'phys',  mult: 2.2, desc: 'Ein gewaltiger Hieb.' },
  { id: 'eislanze',    name: 'Eislanze',    mp: 9, level: 7, kind: 'magic', mult: 2.6, desc: 'Starker magischer Angriff.' },
];

// Gegner. moves: w = Gewichtung, mult = Schadensfaktor,
// poison = vergiftet, drain = heilt sich um den Schaden, charge = lädt auf (nächster Angriff x2.2)
const ENEMIES = {
  schleim: { name: 'Blauschleim', icon: '💧', hp: 18, atk: 6, def: 1, spd: 3, xp: 6, gold: [2, 5],
    drops: [['schleim', 0.75, 1, 2]],
    moves: [{ name: 'Rempler', mult: 1, w: 1 }] },
  hase: { name: 'Wildhase', icon: '🐇', hp: 14, atk: 6, def: 1, spd: 9, xp: 5, gold: [1, 4],
    drops: [['kraeuter', 0.4, 1, 1], ['leder', 0.3, 1, 1]],
    moves: [{ name: 'Tritt', mult: 1, w: 3 }, { name: 'Sprungtritt', mult: 1.4, w: 1 }] },
  wildschwein: { name: 'Wildschwein', icon: '🐗', hp: 30, atk: 9, def: 3, spd: 4, xp: 12, gold: [4, 9],
    drops: [['leder', 0.65, 1, 2]],
    moves: [{ name: 'Stoß', mult: 1, w: 3 }, { name: 'Sturmangriff', mult: 1.5, w: 1 }] },

  wolf: { name: 'Grauwolf', icon: '🐺', hp: 36, atk: 12, def: 4, spd: 10, xp: 17, gold: [5, 10],
    drops: [['leder', 0.75, 1, 2]],
    moves: [{ name: 'Biss', mult: 1, w: 3 }, { name: 'Wildes Reißen', mult: 1.6, w: 1 }] },
  pilzling: { name: 'Pilzling', icon: '🍄', hp: 32, atk: 9, def: 5, spd: 3, xp: 14, gold: [3, 8],
    drops: [['pilz', 0.8, 1, 2], ['kraeuter', 0.3, 1, 1]],
    moves: [{ name: 'Kopfstoß', mult: 1, w: 2 }, { name: 'Giftsporen', mult: 0.6, w: 1, poison: true }] },
  kobold: { name: 'Kobold', icon: '👺', hp: 40, atk: 13, def: 5, spd: 7, xp: 21, gold: [10, 22],
    drops: [['holz', 0.4, 1, 2], ['erz', 0.35, 1, 1]],
    moves: [{ name: 'Keule', mult: 1, w: 3 }, { name: 'Hinterhalt', mult: 1.5, w: 1 }] },

  fledermaus: { name: 'Höhlenfledermaus', icon: '🦇', hp: 38, atk: 15, def: 4, spd: 13, xp: 24, gold: [6, 12],
    drops: [['fluegel', 0.75, 1, 2]],
    moves: [{ name: 'Biss', mult: 1, w: 2 }, { name: 'Blutsauger', mult: 1.1, w: 1, drain: true }] },
  steingolem: { name: 'Steingolem', icon: '🗿', hp: 72, atk: 17, def: 12, spd: 2, xp: 38, gold: [12, 25],
    drops: [['erz', 0.8, 1, 2], ['kristall', 0.2, 1, 1]],
    moves: [{ name: 'Steinfaust', mult: 1, w: 3 }, { name: 'Felswurf', mult: 1.5, w: 1 }] },
  spinne: { name: 'Kristallspinne', icon: '🕷️', hp: 50, atk: 18, def: 8, spd: 9, xp: 32, gold: [8, 18],
    drops: [['kristall', 0.4, 1, 1]],
    moves: [{ name: 'Biss', mult: 1, w: 2 }, { name: 'Giftbiss', mult: 0.9, w: 1, poison: true }] },

  kristallgolem: { name: 'Kristallgolem', icon: '💠', boss: true, hp: 280, atk: 25, def: 14, spd: 5, xp: 300, gold: [300, 300],
    drops: [['golemkern', 1, 1, 1], ['kristall', 1, 3, 5]],
    moves: [{ name: 'Kristallfaust', mult: 1, w: 3 }, { name: 'Splitterhagel', mult: 1.35, w: 2 }, { name: 'Energie aufladen', charge: true, w: 1 }] },
};

// ---------------------------------------------------------------------
//  ZONEN  (jede Zone = später eine eigene Godot-Szene mit TileMap)
// ---------------------------------------------------------------------
const ZONES = {
  dorf: {
    name: 'Dorf Eichenhain',
    ground: '.',
    encounterTile: null,
    exits: {
      '1': { zone: 'wald', x: 14, y: 18, dir: 'up' },
      '2': { zone: 'wiese', x: 1, y: 9, dir: 'right' },
    },
    npcText: [
      'Willkommen in Eichenhain!',
      'Im Osten liegt die Blumenwiese – dort ist es noch recht friedlich.',
      'Der Flüsterwald im Norden ist gefährlicher. Wölfe und Kobolde treiben sich dort herum.',
      'Und hinter dem Wald... die Kristallhöhle. Ein riesiger Golem soll dort hausen.',
      'Tipp: An der Werkbank unten links kannst du Ausrüstung bauen!',
    ],
    chests: [[{ item: 'axt', n: 1 }, { item: 'heiltrank', n: 2 }]],
    map: [
      'TTTTTTTTTTTTTT11TTTTTTTTTTTTTT',
      'T.f...........==.........f...T',
      'T..RRRRR......==......RRRRR..T',
      'T..HHHHH......==......HHHHH..T',
      'T..HHDHH......==......HHDHH..T',
      'T....S........==........I....T',
      'T.............==.............T',
      'T..f..N.......==.....f.......T',
      'T.............==.............T',
      'T============================2',
      'T============================2',
      'T.............==.............T',
      'T..RRRRR......==.....~~~~....T',
      'T..HHHHH......==....~~~~~~...T',
      'T..HHDHH......==....~~~~~~...T',
      'T....W........==.....~~~~..C.T',
      'T..f..........==.........f...T',
      'T.....f.......==.....f.......T',
      'T............................T',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
  },

  wiese: {
    name: 'Blumenwiese',
    ground: '.',
    encounterTile: '"',
    encounterRate: 0.12,
    encounters: [{ id: 'schleim', w: 4 }, { id: 'hase', w: 3 }, { id: 'wildschwein', w: 2 }],
    exits: { '1': { zone: 'dorf', x: 28, y: 9, dir: 'left' } },
    chests: [[{ gold: 40 }, { item: 'manatrank', n: 2 }]],
    map: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'T...""""".......f...""""".w.wT',
      'T..""""""".....h....""""""...T',
      'T..""""""".........."""""""..T',
      'T...""""".....ff......"""""..T',
      'T.......h.................h..T',
      'T..f.........""""""..........T',
      'T...........""""""""....f....T',
      'T..........""""""""""........T',
      '1=========""""""""""=========T',
      '1=========""""""""""=========T',
      'T..........""""""""".........T',
      'T...h.......""""""".....h....T',
      'T..............f.............T',
      'T..""""""..........""""""....T',
      'T.""""""""....w...""""""""...T',
      'T.""""""""..ww....""""""""..CT',
      'T..""""""..........""""""....T',
      'T.....f......h...........f...T',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
  },

  wald: {
    name: 'Flüsterwald',
    ground: '.',
    encounterTile: '"',
    encounterRate: 0.13,
    encounters: [{ id: 'wolf', w: 3 }, { id: 'pilzling', w: 3 }, { id: 'kobold', w: 2 }],
    exits: {
      '1': { zone: 'dorf', x: 14, y: 1, dir: 'down' },
      '2': { zone: 'hoehle', x: 19, y: 18, dir: 'up' },
    },
    npcText: [
      'Ich bin Jäger hier im Wald.',
      'Wölfe lassen gutes Leder fallen – daraus kannst du eine Rüstung bauen.',
      'Am Lagerfeuer kannst du übrigens auch Sachen herstellen.',
      'Die Höhle oben rechts? Ohne Spitzhacke und gute Rüstung würde ich da nicht rein...',
    ],
    map: [
      'TTTTTTTTTTTTTTTTTTTTTT##22##TT',
      'TT..""""TTT......TT...#....#TT',
      'T..""""""TT..w...TT.......h..T',
      'T..""""""....ww.......""""...T',
      'TT..""""..............""""""TT',
      'TTT......TTTT...h....""""""..T',
      'T.....w..TTTT.......TTT......T',
      'T..h.....TT.....""""TTT...w..T',
      'T......""""....""""""........T',
      'TT....""""""....""""...F.N...T',
      'TT....""""""..............TTTT',
      'T......""""....TTT...""""...TT',
      'T..w...........TTT..""""""...T',
      'T.....TT..h.........""""""...T',
      'T....TTTT..............""..w.T',
      'T.""..TT.....""""............T',
      'T""""".......""""""....h.....T',
      'T.""""..w......"""".....TTTTTT',
      'TT............==........TTTTTT',
      'TTTTTTTTTTTTTT11TTTTTTTTTTTTTT',
    ],
  },

  hoehle: {
    name: 'Kristallhöhle',
    ground: ',',
    dark: true,
    encounterTile: ',',
    encounterRate: 0.08,
    encounters: [{ id: 'fledermaus', w: 3 }, { id: 'steingolem', w: 2 }, { id: 'spinne', w: 2 }],
    exits: { '1': { zone: 'wald', x: 24, y: 1, dir: 'down' } },
    chests: [[{ item: 'grheiltrank', n: 2 }, { item: 'kristall', n: 2 }]],
    map: [
      'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      'XXX,,,,,XXXXXXXXXX,,,,,,,,,XXX',
      'XX,,,o,,,,XXXXXXX,,,,G,,,,,,XX',
      'XX,,,,,,,,,XXXXX,,,,,,,,,,,,XX',
      'XXX,,,,c,,,,,,,,,,,,XXXX,,,,XX',
      'XXXX,,,,,,,,,,,,,,,XXXXXX,,,XX',
      'XXXXX,,,XXXXX,,,,,XXXXXXX,,,XX',
      'XX,,,,,XXXXXXX,,,,,,,XXX,,c,XX',
      'XX,o,,,XXXXXXXX,,,,,,,,,,,,XXX',
      'XX,,,,,,,XXXXXX,,,o,,,,,,,XXXX',
      'XXX,,,,,,,,XXXX,,,,,,XXXXXXXXX',
      'XXXX,,c,,,,,,,,,,,,,,XXXXXXXXX',
      'XXXXX,,,,,,,,,,,,,,,,,,,,,XXXX',
      'XXXXXXX,,,,XXXXX,,,,,,,,o,,XXX',
      'XXC,,,,,,,XXXXXXX,,,,,,,,,,XXX',
      'XX,,,,o,,XXXXXXXXX,,,XXXXXXXXX',
      'XXX,,,,,XXXXXXXXXX,,,XXXXXXXXX',
      'XXXXXXXXXXXXXXXXXX::::XXXXXXXX',
      'XXXXXXXXXXXXXXXXXX::::XXXXXXXX',
      'XXXXXXXXXXXXXXXXXXX11XXXXXXXXX',
    ],
  },
};

const START = { zone: 'dorf', x: 15, y: 7, dir: 'down' };
const RESPAWN = { zone: 'dorf', x: 24, y: 6, dir: 'up' }; // vor der Heilerin
