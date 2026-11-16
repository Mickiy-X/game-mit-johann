import * as THREE from 'three';
import { WORLD, resolveCircle } from './world.js';

const GRAVITY = 26;
const JUMP_SPEED = 7.4;
const JUMP_BUFFER_TIME = 0.14;
const COYOTE_TIME = 0.12;

function spoolModel(color = 0xd8cfc0) {
  const g = new THREE.Group();
  const yarn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.36, 16),
    new THREE.MeshStandardMaterial({ color, roughness: 1 })
  );
  g.add(yarn);
  const capMat = new THREE.MeshStandardMaterial({ color: 0x4a382c, roughness: 0.9 });
  for (const y of [-0.19, 0.19]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.035, 16), capMat);
    cap.position.y = y;
    g.add(cap);
  }
  return g;
}

function carryHand(side) {
  const g = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd6a37e, roughness: 0.72 });
  const sleeveMat = new THREE.MeshStandardMaterial({ color: 0xb7a98f, roughness: 0.92 });
  const cuffMat = new THREE.MeshStandardMaterial({ color: 0xd6c6a8, roughness: 0.95 });

  const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.064, 0.46, 8), sleeveMat);
  forearm.position.set(side * 0.02, -0.17, 0.19);
  forearm.rotation.x = 2.28;
  g.add(forearm);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.045, 8), cuffMat);
  cuff.position.set(side * 0.01, -0.035, 0.04);
  cuff.rotation.x = 0.35;
  g.add(cuff);

  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.073, 10, 8), skinMat);
  hand.scale.set(1.18, 0.92, 1.06);
  g.add(hand);
  for (let i = 0; i < 3; i++) {
    const finger = new THREE.Mesh(new THREE.SphereGeometry(0.021, 6, 5), skinMat);
    finger.scale.set(0.75, 1.15, 1.35);
    finger.position.set(side * 0.062, -0.052, -0.035 + i * 0.035);
    g.add(finger);
  }
  const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.027, 6, 5), skinMat);
  thumb.scale.set(1.15, 1.0, 1.3);
  thumb.position.set(side * -0.045, 0.055, 0.025);
  g.add(thumb);

  return g;
}

export class Player {
  constructor(camera) {
    this.camera = camera;
    this.position = WORLD.spawn.clone();
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.eyeHeight = 1.68;
    this.radius = 0.42;
    this.stamina = 100;
    this.sprinting = false;
    this.speed = 0;
    this.bob = 0;
    this.bobAmount = 0;
    this.shake = 0;
    this.shakeTime = 0;
    this.carrying = [];
    this.flashlightOn = false;
    this.time = 0;
    this.stepTimer = 0;
    this.onStep = null;
    this.invulnerable = 0;
    this.lastSafe = false;
    this.motionScale = 1;
    this.vy = 0;
    this.grounded = true;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.jumpHeld = false;
    this.landDip = 0;
    this.cameraY = this.eyeHeight;
    this.jumpTilt = 0;
    this.onJump = null;
    this.onLand = null;

    this.camera.rotation.order = 'YXZ';

    // flashlight
    this.flashlight = new THREE.SpotLight(0xfff1d6, 0, 32, 0.48, 0.55, 1.2);
    this.flashlight.position.set(0.18, -0.08, 0);
    this.flashlight.target.position.set(0, -0.1, -4);
    camera.add(this.flashlight);
    camera.add(this.flashlight.target);

    // spool in hands
    this.carryVisual = new THREE.Group();
    this.carryVisual.visible = false;
    const s1 = spoolModel();
    s1.rotation.z = Math.PI / 2;
    s1.position.set(0, 0, 0);
    this.carryVisual.add(s1);
    const s2 = spoolModel(0xb03a3a);
    s2.rotation.z = Math.PI / 2;
    s2.position.set(0.36, -0.1, 0.05);
    s2.visible = false;
    this.carryVisual.add(s2);
    const handL = carryHand(-1);
    handL.position.set(-0.31, 0, 0.02);
    this.carryVisual.add(handL);
    const handR = carryHand(1);
    handR.position.set(0.31, 0, 0.02);
    this.carryVisual.add(handR);
    this.carryVisual.position.set(0.52, -0.52, -0.95);
    this.carryVisual.rotation.set(0.2, -0.3, 0.2);
    this.carryVisual.scale.setScalar(0.85);
    camera.add(this.carryVisual);
    this.carrySpool2 = s2;
  }

  reset(pos = WORLD.spawn) {
    this.position.copy(pos);
    this.velocity.set(0, 0, 0);
    this.vy = 0;
    this.grounded = true;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.jumpHeld = false;
    this.landDip = 0;
    this.cameraY = this.position.y + this.eyeHeight;
    this.pitch = 0;
    this.bob = 0;
  }

  addShake(amount, time = 0.5) {
    this.shake = Math.max(this.shake, amount);
    this.shakeTime = Math.max(this.shakeTime, time);
  }

  setFlashlight(on) {
    this.flashlightOn = on;
  }

  updateCarryDisplay() {
    this.carryVisual.visible = this.carrying.length > 0;
    this.carrySpool2.visible = this.carrying.length > 1;
  }

