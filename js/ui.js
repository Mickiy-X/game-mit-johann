import { UPGRADES, UPGRADE_ORDER, formatMoney, rankInfo } from './upgrades.js';
import { STAGE_NAMES, STAGE_DESCS, QUALITY, stageProgress } from './balance.js';
import { orderRequirementText, orderProgressText } from './orders.js';
import { NIGHT_MODS } from './nights.js';

const $ = (id) => document.getElementById(id);
const ROMAN = ['I', 'II', 'III', 'IV'];

export class UI {
  constructor() {
    this.el = {
      hud: $('hud'),
      title: $('title-screen'),
      continueBtn: $('btn-continue'),
      startBtn: $('btn-start'),
      botToggle: $('bot-toggle'),
      soundBtn: $('btn-sound'),
      controlsBtn: $('btn-controls'),
      controlsCard: $('controls-card'),
      controlsClose: $('controls-close'),
      shop: $('shop'),
      shopGrid: $('shop-grid'),
      shopMoney: $('shop-money'),
      shopClose: $('shop-close'),
      shopEscalation: $('shop-escalation'),
      pause: $('pause'),
      dawn: $('dawn'),
      win: $('win'),
      jumpscare: $('jumpscare'),
      jsSub: $('js-sub'),
      dayLabel: $('day-label'),
      phaseLabel: $('phase-label'),
      phaseTimer: $('phase-timer'),
      phaseSub: $('phase-sub'),
      snapFlash: $('snap-flash'),
      money: $('money-value'),
      goalText: $('goal-text'),
      goalFill: $('goal-fill'),
      stageNumber: $('stage-number'),
      stageName: $('stage-name'),
      stageDesc: $('stage-desc'),
      escalationFill: $('escalation-fill'),
      orderPanel: $('order-panel'),
      orderHint: $('order-hint'),
      orderCards: [0, 1].map((i) => {
        const card = $('order-card-' + i);
        return {
          card,
          client: card.querySelector('.order-client'),
          bonus: card.querySelector('.order-bonus'),
          line: card.querySelector('.order-line'),
          fill: card.querySelector('.order-fill'),
          progress: card.querySelector('.order-progress')
        };
      }),
      modPanel: $('mod-panel'),
      modName: $('mod-name'),
      modTag: $('mod-tag'),
      modEffect: $('mod-effect'),
      carryCount: $('carry-count'),
      carryList: $('carry-list'),
      partnerPanel: $('partner-panel'),
      partnerState: $('partner-state'),
      partnerName: $('partner-name'),
      machinePanel: $('machine-panel'),
      machineState: $('machine-state'),
      bufferText: $('buffer-text'),
      bufferFill: $('buffer-fill'),
      qWhite: $('q-white'),
      qRed: $('q-red'),
      qBlack: $('q-black'),
      qGold: $('q-gold'),
      stamina: $('stamina-fill'),
      doorWrap: $('door-wrap'),
      doorFill: $('door-fill'),
      doorText: $('door-text'),
      objectivePanel: $('objective-panel'),
      objectiveStep: $('objective-step'),
      objectiveTitle: $('objective-title'),
      objectiveSub: $('objective-sub'),
      objectiveFill: $('objective-fill'),
      prompt: $('prompt'),
      promptKey: $('prompt-key'),
      promptText: $('prompt-text'),
      promptSub: $('prompt-sub'),
      promptProgress: $('prompt-progress'),
      pull: $('pull-ui'),
      pullZone: $('pull-zone-name'),
      pullRate: $('pull-rate'),
      needle: $('tension-needle'),
      nightBanner: $('night-banner'),
      nightBannerText: $('night-banner-text'),
      danger: $('danger-banner'),
      dangerText: $('danger-text'),
      eventBanner: $('event-banner'),
      eventTag: $('event-tag'),
      eventName: $('event-name'),
      eventEffect: $('event-effect'),
      eventTime: $('event-time'),
      eventFill: $('event-fill'),
      toasts: $('toasts'),
      aimHint: $('aim-hint'),
      hint: $('hud-hint'),
      loading: $('loading'),
      lobby: $('lobby'),
      lobbyCode: $('lobby-code'),
      lobbyHint: $('lobby-hint'),
      slotHost: $('slot-host'),
      slotGuest: $('slot-guest'),
      lobbyStart: $('lobby-start'),
      lobbyContinue: $('lobby-continue'),
      lobbyLeave: $('lobby-leave'),
      hostBtn: $('btn-host'),
      joinBtn: $('btn-join'),
      joinCode: $('join-code'),
      koopNote: $('koop-note'),
      netBadge: $('net-badge'),
      dawnDay: $('dawn-day'),
      dawnEarned: $('dawn-earned'),
      dawnMoney: $('dawn-money'),
      dawnStage: $('dawn-stage'),
      dawnDoor: $('dawn-door'),
      dawnLore: $('dawn-lore'),
      dawnLoreText: $('dawn-lore-text'),
      dawnTip: $('dawn-tip'),
      dawnFlavor: $('dawn-flavor'),
      winFlavor: $('win-flavor'),
      winDays: $('win-days'),
      winEarned: $('win-earned'),
      winStage: $('win-stage'),
      winSpools: $('win-spools'),
      sensRange: $('sens-range'),
      volRange: $('vol-range'),
      fovRange: $('fov-range'),
      motionRange: $('motion-range'),
      brightnessRange: $('brightness-range'),
      qualitySelect: $('quality-select')
    };
    this.callbacks = {};
    this.nightTimer = null;
    this.caughtTimer = null;
    this.toastList = [];
    this.controlsOpen = false;
    this.lastPromptKey = '';
    this.lastObjectiveKey = '';

    document.body.appendChild(this.el.controlsCard);
    this.bindStatic();
  }

