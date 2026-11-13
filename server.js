'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8080;
const BIND = process.env.HOST || '0.0.0.0';
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm'
};

/* ------------------------------------------------------------------ */
/* Static files                                                        */
/* ------------------------------------------------------------------ */

function serveStatic(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Methode nicht erlaubt');
    return;
  }

  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Ungültige Anfrage');
    return;
  }

  if (urlPath === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ok');
    return;
  }
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Zugriff verweigert');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Nicht gefunden');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-store'
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(filePath).pipe(res);
  });
}

/* ------------------------------------------------------------------ */
/* Rooms                                                               */
/* ------------------------------------------------------------------ */

const rooms = new Map();
const peers = new Set();
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeCode() {
  for (;;) {
    let code = '';
    for (let i = 0; i < 4; i++) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
    if (!rooms.has(code)) return code;
  }
}

class Peer {
  constructor(socket) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.fragments = [];
    this.fragmentOpcode = 0;
    this.closed = false;
    this.room = null;
    this.role = null;
    this.alive = true;

    socket.setNoDelay(true);
    socket.on('data', (chunk) => this.onData(chunk));
    socket.on('close', () => this.close());
    socket.on('error', () => this.close());
  }

  onData(chunk) {
    if (this.closed) return;
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
    if (this.buffer.length > 1024 * 1024) {
      this.close();
      return;
    }
    while (!this.closed && this.parseFrame()) { /* keep parsing */ }
  }

  parseFrame() {
    const buf = this.buffer;
    if (buf.length < 2) return false;

    const b0 = buf[0];
    const b1 = buf[1];
    const fin = (b0 & 0x80) !== 0;
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let length = b1 & 0x7f;
    let offset = 2;

    if (length === 126) {
      if (buf.length < 4) return false;
      length = buf.readUInt16BE(2);
      offset = 4;
    } else if (length === 127) {
      if (buf.length < 10) return false;
      const big = buf.readBigUInt64BE(2);
      if (big > 8388608n) {
        this.close();
        return false;
      }
      length = Number(big);
      offset = 10;
    }

    if (!masked) {
      // Browser clients must mask every frame.
      this.close();
      return false;
    }
    if (buf.length < offset + 4 + length) return false;

    const mask = buf.subarray(offset, offset + 4);
    offset += 4;
    const payload = Buffer.allocUnsafe(length);
    for (let i = 0; i < length; i++) payload[i] = buf[offset + i] ^ mask[i & 3];
    offset += length;
    this.buffer = buf.subarray(offset);

    if (opcode === 0x8) {
      this.close();
      return false;
    }
    if (opcode === 0x9) {
      this.sendFrame(0xA, payload);
      return true;
    }
    if (opcode === 0xA) {
      this.alive = true;
      return true;
    }
    if (opcode === 0x1 || opcode === 0x2 || opcode === 0x0) {
      if (opcode !== 0x0) {
        this.fragmentOpcode = opcode;
        this.fragments = [];
      }
      this.fragments.push(Buffer.from(payload));
      if (!fin) return true;
      const full = Buffer.concat(this.fragments);
      this.fragments = [];
      if (this.fragmentOpcode === 0x1) this.onMessage(full.toString('utf8'));
      return true;
    }
    return true;
  }

  sendFrame(opcode, payload) {
    if (this.closed || !this.socket.writable) return;
    const len = payload.length;
    let header;
    if (len < 126) {
      header = Buffer.from([0x80 | opcode, len]);
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | opcode;
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | opcode;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }
    try {
      this.socket.write(Buffer.concat([header, payload]));
    } catch (e) {
      this.close();
    }
  }

  send(obj) {
    this.sendFrame(0x1, Buffer.from(JSON.stringify(obj), 'utf8'));
  }

  error(message) {
    this.send({ t: 'err', msg: message });
  }

  onMessage(text) {
    if (this.closed || text.length > 262144) return;
    let msg;
    try {
      msg = JSON.parse(text);
    } catch (e) {
      return;
    }
    if (!msg || typeof msg !== 'object') return;

    switch (msg.t) {
      case 'create':
        this.createRoom();
        break;
      case 'join':
        this.joinRoom(msg.code);
        break;
      case 'relay':
        this.relay(msg.data);
        break;
      case 'leave':
        this.leaveRoom();
        break;
      default:
        break;
    }
  }

  createRoom() {
    if (this.room) {
      this.error('Du bist bereits in einem Raum.');
      return;
    }
    const code = makeCode();
    const room = { code, host: this, guest: null };
    rooms.set(code, room);
    this.room = room;
    this.role = 'host';
    this.send({ t: 'created', code });
    log(`Raum ${code} erstellt`);
  }

  joinRoom(rawCode) {
    if (this.room) {
      this.error('Du bist bereits in einem Raum.');
      return;
    }
    const code = String(rawCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    const room = rooms.get(code);
    if (!room) {
      this.error('Raum nicht gefunden. Code prüfen.');
      return;
    }
    if (room.host === this) {
      this.error('Das ist dein eigener Raum.');
      return;
    }
    if (room.guest) {
      this.error('Raum ist voll (2 Spieler).');
      return;
    }
    room.guest = this;
    this.room = room;
    this.role = 'guest';
    room.host.alive = true;
    this.send({ t: 'joined', code });
    room.host.send({ t: 'peer', joined: true });
    log(`Spieler tritt Raum ${code} bei`);
  }

  relay(data) {
    if (!this.room || !data || typeof data !== 'object') return;
    const other = this.role === 'host' ? this.room.guest : this.room.host;
    if (!other || other.closed) return;
    other.send({ t: 'relay', data });
  }

  leaveRoom() {
    const room = this.room;
    if (!room) return;
    this.room = null;

    if (room.host === this) {
      if (room.guest && !room.guest.closed) {
        room.guest.room = null;
        room.guest.send({ t: 'host-left' });
      }
      rooms.delete(room.code);
      log(`Raum ${room.code} geschlossen`);
    } else {
      room.guest = null;
      if (room.host && !room.host.closed) room.host.send({ t: 'peer', joined: false });
      log(`Spieler verlässt Raum ${room.code}`);
    }
  }

  close() {
    if (this.closed) return;
    this.leaveRoom();
    try {
      this.sendFrame(0x8, Buffer.alloc(0));
    } catch (e) { /* ignore */ }
    this.closed = true;
    peers.delete(this);
    try {
      this.socket.end();
    } catch (e) { /* ignore */ }
  }
}

