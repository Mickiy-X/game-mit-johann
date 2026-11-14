export const RANKS = [
  { name: 'Aushilfe', threshold: 0 },
  { name: 'Spulengesell', threshold: 400 },
  { name: 'Webermeister', threshold: 1200 },
  { name: 'Nachtlegende', threshold: 2400 }
];

export function rankFor(totalEarned) {
  const earned = Math.max(0, totalEarned || 0);
  let rank = 1;
  for (let i = 0; i < RANKS.length; i++) {
    if (earned >= RANKS[i].threshold) rank = i + 1;
  }
  return rank;
}

export function rankInfo(totalEarned) {
  const earned = Math.max(0, totalEarned || 0);
  const rank = rankFor(earned);
  const current = RANKS[rank - 1];
  const next = RANKS[rank] || null;
  const progress = next
    ? Math.max(0, Math.min(1, (earned - current.threshold) / (next.threshold - current.threshold)))
    : 1;
  return {
    rank,
    name: current.name,
    next,
    progress,
    remaining: next ? Math.max(0, next.threshold - earned) : 0
  };
}

export const UPGRADE_ORDER = [
  'spool', 'technique', 'winder', 'cart', 'ladder', 'master',
  'auto', 'quiet',
  'door', 'flood', 'alarm', 'ward',
  'gloves', 'luck', 'boots',
  'orders', 'kasse'
];

export const UPGRADES = {
  spool: {
    name: 'Spulengröße',
    category: 'Produktion',
    rank: 1,
    max: 3,
    costs: [130, 340, 760],
    desc: 'Größere Spulen fassen mehr Faden. Jede Stufe erhöht den Fadenvorrat um 60 Einheiten.',
    effect: (lvl) => lvl > 0 ? `Fadenvorrat: ${100 + lvl * 60}` : 'Aktuell: 100 Faden'
  },
  technique: {
    name: 'Ziehtechnik',
    category: 'Produktion',
    rank: 1,
    max: 3,
    costs: [160, 420, 900],
    desc: 'Geübtere Hände: schnellerer Fadenfluss und langsamer steigende Spannung.',
    effect: (lvl) => lvl > 0 ? `Ziehgeschwindigkeit +${Math.round((1 + lvl * 0.22) * 100 - 100)} %` : 'Ziehgeschwindigkeit: Basis'
  },
  winder: {
    name: 'Wickelmaschine',
    category: 'Produktion',
    rank: 1,
    max: 2,
    costs: [180, 450],
    desc: 'Die Spulmaschine läuft schneller. Weniger Zeit am Wickler, mehr Zeit am Faden.',
    effect: (lvl) => lvl > 0 ? `Wickelgeschwindigkeit ×${(1 + lvl * 0.7).toFixed(1)}` : 'Wickelgeschwindigkeit: Basis'
  },
  cart: {
    name: 'Transportwagen',
    category: 'Produktion',
    rank: 2,
    max: 1,
    costs: [260],
    desc: 'Ein klappriger Wagen. Du kannst zwei volle Spulen gleichzeitig transportieren.',
    effect: (lvl) => lvl > 0 ? 'Spulenkapazität: 2' : 'Spulenkapazität: 1'
  },
  ladder: {
    name: 'Leiter zum Kopf',
    category: 'Produktion',
    rank: 2,
    max: 1,
    costs: [380],
    desc: 'Eine wackelige Leiter hinter der Puppe. Erschließt die Kopf-Zone mit den wertvollsten Fäden.',
    effect: (lvl) => lvl > 0 ? 'Kopf-Zone freigeschaltet' : 'Kopf-Zone gesperrt'
  },
  master: {
    name: 'Meisterstück',
    category: 'Produktion',
    rank: 4,
    max: 1,
    costs: [1650],
    desc: 'Ein handgefertigtes Stück aus reiner Seide. Deine Hände ziehen schneller, und die Kunden zahlen besser.',
    effect: (lvl) => lvl > 0 ? 'Ziehgeschwindigkeit +15 % · Verkaufswert +10 %' : 'Kein Meisterstück'
  },
  auto: {
    name: 'Automatik-Spinner',
    category: 'Automatisierung',
    rank: 3,
    max: 2,
    costs: [520, 980],
    desc: 'Produziert Faden ohne dein Zutun – aber macht Lärm. Die Puppe hört ihn.',
    effect: (lvl) => lvl > 0 ? `Automatik: ${(1.8 * lvl).toFixed(1)} Faden/s · Lärm steigt` : 'Keine Automatik'
  },
  quiet: {
    name: 'Schalldämmung',
    category: 'Automatisierung',
    rank: 4,
    max: 1,
    costs: [440],
    desc: 'Dämmmatten und Gummifüße. Der Automatik-Spinner wird deutlich leiser.',
    effect: (lvl) => lvl > 0 ? 'Maschinenlärm: −50 %' : 'Maschinenlärm: 100 %',
    requires: 'auto'
  },
  door: {
    name: 'Sicherheitstür',
    category: 'Sicherheit',
    rank: 2,
    max: 2,
    costs: [320, 700],
    desc: 'Stahl statt Blech. Die Tür hält länger, wenn die Puppe in der Nacht anklopft.',
    effect: (lvl) => `Türstabilität: ${100 + lvl * 120}`
  },
  flood: {
    name: 'Flutlicht',
    category: 'Sicherheit',
    rank: 3,
    max: 1,
    costs: [400],
    desc: 'Blendendes Notlicht im Innenhof. Die Puppe bewegt sich nachts etwas langsamer.',
    effect: (lvl) => lvl > 0 ? 'Puppentempo nachts: −12 %' : 'Kein Flutlicht'
  },
  alarm: {
    name: 'Alarmanlage',
    category: 'Sicherheit',
    rank: 2,
    max: 1,
    costs: [300],
    desc: 'Ein schrilles Warnsignal. Du bekommst 8 Sekunden mehr Zeit, um in den Safe Room zu kommen.',
    effect: (lvl) => lvl > 0 ? 'Vorwarnung: +8 s' : 'Vorwarnung: Standard'
  },
  ward: {
    name: 'Nachtamulett',
    category: 'Sicherheit',
    rank: 4,
    max: 1,
    costs: [1250],
    desc: 'Ein Knochenamulett aus der alten Weberei. Reißende Fäden kosten dich deutlich weniger Vorrat.',
    effect: (lvl) => lvl > 0 ? 'Fadenriss-Verlust: −25 %' : 'Kein Amulett'
  },
  gloves: {
    name: 'Gummihandschuhe',
    category: 'Ausrüstung',
    rank: 1,
    max: 1,
    costs: [200],
    desc: 'Besserer Grip. Wenn ein Faden reißt, verlierst du nur halb so viel Vorrat.',
    effect: (lvl) => lvl > 0 ? 'Fadenriss-Verlust: −50 %' : 'Fadenriss-Verlust: 100 %'
  },
  luck: {
    name: 'Glücksfaden',
    category: 'Ausrüstung',
    rank: 2,
    max: 1,
    costs: [360],
    desc: 'Ein alter Aberglaube aus der Weberei. Seltene und goldene Fäden erscheinen häufiger.',
    effect: (lvl) => lvl > 0 ? 'Seltene Fäden: +40 %' : 'Seltene Fäden: Basis'
  },
  boots: {
    name: 'Laufschuhe',
    category: 'Ausrüstung',
    rank: 1,
    max: 1,
    costs: [280],
    desc: 'Abgelatscht, aber schnell. Du bewegst dich dauerhaft neun Prozent schneller.',
    effect: (lvl) => lvl > 0 ? 'Tempo: +9 %' : 'Tempo: Basis'
  },
  orders: {
    name: 'Auftragsbuch',
    category: 'Handel',
    rank: 3,
    max: 2,
    costs: [380, 860],
    desc: 'Ein abgegriffenes Kontaktbuch. Kundenaufträge bringen deutlich mehr Bonusgeld.',
    effect: (lvl) => lvl > 0 ? `Auftragsbonus: +${lvl * 30} %` : 'Auftragsbonus: Basis'
  },
  kasse: {
    name: 'Verhandlungsgeschick',
    category: 'Handel',
    rank: 2,
    max: 2,
    costs: [300, 720],
    desc: 'Du redest länger, sie zahlen mehr. Alle verkauften Spulen bringen mehr Geld.',
    effect: (lvl) => lvl > 0 ? `Verkaufswert: +${lvl * 8} %` : 'Verkaufswert: Basis'
  }
};

