import * as THREE from 'three';
import { WORLD, buildWorld } from './world.js';
import { Doll } from './doll.js';
import { Player } from './player.js';
import { Johann } from './johann.js';
import { UI } from './ui.js';
import { AudioEngine } from './audio.js';
import { Net } from './net.js';
import { RemoteAvatar } from './avatar.js';
import { UPGRADES, UPGRADE_ORDER, freshUpgrades, getStats, formatMoney } from './upgrades.js';
import {
  GOAL, DAY_LENGTH, DUSK_LENGTH, nightLength, stageFor,
  STAGE_NAMES, QUALITY, PULL_BASE_RATE
} from './balance.js';
import { generateOrder, applySaleToOrder, orderRequirementText } from './orders.js';
import { NIGHT_MODS, pickNightMod, nightTuning } from './nights.js';
import { LORE_FRAGMENTS } from './lore.js';

/* ============================================================ */
/* Setup                                                        */
/* ============================================================ */
const stageEl = document.getElementById('stage');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
stageEl.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 90);
scene.add(camera);

const world = buildWorld(scene);
const doll = new Doll(scene);
const player = new Player(camera);
const johann = new Johann(scene);
const ui = new UI();
const audio = new AudioEngine();
const net = new Net();

/* ============================================================ */
/* Co-op session                                                */
/* ============================================================ */
const session = {
  role: 'solo',          // solo | host | guest
  code: '',
  peerConnected: false,
  started: false,
  localPaused: false,
  shopOpen: false
};

const remote = {
  active: false,
  position: WORLD.spawn2.clone(),
  yaw: 0,
  pitch: 0,
  stamina: 100,
  carrying: [],
  invulnerable: 0,
  pulling: false,
  pullZone: null,
  lastInput: 0
};

let guestAvatar = null;
let hostAvatar = null;
let snapSeq = 0;
let snapshotTimer = 0;
let guestInputTimer = 0;
let guestActionLock = 0;

function isHost() { return session.role === 'host'; }
function isGuest() { return session.role === 'guest'; }
function isCoop() { return isHost() || isGuest(); }

function sendToGuest(payload) {
  if (!isHost() || !session.peerConnected) return;
  net.send({ t: 'relay', data: payload });
}

function sendToHost(payload) {
  if (!isGuest() || !session.peerConnected) return;
  net.send({ t: 'relay', data: payload });
}

const baseToast = ui.toast.bind(ui);
ui.toast = (text, type = '', duration = 4200) => {
  baseToast(text, type, duration);
  if (isHost()) {
    sendToGuest({ t: 'ev', e: { kind: 'toast', text, type, duration } });
  }
};

/* Pulled-yarn ribbon between the doll and the player's hands */
const PULL_RIBBON_SEGMENTS = 24;
const pullRibbonPositions = new Float32Array(PULL_RIBBON_SEGMENTS * 2 * 3);
const pullRibbonGeometry = new THREE.BufferGeometry();
pullRibbonGeometry.setAttribute('position', new THREE.BufferAttribute(pullRibbonPositions, 3));
{
  const idx = [];
  for (let i = 0; i < PULL_RIBBON_SEGMENTS - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  pullRibbonGeometry.setIndex(idx);
}
const pullRibbonMaterial = new THREE.MeshBasicMaterial({
  color: 0xe8dcc4, transparent: true, opacity: 0.86,
  side: THREE.DoubleSide, depthWrite: false
});
const pullRibbon = new THREE.Mesh(pullRibbonGeometry, pullRibbonMaterial);
pullRibbon.frustumCulled = false;
pullRibbon.visible = false;
scene.add(pullRibbon);

const PULL_ANCHORS = {
  arm_l: new THREE.Vector3(-3.3, 4.7, -13.0),
  arm_r: new THREE.Vector3(3.3, 4.7, -13.0),
  skirt: new THREE.Vector3(0, 2.4, -10.9),
  back: new THREE.Vector3(0, 4.9, -17.0),
  head: new THREE.Vector3(-1.1, 7.7, -15.2)
};
const ribbonA = new THREE.Vector3();
const ribbonH = new THREE.Vector3();
const ribbonM = new THREE.Vector3();
const ribbonP = new THREE.Vector3();
const ribbonTan = new THREE.Vector3();
const ribbonSide = new THREE.Vector3();
const ribbonView = new THREE.Vector3();
const ribbonUp = new THREE.Vector3(0, 1, 0);
const ribbonRight = new THREE.Vector3();
const ribbonDir = new THREE.Vector3();
const ribbonColor = new THREE.Color();
const ribbonSafe = new THREE.Color(0xbfe3a0);
const ribbonWarn = new THREE.Color(0xffc15c);
const ribbonDanger = new THREE.Color(0xff4d4d);

function updatePullRibbon(tension, time) {
  if (!pull.active || !pull.zone) {
    pullRibbon.visible = false;
    return;
  }
  const anchor = PULL_ANCHORS[pull.zone.id] || PULL_ANCHORS.skirt;
  ribbonA.copy(anchor);
  ribbonA.x += doll.position.x;
  ribbonA.z += doll.position.z;
  ribbonA.y += doll.position.y - WORLD.dollHome.y;

  camera.getWorldDirection(ribbonDir);
  ribbonRight.crossVectors(ribbonDir, ribbonUp).normalize();
  ribbonH.copy(camera.position)
    .addScaledVector(ribbonDir, 0.55)
    .addScaledVector(ribbonRight, 0.24)
    .addScaledVector(ribbonUp, -0.22);

  const sag = 0.52 - tension * 0.0036 + Math.sin(time * 26) * 0.02 * (tension / 100);
  ribbonM.copy(ribbonA).lerp(ribbonH, 0.5);
  ribbonM.y -= Math.max(0.08, sag);
  const width = 0.018 + tension * 0.00008;

  if (tension < 58) ribbonColor.copy(ribbonSafe).lerp(ribbonWarn, tension / 58);
  else ribbonColor.copy(ribbonWarn).lerp(ribbonDanger, (tension - 58) / 27);
  pullRibbonMaterial.color.copy(ribbonColor);

  for (let i = 0; i < PULL_RIBBON_SEGMENTS; i++) {
    const t = i / (PULL_RIBBON_SEGMENTS - 1);
    const it = 1 - t;
    ribbonP.set(0, 0, 0)
      .addScaledVector(ribbonA, it * it)
      .addScaledVector(ribbonM, 2 * it * t)
      .addScaledVector(ribbonH, t * t);
    ribbonTan.set(0, 0, 0)
      .addScaledVector(ribbonA, -2 * it)
      .addScaledVector(ribbonM, 2 * (it - t))
      .addScaledVector(ribbonH, 2 * t)
      .normalize();
    ribbonView.copy(camera.position).sub(ribbonP).normalize();
    ribbonSide.crossVectors(ribbonTan, ribbonView).normalize().multiplyScalar(width);
    const o = i * 6;
    pullRibbonPositions[o] = ribbonP.x - ribbonSide.x;
    pullRibbonPositions[o + 1] = ribbonP.y - ribbonSide.y;
    pullRibbonPositions[o + 2] = ribbonP.z - ribbonSide.z;
    pullRibbonPositions[o + 3] = ribbonP.x + ribbonSide.x;
    pullRibbonPositions[o + 4] = ribbonP.y + ribbonSide.y;
    pullRibbonPositions[o + 5] = ribbonP.z + ribbonSide.z;
  }
  pullRibbonGeometry.attributes.position.needsUpdate = true;
  pullRibbon.visible = true;
}

const START_ZONES = Object.fromEntries(WORLD.zones.map(z => [z.id, z.cap]));
const SETTINGS_KEY = 'zwirn_settings_v1';
const SAVE_KEY = 'zwirn_save_v1';

let settings = { sens: 1, vol: 0.7, muted: false, bot: true, fov: 74, motion: 1, brightness: 1.12, quality: 'high' };
try {
  const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
  if (raw && typeof raw === 'object') settings = { ...settings, ...raw };
} catch (e) { /* ignore */ }

const state = newState();
state.carried = player.carrying;

function newState() {
  const upgrades = freshUpgrades();
  const stats = getStats(upgrades);
  return {
    mode: 'title',
    phase: 'day',
    phaseTimeLeft: DAY_LENGTH,
    day: 1,
    money: 0,
    totalEarned: 0,
    dayEarned: 0,
    goal: GOAL,
    goalAnnounced: false,
    escalation: 0,
    stage: 1,
    upgrades,
    stats,
    buffer: { units: 0, value: 0, counts: { white: 0, red: 0, black: 0, gold: 0 } },
    carried: [],
    zoneRemaining: { ...START_ZONES },
    zoneWarned: {},
    doorClosed: true,
    doorBroken: false,
    doorHealth: stats.doorMax,
    scare: false,
    scareTime: 0,
    scareCooldown: 80,
    machineSabotaged: false,
    insideSafe: false,
    playerStamina: 100,
    spoolsMade: 0,
    endless: false,
    started: false,
    lastCompletedDay: 0,
    order: null,
    ordersDone: 0,
    nightMod: null,
    lastNightMod: null,
    pickups: [],
    lore: 0
  };
}

/* Colliders ---------------------------------------------------- */
const staticColliders = [
  ...world.colliders.walls,
  ...world.colliders.props,
  ...world.colliders.pedestal
];
const dollColliders = [...world.colliders.walls, ...world.colliders.props];
const doorCollider = { minX: -16.35, maxX: -13.15, minZ: 11.85, maxZ: 12.2 };
const closedColliders = [...staticColliders, doorCollider];

function activeColliders() {
  return (state.doorClosed && !state.doorBroken) ? closedColliders : staticColliders;
}

/* Input -------------------------------------------------------- */
const input = { forward: false, back: false, left: false, right: false, sprint: false };
const keys = { e: false };
let pressE = false;
let pointerLocked = false;

function resetKeys() {
  input.forward = input.back = input.left = input.right = input.sprint = false;
  keys.e = false;
  pressE = false;
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (session.shopOpen) { e.preventDefault(); closeGuestShop(); }
    else if (session.localPaused) { e.preventDefault(); resumeGame(); }
    else if (state.mode === 'playing') { e.preventDefault(); pauseGame(); }
    else if (state.mode === 'shop') { e.preventDefault(); closeShop(); }
    else if (state.mode === 'paused') { e.preventDefault(); resumeGame(); }
    return;
  }
  if (e.code === 'KeyB' && !e.repeat) { toggleShop(); return; }
  if (e.code === 'KeyF' && !e.repeat) { toggleFlashlight(); return; }
  if (e.code === 'KeyE') {
    if (!keys.e && !e.repeat) pressE = true;
    keys.e = true;
    return;
  }
  switch (e.code) {
    case 'KeyW': case 'ArrowUp': input.forward = true; break;
    case 'KeyS': case 'ArrowDown': input.back = true; break;
    case 'KeyA': case 'ArrowLeft': input.left = true; break;
    case 'KeyD': case 'ArrowRight': input.right = true; break;
    case 'ShiftLeft': case 'ShiftRight': input.sprint = true; break;
    default: break;
  }
  if (e.code === 'Space') e.preventDefault();
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyE') { keys.e = false; return; }
  switch (e.code) {
    case 'KeyW': case 'ArrowUp': input.forward = false; break;
    case 'KeyS': case 'ArrowDown': input.back = false; break;
    case 'KeyA': case 'ArrowLeft': input.left = false; break;
    case 'KeyD': case 'ArrowRight': input.right = false; break;
    case 'ShiftLeft': case 'ShiftRight': input.sprint = false; break;
    default: break;
  }
});

window.addEventListener('blur', () => resetKeys());

document.addEventListener('mousemove', (e) => {
  if (!pointerLocked || state.mode !== 'playing') return;
  const s = 0.0022 * settings.sens;
  player.yaw -= e.movementX * s;
  player.pitch -= e.movementY * s;
  player.pitch = Math.max(-1.4, Math.min(1.4, player.pitch));
});

renderer.domElement.addEventListener('click', () => {
  if (state.mode === 'playing' && !pointerLocked) lockPointer();
});

document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === renderer.domElement;
  if (!pointerLocked && state.mode === 'playing' && !session.shopOpen && !session.localPaused) pauseGame();
});

document.addEventListener('pointerlockerror', () => {
  pointerLocked = false;
});

function lockPointer() {
  if (document.pointerLockElement === renderer.domElement) return;
  try {
    const p = renderer.domElement.requestPointerLock();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (e) { /* the aim hint will offer a click */ }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  applyQuality();
});

/* ============================================================ */
/* Persistence                                                  */
/* ============================================================ */
function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

function loadRaw() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (!data || data.v !== 1) return null;
    return data;
  } catch (e) { return null; }
}

