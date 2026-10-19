'use strict';
// Quem usa o quê: camareira só o elevador de serviço (o carrinho não sobe escada nem elevador comum), segurança qualquer escada ou elevador, bombeiro só escada.
const {mk, put, ok, done} = require('./helpers');

const g = mk(64); g.star = 5; g.msg = () => {}; g.updPerson = () => {};
for (let L = 1; L <= 5; L++) g.placeFloorSpan(L, 0, 63);
const base = g.nodeAt(0, 4), top = () => g.nodeAt(4, 4);
const path = mode => g.nodePath(base, top(), mode);

ok(!path('maid') && !path(true) && !path('stairs'), 'sem escada nem elevador ninguém sobe');
for (let L = 0; L < 5; L++) { const r = g.placeStairs('stairs', L, 56); if (!r.ok) throw new Error(r.err); }
ok(!!path(true) && !!path('stairs') && !path('maid'), 'só com escadas: segurança e bombeiro sobem, a camareira não');
const e = g.placeShaft('elevator', 40, 0, 5); g.addCar(e.shaft);
ok(!path('maid') && !!path(true), 'com elevador comum a camareira continua sem rota');
g.removeStairs(g.stairs[0]);
const sv = g.placeShaft('service', 44, 0, 5); ok(sv.ok, 'elevador de serviço construído ' + (sv.err || '')); g.addCar(sv.shaft);
ok(!!path('maid'), 'com elevador de serviço a camareira sobe');
ok(!!path(true), 'e a segurança também (qualquer elevador ou escada)');

// quem é quem
const hk = put(g, 'housekeeping', 1, 8), sec = put(g, 'security', 1, 24);
const maid = g.mkPerson('staff', hk), guard = g.mkPerson('staff', sec), ff = g.mkPerson('firefighter', null), res = g.mkPerson('resident', null);
ok(g.staffMode(maid) === 'maid' && g.staffMode(guard) === true && g.staffMode(ff) === 'stairs' && g.staffMode(res) === false, 'o modo de rota de cada tipo de pessoa');
done('equipe');
