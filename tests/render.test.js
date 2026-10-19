'use strict';
// Teste de fumaça do renderizador inteiro: roda Renderer.draw (mundo e minimapa) com canvas e DOM falsos
// em todas as visões, com fogo, efeitos, caminhões, helicóptero, bomba e pessoas. Pega exceções e NaN; não confere o visual.
const fs = require('fs'), vm = require('vm'), path = require('path');
const {ok, done} = require('./helpers');

const stats = {calls: 0, nan: 0, last: ''};
const proxy = () => {
  const store = {canvas: {width: 150, height: 230}};
  return new Proxy(function () {}, {
    get: (t, k) => (k === 'then' || typeof k === 'symbol' ? undefined : k in store ? store[k] : (store[k] = proxy())),
    set: (t, k, v) => { store[k] = v; return true; },
    apply: (t, th, a) => { stats.calls++; for (const v of a) if (typeof v === 'number' && !Number.isFinite(v)) { stats.nan++; stats.last = 'chamada com NaN'; } return proxy(); },
  });
};
const canvas = () => ({width: 800, height: 600, getContext: () => proxy(), getBoundingClientRect: () => ({width: 800, height: 600})});
let now = 0;
const ctx = vm.createContext({console, Math, Date, performance: {now: () => (now += 16)}, window: {devicePixelRatio: 1}, document: {createElement: () => canvas()}, localStorage: {}, location: {search: ''}});
const src = ['data', 'game', 'art', 'art-salas', 'render'].map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')).join('\n;');
vm.runInContext(src + '\n;globalThis.__R = {Game, Renderer, FAC, CORR, TRANSPORT};', ctx);
const {Game, Renderer, FAC, TRANSPORT} = ctx.__R;

// uma torre com de tudo um pouco
const g = new Game(); g.funds = 1e9; g.star = 5; g.msg = () => {};
const put = (k, L, x, o) => { const r = g.placeFac(k, L, x, o); if (!r.ok) throw new Error(k + ': ' + r.err); g.facs[g.facs.length - 1].build = 1; return g.facs[g.facs.length - 1]; };
put('lobby', 0, 0, {w: 64}); g.facs.forEach(f => f.build = 1);
for (let L = 1; L <= 6; L++) g.placeFloorSpan(L, 0, 63);
const rooms = [];
for (let L = 1; L <= 4; L++) for (const x of [0, 16, 32]) rooms.push(put('office', L, x));
const bar = put('bar', 5, 16), shop = put('shop', 5, 32);
put('corridor', 1, 8); put('corridorExt', 2, 8); put('corridorSpr', 3, 8); put('corridorHyd', 4, 8); put('corridorCam', 5, 8);
const post = put('security', 6, 0); g.onBuilt(post); put('housekeeping', 6, 16); g.onBuilt(g.facs[g.facs.length - 1]);
for (let L = 0; L < 5; L++) g.placeStairs(L % 2 ? 'escalator' : 'stairs', L, 48);
g.placeShaft('elevator', 56, 0, 6); g.addCar(g.shafts[0]);
for (const L of [-1, -2, -3]) g.placeFloorSpan(L, 0, 100);   // garagem com elevador de carros (precisa pintar sem exceção, com fila e sem energia)
put('tunnelPortal', -2, 48); put('parkspace', -2, 44); put('parkspace', -2, 40); g.placeShaft('carlift', 32, -3, -2); put('parkspace', -2, 28); put('parkspace', -3, 40); if (!g.shafts.some(s => s.carlift)) throw new Error('elevador de carros não foi construído no teste de render'); g.liftJoin(g.shafts[g.shafts.length - 1]);
rooms[0].occ = true; rooms[1].occ = true; rooms[1].fire = 1.3; rooms[2].fire = 1.6; rooms[3].bomb = g.t + 30; rooms[4].fight = g.t + 100;
rooms[5].dirty = true; rooms[6].bugs = 1; rooms[7].occ = true; g.addIncident('theft', rooms[7]);
g.burn(rooms[8]);
const people = [];
for (const f of [rooms[0], rooms[1], bar, shop]) { const p = g.mkPerson('resident', f); g.placeIn(p, f); people.push(p); }
const ff = g.mkPerson('firefighter', null); ff.st = 'walk'; ff.L = 2; ff.x = 10; ff.transient = true;
g.callTruck(rooms[1]); g.updTrucks(30); g.callHeli(7, 32, 'bomb'); g.heli.phase = 'hold'; g.heli.hold = 3;
g.addFx('ext', rooms[1], {from: g.facs.find(f => f.k === 'corridorExt'), ok: true, level: 1.3}); g.addFx('spr', rooms[2], {level: 1.5}); g.addFx('boom', rooms[3]); g.addFx('amb', rooms[4]); g.addFx('thief', rooms[7]);
g.speed = 1; for (let i = 0; i < 20; i++) g.step(0.1);