function saveGame() {
  if (!state.started || isCoop()) return;
  try {
    const data = {
      v: 1,
      day: state.day,
      money: state.money,
      totalEarned: state.totalEarned,
      dayEarned: state.dayEarned,
      escalation: state.escalation,
      upgrades: state.upgrades,
      zoneRemaining: state.zoneRemaining,
      buffer: state.buffer,
      carried: state.carried.map(s => ({ value: s.value, counts: s.counts })),
      doorHealth: state.doorHealth,
      spoolsMade: state.spoolsMade,
      endless: state.endless,
      goalAnnounced: state.goalAnnounced,
      order: state.order,
      ordersDone: state.ordersDone,
      lastNightMod: state.lastNightMod,
      pickups: state.pickups,
      lore: state.lore
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { /* storage can be full or disabled */ }
}

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
}

function loadRun() {
  const data = loadRaw();
  if (!data) return false;

  const upgrades = freshUpgrades();
  for (const id of UPGRADE_ORDER) {
    const lvl = data.upgrades ? data.upgrades[id] : 0;
    if (typeof lvl === 'number') upgrades[id] = Math.max(0, Math.min(UPGRADES[id].max, Math.floor(lvl)));
  }

  state.mode = 'playing';
  state.phase = 'day';
  state.phaseTimeLeft = DAY_LENGTH;
  state.day = Math.max(1, Math.floor(data.day || 1));
  state.money = Math.max(0, data.money || 0);
  state.totalEarned = Math.max(0, data.totalEarned || 0);
  state.dayEarned = Math.max(0, data.dayEarned || 0);
  state.escalation = Math.max(0, data.escalation || 0);
  state.stage = stageFor(state.escalation);
  state.upgrades = upgrades;
  state.stats = getStats(upgrades);
  state.zoneRemaining = { ...START_ZONES };
  if (data.zoneRemaining) {
    for (const z of WORLD.zones) {
      const v = data.zoneRemaining[z.id];
      if (typeof v === 'number') state.zoneRemaining[z.id] = Math.max(0, Math.min(z.cap, v));
    }
  }
  state.buffer = normalizeBuffer(data.buffer);
  state.carried = player.carrying;
  player.carrying.length = 0;
  if (Array.isArray(data.carried)) {
    for (const s of data.carried.slice(0, state.stats.carryCap)) {
      if (s && typeof s.value === 'number') {
        player.carrying.push({ value: Math.max(0, s.value), counts: normalizeCounts(s.counts) });
      }
    }
  }
  player.updateCarryDisplay();
  state.doorClosed = true;
  state.doorBroken = false;
  state.doorHealth = state.stats.doorMax;
  state.scare = false;
  state.scareTime = 0;
  state.scareCooldown = 75;
  state.machineSabotaged = false;
  state.spoolsMade = Math.max(0, data.spoolsMade || 0);
  state.endless = !!data.endless;
  state.goalAnnounced = !!data.goalAnnounced || state.totalEarned >= GOAL;
  state.zoneWarned = {};
  state.insideSafe = false;
  state.order = normalizeOrder(data.order);
  state.ordersDone = Math.max(0, Math.floor(data.ordersDone || 0));
  state.lastNightMod = typeof data.lastNightMod === 'string' ? data.lastNightMod : null;
  state.nightMod = null;
  state.pickups = normalizePickups(data.pickups);
  state.lore = Math.max(0, Math.min(LORE_FRAGMENTS.length, Math.floor(data.lore || 0)));
  state.started = true;
  return true;
}

function normalizeOrder(o) {
  if (!o || typeof o !== 'object') return null;
  if (o.kind !== 'count' && o.kind !== 'value' && o.kind !== 'premium') return null;
  if (!(o.target > 0) || !(o.bonus > 0)) return null;
  return {
    id: typeof o.id === 'string' ? o.id : 'order',
    client: typeof o.client === 'string' ? o.client : 'KUNDE',
    line: typeof o.line === 'string' ? o.line : '',
    kind: o.kind,
    target: o.target,
    progress: Math.max(0, Math.min(o.target, o.progress || 0)),
    bonus: o.bonus,
    done: !!o.done || (o.progress || 0) >= o.target
  };
}

function normalizePickups(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const p of list.slice(0, 3)) {
    if (!p || typeof p !== 'object') continue;
    if (!['money', 'yarn', 'spool'].includes(p.type)) continue;
    if (!(p.reward > 0)) continue;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) continue;
    out.push({
      x: p.x,
      z: p.z,
      type: p.type,
      reward: p.reward,
      taken: !!p.taken
    });
  }
  return out;
}

function normalizeCounts(c) {
  return {
    white: Math.max(0, (c && c.white) || 0),
    red: Math.max(0, (c && c.red) || 0),
    black: Math.max(0, (c && c.black) || 0),
    gold: Math.max(0, (c && c.gold) || 0)
  };
}

function normalizeBuffer(b) {
  return {
    units: Math.max(0, (b && b.units) || 0),
    value: Math.max(0, (b && b.value) || 0),
    counts: normalizeCounts(b && b.counts)
  };
}

/* ============================================================ */
/* UI wiring                                                    */
/* ============================================================ */
ui.bind({
  onStart: (cont) => startGame(cont),
  onToggleSound: () => toggleSound(),
  onResume: () => resumeGame(),
  onQuit: () => quitToTitle(),
  onShopClose: () => closeShop(),
  onBuy: (id) => buyUpgrade(id),
  onDawnContinue: () => dawnContinue(),
  onWinEndless: () => endlessMode(),
  onHost: () => beginHost(),
  onJoin: (code) => beginJoin(code),
  onLobbyStart: () => startHostCoop(),
  onLobbyLeave: () => leaveLobby(),
  onSensitivity: (v) => { settings.sens = v; saveSettings(); },
  onVolume: (v) => {
    settings.vol = v;
    audio.setVolume(v);
    saveSettings();
  },
  onFov: (v) => {
    settings.fov = v;
    camera.fov = v;
    camera.updateProjectionMatrix();
    saveSettings();
  },
  onMotion: (v) => {
    settings.motion = v;
    player.motionScale = v;
    saveSettings();
  },
  onBrightness: (v) => {
    settings.brightness = v;
    renderer.toneMappingExposure = v;
    saveSettings();
  },
  onQuality: (q) => {
    settings.quality = q;
    applyQuality();
    saveSettings();
  },
  onClick: () => audio.click()
});

let lastQuality = '';
function applyQuality() {
  const q = settings.quality || 'high';
  const changed = q !== lastQuality;
  lastQuality = q;
  const dpr = Math.min(window.devicePixelRatio || 1, q === 'low' ? 1 : q === 'medium' ? 1.35 : 1.75);
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = q !== 'low';
  renderer.shadowMap.type = q === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  if (!changed) return;
  scene.traverse((o) => {
    if (!o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) m.needsUpdate = true;
  });
}

function applySettings() {
  camera.fov = settings.fov;
  camera.updateProjectionMatrix();
  player.motionScale = settings.motion;
  renderer.toneMappingExposure = settings.brightness;
  applyQuality();
}

applySettings();
ui.setSettings(settings);
ui.setBotEnabled(settings.bot);
ui.setSoundLabel(!settings.muted);
ui.setContinueVisible(hasSave());
document.getElementById('bot-toggle').addEventListener('change', () => {
  settings.bot = ui.getBotEnabled();
  saveSettings();
});

/* ============================================================ */
/* Run lifecycle                                                */
/* ============================================================ */
function startGame(continueGame) {
  audio.init();
  audio.setVolume(settings.vol);
  audio.setMuted(settings.muted);

  resetKeys();
  ui.hideTitle();
  ui.showHUD();
  ui.hideAllGameOverlays();
  ui.hideCaught();
  ui.setSoundLabel(!settings.muted);

  let loaded = false;
  if (continueGame) loaded = loadRun();
  if (!loaded) {
    // fresh company record
    state.mode = 'playing';
    state.phase = 'day';
    state.phaseTimeLeft = DAY_LENGTH;
    state.day = 1;
    state.money = 0;
    state.totalEarned = 0;
    state.dayEarned = 0;
    state.goalAnnounced = false;
    state.escalation = 0;
    state.stage = 1;
    state.upgrades = freshUpgrades();
    state.stats = getStats(state.upgrades);
    state.buffer = { units: 0, value: 0, counts: { white: 0, red: 0, black: 0, gold: 0 } };
    player.carrying.length = 0;
    player.updateCarryDisplay();
    state.carried = player.carrying;
    state.zoneRemaining = { ...START_ZONES };
    state.zoneWarned = {};
    state.doorClosed = true;
    state.doorBroken = false;
    state.doorHealth = state.stats.doorMax;
    state.scare = false;
    state.scareTime = 0;
    state.machineSabotaged = false;
    state.spoolsMade = 0;
    state.endless = false;
    state.order = null;
    state.ordersDone = 0;
    state.nightMod = null;
    state.lastNightMod = null;
    state.pickups = [];
    state.lore = 0;
    introHintsScheduled = false;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  }

  state.started = true;
  state.scare = false;
  state.scareTime = 0;
  state.machineSabotaged = false;
  firstSnapShown = false;
  fullWarned = false;
  doll.setStage(state.stage);
  world.setPhase('day');
  audio.setPhase('day');
  player.setFlashlight(false);
  player.flashlight.intensity = 0;
  ui.hideWin();
  ui.hideDawn();
  beginDay(!continueGame || !loaded);
  lockPointer();
  ui.toast('Schicht begonnen. Zieh Faden, wickle Spulen und verkaufe sie.', '', 5200);
  setTimeout(() => {
    if (state.mode === 'playing') ui.toast('Vor Sonnenuntergang: ab in den Safe Room und Tür schließen.', 'warn', 5600);
  }, 6500);
}

function beginDay(resetEarnings) {
  state.mode = 'playing';
  state.phase = 'day';
  state.phaseTimeLeft = DAY_LENGTH;
  state.stage = stageFor(state.escalation);
  state.stats = getStats(state.upgrades);
  state.doorClosed = true;
  state.doorBroken = false;
  state.doorHealth = state.stats.doorMax;
  state.machineSabotaged = false;
  state.scare = false;
  state.scareTime = 0;
  state.scareCooldown = 70 + Math.random() * 25;
  state.insideSafe = false;
  state.zoneWarned = {};
  state.nightMod = null;
  stormTimer = 0;
  blackoutTimer = 0;
  document.body.classList.remove('night-blood');
  if (resetEarnings) state.dayEarned = 0;

  if (!state.order) {
    state.order = generateOrder({
      day: state.day,
      stage: state.stage,
      bonusMul: state.stats.orderBonusMul
    });
  }
  if (!state.pickups || state.pickups.length === 0) {
    state.pickups = spawnPickups(state.day);
  }
  restorePickups();

  resetKeys();
  stopPull();
  player.reset(WORLD.spawn);
  player.yaw = 0;
  player.pitch = 0;
  player.invulnerable = 1.6;
  player.flashlightOn = false;
  player.flashlight.intensity = 0;
  player.stamina = 100;
  state.carried = player.carrying;
  player.updateCarryDisplay();

  johann.position.set(-7.2, 0, 10.2);
  johann.group.position.set(-7.2, 0, 10.2);
  johann.state = 'idle';
  johann.timer = 1;
  johann.locked = false;
  johann.carryValue = 0;
  johann.bufferUnits = 0;
  johann.bufferValue = 0;
  johann.spoolCarry.visible = false;
  johann.setActive(settings.bot && !isCoop());

  if (isHost() && remote.active) {
    remote.position.copy(WORLD.spawn2);
    remote.yaw = 0;
    remote.pitch = 0;
    remote.stamina = 100;
    remote.carrying.length = 0;
    remote.invulnerable = 1.6;
    remote.pulling = false;
    remote.pullZone = null;
    remote.lastInput = performance.now();
    sendToGuest({ t: 'ev', e: { kind: 'reset' } });
  }

  doll.resetToHome();
  doll.setStage(state.stage);
  for (const z of WORLD.zones) {
    doll.setZoneFraction(z.id, state.zoneRemaining[z.id] / z.cap);
  }

  world.setDoorVisual(true, false);
  world.setLadderVisible(state.stats.ladder);
  world.setPhase('day');
  audio.setPhase('day');
  ui.setNight(false);
  ui.setDanger(false);
  ui.hideNightBanner();
  ui.hidePull();
  ui.hidePrompt();
  ui.hideCaught();
  lastSpinner = '';
  syncSpinner(true);
  syncUI();

  if (state.day === 1 && !introHintsScheduled && state.order) {
    introHintsScheduled = true;
    const req = orderRequirementText(state.order);
    setTimeout(() => {
      if (state.mode === 'playing') {
        ui.toast(`Kundenauftrag: ${state.order.client} ${req}. Bonus: ${formatMoney(state.order.bonus)}.`, '', 7200);
      }
    }, 9500);
    setTimeout(() => {
      if (state.mode === 'playing') ui.toast('Irgendwo glitzert ein Glücksknäuel. Folg dem Licht.', '', 5200);
    }, 18000);
  }
}

function quitToTitle() {
  if (isCoop()) {
    endCoopSession('Sitzung beendet.');
    return;
  }
  if (state.started) saveGame();
  goToTitle();
}

function goToTitle() {
  state.mode = 'title';
  resetKeys();
  stopPull();
  audio.setPull(false, 0);
  audio.setWinding(false);
  audio.setMachine(false);
  ui.showTitle();
  ui.hideLobby();
  ui.setNetBadge(null);
  ui.hidePull();
  ui.hidePrompt();
  ui.setDanger(false);
  ui.hideNightBanner();
  ui.setNight(false);
  ui.hideCaught();
  ui.setContinueVisible(hasSave());
  document.body.classList.remove('night-blood');
  for (let i = 0; i < world.pickups.length; i++) world.setPickupVisible(i, false);
  world.setPhase('title');
  doll.resetToHome();
  doll.setStage(state.started ? Math.max(2, state.stage) : 2);
  audio.setPhase('title');
  if (document.pointerLockElement) document.exitPointerLock();
}

/* ============================================================ */
/* Co-op lobby and session                                      */
/* ============================================================ */
function cleanupCoop() {
  if (guestAvatar) { guestAvatar.dispose(); guestAvatar = null; }
  if (hostAvatar) { hostAvatar.dispose(); hostAvatar = null; }
  session.role = 'solo';
  session.code = '';
  session.peerConnected = false;
  session.started = false;
  session.localPaused = false;
  session.shopOpen = false;
  remote.active = false;
  remote.pulling = false;
  remote.pullZone = null;
  remote.carrying.length = 0;
  remote.invulnerable = 0;
  ui.hideLobby();
  ui.setNetBadge(null);
  ui.setKoopNote('Gleiche Adresse, Raumcode teilen. Server: node server.js');
}

function endCoopSession(reason = 'Sitzung beendet.') {
  if (isHost() && session.peerConnected) {
    sendToGuest({ t: 'ev', e: { kind: 'end', reason } });
    net.send({ t: 'leave' });
    setTimeout(() => net.close(), 80);
  } else {
    net.send({ t: 'leave' });
    net.close();
  }
  cleanupCoop();
  goToTitle();
  if (reason) setTimeout(() => ui.toast(reason, 'warn', 5200), 120);
}

function leaveLobby() {
  net.send({ t: 'leave' });
  net.close();
  cleanupCoop();
  state.mode = 'title';
  ui.showTitle();
  ui.setContinueVisible(hasSave());
}

async function beginHost() {
  if (isCoop()) return;
  ui.setKoopNote('Verbinde mit Server …');
  try {
    await net.connect();
  } catch (e) {
    ui.setKoopNote(e.message || 'Server nicht erreichbar.', true);
    return;
  }
  net.createRoom();
}

async function beginJoin(code) {
  if (isCoop()) return;
  if (!/^[A-Z0-9]{4}$/.test(code || '')) {
    ui.setKoopNote('Bitte einen 4-stelligen Raumcode eingeben.', true);
    return;
  }
  ui.setKoopNote('Verbinde mit Server …');
  try {
    await net.connect();
  } catch (e) {
    ui.setKoopNote(e.message || 'Server nicht erreichbar.', true);
    return;
  }
  net.joinRoom(code);
}

function openHostLobby(code) {
  session.role = 'host';
  session.code = code;
  session.peerConnected = false;
  ui.setKoopNote(`Raum ${code} erstellt. Code an Spieler 2 weitergeben.`);
  ui.hideTitle();
  ui.showLobby({ code, isHost: true });
}

function openGuestLobby(code) {
  session.role = 'guest';
  session.code = code;
  session.peerConnected = true;
  ui.setKoopNote(`Raum ${code} betreten.`);
  ui.hideTitle();
  ui.showLobby({ code, isHost: false });
}

function prepareRemoteGuest() {
  remote.active = true;
  remote.position.copy(WORLD.spawn2);
  remote.yaw = 0;
  remote.pitch = 0;
  remote.carrying.length = 0;
  remote.invulnerable = 1.6;
  remote.pulling = false;
  remote.pullZone = null;
  remote.lastInput = performance.now();
  if (!guestAvatar) {
    guestAvatar = new RemoteAvatar(scene, 'SPIELER 2', {
      overall: 0x6b2f2f, shirt: 0x2c2a27, cap: 0x9a7a2e
    });
  }
  guestAvatar.setPosition(remote.position.x, remote.position.z, 0);
  guestAvatar.setVisible(true);
}

