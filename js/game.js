'use strict';
// Arranha-Céu — lógica do jogo (sem DOM). Tempo do jogo em minutos; tempo "sim" em segundos.

const MIN_PER_SEC = 4;           // minutos de jogo por segundo real na velocidade 1
const STAIR_COST = 3, ESC_COST = 2;   // custo de rota por andar (escada / rolante)
// elevador: custo fixo (porta e embarque) e por andar de viagem; a espera pela cabine entra à parte, pela cabine mais próxima (`carWait`).
// Calibrado medindo viagens reais: com a cabine livre o elevador leva ~2 s além da caminhada, bem menos que 4+ andares de escada.
const ELEV_BASE = 1.5, ELEV_FLOOR = 0.2, EXPR_BASE = 2, EXPR_FLOOR = 0.05, COST_PER_SEC = 0.6;
const WALK_COST = 0.12, QUEUE_COST = 2.2; // custo por unidade andada / por pessoa na fila do elevador
const WALK_SPEED = 6;            // unidades por segundo
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = a => a[Math.floor(Math.random() * a.length)];
const pickW = (items, ws) => { let r = Math.random() * ws.reduce((a, b) => a + b, 0); for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; } return items[items.length - 1]; };

// horários dos escritórios (entrada / saída / almoço, em horas) por turno
const OFFICE_WIN = {day: [[7.5, 9.5], [17, 18.8]], early: [[6, 7.5], [14.5, 16]], late: [[10.5, 12], [19, 21]]};
const OFFICE_LUNCH = {day: [12, 13.2], early: [11, 12.2], late: [14.5, 15.5]};

// Camada esparsa do mundo (salas, elevadores/escadas ou laje): guarda só as células usadas, em blocos de 64 colunas por andar,
// e cresce sozinha para qualquer x e andar, positivos ou negativos. `empty` é o valor de uma célula vazia.
class Layer {
  constructor(empty) { this.empty = empty; this.rows = new Map(); }
  get(L, u) {
    const r = this.rows.get(L);
    if (!r) return this.empty;
    const c = r.chunks.get(u >> 6);
    return c ? c[u & 63] : this.empty;
  }
  set(L, u, v) {
    let r = this.rows.get(L);
    if (!r) { if (v === this.empty) return; r = {chunks: new Map(), lo: u, hi: u}; this.rows.set(L, r); }
    const k = u >> 6;
    let c = r.chunks.get(k);
    if (!c) { if (v === this.empty) return; c = new Array(64).fill(this.empty); r.chunks.set(k, c); }
    c[u & 63] = v;
    if (v !== this.empty) { if (u < r.lo) r.lo = u; if (u > r.hi) r.hi = u; }
  }
  // limites do que já foi escrito no andar (podem passar um pouco do conteúdo depois de remoções); null se o andar está vazio
  bounds(L) { const r = this.rows.get(L); return r ? [r.lo, r.hi] : null; }
  // trechos [a, b] de células usadas dentro de [lo, hi], em ordem
  runs(L, lo, hi) {
    const r = this.rows.get(L), out = [];
    if (!r) return out;
    let cur = null;
    for (let k = lo >> 6; k <= hi >> 6; k++) {
      const c = r.chunks.get(k);
      if (!c) { if (cur) { out.push(cur); cur = null; } continue; }
      for (let i = 0; i < 64; i++) {
        const u = k * 64 + i;
        if (u < lo || u > hi) continue;
        if (c[i] !== this.empty) { if (cur && cur[1] === u - 1) cur[1] = u; else { if (cur) out.push(cur); cur = [u, u]; } }
        else if (cur) { out.push(cur); cur = null; }
      }
    }
    if (cur) out.push(cur);
    return out;
  }
  levels() { return [...this.rows.keys()]; }
}
const NOSEG = -1e9;

class Game {
  constructor() { this.onEvent = () => {}; this.reset(); }

  reset() {
    this.funds = START_FUNDS; this.t = 6 * 60; this.speed = 1; this.simT = 0;
    this.star = 1; this.pop = 0; this.nextId = 1; this.avgEval = 150; this.avgHotelEval = 150;
    this.facs = []; this.shafts = []; this.stairs = []; this.people = [];
    this.grid = new Layer(null); this.tg = new Layer(null); this.slab = new Layer(0);
    this.ver = 0; this._adj = null; this._pc = {}; this._pcT = 0; this._rc = {}; this._rs = {};
    this.fin = {cur: {inc: {}, mnt: {}}, last: null};
    this.lastDay = -1; this.film = 0; this.filmDay = 0; this.cleanAcc = 0; this.gc = 0;
    this.outage = {energia: 0, agua: 0}; this.elevOff = false; this.store = {energia: 0, agua: 0}; this.weather = 'sol'; this.forecast = 'sol';
    this.lobbyH = 1; this.landmarkDone = false; this.rain = 0; this.rainWin = null;
    this.uhist = []; this.cars = []; this.hist = []; this.heli = null; this.trucks = []; this.fxs = []; this.santa = null;
    this.sys = {}; this.incidents = []; this.lastHr = -1;
    this.log = [];
  }

  emit(type, d) { this.onEvent(type, d || {}); }
  // `f` (opcional) é a sala do aviso: a notificação ganha um botão que leva a câmera até lá
  msg(text, cls, f) {
    const at = f && !f.dead ? {L: f.L, x: f.x + f.w / 2} : null;
    this.log.unshift({text, t: this.t, cls, at}); this.log.length = Math.min(this.log.length, 40);
    this.emit('msg', {text, cls, at, fac: f || null});
  }
  get day() { return Math.floor(this.t / 1440); }
  get minute() { return this.t % 1440; }
  get dayName() { return DAY_NAMES[this.day % 7]; }
  get weekend() { return this.day % 7 >= 5; }
  get quarterDay() { return this.day % QDAYS; }
  dirty() { this.ver++; this._adj = null; this._pc = {}; this._pcT = 0; this._rc = {}; this._rs = {}; this._segs = null; }

  // ------------------------------------------------------------ consulta ao mapa
  solid(L, u) { return !!(this.slab.get(L, u) || this.grid.get(L, u) || this.tg.get(L, u)); }
  solidCount(L, x, w) { let n = 0; for (let u = x; u < x + w; u++) if (this.solid(L, u)) n++; return n; }
  hasGroundLobby() { return this.facs.some(f => f.k === 'lobby' && f.L === 0 && !f.dead); }
  count(k) { let n = 0; for (const f of this.facs) if (f.k === k) n++; return n; }
  // sala que só funciona com acesso desde o térreo (o mesmo aviso vermelho "Sem acesso" da interface); saguão, ruína e corredores ficam de fora
  // (transporte público e rampa são entradas do prédio, com regra própria de ligação à rampa/rua: `stops`, `vehLinked`)
  needsAccess(f) { return !NO_ACCESS.has(f.k) && !FAC[f.k].corr && !FAC[f.k].util; }   // utilidades são infraestrutura: funcionam sem escada (mas a bomba precisa de energia)
  // vaga ou ponto de ônibus/táxi no subsolo que não chega à saída para a rua (rampa/portal): sem ligação não funciona. É o mesmo teste do aviso e do `serves`
  vehUnlinked(f) { return f.L < 0 && !!(FAC[f.k].park || FAC[f.k].needRamp) && f.build >= 1 && !f.dead && !this.vehLinked().has(f); }
  // por que a vaga f está sem ligação (texto para o painel e o alerta): olha a fileira de vagas dela e os elevadores de carros encostados
  vehWhy(f) {
    const seen = new Set([f]), q = [f], lifts = new Set();
    while (q.length) {
      const o = q.pop();
      for (const n of this.vehAdjAll(o, 0, false, false)) if (FAC[n.k].park && !seen.has(n)) { seen.add(n); q.push(n); }
      for (const s of this.shafts) if (s.carlift && o.L >= s.lo && o.L <= s.hi && this.vehAdj(o.L, s.x, s.w, 0, false, false).includes(o)) lifts.add(s);   // encostado, direto ou passando pela frente de outros poços
    }
    if (!lifts.size) return 'Nenhuma rampa, túnel com portal ou elevador de carros que chegue ao térreo está ligado a esta fileira: encoste-a, direto ou por outras vagas, num deles.';
    const ls = [...lifts];
    const toca = s => s.carlift && f.L >= s.lo && f.L <= s.hi && this.vehAdj(f.L, s.x, s.w, 0, false, false).includes(f) || [...seen].some(o => o.L >= s.lo && o.L <= s.hi && this.vehAdj(o.L, s.x, s.w, 0, false, false).includes(o));
    if (ls.some(s => s.off[f.L] && toca(s)) && !ls.some(s => !s.off[f.L] && !s.dark && toca(s))) return 'O elevador de carros encostado nela não atende este andar (desativado em "Andares atendidos"): ative o andar ' + floorLabel(f.L) + ' no painel dele.';
    if (ls.every(s => s.dark)) return 'O elevador de carros encostado nela está sem energia: ' + this.darkText(ls[0]);
    const s = ls[0];
    return 'O elevador de carros encostado nela só vai de ' + floorLabel(s.lo) + ' a ' + floorLabel(s.hi) + ' e não chega à rua: estenda-o até o térreo (' + floorLabel(0) + ') para ele ser uma entrada de carros, ou ligue a fileira a uma rampa ou portal.';
  }
  darkText(s) { return s.darkWhy === 'cap' ? 'as fontes ao alcance (gerador, bateria ou rede) não dão conta de tudo; acrescente geração ou reserva por perto.' : 'nenhuma fonte de energia (gerador, bateria ou rede) chega até ele; construa um gerador ou uma bateria por perto.'; }
  access(f) { return !this.needsAccess(f) || this.reachable(f); }   // só o acesso, sem olhar obra/fogo/energia (as utilidades usam este: `serves` chamaria `utilFresh`)
  // a sala está pronta e alguém chega até ela? Sem acesso por escada ou elevador ela não atende ninguém (serviço, vaga, transporte, lazer...)
  // (pronta, viva, aberta, sem fogo, com acesso e sem corte de energia/água); ruína nunca serve
  serves(f) {
    if (f.build < 1 || f.dead || f.closed || f.fire || f.k === 'ruin') return false;
    if (!this.access(f)) return false;
    if (this.vehUnlinked(f)) return false;   // vaga e ponto sem ligação com a rampa/portal não funcionam
    this.utilFresh();
    return !(f.cutE || f.cutA);
  }
  countOk(k) { let n = 0; for (const f of this.facs) if (f.k === k && f.build >= 1 && this.serves(f)) n++; return n; }
  countGroup(g) { let n = 0; for (const f of this.facs) if (FAC[f.k].limitGroup === g) n++; return n; }
  facAt(L, u) { return this.grid.get(L, u); }
  tgAt(L, u) { return this.tg.get(L, u); }
  // centro (x) da torre: média dos centros das salas; 0 se ainda não há nada. Em cache por versão do mapa.
  towerX() {
    if (this._tx && this._tx.v === this.ver) return this._tx.x;
    let a = 0;
    for (const f of this.facs) a += f.x + f.w / 2;
    const x = this.facs.length ? a / this.facs.length : 0;
    this._tx = {v: this.ver, x};
    return x;
  }
  topBuilt() { let m = 0; for (const f of this.facs) m = Math.max(m, f.L + f.h - 1); for (const s of this.shafts) m = Math.max(m, s.hi); return m; }
  groundLobbyH() { for (const f of this.facs) if (f.k === 'lobby' && f.L === 0) return f.h; return this.lobbyH; }

  // ------------------------------------------------------------ construção
  // subsolo é terra: vale apoio por cima, por baixo ou encostado em algo já construído no mesmo andar
  anchored(L, x, w, h) {
    if (this.solidCount(L + h, x, w) >= Math.ceil(w / 2) || this.solidCount(L - 1, x, w) >= Math.ceil(w / 2)) return true;
    for (let lev = L; lev < L + h; lev++) if (this.solid(lev, x - 1) || this.solid(lev, x + w)) return true;
    return false;
  }
  canPlaceFac(k, L, x, opt = {}) {
    const d = FAC[k], w = k === 'lobby' && opt.w ? opt.w : d.w;
    if (d.nobuild) return {err: 'Não pode ser construído.'};
    if (d.star > this.star) return {err: 'Requer ' + d.star + ' estrelas.'};
    if (k !== 'lobby' && !this.hasGroundLobby()) return {err: 'Comece com um saguão no térreo.'};
    const h = k === 'lobby' && L === 0 ? this.groundLobbyH() : d.h;
    if (x < X_MIN || x + w > X_MAX) return {err: 'Fora do terreno.'};
    if (((x % BOX) + BOX) % BOX) return {err: 'Fora da grade.'};
    if (L < MIN_L + 1 || L > MAX_L) return {err: 'Andar inválido.'};
    if (k === 'lobby' && !isLobbyLevel(L)) return {err: 'Saguões ficam no térreo, nos subsolos e a cada 15 andares.'};
    if (k === 'lobby' && L !== 0 && !this.hasGroundLobby()) return {err: 'Comece com um saguão no térreo.'};
    if (L < 0 && !d.under) return {err: d.label + ' não pode ficar no subsolo.'};
    if (L >= 0 && !d.above) return {err: d.label + ' não pode ficar acima do solo.'};
    if (d.underOnly && L >= 0) return {err: 'Só no subsolo.'};
    if ((d.veh || d.needRamp) && L < 0 && !d.portal && !(d.slope && L === -1) && !this.vehAdjAll({L, x, w, h: d.h}, opt.dir === -1 ? -1 : 1, !!d.slope).length) return {err: (d.slope ? d.label + ' no subsolo' : d.veh ? 'O túnel' : d.label + ' no subsolo') + ' precisa encostar numa rampa ou num túnel (' + (d.slope ? 'a ponta alta no andar de cima e a baixa no próprio andar; R gira o lado' : 'de um lado ou do outro') + ').'};
    if (d.roof) { for (const o of this.facs) if (o.L > L && o.x < x + w && o.x + o.w > x) return {err: d.label + ' só fica no topo: há salas acima.'}; }
    if (L > 0) for (let u = x; u < x + w; u++) { const b = this.grid.get(L - 1, u); if (b && FAC[b.k].roof) return {err: 'Nada fica em cima do ' + FAC[b.k].label.toLowerCase() + '.'}; }
    if (d.maxL !== undefined && L > d.maxL) return {err: d.label + ' só fica no térreo ou no subsolo.'};
    if (L < 0 && L + h - 1 >= 0) return {err: 'Não cabe aqui (cruza o térreo).'};
    if (L + h - 1 > (k === 'landmark' ? TOP_L : MAX_L)) return {err: 'Altura máxima excedida.'};
    if (k === 'landmark' && L < 30) return {err: 'A capela fica no alto da torre (andar 31 ou acima).'};
    if (d.limit && this.count(k) >= d.limit) return {err: 'Limite de ' + d.limit + ' atingido.'};
    if (d.limitGroup && this.countGroup(d.limitGroup) >= LIMITS[d.limitGroup]) return {err: 'Limite atingido.'};
    for (let lev = L; lev < L + h; lev++) for (let u = x; u < x + w; u++) {
      if (this.grid.get(lev, u) || this.tg.get(lev, u)) return {err: 'Espaço ocupado.'};
      if (this.shaftCapAt(lev, u)) return {err: 'Espaço da casa de máquinas / poço do elevador.'};
    }
    if (L > 0 && this.solidCount(L - 1, x, w) < Math.ceil(w / 2)) return {err: 'Precisa de apoio no andar de baixo.'};
    if (L < 0 && !this.anchored(L, x, w, h)) return {err: 'Precisa de apoio (piso em cima, embaixo ou ao lado).'};
    let slabUnits = 0;
    if (L !== 0 && k !== 'lobby') for (let u = x; u < x + w; u++) if (!this.slab.get(L, u)) slabUnits++;
    const cost = Math.round(d.cost * (k === 'lobby' && L === 0 ? h : 1) * w / d.w * (opt.mult || 1)) + slabUnits * FLOOR_COST;
    if (this.funds < cost) return {err: 'Dinheiro insuficiente (' + fmtMoney(cost) + ').', cost};
    return {ok: true, cost, h};
  }
  placeFac(k, L, x, opt = {}) {
    const r = this.canPlaceFac(k, L, x, opt);
    if (!r.ok) return r;
    const d = FAC[k], w = k === 'lobby' && opt.w ? opt.w : d.w;
    const f = {id: this.nextId++, sty: (Math.imul(this.nextId, 2654435761) ^ (L * 7919 + x * 104729)) >>> 0, cat: 'fac', k, L, x, w, h: r.h, price: 1, build: 0, dur: k === 'lobby' ? 15 : d.cost >= 500000 ? 240 : 60,
               occ: false, persons: [], eval: 150, poorDays: 0, dirty: false, guest: null, fire: 0, dead: false, stress: 0, guests: [], emp: [], film: this.film, lastVisit: 0, rep: 100, dir: d.slope || d.portal ? (opt.dir === -1 ? -1 : 1) : 0, line: k === 'transit' ? ((opt.line ?? this.facs.filter(o => o.k === 'transit').length) % LINES.length + LINES.length) % LINES.length : 0};
    this.facs.push(f);
    for (let lev = L; lev < L + f.h; lev++) for (let u = x; u < x + f.w; u++) this.grid.set(lev, u, f);
    for (let u = x; u < x + f.w; u++) this.slab.set(L, u, 1);
    this.funds -= r.cost;
    this.dirty();
    return {ok: true, fac: f};
  }
  // caixas de saguão (BOX) no trecho [a,b], pulando as já ocupadas (elevadores, salas)
  lobbyPieces(L, x0, x1) {
    const a = Math.floor(Math.max(X_MIN, Math.min(x0, x1)) / BOX) * BOX, b = Math.floor(Math.min(X_MAX - 1, Math.max(x0, x1)) / BOX) * BOX;
    if (L < MIN_L + 1 || L > MAX_L) return [];
    const out = [];
    for (let x = a; x <= b; x += BOX) if (!this.grid.get(L, x) && !this.tg.get(L, x)) out.push({x, w: BOX});
    return out;
  }
  lobbyPreview(L, x0, x1) {
    const ps = this.lobbyPieces(L, x0, x1);
    let cost = 0, n = 0, err = ps.length ? '' : 'Espaço ocupado.';
    for (const p of ps) { const r = this.canPlaceFac('lobby', L, p.x, {w: p.w}); if (r.ok) { n++; cost += r.cost; } else if (!err) err = r.err; }
    return {ok: n > 0, cost, err};
  }
  placeLobbySpan(L, x0, x1) {
    let n = 0, last = null;
    for (const p of this.lobbyPieces(L, x0, x1)) {
      const r = this.placeFac('lobby', L, p.x, {w: p.w});
      if (r.ok) n++; else if (!last) last = r.err;
    }
    return n ? {ok: true, n} : {err: last || 'Nada a construir.'};
  }
  // células de piso que dá para criar no trecho (em caixas): {a, b, i, ok}
  floorCells(L, x0, x1) {
    const a = Math.floor(Math.max(X_MIN, Math.min(x0, x1)) / BOX) * BOX, b = Math.floor(Math.min(X_MAX - 1, Math.max(x0, x1)) / BOX) * BOX + BOX - 1;
    const free = u => !(this.slab.get(L, u) || this.grid.get(L, u) || this.tg.get(L, u));
    const base = a - 1, ok = new Uint8Array(b - a + 3);   // ok[u - base]: uma casa de folga de cada lado
    const isOk = u => ok[u - base], mark = u => { ok[u - base] = 1; };
    for (let u = a; u <= b; u++) if (free(u) && this.solid(L > 0 ? L - 1 : L + 1, u)) mark(u);
    if (L < 0) {
      // subsolo: o piso também pode crescer de lado a partir de algo já construído no mesmo andar
      const side = (u, d) => this.solid(L, u + d) || isOk(u + d);
      for (let u = a; u <= b; u++) if (free(u) && !isOk(u) && (side(u, -1) || this.solid(L - 1, u))) mark(u);
      for (let u = b; u >= a; u--) if (free(u) && !isOk(u) && side(u, 1)) mark(u);
      for (let u = a; u <= b; u++) if (free(u) && !isOk(u) && side(u, -1)) mark(u);
    }
    let n = 0; for (let u = a; u <= b; u++) n += isOk(u);
    return {a, b, base, ok, n};
  }
  floorCheck(L, x0, x1) {
    if (!this.hasGroundLobby()) return {err: 'Comece com um saguão no térreo.'};
    if (L === 0) return {err: 'O térreo já tem chão.'};
    if (L < MIN_L + 1 || L > MAX_L) return {err: 'Andar inválido.'};
    const r = this.floorCells(L, x0, x1);
    if (!r.n) return {err: L > 0 ? 'A estrutura precisa de apoio no andar de baixo (ou já existe piso).' : 'Precisa de apoio (em cima, embaixo ou ao lado) — ou já existe piso.'};
    const cost = r.n * FLOOR_COST;
    if (this.funds < cost) return {err: 'Dinheiro insuficiente (' + fmtMoney(cost) + ').', cost};
    return {ok: true, cost, r};
  }
  placeFloorSpan(L, x0, x1) {
    const c = this.floorCheck(L, x0, x1);
    if (!c.ok) return c;
    const {a, b, base, ok, n} = c.r;
    for (let u = a; u <= b; u++) if (ok[u - base]) this.slab.set(L, u, 1);
    this.funds -= c.cost;
    this.dirty();
    return {ok: true, n};
  }
  canPlaceStairs(k, L, x) {
    const t = TRANSPORT[k];
    if (t.star > this.star) return {err: 'Requer ' + t.star + ' estrelas.'};
    if (!this.hasGroundLobby()) return {err: 'Comece com um saguão no térreo.'};
    if (x < X_MIN || x + t.w > X_MAX) return {err: 'Fora do terreno.'};
    if (((x % BOX) + BOX) % BOX) return {err: 'Fora da grade.'};
    if (L < MIN_L + 1 || L + 1 > MAX_L) return {err: 'Andar inválido.'};
    if (this.stairs.length >= LIMITS.stairsEsc) return {err: 'Limite de escadas atingido.'};
    for (let u = x; u < x + t.w; u++) {
      const g = this.grid.get(L, u);
      if ((g && g.k !== 'lobby') || this.tg.get(L, u) || this.shaftCapAt(L, u)) return {err: 'Espaço ocupado.'};
    }
    if (L > 0 && this.solidCount(L - 1, x, t.w) < Math.ceil(t.w / 2)) return {err: 'Precisa de apoio embaixo.'};
    if (L < 0 && this.solidCount(L + 1, x, t.w) < Math.ceil(t.w / 2)) return {err: 'Precisa de apoio em cima.'};
    if (!this.solid(L + 1, x + t.w - 1) && !this.solid(L + 1, x + t.w - 2)) return {err: 'O andar de cima precisa de piso na ponta da escada (senão ninguém consegue subir).'};
    if (this.funds < t.cost) return {err: 'Dinheiro insuficiente (' + fmtMoney(t.cost) + ').', cost: t.cost};
    return {ok: true, cost: t.cost};
  }
  placeStairs(k, L, x) {
    const r = this.canPlaceStairs(k, L, x);
    if (!r.ok) return r;
    const t = TRANSPORT[k];
    const s = {id: this.nextId++, cat: 'stair', k, L, x, w: t.w};
    this.stairs.push(s);
    for (let u = x; u < x + t.w; u++) this.tg.set(L, u, s);
    this.funds -= r.cost; this.dirty();
    return {ok: true};
  }
  shaftCheck(k, x, a, b) {
    const t = TRANSPORT[k];
    const lo = Math.min(a, b), hi = Math.max(a, b), span = hi - lo + 1;
    if (t.star > this.star) return {err: 'Requer ' + t.star + ' estrelas.'};
    if (!this.hasGroundLobby()) return {err: 'Comece com um saguão no térreo.'};
    if (x < X_MIN || x + t.w > X_MAX) return {err: 'Fora do terreno.'};
    if (((x % BOX) + BOX) % BOX) return {err: 'Fora da grade.'};
    if (lo < MIN_L + 1 || hi > MAX_L) return {err: 'Andar inválido.'};
    if (span < 2) return {err: 'O elevador precisa de pelo menos 2 andares.'};
    if (span > t.maxSpan) return {err: 'No máximo ' + t.maxSpan + ' andares por poço.'};
    if (this.shafts.length >= LIMITS.shafts) return {err: 'Limite de poços atingido.'};
    if (t.maxHi !== undefined && hi > t.maxHi) return {err: t.label + ' só do térreo para baixo.'};
    if (t.carlift) for (let u = x; u < x + t.w; u++) if (this.grid.get(hi + 1, u) || this.tg.get(hi + 1, u)) return {err: 'A casa de máquinas precisa de uma casa livre em cima (no andar ' + floorLabel(hi + 1) + ').'};
    for (let L = lo; L <= hi; L++) for (let u = x; u < x + t.w; u++) {
      const g = this.grid.get(L, u);
      if (this.tg.get(L, u)) return {err: 'Já existe outro elevador ou escada aqui.'};
      if (g && g.k !== 'lobby') return {err: 'Espaço ocupado no andar ' + floorLabel(L) + '.'};
    }
    if (lo > 0 && this.solidCount(lo - 1, x, t.w) < Math.ceil(t.w / 2)) return {err: 'Precisa de apoio embaixo.'};
    if (hi < 0 && !t.carlift && this.solidCount(hi + 1, x, t.w) < Math.ceil(t.w / 2)) return {err: 'Precisa de apoio em cima.'};   // o elevador de carros pendura na própria casa de máquinas (que ocupa a casa de cima) e o subsolo é terra
    if (k === 'express') {
      if (!isExpressStop(lo) || !isExpressStop(hi)) return {err: 'O expresso deve começar e terminar em saguões.'};
      for (const L of [lo, hi]) if (L >= 0) {
        let n = 0; for (let u = x; u < x + t.w; u++) { const g = this.grid.get(L, u); if (g && g.k === 'lobby') n++; }
        if (n < t.w) return {err: 'Falta saguão no andar ' + floorLabel(L) + '.'};
      }
    }
    const cost = Math.round(t.cost * (0.3 + 0.7 * Math.min(1, span / 30)) / 1000) * 1000;
    if (this.funds < cost) return {err: 'Dinheiro insuficiente (' + fmtMoney(cost) + ').', cost};
    return {ok: true, cost, lo, hi};
  }
  placeShaft(k, x, a, b) {
    const r = this.shaftCheck(k, x, a, b);
    if (!r.ok) return r;
    const t = TRANSPORT[k];
    const s = {id: this.nextId++, cat: 'shaft', k, x, w: t.w, lo: r.lo, hi: r.hi, cars: [], q: {}, off: {}, hidden: false, stopsC: null, carlift: !!t.carlift};
    s.cars.push(this.newCar(s, s.carlift ? s.hi : s.lo));   // a cabine de carros espera no topo (a rua)
    this.shafts.push(s);
    for (let L = s.lo; L <= s.hi; L++) for (let u = x; u < x + t.w; u++) this.tg.set(L, u, s);
    this.funds -= r.cost; this.dirty();
    return {ok: true, shaft: s};
  }
  // casa de máquinas (uma casa acima do último andar do poço) e poço (uma casa abaixo do primeiro): ocupam a coluna do elevador e são as alças para estendê-lo
  shaftCapAt(L, u) {
    for (const s of this.shafts) if (u >= s.x && u < s.x + s.w && (L === s.hi + 1 || L === s.lo - 1)) return s;
    return null;
  }
  shaftCost(s, span) { return Math.round(TRANSPORT[s.k].cost * (0.3 + 0.7 * Math.min(1, span / 30)) / 1000) * 1000; }
  // estende o poço n andares para cima (dir 1) ou para baixo (dir -1); cada novo andar precisa da coluna livre e da casa de máquinas/poço livre depois dele
  extendShaft(s, dir, n = 1, dry = false) {
    const t = TRANSPORT[s.k];
    if (s.k === 'express') return {err: 'O elevador expresso não se estende (ele liga saguões).'};
    const lo = dir > 0 ? s.lo : s.lo - n, hi = dir > 0 ? s.hi + n : s.hi, span = hi - lo + 1;
    if (span > t.maxSpan) return {err: 'No máximo ' + t.maxSpan + ' andares por poço.'};
    if (lo < MIN_L + 2 || hi > MAX_L - 1) return {err: 'Andar inválido.'};
    if (t.maxHi !== undefined && hi > t.maxHi) return {err: t.label + ' só do térreo para baixo.'};
    const free = (L, lobbyOk) => { for (let u = s.x; u < s.x + s.w; u++) { const g = this.grid.get(L, u); if (this.tg.get(L, u) || (g && !(lobbyOk && g.k === 'lobby'))) return false; } return true; };
    const newLv = []; for (let L = dir > 0 ? s.hi + 1 : lo; L <= (dir > 0 ? hi : s.lo - 1); L++) newLv.push(L);
    for (const L of newLv) if (!free(L, true)) return {err: 'Espaço ocupado no andar ' + floorLabel(L) + '.'};
    if (!free(dir > 0 ? hi + 1 : lo - 1, false)) return {err: 'A casa de máquinas/poço precisa de uma casa livre depois do último andar.'};
    if (dir < 0 && lo > 0 && this.solidCount(lo - 1, s.x, s.w) < Math.ceil(s.w / 2)) return {err: 'Precisa de apoio embaixo.'};
    if (dir > 0 && hi < 0 && !s.carlift && this.solidCount(hi + 1, s.x, s.w) < Math.ceil(s.w / 2)) return {err: 'Precisa de apoio em cima.'};
    const cost = this.shaftCost(s, span) - this.shaftCost(s, s.hi - s.lo + 1);
    if (this.funds < cost) return {err: 'Dinheiro insuficiente (' + fmtMoney(cost) + ').', cost};
    if (dry) return {ok: true, cost, lo, hi};
    for (const L of newLv) for (let u = s.x; u < s.x + s.w; u++) this.tg.set(L, u, s);
    s.lo = lo; s.hi = hi; s.stopsC = null;
    this.funds -= cost; this.dirty();
    return {ok: true, cost, lo, hi};
  }
  // encurta o poço n andares (sem reembolso); quem está na fila ou na cabine nesses andares desce na ponta nova
  shrinkShaft(s, dir, n = 1) {
    const lo = dir > 0 ? s.lo : s.lo + n, hi = dir > 0 ? s.hi - n : s.hi;
    if (hi - lo + 1 < 2) return {err: 'O elevador precisa de pelo menos 2 andares.'};
    const gone = L => L < lo || L > hi;
    for (const L in s.q) if (gone(+L)) { for (const p of s.q[L]) this.release(p, Math.max(lo, Math.min(hi, +L)), s.x + s.w / 2); s.q[L] = []; }
    for (const c of s.cars) {
      if (gone(Math.round(c.y))) c.y = Math.max(lo, Math.min(hi, c.y));
      for (const p of c.pax.slice()) if (gone(p.step.to) || gone(Math.round(c.y))) { this.release(p, Math.round(c.y), s.x + s.w / 2); c.pax.splice(c.pax.indexOf(p), 1); }
      c.dir = 0;
    }
    for (let L = s.lo; L <= s.hi; L++) if (gone(L)) { for (let u = s.x; u < s.x + s.w; u++) this.tg.set(L, u, null); delete s.off[L]; }
    s.lo = lo; s.hi = hi; s.stopsC = null; this.dirty();
    return {ok: true, lo, hi};
  }
  newCar(s, y = s.lo) { return {id: this.nextId++, y, dir: 0, pax: [], dwell: 0}; }
  // andar para uma nova cabine: o mais distante das outras (cada cabine tem a sua pista, então nunca falta lugar)
  freeCarFloor(s) {
    let best = s.lo, bd = -1;
    for (let y = s.lo; y <= s.hi; y++) {
      const d = s.cars.reduce((m, o) => Math.min(m, Math.abs(o.y - y)), 99);
      if (d > bd) { bd = d; best = y; }
    }
    return best;
  }
  stopsOf(s) {
    if (!s.stopsC) {
      s.stopsC = [];
      for (let L = s.lo; L <= s.hi; L++) {
        if (s.k === 'express' ? !isExpressStop(L) : false) continue;
        if (s.off[L]) continue;
        s.stopsC.push(L);
      }
    }
    return s.stopsC;
  }
  setStopOff(s, L, off) {
    if (off) s.off[L] = true; else delete s.off[L];
    s.stopsC = null; this.flushShaft(s); this.dirty();
  }
  // elevador de carros: a cabine só se move enquanto há fila (só para a animação); a espera é a fila de `liftQueue`
  // viagens do elevador de carros (animação em tempo real, independente da fila em minutos de jogo): quem entra de carro desce com ele até o nível da vaga
  // ('in': a cabine pega o carro na rua e leva); quem sai de carro faz o inverso ('out': a cabine desce vazia, pega o carro e sobe). Cada cabine pega a próxima viagem da fila
  updCarLift(s, c, h) {
    const sp = TRANSPORT.carlift.vmax * h * 0.5, go = to => { c.dir = Math.sign(to - c.y); c.y += c.dir * Math.min(sp, Math.abs(to - c.y)); return Math.abs(to - c.y) < 1e-6; };
    if (c.dwell > 0) { c.dwell -= h; return; }
    if (!c.trip) {
      const tr = s.trips || (s.trips = []), k = tr.findIndex(t => !(t.delay > 0));   // viagem cuja hora já chegou
      c.trip = k >= 0 ? tr.splice(k, 1)[0] : null;
      if (c.trip) c.trip.L = clamp(c.trip.L, s.lo, s.hi);
      if (c.trip) c.trip.ph = c.trip.kind === 'in' ? 0 : 1;   // fases: 0 = sobe/espera no topo para pegar o carro, 1 = vai até o carro, 2 = leva o carro ao destino
    }
    const t = c.trip;
    if (!t) { c.full = false; if (!go(s.hi)) return; c.dir = 0; return; }   // sem viagens: volta ao topo (a rua) e espera
    const pick = t.kind === 'in' ? s.hi : t.L, drop = t.kind === 'in' ? t.L : s.hi;
    if (t.ph === 0 || t.ph === 1) { c.full = false; if (go(pick)) { t.ph = 2; c.dwell = 0.6; c.dir = 0; if (t.space && t.kind === 'out') t.space.holdCar = false; } return; }   // saída: a cabine pegou o carro e ele sai da vaga
    c.full = true; if (go(drop)) { if (t.spawn) this.spawnGarageCar(false, s); if (t.space && t.kind === 'in') { t.space.carWait = false; t.space.carT = this.simT; } c.trip = null; c.full = false; c.dwell = 0.6; c.dir = 0; }   // a cabine entregou: o carro entra na vaga
  }
  // fila do elevador de carros: escoa `CARLIFT.rate` carros por minuto por cabine; devolve a espera, em minutos, de quem chega agora
  liftQueue(s) {
    const dt = this.t - (s.rt ?? this.t);
    s.rush = Math.max(0, (s.rush || 0) - dt * CARLIFT.rate * Math.max(1, s.cars.length)); s.rt = this.t;
    return s.rush;
  }
  liftWaitMin(s) { return this.liftQueue(s) / (CARLIFT.rate * Math.max(1, s.cars.length)); }
  liftJoin(s) { const w = this.liftWaitMin(s); s.rush = this.liftQueue(s) + 1; return w; }
  // o carro de p usa os elevadores de carros do caminho até a vaga: entra na fila de cada um e o motorista se estressa com a espera
  // delay: segundos até a cabine começar (o carro da rua ainda está chegando); spawn: o carro só aparece na rua quando a cabine o entrega
  liftTrip(p, space, kind = 'in', delay = 0, spawn = null) {
    const ls = this.liftsFor(space), last = ls[ls.length - 1];   // a última cabine da cadeia é a que entrega/pega o carro na vaga
    let wait = 0;
    for (const s of ls) {
      wait += this.liftJoin(s); const tr = s.trips || (s.trips = []);
      if (tr.length < 8) tr.push({L: space.L, kind, delay: s === spawn ? delay : 0, spawn: s === spawn && kind === 'out', space: s === last ? space : null});
      else if (s === last) { space.carWait = false; space.holdCar = false; }   // fila de animação cheia: o carro não espera a cabine
    }
    if (wait > 0) p.stress = Math.min(STRESS_MAX, p.stress + Math.min(CARLIFT.maxStress, wait * CARLIFT.stress));
  }
  // elevadores de carros que o carro precisa usar para chegar à vaga (vazio = vaga com saída direta)
  liftsFor(f) { return this.vehLinked() && this._vl.lifts.get(f) || []; }
  addCar(s) {
    const t = TRANSPORT[s.k];
    if (s.cars.length >= LIMITS.carsPerShaft) return 'Máximo de cabines atingido.';
    if (this.funds < t.carCost) return 'Dinheiro insuficiente.';
    this.funds -= t.carCost; s.cars.push(this.newCar(s, s.carlift ? s.hi : this.freeCarFloor(s))); return null;
  }
  removeCar(s) {
    if (s.cars.length <= 1) return 'O poço precisa de ao menos uma cabine.';
    const c = s.cars.pop();
    for (const p of c.pax) this.release(p, Math.round(c.y), s.x + s.w / 2);
    return null;
  }
  release(p, L, x) { p.L = L; p.x = x; p.st = 'idle'; p.step = null; p.dest = null; p.at = null; }
  flushShaft(s) {
    for (const k in s.q) { for (const p of s.q[k]) this.release(p, +k, s.x + s.w / 2); s.q[k] = []; }
    for (const c of s.cars) { for (const p of c.pax) this.release(p, Math.round(c.y), s.x + s.w / 2); c.pax = []; c.dir = 0; }
  }
  removeFac(f) {
    f.dead = true;
    for (let lev = f.L; lev < f.L + f.h; lev++) for (let u = f.x; u < f.x + f.w; u++) this.grid.set(lev, u, null);
    this.facs = this.facs.filter(o => o !== f);
    for (const p of f.persons) { this.leaveJob(p); p.dead = true; }
    this.fireAll(f);
    for (const p of f.guests) p.dead = true;
    if (f.occ && FAC[f.k].condo) this.funds -= FAC[f.k].prices[f.price];
    f.persons = []; f.guests = [];
    this.dirty();
  }
  removeShaft(s) {
    this.flushShaft(s);
    for (let L = s.lo; L <= s.hi; L++) for (let u = s.x; u < s.x + s.w; u++) this.tg.set(L, u, null);
    this.shafts = this.shafts.filter(o => o !== s);
    s.dead = true; this.dirty();
  }
  removeStairs(s) {
    for (const p of this.people) if (p.st === 'stair' && p.stair.conn === s) this.release(p, p.stair.from, p.x);
    for (let u = s.x; u < s.x + s.w; u++) this.tg.set(s.L, u, null);
    this.stairs = this.stairs.filter(o => o !== s);
    s.dead = true; this.dirty();
  }
  bulldoze(L, u) {
    const t = this.tgAt(L, u), f = this.facAt(L, u);
    if (t) {
      if (t.cat === 'shaft') this.removeShaft(t); else this.removeStairs(t);
      return {ok: true, what: TRANSPORT[t.k].label};
    }
    if (f) {
      if (!FAC[f.k].removable) return {err: FAC[f.k].label + ' não pode ser demolido.'};
      if (f.fire) return {err: 'Não dá para demolir uma sala em chamas.'};
      if (f.k === 'lobby' && f.L === 0) {
        const others = this.facs.filter(o => o !== f && o.k === 'lobby' && o.L === 0);
        if (!others.length && this.facs.length > 1) return {err: 'Demole o resto da torre antes do último saguão.'};
      }
      this.removeFac(f);
      return {ok: true, what: FAC[f.k].label};
    }
    if (L !== 0 && this.slab.get(L, u)) {
      // remove piso vazio (uma caixa) se nada sustentado em cima
      const a = Math.floor(u / BOX) * BOX;
      let n = 0;
      for (let v = a; v < a + BOX; v++) if (this.slab.get(L, v) && !this.grid.get(L, v) && !this.tg.get(L, v) && !this.solid(L + 1, v)) { this.slab.set(L, v, 0); n++; }
      if (n) this.dirty();
      return n ? {ok: true, what: 'Piso'} : {err: 'Há algo apoiado neste piso.'};
    }
    return {err: 'Nada para demolir.'};
  }