  update(dt, input, state, colliders, onStep) {
    this.time += dt;
    if (this.invulnerable > 0) this.invulnerable -= dt;

    const moving = input.forward || input.back || input.left || input.right;

    // jump input: buffered press + coyote time for forgiving physics
    if (input.jump && !this.jumpHeld) this.jumpBuffer = JUMP_BUFFER_TIME;
    if (!input.jump && this.jumpHeld && this.vy > 0) this.vy *= 0.55;
    this.jumpHeld = !!input.jump;
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.coyote = this.grounded ? COYOTE_TIME : Math.max(0, this.coyote - dt);

    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = JUMP_SPEED;
      this.grounded = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.landDip = 0;
      this.jumpTilt -= 0.02;
      if (this.onJump) this.onJump();
    }

    if (!this.grounded) {
      const fallSpeed = this.vy;
      const gravity = this.vy > 0 ? GRAVITY : GRAVITY * 1.15;
      this.vy -= gravity * dt;
      this.position.y += this.vy * dt;
      if (this.position.y <= 0) {
        const impact = Math.min(1, Math.abs(fallSpeed) / 8);
        this.position.y = 0;
        this.vy = 0;
        this.grounded = true;
        this.landDip = 0.055 + impact * 0.1;
        this.jumpTilt += 0.035 * impact;
        this.addShake(0.04 * impact, 0.16);
        if (this.onLand) this.onLand(impact);
      }
    } else {
      this.position.y = 0;
    }
    this.landDip *= Math.exp(-dt * 9);
    this.jumpTilt = Math.max(-0.09, Math.min(0.09, this.jumpTilt * Math.exp(-dt * 8)));

    // sprint / stamina
    const wantSprint = input.sprint && moving && this.stamina > 2 && state.phase !== 'shop';
    if (wantSprint) {
      this.stamina = Math.max(0, this.stamina - 26 * dt);
    } else {
      this.stamina = Math.min(100, this.stamina + 16 * dt);
    }
    this.sprinting = wantSprint && this.stamina > 0;

    let moveSpeed = this.sprinting ? 7.0 : 4.35;
    if (this.carrying.length > 0) moveSpeed *= 0.78;
    if (state.upgrades.boots > 0) moveSpeed *= 1.09;
    if (state.phase === 'night' || state.phase === 'dusk') moveSpeed *= 1.02;

    // input direction
    const f = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    const s = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let dx = -sy * f + cy * s;
    let dz = -cy * f - sy * s;
    const len = Math.hypot(dx, dz);
    if (len > 0) { dx /= len; dz /= len; }

    const targetVx = dx * moveSpeed;
    const targetVz = dz * moveSpeed;
    const accel = this.grounded ? 12 : 3.4;
    this.velocity.x += (targetVx - this.velocity.x) * Math.min(1, dt * accel);
    this.velocity.z += (targetVz - this.velocity.z) * Math.min(1, dt * accel);

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    resolveCircle(this.position, this.radius, colliders, WORLD.bounds);

    this.speed = Math.hypot(this.velocity.x, this.velocity.z);

    // bob & footsteps
    if (this.speed > 0.6 && this.grounded) {
      this.bob += dt * (this.sprinting ? 13 : 9);
      this.bobAmount += ((this.sprinting ? 0.07 : 0.04) - this.bobAmount) * Math.min(1, dt * 8);
      this.stepTimer -= dt * this.speed / 4.35;
      if (this.stepTimer <= 0) {
        this.stepTimer = this.sprinting ? 0.32 : 0.46;
        if (onStep) onStep(this.sprinting);
      }
    } else {
      this.bobAmount += (0 - this.bobAmount) * Math.min(1, dt * 8);
    }

    if (this.carryVisual.visible) {
      const sway = Math.sin(this.bob * 0.5) * this.bobAmount * 0.4;
      this.carryVisual.position.x = 0.52 + sway;
      this.carryVisual.position.y = -0.52 - this.bobAmount * 0.55 - (this.grounded ? 0 : 0.03);
    }

    // camera shake decay
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      if (this.shakeTime <= 0) this.shake = 0;
    }

    this.applyCamera(dt);
  }

  applyCamera(dt) {
    const m = this.motionScale;
    const bobY = Math.sin(this.bob) * this.bobAmount * m;
    const bobX = Math.cos(this.bob * 0.5) * this.bobAmount * 0.5 * m;
    let sx = 0, sy = 0, sz = 0;
    if (this.shake > 0) {
      sx = (Math.random() - 0.5) * this.shake * m;
      sy = (Math.random() - 0.5) * this.shake * m;
      sz = (Math.random() - 0.5) * this.shake * 0.6 * m;
    }
    const eyeTarget = this.position.y + this.eyeHeight;
    this.cameraY += (eyeTarget - this.cameraY) * Math.min(1, dt * 22);
    this.camera.position.set(
      this.position.x + bobX + sx,
      this.cameraY + bobY + sy - this.landDip,
      this.position.z + sz
    );
    this.camera.rotation.set(this.pitch + this.jumpTilt, this.yaw, Math.sin(this.bob * 0.5) * this.bobAmount * 0.25 * m);
  }

  get position2D() {
    return new THREE.Vector2(this.position.x, this.position.z);
  }
}
