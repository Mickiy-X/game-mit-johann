import * as THREE from 'three';
import { WORLD, resolveCircle } from './world.js';
import { faceTexture, dressTexture } from './textures.js';
function stainTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  grd.addColorStop(0, 'rgba(20,10,8,0.85)');
  grd.addColorStop(0.5, 'rgba(30,18,14,0.45)');
  grd.addColorStop(1, 'rgba(30,18,14,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function yarnTube(points, radius, color, opacity = 0.9) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const geo = new THREE.TubeGeometry(curve, 22, radius, 5, false);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 1, transparent: true, opacity });
  const mesh = new THREE.Mesh(geo, mat);
  return mesh;
}

export class Doll {
  constructor(scene) {
    this.scene = scene;
    this.home = WORLD.dollHome.clone();
    this.group = new THREE.Group();
    this.group.position.copy(this.home);
    scene.add(this.group);
    this.sway = new THREE.Group();
    this.group.add(this.sway);

    this.stage = 0;
    this.time = 0;
    this.moving = false;
    this.baseY = this.home.y;
    this.stepTimer = 0;
    this.headTwitchTimer = 4;
    this.twitch = 0;
    this.eyeGlow = 0;
    this.zones = {};
    this.depleted = {};

    this.build();
    this.setStage(1, true);
  }

  get position() { return this.group.position; }

