import * as THREE from 'three';
import { WORLD, resolveCircle, navWaypoint } from './world.js';
import { nameTexture } from './textures.js';
import { buildWorkerFigure } from './figure.js';

const LINES_DAY = [
  'Johann: Ich hab das Gefühl, sie wird jede Stunde größer.',
  'Johann: Der Faden ist warm. Das ist nicht normal, oder?',
  'Johann: Wenn das reißt, sind wir beide dran.',
  'Johann: Ich nehm die Spule. Du hältst die Augen offen.',
  'Johann: Für 5.000 € kann ich sie ja fast verstehen.',
  'Johann: Sie hat vorhin geblinzelt. Ich schwöre.',
  'Johann: Meine Oma hatte auch so eine Puppe. Die war nur kleiner.',
  'Johann: Das Ticket ist die letzte Chance. Danach bin ich raus.',
  'Johann: Zieh nicht zu schnell. Sie mag das nicht.',
  'Johann: Ich sollte wirklich mehr Gehalt verlangen.'
];
const LINES_WORK = [
  'Johann: Ich hab einen guten Faden erwischt.',
  'Johann: Der Kopf wäre Gold wert. Buchstäblich.',
  'Johann: Das wird eine schöne Spule.',
  'Johann: Fast voll. Halte durch.'
];
const LINES_DUSK = [
  'Johann: Sonne geht unter. Wir müssen rein!',
  'Johann: Beeil dich, die Tür ist der einzige Plan!',
  'Johann: Sie bewegt sich. SIE BEWEGT SICH!',
  'Johann: Lass die Spule, wir haben keine Zeit!'
];
const LINES_SAFE = [
  'Johann: Ich hasse diese Nacht.',
  'Johann: Hörst du das? Sie läuft da draußen.',
  'Johann: Die Tür hält. Die Tür hält. Die Tür hält.',
  'Johann: Morgen kaufen wir eine stärkere Tür. Und einen Urlaub.',
  'Johann: Wenn wir das überleben, bist du schuld.'
];

function makeNameSprite() {
  const mat = new THREE.SpriteMaterial({ map: nameTexture('JOHANN'), transparent: true, depthTest: true });
  const s = new THREE.Sprite(mat);
  s.scale.set(0.9, 0.225, 1);
  return s;
}

export class Johann {
  constructor(scene) {
    this.scene = scene;
    this.active = true;
    this.position = new THREE.Vector3(-7.2, 0, 10.2);
    this.radius = 0.38;
    this.speed = 4.3;
    this.state = 'idle';
    this.timer = 0;
    this.targetZone = null;
    this.bufferUnits = 0;
    this.bufferValue = 0;
    this.bufferCap = 60;
    this.carryValue = 0;
    this.lineTimer = 12;
    this.target = new THREE.Vector3();
    this.moving = false;
    this.walkPhase = 0;
    this.idleTime = 0;
    this.caughtTimer = 0;
    this.doorBusy = false;
    this.locked = false;
    this.build();
  }

