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
/* Vinyl face decal (transparent)                               */
/* ------------------------------------------------------------ */
export function faceTexture(stage) {
  const S = 512;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  g.lineCap = 'round';

  // strong painted eyebrows, one a little higher for an off look
  g.strokeStyle = 'rgba(92,38,26,0.82)';
  g.lineWidth = 7;
  g.beginPath(); g.arc(S * 0.28, S * 0.33, 44, Math.PI * 1.12, Math.PI * 1.9); g.stroke();
  g.lineWidth = 6;
  g.beginPath(); g.arc(S * 0.72, S * 0.315, 42, Math.PI * 1.1, Math.PI * 1.86); g.stroke();

  // bruised sockets
  for (const [ex, ey] of [[S * 0.28, S * 0.43], [S * 0.72, S * 0.445]]) {
    const grd = g.createRadialGradient(ex, ey, 6, ex, ey, 44);
    grd.addColorStop(0, 'rgba(48,26,22,0.5)');
    grd.addColorStop(0.55, 'rgba(58,34,28,0.25)');
    grd.addColorStop(1, 'rgba(58,34,28,0)');
    g.fillStyle = grd;
    g.beginPath(); g.ellipse(ex, ey, 44, 34, 0, 0, Math.PI * 2); g.fill();
  }

  // glassy green-blue eyes, right one slightly wider and lower
  const eyes = [
    { x: S * 0.28, y: S * 0.43, r: 30 },
    { x: S * 0.72, y: S * 0.445, r: 34 }
  ];
  for (const e of eyes) {
    const iris = g.createRadialGradient(e.x - 6, e.y - 7, 2, e.x, e.y, e.r);
    iris.addColorStop(0, 'rgba(214,236,232,0.95)');
    iris.addColorStop(0.32, 'rgba(109,158,146,0.95)');
    iris.addColorStop(0.75, 'rgba(52,96,88,0.95)');
    iris.addColorStop(1, 'rgba(16,30,28,0.95)');
    g.fillStyle = iris;
    g.beginPath(); g.ellipse(e.x, e.y, e.r, e.r * 0.86, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(8,10,10,0.95)';
    g.beginPath(); g.ellipse(e.x + 1, e.y, e.r * 0.32, e.r * 0.42, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.beginPath(); g.arc(e.x - e.r * 0.34, e.y - e.r * 0.34, e.r * 0.16, 0, Math.PI * 2); g.fill();
    // lower lid
    g.strokeStyle = 'rgba(58,32,26,0.6)';
    g.lineWidth = 3;
    g.beginPath(); g.arc(e.x, e.y + 4, e.r * 0.95, Math.PI * 0.18, Math.PI * 0.82); g.stroke();
  }

  // freckles
  for (let i = 0; i < 46; i++) {
    const x = S * 0.5 + rand(-S * 0.22, S * 0.22);
    const y = S * 0.5 + rand(-S * 0.05, S * 0.1);
    g.fillStyle = `rgba(126,70,50,${rand(0.18, 0.4)})`;
    g.beginPath(); g.arc(x, y, rand(0.8, 2.3), 0, Math.PI * 2); g.fill();
  }

  // nose
  g.strokeStyle = 'rgba(96,58,46,0.4)';
  g.lineWidth = 3.5;
  g.beginPath(); g.moveTo(S * 0.5, S * 0.49); g.quadraticCurveTo(S * 0.47, S * 0.57, S * 0.512, S * 0.585); g.stroke();

  // stitched scar from temple to cheek
  g.strokeStyle = 'rgba(70,28,24,0.9)';
  g.lineWidth = 4;
  g.beginPath(); g.moveTo(S * 0.16, S * 0.24); g.quadraticCurveTo(S * 0.2, S * 0.37, S * 0.24, S * 0.52); g.stroke();
  g.strokeStyle = 'rgba(38,16,14,0.95)';
  g.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const y = S * 0.27 + i * S * 0.045;
    const x = S * 0.165 + i * S * 0.012;
    g.beginPath(); g.moveTo(x - 10, y - 4); g.lineTo(x + 10, y + 4); g.stroke();
  }

  // stitched mouth
  const mouthY = S * 0.69;
  g.strokeStyle = 'rgba(82,24,26,0.92)';
  g.lineWidth = 5;
  if (stage <= 2) {
    g.beginPath(); g.moveTo(S * 0.4, mouthY - 4); g.quadraticCurveTo(S * 0.5, mouthY + 9, S * 0.6, mouthY - 4); g.stroke();
  } else {
    g.beginPath(); g.moveTo(S * 0.38, mouthY - 2); g.quadraticCurveTo(S * 0.5, mouthY + 22, S * 0.62, mouthY - 2); g.stroke();
  }
  g.strokeStyle = 'rgba(35,12,12,0.95)';
  g.lineWidth = 2.4;
  for (let i = 0; i < 8; i++) {
    const x = S * 0.39 + i * (S * 0.22 / 7);
    const lift = Math.sin((i / 7) * Math.PI) * 9;
    g.beginPath(); g.moveTo(x, mouthY - 5 + lift * 0.2); g.lineTo(x + 2, mouthY + 7 + lift * 0.5); g.stroke();
  }

  if (stage >= 4) {
    g.fillStyle = 'rgba(22,5,6,0.9)';
    g.beginPath(); g.ellipse(S * 0.5, mouthY + 6, 40, 21, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(222,210,188,0.8)';
    for (let i = 0; i < 6; i++) {
      const x = S * 0.5 - 30 + i * 12;
      g.beginPath();
      g.moveTo(x, mouthY - 1); g.lineTo(x + 6, mouthY - 1); g.lineTo(x + 3, mouthY + 7); g.closePath(); g.fill();
    }
  }

  // dirt at hairline and chin
  const hairline = g.createLinearGradient(0, 0, 0, S * 0.2);
  hairline.addColorStop(0, `rgba(48,30,24,${0.18 + stage * 0.04})`);
  hairline.addColorStop(1, 'rgba(48,30,24,0)');
  g.fillStyle = hairline;
  g.fillRect(0, 0, S, S * 0.2);
  const chin = g.createLinearGradient(0, S * 0.84, 0, S);
  chin.addColorStop(0, 'rgba(45,28,22,0)');
  chin.addColorStop(1, 'rgba(45,28,22,0.22)');
  g.fillStyle = chin;
  g.fillRect(0, S * 0.84, S, S * 0.16);

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

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* ------------------------------------------------------------ */
/* Striped doll shirt                                           */
/* ------------------------------------------------------------ */
export function shirtTexture(stage) {
  const W = 512, H = 512;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');

  g.fillStyle = stage >= 5 ? '#8f7d68' : '#d6c9ae';
  g.fillRect(0, 0, W, H);

  const stripe = stage >= 5 ? '#5e1f1e' : '#8f2f2b';
  for (let y = 0; y < H; y += 64) {
    g.fillStyle = stripe;
    g.globalAlpha = 0.9;
    g.fillRect(0, y + 10, W, 30);
    g.globalAlpha = 1;
  }

  // weave noise
  const img = g.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 20;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);

  // vertical knit shadows
  for (let x = 0; x < W; x += 14) {
    g.strokeStyle = `rgba(30,18,14,${rand(0.03, 0.1)})`;
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + rand(-2, 2), H); g.stroke();
  }

  // stains
  for (let i = 0; i < 6 + stage * 4; i++) {
    const x = Math.random() * W, y = Math.random() * H, r = rand(10, 55);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const red = stage >= 3 && Math.random() < 0.35;
    grd.addColorStop(0, red ? 'rgba(72,14,12,0.4)' : 'rgba(34,24,18,0.32)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }

  // torn patches
  if (stage >= 4) {
    for (let i = 0; i < 4; i++) {
      const x = rand(30, W - 30), y = rand(40, H - 40);
      g.fillStyle = 'rgba(16,10,9,0.8)';
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + rand(10, 30), y + rand(-4, 6));
      g.lineTo(x + rand(4, 18), y + rand(20, 46));
      g.lineTo(x - rand(4, 12), y + rand(10, 24));
      g.closePath(); g.fill();
    }
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/* ------------------------------------------------------------ */
/* Denim overalls                                               */
/* ------------------------------------------------------------ */
export function denimTexture(stage) {
  const W = 512, H = 512;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');

  g.fillStyle = stage >= 5 ? '#2c3442' : '#384d63';
  g.fillRect(0, 0, W, H);

  // diagonal twill weave
  g.globalAlpha = 0.16;
  for (let i = -H; i < W; i += 5) {
    g.strokeStyle = i % 10 === 0 ? '#8fa4b8' : '#141c26';
    g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + H, H); g.stroke();
  }
  g.globalAlpha = 1;

  // weave noise
  const img = g.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 16;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);

  // seams
  g.strokeStyle = 'rgba(208,196,160,0.28)';
  g.lineWidth = 2;
  for (const x of [70, 256, 442]) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + rand(-4, 4), H); g.stroke();
  }

  // pocket
  g.strokeStyle = 'rgba(210,196,158,0.32)';
  g.strokeRect(196, 150, 120, 110);
  g.strokeStyle = 'rgba(12,18,24,0.28)';
  g.strokeRect(199, 153, 114, 104);

  // oil and rust
  for (let i = 0; i < 5 + stage * 3; i++) {
    const x = Math.random() * W, y = Math.random() * H, r = rand(12, 54);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, Math.random() < 0.3 ? 'rgba(88,42,20,0.34)' : 'rgba(12,14,18,0.38)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }

  if (stage >= 4) {
    for (let i = 0; i < 3; i++) {
      const x = rand(30, W - 30), y = rand(60, H - 60);
      g.fillStyle = 'rgba(8,10,12,0.72)';
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + rand(8, 26), y + rand(-2, 8));
      g.lineTo(x + rand(2, 16), y + rand(16, 40));
      g.closePath(); g.fill();
    }
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/* ------------------------------------------------------------ */
/* Safe-room tiles                                              */
/* ------------------------------------------------------------ */
export function tileTexture() {
  const S = 512;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  g.fillStyle = '#202525';
  g.fillRect(0, 0, S, S);
  const n = 4;
  const step = S / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const light = (x + y) % 2 === 0;
      g.fillStyle = light ? '#6d726b' : '#39413c';
      g.fillRect(x * step + 3, y * step + 3, step - 6, step - 6);
      g.fillStyle = `rgba(255,255,255,${rand(0.01, 0.04)})`;
      g.fillRect(x * step + 3, y * step + 3, step - 6, 6);
    }
  }
  for (let i = 0; i < 5; i++) {
    const x = Math.random() * S, y = Math.random() * S, r = rand(20, 80);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(14,16,14,0.34)');
    grd.addColorStop(1, 'rgba(14,16,14,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  return tex(c, 4, 6);
}

/* ------------------------------------------------------------ */
/* Corrugated metal wall panels                                 */
/* ------------------------------------------------------------ */
export function corrugatedTexture() {
  const W = 512, H = 512;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#4a4e50';
  g.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 24) {
    const grd = g.createLinearGradient(x, 0, x + 24, 0);
    grd.addColorStop(0, 'rgba(16,18,19,0.55)');
    grd.addColorStop(0.35, 'rgba(126,133,136,0.35)');
    grd.addColorStop(0.6, 'rgba(78,84,86,0.1)');
    grd.addColorStop(1, 'rgba(14,16,17,0.5)');
    g.fillStyle = grd;
    g.fillRect(x, 0, 24, H);
  }
  for (let i = 0; i < 10; i++) {
    const x = Math.random() * W, y = rand(0, H * 0.6);
    const grd = g.createLinearGradient(x, y, x, y + rand(50, 160));
    grd.addColorStop(0, 'rgba(120,62,30,0.18)');
    grd.addColorStop(1, 'rgba(120,62,30,0)');
    g.fillStyle = grd;
    g.fillRect(x, y, rand(3, 10), rand(60, 170));
  }
  return tex(c, 3, 2);
}

/* ------------------------------------------------------------ */
/* Wall panel with painted lower band                           */
/* ------------------------------------------------------------ */
export function paintedWallTexture(tint = '#49514f') {
  const c = makeCanvas(512, 512);
  const g = c.getContext('2d');
  g.fillStyle = tint;
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(0,0,0,${rand(0.01, 0.06)})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, rand(4, 30), rand(2, 16));
  }
  g.fillStyle = 'rgba(14,16,16,0.55)';
  g.fillRect(0, 400, 512, 112);
  g.fillStyle = 'rgba(198,158,68,0.14)';
  g.fillRect(0, 392, 512, 8);
  const img = g.getImageData(0, 0, 512, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 12;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  return tex(c, 4, 2);
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
