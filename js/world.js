import * as THREE from 'three';
import {
  concreteTexture, wallTexture, woodTexture, metalTexture, signTexture,
  hazardTexture, glowTexture, monitorTexture, corrugatedTexture,
  paintedWallTexture, tileTexture
} from './textures.js';

export const WORLD = {
  bounds: { minX: -18, maxX: 18, minZ: -22, maxZ: 22, height: 10.5 },
  safe: { minX: 8, maxX: 18, minZ: 8, maxZ: 22 },
  door: {
    hingeX: 8,
    hingeZ: 12.95,
    x: 8,
    z: 14.6,
    width: 3.3,
    height: 3.3,
    outside: new THREE.Vector3(6.55, 0, 14.6),
    inside: new THREE.Vector3(9.55, 0, 14.6),
    collider: { minX: 7.78, maxX: 8.22, minZ: 12.8, maxZ: 16.4 }
  },
  dollHome: new THREE.Vector3(0, 0.62, -14),
  spawn: new THREE.Vector3(0, 0, 15.5),
  spawn2: new THREE.Vector3(-2.6, 0, 17.4),
  respawnSafe: new THREE.Vector3(10.4, 0, 19.2),
  winder: new THREE.Vector3(-11.8, 0, 14.4),
  sell: new THREE.Vector3(-11.8, 0, 18.9),
  shop: new THREE.Vector3(12.4, 0, -2.8),
  spinner: new THREE.Vector3(-13.2, 0, -14.6),
  bed: new THREE.Vector3(15.5, 0, 19.2),
  monitor: new THREE.Vector3(17.34, 2.25, 10.9),
  rooms: [
    { id: 'hall', name: 'PUPPENHALLE', minX: -8, maxX: 8, minZ: -22, maxZ: 22 },
    { id: 'lm', name: 'MASCHINEN WEST', minX: -18, maxX: -8, minZ: -22, maxZ: -8 },
    { id: 'ls', name: 'LAGER WEST', minX: -18, maxX: -8, minZ: -8, maxZ: 4 },
    { id: 'lp', name: 'SPULEN & VERKAUF', minX: -18, maxX: -8, minZ: 4, maxZ: 22 },
    { id: 'rm', name: 'MASCHINEN OST', minX: 8, maxX: 18, minZ: -22, maxZ: -8 },
    { id: 'rs', name: 'LAGER OST', minX: 8, maxX: 18, minZ: -8, maxZ: 8 },
    { id: 'safe', name: 'SAFE ROOM', minX: 8, maxX: 18, minZ: 8, maxZ: 22 }
  ],
  portals: [
    { id: 'w-mach', a: 'hall', b: 'lm', x: -8, z: -15 },
    { id: 'w-store', a: 'hall', b: 'ls', x: -8, z: -2 },
    { id: 'w-spool', a: 'hall', b: 'lp', x: -8, z: 14.5 },
    { id: 'e-mach', a: 'hall', b: 'rm', x: 8, z: -15 },
    { id: 'e-store', a: 'hall', b: 'rs', x: 8, z: -2 },
    { id: 'safe-door', a: 'hall', b: 'safe', x: 8, z: 14.6 },
    { id: 'lm-ls', a: 'lm', b: 'ls', x: -13.5, z: -8 },
    { id: 'ls-lp', a: 'ls', b: 'lp', x: -13.5, z: 4 },
    { id: 'rm-rs', a: 'rm', b: 'rs', x: 13.5, z: -8 }
  ],
  zones: [
    {
      id: 'arm_l', name: 'LINKER ARM', label: 'ARM L', pos: new THREE.Vector3(-3.6, 0, -11.4),
      radius: 2.5, rate: 1.0, cap: 620, risk: 1.0, requiresLadder: false,
      weights: { white: 0.88, red: 0.09, black: 0.025, gold: 0.005 }
    },
    {
      id: 'arm_r', name: 'RECHTER ARM', label: 'ARM R', pos: new THREE.Vector3(3.6, 0, -11.4),
      radius: 2.5, rate: 1.0, cap: 620, risk: 1.0, requiresLadder: false,
      weights: { white: 0.88, red: 0.09, black: 0.025, gold: 0.005 }
    },
    {
      id: 'skirt', name: 'BEINE / SCHOSS', label: 'BEINE', pos: new THREE.Vector3(0, 0, -9.2),
      radius: 2.7, rate: 1.15, cap: 1100, risk: 0.9, requiresLadder: false,
      weights: { white: 0.9, red: 0.08, black: 0.016, gold: 0.004 }
    },
    {
      id: 'back', name: 'RÜCKEN', label: 'RÜCKEN', pos: new THREE.Vector3(0, 0, -18.7),
      radius: 2.5, rate: 0.85, cap: 560, risk: 1.35, requiresLadder: false,
      weights: { white: 0.6, red: 0.22, black: 0.13, gold: 0.05 }
    },
    {
      id: 'head', name: 'KOPF', label: 'KOPF', pos: new THREE.Vector3(-3.4, 0, -16.9),
      radius: 2.2, rate: 0.75, cap: 380, risk: 1.6, requiresLadder: true,
      weights: { white: 0.35, red: 0.3, black: 0.22, gold: 0.13 }
    }
  ]
};

/* ============================================================ */
/* Room navigation                                              */
/* ============================================================ */
export function roomAt(pos) {
  for (const r of WORLD.rooms) {
    if (pos.x >= r.minX && pos.x <= r.maxX && pos.z >= r.minZ && pos.z <= r.maxZ) return r.id;
  }
  return 'hall';
}

function portalPath(fromId, toId) {
  if (fromId === toId) return [];
  const seen = { [fromId]: true };
  const prev = {};
  const queue = [fromId];
  while (queue.length) {
    const cur = queue.shift();
    for (const p of WORLD.portals) {
      const next = p.a === cur ? p.b : (p.b === cur ? p.a : null);
      if (!next || seen[next]) continue;
      seen[next] = true;
      prev[next] = { room: cur, portal: p };
      if (next === toId) {
        const path = [];
        let step = toId;
        while (step !== fromId) {
          const e = prev[step];
          if (!e) return [];
          path.unshift(e.portal);
          step = e.room;
        }
        return path;
      }
      queue.push(next);
    }
  }
  return [];
}

function portalNormal(p) {
  const a = WORLD.rooms.find(r => r.id === p.a);
  const b = WORLD.rooms.find(r => r.id === p.b);
  if (!a || !b) return { x: 0, z: 1 };
  if (Math.abs(a.maxX - b.minX) < 0.01) return { x: 1, z: 0 };
  if (Math.abs(b.maxX - a.minX) < 0.01) return { x: -1, z: 0 };
  if (Math.abs(a.maxZ - b.minZ) < 0.01) return { x: 0, z: 1 };
  return { x: 0, z: -1 };
}

