'use strict';
// Arranha-Céu — ponto de entrada.

// saves: ver js/saves.js (autosave na chave antiga + 5 slots); `app.saves` é criado quando a página carrega

const app = {
  game: new Game(), renderer: null, ui: null, audio: null,
  layout() { this.renderer.resize(); },
  setSpeed(s) {
    this.game.speed = s;
    this.ui.refreshBar();
  },
  togglePause() {
    if (this.game.speed) { this.ui.prevSpeed = this.game.speed; this.setSpeed(0); } else this.setSpeed(this.ui.prevSpeed || 1);
  },
  volumes: (() => { try { return JSON.parse(localStorage.getItem('arranha-vol') || '{}'); } catch (_) { return {}; } })(),
  setVolume(cat, v) { this.mix.setVolume(cat, v); this.volumes[cat] = cat === 'master' ? this.mix.master : this.mix.cats[cat]; try { localStorage.setItem('arranha-vol', JSON.stringify(this.volumes)); } catch (_) {} if (cat === 'master' || cat === 'ambiente') this.updateRain(); },
  muted: (() => { try { return localStorage.getItem('arranha-mute') === '1'; } catch (_) { return false; } })(),
  setMuted(v) { this.muted = v; try { localStorage.setItem('arranha-mute', v ? '1' : '0'); } catch (_) {} if (v) this.stopRain(); },
  ctx() { return Som.ctx(); },
  mix: Som.mix,
  sound(name, o) { if (!this.muted) Som.play(name, o); },
  voice(seed, mood, vol) { Som.voice(seed, mood, vol); },
  soundAt(name, L, x, d) {
    if (this.muted || !this.renderer || this.game.speed > 2 || this.game.speed === 0) return;
    const r = this.renderer, w = {x: x * U, y: -(L + .5) * FH};
    const s = r.toScreen(w.x, w.y);
    if (s.x < -20 || s.x > r.vw + 20 || s.y < -20 || s.y > r.vh + 20) return;
    if (name === 'ding' && r.cam.z < 0.7) return;
    // mais perto do centro da tela e mais zoom = mais alto
    const dx = (s.x - r.vw / 2) / (r.vw / 2), dy = (s.y - r.vh / 2) / (r.vh / 2), near = Math.max(0, 1 - Math.hypot(dx, dy) / 1.5) * Math.min(1, 0.5 + r.cam.z * 0.6);
    this.sound(name, Object.assign({near}, d));
  },
  // ambiente contínuo: trânsito na rua (mais forte no horário de pico) e murmúrio da multidão que aparece na tela
  ambT: 0, ambCar: 0, ambVoz: 0,
  updateAmbient(dt) {
    if (this.muted || !this.renderer || !this.game.speed || this.game.speed > 2) return;
    const g = this.game, r = this.renderer, hr = g.minute / 60;
    this.ambCar -= dt; this.ambVoz -= dt;
    const ground = r.toScreen(g.towerX() * U, 0);
    if (this.ambCar <= 0 && ground.y > -40 && ground.y < r.vh + 80) {   // a rua está à vista
      const rush = (hr >= 7 && hr < 10) || (hr >= 17 && hr < 20), night = hr >= 23 || hr < 5;
      this.ambCar = (night ? 14 : rush ? 2.2 : 5) * (0.6 + Math.random() * 0.8);
      this.sound('carro', {near: Math.min(1, 0.4 + r.cam.z * 0.5)});
      if (rush && Math.random() < 0.15) this.sound('buzina', {near: 0.7});
    }
    if (this.ambVoz <= 0 && r.cam.z >= 0.6) {
      this.ambVoz = 2 + Math.random() * 2;
      let n = 0, id = 1;
      for (const p of g.people) { if (p.dead || p.st === 'inside') continue; const s = r.toScreen(p.x * U, -(p.L + .5) * FH); if (s.x > 0 && s.x < r.vw && s.y > 0 && s.y < r.vh) { n++; id = p.id; } }
      if (n >= 3) this.sound('murmurio', {near: Math.min(1, n / 20), seed: id});
    }
  },
  // tela inicial: trânsito e murmúrio leves (só depois do primeiro clique/tecla, quando o navegador libera o áudio)
  titleAmb: 0,
  updateTitleAmbient(dt) {
    if (this.muted || !Som.liberado) return;
    this.titleAmb -= dt;
    if (this.titleAmb > 0) return;
    this.titleAmb = 2.5 + Math.random() * 3;
    this.sound('carro', {near: 0.5});
    if (Math.random() < 0.3) this.sound('murmurio', {near: 0.4, seed: 1 + Math.floor(Math.random() * 50)});
  },
  rainNode: null,
  updateRain() {
    const want = !this.muted && this.game.speed > 0 ? this.game.rain : 0;
    if (want < 0.03 && !this.rainNode) return;
    const a = this.ctx(); if (!a) return;
    if (!this.rainNode) {
      const buf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = a.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2500; f.Q.value = 0.4;
      const g = a.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(Som.out()); src.start();
      this.rainNode = {src, g};
    }
    this.rainNode.g.gain.setTargetAtTime(want * 0.12 * this.mix.master * this.mix.cats.ambiente, a.currentTime, 0.4);
  },
  stopRain() { if (this.rainNode) this.rainNode.g.gain.value = 0; },
  // salvar rápido: no último slot usado; sem slot ainda, abre a lista para escolher
  save() {
    const id = this.saves.last;
    if (!id) { this.ui.showSlots(); return; }
    this.saveSlot(id);
  },
  saveSlot(id, name) {
    const r = this.saves.save(id, this.game.serialize(), name);
    this.ui.hint(r.ok ? 'Salvo no slot ' + id + ' (' + r.meta.name + ').' : r.err, !r.ok);
    return r.ok;
  },
  // carrega um save (de slot, autosave ou arquivo) e refaz a interface; devolve false se o save estiver inválido
  loadData(d) {
    try { this.game.load(upgradeSave(d)); } catch (e) { this.ui.hint('Save inválido.', true); this.game.reset(); return false; }
    this.ui.buildToolbar(); this.ui.setOverlay('none'); this.ui.closePanel(); this.renderer.selected = null;
    this.renderer.cam.x = this.game.towerX() * U; this.renderer.cam.y = -FH * 3 - Math.min(this.game.topBuilt(), 20) * FH * 0.6; this.renderer.clampCam();
    this.ui.refreshBar(); this.ui.hideTitle(false);
    return true;
  },
  loadSlot(id) {
    const d = this.saves.load(id);
    if (!d) { this.ui.hint('O slot ' + id + ' está vazio ou o save está danificado.', true); return false; }
    if (!this.loadData(d)) return false;
    this.ui.hint('Slot ' + id + ' carregado.');
    return true;
  },
  autosave() { if (!this.ui.titleOpen) this.saves.autosave(this.game.serialize()); },
  newGame() {
    this.saves.clearAutosave();
    this.game.reset(); this.game.onEvent = (t, d) => this.ui.onGameEvent(t, d);
    this.ui.buildToolbar(); this.ui.setOverlay('none'); this.renderer.selected = null;
    this.renderer.cam.x = 0; this.renderer.cam.y = -FH * 3; this.renderer.cam.z = clamp(this.renderer.vw / 1600, 0.4, 1.2);
    this.renderer.clampCam();
    this.ui.setTool('inspect'); this.ui.refreshBar();
    this.ui.showTicker('Comece arrastando um saguão pelo térreo.');
  },
  // tela inicial: uma torre de exibição (`DEMO_TORRE`) roda num jogo à parte, com câmera própria; o jogo de verdade fica parado
  demo: null, camSaved: null,
  startDemo() {
    const r = this.renderer;
    this.camSaved = {x: r.cam.x, y: r.cam.y, z: r.cam.z};
    try {
      // a torre de exibição vive numa rede generosa (energia e água vêm da rua só durante a tela inicial) para as salas não ficarem às escuras
      this.realGrid = {...UTIL.grid}; UTIL.grid.energia = 1400; UTIL.grid.agua = 800;
      const g = new Game(); g.load(upgradeSave(JSON.parse(JSON.stringify(DEMO_TORRE))));
      g.t = Math.floor(g.t / 1440) * 1440 + 17.4 * 60; g.speed = 2;   // começa no fim da tarde: a noite acende as janelas
      this.demo = g;
    } catch (_) { this.demo = null; }
    const g = this.demo || this.game, top = Math.max(8, g.topBuilt() + 3);
    let x0 = Infinity, x1 = -Infinity; for (const f of g.facs) if (f.L >= 1) { x0 = Math.min(x0, f.x); x1 = Math.max(x1, f.x + f.w); }
    const wTower = Math.max(32, x1 - x0) * U, wide = r.vw > 800;
    r.cam.z = clamp(Math.min(r.vh * 0.8 / (top * FH), r.vw * (wide ? 0.6 : 0.9) / wTower), 0.15, 1.2);
    this.demoCam = {x: x0 === Infinity ? g.towerX() * U : (x0 + x1) / 2 * U, y: -top * FH * 0.4};
    this.demoCam.z = r.cam.z; r.cam.y = this.demoCam.y; r.cam.x = this.demoCam.x; r.clampCam();
  },
  // resume: volta a câmera de antes ("Continuar"); nos outros casos quem chamou já posicionou a câmera
  stopDemo(resume) {
    this.demo = null;
    if (this.realGrid) { Object.assign(UTIL.grid, this.realGrid); this.realGrid = null; }
    if (resume && this.camSaved) { Object.assign(this.renderer.cam, this.camSaved); this.renderer.clampCam(); }
    this.camSaved = null;
  },
  exportSave() {
    const blob = new Blob([JSON.stringify(this.game.serialize())], {type: 'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'arranha-ceu.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
  importSave() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = () => {
      const f = inp.files[0]; if (!f) return;
      f.text().then(t => { try { if (this.loadData(JSON.parse(t))) this.ui.hint('Torre importada.'); } catch (_) { this.ui.hint('Arquivo inválido.', true); } });
    };
    inp.click();
  },
};

window.addEventListener('DOMContentLoaded', () => {
  app.renderer = new Renderer(document.getElementById('view'), document.getElementById('minimap'));
  try { app.saves = new SaveStore(localStorage); } catch (_) { const m = new Map(); app.saves = new SaveStore({getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k)}); }
  app.saves.migrateLegacy();
  const saved = app.saves.loadAutosave();
  let loaded = !!saved;
  if (saved) { try { app.game.load(saved); } catch (_) { app.game.reset(); loaded = false; } }
  for (const k in app.volumes) app.mix.setVolume(k, app.volumes[k]);
  app.ui = new UI(app);
  app.cheats = new Cheats(app.game); Object.defineProperty(app.cheats, 'g', {get: () => app.game});
  window.cheat = line => { const r = app.cheats.run(line); console.log(r); app.ui.refreshBar(); return r; };   // modo deus pelo console: cheat('ajuda')
  console.info('Cheats: digite cheat("ajuda") no console.');
  app.game.onEvent = (t, d) => app.ui.onGameEvent(t, d);
  app.renderer.cam.z = clamp(app.renderer.vw / 1600, 0.4, 1.2);
  app.renderer.cam.x = app.game.towerX() * U; app.renderer.cam.y = -FH * 3 - (loaded ? Math.min(app.game.topBuilt(), 20) * FH * 0.6 : 0);
  app.renderer.clampCam();
  app.ui.setOverlay('none'); app.ui.refreshBar();
  if (app.game.pendingMsg) { app.ui.hint(app.game.pendingMsg); app.game.pendingMsg = null; }
  if (!loaded) app.ui.showTicker('Comece arrastando um saguão pelo térreo.');
  app.ui.showTitle();
  window.addEventListener('resize', () => app.renderer.resize());
  new ResizeObserver(() => app.renderer.resize()).observe(document.getElementById('stage'));

  let last = performance.now(), barT = 0, errCount = 0;
  const banner = msg => {
    let b = document.getElementById('errBanner');
    if (!b) { b = document.createElement('div'); b.id = 'errBanner'; b.style.cssText = 'position:fixed;left:8px;right:8px;top:70px;z-index:99;background:#5a2427;color:#ffd7d7;border:1px solid #e5484d;border-radius:8px;padding:8px 12px;font:12px/1.4 system-ui;user-select:text'; document.body.appendChild(b); }
    b.textContent = 'Erro no jogo (pausado e salvo): ' + msg + ' — recarregue a página ou use Menu > Novo jogo.';
  };
  window.addEventListener('error', e => { try { app.game.speed = 0; app.autosave(); banner(e.message); } catch (_) {} });
  window.addEventListener('unhandledrejection', e => { try { app.game.speed = 0; banner(String(e.reason)); } catch (_) {} });
  document.addEventListener('visibilitychange', () => { last = performance.now(); });
  const frame = now => {
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    try {
      if (!document.hidden) {
        const t0 = performance.now();
        const shown = app.ui.titleOpen && app.demo ? app.demo : app.game;
        if (shown === app.demo) {   // a torre de exibição anda sozinha; a câmera a enquadra à direita (o menu fica à esquerda) e balança devagar
          const r = app.renderer, wide = r.vw > 800, c = app.demoCam;
          r.cam.z = c.z * (1 + 0.03 * Math.sin(now / 8000)); r.cam.x = c.x - (wide ? r.vw * 0.17 / r.cam.z : 0) + Math.sin(now / 9000) * 60 / r.cam.z * 0.5; r.cam.y = c.y; r.clampCam();   // a câmera respira devagar
        }
        shown.tick(dt);
        const t1 = performance.now();
        app.renderer.draw(shown, app.ui);
        const t2 = performance.now();
        if (t2 - t0 > 400) console.warn('Quadro lento: simulação ' + Math.round(t1 - t0) + ' ms, desenho ' + Math.round(t2 - t1) + ' ms (hora ' + hourStr(app.game.minute) + ', dia ' + app.game.day + ')');   // ajuda a achar travamentos
        barT += dt;
        if (barT > 0.25) { barT = 0; app.ui.refreshBar(); app.updateRain(); }
        app.updateAmbient(dt); if (app.ui.titleOpen) app.updateTitleAmbient(dt);
      }
    } catch (e) {
      console.error('Erro no laço do jogo (hora ' + hourStr(app.game.minute) + ', dia ' + app.game.day + '):', e);   // sem isso o erro só aparecia na faixa vermelha, nunca no console
      errCount++;
      app.game.speed = 0;
      banner(e && e.message ? e.message : String(e));
      if (errCount > 3) return;     // para de tentar, sem travar o navegador
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  // salva com frequência: no F5, ao fechar/trocar de aba (celular nem sempre dispara beforeunload) e a cada 30 s
  addEventListener('beforeunload', () => app.autosave());
  addEventListener('pagehide', () => app.autosave());
  document.addEventListener('visibilitychange', () => { if (document.hidden) app.autosave(); });
  setInterval(() => { if (!document.hidden) app.autosave(); }, 30000);
});
