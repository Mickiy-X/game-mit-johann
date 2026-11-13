import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function tex(canvas, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4;
  return t;
}

function rand(a, b) { return a + Math.random() * (b - a); }

/* ------------------------------------------------------------ */
/* Concrete floor                                               */
/* ------------------------------------------------------------ */
export function concreteTexture() {
  const c = makeCanvas(1024, 1024);
  const g = c.getContext('2d');
  g.fillStyle = '#3a3b3c';
  g.fillRect(0, 0, 1024, 1024);

  // large blotches
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 1024, y = Math.random() * 1024;
    const r = rand(30, 220);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const dark = Math.random() > 0.5;
    grd.addColorStop(0, dark ? 'rgba(20,20,20,0.10)' : 'rgba(160,158,150,0.06)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }

  // speckle
  const img = g.getImageData(0, 0, 1024, 1024);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 22;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  g.putImageData(img, 0, 0);

  // seams / slabs
  g.strokeStyle = 'rgba(15,15,16,0.5)';
  g.lineWidth = 4;
  for (let i = 1; i < 4; i++) {
    g.beginPath(); g.moveTo(i * 256, 0); g.lineTo(i * 256 + rand(-8, 8), 1024); g.stroke();
    g.beginPath(); g.moveTo(0, i * 256); g.lineTo(1024, i * 256 + rand(-8, 8)); g.stroke();
  }
  g.strokeStyle = 'rgba(120,118,112,0.13)';
  g.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    g.beginPath(); g.moveTo(i * 256 + 3, 0); g.lineTo(i * 256 + 3, 1024); g.stroke();
    g.beginPath(); g.moveTo(0, i * 256 + 3); g.lineTo(1024, i * 256 + 3); g.stroke();
  }

  // cracks
  g.strokeStyle = 'rgba(12,12,13,0.45)';
  g.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    let x = Math.random() * 1024, y = Math.random() * 1024;
    g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 9; s++) {
      x += rand(-40, 40); y += rand(-40, 40);
      g.lineTo(x, y);
    }
    g.stroke();
  }

  // oil stains
  for (let i = 0; i < 6; i++) {
    const x = Math.random() * 1024, y = Math.random() * 1024;
    const grd = g.createRadialGradient(x, y, 0, x, y, rand(40, 110));
    grd.addColorStop(0, 'rgba(8,8,8,0.36)');
    grd.addColorStop(0.7, 'rgba(10,10,10,0.12)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, rand(40, 110), 0, Math.PI * 2); g.fill();
  }

  // faded safety line
  g.save();
  g.translate(512, 512);
  g.strokeStyle = 'rgba(200,155,40,0.22)';
  g.lineWidth = 16;
  g.setLineDash([64, 32]);
  g.strokeRect(-380, -380, 760, 760);
  g.restore();

  return tex(c, 6, 8);
}

/* ------------------------------------------------------------ */
/* Factory wall panels                                          */
/* ------------------------------------------------------------ */
export function wallTexture() {
  const c = makeCanvas(512, 512);
  const g = c.getContext('2d');
  const base = g.createLinearGradient(0, 0, 0, 512);
  base.addColorStop(0, '#4a4d4f');
  base.addColorStop(0.5, '#3c3f41');
  base.addColorStop(1, '#2e3133');
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 512);

  // panel seams
  g.strokeStyle = 'rgba(12,13,14,0.65)';
  g.lineWidth = 4;
  for (let x = 0; x <= 512; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
  for (let y = 0; y <= 512; y += 256) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
  g.strokeStyle = 'rgba(190,196,200,0.07)';
  g.lineWidth = 1.5;
  for (let x = 3; x <= 512; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }

  // rivets
  g.fillStyle = 'rgba(20,21,22,0.8)';
  for (let x = 16; x < 512; x += 128) {
    for (let y = 16; y < 512; y += 64) {
      g.beginPath(); g.arc(x, y, 2.4, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(200,205,208,0.13)';
      g.beginPath(); g.arc(x - 0.7, y - 0.7, 1.1, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(20,21,22,0.8)';
    }
  }

  // rust streaks
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * 512, y = rand(0, 380);
    const grd = g.createLinearGradient(x, y, x, y + rand(40, 130));
    grd.addColorStop(0, 'rgba(120,62,30,0.16)');
    grd.addColorStop(1, 'rgba(120,62,30,0)');
    g.fillStyle = grd;
    g.fillRect(x - rand(2, 6), y, rand(4, 13), rand(50, 150));
  }

  // scratches
  g.strokeStyle = 'rgba(210,214,216,0.06)';
  g.lineWidth = 1;
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * 512, y = Math.random() * 512;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + rand(-30, 30), y + rand(10, 60)); g.stroke();
  }
  return tex(c, 4, 2);
}

