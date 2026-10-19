'use strict';
// Arranha-Céu — renderização do mundo e do minimapa.

const levelY = L => -(L + 1) * FH;                 // topo da linha do nível L
const levelAt = wy => Math.floor(-wy / FH);        // nível a partir da coordenada y de mundo

// ponta do saguão: no térreo só vale se ao lado não há nada (nem elevador, escada ou sala): é a fachada, onde ficam a porta e o toldo; nos saguões altos, onde acaba o saguão
function lobEdge(g, f, u) {
  if (f.L === 0) return !g.grid.get(0, u) && !g.tg.get(0, u);
  const o = g.grid.get(f.L, u); return !(o && o.k === 'lobby');
}
class Renderer {
  constructor(canvas, mini) {
    // com ?cpu na URL o desenho usa o processador em vez da placa de vídeo (mais lento, porém imune a travamentos da GPU)
    const cpu = /[?&]cpu\b/.test(location.search);
    this.cv = canvas; this.c = canvas.getContext('2d', cpu ? {willReadFrequently: true} : undefined);
    this.mini = mini; this.mc = mini.getContext('2d');
    this.mcss = {w: 150, h: 230, d: 1}; this.miniMode = 'fit'; this.miniZ = 1; this.miniHold = false; this.miniMap = null;
    this._ms = document.createElement('canvas'); this._msKey = ''; this._msT = 0;
    this.cam = {x: 0, y: -FH * 3, z: 0.7};     // x,y = centro da vista (mundo)
    this.vw = 0; this.vh = 0; this.dpr = 1;
    this.ghost = null; this.overlay = 'none'; this.selected = null; this.t0 = performance.now();
    this.stars = Array.from({length: 90}, (_, i) => [hash(i * 3 + 1), hash(i * 3 + 2) * .7, hash(i * 3 + 3)]);
    this.clouds = Array.from({length: 9}, (_, i) => ({x: hash(i * 11) * 6000, y: -300 - hash(i * 11 + 4) * 900, s: .6 + hash(i * 11 + 7) * 1.2}));
    // (a silhueta da cidade é calculada por trecho de 70 px, sem lista: o mundo não tem fim)
    this.resize();
  }
  resize() {
    const r = this.cv.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.vw = Math.max(1, r.width); this.vh = Math.max(1, r.height);
    this.cv.width = Math.round(this.vw * this.dpr); this.cv.height = Math.round(this.vh * this.dpr);
    this.clampCam();
    this.resizeMini();
  }
  // o buffer do minimapa acompanha o tamanho em CSS × devicePixelRatio (nítido em telas HiDPI)
  resizeMini() {
    const r = this.mini.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const d = window.devicePixelRatio || 1, w = Math.round(r.width * d), h = Math.round(r.height * d);
    if (this.mini.width !== w || this.mini.height !== h) { this.mini.width = w; this.mini.height = h; this._msKey = ''; }
    if (this._ms.width !== w || this._ms.height !== h) { this._ms.width = w; this._ms.height = h; this._msKey = ''; }
    this.mcss = {w: r.width, h: r.height, d};
  }
  setMiniMode(m) { this.miniMode = m; this._msKey = ''; }
  toWorld(sx, sy) { return {x: (sx - this.vw / 2) / this.cam.z + this.cam.x, y: (sy - this.vh / 2) / this.cam.z + this.cam.y}; }
  toScreen(wx, wy) { return {x: (wx - this.cam.x) * this.cam.z + this.vw / 2, y: (wy - this.cam.y) * this.cam.z + this.vh / 2}; }
  zoomAt(sx, sy, z) {
    const before = this.toWorld(sx, sy);
    this.cam.z = clamp(z, 0.1, 3);
    const after = this.toWorld(sx, sy);
    this.cam.x += before.x - after.x; this.cam.y += before.y - after.y;
    this.clampCam();
  }
  clampCam() {
    const hw = this.vw / 2 / this.cam.z, hh = this.vh / 2 / this.cam.z;
    this.cam.x = clamp(this.cam.x, X_MIN * U + hw, X_MAX * U - hw);
    const top = -(TOP_L + 3) * FH, bot = (-MIN_L + 1) * FH;
    this.cam.y = clamp(this.cam.y, top + hh, Math.max(top + hh, bot - hh));
  }
  centerOn(wx, wy) { this.cam.x = wx; this.cam.y = wy; this.clampCam(); }

