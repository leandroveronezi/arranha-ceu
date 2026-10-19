'use strict';
// Arranha-Céu — som: gerenciador de mistura (lógica pura, testada no Node) e gerador de vozes "grammelot".
// Como tudo acontece ao mesmo tempo, nenhum som toca direto: passa por SoundMix.ask(), que decide se toca, a que volume e quem cala quem.

// categorias: volume próprio (slider) e máximo de sons ao mesmo tempo
const SOM_CATS = {
  alerta: {label: 'Alertas', vol: 1, max: 3},        // sirene, explosão, trovão, apagão: sempre passam
  efeito: {label: 'Efeitos', vol: 1, max: 5},        // construção, elevador, estrelas, metrô, helicóptero
  ambiente: {label: 'Ambiente', vol: 1, max: 3},     // carros, ônibus, chuva, murmúrio
  voz: {label: 'Vozes', vol: 1, max: 3},             // gritos, briga, torcida, conversa
};
const SOM_MAX_TOTAL = 9;      // vozes de áudio simultâneas no total
const SOM_DUCK = 0.4;         // com um alerta tocando, ambiente e vozes caem para esta fração
// prio: quem entra quando está cheio (maior vence); cd: espera mínima entre dois iguais (ms); dur: duração aproximada (s); vol: ganho base
const SONS = {
  error: {cat: 'efeito', prio: 2, cd: 200, dur: 0.2, vol: 1},
  build: {cat: 'efeito', prio: 1, cd: 120, dur: 0.15, vol: 1},
  ding: {cat: 'efeito', prio: 0, cd: 350, dur: 0.4, vol: 1},
  star: {cat: 'efeito', prio: 4, cd: 1000, dur: 0.8, vol: 1},
  train: {cat: 'efeito', prio: 2, cd: 2500, dur: 2.2, vol: 1},
  step: {cat: 'efeito', prio: 0, cd: 1500, dur: 0.3, vol: 1},
  heli: {cat: 'efeito', prio: 2, cd: 4000, dur: 2.2, vol: 1},
  ext: {cat: 'efeito', prio: 2, cd: 1200, dur: 0.6, vol: 1},
  amb: {cat: 'alerta', prio: 3, cd: 3000, dur: 0.8, vol: 1},
  siren: {cat: 'alerta', prio: 3, cd: 3000, dur: 0.9, vol: 1},
  boom: {cat: 'alerta', prio: 5, cd: 800, dur: 1, vol: 1},
  thunder: {cat: 'alerta', prio: 4, cd: 2500, dur: 2.5, vol: 1},
  apagao: {cat: 'alerta', prio: 4, cd: 5000, dur: 1.4, vol: 1},
  carro: {cat: 'ambiente', prio: 0, cd: 500, dur: 1.6, vol: 1},
  onibus: {cat: 'ambiente', prio: 1, cd: 2500, dur: 2.2, vol: 1},
  caminhao: {cat: 'ambiente', prio: 1, cd: 3000, dur: 2.4, vol: 1},
  buzina: {cat: 'ambiente', prio: 1, cd: 4000, dur: 0.5, vol: 0.8},
  voz: {cat: 'voz', prio: 1, cd: 250, dur: 1.2, vol: 1},          // vozes individuais (grito, briga, torcida)
  murmurio: {cat: 'voz', prio: 0, cd: 2200, dur: 1.8, vol: 0.5},  // conversa de fundo da multidão visível
};

