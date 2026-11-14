import * as THREE from 'three';
import { WORLD, resolveCircle, navWaypoint } from './world.js';
import { faceTexture, shirtTexture, denimTexture } from './textures.js';

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

function patchTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#8a6d3a';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(30,22,12,0.5)';
  g.lineWidth = 3;
  g.setLineDash([5, 4]);
  g.strokeRect(8, 8, 112, 112);
  g.setLineDash([]);
  g.fillStyle = '#2b2115';
  g.font = 'bold 54px Consolas, monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('W7', 64, 60);
  g.font = '16px Consolas, monospace';
  g.fillText('WEBEREI', 64, 98);
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
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe4d1bf, roughness: 0.46, metalness: 0.03 });
    this.skinMat = skinMat;
    this.shirtMat = new THREE.MeshStandardMaterial({ map: shirtTexture(1), roughness: 0.95 });
    this.overallMat = new THREE.MeshStandardMaterial({ map: denimTexture(1), roughness: 0.96 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x8a3218, roughness: 0.86 });
    const hairDark = new THREE.MeshStandardMaterial({ color: 0x5e2010, roughness: 0.9 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x35241a, roughness: 0.72 });
    const soleMat = new THREE.MeshStandardMaterial({ color: 0x191512, roughness: 0.95 });
    const buckleMat = new THREE.MeshStandardMaterial({ color: 0x9b8a5a, roughness: 0.42, metalness: 0.8 });
    const stitchMat = new THREE.MeshStandardMaterial({ color: 0x1b1210, roughness: 0.9 });
    this.socketMat = new THREE.MeshStandardMaterial({ color: 0x1b1211, roughness: 0.55 });
    this.irisMat = new THREE.MeshStandardMaterial({ color: 0x6f9d86, roughness: 0.28, metalness: 0.1 });
    this.pupilMat = new THREE.MeshStandardMaterial({ color: 0x120606, emissive: 0xff1c1c, emissiveIntensity: 0.05, roughness: 0.25 });

    /* legs + boots */
    for (const sx of [-1, 1]) {
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.5, 1.45, 16), this.overallMat);
      thigh.position.set(sx * 0.62, 2.13, 0);
      thigh.castShadow = true;
      this.sway.add(thigh);
      const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.42, 1.2, 16), this.overallMat);
      calf.position.set(sx * 0.62, 0.98, 0);
      calf.castShadow = true;
      this.sway.add(calf);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.16, 16), new THREE.MeshStandardMaterial({ color: 0x6b7472, roughness: 0.9 }));
      cuff.position.set(sx * 0.62, 0.42, 0);
      this.sway.add(cuff);
      // rolled seam
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.2, 0.04), stitchMat);
      seam.position.set(sx * 0.62, 1.0, 0.4);
      this.sway.add(seam);
      // boot
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.42, 1.15), bootMat);
      boot.position.set(sx * 0.62, 0.28, 0.12);
      boot.castShadow = true;
      this.sway.add(boot);
      const toe = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), bootMat);
      toe.scale.set(0.95, 0.62, 0.9);
      toe.position.set(sx * 0.62, 0.24, 0.64);
      this.sway.add(toe);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.13, 1.45), soleMat);
      sole.position.set(sx * 0.62, 0.065, 0.22);
      this.sway.add(sole);
      // laces
      for (let i = 0; i < 3; i++) {
        const lace = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.035, 0.04), new THREE.MeshStandardMaterial({ color: 0xb9a37c, roughness: 0.9 }));
        lace.position.set(sx * 0.62, 0.34 + i * 0.09, 0.62);
        this.sway.add(lace);
      }
      // knee patch
      const patch = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.03), new THREE.MeshStandardMaterial({ color: 0x526a7c, roughness: 0.95 }));
      patch.position.set(sx * 0.62, 1.7, 0.47);
      this.sway.add(patch);
    }

    /* hips */
    const hips = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), this.overallMat);
    hips.scale.set(1.16, 0.72, 0.82);
    hips.position.y = 2.98;
    hips.castShadow = true;
    this.sway.add(hips);

    /* torso in the striped shirt */
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.12, 1.75, 24), this.shirtMat);
    torso.position.y = 4.12;
    torso.castShadow = true;
    this.sway.add(torso);
    this.torso = torso;
    const shoulders = new THREE.Mesh(new THREE.SphereGeometry(1.12, 20, 14), this.shirtMat);
    shoulders.scale.set(1.02, 0.5, 0.76);
    shoulders.position.y = 4.93;
    this.sway.add(shoulders);

    /* overalls bib + straps */
    const bib = new THREE.Mesh(new THREE.BoxGeometry(1.32, 1.2, 0.18), this.overallMat);
    bib.position.set(0, 4.02, 0.99);
    bib.castShadow = true;
    this.sway.add(bib);
    const bibPocket = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.42, 0.035), new THREE.MeshStandardMaterial({ color: 0x4a6275, roughness: 0.96 }));
    bibPocket.position.set(0, 3.86, 1.09);
    this.sway.add(bibPocket);
    const patchMat = new THREE.MeshStandardMaterial({ map: patchTexture(), roughness: 0.95 });
    const namePatch = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.32), patchMat);
    namePatch.position.set(0.32, 4.26, 1.1);
    this.sway.add(namePatch);
    for (const sx of [-1, 1]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.19, 1.06, 0.12), this.overallMat);
      strap.position.set(sx * 0.53, 4.75, 0.86);
      strap.rotation.z = sx * 0.12;
      strap.rotation.x = -0.12;
      this.sway.add(strap);
      const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.1), buckleMat);
      buckle.position.set(sx * 0.48, 4.34, 1.09);
      this.sway.add(buckle);
      const button = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 12), buckleMat);
      button.rotation.x = Math.PI / 2;
      button.position.set(sx * 0.48, 4.34, 1.15);
      this.sway.add(button);
    }

    /* collar */
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.07, 7, 22), new THREE.MeshStandardMaterial({ color: 0xd6c6a8, roughness: 0.9 }));
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 5.07;
    this.sway.add(collar);

    /* neck */
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.38, 0.42, 14), skinMat);
    neck.position.y = 5.27;
    this.sway.add(neck);
    const neckSeam = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.025, 5, 16), stitchMat);
    neckSeam.rotation.x = Math.PI / 2;
    neckSeam.position.y = 5.43;
    this.sway.add(neckSeam);

    /* head */
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 6.03, 0);
    this.sway.add(this.headGroup);
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.21, 32, 24), skinMat);
    head.scale.set(1, 1.06, 1.01);
    head.castShadow = true;
    this.headGroup.add(head);
    this.head = head;
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.86, 22, 16), skinMat);
    jaw.scale.set(1.02, 0.72, 0.92);
    jaw.position.set(0, -0.45, 0.1);
    this.headGroup.add(jaw);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skinMat);
      ear.scale.set(0.55, 1.05, 0.8);
      ear.position.set(sx * 1.17, -0.02, 0.02);
      this.headGroup.add(ear);
    }

    /* curved face decal */
    const faceGeo = new THREE.PlaneGeometry(1.84, 1.84, 26, 26);
    const fpos = faceGeo.attributes.position;
    const R = 1.255;
    for (let i = 0; i < fpos.count; i++) {
      const x = fpos.getX(i);
      const y = fpos.getY(i);
      const yy = y / 1.06;
      const inside = Math.max(0, 1 - (x / R) ** 2 - (yy / R) ** 2);
      fpos.setZ(i, R * Math.sqrt(inside) + 0.018);
    }
    faceGeo.computeVertexNormals();
    this.faceMat = new THREE.MeshStandardMaterial({
      map: faceTexture(1), transparent: true, roughness: 0.44,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2
    });
    const face = new THREE.Mesh(faceGeo, this.faceMat);
    face.position.set(0, 0.02, 0.01);
    this.headGroup.add(face);
    this.face = face;

    /* glass eyes */
    this.eyeSockets = new THREE.Group();
    this.pupils = [];
    for (const [sx, sy, size] of [[-1, 0.14, 0.2], [1, 0.1, 0.215]]) {
      const socket = new THREE.Mesh(new THREE.SphereGeometry(0.215, 14, 12), this.socketMat);
      socket.scale.set(1, 1.1, 0.45);
      socket.position.set(sx * 0.4, sy, 1.16);
      this.eyeSockets.add(socket);
      const iris = new THREE.Mesh(new THREE.SphereGeometry(size * 0.82, 16, 12), this.irisMat);
      iris.scale.set(1, 1, 0.55);
      iris.position.set(sx * 0.4, sy, 1.22);
      this.eyeSockets.add(iris);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(size * 0.42, 12, 10), this.pupilMat.clone());
      pupil.scale.set(1, 1, 0.5);
      pupil.position.set(sx * 0.4, sy, 1.29);
      pupil.userData.base = sx;
      this.eyeSockets.add(pupil);
      this.pupils.push(pupil);
    }
    this.headGroup.add(this.eyeSockets);
    this.eyeLight = new THREE.PointLight(0xff2020, 0, 8, 1.4);
    this.eyeLight.position.set(0, 0.12, 1.5);
    this.headGroup.add(this.eyeLight);

    /* eyebrows */
    for (const sx of [-1, 1]) {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.06), hairDark);
      brow.position.set(sx * 0.4, 0.39 + (sx > 0 ? 0.02 : 0), 1.13);
      brow.rotation.z = sx * -0.16;
      this.headGroup.add(brow);
    }
    // nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), skinMat);
    nose.scale.set(0.85, 1.15, 0.7);
    nose.position.set(0, -0.02, 1.22);
    this.headGroup.add(nose);
    // cheek stitches
    for (let i = 0; i < 3; i++) {
      const stitch = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.03), stitchMat);
      stitch.position.set(-0.72, -0.14 - i * 0.11, 1.03 - i * 0.02);
      stitch.rotation.z = 0.35;
      this.headGroup.add(stitch);
    }

    /* red hair */
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(1.26, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.4),
      hairMat
    );
    cap.position.set(0, 0.2, -0.03);
    cap.scale.set(1.01, 0.98, 1.03);
    this.headGroup.add(cap);
    const backHair = new THREE.Mesh(new THREE.SphereGeometry(1.12, 20, 16), hairMat);
    backHair.scale.set(1.1, 1.05, 0.85);
    backHair.position.set(0, -0.12, -0.48);
    this.headGroup.add(backHair);
    // messy tufts
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), i % 3 === 0 ? hairDark : hairMat);
      const rr = i % 2 === 0 ? 0.98 : 1.12;
      tuft.scale.set(0.85, 0.55, 0.9);
      tuft.position.set(Math.cos(a) * rr, 0.82 + Math.sin(a * 2) * 0.12, Math.sin(a) * 0.96 - 0.1);
      tuft.rotation.set(Math.sin(a) * 0.5, a, Math.cos(a) * 0.5);
      this.headGroup.add(tuft);
    }
    // forelock
    const forelock = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), hairDark);
    forelock.scale.set(0.55, 0.9, 0.45);
    forelock.position.set(-0.18, 0.94, 0.98);
    forelock.rotation.z = 0.5;
    this.headGroup.add(forelock);
    for (const sx of [-1, 1]) {
      const sideburn = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 10), hairDark);
      sideburn.scale.set(0.5, 1.1, 0.65);
      sideburn.position.set(sx * 1.05, -0.32, 0.28);
      this.headGroup.add(sideburn);
    }

    this.longHair = new THREE.Group();
    const longHairMat = new THREE.MeshStandardMaterial({ color: 0x6b2713, roughness: 0.92 });
    for (let i = 0; i < 5; i++) {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.035, 2.4 + Math.random(), 5), longHairMat);
      h.position.set(-0.7 + i * 0.35, -1.0, -0.9);
      h.rotation.z = (i - 2) * 0.06;
      h.rotation.x = -0.12;
      this.longHair.add(h);
    }
    this.longHair.visible = false;
    this.headGroup.add(this.longHair);

    /* arms */
    const makeArm = (side) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 1.2, 4.78, 0);
      shoulder.rotation.z = side * 0.16;
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.31, 1.25, 14), this.shirtMat);
      sleeve.position.y = -0.62;
      sleeve.castShadow = true;
      shoulder.add(sleeve);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.14, 14), new THREE.MeshStandardMaterial({ color: 0xd6c6a8, roughness: 0.95 }));
      cuff.position.y = -1.28;
      shoulder.add(cuff);
      const elbow = new THREE.Group();
      elbow.position.y = -1.35;
      shoulder.add(elbow);
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 1.25, 14), skinMat);
      fore.position.y = -0.63;
      fore.castShadow = true;
      elbow.add(fore);
      // forearm stitches
      for (let i = 0; i < 3; i++) {
        const st = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.03), stitchMat);
        st.position.set(0, -0.38 - i * 0.16, 0.23);
        elbow.add(st);
      }
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.31, 14, 10), skinMat);
      hand.scale.set(0.85, 1.22, 0.68);
      hand.position.y = -1.36;
      elbow.add(hand);
      for (let i = 0; i < 4; i++) {
        const f = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.018, 0.55, 5), skinMat);
        f.position.set(-0.14 + i * 0.095, -1.67, 0.05);
        f.rotation.x = 0.18 + i * 0.03;
        elbow.add(f);
      }
      this.sway.add(shoulder);
      return { shoulder, elbow, hand };
    };
    this.armL = makeArm(-1);
    this.armR = makeArm(1);

    /* decorative yarn strands */
    this.strandMeshes = [];
    const strands = [
      { tag: 'arm_l', pts: [[-1.8, 2.3, 0.3], [-2.45, 1.15, 0.9], [-2.95, 0.02, 1.3]], color: 0xd8cfc0 },
      { tag: 'arm_r', pts: [[1.8, 2.3, 0.3], [2.5, 1.15, 0.95], [3.0, 0.02, 1.35]], color: 0xd8cfc0 },
      { tag: 'skirt', pts: [[0.5, 0.55, 0.9], [1.1, 0.22, 1.4], [1.8, 0.02, 1.9]], color: 0xb03a3a },
      { tag: 'skirt', pts: [[-0.8, 0.7, 0.82], [-1.45, 0.3, 1.25], [-2.1, 0.02, 1.65]], color: 0xd8cfc0 },
      { tag: 'back', pts: [[0.4, 1.8, -1.1], [0.9, 0.85, -1.85], [1.55, 0.02, -2.35]], color: 0x6b2713 }
    ];
    for (const s of strands) {
      const m = yarnTube(s.pts, 0.028, s.color, 0.75);
      m.userData.tag = s.tag;
      this.sway.add(m);
      this.strandMeshes.push(m);
    }

    /* stains */
    const stTex = stainTexture();
    this.stainMat = new THREE.MeshBasicMaterial({ map: stTex, transparent: true, opacity: 0, depthWrite: false });
    this.stains = [];
    const stainPos = [
      [0.72, 3.75, 1.16, 0.7, 0.9, -0.2],
      [-0.6, 4.25, 1.08, 0.55, 0.7, 0.25],
      [0.2, 2.95, 0.82, 0.8, 0.6, 0],
      [-0.5, 3.2, 0.78, 0.6, 0.55, 0.3],
      [0.65, 2.4, 0.5, 0.5, 0.6, -0.3]
    ];
    for (const [x, y, z, sx, sy, rz] of stainPos) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(sx, sy), this.stainMat);
      p.position.set(x, y, z);
      p.rotation.z = rz;
      p.lookAt(x * 1.8, y + 0.3, z * 1.8);
      this.sway.add(p);
      this.stains.push(p);
    }

    /* tendrils */
    this.tendrils = new THREE.Group();
    const tendrilMat = new THREE.MeshStandardMaterial({ color: 0x2b1a17, roughness: 0.95 });
    for (let i = 0; i < 5; i++) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1 + i * 0.5, 4.9, -0.7),
        new THREE.Vector3(-1.4 + i * 0.7, 5.7, -1.3),
        new THREE.Vector3(-1.2 + i * 0.6, 6.4, -1.0),
        new THREE.Vector3(-1.8 + i * 0.9, 7.0, -1.5)
      ]);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.05, 5, false), tendrilMat);
      this.tendrils.add(tube);
    }
    this.tendrils.visible = false;
    this.sway.add(this.tendrils);

    this.group.traverse(o => { if (o.isMesh) { o.castShadow = true; } });

    this.pose = {
      armLX: 0.05, armLZ: -0.16, elbowLX: 0.08,
      armRX: 0.05, armRZ: 0.16, elbowRX: 0.08,
      headX: 0.26, headY: 0
    };
  }

  /* ------------------------------------------------------------ */
  setStage(stage, force = false) {
    if (!force && stage === this.stage) return;
    this.stage = stage;

    if (this.faceMat.map) this.faceMat.map.dispose();
    this.faceMat.map = faceTexture(stage);
    this.faceMat.needsUpdate = true;

    if (this.shirtMat.map) this.shirtMat.map.dispose();
    this.shirtMat.map = shirtTexture(stage);
    this.shirtMat.needsUpdate = true;

    if (this.overallMat.map) this.overallMat.map.dispose();
    this.overallMat.map = denimTexture(stage);
    this.overallMat.needsUpdate = true;

    const tint = 1 - Math.min(0.4, (stage - 1) * 0.09);
    this.shirtMat.color.setRGB(tint, tint * 0.96, tint * 0.92);
    this.overallMat.color.setRGB(tint * 0.96, tint * 0.98, tint);

    this.stainMat.opacity = Math.max(0, stage - 1) * 0.16;
    this.longHair.visible = stage >= 3;
    this.longHair.scale.setScalar(0.7 + stage * 0.1);
    this.tendrils.visible = stage >= 4;

    for (const p of this.pupils) {
      p.material.emissiveIntensity = stage >= 5 ? 2.2 : 0.05;
    }
    this.skinMat.color.setHex(stage >= 5 ? 0xc7b3a3 : stage >= 4 ? 0xd9c5b4 : 0xe4d1bf);

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
        target = WORLD.door.outside;
        stopDist = 2.0;
      }
    } else {
      target = this.home;
      stopDist = 0.3;
      speed = 2.8;
    }

    const finalDist = Math.hypot(target.x - this.group.position.x, target.z - this.group.position.z);
    const wp = navWaypoint(this.group.position, target);
    const dx = wp.x - this.group.position.x;
    const dz = wp.z - this.group.position.z;
    const dist = Math.hypot(dx, dz);
    this.moving = false;

    if (finalDist > stopDist && dist > 0.02) {
      const move = Math.min(speed * dt, dist);
      const nx = dx / dist, nz = dz / dist;
      const next = this.group.position.clone();
      next.x += nx * move;
      next.z += nz * move;
      const cols = colliders.concat(doorClosed ? [WORLD.door.collider] : []);
      resolveCircle(next, 1.2, cols, bounds);
      const moved = next.distanceToSquared(this.group.position) > 0.00001;
      this.group.position.x = next.x;
      this.group.position.z = next.z;
      this.moving = moved || finalDist > stopDist + 0.5;

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

    const targetY = (!awake && finalDist < 2.5) ? this.home.y : 0.05;
    this.baseY += (targetY - this.baseY) * Math.min(1, dt * 2.5);
    const bob = this.moving ? Math.sin(this.time * 7.5) * 0.055 : Math.sin(this.time * 1.4) * 0.02;
    this.group.position.y = this.baseY + bob;

    this.sway.rotation.z = this.moving ? Math.sin(this.time * 7.5) * 0.026 : Math.sin(this.time * 0.9) * 0.006;
    this.sway.rotation.x = awake ? 0.045 : 0.008;

    const p = this.pose;
    const reach = awake ? 1 : 0;
    const tArmX = -1.08 * reach + 0.04;
    const tArmZ = awake ? -0.1 : -0.16;
    const tArmRZ = awake ? 0.1 : 0.16;
    const tElbow = awake ? 0.42 : 0.08;
    const tHeadX = awake ? -0.03 : 0.26;

    p.armLX += (tArmX - p.armLX) * Math.min(1, dt * 2.2);
    p.armRX += (tArmX - p.armRX) * Math.min(1, dt * 2.2);
    p.armLZ += (tArmZ - p.armLZ) * Math.min(1, dt * 2.2);
    p.armRZ += (tArmRZ - p.armRZ) * Math.min(1, dt * 2.2);
    p.elbowLX += (tElbow - p.elbowLX) * Math.min(1, dt * 2.2);
    p.elbowRX += (tElbow - p.elbowRX) * Math.min(1, dt * 2.2);
    p.headX += (tHeadX - p.headX) * Math.min(1, dt * 2.0);

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

    const glowTarget = awake
      ? (stage >= 4 ? 2.6 : 1.2)
      : (stage >= 3 ? 0.12 : 0.02);
    this.eyeGlow += (glowTarget - this.eyeGlow) * Math.min(1, dt * 3);
    for (const pupil of this.pupils) pupil.material.emissiveIntensity = this.eyeGlow + (this.twitch > 0.1 ? 0.7 : 0);
    this.eyeLight.intensity = awake ? 2.2 + stage * 0.5 : (stage >= 3 ? 0.15 : 0);
    this.eyeLight.position.x = Math.sin(this.time * 2.2) * 0.04;

    if (this.tendrils.visible) {
      this.tendrils.rotation.y = Math.sin(this.time * 1.3) * 0.14;
      this.tendrils.rotation.z = Math.sin(this.time * 1.7) * 0.08;
    }

    const breathe = 1 + Math.sin(this.time * 1.1) * 0.008;
    this.torso.scale.y = breathe;
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
    const tArmZ = awake ? -0.1 : -0.16;
    const tArmRZ = awake ? 0.1 : 0.16;
    const tElbow = awake ? 0.42 : 0.08;
    const tHeadX = awake ? -0.03 : 0.26;

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

    const breathe = 1 + Math.sin(this.time * 1.1) * 0.008;
    this.torso.scale.y = breathe;
  }
}