  bindStatic() {
    this.el.controlsBtn.addEventListener('click', () => this.toggleControls());
    this.el.controlsClose.addEventListener('click', () => this.toggleControls(false));
    this.el.shopClose.addEventListener('click', () => this.callbacks.onShopClose && this.callbacks.onShopClose());
    this.el.shopGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.upgrade-buy');
      if (!btn || btn.disabled) return;
      const id = btn.dataset.id;
      if (id && this.callbacks.onBuy) this.callbacks.onBuy(id);
    });
    this.el.sensRange.addEventListener('input', () => {
      if (this.callbacks.onSensitivity) this.callbacks.onSensitivity(parseFloat(this.el.sensRange.value));
    });
    this.el.volRange.addEventListener('input', () => {
      if (this.callbacks.onVolume) this.callbacks.onVolume(parseFloat(this.el.volRange.value));
    });
    this.el.fovRange.addEventListener('input', () => {
      if (this.callbacks.onFov) this.callbacks.onFov(parseFloat(this.el.fovRange.value));
    });
    this.el.motionRange.addEventListener('input', () => {
      if (this.callbacks.onMotion) this.callbacks.onMotion(parseFloat(this.el.motionRange.value));
    });
    this.el.brightnessRange.addEventListener('input', () => {
      if (this.callbacks.onBrightness) this.callbacks.onBrightness(parseFloat(this.el.brightnessRange.value));
    });
    this.el.qualitySelect.addEventListener('change', () => {
      if (this.callbacks.onQuality) this.callbacks.onQuality(this.el.qualitySelect.value);
    });
    this.el.hostBtn.addEventListener('click', () => {
      if (this.callbacks.onHost) this.callbacks.onHost();
    });
    const join = () => {
      const code = this.el.joinCode.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
      this.el.joinCode.value = code;
      if (this.callbacks.onJoin) this.callbacks.onJoin(code);
    };
    this.el.joinBtn.addEventListener('click', join);
    this.el.joinCode.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') join();
    });
    this.el.joinCode.addEventListener('input', () => {
      this.el.joinCode.value = this.el.joinCode.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    });
    this.el.lobbyStart.addEventListener('click', () => {
      if (this.callbacks.onLobbyStart) this.callbacks.onLobbyStart();
    });
    this.el.lobbyContinue.addEventListener('click', () => {
      if (this.callbacks.onLobbyContinue) this.callbacks.onLobbyContinue();
    });
    this.el.lobbyLeave.addEventListener('click', () => {
      if (this.callbacks.onLobbyLeave) this.callbacks.onLobbyLeave();
    });
  }

  setSettings(s) {
    this.el.sensRange.value = s.sens;
    this.el.volRange.value = s.vol;
    this.el.fovRange.value = s.fov;
    this.el.motionRange.value = s.motion;
    this.el.brightnessRange.value = s.brightness;
    this.el.qualitySelect.value = s.quality || 'high';
  }

  bind(cb) {
    this.callbacks = cb;
    this.el.startBtn.addEventListener('click', () => cb.onStart && cb.onStart(false));
    this.el.continueBtn.addEventListener('click', () => cb.onStart && cb.onStart(true));
    this.el.soundBtn.addEventListener('click', () => cb.onToggleSound && cb.onToggleSound());
    $('btn-resume').addEventListener('click', () => cb.onResume && cb.onResume());
    $('btn-pause-controls').addEventListener('click', () => this.toggleControls());
    $('btn-quit').addEventListener('click', () => cb.onQuit && cb.onQuit());
    $('dawn-continue').addEventListener('click', () => cb.onDawnContinue && cb.onDawnContinue());
    $('win-endless').addEventListener('click', () => cb.onWinEndless && cb.onWinEndless());
    $('win-title').addEventListener('click', () => cb.onQuit && cb.onQuit());
  }

  getBotEnabled() { return this.el.botToggle.checked; }
  setBotEnabled(v) { this.el.botToggle.checked = v; }

  setSoundLabel(on) { this.el.soundBtn.textContent = on ? 'Sound: AN' : 'Sound: AUS'; }

  pulse(el) {
    if (!el) return;
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
  }

  pulseMoney() { this.pulse(this.el.money); }
  pulseCarry() { this.pulse(this.el.carryCount); }

  flashDamage() {
    const el = this.el.snapFlash;
    if (!el) return;
    el.classList.add('active');
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => el.classList.remove('active'), 110);
  }

  setContinueVisible(v) { this.el.continueBtn.classList.toggle('hidden', !v); }

  /* ---------------- Online-Koop ---------------- */
  setKoopNote(text, warn = false) {
    this.el.koopNote.textContent = text;
    this.el.koopNote.classList.toggle('warn', !!warn);
  }

  showLobby({ code, isHost, hasSave, saveDay }) {
    this.el.lobby.classList.remove('hidden');
    this.el.lobbyCode.textContent = code;
    this.el.lobbyHint.textContent = isHost
      ? 'Teile den Code. Der Gast tritt auf der Startseite bei.'
      : 'Warte auf den Host. Die Schicht startet, sobald er bereit ist.';
    this.el.slotHost.textContent = isHost ? 'Verbunden' : 'Verbunden';
    this.el.slotHost.classList.add('ok');
    this.el.slotGuest.textContent = isHost ? 'Wartet auf Beitritt …' : 'Du';
    this.el.slotGuest.classList.toggle('ok', !isHost);
    this.el.lobbyStart.classList.toggle('hidden', !isHost);
    this.el.lobbyStart.disabled = true;
    this.el.lobbyContinue.textContent = saveDay
      ? `Gespeicherte Schicht · Tag ${saveDay}`
      : 'Gespeicherte Schicht';
    this.el.lobbyContinue.classList.toggle('hidden', !isHost || !hasSave);
    this.el.lobbyContinue.disabled = true;
  }

  updateLobby({ isHost, guestConnected }) {
    if (isHost) {
      this.el.slotGuest.textContent = guestConnected ? 'Verbunden' : 'Wartet auf Beitritt …';
      this.el.slotGuest.classList.toggle('ok', !!guestConnected);
      this.el.lobbyStart.disabled = !guestConnected;
      this.el.lobbyContinue.disabled = !guestConnected;
    }
  }

  hideLobby() {
    this.el.lobby.classList.add('hidden');
  }

  setNetBadge(text) {
    if (text) {
      this.el.netBadge.textContent = text;
      this.el.netBadge.classList.remove('hidden');
    } else {
      this.el.netBadge.classList.add('hidden');
    }
  }

  setPartner(name, inside = false) {
    if (!name) {
      this.el.partnerPanel.classList.add('hidden');
      return;
    }
    this.el.partnerPanel.classList.remove('hidden');
    this.el.partnerName.textContent = name;
    this.el.partnerState.textContent = inside ? 'IM SAFE ROOM' : 'DRAUSSEN';
    this.el.partnerState.classList.toggle('safe', inside);
    this.el.partnerState.classList.toggle('outside', !inside);
  }

  toggleControls(force) {
    this.controlsOpen = force !== undefined ? force : !this.controlsOpen;
    this.el.controlsCard.classList.toggle('hidden', !this.controlsOpen);
    if (this.callbacks.onClick) this.callbacks.onClick();
  }

  showTitle() {
    this.el.title.classList.remove('hidden');
    this.el.hud.classList.add('hidden');
    this.hideAllGameOverlays();
    document.body.classList.remove('night', 'caught');
  }

  hideTitle() {
    this.el.title.classList.add('hidden');
  }

  showHUD() { this.el.hud.classList.remove('hidden'); }

  hideAllGameOverlays() {
    this.el.shop.classList.add('hidden');
    this.el.pause.classList.add('hidden');
    this.el.dawn.classList.add('hidden');
    this.el.win.classList.add('hidden');
    this.el.jumpscare.classList.add('hidden');
    this.toggleControls(false);
  }

  hideLoading() {
    this.el.loading.classList.add('done');
    setTimeout(() => this.el.loading.classList.add('hidden'), 700);
  }

  /* ---------------- HUD ---------------- */
  update(state, extra) {
    const st = extra.stage;
    this.el.dayLabel.textContent = `TAG ${state.day}`;
    const phaseNames = { day: 'TAGPHASE', dusk: 'SONNENUNTERGANG', night: 'NACHT' };
    this.el.phaseLabel.textContent = phaseNames[state.phase] || '—';
    this.el.phaseTimer.textContent = formatTime(state.phaseTimeLeft);
    let sub = '';
    if (state.phase === 'day') {
      if (state.scare) sub = 'SIE IST WACH!';
      else if (state.upgrades.auto > 0) sub = state.machineSabotaged ? 'Spinner sabotiert.' : 'Maschinenlärm im Raum.';
      else sub = 'Die Puppe schläft.';
    } else if (state.phase === 'dusk') {
      sub = 'Ab in den Safe Room!';
    } else if (state.phase === 'night') {
      const mod = state.nightMod ? NIGHT_MODS[state.nightMod] : null;
      sub = state.insideSafe ? 'Du bist im Safe Room.' : mod ? mod.tag : 'Sie ist irgendwo da draußen.';
    }
    this.el.phaseSub.textContent = sub;

    this.el.money.textContent = formatMoney(state.money);
    this.el.goalText.textContent = `${Math.round(state.totalEarned).toLocaleString('de-DE')} / ${state.goal.toLocaleString('de-DE')} €`;
    this.el.goalFill.style.width = `${Math.min(100, (state.totalEarned / state.goal) * 100)}%`;

    this.el.stageNumber.textContent = `STUFE ${st}`;
    this.el.stageName.textContent = STAGE_NAMES[st - 1];
    this.el.stageDesc.textContent = STAGE_DESCS[st - 1];
    this.el.escalationFill.style.width = `${stageProgress(state.escalation) * 100}%`;

    const stats = state.stats;
    const cap = stats.carryCap;
    const carrySig = `${cap}|${state.carried.map((s) => Math.round(s.value)).join(',')}`;
    if (carrySig !== this._carrySig) {
      this._carrySig = carrySig;
      this.el.carryCount.textContent = `${state.carried.length} / ${cap}`;
      if (state.carried.length === 0) {
        this.el.carryList.innerHTML = '<span class="empty">Keine Spule</span>';
      } else {
        this.el.carryList.innerHTML = state.carried
          .map((s, i) => `<div class="spool-item"><span>Spule ${i + 1}</span><b>${formatMoney(s.value)}</b></div>`)
          .join('');
      }
    }

    this.el.machinePanel.classList.toggle('hidden', state.upgrades.auto === 0);
    if (state.upgrades.auto > 0) {
      const broken = state.machineSabotaged;
      const shorted = state.phase === 'day' && state.event && state.event.kind === 'blackout';
      const running = state.phase === 'day' && !broken && !shorted && !state.scare;
      this.el.machineState.textContent = broken ? 'DEFEKT' : shorted ? 'STÖRUNG' : running ? 'LÄUFT' : 'AUS';
      this.el.machineState.classList.toggle('broken', broken || shorted);
    }

    const ev = state.phase === 'day' && !state.scare ? state.event : null;
    this.el.eventBanner.classList.toggle('hidden', !ev);
    if (ev) {
      this.el.eventTag.textContent = ev.tag;
      this.el.eventName.textContent = ev.name;
      this.el.eventEffect.textContent = ev.effect;
      this.el.eventTime.textContent = `${Math.max(1, Math.ceil(ev.timeLeft))} s`;
      const left = Math.max(0, Math.min(1, ev.timeLeft / Math.max(1, ev.duration)));
      this.el.eventFill.style.width = `${left * 100}%`;
      this.el.eventBanner.classList.toggle('hazard', ev.tone === 'hazard');
      if (ev.id !== this._eventId) {
        this._eventId = ev.id;
        this.el.eventBanner.classList.remove('pop');
        void this.el.eventBanner.offsetWidth;
        this.el.eventBanner.classList.add('pop');
      }
    } else {
      this._eventId = '';
    }

    const orders = Array.isArray(state.orders) ? state.orders : [];
    const openOrders = orders.filter((o) => o && !o.done).length;
    const showOrder = orders.length > 0 && state.phase !== 'night';
    this.el.orderPanel.classList.toggle('hidden', !showOrder);
    if (showOrder) {
      let focus = Math.max(0, Math.min(orders.length - 1, state.orderFocus | 0));
      if (!orders[focus] || orders[focus].done) focus = orders.findIndex((o) => o && !o.done);
      this.el.orderHint.textContent = openOrders > 1 ? 'T WECHSELN' : '';
      this.el.orderHint.classList.toggle('hidden', openOrders < 2);
      this.el.orderCards.forEach((c, i) => {
        const order = orders[i];
        c.card.classList.toggle('hidden', !order);
        if (!order) return;
        c.card.classList.toggle('done', order.done);
        c.card.classList.toggle('active', !order.done && i === focus && openOrders > 1);
        c.client.textContent = order.client;
        c.line.textContent = orderRequirementText(order);
        c.bonus.textContent = order.done ? 'ERLEDIGT' : `+ ${formatMoney(order.bonus)}`;
        c.progress.textContent = order.done
          ? `Bezahlt · ${formatMoney(order.bonus)} Bonus`
          : orderProgressText(order);
        c.fill.style.width = `${Math.max(0, Math.min(1, order.progress / order.target)) * 100}%`;
      });
    }

    const mod = state.nightMod ? NIGHT_MODS[state.nightMod] : null;
    const showMod = !!mod && (state.phase === 'night' || state.phase === 'dusk');
    this.el.modPanel.classList.toggle('hidden', !showMod);
    if (mod && showMod) {
      this.el.modName.textContent = mod.name;
      this.el.modTag.textContent = state.phase === 'dusk' ? 'HEUTE NACHT' : mod.tag;
      this.el.modEffect.textContent = mod.effect;
      this.el.modPanel.classList.remove('still', 'storm', 'blood');
      this.el.modPanel.classList.add(state.nightMod);
    }

    const buffer = state.buffer;
    this.el.bufferText.textContent = `${Math.floor(buffer.units)} / ${stats.bufferCap}`;
    this.el.bufferFill.style.width = `${Math.min(100, (buffer.units / stats.bufferCap) * 100)}%`;
    this.el.qWhite.textContent = Math.floor(buffer.counts.white);
    this.el.qRed.textContent = Math.floor(buffer.counts.red);
    this.el.qBlack.textContent = Math.floor(buffer.counts.black);
    this.el.qGold.textContent = Math.floor(buffer.counts.gold);

    this.el.stamina.style.width = `${state.playerStamina}%`;

    const showDoor = state.phase === 'night' || state.phase === 'dusk' || state.doorBroken;
    this.el.doorWrap.classList.toggle('hidden', !showDoor);
    if (showDoor) {
      const pct = state.doorBroken ? 0 : Math.max(0, Math.min(100, (state.doorHealth / stats.doorMax) * 100));
      this.el.doorFill.style.width = `${pct}%`;
      this.el.doorFill.classList.toggle('danger', pct <= 30);
      this.el.doorText.textContent = state.doorBroken ? 'ZERSTÖRT' : `${Math.round(pct)} %`;
    }

    const o = extra.objective;
    if (o) {
      this.el.objectiveStep.textContent = o.step;
      this.el.objectiveTitle.textContent = o.title;
      this.el.objectiveSub.textContent = o.sub;
      this.el.objectiveFill.style.width = `${Math.max(0, Math.min(1, o.progress || 0)) * 100}%`;
      this.el.objectivePanel.classList.toggle('danger', !!o.danger);
      if (this.lastObjectiveKey !== o.key) {
        this.lastObjectiveKey = o.key;
        this.el.objectivePanel.classList.remove('pop');
        void this.el.objectivePanel.offsetWidth;
        this.el.objectivePanel.classList.add('pop');
      }
    }
  }

  showPrompt({ key = 'E', text = '', sub = '', progress = null }) {
    const k = key + text;
    this.el.prompt.classList.remove('hidden');
    if (this.lastPromptKey !== k) {
      this.lastPromptKey = k;
      this.el.promptKey.textContent = key;
      this.el.promptText.textContent = text;
      this.el.promptSub.textContent = sub;
    }
    if (progress !== null) {
      this.el.promptProgress.classList.remove('hidden');
      this.el.promptProgress.firstElementChild.style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
    } else {
      this.el.promptProgress.classList.add('hidden');
    }
  }

  hidePrompt() {
    this.el.prompt.classList.add('hidden');
    this.lastPromptKey = '';
  }

  showPull(zoneName, tension, rate) {
    this.el.pull.classList.remove('hidden');
    this.el.pullZone.textContent = zoneName;
    this.el.pullRate.textContent = `${rate >= 0 ? '+ ' : ''}${rate.toFixed(1).replace('.', ',')} Faden/s`;
    this.el.needle.style.left = `${Math.max(0, Math.min(100, tension))}%`;
  }

  hidePull() {
    this.el.pull.classList.add('hidden');
  }

  setNight(on) {
    document.body.classList.toggle('night', on);
  }

  showNightBanner(text = 'DIE PUPPE IST WACH') {
    this.el.nightBannerText.textContent = text;
    this.el.nightBanner.classList.remove('hidden', 'leaving');
    clearTimeout(this.nightTimer);
    clearTimeout(this.nightFadeTimer);
    this.nightFadeTimer = setTimeout(() => this.el.nightBanner.classList.add('leaving'), 3500);
    this.nightTimer = setTimeout(() => {
      this.el.nightBanner.classList.add('hidden');
      this.el.nightBanner.classList.remove('leaving');
    }, 4100);
  }

  hideNightBanner() {
    clearTimeout(this.nightTimer);
    clearTimeout(this.nightFadeTimer);
    this.el.nightBanner.classList.add('hidden');
    this.el.nightBanner.classList.remove('leaving');
  }

  setDanger(on, text = 'SIE IST WACH') {
    this.el.danger.classList.toggle('hidden', !on);
    if (on) this.el.dangerText.textContent = text;
  }

  toast(text, type = '', duration = 4200) {
    const div = document.createElement('div');
    div.className = `toast ${type}`;
    div.textContent = text;
    this.el.toasts.appendChild(div);
    const obj = { div, timer: null };
    this.toastList.push(obj);
    if (this.toastList.length > 4) {
      const old = this.toastList.shift();
      clearTimeout(old.timer);
      old.div.remove();
    }
    obj.timer = setTimeout(() => {
      div.classList.add('leave');
      setTimeout(() => {
        div.remove();
        this.toastList = this.toastList.filter(t => t !== obj);
      }, 420);
    }, duration);
  }

  setAimHint(on) {
    this.el.aimHint.classList.toggle('hidden', !on);
  }

  /* ---------------- Shop ---------------- */
  openShop(state) {
    this.el.shop.classList.remove('hidden');
    this.renderShop(state);
  }

  closeShop() {
    this.el.shop.classList.add('hidden');
  }

  renderShop(state) {
    const grid = this.el.shopGrid;
    const scroll = grid.scrollTop;
    grid.innerHTML = '';
    const rank = rankInfo(state.totalEarned || 0);
    const hiddenCount = UPGRADE_ORDER.filter((id) => (UPGRADES[id].rank || 1) > rank.rank).length;
    grid.appendChild(this.buildRankBanner(state, rank, hiddenCount));
    let lastCat = '';
    for (const id of UPGRADE_ORDER) {
      const def = UPGRADES[id];
      const defRank = def.rank || 1;
      if (defRank > rank.rank) continue;
      const lvl = state.upgrades[id];
      if (def.category !== lastCat) {
        lastCat = def.category;
        const h = document.createElement('div');
        h.className = 'shop-section';
        h.textContent = def.category;
        grid.appendChild(h);
      }
      const maxed = lvl >= def.max;
      const locked = def.requires && state.upgrades[def.requires] === 0;
      const cost = maxed ? null : def.costs[Math.min(lvl, def.costs.length - 1)];
      const canAfford = cost !== null && state.money >= cost;
      const card = document.createElement('div');
      card.className = `upgrade-card${maxed ? ' maxed' : ''}${lvl > 0 ? ' owned' : ''}${defRank >= 3 ? ' high-tier' : ''}`;
      const rankTag = defRank > 1 ? `RANG ${ROMAN[defRank - 1]} · ` : '';
      let btnLabel;
      if (maxed) btnLabel = 'MAXIMUM';
      else if (locked) btnLabel = 'GESPERRT';
      else if (!canAfford) btnLabel = `ZU TEUER · ${formatMoney(cost)}`;
      else btnLabel = `KAUFEN · ${formatMoney(cost)}`;
      card.innerHTML = `
        <div class="upgrade-top">
          <div class="upgrade-name">${def.name}</div>
          <div class="upgrade-level">${rankTag}STUFE ${lvl}/${def.max}</div>
        </div>
        <div class="upgrade-desc">${def.desc}</div>
        <div class="upgrade-effect${id === 'auto' ? ' warn' : ''}">${def.effect(lvl)}</div>
        ${locked ? '<div class="upgrade-effect warn">Benötigt: Automatik-Spinner</div>' : ''}
        <button class="upgrade-buy" data-id="${id}" ${maxed || locked || !canAfford ? 'disabled' : ''}>${btnLabel}</button>
      `;
      grid.appendChild(card);
    }
    this.el.shopMoney.textContent = formatMoney(state.money);
    this.el.shopEscalation.textContent = `Rangstufe ${rank.rank} · ${rank.name} · Eskalation: Stufe ${state.stage}`;
    grid.scrollTop = scroll;
  }

  buildRankBanner(state, rank, hiddenCount) {
    const banner = document.createElement('div');
    banner.className = 'shop-rank';
    const hiddenText = hiddenCount === 1
      ? '1 weiteres Upgrade wartet auf eine höhere Rangstufe.'
      : `${hiddenCount} weitere Upgrades warten auf höhere Rangstufen.`;
    const nextText = rank.next
      ? `Erreiche Rangstufe ${rank.rank + 1} (${rank.next.name}) bei ${formatMoney(rank.next.threshold)} Gesamteinnahmen, um bessere Upgrades freizuschalten. Es fehlen ${formatMoney(rank.remaining)}.`
      : 'Maximale Rangstufe erreicht. Alle Upgrades sind freigeschaltet.';
    banner.innerHTML = `
      <div class="shop-rank-top">
        <span class="shop-rank-title">RANGSTUFE ${rank.rank} · ${rank.name.toUpperCase()}</span>
        <span class="shop-rank-value">${formatMoney(state.totalEarned || 0)} Gesamteinnahmen</span>
      </div>
      <div class="shop-rank-bar"><i style="width:${Math.round(rank.progress * 100)}%"></i></div>
      <div class="shop-rank-hint">${nextText}</div>
      ${hiddenCount > 0 ? `<div class="shop-rank-hidden">${hiddenText}</div>` : ''}
    `;
    return banner;
  }

  /* ---------------- Overlays ---------------- */
  showPause(sens, vol, coop = false) {
    this.el.pause.classList.remove('hidden');
    this.el.sensRange.value = sens;
    this.el.volRange.value = vol;
    this.el.pause.querySelector('.eyebrow').textContent = coop ? 'KOOP · SCHICHT LÄUFT WEITER' : 'SCHICHT UNTERBROCHEN';
    this.el.pause.querySelector('h2').textContent = coop ? 'Lokale Pause' : 'Pause';
    this.el.pause.querySelector('.tiny-note').textContent = coop
      ? 'Koop: Die Welt läuft weiter – die Puppe auch. Nur dein Bild steht.'
      : 'Tipp: Beim Verlassen des Spiels wird die Schicht automatisch gespeichert.';
  }

  hidePause() {
    this.el.pause.classList.add('hidden');
    this.toggleControls(false);
  }

  showDawn(data) {
    this.el.dawn.classList.remove('hidden');
    this.el.dawnDay.textContent = data.day;
    this.el.dawnEarned.textContent = `+ ${formatMoney(data.earned)}`;
    this.el.dawnMoney.textContent = formatMoney(data.money);
    this.el.dawnStage.textContent = `Stufe ${data.stage} · ${STAGE_NAMES[data.stage - 1]}`;
    this.el.dawnDoor.textContent = data.doorBroken ? 'AUFGEBROCHEN' : `${Math.round(data.doorHealth)} %`;
    this.el.dawnFlavor.textContent = data.flavor;
    this.el.dawnLore.classList.toggle('hidden', !data.lore);
    this.el.dawnLoreText.textContent = data.lore || '';
    this.el.dawnTip.textContent = data.tip;
  }

  hideDawn() {
    this.el.dawn.classList.add('hidden');
  }

  showCaught(sub = 'Sie hat dich gefunden.', duration = 2600) {
    this.el.jumpscare.classList.remove('hidden');
    this.el.jsSub.textContent = sub;
    document.body.classList.add('caught');
    clearTimeout(this.caughtTimer);
    this.caughtTimer = setTimeout(() => this.hideCaught(), duration);
  }

  hideCaught() {
    this.el.jumpscare.classList.add('hidden');
    document.body.classList.remove('caught');
  }

  showWin(data) {
    this.el.win.classList.remove('hidden');
    this.el.winDays.textContent = data.day;
    this.el.winEarned.textContent = formatMoney(data.totalEarned);
    this.el.winStage.textContent = `Stufe ${data.stage} · ${STAGE_NAMES[data.stage - 1]}`;
    this.el.winSpools.textContent = data.spools;
    this.el.winFlavor.textContent = data.flavor;
  }

  hideWin() {
    this.el.win.classList.add('hidden');
  }

  /* ---------------- Helpers ---------------- */
  showLoadingDone() { this.hideLoading(); }
}

export function formatTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
