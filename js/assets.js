import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

export function loadGLB(url) {
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });
}

export async function loadGLBSafe(url) {
  try {
    return await loadGLB(url);
  } catch (err) {
    console.warn(`[assets] ${url} fehlt – prozeduraler Fallback bleibt aktiv`);
    return null;
  }
}

/* Skaliert auf Höhe bzw. Grundfläche, zentriert X/Z und setzt die Unterseite auf y = 0. */
export function fitModel(root, { height = 0, maxWidth = 0, maxDepth = 0, center = true } = {}) {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);

  let k = 1;
  if (maxWidth && maxDepth) k = Math.min(maxWidth / (size.x || 1), maxDepth / (size.z || 1));
  if (height) k = height / (size.y || 1);
  root.scale.multiplyScalar(k);

  box.setFromObject(root);
  if (center) {
    const c = new THREE.Vector3();
    box.getCenter(c);
    root.position.x -= c.x;
    root.position.z -= c.z;
  }
  root.position.y -= box.min.y;
  return root;
}

/* KI-Modelle sind zu schwer für zusätzliche Shadow-Passes. */
export function markStatic(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });
  return root;
}
