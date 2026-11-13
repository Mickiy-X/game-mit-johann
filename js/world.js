import * as THREE from 'three';
import {
  concreteTexture, wallTexture, woodTexture, metalTexture, signTexture,
  hazardTexture, glowTexture, monitorTexture
} from './textures.js';

export const WORLD = {
  bounds: { minX: -18, maxX: 18, minZ: -22, maxZ: 22, height: 10.5 },
  safe: { minX: -18, maxX: -11.5, minZ: 12, maxZ: 22 },
  door: { hingeX: -16.3, z: 12, width: 3.1, height: 3.3 },
  dollHome: new THREE.Vector3(0, 0.62, -14),
  spawn: new THREE.Vector3(0, 0, 15.5),
  spawn2: new THREE.Vector3(-2.6, 0, 17.4),
  winder: new THREE.Vector3(6, 0, 10),
  sell: new THREE.Vector3(13, 0, 10),
  shop: new THREE.Vector3(10, 0, 5.5),
  spinner: new THREE.Vector3(-8, 0, -4),
  bed: new THREE.Vector3(-15.7, 0, 19.1),
  monitor: new THREE.Vector3(-11.7, 2.25, 16.4),
  zones: [
    {
      id: 'arm_l', name: 'LINKER ARM', label: 'ARM L', pos: new THREE.Vector3(-4.4, 0, -10.6),
      radius: 2.5, rate: 1.0, cap: 620, risk: 1.0, requiresLadder: false,
      weights: { white: 0.88, red: 0.09, black: 0.025, gold: 0.005 }
    },
    {
      id: 'arm_r', name: 'RECHTER ARM', label: 'ARM R', pos: new THREE.Vector3(4.4, 0, -10.6),
      radius: 2.5, rate: 1.0, cap: 620, risk: 1.0, requiresLadder: false,
      weights: { white: 0.88, red: 0.09, black: 0.025, gold: 0.005 }
    },
    {
      id: 'skirt', name: 'ROCK / BEINE', label: 'ROCK', pos: new THREE.Vector3(0, 0, -8.3),
      radius: 2.7, rate: 1.15, cap: 1100, risk: 0.9, requiresLadder: false,
      weights: { white: 0.9, red: 0.08, black: 0.016, gold: 0.004 }
    },
    {
      id: 'back', name: 'RÜCKEN', label: 'RÜCKEN', pos: new THREE.Vector3(0, 0, -18.5),
      radius: 2.5, rate: 0.85, cap: 560, risk: 1.35, requiresLadder: false,
      weights: { white: 0.6, red: 0.22, black: 0.13, gold: 0.05 }
    },
    {
      id: 'head', name: 'KOPF', label: 'KOPF', pos: new THREE.Vector3(-5.4, 0, -17.1),
      radius: 2.2, rate: 0.75, cap: 380, risk: 1.6, requiresLadder: true,
      weights: { white: 0.35, red: 0.3, black: 0.22, gold: 0.13 }
    }
  ]
};

/* ============================================================ */
/* Collision helpers                                            */
/* ============================================================ */
export function resolveCircle(pos, radius, colliders, bounds) {
  for (const c of colliders) {
    if (c.type === 'circle') {
      const dx = pos.x - c.x;
      const dz = pos.z - c.z;
      const d = Math.hypot(dx, dz);
      const min = radius + c.r;
      if (d < min && d > 0.0001) {
        const push = (min - d) / d;
        pos.x += dx * push;
        pos.z += dz * push;
      } else if (d <= 0.0001) {
        pos.x += min;
      }
    } else {
      const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
      const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      const dx = pos.x - nx;
      const dz = pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 0.000001) {
          const d = Math.sqrt(d2);
          const push = (radius - d) / d;
          pos.x += dx * push;
          pos.z += dz * push;
        } else {
          // deep inside: push out along smallest penetration axis
          const left = pos.x - c.minX, right = c.maxX - pos.x;
          const top = pos.z - c.minZ, bottom = c.maxZ - pos.z;
          const m = Math.min(left, right, top, bottom);
          if (m === left) pos.x = c.minX - radius;
          else if (m === right) pos.x = c.maxX + radius;
          else if (m === top) pos.z = c.minZ - radius;
          else pos.z = c.maxZ + radius;
        }
      }
    }
  }
  if (bounds) {
    pos.x = Math.max(bounds.minX + radius, Math.min(bounds.maxX - radius, pos.x));
    pos.z = Math.max(bounds.minZ + radius, Math.min(bounds.maxZ - radius, pos.z));
  }
}