function log(text) {
  const time = new Date().toLocaleTimeString('de-DE', { hour12: false });
  console.log(`[${time}] ${text}`);
}

/* ------------------------------------------------------------------ */
/* HTTP + WebSocket server                                             */
/* ------------------------------------------------------------------ */

const server = http.createServer(serveStatic);

server.on('upgrade', (req, socket, head) => {
  const key = req.headers['sec-websocket-key'];
  const upgrade = String(req.headers.upgrade || '').toLowerCase();
  if (upgrade !== 'websocket' || !key) {
    socket.destroy();
    return;
  }

  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );

  const peer = new Peer(socket);
  peers.add(peer);
  if (head && head.length) peer.onData(head);
});

setInterval(() => {
  for (const peer of peers) {
    if (!peer.alive) {
      peer.close();
      continue;
    }
    peer.alive = false;
    peer.sendFrame(0x9, Buffer.alloc(0));
  }
}, 30000).unref();

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`\nPort ${PORT} ist belegt. Anderen Port wählen: PORT=8081 node server.js\n`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

server.listen(PORT, BIND, () => {
  console.log('');
  console.log('  ZWIRN & ZORN – Nachtschicht-Server');
  console.log('  ----------------------------------');
  console.log(`  Lokal:  http://localhost:${PORT}`);
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`  LAN:    http://${net.address}:${PORT}  (${name})`);
      }
    }
  }
  console.log('');
  console.log('  Koop: Beide öffnen dieselbe Adresse.');
  console.log('  Host klickt "Koop hosten", Gast gibt den Raumcode ein.');
  console.log('');
});