function startHostCoop() {
  if (!isHost() || !session.peerConnected || session.started) return;
  session.started = true;
  session.localPaused = false;
  session.shopOpen = false;
  ui.hideLobby();
  ui.setNetBadge(`KOOP · ${session.code}`);

  prepareRemoteGuest();
  sendToGuest({ t: 'start' });
  startGame(false);
  ui.toast('Koop-Schicht gestartet. Spieler 2 ist dabei.', '', 4600);
}

function startGuest() {
  if (!isGuest() || session.started) return;
  session.started = true;
  session.localPaused = false;
  session.shopOpen = false;
  lastSpinnerSig = '';
  lastPickupSig = '';
  lastShopSig = '';
  lastCarrySig = '';
  ui.hideLobby();
  ui.setNetBadge(`KOOP · ${session.code}`);

  audio.init();
  audio.setVolume(settings.vol);
  audio.setMuted(settings.muted);
  resetKeys();
  ui.hideTitle();
  ui.showHUD();
  ui.hideAllGameOverlays();
  ui.hideCaught();

  state.mode = 'playing';
  state.phase = 'day';
  state.phaseTimeLeft = DAY_LENGTH;
  state.day = 1;
  state.money = 0;
  state.totalEarned = 0;
  state.dayEarned = 0;
  state.goalAnnounced = false;
  state.escalation = 0;
  state.stage = 1;
  state.upgrades = freshUpgrades();
  state.stats = getStats(state.upgrades);
  state.buffer = { units: 0, value: 0, counts: { white: 0, red: 0, black: 0, gold: 0 } };
  state.zoneRemaining = { ...START_ZONES };
  state.zoneWarned = {};
  state.doorClosed = true;
  state.doorBroken = false;
  state.doorHealth = state.stats.doorMax;
  state.scare = false;
  state.scareTime = 0;
  state.machineSabotaged = false;
  state.spoolsMade = 0;
  state.endless = false;
  state.order = null;
  state.ordersDone = 0;
  state.nightMod = null;
  state.lastNightMod = null;
  state.pickups = [];
  state.lore = 0;
  state.started = true;

  player.carrying.length = 0;
  player.updateCarryDisplay();
  state.carried = player.carrying;
  player.reset(WORLD.spawn2);
  player.yaw = 0;
  player.pitch = 0;
  player.invulnerable = 1.6;
  player.stamina = 100;
  player.setFlashlight(false);
  player.flashlight.intensity = 0;

  johann.setActive(false);
  johann.active = false;
  doll.setStage(1);
  doll.resetToHome();
  world.setPhase('day');
  world.setDoorVisual(true, false);
  world.setLadderVisible(false);
  world.setSpinnerState(false, false, false);
  for (let i = 0; i < world.pickups.length; i++) world.setPickupVisible(i, false);

  if (!hostAvatar) {
    hostAvatar = new RemoteAvatar(scene, 'SPIELER 1', {
      overall: 0x2f4e73, shirt: 0xb7a98f, cap: 0xc9a536
    });
  }
  hostAvatar.setPosition(WORLD.spawn.x, WORLD.spawn.z, 0);
  hostAvatar.setVisible(true);

  ui.setNight(false);
  ui.setDanger(false);
  ui.hideNightBanner();
  syncUI();
  if (document.pointerLockElement) document.exitPointerLock();
  lockPointer();
  ui.toast('Koop-Schicht gestartet. Spieler 1 ist der Host.', '', 4600);
}

function handleServerMessage(type, msg) {
  switch (type) {
    case 'created':
      openHostLobby(msg.code);
      break;
    case 'joined':
      openGuestLobby(msg.code);
      break;
    case 'peer': {
      if (!isHost()) break;
      const wasConnected = session.peerConnected;
      session.peerConnected = !!msg.joined;
      ui.updateLobby({ isHost: true, guestConnected: session.peerConnected });
      if (!session.peerConnected) {
        handlePeerLeft();
      } else if (session.started && !wasConnected) {
        prepareRemoteGuest();
        sendToGuest({ t: 'start' });
        ui.toast('Spieler 2 ist während der Schicht dazugekommen.', '', 4600);
      }
      break;
    }
    case 'host-left':
      if (isGuest()) endCoopSession('Der Host hat die Sitzung beendet.');
      break;
    case 'relay':
      handlePeerMessage(msg.data);
      break;
    case 'err':
      ui.setKoopNote(msg.msg || 'Koop-Fehler.', true);
      ui.toast(msg.msg || 'Koop-Fehler.', 'warn', 5200);
      break;
    default:
      break;
  }
}

net.on('created', (msg) => handleServerMessage('created', msg));
net.on('joined', (msg) => handleServerMessage('joined', msg));
net.on('peer', (msg) => handleServerMessage('peer', msg));
net.on('host-left', (msg) => handleServerMessage('host-left', msg));
net.on('relay', (msg) => handleServerMessage('relay', msg));
net.on('err', (msg) => handleServerMessage('err', msg));
net.on('close', () => {
  if (isGuest()) {
    endCoopSession('Verbindung zum Host verloren.');
  } else if (isHost() && session.started) {
    session.peerConnected = false;
    remote.active = false;
    remote.pulling = false;
    if (guestAvatar) { guestAvatar.dispose(); guestAvatar = null; }
    ui.setNetBadge(null);
    ui.toast('Verbindung zu Spieler 2 verloren. Du spielst allein weiter.', 'warn', 6200);
  } else if (isHost()) {
    leaveLobby();
  }
});

function handlePeerLeft() {
  remote.active = false;
  remote.pulling = false;
  remote.pullZone = null;
  remote.carrying.length = 0;
  if (guestAvatar) { guestAvatar.dispose(); guestAvatar = null; }
  if (session.started) {
    ui.setNetBadge(null);
    ui.toast('Spieler 2 hat die Sitzung verlassen. Du spielst allein weiter.', 'warn', 6200);
  } else {
    ui.setKoopNote('Spieler 2 hat die Lobby verlassen.', true);
  }
}

function handlePeerMessage(msg) {
  if (!msg || typeof msg !== 'object') return;
  if (isGuest()) {
    switch (msg.t) {
      case 'start': startGuest(); break;
      case 'snap': applyGuestSnapshot(msg.s); break;
      case 'ev': handleGuestEvent(msg.e); break;
      default: break;
    }
  } else if (isHost()) {
    switch (msg.t) {
      case 'input': applyRemoteInput(msg); break;
      case 'act': handleGuestAction(msg); break;
      default: break;
    }
  }
}

function applyRemoteInput(msg) {
  if (!remote.active) return;
  const bx = WORLD.bounds;
  remote.position.x = Math.max(bx.minX + 0.5, Math.min(bx.maxX - 0.5, Number(msg.x) || 0));
  remote.position.z = Math.max(bx.minZ + 0.5, Math.min(bx.maxZ - 0.5, Number(msg.z) || 0));
  remote.position.y = 0;
  remote.yaw = Number(msg.yaw) || 0;
  remote.pitch = Number(msg.pitch) || 0;
  remote.stamina = Math.max(0, Math.min(100, Number(msg.stamina) || 0));
  remote.lastInput = performance.now();
}

/* ---------------- Host: remote simulation ---------------- */
function updateRemoteSim(dt) {
  if (!remote.active) return;
  if (remote.invulnerable > 0) remote.invulnerable -= dt;

  if (remote.pulling) {
    const z = WORLD.zones.find((zone) => zone.id === remote.pullZone);
    if (!z || (state.zoneRemaining[z.id] || 0) <= 0.5) {
      remote.pulling = false;
      remote.pullZone = null;
    } else {
      const d = Math.hypot(remote.position.x - z.pos.x, remote.position.z - z.pos.z);
      if (d > z.radius + 2.3) {
        remote.pulling = false;
        remote.pullZone = null;
      } else {
        const rate = PULL_BASE_RATE * z.rate * state.stats.pullMul;
        gainYarn(z, rate * dt);
      }
    }
  }

  if (performance.now() - remote.lastInput > 4000) {
    remote.pulling = false;
    remote.pullZone = null;
  }

  if (guestAvatar) {
    guestAvatar.setTarget(remote.position.x, remote.position.z, remote.yaw, remote.carrying.length > 0);
    guestAvatar.update(dt);
  }
}

function buildSnapshot() {
  snapSeq++;
  return {
    seq: snapSeq,
    phase: state.phase,
    phaseTimeLeft: state.phaseTimeLeft,
    day: state.day,
    money: state.money,
    totalEarned: state.totalEarned,
    dayEarned: state.dayEarned,
    goalAnnounced: state.goalAnnounced,
    escalation: state.escalation,
    stage: state.stage,
    buffer: state.buffer,
    zoneRemaining: state.zoneRemaining,
    doorClosed: state.doorClosed,
    doorBroken: state.doorBroken,
    doorHealth: state.doorHealth,
    scare: state.scare,
    nightMod: state.nightMod,
    machineSabotaged: state.machineSabotaged,
    spoolsMade: state.spoolsMade,
    order: state.order,
    ordersDone: state.ordersDone,
    pickups: state.pickups.map((p) => ({ x: p.x, z: p.z, type: p.type, reward: p.reward, taken: p.taken })),
    upgrades: state.upgrades,
    lore: state.lore,
    endless: state.endless,
    mode: (state.mode === 'shop' || state.mode === 'paused' || state.mode === 'caught') ? 'playing' : state.mode,
    host: { x: player.position.x, z: player.position.z, yaw: player.yaw, carry: player.carrying.length },
    guestPos: { x: remote.position.x, z: remote.position.z },
    guestCarry: remote.carrying.map((s) => ({ value: s.value, counts: s.counts })),
    doll: { x: doll.position.x, z: doll.position.z, yaw: doll.group.rotation.y },
    lightsOut: world.lightsOut || 0
  };
}

function handleGuestAction(msg) {
  if (!isHost() || !remote.active) return;
  const px = remote.position.x;
  const pz = remote.position.z;
  const near = (x, z, r) => Math.hypot(px - x, pz - z) <= r;

  switch (msg.kind) {
    case 'pull': {
      const z = WORLD.zones.find((zone) => zone.id === msg.zoneId);
      if (!z || (state.zoneRemaining[z.id] || 0) <= 0.5) return;
      if (!near(z.pos.x, z.pos.z, z.radius + 2.3)) return;
      remote.pulling = true;
      remote.pullZone = z.id;
      break;
    }
    case 'pull-stop':
      remote.pulling = false;
      remote.pullZone = null;
      break;
    case 'snap': {
      const loss = state.stats.snapLoss;
      state.buffer.units *= (1 - loss);
      state.buffer.value *= (1 - loss);
      for (const k of ['white', 'red', 'black', 'gold']) state.buffer.counts[k] *= (1 - loss);
      ui.toast(`Der Faden reißt! ${Math.round(loss * 100)} % des Vorrats verloren.`, 'danger', 5200);
      sendToGuest({ t: 'ev', e: { kind: 'damage' } });
      break;
    }
    case 'wind': {
      if (!near(WORLD.winder.x, WORLD.winder.z, 3.2)) return;
      if (state.buffer.units < 20) return;
      if (remote.carrying.length >= state.stats.carryCap) {
        ui.toast('Spieler 2 hat die Hände voll.', 'warn', 3600);
        return;
      }
      finishWindingFor(remote);
      break;
    }
    case 'sell':
      if (!near(WORLD.sell.x, WORLD.sell.z, 3.2)) return;
      if (!remote.carrying.length) return;
      sellAllFor(remote);
      break;
    case 'door':
      if (state.doorBroken) return;
      if (!near(-14.75, 12, 3.5)) return;
      toggleDoor();
      break;
    case 'pickup': {
      const i = Number(msg.index);
      const p = state.pickups[i];
      if (!p || p.taken) return;
      if (!near(p.x, p.z, 2.6)) return;
      collectPickup(i, remote);
      break;
    }
    case 'buy':
      if (state.phase !== 'day') return;
      buyUpgrade(msg.id, true);
      break;
    case 'repair':
      if (!near(WORLD.spinner.x, WORLD.spinner.z, 3.6)) return;
      if (!state.machineSabotaged) return;
      repairSpinner();
      break;
    case 'continue':
      if (state.mode === 'dawn') dawnContinue();
      break;
    case 'endless':
      if (state.mode === 'win') endlessMode();
      break;
    default:
      break;
  }
}

function finishWindingFor(who) {
  const value = Math.max(1, Math.round(state.buffer.value));
  who.carrying.push({ value, counts: { ...state.buffer.counts } });
  state.spoolsMade++;
  state.buffer = { units: 0, value: 0, counts: { white: 0, red: 0, black: 0, gold: 0 } };
  if (who === player) player.updateCarryDisplay();
  resetHold();
  audio.windDone();
  ui.pulseCarry();
  ui.toast(`Spule fertig: ${formatMoney(value)}`, '', 4200);
  syncUI();
}

function sellAllFor(who) {
  if (!who.carrying.length) return;
  const spools = who.carrying.slice();
  const total = spools.reduce((s, x) => s + x.value, 0);
  const payout = Math.round(total * state.stats.sellMul);
  const count = spools.length;
  who.carrying.length = 0;
  if (who === player) player.updateCarryDisplay();
  addMoney(payout);
  registerOrderSale(spools);
  resetHold();
  audio.sale();
  audio.coin();
  ui.toast(`${count} Spule${count > 1 ? 'n' : ''} verkauft: + ${formatMoney(payout)}`, 'gold', 4800);
  syncUI();
}

/* ---------------- Guest: snapshot and events ---------------- */
let dollNet = null;
let lastSpinnerSig = '';
let lastPickupSig = '';
let lastShopSig = '';
let lastCarrySig = '';

function applyGuestPhase(phase) {
  if (phase !== 'day' && session.shopOpen) closeGuestShop(false);
  world.setPhase(phase);
  audio.setPhase(phase);
  if (phase === 'day') {
    ui.setNight(false);
    ui.setDanger(false);
    ui.hideNightBanner();
    document.body.classList.remove('night-blood');
  } else if (phase === 'dusk') {
    ui.setNight(true);
    ui.showNightBanner('SONNENUNTERGANG · AB IN DEN SAFE ROOM');
    ui.setDanger(true, 'SIE WACHT AUF');
    document.body.classList.remove('night-blood');
    audio.siren();
  } else if (phase === 'night') {
    const mod = state.nightMod ? NIGHT_MODS[state.nightMod] : null;
    ui.setNight(true);
    ui.showNightBanner(mod ? `${mod.name} · SIE IST WACH` : 'DIE PUPPE IST WACH');
    ui.setDanger(true, 'SIE JAGT DICH');
    if (state.nightMod === 'storm') {
      world.lightTargets.fog = 0.048;
      world.lightTargets.lamp = 1.2;
    }
    if (state.nightMod === 'blackout') {
      world.lightTargets.fog = 0.042;
      world.lightTargets.lamp = 0.15;
      world.lightTargets.emerg = 0;
      world.lightTargets.safe = 5;
      blackoutTimer = 8;
      setTimeout(() => {
        if (state.phase === 'night' && state.nightMod === 'blackout') {
          ui.toast('Stromausfall: F schaltet die Taschenlampe. Ohne sie siehst du fast nichts.', 'warn', 6600);
        }
      }, 3200);
    }
    if (state.nightMod === 'blood') document.body.classList.add('night-blood');
    audio.siren();
  }
}

