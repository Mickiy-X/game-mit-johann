import * as THREE from 'three';
import { nameTexture } from './textures.js';
import { buildWorkerFigure } from './figure.js';

/* Visible body for the other player in co-op. */
export class RemoteAvatar {
  constructor(scene, label, palette = {}) {
    this.scene = scene;
    this.label = label;
    this.position = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.yaw = 0;
    this.targetYaw = 0;
    this.moving = false;
    this.walkPhase = 0;
    this.airBlend = 0;
    this.idleTime = 0;
    this.carrying = false;
    this.visible = false;
    this.build(palette);
  }

  build(palette) {
    const figure = buildWorkerFigure({
      skin: palette.skin ?? 0xd6a37e,
      shirt: palette.shirt ?? 0xb7a98f,
      overall: palette.overall ?? 0x2f4e73,
      cap: palette.cap ?? 0xc9a536,
      hair: palette.hair ?? 0x4a3524
    });
    this.figure = figure;
    this.group = figure.root;
    this.body = figure.body;
    this.head = figure.head;
    this.legL = figure.legL;
    this.legR = figure.legR;
    this.armL = figure.armL;
    this.armR = figure.armR;
    this.elbowL = figure.elbowL;
    this.elbowR = figure.elbowR;
    this.group.visible = false;

    this.nameSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: nameTexture(this.label),
      transparent: true,
      depthTest: true
    }));
    this.nameSprite.scale.set(1.1, 0.275, 1);
    this.nameSprite.position.set(0, 2.08, 0);
    this.group.add(this.nameSprite);

    this.spool = new THREE.Group();
    const yarn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.3, 12),
      new THREE.MeshStandardMaterial({ color: 0xd8cfc0, roughness: 1 })
    );
    this.spool.add(yarn);
    const spoolCapMat = new THREE.MeshStandardMaterial({ color: 0x4a382c, roughness: 0.9 });
    for (const y of [-0.16, 0.16]) {
      const capMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 12), spoolCapMat);
      capMesh.position.y = y;
      this.spool.add(capMesh);
    }
    this.spool.position.set(0.34, 1.12, 0.32);
    this.spool.rotation.z = Math.PI / 2;
    this.spool.visible = false;
    this.group.add(this.spool);

    this.scene.add(this.group);
  }

  setVisible(v) {
    this.visible = v;
    this.group.visible = v;
  }

  setPosition(x, z, yaw = 0, y = 0) {
    this.position.set(x, y, z);
    this.target.set(x, y, z);
    this.yaw = yaw + Math.PI;
    this.targetYaw = this.yaw;
    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
  }

  setTarget(x, z, yaw, carrying = false, y = 0) {
    this.target.set(x, y, z);
    this.targetYaw = yaw + Math.PI;
    this.carrying = carrying;
    this.spool.visible = carrying;
    if (!this.visible) this.setPosition(x, z, yaw, y);
  }

  update(dt) {
    if (!this.visible) return;
    const px = this.position.x;
    const pz = this.position.z;
    const lerp = 1 - Math.exp(-dt * 12);
    this.position.lerp(this.target, lerp);
    this.group.position.set(this.position.x, this.position.y, this.position.z);

    let diff = this.targetYaw - this.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.yaw += diff * Math.min(1, dt * 10);
    this.group.rotation.y = this.yaw;

    const moved = Math.hypot(this.position.x - px, this.position.z - pz);
    this.moving = moved > 0.0015;
    if (this.moving) this.walkPhase += dt * 11;

    const airborne = this.position.y > 0.06 || this.target.y > 0.06;
    this.airBlend += ((airborne ? 1 : 0) - this.airBlend) * Math.min(1, dt * 9);

    const walk = this.moving ? Math.sin(this.walkPhase) : 0;
    const swing = Math.min(1, dt * 12);
    const air = this.airBlend;
    const legLTarget = walk * 0.55 * (1 - air) + -0.55 * air;
    const legRTarget = -walk * 0.55 * (1 - air) + 0.3 * air;
    const armTarget = -walk * 0.45 * (1 - air) + -1.15 * air;
    const armAlt = walk * 0.45 * (1 - air) + -1.15 * air;
    this.legL.rotation.x += (legLTarget - this.legL.rotation.x) * swing;
    this.legR.rotation.x += (legRTarget - this.legR.rotation.x) * swing;
    this.armL.rotation.x += (armTarget - this.armL.rotation.x) * swing;
    this.armR.rotation.x += (armAlt - this.armR.rotation.x) * swing;
    this.armL.rotation.z += ((-0.08 - air * 0.38) - this.armL.rotation.z) * swing;
    this.armR.rotation.z += ((0.08 + air * 0.38) - this.armR.rotation.z) * swing;
    this.idleTime += dt;
    const breathe = air > 0.5 ? 0 : Math.sin(this.idleTime * 1.8) * 0.006;
    this.body.position.y = (this.moving ? Math.abs(Math.sin(this.walkPhase)) * 0.02 : 0) + breathe;
  }

  dispose() {
    this.setVisible(false);
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.isMesh) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (o.material.map) o.material.map.dispose();
          o.material.dispose();
        }
      }
      if (o.isSprite) {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
      }
    });
  }
}