/* ============================================================ */
export function buildWorld(scene) {
  scene.background = new THREE.Color(0x090b0d);
  scene.fog = new THREE.FogExp2(0x0c1013, 0.018);

  const world = {
    lamps: [],
    emergency: [],
    colliders: { walls: [], props: [], pedestal: [] },
    phase: 'day',
    lightTargets: { hemi: 0.65, dir: 2.2, lamp: 60, emerg: 0, safe: 26, fog: 0.018 },
    time: 0,
    flickerTimer: 2,
    lightsOut: 0,
    doorPivot: null,
    doorTarget: 0,
    doorVisual: { closed: true, broken: false },
    anim: {},
    monitorCanvas: null,
    monitorCtx: null,
    monitorTex: null,
    monitorTimer: 0,
    scene
  };

  const floorTex = concreteTexture();
  const wallTex = wallTexture();
  const woodTex = woodTexture();
  const metalTex = metalTexture();
  const hazardTex = hazardTexture();

  const M = {
    floor: new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.94, metalness: 0.04, color: 0xbcbcbc }),
    wall: new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.82, metalness: 0.25, color: 0x9a9e9f }),
    ceiling: new THREE.MeshStandardMaterial({ color: 0x1a1d1f, roughness: 0.95 }),
    wood: new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.9 }),
    metal: new THREE.MeshStandardMaterial({ map: metalTex, roughness: 0.55, metalness: 0.7, color: 0xa9aeb2 }),
    metalDark: new THREE.MeshStandardMaterial({ color: 0x2c3033, roughness: 0.5, metalness: 0.8 }),
    rust: new THREE.MeshStandardMaterial({ color: 0x6a4a34, roughness: 0.95, metalness: 0.25 }),
    black: new THREE.MeshStandardMaterial({ color: 0x0c0d0e, roughness: 0.8 }),
    hazard: new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.9 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x0a1418, roughness: 0.15, metalness: 0.4, emissive: 0x0a1a22, emissiveIntensity: 0.4 }),
    red: new THREE.MeshStandardMaterial({ color: 0x8c1e1e, roughness: 0.6 }),
    green: new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.7 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x2c4e73, roughness: 0.65 }),
    yarnWhite: new THREE.MeshStandardMaterial({ color: 0xd9d0c2, roughness: 1 }),
    yarnRed: new THREE.MeshStandardMaterial({ color: 0x8c2f2f, roughness: 1 }),
    emissive: (hex, intensity = 1) => new THREE.MeshStandardMaterial({
      color: hex, emissive: hex, emissiveIntensity: intensity, roughness: 0.5
    })
  };

  const room = new THREE.Group();
  scene.add(room);

  /* ---------------- Floor & ceiling ---------------- */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(36, 44), M.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  room.add(floor);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(36, 44), M.ceiling);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = WORLD.bounds.height;
  room.add(ceiling);

  // steel ceiling beams
  for (let z = -20; z <= 20; z += 8) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(36, 0.4, 0.5), M.metalDark);
    beam.position.set(0, WORLD.bounds.height - 0.35, z);
    room.add(beam);
  }
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 44), M.metalDark);
  spine.position.set(0, WORLD.bounds.height - 0.4, 0);
  room.add(spine);

  // skylight panels (emissive)
  const skyMat = M.emissive(0xb9d3e8, 0.6);
  for (const z of [-4, 8]) {
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 2.4), skyMat);
    sky.rotation.x = Math.PI / 2;
    sky.position.set(0, WORLD.bounds.height - 0.08, z);
    room.add(sky);
  }

  /* ---------------- Walls ---------------- */
  const wallHeight = WORLD.bounds.height;
  function addWall(w, h, d, x, y, z, repX = 4, repY = 2) {
    const mat = M.wall.clone();
    mat.map = wallTex.clone();
    mat.map.needsUpdate = true;
    mat.map.repeat.set(repX, repY);
    mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    room.add(mesh);
    return mesh;
  }

  // outer walls
  addWall(36.8, wallHeight, 0.8, 0, wallHeight / 2, -22.2, 7, 2.4);
  addWall(36.8, wallHeight, 0.8, 0, wallHeight / 2, 22.2, 7, 2.4);
  addWall(0.8, wallHeight, 44.8, -18.2, wallHeight / 2, 0, 8, 2.4);
  addWall(0.8, wallHeight, 44.8, 18.2, wallHeight / 2, 0, 8, 2.4);

  world.colliders.walls.push(
    { minX: -19, maxX: 19, minZ: -23, maxZ: -21.8 },
    { minX: -19, maxX: 19, minZ: 21.8, maxZ: 23 },
    { minX: -19, maxX: -17.8, minZ: -23, maxZ: 23 },
    { minX: 17.8, maxX: 19, minZ: -23, maxZ: 23 }
  );

  // baseboard trim
  for (const [w, d, x, z] of [[36, 0.15, 0, -21.78], [36, 0.15, 0, 21.78], [0.15, 44, -17.78, 0], [0.15, 44, 17.78, 0]]) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d), M.metalDark);
    trim.position.set(x, 0.25, z);
    room.add(trim);
  }

  /* ---------------- Safe room ---------------- */
  const safe = WORLD.safe;
  const srWallMat = M.wall.clone();
  srWallMat.map = wallTex.clone();
  srWallMat.map.repeat.set(1.5, 2);
  srWallMat.map.needsUpdate = true;

  function srWall(w, h, d, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), srWallMat);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    room.add(mesh);
    return mesh;
  }

  // north wall with door gap (x -16.3 .. -13.2, width 3.1)
  srWall(1.7, wallHeight, 0.45, -17.15, wallHeight / 2, 12);
  srWall(2.3, wallHeight, 0.45, -12.55, wallHeight / 2, 12);
  // lintel above door
  srWall(3.1, wallHeight - 3.3, 0.45, -14.75, 3.3 + (wallHeight - 3.3) / 2, 12);
  // east wall of safe room
  srWall(0.45, wallHeight, 10, -11.5, wallHeight / 2, 17);

  world.colliders.walls.push(
    { minX: -18, maxX: -16.3, minZ: 11.75, maxZ: 12.25 },
    { minX: -13.2, maxX: -11.5, minZ: 11.75, maxZ: 12.25 },
    { minX: -11.75, maxX: -11.25, minZ: 12, maxZ: 22 }
  );

  // safe room ceiling & inner light
  const srCeil = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 10), new THREE.MeshStandardMaterial({ color: 0x24282a, roughness: 0.95 }));
  srCeil.rotation.x = Math.PI / 2;
  srCeil.position.set(-14.75, 4.6, 17);
  room.add(srCeil);

  const safeLight = new THREE.PointLight(0xffc98f, 26, 12, 1.3);
  safeLight.position.set(-14.5, 3.9, 17);
  scene.add(safeLight);
  world.safeLight = safeLight;
  const safeBulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), M.emissive(0xffd9a0, 2));
  safeBulb.position.copy(safeLight.position);
  scene.add(safeBulb);
  const safeCord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 5.9, 6), M.black);
  safeCord.position.set(-14.5, 6.55, 17);
  scene.add(safeCord);

  // door frame
  const frameMat = M.metalDark;
  for (const x of [-16.42, -13.08]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.26, 3.5, 0.55), frameMat);
    post.position.set(x, 1.75, 12);
    room.add(post);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.28, 0.55), frameMat);
  lintel.position.set(-14.75, 3.44, 12);
  room.add(lintel);

  // door pivot
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-16.3, 0, 12);
  room.add(doorPivot);
  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(3.1, 3.3, 0.14), M.metal);
  doorPanel.position.set(1.55, 1.65, 0);
  doorPanel.castShadow = true;
  doorPivot.add(doorPanel);
  // door details
  const doorWin = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.55), M.glass);
  doorWin.position.set(1.55, 2.25, 0.075);
  doorPivot.add(doorWin);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.28, 8), M.metalDark);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(2.55, 1.45, 0.16);
  doorPivot.add(handle);
  const doorBar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.9, 0.08), M.red);
  doorBar.position.set(1.55, 1.55, 0.09);
  doorPivot.add(doorBar);
  world.doorPivot = doorPivot;

  // safe room sign
  const srSign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.3), new THREE.MeshBasicMaterial({ map: signTexture('SAFE ROOM', 'NUR BEI GESCHLOSSENER TÜR', '#9be27a', '#101512') }));
  srSign.position.set(-14.75, 4.25, 12.27);
  room.add(srSign);

  // bed
  const bedGroup = new THREE.Group();
  bedGroup.position.set(-15.8, 0, 19.1);
  const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.45, 3.8), M.metalDark);
  bedFrame.position.y = 0.3; bedFrame.castShadow = true; bedGroup.add(bedFrame);
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.28, 3.6), new THREE.MeshStandardMaterial({ color: 0x5b625c, roughness: 1 }));
  mattress.position.y = 0.62; mattress.castShadow = true; bedGroup.add(mattress);
  const blanket = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 2.4), new THREE.MeshStandardMaterial({ color: 0x364a44, roughness: 1 }));
  blanket.position.set(0, 0.8, 0.45); bedGroup.add(blanket);
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.2, 0.65), new THREE.MeshStandardMaterial({ color: 0xaeb0a6, roughness: 1 }));
  pillow.position.set(0, 0.8, -1.3); pillow.rotation.x = -0.06; bedGroup.add(pillow);
  room.add(bedGroup);
  world.anim.bed = bedGroup;
  world.colliders.props.push({ minX: -17, maxX: -14.6, minZ: 17.2, maxZ: 21 });

  // safe room shelf, radio, locker
  addShelf(-17.2, 0, 14.4, Math.PI / 2);
  const locker = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 0.7), M.blue);
  locker.position.set(-17.2, 1.1, 20.8);
  locker.castShadow = true;
  room.add(locker);
  world.colliders.props.push({ minX: -17.8, maxX: -16.5, minZ: 20.4, maxZ: 21.2 });

  const radio = new THREE.Group();
  const radioBody = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.32, 0.28), M.metalDark);
  radio.add(radioBody);
  const radioLight = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.02), M.emissive(0x9be27a, 1.2));
  radioLight.position.set(0.18, 0.06, 0.15);
  radio.add(radioLight);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.9, 5), M.metal);
  antenna.position.set(-0.15, 0.55, 0);
  radio.add(antenna);
  radio.position.set(-17.2, 1.75, 14.4);
  room.add(radio);

  // camera monitor
  const monCanvas = document.createElement('canvas');
  monCanvas.width = 512; monCanvas.height = 384;
  const monCtx = monCanvas.getContext('2d');
  const monTex = monitorTexture(monCanvas);
  const monFrame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.15, 1.5), M.metalDark);
  monFrame.position.copy(WORLD.monitor);
  room.add(monFrame);
  const monScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 0.98),
    new THREE.MeshBasicMaterial({ map: monTex, toneMapped: false })
  );
  monScreen.rotation.y = -Math.PI / 2;
  monScreen.position.set(WORLD.monitor.x - 0.075, WORLD.monitor.y, WORLD.monitor.z);
  room.add(monScreen);
  const monGlow = new THREE.PointLight(0x76c8a2, 4, 4, 1.6);
  monGlow.position.set(-12.4, 2.2, 16.4);
  scene.add(monGlow);
  world.monitorCanvas = monCanvas;
  world.monitorCtx = monCtx;
  world.monitorTex = monTex;
  world.anim.monitor = monScreen;

  /* ---------------- Pedestal for the doll ---------------- */
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(4.1, 4.35, 0.62, 48), M.wood);
  pedestal.position.set(0, 0.31, -14);
  pedestal.receiveShadow = true;
  pedestal.castShadow = true;
  room.add(pedestal);
  const pedRim = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.07, 8, 64), M.emissive(0xc79a2f, 0.6));
  pedRim.rotation.x = -Math.PI / 2;
  pedRim.position.set(0, 0.65, -14);
  room.add(pedRim);
  world.colliders.pedestal.push({ type: 'circle', x: 0, z: -14, r: 3.75 });

  // zone floor stencils
  function floorLabel(text, x, z, rot = 0, col = '#c79a2f') {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 256, 128);
    g.font = 'bold 58px Consolas, monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = col;
    g.globalAlpha = 0.52;
    g.fillText(text, 128, 64);
    g.globalAlpha = 0.18;
    g.strokeStyle = col;
    g.lineWidth = 4;
    g.strokeRect(10, 12, 236, 104);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.5, depthWrite: false }));
    p.rotation.x = -Math.PI / 2;
    p.rotation.z = rot;
    p.position.set(x, 0.012, z);
    room.add(p);
  }
  floorLabel('ARM L', -4.4, -10.6);
  floorLabel('ARM R', 4.4, -10.6);
  floorLabel('ROCK', 0, -8.3);
  floorLabel('RÜCKEN', 0, -18.5);
  floorLabel('KOPF', -5.4, -17.1, 0, '#a97cff');

  /* ---------------- Wall dressing ---------------- */
  // big wall sign
  const bigSign = new THREE.Mesh(
    new THREE.PlaneGeometry(7.2, 3.6),
    new THREE.MeshBasicMaterial({ map: signTexture('ZWIRN & ZORN', 'WEBEREI 07 · SCHICHT 3', '#c79a2f', '#17191a') })
  );
  bigSign.position.set(0, 7.4, -21.75);
  room.add(bigSign);

  // warning signs
  const warnSigns = [
    ['KEIN AUSGANG', 'HINTER DIESER TÜR', 10, 5.2, -21.7, 0],
    ['RUHE BEWAHREN', 'SIE HÖRT DEN LÄRM', -10, 5.2, -21.7, 0],
    ['SCHICHT 3', 'NACHSCHICHT 22–06', -17.7, 5.3, -3, Math.PI / 2]
  ];
  for (const [t, s, x, y, z, ry] of warnSigns) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.4), new THREE.MeshBasicMaterial({ map: signTexture(t, s) }));
    sign.position.set(x, y, z);
    sign.rotation.y = ry;
    room.add(sign);
  }

  // pipes along walls
  function pipeRun(x, y, z, len, horizontal) {
    const geo = horizontal ? new THREE.CylinderGeometry(0.18, 0.18, len, 12) : new THREE.CylinderGeometry(0.18, 0.18, len, 12);
    const p = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x4b4036, roughness: 0.92, metalness: 0.3 }));
    if (horizontal) p.rotation.z = Math.PI / 2;
    else p.rotation.x = Math.PI / 2;
    p.position.set(x, y, z);
    room.add(p);
    return p;
  }
  pipeRun(-16.9, 8.7, 4, 34, false);
  pipeRun(16.9, 8.9, -6, 26, false);
  pipeRun(-8, 8.7, -21.3, 16, true);
  for (const [x, z] of [[-16.9, -8], [-16.9, 6], [-16.9, 18], [16.9, -12], [16.9, 10]]) {
    const valve = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.045, 6, 14), M.rust);
    valve.rotation.y = Math.PI / 2;
    valve.position.set(x + (x < 0 ? 0.2 : -0.2), 8.7, z);
    room.add(valve);
  }

  // hanging chains
  for (const [x, z, len] of [[-12, -8, 3.2], [12, -14, 2.4], [14, 12, 3.8], [-8, 16, 2.8]]) {
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, len, 6), M.metalDark);
    chain.position.set(x, WORLD.bounds.height - len / 2, z);
    room.add(chain);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 6, 12, Math.PI * 1.5), M.rust);
    hook.position.set(x, WORLD.bounds.height - len - 0.15, z);
    room.add(hook);
  }

  /* ---------------- Crates / barrels / props ---------------- */
  function crate(x, z, size = 1.7, rot = 0, stack = 1) {
    for (let i = 0; i < stack; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.85, size), M.wood);
      m.position.set(x + i * 0.05, size * 0.425 + i * size * 0.86, z);
      m.rotation.y = rot + i * 0.05;
      m.castShadow = true;
      m.receiveShadow = true;
      room.add(m);
      const strap = new THREE.Mesh(new THREE.BoxGeometry(size + 0.03, 0.09, size + 0.03), M.metalDark);
      strap.position.set(m.position.x, m.position.y + size * 0.18, m.position.z);
      strap.rotation.y = m.rotation.y;
      room.add(strap);
    }
    world.colliders.props.push({
      minX: x - size * 0.62, maxX: x + size * 0.62,
      minZ: z - size * 0.62, maxZ: z + size * 0.62
    });
  }

  function barrel(x, z, color = 0x365666) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.25, 16), new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.5 }));
    m.position.set(x, 0.63, z);
    m.castShadow = true;
    room.add(m);
    for (const y of [0.3, 0.96]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.035, 5, 16), M.metalDark);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, y, z);
      room.add(ring);
    }
    world.colliders.props.push({ type: 'circle', x, z, r: 0.7 });
  }

  crate(9.2, -17.6, 1.8, 0.15);
  crate(11.4, -15.6, 1.5, -0.2);
  crate(-10.2, -2.6, 1.8, 0.4, 2);
  crate(-12.6, -6.4, 1.4, 0.2);
  crate(12.4, 2.6, 1.7, -0.3);
  crate(14.8, 5.1, 1.4, 0.2);
  crate(-14.2, 4.2, 1.9, 0.1);
  crate(3.6, 1.4, 1.5, 0.5, 1);
  crate(-5.2, 7.8, 1.6, -0.2);
  crate(15.3, 17.2, 1.8, 0.3, 2);

  barrel(-12.2, 8.6);
  barrel(16.2, -8.4, 0x5d4a2d);
  barrel(3.2, -19.2, 0x4d5b33);
  barrel(-15.9, -10.4, 0x5d3a3a);

  // pallet + stacked yarn spools
  function spoolStack(x, z, n = 5) {
    const pallet = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 1.7), M.wood);
    pallet.position.set(x, 0.08, z);
    room.add(pallet);
    for (let i = 0; i < n; i++) {
      const spool = makeSpoolMesh(0.28, 0.42, M.yarnWhite);
      spool.position.set(x - 0.65 + (i % 3) * 0.65, 0.5, z - 0.35 + Math.floor(i / 3) * 0.7);
      spool.rotation.z = Math.PI / 2;
      room.add(spool);
    }
    world.colliders.props.push({ minX: x - 1.2, maxX: x + 1.2, minZ: z - 0.95, maxZ: z + 0.95 });
  }
  spoolStack(-15.6, -16.5);
  spoolStack(14.4, 14.2, 3);

  // workbench
  const bench = new THREE.Group();
  const benchTop = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.16, 1.4), M.wood);
  benchTop.position.y = 1.2;
  bench.add(benchTop);
  for (const dx of [-1.5, 1.5]) for (const dz of [-0.55, 0.55]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.12), M.metalDark);
    leg.position.set(dx, 0.6, dz);
    bench.add(leg);
  }
  const vice = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.3), M.rust);
  vice.position.set(-1.1, 1.42, 0.1);
  bench.add(vice);
  const toolbox = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.32, 0.4), M.red);
  toolbox.position.set(0.9, 1.44, 0);
  bench.add(toolbox);
  bench.position.set(-15.5, 0, 0.2);
  bench.rotation.y = Math.PI / 2;
  room.add(bench);
  world.colliders.props.push({ minX: -16.4, maxX: -14.6, minZ: -1.5, maxZ: 1.9 });

  // shelves with yarn spools (west wall)
  function addShelf(x, y, z, rotY) {
    const g = new THREE.Group();
    for (let level = 0; level < 3; level++) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 0.8), M.metalDark);
      board.position.y = level * 1.1;
      g.add(board);
      for (let i = 0; i < 4; i++) {
        const s = makeSpoolMesh(0.16, 0.26, i % 3 === 0 ? M.yarnRed : M.yarnWhite);
        s.position.set(-1.0 + i * 0.62, level * 1.1 + 0.2, 0);
        g.add(s);
      }
    }
    for (const dx of [-1.25, 1.25]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.3, 0.8), M.metalDark);
      post.position.set(dx, 1.1, 0);
      g.add(post);
    }
    g.position.set(x, y + 0.1, z);
    g.rotation.y = rotY;
    room.add(g);
  }
  addShelf(16.9, 0, -2, -Math.PI / 2);

  /* ---------------- Lamps ---------------- */
  const lampPositions = [
    [-9, -9], [9, -9], [-8, 3], [8, 3], [0, 14]
  ];
  const cableMat = M.black;
  const shadeMat = new THREE.MeshStandardMaterial({ color: 0x2e3436, roughness: 0.5, metalness: 0.7, side: THREE.DoubleSide });
  for (const [x, z] of lampPositions) {
    const g = new THREE.Group();
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 2.4, 5), cableMat);
    cable.position.y = WORLD.bounds.height - 1.2;
    g.add(cable);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.5, 20, 1, true), shadeMat);
    shade.position.y = WORLD.bounds.height - 2.45;
    shade.rotation.x = Math.PI;
    g.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), M.emissive(0xffc176, 2));
    bulb.position.y = WORLD.bounds.height - 2.62;
    g.add(bulb);

    const light = new THREE.PointLight(0xffc07a, 60, 23, 1.35);
    light.position.set(x, WORLD.bounds.height - 2.75, z);
    g.add(light);
    g.position.set(x, 0, z);
    scene.add(g);
    world.lamps.push({ light, bulb, base: 60, flicker: Math.random() * 10 });
  }

  // emergency red lights
  for (const [x, z] of [[-17.6, 0], [17.6, 0], [-17.6, 10], [10, -21.5]]) {
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.45, 0.3), M.metalDark);
    housing.position.set(x, 6.5, z);
    room.add(housing);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), M.emissive(0xff1a1a, 0.1));
    lamp.position.set(x + (x < 0 ? 0.18 : -0.18), 6.5, z);
    room.add(lamp);
    const light = new THREE.PointLight(0xff1c1c, 0, 22, 1.4);
    light.position.copy(lamp.position);
    scene.add(light);
    world.emergency.push({ light, lamp });
  }

  /* ---------------- Stations ---------------- */
  buildWinder(room, M, world, metalTex);
  buildSellStation(room, M, world);
  buildShopTerminal(room, M, world);
  buildSpinner(room, M, world);
  buildLadder(room, M, world);

  // station signs
  function hangingSign(text, sub, x, y, z, col = '#c79a2f') {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), new THREE.MeshBasicMaterial({ map: signTexture(text, sub, col), side: THREE.DoubleSide }));
    s.position.set(x, y, z);
    room.add(s);
    return s;
  }
  hangingSign('WICKLER', 'FADEN AUFSPULEN', 6, 3.3, 10.7);
  hangingSign('VERKAUF', 'SPULEN GEGEN BAR', 13, 3.4, 10.7, '#9be27a');
  hangingSign('KATALOG', 'UPGRADES', 10, 3.1, 6.4, '#7bc4ff');

  /* ---------------- Dust ---------------- */
  const dustGeo = new THREE.BufferGeometry();
  const N = 420;
  const pos = new Float32Array(N * 3);
  const seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 34;
    pos[i * 3 + 1] = Math.random() * 8 + 0.4;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 42;
    seed[i] = Math.random() * Math.PI * 2;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dustMat = new THREE.PointsMaterial({
    size: 0.045,
    map: glowTexture(),
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    color: 0xd8c7ae,
    blending: THREE.AdditiveBlending
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  scene.add(dust);
  world.anim.dust = { points: dust, seed, base: pos.slice() };

  /* ---------------- Ambient lighting ---------------- */
  const hemi = new THREE.HemisphereLight(0x9fb2c4, 0x1a1410, 0.65);
  scene.add(hemi);
  world.hemi = hemi;

  const dir = new THREE.DirectionalLight(0xfff0d6, 2.2);
  dir.position.set(7, 15, 5);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  dir.shadow.camera.left = -26;
  dir.shadow.camera.right = 26;
  dir.shadow.camera.top = 26;
  dir.shadow.camera.bottom = -26;
  dir.shadow.camera.near = 1;
  dir.shadow.camera.far = 45;
  dir.shadow.bias = -0.0006;
  dir.shadow.normalBias = 0.02;
  scene.add(dir);
  world.dir = dir;

  /* ---------------- update ---------------- */
  world.setPhase = (phase) => {
    world.phase = phase;
    if (phase === 'day') {
      world.lightTargets = { hemi: 0.7, dir: 2.3, lamp: 62, emerg: 0, safe: 26, fog: 0.017 };
      scene.background.set(0x0b0d0f);
    } else if (phase === 'dusk') {
      world.lightTargets = { hemi: 0.38, dir: 0.75, lamp: 34, emerg: 7, safe: 22, fog: 0.022 };
      scene.background.set(0x0a0908);
    } else if (phase === 'night') {
      world.lightTargets = { hemi: 0.1, dir: 0.03, lamp: 2.2, emerg: 26, safe: 18, fog: 0.034 };
      scene.background.set(0x050607);
    } else if (phase === 'title') {
      world.lightTargets = { hemi: 0.28, dir: 0.45, lamp: 24, emerg: 4, safe: 10, fog: 0.026 };
      scene.background.set(0x07080a);
    }
  };

  world.setDoorVisual = (closed, broken) => {
    world.doorVisual.closed = closed;
    world.doorVisual.broken = broken;
    world.doorTarget = (closed && !broken) ? 0 : -1.92;
  };

  world.setLadderVisible = (v) => {
    if (world.anim.ladder) world.anim.ladder.visible = v;
  };

  world.setSpinnerState = (owned, running, broken) => {
    world.anim.spinnerOwned = owned;
    world.anim.spinnerRunning = running;
    world.anim.spinnerBroken = broken;
    if (world.anim.spinnerLight) {
      world.anim.spinnerLight.material = broken ? M.emissive(0xff2020, 1.2) : M.emissive(0x59e07a, running ? 1.6 : 0.15);
    }
    if (world.anim.spinnerGlow) {
      world.anim.spinnerGlow.intensity = running ? 6 : 0;
      world.anim.spinnerGlow.color.set(broken ? 0xff2020 : 0x59e07a);
    }
  };

  world.setWinderActive = (active) => { world.anim.winderActive = active; };

  world.update = (dt, gameState) => {
    world.time += dt;

    // light blending
    const t = world.lightTargets;
    const k = 1 - Math.pow(0.001, dt);
    hemi.intensity += (t.hemi - hemi.intensity) * k;
    dir.intensity += (t.dir - dir.intensity) * k;
    if (world.safeLight) world.safeLight.intensity += ((world.lightsOut > 0 ? 4 : t.safe) - world.safeLight.intensity) * k;
    scene.fog.density += (t.fog - scene.fog.density) * k;

    // lamp flicker
    world.flickerTimer -= dt;
    if (world.flickerTimer <= 0) {
      world.flickerTimer = 1.5 + Math.random() * 5;
      if (Math.random() < 0.38) {
        const l = world.lamps[(Math.random() * world.lamps.length) | 0];
        l.flicker = 1;
      }
    }
    for (const l of world.lamps) {
      let target = t.lamp;
      if (world.lightsOut > 0) target = 0;
      if (l.flicker > 0) {
        l.flicker -= dt * 3;
        target *= 0.15 + Math.abs(Math.sin(world.time * 40)) * 0.85;
      }
      if (t.lamp > 20) target *= 0.94 + Math.sin(world.time * 2.1 + l.base) * 0.06;
      l.light.intensity += (target - l.light.intensity) * Math.min(1, dt * 12);
      l.bulb.material.emissiveIntensity = 0.08 + l.light.intensity / 70;
    }
    if (world.lightsOut > 0) world.lightsOut -= dt;

    for (const e of world.emergency) {
      e.light.intensity += (t.emerg * (0.8 + Math.sin(world.time * 3) * 0.2) - e.light.intensity) * Math.min(1, dt * 6);
      e.lamp.material.emissiveIntensity = 0.2 + e.light.intensity / 22;
    }

    // door swing
    if (doorPivot) {
      const diff = world.doorTarget - doorPivot.rotation.y;
      doorPivot.rotation.y += diff * Math.min(1, dt * 6);
    }

    // dust
    const d = world.anim.dust;
    if (d) {
      const arr = d.points.geometry.attributes.position.array;
      for (let i = 0; i < d.seed.length; i++) {
        const s = d.seed[i];
        arr[i * 3] = d.base[i * 3] + Math.sin(world.time * 0.13 + s) * 0.9;
        arr[i * 3 + 1] = d.base[i * 3 + 1] + Math.sin(world.time * 0.09 + s * 2) * 0.5;
        arr[i * 3 + 2] = d.base[i * 3 + 2] + Math.cos(world.time * 0.11 + s) * 0.9;
      }
      d.points.geometry.attributes.position.needsUpdate = true;
    }

    // winder animation
    if (world.anim.winderSpool) {
      const active = world.anim.winderActive;
      world.anim.winderSpool.rotation.x += dt * (active ? 12 : 0.5);
      world.anim.winderLight.material.emissiveIntensity = active ? 2.4 : 0.5;
    }

    // spinner animation
    if (world.anim.spinnerWheel) {
      if (world.anim.spinnerOwned && world.anim.spinnerRunning && !world.anim.spinnerBroken) {
        world.anim.spinnerWheel.rotation.z += dt * 4.5;
        world.anim.spinnerPiston.position.y = 0.9 + Math.sin(world.time * 5) * 0.22;
      }
    }

    // monitor feed
    world.monitorTimer -= dt;
    if (world.monitorTimer <= 0 && gameState) {
      world.monitorTimer = 0.12;
      drawMonitor(world, gameState);
    }

    // lucky yarn pickups
    for (const p of world.pickups) {
      if (!p.group.visible) continue;
      p.ball.position.y = 0.62 + Math.sin(world.time * 2.2 + p.phase) * 0.1;
      p.ball.rotation.y += dt * 1.6;
      p.ring.rotation.z += dt * 0.8;
      p.ring.scale.setScalar(1 + Math.sin(world.time * 3 + p.phase) * 0.08);
      p.light.intensity = 1.8 + Math.sin(world.time * 4 + p.phase) * 0.7;
    }
  };

  /* ---------------- lucky yarn pickups ---------------- */
  world.pickups = [];
  {
    const yarnMat = new THREE.MeshStandardMaterial({
      color: 0xffd489, emissive: 0xffa43c, emissiveIntensity: 1.25, roughness: 0.35, metalness: 0.1
    });
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffbf6b, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false
    });
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), yarnMat);
      ball.position.y = 0.62;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.025, 6, 24), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.08;
      const light = new THREE.PointLight(0xffa845, 2.2, 5.5, 1.6);
      light.position.y = 0.7;
      g.add(ball, ring, light);
      g.visible = false;
      scene.add(g);
      world.pickups.push({ group: g, ball, ring, light, phase: i * 2.1 });
    }
    world.setPickupVisible = (i, visible, x = 0, z = 0) => {
      const p = world.pickups[i];
      if (!p) return;
      p.group.visible = visible;
      if (visible) p.group.position.set(x, 0, z);
    };
  }

  world.setPhase('title');
  world.setDoorVisual(true, false);
  return world;
}