function applyGuestPickups(list) {
  const items = list || [];
  const sig = items.map((p) => `${p.x}|${p.z}|${p.taken ? 1 : 0}`).join(';');
  if (sig === lastPickupSig) return;
  lastPickupSig = sig;
  state.pickups = items;
  for (let i = 0; i < world.pickups.length; i++) {
    const p = items[i];
    world.setPickupVisible(i, !!p && !p.taken, p ? p.x : 0, p ? p.z : 0);
  }
}

function applyGuestSnapshot(s) {
  if (!isGuest() || !s) return;
  const prevPhase = state.phase;
  const prevScare = state.scare;
  const prevDoorClosed = state.doorClosed;
  const prevDoorBroken = state.doorBroken;
  const prevLadder = state.upgrades.ladder;

  state.phase = s.phase;
  state.phaseTimeLeft = s.phaseTimeLeft;
  state.day = s.day;
  state.money = s.money;
  state.totalEarned = s.totalEarned;
  state.dayEarned = s.dayEarned;
  state.goalAnnounced = s.goalAnnounced;
  state.escalation = s.escalation;
  state.stage = s.stage;
  state.buffer = normalizeBuffer(s.buffer);
  state.zoneRemaining = { ...s.zoneRemaining };
  state.doorClosed = s.doorClosed;
  state.doorBroken = s.doorBroken;
  state.doorHealth = s.doorHealth;
  state.scare = s.scare;
  state.nightMod = s.nightMod;
  state.machineSabotaged = s.machineSabotaged;
  state.spoolsMade = s.spoolsMade;
  state.order = s.order;
  state.ordersDone = s.ordersDone;
  state.upgrades = s.upgrades || state.upgrades;
  state.stats = getStats(state.upgrades);
  state.lore = s.lore;
  state.endless = s.endless;

  const carrySig = (s.guestCarry || []).map((sp) => Math.round(sp.value || 0)).join(',');
  if (carrySig !== lastCarrySig) {
    lastCarrySig = carrySig;
    player.carrying.length = 0;
    for (const sp of s.guestCarry || []) {
      player.carrying.push({ value: Math.max(0, sp.value || 0), counts: normalizeCounts(sp.counts) });
    }
    player.updateCarryDisplay();
    state.carried = player.carrying;
  }

  if (s.guestPos) {
    const dx = player.position.x - s.guestPos.x;
    const dz = player.position.z - s.guestPos.z;
    if (Math.hypot(dx, dz) > 2.5) {
      player.reset(new THREE.Vector3(s.guestPos.x, 0, s.guestPos.z));
      player.invulnerable = Math.max(player.invulnerable, 1.2);
    }
  }

  dollNet = {
    x: s.doll.x,
    z: s.doll.z,
    yaw: s.doll.yaw,
    awake: s.phase === 'night' || s.scare,
    stage: s.stage
  };

  if (s.phase !== prevPhase) applyGuestPhase(s.phase);

  if (!!s.scare !== !!prevScare) {
    if (s.scare) {
      ui.setDanger(true, 'SIE IST WACH');
      ui.showNightBanner('SIE IST AUF GEWACHT');
      audio.siren();
    } else if (s.phase === 'day') {
      ui.setDanger(false);
    }
  }

  if (s.doorClosed !== prevDoorClosed || s.doorBroken !== prevDoorBroken) {
    world.setDoorVisual(s.doorClosed, s.doorBroken);
    if (s.doorBroken && !prevDoorBroken) audio.doorBreak();
    else if (s.doorClosed !== prevDoorClosed && !s.doorBroken) {
      if (s.doorClosed) audio.click();
      else audio.creak();
    }
  }

  if ((s.upgrades.ladder > 0) !== (prevLadder > 0)) {
    world.setLadderVisible(s.upgrades.ladder > 0);
  }

  const running = s.upgrades.auto > 0 && s.phase === 'day' && !s.scare && !s.machineSabotaged;
  const spinSig = `${s.upgrades.auto}|${running}|${s.machineSabotaged}`;
  if (spinSig !== lastSpinnerSig) {
    lastSpinnerSig = spinSig;
    world.setSpinnerState(s.upgrades.auto > 0, running, s.machineSabotaged);
    audio.setMachine(running);
  }

  doll.setStage(s.stage);
  for (const z of WORLD.zones) {
    doll.setZoneFraction(z.id, (state.zoneRemaining[z.id] || 0) / z.cap);
  }
  if (typeof s.lightsOut === 'number') world.lightsOut = Math.max(world.lightsOut || 0, s.lightsOut);
  applyGuestPickups(s.pickups);

  if (hostAvatar) hostAvatar.setTarget(s.host.x, s.host.z, s.host.yaw, s.host.carry > 0);

  if (s.mode === 'playing' && (state.mode === 'dawn' || state.mode === 'win')) {
    ui.hideDawn();
    ui.hideWin();
    state.mode = 'playing';
    resetGuestDay();
  }

  renderGuestShopIfChanged();
}

function renderGuestShopIfChanged() {
  if (!session.shopOpen) return;
  const sig = `${state.money}|${state.phase}|${state.upgrades.ladder}|${UPGRADE_ORDER.map((id) => state.upgrades[id]).join(',')}`;
  if (sig === lastShopSig) return;
  lastShopSig = sig;
  ui.renderShop(state);
}

function handleGuestEvent(e) {
  if (!isGuest() || !e) return;
  switch (e.kind) {
    case 'toast':
      ui.toast(e.text, e.type, e.duration);
      break;
    case 'caught':
      clearCoopOverlays();
      ui.showCaught(e.sub || 'Sie hat dich gefunden.', 2400);
      audio.jumpscare();
      player.addShake(0.38, 1.2);
      player.carrying.length = 0;
      player.updateCarryDisplay();
      player.reset(new THREE.Vector3(-14.2, 0, 18.2));
      player.yaw = 0;
      player.pitch = 0;
      player.invulnerable = 7;
      stopPull();
      resetHold();
      ui.hidePull();
      clearPrompt();
      break;
    case 'damage':
      ui.flashDamage();
      player.addShake(0.22, 0.7);
      audio.snap();
      break;
    case 'dawn':
      clearCoopOverlays();
      document.body.classList.remove('night-blood');
      state.mode = 'dawn';
      resetKeys();
      stopPull();
      resetHold();
      ui.hidePull();
      clearPrompt();
      audio.setPull(false, 0);
      audio.setWinding(false);
      audio.setMachine(false);
      audio.dawn();
      if (document.pointerLockElement) document.exitPointerLock();
      ui.showDawn(e.data);
      break;
    case 'win':
      clearCoopOverlays();
      state.mode = 'win';
      resetKeys();
      stopPull();
      ui.hidePull();
      clearPrompt();
      if (document.pointerLockElement) document.exitPointerLock();
      ui.showWin(e.data);
      break;
    case 'reset':
      resetGuestDay();
      break;
    case 'end':
      endCoopSession(e.reason || 'Der Host hat die Sitzung beendet.');
      break;
    default:
      break;
  }
}

function resetGuestDay() {
  clearCoopOverlays();
  state.mode = 'playing';
  ui.hideDawn();
  ui.hideWin();
  ui.hideCaught();
  resetKeys();
  stopPull();
  resetHold();
  ui.hidePull();
  clearPrompt();
  player.reset(WORLD.spawn2);
  player.yaw = 0;
  player.pitch = 0;
  player.invulnerable = 1.6;
  player.stamina = 100;
  player.setFlashlight(false);
  player.flashlight.intensity = 0;
  if (!document.pointerLockElement) lockPointer();
  syncUI();
}

/* ---------------- Guest: local game loop ---------------- */
function updateGuestGame(dt) {
  guestActionLock = Math.max(0, guestActionLock - dt);
  const active = state.mode === 'playing' && !session.localPaused && !session.shopOpen;

  player.update(dt, active ? input : ZERO_INPUT, state, activeColliders(), (sprint) => {
    if (active) audio.footstep(sprint);
  });
  state.playerStamina = player.stamina;

  if (active) {
    updateGuestInteractions(dt);
  } else {
    clearPrompt();
    ui.hidePull();
    audio.setPull(false, 0);
    world.setWinderActive(false);
    audio.setWinding(false);
  }

  if (dollNet) doll.applyNetwork(dt, dollNet, player.position);
  if (hostAvatar) hostAvatar.update(dt);
  if (state.phase === 'night' && state.nightMod === 'blackout') {
    blackoutTimer -= dt;
    if (blackoutTimer <= 0) {
      blackoutTimer = 11 + Math.random() * 8;
      world.lightsOut = 0.18;
      audio.creakLong();
    }
  }
  updatePickupGlint(dt);

  const tune = state.phase === 'night' ? nightTuning(state.nightMod) : null;
  const flTarget = player.flashlightOn ? (tune ? tune.flashlight : 16) : 0;
  player.flashlight.intensity += (flTarget - player.flashlight.intensity) * Math.min(1, dt * 7);

  state.insideSafe = isProtected(player.position);
  world.update(dt, {
    doll,
    player,
    johann,
    door: { closed: state.doorClosed, broken: state.doorBroken },
    upgrades: state.upgrades,
    day: state.day
  });
  updatePullRibbon(pull.tension, performance.now() * 0.001);
  audio.update(dt, {
    phase: state.phase,
    scare: state.scare || state.phase === 'dusk',
    insideSafe: state.insideSafe,
    dollDist: Math.hypot(player.position.x - doll.position.x, player.position.z - doll.position.z)
  });

  ui.setAimHint(!pointerLocked && state.mode !== 'caught');
  uiTimer += dt;
  if (uiTimer >= 0.1) {
    uiTimer = 0;
    syncUI();
    renderGuestShopIfChanged();
  }

  guestInputTimer -= dt;
  if (guestInputTimer <= 0) {
    guestInputTimer = 0.05;
    sendToHost({
      t: 'input',
      x: player.position.x,
      z: player.position.z,
      yaw: player.yaw,
      pitch: player.pitch,
      stamina: player.stamina
    });
  }

  pressE = false;
}

function updateGuestInteractions(dt) {
  if (pull.snapLock > 0) pull.snapLock -= dt;

  const inter = findInteraction(player.position);
  let zonePulling = false;
  let winding = false;

  if (inter) {
    switch (inter.type) {
      case 'zone': {
        const z = inter.zone;
        if (inter.locked) {
          setPrompt({ text: 'Kopf-Zone gesperrt', sub: 'Leiter im Katalog kaufen' });
        } else if (state.buffer.units >= state.stats.bufferCap - 0.01) {
          setPrompt({ text: 'Fadenvorrat voll', sub: 'Zum Wickler gehen' });
          if (!fullWarned) {
            fullWarned = true;
            ui.toast('Der Fadenvorrat ist voll. Wickle ihn am Wickler auf.', 'warn', 4800);
          }
        } else if (keys.e && pull.snapLock <= 0) {
          zonePulling = true;
          pull.active = true;
          pull.zone = z;
          pull.rate = PULL_BASE_RATE * z.rate * state.stats.pullMul;
          pull.tension += dt * 27 * z.risk * state.stats.tensionMul;
          if (pull.tension >= 100) {
            pull.tension = 0;
            pull.snapLock = 0.8;
            pull.active = false;
            pull.zone = null;
            ui.hidePull();
            sendToHost({ t: 'act', kind: 'snap' });
          } else {
            ui.showPull(z.name, pull.tension, pull.rate);
          }
          clearPrompt();
        } else {
          pull.tension = Math.max(0, pull.tension - 42 * dt);
          setPrompt({
            text: `Faden ziehen · ${z.name}`,
            sub: 'E halten · loslassen senkt die Spannung'
          });
        }
        break;
      }
      case 'pickup': {
        pull.tension = Math.max(0, pull.tension - 42 * dt);
        const p = state.pickups[inter.pickupIndex];
        const flavor = p && p.type === 'spool'
          ? 'Eine fertige Spule. Wer hat sie verloren?'
          : p && p.type === 'money'
            ? 'Ein kleiner Fund zwischen den Maschinen.'
            : 'Faden, der nicht von ihr stammt.';
        setPrompt({ text: 'Glücksknäuel einsammeln', sub: flavor });
        if (pressE) sendToHost({ t: 'act', kind: 'pickup', index: inter.pickupIndex });
        break;
      }
      case 'door': {
        pull.tension = Math.max(0, pull.tension - 42 * dt);
        if (state.doorBroken) {
          setPrompt({ text: 'Tür ist zerstört', sub: 'Bis zum Morgen bleibt sie offen' });
        } else {
          setPrompt({
            text: state.doorClosed ? 'Tür öffnen' : 'Tür schließen',
            sub: state.doorClosed ? 'Der Safe Room ist verriegelt' : 'Nur geschlossen schützt sie'
          });
          if (pressE) sendToHost({ t: 'act', kind: 'door' });
        }
        break;
      }
      case 'winder': {
        pull.tension = Math.max(0, pull.tension - 42 * dt);
        if (state.buffer.units < 20) {
          setPrompt({ text: 'Zu wenig Faden', sub: 'Mindestens 20 Einheiten sammeln' });
        } else if (player.carrying.length >= state.stats.carryCap) {
          setPrompt({ text: 'Hände voll', sub: 'Erst die Spulen verkaufen' });
        } else if (guestActionLock > 0) {
          setPrompt({ text: 'Spule wird aufgewickelt', sub: 'Einen Moment …' });
        } else {
          const p = handleHold(dt, 'winder', 1 / 1.75 * state.stats.windSpeed);
          setPrompt({ text: 'Spule aufwickeln', sub: 'E halten', progress: p });
          winding = true;
          if (p >= 1) {
            sendToHost({ t: 'act', kind: 'wind' });
            guestActionLock = 0.7;
            resetHold();
          }
        }
        break;
      }
      case 'sell': {
        pull.tension = Math.max(0, pull.tension - 42 * dt);
        if (player.carrying.length === 0) {
          setPrompt({ text: 'Keine Spulen dabei', sub: 'Erst am Wickler eine Spule machen' });
        } else if (guestActionLock > 0) {
          setPrompt({ text: 'Wird verkauft …', sub: 'Einen Moment' });
        } else {
          const p = handleHold(dt, 'sell', 1 / 0.9);
          const total = player.carrying.reduce((s, x) => s + x.value, 0);
          setPrompt({ text: `Spulen verkaufen · ${formatMoney(total)}`, sub: 'E halten', progress: p });
          if (p >= 1) {
            sendToHost({ t: 'act', kind: 'sell' });
            guestActionLock = 0.7;
            resetHold();
          }
        }
        break;
      }
      case 'shop': {
        pull.tension = Math.max(0, pull.tension - 42 * dt);
        setPrompt({ text: 'Fabrik-Katalog öffnen', sub: 'Nur tagsüber verfügbar' });
        if (pressE) openGuestShop();
        break;
      }
      case 'spinner': {
        pull.tension = Math.max(0, pull.tension - 42 * dt);
        if (state.upgrades.auto === 0) {
          setPrompt({ text: 'Automatik-Spinner nicht installiert', sub: 'Im Katalog kaufen' });
        } else if (state.machineSabotaged) {
          if (guestActionLock > 0) {
            setPrompt({ text: 'Maschine wird repariert', sub: 'Einen Moment …' });
          } else {
            const p = handleHold(dt, 'repair', 1 / 2.2);
            setPrompt({ text: 'Maschine reparieren', sub: 'E halten', progress: p });
            if (p >= 1) {
              sendToHost({ t: 'act', kind: 'repair' });
              guestActionLock = 0.7;
              resetHold();
            }
          }
        } else {
          const running = state.phase === 'day' && !state.scare;
          setPrompt({
            text: running ? 'Spinner läuft' : 'Spinner steht',
            sub: running ? 'Lärm zieht ihre Aufmerksamkeit an' : 'Erst am nächsten Tag wieder aktiv'
          });
        }
        break;
      }
      default:
        break;
    }
    if (inter.type !== 'winder') winding = false;
  } else {
    clearPrompt();
    pull.tension = Math.max(0, pull.tension - 42 * dt);
  }

  if (zonePulling) {
    pull.resend = (pull.resend || 0) - dt;
    if (!pull.guestSent || pull.resend <= 0) {
      pull.guestSent = true;
      pull.resend = 0.5;
      sendToHost({ t: 'act', kind: 'pull', zoneId: pull.zone.id });
    }
  } else {
    if (pull.guestSent) {
      pull.guestSent = false;
      sendToHost({ t: 'act', kind: 'pull-stop' });
    }
    pull.active = false;
    pull.zone = null;
    pull.rate = 0;
    ui.hidePull();
  }

  if (!winding) {
    world.setWinderActive(false);
    audio.setWinding(false);
    if (hold.type === 'winder') resetHold();
  } else {
    world.setWinderActive(true);
    audio.setWinding(true);
  }
  if (inter && inter.type !== 'winder' && hold.type === 'winder') resetHold();
  if (inter && inter.type !== 'sell' && hold.type === 'sell') resetHold();
  if (inter && inter.type !== 'spinner' && hold.type === 'repair') resetHold();

  if (state.buffer.units < state.stats.bufferCap - 1) fullWarned = false;
  audio.setPull(pull.active, pull.tension);
}