export function freshUpgrades() {
  const u = {};
  for (const id of UPGRADE_ORDER) u[id] = 0;
  return u;
}

export function getStats(upg) {
  return {
    bufferCap: 100 + upg.spool * 60,
    pullMul: 1 + upg.technique * 0.22 + (upg.master || 0) * 0.15,
    tensionMul: 1 / (1 + upg.technique * 0.18),
    windSpeed: 1 + upg.winder * 0.7,
    carryCap: 1 + upg.cart,
    ladder: upg.ladder > 0,
    autoRate: 1.8 * upg.auto,
    autoNoise: 0.12 * upg.auto * (upg.quiet > 0 ? 0.5 : 1),
    doorMax: 100 + upg.door * 120,
    dollSlow: upg.flood > 0 ? 1 : 0,
    alarmExtra: upg.alarm > 0 ? 8 : 0,
    snapLoss: 0.30 * (upg.gloves > 0 ? 0.5 : 1) * (upg.ward > 0 ? 0.75 : 1),
    rareMul: upg.luck > 0 ? 1.4 : 1,
    speedMul: upg.boots > 0 ? 1.09 : 1,
    sellMul: 1 + upg.kasse * 0.08 + (upg.master || 0) * 0.10,
    orderBonusMul: 1 + upg.orders * 0.30,
    doorLevel: upg.door
  };
}

export function formatMoney(n) {
  return Math.round(n).toLocaleString('de-DE') + ' €';
}