  // ------------------------------------------------------------ quadro
  draw(g, ui) {
    const c = this.c, cam = this.cam, dpr = this.dpr;
    const time = (performance.now() - this.t0) / 1000;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const [skyT, skyB, hour] = skyColors(g.minute);
    const grad = c.createLinearGradient(0, 0, 0, this.vh);
    grad.addColorStop(0, skyT); grad.addColorStop(1, skyB);
    c.fillStyle = grad; c.fillRect(0, 0, this.vw, this.vh);
    const night = isNight(g.minute), day = daylight(g.minute);

    // estrelas, sol/lua
    if (!day || day < .5) {
      const a = 1 - day * 2;
      c.fillStyle = 'rgba(255,255,255,' + (0.85 * a).toFixed(2) + ')';
      for (const s of this.stars) c.fillRect(s[0] * this.vw, s[1] * this.vh * .85, s[2] * 1.6 + .6, s[2] * 1.6 + .6);
    }
    const sunT = ((hour - 6) / 12), moonT = ((hour + 6) % 24) / 12;
    const body = (t, col, r) => {
      if (t < -.05 || t > 1.05) return;
      const bx = this.vw * (0.08 + 0.84 * t), by = this.vh * (0.55 - Math.sin(clamp(t, 0, 1) * Math.PI) * 0.45);
      c.fillStyle = col; c.beginPath(); c.arc(bx, by, r, 0, 7); c.fill();
    };
    body(sunT, '#fff3b0', 22);
    body(hour >= 18 ? (hour - 18) / 12 : (hour + 6) / 12, '#e8ecf6', 14);

    c.save();
    c.translate(this.vw / 2, this.vh / 2); c.scale(cam.z, cam.z); c.translate(-cam.x, -cam.y);
    const vx0 = cam.x - this.vw / 2 / cam.z, vx1 = cam.x + this.vw / 2 / cam.z;
    const vy0 = cam.y - this.vh / 2 / cam.z, vy1 = cam.y + this.vh / 2 / cam.z;

    // nuvens
    c.fillStyle = night ? 'rgba(40,50,80,.45)' : 'rgba(255,255,255,.75)';
    for (const cl of this.clouds) {
      const span = Math.max(6000, vx1 - vx0 + 800), w0 = vx0 - 400;   // as nuvens se repetem a cada `span` px, onde quer que a câmera esteja
      const cx = w0 + (((cl.x + time * 6 * cl.s - w0) % span) + span) % span;
      c.beginPath(); c.ellipse(cx, cl.y, 60 * cl.s, 14 * cl.s, 0, 0, 7); c.ellipse(cx + 34 * cl.s, cl.y + 4, 40 * cl.s, 11 * cl.s, 0, 0, 7); c.ellipse(cx - 34 * cl.s, cl.y + 4, 38 * cl.s, 10 * cl.s, 0, 0, 7); c.fill();
    }
    // silhueta da cidade
    c.fillStyle = night ? '#0e1530' : '#8fa6b8';
    for (let t = Math.floor((vx0 - 100) / 70); t <= Math.floor(vx1 / 70) + 1; t++) {
      const b = {x: t * 70 + hash(t) * 40, w: 30 + hash(t + 80) * 50, h: 40 + hash(t + 120) * 150};
      if (b.x > vx1 || b.x + b.w < vx0) continue;
      c.fillRect(b.x, -b.h, b.w, b.h + 2);
      if (night) { c.fillStyle = 'rgba(255,220,130,.5)'; for (let i = 0; i < b.h; i += 14) for (let j = 4; j < b.w - 4; j += 10) if (hash(b.x + i * 7 + j) > .6) c.fillRect(b.x + j, -b.h + i + 4, 3, 4); c.fillStyle = '#0e1530'; }
    }

    // chão
    const gtop = 0;
    const grass = [['#4e8a46', '#16301f'], ['#5c9c3a', '#183512'], ['#8c7b3c', '#2a2410'], ['#e4ecf0', '#3a4552']][g.season];
    c.fillStyle = night ? grass[1] : grass[0]; c.fillRect(vx0 - 10, gtop - 14, vx1 - vx0 + 20, 14);
    c.fillStyle = '#3c3c44'; c.fillRect(vx0 - 10, gtop - 5, vx1 - vx0 + 20, 5);
    paintVerge(c, vx0, vx1, g.season, night, cam.z > 0.3, time);
    // subsolo: terra
    const soilBot = Math.max(12 * FH, vy1 + 20);
    paintSoil(c, vx0, vx1, vy0, vy1, soilBot, night, cam.z > 0.3, time);

    // área de construção
    const top = Math.min(MAX_L + 1, g.topBuilt() + 4);
    c.fillStyle = night ? 'rgba(255,255,255,.035)' : 'rgba(255,255,255,.10)';
    c.fillRect(vx0 - 10, -(top + 1) * FH, vx1 - vx0 + 20, (top + 1) * FH);
    c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(vx0 - 10, 0, vx1 - vx0 + 20, soilBot);
    c.fillStyle = 'rgba(0,0,0,.0)';

    const L0 = Math.max(MIN_L, levelAt(vy1) - 1), L1 = Math.min(TOP_L, levelAt(vy0) + 1);
    const lod = cam.z > 0.38;
    const inRoom = new Map();
    for (const p of g.people) if (p.st === 'idle' && p.at) inRoom.set(p.at.id, (inRoom.get(p.at.id) || 0) + 1);

    // linhas de andar e pisos soltos
    const ax0 = Math.floor(vx0 / U), ax1 = Math.ceil(vx1 / U);
    for (let L = Math.max(MIN_L, L0); L <= Math.min(L1, MAX_L); L++) {
      const y = levelY(L);
      // piso solto (laje sem sala)
      for (const [ra, rb] of g.slab.runs(L, ax0, ax1)) {
        let run = -1;
        for (let u = ra; u <= rb + 1; u++) {
          const has = u <= rb && !g.grid.get(L, u) && !g.tg.get(L, u);
          if (has && run < 0) run = u;
          if (!has && run >= 0) { paintBareFloor(c, run * U, u * U, y + FH, night); run = -1; }
        }
      }
      if (L >= 0 && L <= top) {
        c.strokeStyle = 'rgba(255,255,255,.06)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(vx0 - 10, y + FH); c.lineTo(vx1 + 10, y + FH); c.stroke();
        if (lod && L % (cam.z < 0.6 ? 5 : 1) === 0) { c.fillStyle = 'rgba(255,255,255,.45)'; c.font = '9px system-ui'; c.textAlign = 'left'; c.fillText(floorLabel(L), vx0 + 6 / cam.z, y + FH - 12); }
      } else if (L < 0 && lod) { c.fillStyle = 'rgba(255,255,255,.4)'; c.font = '9px system-ui'; c.textAlign = 'left'; c.fillText(floorLabel(L), vx0 + 6 / cam.z, y + FH - 12); }
    }

    // instalações
    const ov = this.overlay;
    const hourF = g.minute / 60;
    const dark = hourF >= 22 ? Math.min(1, (hourF - 22) / 2.5) * 0.65 : hourF < 5 ? 0.65 : hourF < 7 ? 0.65 * (7 - hourF) / 2 : 0;
    const vehLinkedSet = g.vehLinked();
    for (const f of g.facs) {
      if (f.L > L1 || f.L + f.h - 1 < L0) continue;
      const x = f.x * U, w = f.w * U;
      if (x > vx1 || x + w < vx0) continue;
      const y = -(f.L + f.h) * FH, h = f.h * FH, def = FAC[f.k];
      const resid = def.tenant || def.hotel;
      const vacant = def.hotel ? !f.guests.length : (def.tenant ? !f.occ : (def.biz ? !!f.closed : false));
      // quem está na sala muda toda hora: a luz, a plateia e a tela do cinema seguem a contagem devagar (no máximo uma pessoa a cada 1,2 s), sem piscar
      const target = inRoom.get(f.id) || 0;
      if (f._lcT === undefined || time - f._lcT > 5) { f._lc = target; f._lcT = time; }   // sala que voltou à tela ou acabou de aparecer: sem transição
      else if (time - f._lcT >= 1.2 && f._lc !== target) { f._lc += Math.sign(target - f._lc); f._lcT = time; }
      else if (f._lc === target) f._lcT = time;
      let lc = f._lc;
      f._dark = false;
      // à noite as luzes vão apagando aos poucos (22h–0h30) e voltam a acender de manhã (5h–7h)
      if (dark > 0 && (def.condo || def.hotel) && hash(f.id * 7 + 1) < (def.hotel ? Math.min(.95, dark * 1.45) : dark)) { lc = 0; f._dark = true; }   // hotel: o hóspede dorme mais cedo e mais fundo
      if (f.cutE) lc = 0;   // sem energia: luzes apagadas (o hóspede continua dormindo se for de noite; o apagão não muda isso)
      const us = def.util;
      const lob = f.k === 'lobby';
      const bfill = f.k === 'bike' ? g.bikeFill(f) : undefined;
      const traffic = def.veh ? vehLinkedSet.has(f) : undefined;
      const open = def.open ? (g.minute / 60 >= def.open[0] / 60 && g.minute / 60 < def.open[1] / 60 && !f.cutE && !f.cutA) : undefined;   // sem energia ou água o comércio fecha na hora
      const truckP = f.truckEta ? Math.max(0, Math.min(1, 1 - (f.truckEta - g.t) / LIXO.eta)) : undefined;
      paintFacility(c, f, x, y, w, h, {rushNow: f.k === 'busstop' || f.k === 'taxi' ? g.hailQueue(f) : undefined, night, lit: lc, dark: f._dark, vacant, lod, heliAway: f.k === 'heliport' && !!(g.heli && Math.abs(g.heli.tx - (f.x + f.w / 2)) < 1), theme: lob || f.k.startsWith('corridor') ? Math.min(4, Math.max(0, g.star - 1)) : 0, edgeL: lob ? lobEdge(g, f, f.x - 1) : false, edgeR: lob ? lobEdge(g, f, f.x + f.w) : false, fill: bfill, open, traffic, st: g.simT, truckP, lvl: us && us.store ? g.storeLvl(f) / us.store.cap : undefined, sun: us && us.solar ? Math.max(0, g.sun() * WEATHER[g.weather].sun) : undefined, train: f.k === 'transit' ? g.trainState(f) : null, tdir: f.k === 'transit' ? g.trainDir(f) : 1, tclip: f.k === 'transit', time});
      if (f.build >= 1 && (f.cutE || f.cutA)) paintNoUtil(c, x, y, w, h, f.cutE, f.cutA, time, lod);
      if (f.fire) paintFire(c, x, y, w, h, time, f.fire, f.fighting);
      if (f.working && !f.fire && lod) paintSparkles(c, x, y, w, h, time);
      if (f.fight && lod) paintFight(c, x, y, w, h, time);
      if (f.bomb && lod) paintBomb(c, x, y, w, h, time, Math.max(0, f.bomb - g.t));
      if (f.fire && lod && g.coverage(f).fire === 'spr') paintSprinkle(c, x, y, w, h, time);
      if (ov !== 'none') this.paintOverlay(c, g, f, x, y, w, h, ov, time);
      if (g.reachable && f.build >= 1 && ((g.needsAccess(f) && !g.reachable(f)) || g.vehUnlinked(f)) && lod) {
        c.fillStyle = '#ff6b6b'; c.font = 'bold 9px system-ui'; c.textAlign = 'right'; c.fillText('!', x + w - 3, y + 10);
      }
    }
    const tierOf = Math.min(4, Math.max(0, g.star - 1));   // acabamento de escadas e elevadores por estrela
    // escadas
    for (const s of g.stairs) {
      if (s.L > L1 || s.L < L0) continue;
      paintStairs(c, s, s.dark ? 0 : time, false, tierOf);   // rolante sem energia pára
      if (s.dark) paintNoUtil(c, s.x * U, -(s.L + 1) * FH, s.w * U, FH, true, false, time, cam.z > 0.3);
    }
    // poços
    for (const s of g.shafts) {
      if (s.hi + 1 < L0 || s.lo - 1 > L1) continue;
      if (s.hidden && ui.tool !== 'adjust' && ui.tool !== 'inspect') continue;
      paintShaft(c, s, cam, night);
      paintShaftDoors(c, s, g.stopsOf(s), cam);
      if (!g.grid.get(s.hi + 1, s.x) && !g.tg.get(s.hi + 1, s.x) && s.hi + 1 + 1 >= L0) paintMachineRoom(c, s, time, !s.dark, cam);
      if (!g.grid.get(s.lo - 1, s.x) && !g.tg.get(s.lo - 1, s.x)) paintShaftPit(c, s, cam);
      for (const L of s.lo === undefined ? [] : Object.keys(s.off)) { const y = -L * FH - SLAB; R(c, s.x * U + 2, y - (s.carlift ? FH - SLAB - 2 : 22), s.w * U - 4, s.carlift ? FH - SLAB - 2 : 22, 'rgba(0,0,0,.55)'); }
      s.cars.forEach((car, i) => paintCar(c, s, car, i, s.cars.length, g.carLoad(car)));
      if (s.dark) paintNoUtil(c, s.x * U, -(s.hi + 1) * FH, s.w * U, (s.hi - s.lo + 1) * FH, true, false, time, cam.z > 0.3);   // sem energia: o mesmo raio das salas
      if (cam.z > 0.4) for (const k in s.q) if (s.q[k].length) {
        c.fillStyle = '#ffd24a'; c.font = 'bold 8px system-ui'; c.textAlign = 'left';
        c.fillText(s.q[k].length, (s.x + s.w) * U + 2, -(+k) * FH - SLAB - 6);
      }
    }
    // rua e carros (na frente do térreo)
    if (cam.z > 0.2) {
      c.fillStyle = night ? '#1d1f26' : '#3a3d46'; c.fillRect(vx0 - 10, 0, vx1 - vx0 + 20, 8);
      c.fillStyle = night ? '#2a2d36' : '#5a5f6b'; c.fillRect(vx0 - 10, 0, vx1 - vx0 + 20, 1.5);
      c.fillStyle = 'rgba(255,255,255,.35)';
      for (let u = Math.floor(vx0 / 20) * 20; u < vx1; u += 20) c.fillRect(u, 4, 10, 1);
      for (const tr of g.trucks) {
        const tx = tr.x * U;
        if (tx < vx0 - 30 || tx > vx1 + 30) continue;
        paintTruck(c, tx, 7, tr.dir, time, tr.phase === 'work');
        if (tr.phase === 'work' && tr.fac && !tr.fac.dead && tr.fac.fighting) {
          c.save(); c.strokeStyle = '#5bb8ff'; c.lineWidth = 1.6; c.setLineDash([3, 2]); c.lineDashOffset = -time * 24;
          c.beginPath(); c.moveTo(tx, -4); c.lineTo((tr.fac.x + tr.fac.w / 2) * U, -(tr.fac.L + .5) * FH); c.stroke(); c.restore();
        }
      }
      if (lod || cam.z > 0.2) for (const car of g.cars) {
        const cx = car.x * U;
        if (cx < vx0 - 20 || cx > vx1 + 20) continue;
        if (car.kind === 'busstop') paintBus(c, cx, car.dir > 0 ? 7 : 5.2, car.dir, 0.85);
        else if (car.kind === 'lixo') paintGarbageTruck(c, cx, car.dir > 0 ? 7 : 5.2, car.dir, 0.85);
        else { paintCarSide(c, cx, car.dir > 0 ? 7 : 5.2, car.dir, car.col, 0.85); if (car.kind === 'taxi') { c.fillStyle = '#222'; c.fillRect(cx - 2, (car.dir > 0 ? 7 : 5.2) - 8.2, 4, 1.6); } }
        if (night) { c.fillStyle = 'rgba(255,240,170,.18)'; c.beginPath(); c.moveTo(cx + car.dir * 8, 4); c.lineTo(cx + car.dir * 28, 1); c.lineTo(cx + car.dir * 28, 8); c.fill(); }
      }
    }
    // pessoas
    const plod = cam.z > 0.55;
    const psc = clamp(0.85 / cam.z, 1, 2.6);          // pessoas ficam maiores com o zoom afastado
    for (const s of g.shafts) for (const k in s.q) s.q[k].forEach((p, i) => { p.qi = i; p.qs = s; });
    const drawP = (p, px, py, sc, alpha) => {
      c.save(); c.translate(px, py); c.scale(sc, sc);
      if (alpha < 1) c.globalAlpha = alpha;
      paintPerson(c, p, 0, 0, time, plod, (p.st === 'idle' || p.st === 'work') && p.at && !p.task ? PERSON_ACT[p.at.k] : undefined);
      c.restore();
    };
    let drawn = 0;
    const rdt = Math.min(0.1, time - (this._pt === undefined ? time : this._pt)); this._pt = time;
    for (const p of g.people) {
      if (p.st === 'away' || p.st === 'ride' || p.dead || p.fxUntil > g.simT) continue;
      if (drawn > 1800) break;                       // limite de pessoas desenhadas por quadro
      if (p.st === 'work' && !p.at) p.at = p.task;
      if (p.st === 'walk' || p.st === 'stair' || p.st === 'wait') p.rx = undefined;   // em trânsito: a próxima sala começa do ponto de chegada
      let px = p.x * U + ((p.id % 5) - 2) * .9, py = -p.L * FH - SLAB, inside = false;
      if (p.st === 'stair') py = -p.fy * FH - SLAB;
      else if (p.st === 'wait' && p.qs) {
        // fila ao lado do poço, alternando os lados
        // fila só onde há piso: usa os lados com chão e respeita o trecho contínuo do andar
        const s = p.qs, hasL = g.solid(p.L, s.x - 1), hasR = g.solid(p.L, s.x + s.w);
        const bnd = g.segBounds(p.L, s.x + s.w / 2);
        if (!hasL && !hasR) px = (s.x + s.w / 2) * U + ((p.qi % 3) - 1) * 3;
        else {
          const side = hasL && hasR ? (p.qi % 2 ? 1 : -1) : hasR ? 1 : -1, row = hasL && hasR ? Math.floor(p.qi / 2) : p.qi;
          px = side < 0 ? s.x * U - 3 - row * 4 : (s.x + s.w) * U + 3 + row * 4;
          if (bnd) px = clamp(px, bnd.a * U + 2, bnd.b * U - 2);
        }
      } else if ((p.st === 'idle' || p.st === 'work') && p.at) {
        const k = p.at.k;
        if (k !== 'restaurant' && k !== 'cinema' && k !== 'fastfood' && k !== 'bar' && k !== 'shop' && k !== 'lobby' && k !== 'party' && k !== 'auditorio') {
          if (cam.z < 0.4 || p.at._dark) continue;
          inside = true;
          // balanço no relógio do jogo (acompanha a velocidade); a pessoa desliza do ponto de chegada até o seu lugar na sala
          const rangeW = Math.max(1, p.at.w * U - 16), wob = Math.sin(g.simT * 0.35 + p.id * 1.7) * Math.min(14, rangeW * 0.3);
          const tx = p.at.x * U + 8 + clamp(((p.id * 37) % rangeW) + wob, 0, rangeW);
          if (p.rx === undefined || p.rL !== p.L || Math.abs(p.rx - tx) > 400) p.rx = px;   // veio andando (ou mudou de andar): parte de onde chegou
          p.rL = p.L;
          const dx = tx - p.rx, mv = WALK_SPEED * U * 0.9 * g.speed * rdt;
          p.rx = Math.abs(dx) <= mv ? tx : p.rx + Math.sign(dx) * mv;
          px = p.rx;
          py += Math.abs(Math.sin(time * 0.9 + p.id)) * -0.6;
        }
      }
      if (px < vx0 - 10 || px > vx1 + 10 || py < vy0 - 20 || py > vy1 + 40) continue;
      drawP(p, px, py, inside ? 1 : psc, inside ? 0.8 : 1); drawn++;
    }
    // prévia
    if (this.ghost) this.paintGhost(c, this.ghost, time, night, g);
    for (const e of g.fxs) paintFx(c, e, clamp((g.simT - e.t0) / e.dur, 0, 1), time);
    if (g.heli) {   // o helicóptero do VIP pousa no heliponto (desce, rotor desacelera, pára) e decola de novo; os outros só pairam
      const hl = g.heli, alt = hl.reason === 'vip' ? (hl.alt === undefined ? 1 : hl.alt) : 1, base = hl.reason === 'vip' ? -hl.L * FH - SLAB - 13 : -(hl.L + 1) * FH - 8;
      const hy = base - (hl.reason === 'vip' ? alt * 42 : 0) + (alt > 0 ? Math.sin(time * 3) * 1.5 * Math.min(1, alt * 4 + (hl.reason === 'vip' ? 0 : 1)) : 0);
      paintHeli(c, hl.x * U, hy, time, -hl.dir, hl.reason === 'vip' ? 3 + alt * 27 : 30); paintHeliDrop(c, hl, hl.x * U, hy, time);
    }
    if (g.santa) { const topY = -(Math.max(g.topBuilt(), 10) + 7) * FH; paintSanta(c, g.santa.x * U, topY + g.santa.y * 3, time); g.santa.sx = g.santa.x * U; g.santa.sy = topY; }
    if (g.star >= 6 && night) { const lm = g.facs.find(f => f.k === 'landmark'); if (lm) paintFireworks(c, (lm.x + lm.w / 2) * U, -(lm.L + lm.h) * FH, time); }
    // seleção
    if (this.selected && !this.selected.dead) {
      const s = this.selected;
      // pisca e tem contorno escuro por fora para ser achada em qualquer fundo
      const blink = Math.sin(time * 6) > 0;
      c.lineWidth = 5 / cam.z + 1; c.strokeStyle = 'rgba(0,0,0,.7)'; this.strokeSel(c, s);
      c.lineWidth = 3 / cam.z + .5; c.strokeStyle = blink ? '#ffe066' : '#ff9d00'; this.strokeSel(c, s);
    }
    c.restore();

    if (g.rain > 0.02) {   // chuva ou neve (inverno) na intensidade do clima do dia: garoa, chuva, tempestade; raios fazem a tela piscar
      const wx = WEATHER[g.weather], lvl = (wx.level === undefined ? .6 : wx.level) * g.rain;
      c.fillStyle = 'rgba(40,50,70,' + (0.12 + 0.3 * lvl).toFixed(2) + ')'; c.fillRect(0, 0, this.vw, this.vh);
      if (g.season === 3) paintSnow(c, this.vw, this.vh, time, lvl, !!wx.storm); else paintRain(c, this.vw, this.vh, time, lvl, !!wx.storm);
      if (wx.storm && g.flashT !== undefined) { const dt = g.simT - g.flashT; if (dt >= 0 && dt < .5) { const a2 = dt < .12 ? .55 : dt < .2 ? .12 : dt < .3 ? .4 * (1 - (dt - .2) / .1) : 0; if (a2 > 0) { c.fillStyle = 'rgba(235,240,255,' + a2.toFixed(2) + ')'; c.fillRect(0, 0, this.vw, this.vh); } } }
    }
    // escurecer à noite
    const tint = skyTint(g.minute);
    if (tint) { c.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${tint[3].toFixed(3)})`; c.fillRect(0, 0, this.vw, this.vh); }
    this.drawMini(g);
  }

  strokeSel(c, s) {
    if (s.cat === 'fac') c.strokeRect(s.x * U, -(s.L + s.h) * FH, s.w * U, s.h * FH);
    else if (s.cat === 'shaft') c.strokeRect(s.x * U, -(s.hi + 1) * FH, s.w * U, (s.hi - s.lo + 1) * FH);
    else c.strokeRect(s.x * U, -(s.L + 1) * FH, s.w * U, FH);
  }

  // cor da unidade em cada visão (a = opacidade); null = sem dado nessa visão
  ovColor(f, ov, a, g) {
    const def = FAC[f.k];
    if (ov === 'eval') {
      if ((def.tenant && f.occ) || (def.hotel && f.guests.length)) return evalCol(f.eval, a);
      if (def.tenant || def.hotel) return `rgba(30,30,40,${(a * .8).toFixed(2)})`;
    } else if (ov === 'price') {
      if (def.prices) return `rgba(${['180,90,230', '70,150,230', '70,200,150', '240,200,70'][f.price]},${a})`;
    } else if (ov === 'fire' || ov === 'sec') {
      const C = {spr: '70,150,230', hyd: '240,200,70', ext: '63,178,127', fnone: '214,72,77', ok: '63,178,127', off: '240,200,70', slow: '240,140,60', noroute: '229,72,77', cam: '110,215,215', post: '70,170,230', none: '150,60,60'};
      const rgb = k => `rgba(${C[k]},${a})`;
      if (def.corr) {
        if (ov === 'fire') return def.corr === 'spr' || def.corr === 'hyd' || def.corr === 'ext' ? rgb(def.corr) : null;
        return def.corr === 'cam' ? rgb('cam') : null;
      }
      if (def.struct || f.k === 'ruin' || f.build < 1) return null;
      const cv = g.coverage(f);
      if (ov === 'fire') return rgb(cv.fire || 'fnone');
      if (f.k === 'security') return rgb('post');
      if (cv.post) return rgb(cv.resp === null ? 'noroute' : !cv.guards ? 'off' : cv.resp > SEC.fastSec ? 'slow' : 'ok');
      return rgb(cv.cam ? 'cam' : 'none');
    } else if (ov === 'energia' || ov === 'agua') {   // até onde a rede chega: amarelo/azul = atendida, claro = a própria fonte, vermelho = fora do alcance ou sem capacidade
      if (f.build < 1 || f.k === 'ruin') return null;
      const res = ov === 'energia' ? 'energia' : 'agua', u = def.util, isSrc = (u && (u[res] || (u.store && u.store.res === res))) || (f.k === 'lobby' && f.L === 0);
      if (isSrc) return ov === 'energia' ? `rgba(255,240,140,${a})` : `rgba(150,215,255,${a})`;
      if (f.k === 'lobby') return null;
      return (ov === 'energia' ? f.cutE : f.cutA) ? `rgba(214,72,77,${a})` : (ov === 'energia' ? `rgba(200,160,40,${(a * .75).toFixed(2)})` : `rgba(50,120,200,${(a * .75).toFixed(2)})`);
    } else if (ov === 'hotel') {
      if (def.hotel) return `rgba(${f.bugs ? '160,60,200' : f.dirty ? '229,72,77' : f.guests.length ? '63,178,127' : '120,130,150'},${a})`;
    }
    return null;
  }
  paintOverlay(c, g, f, x, y, w, h, ov, time) {
    const def = FAC[f.k], col = this.ovColor(f, ov, .66, g);
    c.fillStyle = col || 'rgba(10,14,24,.55)'; c.fillRect(x, y, w, h);
    if (ov !== 'eval' || !col || !(def.tenant || def.hotel)) return;
    const live = def.tenant ? f.occ : f.guests.length;
    if (!live) return;
    if (def.tenant && f.poorDays >= 1) {
      c.strokeStyle = `rgba(255,70,70,${(.55 + .45 * Math.sin(time * 6)).toFixed(2)})`; c.lineWidth = 2;
      c.strokeRect(x + 1, y + 1, w - 2, h - 2);
    }
    if (this.cam.z > 0.75 && w > 40) {
      const tr = f.trend > 3 ? '↑' : f.trend < -3 ? '↓' : '', fs = clamp(11 / this.cam.z, 11, 16);
      c.font = `bold ${fs}px system-ui`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = 'rgba(0,0,0,.55)'; c.fillText(`${EVAL_FACE[evalTier(f.eval)]} ${Math.round(f.eval)}${tr}`, x + w / 2 + 1, y + h / 2 + 1);
      c.fillStyle = '#fff'; c.fillText(`${EVAL_FACE[evalTier(f.eval)]} ${Math.round(f.eval)}${tr}`, x + w / 2, y + h / 2);
      c.textBaseline = 'alphabetic';
    }
  }
  paintGhost(c, gh, time = 0, night = false, g) {
    const x0 = gh.x * U, yT = -(gh.L + gh.h) * FH, w = gh.w * U, hh = gh.h * FH, d = gh.k && FAC[gh.k];
    if (d && g) {   // o fantasma é a própria imagem da sala que vai ficar (com o mesmo modelo sorteado e já vaga/à venda, se for de aluguel ou venda)
      const stub = {id: g.nextId, sty: (Math.imul(g.nextId + 1, 2654435761) ^ (gh.L * 7919 + gh.x * 104729)) >>> 0, cat: 'fac', k: gh.k, L: gh.L, x: gh.x, w: gh.w, h: gh.h, build: 1, price: 1, occ: false, persons: [], guests: [], film: g.film, dir: gh.dir || 1, line: 0, fire: 0, dirty: false, bugs: 0};
      c.save(); c.globalAlpha = .78;
      try { paintFacility(c, stub, x0, yT, w, hh, {night, lit: 0, vacant: !!(d.tenant), lod: true, time}); } catch (e) { /* sala sem pintura de prévia */ }
      c.restore();
    }
    c.fillStyle = d ? (gh.ok ? 'rgba(80,220,140,.16)' : 'rgba(255,60,60,.40)') : (gh.ok ? 'rgba(80,220,140,.45)' : 'rgba(255,80,80,.45)');
    c.fillRect(x0, yT, w, hh);
    c.strokeStyle = gh.ok ? '#6fe39b' : '#ff6b6b'; c.lineWidth = 1.5;
    c.strokeRect(x0, yT, w, hh);
    if (gh.portal) {   // portal: seta para o lado da saída e marca o lado de dentro, onde as vagas e os túneis precisam encostar
      const e = gh.dir === 1 ? x0 + w : x0, i = gh.dir === 1 ? x0 : x0 + w;
      c.fillStyle = '#fff'; c.font = 'bold 9px system-ui'; c.textAlign = gh.dir === 1 ? 'right' : 'left'; c.fillText(gh.dir === 1 ? 'saída ▶' : '◀ saída', e + (gh.dir === 1 ? -2 : 2), yT + 12);
      c.fillStyle = 'rgba(111,227,155,.7)'; c.fillRect(gh.dir === 1 ? i - 3 : i, yT + 2, 3, hh - 4);
    }
    if (gh.slope) {   // rampa e túnel descendente: o desenho mostra de que lado fica a ponta alta (que encosta no andar de cima) e a ponta baixa, mesmo quando a posição é inválida
      const x0 = gh.x * U, w = gh.w * U, yT = -(gh.L + gh.h) * FH, yB = yT + gh.h * FH, hi = gh.dir === 1 ? x0 + w : x0, lo = gh.dir === 1 ? x0 : x0 + w;
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.moveTo(lo, yB - 3); c.lineTo(hi, yT + 4); c.lineTo(hi, yB - 3); c.fill();
      c.fillStyle = '#fff'; c.font = 'bold 9px system-ui'; c.textAlign = gh.dir === 1 ? 'right' : 'left'; c.fillText('▲ alta', hi + (gh.dir === 1 ? -2 : 2), yT + 12);
      c.textAlign = gh.dir === 1 ? 'left' : 'right'; c.fillText('baixa', lo + (gh.dir === 1 ? 2 : -2), yB - 6);
    }
  }

  // ------------------------------------------------------------ minimapa
  // enquadramento: 'fit' = área construída (com margem); 'world' = terreno inteiro. Escala uniforme (a proporção real do prédio).
  miniView(g) {
    const W = this.mcss.w, H = this.mcss.h;
    let x0 = Infinity, x1 = -Infinity, top = -Infinity, bot = Infinity;
    for (const f of g.facs) { x0 = Math.min(x0, f.x); x1 = Math.max(x1, f.x + f.w); top = Math.max(top, f.L + f.h - 1); bot = Math.min(bot, f.L); }
    for (const s of g.shafts) { x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x + s.w); top = Math.max(top, s.hi); bot = Math.min(bot, s.lo); }
    if (this.miniMode === 'world' || !isFinite(x0)) {   // a torre com uma margem larga (ou a região da câmera, se ainda não há nada)
      const has = isFinite(x0), cx = has ? (x0 + x1) / 2 : this.cam.x / U, hw = has ? Math.max(200, (x1 - x0) / 2 + 120) : 200;
      x0 = cx - hw; x1 = cx + hw; top = Math.max(30, g.topBuilt() + 6); bot = -10;
    }
    else {
      const cx = (x0 + x1) / 2, hw = Math.max(24, (x1 - x0) / 2 + 6);
      x0 = cx - hw; x1 = cx + hw;
      top = Math.max(top + 3, bot + 11); bot = Math.min(bot, 0) - 1;
    }
    const X0 = x0 * U, X1 = x1 * U, Y0 = -(top + 1) * FH, Y1 = -bot * FH;
    const s = Math.min(W / (X1 - X0), H / (Y1 - Y0)) * this.miniZ, vlx = W / s, vly = H / s, cam = this.cam;
    const left = vlx >= X1 - X0 ? (X0 + X1) / 2 - vlx / 2 : clamp(cam.x - vlx / 2, X0, X1 - vlx);
    const topY = vly >= Y1 - Y0 ? Y1 - vly : clamp(cam.y - vly / 2, Y0, Y1 - vly);
    return {s, left, top: topY, W, H, bot, topL: top};
  }
  drawMini(g) {
    const m = this.mc, d = this.mcss.d, now = performance.now(), tt = (now - this.t0) / 1000;
    if (this.mini.width < 2) return;
    const v = this.miniHold && this.miniMap ? this.miniMap : this.miniView(g);
    this.miniMap = v;
    const {s, left, top, W, H} = v, X = wx => (wx - left) * s, Y = wy => (wy - top) * s;
    const ov = this.overlay;
    // camada estática (prédio): em cache, refeita a cada 250 ms ou quando a vista/visão muda
    const key = [ov, this.miniMode, this.miniZ, W, H, d, left.toFixed(0), top.toFixed(0), s.toFixed(5), g.facs.length, g.shafts.length, g.stairs.length].join('|');
    if (key !== this._msKey || now - this._msT > 250) {
      this._msKey = key; this._msT = now;
      this.drawMiniStatic(this._ms.getContext('2d'), g, v, ov, d);
    }
    m.setTransform(1, 0, 0, 1, 0, 0);
    m.fillStyle = '#101520'; m.fillRect(0, 0, this.mini.width, this.mini.height);
    m.drawImage(this._ms, 0, 0);
    m.setTransform(d, 0, 0, d, 0, 0);
    // filas nos poços
    for (const sh of g.shafts) for (const k in sh.q) {
      const n = sh.q[k].length; if (!n) continue;
      m.fillStyle = `rgba(255,${Math.max(60, 210 - n * 18)},60,${Math.min(1, .5 + n / 10).toFixed(2)})`;
      m.fillRect(X((sh.x + sh.w) * U) + 1, Y(-(+k + 1) * FH), 3, Math.max(2, FH * s));
    }
    // marcadores de eventos
    const pulse = Math.sin(tt * 7) > 0;
    const dot = (f, col, r, ring) => {
      const cx = X((f.x + f.w / 2) * U), cy = Y(-(f.L + f.h / 2) * FH);
      m.beginPath(); m.arc(cx, cy, r, 0, 6.2832);
      if (ring) { m.strokeStyle = col; m.lineWidth = 1.5; m.stroke(); } else { m.fillStyle = col; m.fill(); }
    };
    for (const f of g.facs) {
      const def = FAC[f.k];
      if (f.fire) dot(f, pulse ? '#ff7a1a' : '#ffd24a', 3.5);
      else if (f.bomb) dot(f, pulse ? '#ff3b3b' : '#ffd24a', 3.5);
      else if (f.fight) dot(f, pulse ? '#ff3b3b' : '#ffffff', 3);
      else if (this._unreach && this._unreach.has(f.id)) dot(f, '#ff6b6b', 3, true);
      else if (ov === 'eval' && def.tenant && f.occ && f.poorDays >= 1) dot(f, pulse ? '#ff4646' : '#ffffff', 2.5, true);
      else if (def.corr === 'ext' && f.build >= 1) dot(f, '#3fb27f', 2);
      else if (def.corr === 'spr' && f.build >= 1) dot(f, '#5bb8ff', 2);
      else if (def.corr === 'hyd' && f.build >= 1) dot(f, '#f2c230', 2);
      else if (def.corr === 'cam' && f.build >= 1) dot(f, '#7fe3e3', 2);
    }
    // vista atual (sempre visível: limitada às bordas do mapa)
    const cam = this.cam, hw = this.vw / 2 / cam.z, hh = this.vh / 2 / cam.z;
    let rx0 = X(cam.x - hw), ry0 = Y(cam.y - hh), rx1 = X(cam.x + hw), ry1 = Y(cam.y + hh);
    rx0 = clamp(rx0, 1, W - 5); ry0 = clamp(ry0, 1, H - 5);
    rx1 = clamp(rx1, rx0 + 4, W - 1); ry1 = clamp(ry1, ry0 + 4, H - 1);
    m.strokeStyle = '#f6c445'; m.lineWidth = 1.5; m.strokeRect(rx0, ry0, rx1 - rx0, ry1 - ry0);
  }
  drawMiniStatic(m, g, v, ov, d) {
    const {s, left, top, W, H} = v, X = wx => (wx - left) * s, Y = wy => (wy - top) * s;
    m.setTransform(1, 0, 0, 1, 0, 0); m.clearRect(0, 0, m.canvas.width, m.canvas.height);
    m.setTransform(d, 0, 0, d, 0, 0);
    m.fillStyle = '#101520'; m.fillRect(0, 0, W, H);
    const gy = Y(0);
    if (gy < H) { m.fillStyle = '#2a2018'; m.fillRect(0, Math.max(0, gy), W, H - Math.max(0, gy)); }
    // régua de andares
    const px = FH * s, step = px >= 14 ? 5 : px >= 7 ? 10 : px >= 3 ? 20 : 50;
    m.font = '8px system-ui'; m.textAlign = 'left'; m.fillStyle = 'rgba(255,255,255,.22)';
    for (let L = Math.ceil(v.bot / step) * step; L <= v.topL + 1; L += step) {
      if (L === 0) continue;
      const y = Y(-L * FH); if (y < 0 || y > H) continue;
      m.fillRect(0, y, L % 10 === 0 ? 5 : 3, 1);
      if (L % (step === 5 ? 10 : step) === 0) m.fillText(floorLabel(L), 7, y + 3);
    }
    // instalações
    const unreach = new Set();
    for (const f of g.facs) {
      const def = FAC[f.k], x = X(f.x * U), y = Y(-(f.L + f.h) * FH), w = Math.max(1, f.w * U * s), h = Math.max(1, f.h * FH * s);
      if (x > W || x + w < 0 || y > H || y + h < 0) continue;
      if (f.build >= 1 && ((g.needsAccess(f) && !g.reachable(f)) || g.vehUnlinked(f))) unreach.add(f.id);
      m.globalAlpha = f.build < 1 ? .45 : 1;
      m.fillStyle = ov === 'none' ? def.col : (this.ovColor(f, ov, 1, g) || '#3a3f4b');
      m.fillRect(x, y, w, h);
    }
    m.globalAlpha = 1; this._unreach = unreach;
    // escadas (cinza) e escadas rolantes (azul)
    for (const st of g.stairs) {
      m.fillStyle = st.k === 'escalator' ? '#4aa3df' : '#8d99b3';
      m.fillRect(X(st.x * U), Y(-(st.L + 1) * FH), Math.max(1.5, st.w * U * s), Math.max(1, FH * s * .6));
    }
    // poços: elevador comum, expresso (dourado) e de serviço (azul-acinzentado)
    const SC = {carlift: '#8fb4d9', elevator: '#c9d2e3', express: '#f6c445', service: '#7f93b5'};
    for (const sh of g.shafts) {
      m.fillStyle = SC[sh.k] || '#c9d2e3';
      m.fillRect(X(sh.x * U), Y(-(sh.hi + 1) * FH), Math.max(2, sh.w * U * s), Math.max(2, (sh.hi - sh.lo + 1) * FH * s));
    }
    // térreo
    m.fillStyle = '#4c9a4c'; m.fillRect(0, gy - 1, W, 2);
  }
  miniToWorld(mx, my) {
    const v = this.miniMap;
    if (!v) return null;
    return {x: v.left + mx / v.s, y: v.top + my / v.s};
  }
}