function openGuestShop() {
  if (!isCoop() || state.mode !== 'playing' || session.shopOpen) return;
  if (session.localPaused) return;
  if (state.phase !== 'day') {
    ui.toast('Der Katalog ist nur tagsüber geöffnet.', 'warn', 3600);
    return;
  }
  session.shopOpen = true;
  lastShopSig = '';
  resetKeys();
  stopPull();
  ui.hidePull();
  clearPrompt();
  audio.uiOpen();
  ui.openShop(state);
  if (document.pointerLockElement) document.exitPointerLock();
}

function closeGuestShop(relock = true) {
  if (!session.shopOpen) return;
  session.shopOpen = false;
  ui.closeShop();
  audio.uiClose();
  if (relock) lockPointer();
}

function clearCoopOverlays() {
  if (session.shopOpen) closeGuestShop(false);
  if (session.localPaused) {
    session.localPaused = false;
    ui.hidePause();
  }
}



/* ============================================================ */
/* Phases                                                       */
/* ============================================================ */
function tickPhase(dt) {
  if (state.phase === 'day') {
    state.phaseTimeLeft -= dt;
    if (state.phaseTimeLeft <= 0) startDusk();
  } else if (state.phase === 'dusk') {
    state.phaseTimeLeft -= dt;
    if (state.phaseTimeLeft <= 0) startNight();
  } else if (state.phase === 'night') {
    state.phaseTimeLeft -= dt;
    if (state.phaseTimeLeft <= 0) endNight();
  }
}

function startDusk() {
  state.phase = 'dusk';
  state.phaseTimeLeft = DUSK_LENGTH + state.stats.alarmExtra;
  state.scare = false;
  state.scareTime = 0;
  state.nightMod = pickNightMod(state.day, state.stage, state.lastNightMod);
  state.lastNightMod = state.nightMod;
  world.setPhase('dusk');
  audio.setPhase('dusk');
  audio.siren();
  ui.setNight(true);
  ui.showNightBanner('SONNENUNTERGANG · AB IN DEN SAFE ROOM');
  ui.setDanger(true, 'SIE WACHT AUF');
  ui.toast('Die Sonne geht unter. Bring dich in den Safe Room!', 'danger', 6000);
  if (state.nightMod) {
    const mod = NIGHT_MODS[state.nightMod];
    setTimeout(() => {
      if (state.phase === 'dusk' || state.phase === 'night') {
        ui.toast(`Nachtlage: ${mod.name} – ${mod.effect}`, 'warn', 7600);
        audio.nightMod();
      }
    }, 2600);
  }
  player.addShake(0.08, 0.5);
}

function startNight() {
  state.phase = 'night';
  state.phaseTimeLeft = nightLength(state.stage);
  state.scare = false;
  state.scareTime = 0;
  state.doorClosed = state.doorClosed && !state.doorBroken;
  doorBangTimer = 0;
  doorHalfWarned = false;
  doorLowWarned = false;
  world.setPhase('night');
  const mod = state.nightMod ? NIGHT_MODS[state.nightMod] : null;
  const tuning = nightTuning(state.nightMod);
  if (state.nightMod === 'storm') {
    world.lightTargets.fog = 0.048;
    world.lightTargets.lamp = 1.2;
    stormTimer = 3;
  }
  if (state.nightMod === 'blackout') {
    world.lightTargets.fog = 0.042;
    world.lightTargets.lamp = 0.15;
    world.lightTargets.emerg = 0;
    world.lightTargets.safe = 5;
    blackoutTimer = 8;
    setTimeout(() => {
      if (state.phase === 'night' && state.nightMod === 'blackout') {
        ui.toast('Stromausfall: F schaltet die Taschenlampe. Ohne sie siehst du fast nichts.', 'warn', 6600);
        audio.creakLong();
      }
    }, 3200);
  }
  if (state.nightMod === 'blood') document.body.classList.add('night-blood');
  audio.setPhase('night');
  ui.setNight(true);
  ui.setDanger(true, 'SIE JAGT DICH');
  ui.showNightBanner(mod ? `${mod.name} · SIE IST WACH` : 'DIE PUPPE IST WACH');
  if (mod) ui.toast(mod.desc, 'danger', 7000);
  doll.resetToHome();
  if (state.upgrades.auto > 0 && !state.machineSabotaged && Math.random() < tuning.sabotageChance) {
    state.machineSabotaged = true;
    audio.sabotage();
    ui.toast('Der Automatik-Spinner wurde sabotiert. Reparatur am Gerät möglich.', 'danger', 6200);
  }
  lastSpinner = '';
  syncSpinner(true);
  if (state.doorClosed) {
    ui.toast('Die Tür ist zu. Sie weiß trotzdem, dass du da bist.', 'warn', 4800);
  } else {
    ui.toast('Die Tür steht offen. Das war keine gute Idee.', 'danger', 5200);
  }
  player.addShake(0.14, 0.8);
}

function endNight() {
  if (state.mode !== 'playing' && state.mode !== 'caught') return;
  clearCoopOverlays();
  const completed = state.day;
  const earned = state.dayEarned;
  const doorBroken = state.doorBroken;
  const doorPercent = doorBroken ? 0 : Math.max(0, Math.min(100, (state.doorHealth / state.stats.doorMax) * 100));

  state.mode = 'dawn';
  state.lastCompletedDay = completed;
  resetKeys();
  stopPull();
  audio.setPull(false, 0);
  audio.setWinding(false);
  audio.setMachine(false);
  if (document.pointerLockElement) document.exitPointerLock();

  state.doorClosed = true;
  state.doorBroken = false;
  state.doorHealth = state.stats.doorMax;
  state.machineSabotaged = false;
  state.scare = false;
  state.scareTime = 0;
  state.nightMod = null;
  document.body.classList.remove('night-blood');
  state.order = null;
  state.pickups = [];
  for (let i = 0; i < world.pickups.length; i++) world.setPickupVisible(i, false);
  for (const z of WORLD.zones) {
    const rem = state.zoneRemaining[z.id] ?? z.cap;
    state.zoneRemaining[z.id] = Math.min(z.cap, rem + z.cap * 0.45);
    doll.setZoneFraction(z.id, state.zoneRemaining[z.id] / z.cap);
  }
  state.zoneWarned = {};
  state.day = completed + 1;
  state.dayEarned = 0;
  doll.resetToHome();
  doll.setStage(stageFor(state.escalation));
  world.setDoorVisual(true, false);
  world.setLadderVisible(state.stats.ladder);
  world.setPhase('dusk');
  lastSpinner = '';
  syncSpinner(true);
  audio.setPhase('day');
  audio.dawn();
  ui.setNight(false);
  ui.setDanger(false);
  ui.hideNightBanner();
  ui.hidePull();
  ui.hidePrompt();
  ui.hideCaught();

  const flavors = [
    'Die Puppe sitzt wieder auf ihrem Podest. Hat sie sich bewegt?',
    'Der Faden liegt noch warm in deinen Händen. Sie beobachtet dich.',
    'Du hast die Nacht überlebt. Sie hat jetzt mehr von dir gesehen.',
    'Die Tür hat gehalten. Diesmal. Die Puppe lernt schnell.',
    'Draußen wird es hell. Drinnen ist etwas aufgewacht, das nicht mehr schläft.'
  ];
  const flavor = flavors[Math.min(flavors.length - 1, state.stage - 1)];
  let tip;
  if (doorBroken) tip = 'Der Schlosser hat eine neue Tür eingebaut. Der Automatik-Spinner läuft wieder.';
  else if (state.upgrades.auto > 0) tip = 'Die Tür wurde repariert. Der Automatik-Spinner läuft wieder.';
  else tip = 'Die Tür wurde repariert. Der Faden in der Puppe wächst nach.';

  if (state.lore < LORE_FRAGMENTS.length) state.lore++;
  const loreText = state.lore > 0 ? LORE_FRAGMENTS[state.lore - 1] : '';

  const dawnData = {
    day: completed,
    earned,
    money: state.money,
    stage: state.stage,
    doorBroken,
    doorHealth: doorPercent,
    flavor,
    tip,
    lore: loreText
  };
  ui.showDawn(dawnData);
  sendToGuest({ t: 'ev', e: { kind: 'dawn', data: dawnData } });
  saveGame();
  syncUI();
}

function dawnContinue() {
  if (state.mode !== 'dawn') return;
  if (isGuest()) {
    ui.hideDawn();
    sendToHost({ t: 'act', kind: 'continue' });
    return;
  }
  ui.hideDawn();
  if (state.totalEarned >= GOAL && !state.endless) {
    state.mode = 'win';
    const winFlavors = [
      'Hinter dir schließt sich das Fabriktor. Aus der Dunkelheit hört du ein leises Knarren – als würde jemand den Kopf drehen.',
      'Das Ticket ist bezahlt. Du lässt die Puppe zurück. Sie sieht dir nach.',
      'Der letzte Faden hängt noch an deiner Schulter. Du lässt ihn nicht los.'
    ];
    const winData = {
      day: state.lastCompletedDay || state.day,
      totalEarned: state.totalEarned,
      stage: state.stage,
      spools: state.spoolsMade,
      flavor: winFlavors[(Math.random() * winFlavors.length) | 0]
    };
    ui.showWin(winData);
    sendToGuest({ t: 'ev', e: { kind: 'win', data: winData } });
    return;
  }
  beginDay(true);
  ui.toast(`Tag ${state.day}. Die Puppe ist wieder ruhig. Noch.`, '', 4600);
  lockPointer();
}

function endlessMode() {
  if (state.mode !== 'win') return;
  if (isGuest()) {
    ui.hideWin();
    sendToHost({ t: 'act', kind: 'endless' });
    return;
  }
  ui.hideWin();
  state.endless = true;
  beginDay(true);
  ui.toast('Kein Ticket. Nur die Nachtschicht. Für immer, wenn du willst.', 'warn', 5200);
  lockPointer();
}

/* ============================================================ */
/* Day scare                                                    */
/* ============================================================ */
function updateScare(dt) {
  if (state.phase !== 'day') return;
  if (state.scare) {
    state.scareTime -= dt;
    if (state.scareTime <= 0) endScare();
  } else {
    state.scareCooldown -= dt;
    if (state.scareCooldown <= 0 && state.stage >= 2) {
      const elapsed = DAY_LENGTH - state.phaseTimeLeft;
      if (elapsed > 24 && state.phaseTimeLeft > 20) startScare();
      else state.scareCooldown = 6;
    }
  }
}

function startScare() {
  state.scare = true;
  state.scareTime = 8 + state.stage * 1.6;
  ui.showNightBanner('SIE IST AUF GEWACHT');
  ui.setDanger(true, 'SIE IST WACH');
  ui.toast('Die Puppe hat sich bewegt. Sie ist wach!', 'danger', 5600);
  audio.siren();
  player.addShake(0.12, 0.7);
}

function endScare() {
  if (!state.scare) return;
  state.scare = false;
  state.scareTime = 0;
  state.scareCooldown = 55 + Math.random() * 30;
  if (state.phase === 'day') {
    doll.resetToHome();
    ui.setDanger(false);
    ui.toast('Sie hat die Augen wieder geschlossen. Für jetzt.', '', 4500);
  }
}

/* ============================================================ */
/* Economy                                                      */
/* ============================================================ */
function rollQuality(zone) {
  const w = zone.weights;
  const mul = state.stats.rareMul;
  const ww = w.white;
  const wr = w.red * mul;
  const wb = w.black * mul;
  const wg = w.gold * mul;
  const total = ww + wr + wb + wg;
  let r = Math.random() * total;
  if ((r -= ww) < 0) return 'white';
  if ((r -= wr) < 0) return 'red';
  if ((r -= wb) < 0) return 'black';
  return 'gold';
}