/* ------------------------------------------------------------ */
export function woodTexture() {
  const c = makeCanvas(512, 512);
  const g = c.getContext('2d');
  g.fillStyle = '#6a4d34';
  g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 64) {
    g.fillStyle = `rgba(${rand(70, 105) | 0},${rand(48, 72) | 0},${rand(30, 45) | 0},1)`;
    g.fillRect(0, y, 512, 63);
    g.strokeStyle = 'rgba(25,16,10,0.55)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, y + 63); g.lineTo(512, y + 63); g.stroke();
    // grain
    for (let i = 0; i < 10; i++) {
      g.strokeStyle = `rgba(40,25,14,${rand(0.05, 0.18)})`;
      g.lineWidth = rand(0.5, 1.8);
      const yy = y + rand(4, 58);
      g.beginPath();
      g.moveTo(0, yy);
      g.bezierCurveTo(140, yy + rand(-5, 5), 350, yy + rand(-5, 5), 512, yy + rand(-4, 4));
      g.stroke();
    }
    // nails
    g.fillStyle = 'rgba(20,18,15,0.8)';
    g.beginPath(); g.arc(24, y + 32, 2.4, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(488, y + 32, 2.4, 0, Math.PI * 2); g.fill();
  }
  return tex(c, 1, 1);
}

/* ------------------------------------------------------------ */
export function metalTexture(tint = 0) {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = tint ? '#4a4d50' : '#575b5e';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 200; i++) {
    g.strokeStyle = `rgba(255,255,255,${rand(0.005, 0.03)})`;
    g.beginPath();
    const y = Math.random() * 256;
    g.moveTo(0, y); g.lineTo(256, y + rand(-1, 1)); g.stroke();
  }
  for (let i = 0; i < 6; i++) {
    const x = Math.random() * 256, y = Math.random() * 256;
    const grd = g.createRadialGradient(x, y, 0, x, y, 40);
    grd.addColorStop(0, 'rgba(20,20,20,0.22)');
    grd.addColorStop(1, 'rgba(20,20,20,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, 40, 0, Math.PI * 2); g.fill();
  }
  return tex(c, 2, 2);
}