export function navWaypoint(from, to) {
  const a = roomAt(from);
  const b = roomAt(to);
  if (a === b) return to;
  const path = portalPath(a, b);
  if (!path.length) return to;
  const p = path[0];
  const d = Math.hypot(from.x - p.x, from.z - p.z);
  const n = portalNormal(p);
  const sign = a === p.a ? 1 : -1;
  const lateral = Math.abs(n.x) > 0.5 ? Math.abs(from.z - p.z) : Math.abs(from.x - p.x);
  if (d < 3.0 && lateral < 1.5) {
    // aligned with the threshold: step through to the far side
    return { x: p.x + n.x * sign * 2.6, z: p.z + n.z * sign * 2.6 };
  }
  // approach the threshold from open floor, not along a wall face
  return { x: p.x - n.x * sign * 2.2, z: p.z - n.z * sign * 2.2 };
}

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
  const corrTex = corrugatedTexture();
  const tileTex = tileTexture();

  const M = {
    floor: new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.94, metalness: 0.04, color: 0xbcbcbc }),
    floorWood: new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.9, color: 0x8f8a80 }),
    floorMetal: new THREE.MeshStandardMaterial({ map: metalTex, roughness: 0.7, metalness: 0.35, color: 0x7d8388 }),
    floorTile: new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.8, color: 0xb9beb4 }),
    wall: new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.82, metalness: 0.25, color: 0x9a9e9f }),
    wallPaint: new THREE.MeshStandardMaterial({ map: paintedWallTexture('#49524e'), roughness: 0.88, metalness: 0.08, color: 0xbfc4bf }),
    wallCorr: new THREE.MeshStandardMaterial({ map: corrTex, roughness: 0.6, metalness: 0.62, color: 0x9da3a5 }),
    wallSafe: new THREE.MeshStandardMaterial({ map: paintedWallTexture('#435449'), roughness: 0.86, metalness: 0.06, color: 0xb9c4b7 }),
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
    denim: new THREE.MeshStandardMaterial({ color: 0x35465a, roughness: 0.95 }),
    yarnWhite: new THREE.MeshStandardMaterial({ color: 0xd9d0c2, roughness: 1 }),
    yarnRed: new THREE.MeshStandardMaterial({ color: 0x8c2f2f, roughness: 1 }),
    yarnGold: new THREE.MeshStandardMaterial({ color: 0xb88a3a, roughness: 1 }),
    emissive: (hex, intensity = 1) => new THREE.MeshStandardMaterial({
      color: hex, emissive: hex, emissiveIntensity: intensity, roughness: 0.5
    })
  };

  const room = new THREE.Group();
  scene.add(room);

  const wallCollider = (minX, maxX, minZ, maxZ) => {
    world.colliders.walls.push({ minX, maxX, minZ, maxZ });
  };
  const propCollider = (minX, maxX, minZ, maxZ) => {
    world.colliders.props.push({ minX, maxX, minZ, maxZ });
  };

  /* ---------------- Floor & ceiling ---------------- */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(36, 44), M.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  room.add(floor);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(36, 44), M.ceiling);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = WORLD.bounds.height;
  room.add(ceiling);

  function roomFloor(x, z, w, d, mat) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.006, z);
    mesh.receiveShadow = true;
    room.add(mesh);
  }
  roomFloor(-13, -15, 9.8, 13.8, M.floorMetal);
  roomFloor(-13, -2, 9.8, 11.8, M.floorWood);
  roomFloor(-13, 13, 9.8, 17.8, M.floor);
  roomFloor(13, -15, 9.8, 13.8, M.floorWood);
  roomFloor(13, 0, 9.8, 15.8, M.floorMetal);
  roomFloor(13, 15, 9.8, 13.8, M.floorTile);

  // hall runner and danger lines
  const runnerMat = new THREE.MeshStandardMaterial({ color: 0x4a1717, roughness: 0.96 });
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 21.5), runnerMat);
  runner.rotation.x = -Math.PI / 2;
  runner.position.set(0, 0.012, 0.8);
  room.add(runner);

  const lineMat = new THREE.MeshBasicMaterial({ color: 0xc79a2f, transparent: true, opacity: 0.3 });
  for (const z of [-10.2, -17.8, 12.4]) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(15.4, 0.18), lineMat);
    bar.rotation.x = -Math.PI / 2;
    bar.position.set(0, 0.015, z);
    room.add(bar);
  }

  // steel ceiling beams
  for (let z = -20; z <= 20; z += 8) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(36, 0.4, 0.5), M.metalDark);
    beam.position.set(0, WORLD.bounds.height - 0.35, z);
    room.add(beam);
  }
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 44), M.metalDark);
  spine.position.set(0, WORLD.bounds.height - 0.4, 0);
  room.add(spine);

  // ventilation ducts
  for (const x of [-6.4, 6.4]) {
    const duct = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 44, 12), M.metal);
    duct.rotation.x = Math.PI / 2;
    duct.position.set(x, WORLD.bounds.height - 0.95, 0);
    room.add(duct);
    for (let z = -18; z <= 18; z += 6) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.05, 6, 14), M.metalDark);
      ring.rotation.x = 0;
      ring.position.set(x, WORLD.bounds.height - 0.95, z);
      room.add(ring);
    }
  }

  // skylight panels (emissive)
  const skyMat = M.emissive(0xb9d3e8, 0.6);
  for (const z of [-6, 8]) {
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 2.4), skyMat);
    sky.rotation.x = Math.PI / 2;
    sky.position.set(0, WORLD.bounds.height - 0.08, z);
    room.add(sky);
  }

  /* ---------------- Outer walls ---------------- */
  const wallHeight = WORLD.bounds.height;

  function texturedWallMat(baseMat, repX, repY) {
    const mat = baseMat.clone();
    mat.map = baseMat.map.clone();
    mat.map.needsUpdate = true;
    mat.map.repeat.set(repX, repY);
    mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping;
    return mat;
  }

  function addWall(w, h, d, x, y, z, repX = 4, repY = 2, base = M.wall) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), texturedWallMat(base, repX, repY));
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    room.add(mesh);
    return mesh;
  }

  addWall(36.8, wallHeight, 0.8, 0, wallHeight / 2, -22.2, 7, 2.4);
  addWall(36.8, wallHeight, 0.8, 0, wallHeight / 2, 22.2, 7, 2.4);
  addWall(0.8, wallHeight, 44.8, -18.2, wallHeight / 2, 0, 8, 2.4, M.wallCorr);
  addWall(0.8, wallHeight, 44.8, 18.2, wallHeight / 2, 0, 8, 2.4, M.wallCorr);

  wallCollider(-19, 19, -23, -21.8);
  wallCollider(-19, 19, 21.8, 23);
  wallCollider(-19, -17.8, -23, 23);
  wallCollider(17.8, 19, -23, 23);

  // baseboard trim
  for (const [w, d, x, z] of [[36, 0.15, 0, -21.78], [36, 0.15, 0, 21.78], [0.15, 44, -17.78, 0], [0.15, 44, 17.78, 0]]) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d), M.metalDark);
    trim.position.set(x, 0.25, z);
    room.add(trim);
  }

  /* ---------------- Interior walls & doors ---------------- */
  function interiorWall(x, z, w, d, base = M.wallPaint, repX = 3, repY = 2) {
    addWall(w, wallHeight, d, x, wallHeight / 2, z, repX, repY, base);
    wallCollider(x - w / 2 - 0.02, x + w / 2 + 0.02, z - d / 2 - 0.02, z + d / 2 + 0.02);
  }

  // west wall x=-8: doors at z -15, -2, 14.5
  interiorWall(-8, -19.3, 0.45, 5.4, M.wallPaint);
  interiorWall(-8, -8.5, 0.45, 9.8, M.wallPaint);
  interiorWall(-8, 6.3, 0.45, 13.4, M.wallPaint);
  interiorWall(-8, 19.0, 0.45, 6.0, M.wallPaint);

  // east wall x=8: doors at z -15, -2 and the safe door at 14.6
  interiorWall(8, -19.3, 0.45, 5.4, M.wallCorr);
  interiorWall(8, -8.5, 0.45, 9.8, M.wallCorr);
  interiorWall(8, 6.275, 0.45, 13.35, M.wallCorr);
  interiorWall(8, 19.125, 0.45, 5.75, M.wallCorr);

  // west column dividers z=-8 and z=4
  interiorWall(-16.55, -8, 2.9, 0.45, M.wallPaint);
  interiorWall(-9.95, -8, 3.9, 0.45, M.wallPaint);
  interiorWall(-16.55, 4, 2.9, 0.45, M.wallPaint);
  interiorWall(-9.95, 4, 3.9, 0.45, M.wallPaint);

  // east column divider z=-8 and the solid safe wall at z=8
  interiorWall(9.95, -8, 3.9, 0.45, M.wallCorr);
  interiorWall(16.55, -8, 2.9, 0.45, M.wallCorr);
  interiorWall(13, 8, 10, 0.45, M.wallSafe);

  function doorFrame(axis, fixed, center, width, height = 8.35) {
    const frameMat = M.metalDark;
    if (axis === 'x') {
      for (const z of [center - width / 2 - 0.12, center + width / 2 + 0.12]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, height + 0.2, 0.32), frameMat);
        post.position.set(fixed, (height + 0.2) / 2, z);
        room.add(post);
      }
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, width + 0.6), frameMat);
      lintel.position.set(fixed, height + 0.1, center);
      room.add(lintel);
      const headerH = Math.max(0.4, wallHeight - (height + 0.23));
      const header = new THREE.Mesh(new THREE.BoxGeometry(0.45, headerH, width + 0.72), M.metal);
      header.position.set(fixed, height + 0.23 + headerH / 2, center);
      header.receiveShadow = true;
      room.add(header);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.02, width), M.hazard);
      plate.position.set(fixed, 0.02, center);
      room.add(plate);
    } else {
      for (const x of [center - width / 2 - 0.12, center + width / 2 + 0.12]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.32, height + 0.2, 0.3), frameMat);
        post.position.set(x, (height + 0.2) / 2, fixed);
        room.add(post);
      }
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(width + 0.6, 0.26, 0.3), frameMat);
      lintel.position.set(center, height + 0.1, fixed);
      room.add(lintel);
      const headerH = Math.max(0.4, wallHeight - (height + 0.23));
      const header = new THREE.Mesh(new THREE.BoxGeometry(width + 0.72, headerH, 0.45), M.metal);
      header.position.set(center, height + 0.23 + headerH / 2, fixed);
      header.receiveShadow = true;
      room.add(header);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(width, 0.02, 0.7), M.hazard);
      plate.position.set(center, 0.02, fixed);
      room.add(plate);
    }
  }

  function openDoorLeaf(axis, fixed, center, width, side = 1, tint = 0x354a44) {
    const mat = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.72, metalness: 0.32 });
    if (axis === 'x') {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.12, 8.05, width), mat);
      leaf.position.set(fixed + side * 0.34, 4.03, center + side * width);
      leaf.castShadow = true;
      room.add(leaf);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), M.glass);
      win.rotation.y = side * Math.PI / 2;
      win.position.set(fixed + side * 0.28, 2.1, center + side * width);
      room.add(win);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.24, 8), M.metalDark);
      handle.rotation.z = Math.PI / 2;
      handle.position.set(fixed + side * 0.28, 1.4, center + side * (width - 0.45));
      room.add(handle);
    } else {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(width, 8.05, 0.12), mat);
      leaf.position.set(center + side * width, 4.03, fixed + side * 0.34);
      leaf.castShadow = true;
      room.add(leaf);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), M.glass);
      win.position.set(center + side * width, 2.1, fixed + side * 0.28);
      room.add(win);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.24, 8), M.metalDark);
      handle.rotation.x = Math.PI / 2;
      handle.position.set(center + side * (width - 0.45), 1.4, fixed + side * 0.28);
      room.add(handle);
    }
  }

  // hall side doors
  doorFrame('x', -8, -15, 3.2);
  openDoorLeaf('x', -8, -15, 3.2, -1, 0x40534b);
  doorFrame('x', -8, -2, 3.2);
  openDoorLeaf('x', -8, -2, 3.2, 1, 0x4a4438);
  doorFrame('x', -8, 14.5, 3.0);
  openDoorLeaf('x', -8, 14.5, 3.0, -1, 0x4b3b32);

  doorFrame('x', 8, -15, 3.2);
  openDoorLeaf('x', 8, -15, 3.2, 1, 0x3d4b50);
  doorFrame('x', 8, -2, 3.2);
  openDoorLeaf('x', 8, -2, 3.2, -1, 0x3f4a44);

  // side-room dividers
  doorFrame('z', -8, -13.5, 3.2);
  openDoorLeaf('z', -8, -13.5, 3.2, 1, 0x45403a);
  doorFrame('z', 4, -13.5, 3.2);
  openDoorLeaf('z', 4, -13.5, 3.2, -1, 0x37463f);
  doorFrame('z', -8, 13.5, 3.2);
  openDoorLeaf('z', -8, 13.5, 3.2, -1, 0x3d4550);

  // door signs
  function hangingSign(text, sub, x, y, z, col = '#c79a2f', ry = 0) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(2.25, 1.1), new THREE.MeshBasicMaterial({
      map: signTexture(text, sub, col), side: THREE.DoubleSide
    }));
    s.position.set(x, y, z);
    s.rotation.y = ry;
    room.add(s);
    return s;
  }
  hangingSign('MASCHINEN', 'WESTFLÜGEL', -8, 9.15, -15, '#c79a2f', Math.PI / 2);
  hangingSign('LAGER', 'GARN & WERKZEUG', -8, 9.15, -2, '#9be27a', Math.PI / 2);
  hangingSign('SPULEN', 'WICKELN & VERKAUF', -8, 9.15, 14.5, '#e0a05a', Math.PI / 2);
  hangingSign('MASCHINEN', 'OSTFLÜGEL', 8, 9.15, -15, '#c79a2f', Math.PI / 2);
  hangingSign('LAGER', 'KATALOG', 8, 9.15, -2, '#7bc4ff', Math.PI / 2);
  hangingSign('SAFE ROOM', 'NUR BEI GESCHLOSSENER TÜR', 8, 4.35, 14.6, '#9be27a', Math.PI / 2);

  /* ---------------- Safe room ---------------- */
  const safe = WORLD.safe;

  // functional safe door
  const frameMat = M.metalDark;
  for (const z of [12.82, 16.38]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.34, 3.5, 0.3), frameMat);
    post.position.set(8, 1.75, z);
    room.add(post);
  }
  const safeLintel = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.3, 3.9), frameMat);
  safeLintel.position.set(8, 3.44, 14.6);
  room.add(safeLintel);

  const doorPivot = new THREE.Group();
  doorPivot.position.set(WORLD.door.hingeX, 0, WORLD.door.hingeZ);
  room.add(doorPivot);
  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.3, WORLD.door.width), M.metal);
  doorPanel.position.set(0, 1.65, WORLD.door.width / 2);
  doorPanel.castShadow = true;
  doorPivot.add(doorPanel);
  const doorWin = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), M.glass);
  doorWin.rotation.y = -Math.PI / 2;
  doorWin.position.set(-0.09, 2.25, WORLD.door.width / 2);
  doorPivot.add(doorWin);
  const doorHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), M.metalDark);
  doorHandle.rotation.z = Math.PI / 2;
  doorHandle.position.set(-0.14, 1.42, WORLD.door.width - 0.62);
  doorPivot.add(doorHandle);
  const doorBar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.9, 0.2), M.red);
  doorBar.position.set(-0.11, 1.55, WORLD.door.width / 2);
  doorPivot.add(doorBar);
  for (const y of [0.55, 2.75]) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, WORLD.door.width - 0.3), M.metalDark);
    rib.position.set(-0.08, y, WORLD.door.width / 2);
    doorPivot.add(rib);
  }
  world.doorPivot = doorPivot;

  const srSign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.3), new THREE.MeshBasicMaterial({
    map: signTexture('SAFE ROOM', 'NUR BEI GESCHLOSSENER TÜR', '#9be27a', '#101512'), side: THREE.DoubleSide
  }));
  srSign.rotation.y = -Math.PI / 2;
  srSign.position.set(7.72, 4.4, 14.6);
  room.add(srSign);

  // safe light
  const safeLight = new THREE.PointLight(0xffc98f, 26, 13, 1.3);
  safeLight.position.set(12.2, 4.05, 15.2);
  scene.add(safeLight);
  world.safeLight = safeLight;
  const safeBulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), M.emissive(0xffd9a0, 2));
  safeBulb.position.copy(safeLight.position);
  scene.add(safeBulb);
  const safeCord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 6.3, 6), M.black);
  safeCord.position.set(12.2, 7.35, 15.2);
  scene.add(safeCord);

  // bedside work lamp next to the cot
  const bedLampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.1, 12), M.metalDark);
  bedLampBase.position.set(13.7, 0.05, 20.9);
  room.add(bedLampBase);
  const bedLampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.5, 8), M.metal);
  bedLampPole.position.set(13.7, 0.8, 20.9);
  room.add(bedLampPole);
  const bedLampShade = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.3, 14, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x3a4038, roughness: 0.6, metalness: 0.5, side: THREE.DoubleSide }));
  bedLampShade.position.set(13.7, 1.62, 20.9);
  bedLampShade.rotation.x = Math.PI;
  room.add(bedLampShade);
  const bedLampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), M.emissive(0xffcf8a, 1.8));
  bedLampBulb.position.set(13.7, 1.52, 20.9);
  room.add(bedLampBulb);
  const bedLampLight = new THREE.PointLight(0xffb064, 14, 9, 1.5);
  bedLampLight.position.set(13.7, 1.75, 20.9);
  scene.add(bedLampLight);
  propCollider(13.4, 14.0, 20.6, 21.2);

  // bed along the south-east corner
  const bedGroup = new THREE.Group();
  bedGroup.position.set(WORLD.bed.x, 0, WORLD.bed.z);
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
  propCollider(14.25, 16.75, 17.2, 21.3);

  // rug
  const rugCanvas = document.createElement('canvas');
  rugCanvas.width = 256; rugCanvas.height = 256;
  const rg = rugCanvas.getContext('2d');
  rg.fillStyle = '#4c3d33'; rg.fillRect(0, 0, 256, 256);
  rg.strokeStyle = 'rgba(190,160,110,0.45)'; rg.lineWidth = 10; rg.strokeRect(14, 14, 228, 228);
  rg.strokeStyle = 'rgba(25,20,18,0.5)'; rg.lineWidth = 3;
  for (let i = 0; i < 9; i++) rg.strokeRect(28 + i * 4, 28 + i * 4, 200 - i * 8, 200 - i * 8);
  const rugTex = new THREE.CanvasTexture(rugCanvas);
  rugTex.colorSpace = THREE.SRGBColorSpace;
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 5.2), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(11.7, 0.016, 17.6);
  room.add(rug);

  // bunk shelf, radio, locker
  addShelf(10.6, 0, 8.75, 0, false);
  const radio = new THREE.Group();
  const radioBody = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.32, 0.28), M.metalDark);
  radio.add(radioBody);
  const radioLight = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.02), M.emissive(0x9be27a, 1.2));
  radioLight.position.set(0.18, 0.06, 0.15);
  radio.add(radioLight);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.9, 5), M.metal);
  antenna.position.set(-0.15, 0.55, 0);
  radio.add(antenna);
  radio.position.set(10.6, 1.55, 8.9);
  room.add(radio);

  const locker = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.2, 1.1), M.blue);
  locker.position.set(17.2, 1.1, 9.4);
  locker.castShadow = true;
  room.add(locker);
  propCollider(16.7, 17.7, 8.8, 10.0);

  // camera monitor on the east wall
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
  monGlow.position.set(WORLD.monitor.x - 1.0, 2.2, WORLD.monitor.z);
  scene.add(monGlow);
  world.monitorCanvas = monCanvas;
  world.monitorCtx = monCtx;
  world.monitorTex = monTex;
  world.anim.monitor = monScreen;

  const safeSubSign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.05), new THREE.MeshBasicMaterial({
    map: signTexture('VERRIEGELN', 'SIE HÖRT DEN LÄRM', '#9be27a', '#141a15'), side: THREE.DoubleSide
  }));
  safeSubSign.rotation.y = -Math.PI / 2;
  safeSubSign.position.set(16.9, 3.2, 14.6);
  room.add(safeSubSign);

  /* ---------------- Pedestal & hall dressing ---------------- */
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(3.45, 3.7, 0.62, 48), M.wood);
  pedestal.position.set(0, 0.31, -14);
  pedestal.receiveShadow = true;
  pedestal.castShadow = true;
  room.add(pedestal);
  const pedRim = new THREE.Mesh(new THREE.TorusGeometry(3.55, 0.07, 8, 64), M.emissive(0xc79a2f, 0.6));
  pedRim.rotation.x = -Math.PI / 2;
  pedRim.position.set(0, 0.65, -14);
  room.add(pedRim);
  const dangerRing = new THREE.Mesh(new THREE.RingGeometry(4.55, 4.72, 64), new THREE.MeshBasicMaterial({ color: 0xc79a2f, transparent: true, opacity: 0.32, side: THREE.DoubleSide }));
  dangerRing.rotation.x = -Math.PI / 2;
  dangerRing.position.set(0, 0.018, -14);
  room.add(dangerRing);
  world.colliders.pedestal.push({ type: 'circle', x: 0, z: -14, r: 3.3 });

  function floorLabel(text, x, z, rot = 0, col = '#c79a2f') {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 256, 128);
    g.font = 'bold 54px Consolas, monospace';
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
    p.position.set(x, 0.022, z);
    room.add(p);
  }
  floorLabel('ARM L', -3.6, -11.4);
  floorLabel('ARM R', 3.6, -11.4);
  floorLabel('BEINE', 0, -9.2);
  floorLabel('RÜCKEN', 0, -18.7);
  floorLabel('KOPF', -3.4, -16.9, 0, '#a97cff');

  const bigSign = new THREE.Mesh(
    new THREE.PlaneGeometry(7.2, 3.6),
    new THREE.MeshBasicMaterial({ map: signTexture('ZWIRN & ZORN', 'WEBEREI 07 · SCHICHT 3', '#c79a2f', '#17191a') })
  );
  bigSign.position.set(0, 7.4, -21.75);
  room.add(bigSign);
  const loreSign = new THREE.Mesh(
    new THREE.PlaneGeometry(5.4, 2.4),
    new THREE.MeshBasicMaterial({ map: signTexture('SIE SCHLÄFT', 'NICHT ZU NAH KOMMEN', '#c98a72', '#181414') })
  );
  loreSign.position.set(0, 5.2, 21.75);
  loreSign.rotation.y = Math.PI;
  room.add(loreSign);

  /* ---------------- Wall dressing ---------------- */
  const warnSigns = [
    ['KEIN AUSGANG', 'HINTER DIESER TÜR', 13.2, 6.2, -21.7, 0],
    ['RUHE BEWAHREN', 'SIE HÖRT DEN LÄRM', -12.6, 6.2, -21.7, 0],
    ['SCHICHT 3', 'NACHSCHICHT 22–06', -17.7, 5.3, -2, Math.PI / 2],
    ['FADEN BRICHT', 'NIEMALS ZU VIEL ZIEHEN', 17.7, 5.3, 2, -Math.PI / 2],
    ['SAFE ROOM', 'SCHLÜSSEL NICHT VERLIEREN', -17.7, 5.3, 18, Math.PI / 2]
  ];
  for (const [t, s, x, y, z, ry] of warnSigns) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.4), new THREE.MeshBasicMaterial({ map: signTexture(t, s) }));
    sign.position.set(x, y, z);
    sign.rotation.y = ry;
    room.add(sign);
  }

  // pipes along walls
  function pipeRun(x, y, z, len, vertical) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, len, 12), new THREE.MeshStandardMaterial({ color: 0x4b4036, roughness: 0.92, metalness: 0.3 }));
    if (vertical) p.rotation.x = Math.PI / 2;
    else p.rotation.z = Math.PI / 2;
    p.position.set(x, y, z);
    room.add(p);
    return p;
  }
  pipeRun(-16.9, 8.6, 0, 40, true);
  pipeRun(16.9, 8.8, 0, 40, true);
  pipeRun(-8, 8.6, -21.2, 15, false);
  pipeRun(8, 8.6, -21.2, 15, false);
  pipeRun(-8, 8.4, 20.4, 15, false);
  for (const [x, z] of [[-16.9, -8], [-16.9, 6], [-16.9, 18], [16.9, -12], [16.9, 10], [16.9, 20]]) {
    const valve = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.045, 6, 14), M.rust);
    valve.rotation.y = Math.PI / 2;
    valve.position.set(x + (x < 0 ? 0.2 : -0.2), 8.6, z);
    room.add(valve);
  }

  // hanging chains
  for (const [x, z, len] of [[-6.2, -8, 3.2], [6.2, -18, 2.4], [-6.4, 12, 3.8], [6.4, 4, 2.8], [-14.2, -12, 2.4]]) {
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, len, 6), M.metalDark);
    chain.position.set(x, WORLD.bounds.height - len / 2, z);
    room.add(chain);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 6, 12, Math.PI * 1.5), M.rust);
    hook.position.set(x, WORLD.bounds.height - len - 0.15, z);
    room.add(hook);
  }

  /* ---------------- Props ---------------- */
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
    propCollider(x - size * 0.62, x + size * 0.62, z - size * 0.62, z + size * 0.62);
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
    world.colliders.props.push({ type: 'circle', x, z, r: 0.68 });
  }

  function spoolStack(x, z, n = 5, rot = 0) {
    const pallet = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 1.7), M.wood);
    pallet.position.set(x, 0.08, z);
    pallet.rotation.y = rot;
    room.add(pallet);
    for (let i = 0; i < n; i++) {
      const spool = makeSpoolMesh(0.28, 0.42, i % 3 === 2 ? M.yarnRed : M.yarnWhite);
      spool.position.set(x - 0.65 + (i % 3) * 0.65, 0.5, z - 0.35 + Math.floor(i / 3) * 0.7);
      spool.rotation.set(Math.PI / 2, rot, 0);
      room.add(spool);
    }
    propCollider(x - 1.15, x + 1.15, z - 0.9, z + 0.9);
  }

  function addShelf(x, y, z, rotY, collide = true) {
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
    if (collide) {
      if (Math.abs(Math.sin(rotY)) > 0.7) propCollider(x - 0.55, x + 0.55, z - 1.4, z + 1.4);
      else propCollider(x - 1.4, x + 1.4, z - 0.55, z + 0.55);
    }
  }

  function workbench(x, z, rotY = 0) {
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
    for (let i = 0; i < 3; i++) {
      const s = makeSpoolMesh(0.12, 0.2, i === 1 ? M.yarnRed : M.yarnWhite);
      s.position.set(-0.35 + i * 0.35, 1.39, 0.35);
      bench.add(s);
    }
    bench.position.set(x, 0, z);
    bench.rotation.y = rotY;
    room.add(bench);
    if (Math.abs(Math.sin(rotY)) > 0.7) propCollider(x - 0.85, x + 0.85, z - 1.85, z + 1.85);
    else propCollider(x - 1.85, x + 1.85, z - 0.85, z + 0.85);
  }

  function machineBlock(x, z, w, d, h = 2.6, color = 0x4a5154) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.55 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    body.position.set(x, h / 2, z);
    body.castShadow = true;
    room.add(body);
    const cover = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, h * 0.32, d * 0.7), M.metalDark);
    cover.position.set(x, h + 0.16, z);
    room.add(cover);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), M.emissive(0xffa845, 0.8));
    lamp.position.set(x + w * 0.3, h * 0.7, z + d * 0.5 + 0.03);
    room.add(lamp);
    for (const dx of [-w * 0.35, w * 0.35]) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, d * 0.9), M.metalDark);
      foot.position.set(x + dx, 0.12, z);
      room.add(foot);
    }
    propCollider(x - w / 2 - 0.08, x + w / 2 + 0.08, z - d / 2 - 0.08, z + d / 2 + 0.08);
  }

  function yarnBale(x, z) {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), i % 2 ? M.yarnRed : M.yarnWhite);
      ball.position.set((i % 3) * 0.55 - 0.55, 0.34 + Math.floor(i / 3) * 0.5, (i % 2) * 0.18);
      ball.scale.set(1, 0.78, 1);
      g.add(ball);
    }
    g.position.set(x, 0, z);
    room.add(g);
    propCollider(x - 0.95, x + 0.95, z - 0.6, z + 0.6);
  }

  function hazardStrip(x, z, w, d) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M.hazard);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(x, 0.02, z);
    room.add(strip);
  }

  // machines west
  machineBlock(-16.6, -20.5, 3.0, 1.6, 3.0, 0x4c5357);
  machineBlock(-11.4, -20.5, 3.0, 1.6, 2.4, 0x565044);
  barrel(-16.6, -10.4, 0x365666);
  crate(-16.8, -6.8, 1.6, 0.2);
  hazardStrip(-13.2, -18.3, 7.6, 0.8);

  // storage west
  addShelf(-17.0, 0, -4.6, Math.PI / 2);
  addShelf(-17.0, 0, -0.4, Math.PI / 2);
  spoolStack(-10.4, -5.8, 6);
  crate(-10.3, -1.2, 1.5, -0.15);
  yarnBale(-16.2, -10.4);

  // spool & sell west
  spoolStack(-16.4, 10.0, 4);
  spoolStack(-16.4, 20.4, 6);
  addShelf(-17.0, 0, 13.0, Math.PI / 2);
  barrel(-10.2, 8.8, 0x5d4a2d);
  crate(-16.2, 5.8, 1.5, 0.1);
  yarnBale(-15.4, 17.8);
  hazardStrip(-12.0, 12.6, 4.0, 0.7);

  // machines east
  workbench(13.2, -20.8);
  machineBlock(9.3, -20.5, 2.2, 1.5, 2.8, 0x4a4f56);
  barrel(16.5, -9.6, 0x4d5b33);
  crate(16.6, -19.4, 1.5, 0.3);
  hazardStrip(13.0, -18.4, 7.4, 0.8);

  // storage east
  addShelf(17.0, 0, -5.8, -Math.PI / 2);
  addShelf(17.0, 0, -0.8, -Math.PI / 2);
  crate(10.3, 5.6, 1.5, 0.2);
  yarnBale(15.6, 5.4);
  spoolStack(15.4, -6.2, 3);

  // hall south / north corners
  crate(-6.6, 20.6, 1.6, 0.2);
  barrel(6.4, 20.8, 0x4d5b33);
  crate(6.6, -21.0, 1.5, -0.2);

  /* ---------------- Lamps ---------------- */
  function hangingLamp(x, z, intensity = 60) {
    const g = new THREE.Group();
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 2.4, 5), M.black);
    cable.position.y = WORLD.bounds.height - 1.2;
    g.add(cable);
    const shadeMat = new THREE.MeshStandardMaterial({ color: 0x2e3436, roughness: 0.5, metalness: 0.7, side: THREE.DoubleSide });
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.5, 20, 1, true), shadeMat);
    shade.position.y = WORLD.bounds.height - 2.45;
    shade.rotation.x = Math.PI;
    g.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), M.emissive(0xffc176, 2));
    bulb.position.y = WORLD.bounds.height - 2.62;
    g.add(bulb);
    const light = new THREE.PointLight(0xffc07a, intensity, 24, 1.35);
    light.position.set(0, WORLD.bounds.height - 2.75, 0);
    g.add(light);
    g.position.set(x, 0, z);
    scene.add(g);
    world.lamps.push({ light, bulb, base: intensity, flicker: Math.random() * 10 });
    return g;
  }
  for (const [x, z] of [[-6.2, -9], [6.2, -9], [-5.8, 7], [5.8, 7], [0, 17.5]]) hangingLamp(x, z, 62);
  hangingLamp(-13.2, -17.2, 38);
  hangingLamp(-12.6, 9.8, 42);
  hangingLamp(13.4, -17.4, 40);
  hangingLamp(13.0, 2.4, 34);
  // second lamp per side room so the 14 m deep wings are readable
  hangingLamp(-13.2, -11.0, 36);
  hangingLamp(-12.8, -2.4, 40);
  hangingLamp(-12.6, 17.4, 36);
  hangingLamp(13.2, -11.2, 36);
  hangingLamp(12.8, -4.6, 34);

  // emissive strip lights for side rooms
  for (const [x, z, ry] of [[-17.2, -14, Math.PI / 2], [-17.2, -2, Math.PI / 2], [-17.2, 12, Math.PI / 2], [17.2, -14, -Math.PI / 2], [17.2, 0, -Math.PI / 2]]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 2.6), M.emissive(0xbfe0ff, 0.85));
    strip.position.set(x, 5.6, z);
    strip.rotation.y = ry;
    room.add(strip);
  }

  // emergency red lights
  for (const [x, z] of [[-17.6, 0], [17.6, 0], [-17.6, 14], [17.6, 16], [6.2, -21.5], [-6.2, -21.5]]) {
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.45, 0.3), M.metalDark);
    housing.position.set(x, 6.5, z);
    room.add(housing);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), M.emissive(0xff1a1a, 0.1));
    lamp.position.set(x + (x < 0 ? 0.18 : -0.18), 6.5, z);
    room.add(lamp);
    const light = new THREE.PointLight(0xff1c1c, 0, 24, 1.4);
    light.position.copy(lamp.position);
    scene.add(light);
    world.emergency.push({ light, lamp });
  }

  /* ---------------- Stations ---------------- */
  buildWinder(room, M, world, WORLD.winder.x, WORLD.winder.z, Math.PI / 2);
  buildSellStation(room, M, world, WORLD.sell.x, WORLD.sell.z, Math.PI / 2);
  buildShopTerminal(room, M, world, WORLD.shop.x, WORLD.shop.z, 0.25);
  buildSpinner(room, M, world, WORLD.spinner.x, WORLD.spinner.z);
  buildLadder(room, M, world);

  hangingSign('WICKLER', 'FADEN AUFSPULEN', -11.4, 3.5, 13.7, '#c79a2f', Math.PI / 2);
  hangingSign('VERKAUF', 'SPULEN GEGEN BAR', -11.4, 3.6, 18.9, '#9be27a', Math.PI / 2);
  hangingSign('KATALOG', 'UPGRADES', 12.4, 3.3, -1.2, '#7bc4ff', Math.PI / 2);
  hangingSign('SPINNER', 'AUTO-BETRIEB', -13.2, 3.6, -13.0, '#c79a2f', Math.PI / 2);

  /* ---------------- Dust ---------------- */
  const dustGeo = new THREE.BufferGeometry();
  const N = 480;
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

    const t = world.lightTargets;
    const k = 1 - Math.pow(0.001, dt);
    hemi.intensity += (t.hemi - hemi.intensity) * k;
    dir.intensity += (t.dir - dir.intensity) * k;
    if (world.safeLight) world.safeLight.intensity += ((world.lightsOut > 0 ? 4 : t.safe) - world.safeLight.intensity) * k;
    scene.fog.density += (t.fog - scene.fog.density) * k;

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

    if (doorPivot) {
      const diff = world.doorTarget - doorPivot.rotation.y;
      doorPivot.rotation.y += diff * Math.min(1, dt * 6);
    }

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

    if (world.anim.winderSpool) {
      const active = world.anim.winderActive;
      world.anim.winderSpool.rotation.x += dt * (active ? 12 : 0.5);
      world.anim.winderLight.material.emissiveIntensity = active ? 2.4 : 0.5;
    }

    if (world.anim.spinnerWheel) {
      if (world.anim.spinnerOwned && world.anim.spinnerRunning && !world.anim.spinnerBroken) {
        world.anim.spinnerWheel.rotation.z += dt * 4.5;
        world.anim.spinnerPiston.position.y = 0.9 + Math.sin(world.time * 5) * 0.22;
      }
    }

    world.monitorTimer -= dt;
    if (world.monitorTimer <= 0 && gameState) {
      world.monitorTimer = 0.12;
      drawMonitor(world, gameState);
    }

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