/* ============================================================ */
function makeSpoolMesh(r, h, mat) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, h, 12), new THREE.MeshStandardMaterial({ color: 0x3a3028, roughness: 0.9 }));
  g.add(core);
  const yarn = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h * 0.86, 16), mat);
  g.add(yarn);
  for (const y of [-h / 2, h / 2]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.08, r * 1.08, h * 0.08, 16), new THREE.MeshStandardMaterial({ color: 0x5d4b3b, roughness: 0.9 }));
    cap.position.y = y;
    g.add(cap);
  }
  return g;
}

function buildWinder(room, M, world, metalTex) {
  const g = new THREE.Group();
  g.position.set(6, 0, 10);
  const table = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.14, 1.25), M.wood);
  table.position.y = 1.05;
  table.castShadow = true;
  g.add(table);
  for (const dx of [-1.2, 1.2]) for (const dz of [-0.45, 0.45]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.05, 0.12), M.metalDark);
    leg.position.set(dx, 0.52, dz);
    g.add(leg);
  }
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.75, 0.8), M.metal);
  body.position.set(-0.35, 1.5, 0);
  body.castShadow = true;
  g.add(body);
  const drum = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.7), M.metalDark);
  drum.position.set(0.55, 1.5, 0);
  g.add(drum);
  const spool = makeSpoolMesh(0.3, 0.5, M.yarnWhite);
  spool.position.set(0.55, 1.5, 0.45);
  spool.rotation.x = Math.PI / 2;
  g.add(spool);
  const guide = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.02, 5, 12), M.metal);
  guide.position.set(0.55, 1.55, 0.72);
  g.add(guide);
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), M.emissive(0xffb547, 0.5));
  light.position.set(-0.85, 1.92, 0.3);
  g.add(light);
  const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.45, 6), M.rust);
  lever.rotation.z = 0.5;
  lever.position.set(-0.1, 1.95, -0.2);
  g.add(lever);
  room.add(g);
  world.colliders.props.push({ minX: 4.6, maxX: 7.4, minZ: 9.35, maxZ: 10.65 });
  world.anim.winderSpool = spool;
  world.anim.winderLight = light;
}

