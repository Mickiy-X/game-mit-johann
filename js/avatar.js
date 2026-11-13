import * as THREE from 'three';
import { nameTexture } from './textures.js';

/* Visible body for the other player in co-op. */
export class RemoteAvatar {
  constructor(scene, label, palette = {}) {
    this.scene = scene;
    this.label = label;
    this.palette = {
      overall: palette.overall ?? 0x2f4e73,
      shirt: palette.shirt ?? 0xb7a98f,
      cap: palette.cap ?? 0xc9a536,
      skin: palette.skin ?? 0xd6a37e
    };
    this.position = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.yaw = 0;
    this.targetYaw = 0;
    this.moving = false;
    this.walkPhase = 0;
    this.carrying = false;
    this.visible = false;
    this.build();
  }

  build() {
    const { overall, shirt, cap, skin } = this.palette;
    const overallMat = new THREE.MeshStandardMaterial({ color: overall, roughness: 0.85 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.9 });
    const capMat = new THREE.MeshStandardMaterial({ color: cap, roughness: 0.7 });
    const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x2a2521, roughness: 0.9 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.6 });

    this.group = new THREE.Group();
    this.group.visible = false;
    this.body = new THREE.Group();
    this.group.add(this.body);

    this.legL = new THREE.Group();
    this.legL.position.set(-0.16, 0.82, 0);
    const legMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.8, 8), overallMat);
    legMesh.position.y = -0.4;
    this.legL.add(legMesh);
    const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.36), bootMat);
    shoeL.position.set(0, -0.83, 0.07);
    this.legL.add(shoeL);
    this.body.add(this.legL);

    this.legR = new THREE.Group();
    this.legR.position.set(0.16, 0.82, 0);
    const legMesh2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.8, 8), overallMat);
    legMesh2.position.y = -0.4;
    this.legR.add(legMesh2);
    const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.36), bootMat);
    shoeR.position.set(0, -0.83, 0.07);
    this.legR.add(shoeR);
    this.body.add(this.legR);

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.85, 12), shirtMat);
    torso.position.y = 1.2;
    torso.castShadow = true;
    this.body.add(torso);
    const overalls = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.58, 0.38), overallMat);
    overalls.position.set(0, 1.06, 0.02);
    this.body.add(overalls);
    for (const sx of [-0.17, 0.17]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.04), overallMat);
      strap.position.set(sx, 1.42, 0.27);
      strap.rotation.x = -0.1;
      this.body.add(strap);
    }

    this.armL = new THREE.Group();
    this.armL.position.set(-0.36, 1.55, 0);
    const aL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.72, 8), shirtMat);
    aL.position.y = -0.36;
    this.armL.add(aL);
    const handL = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), skinMat);
    handL.position.y = -0.78;
    this.armL.add(handL);
    this.body.add(this.armL);

    this.armR = new THREE.Group();
    this.armR.position.set(0.36, 1.55, 0);
    const aR = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.72, 8), shirtMat);
    aR.position.y = -0.36;
    this.armR.add(aR);
    const handR = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), skinMat);
    handR.position.y = -0.78;
    this.armR.add(handR);
    this.body.add(this.armR);

    this.head = new THREE.Group();
    this.head.position.y = 1.93;
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.29, 16, 12), skinMat);
    headMesh.scale.set(1, 1.08, 0.95);
    headMesh.castShadow = true;
    this.head.add(headMesh);
    for (const sx of [-0.1, 0.1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), darkMat);
      eye.position.set(sx, 0.03, 0.26);
      this.head.add(eye);
    }
    const capTop = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
      capMat
    );
    capTop.position.y = 0.13;
    this.head.add(capTop);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.2), capMat);
    brim.position.set(0, 0.16, 0.27);
    this.head.add(brim);
    this.body.add(this.head);

    this.nameSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: nameTexture(this.label),
      transparent: true,
      depthTest: true
    }));
    this.nameSprite.scale.set(1.25, 0.31, 1);
    this.nameSprite.position.set(0, 2.55, 0);
    this.group.add(this.nameSprite);

    this.spool = new THREE.Group();
    const yarn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.3, 12),
      new THREE.MeshStandardMaterial({ color: 0xd8cfc0, roughness: 1 })
    );
    this.spool.add(yarn);
    const capMatSpool = new THREE.MeshStandardMaterial({ color: 0x4a382c, roughness: 0.9 });
    for (const y of [-0.16, 0.16]) {
      const capMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 12), capMatSpool);
      capMesh.position.y = y;
      this.spool.add(capMesh);
    }
    this.spool.position.set(0.35, 1.1, 0.35);
    this.spool.rotation.z = Math.PI / 2;
    this.spool.visible = false;
    this.group.add(this.spool);

    this.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(this.group);
  }

  setVisible(v) {
    this.visible = v;
    this.group.visible = v;
  }

  setPosition(x, z, yaw = 0) {
    this.position.set(x, 0, z);
    this.target.set(x, 0, z);
    this.yaw = yaw + Math.PI;
    this.targetYaw = this.yaw;
    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
  }

  setTarget(x, z, yaw, carrying = false) {
    this.target.set(x, 0, z);
    this.targetYaw = yaw + Math.PI;
    this.carrying = carrying;
    this.spool.visible = carrying;
    if (!this.visible) this.setPosition(x, z, yaw);
  }

  update(dt) {
    if (!this.visible) return;
    const px = this.position.x;
    const pz = this.position.z;
    const lerp = 1 - Math.exp(-dt * 12);
    this.position.lerp(this.target, lerp);
    this.group.position.set(this.position.x, 0, this.position.z);

    let diff = this.targetYaw - this.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.yaw += diff * Math.min(1, dt * 10);
    this.group.rotation.y = this.yaw;

    const moved = Math.hypot(this.position.x - px, this.position.z - pz);
    this.moving = moved > 0.0015;
    if (this.moving) this.walkPhase += dt * 11;
    const walk = this.moving ? Math.sin(this.walkPhase) : 0;
    const swing = Math.min(1, dt * 12);
    this.legL.rotation.x += (walk * 0.55 - this.legL.rotation.x) * swing;
    this.legR.rotation.x += (-walk * 0.55 - this.legR.rotation.x) * swing;
    this.armL.rotation.x += (-walk * 0.45 - this.armL.rotation.x) * swing;
    this.armR.rotation.x += (walk * 0.45 - this.armR.rotation.x) * swing;
    this.body.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.02;
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