function gainYarn(zone, units) {
  const remaining = state.zoneRemaining[zone.id] || 0;
  if (remaining <= 0) return 0;
  const capLeft = state.stats.bufferCap - state.buffer.units;
  if (capLeft <= 0) return 0;
  const allowed = Math.min(units, remaining, capLeft);
  if (allowed <= 0) return 0;

  let n = Math.floor(allowed);
  if (Math.random() < allowed - n) n++;
  for (let i = 0; i < n; i++) {
    const q = rollQuality(zone);
    state.buffer.counts[q]++;
    state.buffer.value += QUALITY[q].value;
  }
  state.buffer.units += allowed;

  state.zoneRemaining[zone.id] = Math.max(0, remaining - allowed);
  doll.setZoneFraction(zone.id, state.zoneRemaining[zone.id] / zone.cap);
  if (state.zoneRemaining[zone.id] <= 0.5 && !state.zoneWarned[zone.id]) {
    state.zoneWarned[zone.id] = true;
    ui.toast(`${zone.name} ist leer. Sie hat nichts mehr übrig.`, 'warn', 4600);
  }

  state.escalation += allowed * 0.2 * zone.risk;
  updateStage();
  return allowed;
}

function autoGain(units) {
  const capLeft = state.stats.bufferCap - state.buffer.units;
  if (capLeft <= 0) return;
  const allowed = Math.min(units, capLeft);
  state.buffer.units += allowed;
  state.buffer.counts.white += allowed;
  state.buffer.value += allowed;
  state.escalation += allowed * 0.12;
  updateStage();
}

function johannPull(zoneId, units) {
  const zone = WORLD.zones.find(z => z.id === zoneId);
  if (!zone) return 0;
  const remaining = state.zoneRemaining[zoneId] || 0;
  if (remaining <= 0) return 0;
  const allowed = Math.min(units, remaining);
  let n = Math.floor(allowed);
  if (Math.random() < allowed - n) n++;
  let value = 0;
  for (let i = 0; i < n; i++) value += QUALITY[rollQuality(zone)].value;
  state.zoneRemaining[zoneId] = Math.max(0, remaining - allowed);
  doll.setZoneFraction(zoneId, state.zoneRemaining[zoneId] / zone.cap);
  if (state.zoneRemaining[zoneId] <= 0.5 && !state.zoneWarned[zoneId]) {
    state.zoneWarned[zoneId] = true;
    ui.toast(`Johann hat ${zone.name} leergezogen.`, 'warn', 4400);
  }
  state.escalation += allowed * 0.2 * zone.risk;
  updateStage();
  return value;
}

function addMoney(value) {
  if (!(value > 0)) return;
  state.money += value;
  state.totalEarned += value;
  state.dayEarned += value;
  ui.pulseMoney();
  if (!state.goalAnnounced && state.totalEarned >= GOAL) {
    state.goalAnnounced = true;
    ui.toast('Das Fluchtticket ist bezahlt. Überlebe bis zum Morgen!', 'gold', 6800);
    audio.dawn();
  }
}

function updateStage() {
  const st = stageFor(state.escalation);
  if (st === state.stage) return;
  const prev = state.stage;
  state.stage = st;
  doll.setStage(st);
  if (st > prev) {
    ui.toast(`Eskalation Stufe ${st}: ${STAGE_NAMES[st - 1]}`, 'danger', 6200);
    audio.creakLong();
    player.addShake(0.09, 0.6);
    if (st >= 4) world.lightsOut = 2.5;
  }
}

/* ============================================================ */
/* Kundenauftrag & Glücksknäuel                                */
/* ============================================================ */
function registerOrderSale(spools) {
  const order = state.order;
  if (!order || order.done) return;
  const res = applySaleToOrder(order, spools);
  if (res.completed) {
    const bonus = order.bonus;
    state.ordersDone++;
    addMoney(bonus);
    audio.coin();
    audio.dawn();
    ui.toast(`Auftrag erfüllt: ${order.client} zahlt ${formatMoney(bonus)} Bonus.`, 'gold', 6800);
  }
}

const PICKUP_SPOTS = [
  { x: 16.2, z: -20.2 },
  { x: -16.4, z: -15.4 },
  { x: 16.6, z: 2.2 },
  { x: -15.6, z: 7.2 },
  { x: 8.2, z: -20.2 },
  { x: 14.8, z: -6.4 },
  { x: -13.2, z: -6.2 },
  { x: 16.2, z: 16.8 }
];

function spotFree(x, z, r) {
  for (const c of staticColliders) {
    if (c.type === 'circle') {
      if (Math.hypot(x - c.x, z - c.z) < r + c.r) return false;
    } else {
      const nx = Math.max(c.minX, Math.min(x, c.maxX));
      const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
      if (Math.hypot(x - nx, z - nz) < r) return false;
    }
  }
  return true;
}

function spawnPickups(day) {
  const count = day >= 5 ? 2 : 1;
  const spots = PICKUP_SPOTS
    .filter((s) => spotFree(s.x, s.z, 1.15))
    .sort(() => Math.random() - 0.5)
    .slice(0, count);
  const out = [];
  for (const s of spots) {
    const roll = Math.random();
    let type, reward;
    if (day <= 1) {
      type = 'money';
      reward = 40 + Math.round(Math.random() * 20);
    } else if (roll < 0.55) {
      type = 'yarn';
      reward = Math.min(45, 18 + day * 2 + Math.round(Math.random() * 6));
    } else if (roll < 0.9) {
      type = 'money';
      reward = Math.min(170, 55 + day * 9 + Math.round(Math.random() * 20));
    } else {
      type = 'spool';
      reward = Math.min(320, 90 + day * 16 + Math.round(Math.random() * 30));
    }
    out.push({ x: s.x, z: s.z, type, reward, taken: false });
  }
  return out;
}

function restorePickups() {
  for (let i = 0; i < world.pickups.length; i++) {
    const p = state.pickups[i];
    world.setPickupVisible(i, !!p && !p.taken, p ? p.x : 0, p ? p.z : 0);
  }
}

let glintTimer = 0;
function updatePickupGlint(dt) {
  if (state.mode !== 'playing') return;
  glintTimer -= dt;
  if (glintTimer > 0) return;
  glintTimer = 0.75;
  let best = Infinity;
  for (const p of state.pickups) {
    if (!p || p.taken) continue;
    const d = Math.hypot(player.position.x - p.x, player.position.z - p.z);
    if (d < best) best = d;
  }
  if (best < 6) audio.glint(Math.max(0.012, 0.045 * (1 - best / 6)));
}

function collectPickup(index, who = player) {
  const p = state.pickups[index];
  if (!p || p.taken) return;
  p.taken = true;
  world.setPickupVisible(index, false, p.x, p.z);

  if (p.type === 'money') {
    addMoney(p.reward);
    ui.toast(`Glücksknäuel: + ${formatMoney(p.reward)} in der Kasse.`, 'gold', 4800);
  } else if (p.type === 'yarn') {
    const added = addYarnBundle(p.reward);
    if (added > 0.5) {
      ui.toast(`Glücksknäuel: ${Math.round(added)} Faden im Vorrat.`, 'gold', 4800);
    } else {
      addMoney(Math.round(p.reward * 1.4));
      ui.toast(`Vorrat voll – das Knäuel bringt ${formatMoney(Math.round(p.reward * 1.4))}.`, 'warn', 4800);
    }
  } else if (who.carrying.length < state.stats.carryCap) {
    who.carrying.push({
      value: Math.round(p.reward),
      counts: { white: Math.round(p.reward), red: 0, black: 0, gold: 0 }
    });
    if (who === player) player.updateCarryDisplay();
    ui.pulseCarry();
    ui.toast(`Glücksknäuel: Spule im Wert von ${formatMoney(Math.round(p.reward))}.`, 'gold', 4800);
  } else {
    addMoney(Math.round(p.reward * 0.75));
    ui.toast(`Hände voll – das Knäuel bringt ${formatMoney(Math.round(p.reward * 0.75))}.`, 'warn', 4800);
  }

  audio.pickup();
  syncUI();
}

function addYarnBundle(units) {
  const capLeft = state.stats.bufferCap - state.buffer.units;
  if (capLeft <= 0.5) return 0;
  const allowed = Math.min(units, capLeft);
  let n = Math.floor(allowed);
  if (Math.random() < allowed - n) n++;
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    let q = 'white';
    if (r > 0.96) q = 'gold';
    else if (r > 0.82) q = 'black';
    else if (r > 0.5) q = 'red';
    state.buffer.counts[q]++;
    state.buffer.value += QUALITY[q].value;
  }
  state.buffer.units += allowed;
  const overflow = units - allowed;
  if (overflow >= 1) addMoney(Math.round(overflow * 1.4));
  return allowed;
}

/* ============================================================ */
/* Interactions                                                 */
/* ============================================================ */
const pull = { active: false, zone: null, tension: 0, rate: 0, snapLock: 0 };
const hold = { type: '', progress: 0 };
let promptVisible = false;
let fullWarned = false;
let firstSnapShown = false;
let introHintsScheduled = false;

function stopPull() {
  if (isGuest() && pull.guestSent) {
    pull.guestSent = false;
    sendToHost({ t: 'act', kind: 'pull-stop' });
  }
  pull.active = false;
  pull.zone = null;
  pull.rate = 0;
  pull.snapLock = 0;
  pullRibbon.visible = false;
}

function findInteraction() {
  const px = player.position.x, pz = player.position.z;
  const list = [];

  const add = (type, dist, extra) => list.push({ type, dist, ...extra });
  const dTo = (x, z) => Math.hypot(px - x, pz - z);

  for (const z of WORLD.zones) {
    if ((state.zoneRemaining[z.id] || 0) <= 0.5) continue;
    const d = Math.hypot(px - z.pos.x, pz - z.pos.z);
    if (d < z.radius + 1.25) {
      add('zone', d, { zone: z, locked: z.requiresLadder && !state.stats.ladder });
    }
  }

  for (let i = 0; i < state.pickups.length; i++) {
    const p = state.pickups[i];
    if (!p || p.taken) continue;
    const d = Math.hypot(px - p.x, pz - p.z);
    if (d < 2.1) add('pickup', d, { pickupIndex: i });
  }

  const doorD = dTo(-14.75, 12);
  if (doorD < 2.9) add('door', doorD);
  const winderD = dTo(WORLD.winder.x, WORLD.winder.z);
  if (winderD < 2.6) add('winder', winderD);
  const sellD = dTo(WORLD.sell.x, WORLD.sell.z);
  if (sellD < 2.7) add('sell', sellD);
  const shopD = dTo(WORLD.shop.x, WORLD.shop.z);
  if (shopD < 2.5) add('shop', shopD);
  const spinnerD = dTo(WORLD.spinner.x, WORLD.spinner.z);
  if (spinnerD < 3.0) add('spinner', spinnerD);

  if (!list.length) return null;
  list.sort((a, b) => a.dist - b.dist);
  return list[0];
}

function setPrompt({ key = 'E', text, sub = '', progress = null }) {
  ui.showPrompt({ key, text, sub, progress });
  promptVisible = true;
}

function clearPrompt() {
  if (promptVisible) {
    ui.hidePrompt();
    promptVisible = false;
  }
}

function handleHold(dt, type, speed) {
  if (hold.type !== type) {
    hold.type = type;
    hold.progress = 0;
  }
  if (keys.e) hold.progress += dt * speed;
  else hold.progress = 0;
  return Math.min(1, hold.progress);
}

function resetHold() {
  hold.type = '';
  hold.progress = 0;
}

function updateInteractions(dt) {
  if (pull.snapLock > 0) pull.snapLock -= dt;

  const inter = findInteraction();
  let zonePulling = false;
  let winding = false;

  if (inter) {
    switch (inter.type) {
      case 'zone': {
        const z = inter.zone;
        if (inter.locked) {
          setPrompt({ text: 'Kopf-Zone gesperrt', sub: 'Leiter im Katalog kaufen' });
        } else if (state.buffer.units >= state.stats.bufferCap - 0.01) {
          setPrompt({ text: 'Fadenvorrat voll', sub: 'Zum Wickler gehen' });
          if (!fullWarned) {
            fullWarned = true;
            ui.toast('Der Fadenvorrat ist voll. Wickle ihn am Wickler auf.', 'warn', 4800);
          }
        } else if (keys.e && pull.snapLock <= 0) {
          zonePulling = true;
          pull.active = true;
          pull.zone = z;
          pull.rate = PULL_BASE_RATE * z.rate * state.stats.pullMul;

          pull.tension += dt * 27 * z.risk * state.stats.tensionMul;
          if (pull.tension >= 100) {
            snapYarn();
          } else {
            gainYarn(z, pull.rate * dt);
            ui.showPull(z.name, pull.tension, pull.rate);
          }
          clearPrompt();
        } else {
          pull.tension = Math.max(0, pull.tension - 42 * dt);
          setPrompt({
            text: `Faden ziehen · ${z.name}`,
            sub: 'E halten · loslassen senkt die Spannung'
          });
        }
        break;
      }
      case 'pickup': {
        pull.tension = Math.max(0, pull.tension - 42 * dt);
        const p = state.pickups[inter.pickupIndex];
        const flavor = p && p.type === 'spool'
          ? 'Eine fertige Spule. Wer hat sie verloren?'
          : p && p.type === 'money'
            ? 'Ein kleiner Fund zwischen den Maschinen.'
            : 'Faden, der nicht von ihr stammt.';
        setPrompt({ text: 'Glücksknäuel einsammeln', sub: flavor });
        if (pressE) collectPickup(inter.pickupIndex);
        break;
      }
      case 'door': {
        pull.tension = Math.max(0, pull.tension - 42 * dt);
        if (state.doorBroken) {
          setPrompt({ text: 'Tür ist zerstört', sub: 'Bis zum Morgen bleibt sie offen' });
        } else {
          setPrompt({
            text: state.doorClosed ? 'Tür öffnen' : 'Tür schließen',
            sub: state.doorClosed ? 'Der Safe Room ist verriegelt' : 'Nur geschlossen schützt sie'
          });
          if (pressE) toggleDoor();
        }
        break;
      }
      case 'winder': {
        pull.tension = Math.max(0, pull.tension - 42 * dt);
        if (state.buffer.units < 20) {
          setPrompt({ text: 'Zu wenig Faden', sub: 'Mindestens 20 Einheiten sammeln' });
        } else if (state.carried.length >= state.stats.carryCap) {
          setPrompt({ text: 'Hände voll', sub: 'Erst die Spulen verkaufen' });
        } else {
          const p = handleHold(dt, 'winder', 1 / 1.75 * state.stats.windSpeed);
          setPrompt({
            text: 'Spule aufwickeln',
            sub: 'E halten',
            progress: p
          });
          winding = true;
          if (p >= 1) {
            finishWinding();
            winding = false;
          }
        }
        break;
      }
      case 'sell': {
        pull.tension = Math.max(0, pull.tension - 42 * dt);
        if (state.carried.length === 0) {
          setPrompt({ text: 'Keine Spulen dabei', sub: 'Erst am Wickler eine Spule machen' });
        } else {
          const p = handleHold(dt, 'sell', 1 / 0.9);
          const total = state.carried.reduce((s, x) => s + x.value, 0);
          setPrompt({
            text: `Spulen verkaufen · ${formatMoney(total)}`,
            sub: 'E halten',
            progress: p
          });
          if (p >= 1) sellAll();
        }
        break;
      }
      case 'shop': {
        pull.tension = Math.max(0, pull.tension - 42 * dt);
        setPrompt({ text: 'Fabrik-Katalog öffnen', sub: 'Nur tagsüber verfügbar' });
        if (pressE) openShop();
        break;
      }
      case 'spinner': {
        pull.tension = Math.max(0, pull.tension - 42 * dt);
        if (state.upgrades.auto === 0) {
          setPrompt({ text: 'Automatik-Spinner nicht installiert', sub: 'Im Katalog kaufen' });
        } else if (state.machineSabotaged) {
          const p = handleHold(dt, 'repair', 1 / 2.2);
          setPrompt({ text: 'Maschine reparieren', sub: 'E halten', progress: p });
          if (p >= 1) repairSpinner();
        } else {
          const running = state.phase === 'day' && !state.scare;
          setPrompt({
            text: running ? 'Spinner läuft' : 'Spinner steht',
            sub: running ? 'Lärm zieht ihre Aufmerksamkeit an' : 'Erst am nächsten Tag wieder aktiv'
          });
        }
        break;
      }
      default: break;
    }
    if (inter.type !== 'winder') winding = false;
  } else {
    clearPrompt();
    pull.tension = Math.max(0, pull.tension - 42 * dt);
  }

  if (!zonePulling) {
    pull.active = false;
    pull.zone = null;
    pull.rate = 0;
    ui.hidePull();
  }
  if (!winding) {
    world.setWinderActive(false);
    audio.setWinding(false);
    if (hold.type === 'winder') resetHold();
  } else {
    world.setWinderActive(true);
    audio.setWinding(true);
  }
  if (inter && inter.type !== 'winder' && hold.type === 'winder') resetHold();
  if (inter && inter.type !== 'sell' && hold.type === 'sell') resetHold();
  if (inter && inter.type !== 'spinner' && hold.type === 'repair') resetHold();

  if (state.buffer.units < state.stats.bufferCap - 1) fullWarned = false;
  audio.setPull(pull.active, pull.tension);
}