function buildSellStation(room, M, world) {
  const g = new THREE.Group();
  g.position.set(13, 0, 10);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.1, 1.2), M.wood);
  counter.position.y = 0.55;
  counter.castShadow = true;
  g.add(counter);
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.08, 1.35), M.metalDark);
  top.position.y = 1.14;
  g.add(top);
  // cage bars
  for (let i = 0; i < 7; i++) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 5), M.metal);
    bar.position.set(-1.2 + i * 0.4, 1.75, -0.45);
    g.add(bar);
  }
  const cash = new THREE.Group();
  const cashBody = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.32, 0.45), M.metalDark);
  cashBody.position.y = 1.35;
  cash.add(cashBody);
  const cashScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.16), new THREE.MeshBasicMaterial({ color: 0x7ef29a }));
  cashScreen.position.set(0, 1.4, 0.23);
  cash.add(cashScreen);
  cash.position.set(0.9, 0, 0.1);
  g.add(cash);
  const scale = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.5), M.metal);
  scale.position.set(-0.7, 1.22, 0.1);
  g.add(scale);
  const basket = new THREE.Group();
  for (const [dx, dz] of [[-0.2, -0.15], [0.2, -0.15], [-0.2, 0.15], [0.2, 0.15]]) {
    const s = makeSpoolMesh(0.14, 0.24, M.yarnWhite);
    s.position.set(dx, 0.15, dz);
    basket.add(s);
  }
  basket.position.set(-0.7, 1.25, 0.15);
  g.add(basket);
  world.anim.sellBasket = basket;
  room.add(g);
  world.colliders.props.push({ minX: 11.4, maxX: 14.6, minZ: 9.35, maxZ: 10.65 });
}

