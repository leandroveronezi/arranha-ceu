'use strict';
// Arranha-Céu — síntese de som (Web Audio): usada pelo jogo (main.js) e pelo catálogo. Toda chamada passa antes pelo SoundMix (sons.js).
const Som = {
  // o navegador só deixa criar o AudioContext depois de um gesto do usuário: antes disso não cria (evita o aviso no console)
  liberado: false,
  ctx() {
    if (!this.liberado) return null;
    try { if (!this.audio) this.audio = new (window.AudioContext || window.webkitAudioContext)(); if (this.audio.state === 'suspended') this.audio.resume(); return this.audio; } catch (_) { return null; }
  },
  mix: new SoundMix(),
  LOUD: 2.4,   // ganho geral dos sons (os valores de cada um são baixos de propósito: o compressor segura o excesso quando muitos tocam juntos)
  // saída única com compressor: som alto não estoura quando vários tocam ao mesmo tempo
  out() {
    const a = this.ctx(); if (!a) return null;
    if (!this._out || this._outCtx !== a) { const c = a.createDynamicsCompressor(); c.threshold.value = -18; c.knee.value = 12; c.ratio.value = 6; c.attack.value = 0.003; c.release.value = 0.2; c.connect(a.destination); this._out = c; this._outCtx = a; }
    return this._out;
  },
  audio: null,
  tone(f0, f1, dur, type, vol, delay = 0, dest) {
    const a = this.ctx(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.out()); o.start(t); o.stop(t + dur + 0.02);
  },
  // ruído filtrado com varredura de frequência e envelope (vento, passagem de carro, trovão, chiado de freio)
  noise(dur, f0, f1, q, type, vol, delay = 0, attack = 0.05) {
    const a = this.ctx(); if (!a) return;
    const n = Math.ceil(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = a.createBufferSource(); s.buffer = buf;
    const f = a.createBiquadFilter(); f.type = type; f.Q.value = q; const t = a.currentTime + delay;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(attack, dur / 2)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.out()); s.start(t); s.stop(t + dur + 0.02);
  },
  // voz "grammelot": sílabas inventadas (vogal = dois filtros de formantes sobre uma onda serrilhada; consoante = estouro de ruído)
  voice(seed, mood, vol) {
    const a = this.ctx(); if (!a) return;
    const gm = grammelot(seed, mood), t0 = a.currentTime + 0.01;
    for (const y of gm.syl) {
      const t = t0 + y.t, o = a.createOscillator(), g = a.createGain(), end = t + y.dur;
      o.type = 'sawtooth'; o.frequency.setValueAtTime(y.f0 * 0.96, t); o.frequency.linearRampToValueAtTime(y.f0 * 1.04, end);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol * y.vol * 0.5, t + y.dur * 0.2); g.gain.linearRampToValueAtTime(0.0001, end);
      for (const [fc, q, gain] of [[y.f1, 6, 1], [y.f2, 8, 0.6]]) { const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fc; f.Q.value = q; const fg = a.createGain(); fg.gain.value = gain; o.connect(f); f.connect(fg); fg.connect(g); }
      g.connect(this.out()); o.start(t); o.stop(end + 0.02);
      if (y.cons) this.noise(0.05, 3500, 5200, 1, 'highpass', vol * 0.12, y.t + 0.01, 0.01);
    }
  },
  play(name, o) {
    const m = this.mix.ask(name, performance.now(), o && o.near !== undefined ? o.near : 1); if (!m) return;
    const v = m.gain * this.LOUD;
    if (name === 'build') this.tone(330, 330, 0.12, 'triangle', 0.04 * v);
    else if (name === 'ding') { this.tone(1175, 1175, 0.16, 'sine', 0.025 * v); this.tone(880, 880, 0.22, 'sine', 0.025 * v, 0.12); }
    else if (name === 'train') { this.noise(2, 300, 1400, 0.7, 'bandpass', 0.05 * v, 0, 1); this.tone(150, 80, 0.9, 'sawtooth', 0.03 * v); this.tone(300, 160, 0.6, 'square', 0.012 * v); this.noise(0.5, 6000, 2500, 3, 'highpass', 0.015 * v, 1.6, 0.05); }
    else if (name === 'siren') { this.tone(620, 880, 0.45, 'sawtooth', 0.02 * v); this.tone(880, 620, 0.45, 'sawtooth', 0.02 * v, 0.45); }
    else if (name === 'ext') { this.tone(520, 180, 0.5, 'sawtooth', 0.018 * v); this.tone(260, 120, 0.45, 'square', 0.008 * v, 0.05); this.noise(0.5, 4000, 1500, 0.5, 'bandpass', 0.03 * v); }
    else if (name === 'boom') { this.tone(90, 28, 0.9, 'square', 0.06 * v); this.tone(160, 40, 0.7, 'sawtooth', 0.03 * v); this.noise(0.9, 900, 80, 0.5, 'lowpass', 0.12 * v, 0, 0.01); }
    else if (name === 'amb') { this.tone(780, 980, 0.35, 'sine', 0.02 * v); this.tone(980, 780, 0.35, 'sine', 0.02 * v, 0.35); }
    else if (name === 'heli') { this.tone(90, 70, 1.4, 'sawtooth', 0.025 * v); this.tone(180, 150, 1.2, 'square', 0.008 * v); for (let i = 0; i < 6; i++) this.noise(0.12, 300, 120, 0.7, 'lowpass', 0.05 * v, i * 0.3, 0.02); }
    else if (name === 'star') [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.25, 'triangle', 0.05 * v, i * 0.12));
    else if (name === 'error') this.tone(140, 110, 0.14, 'square', 0.04 * v);
    else if (name === 'thunder') { this.noise(2.4, 700, 60, 0.6, 'lowpass', 0.22 * v, 0.1, 0.15); this.noise(0.5, 1500, 200, 0.5, 'lowpass', 0.14 * v, 0, 0.01); }
    else if (name === 'apagao') { this.tone(220, 40, 1.2, 'sawtooth', 0.05 * v); this.tone(110, 30, 1.3, 'square', 0.03 * v, 0.1); }
    else if (name === 'carro') { const f = 300 + Math.random() * 400; this.noise(1.5, f, f * 0.55, 0.9, 'bandpass', 0.06 * v, 0, 0.5); this.tone(70 + Math.random() * 30, 55, 1.2, 'sawtooth', 0.01 * v); }
    else if (name === 'onibus') { this.noise(2.1, 200, 120, 0.8, 'lowpass', 0.1 * v, 0, 0.8); this.tone(60, 48, 2, 'sawtooth', 0.025 * v); this.noise(0.5, 5000, 1800, 2, 'highpass', 0.025 * v, 1.7, 0.02); }   // motor diesel e chiado do freio
    else if (name === 'caminhao') { this.noise(2.3, 180, 100, 0.7, 'lowpass', 0.11 * v, 0, 0.9); this.tone(52, 42, 2.2, 'square', 0.02 * v); for (let i = 0; i < 4; i++) this.tone(1000, 1000, 0.1, 'square', 0.012 * v, 1.0 + i * 0.3); }   // motor e o bipe da ré
    else if (name === 'buzina') { const f = 380 + Math.random() * 120; this.tone(f, f, 0.4, 'square', 0.02 * v); this.tone(f * 1.25, f * 1.25, 0.4, 'square', 0.015 * v); }
    else if (name === 'voz') this.voice(o && o.seed || 1, o && o.mood || 'chat', 0.09 * v);
    else if (name === 'murmurio') { for (let i = 0; i < 2; i++) this.voice((o && o.seed || 1) + i * 17, 'chat', 0.09 * v); }
  },
};
if (typeof window !== 'undefined' && window.addEventListener) {
  const liberar = () => { Som.liberado = true; Som.ctx(); ['pointerdown', 'keydown', 'touchstart'].forEach(e => window.removeEventListener(e, liberar, true)); };
  ['pointerdown', 'keydown', 'touchstart'].forEach(e => window.addEventListener(e, liberar, true));
}