function buildWinder(room, M, world, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
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
  // spare spool rack
  for (let i = 0; i < 3; i++) {
    const s = makeSpoolMesh(0.12, 0.22, i === 1 ? M.yarnRed : M.yarnWhite);
    s.position.set(-1.18, 1.28 + i * 0.24, 0.25);
    s.rotation.z = Math.PI / 2;
    g.add(s);
  }
  room.add(g);
  const halfX = Math.abs(Math.sin(rotY)) > 0.7 ? 0.75 : 1.5;
  const halfZ = Math.abs(Math.sin(rotY)) > 0.7 ? 1.5 : 0.75;
  world.colliders.props.push({ minX: x - halfX, maxX: x + halfX, minZ: z - halfZ, maxZ: z + halfZ });
  world.anim.winderSpool = spool;
  world.anim.winderLight = light;
}

function buildSellStation(room, M, world, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.1, 1.2), M.wood);
  counter.position.y = 0.55;
  counter.castShadow = true;
  g.add(counter);
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.08, 1.35), M.metalDark);
  top.position.y = 1.14;
  g.add(top);
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
  // price board
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshBasicMaterial({
    map: signTexture('PREISLISTE', 'WEISS 1 · ROT 2,5 · SCHWARZ 6 · GOLD 18', '#e0c07a', '#131614'), side: THREE.DoubleSide
  }));
  board.position.set(0, 2.1, -0.6);
  g.add(board);
  room.add(g);
  const halfX = Math.abs(Math.sin(rotY)) > 0.7 ? 0.72 : 1.55;
  const halfZ = Math.abs(Math.sin(rotY)) > 0.7 ? 1.55 : 0.72;
  world.colliders.props.push({ minX: x - halfX, maxX: x + halfX, minZ: z - halfZ, maxZ: z + halfZ });
}

