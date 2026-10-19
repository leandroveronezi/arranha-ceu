'use strict';
// O helicóptero do VIP pousa no heliponto (desce, fica parado, decola) em vez de só pairar; o de incêndio continua pairando.
const {mk, put, ok, done, roundTrip} = require('./helpers');

const g = mk(); put(g, 'heliport', 1, 8);
const hp = g.facs.find(f => f.k === 'heliport'), x = hp.x + hp.w / 2;
g.callHeli(hp.L, x, 'vip');
ok(g.heli.alt === 1, 'chega voando alto');
let landed = false, up = false, minAlt = 1, seen = new Set(), saved = false;
for (let i = 0; i < 3000 && g.heli; i++) {
  g.updHeli(0.05); if (!g.heli) break;
  seen.add(g.heli.phase); minAlt = Math.min(minAlt, g.heli.alt);
  if (g.heli.phase === 'hold' && g.heli.alt === 0) landed = true;
  if (g.heli.phase === 'land' && !saved) { saved = true; const g2 = roundTrip(g); ok(g2.heli && g2.heli.phase === 'land' && g2.heli.alt === g.heli.alt, 'salva e carrega o helicóptero em pouso'); }
  if (g.heli.phase === 'up') up = true;
}
ok(landed && minAlt === 0, 'pousa de verdade (altitude zero) e fica parado');
ok(['in', 'land', 'hold', 'up', 'out'].every(p => seen.has(p)), 'passa por todas as fases: ' + [...seen].join(', '));
ok(up && !g.heli, 'decola e sai de cena');

const g2 = mk(); g2.callHeli(5, 10, 'bomb'); let low = 1;
for (let i = 0; i < 2000 && g2.heli; i++) { g2.updHeli(0.05); if (g2.heli) low = Math.min(low, g2.heli.alt); }
ok(low === 1 && !g2.heli, 'o helicóptero de resgate/incêndio só paira, não pousa');
done('heliponto');
