import * as THREE from 'three';

/* Stylized factory worker shared by Johann and the co-op avatars. */
export function buildWorkerFigure(opts = {}) {
  const {
    skin = 0xd6a37e,
    shirt = 0xb7a98f,
    overall = 0x2f4e73,
    cap = 0xc9a536,
    boot = 0x2a2521,
    hair = 0x4a3524,
    capOn = true
  } = opts;

  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.72 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.92 });
  const denimMat = new THREE.MeshStandardMaterial({ color: overall, roughness: 0.94 });
  const denimDark = new THREE.MeshStandardMaterial({ color: new THREE.Color(overall).multiplyScalar(0.78), roughness: 0.95 });
  const capMat = new THREE.MeshStandardMaterial({ color: cap, roughness: 0.78 });
  const bootMat = new THREE.MeshStandardMaterial({ color: boot, roughness: 0.82 });
  const soleMat = new THREE.MeshStandardMaterial({ color: 0x171310, roughness: 0.95 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x14100d, roughness: 0.55 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf3ece0, roughness: 0.35 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.9 });
  const hairDark = new THREE.MeshStandardMaterial({ color: new THREE.Color(hair).multiplyScalar(0.7), roughness: 0.92 });
  const buckleMat = new THREE.MeshStandardMaterial({ color: 0xa8925c, roughness: 0.35, metalness: 0.75 });
  const cuffMat = new THREE.MeshStandardMaterial({ color: 0xd6c6a8, roughness: 0.95 });
  const stitchMat = new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.9 });

  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  /* legs + boots ------------------------------------------------ */
  const HIP_Y = 0.89;
  let legL = null;
  let legR = null;
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.145, HIP_Y, 0);

    add(leg, new THREE.CylinderGeometry(0.115, 0.1, 0.44, 10), denimMat, 0, -0.22, 0);
    const knee = add(leg, new THREE.SphereGeometry(0.104, 10, 8), denimMat, 0, -0.445, 0.005);
    knee.scale.set(1, 0.82, 1);
    add(leg, new THREE.CylinderGeometry(0.095, 0.082, 0.38, 10), denimMat, 0, -0.63, 0);
    add(leg, new THREE.CylinderGeometry(0.098, 0.098, 0.06, 10), cuffMat, 0, -0.815, 0);
    add(leg, new THREE.BoxGeometry(0.11, 0.1, 0.014), denimDark, side * 0.035, -0.45, 0.096);

    add(leg, new THREE.BoxGeometry(0.2, 0.13, 0.3), bootMat, 0, -0.8, 0.045);
    const toe = add(leg, new THREE.SphereGeometry(0.1, 10, 8), bootMat, 0, -0.805, 0.2);
    toe.scale.set(1, 0.68, 0.92);
    add(leg, new THREE.BoxGeometry(0.23, 0.05, 0.35), soleMat, 0, -0.865, 0.055);
    for (let i = 0; i < 2; i++) {
      add(leg, new THREE.BoxGeometry(0.11, 0.018, 0.014), cuffMat, 0, -0.762 + i * 0.052, 0.2);
    }

    body.add(leg);
    if (side < 0) legL = leg; else legR = leg;
  }

  const hips = add(body, new THREE.SphereGeometry(0.24, 14, 10), denimMat, 0, 0.93, 0);
  hips.scale.set(1.06, 0.66, 0.82);

  /* torso + overalls -------------------------------------------- */
  add(body, new THREE.CylinderGeometry(0.255, 0.225, 0.58, 14), shirtMat, 0, 1.19, 0);
  const chest = add(body, new THREE.SphereGeometry(0.26, 14, 10), shirtMat, 0, 1.45, 0);
  chest.scale.set(1.05, 0.62, 0.85);
  add(body, new THREE.BoxGeometry(0.34, 0.36, 0.05), denimMat, 0, 1.29, 0.222);
  add(body, new THREE.BoxGeometry(0.16, 0.12, 0.018), denimDark, 0, 1.22, 0.25);

  for (const side of [-1, 1]) {
    const strap = add(body, new THREE.BoxGeometry(0.068, 0.37, 0.03), denimMat, side * 0.125, 1.44, 0.208);
    strap.rotation.x = -0.16;
    add(body, new THREE.BoxGeometry(0.078, 0.058, 0.026), buckleMat, side * 0.125, 1.3, 0.258);
    add(body, new THREE.SphereGeometry(0.012, 6, 6), buckleMat, side * 0.125, 1.27, 0.273);
  }

  const collar = add(body, new THREE.TorusGeometry(0.15, 0.022, 6, 16), cuffMat, 0, 1.552, 0);
  collar.rotation.x = Math.PI / 2;
  add(body, new THREE.CylinderGeometry(0.075, 0.09, 0.13, 10), skinMat, 0, 1.585, 0);

  /* head -------------------------------------------------------- */
  const head = new THREE.Group();
  head.position.set(0, 1.745, 0);
  body.add(head);

  const skull = add(head, new THREE.SphereGeometry(0.195, 20, 16), skinMat, 0, 0, 0);
  skull.scale.set(1, 1.06, 0.97);
  const jaw = add(head, new THREE.SphereGeometry(0.14, 14, 10), skinMat, 0, -0.07, 0.02);
  jaw.scale.set(1.02, 0.72, 0.92);

  for (const side of [-1, 1]) {
    const ear = add(head, new THREE.SphereGeometry(0.045, 8, 6), skinMat, side * 0.187, -0.01, 0);
    ear.scale.set(0.55, 1.0, 0.78);
  }

  const nose = add(head, new THREE.SphereGeometry(0.035, 8, 6), skinMat, 0, -0.012, 0.192);
  nose.scale.set(0.85, 1.15, 0.9);

  for (const side of [-1, 1]) {
    const eye = add(head, new THREE.SphereGeometry(0.042, 10, 8), whiteMat, side * 0.073, 0.018, 0.168);
    eye.scale.set(1, 1, 0.55);
    add(head, new THREE.SphereGeometry(0.021, 8, 6), darkMat, side * 0.073, 0.018, 0.196);
    add(head, new THREE.SphereGeometry(0.008, 6, 6), whiteMat, side * 0.079, 0.026, 0.203);
    const brow = add(head, new THREE.BoxGeometry(0.075, 0.016, 0.02), hairDark, side * 0.073, 0.085, 0.176);
    brow.rotation.z = side * -0.12;
  }

  add(head, new THREE.BoxGeometry(0.055, 0.012, 0.012), new THREE.MeshStandardMaterial({ color: 0x5a3830, roughness: 0.8 }), 0, -0.082, 0.183);

  const backHair = add(head, new THREE.SphereGeometry(0.19, 14, 10), hairMat, 0, 0.025, -0.032);
  backHair.scale.set(1.02, 1.0, 0.92);
  for (const side of [-1, 1]) {
    const sideburn = add(head, new THREE.SphereGeometry(0.05, 8, 6), hairDark, side * 0.168, -0.035, 0.03);
    sideburn.scale.set(0.55, 1.15, 0.8);
  }

  if (capOn) {
    const capTop = add(head, new THREE.SphereGeometry(0.203, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.4), capMat, 0, 0.035, 0);
    capTop.scale.set(1, 0.95, 1.04);
    add(head, new THREE.CylinderGeometry(0.204, 0.204, 0.032, 18), capMat, 0, 0.092, 0);
    const brim = add(head, new THREE.BoxGeometry(0.32, 0.028, 0.18), capMat, 0, 0.086, 0.2);
    brim.rotation.x = -0.06;
    add(head, new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshStandardMaterial({ color: new THREE.Color(cap).multiplyScalar(0.82), roughness: 0.8 }), 0, 0.199, 0.012);
  } else {
    const hairTop = add(head, new THREE.SphereGeometry(0.2, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), hairMat, 0, 0.03, 0);
    hairTop.scale.set(1.01, 1.0, 1.01);
  }

  /* arms -------------------------------------------------------- */
  const SHOULDER_Y = 1.47;
  let armL = null;
  let armR = null;
  let elbowL = null;
  let elbowR = null;
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.315, SHOULDER_Y, 0);
    arm.rotation.z = side * 0.08;

    add(arm, new THREE.SphereGeometry(0.095, 10, 8), shirtMat, 0, 0.005, 0);
    add(arm, new THREE.CylinderGeometry(0.088, 0.078, 0.3, 10), shirtMat, 0, -0.15, 0);
    add(arm, new THREE.CylinderGeometry(0.081, 0.081, 0.045, 10), cuffMat, 0, -0.303, 0);

    const elbow = new THREE.Group();
    elbow.position.y = -0.315;
    arm.add(elbow);
    add(elbow, new THREE.CylinderGeometry(0.072, 0.062, 0.26, 10), skinMat, 0, -0.13, 0);

    const hand = add(elbow, new THREE.SphereGeometry(0.082, 12, 10), skinMat, 0, -0.285, 0.012);
    hand.scale.set(0.95, 1.15, 0.72);
    const thumb = add(elbow, new THREE.SphereGeometry(0.032, 8, 6), skinMat, side * -0.062, -0.263, 0.045);
    thumb.scale.set(0.8, 1.3, 0.8);
    for (let i = 0; i < 3; i++) {
      const finger = add(elbow, new THREE.SphereGeometry(0.022, 6, 5), skinMat, -0.03 + i * 0.03, -0.352, 0.028);
      finger.scale.set(0.8, 1.55, 0.8);
    }

    body.add(arm);
    if (side < 0) { armL = arm; elbowL = elbow; }
    else { armR = arm; elbowR = elbow; }
  }

  const carryAnchor = new THREE.Group();
  carryAnchor.position.set(0.34, 1.12, 0.32);
  body.add(carryAnchor);

  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  return { root, body, head, legL, legR, armL, armR, elbowL, elbowR, carryAnchor };
}