function snapYarn() {
  const loss = state.stats.snapLoss;
  state.buffer.units *= (1 - loss);
  state.buffer.value *= (1 - loss);
  for (const k of ['white', 'red', 'black', 'gold']) state.buffer.counts[k] *= (1 - loss);
  pull.tension = 0;
  pull.snapLock = 0.8;
  pull.active = false;
  audio.snap();
  player.addShake(0.22, 0.7);
  ui.flashDamage();
  ui.hidePull();
  const hint = firstSnapShown ? '' : ' Tipp: Früher loslassen, bevor der Balken rot wird.';
  firstSnapShown = true;
  ui.toast(`Der Faden reißt! ${Math.round(loss * 100)} % des Vorrats verloren.${hint}`, 'danger', 5600);
}

function finishWinding() {
  const value = Math.max(1, Math.round(state.buffer.value));
  state.carried.push({ value, counts: { ...state.buffer.counts } });
  state.spoolsMade++;
  state.buffer = { units: 0, value: 0, counts: { white: 0, red: 0, black: 0, gold: 0 } };
  player.updateCarryDisplay();
  resetHold();
  audio.windDone();
  ui.pulseCarry();
  ui.toast(`Spule fertig: ${formatMoney(value)}`, '', 4200);
}

function sellAll() {
  if (!state.carried.length) return;
  const spools = state.carried.slice();
  const total = spools.reduce((s, x) => s + x.value, 0);
  const payout = Math.round(total * state.stats.sellMul);
  const count = spools.length;
  state.carried.length = 0;
  player.updateCarryDisplay();
  addMoney(payout);
  registerOrderSale(spools);
  resetHold();
  audio.sale();
  audio.coin();
  const haggled = payout > total ? ` (verhandelt, +${Math.round((state.stats.sellMul - 1) * 100)} %)` : '';
  ui.toast(`${count} Spule${count > 1 ? 'n' : ''} verkauft: + ${formatMoney(payout)}${haggled}`, 'gold', 4800);
}

function toggleDoor() {
  if (state.doorBroken) {
    ui.toast('Die Tür ist zerstört. Sie lässt sich nicht mehr schließen.', 'danger', 3800);
    return;
  }
  state.doorClosed = !state.doorClosed;
  world.setDoorVisual(state.doorClosed, false);
  if (state.doorClosed) audio.click();
  else audio.creak();
  syncUI();
}

function openShop() {
  if (isCoop()) { openGuestShop(); return; }
  if (state.mode !== 'playing') return;
  if (state.phase !== 'day') {
    ui.toast('Der Katalog ist nur tagsüber geöffnet.', 'warn', 3600);
    return;
  }
  state.mode = 'shop';
  resetKeys();
  stopPull();
  ui.hidePull();
  clearPrompt();
  audio.uiOpen();
  ui.openShop(state);
  if (document.pointerLockElement) document.exitPointerLock();
}

function closeShop() {
  if (session.shopOpen) { closeGuestShop(); return; }
  if (state.mode !== 'shop') return;
  ui.closeShop();
  state.mode = 'playing';
  audio.uiClose();
  lockPointer();
}

function toggleShop() {
  if (isCoop()) {
    if (session.shopOpen) closeGuestShop();
    else openGuestShop();
    return;
  }
  if (state.mode === 'shop') closeShop();
  else if (state.mode === 'playing') openShop();
}

function buyUpgrade(id, external = false) {
  if (isGuest() && !external) {
    if (session.shopOpen) sendToHost({ t: 'act', kind: 'buy', id });
    return;
  }
  if (!external && state.mode !== 'shop' && !session.shopOpen) return;
  if (external && state.phase !== 'day') return;
  const def = UPGRADES[id];
  if (!def) return;
  const lvl = state.upgrades[id] || 0;
  if (lvl >= def.max) return;
  if (def.requires && state.upgrades[def.requires] === 0) return;
  const cost = def.costs[Math.min(lvl, def.costs.length - 1)];
  if (state.money < cost) {
    audio.click();
    return;
  }
  state.money -= cost;
  state.upgrades[id] = lvl + 1;
  state.stats = getStats(state.upgrades);

  if (id === 'door') state.doorHealth = state.stats.doorMax;
  if (id === 'ladder') world.setLadderVisible(true);
  if (id === 'auto') {
    lastSpinner = '';
    syncSpinner(true);
  }
  if (id === 'cart') player.updateCarryDisplay();

  audio.coin();
  ui.toast(`${def.name} gekauft · Stufe ${state.upgrades[id]}`, 'gold', 4000);
  ui.renderShop(state);
  syncUI();
}

function repairSpinner() {
  state.machineSabotaged = false;
  resetHold();
  audio.machineStart();
  lastSpinner = '';
  syncSpinner(true);
  ui.toast('Der Automatik-Spinner läuft wieder.', '', 4200);
}

function toggleFlashlight() {
  if (state.mode !== 'playing') return;
  player.setFlashlight(!player.flashlightOn);
  audio.click();
}

function toggleSound() {
  settings.muted = !settings.muted;
  audio.setMuted(settings.muted);
  ui.setSoundLabel(!settings.muted);
  saveSettings();
  if (!settings.muted) audio.click();
}

/* ============================================================ */
/* Pause                                                        */
/* ============================================================ */
function pauseGame() {
  if (isCoop()) {
    if (!session.started || session.localPaused || session.shopOpen) return;
    if (state.mode !== 'playing') return;
    session.localPaused = true;
    resetKeys();
    stopPull();
    ui.hidePull();
    clearPrompt();
    audio.setPull(false, 0);
    audio.setWinding(false);
    audio.setMachine(false);
    ui.showPause(settings.sens, settings.vol, true);
    baseToast('Im Koop läuft die Schicht weiter – die Puppe auch.', 'warn', 4200);
    if (document.pointerLockElement) document.exitPointerLock();
    return;
  }
  if (state.mode !== 'playing') return;
  state.mode = 'paused';
  resetKeys();
  stopPull();
  ui.hidePull();
  clearPrompt();
  audio.setPull(false, 0);
  audio.setWinding(false);
  audio.setMachine(false);
  ui.showPause(settings.sens, settings.vol);
  if (document.pointerLockElement) document.exitPointerLock();
}

function resumeGame() {
  if (isCoop()) {
    if (!session.localPaused) return;
    session.localPaused = false;
    ui.hidePause();
    audio.uiClose();
    lockPointer();
    return;
  }
  if (state.mode !== 'paused') return;
  ui.hidePause();
  state.mode = 'playing';
  audio.uiClose();
  lockPointer();
}

/* ============================================================ */
/* Auto spinner / stage display                                 */
/* ============================================================ */
let lastSpinner = '';

function syncSpinner(running) {
  const owned = state.upgrades.auto > 0;
  const sig = `${owned}|${running}|${state.machineSabotaged}`;
  if (sig !== lastSpinner) {
    lastSpinner = sig;
    world.setSpinnerState(owned, running, state.machineSabotaged);
    audio.setMachine(owned && running && !state.machineSabotaged);
  }
}

function updateAuto(dt) {
  const running = state.upgrades.auto > 0
    && state.phase === 'day'
    && !state.scare
    && !state.machineSabotaged;
  if (running) autoGain(state.stats.autoRate * dt);
  syncSpinner(running);
}

/* ============================================================ */
/* Doll, Johann and danger                                      */
/* ============================================================ */
function insideSafeArea(pos) {
  return pos.x >= WORLD.safe.minX - 0.1
    && pos.x <= WORLD.safe.maxX + 0.1
    && pos.z >= WORLD.safe.minZ + 0.05
    && pos.z <= WORLD.safe.maxZ + 0.1;
}

function isProtected(pos) {
  return insideSafeArea(pos)
    && state.doorClosed
    && !state.doorBroken
    && !insideSafeArea(doll.position);
}

function updateDoll(dt) {
  const tune = state.phase === 'night' ? nightTuning(state.nightMod) : null;
  const players = [{
    pos: player.position,
    safe: isProtected(player.position)
  }];
  if (remote.active) {
    players.push({
      pos: remote.position,
      safe: isProtected(remote.position)
    });
  }
  if (johann.active) {
    players.push({
      pos: johann.position,
      safe: isProtected(johann.position)
    });
  }

  let nearest = null;
  let nearestD = Infinity;
  for (const p of players) {
    const d = doll.position.distanceToSquared(p.pos);
    if (d < nearestD) { nearestD = d; nearest = p; }
  }

  doll.update(dt, {
    night: state.phase === 'night',
    scare: state.scare || state.phase === 'dusk',
    stage: state.stage,
    players,
    colliders: dollColliders,
    bounds: WORLD.bounds,
    doorClosed: state.doorClosed,
    doorBroken: state.doorBroken,
    floodLevel: state.stats.dollSlow,
    nightSpeedMul: tune ? tune.dollSpeed : 1,
    playerPos: player.position,
    nearestPlayer: nearest,
    onStep: (dist) => audio.dollStep(dist),
    onCreak: () => audio.creak()
  });
}

function johannContext() {
  return {
    state,
    zones: WORLD.zones.map(z => ({
      id: z.id,
      pos: z.pos,
      locked: z.requiresLadder && !state.stats.ladder
    })),
    remaining: state.zoneRemaining,
    colliders: activeColliders(),
    doorClosed: state.doorClosed,
    doorBroken: state.doorBroken,
    playerInside: insideSafeArea(player.position),
    insideSafe: insideSafeArea(johann.position),
    openDoor: () => {
      if (state.doorClosed && !state.doorBroken) {
        state.doorClosed = false;
        world.setDoorVisual(false, false);
        audio.creak();
      }
    },
    closeDoor: () => {
      if (!state.doorClosed && !state.doorBroken) {
        state.doorClosed = true;
        world.setDoorVisual(true, false);
        audio.click();
      }
    },
    isInsideSafe: (pos) => insideSafeArea(pos),
    onJohannPull: (id, units) => johannPull(id, units),
    onJohannWind: () => {},
    onJohannSell: (value) => {
      if (value > 0) {
        const payout = Math.round(value * state.stats.sellMul);
        addMoney(payout);
        state.spoolsMade++;
        registerOrderSale([{ value, counts: null }]);
        audio.sale();
        ui.toast(`Johann verkauft eine Spule: + ${formatMoney(payout)}`, 'gold', 4400);
      }
    },
    onLine: (text) => ui.toast(text, '', 4200)
  };
}

function updateDollAndJohann(dt) {
  updateDoll(dt);
  if (johann.active) johann.update(dt, johannContext());
}

function updateDoorCombat(dt) {
  if (state.phase !== 'night' || !state.doorClosed || state.doorBroken) {
    doorBangTimer = 0;
    return;
  }
  const everyoneSafe = isProtected(player.position)
    && (!remote.active || isProtected(remote.position))
    && (!johann.active || isProtected(johann.position));
  if (!everyoneSafe) return;
  const dx = doll.position.x - (-14.75);
  const dz = doll.position.z - 10.15;
  const dist = Math.hypot(dx, dz);
  if (dist > 3.9) return;

  const tune = nightTuning(state.nightMod);
  doorBangTimer -= dt;
  if (doorBangTimer <= 0) {
    doorBangTimer = (1.0 + Math.random() * 0.9) * tune.bangInterval;
    audio.bang();
    player.addShake(0.05, 0.3);
  }

  if (state.stage >= 4) {
    state.doorHealth -= (state.stage - 3) * 6 * dt * tune.doorDamage;
    if (state.doorHealth <= state.stats.doorMax * 0.5 && !doorHalfWarned) {
      doorHalfWarned = true;
      ui.toast('Die Tür bekommt Risse. Sie kommt durch.', 'danger', 5200);
    }
    if (state.doorHealth <= state.stats.doorMax * 0.2 && !doorLowWarned) {
      doorLowWarned = true;
      ui.toast('Die Tür hält nicht mehr lange!', 'danger', 5200);
    }
    if (state.doorHealth <= 0) breakDoor();
  }
}

let doorBangTimer = 0;
let doorHalfWarned = false;
let doorLowWarned = false;
let stormTimer = 0;
let blackoutTimer = 0;

function breakDoor() {
  state.doorBroken = true;
  state.doorClosed = false;
  state.doorHealth = 0;
  world.setDoorVisual(false, true);
  audio.doorBreak();
  ui.toast('Die Sicherheitstür ist aufgebrochen!', 'danger', 6400);
  player.addShake(0.28, 0.9);
}

