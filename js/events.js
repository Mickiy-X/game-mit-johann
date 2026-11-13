/* Random daytime events: short, readable windows that change how the
   factory plays without touching the night systems. */

export const DAY_EVENTS = [
  {
    kind: 'pull', name: 'FADENRAUSCH', tag: 'ZONEN-EREIGNIS',
    tone: 'good', duration: 24, weight: 3, power: 1.7
  },
  {
    kind: 'quality', name: 'GOLDENE NAHT', tag: 'QUALITÄT',
    tone: 'good', duration: 20, weight: 2.4, power: 3
  },
  {
    kind: 'sell', name: 'KUNDENANSTURM', tag: 'KASSE',
    tone: 'good', duration: 25, weight: 3, power: 1.35
  },
  {
    kind: 'moths', name: 'MOTTENFRASS', tag: 'VORRAT',
    tone: 'hazard', duration: 7, weight: 2, power: 0.14
  },
  {
    kind: 'blackout', name: 'KURZSCHLUSS', tag: 'MASCHINE',
    tone: 'hazard', duration: 16, weight: 1.6
  },
  {
    kind: 'spool', name: 'WANDERNDE SPULE', tag: 'FUND',
    tone: 'good', duration: 9, weight: 2
  }
];

function pickWeighted(pool, stage) {
  let total = 0;
  for (const def of pool) {
    const hazardBonus = def.tone === 'hazard' ? Math.min(1.2, stage * 0.16) : 0;
    total += def.weight + hazardBonus;
  }
  let r = Math.random() * total;
  for (const def of pool) {
    const hazardBonus = def.tone === 'hazard' ? Math.min(1.2, stage * 0.16) : 0;
    r -= def.weight + hazardBonus;
    if (r <= 0) return def;
  }
  return pool[pool.length - 1];
}

function pickZone(zones) {
  const open = zones.filter((z) => !z.locked && z.remaining > 2);
  if (!open.length) return null;
  const total = open.reduce((sum, z) => sum + Math.min(40, z.remaining), 0);
  let r = Math.random() * total;
  for (const z of open) {
    r -= Math.min(40, z.remaining);
    if (r <= 0) return z;
  }
  return open[open.length - 1];
}

function zoneLabel(zone) {
  return zone ? zone.name : 'EINE ZONE';
}

export function createDayEvent({
  day = 1,
  stage = 1,
  upgrades = {},
  bufferUnits = 0,
  pickupsLeft = 0,
  lastKind = null,
  forcedKind = null,
  zones = []
} = {}) {
  const zoneReady = zones.some((z) => !z.locked && z.remaining > 2);
  const fits = (def) => {
    if (def.kind === 'blackout') return (upgrades.auto || 0) > 0;
    if (def.kind === 'moths') return bufferUnits >= 16;
    if (def.kind === 'spool') return pickupsLeft > 0;
    if (def.kind === 'pull' || def.kind === 'quality') return zoneReady;
    return true;
  };

  const forced = forcedKind ? DAY_EVENTS.find((def) => def.kind === forcedKind) : null;
  let pool = forced ? [forced] : DAY_EVENTS.filter(fits);
  if (!forced && lastKind && pool.length > 1) {
    const withoutLast = pool.filter((def) => def.kind !== lastKind);
    if (withoutLast.length) pool = withoutLast;
  }
  if (!pool.length) return null;

  const def = pickWeighted(pool, stage);
  const zone = (def.kind === 'pull' || def.kind === 'quality') ? pickZone(zones) : null;
  if ((def.kind === 'pull' || def.kind === 'quality') && !zone) return null;

  const event = {
    id: `ev-${day}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    kind: def.kind,
    name: def.name,
    tag: def.tag,
    tone: def.tone,
    zoneId: zone ? zone.id : null,
    zoneName: zone ? zone.name : null,
    duration: def.duration,
    timeLeft: def.duration,
    power: def.power || 1,
    effect: '',
    desc: ''
  };

  const name = zoneLabel(zone);
  switch (def.kind) {
    case 'pull':
      event.effect = `+70 % Faden · ${name}`;
      event.desc = `Der Faden fließt nur so. ${name} gibt ${def.duration} s lang +70 % Faden.`;
      break;
    case 'quality':
      event.effect = `Seltene Fäden · ${name}`;
      event.desc = `In ${name} liegt seltenes Garn. ${def.duration} s lang bessere Qualität.`;
      break;
    case 'sell':
      event.effect = '+35 % Verkaufswert';
      event.desc = `Ein Kunde wartet schon. ${def.duration} s lang bringt jeder Verkauf 35 % mehr.`;
      break;
    case 'moths':
      event.effect = '14 % Vorrat gefressen';
      event.desc = 'Motten im Fadenvorrat. Ein Teil des Vorrats ist verloren.';
      break;
    case 'blackout':
      event.effect = `Spinner außer Betrieb · ${def.duration} s`;
      event.desc = `Kurzschluss in der Maschine. Der Automatik-Spinner steht ${def.duration} s.`;
      break;
    case 'spool':
      event.effect = 'Bonus-Spule im Raum';
      event.desc = 'Eine fremde Spule ist aufgetaucht. Sie glitzert irgendwo zwischen den Maschinen.';
      break;
    default:
      break;
  }

  return event;
}

export function eventPullMul(event, zoneId) {
  return event && event.kind === 'pull' && event.zoneId === zoneId ? event.power : 1;
}

export function eventQualityMul(event, zoneId) {
  return event && event.kind === 'quality' && event.zoneId === zoneId ? event.power : 1;
}

export function eventSellMul(event) {
  return event && event.kind === 'sell' ? event.power : 1;
}

export function eventShortsMachine(event) {
  return !!event && event.kind === 'blackout';
}