// toda ação dos alertas ("Ir até lá", "Construir...", contratar...) precisa ter dados válidos para o botão funcionar
{
  const KNOWN = ['goto', 'hire', 'dismiss', 'sys', 'pest', 'rebuild', 'car', 'price', 'build', 'garbage'];
  const al = g.alerts(), acts = al.flatMap(a => a.actions.map(x => [a, x]));
  const bad = acts.filter(([a, x]) => !KNOWN.includes(x.type) || (x.type === 'goto' && !(Number.isFinite(x.x) && Number.isFinite(x.L))) || (x.type === 'build' && !(x.what in FAC) && !(x.what in TRANSPORT)));
  ok(acts.length > 0 && bad.length === 0, `as ${acts.length} ações dos ${al.length} alertas têm tipo conhecido e dados válidos` + (bad.length ? ': ' + bad.map(([a, x]) => a.title + ' → ' + x.type).join('; ') : ''));
}

let err = null, frames = 0;
try {
  const r = new Renderer(canvas(), canvas());
  const ui = {tool: 'inspect', hoverTip: null};
  for (const ov of ['none', 'eval', 'price', 'hotel', 'fire', 'sec', 'energia', 'agua']) for (const z of [0.3, 0.7, 1.4]) for (const miniMode of ['fit', 'world']) {
    r.overlay = ov; r.cam.z = z; r.setMiniMode(miniMode); r.cam.x = 200 * 8 / 2 - 100; r.cam.y = -3 * 36 - 80; r.clampCam();
    r.draw(g, ui); r.draw(g, ui); frames += 2;
  }
  r.selected = rooms[1]; r.ghost = {x: 0, L: 1, w: 8, h: 1, ok: true}; r.draw(g, ui);
  for (const k of ['condo', 'mercado', 'office', 'single', 'cinema', 'parkramp', 'tunnelDown', 'lobby', 'transit', 'heliport']) { r.ghost = {x: 4, L: 1, w: FAC[k].w, h: FAC[k].h, ok: k !== 'cinema', k, slope: !!FAC[k].slope, dir: -1}; r.draw(g, ui); }   // o fantasma é a imagem da própria sala (vaga ou à venda se for de aluguel)
  r.ghost = null;
  g.fxs = []; g.trucks = []; g.heli = null; r.overlay = 'none'; r.draw(g, ui);
} catch (e) { err = e; }
// mundo sem teto: câmera longe da origem, em x negativo, bem alto e bem fundo
let err2 = null, frames2 = 0;
try {
  const G = new Game(); G.funds = 1e12; G.star = 5; G.msg = () => {};
  G.placeLobbySpan(0, -3000, -2937); G.facs.forEach(f => { f.build = 1; });
  for (let L = 1; L <= 40; L++) G.placeFloorSpan(L, -3000, -2937);
  for (let L = -1; L >= -6; L--) G.placeFloorSpan(L, -3000, -2937);
  for (let L = 0; L < 40; L++) G.placeStairs('stairs', L, -2990);
  for (let L = 1; L <= 40; L += 3) { const r = G.placeFac('office', L, -2970); if (r.ok) G.facs[G.facs.length - 1].build = 1; }
  const last = G.facs[G.facs.length - 1]; last.occ = true; last.fire = 1.3;
  G.addIncident('theft', last); G.callHeli(20, -2960, 'bomb'); G.heli.phase = 'hold'; G.heli.hold = 3; G.addFx('boom', last); G.callTruck(last); G.updTrucks(30);
  for (let i = 0; i < 10; i++) G.step(0.1);
  const r2 = new Renderer(canvas(), canvas()), ui2 = {tool: 'inspect'};
  for (const [cx, cy, z] of [[-2960, -20 * 36, 0.4], [-2960, 5 * 36, 1.2], [-2960, -39 * 36, 0.2], [0, -3 * 36, 0.7], [90000, -500, 0.3], [-90000, 900, 0.1], [-2960, -200 * 36, 0.1]])
    for (const ov of ['none', 'fire', 'sec', 'eval', 'energia', 'agua']) for (const mm of ['fit', 'world']) {
      r2.overlay = ov; r2.setMiniMode(mm); r2.cam.z = z; r2.cam.x = cx * 8; r2.cam.y = cy; r2.clampCam(); r2.draw(G, ui2); frames2++;
    }
  r2.cam.x = -1e9; r2.clampCam(); const lo = r2.cam.x; r2.cam.x = 1e9; r2.clampCam();
  ok(lo < -1e6 && r2.cam.x > 1e6 && lo > -1.1e6 && r2.cam.x < 1.1e6, 'a câmera anda livremente até ~1 milhão de pixels para cada lado');
} catch (e) { err2 = e; }
ok(!err2, `o renderizador desenha ${frames2} quadros em x negativo, longe da origem, bem alto e bem fundo (40 andares + subsolos) sem exceção` + (err2 ? ': ' + (err2.stack || err2.message).split('\n').slice(0, 4).join(' | ') : ''));
ok(!err, `o renderizador desenha ${frames} quadros (6 visões × 3 zooms × 2 enquadramentos do minimapa) sem exceção` + (err ? ': ' + (err.stack || err.message).split('\n').slice(0, 4).join(' | ') : ''));
ok(stats.calls > 1000, 'e chega a desenhar de verdade (' + stats.calls + ' chamadas ao canvas)');
ok(stats.nan === 0, 'nenhuma chamada de desenho recebeu NaN');
done('render');