function buildShopTerminal(room, M, world) {
  const g = new THREE.Group();
  g.position.set(10, 0, 5.5);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.05, 0.8), M.metalDark);
  desk.position.y = 0.52;
  desk.castShadow = true;
  g.add(desk);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.7, 8), M.metal);
  post.position.y = 1.4;
  g.add(post);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.66), new THREE.MeshBasicMaterial({ color: 0x183247 }));
  screen.position.set(0, 1.85, 0.05);
  screen.rotation.x = -0.1;
  g.add(screen);
  // fake UI
  const c = document.createElement('canvas');
  c.width = 256; c.height = 160;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#08141d'; ctx.fillRect(0, 0, 256, 160);
  ctx.fillStyle = '#7bc4ff'; ctx.font = 'bold 18px Consolas, monospace'; ctx.fillText('FABRIK-KATALOG', 20, 34);
  ctx.strokeStyle = 'rgba(123,196,255,0.35)'; ctx.strokeRect(16, 48, 224, 30); ctx.strokeRect(16, 86, 224, 30); ctx.strokeRect(16, 124, 224, 22);
  ctx.fillStyle = 'rgba(123,196,255,0.3)';
  ctx.fillRect(24, 58, 120, 8); ctx.fillRect(24, 96, 150, 8); ctx.fillRect(24, 132, 80, 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  screen.material = new THREE.MeshBasicMaterial({ map: t });
  room.add(g);
  world.colliders.props.push({ minX: 9, maxX: 11, minZ: 5, maxZ: 6 });
}

