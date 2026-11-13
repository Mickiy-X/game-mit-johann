export const GOAL = 5000;

export const STAGE_THRESHOLDS = [0, 80, 200, 360, 470];
export const STAGE_NAMES = ['Die Schlafende', 'Die Erwachende', 'Die Beobachterin', 'Die Jägerin', 'Das Monster'];
export const STAGE_DESCS = [
  'Sie schläft. Noch.',
  'Ihre Augen bewegen sich unter den Lidern.',
  'Sie beobachtet dich. Sie wartet.',
  'Sie jagt dich. Nachts öffnet sie Türen.',
  'Sie ist kaum noch eine Puppe.'
];

export const QUALITY = {
  white: { name: 'Weiß', value: 1.0, className: 'white' },
  red: { name: 'Rot', value: 2.5, className: 'red' },
  black: { name: 'Schwarz', value: 6.0, className: 'black' },
  gold: { name: 'Gold', value: 18.0, className: 'gold' }
};

export const DAY_LENGTH = 165;
export const DUSK_LENGTH = 20;
export const NIGHT_BASE = 42;
export const PULL_BASE_RATE = 4.6;

export function stageFor(escalation) {
  let stage = 1;
  for (let i = 0; i < STAGE_THRESHOLDS.length; i++) {
    if (escalation >= STAGE_THRESHOLDS[i]) stage = i + 1;
  }
  return stage;
}

export function stageProgress(escalation) {
  const stage = stageFor(escalation);
  const start = STAGE_THRESHOLDS[stage - 1];
  const end = stage < STAGE_THRESHOLDS.length ? STAGE_THRESHOLDS[stage] : 800;
  return Math.max(0, Math.min(1, (escalation - start) / (end - start)));
}

export function nightLength(stage) {
  return NIGHT_BASE + stage * 3;
}
