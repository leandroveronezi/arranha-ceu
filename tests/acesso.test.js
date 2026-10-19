'use strict';
// Sala sem acesso desde o térreo (o aviso vermelho "Sem acesso") não atende ninguém: serviços, lazer, vagas e eventos valem 0.
const {mk, put, ok, done, FAC} = require('./helpers');

const g = mk(64); g.star = 5; g.msg = () => {};
g.placeFloorSpan(1, 0, 63);   // andar 2 com piso, mas sem escada
const kit = put(g, 'kitnet', 1, 0), cafe = put(g, 'cafe', 1, 12), cin = put(g, 'cinema', 1, 28);
g._rc = {}; g._rs = {};
ok(!g.reachable(cafe) && !g.reachable(cin), 'sem escada nem elevador, o andar 2 não tem acesso');
ok(g.serviceNear(kit, 'cafe') === 0, 'café sem acesso não atendem a kitnet vizinha (0)');
ok(!g.dayCtx().open.includes(cafe) && !g.dayCtx().open.includes(cin), 'cinema e café sem acesso não recebem visitantes');
ok(g.demandFactors(kit).every(d => d.v <= 0), 'nenhum motivo positivo de serviço na nota da kitnet');
ok(g.alerts && true, 'alertas existem');

// com uma escada até o andar 2 tudo volta a valer
{ const r = g.placeStairs('stairs', 0, 56); if (!r.ok) throw new Error(r.err); g.stairs.forEach(s => { s.build = 1; });}
g.ver++; g._rc = {}; g._rs = {};
ok(g.reachable(cafe), 'depois da escada o andar 2 tem acesso');
ok(g.serviceNear(kit, 'cafe') > 0, 'e o serviço voltam a atender');

// ---- quem já mora lá: tirar a escada derruba a nota, ele reclama e se muda; sem acesso ninguém aluga e ninguém paga
const h = mk(64); h.star = 5; h.msg = () => {}; h.updPerson = () => {};
h.placeFloorSpan(1, 0, 63);
const st = h.placeStairs('stairs', 0, 56); if (!st.ok) throw new Error(st.err);
const stair = h.stairs[0];
const apt = put(h, 'kitnet', 1, 0); apt.occ = true; apt.persons = []; apt.eval = 100;
h.updateEval(false);
ok(h.reachable(apt) && !h.evalBreakdown(apt).some(d => d.key === 'access'), 'com a escada: sem motivo de acesso na nota');
h.removeStairs(stair); h._rc = {}; h._rs = {};
h.updateEval(false);
const acc = h.evalBreakdown(apt).find(d => d.key === 'access');
ok(!h.reachable(apt) && acc && acc.v <= -100, 'sem a escada: a nota ganha o motivo "Sem acesso" (' + (acc && acc.v) + ')');
ok(apt.eval < 90, 'a nota cai (' + apt.eval + ')');
let left = -1;
for (let d = 1; d <= 4 && left < 0; d++) { h.newDay(); if (!apt.occ) left = d; }
ok(left > 0 && left <= 3, 'o morador se muda em poucos dias (saiu no dia ' + left + ')');
const w = mk(64); w.star = 5; w.msg = () => {}; w.placeFloorSpan(1, 0, 63);
const empty = put(w, 'kitnet', 1, 0); w.updPerson = () => {};
for (let i = 0; i < 20; i++) { w.newDay(); w.step(1); }
ok(!empty.occ, 'sem acesso a unidade vaga nunca é alugada');
const r = mk(64); r.star = 5; r.msg = () => {}; r.placeFloorSpan(1, 0, 63);
const paying = put(r, 'office', 1, 0); paying.occ = true; paying.persons = [];
const before = r.funds; r.quarter();
const unpaid = r.funds - before;
const r2 = mk(64); r2.star = 5; r2.msg = () => {}; r2.placeFloorSpan(1, 0, 63); r2.placeStairs('stairs', 0, 56);
const pay2 = put(r2, 'office', 1, 0); pay2.occ = true; pay2.persons = [];
const b2 = r2.funds; r2.quarter();
ok(r2.funds - b2 > unpaid, 'sem acesso o aluguel não é cobrado (' + unpaid + ' contra ' + (r2.funds - b2) + ')');

// hotel sem acesso nunca recebe hóspede; loja sem acesso nunca é procurada
const t = mk(64); t.star = 5; t.msg = () => {}; t.placeFloorSpan(1, 0, 63); t.updPerson = () => {};
const room = put(t, 'single', 1, 0), shop = put(t, 'shop', 1, 16); shop.occ = true;
let guests = 0, clients = 0;
for (let d = 0; d < 6; d++) { t.newDay(); for (let i = 0; i < 200; i++) t.step(1); guests += room.guests.length; clients += t.people.filter(p => p.plan && p.plan.some(a => a.fac === shop)).length; }
ok(guests === 0, 'quarto de hotel sem acesso não recebe hóspedes');
ok(clients === 0, 'loja sem acesso não recebe clientes nos planos do dia');
done('acesso');