function buildShopTerminal(room, M, world, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
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
  // small shelf with sample spools
  for (let i = 0; i < 3; i++) {
    const s = makeSpoolMesh(0.11, 0.2, i === 0 ? M.yarnGold : (i === 1 ? M.yarnRed : M.yarnWhite));
    s.position.set(-0.62 + i * 0.3, 1.18, 0.5);
    g.add(s);
  }
  // little sign lamp
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), M.emissive(0x7bc4ff, 1.5));
  lamp.position.set(0.7, 2.2, 0.1);
  g.add(lamp);
  room.add(g);
  const halfX = Math.abs(Math.sin(rotY)) > 0.7 ? 0.48 : 0.95;
  const halfZ = Math.abs(Math.sin(rotY)) > 0.7 ? 0.95 : 0.48;
  world.colliders.props.push({ minX: x - halfX, maxX: x + halfX, minZ: z - halfZ, maxZ: z + halfZ });
}

function buildSpinner(room, M, world, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
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
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.85), new THREE.MeshBasicMaterial({ map: signTexture('AUTO\nSPINNER', 'LÄRMFAKTOR HOCH', '#c79a2f', '#141615') }));
  sign.position.set(0, 2.45, 0.62);
  g.add(sign);
  room.add(g);

  const glow = new THREE.PointLight(0x59e07a, 0, 9, 1.4);
  glow.position.set(x, 1.6, z + 1.1);
  room.add(glow);
  world.colliders.props.push({ minX: x - 1.3, maxX: x + 1.3, minZ: z - 0.9, maxZ: z + 0.9 });
  world.anim.spinnerWheel = wheel;
  world.anim.spinnerPiston = piston;
  world.anim.spinnerLight = light;
  world.anim.spinnerGlow = glow;
  world.anim.spinnerOwned = false;
  world.anim.spinnerRunning = false;
  world.anim.spinnerBroken = false;
}

