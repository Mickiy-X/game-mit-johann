import { formatMoney } from './upgrades.js';

export const ORDER_CLIENTS = [
  { name: 'WEBEREI NACHTSCHICHT GmbH', line: 'Wir brauchen Nachschub. Dringend. Wie immer.' },
  { name: 'MUSEUM FÜR FEHLENDE PUPPEN', line: 'Nur das Beste. Sie sieht alles.' },
  { name: 'LSD – LUNARE SEIDENABTEILUNG', line: 'Keine Fragen. Nur Faden.' },
  { name: 'MOTTENKISTE & SÖHNE', line: 'Motten zahlen bar. Meistens.' },
  { name: 'FRAU ZORNS HANDARBEITSKREIS', line: 'Wir stricken etwas, das zurückstrickt.' },
  { name: 'ZWIRNLOGISTIK OST', line: 'Lieferung bis Schichtende. Sonst.' },
  { name: 'THEATER DER STILLEN FÄDEN', line: 'Für die Premiere. Sie sitzt im Publikum.' }
];

export function orderRequirementText(order) {
  if (order.kind === 'value') return `Sucht Warenwert ${formatMoney(order.target)}`;
  if (order.kind === 'premium') return `Sucht ${order.target} schwarze oder goldene Fäden`;
  return `Sucht ${order.target} Spule${order.target === 1 ? '' : 'n'}`;
}

export function orderProgressText(order) {
  if (order.kind === 'value') return `${formatMoney(order.progress)} / ${formatMoney(order.target)} Warenwert`;
  if (order.kind === 'premium') return `${Math.floor(order.progress)} / ${order.target} Edelfäden`;
  return `${Math.floor(order.progress)} / ${order.target} Spulen`;
}

function pickClient(avoidName) {
  for (let i = 0; i < 4; i++) {
    const client = ORDER_CLIENTS[(Math.random() * ORDER_CLIENTS.length) | 0];
    if (client.name !== avoidName) return client;
  }
  return ORDER_CLIENTS[0];
}

export function generateOrder({ day, stage, bonusMul = 1, slot = 'a', forcedKind = null, targetScale = 1, avoidClient = null }) {
  const client = pickClient(avoidClient);
  let kind, target;

  if (forcedKind) {
    kind = forcedKind;
  } else if (day <= 1) {
    kind = 'count';
    target = 1;
  } else if (day === 2) {
    kind = 'count';
    target = 2;
  } else {
    const roll = Math.random();
    if (stage >= 2 && roll < 0.24) {
      kind = 'premium';
      target = 3 + Math.floor(stage / 2);
    } else if (roll < 0.56) {
      kind = 'value';
      target = Math.round((210 + day * 65 + stage * 30) / 10) * 10;
    } else {
      kind = 'count';
      target = Math.min(5, 2 + Math.floor((day - 1) / 4));
    }
  }

  if (kind === 'count') {
    if (!(target > 0)) target = Math.min(5, 2 + Math.floor((day - 1) / 4));
    target = Math.max(1, Math.round(target * targetScale));
  } else if (kind === 'value') {
    if (!(target > 0)) target = Math.round((210 + day * 65 + stage * 30) / 10) * 10;
    target = Math.max(50, Math.round((target * targetScale) / 10) * 10);
  } else {
    if (!(target > 0)) target = 3 + Math.floor(stage / 2);
    target = Math.max(1, Math.round(target * targetScale));
  }

  let base;
  if (kind === 'count') base = 55 + target * 45 + day * 4 + stage * 12;
  else if (kind === 'value') base = Math.round(target * 0.5 + 30 + stage * 15);
  else base = 90 + target * 30 + stage * 20;
  const bonus = Math.max(40, Math.round((base * bonusMul) / 5) * 5);

  return {
    id: `d${day}-${slot}-${kind}`,
    client: client.name,
    line: client.line,
    kind,
    target,
    progress: 0,
    bonus,
    done: false
  };
}

function secondaryKind(avoidKind, stage) {
  const pool = ['count', 'value'];
  if (stage >= 2) pool.push('premium');
  const options = pool.filter((k) => k !== avoidKind);
  return options[(Math.random() * options.length) | 0];
}

export function generateOrders({ day, stage, bonusMul = 1 }) {
  const first = generateOrder({ day, stage, bonusMul, slot: 'a' });
  if (day < 2) return [first];

  const second = day < 3
    ? generateOrder({ day, stage, bonusMul: bonusMul * 0.7, slot: 'b', targetScale: 0.5, avoidClient: first.client })
    : generateOrder({
      day,
      stage,
      bonusMul: bonusMul * 0.7,
      slot: 'b',
      forcedKind: secondaryKind(first.kind, stage),
      targetScale: 0.6,
      avoidClient: first.client
    });
  return [first, second];
}

export function applySaleToOrder(order, spools) {
  if (!order || order.done || !Array.isArray(spools) || spools.length === 0) {
    return { gained: 0, completed: false };
  }
  let gained = 0;
  if (order.kind === 'count') {
    gained = spools.length;
  } else if (order.kind === 'value') {
    gained = spools.reduce((sum, s) => sum + (s.value || 0), 0);
  } else {
    gained = spools.reduce((sum, s) => sum + ((s.counts && s.counts.black) || 0) + ((s.counts && s.counts.gold) || 0), 0);
  }
  if (gained <= 0) return { gained: 0, completed: false };

  order.progress += gained;
  if (order.progress >= order.target) {
    order.progress = order.target;
    order.done = true;
    return { gained, completed: true };
  }
  return { gained, completed: false };
}
