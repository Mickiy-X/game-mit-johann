import * as THREE from 'three';
import { WORLD, resolveCircle } from './world.js';

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
    this.carryVisual.position.set(0.52, -0.52, -0.95);
    this.carryVisual.rotation.set(0.2, -0.3, 0.2);
    this.carryVisual.scale.setScalar(0.85);
    camera.add(this.carryVisual);
    this.carrySpool2 = s2;
  }

  reset(pos = WORLD.spawn) {
    this.position.copy(pos);
    this.velocity.set(0, 0, 0);
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
    const accel = 12;
    this.velocity.x += (targetVx - this.velocity.x) * Math.min(1, dt * accel);
    this.velocity.z += (targetVz - this.velocity.z) * Math.min(1, dt * accel);

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    resolveCircle(this.position, this.radius, colliders, WORLD.bounds);

    this.speed = Math.hypot(this.velocity.x, this.velocity.z);

    // bob & footsteps
    if (this.speed > 0.6) {
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
    this.camera.position.set(
      this.position.x + bobX + sx,
      this.position.y + this.eyeHeight + bobY + sy,
      this.position.z + sz
    );
    this.camera.rotation.set(this.pitch, this.yaw, Math.sin(this.bob * 0.5) * this.bobAmount * 0.25 * m);
  }

  get position2D() {
    return new THREE.Vector2(this.position.x, this.position.z);
  }
}