class SoundMix {
  constructor() { this.master = 1; this.cats = {}; for (const k in SOM_CATS) this.cats[k] = SOM_CATS[k].vol; this.last = {}; this.active = []; }
  setVolume(cat, v) { v = Math.max(0, Math.min(1, +v || 0)); if (cat === 'master') this.master = v; else if (cat in this.cats) this.cats[cat] = v; }
  _purge(now) { this.active = this.active.filter(a => a.end > now); }
  // há um alerta tocando? então o resto abaixa
  ducked(now) { return this.active.some(a => a.end > now && a.cat === 'alerta'); }
  // pede para tocar `name` em `now` (ms); near = 0..1 (1 = bem na frente da câmera). Devolve {gain, cat, dur, stop: [ativos calados]} ou null.
  ask(name, now, near = 1) {
    const d = SONS[name]; if (!d) return null;
    if (now - (this.last[name] === undefined ? -1e9 : this.last[name]) < d.cd) return null;
    let gain = d.vol * this.master * this.cats[d.cat] * (0.2 + 0.8 * Math.max(0, Math.min(1, near)));
    if (d.cat !== 'alerta' && this.ducked(now)) gain *= SOM_DUCK;
    if (gain < 0.03) return null;
    this._purge(now);
    const stop = [], same = this.active.filter(a => a.cat === d.cat);
    const weakest = list => list.reduce((m, a) => (!m || a.prio < m.prio || (a.prio === m.prio && a.end < m.end) ? a : m), null);
    if (same.length >= SOM_CATS[d.cat].max) { const w = weakest(same); if (w.prio >= d.prio) return null; stop.push(w); this.active.splice(this.active.indexOf(w), 1); }
    if (this.active.length >= SOM_MAX_TOTAL) { const w = weakest(this.active); if (w.prio >= d.prio) return null; stop.push(w); this.active.splice(this.active.indexOf(w), 1); }
    this.last[name] = now;
    this.active.push({name, cat: d.cat, prio: d.prio, end: now + d.dur * 1000});
    return {gain, cat: d.cat, dur: d.dur, stop};
  }
}

// ---- grammelot: vozes sem palavras (sílabas inventadas, como no teatro) ----
// formantes (F1, F2) de cada vogal: é o que faz "a, e, i, o, u" soarem diferentes
const VOGAIS = [[800, 1200], [550, 1800], [300, 2300], [500, 900], [320, 800], [650, 1500]];
function rngSeed(seed) { let a = (seed * 2654435761 + 1) >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// humor → como falar: n sílabas, duração, altura relativa, inclinação da melodia, força de consoantes e brilho
const GRAMMELOT = {
  chat: {n: [3, 6], dur: 0.17, pitch: 1, slope: 0, cons: 0.4, vol: 0.5},
  grito: {n: [2, 3], dur: 0.26, pitch: 1.7, slope: 0.35, cons: 0.2, vol: 1},     // pânico: agudo e subindo
  briga: {n: [3, 5], dur: 0.15, pitch: 0.75, slope: -0.3, cons: 0.8, vol: 0.9},  // grave, seco, caindo
  festa: {n: [3, 5], dur: 0.2, pitch: 1.25, slope: 0.15, cons: 0.3, vol: 0.8},
  riso: {n: [4, 7], dur: 0.1, pitch: 1.4, slope: -0.1, cons: 0.1, vol: 0.6},
};
// devolve as sílabas {t, dur, f0, f1, f2, cons, vol} (segundos, Hz); mesma semente e humor → mesma fala
function grammelot(seed, mood) {
  const m = GRAMMELOT[mood] || GRAMMELOT.chat, r = rngSeed(seed * 7 + mood.length), base = (95 + r() * 150) * m.pitch;   // cada pessoa tem a sua voz
  const n = m.n[0] + Math.floor(r() * (m.n[1] - m.n[0] + 1)), out = [];
  let t = 0, v = Math.floor(r() * VOGAIS.length);
  for (let i = 0; i < n; i++) {
    if (r() < 0.7) v = Math.floor(r() * VOGAIS.length);
    const dur = m.dur * (0.7 + r() * 0.7), f0 = base * (1 + m.slope * (i / Math.max(1, n - 1)) + (r() - 0.5) * 0.16);
    out.push({t, dur, f0, f1: VOGAIS[v][0], f2: VOGAIS[v][1], cons: r() < m.cons ? 1 : 0, vol: m.vol * (0.75 + r() * 0.25)});
    t += dur * (r() < 0.2 ? 1.6 : 1.05);
  }
  return {syl: out, total: t};
}