function buildLadder(room, M, world) {
  const head = WORLD.zones.find(z => z.id === 'head');
  const g = new THREE.Group();
  g.position.set(head.pos.x, 0, head.pos.z);
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

  const padX = 30, padY = 46;
  const mapW = W - padX * 2;
  const mapH = H - padY - 24;
  const toX = (x) => padX + ((x - (-18)) / 36) * mapW;
  const toY = (z) => padY + ((z - (-22)) / 44) * mapH;

  ctx.strokeStyle = 'rgba(110,220,160,0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 12; i++) {
    ctx.beginPath(); ctx.moveTo(padX + (mapW / 12) * i, padY); ctx.lineTo(padX + (mapW / 12) * i, padY + mapH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(padX, padY + (mapH / 12) * i); ctx.lineTo(padX + mapW, padY + (mapH / 12) * i); ctx.stroke();
  }

  // rooms
  for (const r of WORLD.rooms) {
    const x = toX(r.minX), z = toY(r.minZ);
    const w = toX(r.maxX) - x, h = toY(r.maxZ) - z;
    if (r.id === 'safe') {
      ctx.fillStyle = 'rgba(120,230,160,0.12)';
      ctx.fillRect(x, z, w, h);
      ctx.strokeStyle = 'rgba(150,255,190,0.55)';
    } else {
      ctx.strokeStyle = 'rgba(130,255,190,0.32)';
    }
    ctx.lineWidth = r.id === 'hall' ? 2 : 1.4;
    ctx.strokeRect(x, z, w, h);
    ctx.fillStyle = 'rgba(160,255,200,0.34)';
    ctx.font = '9px Consolas, monospace';
    ctx.fillText(r.name, x + 4, z + 11);
  }

  // door gaps
  ctx.strokeStyle = 'rgba(255,210,120,0.7)';
  ctx.lineWidth = 3;
  for (const p of WORLD.portals) {
    ctx.beginPath();
    ctx.moveTo(toX(p.x) - 4, toY(p.z));
    ctx.lineTo(toX(p.x) + 4, toY(p.z));
    ctx.stroke();
  }

  // doll platform
  ctx.strokeStyle = 'rgba(255,90,90,0.3)';
  ctx.beginPath();
  ctx.arc(toX(0), toY(-14), (3.45 / 36) * mapW, 0, Math.PI * 2);
  ctx.stroke();

  // stations
  const st = (x, z, label, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(toX(x) - 4, toY(z) - 4, 8, 8);
    ctx.font = '10px Consolas, monospace';
    ctx.fillStyle = 'rgba(200,255,220,0.5)';
    ctx.fillText(label, toX(x) - 14, toY(z) - 8);
  };
  st(WORLD.winder.x, WORLD.winder.z, 'WICK', 'rgba(255,190,90,0.7)');
  st(WORLD.sell.x, WORLD.sell.z, 'SELL', 'rgba(150,255,180,0.7)');
  st(WORLD.shop.x, WORLD.shop.z, 'SHOP', 'rgba(120,200,255,0.7)');
  st(WORLD.spinner.x, WORLD.spinner.z, 'AUTO', state.upgrades.auto > 0 ? 'rgba(255,90,90,0.8)' : 'rgba(120,120,120,0.4)');
  st(WORLD.door.x, WORLD.door.z, 'TÜR', state.door.closed ? 'rgba(150,255,180,0.7)' : 'rgba(255,130,90,0.8)');

  if (state.doll) {
    const p = state.doll.position;
    const pulse = 0.5 + Math.sin(world.time * 4) * 0.5;
    ctx.fillStyle = `rgba(255,45,45,${0.4 + pulse * 0.4})`;
    ctx.beginPath();
    ctx.arc(toX(p.x), toY(p.z), 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,90,90,0.4)';
    ctx.beginPath(); ctx.arc(toX(p.x), toY(p.z), 14 + pulse * 4, 0, Math.PI * 2); ctx.stroke();
  }

  if (state.player) {
    const p = state.player.position;
    ctx.fillStyle = 'rgba(130,255,170,0.95)';
    ctx.beginPath(); ctx.arc(toX(p.x), toY(p.z), 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(130,255,170,0.35)';
    ctx.beginPath(); ctx.arc(toX(p.x), toY(p.z), 11, 0, Math.PI * 2); ctx.stroke();
  }

  if (state.johann && state.johann.active) {
    const p = state.johann.position;
    ctx.fillStyle = 'rgba(120,200,255,0.95)';
    ctx.beginPath(); ctx.arc(toX(p.x), toY(p.z), 4, 0, Math.PI * 2); ctx.fill();
    ctx.font = '10px Consolas, monospace';
    ctx.fillText('J', toX(p.x) + 7, toY(p.z) + 3);
  }

  ctx.fillStyle = 'rgba(160,255,200,0.75)';
  ctx.font = 'bold 16px Consolas, monospace';
  ctx.fillText('KAM 01 · WERKSTATT', 20, 26);
  ctx.fillStyle = 'rgba(160,255,200,0.45)';
  ctx.font = '12px Consolas, monospace';
  const t = new Date();
  ctx.fillText(`TAG ${state.day}  ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}:${String(t.getSeconds()).padStart(2, '0')}`, 20, 41);
  ctx.fillStyle = state.door.closed ? 'rgba(150,255,180,0.75)' : 'rgba(255,120,100,0.8)';
  ctx.fillText(state.door.broken ? 'TÜR: AUFGEBROCHEN' : state.door.closed ? 'TÜR: VERRIEGELT' : 'TÜR: OFFEN', W - 190, 26);

  ctx.fillStyle = 'rgba(160,255,200,0.035)';
  for (let i = 0; i < 90; i++) {
    ctx.fillRect(Math.random() * W, Math.random() * H, Math.random() * 3, 1);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  const grd = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.78);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  world.monitorTex.needsUpdate = true;
}
