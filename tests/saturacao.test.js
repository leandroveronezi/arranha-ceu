'use strict';
// Salas do mesmo tipo por perto dividem o público (satur): sozinha vale 1, duas coladas 1/2 cada, longe são independentes; sala fechada ou sem acesso não conta.
const {mk: mk0, put, ok, done} = require('./helpers');
const mk = (...a) => { const g = mk0(...a); g.reachable = f => !f.dead && f.k !== 'ruin'; return g; };
const world = () => { const g = mk(240); g.msg = () => {}; g.star = 5; for (let L = 1; L <= 12; L++) g.placeFloorSpan(L, 0, 239); return g; };
const near = (a, b) => Math.abs(a - b) < 1e-9;

const g = world(); const a = put(g, 'cinema', 1, 0);
ok(near(g.satur(a), 1), 'cinema sozinho: 1');
const b = put(g, 'cinema', 1, 32);
ok(near(g.satur(a), 0.5) && near(g.satur(b), 0.5), 'dois cinemas colados dividem o público: 1/2 cada');
const w = world(); const x = put(w, 'cinema', 1, 0), y = put(w, 'cinema', 1, 200);
ok(near(w.satur(x), 1) && near(w.satur(y), 1), 'cinemas a 160 unidades de distância são independentes');
const v = world(); const p = put(v, 'cinema', 1, 0), q = put(v, 'cinema', 1, 32);
q.closed = true; ok(near(v.satur(p), 1), 'sala fechada não divide o público');
const o = world(); const c1 = put(o, 'cinema', 1, 0), c2 = put(o, 'cafe', 1, 32);
ok(near(o.satur(c1), 1), 'sala de outro tipo não divide o público');
const t = world(); const t1 = put(t, 'cinema', 1, 0), t2 = put(t, 'cinema', 5, 0);
ok(t.satur(t1) < 1 && t.satur(t1) > 0.5, 'dois cinemas com dois andares vazios entre eles: divisão parcial (' + t.satur(t1).toFixed(2) + ')');
done('saturacao');