  build() {
    const porcelainMat = new THREE.MeshStandardMaterial({ color: 0xe9ddd4, roughness: 0.42, metalness: 0.04 });
    this.porcelainMat = porcelainMat;
    this.dressMat = new THREE.MeshStandardMaterial({ map: dressTexture(1), roughness: 0.94 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x17110f, roughness: 0.82 });
    const yarnMat = new THREE.MeshStandardMaterial({ color: 0xd8cfc0, roughness: 1 });
    const yarnRedMat = new THREE.MeshStandardMaterial({ color: 0x7c2d2d, roughness: 1 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x2a1d18, roughness: 0.72 });
    this.socketMat = new THREE.MeshStandardMaterial({ color: 0x150d0c, roughness: 0.55 });
    this.pupilMat = new THREE.MeshStandardMaterial({ color: 0x280000, emissive: 0xff1c1c, emissiveIntensity: 0.05, roughness: 0.25 });

    // Dress
    const dress = new THREE.Mesh(new THREE.ConeGeometry(3.15, 4.85, 44, 1, true), this.dressMat);
    dress.position.y = 2.42;
    dress.castShadow = true;
    dress.receiveShadow = true;
    this.sway.add(dress);
    this.dressMesh = dress;
    // dress top shell
    const bodice = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.65, 1.0, 26), this.dressMat);
    bodice.position.y = 4.55;
    bodice.castShadow = true;
    this.sway.add(bodice);

    // torso
    const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 30, 22), porcelainMat);
    torso.scale.set(1.48, 1.35, 1.1);
    torso.position.y = 5.18;
    torso.castShadow = true;
    this.sway.add(torso);
    this.torso = torso;

    // lace collar
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.09, 7, 24), new THREE.MeshStandardMaterial({ color: 0xd9cfc2, roughness: 0.9 }));
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 6.06;
    this.sway.add(collar);

    // buttons
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), new THREE.MeshStandardMaterial({ color: 0x3b2b26, roughness: 0.5 }));
      b.position.set(0, 5.45 - i * 0.32, 1.28 - i * 0.03);
      this.sway.add(b);
    }

    // neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.46, 0.55, 14), porcelainMat);
    neck.position.y = 6.22;
    this.sway.add(neck);

    // head
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 6.98, 0);
    this.sway.add(this.headGroup);
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.28, 32, 24), porcelainMat);
    head.scale.set(1, 1.08, 1.02);
    head.castShadow = true;
    this.headGroup.add(head);
    this.head = head;

    // curved face decal, pushed just outside the porcelain surface
    const faceGeo = new THREE.PlaneGeometry(1.86, 1.86, 26, 26);
    const fpos = faceGeo.attributes.position;
    const R = 1.34;
    for (let i = 0; i < fpos.count; i++) {
      const x = fpos.getX(i);
      const y = fpos.getY(i);
      const yy = y / 1.08;
      const inside = Math.max(0, 1 - (x / R) ** 2 - (yy / R) ** 2);
      fpos.setZ(i, R * Math.sqrt(inside) + 0.02);
    }
    faceGeo.computeVertexNormals();
    this.faceMat = new THREE.MeshStandardMaterial({
      map: faceTexture(1), transparent: true, roughness: 0.42,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2
    });
    const face = new THREE.Mesh(faceGeo, this.faceMat);
    face.position.set(0, 0.03, 0.01);
    this.headGroup.add(face);
    this.face = face;

    // eyes
    this.eyeSockets = new THREE.Group();
    for (const sx of [-1, 1]) {
      const socket = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 12), this.socketMat);
      socket.scale.set(1, 1.15, 0.5);
      socket.position.set(sx * 0.42, 0.16, 1.24);
      this.eyeSockets.add(socket);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), this.pupilMat.clone());
      pupil.position.set(sx * 0.42, 0.16, 1.275);
      pupil.userData.base = sx;
      this.eyeSockets.add(pupil);
    }
    this.pupils = this.eyeSockets.children.filter(c => c.geometry.parameters.radius < 0.1);
    this.headGroup.add(this.eyeSockets);

    // faint eye glow light
    this.eyeLight = new THREE.PointLight(0xff2020, 0, 8, 1.4);
    this.eyeLight.position.set(0, 0.16, 1.5);
    this.headGroup.add(this.eyeLight);

    // hair cap: top only, so the face stays visible
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(1.33, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.34),
      hairMat
    );
    cap.position.set(0, 0.16, -0.04);
    cap.scale.set(1.01, 1.0, 1.02);
    this.headGroup.add(cap);

    // bangs across the forehead
    for (let i = -2; i <= 2; i++) {
      const bang = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), hairMat);
      bang.scale.set(0.9, 0.55, 0.55);
      bang.position.set(i * 0.36, 0.94 - Math.abs(i) * 0.06, 0.9 - Math.abs(i) * 0.03);
      bang.rotation.z = i * 0.12;
      this.headGroup.add(bang);
    }

    // side locks framing the face
    for (const sx of [-1, 1]) {
      const lock = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), hairMat);
      lock.scale.set(0.55, 1.35, 0.75);
      lock.position.set(sx * 1.16, -0.1, 0.35);
      this.headGroup.add(lock);
    }

    const backHair = new THREE.Mesh(new THREE.SphereGeometry(1.12, 20, 16), hairMat);
    backHair.scale.set(1.12, 1.2, 0.85);
    backHair.position.set(0, -0.22, -0.5);
    this.headGroup.add(backHair);
    for (const sx of [-1, 1]) {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 10), hairMat);
      bun.position.set(sx * 1.05, 0.38, -0.18);
      this.headGroup.add(bun);
    }

    // long hair strands (appear at higher stages)
    this.longHair = new THREE.Group();
    const longHairMat = new THREE.MeshStandardMaterial({ color: 0x191311, roughness: 0.9 });
    for (let i = 0; i < 5; i++) {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.03, 2.6 + Math.random(), 5), longHairMat);
      h.position.set(-0.8 + i * 0.4, -1.0, -0.85);
      h.rotation.z = (i - 2) * 0.05;
      h.rotation.x = -0.12;
      this.longHair.add(h);
    }
    this.longHair.visible = false;
    this.headGroup.add(this.longHair);

    // arms
    const makeArm = (side) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 1.42, 5.55, 0);
      shoulder.rotation.z = side * 0.2;
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 2.3, 12), porcelainMat);
      upper.position.y = -1.15;
      upper.castShadow = true;
      shoulder.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = -2.3;
      shoulder.add(elbow);
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 2.1, 12), porcelainMat);
      fore.position.y = -1.05;
      fore.castShadow = true;
      elbow.add(fore);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.33, 14, 10), porcelainMat);
      hand.scale.set(0.9, 1.25, 0.7);
      hand.position.y = -2.18;
      elbow.add(hand);
      // long creepy fingers
      for (let i = 0; i < 4; i++) {
        const f = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.02, 0.6, 5), porcelainMat);
        f.position.set(-0.15 + i * 0.1, -2.45, 0.06);
        f.rotation.x = 0.2 + i * 0.03;
        elbow.add(f);
      }
      this.sway.add(shoulder);
      return { shoulder, elbow, hand };
    };
    this.armL = makeArm(-1);
    this.armR = makeArm(1);

    // feet peeking out
    for (const sx of [-1, 1]) {
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.22, 1.15), shoeMat);
      shoe.position.set(sx * 0.85, 0.11, 2.35);
      shoe.rotation.y = sx * 0.15;
      shoe.castShadow = true;
      this.sway.add(shoe);
    }

    // decorative yarn strands
    this.strandMeshes = [];
    const strands = [
      { tag: 'arm_l', pts: [[-2.1, 1.3, 0.5], [-2.6, 0.6, 1.0], [-3.1, 0.02, 1.4]], color: 0xd8cfc0 },
      { tag: 'arm_r', pts: [[2.1, 1.3, 0.5], [2.7, 0.6, 1.1], [3.2, 0.02, 1.5]], color: 0xd8cfc0 },
      { tag: 'skirt', pts: [[0.6, 0.25, 3.05], [1.2, 0.12, 3.3], [2.0, 0.02, 3.6]], color: 0xb03a3a },
      { tag: 'skirt', pts: [[-1.0, 0.6, 2.85], [-1.7, 0.3, 3.1], [-2.4, 0.02, 3.4]], color: 0xd8cfc0 },
      { tag: 'back', pts: [[0.4, 1.4, -2.4], [0.9, 0.7, -2.9], [1.6, 0.02, -3.2]], color: 0x2a2320 }
    ];
    for (const s of strands) {
      const m = yarnTube(s.pts, 0.028, s.color, 0.75);
      m.userData.tag = s.tag;
      this.sway.add(m);
      this.strandMeshes.push(m);
    }

    // stains on dress
    const stTex = stainTexture();
    this.stainMat = new THREE.MeshBasicMaterial({ map: stTex, transparent: true, opacity: 0, depthWrite: false });
    this.stains = [];
    const stainPos = [
      [1.4, 2.2, 2.45, 1.2, 1.5, -0.32],
      [-1.2, 1.5, 2.6, 1.0, 1.2, 0.3],
      [0.3, 3.2, 2.3, 1.4, 1.7, 0],
      [-0.9, 0.9, 2.8, 1.1, 0.9, 0.25],
      [1.7, 0.8, 2.2, 1.0, 1.1, -0.4]
    ];
    for (const [x, y, z, sx, sy, rz] of stainPos) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(sx, sy), this.stainMat);
      p.position.set(x, y, z);
      p.rotation.z = rz;
      p.lookAt(x * 1.8, y + 0.4, z * 1.8);
      this.sway.add(p);
      this.stains.push(p);
    }

    // tendrils (high stage)
    this.tendrils = new THREE.Group();
    const tendrilMat = new THREE.MeshStandardMaterial({ color: 0x2b1a17, roughness: 0.95 });
    for (let i = 0; i < 5; i++) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1 + i * 0.5, 5.8, -0.6),
        new THREE.Vector3(-1.4 + i * 0.7, 6.6, -1.2),
        new THREE.Vector3(-1.2 + i * 0.6, 7.3, -0.9),
        new THREE.Vector3(-1.8 + i * 0.9, 7.9, -1.4)
      ]);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.05, 5, false), tendrilMat);
      this.tendrils.add(tube);
    }
    this.tendrils.visible = false;
    this.sway.add(this.tendrils);

    // shadow flags
    this.group.traverse(o => { if (o.isMesh) { o.castShadow = true; } });

    // animation state
    this.pose = {
      armLX: 0.05, armLZ: -0.2, elbowLX: 0.08,
      armRX: 0.05, armRZ: 0.2, elbowRX: 0.08,
      headX: 0.3, headY: 0
    };
  }

  /* ------------------------------------------------------------ */
  setStage(stage, force = false) {
    if (!force && stage === this.stage) return;
    this.stage = stage;

    if (this.faceMat.map) this.faceMat.map.dispose();
    this.faceMat.map = faceTexture(stage);
    this.faceMat.needsUpdate = true;

    if (this.dressMat.map) this.dressMat.map.dispose();
    this.dressMat.map = dressTexture(stage);
    this.dressMat.needsUpdate = true;
    const tint = 1 - Math.min(0.45, (stage - 1) * 0.1);
    this.dressMat.color.setRGB(tint, tint * 0.94, tint * 0.9);

    this.stainMat.opacity = Math.max(0, stage - 1) * 0.16;
    this.longHair.visible = stage >= 3;
    this.longHair.scale.setScalar(0.7 + stage * 0.1);
    this.tendrils.visible = stage >= 4;

    for (const p of this.pupils) {
      p.material.emissiveIntensity = stage >= 5 ? 2.2 : 0.05;
    }
    this.porcelainMat.color.setHex(stage >= 5 ? 0xcfc1b8 : stage >= 4 ? 0xdfd2c8 : 0xe9ddd4);

    // twitch when escalating
    this.twitch = 0.6;
  }

  setZoneFraction(id, fraction) {
    this.depleted[id] = fraction <= 0.02;
    for (const m of this.strandMeshes) {
      if (m.userData.tag === id) {
        m.material.opacity = Math.min(0.8, 0.15 + fraction * 0.7);
        m.visible = fraction > 0.01;
      }
    }
  }

  resetToHome() {
    this.group.position.copy(this.home);
    this.baseY = this.home.y;
    this.moving = false;
    this.group.rotation.y = 0;
    this.headGroup.rotation.set(0.3, 0, 0);
  }

  knockback(dist = 5) {
    const dir = new THREE.Vector3().subVectors(this.group.position, new THREE.Vector3()).setY(0);
    if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
    dir.normalize().multiplyScalar(dist);
    const p = this.group.position.clone().add(dir);
    p.x = Math.max(-16.5, Math.min(16.5, p.x));
    p.z = Math.max(-20.5, Math.min(20.5, p.z));
    this.group.position.copy(p);
  }

  /* ------------------------------------------------------------ */
  update(dt, ctx) {
    this.time += dt;
    const { night, scare, stage, players, colliders, bounds, doorClosed, doorBroken, floodLevel = 0, onStep, onCreak } = ctx;

    const awake = night || scare;
    const speedTable = [0, 2.35, 3.0, 3.85, 4.75, 5.7];
    let speed = (speedTable[stage] || 2.4) * (1 - 0.12 * (floodLevel || 0)) * (ctx.nightSpeedMul || 1);
    if (scare && !night) speed = Math.min(speed, 3.3);

    // choose target
    let target = null;
    let stopDist = 2.35;
    if (awake) {
      const unsafe = players.filter(p => !p.safe);
      if (unsafe.length > 0) {
        let best = null, bestD = Infinity;
        for (const p of unsafe) {
          const d = this.group.position.distanceToSquared(p.pos);
          if (d < bestD) { bestD = d; best = p; }
        }
        target = best.pos;
        stopDist = 2.1;
      } else {
        // All players are inside. Head for the door, but if we are stuck
        // east of the safe room, first walk around its north side.
        const doorSpot = new THREE.Vector3(-14.75, 0, 10.15);
        if (this.group.position.x > -11.5 && this.group.position.z > 10.5) {
          target = new THREE.Vector3(-9.6, 0, 8.6);
          stopDist = 1.2;
        } else {
          target = doorSpot;
          stopDist = 2.2;
        }
      }
    } else {
      target = this.home;
      stopDist = 0.3;
      speed = 2.8;
    }

    const dx = target.x - this.group.position.x;
    const dz = target.z - this.group.position.z;
    const dist = Math.hypot(dx, dz);
    this.moving = false;

    if (dist > stopDist) {
      const move = Math.min(speed * dt, dist - stopDist);
      const nx = dx / dist, nz = dz / dist;
      const next = this.group.position.clone();
      next.x += nx * move;
      next.z += nz * move;
      const cols = colliders.concat(doorClosed ? [{ minX: -16.35, maxX: -13.15, minZ: 11.85, maxZ: 12.2 }] : []);
      resolveCircle(next, 1.32, cols, bounds);
      // detect if we actually moved
      const moved = next.distanceToSquared(this.group.position) > 0.00001;
      this.group.position.x = next.x;
      this.group.position.z = next.z;
      this.moving = moved || dist > stopDist + 0.5;

      // face movement direction
      const desiredYaw = Math.atan2(nx, nz);
      let diff = desiredYaw - this.group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.group.rotation.y += diff * Math.min(1, dt * 3.2);

      if (moved) {
        this.stepTimer -= dt;
        if (this.stepTimer <= 0) {
          this.stepTimer = Math.max(0.42, 0.95 - stage * 0.07);
          if (onStep) {
            const d = ctx.playerPos ? this.group.position.distanceTo(ctx.playerPos) : 15;
            onStep(d);
          }
        }
      }
    }

    // base height: step off pedestal
    const targetY = (!awake && dist < 2.5) ? this.home.y : 0.05;
    this.baseY += (targetY - this.baseY) * Math.min(1, dt * 2.5);
    const bob = this.moving ? Math.sin(this.time * 7.5) * 0.055 : Math.sin(this.time * 1.4) * 0.02;
    this.group.position.y = this.baseY + bob;

    // sway
    this.sway.rotation.z = this.moving ? Math.sin(this.time * 7.5) * 0.026 : Math.sin(this.time * 0.9) * 0.006;
    this.sway.rotation.x = awake ? 0.045 : 0.008;

    // arm / head pose targets
    const p = this.pose;
    const reach = awake ? 1 : 0;
    const tArmX = -1.08 * reach + 0.04;
    const tArmZ = awake ? -0.12 : -0.2;
    const tArmRZ = awake ? 0.12 : 0.2;
    const tElbow = awake ? 0.42 : 0.08;
    const tHeadX = awake ? -0.03 : 0.3;

    p.armLX += (tArmX - p.armLX) * Math.min(1, dt * 2.2);
    p.armRX += (tArmX - p.armRX) * Math.min(1, dt * 2.2);
    p.armLZ += (tArmZ - p.armLZ) * Math.min(1, dt * 2.2);
    p.armRZ += (tArmRZ - p.armRZ) * Math.min(1, dt * 2.2);
    p.elbowLX += (tElbow - p.elbowLX) * Math.min(1, dt * 2.2);
    p.elbowRX += (tElbow - p.elbowRX) * Math.min(1, dt * 2.2);
    p.headX += (tHeadX - p.headX) * Math.min(1, dt * 2.0);

    // idle twitch / head tracking
    this.headTwitchTimer -= dt;
    if (this.headTwitchTimer <= 0) {
      this.headTwitchTimer = 5 + Math.random() * 9;
      if (stage >= 2) {
        this.twitch = 0.35;
        if (onCreak && Math.random() < 0.45) onCreak();
      }
    }
    if (this.twitch > 0) this.twitch = Math.max(0, this.twitch - dt * 1.4);

    const nearest = ctx.nearestPlayer;
    let desiredHeadY = 0;
    if (nearest && (stage >= 2 || awake)) {
      const headWorld = new THREE.Vector3();
      this.headGroup.getWorldPosition(headWorld);
      const ang = Math.atan2(nearest.pos.x - headWorld.x, nearest.pos.z - headWorld.z) - this.group.rotation.y;
      let a = ang;
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      desiredHeadY = Math.max(-1.05, Math.min(1.05, a)) * (awake ? 0.75 : 0.55);
    }
    const headSpeed = (stage >= 4 && !awake) ? 4.5 : 1.6;
    let hy = desiredHeadY - this.headGroup.rotation.y;
    while (hy > Math.PI) hy -= Math.PI * 2;
    while (hy < -Math.PI) hy += Math.PI * 2;
    this.headGroup.rotation.y += hy * Math.min(1, dt * headSpeed);
    this.headGroup.rotation.x = p.headX + (this.twitch > 0 ? Math.sin(this.time * 35) * this.twitch * 0.25 : 0);
    this.headGroup.rotation.z = Math.sin(this.time * 0.6) * 0.015 + (stage >= 5 ? 0.09 : 0);

    this.armL.shoulder.rotation.x = p.armLX;
    this.armR.shoulder.rotation.x = p.armRX;
    this.armL.shoulder.rotation.z = p.armLZ + Math.sin(this.time * 1.2) * 0.01;
    this.armR.shoulder.rotation.z = p.armRZ - Math.sin(this.time * 1.2) * 0.01;
    this.armL.elbow.rotation.x = p.elbowLX;
    this.armR.elbow.rotation.x = p.elbowRX;

    // eyes
    const glowTarget = awake
      ? (stage >= 4 ? 2.6 : 1.2)
      : (stage >= 3 ? 0.12 : 0.02);
    this.eyeGlow += (glowTarget - this.eyeGlow) * Math.min(1, dt * 3);
    for (const pupil of this.pupils) pupil.material.emissiveIntensity = this.eyeGlow + (this.twitch > 0.1 ? 0.7 : 0);
    this.eyeLight.intensity = awake ? 2.2 + stage * 0.5 : (stage >= 3 ? 0.15 : 0);
    this.eyeLight.position.x = Math.sin(this.time * 2.2) * 0.04;

    // tendril wiggle
    if (this.tendrils.visible) {
      this.tendrils.rotation.y = Math.sin(this.time * 1.3) * 0.14;
      this.tendrils.rotation.z = Math.sin(this.time * 1.7) * 0.08;
    }

    // breathe
    const breathe = 1 + Math.sin(this.time * 1.1) * 0.006;
    this.torso.scale.y = 1.35 * breathe;
  }

  /* Network-driven visuals for co-op guests: no AI, just pose. */
  applyNetwork(dt, net, lookAt) {
    if (!net) return;
    this.time += dt;
    this.setStage(net.stage);

    const prevX = this.group.position.x;
    const prevZ = this.group.position.z;
    const k = Math.min(1, dt * 12);
    this.group.position.x += (net.x - this.group.position.x) * k;
    this.group.position.z += (net.z - this.group.position.z) * k;

    let diff = net.yaw - this.group.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.group.rotation.y += diff * Math.min(1, dt * 8);

    const speed = Math.hypot(this.group.position.x - prevX, this.group.position.z - prevZ) / Math.max(dt, 0.0001);
    this.moving = speed > 0.4;

    const awake = !!net.awake;
    const dxHome = this.group.position.x - this.home.x;
    const dzHome = this.group.position.z - this.home.z;
    const targetY = (!awake && Math.hypot(dxHome, dzHome) < 2.5) ? this.home.y : 0.05;
    this.baseY += (targetY - this.baseY) * Math.min(1, dt * 2.5);
    const bob = this.moving ? Math.sin(this.time * 7.5) * 0.055 : Math.sin(this.time * 1.4) * 0.02;
    this.group.position.y = this.baseY + bob;

    this.sway.rotation.z = this.moving ? Math.sin(this.time * 7.5) * 0.026 : Math.sin(this.time * 0.9) * 0.006;
    this.sway.rotation.x = awake ? 0.045 : 0.008;

    const p = this.pose;
    const reach = awake ? 1 : 0;
    const tArmX = -1.08 * reach + 0.04;
    const tArmZ = awake ? -0.12 : -0.2;
    const tArmRZ = awake ? 0.12 : 0.2;
    const tElbow = awake ? 0.42 : 0.08;
    const tHeadX = awake ? -0.03 : 0.3;

    p.armLX += (tArmX - p.armLX) * Math.min(1, dt * 2.2);
    p.armRX += (tArmX - p.armRX) * Math.min(1, dt * 2.2);
    p.armLZ += (tArmZ - p.armLZ) * Math.min(1, dt * 2.2);
    p.armRZ += (tArmRZ - p.armRZ) * Math.min(1, dt * 2.2);
    p.elbowLX += (tElbow - p.elbowLX) * Math.min(1, dt * 2.2);
    p.elbowRX += (tElbow - p.elbowRX) * Math.min(1, dt * 2.2);
    p.headX += (tHeadX - p.headX) * Math.min(1, dt * 2.0);

    this.twitch = Math.max(0, this.twitch - dt * 1.4);

    let desiredHeadY = 0;
    if (lookAt && (this.stage >= 2 || awake)) {
      const headWorld = new THREE.Vector3();
      this.headGroup.getWorldPosition(headWorld);
      const ang = Math.atan2(lookAt.x - headWorld.x, lookAt.z - headWorld.z) - this.group.rotation.y;
      let a = ang;
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      desiredHeadY = Math.max(-1.05, Math.min(1.05, a)) * (awake ? 0.75 : 0.55);
    }
    const headSpeed = (this.stage >= 4 && !awake) ? 4.5 : 1.6;
    let hy = desiredHeadY - this.headGroup.rotation.y;
    while (hy > Math.PI) hy -= Math.PI * 2;
    while (hy < -Math.PI) hy += Math.PI * 2;
    this.headGroup.rotation.y += hy * Math.min(1, dt * headSpeed);
    this.headGroup.rotation.x = p.headX + (this.twitch > 0 ? Math.sin(this.time * 35) * this.twitch * 0.25 : 0);
    this.headGroup.rotation.z = Math.sin(this.time * 0.6) * 0.015 + (this.stage >= 5 ? 0.09 : 0);

    this.armL.shoulder.rotation.x = p.armLX;
    this.armR.shoulder.rotation.x = p.armRX;
    this.armL.shoulder.rotation.z = p.armLZ + Math.sin(this.time * 1.2) * 0.01;
    this.armR.shoulder.rotation.z = p.armRZ - Math.sin(this.time * 1.2) * 0.01;
    this.armL.elbow.rotation.x = p.elbowLX;
    this.armR.elbow.rotation.x = p.elbowRX;

    const glowTarget = awake
      ? (this.stage >= 4 ? 2.6 : 1.2)
      : (this.stage >= 3 ? 0.12 : 0.02);
    this.eyeGlow += (glowTarget - this.eyeGlow) * Math.min(1, dt * 3);
    for (const pupil of this.pupils) pupil.material.emissiveIntensity = this.eyeGlow + (this.twitch > 0.1 ? 0.7 : 0);
    this.eyeLight.intensity = awake ? 2.2 + this.stage * 0.5 : (this.stage >= 3 ? 0.15 : 0);
    this.eyeLight.position.x = Math.sin(this.time * 2.2) * 0.04;

    if (this.tendrils.visible) {
      this.tendrils.rotation.y = Math.sin(this.time * 1.3) * 0.14;
      this.tendrils.rotation.z = Math.sin(this.time * 1.7) * 0.08;
    }

    const breathe = 1 + Math.sin(this.time * 1.1) * 0.006;
    this.torso.scale.y = 1.35 * breathe;
  }
}