function checkCatch() {
  if (player.invulnerable > 0) return;
  if (state.phase !== 'night' && state.phase !== 'dusk' && !state.scare) return;
  if (isProtected(player.position)) return;
  const dx = player.position.x - doll.position.x;
  const dz = player.position.z - doll.position.z;
  if (Math.hypot(dx, dz) > 3.0) return;
  catchPlayer();
}

function catchPlayer() {
  const penalty = Math.floor(state.money * 0.2);
  const lostSpools = state.carried.length;
  state.money = Math.max(0, state.money - penalty);
  state.carried.length = 0;
  player.updateCarryDisplay();
  state.mode = 'caught';
  state.catchTimer = 1.8;
  resetKeys();
  stopPull();
  ui.hidePull();
  clearPrompt();

  const sub = penalty > 0 || lostSpools > 0
    ? `− ${formatMoney(penalty)} und ${lostSpools} Spule${lostSpools === 1 ? '' : 'n'} verloren.`
    : 'Sie hat dich gefunden.';
  ui.showCaught(sub, 2400);
  audio.jumpscare();
  player.addShake(0.38, 1.2);
  if (isHost() && remote.active) {
    sendToGuest({ t: 'ev', e: { kind: 'toast', text: 'Spieler 1 wurde erwischt.', type: 'danger', duration: 4200 } });
  }

  player.reset(new THREE.Vector3(-14.2, 0, 18.2));
  player.yaw = 0;
  player.pitch = 0;
  player.invulnerable = 7;
  if (!state.doorBroken) {
    state.doorClosed = true;
    world.setDoorVisual(true, false);
  }
  doll.resetToHome();
  syncUI();
}

function checkRemoteCatch() {
  if (!isHost() || !remote.active) return;
  if (remote.invulnerable > 0) return;
  if (state.phase !== 'night' && state.phase !== 'dusk' && !state.scare) return;
  if (isProtected(remote.position)) return;
  const dx = remote.position.x - doll.position.x;
  const dz = remote.position.z - doll.position.z;
  if (Math.hypot(dx, dz) > 3.0) return;
  catchRemotePlayer();
}

function catchRemotePlayer() {
  const penalty = Math.floor(state.money * 0.2);
  const lostSpools = remote.carrying.length;
  state.money = Math.max(0, state.money - penalty);
  remote.carrying.length = 0;
  remote.pulling = false;
  remote.pullZone = null;
  remote.position.set(-14.2, 0, 18.2);
  remote.yaw = 0;
  remote.pitch = 0;
  remote.invulnerable = 7;

  const sub = penalty > 0 || lostSpools > 0
    ? `Spieler 2 verliert ${formatMoney(penalty)} und ${lostSpools} Spule${lostSpools === 1 ? '' : 'n'}.`
    : 'Sie hat Spieler 2 gefunden.';
  ui.showCaught(sub, 2400);
  audio.jumpscare();
  player.addShake(0.22, 0.8);
  sendToGuest({ t: 'ev', e: { kind: 'caught', sub } });
  if (!state.doorBroken) {
    state.doorClosed = true;
    world.setDoorVisual(true, false);
  }
  doll.resetToHome();
  syncUI();
}

/* ============================================================ */
/* Frame update                                                 */
/* ============================================================ */
const ZERO_INPUT = { forward: false, back: false, left: false, right: false, sprint: false };
let uiTimer = 0;

function updateGame(dt) {
  if (state.mode === 'caught') {
    state.catchTimer -= dt;
    if (state.catchTimer <= 0) state.mode = 'playing';
  }
  const active = state.mode === 'playing' && !session.localPaused && !session.shopOpen;

  tickPhase(dt);

  if (isHost() && session.started && session.peerConnected) {
    snapshotTimer -= dt;
    if (snapshotTimer <= 0) {
      snapshotTimer = 0.066;
      sendToGuest({ t: 'snap', s: buildSnapshot() });
    }
  }

  if (state.mode === 'dawn' || state.mode === 'win') return;

  if (remote.active) updateRemoteSim(dt);
  updateScare(dt);

  player.update(dt, active ? input : ZERO_INPUT, state, activeColliders(), (sprint) => {
    if (active) audio.footstep(sprint);
  });
  state.playerStamina = player.stamina;

  if (active) {
    updateInteractions(dt);
  } else {
    clearPrompt();
    ui.hidePull();
    audio.setPull(false, 0);
    world.setWinderActive(false);
    audio.setWinding(false);
  }

  updateAuto(dt);
  updateDollAndJohann(dt);
  updateDoorCombat(dt);
  if (state.mode === 'playing') {
    if (!session.localPaused) checkCatch();
    checkRemoteCatch();
  }

  if (state.phase === 'night' && state.nightMod === 'storm') {
    stormTimer -= dt;
    if (stormTimer <= 0) {
      stormTimer = 5 + Math.random() * 6;
      world.lightsOut = 0.32;
      audio.creak();
    }
  }
  if (state.phase === 'night' && state.nightMod === 'blackout') {
    blackoutTimer -= dt;
    if (blackoutTimer <= 0) {
      blackoutTimer = 11 + Math.random() * 8;
      world.lightsOut = 0.18;
      audio.creakLong();
    }
  }
  updatePickupGlint(dt);

  // flashlight
  const tune = state.phase === 'night' ? nightTuning(state.nightMod) : null;
  const flTarget = player.flashlightOn ? (tune ? tune.flashlight : 16) : 0;
  player.flashlight.intensity += (flTarget - player.flashlight.intensity) * Math.min(1, dt * 7);

  state.insideSafe = isProtected(player.position);
  world.update(dt, {
    doll,
    player,
    johann,
    door: { closed: state.doorClosed, broken: state.doorBroken },
    upgrades: state.upgrades,
    day: state.day
  });
  updatePullRibbon(pull.tension, performance.now() * 0.001);
  audio.update(dt, {
    phase: state.phase,
    scare: state.scare || state.phase === 'dusk',
    insideSafe: state.insideSafe,
    dollDist: Math.hypot(player.position.x - doll.position.x, player.position.z - doll.position.z)
  });

  ui.setAimHint(!pointerLocked && state.mode !== 'caught');
  uiTimer += dt;
  if (uiTimer >= 0.1) {
    uiTimer = 0;
    syncUI();
  }
  pressE = false;
}

function syncUI() {
  state.insideSafe = isProtected(player.position);
  state.playerStamina = player.stamina;
  ui.update(state, { stage: state.stage, objective: computeObjective() });
  updatePartnerHud();
}

function updatePartnerHud() {
  if (!isCoop() || !session.started || !session.peerConnected) {
    ui.setPartner(null);
    return;
  }
  const pos = isHost() ? (remote.active ? remote.position : null) : (hostAvatar ? hostAvatar.position : null);
  if (!pos) {
    ui.setPartner(null);
    return;
  }
  const inside = pos.x < WORLD.safe.maxX && pos.z > WORLD.safe.minZ;
  ui.setPartner(isHost() ? 'SPIELER 2' : 'SPIELER 1', inside);
}

function metresTo(x, z) {
  return Math.max(0, Math.round(Math.hypot(player.position.x - x, player.position.z - z)));
}

function dirHint(x, z) {
  const dx = x - player.position.x;
  const dz = z - player.position.z;
  const fwdX = -Math.sin(player.yaw);
  const fwdZ = -Math.cos(player.yaw);
  const rightX = Math.cos(player.yaw);
  const rightZ = -Math.sin(player.yaw);
  const f = dx * fwdX + dz * fwdZ;
  const r = dx * rightX + dz * rightZ;
  const angle = Math.atan2(r, f) * (180 / Math.PI);
  if (Math.abs(angle) > 150) return 'hinter dir';
  if (Math.abs(angle) < 25) return 'geradeaus';
  return angle > 0 ? 'rechts' : 'links';
}

function nearestZone() {
  let best = null;
  let bestD = Infinity;
  for (const z of WORLD.zones) {
    if (z.requiresLadder && !state.stats.ladder) continue;
    if ((state.zoneRemaining[z.id] || 0) <= 0.5) continue;
    const d = Math.hypot(player.position.x - z.pos.x, player.position.z - z.pos.z);
    if (d < bestD) { bestD = d; best = z; }
  }
  return best;
}

function computeObjective() {
  const ticket = Math.min(1, state.totalEarned / GOAL);

  if (state.phase === 'night') {
    const inside = player.position.x < WORLD.safe.maxX && player.position.z > WORLD.safe.minZ;
    const progress = 1 - Math.max(0, state.phaseTimeLeft) / nightLength(state.stage);
    if (state.doorBroken) {
      return { key: 'night-broken', step: 'NACHTWACHE', title: 'Überlebe bis zum Morgen', sub: 'Die Tür ist zerstört. Halte Abstand und bleib in Bewegung.', progress, danger: true };
    }
    if (!inside) {
      return { key: 'night-outside', step: 'NACHTWACHE', title: 'In den Safe Room', sub: `Tür ${dirHint(-14.75, 12)} · ${metresTo(-14.75, 12)} m`, progress, danger: true };
    }
    if (!state.doorClosed) {
      return { key: 'night-door', step: 'NACHTWACHE', title: 'Tür schließen', sub: 'Nur eine geschlossene Tür schützt dich.', progress, danger: true };
    }
    return { key: 'night-safe', step: 'NACHTWACHE', title: 'Durchhalten', sub: 'Bis zum Morgen. Sie ist draußen.', progress, danger: false };
  }

  if (state.phase === 'dusk') {
    return {
      key: 'dusk',
      step: 'NACHTWACHE',
      title: 'Safe Room aufsuchen',
      sub: `Tür ${dirHint(-14.75, 12)} · ${metresTo(-14.75, 12)} m. Hinter dir schließen.`,
      progress: 1 - Math.max(0, state.phaseTimeLeft) / (DUSK_LENGTH + state.stats.alarmExtra),
      danger: true
    };
  }

  const upgraded = UPGRADE_ORDER.some(id => state.upgrades[id] > 0);
  const tutorialDone = state.spoolsMade > 0 && state.totalEarned > 0;

  if (state.carried.length > 0) {
    return {
      key: 'sell',
      step: '3 / 4',
      title: 'Spule verkaufen',
      sub: `Verkaufsstation ${dirHint(WORLD.sell.x, WORLD.sell.z)} · ${metresTo(WORLD.sell.x, WORLD.sell.z)} m`,
      progress: ticket
    };
  }

  if (state.buffer.units >= state.stats.bufferCap - 0.5) {
    return {
      key: 'winder-full',
      step: '2 / 4',
      title: 'Spule aufwickeln',
      sub: `Vorrat voll · Wickler ${dirHint(WORLD.winder.x, WORLD.winder.z)} ${metresTo(WORLD.winder.x, WORLD.winder.z)} m`,
      progress: ticket
    };
  }

  if (state.buffer.units >= 20 && (state.spoolsMade === 0 || state.buffer.units >= state.stats.bufferCap * 0.6)) {
    return {
      key: 'winder',
      step: '2 / 4',
      title: 'Spule aufwickeln',
      sub: `Wickler ${dirHint(WORLD.winder.x, WORLD.winder.z)} · ${metresTo(WORLD.winder.x, WORLD.winder.z)} m. E halten.`,
      progress: ticket
    };
  }

  if (state.totalEarned > 0 && !upgraded && state.money >= 130) {
    return {
      key: 'shop',
      step: '4 / 4',
      title: 'Erstes Upgrade kaufen',
      sub: `Katalog ${dirHint(WORLD.shop.x, WORLD.shop.z)} · ${metresTo(WORLD.shop.x, WORLD.shop.z)} m. Mehr Faden pro Zug.`,
      progress: ticket
    };
  }

  const zone = nearestZone();
  if (!zone) {
    return {
      key: 'empty',
      step: tutorialDone ? 'TICKET' : '1 / 4',
      title: 'Alle Zonen leergezogen',
      sub: 'Der Faden wächst in der Nacht nach. Verkaufe deine Spulen.',
      progress: ticket
    };
  }
  const left = Math.ceil(state.zoneRemaining[zone.id] || 0);
  return {
    key: 'pull-' + zone.id,
    step: tutorialDone ? 'TICKET' : '1 / 4',
    title: state.buffer.units > 0 ? 'Weiter Faden ziehen' : 'Faden ziehen',
    sub: `${zone.label} ${dirHint(zone.pos.x, zone.pos.z)} · ${metresTo(zone.pos.x, zone.pos.z)} m · ${left} Faden übrig`,
    progress: state.buffer.units / Math.max(1, state.stats.bufferCap)
  };
}

/* ============================================================ */
/* Title camera and loop                                        */
/* ============================================================ */
let titleTime = 0;

function updateTitleCamera(dt) {
  titleTime += dt;
  const t = titleTime;
  camera.position.set(Math.sin(t * 0.07) * 5.8, 3.6 + Math.sin(t * 0.19) * 0.18, 5.6 + Math.cos(t * 0.07) * 1.3);
  camera.lookAt(0, 4.55, -13.6);
}

let lastTime = performance.now();
let firstFrame = true;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  if (state.mode === 'title') {
    updateTitleCamera(dt);
    doll.update(dt, {
      night: false,
      scare: false,
      stage: state.stage,
      players: [],
      colliders: dollColliders,
      bounds: WORLD.bounds,
      doorClosed: true,
      doorBroken: false,
      floodLevel: 0,
      playerPos: null,
      nearestPlayer: null,
      onStep: null,
      onCreak: null
    });
    world.update(dt, null);
  } else if (isGuest() && session.started) {
    if (state.mode === 'playing' || state.mode === 'dawn' || state.mode === 'win') updateGuestGame(dt);
  } else if (state.mode === 'playing' || state.mode === 'caught') {
    updateGame(dt);
  }

  renderer.render(scene, camera);
  if (firstFrame) {
    firstFrame = false;
    ui.hideLoading();
  }
}

/* initial decoration state */
world.setLadderVisible(false);
world.setSpinnerState(false, false, false);
world.setPhase('title');
doll.setStage(2);
doll.resetToHome();
ui.setNight(false);
ui.setSoundLabel(!settings.muted);
ui.setContinueVisible(hasSave());

window.addEventListener('beforeunload', () => {
  if (state.started && !isCoop()) saveGame();
});

const params = new URLSearchParams(location.search);
if (params.has('debug')) {
  window.__zwirn = {
    state, player, doll, johann, world, ui, audio, scene, camera, THREE, renderer,
    net, session, remote, buildSnapshot,
    startGame, beginDay, startDusk, startNight, endNight,
    updateGame, updateGuestGame, updateInteractions, catchPlayer, sellAll,
    finishWinding, gainYarn, buyUpgrade, saveGame, loadRun,
    syncUI, toggleDoor, openShop, closeShop, isProtected,
    collectPickup, spawnPickups, restorePickups, generateOrder,
    applyGuestSnapshot, openGuestShop, closeGuestShop, dawnContinue
  };
}

requestAnimationFrame(animate);