  build() {
    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    const figure = buildWorkerFigure({
      skin: 0xd6a37e,
      shirt: 0xb7a98f,
      overall: 0x2f4e73,
      cap: 0xc9a536,
      boot: 0x2a2521,
      hair: 0x4a3524
    });
    this.figure = figure;
    this.body = figure.body;
    this.head = figure.head;
    this.legL = figure.legL;
    this.legR = figure.legR;
    this.armL = figure.armL;
    this.armR = figure.armR;
    this.group.add(figure.root);

    // name tag
    this.nameSprite = makeNameSprite();
    this.nameSprite.position.set(0, 2.08, 0);
    this.group.add(this.nameSprite);

    // carried spool
    this.spoolCarry = new THREE.Group();
    const yarn = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 12), new THREE.MeshStandardMaterial({ color: 0xd8cfc0, roughness: 1 }));
    this.spoolCarry.add(yarn);
    const capM = new THREE.MeshStandardMaterial({ color: 0x4a382c, roughness: 0.9 });
    for (const y of [-0.16, 0.16]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 12), capM);
      cap.position.y = y;
      this.spoolCarry.add(cap);
    }
    this.spoolCarry.position.set(0.34, 1.12, 0.32);
    this.spoolCarry.rotation.z = Math.PI / 2;
    this.spoolCarry.visible = false;
    this.group.add(this.spoolCarry);

    this.scene.add(this.group);
  }

  setActive(v) {
    this.active = v;
    this.group.visible = v;
  }

  respawnSafe() {
    this.position.copy(WORLD.respawnSafe);
    this.group.position.copy(WORLD.respawnSafe);
    this.state = 'safe';
    this.caughtTimer = 0;
    this.spoolCarry.visible = false;
    this.carryValue = 0;
    this.bufferUnits = 0;
    this.bufferValue = 0;
  }

  say(ctx, text) {
    if (ctx.onLine) ctx.onLine(text);
  }

  moveToward(target, speed, dt, colliders) {
    const finalDist = Math.hypot(target.x - this.position.x, target.z - this.position.z);
    const wp = navWaypoint(this.position, target);
    const dx = wp.x - this.position.x;
    const dz = wp.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.001) return finalDist;
    const step = Math.min(speed * dt, dist);
    const next = this.position.clone();
    next.x += (dx / dist) * step;
    next.z += (dz / dist) * step;
    resolveCircle(next, this.radius, colliders, WORLD.bounds);
    this.position.x = next.x;
    this.position.z = next.z;
    const yaw = Math.atan2(dx, dz);
    let diff = yaw - this.group.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.group.rotation.y += diff * Math.min(1, dt * 8);
    this.moving = true;
    return finalDist;
  }

  chooseZone(ctx) {
    const zones = ctx.zones.filter(z => {
      if (z.locked) return false;
      if (ctx.remaining[z.id] <= 15) return false;
      return true;
    });
    if (!zones.length) return null;
    // prefer juicy zones at higher escalation
    zones.sort(() => Math.random() - 0.5);
    return zones[0];
  }

  update(dt, ctx) {
    if (!this.active) return;
    const state = ctx.state;
    this.lineTimer -= dt;
    this.moving = false;

    if (state.phase === 'night' || state.scare) {
      this.flee(dt, ctx);
    } else if (state.phase === 'dusk') {
      this.flee(dt, ctx);
    } else if (state.phase === 'day') {
      this.work(dt, ctx);
    } else {
      this.idle(dt, ctx);
    }

    // speech
    if (this.lineTimer <= 0) {
      this.lineTimer = 16 + Math.random() * 22;
      if (state.phase === 'day' && !state.scare) {
        this.say(ctx, LINES_DAY[(Math.random() * LINES_DAY.length) | 0]);
      } else if (state.phase === 'night' || state.scare) {
        if (ctx.insideSafe) this.say(ctx, LINES_SAFE[(Math.random() * LINES_SAFE.length) | 0]);
      }
    }

    // visual
    this.group.position.set(this.position.x, 0, this.position.z);
    const walk = this.moving ? Math.sin(this.walkPhase) : 0;
    if (this.moving) this.walkPhase += dt * 11;
    const lerp = Math.min(1, dt * 10);
    this.legL.rotation.x += (walk * 0.55 - this.legL.rotation.x) * lerp;
    this.legR.rotation.x += (-walk * 0.55 - this.legR.rotation.x) * lerp;
    const armSwing = this.state === 'pull' ? -1.1 : (this.moving ? -walk * 0.45 : 0);
    this.armL.rotation.x += (armSwing - this.armL.rotation.x) * lerp;
    this.armR.rotation.x += ((this.state === 'pull' ? -0.8 : this.moving ? walk * 0.45 : 0) - this.armR.rotation.x) * lerp;
    this.idleTime += dt;
    const breathe = this.moving ? 0 : Math.sin(this.idleTime * 1.7) * 0.006;
    this.body.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.02 + breathe;
    this.spoolCarry.visible = this.carryValue > 0 && (this.state === 'toSell' || this.state === 'sell');
    if (this.spoolCarry.visible) this.spoolCarry.rotation.x += dt * 2;
  }

  idle(dt, ctx) {
    this.moving = false;
  }

  work(dt, ctx) {
    const colliders = ctx.colliders;
    this.moving = false;
    switch (this.state) {
      case 'idle': {
        this.timer -= dt;
        if (this.timer <= 0) {
          const z = this.chooseZone(ctx);
          if (z) {
            this.targetZone = z;
            // stand slightly to the side of the player's spot
            const off = new THREE.Vector3((Math.random() - 0.5) * 1.6, 0, (Math.random() - 0.5) * 1.6);
            this.target.copy(z.pos).add(off);
            this.state = 'toZone';
          } else {
            this.timer = 3;
          }
        }
        break;
      }
      case 'toZone': {
        if (!this.targetZone) { this.state = 'idle'; break; }
        const dist = this.moveToward(this.target, this.speed, dt, colliders);
        if (dist < 1.4) {
          this.state = 'pull';
          this.timer = 12 + Math.random() * 8;
          this.say(ctx, LINES_WORK[(Math.random() * LINES_WORK.length) | 0]);
        }
        break;
      }
      case 'pull': {
        this.timer -= dt;
        const pullRate = 2.2;
        const gains = ctx.onJohannPull(this.targetZone.id, pullRate * dt);
        this.bufferUnits += pullRate * dt;
        this.bufferValue += gains || 0;
        if (this.timer <= 0 || this.bufferUnits >= this.bufferCap) {
          if (this.bufferUnits >= 12) {
            this.carryValue = this.bufferValue;
            this.bufferUnits = 0;
            this.bufferValue = 0;
            this.state = 'toWinder';
          } else {
            this.timer = 4;
          }
        }
        break;
      }
      case 'toWinder': {
        this.target.set(WORLD.winder.x + 1.1, 0, WORLD.winder.z - 0.5);
        const dist = this.moveToward(this.target, this.speed, dt, colliders);
        if (dist < 1.3) {
          this.state = 'wind';
          this.timer = 2.3;
        }
        break;
      }
      case 'wind': {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.state = 'toSell';
          if (ctx.onJohannWind) ctx.onJohannWind();
        }
        break;
      }
      case 'toSell': {
        this.target.set(WORLD.sell.x + 1.1, 0, WORLD.sell.z - 0.6);
        const dist = this.moveToward(this.target, this.speed, dt, colliders);
        if (dist < 1.3) {
          this.state = 'sell';
          this.timer = 1.0;
        }
        break;
      }
      case 'sell': {
        this.timer -= dt;
        if (this.timer <= 0) {
          if (ctx.onJohannSell && this.carryValue > 0) ctx.onJohannSell(this.carryValue);
          this.carryValue = 0;
          this.bufferUnits = 0;
          this.bufferValue = 0;
          this.state = 'idle';
          this.timer = 1 + Math.random() * 2.5;
        }
        break;
      }
      case 'safe':
        this.state = 'idle';
        break;
      default:
        this.state = 'idle';
        this.timer = 0.5;
    }
  }

  flee(dt, ctx) {
    // the safe-area test has a small tolerance for the player; Johann must be clearly inside
    const inside = ctx.isInsideSafe(this.position) && this.position.x > WORLD.safe.minX + 1.2;
    const colliders = ctx.colliders;
    this.moving = false;

    if (!inside) {
      // open the safe door before walking into it
      if (ctx.doorClosed && !ctx.doorBroken && !this.doorBusy) {
        const doorDist = Math.hypot(this.position.x - WORLD.door.outside.x, this.position.z - WORLD.door.outside.z);
        if (doorDist < 4.2 && ctx.openDoor) {
          ctx.openDoor();
          this.doorBusy = true;
          setTimeout(() => { this.doorBusy = false; }, 900);
        }
      }
      this.moveToward(WORLD.respawnSafe, 5.4, dt, colliders);
      if (this.lineTimer > 6 && Math.random() < 0.02) this.say(ctx, LINES_DUSK[(Math.random() * LINES_DUSK.length) | 0]);
      this.state = 'flee';
    } else {
      this.state = 'safe';
      // close the door only when the player is also inside
      if (ctx.playerInside && !ctx.doorClosed && !ctx.doorBroken && !this.doorBusy && ctx.closeDoor) {
        this.doorBusy = true;
        setTimeout(() => {
          this.doorBusy = false;
          if (ctx.closeDoor) ctx.closeDoor();
        }, 600);
      }
    }
  }
}