function buildSpinner(room, M, world) {
  const g = new THREE.Group();
  g.position.set(-8, 0, -4);
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.7, 1.6), M.metal);
  body.position.y = 0.85;
  body.castShadow = true;
  g.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 1.2), M.metalDark);
  top.position.y = 1.9;
  g.add(top);
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.07, 6, 20), M.rust);
  wheel.add(rim);
  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, 0.06), M.metal);
    spoke.rotation.z = (i / 5) * Math.PI;
    wheel.add(spoke);
  }
  wheel.position.set(0, 1.45, 0.86);
  g.add(wheel);
  const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.9, 10), M.metalDark);
  piston.position.set(0.75, 0.9, 0.1);
  g.add(piston);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 3), M.black);
  belt.position.set(-0.4, 0.24, 2.0);
  g.add(belt);
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), M.emissive(0x59e07a, 0.15));
  light.position.set(1.15, 1.5, 0.87);
  g.add(light);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.6, 10), M.rust);
  pipe.position.set(-1.3, 1.6, -0.2);
  g.add(pipe);
  // cone sign
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.85), new THREE.MeshBasicMaterial({ map: signTexture('AUTO\nSPINNER', 'LÄRMFAKTOR HOCH', '#c79a2f', '#141615') }));
  sign.position.set(0, 2.45, 0.62);
  g.add(sign);
  room.add(g);

  const glow = new THREE.PointLight(0x59e07a, 0, 9, 1.4);
  glow.position.set(-8, 1.6, -2.9);
  room.add(glow);
  world.colliders.props.push({ minX: -9.3, maxX: -6.7, minZ: -4.9, maxZ: -3.1 });
  world.anim.spinnerWheel = wheel;
  world.anim.spinnerPiston = piston;
  world.anim.spinnerLight = light;
  world.anim.spinnerGlow = glow;
  world.anim.spinnerOwned = false;
  world.anim.spinnerRunning = false;
  world.anim.spinnerBroken = false;
}

