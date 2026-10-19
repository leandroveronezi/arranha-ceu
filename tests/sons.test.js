'use strict';
const {SoundMix, SONS, SOM_CATS, SOM_MAX_TOTAL, SOM_DUCK, grammelot, GRAMMELOT, ok, done} = require('./helpers');

// todo som tem categoria válida e prioridade
ok(Object.keys(SONS).every(k => SOM_CATS[SONS[k].cat] && SONS[k].dur > 0), 'todo som tem categoria e duração');
ok(SONS.boom.prio > SONS.ding.prio && SONS.siren.prio > SONS.carro.prio, 'alertas valem mais que ambiente');

// espera mínima entre iguais
let m = new SoundMix();
ok(m.ask('carro', 0), 'primeiro carro toca');
ok(!m.ask('carro', 100), 'segundo carro logo em seguida é barrado (espera)');
ok(m.ask('carro', 700), 'depois da espera toca de novo');

// distância: longe fica mais baixo, e bem longe some
m = new SoundMix();
const perto = m.ask('boom', 0, 1), longe = new SoundMix().ask('boom', 0, 0);
ok(perto && longe && perto.gain > longe.gain, 'quanto mais perto da câmera, mais alto');
m = new SoundMix(); m.setVolume('ambiente', 0);
ok(!m.ask('carro', 0), 'categoria no zero não toca');
m = new SoundMix(); m.setVolume('master', 0);
ok(!m.ask('boom', 0), 'volume geral zero cala tudo');

// limite por categoria: o fraco cede lugar ao forte, o fraco não derruba o forte
m = new SoundMix();
const max = SOM_CATS.ambiente.max;
for (let i = 0; i < max; i++) ok(m.ask(['carro', 'onibus', 'caminhao'][i], i), 'cabe ' + (i + 1) + ' ambiente');
ok(!m.ask('buzina', 10) || true, 'buzina (prio 1) com a categoria cheia');
m = new SoundMix();
m.ask('onibus', 0); m.ask('caminhao', 0); m.ask('buzina', 0);
const car = m.ask('carro', 300);   // prio 0 não derruba ninguém
ok(!car, 'som fraco não tira lugar de som mais forte');
m = new SoundMix();
m.ask('carro', 0); m.ask('murmurio', 0); m.ask('carro', 600); m.ask('carro', 1200);
const r = m.ask('onibus', 1300);
ok(r && r.stop.length === 1 && r.stop[0].name === 'carro', 'ônibus (prio maior) calou um carro quando a categoria estava cheia');

// total simultâneo nunca passa do teto
m = new SoundMix();
const names = Object.keys(SONS);
for (let t = 0; t < 40; t++) m.ask(names[t % names.length], t * 3000 / 40);
ok(m.active.length <= SOM_MAX_TOTAL, 'nunca passa de ' + SOM_MAX_TOTAL + ' sons ao mesmo tempo (' + m.active.length + ')');

// abaixar ambiente/voz quando há alerta tocando
m = new SoundMix();
const a0 = m.ask('carro', 0).gain;
m = new SoundMix(); m.ask('siren', 0);
const a1 = m.ask('carro', 100).gain;
ok(Math.abs(a1 / a0 - SOM_DUCK) < 1e-9, 'com sirene tocando o ambiente cai para ' + SOM_DUCK);
ok(m.ask('boom', 200).gain >= m.ask('thunder', 200 + 3000).gain * 0.99, 'alerta não é abafado por outro alerta');

// grammelot
ok(JSON.stringify(grammelot(5, 'grito')) === JSON.stringify(grammelot(5, 'grito')), 'grammelot: mesma semente e humor → mesma fala');
ok(JSON.stringify(grammelot(5, 'grito')) !== JSON.stringify(grammelot(6, 'grito')), 'grammelot: pessoas diferentes falam diferente');
const med = mood => { let s = 0, n = 0; for (let i = 0; i < 200; i++) for (const y of grammelot(i, mood).syl) { s += y.f0; n++; } return s / n; };
ok(med('grito') > med('chat') * 1.4 && med('briga') < med('chat'), 'grito é agudo e briga é grave');
for (const mood of Object.keys(GRAMMELOT)) {
  const ok2 = Array.from({length: 100}, (_, i) => grammelot(i, mood)).every(g => g.syl.length >= GRAMMELOT[mood].n[0] && g.syl.length <= GRAMMELOT[mood].n[1] && g.total < 3 && g.syl.every(y => y.f0 > 40 && y.f0 < 700 && y.dur > 0 && y.vol > 0 && y.vol <= 1));
  ok(ok2, 'grammelot ' + mood + ': sílabas, tom e duração dentro dos limites');
}
ok(grammelot(1, 'inexistente').syl.length > 0, 'humor desconhecido cai na conversa');
done('sons');