  // ------------------------------------------------------------ transporte / rotas
  // trechos de piso contínuo de um andar (onde dá para andar), calculados só para os andares que alguém consulta: {lo, hi, arr}, arr[u - lo] = início do trecho (ou NOSEG)
  segRow(L) {
    const m = this._segs || (this._segs = new Map());
    let r = m.get(L);
    if (r !== undefined) return r;
    const bs = [this.slab.bounds(L), this.grid.bounds(L), this.tg.bounds(L)].filter(Boolean);
    if (!bs.length) { m.set(L, null); return null; }
    const lo = Math.min(...bs.map(x => x[0])), hi = Math.max(...bs.map(x => x[1])), arr = new Int32Array(hi - lo + 1).fill(NOSEG);
    let start = null;
    for (let u = lo; u <= hi + 1; u++) {
      const w = u <= hi && this.solid(L, u);
      if (w && start === null) start = u;
      if (start !== null) { if (w) arr[u - lo] = start; else start = null; }
    }
    r = {lo, hi, arr};
    m.set(L, r);
    return r;
  }
  nodeAt(L, x) {
    if (L < MIN_L || L > MAX_L) return -1;
    const r = this.segRow(L), u = Math.floor(x);
    if (!r || u < r.lo || u > r.hi) return -1;
    const s = r.arr[u - r.lo];
    return s === NOSEG ? -1 : (L + NODE.lOff) * NODE.xSpan + s + NODE.xOff;
  }
  nodeLevel(key) { return Math.floor(key / NODE.xSpan) - NODE.lOff; }
  segBounds(L, x) {
    const r = this.segRow(L), u = Math.floor(x);
    if (!r || u < r.lo || u > r.hi) return null;
    const s = r.arr[u - r.lo];
    if (s === NOSEG) return null;
    let e = u; while (e + 1 <= r.hi && r.arr[e + 1 - r.lo] === s) e++;
    return {a: s, b: e + 1};
  }
  buildAdj() {
    const adj = new Map();
    const add = (a, e) => { if (a < 0 || e.to < 0) return; (adj.get(a) || adj.set(a, []).get(a)).push(e); };
    for (const s of this.stairs) {
      const w = s.k === 'stairs' ? STAIR_COST : ESC_COST;
      const lo = this.nodeAt(s.L, s.x + 1), up = this.nodeAt(s.L + 1, s.x + s.w - 1);
      add(lo, {to: up, w, conn: s, tl: s.L + 1}); add(up, {to: lo, w, conn: s, tl: s.L});
    }
    for (const s of this.shafts) {
      if (s.carlift) continue;   // só carros: não entra no grafo de rotas das pessoas
      const st = this.stopsOf(s);
      const nodes = st.map(L => this.nodeAt(L, s.x + s.w / 2));
      for (let i = 0; i < st.length; i++) for (let j = 0; j < st.length; j++) {
        if (i === j) continue;
        const w = (s.k === 'express' ? EXPR_BASE : ELEV_BASE) + Math.abs(st[i] - st[j]) * (s.k === 'express' ? EXPR_FLOOR : ELEV_FLOOR);
        add(nodes[i], {to: nodes[j], w, conn: s, svc: s.k === 'service', tl: st[j]});
      }
    }
    return (this._adj = adj);
  }
  // busca de menor custo a partir do nó a. Estado = (nó, x de chegada), para somar a caminhada
  // entre uma conexão e a próxima; a fila dos elevadores entra no custo (cache curto, ela muda).
  // sx == null: sem caminhada nem fila (só conectividade).
  search(a, sx, staff) {
    if (this.simT - this._pcT > 3) { this._pc = {}; this._pcT = this.simT; }
    const ck = a + (staff === 'stairs' ? 'f' : staff === 'maid' ? 'm' : staff ? 's' : '') + '|' + (sx == null ? '-' : Math.round(sx / 6));
    let pc = this._pc[ck];
    if (pc) return pc;
    const adj = this._adj || this.buildAdj(), walkK = sx == null ? 0 : WALK_COST, qK = sx == null ? 0 : QUEUE_COST;
    const key = (n, x) => n * 1048576 + Math.round(x * 2) + 524288;   // (nó, x de chegada) em um número só: o nó vai até ~1,1e9 e 2x cabe em ±524.288
    const k0 = key(a, sx == null ? 0 : sx);
    const dist = new Map([[k0, 0]]), prev = new Map(), byNode = new Map(), done = new Set(), heap = [[0, k0, a, sx == null ? 0 : sx]];
    const push = it => { heap.push(it); let i = heap.length - 1; while (i > 0) { const q = (i - 1) >> 1; if (heap[q][0] <= heap[i][0]) break; [heap[q], heap[i]] = [heap[i], heap[q]]; i = q; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const qMemo = new Map(), cwMemo = new Map();   // fila e espera pela cabine são iguais para todas as arestas do mesmo poço neste andar: calcula uma vez
    while (heap.length) {
      const [d, k, u, x] = pop();
      if (done.has(k)) continue;
      done.add(k);
      (byNode.get(u) || byNode.set(u, []).get(u)).push({k, x, d});
      const Lu = this.nodeLevel(u);
      for (const e of adj.get(u) || []) {
        if (e.svc && !staff) continue;
        if (staff === 'stairs' && e.conn.cat === 'shaft') continue;   // bombeiros: só escadas
        if (staff === 'maid' && !e.svc) continue;   // camareiras: só o elevador de serviço (com o carrinho não usam escada nem elevador comum)
        const ex = this.connX(e.conn, e.tl), nk = key(e.to, ex);
        let dyn = 0;
        if (walkK) {
          const mk = e.conn.id * 8192 + Lu + 4096;
          let qv = qMemo.get(mk), cw = cwMemo.get(mk);
          if (qv === undefined) { qv = qK * this.queueLen(e.conn, Lu); cw = this.carWait(e.conn, Lu); qMemo.set(mk, qv); cwMemo.set(mk, cw); }
          dyn = walkK * Math.abs(x - this.connX(e.conn, Lu)) + qv + cw;
        }
        const nd = d + (e.conn.dark && e.conn.k === 'escalator' ? STAIR_COST : e.w) + dyn;   // rolante sem energia = escada comum
        if (nd < (dist.has(nk) ? dist.get(nk) : 1e9)) { dist.set(nk, nd); prev.set(nk, {k, e}); push([nd, nk, e.to, ex]); }
      }
    }
    return (this._pc[ck] = {k0, dist, prev, byNode});
  }
  // melhor estado de chegada em b (somando a caminhada até dx, se houver) e a lista de arestas até ele
  routeTo(s, b, dx) {
    const L = s.byNode.get(b);
    if (!L) return null;
    let best = null, bs = 1e9;
    for (const o of L) { const c = o.d + (dx == null ? 0 : WALK_COST * Math.abs(o.x - dx)); if (c < bs) { bs = c; best = o; } }
    const edges = [];
    let k = best.k, guard = 0;
    while (k !== s.k0 && guard++ < 400) { const q = s.prev.get(k); edges.push(q.e); k = q.k; }
    return edges.reverse();
  }
  nodePath(a, b, staff) {
    if (a === b) return [a];
    const edges = this.routeTo(this.search(a, null, staff), b, null);
    return edges ? [a, ...edges.map(e => e.to)] : null;
  }
  // primeira conexão da melhor rota, considerando onde a pessoa está (px) e para onde vai (dx)
  route(a, b, px, dx, staff) {
    const edges = this.routeTo(this.search(a, px, staff), b, dx);
    return edges && edges.length ? edges[0] : null;
  }
  groundEntrances() {
    // pontas de cada trecho de piso do térreo que contém saguão
    if (this._ge && this._ge.v === this.ver) return this._ge.out;   // em cache até o mapa mudar (é chamada a cada pessoa que entra ou sai)
    const out = [], seen = new Set();
    for (const f of this._index().rows.get(0) || []) if (f.k === 'lobby') {
      const b = this.segBounds(0, f.x);
      if (!b || seen.has(b.a)) continue;
      seen.add(b.a);
      out.push({x: b.a + 0.5, key: this.nodeAt(0, b.a)}, {x: b.b - 0.5, key: this.nodeAt(0, b.a)});
    }
    this._ge = {v: this.ver, out};
    return out;
  }
  reachable(f) {
    if (f.dead) return false;
    if (f.k === 'ruin') return false;
    if (this._rc[f.id] !== undefined) return this._rc[f.id];
    const target = this.nodeAt(f.L, f.x + f.w / 2);
    let ok = false;
    if (target >= 0) for (const e of this.groundEntrances()) { if (this.nodePath(e.key, target)) { ok = true; break; } }
    return (this._rc[f.id] = ok);
  }
  // os bombeiros chegam à sala f? Precisam de escada ou escada rolante contínua do térreo até lá (elevador não vale)
  stairReach(f) {
    if (this._rs[f.id] !== undefined) return this._rs[f.id];
    const target = this.nodeAt(f.L, f.x + f.w / 2);
    let ok = false;
    if (target >= 0) for (const e of this.groundEntrances()) if (this.nodePath(e.key, target, 'stairs')) { ok = true; break; }
    return (this._rs[f.id] = ok);
  }
  // ---------- metrô, carros e entradas
  stations() { return this.facs.filter(f => f.k === 'transit' && this.serves(f)); }   // metrô em chamas, fechado ou sem energia não vale
  // lados da estação com túnel livre (sem outra sala encostada): o trem entra e sai por um deles; estações coladas não dividem trilho
  tunnelSides(f) {
    const free = u => { for (let lev = f.L; lev < f.L + f.h; lev++) if (this.grid.get(lev, u) || this.tg.get(lev, u)) return false; return true; };
    return {l: free(f.x - 1), r: free(f.x + f.w)};
  }
  // 1: o trem chega pela esquerda; -1: pela direita. Prefere o lado livre; com sala encostada o túnel segue por baixo dela (não está ligado a ela) e o trem sai da parede da estação (`trainClipped`)
  trainDir(f) { const s = this.tunnelSides(f); return s.l ? 1 : s.r ? -1 : 1; }
  trainClipped(f) { const s = this.tunnelSides(f); return !s.l && !s.r; }
  trainState(f) {
    const m = (this.t + f.id * 37) % TRAIN.cycle, a = TRAIN.arrive, o = a + TRAIN.open, l = o + TRAIN.leave;
    if (m < a) return {phase: 'arrive', p: m / a, next: 0};
    if (m < o) return {phase: 'open', p: 1, next: 0};
    if (m < l) return {phase: 'leave', p: (m - o) / TRAIN.leave, next: 0};
    return {phase: 'none', p: 0, next: TRAIN.cycle - m};
  }
  // vizinhos de veículo de uma peça (rampa, túnel, ponto, vaga) no andar L, x..x+w. Rampas, túneis descendentes e portais têm lado (dir 1: sobe/sai para a direita):
  // a ponta baixa da rampa continua no mesmo andar (lado oposto a dir) e a ponta alta encosta no andar de cima, na lateral de dir.
  // O portal só se liga pelo lado de dentro (oposto a dir): a saída para a rua fica do lado de dir, e só o que encosta no lado de dentro está ligado a ela
  // o elevador é algo na parede: quem passa pelo andar passa pela frente dele. Salta os poços (pessoas e carros) a partir da coluna u, indo para o lado `side`
  pastShafts(L, u, side) {
    for (let t = this.tg.get(L, u); t && t.cat === 'shaft'; t = this.tg.get(L, u)) u = side < 0 ? t.x - 1 : t.x + t.w;
    return u;
  }
  vehAdj(L, x, w, dir, slope, portal) {
    const out = [], isV = o => o && !o.dead && (FAC[o.k].veh || FAC[o.k].needRamp || FAC[o.k].park);
    const sided = o => (FAC[o.k].slope || FAC[o.k].portal);   // peças com lado
    for (const side of [-1, 1]) {
      if ((slope || portal) && side !== -dir) continue;
      const o = this.grid.get(L, this.pastShafts(L, side < 0 ? x - 1 : x + w, side));   // poços de elevador (de pessoas ou de carros) não bloqueiam: o carro passa pela frente
      if (isV(o) && o.L <= L && o.L + o.h > L && !(sided(o) && o.dir !== side)) out.push(o);
    }
    if (slope) {
      const o = this.grid.get(L + 1, dir === 1 ? x + w : x - 1);
      if (isV(o) && o.L === L + 1 && (dir === 1 ? o.x === x + w : o.x + o.w === x) && !(sided(o) && o.dir !== dir)) out.push(o);
    }
    const p = this.grid.get(L - 1, x - 1), q = this.grid.get(L - 1, x + w), lado = !slope && !portal;
    if (p && !p.dead && FAC[p.k].slope && p.dir === 1 && p.L === L - 1 && p.x + p.w === x && (lado || dir === 1)) out.push(p);
    if (q && !q.dead && FAC[q.k].slope && q.dir === -1 && q.L === L - 1 && q.x === x + w && (lado || dir === -1)) out.push(q);
    return out;
  }
  // idem para peças de mais de um andar: junta os vizinhos de cada nível
  vehAdjAll(f, dir, slope, portal) {
    const set = new Set();
    for (let lev = f.L; lev < f.L + f.h; lev++) for (const o of this.vehAdj(lev, f.x, f.w, dir, slope, portal)) set.add(o);
    return [...set];
  }
  // veículos no subsolo: do térreo desce uma rampa (andar -1); daí em diante rampas, túneis e pontos ligam-se pelas regras de `vehAdj`.
  // Devolve Map(peça ligada → rampa da rua de onde vem)
  // Melhor rota dos carros até a rua (Dijkstra, como a rota das pessoas): do ponto onde o carro está até uma saída (rampa do andar -1, túnel com portal ou elevador de carros que chega ao térreo).
  // O custo soma o trecho andado (por peça) e, a cada travessia de um elevador de carros, a viagem (base + andares) e a espera da fila dele; elevador parado (sem energia ou sem o andar) não serve.
  // Devolve Map(peça ou poço → saída da rua), e `_vl.lifts` guarda, para cada peça, os elevadores da melhor rota; `_vl.cost` o custo (minutos de jogo) dela.
  // Só a vaga passa a ligação a outra vaga; pontos (ônibus/táxi) são ponta de linha; só o elevador de carros faz ponte entre vagas de níveis/lados diferentes.
  vehLinked() {
    const key = this.ver + ':' + this.facs.length + ':' + this.shafts.length + ':' + Math.floor(this.t / 5);
    if (this._vl && this._vl.key === key) return this._vl.map;
    const ok = o => o.build >= 1 && !o.dead, park = o => !!FAC[o.k].park;
    const best = new Map(), heap = [];
    const up = i => { while (i > 0) { const p = (i - 1) >> 1; if (heap[p].d <= heap[i].d) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const down = i => { for (;;) { let m = i; for (const c of [2 * i + 1, 2 * i + 2]) if (c < heap.length && heap[c].d < heap[m].d) m = c; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } };
    const push = (k, obj, d, root, ls) => { const b = best.get(k); if (b && b.d <= d + 1e-9) return; best.set(k, {d, obj, root, ls}); heap.push({d, k}); up(heap.length - 1); };
    const pcost = o => 0.02 * (o.w / 4);   // andar um trecho de pista
    const cls = this.shafts.filter(s => s.carlift && !s.dark);
    const inK = (s, L) => 'i' + s.id + ':' + L, outK = (s, L) => 'o' + s.id + ':' + L;
    const stopNb = new Map(), facStops = new Map();   // vizinhos de cada parada do elevador e, ao contrário, as paradas em que cada peça encosta
    for (const s of cls) for (const L of this.stopsOf(s)) {
      const nb = this.vehAdj(L, s.x, s.w, 0, false, false).filter(o => ok(o));
      stopNb.set(s.id + ':' + L, nb);
      for (const o of nb) { let a = facStops.get(o); if (!a) facStops.set(o, a = []); a.push({s, L}); }
    }
    for (const f of this.facs) if (((FAC[f.k].slope && f.L === -1) || FAC[f.k].portal) && ok(f)) push(f, f, 0, f, []);   // saem na rua
    for (const s of cls) if (s.hi === 0 && !s.off[0]) push(inK(s, 0), {s, L: 0}, 0, s, []);   // chega ao térreo: tem a própria saída para a rua
    const rem = new Map();   // peça/poço → melhor estado final
    while (heap.length) {
      const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; down(0); }
      const b = best.get(top.k); if (!b || top.d > b.d + 1e-9) continue;
      const o = b.obj;
      if (o.s) {   // parada do elevador
        const {s, L} = o;
        if (top.k[0] === 'i') {   // carro entrou na cabine neste andar: atravessa para qualquer andar atendido (o mesmo inclusive: de um lado ao outro da fileira)
          const w = this.liftWaitMin(s);
          for (const L2 of this.stopsOf(s)) push(outK(s, L2), {s, L: L2}, b.d + 0.4 + Math.abs(L - L2) * 0.08 + w, b.root, b.ls.concat([s]));
          if (!rem.has(s) || rem.get(s).d > b.d) rem.set(s, {d: b.d, root: b.root, ls: b.ls});
        } else for (const n of stopNb.get(s.id + ':' + L) || []) if (park(n)) push(n, n, b.d + pcost(n), b.root, b.ls);   // sai da cabine para a vaga encostada
        continue;
      }
      if (!rem.has(o) || rem.get(o).d > b.d) rem.set(o, {d: b.d, root: b.root, ls: b.ls});
      for (const st of facStops.get(o) || []) push(inK(st.s, st.L), {s: st.s, L: st.L}, b.d, b.root, b.ls);
      if (FAC[o.k].needRamp) continue;   // o ponto é ponta de linha: não passa adiante
      for (const n of this.vehAdjAll(o, o.dir, !!FAC[o.k].slope, !!FAC[o.k].portal)) if (ok(n) && !(park(o) && !park(n))) push(n, n, b.d + pcost(n), b.root, b.ls);
    }
    const map = new Map(), lifts = new Map(), cost = new Map();
    for (const [k, v] of rem) { map.set(k, v.root); lifts.set(k, v.ls); cost.set(k, v.d); }
    this._vl = {key, map, lifts, cost};
    return map;
  }
  // ---------- lixo: depósitos (subsolo, ligados à rampa) e usinas de reciclagem guardam o lixo das unidades por perto; cheios transbordam, e um caminhão (R$) esvazia os depósitos
  deposits() { return this.facs.filter(f => FAC[f.k].waste && this.serves(f)); }
  trashOf(u) {   // lixo diário de uma unidade
    const d = FAC[u.k];
    if (d.tenant && u.occ) return u.persons.length * LIXO.perPerson;
    if (d.hotel && u.guests.length) return u.guests.length * LIXO.perPerson;
    if (d.commercial && !u.closed) return u.w * LIXO.perWidth;
    return 0;
  }
  // comércio que fecha e reabre: ver BIZ (movimento = gente circulando por perto; insegurança = ocorrências recentes)
  bizState(f) {
    const act = this.localPop(f, NEAR.visit.range), safe = this.insecurity(f), why = act < BIZ.minPop ? 'pouco movimento por perto' : safe < BIZ.minSafe ? 'insegurança na vizinhança' : null;
    return {act, safe, why};
  }
  bizDaily() {
    if (this.pop < BIZ.minPopDay || this.day < BIZ.minDay) return;
    for (const f of this.facs) {
      if (!FAC[f.k].biz || f.build < 1 || f.dead || f.fire) continue;
      const b = this.bizState(f);
      if (!f.closed) {
        f.idle = b.why ? (f.idle || 0) + 1 : Math.max(0, (f.idle || 0) - 1);
        if (f.idle >= BIZ.days) { f.closed = true; f.closeWhy = b.why; f.idle = 0; this.fireAll(f); this.msg('🏪 ' + FAC[f.k].label + ' do andar ' + floorLabel(f.L) + ' fechou: ' + b.why + '. O ponto ficou vago.', 'bad', f); }
      } else if (!b.why && Math.random() < BIZ.reopen * clamp(b.act / (BIZ.minPop * 3), 0.3, 1)) {
        f.closed = false; f.closeWhy = null; f.idle = 0; this.msg('🏪 Um novo comerciante abriu ' + FAC[f.k].label.toLowerCase() + ' no andar ' + floorLabel(f.L) + '.', 'good', f);
      }
    }
  }
  // o lixo entra a cada hora (1/24 do total diário), então o monte cresce de forma contínua
  trashHourly() {
    const deps = this.deposits(); if (!deps.length) return;
    for (const u of this.facs) {
      if (u.build < 1 || u.dead || FAC[u.k].waste) continue;
      const amt = this.trashOf(u) / 24; if (!amt) continue;
      let best = null, bd = 1e9;
      for (const d of this.nearFacs(u, LIXO.range)) if (FAC[d.k].waste && this.serves(d)) { const r = this.roomDist(u, d); if (r < LIXO.range && r < bd) { bd = r; best = d; } }
      if (best) best.lixo = Math.min(FAC[best.k].waste.cap, (best.lixo || 0) + amt);
    }
    for (const d of deps) {
      const w = FAC[d.k].waste;
      if (w.process) d.lixo = Math.max(0, (d.lixo || 0) - w.process / 24);   // a usina processa sozinha; no depósito, só o jogador chama o caminhão
    }
  }
  trashDaily() { for (let h = 0; h < 24; h++) this.trashHourly(); }   // um dia inteiro de uma vez (testes e ferramentas)
  // ação do jogador: chama o caminhão para esvaziar o depósito (devolve o erro, se houver)
  callGarbage(d) {
    const w = FAC[d.k].waste;
    if (!w || w.process) return 'Esta usina processa o lixo sozinha.';
    if (d.truckEta) return 'O caminhão já está a caminho.';
    if ((d.lixo || 0) <= 0) return 'O depósito está vazio.';
    if (this.funds < LIXO.cost) return 'Dinheiro insuficiente (' + fmtMoney(LIXO.cost) + ').';
    d.truckEta = this.t + LIXO.eta; this.spawnRide(d, true);
    this.msg('🗑️ Caminhão de lixo a caminho do depósito do andar ' + floorLabel(d.L) + '.', '', d);
    return null;
  }
  trashTick() {   // a cada hora: o caminhão que chegou esvazia o depósito
    for (const d of this.deposits()) if (d.truckEta && this.t >= d.truckEta) {
      d.truckEta = 0; d.lixo = 0; this.expense('lixo', LIXO.cost); this.spawnRide(d, false);
    }
  }
  // lixo acumulado por perto pesa nas unidades (local): o desconforto cresce do `annoy` até o depósito cheio, que transborda
  trashFactor(f) {
    let v = 0, full = false;
    for (const d of this.nearFacs(f, LIXO.range)) if (FAC[d.k].waste && this.serves(d)) {
      const lv = (d.lixo || 0) / FAC[d.k].waste.cap; if (lv < LIXO.annoy) continue;
      v += this.prox(f, d, LIXO.range) * (lv - LIXO.annoy) / (1 - LIXO.annoy); if (lv >= 1) full = true;
    }
    return v > 0 ? {label: full ? 'Lixo transbordando por perto' : 'Lixo acumulado por perto', v: -Math.min(LIXO.penalty * 1.5, LIXO.penalty * v), key: 'lixo'} : null;
  }
  // ---------- energia e água: capacidade (rede pública + fontes) contra consumo; quem passa da capacidade, por prioridade, fica sem serviço
  sun() { const hr = (this.t / 60) % 24; return hr < 6 || hr > 18 ? 0 : Math.sin((hr - 6) * Math.PI / 12); }
  pickWeather(day) { return pickW(WEATHER_KEYS, WEATHER_ODDS[Math.floor(day / SEASON_DAYS) % 4]); }
  utilUse(f, i) {
    const u = USE[f.k], def = FAC[f.k];
    if (!u || !u[i]) return 0;
    let a = u[i] * f.w * SEASONS[this.season][i ? 'agua' : 'energia'] * WEATHER[this.weather][i ? 'agua' : 'energia'];
    if ((def.tenant && !f.occ) || (def.hotel && !f.guests.length) || f.closed) a *= UTIL.vacant;
    return a;
  }
  // reservatórios (caixa d'água, bateria): enchem com a sobra e esvaziam no déficit; a caixa só funciona com uma bomba num andar abaixo
  storeFacs(res) { return this.facs.filter(f => { const s = (FAC[f.k].util || {}).store; return s && s.res === res && f.build >= 1 && !f.dead && this.access(f); }); }
  storeLvl(f) { return Math.max(0, Math.min(FAC[f.k].util.store.cap, f.lvl || 0)); }   // cada caixa/bateria guarda o seu próprio nível
  storeSpec(res) {
    let cap = 0, rate = 0;
    let level = 0;
    for (const f of this.storeFacs(res)) { const s = FAC[f.k].util.store; cap += s.cap; rate += s.rate; level += this.storeLvl(f); }
    return {cap, rate, level};
  }
  utilCap(res) { const sp = this.storeSpec(res); return this.utilFlow(res) + Math.min(sp.level, sp.rate); }   // produção agora + o que os reservatórios entregam por hora
  // fontes que produzem agora (rede pública presa aos saguões do térreo + fontes próprias): cada uma alcança só as salas a até `reach` unidades (roomDist)
  utilSources(res) {
    const out = [], down = this.outage[res] > this.t;   // em apagão/falta d'água a rede pública some e só valem as fontes próprias
    const lob = this.facs.filter(f => f.k === 'lobby' && f.L === 0 && f.build >= 1 && !f.dead).sort((a, b) => a.x - b.x), taps = [], tw = lob.reduce((a, f) => a + f.w, 0);
    for (const f of lob) { const t = taps[taps.length - 1]; if (t && t.x + t.w === f.x) t.w += f.w; else taps.push({k: 'lobby', L: 0, x: f.x, w: f.w, h: 1}); }   // saguões encostados formam uma só ligação com a rede
    if (!down && tw > 0) for (const f of taps) out.push({f, cap: UTIL.grid[res] * f.w / tw, reach: UTIL.reach.grid, kind: 0});
    for (const f of this.facs) {
      const u = FAC[f.k].util;
      if (!u || !u[res] || f.build < 1 || f.dead || !this.access(f)) continue;
      if (res === 'agua' && f.cutE) continue;   // bomba/estação sem energia não bombeia
      out.push({f, cap: u[res] * (u.solar ? this.sun() * SEASONS[this.season].sol * WEATHER[this.weather].sun : 1), reach: u.reach || UTIL.reach.own, kind: 1});
    }
    return out;
  }
  utilFlow(res) { let cap = 0; for (const s of this.utilSources(res)) cap += s.cap; return cap; }
  migrateStore() {
    for (const res of ['energia', 'agua']) {
      const stf = this.facs.filter(f => { const st = (FAC[f.k].util || {}).store; return st && st.res === res; }), cap = stf.reduce((a, f) => a + FAC[f.k].util.store.cap, 0);
      if (!stf.length || stf.some(f => f.lvl > 0) || !(this.store[res] > 0)) continue;
      for (const f of stf) f.lvl = Math.min(FAC[f.k].util.store.cap, this.store[res] * FAC[f.k].util.store.cap / cap);
    }
  }
  // uma vez por hora de jogo: cada reserva perde o que forneceu às salas e ganha o que sobrou das fontes ao alcance (bomba só enche caixa que está ACIMA dela; a bateria
  // também é carregada por outra bateria mais cheia por perto: uma alimenta a próxima). A sobra de cada fonte é repartida entre as reservas pela necessidade de cada uma.
  utilTick() {
    this.utilFresh();
    for (const res of ['energia', 'agua']) {
      const src = this._src[res], stores = this.storeFacs(res);
      for (const s of src) if (s.kind === 2) s.f.lvl = Math.max(0, this.storeLvl(s.f) - (s.cap - s.rem));   // descarga: o que as salas consumiram
      for (const f of stores) f._fill = FAC[f.k].util.store.fill || FAC[f.k].util.store.rate;
      const order = src.filter(s => s.rem > 0).sort((x, y) => x.kind - y.kind);   // rede e fontes próprias primeiro, depois as reservas doadoras
      const boosters = res === 'agua' ? this.facs.filter(f => FAC[f.k].util && FAC[f.k].util.lift && f.build >= 1 && !f.dead && !f.cutE && this.access(f) && !FAC[f.k].util.store).map(f => ({f, left: FAC[f.k].util.lift})) : [];   // bomba de recalque avulsa (a torre tem o recalque dela, abaixo)
      this._lift = new Map();
      for (const t of order) {
        const free = [], up = [];
        for (const f of stores) {
          const st = FAC[f.k].util.store, space = st.cap - this.storeLvl(f);
          if (f === t.f || space <= 0.01 || f._fill <= 0 || this.roomDist(t.f, f) > t.reach) continue;
          if (t.kind === 2 && this.storeLvl(t.f) / FAC[t.f.k].util.store.cap <= this.storeLvl(f) / st.cap) continue;   // reserva só doa para outra menos cheia
          const c = {f, need: Math.min(space, f._fill)};
          if (st.pump) {   // caixa d'água: a água desce de graça; sobe só por bomba de subsolo (ou tratamento) abaixo dela, ou por bomba de recalque
            if (t.kind === 1) { if (!(t.f.L < f.L && FAC[t.f.k].util.agua)) continue; free.push(c); }
            else if (t.kind === 2) (t.f.L >= f.L ? free : up).push(c);
            else continue;
          } else free.push(c);
        }
        const fx = list => { const total = list.reduce((a, c) => a + c.need, 0); if (!total) return 0; const give = Math.min(t.rem, total); for (const c of list) { const amt = give * c.need / total; c.f.lvl = this.storeLvl(c.f) + amt; c.f._fill -= amt; } t.rem -= give; if (t.kind === 2) t.f.lvl = Math.max(0, this.storeLvl(t.f) - give); return give; };
        fx(free);
        if (up.length) {   // para cima só com uma bomba de recalque ao lado da caixa de baixo, limitada à vazão dela
          const own = t.kind === 2 && FAC[t.f.k].util.lift && !t.f.cutE;   // torre com recalque embutido: manda a própria água para as caixas acima, até a vazão do recalque dela
          if (own) {
            const left = this._lift.has(t.f) ? this._lift.get(t.f) : FAC[t.f.k].util.lift, saved = t.rem;
            t.rem = Math.min(t.rem, left); const given = fx(up); t.rem = saved - given; this._lift.set(t.f, left - given);
            for (const c of up) c.need = Math.max(0, Math.min(FAC[c.f.k].util.store.cap - this.storeLvl(c.f), c.f._fill));
          }
          const bs = boosters.filter(b => b.left > 0 && this.roomDist(b.f, t.f) <= UTIL.liftReach);
          const cap = bs.reduce((a, b) => a + b.left, 0);
          if (cap > 0) { const saved = t.rem; t.rem = Math.min(t.rem, cap); const given = fx(up); t.rem = saved - given; let left = given; for (const b of bs) { const use = Math.min(b.left, left); b.left -= use; left -= use; } }
        }
      }
      this.store[res] = stores.reduce((a, f) => a + this.storeLvl(f), 0);
    }
    this._utk = null;
  }
  // energia e água são locais: cada fonte (rede pública do saguão, geradores, bombas, estação de tratamento, placa solar e as reservas) só alcança as salas
  // a até `reach` unidades. As salas são atendidas por prioridade pela fonte mais próxima com sobra; quem não alcança fonte ou não cabe fica sem (cutE/cutA, `cutWhyE/A`).
  utilCalc() {
    const out = {};
    for (const [res, i] of [['energia', 0], ['agua', 1]]) {
      const flag = res === 'energia' ? 'cutE' : 'cutA', why = res === 'energia' ? 'cutWhyE' : 'cutWhyA';
      const src = this.utilSources(res), stf = this.storeFacs(res), sp = this.storeSpec(res);
      this.store[res] = sp.level;
      for (const f of stf) src.push({f, cap: Math.min(this.storeLvl(f), FAC[f.k].util.store.rate), reach: FAC[f.k].util.reach || UTIL.reach.own, kind: 2, down: !!FAC[f.k].util.store.down});   // cada reserva entrega até a taxa dela, se tiver nível
      (this._src = this._src || {})[res] = src;
      for (const s of src) s.rem = s.cap;
      const needs = [];
      if (res === 'energia') for (const s of this.stairs) if (s.k === 'escalator') needs.push({sh: s, f: {L: s.L, x: s.x, w: s.w, h: 1}, a: UTIL.escalator, p: 9});   // escada rolante gasta energia (a escada comum não gasta nada)
      if (res === 'energia') for (const s of this.shafts) needs.push({sh: s, f: {L: Math.round((s.lo + s.hi) / 2), x: s.x, w: s.w, h: 1}, a: s.cars.length * UTIL.elevator, p: 9});
      for (const f of this.facs) {
        f[flag] = false; f[why] = null;
        if (f.build < 1 || f.dead || f.k === 'ruin') continue;
        const a = this.utilUse(f, i), d = FAC[f.k];
        if (a > 0) needs.push({f, a, p: UPRIO[f.k] ?? 2});
        else if (d.corr && ((res === 'energia' && d.corr === 'cam') || (res === 'agua' && (d.corr === 'spr' || d.corr === 'hyd')))) needs.push({f, a: 0, p: -1});   // só precisa ser alcançado quem usa o recurso: câmera (energia), sprinkler e hidrante (água); corredor comum e extintor não precisam de nada
      }
      needs.sort((x, y) => y.p - x.p || (x.f.id || 0) - (y.f.id || 0));
      let use = 0, cut = 0, rooms = 0, total = 0; for (const s of src) total += s.cap;
      for (const n of needs) {
        use += n.a; if (n.a > 0) rooms++;
        const cs = []; let tot = 0, inReach = false;   // fontes ao alcance com sobra: rede e fontes próprias antes das reservas, a mais próxima primeiro; uma sala pode somar duas fontes
        for (const s of src) {
          if (s.down && n.f.L > s.f.L + s.f.h - 1) continue;   // a água da caixa só desce: não abastece salas acima dela
          const d = this.roomDist(s.f, n.f); if (d > s.reach) continue;
          inReach = true;
          if (s.rem > 1e-9 && (n.a > 0 || s.cap > 0)) { cs.push({s, d}); tot += s.rem; }
        }
        if (cs.length && tot + 1e-9 >= n.a) {
          cs.sort((x, y) => x.s.kind - y.s.kind || x.d - y.d);
          let left = n.a; for (const c of cs) { const take = Math.min(left, c.s.rem); c.s.rem -= take; left -= take; if (left <= 1e-9) break; }
          if (n.sh) { n.sh.dark = false; n.sh.darkWhy = null; } continue;
        }
        if (n.sh) { n.sh.dark = true; n.sh.darkWhy = inReach ? 'cap' : 'reach'; cut++; continue; }   // 'reach': nenhuma fonte chega até ele; 'cap': as fontes ao alcance não dão conta
        n.f[flag] = true; n.f[why] = inReach ? 'cap' : 'reach'; if (n.a > 0) cut++;
      }
      out[res] = {cap: total, use, cut, rooms, out: this.outage[res] > this.t, store: sp.level, storeCap: sp.cap, reach: needs.filter(n => !n.sh && n.f[flag] && n.f[why] === 'reach').length};
      if (res === 'energia') this.elevOff = this.shafts.some(s => s.dark);
    }
    this.util = out;
    return out;
  }
  // sorteio horário: apagão e falta d'água (mais prováveis com a torre sobrecarregada)
  // histórico das últimas 72 horas para os gráficos de Estatísticas: consumo/capacidade (%), reservas (%), lixo do depósito mais cheio (%), maior fila de ponto (pessoas) e apagões
  recordHour() {
    const u = this.utilFresh(), pct = (a, b) => b > 0 ? Math.round(100 * a / b) : 0;
    let trash = 0, queue = 0;
    for (const d of this.deposits()) if (!FAC[d.k].waste.process) trash = Math.max(trash, pct(d.lixo || 0, FAC[d.k].waste.cap));
    for (const f of this.facs) if (f.k === 'busstop' || f.k === 'taxi') queue = Math.max(queue, Math.round(this.hailQueue(f)));
    this.uhist.push({t: Math.round(this.t), e: pct(u.energia.use, u.energia.cap), a: pct(u.agua.use, u.agua.cap), se: pct(u.energia.store, u.energia.storeCap), sa: pct(u.agua.store, u.agua.storeCap), l: trash, q: queue, oe: u.energia.out ? 1 : 0, oa: u.agua.out ? 1 : 0});
    if (this.uhist.length > 72) this.uhist.shift();
  }
  // carros presos (a vaga ficou sem ligação com a rua): quando a ligação volta, o dono já foi embora a pé e o carro sai sozinho (pela cabine, se for o caso)
  releaseStuck() {
    for (const f of this.facs) if (f.stuck) {
      if (f.dead || !f.owner) { f.stuck = false; continue; }
      if (!this.serves(f)) continue;
      const p = f.owner, lfs = this.liftsFor(f), lf = lfs.find(s => this.streetLift(s));
      f.stuck = false; f.owner = null;
      if (lfs.length) { f.holdCar = true; f.carT = this.simT; } else f.leaveT = this.simT;
      if (!lf) this.spawnGarageCar(false);
      this.liftTrip({stress: 0}, f, 'out', 0, lf || null);
    }
  }
  utilEvents() {
    this.releaseStuck();
    this.utilTick(); this.trashTick(); this.recordHour();
    if (WEATHER[this.weather].storm && !this.outage.energia && this.pop >= 150 && this.star >= OUTAGE.minStar && Math.random() < STORM.blackout) {   // raio na rede
      this.outage.energia = this.t + rnd(OUTAGE.minutes[0], OUTAGE.minutes[1]); this._utk = null; this.emit('sound', {name: 'thunder', L: 0, x: this.towerX()}); this.emit('sound', {name: 'apagao', L: 0, x: this.towerX()});
      const u3 = this.utilFresh(), c3 = u3.energia.cut === 0; this.msg('⛈️ Um raio atingiu a rede: apagão! ' + (c3 ? 'A bateria e as fontes próprias seguram a torre.' : 'Só as fontes próprias funcionam' + (this.elevOff ? ' e os elevadores pararam.' : '.')), c3 ? '' : 'bad');
    } if (this.star >= SVC_STAR.lixo) this.trashHourly();
    const u = this.utilFresh();
    if (Math.floor(this.minute / 60) === 18) { const w = WEATHER[this.forecast]; this.msg('📡 Previsão para amanhã: ' + w.icon + ' ' + w.name.toLowerCase() + (w.energia > 1 ? ' (energia ×' + w.energia + ')' : '') + (w.agua > 1 ? ' (água ×' + w.agua + ')' : '') + '.', w.energia > 1 || w.agua > 1 ? 'bad' : ''); }
    // previsão: meio-dia antes da virada da estação
    if (Math.floor(this.minute / 60) === 12 && (this.day + 1) % SEASON_DAYS === 0) {
      const nx = SEASONS[(this.season + 1) % 4], extra = nx.agua > 1 ? 'água ×' + nx.agua : nx.energia > 1 ? 'energia ×' + nx.energia : null;
      this.msg('📅 Amanhã começa o(a) ' + nx.name.toLowerCase() + (extra ? ': consumo de ' + extra + '. Confira a capacidade (⚡/💧 no topo).' : '.'), extra ? 'bad' : '');
    }
    for (const res of ['energia', 'agua']) {
      if (this.outage[res] && this.outage[res] <= this.t) { this.outage[res] = 0; this._utk = null; this.msg(res === 'energia' ? '💡 A energia voltou.' : '🚰 A água voltou.', 'good'); }
      if (this.outage[res] || this.pop < 150 || this.star < OUTAGE.minStar) continue;   // só depois de poder construir geradores, bombas e caixas
      if (Math.random() < OUTAGE.chance / 24 * (u[res].cut > 0 ? OUTAGE.overload : 1) * WEATHER[this.weather].outage) {
        this.outage[res] = this.t + rnd(OUTAGE.minutes[0], OUTAGE.minutes[1]); this._utk = null;
        const u2 = this.utilFresh(), r2 = u2[res], hrs = this.reserveHours(res), covers = r2.cut === 0, reserve = r2.storeCap > 0 && r2.store > 0
          ? (covers ? ' A reserva (' + Math.round(100 * r2.store / r2.storeCap) + '%) está cobrindo' + (isFinite(hrs) ? ' por cerca de ' + (hrs < 1 ? 'menos de 1 hora' : Math.round(hrs) + ' h') : '') + '.' : ' A reserva (' + Math.round(100 * r2.store / r2.storeCap) + '%) ajuda, mas entrega no máximo ' + Math.round(this.storeSpec(res).rate) + ' por hora e não cobre tudo: ' + r2.cut + ' sala(s) ficaram sem.') : '';
        this.msg(res === 'energia' ? '🔌 Apagão! Sem energia da rede: só as fontes próprias' + (r2.storeCap > 0 ? ' e a bateria' : '') + ' funcionam' + (this.elevOff ? ', os elevadores pararam e as câmeras falham.' : covers ? ', e a torre segue ligada.' : '.') + reserve
          : '🚱 Falta d\'água na rede!' + (covers ? ' A torre segue abastecida' + (reserve ? '' : ' pelas fontes próprias') + '.' : ' Só as fontes próprias servem a torre e sprinklers e hidrantes falham nas salas sem água.') + reserve, covers ? '' : 'bad');
      }
    }
    this.utilFresh();
  }
  // quanto tempo a reserva (caixa d'água ou bateria) segura a torre sem a rede: horas até esvaziar no consumo atual (Infinity se a produção própria já basta)
  reserveHours(res) {
    const u = this.utilFresh()[res], deficit = u.use - this.utilFlow(res);
    return deficit <= 0 ? Infinity : (u.store || 0) / deficit;
  }
  utilFresh() {
    const key = this.ver + ':' + this.facs.length + ':' + Math.floor(this.t / 60);
    if (this._utk !== key) { this._utk = key; this.utilCalc(); }
    return this.util;
  }
  stops(k) {
    const links = FAC[k] && FAC[k].needRamp ? this.vehLinked() : null;
    return this.facs.filter(f => f.k === k && f.build >= 1 && !f.dead && (f.L >= 0 || !links || links.has(f)) && this.serves(f));
  }
  // fila do ponto (ônibus/táxi): quem chega entra na fila; o ponto escoa `rate` pessoas por minuto de jogo. Devolve a espera em minutos de quem acabou de chegar
  hailQueue(f) {
    const dt = this.t - (f.rt ?? this.t);
    f.rush = Math.max(0, (f.rush || 0) - dt * HAIL[f.k].rate); f.rt = this.t;
    return f.rush;
  }
  hailJoin(f) { const q = this.hailQueue(f); f.rush = q + 1; return q / HAIL[f.k].rate; }
  // veículo do ponto: entra pela rua e para no ponto (no subsolo, some na rampa); ao sair, parte do ponto
  spawnRide(f, entering) {
    const ramp = f.L < 0 ? this.vehLinked().get(f) : null;
    if (f.L < 0 && !ramp && !FAC[f.k].waste) return;   // o depósito de lixo é atendido pela rua mesmo sem rampa
    const gx = ramp ? ramp.x + ramp.w / 2 : f.x + f.w / 2, dir = Math.random() < .5 ? 1 : -1;
    const v = {x: entering ? this.towerX() - dir * STREET : gx, dir, v: rnd(10, 16), kind: f.k, ride: true, col: f.k === 'taxi' ? 4 : 0};
    if (entering) { v.goal = gx; v.hide = !!ramp; v.wait = (HAIL[f.k] || {dwell: 3}).dwell; }
    this.cars.push(v);
    this.emit('sound', {name: f.k === 'busstop' ? 'onibus' : f.waste || FAC[f.k].waste ? 'caminhao' : 'carro', L: Math.min(0, f.L), x: v.goal !== undefined ? v.goal : gx});
  }
  // entrada de carros para a garagem: rampa de carros ou túnel com portal (que tem saída própria para a rua)
  // (e o elevador de carros que chega ao térreo, `streetLift`)
  streetLift(s) { return !!s.carlift && s.hi === 0 && !s.dark && !s.off[0]; }   // chega ao térreo e para nele (o térreo não foi desativado nos andares atendidos)
  hasRamp() { return this.facs.some(f => (f.k === 'parkramp' || FAC[f.k].portal) && f.build >= 1 && !f.dead) || this.shafts.some(s => this.streetLift(s)); }
  chooseEntry(destKey) {
    const r = Math.random(), rainy = this.rain > 0.3, tries = [];
    const openSt = this.stations().filter(f => this.trainState(f).phase === 'open');
    if (openSt.length && r < Math.min(0.8, (rainy ? 0.45 : 0.25) * 3)) {   // com as portas abertas, uma leva de gente chega de metro
      for (const f of openSt) {
        const x = f.x + f.w / 2 + (Math.random() - .5) * 10;
        tries.push({type: 'metro', L: f.L, x, key: this.nodeAt(f.L, x), fac: f});
      }
    } else if (r < 0.5 + HAIL.busstop.share * (this.stops('busstop').length ? 1 : 0) + HAIL.taxi.share * (this.stops('taxi').length ? 1 : 0) && r >= 0.5) {
      const k = r < 0.5 + HAIL.busstop.share * (this.stops('busstop').length ? 1 : 0) ? 'busstop' : 'taxi', sp = this.stops(k);
      for (let i = 0; i < 3 && sp.length; i++) {
        const s = sp.splice(Math.floor(Math.random() * sp.length), 1)[0], x = s.x + s.w / 2 + (Math.random() - .5) * 4;
        tries.push({type: k, L: s.L, x, key: this.nodeAt(s.L, x), fac: s});
      }
    } else if (r < 0.5 && this.hasRamp()) {
      const sp = this.facs.filter(f => f.k === 'parkspace' && !f.owner && this.serves(f) && this.liftsFor(f).every(s => this.liftWaitMin(s) < CARLIFT.giveUp));   // fila grande no elevador de carros: o motorista desiste da vaga
      for (let i = 0; i < 4 && sp.length; i++) {
        const s = sp.splice(Math.floor(Math.random() * sp.length), 1)[0];
        tries.push({type: 'car', L: s.L, x: s.x + 2, key: this.nodeAt(s.L, s.x + 2), space: s});
      }
    }
    for (const e of tries) if (e.key >= 0 && this.nodePath(e.key, destKey)) return e;
    const x = this.entrance();
    return x === null ? null : {type: 'ground', L: 0, x};
  }
  spawnGarageCar(entering, via = null) {   // via: o elevador de carros do térreo que vai receber/entregar o carro
    const lifts = this.shafts.filter(s => this.streetLift(s));
    let ramp = this.facs.find(f => (f.k === 'parkramp' || FAC[f.k].portal) && f.build >= 1 && !f.dead);
    if (lifts.length && (!ramp || Math.random() < lifts.length / (lifts.length + 1))) ramp = lifts[Math.floor(Math.random() * lifts.length)];   // o elevador de carros no térreo também é entrada
    if (via) ramp = via;
    if (!ramp) return null;
    const rx = ramp.x + ramp.w / 2, dir = Math.random() < .5 ? 1 : -1;
    const car = entering ? {x: rx - dir * 200, dir, v: rnd(14, 20), goal: rx, col: Math.floor(Math.random() * 6)} : {x: rx, dir, v: rnd(14, 20), col: Math.floor(Math.random() * 6)};
    this.cars.push(car);
    return car;
  }
  updSanta(h) {
    const s = this.santa;
    if (!s) return;
    s.x += 9 * h; s.y = Math.sin(s.x / 12) * 2;
    if (s.x > s.end) this.santa = null;
  }
  claimSanta() {
    const s = this.santa;
    if (!s || s.claimed) return false;
    s.claimed = true; this.income('vip', 100000);
    this.msg('🎁 O Papai Noel deixou um presente: ' + fmtMoney(100000) + '!', 'good');
    this.emit('sound', {name: 'star', L: 0, x: s.x});
    return true;
  }
  updCars(h) {
    const hr = (this.t / 60) % 24, day = clamp(Math.sin((hr - 6) * Math.PI / 12) * 1.6, 0.1, 1);
    if (this.cars.length < 26 && Math.random() < h * (0.15 + 0.6 * day + this.pop / 5000)) {
      const dir = Math.random() < .5 ? 1 : -1;
      this.cars.push({x: this.towerX() - dir * STREET, dir, v: rnd(12, 22), col: Math.floor(Math.random() * 6), traffic: true});
    }
    for (const c of this.cars) {
      if (c.parked) { c.wait -= h; if (c.wait <= 0) { c.parked = false; c.goal = undefined; } continue; }
      c.x += c.dir * c.v * h;
      if (c.ride && !c.hide && c.goal !== undefined && (c.x - c.goal) * c.dir >= 0) { c.x = c.goal; c.parked = true; }
    }
    const cx = this.towerX();
    this.cars = this.cars.filter(c => c.parked || (Math.abs(c.x - cx) < STREET + 20 && !(c.goal !== undefined && (c.x - c.goal) * c.dir >= 0)));
  }
  entrance(nearX, key) {
    const es = this.groundEntrances();
    if (!es.length) return null;
    if (nearX === undefined) return pick(es).x;
    let best = null, bd = 1e9;
    for (const e of es) {
      const d = Math.abs(e.x - nearX) + (key !== undefined && e.key !== key ? 1000 : 0);
      if (d < bd) { bd = d; best = e; }
    }
    return best.x;
  }
  connX(c, L) {
    if (c.cat === 'shaft') return c.x + c.w / 2;
    return L === c.L ? c.x + 1 : c.x + c.w - 1;
  }
  // espera estimada pela cabine mais próxima do andar L (distância ÷ velocidade + embarque em andamento), em custo de rota
  carWait(c, L) {
    if (c.cat !== 'shaft' || !c.cars.length) return 0;
    if (c.dark) return 1e4 * COST_PER_SEC;   // sem energia: ninguém espera por um elevador parado, vai de escada
    const v = TRANSPORT[c.k].vmax;
    let w = 1e9;
    for (const car of c.cars) w = Math.min(w, Math.abs(car.y - L) / v + Math.max(0, car.dwell));
    return w * COST_PER_SEC;
  }
  queueLen(c, L) { return c.cat === 'shaft' && c.q[L] ? c.q[L].reduce((a, p) => a + this.slots(p), 0) : 0; }
  // quem pedala (fixo por pessoa, sem sorteio nem campo salvo): trabalhadores e moradores de kitnet
  bikes(p) { return (p.kind === 'worker' || (p.home && p.home.k === 'kitnet')) && (p.id * 2654435761 >>> 0) % 1000 < BIKE.share * 1000; }
  // a bicicleta fica guardada se há bicicletário por perto do destino; senão sobe junto, no elevador
  bikeParked(p) {
    const h = p.home; if (!h) return false;
    if (!h._bk || h._bk.ver !== this.ver) h._bk = {ver: this.ver, v: this.serviceNear(h, 'bike') > 0};
    return h._bk.v;
  }
  // quantos ciclistas estão por perto agora (trabalhando ou em casa): o bicicletário enche e esvazia com eles
  bikeFill(f) {
    if (!this.serves(f)) { f._bf = {t: this.t, v: 0}; return 0; }   // bicicletário sem acesso, em obras ou fechado não guarda bicicleta
    if (f._bf && this.t - f._bf.t < 20) return f._bf.v;
    let n = 0;
    for (const o of this.nearFacs(f, DEMANDV.range)) if (o.persons && o.build >= 1 && !o.dead) for (const p of o.persons) if (p.st !== 'away' && this.bikes(p)) n++;
    const target = Math.min(1, n / BIKE.rack), prev = f._bf ? f._bf.v : target;
    const v = prev + Math.max(-1, Math.min(1, (target - prev) * BIKE.rack)) / BIKE.rack;   // no máximo uma bicicleta entra ou sai por vez (não pisca)
    f._bf = {t: this.t, v};
    return v;
  }
  slots(p) { return this.bikes(p) && !this.bikeParked(p) ? BIKE.slots : 1; }
  carLoad(c) { let n = 0; for (const p of c.pax) n += this.slots(p); return n; }

  // ------------------------------------------------------------ pessoas
  mkPerson(kind, home, o = {}) {
    const p = {id: this.nextId++, kind, home, st: 'away', L: 0, x: 0, step: null, dest: null, stress: kind === 'visitor' ? 0 : rnd(0, 10),
               plan: [], at: null, dead: false, transient: kind === 'visitor' || kind === 'guest', wait0: 0, look: Math.floor(Math.random() * 8), fy: 0, via: null,
               name: o.name || pick(FIRST_NAMES) + ' ' + (o.surname || pick(SURNAMES)), age: o.age || Math.round(rnd(20, 60)), prof: o.prof || '', nights: o.nights || 0};
    this.people.push(p);
    return p;
  }
  // coloca a pessoa dentro de uma sala (usado ao reconstruir o dia)
  placeIn(p, f) { p.st = 'idle'; p.at = f; p.L = f.L; p.x = f.x + 1 + Math.random() * Math.max(0, f.w - 2); p.dest = null; p.step = null; }
  initPlace(p, f, inside) { if (inside) this.placeIn(p, f); else { p.st = 'away'; p.at = null; } }
  // agenda do dia; em modo "retro" executa o que já deveria ter acontecido até agora
  setPlan(p, pl, retro) {
    pl.sort((a, b) => a.t - b.t);
    if (!retro) { p.plan = pl.filter(e => e.t >= this.t); return; }
    while (pl.length && pl[0].t <= this.t) {
      const e = pl.shift();
      if (e.act === 'go') this.placeIn(p, e.fac); else { p.st = 'away'; p.at = null; }
    }
    p.plan = pl;
  }
  // inquilinos: escritório com turno próprio; apartamento com uma família de verdade
  moveIn(f) {
    f.persons = [];
    const def = FAC[f.k];
    if (def.office) {
      f.shift = pickW(['day', 'early', 'late', 'night'], [5, 2, 2, 1]);
      const n = Math.max(2, def.pop - 2) + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) f.persons.push(this.mkPerson('worker', f, {prof: f.shift, age: Math.round(rnd(22, 60))}));
      f.jobCap = n; f.emp = [];
    } else {
      const pool = def.maxOcc ? HOUSEHOLDS.filter(h => h.m.length <= def.maxOcc) : HOUSEHOLDS;
      const tpl = pickW(pool, pool.map(h => h.w[f.price]));
      f.family = pick(SURNAMES);
      for (const prof of tpl.m) f.persons.push(this.mkPerson('resident', f, {prof, age: ageFor(prof), surname: f.family}));
    }
    f.newTenant = true;
  }
  // inquilinos insatisfeitos vão embora andando, não somem
  evict(f) {
    this.fireAll(f);
    for (const p of f.persons) {
      this.leaveJob(p);
      p.home = null; p.transient = true; p.prof = '';
      p.plan = p.st === 'away' ? [] : [{t: this.t, act: 'leave'}];
    }
    f.persons = [];
  }
  startTrip(p, f) {
    if (f.dead || f.build < 1) return;
    if (p.st === 'away') {
      const e = this.chooseEntry(this.nodeAt(f.L, f.x + f.w / 2));
      if (!e) return;
      p.via = e; p.L = e.L; p.x = e.x;
      if (e.type === 'car') { e.space.owner = p; e.space.carCol = p.id % 6; e.space.carT = this.simT; e.space.leaveT = undefined; e.space.holdCar = false; e.space.carWait = this.liftsFor(e.space).length > 0; this.income('parking', 40);   // com elevador de carros no caminho, o carro só aparece na vaga quando a cabine o entrega
         const lf = this.liftsFor(e.space).find(s => this.streetLift(s)), car = this.spawnGarageCar(true, lf || null); this.liftTrip(p, e.space, 'in', car && lf ? Math.abs(car.goal - car.x) / car.v : 0, lf || null); }   // carT/leaveT só alimentam a animação da vaga
      else if (e.type === 'metro') this.emit('sound', {name: 'step', L: e.L, x: e.x});
      else if (e.type === 'busstop' || e.type === 'taxi') {
        p.stress = Math.min(STRESS_MAX, p.stress + Math.min(HAIL.maxStress, this.hailJoin(e.fac) * HAIL.stress));
        this.spawnRide(e.fac, true);
      }
    }
    p.dest = {L: f.L, x: f.x + 1 + Math.random() * Math.max(0, f.w - 2), fac: f};
    p.at = null;
    this.advance(p);
  }
  startExit(p) {
    if (p.st === 'away') return;
    const v = p.via;
    if (v && v.type === 'metro' && !v.fac.dead) p.dest = {L: v.L, x: v.x, exit: true};
    else if (v && (v.type === 'busstop' || v.type === 'taxi') && !v.fac.dead) p.dest = {L: v.L, x: v.x, exit: true};
    else if (v && v.type === 'car' && !v.space.dead && v.space.owner === p && this.serves(v.space)) p.dest = {L: v.L, x: v.x, exit: true};
    else {
      if (v && v.type === 'car' && !v.space.dead && v.space.owner === p) { v.space.stuck = true; p.via = null; }   // a vaga perdeu a ligação (ex.: elevador de carros sem energia): o carro fica preso e a pessoa sai a pé
      const e = this.entrance(p.x, p.L === 0 ? this.nodeAt(0, p.x) : undefined);
      if (e === null) { p.st = 'away'; return; }
      p.dest = {L: 0, x: e, exit: true};
    }
    p.at = null;
    this.advance(p);
  }
  failTrip(p) {
    const wasAway = p.st === 'away';
    p.extinguish = null;
    p.stress = Math.min(STRESS_MAX, p.stress + 40);
    p.dest = null; p.step = null;
    p.st = wasAway || p.transient ? 'away' : 'idle';
  }
  advance(p) {
    const d = p.dest;
    if (!d) { p.st = 'idle'; return; }
    const a = this.nodeAt(p.L, p.x), b = this.nodeAt(d.L, d.x);
    if (a < 0 || b < 0) return this.failTrip(p);
    if (a === b) { p.step = {k: 'walk', x: d.x, then: 'done'}; p.st = 'walk'; return; }
    const best = this.route(a, b, p.x, d.x, this.staffMode(p));
    if (!best) return this.failTrip(p);
    p.step = {k: 'walk', x: this.connX(best.conn, p.L), then: 'use', conn: best.conn, to: this.nodeLevel(best.to)};
    p.st = 'walk';
  }
  arrive(p) {
    const d = p.dest;
    p.dest = null; p.step = null;
    if (d && d.exit) {
      if (p.via && p.via.type === 'car' && p.via.space.owner === p && !this.serves(p.via.space)) { p.via.space.stuck = true; p.via = null; p.st = 'idle'; this.startExit(p); return; }   // chegou ao carro e a saída foi cortada: ele fica preso e a pessoa volta a pé
      p.st = 'away';
      if (p.via && p.via.type === 'car' && p.via.space.owner === p) { p.via.space.owner = null; const lfs = this.liftsFor(p.via.space); if (lfs.length) { p.via.space.holdCar = true; p.via.space.carT = this.simT; } else p.via.space.leaveT = this.simT;   // com elevador, o carro fica na vaga até a cabine pegá-lo
        const lf = lfs.find(s => this.streetLift(s)); if (!lf) this.spawnGarageCar(false); this.liftTrip(p, p.via.space, 'out', 0, lf || null); }   // com elevador no térreo, o carro só aparece na rua quando a cabine o entrega
      else if (p.via && (p.via.type === 'busstop' || p.via.type === 'taxi') && !p.via.fac.dead) { this.hailJoin(p.via.fac); this.spawnRide(p.via.fac, false); }
      p.via = null;
      return;
    }
    p.st = 'idle';
    if (!d) return;
    const f = d.fac;
    p.at = f;
    if (!f || f.dead) return;
    if (p.extinguish && p.extinguish.c === f) { this.useExtinguisher(p); return; }
    if ((p.kind === 'staff' || p.kind === 'firefighter') && p.task === f) { this.beginWork(p, f); return; }
    const def = FAC[f.k];
    if (p.kind === 'vip' && f === p.home) { this.judgeVip(p, f); return; }
    if (def.commercial && (p.kind === 'visitor' || f !== p.home) && p.job !== f) {
      if (def.perCustomer) this.income(f.k, def.perCustomer);
    } else if (f.k === 'cinema' && p.kind === 'visitor') {
      this.income('cinema', 350 * (FILM_DRAW[FILMS[f.film].kind]));
    } else if (f.k === 'cinema' && f !== p.home && p.job !== f) {
      this.income('cinema', 350 * (FILM_DRAW[FILMS[f.film].kind]));
    } else if (f.k === 'party' && p.kind === 'visitor') {
      this.income('party', 600);
    } else if (f.k === 'auditorio' && p.kind === 'visitor') {
      this.income('auditorio', 700);
    } else if (f.k === 'landmark' && p.kind === 'visitor') {
      this.income('landmark', 3000);
    } else if (def.hotel && p.kind === 'guest' && !p.paid) {
      p.paid = true;
      if (f.guests[0] === p) this.income(f.k, def.prices[f.price] * (p.nights || 1));
    }
  }
  income(cat, amt) { this.funds += amt; const c = this.fin.cur.inc; c[cat] = (c[cat] || 0) + amt; }
  expense(cat, amt) { this.funds -= amt; const c = this.fin.cur.mnt; c[cat] = (c[cat] || 0) + amt; }

  updPerson(p, h) {
    if (p.panic && this.t > p.panicT) p.panic = false;
    if (p.st === 'work') {
      const f = p.task;
      if (!f || f.dead) { p.task = null; p.st = 'idle'; if (p.kind === 'firefighter') this.startExit(p); else if (p.home && !p.home.dead) this.startTrip(p, p.home); return; }
      p.work -= h;
      if (p.work <= 0) this.finishWork(p, f);
      return;
    }
    if (p.st === 'idle' || p.st === 'away') {
      if (p.at && p.at.dead) p.at = null;
      if (p.plan.length && p.plan[0].t <= this.t) {
        const e = p.plan.shift();
        if (e.act === 'go') this.startTrip(p, e.fac);
        else if (e.act === 'leave') this.startExit(p);
      } else if (p.transient && !p.plan.length && (p.st === 'away' || !p.at)) p.dead = true;
      return;
    }
    if (p.st === 'walk') {
      const s = p.step;
      if (!s) { p.st = 'idle'; return; }
      const dx = s.x - p.x, m = WALK_SPEED * h * (0.85 + (p.id % 5) * 0.08) * (p.kind === 'firefighter' ? TRUCK.speed : 1) * (p.panic ? 1.7 : 1);
      if (Math.abs(dx) <= m) {
        p.x = s.x;
        if (s.then === 'done') this.arrive(p);
        else if (s.conn.dead) this.advance(p);
        else if (s.conn.cat === 'shaft') {
          const st = this.stopsOf(s.conn);
          if (!st.includes(p.L) || !st.includes(s.to)) return this.advance(p);
          (s.conn.q[p.L] || (s.conn.q[p.L] = [])).push(p);
          p.st = 'wait'; p.wait0 = this.simT; p.step = {k: 'lift', conn: s.conn, to: s.to};
        } else {
          p.st = 'stair';
          p.stair = {conn: s.conn, from: p.L, to: s.to, prog: 0, dur: p.kind === 'firefighter' ? 5 / TRUCK.speed : s.conn.k === 'stairs' ? 5 : 2.5};
          p.step = null;
        }
      } else p.x += Math.sign(dx) * m;
    } else if (p.st === 'stair') {
      const a = p.stair;
      a.prog += h / a.dur;
      const x0 = this.connX(a.conn, a.from), x1 = this.connX(a.conn, a.to);
      p.x = x0 + (x1 - x0) * Math.min(1, a.prog);
      p.fy = a.from + (a.to - a.from) * Math.min(1, a.prog);
      if (a.prog >= 1) {
        p.L = a.to; p.x = x1; p.stair = null;
        if (a.conn.k === 'stairs') p.stress = Math.min(STRESS_MAX, p.stress + 6);
        this.advance(p);
      }
    } else if (p.st === 'wait') {
      if (this.simT - p.wait0 > 90) {
        const s = p.step;
        if (s && s.conn.q[p.L]) s.conn.q[p.L] = s.conn.q[p.L].filter(x => x !== p);
        this.failTrip(p);
      }
    }
  }

  // ------------------------------------------------------------ cabines
  chooseDir(s, c, f) {
    const tg = [];
    for (const p of c.pax) tg.push(p.step.to);
    for (const k in s.q) if (s.q[k].length) tg.push(+k);
    if (!tg.length) { c.dir = 0; return; }
    if (c.dir !== 0 && tg.some(t => (t - f) * c.dir > 0)) return;
    let near = tg[0];
    for (const t of tg) if (Math.abs(t - f) < Math.abs(near - f)) near = t;
    if (near === f) {
      const q = s.q[f];
      c.dir = q && q.length ? (Math.sign(q[0].step.to - f) || 1) : 0;
    } else c.dir = Math.sign(near - f);
  }
  stopAt(s, c, f) {
    const cap = TRANSPORT[s.k].cap;
    let acted = false;
    for (let i = c.pax.length - 1; i >= 0; i--) {
      const p = c.pax[i];
      if (p.step.to === f) {
        c.pax.splice(i, 1);
        p.L = f; p.x = s.x + s.w / 2;
        const ride = this.simT - p.board0;
        p.stress = Math.min(STRESS_MAX, p.stress + Math.max(0, ride - 8) * 1.2);
        this.advance(p); acted = true;
      }
    }
    if (acted) this.emit('sound', {name: 'ding', L: f, x: s.x + s.w / 2});
    this.chooseDir(s, c, f);
    const q = s.q[f];
    if (q && q.length) {
      let load = this.carLoad(c);
      for (let i = 0; i < q.length && load < cap;) {
        const p = q[i], d = Math.sign(p.step.to - f), sl = this.slots(p);
        if ((c.dir === 0 || d === c.dir) && (load === 0 || load + sl <= cap)) {
          load += sl;
          q.splice(i, 1);
          const w = this.simT - p.wait0;
          p.stress = Math.min(STRESS_MAX, p.stress + w * 1.7);
          p.st = 'ride'; p.board0 = this.simT; c.pax.push(p);
          if (c.dir === 0) c.dir = d;
          acted = true;
        } else i++;
      }
    }
    return acted;
  }
  updCar(s, c, h) {
    if (c.dwell > 0) { c.dwell -= h; return; }
    const t = TRANSPORT[s.k];
    // posição sempre dentro do poço (evita deriva de ponto flutuante)
    c.y = clamp(c.y, s.lo, s.hi);
    if (c.dir === 0) {
      const f = Math.round(c.y); c.y = f;
      if (this.stopAt(s, c, f)) { c.dwell = t.board; return; }
      this.chooseDir(s, c, f);
      if (c.dir === 0) return;
    }
    // nunca sair do poço: nos limites, só vale a direção para dentro
    if ((c.dir > 0 && c.y >= s.hi - 1e-6) || (c.dir < 0 && c.y <= s.lo + 1e-6)) { c.y = clamp(Math.round(c.y), s.lo, s.hi); c.dir = 0; return; }
    const yr = Math.round(c.y), atInt = Math.abs(c.y - yr) < 1e-6;
    if (atInt) c.y = yr;
    // próximo andar inteiro na direção do movimento
    const g = clamp(c.dir > 0 ? (atInt ? yr + 1 : Math.ceil(c.y)) : (atInt ? yr - 1 : Math.floor(c.y)), s.lo, s.hi);
    const ny = c.y + t.vmax * h * c.dir;
    if ((g - ny) * c.dir <= 1e-9) {
      c.y = g;
      if (this.stopAt(s, c, g)) c.dwell = t.board;
      if ((c.dir > 0 && g >= s.hi) || (c.dir < 0 && g <= s.lo)) c.dir = 0;
    } else c.y = ny;
  }

  // ------------------------------------------------------------ dia a dia
  // ---------- equipes: camareiras e seguranças
  freeStaff(role) {
    return this.people.filter(p => !p.dead && p.kind === 'staff' && p.home && !p.home.dead && p.home.k === role && p.st === 'idle' && !p.task);
  }
  // quem pode usar o quê: bombeiro só escada, camareira só elevador de serviço, segurança qualquer escada ou elevador (inclusive o de serviço), os demais (false) só os comuns
  staffMode(p) { return p.kind === 'firefighter' ? 'stairs' : p.kind === 'staff' ? (p.home && p.home.k === 'housekeeping' ? 'maid' : true) : false; }
  assignTask(p, f) {
    p.task = f;
    this.startTrip(p, f);
    if (!p.dest) { p.task = null; return false; }
    return true;
  }
  dispatch() {
    const live = (o, key) => o[key] && !o[key].dead && o[key].task === o;
    let guards = this.freeStaff('security');
    for (const f of this.facs) {
      if (!guards.length) break;
      if (!(f.fire || f.bomb || f.fight) || live(f, 'responder')) continue;
      const near = guards.filter(p => p.home && this.secCovers(p.home, f)).sort((a, b) => Math.abs(a.L - f.L) - Math.abs(b.L - f.L));
      for (const p of near) if (this.assignTask(p, f)) { f.responder = p; guards.splice(guards.indexOf(p), 1); break; }
    }
    const maids = this.freeStaff('housekeeping');
    for (const f of this.facs) {
      if (!maids.length) break;
      if (!(f.dirty || f.bugs) || f.build < 1 || live(f, 'cleaner')) continue;
      maids.sort((a, b) => Math.abs(a.L - f.L) - Math.abs(b.L - f.L));
      for (let i = 0; i < maids.length; i++) { const p = maids[i]; if (this.assignTask(p, f)) { f.cleaner = p; maids.splice(i, 1); break; } }
    }
  }
  beginWork(p, f) {
    p.st = 'work';
    p.work = p.kind === 'firefighter' ? TRUCK.fightSec : f.bomb ? 6 : f.fight ? 6 : f.fire ? 10 : f.bugs ? 7 : 5;
    if (f.fire) f.fighting = true;
    f.working = true;
  }
  finishWork(p, f) {
    f.working = false; f.fighting = false;
    if (p.kind === 'firefighter') {
      if (f.fire) {
        f.fire = 0; f.spread = false; f.heliCalled = false;
        this.expense('brigade', TRUCK.cost);
        this.msg('🚒 Os bombeiros apagaram o incêndio no andar ' + floorLabel(f.L) + '. Custo: ' + fmtMoney(TRUCK.cost) + '.', 'good', f);
      }
      p.task = null; p.st = 'idle'; p.at = f; this.startExit(p);
      return;
    }
    if (f.fire) { f.fire = 0; f.spread = false; f.heliCalled = false; this.msg('🧯 A segurança apagou o incêndio no andar ' + floorLabel(f.L) + '.', 'good', f); f.responder = null; }
    else if (f.fight) { f.fight = null; f.responder = null; this.msg('🛡 A segurança apartou a briga no andar ' + floorLabel(f.L) + '.', 'good', f); }
    else if (f.bomb) { f.bomb = null; f.responder = null; this.msg('🛡 A segurança desarmou a bomba no andar ' + floorLabel(f.L) + '.', 'good', f); }
    else if (f.bugs) {
      f.bugs--;
      if (f.bugs > 0) { p.work = 7; f.working = true; return; }
      f.dirty = false; f.cleaner = null;
    } else { f.dirty = false; f.cleaner = null; }
    p.task = null; p.st = 'idle'; p.at = f;
    if (p.home && !p.home.dead) this.startTrip(p, p.home);
  }
  staffPlan(f, p, i, base, all) {
    // seguranças trabalham em dois turnos (6h–18h e 18h–6h); camareiras no horário comercial
    const fin = pl => (all ? pl : pl.filter(e => e.t >= this.t)).sort((a, b) => a.t - b.t);
    if (f.k === 'security' && i % 2 === 1) {
      const pl = [{t: base + rnd(17.5, 18.5) * 60, act: 'go', fac: f}];
      if (all || p.st !== 'away') pl.unshift({t: base + rnd(5.5, 6.5) * 60, act: 'leave'});
      return fin(pl);
    }
    const a = f.k === 'security' ? [5.5, 6.5] : [7.5, 9], b = f.k === 'security' ? [17.5, 18.5] : [17, 18.5];
    const pl = [{t: base + rnd(a[0], a[1]) * 60, act: 'go', fac: f}, {t: base + rnd(b[0], b[1]) * 60, act: 'leave'}];
    // pausa para o almoço (só no planejamento diário)
    if (all && this._lunch && this._lunch.length && Math.random() < 0.45) {
      const v = this.venueFor(this._lunch, rnd(12, 13.3) * 60, rnd(30, 45));
      if (v) pl.push({t: base + v.t, act: 'go', fac: v.f}, {t: base + v.t + v.stay, act: 'go', fac: f});
    }
    return fin(pl);
  }
  // ---- emprego de moradores dentro do prédio
  // vagas: escritórios (tiradas dos funcionários de fora), lanchonete, restaurante e boutique (jobs)
  jobCap(f) { const d = FAC[f.k]; return d.office ? (f.jobCap ?? f.persons.length + f.emp.length) : (d.jobs || 0); }
  vacancies(f) {
    const d = FAC[f.k];
    if (!(d.office || d.jobs) || f.build < 1 || f.dead || f.fire || f.closed || (d.tenant && !f.occ)) return 0;
    const v = this.jobCap(f) - f.emp.length;
    return d.office ? Math.min(v, f.persons.length) : v;
  }
  // emprego em vigor (null se o local fechou, está em obras ou queimou)
  jobOf(p) { const f = p.job; return f && !f.dead && !f.closed && f.build >= 1 && !(FAC[f.k].tenant && !f.occ) ? f : null; }
  // o turno da vaga combina com o perfil do morador? (jobShift: 'day' por padrão, 'night' ou 'both')
  jobFits(f, night) {
    const d = FAC[f.k], k = d.office ? (f.shift === 'night' ? 'night' : 'day') : (d.jobShift || 'day');
    return k === 'both' || (k === 'night') === night;
  }
  // escolhe um emprego para o morador adulto: no prédio (se houver vaga, com preferência por andares próximos) ou fora
  findJob(p) {
    if (p.prof !== 'day' && p.prof !== 'night') return;
    const home = p.home;
    if (!home || home.dead) return;
    const night = p.prof === 'night', cands = [], ws = [];
    if (this.reachable(home)) for (const f of this.facs) {
      const d = FAC[f.k];
      if (!(d.office || d.jobs) || !this.jobFits(f, night)) continue;
      const v = this.vacancies(f);
      if (v <= 0 || !this.reachable(f)) continue;
      cands.push(f); ws.push(v / (1 + Math.abs(f.L - home.L) / 3));
    }
    if (cands.length && Math.random() < INHOUSE_JOB_CHANCE) this.employ(p, pickW(cands, ws));
    else p.job = null;
  }
  employ(p, f) {
    p.job = f; f.emp.push(p);
    if (FAC[f.k].office) {      // a vaga deixa de ser de um funcionário de fora
      let i = f.persons.findIndex(q => q.st === 'away');
      if (i < 0) i = f.persons.length - 1;
      const [q] = f.persons.splice(i, 1);
      if (q) q.dead = true;
    }
  }
  // o morador deixa o emprego do prédio (num escritório, a vaga volta para um funcionário de fora)
  leaveJob(p) {
    const f = p.job;
    if (!f) return;
    p.job = undefined;
    const i = f.emp.indexOf(p);
    if (i < 0) return;
    f.emp.splice(i, 1);
    if (!f.dead && FAC[f.k].office && f.occ && f.persons.length + f.emp.length < this.jobCap(f))
      f.persons.push(this.mkPerson('worker', f, {prof: f.shift, age: Math.round(rnd(22, 60))}));
  }
  // demitido: perde a agenda do dia que ia ao antigo local, volta para casa e procura outro emprego (no prédio ou fora)
  fire(p) {
    const f = p.job;
    if (!f) return;
    this.leaveJob(p);
    p.plan = p.plan.filter(e => e.fac !== f);
    if (p.home && !p.home.dead) {
      if (p.at === f || (p.dest && p.dest.fac === f)) p.plan.unshift({t: this.t, act: 'go', fac: p.home});
      this.findJob(p);
    }
  }
  fireAll(f) {
    const es = f.emp.slice();
    if (!es.length) return;
    f.emp = [];
    for (const p of es) this.fire(p);
    this.msg('💼 ' + es.length + (es.length > 1 ? ' moradores perderam' : ' morador perdeu') + ' o emprego no ' + FAC[f.k].label.toLowerCase() + ' do andar ' + floorLabel(f.L) + '.', 'bad', f);
  }
  // turno do morador numa loja ou lanchonete: único, ou manhã/tarde se o local abre por muito tempo
  shopShift(f, p) {
    const d = FAC[f.k], [o, c] = d.workHours || [d.open[0] - 30, d.open[1] + 20], i = Math.max(0, f.emp.indexOf(p));
    if (c - o <= 8 * 60 || f.emp.length < 2) return [o, c];
    const mid = (o + c) / 2;
    return i % 2 === 0 ? [o, mid + 15] : [mid - 15, c];
  }
  tenants() { return this.facs.filter(f => FAC[f.k].tenant && f.build >= 1 && f.k !== 'shop'); }
  // índices por versão do mapa: salas por andar (cada sala em todos os andares que ocupa), corredores e postos de segurança
  _index() {
    if (this._ix && this._ix.v === this.ver) return this._ix;
    const rows = new Map(), corr = [], posts = [];
    for (const f of this.facs) {
      for (let L = f.L; L < f.L + f.h; L++) { let r = rows.get(L); if (!r) rows.set(L, r = []); r.push(f); }
      if (FAC[f.k].corr) corr.push(f);
      if (f.k === 'security') posts.push(f);
    }
    return (this._ix = {v: this.ver, rows, corr, posts});
  }
  // salas que podem estar a menos de R unidades de f (só olha os andares dentro do alcance vertical); quem decide o peso é prox()
  nearFacs(f, R) {
    const ix = this._index(), span = Math.ceil(R / PROX.floorUnits), out = [], seen = new Set();
    for (let L = f.L - span; L < f.L + f.h + span; L++) {
      const r = ix.rows.get(L);
      if (r) for (const o of r) if (!seen.has(o)) { seen.add(o); out.push(o); }
    }
    return out;
  }
  // distância entre duas salas (ou uma sala e uma ocorrência) em unidades: folga horizontal + andares inteiros entre elas × PROX.floorUnits
  roomDist(a, b) {
    const gx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
    const gl = Math.max(0, Math.max(a.L, b.L) - Math.min(a.L + a.h, b.L + b.h));
    return gx + gl * PROX.floorUnits;
  }
  // peso do efeito de b sobre a: 1 colado, 0 no alcance R
  prox(a, b, R) { return Math.max(0, 1 - this.roomDist(a, b) / R); }
  // barulho que chega à unidade f: cada fonte barulhenta pesa 1 colada e cai até 0 no alcance (maior para as muito barulhentas)
  noiseOf(f) {
    let n = 0;
    for (const o of this.nearFacs(f, NOISE.loudRange)) {
      if (o === f || o.build < 1 || !FAC[o.k].noisy || !this.serves(o)) continue;   // sala parada (fechada, sem acesso, queimada, sem energia) não faz barulho; vale também para gerador e bombas
      n += this.prox(f, o, NOISE.loud.includes(o.k) ? NOISE.loudRange : NOISE.range);
    }
    return n;
  }
  // gente que circula perto de f: pessoas de cada sala ocupada, ponderadas pela distância
  localPop(f, R) {
    let n = 0;
    for (const o of this.nearFacs(f, R)) {
      if (!this.serves(o)) continue;   // quem está numa sala parada (sem acesso, em obras, fechada, com fogo ou sem energia) não circula
      const c = FAC[o.k], p = c.hotel ? o.guests.filter(q => q.paid).length : (o.occ && c.pop) || c.staff ? o.persons.length : 0;
      if (p) n += p * this.prox(f, o, R);
    }
    return n;
  }
  // humor da vizinhança de f: média das notas das unidades ocupadas por perto (sem ela mesma), ponderada pela distância; 150 se não há vizinhos
  localMood(f) {
    let s = 0, w = 0;
    for (const o of this.nearFacs(f, NEAR.mood.range)) {
      if (o === f || o.build < 1 || o.dead) continue;
      const c = FAC[o.k];
      if (!((c.tenant && o.occ) || (c.hotel && o.guests.length))) continue;
      const p = this.prox(f, o, NEAR.mood.range);
      s += o.eval * p; w += p;
    }
    return w > 0 ? s / w : 150;
  }
  // ocorrências recentes (furto, briga com feridos, explosão): guardam o lugar e pesam pela distância até sumirem
  addIncident(kind, f) { this.incidents.push({k: kind, x: f.x, w: f.w, L: f.L, h: f.h, t: this.t}); }
  // quanto as ocorrências recentes pesam sobre a unidade f, por tipo (valores negativos): a unidade atingida sente tudo, as vizinhas uma fração que cai com a distância
  incidentEffect(f) {
    const out = {theft: 0, fight: 0, bomb: 0};
    for (const i of this.incidents) {
      const sp = INCIDENT[i.k], age = (this.t - i.t) / 1440;
      if (age >= sp.days) continue;
      const reach = sp.range / PROX.floorUnits;   // descarta de cara o que está longe demais na vertical (a torre pode ter centenas de andares)
      if (i.L - (f.L + f.h) >= reach || f.L - (i.L + i.h) >= reach) continue;
      const w = i.x === f.x && i.L === f.L ? 1 : PROX.neighbor * Math.max(0, 1 - this.roomDist(f, i) / sp.range);
      out[i.k] -= sp.mag * w * (1 - age / sp.days);
    }
    for (const k in out) out[k] = Math.max(out[k], -INCIDENT[k].mag * 1.5);
    const tot = out.theft + out.fight + out.bomb;   // teto geral: as ocorrências somadas nunca passam de INCIDENT.cap
    if (tot < -INCIDENT.cap) { const r = -INCIDENT.cap / tot; for (const k in out) out[k] *= r; }
    return out;
  }
  // multiplicador (0,4 a 1) de visitantes de um local por causa das ocorrências recentes por perto
  insecurity(f) { const e = this.incidentEffect(f); return clamp(1 + (e.theft + e.fight + e.bomb) / 200, 0.4, 1); }
  // chance de o morador de uma unidade ter carro (0 a 1): sobe com a faixa de preço (0 Premium … 3 Promoção) e com o tipo
  carShare(f) { return clamp(RIDE.carBase + RIDE.carWealth * (3 - f.price) / 3 + (RIDE.typeBonus[f.k] || 0), 0, 1); }
  // vagas para quem tem carro: razão entre as vagas e os carros dos moradores (0 se não há rampa); em cache por hora
  parkSupply() {
    if (!this.hasRamp()) return 0;
    const key = this.ver + ':' + Math.floor(this.t / 60) + ':' + this.facs.length;
    if (!this._pk || this._pk.key !== key) this._pk = {key, demand: this.facs.reduce((a, o) => a + (FAC[o.k].condo && o.occ && o.build >= 1 ? this.carShare(o) : 0), 0), spaces: this.countOk('parkspace')};
    return Math.min(1, this._pk.spaces / Math.max(1, this._pk.demand));
  }
  // comércio/lazer por andar: máscara de tipos presentes (recalculada a cada hora de jogo)
  amenityKinds(f) {   // quantos tipos de comércio e lazer funcionam por perto (agora local: até AMENITY_RANGE de roomDist, ~4 andares e 32 unidades de folga)
    let mask = 0;
    for (const o of this.nearFacs(f, AMENITY_RANGE)) { const bit = AMENITY_BIT[o.k]; if (bit && this.roomDist(f, o) <= AMENITY_RANGE && this.serves(o)) mask |= bit; }
    let n = 0; for (; mask; mask &= mask - 1) n++;
    return n;
  }
  // contagem em cache (por hora de jogo e nº de instalações): evalBreakdown roda para todas as unidades
  countC(k) {
    const key = Math.floor(this.t / 60) + ':' + this.facs.length;
    if (!this._cc || this._cc.key !== key) this._cc = {key};
    return this._cc[k] ?? (this._cc[k] = this.count(k));
  }
  evalBreakdown(f) {
    const def = FAC[f.k], out = [{label: 'Base', v: 150}];
    const po = PRICE_EVAL_OFFSET[f.price];
    if (po) out.push({label: 'Preço ' + PRICE_NAMES[f.price].toLowerCase(), v: po, key: 'price'});
    const ps = def.hotel ? f.guests : f.persons;
    if (ps.length) {
      const st = ps.reduce((a, p) => a + p.stress, 0) / ps.length;
      // contínuo em torno de 12: até 4 → +15 (tranquilo), 12 → 0, acima disso -0,5 por ponto
      if (st > 12) out.push({label: 'Estresse nos elevadores e escadas (média ' + Math.round(st) + ')', v: -0.5 * (st - 12), key: 'stress'});
      else if (st < 12) out.push({label: 'Deslocamentos tranquilos (estresse ' + Math.round(st) + ')', v: Math.min(15, 1.875 * (12 - st)), key: 'calm'});
    }
    if (def.sensitive) {
      const q = this.serviceNear(f, 'jardim'), n = this.noiseOf(f) * (1 - DEMANDV.quiet * q);   // o jardim abafa parte do barulho
      if (n >= 0.05) out.push({label: 'Barulho por perto (' + n.toFixed(1).replace('.', ',') + (q > 0 ? ', abafado pelo jardim' : '') + ')', v: -Math.min(NOISE.cap, n * NOISE.perSource), key: 'noise'});
    }
    if (!this.reachable(f)) out.push({label: 'Sem acesso desde o térreo', v: -120, key: 'access'});
    if (def.condo || def.office) {
      const v = Math.min(def.condo ? 20 : 10, Math.round((f.L - 6) * 0.8));
      if (v > 0) out.push({label: def.condo ? 'Vista dos andares altos' : 'Prestígio do andar alto', v, key: 'view'});
    }
    if (f.k === 'shop') {
      if (f.L <= 1 && f.L >= 0) out.push({label: 'Perto do saguão', v: 10, key: 'lobby'});
      const lp = this.localPop(f, NEAR.traffic.range);
      if (lp >= NEAR.traffic.quiet) out.push({label: 'Fluxo de pessoas por perto', v: Math.min(NEAR.traffic.cap, lp / NEAR.traffic.per), key: 'traffic'});
      else out.push({label: 'Pouco movimento por perto', v: -5, key: 'traffic'});
    } else {
      const na = this.amenityKinds(f);
      if (na) out.push({label: 'Comércio e lazer por perto (' + na + ' tipo' + (na > 1 ? 's' : '') + ')', v: Math.min(18, na * 6), key: 'amenity'});
    }
    if (def.condo) {   // moradores: quem não tem carro conta com o metrô, quem tem carro conta com as vagas
      const car = this.carShare(f), ps = this.parkSupply();
      if (this.stations().length) out.push({label: 'Metrô (para quem não tem carro)', v: RIDE.metro * (1 - car), key: 'metro'});
      if (ps > 0) out.push({label: 'Vagas de estacionamento (para quem tem carro)', v: RIDE.parking * car * ps, key: 'parking'});
    }
    if (def.hotel) {
      if (f.bugs) out.push({label: 'Baratas no quarto', v: -80, key: 'bugs'});
      else if (f.dirty) out.push({label: 'Quarto sujo', v: -60, key: 'dirty'});
      else out.push({label: 'Quarto limpo', v: 10, key: 'clean'});
      const rp = clamp((f.rep - 80) * 0.5, -15, 10);
      if (Math.abs(rp) >= 1) out.push({label: 'Reputação do quarto e dos vizinhos (' + Math.round(f.rep) + '%)', v: rp, key: 'rep'});
    }
    let am = 0;
    for (const o of this.nearFacs(f, NEAR.service.range)) if ((o.k === 'clinic' || o.k === 'recycling') && this.serves(o)) am += NEAR.service.bonus * this.prox(f, o, NEAR.service.range);
    am = Math.min(NEAR.service.cap, am);
    if (am >= 0.5) out.push({label: 'Clínica e reciclagem por perto', v: am, key: 'service'});
    this.utilFresh();
    if (this.star >= SVC_STAR.lixo) { const tf = this.trashFactor(f); if (tf) out.push(tf); }
    if (f.cutE) out.push({label: f.cutWhyE === 'reach' ? 'Sem energia: nenhuma fonte ao alcance (rede pública, gerador ou bateria a até ' + Math.round(UTIL.reach.own / PROX.floorUnits) + ' andares)' : 'Sem energia: a fonte mais próxima não dá conta' + (this.season === 3 ? ' (inverno: consumo maior)' : '') + (this.util.energia.storeCap > 0 && this.util.energia.store > 0 ? ' (a bateria entrega no máximo ' + Math.round(this.storeSpec('energia').rate) + ' por hora)' : ''), v: -UTIL.penalty.energia, key: 'util:energia'});
    if (f.cutA) out.push({label: f.cutWhyA === 'reach' ? 'Sem água: nenhuma fonte ao alcance (rede pública, bomba, caixa ou tratamento a até ' + Math.round(UTIL.reach.own / PROX.floorUnits) + ' andares)' : 'Sem água: a fonte mais próxima não dá conta' + (this.season === 1 ? ' (verão: consumo maior)' : '') + (this.util.agua.storeCap > 0 && this.util.agua.store > 0 ? ' (a reserva entrega no máximo ' + Math.round(this.storeSpec('agua').rate) + ' por hora)' : ''), v: -UTIL.penalty.agua, key: 'util:agua'});
    for (const d of this.demandFactors(f)) out.push({label: d.label, v: d.v, key: 'svc:' + d.svc});
    const ie = this.incidentEffect(f), LAB = {theft: 'Furtos recentes no local e ao redor', fight: 'Briga com feridos por perto', bomb: 'Explosão por perto'};
    let inc = 0;
    for (const k of ['theft', 'fight', 'bomb']) if (ie[k] <= -0.5) { out.push({label: LAB[k], v: ie[k], key: k}); inc += ie[k]; }
    if (inc > -5 && this.secPosts(f).length && this.guardsFor(f) > 0) out.push({label: 'Área vigiada por segurança', v: INCIDENT.watch, key: 'safe'});
    return out;
  }
  // peso (0 a 1) do serviço `svc` mais perto de f: 1 colado, 0 se não há nenhum no alcance (DEMANDV.range)
  // nível do transporte público da torre: táxi 1, ônibus 2, metrô 3 (o melhor presente vale, sem distância)
  transportTier() {
    let t = 0;
    for (const k of ['taxi', 'busstop']) if (this.stops(k).length) t = Math.max(t, FAC[k].tier);
    if (this.stations().length) t = Math.max(t, FAC.transit.tier);
    return t;
  }
  serviceNear(f, svc) {
    if (svc === 'transporte') return this.transportTier() / SVC_TIERS;
    if (svc === 'lixo') return this.facs.some(o => FAC[o.k].svc === 'lixo' && this.serves(o)) ? 1 : 0;   // lixo e usina são infraestrutura do prédio (decisão do dono): não pedem proximidade
    let w = 0;
    for (const o of this.nearFacs(f, DEMANDV.range)) if (o !== f && FAC[o.k].svc === svc && this.serves(o)) w = Math.max(w, this.prox(f, o, DEMANDV.range));
    return w;
  }
  // o que a unidade f procura por perto (só serviços que existem no catálogo): bônus por serviço atendido, desconto pelo que falta; cada um vira um motivo mostrado
  demandFactors(f) {
    const want = (DEMAND[f.k] || []).filter(k => SERVICES.has(k) && SVC_STAR[k] <= this.star);   // só cobra o que o jogador já pode construir
    // extras: não são exigência. O serviço por perto dá humor (o jardim ainda abafa o barulho, em `evalBreakdown`); sem ele não se perde nada
    const extra = [], fd = FAC[f.k];
    if (fd.tenant || fd.hotel) {
      const ex = (DEMAND_EXTRA[f.k] || []).filter(k => SERVICES.has(k) && SVC_STAR[k] <= this.star).map(k => ({k, w: this.serviceNear(f, k)})).filter(o => o.w > 0);
      const tot = ex.reduce((a, o) => a + DEMANDV.extra * o.w, 0), kx = tot > DEMANDV.capExtra ? DEMANDV.capExtra / tot : 1;
      const nm = k => SVC_NAMES[k] || Object.values(FAC).find(d => d.svc === k).label.toLowerCase();
      for (const o of ex) extra.push({svc: o.k, met: true, extra: true, v: DEMANDV.extra * o.w * kx, label: 'Tem ' + nm(o.k) + ' por perto (extra)'});
    }
    if (!want.length) return extra;
    const name = k => SVC_NAMES[k] || Object.values(FAC).find(d => d.svc === k).label.toLowerCase();
    const met = [], miss = [];
    for (const k of want) { const w = this.serviceNear(f, k); (w > 0 ? met : miss).push({svc: k, w}); }
    let sm = met.reduce((a, d) => a + DEMANDV.met * d.w, 0); const km = sm > DEMANDV.capMet ? DEMANDV.capMet / sm : 1;
    let ss = miss.length * DEMANDV.miss; const kn = ss > DEMANDV.capMiss ? DEMANDV.capMiss / ss : 1;
    return [...extra, ...met.map(d => ({svc: d.svc, met: true, v: DEMANDV.met * d.w * km, label: 'Tem ' + name(d.svc) + ' por perto'})),
            ...miss.map(d => ({svc: d.svc, met: false, v: -DEMANDV.miss * kn, label: 'Falta ' + name(d.svc) + ' por perto'}))];
  }
  // chance de uma unidade vaga ser alugada num dia: base × faixa de preço × procura do entorno (cai com o humor dos vizinhos)
  rentChance(f) { this.utilFresh(); if (!this.reachable(f) || f.fire) return 0; return ((f.cutE || f.cutA) ? UTIL.rent : 1) * 0.28 * PRICE_MOVE_FACTOR[f.price] * clamp(0.4 + this.localMood(f) / 200, 0.3, 1.3) * clamp(1 + this.demandFactors(f).reduce((a, d) => a + d.v, 0) / DEMANDV.rent, 0.7, 1.3); }
  // por que uma unidade vaga ainda não foi alugada (e o que pesa na chance); só informação, sem ações
  vacancyReasons(f) {
    const def = FAC[f.k], out = [];
    if (!def.tenant || f.occ) return out;
    if (f.build < 1) { out.push({sev: 'info', text: 'Ainda em obras: só pode ser alugada depois de pronta.'}); return out; }
    if (!this.reachable(f)) out.push({sev: 'bad', text: 'Sem acesso desde o térreo: ninguém consegue chegar aqui, então ela nem entra no mercado. Falta uma escada ou elevador até este andar.'});
    const ch = this.rentChance(f);
    if (f.cutE) out.push({sev: 'bad', text: 'Sem energia: a capacidade (rede pública e fontes) não cobre a torre e esta unidade está entre as cortadas. Construa geradores ou placas solares.'});
    if (f.cutA) out.push({sev: 'bad', text: 'Sem água: a capacidade não cobre a torre e esta unidade está entre as cortadas. Construa caixas d\'água ou uma estação de tratamento.'});
    out.push({sev: 'info', text: 'Chance de ser alugada por dia: ' + Math.round(ch * 100) + '% (em média ~' + (1 / ch).toFixed(1).replace('.', ',') + ' dias).'});
    const pf = PRICE_MOVE_FACTOR[f.price];
    if (pf < 1) out.push({sev: 'bad', text: 'Preço ' + PRICE_NAMES[f.price].toLowerCase() + ': a procura cai para ' + Math.round(pf * 100) + '% do normal. Um preço mais baixo atrai mais rápido.'});
    else if (pf > 1) out.push({sev: 'info', text: 'Preço ' + PRICE_NAMES[f.price].toLowerCase() + ': a procura sobe para ' + Math.round(pf * 100) + '% do normal (rende menos por aluguel).'});
    for (const d of this.demandFactors(f)) out.push(d.met
      ? {sev: 'info', text: d.label + ': quem procura ' + def.label.toLowerCase() + ' gosta disso (' + (d.v >= 0 ? '+' : '') + d.v.toFixed(1).replace('.', ',') + ' na avaliação e mais procura).'}
      : {sev: 'bad', text: d.label + ': o inquilino procura isso por perto (' + d.v.toFixed(1).replace('.', ',') + ' na avaliação e menos procura).'});
    const mood = this.localMood(f), city = clamp(0.4 + mood / 200, 0.3, 1.3);
    if (city < 0.95) out.push({sev: 'bad', text: 'O humor dos vizinhos (' + Math.round(mood) + ') reduz a procura a ' + Math.round(city * 100) + '% do normal; melhore a avaliação das unidades por perto.'});
    else if (city > 1.05) out.push({sev: 'info', text: 'O bom humor dos vizinhos (' + Math.round(mood) + ') aumenta a procura para ' + Math.round(city * 100) + '% do normal.'});
    return out;
  }
  evalFac(f) { return clamp(this.evalBreakdown(f).reduce((a, o) => a + o.v, 0), 0, 300); }
  // avaliação contínua: a cada hora de jogo a nota anda 30% em direção ao valor atual (snap = vai direto)
  updateEval(snap) {
    let es = 0, en = 0, hs = 0, hn = 0;
    for (const f of this.facs) {
      if (f.build < 1 || f.dead) continue;
      const def = FAC[f.k];
      if (def.tenant && f.occ) {
        const tgt = this.evalFac(f);
        f.eval = snap ? tgt : f.eval + (tgt - f.eval) * 0.3;
        es += f.eval; en++;
      } else if (def.hotel) {
        const tgt = this.evalFac(f);
        f.eval = snap ? tgt : f.eval + (tgt - f.eval) * 0.3;
        if (f.guests.length) { hs += f.eval; hn++; }   // só quartos ocupados entram na média
      }
    }
    this.avgEval = en ? es / en : 150;
    this.avgHotelEval = hn ? hs / hn : 150;
  }
  // piores unidades (inquilinos e quartos ocupados) com o maior fator negativo de cada uma
  moodRank(n = 8) {
    const out = [];
    for (const f of this.facs) {
      const def = FAC[f.k];
      if (f.build < 1 || f.dead || !((def.tenant && f.occ) || (def.hotel && f.guests.length))) continue;
      const br = this.evalBreakdown(f).filter(o => o.v < 0).sort((a, b) => a.v - b.v)[0];
      out.push({f, e: f.eval, why: br ? br.label : 'Sem problemas graves'});
    }
    return out.sort((a, b) => a.e - b.e).slice(0, n);
  }
  newDay() {
    const day = this.day, base = day * 1440;
    // avaliação e saída de inquilinos (a nota já vem sendo atualizada a cada hora)
    this.updateEval(false);
    for (const f of this.facs) {
      if (f.build < 1) continue;
      const def = FAC[f.k];
      if (def.tenant && f.occ) {
        if (f.eval < EVAL_GOOD) {
          f.poorDays++;
          if (f.poorDays >= 2) {
            f.occ = false; f.poorDays = 0;
            this.evict(f);
            if (def.condo) this.funds -= def.prices[f.price];
            this.msg('Inquilinos saíram do ' + def.label.toLowerCase() + ' do andar ' + floorLabel(f.L) + ': insatisfeitos.', 'bad', f);
          } else this.msg(def.label + ' no andar ' + floorLabel(f.L) + ' está insatisfeito.', 'bad', f);
        } else f.poorDays = 0;
        for (const p of f.persons) p.stress *= 0.55;
      }
      if (def.tenant || def.hotel) { f.trend = f.evalDay === undefined ? 0 : f.eval - f.evalDay; f.evalDay = f.eval; }
    }
    // demissões ocasionais: o morador procura outro emprego, no prédio ou fora
    for (const f of this.facs) if (f.emp.length) for (const p of f.emp.slice()) if (Math.random() < LAYOFF_DAILY) this.fire(p);
    this.hist.push({day, pop: this.pop, funds: Math.round(this.funds), ev: Math.round(this.avgEval)});
    if (this.hist.length > 150) this.hist.shift();
    this.weather = this.forecast || 'sol'; this.forecast = this.pickWeather(day + 1); this._utk = null;
    this.rainWin = WEATHER[this.weather].rain ? [base + rnd(6, 18) * 60, 0] : null;
    if (this.rainWin) this.rainWin[1] = this.rainWin[0] + rnd(90, 300);

    // ocorrências antigas somem; reputação de cada quarto de hotel (quartos sujos e humor dos hóspedes por perto)
    this.incidents = this.incidents.filter(i => (this.t - i.t) / 1440 < INCIDENT[i.k].days);
    const hot = this.facs.filter(f => FAC[f.k].hotel && f.build >= 1), low = [];
    for (const h of hot) {
      const near = hot.filter(o => this.prox(h, o, NEAR.hotel.range) > 0), occ = near.filter(o => o.guests.length);
      const bad = near.filter(o => o.dirty || o.bugs).length / near.length, mood = occ.length ? occ.reduce((a, o) => a + o.eval, 0) / occ.length : 150;
      h.rep = clamp(h.rep + (bad > 0.2 ? -10 : bad > 0.1 ? -4 : 3) + (mood < EVAL_GOOD ? -3 : mood >= EVAL_GREAT ? 2 : 0), 20, 100);
      if (h.rep < 60 && !h.repWarn) { h.repWarn = true; low.push(h); }
      if (h.rep >= 80) h.repWarn = false;
    }
    if (low.length) this.msg('🏨 A reputação de ' + low.length + ' quarto(s) caiu para menos de 60%: muitos quartos sujos por perto. Contrate camareiras.', 'bad', low[0]);
    // custos diários
    for (const f of this.facs) {
      const d = FAC[f.k];
      if (d.dailyCost && f.build >= 1 && !f.closed) this.expense('daily', d.dailyCost);
    }
    // novos inquilinos
    for (const f of this.facs) {
      const def = FAC[f.k];
      if (!def.tenant || f.build < 1 || f.occ || f.fire || !this.reachable(f)) continue;
      if (Math.random() < this.rentChance(f)) {
        f.occ = true; f.poorDays = 0;
        f.sty = (Math.imul(this.t | 0, 2654435761) ^ Math.imul(f.id + 1, 40503)) >>> 0;   // novo ocupante, nova decoração (sem Math.random: não altera os sorteios da simulação)
        if (def.pop) this.moveIn(f);
        f.eval = this.evalFac(f); f.evalDay = f.eval; f.trend = 0;
        if (def.condo) this.income(f.k, def.prices[f.price]);
        this.msg((def.office ? 'Nova empresa' : def.condo ? 'Apartamento vendido' : 'Nova boutique') + ' no andar ' + floorLabel(f.L) + '.', 'good', f);
      }
    }
    this.calcStats();

    // rotinas do dia
    this.bizDaily();
    const ctx = this.dayCtx();
    this.planDay(ctx, false);
    this.planCrowd(ctx);
    if (this.star >= 3 && Math.random() < 0.03 * (this.stops('heliport').length ? HAIL.heliVip : 1)) this.vipEvent();
    this.bugEvent(); this.holidayEvent(); this.weddingEvent();
    // trimestre
    if (day > 0 && day % YEAR_DAYS === 0) this.msg('🎆 Feliz Ano Novo! Começa o ano ' + this.year + ' da sua torre.', 'good');
    if (day > 0 && day % QDAYS === 0) this.quarter();
    // eventos
    if (day > 1) {
      const fr = this.fireRisk();
      if (Math.random() < fr.p) this.fireEvent();
      else if (this.pop > 600 && Math.random() < 0.03) this.bombEvent();
    }
    this.updateStars();
    this.emit('day', {day});
  }
  // ------------------------------------------------------------ rotinas diárias
  openAt(f, h) { const o = FAC[f.k].open; return !o || (h * 60 >= o[0] && h * 60 < o[1]); }
  // ajusta uma visita (minutos desde 0h) ao horário de funcionamento; null se não der
  venueTime(f, tmin, stay) {
    const def = FAC[f.k];
    if (f.k === 'cinema') {
      const ss = [14, 17, 20].map(h => h * 60).filter(m => m - 20 >= tmin);
      return ss.length ? {t: ss[0] - rnd(5, 20), stay: 105 + rnd(0, 12)} : null;
    }
    if (def.open) {
      if (tmin < def.open[0]) tmin = def.open[0];
      if (tmin > def.open[1] - 30) return null;
      stay = Math.min(stay, def.open[1] - tmin - 5);
    }
    return {t: tmin, stay: Math.max(15, stay)};
  }
  venueFor(list, tmin, stay) {
    for (let i = 0; i < Math.min(3, list.length); i++) { const f = pick(list), v = this.venueTime(f, tmin, stay); if (v) return {f, t: v.t, stay: v.stay}; }
    return null;
  }
  dayCtx() {
    const open = this.facs.filter(f => !f.fire && this.serves(f));   // sem acesso desde o térreo não recebe ninguém (cinema, festa, bar, academia...)
    const reach = open;
    const ctx = {
      open, rain: !!this.rainWin,
      lunch: reach.filter(f => f.k === 'fastfood'),
      dine: reach.filter(f => f.k === 'restaurant' || f.k === 'fastfood' || f.k === 'cinema'),
      shops: reach.filter(f => f.k === 'shop' && f.occ),
      cinemas: reach.filter(f => f.k === 'cinema'),
    };
    ctx.errand = ctx.shops.concat(ctx.lunch);
    this._lunch = ctx.lunch;
    return ctx;
  }
  planDay(ctx, retro) {
    const base = this.day * 1440, we = this.weekend;
    for (const f of ctx.open) {
      const def = FAC[f.k];
      if (def.office) this.planOffice(f, base, we, ctx, retro);
      else if (def.condo) this.planHousehold(f, base, we, ctx, retro);
      else if (def.staff) {
        if (!f.persons.length) for (let i = 0; i < def.pop; i++) f.persons.push(this.mkPerson('staff', f));
        f.persons.forEach((p, i) => {
          if (p.task) return;
          if (retro) this.initPlace(p, f, f.k === 'security' && i % 2 === 1);
          this.setPlan(p, this.staffPlan(f, p, i, base, true), retro);
        });
      }
    }
  }
  planOffice(f, base, we, ctx, retro) {
    const night = f.shift === 'night', sh = f.shift || 'day';
    const win = OFFICE_WIN[sh] || OFFICE_WIN.day, lunchH = OFFICE_LUNCH[sh] || OFFICE_LUNCH.day;
    const nt = f.newTenant;
    f.persons.forEach((p, i) => {
      if (retro) this.initPlace(p, f, night);
      const pl = [], T = m => base + m * 60;
      if (nt) {
        pl.push({t: T(rnd(8, 11)), act: 'go', fac: f});
        if (!night) pl.push({t: T(rnd(17, 18.8)), act: 'leave'});
      } else if (night) {
        pl.push({t: T(rnd(5.5, 6.5)), act: 'leave'}, {t: T(rnd(21, 22.5)), act: 'go', fac: f});
      } else if (!we) {
        pl.push({t: T(rnd(win[0][0], win[0][1])), act: 'go', fac: f});
        if (ctx.lunch.length && Math.random() < 0.55) {
          const v = this.venueFor(ctx.lunch, rnd(lunchH[0], lunchH[1]) * 60, rnd(40, 70));
          if (v) pl.push({t: base + v.t, act: 'go', fac: v.f}, {t: base + v.t + v.stay, act: 'go', fac: f});
        }
        pl.push({t: T(rnd(win[1][0], win[1][1])), act: 'leave'});
      } else if (i % 4 === 0) pl.push({t: T(rnd(10, 11)), act: 'go', fac: f}, {t: T(rnd(14, 16)), act: 'leave'});
      else if (p.st !== 'away') pl.push({t: T(rnd(9, 11)), act: 'leave'});
      this.setPlan(p, pl, retro);
    });
    f.newTenant = false;
  }
  // rotina de cada morador: quem trabalha de dia, de noite, em casa, aposentados, crianças na escola...
  planHousehold(f, base, we, ctx, retro) {
    const ms = f.persons, moving = f.newTenant;
    if (!ms.length) return;
    for (const p of ms) if (p.job === undefined) this.findJob(p);     // adulto sem emprego definido: procura vaga no prédio ou fora
    const jb = p => this.jobOf(p);
    if (retro) for (const p of ms) { const w = p.prof === 'night' && jb(p); if (w) this.placeIn(p, w); else this.initPlace(p, f, p.prof !== 'night'); }
    const plans = new Map(ms.map(p => [p, []]));
    const add = (p, m, act, fac) => plans.get(p).push({t: base + m, act, fac});
    const trip = (p, v) => { add(p, v.t, 'go', v.f); add(p, v.t + v.stay, 'go', f); };   // vai a um local do prédio e volta
    const night = (p, works) => {
      const w = jb(p);
      if (w) {      // turno da noite no prédio: escritório 24h (volta de manhã) ou cinema, bar e restaurante (volta depois do fechamento)
        const office = FAC[w.k].office;
        if (p.st === 'away') add(p, rnd(6, 7.5) * 60, 'go', f);
        else if (p.at === w) add(p, office ? rnd(5.5, 6.5) * 60 : rnd(10, 50), 'go', f);
        if (works) {
          if (office) add(p, rnd(20.5, 22) * 60, 'go', w);
          else {
            const [a, b] = this.shopShift(w, p);
            add(p, a + rnd(0, 10), 'go', w);
            if (b < 1380) add(p, b + rnd(0, 10), 'go', f);   // se fecha depois da meia-noite, volta no começo do dia seguinte
          }
        }
        return;
      }
      if (p.st === 'away') add(p, rnd(6, 7.5) * 60, 'go', f);
      if (works) add(p, rnd(20.5, 22) * 60, 'leave');
    };
    let lastRet = 0;        // quando o último membro volta para casa
    const ret = m => { lastRet = Math.max(lastRet, m); return m; };
    const joins = new Map();

    if (f.newTenant) {
      const m = rnd(8, 14) * 60;
      for (const p of ms) add(p, m + rnd(0, 8), 'go', f);
      f.newTenant = false;
    } else if (!we) {
      for (const p of ms) {
        switch (p.prof) {
          case 'day': {
            const w = jb(p);
            if (w && FAC[w.k].office) {      // escritório do prédio: mesmo horário e almoço dos funcionários
              const sh = w.shift || 'day', win = OFFICE_WIN[sh] || OFFICE_WIN.day, lh = OFFICE_LUNCH[sh] || OFFICE_LUNCH.day;
              add(p, rnd(win[0][0], win[0][1]) * 60, 'go', w);
              if (ctx.lunch.length && Math.random() < 0.55) { const v = this.venueFor(ctx.lunch, rnd(lh[0], lh[1]) * 60, rnd(40, 70)); if (v) { add(p, v.t, 'go', v.f); add(p, v.t + v.stay, 'go', w); } }
              add(p, ret(rnd(win[1][0], win[1][1]) * 60), 'go', f);
            } else if (w) {                  // loja, lanchonete ou restaurante do prédio
              const [a, b] = this.shopShift(w, p);
              add(p, a + rnd(0, 10), 'go', w); add(p, ret(b + rnd(0, 10)), 'go', f);
            } else { add(p, rnd(7, 9) * 60, 'leave'); add(p, ret(rnd(17, 20) * 60), 'go', f); }
            break;
          }
          case 'night': night(p, true); break;
          case 'home': if (ctx.lunch.length && Math.random() < 0.4) { const v = this.venueFor(ctx.lunch, rnd(12, 13.5) * 60, rnd(35, 60)); if (v) trip(p, v); } break;
          case 'retired': {
            if (ctx.errand.length && Math.random() < 0.6) { const v = this.venueFor(ctx.errand, rnd(9, 11) * 60, rnd(30, 70)); if (v) trip(p, v); }
            if (Math.random() < 0.5) { add(p, rnd(14, 16) * 60, 'leave'); add(p, ret(rnd(17, 18.5) * 60), 'go', f); }
            break;
          }
          case 'homemaker': {
            add(p, rnd(7.5, 8.5) * 60, 'leave'); add(p, rnd(9, 10) * 60, 'go', f);        // leva as crianças à escola
            if (ctx.shops.length && Math.random() < 0.45) { const v = this.venueFor(ctx.shops, rnd(10.5, 12) * 60, rnd(25, 50)); if (v) trip(p, v); }
            if (Math.random() < 0.6) { add(p, rnd(15, 16) * 60, 'leave'); add(p, ret(rnd(17, 18.3) * 60), 'go', f); }
            break;
          }
          case 'school_am': {
            add(p, rnd(6.5, 7.2) * 60, 'leave');
            const v = p.age >= 11 && ctx.lunch.length && Math.random() < 0.25 ? this.venueFor(ctx.lunch, rnd(13, 14.5) * 60, rnd(40, 70)) : null;
            if (v) { add(p, v.t, 'go', v.f); add(p, ret(v.t + v.stay), 'go', f); } else add(p, ret(rnd(12.5, 13.5) * 60), 'go', f);
            break;
          }
          case 'school_pm': add(p, rnd(12.2, 13) * 60, 'leave'); add(p, ret(rnd(17.5, 18.8) * 60), 'go', f); break;
        }
      }
    } else {
      // fim de semana: a família sai junta, vai ao cinema do prédio ou fica em casa
      const mode = pickW(['out', 'cin', 'home'], ctx.rain ? [45, 25, 30] : [65, 20, 15]);
      // quem trabalha numa loja ou lanchonete do prédio pega o fim de semana em escala (60% trabalham)
      const wk = new Set();
      for (const p of ms) { const w = p.prof === 'day' && jb(p); if (w && FAC[w.k].open && Math.random() < 0.6) wk.add(p); }
      for (const p of ms) joins.set(p, !wk.has(p) && p.prof !== 'night' && (p.prof === 'toddler' || Math.random() < (p.prof === 'retired' ? 0.6 : 0.9)));
      for (const p of wk) { const w = jb(p), [a, b] = this.shopShift(w, p); add(p, a + rnd(0, 10), 'go', w); add(p, ret(b + rnd(0, 10)), 'go', f); }
      for (const p of ms) if (p.prof === 'night') night(p, Math.random() < 0.55);
      if (mode === 'out') {
        const t0 = rnd(9.5, 13) * 60, back = t0 + rnd(150, 360);
        for (const p of ms) if (joins.get(p)) { add(p, t0 + rnd(0, 10), 'leave'); add(p, back + rnd(0, 12), 'go', f); }
        lastRet = Math.max(lastRet, back);
      } else if (mode === 'cin' && ctx.cinemas.length) {
        const v = this.venueFor(ctx.cinemas, rnd(13, 18.5) * 60, 110);
        if (v) { for (const p of ms) if (joins.get(p)) trip(p, v); lastRet = Math.max(lastRet, v.t + v.stay); }
      }
    }
    // jantar em família num restaurante, lanchonete ou cinema do próprio prédio
    if (ctx.dine.length && !moving && Math.random() < ((we ? 0.35 : 0.2) * (ctx.rain ? 1.2 : 1))) {
      const v = this.venueFor(ctx.dine, Math.max(19.5 * 60, lastRet + 20), rnd(60, 100));
      if (v && v.t + v.stay < 23.7 * 60) for (const p of ms) if (p.prof !== 'night') { add(p, v.t + rnd(0, 4), 'go', v.f); add(p, v.t + v.stay + rnd(0, 4), 'go', f); }
    }
    for (const p of ms) {
      const pl = plans.get(p).sort((a, b) => a.t - b.t);
      if (p.st === 'away' && (!pl.length || pl[0].act !== 'go')) pl.unshift({t: base + rnd(10, 60), act: 'go', fac: f});   // quem amanhece fora volta para casa
      this.setPlan(p, pl, retro);
    }
  }
  // hóspedes e visitantes do dia
  planCrowd(ctx) {
    const base = this.day * 1440, open = ctx.open;
    const rf = ctx.rain ? 0.8 : 1;
    // hóspedes: ficam de 1 a 3 noites e saem para comer
    for (const f of open) {
      if (!FAC[f.k].hotel || f.guests.length || f.dirty || f.vip || f.bugs || f.fire || !this.reachable(f)) continue;
      const hotelDemand = clamp(this.localPop(f, NEAR.hotel.demand) / NEAR.hotel.scale, 0.15, 1);   // atrai pela gente que circula por perto
      if (Math.random() > 1.2 * hotelDemand * clamp(f.rep / 100, 0.2, 1.05) * PRICE_MOVE_FACTOR[f.price] * clamp(this.localMood(f) / 150, 0.4, 1.2)) continue;
      const tin = rnd(13, 20) * 60;
      if (base + tin < this.t) continue;
      if (this.people.length > MAX_PEOPLE) break;
      const nights = pickW([1, 2, 3], [60, 28, 12]), ev = [];
      for (let d = 0; d < nights; d++) {
        if (Math.random() < 0.5) {
          const v = this.venueFor(ctx.dine, (d === 0 ? Math.max(tin + 90, 18 * 60) : 18 * 60) + rnd(0, 90), rnd(60, 100));
          if (v) ev.push({t: d * 1440 + v.t, f: v.f, stay: v.stay});
        }
        if (d > 0 && Math.random() < 0.4) {
          const v = this.venueFor(ctx.lunch, rnd(12, 14) * 60, rnd(35, 60));
          if (v) ev.push({t: d * 1440 + v.t, f: v.f, stay: v.stay});
        }
      }
      const out = nights * 1440 + rnd(9, 11) * 60;
      for (let i = 0; i < FAC[f.k].guests; i++) {
        const g = this.mkPerson('guest', f, {nights}), o = i * 2;
        const pl = [{t: base + tin + o, act: 'go', fac: f}];
        for (const e of ev) pl.push({t: base + e.t + o, act: 'go', fac: e.f}, {t: base + e.t + e.stay + o, act: 'go', fac: f});
        pl.push({t: base + out + o, act: 'leave'});
        g.plan = pl.sort((a, b) => a.t - b.t);
        f.guests.push(g);
      }
    }
    // visitantes
    const access = (this.stations().length ? 1.5 : 1) * (1 + Math.min(0.3, this.countOk('parkspace') / 200)) + (this.stops('busstop').length ? HAIL.busstop.access : 0) + (this.stops('taxi').length ? HAIL.taxi.access : 0);   // acesso da torre por metrô e vagas
    const we = this.weekend;
    for (const f of open) {
      const def = FAC[f.k];
      if (f.fire || !this.reachable(f)) continue;
      if (!(def.commercial && def.open) && f.k !== 'cinema' && !(f.k === 'party' && we) && !(f.k === 'auditorio' && !we)) continue;
      const lp = this.localPop(f, NEAR.visit.range), attract = clamp(lp / NEAR.visit.scale, 0.02, 1) * access, sat = this.satur(f);   // atrai pela gente que circula por perto
      if (def.commercial && def.open) {
        if (f.k === 'shop' && !f.occ) continue;
        let n = Math.round((def.visitors[0] + (def.visitors[1] - def.visitors[0]) * Math.min(1, attract * 1.3)) * rnd(0.7, 1.2) * this.insecurity(f) * rf * sat);
        if (lp < 15) n = 0;
        n = Math.min(n, def.cap);
        for (let i = 0; i < n; i++) {
          const r = Math.random();
          const peak = f.k === 'fastfood' ? (r < 0.4 ? rnd(12, 14) : r < 0.75 ? rnd(18, 20.5) : rnd(10, 20.5)) : f.k === 'restaurant' ? rnd(17.5, 22) : f.k === 'bar' ? rnd(19.5, 23.3) : rnd(Math.max(10, def.open[0] / 60 + 1), Math.min(20.5, def.open[1] / 60 - 1));
          const v = this.venueTime(f, peak * 60, rnd(25, 80));
          if (v) this.spawnVisitor(f, base + v.t, v.stay);
        }
      } else if (f.k === 'cinema') {
        const kind = FILMS[f.film].kind;
        for (const hr of [14, 17, 20]) {
          const n = Math.min(120, Math.round((8 + 90 * attract) * FILM_DRAW[kind] * rnd(0.7, 1.2) * (ctx.rain ? 1.2 : 1) * sat));
          if (lp < 15) break;
          for (let i = 0; i < n; i++) this.spawnVisitor(f, base + hr * 60 - rnd(0, 25), 105 + rnd(0, 15));
        }
      } else if (f.k === 'auditorio' && !we && lp >= 50) {
        const n = Math.min(80, Math.round((15 + 90 * attract) * sat));
        for (let i = 0; i < n; i++) this.spawnVisitor(f, base + 9 * 60 + rnd(0, 30), 240);   // a receita entra na chegada
      } else if (f.k === 'party' && we && lp >= 50) {
        const n = Math.min(100, Math.round((20 + 150 * attract) * sat));
        for (let i = 0; i < n; i++) this.spawnVisitor(f, base + 18.5 * 60 + rnd(0, 40), 170);   // a receita entra quando os convidados chegam
      }
    }
  }
  // salas do mesmo tipo por perto dividem o público (colada = metade cada; a 8 andares ou mais são independentes)
  satur(f, R = NEAR.visit.range) {
    let n = 1;
    for (const o of this.nearFacs(f, R)) if (o !== f && o.k === f.k && this.serves(o)) n += this.prox(f, o, R);
    return 1 / n;
  }
  spawnVisitor(f, t, stay) {
    if (t < this.t || this.people.length > MAX_PEOPLE) return;
    const v = this.mkPerson('visitor', null);
    v.plan = [{t, act: 'go', fac: f}, {t: t + stay, act: 'leave'}];
  }
  // o que o fim do trimestre vai cobrar e pagar agora (aluguéis por tipo e manutenção por categoria); a tela de finanças usa para a previsão
  quarterCalc() {
    let rent = 0;
    const inc = {}, mnt = {};
    for (const f of this.facs) {
      if (f.build < 1) continue;
      const def = FAC[f.k];
      if (def.tenant && def.per === 'trimestre' && f.occ && !f.fire && this.reachable(f)) { inc[f.k] = (inc[f.k] || 0) + def.prices[f.price]; rent += def.prices[f.price]; }
      if (MAINT[f.k]) { const cat = def.corr ? 'corridors' : f.k; mnt[cat] = (mnt[cat] || 0) + MAINT[f.k]; }
      if (f.k === 'lobby') mnt.lobby = (mnt.lobby || 0) + MAINT.lobbyUnit * f.w / 4 * f.h;
    }
    for (const s of this.shafts) { const m = (MAINT[s.k] || 0) * s.cars.length; mnt[s.k] = (mnt[s.k] || 0) + m; }
    for (const s of this.stairs) if (s.k === 'escalator') mnt.escalator = (mnt.escalator || 0) + MAINT.escalator;
    mnt.wages = this.people.filter(p => !p.dead && p.kind === 'staff').length * WAGE;
    for (const k in this.sys) if (this.sys[k]) mnt.systems = (mnt.systems || 0) + SYSTEMS[k].upkeep;
    return {rent, inc, mnt};
  }
  quarter() {
    const {rent, inc, mnt} = this.quarterCalc();
    for (const k in inc) this.income(k, inc[k]);
    let tot = 0;
    for (const k in mnt) { this.expense(k, Math.round(mnt[k])); tot += mnt[k]; }
    this.fin.last = this.fin.cur;
    this.fin.cur = {inc: {}, mnt: {}};
    this.msg('Fim de trimestre: aluguéis ' + fmtMoney(rent) + ', manutenção ' + fmtMoney(tot) + '.', 'good');
    this.emit('quarter', {});
  }
  bugEvent() {
    const hotels = this.facs.filter(f => FAC[f.k].hotel && f.build >= 1);
    for (const f of hotels) if (f.bugs && Math.random() < 0.3) {
      const nb = pick([this.facAt(f.L, f.x - 1), this.facAt(f.L, f.x + f.w)]);
      if (nb && FAC[nb.k].hotel && !nb.bugs) this.infest(nb, true);
    }
    if (this.day > 3 && hotels.length && Math.random() < 0.06) this.infest(pick(hotels), false);
  }
  infest(f, spread) {
    f.bugs = 3;
    for (const g of f.guests) g.dead = true;
    f.guests = [];
    this.msg('🪳 ' + (spread ? 'As baratas se espalharam para' : 'Baratas encontradas em') + ' um quarto no andar ' + floorLabel(f.L) + '. Camareiras podem limpar.', 'bad', f);
  }
  weddingEvent() {
    const ch = this.facs.find(f => f.k === 'landmark' && this.serves(f));
    if (!ch || !this.weekend || this.pop < 200) return;
    const n = Math.min(40, 10 + Math.round(this.pop / 200)), base = this.day * 1440 + rnd(11, 15) * 60;
    for (let i = 0; i < n; i++) this.spawnVisitor(ch, base + rnd(0, 20), 110);
    this.msg('💒 Casamento na Capela celeste hoje à tarde: ' + n + ' convidados a caminho (cada um rende ' + fmtMoney(3000) + ' ao chegar).', 'good');
  }
  get year() { return Math.floor(this.day / YEAR_DAYS) + 1; }
  get season() { return Math.floor(this.day / SEASON_DAYS) % 4; }
  holidayEvent() {
    const yd = this.day % YEAR_DAYS;
    if (yd === YEAR_DAYS - 2) {
      this.santa = {x: this.towerX() - 220, end: this.towerX() + 260, y: 0, claimed: false, t0: this.t};
      this.msg('🎅 É véspera de Natal! Fique de olho no céu: clique no Papai Noel para ganhar um presente.', 'good');
    }
  }
  callHeli(L, x, reason) {
    if (this.heli) return;
    const side = x <= this.towerX() ? 1 : -1;   // vem do lado oposto e atravessa
    this.heli = {x: x + side * STREET, tx: x, L, reason, phase: 'in', hold: 0, dir: -side, alt: 1};
    this.emit('sound', {name: 'heli', L, x});
  }
  updHeli(h) {
    const hl = this.heli;
    if (!hl) return;
    if (hl.phase === 'in') {
      const dx = hl.tx - hl.x, mv = Math.min(Math.abs(dx), 40 * h);
      hl.x += Math.sign(dx) * mv;
      if (Math.abs(hl.tx - hl.x) < 0.5) { hl.x = hl.tx; hl.phase = hl.reason === 'vip' ? 'land' : 'hold'; hl.hold = 6; }
    } else if (hl.phase === 'land') {   // pouso do VIP: desce devagar até a laje
      hl.alt = Math.max(0, (hl.alt === undefined ? 1 : hl.alt) - 0.3 * h); if (hl.alt <= 0) { hl.phase = 'hold'; hl.hold = 7; }
    } else if (hl.phase === 'up') {   // decolagem
      hl.alt = Math.min(1, (hl.alt || 0) + 0.3 * h); if (hl.alt >= 1) hl.phase = 'out';
    } else if (hl.phase === 'hold') {
      hl.hold -= h;
      if (hl.hold <= 0) {
        hl.phase = hl.reason === 'vip' ? 'up' : 'out';
        if (hl.reason === 'fire' && hl.fac && !hl.fac.dead) { hl.fac.fire = 0; this.expense('daily', 150000); this.msg('🚁 O helicóptero apagou o incêndio. Custo: ' + fmtMoney(150000) + '.', 'good'); }
        else if (hl.reason === 'bomb') { this.expense('daily', 300000); this.msg('🚁 Helicóptero entregou o resgate da bomba: ' + fmtMoney(300000) + '.', 'bad'); }
      }
    } else { hl.x += hl.dir * 45 * h; if (Math.abs(hl.x - hl.tx) > STREET + 30) this.heli = null; }
  }
  // ---------- bombeiros: caminhão chamado para salas cobertas por hidrante
  // chama TRUCK.trucks caminhões, um de cada lado do prédio: o da porta do térreo mais perto da sala e o da porta mais distante dela
  callTruck(f) {
    const cx = f.x + f.w / 2, doors = this.groundEntrances().map(e => e.x);
    const near = doors.length ? doors.reduce((a, d) => (Math.abs(d - cx) < Math.abs(a - cx) ? d : a)) : cx;
    const far = doors.length ? doors.reduce((a, d) => (Math.abs(d - near) > Math.abs(a - near) ? d : a)) : near;
    const sameDoor = Math.abs(far - near) < 8;
    const spots = sameDoor ? [{door: near, goal: near - 7, left: true}, {door: near, goal: near + 7, left: false}]   // porta única: um de cada lado dela
      : [near, far].sort((a, b) => a - b).map((d, i) => ({door: d, goal: d, left: i === 0}));
    f.truck = true;
    for (const sp of spots.slice(0, TRUCK.trucks)) {
      const x0 = sp.goal + (sp.left ? -200 : 200);   // sai de 200 unidades da porta, do lado dela
      this.trucks.push({x: x0, x0, dir: Math.sign(sp.goal - x0), goal: sp.goal, door: sp.door, spd: Math.abs(sp.goal - x0) / TRUCK.eta, phase: 'drive', hold: 0, crew: [], fac: f});
    }
    this.emit('sound', {name: 'siren', L: 0, x: near});
    this.msg('🚒 Os bombeiros foram chamados para o andar ' + floorLabel(f.L) + ': ' + TRUCK.trucks + ' caminhões, ' + TRUCK.trucks * TRUCK.crew + ' bombeiros. Eles sobem pelas escadas.', 'good', f);
  }
  // a equipe desce do caminhão na porta e segue a pé (só escadas e escadas rolantes) até a sala
  unloadCrew(t) {
    for (let i = 0; i < TRUCK.crew; i++) {
      const p = this.mkPerson('firefighter', null);
      p.transient = true; p.st = 'idle'; p.L = 0; p.x = t.door; p.stress = 0; p.task = t.fac;
      this.startTrip(p, t.fac);
      t.crew.push(p);
    }
  }
  updTrucks(dm) {
    for (const t of this.trucks) {
      if (t.phase === 'drive' && (!t.fac || t.fac.dead)) { t.phase = 'leave'; t.dir = -t.dir; }   // desistiu antes de chegar
      if (t.phase === 'drive') {
        const mv = t.spd * dm;
        if (Math.abs(t.goal - t.x) <= mv) { t.x = t.goal; t.phase = 'work'; t.hold = 0; this.unloadCrew(t); }
        else t.x += t.dir * mv;
      } else if (t.phase === 'work') {
        // fica estacionado até a equipe voltar (ou até o tempo máximo)
        t.hold += dm;
        t.crew = t.crew.filter(p => !p.dead && p.st !== 'away');
        if (!t.crew.length || t.hold > TRUCK.maxStay) {
          for (const p of t.crew) p.dead = true;
          t.crew = [];
          if (t.fac && !t.fac.dead && !this.trucks.some(o => o !== t && o.fac === t.fac && o.phase !== 'leave')) { t.fac.truck = false; if (t.fac.fire) t.fac.truckT = this.t + 30; }
          t.phase = 'leave'; t.dir = -t.dir;
        }
      } else t.x += t.dir * Math.max(t.spd, 3) * 3 * dm;
    }
    this.trucks = this.trucks.filter(t => t.phase !== 'leave' || (t.x0 - t.x) * t.dir > 0);   // ao sair, volta até o ponto de onde veio
  }
  vipEvent() {
    const suites = this.facs.filter(f => f.k === 'suite' && this.serves(f) && !f.dirty && !f.guests.length && !f.vip);
    if (!suites.length) return;
    const busy = suites.filter(f => this.localPop(f, NEAR.visit.range) >= 3);   // o VIP só vem a um hotel com movimento por perto
    if (!busy.length) return;
    const s = pick(busy);
    const t = this.day * 1440 + rnd(13, 16) * 60;
    if (t < this.t) return;
    const v = this.mkPerson('vip', s);
    v.transient = true; v.stress = 0;
    v.plan = [{t, act: 'go', fac: s}, {t: t + 150, act: 'leave'}];
    s.vip = v;
    const hp = this.stops('heliport')[0];
    if (hp) (this.pendingHeli = this.pendingHeli || []).push({t: t - 4, L: hp.L, x: hp.x + hp.w / 2});
    this.msg('⭐ Um convidado VIP chega hoje à tarde e vai avaliar a suíte do andar ' + floorLabel(s.L) + '!', 'good');
  }
  judgeVip(p, f) {
    const issues = [];
    if (f.dirty) issues.push('quarto sujo');
    if (this.noiseOf(f) > 0.25) issues.push('barulho');
    if (p.stress >= 150) issues.push('espera demais nos elevadores');
    if (this.localMood(f) < 100) issues.push('vizinhança mal avaliada');
    f.vip = null;
    if (!issues.length) { this.income('vip', 150000); this.msg('⭐ O VIP adorou a suíte! Bônus de ' + fmtMoney(150000) + '.', 'good'); }
    else { this.expense('daily', 50000); this.msg('O VIP reclamou (' + issues.join(', ') + '). Multa de ' + fmtMoney(50000) + '.', 'bad'); }
  }
  guardsOnDuty() { return this.people.filter(p => !p.dead && p.kind === 'staff' && p.home && p.home.k === 'security' && p.st !== 'away').length; }
  // o posto p cobre a sala f: até SEC.floors andares acima/abaixo e SEC.reach unidades para cada lado
  secCovers(p, f) {
    return this.serves(p) && f.L <= p.L + SEC.floors && f.L + f.h - 1 >= p.L - SEC.floors && f.x < p.x + p.w + SEC.reach && f.x + f.w > p.x - SEC.reach;
  }
  secPosts(f) { return this._index().posts.filter(p => this.secCovers(p, f)); }
  // seguranças em serviço agora nos postos que cobrem a sala f
  guardsFor(f) {
    const posts = this.secPosts(f);
    let n = 0;   // a equipe de um posto são as pessoas da própria sala (não precisa varrer todo mundo)
    for (const post of posts) for (const p of post.persons) if (!p.dead && p.kind === 'staff' && p.st !== 'away') n++;
    return n;
  }
  // cobertura de segurança da sala f, de 0 a 1 (quanto os seguranças daqui seguram o risco); `crowd` = gente no local
  secCoverage(f, crowd = 0) { const g = this.guardsFor(f); return g ? Math.min(1, g / (1 + crowd / 20)) : 0; }
  fireRisk() {
    const kitchens = this.facs.filter(f => (f.k === 'fastfood' || f.k === 'restaurant') && f.build >= 1).length;
    const factors = []; let p = 0.004;
    if (kitchens) { p += 0.006 * kitchens; factors.push(kitchens + ' cozinha(s) em lanchonetes e restaurantes'); }
    if (this.pop > 200) { p += this.pop / 60000; factors.push('Muita gente no prédio (' + this.pop + ')'); }
    if (!this.count('security')) factors.push('Sem posto de segurança: só o helicóptero (R$ 150.000) apaga o fogo');
    else factors.push(this.guardsOnDuty() + ' segurança(s) em serviço agora (cada posto só cobre a sua área)');
    const rooms = this.facs.filter(f => f.build >= 1 && !FAC[f.k].struct && f.k !== 'ruin');
    const covered = rooms.filter(f => this.corrNear(f, 'ext')).length;
    factors.push(covered + ' de ' + rooms.length + ' sala(s) cobertas por extintor');
    factors.push(rooms.filter(f => this.corrNear(f, 'spr')).length + ' de ' + rooms.length + ' sala(s) cobertas por sprinklers (risco −60% nelas)');
    factors.push(rooms.filter(f => this.corrNear(f, 'hyd')).length + ' de ' + rooms.length + ' sala(s) cobertas por hidrante (bombeiros: ' + fmtMoney(TRUCK.cost) + ', sobem só por escadas)');
    const noStairs = rooms.filter(f => this.corrNear(f, 'hyd') && !this.stairReach(f)).length;
    if (noStairs) factors.push(noStairs + ' sala(s) com hidrante mas sem escada até lá: os bombeiros não chegam');
    p = Math.min(p, 0.35);
    return {p, level: p < 0.02 ? 0 : p < 0.06 ? 1 : 2, factors};
  }
  crimeRisk() {
    const venues = this.facs.filter(f => f.build >= 1 && CRIME_KINDS.includes(f.k));
    const factors = [], posts = this.count('security');
    const noPost = venues.filter(f => !this.secPosts(f).length).length, cam = venues.filter(f => this.corrNear(f, 'cam')).length;
    factors.push(venues.length + ' local(is) público(s) que atraem multidões' + (venues.some(f => f.k === 'bar') ? ' (bares pesam mais)' : ''));
    factors.push(posts ? noPost + ' local(is) fora da área de qualquer posto de segurança' : 'Sem posto de segurança');
    factors.push(this.guardsOnDuty() + ' segurança(s) em serviço agora');
    factors.push(cam + ' local(is) cobertos por câmera (brigas e furtos −50%)');
    const rec = this.incidents.filter(i => (this.t - i.t) / 1440 < INCIDENT[i.k].days).length;
    factors.push(rec + ' ocorrência(s) recente(s) (furtos, brigas com feridos, explosões): cada uma pesa nas unidades por perto');
    let score = 0;
    for (const f of venues) score += (CRIME_W[f.k] || 1) * (1 - 0.7 * Math.min(1, this.guardsFor(f) / 2)) * (this.corrNear(f, 'cam') ? CORR.camFight : 1);
    score *= this.star >= FAC.security.star ? 1 : 0.3;
    return {level: score < 0.8 ? 0 : score < 2.5 ? 1 : 2, factors};
  }
  // tempo (em segundos de jogo, na velocidade 1) que os seguranças de um posto levam até a sala pela melhor rota de equipe; null = sem rota
  guardEta(p, f) {
    const a = this.nodeAt(p.L, p.x + p.w / 2), b = this.nodeAt(f.L, f.x + f.w / 2);
    if (a < 0 || b < 0) return null;
    if (a === b) return 0;
    const l = this.search(a, null, true).byNode.get(b);
    return l ? Math.round(Math.min(...l.map(o => o.d)) / SEC.costPerSec) : null;
  }
  // cobertura de uma sala para as visões do mapa (em cache: recalcula quando o prédio muda ou a cada ~1 s de jogo)
  coverage(f) {
    if (this._cvV !== this.ver || this.simT - this._cvT > 1) { this._cv = new Map(); this._cvV = this.ver; this._cvT = this.simT; }
    let c = this._cv.get(f.id);
    if (c) return c;
    const fire = this.corrNear(f, 'spr') ? 'spr' : this.corrNear(f, 'hyd') ? 'hyd' : this.corrNear(f, 'ext') ? 'ext' : null;
    const posts = this.secPosts(f), etas = posts.map(p => this.guardEta(p, f)).filter(e => e !== null);
    c = {fire, post: posts.length > 0, guards: this.guardsFor(f), cam: this.corrNear(f, 'cam'), resp: etas.length ? Math.min(...etas) : null, stairs: this.stairReach(f)};
    this._cv.set(f.id, c);
    return c;
  }
  // efeito visual de um evento (extintor, sprinklers, explosão, ambulância, ladrão); `o` leva dados do desenho
  addFx(k, f, o = {}) {
    this.fxs.push({k, f, t0: this.simT, dur: FX_DUR[k], ...o});
    const snd = {ext: 'ext', boom: 'boom', amb: 'amb', spr: 'ext'}[k];
    if (snd) this.emit('sound', {name: snd, L: f.L, x: f.x + f.w / 2});
  }
  // salas para onde o fogo pode pular, com a chance de cada uma; corredores não queimam, mas o fogo atravessa com chance reduzida
  spreadTargets(f) {
    const out = new Map();
    const add = (o, p) => { if (o && o !== f && !FAC[o.k].struct && o.k !== 'ruin' && o.build >= 1) out.set(o, Math.max(out.get(o) || 0, p)); };
    const probe = (L, u, dL, du) => {
      const o = this.facAt(L, u);
      if (!o || !FAC[o.k].corr) { add(o, 1); return; }
      const p = FAC[o.k].corr === 'spr' ? CORR.spreadSpr : CORR.spreadPlain;
      add(du > 0 ? this.facAt(L, o.x + o.w) : du < 0 ? this.facAt(L, o.x - 1) : this.facAt(L + dL, u), p);
    };
    for (let u = f.x; u < f.x + f.w; u++) { probe(f.L - 1, u, -1, 0); probe(f.L + f.h, u, 1, 0); }
    for (let lev = f.L; lev < f.L + f.h; lev++) { probe(lev, f.x - 1, 0, -1); probe(lev, f.x + f.w, 0, 1); }
    return [...out];
  }
  // o corredor c (extintor/sprinklers) cobre a sala f: mesmo andar ou 1 acima/abaixo, até CORR.range unidades de distância
  corrCovers(c, f) {
    return c.build >= 1 && c.L >= f.L - 1 && c.L <= f.L + f.h && f.x < c.x + c.w + CORR.range && f.x + f.w > c.x - CORR.range;
  }
  corrNear(f, type) {
    this.utilFresh();   // sem água no corredor, sprinklers e hidrantes não funcionam; sem energia nele, as câmeras falham
    return this._index().corr.some(c => FAC[c.k].corr === type && this.corrCovers(c, f) && !((type === 'spr' || type === 'hyd') && c.cutA) && !(type === 'cam' && c.cutE)); }
  // alguém ocioso numa sala coberta pelo mesmo extintor vai a pé até o corredor e tenta apagar o fogo pequeno (custa uma recarga e pode falhar)
  tryExtinguish(f, dm) {
    f.extT = (f.extT || 0) + dm;
    if (f.extT < CORR.extEvery) return;
    f.extT = 0;
    const by = f.extBy;
    if (by && !by.dead && by.extinguish && by.dest && by.dest.fac === by.extinguish.c) return;   // já tem alguém a caminho
    const exts = this.facs.filter(c => FAC[c.k].corr === 'ext' && this.corrCovers(c, f));
    if (!exts.length) return;
    const who = this.people.filter(p => !p.dead && p.st === 'idle' && p.at && !p.at.dead && p.at !== f && exts.some(c => this.corrCovers(c, p.at)));
    if (!who.length) return;
    const c = exts[0], p = who.reduce((a, q) => (Math.abs(q.L - c.L) * 20 + Math.abs(q.x - c.x) < Math.abs(a.L - c.L) * 20 + Math.abs(a.x - c.x) ? q : a));
    p.extinguish = {f, c}; f.extBy = p;
    this.startTrip(p, c);
    if (!p.dest) { p.extinguish = null; f.extBy = null; }   // sem rota até o extintor
  }
  // quem chegou ao corredor usa o extintor: se o fogo já passou do limite (ou apagou), a viagem foi em vão e nada é cobrado
  useExtinguisher(p) {
    const {f, c} = p.extinguish;
    p.extinguish = null; if (f.extBy === p) f.extBy = null;
    if (f.dead || !f.fire || f.fire >= CORR.extMax) return;
    this.expense('refills', CORR.extRefill);
    const ok = Math.random() < CORR.extChance;
    this.addFx('ext', f, {from: c, ok, level: f.fire});
    p.fxUntil = this.simT + FX_DUR.ext;   // o desenho do efeito faz o papel dele
    if (ok) {
      f.fire = 0; f.spread = false; f.fighting = false; f.heliCalled = false;
      this.msg('🧯 Alguém usou o extintor e apagou o fogo no andar ' + floorLabel(f.L) + '.', 'good', f);
    } else this.msg('O extintor não deu conta do fogo no andar ' + floorLabel(f.L) + '.', 'bad', f);
  }
  ignite(f, cause) {
    f.fire = 1; f.spread = false; f.fireCause = cause;
    for (const p of this.people) if (!p.dead && p.at === f && p.st === 'idle') { p.stress = Math.min(STRESS_MAX, p.stress + 80); p.panic = true; p.panicT = this.t + 40; this.startExit(p); }   // foge correndo
    this.emit('sound', {name: 'voz', mood: 'grito', seed: f.id || f.x, L: f.L, x: f.x + f.w / 2});
  }
  fireEvent() {
    const c = this.facs.filter(f => f.build >= 1 && !FAC[f.k].struct && f.k !== 'ruin' && !f.fire);
    if (!c.length) return;
    const w = f => ((f.k === 'fastfood' || f.k === 'restaurant') ? 6 : f.k === 'recycling' ? 2 : 1) * (this.corrNear(f, 'spr') ? CORR.sprIgnition : 1);
    const tot = c.reduce((a, f) => a + w(f), 0);
    let r = Math.random() * tot, f = c[0];
    for (const o of c) { r -= w(o); if (r <= 0) { f = o; break; } }
    const kitchen = f.k === 'fastfood' || f.k === 'restaurant';
    this.ignite(f, kitchen ? 'Gordura superaquecida na cozinha' : 'Curto-circuito na instalação elétrica');
    this.msg('🔥 Incêndio no andar ' + floorLabel(f.L) + ' (' + f.fireCause.toLowerCase() + ')!', 'bad', f);
  }
  crimeCheck() {
    const by = new Map();
    for (const p of this.people) if (!p.dead && p.st === 'idle' && p.at) { (by.get(p.at) || by.set(p.at, []).get(p.at)).push(p); }
    for (const [f, crowd] of by) {
      if (f.fight || f.build < 1 || !CRIME_KINDS.includes(f.k) || crowd.length < 6 || !this.openAt(f, this.minute / 60)) continue;
      const avg = crowd.reduce((a, p) => a + p.stress, 0) / crowd.length;
      let p = 0.03 * (crowd.length / 15) * (1 + avg / 150) * (1 - 0.7 * this.secCoverage(f, crowd.length)) * (CRIME_W[f.k] || 1);
      if (this.corrNear(f, 'cam')) p *= CORR.camFight;
      if (Math.random() < p) {
        f.fight = this.t + 120; this.emit('sound', {name: 'voz', mood: 'briga', seed: f.id || f.x, L: f.L, x: f.x + f.w / 2});
        for (const q of crowd) q.stress = Math.min(STRESS_MAX, q.stress + 25);
        this.msg('👊 Briga no(a) ' + FAC[f.k].label.toLowerCase() + ' do andar ' + floorLabel(f.L) + '! (' + crowd.length + ' pessoas, estresse médio ' + Math.round(avg) + ')', 'bad', f);
      }
    }
    this.theftCheck(); this.bikeTheft();
  }
  // furtos de madrugada em unidades ocupadas (escritório, loja, apartamento, quarto...) que estão vazias de gente; a segurança da área e as câmeras reduzem a chance
  theftCheck() {
    const inside = new Set();
    for (const p of this.people) if (!p.dead && p.at) inside.add(p.at);
    for (const f of this.facs) {
      const def = FAC[f.k];
      if (f.build < 1 || !((def.tenant && f.occ) || (def.hotel && f.guests.length)) || inside.has(f)) continue;
      let p = THEFT.p * (1 - 0.7 * this.secCoverage(f)) * (this.star >= FAC.security.star ? 1 : 0.3);
      if (this.corrNear(f, 'cam')) p *= CORR.camTheft;
      if (f.cutE) p *= OUTAGE.crime;   // no escuro os furtos sobem
      if (Math.random() >= p) continue;
      this.addIncident('theft', f);
      for (const q of (def.hotel ? f.guests : f.persons)) q.stress = Math.min(STRESS_MAX, q.stress + THEFT.stress);
      this.addFx('thief', f);
      this.msg('🦹 Furto no(a) ' + def.label.toLowerCase() + ' do andar ' + floorLabel(f.L) + ': o humor de quem mora/trabalha ali e nas unidades vizinhas caiu.', 'bad', f);
    }
  }
  // bicicletário: de madrugada, se há ciclistas por perto, as bicicletas podem ser furtadas (segurança da área e câmeras reduzem a chance)
  bikeTheft() {
    for (const f of this.facs) {
      if (f.k !== 'bike' || !this.serves(f)) continue;
      let n = 0;
      for (const o of this.nearFacs(f, DEMANDV.range)) if (o.occ && o.persons) for (const p of o.persons) if (this.bikes(p)) n++;
      if (!n) continue;
      let p = BIKE.theft * Math.min(3, n / 4) * (1 - 0.7 * this.secCoverage(f)) * (this.star >= FAC.security.star ? 1 : 0.3);
      if (this.corrNear(f, 'cam')) p *= CORR.camTheft;
      if (Math.random() >= p) continue;
      this.addIncident('theft', f);
      this.addFx('thief', f);
      for (const o of this.nearFacs(f, DEMANDV.range)) if (o.occ && o.persons) for (const q of o.persons) if (this.bikes(q)) q.stress = Math.min(STRESS_MAX, q.stress + BIKE.stress);
      this.msg('🦹 Bicicletas furtadas no bicicletário do andar ' + floorLabel(f.L) + ': quem pedala por perto ficou irritado.', 'bad', f);
    }
  }
  hire(f) {
    if (!FAC[f.k].staff) return 'Aqui não há equipe.';
    if (f.persons.length >= MAX_CREW) return 'Equipe máxima (' + MAX_CREW + ').';
    if (this.funds < HIRE_COST) return 'Dinheiro insuficiente.';
    this.expense('wages', HIRE_COST);
    const p = this.mkPerson('staff', f), i = f.persons.length;
    f.persons.push(p);
    p.plan = [{t: this.t + rnd(1, 8), act: 'go', fac: f}, ...this.staffPlan(f, p, i, this.day * 1440).filter(e => e.act === 'leave')];
    return null;
  }
  dismiss(f) {
    if (f.persons.length <= 1) return 'Mantenha ao menos 1 funcionário.';
    const p = [...f.persons].reverse().find(q => !q.task);
    if (!p) return 'Todos estão em tarefa agora.';
    p.dead = true; f.persons = f.persons.filter(q => q !== p);
    return null;
  }
  buySystem(name) {
    const s = SYSTEMS[name];
    if (!s) return 'Sistema inválido.';
    if (this.sys[name]) return 'Já instalado.';
    if (!this.hasGroundLobby()) return 'Construa o saguão primeiro.';
    if (this.funds < s.cost) return 'Dinheiro insuficiente (' + fmtMoney(s.cost) + ').';
    this.funds -= s.cost; this.sys[name] = true;
    this.msg('✔ ' + s.label + ' instalados.', 'good');
    return null;
  }
  pestControl(f) {
    if (!f.bugs) return 'Sem infestação.';
    if (this.funds < PEST_COST) return 'Dinheiro insuficiente.';
    this.expense('daily', PEST_COST);
    f.bugs = 0; f.dirty = true; f.cleaner = null;
    this.msg('🧪 Dedetização feita no quarto do andar ' + floorLabel(f.L) + '. Falta a limpeza.', 'good', f);
    return null;
  }
  // ---------- alertas: causa, efeito e solução
  alerts() {
    const out = [], lbl = f => FAC[f.k].label + ' (andar ' + floorLabel(f.L) + ')';
    const sec = this.facs.find(f => f.k === 'security' && f.build >= 1), hk = this.facs.find(f => f.k === 'housekeeping' && f.build >= 1);
    const goto = f => ({type: 'goto', L: f.L, x: f.x + f.w / 2, fac: f, label: 'Ir até lá'});
    const hireSec = sec ? {type: 'hire', fac: sec, label: '+ Segurança', cost: HIRE_COST} : null;
    const respond = f => f.responder && !f.responder.dead && f.responder.task === f;
    for (const f of this.facs) {
      if (f.fire) {
        out.push({sev: 2, title: '🔥 Incêndio: ' + lbl(f), cause: f.fireCause || 'Foco de incêndio',
          effect: 'O fogo cresce, pode se espalhar para as salas vizinhas e, se queimar tudo, vira ruína e os inquilinos vão embora.',
          status: respond(f) ? 'Um segurança está combatendo ou a caminho.' : f.truck ? 'Os bombeiros estão a caminho (' + TRUCK.trucks + ' caminhões): a equipe sobe pelas escadas (R$ 50.000 no total).' : this.corrNear(f, 'hyd') && !this.stairReach(f) ? 'Há hidrante, mas falta escada ou escada rolante contínua do térreo até aqui: os bombeiros não conseguem subir.' : sec ? 'Aguardando um segurança livre; se demorar, o helicóptero é chamado (R$ 150.000).' : 'Sem posto de segurança: só o helicóptero (R$ 150.000) pode apagar.',
          actions: [goto(f), !this.corrNear(f, 'spr') && this.star >= FAC.corridorSpr.star && {type: 'build', what: 'corridorSpr', label: 'Construir corredor com sprinklers'}, hireSec, !sec && this.star >= FAC.security.star && {type: 'build', what: 'security', label: 'Construir posto de segurança'}, !this.corrNear(f, 'ext') && {type: 'build', what: 'corridorExt', label: 'Construir corredor com extintor'}, !this.corrNear(f, 'hyd') && this.star >= FAC.corridorHyd.star && {type: 'build', what: 'corridorHyd', label: 'Construir corredor com hidrante'}, this.corrNear(f, 'hyd') && !this.stairReach(f) && {type: 'build', what: 'stairs', label: 'Construir escada'}].filter(Boolean)});
      }
      if (f.bomb) out.push({sev: 2, title: '💣 Ameaça de bomba: ' + lbl(f), cause: 'Ameaça anônima ao prédio.', effect: 'Se ninguém desarmar em tempo, explode: perda de R$ 300.000 e a sala vira ruína.',
        status: respond(f) ? 'Um segurança está a caminho.' : 'Aguardando segurança livre.', actions: [goto(f), hireSec].filter(Boolean)});
      if (f.fight) out.push({sev: 2, title: '👊 Briga: ' + lbl(f), cause: 'Multidão estressada num local público' + (this.guardsFor(f) ? ' com pouca cobertura de segurança.' : this.secPosts(f).length ? ' sem segurança em serviço agora.' : ' fora da área de qualquer posto de segurança.'),
        effect: 'Se ninguém apartar: feridos, indenização de R$ 80.000 e queda da segurança do prédio (os inquilinos avaliam pior).',
        status: respond(f) ? 'Um segurança está a caminho.' : 'Aguardando segurança livre.',
        actions: [goto(f), hireSec, !this.corrNear(f, 'cam') && {type: 'build', what: 'corridorCam', label: 'Construir corredor com câmera'}, !this.secPosts(f).length && this.star >= FAC.security.star && {type: 'build', what: 'security', label: 'Construir posto de segurança'}].filter(Boolean)});
      if (f.bugs) out.push({sev: 1, title: '🪳 Baratas: ' + lbl(f), cause: 'Quarto deixado sujo por muito tempo (comida por perto ajuda).', effect: 'Hóspedes fogem e a infestação se espalha para os quartos vizinhos.',
        status: f.cleaner && !f.cleaner.dead ? 'Uma camareira está tratando.' : hk ? 'Aguardando camareira livre.' : 'Sem camareiras.',
        actions: [goto(f), {type: 'pest', fac: f, label: 'Dedetizar agora', cost: PEST_COST}, hk && {type: 'hire', fac: hk, label: '+ Camareira', cost: HIRE_COST}].filter(Boolean)});
    }
    const hotels = this.facs.filter(f => FAC[f.k].hotel && f.build >= 1);
    if (hotels.length) {
      const dirty = hotels.filter(f => f.dirty || f.bugs).length, share = dirty / hotels.length, minRep = hotels.reduce((m, h) => Math.min(m, h.rep), 100);
      if (share > 0.1 || minRep < 70) {
        const maids = this.people.filter(p => !p.dead && p.kind === 'staff' && p.home && p.home.k === 'housekeeping' && p.st !== 'away').length;
        out.push({sev: share > 0.2 ? 2 : 1, title: '🧹 Quartos sujos acumulando (' + dirty + ' de ' + hotels.length + ')',
          cause: hk ? maids + ' camareira(s) em serviço não dão conta da demanda.' : 'O prédio não tem camareiras.',
          effect: 'A reputação dos quartos por perto cai (a pior está em ' + Math.round(minRep) + '%), vêm menos hóspedes e as baratas aparecem.',
          status: 'Quartos sujos não podem ser alugados até serem limpos.',
          actions: [hk ? {type: 'hire', fac: hk, label: '+ Camareira', cost: HIRE_COST} : {type: 'build', what: 'housekeeping', label: 'Construir camareiras'}, hk && !this.shafts.some(s => s.k === 'service') && {type: 'build', what: 'service', label: 'Elevador de serviço'}].filter(Boolean)});
      }
    }
    for (const s of this.shafts) {
      if (s.carlift) {
        const wm = this.liftWaitMin(s);
        if (wm >= CARLIFT.giveUp / 2) out.push({sev: wm >= CARLIFT.giveUp ? 2 : 1, title: '⏳ Fila no elevador de carros (' + Math.round(s.rush) + ' carros, ' + wm.toFixed(1).replace('.', ',') + ' min)', cause: s.cars.length + ' cabine(s) escoam ' + CARLIFT.rate * s.cars.length + ' carros por minuto.', effect: 'Os motoristas ficam estressados e, acima de ' + CARLIFT.giveUp + ' min, desistem das vagas de lá.', status: '', actions: [{type: 'goto', L: Math.round((s.lo + s.hi) / 2), x: s.x + s.w / 2, fac: s, label: 'Ir até lá'}, s.cars.length < LIMITS.carsPerShaft && {type: 'car', shaft: s, label: '+ Cabine', cost: TRANSPORT[s.k].carCost}].filter(Boolean)});
        continue;
      }
      let w = 0; for (const k in s.q) w += s.q[k].length;
      if (w >= 12) out.push({sev: w >= 25 ? 2 : 1, title: '⏳ Fila grande no elevador (' + w + ' esperando)', cause: 'Poucas cabines para o movimento (' + s.cars.length + ' cabine(s), andares ' + floorLabel(s.lo) + '–' + floorLabel(s.hi) + ').',
        effect: 'O estresse sobe, a avaliação dos inquilinos cai e eles se mudam.', status: '',
        actions: [{type: 'goto', L: Math.round(s.cars[0].y), x: s.x + s.w / 2, fac: s, label: 'Ir até lá'}, s.cars.length < LIMITS.carsPerShaft && {type: 'car', shaft: s, label: '+ Cabine', cost: TRANSPORT[s.k].carCost}].filter(Boolean)});
    }
    const poor = this.facs.filter(f => FAC[f.k].tenant && f.occ && f.build >= 1 && f.eval < 100).slice(0, 4);
    for (const f of poor) {
      const br = this.evalBreakdown(f).filter(o => o.v < 0).sort((a, b) => a.v - b.v)[0];
      const fix = [goto(f)];
      let advice = '';
      if (br && br.key === 'noise') advice = 'Afaste comércio barulhento (lojas, restaurantes) deste andar.';
      else if (br && br.key === 'stress') advice = 'Reduza as esperas: mais cabines, outro poço ou escadas rolantes.';
      else if (br && br.key === 'access') advice = 'Ligue esta sala por piso contínuo a um elevador ou escada.';
      else if (br && ['theft', 'fight', 'bomb'].includes(br.key)) advice = 'Ocorrência recente por perto: cubra a área com um posto de segurança e corredores com câmera; o efeito some sozinho em alguns dias.';
      else if (br && br.key === 'rep') advice = 'Quartos sujos por perto: contrate camareiras e ligue-as aos quartos por elevador de serviço.';
      if (f.price < 3 && FAC[f.k].prices) fix.push({type: 'price', fac: f, level: f.price + 1, label: 'Baixar preço', cost: 0});
      out.push({sev: 1, title: '😠 Inquilino insatisfeito: ' + lbl(f), cause: br ? br.label : 'Avaliação baixa.', effect: 'Se continuar ruim por 2 dias, ele se muda' + (FAC[f.k].condo ? ' e o valor da venda é devolvido.' : '.'),
        status: advice, actions: fix});
    }
    for (const f of this.facs) if (FAC[f.k].biz && f.closed && f.build >= 1) out.push({sev: 1, title: '🏪 Ponto vago: ' + lbl(f), cause: 'O comerciante se mudou: ' + (f.closeWhy || 'sem movimento') + '.', effect: 'Sem renda, sem clientes e o serviço some da vizinhança (as unidades por perto perdem o bônus).', status: 'Aumente o movimento por perto e a segurança: um novo comerciante abre sozinho quando melhorar.', actions: [goto(f)]});
    for (const f of this.facs) if (FAC[f.k].waste && !FAC[f.k].waste.process && f.build >= 1 && this.star >= SVC_STAR.lixo && (f.lixo || 0) >= LIXO.annoy * FAC[f.k].waste.cap) {
      const lv = f.lixo / FAC[f.k].waste.cap;
      out.push({sev: lv >= 1 ? 2 : 1, title: '🗑️ Lixo ' + (lv >= 1 ? 'transbordando' : 'acumulando') + ': ' + lbl(f), cause: 'O depósito está com ' + Math.round(lv * 100) + '% da capacidade.', effect: 'Quem mora ou trabalha por perto vai ficando descontente' + (lv >= 1 ? ' (o lixo já transborda).' : ', cada vez mais até a coleta.'),
        status: f.truckEta ? 'O caminhão está a caminho.' : 'Chame o caminhão para esvaziar o depósito.', actions: [goto(f), !f.truckEta && {type: 'garbage', fac: f, label: 'Chamar caminhão', cost: LIXO.cost}].filter(Boolean)});
    }
    for (const [loose, what, title, cause, effect] of [
      [this.facs.filter(f => FAC[f.k].park && this.vehUnlinked(f)), 'parkramp', 'vaga(s)', l => 'Sem ligação com a entrada dos carros (rampa, túnel com portal ou elevador de carros que chegue ao térreo; direto ou por uma fileira de vagas, do lado certo da saída). ' + this.vehWhy(l[0]), 'Os carros não chegam: as vagas não funcionam, não são ocupadas e não rendem.'],
      [this.facs.filter(f => FAC[f.k].needRamp && this.vehUnlinked(f)), 'parkramp', 'ponto(s) de ônibus/táxi', 'No subsolo o ponto precisa estar ligado à rua por rampa ou túnel com portal (do lado certo da saída; o elevador de carros não liga pontos).', 'Os veículos não chegam: o ponto não atende ninguém e o transporte público não conta.'],
    ]) if (loose.length) out.push({sev: 1, title: '🅿️ ' + loose.length + ' ' + title + ' sem ligação com a entrada dos carros (andar ' + floorLabel(loose[0].L) + ')', cause: typeof cause === 'function' ? cause(loose) : cause, effect, status: 'Encoste numa rampa de carros ou num túnel ligado à rua.', actions: [{type: 'goto', L: loose[0].L, x: loose[0].x + loose[0].w / 2, fac: loose[0], label: 'Ir até lá'}, {type: 'build', what, label: 'Construir rampa'}]});
    for (const s of this.shafts) if (s.dark) {
      const lbl = TRANSPORT[s.k].label, cl = s.carlift;
      out.push({sev: 1, title: '⚡ ' + lbl + ' sem energia (andares ' + floorLabel(s.lo) + '–' + floorLabel(s.hi) + ')', cause: 'O elevador está parado: ' + this.darkText(s), effect: cl ? 'As vagas que dependem dele ficam sem ligação e a entrada de carros por ele não funciona.' : 'As cabines param: ninguém espera por elas, todos vão de escada.', status: 'Veja a visão ⚡ Energia no mapa.', actions: [{type: 'goto', L: Math.round((s.lo + s.hi) / 2), x: s.x + s.w / 2, fac: s, label: 'Ir até lá'}, {type: 'build', what: 'gerador', label: 'Construir gerador'}]});
    }
    const roladasParadas = this.stairs.filter(s => s.k === 'escalator' && s.dark);
    if (roladasParadas.length) out.push({sev: 1, title: '⚡ ' + roladasParadas.length + ' escada(s) rolante(s) sem energia', cause: 'Sem energia a escada rolante vira uma escada comum: ' + this.darkText(roladasParadas[0]), effect: 'Mais lenta e cansativa: sobe o estresse de quem usa.', status: 'Veja a visão ⚡ Energia no mapa.', actions: [{type: 'goto', L: roladasParadas[0].L, x: roladasParadas[0].x + roladasParadas[0].w / 2, fac: roladasParadas[0], label: 'Ir até lá'}, {type: 'build', what: 'gerador', label: 'Construir gerador'}]});
    const presos = this.facs.filter(f => f.stuck && f.owner);
    if (presos.length) out.push({sev: 2, title: '🚗 ' + presos.length + ' carro(s) preso(s) na garagem (andar ' + floorLabel(presos[0].L) + ')', cause: this.vehWhy(presos[0]), effect: 'Os donos saíram a pé e os carros ficam nas vagas (que não liberam para outros) até a ligação voltar.', status: 'Quando a ligação volta, os carros saem sozinhos.', actions: [{type: 'goto', L: presos[0].L, x: presos[0].x + presos[0].w / 2, fac: presos[0], label: 'Ir até lá'}]});
    const orfaos = this.shafts.filter(s => s.carlift && !s.dark && !this.vehLinked().has(s));
    if (orfaos.length) out.push({sev: 1, title: '🚗 ' + orfaos.length + ' elevador(es) de carros sem ligação com a entrada dos carros (andar ' + floorLabel(orfaos[0].hi) + ')', cause: 'Nenhuma vaga ligada à rua, rampa ou túnel encosta neles.', effect: 'As vagas dos níveis dele ficam sem ligação e não funcionam.', status: 'Encoste o elevador numa vaga que chegue à rampa ou ao portal (ou direto neles).', actions: [{type: 'goto', L: orfaos[0].hi, x: orfaos[0].x + orfaos[0].w / 2, fac: orfaos[0], label: 'Ir até lá'}]});
    const unreach = this.facs.filter(f => this.needsAccess(f) && f.build >= 1 && !this.reachable(f)).slice(0, 3);
    const dry = this.facs.filter(f => f.build >= 1 && !f.dead && (f.cutWhyE === 'reach' || f.cutWhyA === 'reach') && FAC[f.k].k !== 'ruin');
    if (dry.length) { const top = dry.slice().sort((a, b) => b.L - a.L)[0], noE = dry.filter(f => f.cutWhyE === 'reach').length, noA = dry.filter(f => f.cutWhyA === 'reach').length;
      out.push({sev: 1, title: '⚡ ' + dry.length + ' sala(s) fora do alcance de energia ou água (do andar ' + floorLabel(dry.slice().sort((a, b) => a.L - b.L)[0].L) + ' ao ' + floorLabel(top.L) + ')', cause: 'Nenhuma fonte chega até elas: ' + (noE ? noE + ' sem energia (gerador, bateria ou rede a até ' + Math.round(UTIL.reach.own / PROX.floorUnits) + ' andares)' : '') + (noE && noA ? ' e ' : '') + (noA ? noA + ' sem água (bomba a até ' + Math.round(FAC.bomba.util.reach / PROX.floorUnits) + ' andares, ou caixa)' : '') + '.',
        effect: 'Ficam escuras: comércio fecha, ninguém atende nelas, o humor cai e os moradores se mudam.', status: 'Veja as visões ⚡ Energia e 💧 Água no mapa.', actions: [goto(top), {type: 'build', what: 'gerador', label: 'Construir gerador'}, this.star >= FAC.bateria.star && {type: 'build', what: 'bateria', label: 'Construir bateria'}].filter(Boolean)}); }
    for (const f of unreach) out.push({sev: 1, title: '🚫 Sala sem acesso: ' + lbl(f), cause: 'Não há piso contínuo ligando esta sala a um elevador ou escada que chegue ao térreo.', effect: 'Ninguém consegue chegar: ' + (FAC[f.k].svc && !FAC[f.k].tenant && !FAC[f.k].commercial && !FAC[f.k].hotel ? 'o serviço não atende ninguém por perto.' : 'a sala fica vazia e não rende.'), status: 'Preencha o vão com piso ou salas, ou encoste o elevador.', actions: [goto(f)]});
    if (this.pop > 400 && !sec) out.push({sev: 1, title: '🛡 Prédio sem posto de segurança', cause: 'Com ' + this.pop + ' pessoas, incêndios, bombas e brigas ficam sem resposta.', effect: 'Incêndios queimam salas, bombas custam R$ 300.000 e brigas derrubam a segurança do prédio.', status: '', actions: [{type: 'build', what: 'security', label: 'Construir posto de segurança'}]});
    return out.sort((a, b) => b.sev - a.sev);
  }
  hygieneRisk() {
    const hotels = this.facs.filter(f => FAC[f.k].hotel && f.build >= 1);
    const dirty = hotels.filter(f => f.dirty || f.bugs).length;
    const maids = this.people.filter(p => !p.dead && p.kind === 'staff' && p.home && p.home.k === 'housekeeping' && p.st !== 'away').length;
    const share = hotels.length ? dirty / hotels.length : 0;
    return {level: share > 0.2 ? 2 : share > 0.1 ? 1 : 0, factors: [hotels.length + ' quarto(s) de hotel, ' + dirty + ' sujo(s)', maids + ' camareira(s) em serviço', 'Pior reputação de quarto: ' + Math.round(hotels.reduce((m, h) => Math.min(m, h.rep), 100)) + '%', this.shafts.some(s => s.k === 'service') ? '✔ Elevador de serviço disponível' : 'Sem elevador de serviço (trajetos mais lentos)']};
  }
  bombEvent() {
    const c = this.facs.filter(f => f.build >= 1 && !FAC[f.k].struct && f.k !== 'ruin' && !f.bomb);
    if (!c.length) return;
    const f = pick(c);
    if (this.secPosts(f).length) {
      f.bomb = this.t + 240;
      this.msg('💣 Ameaça de bomba no andar ' + floorLabel(f.L) + '! A segurança foi acionada.', 'bad', f);
    } else {
      this.msg('💣 Ameaça de bomba no andar ' + floorLabel(f.L) + ', fora da área de qualquer posto de segurança! Um helicóptero traz o dinheiro do resgate.', 'bad', f);
      this.callHeli(this.topBuilt(), this.towerX(), 'bomb');
    }
  }
  calcStats() {
    let pop = 0;
    for (const f of this.facs) {
      if (f.build < 1) continue;
      if (f.occ || FAC[f.k].staff) pop += f.persons.length;
      pop += f.guests.filter(g => g.paid).length;
    }
    this.pop = pop;
  }
  updateStars() {
    this.calcStats();
    let st = this.star;
    for (let s = st + 1; s <= 5; s++) {
      if (this.pop >= STAR_POP[s] && (!STAR_NEEDS_GOOD[s] || this.avgEval >= 100)) st = s; else break;
    }
    if (this.landmarkDone && st >= 5) st = 6;
    if (st > this.star) {
      this.star = st;
      this.msg(st === 6 ? '🏆 Torre completa! Você alcançou a classificação máxima.' : '★ Nova estrela! Você tem ' + st + ' estrelas.', 'good');
      this.emit('star', {star: st});
    }
  }
  demandsList() {
    const out = [], nx = this.star + 1;
    if (nx > 6) return out;
    if (nx <= 5) {
      out.push({met: this.pop >= STAR_POP[nx], text: 'População: ' + this.pop + ' de ' + STAR_POP[nx] + ' pessoas'});
      if (STAR_NEEDS_GOOD[nx]) out.push({met: this.avgEval >= 100, text: 'Avaliação média: ' + Math.round(this.avgEval) + ' de ' + EVAL_GOOD + ' (nota "Boa")'});
    } else {
      out.push({met: this.landmarkDone, text: 'Construir a Capela celeste'});
    }
    return out;
  }

  // ------------------------------------------------------------ passo da simulação
  tick(dtReal) {
    if (!this.speed) return;
    const rem = Math.min(dtReal, 0.1) * this.speed, n = Math.min(10, Math.ceil(rem / 0.1)), h = rem / n;
    const t0 = Date.now();
    for (let i = 0; i < n; i++) {
      this.step(h);
      if (Date.now() - t0 > 40) { this.slow = (this.slow || 0) + 1; break; }   // nunca gasta mais de ~40 ms de CPU por quadro
    }
  }
  step(h) {
    if (this.god) { if (this.funds < 1e12) this.funds = 1e12; for (const f of this.facs) if (f.build < 1) f.build = 1; }   // modo deus (cheats)
    this.simT += h;
    const dm = h * MIN_PER_SEC;
    this.t += dm;
    const d = this.day;
    if (d !== this.lastDay) { this.lastDay = d; this.newDay(); }
    // obras
    for (const f of this.facs) {
      if (f.build < 1) {
        f.build = Math.min(1, f.build + dm / f.dur);
        if (f.build >= 1) this.onBuilt(f);
      }
      if (f.fire) {
        const spr = this.corrNear(f, 'spr');
        f.fire += dm / (180 * (spr ? CORR.sprSlow : 1));
        if (f.fire && f.fire < CORR.extMax) this.tryExtinguish(f, dm);
        if (spr && f.fire > CORR.sprContain) {
          this.addFx('spr', f, {level: f.fire});
          f.fire = 0; f.fighting = false; f.heliCalled = false;
          this.msg('🚿 Os sprinklers contiveram o incêndio no andar ' + floorLabel(f.L) + '.', 'good', f);
        } else {
          if (!f.spread && f.fire > 1.45) {
            f.spread = true;
            const nb = this.spreadTargets(f).filter(t => !t[0].fire);
            if (nb.length) { const [o, pr] = pick(nb); if (Math.random() < pr) { this.ignite(o, 'Fogo vindo do andar ' + floorLabel(f.L)); this.msg('🔥 O fogo se espalhou para o andar ' + floorLabel(o.L) + '!', 'bad', f); } }
          }
          const handled = f.responder && !f.responder.dead && f.responder.task === f;
          if (!handled && !f.truck && !(f.truckT > this.t) && f.fire > TRUCK.callAt && this.funds >= TRUCK.cost && this.corrNear(f, 'hyd') && this.stairReach(f)) this.callTruck(f);
          if (!handled && (!f.truck || f.fire > TRUCK.backup) && f.fire > 1.3 && !this.heli && this.funds >= 150000 && !f.heliCalled) { f.heliCalled = true; this.callHeli(f.L + f.h, f.x + f.w / 2, 'fire'); this.heli.fac = f; }
          if (f.fire >= 2) { f.fire = 0; f.heliCalled = false; f.fighting = false; this.burn(f); }
        }
      }
      if (f.fight && this.t > f.fight) {
        f.fight = null; f.responder = null;
        this.addIncident('fight', f);
        this.expense('daily', 80000);
        this.addFx('amb', f);
        this.msg('🚑 A briga no andar ' + floorLabel(f.L) + ' saiu do controle: feridos! Indenização de ' + fmtMoney(80000) + '; o humor do local e dos vizinhos caiu.', 'bad', f);
      }
      if (f.bomb && this.t > f.bomb) {
        const L = f.L; f.bomb = null; f.responder = null;
        this.expense('daily', 300000);
        this.addFx('boom', f); this.addIncident('bomb', f);
        this.msg('💥 A bomba explodiu no andar ' + floorLabel(L) + '! Prejuízo de ' + fmtMoney(300000) + '.', 'bad');
        this.burn(f);
        break;
      }
    }
    const hr = Math.floor(this.minute / 60);
    if (hr !== this.lastHr) { this.lastHr = hr; this.utilEvents(); this.updateEval(false); if (hr >= 21 || hr < 5) this.crimeCheck(); }
    this.dispT = (this.dispT || 0) + h;
    if (this.dispT > 1) { this.dispT = 0; this.dispatch(); }
    if (this.pendingHeli && this.pendingHeli.length) { const due = this.pendingHeli.filter(e => this.t >= e.t); if (due.length) { this.pendingHeli = this.pendingHeli.filter(e => this.t < e.t); this.callHeli(due[0].L, due[0].x, 'vip'); } }
    this.updCars(h); this.updHeli(h); this.updTrucks(dm); this.updSanta(h);
    if (this.fxs.length) this.fxs = this.fxs.filter(e => this.simT - e.t0 < e.dur);
    for (const f of this.facs) if (f.k === 'transit' && f.build >= 1) {
      const ph = this.trainState(f).phase;
      if (f.lph !== ph) { if (ph === 'arrive') this.emit('sound', {name: 'train', L: f.L, x: f.x + f.w / 2}); f.lph = ph; }
    }
    if (WEATHER[this.weather].storm && this.rain > 0.3) { this.lightT = (this.lightT === undefined ? rnd(2, 6) : this.lightT) - h; if (this.lightT <= 0) { this.lightT = rnd(STORM.flash[0], STORM.flash[1]); this.flashT = this.simT; this.emit('sound', {name: 'thunder', L: 0, x: this.towerX()}); } }
    const rt = this.rainWin && this.t >= this.rainWin[0] && this.t <= this.rainWin[1] ? 1 : 0;
    this.rain += (rt - this.rain) * Math.min(1, h * 0.4);
    this.utilFresh();
    for (const s of this.shafts) if (!s.dark) { if (s.carlift && s.trips) for (const t of s.trips) if (t.delay > 0) t.delay -= h; for (const c of s.cars) { if (s.carlift) this.updCarLift(s, c, h); else this.updCar(s, c, h); } }
    for (const p of this.people) if (!p.dead) this.updPerson(p, h);
    this.gc += h;
    if (this.gc > 1) {
      this.gc = 0;
      if (this.people.some(p => p.dead)) {
        for (const p of this.people) if (p.dead && p.kind === 'guest' && p.home && !p.home.dead) {
          p.home.guests = p.home.guests.filter(g => g !== p);
          if (!p.home.guests.length && p.paid) p.home.dirty = true;
        }
        for (const f of this.facs) if (f.owner && f.owner.dead) f.owner = null;
        this.people = this.people.filter(p => !p.dead);
        for (const f of this.facs) if (f.persons.some(p => p.dead)) f.persons = f.persons.filter(p => !p.dead);
      }
    }
  }
  onBuilt(f) {
    const def = FAC[f.k];
    if (f.k === 'landmark') { this.landmarkDone = true; this.updateStars(); }
    if (def.staff) {
      for (let i = 0; i < def.pop; i++) f.persons.push(this.mkPerson('staff', f));
      f.persons.forEach((p, i) => { p.plan = [{t: this.t + rnd(5, 40), act: 'go', fac: f}, ...this.staffPlan(f, p, i, Math.floor(this.t / 1440) * 1440).filter(e => e.act === 'leave')]; });
    }
    this.calcStats();
  }
  makeRuin(L, u, was) {
    const r = {id: this.nextId++, cat: 'fac', k: 'ruin', L, x: u, w: BOX, h: 1, price: 1, build: 1, dur: 1, occ: false, persons: [], eval: 0, poorDays: 0, dirty: false, guest: null, fire: 0, dead: false, stress: 0, guests: [], emp: [], film: 0, was};
    this.facs.push(r); for (let v = u; v < u + BOX; v++) this.grid.set(L, v, r);
    return r;
  }
  burn(f) {
    this.msg('O fogo destruiu o ' + FAC[f.k].label.toLowerCase() + ' do andar ' + floorLabel(f.L) + '. Sobrou uma ruína.', 'bad', f);
    const L = f.L, x = f.x, w = f.w, was = {k: f.k, x, w, h: f.h};
    this.removeFac(f);
    for (let u = x; u < x + w; u += BOX) this.makeRuin(L, u, was);
    this.dirty();
  }
  ruinGroup(r) {
    const w = r.was;
    return w ? this.facs.filter(o => o.k === 'ruin' && o.L === r.L && o.was && o.was.k === w.k && o.was.x === w.x && o.was.w === w.w) : [];
  }
  rebuildCost(r) {
    const w = r.was;
    return w ? Math.round(FAC[w.k].cost * w.w / FAC[w.k].w * CORR.rebuildMult) : null;
  }
  // reconstrói a sala queimada pelo mesmo tipo, com desconto; se não couber, devolve as ruínas
  rebuild(r) {
    const w = r.was;
    if (r.k !== 'ruin' || !w) return 'Esta ruína não pode ser reconstruída.';
    const ruins = this.ruinGroup(r);
    for (const o of ruins) this.removeFac(o);
    const res = this.placeFac(w.k, r.L, w.x, {mult: CORR.rebuildMult});
    if (!res.ok) {
      for (const o of ruins) this.makeRuin(o.L, o.x, w);
      this.dirty();
      return res.err;
    }
    this.msg('🔨 Reconstrução do ' + FAC[w.k].label.toLowerCase() + ' iniciada no andar ' + floorLabel(r.L) + '.', 'good');
    return null;
  }

  // ------------------------------------------------------------ salvar / carregar
  // Salva a torre inteira, inclusive as pessoas (onde estão, a agenda, a família) e os eventos em andamento.
  serialize() {
    const fi = new Map(this.facs.map((f, i) => [f, i])), idx = f => (f && fi.has(f) ? fi.get(f) : -1);
    const people = [], pidx = new Map();
    for (const p of this.people) {
      if (p.dead || p.kind === 'firefighter') continue;
      const o = {k: p.kind, h: idx(p.home), l: p.look, z: Math.round(p.stress)};
      if (p.kind !== 'visitor') { o.n = p.name; o.g = p.age; }
      if (p.prof) o.f = p.prof;
      if (p.paid) o.pd = 1;
      if (p.nights) o.ns = p.nights;
      if (p.job) o.j = idx(p.job); else if (p.job === null) o.j = -2;
      if (p.st === 'away') o.s = 'away';
      else {
        // como entrou no prédio (carro na vaga, metrô, ponto, rua): sem isso a vaga esvazia e a pessoa sai por outro lugar
        if (p.via) o.v = [p.via.type, idx(p.via.fac || p.via.space), p.via.L, +p.via.x.toFixed(1)];
        // quem está em trânsito (andando, na fila, no elevador) é salvo parado, com o destino para retomar o trajeto
        let L = p.L, dest = p.dest, at = p.at;
        if (p.st === 'stair' && p.stair) L = p.stair.from;
        if (p.st === 'work' && p.task) { at = p.task; dest = p.home && !p.home.dead ? {fac: p.home} : null; }
        o.s = 'idle'; o.L = L; o.x = +p.x.toFixed(1); o.a = idx(at);
        if (dest) o.d = dest.exit ? -2 : idx(dest.fac);
      }
      o.p = p.plan.filter(e => e.act !== 'go' || idx(e.fac) >= 0).map(e => [Math.round(e.t * 10) / 10, e.act === 'go' ? idx(e.fac) : -1]);
      pidx.set(p, people.length); people.push(o);
    }
    return {
      v: SAVE_VERSION, funds: this.funds, t: this.t, star: this.star, film: this.film, landmarkDone: this.landmarkDone, outage: this.outage, store: this.store, wx: this.weather, fc: this.forecast, lobbyH: this.lobbyH, speed: this.speed, ph: this.pendingHeli && this.pendingHeli.length ? this.pendingHeli : undefined, log: this.log,
      fin: this.fin, hist: this.hist, uh: this.uhist, sys: this.sys, inc: this.incidents.map(i => [i.k, i.x, i.w, i.L, i.h, Math.round(i.t * 10) / 10]), rain: this.rain, rainWin: this.rainWin,
      trucks: this.trucks.map(t => ({x: t.x, x0: t.x0, dir: t.dir, goal: t.goal, door: t.door, spd: t.spd, phase: t.phase, hold: t.hold, fac: idx(t.fac)})),
      santa: this.santa ? {x: this.santa.x, end: this.santa.end, y: this.santa.y, claimed: this.santa.claimed, t0: this.santa.t0} : null,
      heli: this.heli ? {x: this.heli.x, dir: this.heli.dir, tx: this.heli.tx, L: this.heli.L, reason: this.heli.reason, phase: this.heli.phase, hold: this.heli.hold, alt: this.heli.alt, fac: idx(this.heli.fac)} : null,
      slab: this.slab.levels().map(L => { const [lo, hi] = this.slab.bounds(L); return [L, this.slab.runs(L, lo, hi)]; }).filter(e => e[1].length).sort((a, b) => a[0] - b[0]),
      facs: this.facs.map(f => ({k: f.k, L: f.L, x: f.x, w: f.k === 'lobby' ? f.w : undefined, h: f.h, price: f.price, build: f.build, occ: f.occ, eval: f.eval, ed: f.evalDay, film: f.film, sty: f.sty, dirty: f.dirty, name: f.name || '', bugs: f.bugs || 0,
        poorDays: f.poorDays || 0, jc: f.jobCap, shift: f.shift, fam: f.family, nt: f.newTenant ? 1 : 0, fire: f.fire || 0, fc: f.fireCause, sp: f.spread ? 1 : 0, bomb: f.bomb || 0, fight: f.fight || 0, rep: f.rep,
        vip: f.vip && pidx.has(f.vip) ? pidx.get(f.vip) : -1, was: f.was, dr: f.dir || undefined, ln: f.k === 'transit' ? f.line : undefined, lx: f.lixo ? Math.round(f.lixo * 10) / 10 : undefined, cl: f.closed ? 1 : undefined, ci: f.idle || undefined, cw: f.closeWhy || undefined, te: f.truckEta ? Math.round(f.truckEta) : undefined, lv: f.lvl ? Math.round(f.lvl * 10) / 10 : undefined,
        cc: f.owner ? f.carCol : undefined, tr: f.trend ? Math.round(f.trend * 100) / 100 : undefined, hc: f.heliCalled ? 1 : undefined, tt: f.truckT > this.t ? Math.round(f.truckT) : undefined, rs: f.rush > 0 ? Math.round(f.rush * 100) / 100 : undefined})),
      shafts: this.shafts.map(s => ({k: s.k, x: s.x, lo: s.lo, hi: s.hi, cars: s.cars.length, cy: s.cars.map(c => +c.y.toFixed(2)), off: Object.keys(s.off).map(Number), hidden: s.hidden, rs: s.rush > 0 ? Math.round(s.rush * 100) / 100 : undefined})),
      stairs: this.stairs.map(s => ({k: s.k, L: s.L, x: s.x})),
      people,
    };
  }
  load(d) {
    this.reset();
    this.funds = d.funds; this.t = d.t; this.star = d.star; this.film = d.film || 0; this.landmarkDone = !!d.landmarkDone; this.outage = {energia: (d.outage && d.outage.energia) || 0, agua: (d.outage && d.outage.agua) || 0}; this._utk = null; this.store = {energia: (d.store && d.store.energia) || 0, agua: (d.store && d.store.agua) || 0}; this.weather = WEATHER[d.wx] ? d.wx : 'sol'; this.forecast = WEATHER[d.fc] ? d.fc : 'sol';
    this.lobbyH = d.lobbyH || 1; this.speed = d.speed === undefined ? 1 : d.speed; this.pendingHeli = Array.isArray(d.ph) ? d.ph : null; this.log = Array.isArray(d.log) ? d.log.slice(0, 40) : []; if (d.fin) this.fin = d.fin; this.hist = d.hist || []; this.uhist = Array.isArray(d.uh) ? d.uh.slice(-72) : []; this.sys = {}; this.incidents = (d.inc || []).map(([k, x, w, L, h, t]) => ({k, x, w, L, h, t}));
    for (const [k, cost] of [['sprinkler', 600000], ['cameras', 400000]]) if (d.sys && d.sys[k]) { this.funds += cost; this.msg('O sistema de ' + (k === 'cameras' ? 'câmeras' : 'sprinklers') + ' do prédio inteiro foi substituído por corredores que protegem uma área: ' + fmtMoney(cost) + ' devolvidos.', 'good'); }
    this.rain = d.rain || 0; this.rainWin = d.rainWin || null; this.santa = d.santa ? {end: d.santa.x + 600, ...d.santa} : null;
    // formato novo (v4): [[andar, trechos], ...]; formato antigo: um item por andar a partir do B10 (índice 0 = andar -10)
    const slabs = (d.v ?? 1) >= 4 ? d.slab : d.slab.map((runs, i) => [i - 10, runs]);
    for (const [L, runs] of slabs) for (const [a, b] of runs) for (let u = a; u <= b; u++) this.slab.set(L, u, 1);
    for (const o of d.facs) {
      const def = FAC[o.k];
      const f = {id: this.nextId++, sty: o.sty ?? this.nextId, cat: 'fac', k: o.k, L: o.L, x: o.x, w: o.w || def.w, h: o.h, price: o.price, build: o.build, dur: o.k === 'lobby' ? 15 : def.cost >= 500000 ? 240 : 60,
                 occ: o.occ, persons: [], eval: o.eval, evalDay: o.ed, trend: 0, poorDays: o.poorDays || 0, dirty: o.dirty, name: o.name || '', bugs: o.bugs || 0, guest: null, fire: o.fire || 0, dead: false, stress: 0, guests: [], emp: [], jobCap: o.jc, film: o.film || 0,
                 shift: o.shift, family: o.fam, newTenant: !!o.nt, fireCause: o.fc, spread: !!o.sp, bomb: o.bomb || 0, fight: o.fight || 0, was: o.was, rep: o.rep ?? 100, dir: def.slope || def.portal ? (o.dr === -1 ? -1 : 1) : 0, lixo: o.lx || 0, truckEta: o.te || 0, line: o.ln || 0, closed: !!o.cl, idle: o.ci || 0, closeWhy: o.cw || null, lvl: o.lv || 0,
                 trend: o.tr || 0, heliCalled: !!o.hc, truckT: o.tt || 0, rush: o.rs || 0, rt: o.rs ? this.t : undefined, carCol: o.cc};
      this.facs.push(f);
      for (let lev = f.L; lev < f.L + f.h; lev++) for (let u = f.x; u < f.x + f.w; u++) this.grid.set(lev, u, f);
    }
    for (const o of d.shafts) {
      const t = TRANSPORT[o.k];
      const s = {id: this.nextId++, cat: 'shaft', k: o.k, x: o.x, w: t.w, lo: o.lo, hi: o.hi, cars: [], q: {}, off: {}, hidden: !!o.hidden, stopsC: null, carlift: !!t.carlift, rush: o.rs || 0, rt: o.rs ? this.t : undefined};
      for (let i = 0; i < o.cars; i++) { const c = this.newCar(s); if (o.cy && o.cy[i] !== undefined) c.y = clamp(o.cy[i], s.lo, s.hi); s.cars.push(c); }
      const extra = Math.max(0, s.cars.length - LIMITS.carsPerShaft); s.cars.length -= extra;
      if (extra) { this.funds += extra * t.carCost; this.msg('O poço agora aceita no máximo ' + LIMITS.carsPerShaft + ' cabines: ' + extra + ' cabine(s) devolvida(s) por ' + fmtMoney(extra * t.carCost) + '.', 'good'); }
      for (const L of o.off || []) s.off[L] = true;
      this.shafts.push(s);
      for (let L = s.lo; L <= s.hi; L++) for (let u = s.x; u < s.x + s.w; u++) this.tg.set(L, u, s);
    }
    for (const o of d.stairs) {
      const t = TRANSPORT[o.k];
      const s = {id: this.nextId++, cat: 'stair', k: o.k, L: o.L, x: o.x, w: t.w};
      this.stairs.push(s);
      for (let u = s.x; u < s.x + s.w; u++) this.tg.set(s.L, u, s);
    }
    this.migrateStore();   // saves antigos guardavam um nível global de reservas: reparte entre as caixas e baterias pela capacidade
    this.dirty();
    this.lastDay = this.day;        // o dia já foi planejado: não roda newDay (evita cobrar tudo de novo)
    let ok = false;
    if (d.v >= 3 && Array.isArray(d.people)) {
      try { this.restorePeople(d); ok = true; }
      catch (e) { this.people = []; for (const f of this.facs) { f.persons = []; f.guests = []; f.vip = null; } }
    }
    if (!ok) this.legacyPeople(d);
    this.trucks = (d.trucks || []).map(t => ({x: t.x, x0: t.x0 ?? t.goal - 200 * Math.sign(t.dir), dir: t.dir, goal: t.goal, door: t.door ?? t.goal, spd: t.spd, phase: t.phase, hold: t.hold, crew: [], fac: t.fac >= 0 ? this.facs[t.fac] : null})).filter(t => t.fac && t.phase !== 'work');
    for (const t of this.trucks) if (t.phase === 'drive') t.fac.truck = true;
    if (d.heli) { this.heli = {x: d.heli.x, dir: d.heli.dir ?? (d.heli.x > d.heli.tx ? -1 : 1), tx: d.heli.tx, L: d.heli.L, reason: d.heli.reason, phase: d.heli.phase, hold: d.heli.hold, alt: d.heli.alt ?? 1, fac: d.heli.fac >= 0 ? this.facs[d.heli.fac] : null}; }
    this.calcStats();
  }
  restorePeople(d) {
    const fs = this.facs, F = i => (i >= 0 && i < fs.length ? fs[i] : null), list = d.people;
    const ps = list.map(o => {
      const home = F(o.h);
      const p = this.mkPerson(o.k, home, {prof: o.f, age: o.g, name: o.n, nights: o.ns});
      p.look = o.l; p.stress = o.z; p.paid = !!o.pd;
      if (o.k === 'vip' || (!home && (o.k === 'resident' || o.k === 'worker'))) p.transient = true;
      if (o.s === 'idle') {
        p.st = 'idle'; p.L = o.L; p.x = o.x; p.at = F(o.a);
        if (o.v) {
          const [type, i, L, x] = o.v, fac = F(i);
          if (type === 'car') { if (fac && fac.k === 'parkspace') p.via = {type, L, x, key: this.nodeAt(L, x), space: fac}; }
          else if (type === 'ground') p.via = {type, L, x};
          else if (fac) p.via = {type, L, x, key: this.nodeAt(L, x), fac};
        }
      }
      p.plan = (o.p || []).map(([t, i]) => (i >= 0 && fs[i] ? {t, act: 'go', fac: fs[i]} : {t, act: 'leave'}));
      if (home) { if (o.k === 'guest') home.guests.push(p); else if (o.k !== 'vip') home.persons.push(p); }
      return p;
    });
    d.facs.forEach((o, i) => { if (o.vip >= 0 && ps[o.vip]) fs[i].vip = ps[o.vip]; });
    // vaga ocupada: o dono é quem chegou de carro e ainda está no prédio (ou a caminho)
    ps.forEach(p => { if (p.via && p.via.type === 'car' && !p.via.space.owner) p.via.space.owner = p; });
    list.forEach((o, i) => {
      if (o.j >= 0 && fs[o.j]) { ps[i].job = fs[o.j]; fs[o.j].emp.push(ps[i]); } else if (o.j === -2) ps[i].job = null;
    });
    for (const f of fs) if (FAC[f.k].office && f.jobCap === undefined) f.jobCap = f.persons.length + f.emp.length;
    // retoma os trajetos interrompidos
    list.forEach((o, i) => {
      if (o.s !== 'idle' || o.d === undefined) return;
      if (o.d === -2) this.startExit(ps[i]); else if (o.d >= 0 && fs[o.d]) this.startTrip(ps[i], fs[o.d]);
    });
  }
  // save antigo (sem pessoas): recria moradores e equipe e coloca cada um onde deveria estar a esta hora
  legacyPeople(d) {
    this.facs.forEach((f, i) => {
      const o = d.facs[i] || {}, def = FAC[f.k];
      if (f.build < 1) return;
      if (f.occ && def.pop && f.k !== 'shop') { this.moveIn(f); f.newTenant = false; for (const p of f.persons) if (o.stress) p.stress = o.stress; }
      else if (def.staff) for (let j = 0; j < (o.crew || def.pop); j++) f.persons.push(this.mkPerson('staff', f));
    });
    const ctx = this.dayCtx();
    this.planDay(ctx, true);
    this.planCrowd(ctx);
  }
}

function fmtMoney(v) {
  const neg = v < 0; v = Math.abs(Math.round(v));
  return (neg ? '−' : '') + 'R$ ' + v.toLocaleString('pt-BR');
}
if (typeof module !== 'undefined') module.exports = {Game};