function buildLadder(room, M, world) {
  const g = new THREE.Group();
  g.position.set(-5.4, 0, -17.1);
  g.rotation.x = -0.14;
  g.rotation.y = 0.12;
  for (const dx of [-0.45, 0.45]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 6.4, 0.14), M.wood);
    rail.position.set(dx, 3.2, 0);
    g.add(rail);
  }
  for (let i = 0; i < 12; i++) {
    const rung = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.1), M.wood);
    rung.position.set(0, 0.5 + i * 0.5, 0);
    g.add(rung);
  }
  g.visible = false;
  room.add(g);
  world.anim.ladder = g;
}

/* ============================================================ */
function drawMonitor(world, state) {
  const ctx = world.monitorCtx;
  if (!ctx) return;
  const W = 512, H = 384;
  ctx.fillStyle = '#06100b';
  ctx.fillRect(0, 0, W, H);

  const padX = 36, padY = 52;
  const mapW = W - padX * 2;
  const mapH = H - padY - 28;
  const toX = (x) => padX + ((x - (-18)) / 36) * mapW;
  const toY = (z) => padY + ((z - (-22)) / 44) * mapH;

  // grid
  ctx.strokeStyle = 'rgba(110,220,160,0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 12; i++) {
    ctx.beginPath(); ctx.moveTo(padX + (mapW / 12) * i, padY); ctx.lineTo(padX + (mapW / 12) * i, padY + mapH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(padX, padY + (mapH / 12) * i); ctx.lineTo(padX + mapW, padY + (mapH / 12) * i); ctx.stroke();
  }

  // room outline
  ctx.strokeStyle = 'rgba(130,255,190,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(toX(-18), toY(-22), mapW, mapH * (44 / 44));

  // safe room
  ctx.fillStyle = 'rgba(120,230,160,0.12)';
  ctx.fillRect(toX(-18), toY(12), toX(-11.5) - toX(-18), toY(22) - toY(12));
  ctx.strokeStyle = 'rgba(150,255,190,0.5)';
  ctx.strokeRect(toX(-18), toY(12), toX(-11.5) - toX(-18), toY(22) - toY(12));
  ctx.fillStyle = 'rgba(180,255,210,0.6)';
  ctx.font = '13px Consolas, monospace';
  ctx.fillText('SAFE', toX(-17.2), toY(13.6));

  // doll platform
  ctx.strokeStyle = 'rgba(255,90,90,0.28)';
  ctx.beginPath();
  ctx.arc(toX(0), toY(-14), (4.2 / 36) * mapW, 0, Math.PI * 2);
  ctx.stroke();

  // stations
  const st = (x, z, label, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(toX(x) - 5, toY(z) - 5, 10, 10);
    ctx.font = '11px Consolas, monospace';
    ctx.fillStyle = 'rgba(200,255,220,0.45)';
    ctx.fillText(label, toX(x) - 20, toY(z) - 10);
  };
  st(6, 10, 'WICK', 'rgba(255,190,90,0.7)');
  st(13, 10, 'SELL', 'rgba(150,255,180,0.7)');
  st(10, 5.5, 'SHOP', 'rgba(120,200,255,0.7)');
  st(-8, -4, 'AUTO', state.upgrades.auto > 0 ? 'rgba(255,90,90,0.8)' : 'rgba(120,120,120,0.4)');

  // doll
  if (state.doll) {
    const p = state.doll.position;
    const pulse = 0.5 + Math.sin(world.time * 4) * 0.5;
    ctx.fillStyle = `rgba(255,45,45,${0.4 + pulse * 0.4})`;
    ctx.beginPath();
    ctx.arc(toX(p.x), toY(p.z), 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,90,90,0.4)';
    ctx.beginPath(); ctx.arc(toX(p.x), toY(p.z), 15 + pulse * 4, 0, Math.PI * 2); ctx.stroke();
  }

  // player
  if (state.player) {
    const p = state.player.position;
    ctx.fillStyle = 'rgba(130,255,170,0.95)';
    ctx.beginPath(); ctx.arc(toX(p.x), toY(p.z), 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(130,255,170,0.35)';
    ctx.beginPath(); ctx.arc(toX(p.x), toY(p.z), 11, 0, Math.PI * 2); ctx.stroke();
  }

  // johann
  if (state.johann && state.johann.active) {
    const p = state.johann.position;
    ctx.fillStyle = 'rgba(120,200,255,0.95)';
    ctx.beginPath(); ctx.arc(toX(p.x), toY(p.z), 4, 0, Math.PI * 2); ctx.fill();
    ctx.font = '10px Consolas, monospace';
    ctx.fillText('J', toX(p.x) + 7, toY(p.z) + 3);
  }

  // header
  ctx.fillStyle = 'rgba(160,255,200,0.75)';
  ctx.font = 'bold 16px Consolas, monospace';
  ctx.fillText('KAM 01 · WERKSTATT', 24, 28);
  ctx.fillStyle = 'rgba(160,255,200,0.45)';
  ctx.font = '12px Consolas, monospace';
  const t = new Date();
  ctx.fillText(`TAG ${state.day}  ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}:${String(t.getSeconds()).padStart(2, '0')}`, 24, 44);
  ctx.fillStyle = state.door.closed ? 'rgba(150,255,180,0.75)' : 'rgba(255,120,100,0.8)';
  ctx.fillText(state.door.broken ? 'TÜR: AUFGEBROCHEN' : state.door.closed ? 'TÜR: VERRIEGELT' : 'TÜR: OFFEN', W - 190, 28);

  // static noise
  ctx.fillStyle = 'rgba(160,255,200,0.035)';
  for (let i = 0; i < 90; i++) {
    ctx.fillRect(Math.random() * W, Math.random() * H, Math.random() * 3, 1);
  }
  // scanlines
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  // vignette
  const grd = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.78);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  world.monitorTex.needsUpdate = true;
}
