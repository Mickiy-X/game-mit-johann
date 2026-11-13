export const NIGHT_MODS = {
  still: {
    name: 'DIE STILLE STUNDE',
    tag: 'SIE HÖRT JEDES WORT',
    desc: 'Kein Wind, keine Maschinen. Jedes Geräusch trägt bis zu ihr.',
    effect: 'Maschinenlärm provoziert sie häufiger. Die Tür bekommt mehr Stöße.'
  },
  storm: {
    name: 'STURM ÜBER DER FABRIK',
    tag: 'DAS LICHT STIRBT',
    desc: 'Regen peitscht gegen die Halle. Die Lampen halten nicht.',
    effect: 'Deine Taschenlampe ist schwächer. Die Sicht ist kürzer.'
  },
  blood: {
    name: 'BLUTMOND',
    tag: 'SIE IST SCHNELLER',
    desc: 'Draußen steht der Mond rot. Drinnen bewegt sie sich anders.',
    effect: 'Die Puppe ist 15 % schneller. Die Sicherheitstür hält länger.'
  },
  blackout: {
    name: 'STROMAUSFALL',
    tag: 'NUR DEINE LAMPE',
    desc: 'Die Sicherungen brennen durch. Die Halle atmet im Dunkeln.',
    effect: 'Notlichter und Deckenlampen sind aus. Deine Taschenlampe reicht weiter.'
  }
};

export function pickNightMod(day, stage, lastId) {
  if (day <= 2) return null;
  const pool = ['still', 'storm'];
  if (stage >= 2) pool.push('blackout');
  if (stage >= 3) pool.push('blood');
  const options = pool.filter((id) => id !== lastId);
  const list = options.length ? options : pool;
  return list[(Math.random() * list.length) | 0];
}

export function nightTuning(id) {
  return {
    dollSpeed: id === 'blood' ? 1.15 : 1,
    doorDamage: id === 'still' ? 1.3 : id === 'blood' ? 0.65 : 1,
    flashlight: id === 'storm' ? 9 : id === 'blackout' ? 20 : 16,
    sabotageChance: id === 'still' ? 0.75 : 0.45,
    bangInterval: id === 'still' ? 0.7 : 1
  };
}
