/* Minimal WebSocket client for the co-op lobby. */

export class Net {
  constructor() {
    this.ws = null;
    this.handlers = new Map();
    this.connecting = null;
  }

  on(type, fn) {
    this.handlers.set(type, fn);
    return this;
  }

  emit(type, data) {
    const fn = this.handlers.get(type);
    if (fn) fn(data);
  }

  available() {
    return location.protocol === 'http:' || location.protocol === 'https:';
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.connecting) return this.connecting;
    if (!this.available()) {
      return Promise.reject(new Error('Koop braucht den Nachtschicht-Server (node server.js).'));
    }

    this.connecting = new Promise((resolve, reject) => {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${location.host}/ws`);
      this.ws = ws;
      let settled = false;

      const fail = (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.connecting = null;
        try { ws.close(); } catch (e) { /* ignore */ }
        reject(err);
      };

      const timer = setTimeout(() => fail(new Error('Server antwortet nicht. Läuft "node server.js"?')), 5000);

      ws.addEventListener('open', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.connecting = null;
        resolve();
      });

      ws.addEventListener('message', (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        if (msg && msg.t) this.emit(msg.t, msg);
      });

      ws.addEventListener('close', () => {
        clearTimeout(timer);
        if (this.ws === ws) this.ws = null;
        if (!settled) {
          settled = true;
          this.connecting = null;
          reject(new Error('Verbindung zum Server fehlgeschlagen.'));
          return;
        }
        this.emit('close', {});
      });

      ws.addEventListener('error', () => {
        if (!settled) fail(new Error('Verbindung zum Server fehlgeschlagen.'));
      });
    });

    return this.connecting;
  }

  send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  createRoom() { this.send({ t: 'create' }); }

  joinRoom(code) { this.send({ t: 'join', code }); }

  leave() { this.send({ t: 'leave' }); }

  close() {
    const ws = this.ws;
    this.ws = null;
    this.connecting = null;
    if (ws) {
      try { ws.close(); } catch (e) { /* ignore */ }
    }
  }
}