/* ------------------------------------------------------------ */
/* Porcelain face decal (transparent)                          */
/* ------------------------------------------------------------ */
export function faceTexture(stage) {
  const S = 512;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  g.clearRect(0, 0, S, S);

  // eyebrow paint
  g.strokeStyle = 'rgba(70,40,30,0.72)';
  g.lineWidth = 5;
  g.lineCap = 'round';
  g.beginPath(); g.arc(S * 0.27, S * 0.34, 44, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
  g.beginPath(); g.arc(S * 0.73, S * 0.34, 44, Math.PI * 1.15, Math.PI * 1.85); g.stroke();

  // eye sockets painted
  for (const ex of [S * 0.27, S * 0.73]) {
    const grd = g.createRadialGradient(ex, S * 0.42, 4, ex, S * 0.42, 34);
    grd.addColorStop(0, 'rgba(30,16,14,0.85)');
    grd.addColorStop(0.62, 'rgba(45,25,20,0.55)');
    grd.addColorStop(1, 'rgba(60,30,25,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.ellipse(ex, S * 0.42, 35, 27, 0, 0, Math.PI * 2);
    g.fill();
    // lashes
    g.strokeStyle = 'rgba(50,28,22,0.75)';
    g.lineWidth = 3;
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo(ex + i * 12, S * 0.42 + 20);
      g.lineTo(ex + i * 14, S * 0.42 + 31);
      g.stroke();
    }
  }

  // rosy cheeks
  for (const cx of [S * 0.2, S * 0.8]) {
    const grd = g.createRadialGradient(cx, S * 0.58, 2, cx, S * 0.58, 52);
    grd.addColorStop(0, 'rgba(205,110,100,0.28)');
    grd.addColorStop(1, 'rgba(205,110,100,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(cx, S * 0.58, 52, 0, Math.PI * 2); g.fill();
  }

  // nose
  g.strokeStyle = 'rgba(90,55,45,0.35)';
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(S * 0.5, S * 0.48); g.quadraticCurveTo(S * 0.475, S * 0.56, S * 0.505, S * 0.575); g.stroke();

  // mouth
  g.strokeStyle = 'rgba(105,35,38,0.85)';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(S * 0.42, S * 0.68);
  g.quadraticCurveTo(S * 0.5, S * 0.665, S * 0.58, S * 0.68);
  g.stroke();
  if (stage >= 3) {
    // stitched mouth
    g.strokeStyle = 'rgba(60,25,25,0.9)';
    g.lineWidth = 2.5;
    for (let i = 0; i < 6; i++) {
      const x = S * 0.42 + i * (S * 0.16 / 5);
      g.beginPath(); g.moveTo(x, S * 0.655); g.lineTo(x + 3, S * 0.705); g.stroke();
    }
  }
  if (stage >= 4) {
    // open crack mouth
    g.fillStyle = 'rgba(25,5,5,0.88)';
    g.beginPath();
    g.ellipse(S * 0.5, S * 0.695, 34, 20, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(225,215,200,0.75)';
    for (let i = 0; i < 5; i++) {
      const x = S * 0.5 - 26 + i * 12;
      g.beginPath();
      g.moveTo(x, S * 0.68); g.lineTo(x + 5, S * 0.68); g.lineTo(x + 2.5, S * 0.705); g.closePath(); g.fill();
    }
  }

  // cracks per stage
  const crackCount = Math.max(0, stage - 1) * 3;
  for (let i = 0; i < crackCount; i++) {
    let x = rand(40, S - 40);
    let y = rand(20, S * 0.3);
    if (Math.random() < 0.5) { x = rand(S * 0.18, S * 0.82); y = rand(S * 0.1, S * 0.72); }
    g.strokeStyle = `rgba(28,18,16,${rand(0.45, 0.8)})`;
    g.lineWidth = rand(1.2, 2.8);
    g.beginPath();
    g.moveTo(x, y);
    const steps = (8 + Math.random() * 8) | 0;
    for (let s = 0; s < steps; s++) {
      x += rand(-22, 22);
      y += rand(3, 24);
      g.lineTo(x, y);
    }
    g.stroke();
  }

  // grime at hairline
  const grd = g.createLinearGradient(0, 0, 0, S * 0.22);
  grd.addColorStop(0, `rgba(45,30,25,${0.14 + stage * 0.04})`);
  grd.addColorStop(1, 'rgba(45,30,25,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S * 0.22);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* ------------------------------------------------------------ */
export function dressTexture(stage) {
  const W = 512, H = 1024;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');

  const shade = Math.max(0, 0.28 - stage * 0.05);
  const base = g.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, stage >= 5 ? '#6e5651' : '#c0aaa4');
  base.addColorStop(0.6, stage >= 5 ? '#5a4440' : '#a98f89');
  base.addColorStop(1, stage >= 5 ? '#3c2c29' : '#7f6a66');
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);

  // fabric noise
  const img = g.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 18;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);

  // vertical seams and folds
  for (let x = 40; x < W; x += 68) {
    g.strokeStyle = `rgba(40,25,22,${0.12 + shade * 0.4})`;
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + rand(-10, 10), H); g.stroke();
    g.strokeStyle = 'rgba(255,240,235,0.045)';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(x + 5, 0); g.lineTo(x + 5, H); g.stroke();
  }

  // lace at bottom
  g.strokeStyle = 'rgba(230,215,205,0.22)';
  g.lineWidth = 2;
  for (let x = 0; x < W; x += 26) {
    g.beginPath();
    g.arc(x + 13, H - 26, 13, 0, Math.PI);
    g.stroke();
  }

  // stains
  const stains = 4 + stage * 5;
  for (let i = 0; i < stains; i++) {
    const x = Math.random() * W, y = rand(H * 0.15, H);
    const r = rand(16, 80);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const darkRed = stage >= 4 && Math.random() < 0.4;
    grd.addColorStop(0, darkRed ? 'rgba(70,15,12,0.4)' : 'rgba(30,20,16,0.35)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }

  // torn patches at high stage
  if (stage >= 4) {
    for (let i = 0; i < 5; i++) {
      const x = rand(40, W - 40), y = rand(H * 0.2, H * 0.9);
      const w = rand(7, 30), h = rand(14, 60);
      g.fillStyle = 'rgba(12,8,8,0.75)';
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + w, y + rand(-4, 8));
      g.lineTo(x + w * 0.5, y + h);
      g.lineTo(x - w * 0.4, y + h * 0.6);
      g.closePath(); g.fill();
    }
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/* ------------------------------------------------------------ */
export function glowTexture() {
  const c = makeCanvas(128, 128);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.65)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  return t;
}

/* ------------------------------------------------------------ */
export function signTexture(text, sub = '', color = '#d8a13f', bg = '#1a1c1d') {
  const c = makeCanvas(512, 256);
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 256);
  g.strokeStyle = color;
  g.lineWidth = 6;
  g.strokeRect(12, 12, 488, 232);
  g.fillStyle = color;
  g.font = 'bold 54px Oswald, Arial Narrow, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    g.fillText(line, 256, 100 + i * 62 - (lines.length - 1) * 20);
  });
  if (sub) {
    g.fillStyle = 'rgba(230,225,215,0.55)';
    g.font = '20px Consolas, monospace';
    g.fillText(sub, 256, 206);
  }
  // scratches
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const x = Math.random() * 512, y = Math.random() * 256;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + rand(-30, 30), y + rand(-16, 16)); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ------------------------------------------------------------ */
export function nameTexture(name) {
  const c = makeCanvas(256, 64);
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 64);
  g.fillStyle = 'rgba(5,7,9,0.72)';
  g.fillRect(0, 8, 256, 48);
  g.strokeStyle = 'rgba(123,196,255,0.6)';
  g.lineWidth = 2;
  g.strokeRect(2, 10, 252, 44);
  g.fillStyle = '#cfe9ff';
  g.font = 'bold 26px Consolas, monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(name, 128, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ------------------------------------------------------------ */
export function hazardTexture() {
  const c = makeCanvas(256, 64);
  const g = c.getContext('2d');
  g.fillStyle = '#151617';
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#c79a2f';
  for (let x = -64; x < 320; x += 64) {
    g.beginPath();
    g.moveTo(x, 64); g.lineTo(x + 32, 64); g.lineTo(x + 96, 0); g.lineTo(x + 64, 0);
    g.closePath(); g.fill();
  }
  // wear
  g.fillStyle = 'rgba(20,20,20,0.4)';
  for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 256, Math.random() * 64, rand(2, 12), rand(1, 5));
  return tex(c, 3, 1);
}

export function monitorTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
