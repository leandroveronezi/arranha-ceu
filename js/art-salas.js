'use strict';
// Arranha-Céu — variações visuais das salas (carrega depois de art.js).
// Cada tipo tem vários modelos, escolhidos pelo id da sala. As salas com faixa de preço também mudam de acabamento
// com o poder aquisitivo do ocupante (wl 0 = Promoção ... 3 = Premium): 3 modelos × 4 faixas = 12 aparências por tipo.
// Lanchonete, restaurante e bar não têm faixa de preço: 4 modelos cada.
// Cada painter recebe (c, f, x, y, w, h, o), como paintFacility, e desenha só o miolo da sala (a laje e a borda ficam com ela).

// o modelo vem de `sty`, sorteado ao construir e gravado no save (o id muda ao recarregar); `id` só serve a salas sem sty
// vr.n guarda o maior n pedido desde que foi zerado: o catálogo (catalogo.html) lê daqui quantos modelos cada sala tem
const vr = (f, n) => (vr.n = Math.max(vr.n || 0, n), Math.floor(hash((f.sty ?? f.id) * 31 + 7) * n));
const wealth = f => clamp(3 - (f.price === undefined ? 1 : f.price), 0, 3);
const GOLD = '#d4af37';

function forRent(c, x, y, w, floorY, txt) {
  R(c, x + w / 2 - 14, floorY - 17, 28, 10, '#e8e6d8');
  c.fillStyle = '#b33'; c.font = 'bold 6px system-ui'; c.textAlign = 'center'; c.fillText(txt, x + w / 2, floorY - 9.5);
}
// unidade vaga: parede crua, janelas com a luz do dia entrando (com poeira no ar), caixas de mudança e lata de tinta num canto, e a placa grande de aluga-se / à venda
function vacantRoom(c, f, x, y, w, h, o, txt, home) {
  const floorY = y + h - SLAB, tm = o.time || 0, night = o.night, n = Math.max(1, Math.floor(w / 56));
  for (let k = 0; k < n; k++) {
    const wx = x + (k + .5) * w / n - 12, wy = y + 5;
    R(c, wx - 1.5, wy - 1.5, 27, 17, '#8a8478'); R(c, wx, wy, 24, 14, night ? '#1d2b45' : '#bfe6f7'); R(c, wx + 11.5, wy, 1, 14, '#8a8478');
    if (!night) { c.fillStyle = 'rgba(255,250,225,.16)'; c.beginPath(); c.moveTo(wx + 2, wy + 14); c.lineTo(wx + 22, wy + 14); c.lineTo(wx + 40, floorY - 2); c.lineTo(wx + 14, floorY - 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 3; i++) { const p = (tm * .25 + i / 3 + k * .2) % 1; c.fillRect(wx + 8 + p * 22 + i * 3, wy + 16 + p * (floorY - wy - 20), 1, 1); } }   // poeira na luz
  }
  R(c, x + 3, floorY - 8, 11, 8, '#b98a55'); R(c, x + 3, floorY - 8, 11, 1.4, '#d8ad76'); R(c, x + 7, floorY - 8, 3, 8, 'rgba(255,255,255,.35)'); R(c, x + 10, floorY - 13, 9, 5, '#a8793f'); R(c, x + 13, floorY - 13, 3, 5, 'rgba(255,255,255,.35)');   // caixas
  R(c, x + w - 12, floorY - 6, 6, 6, '#c0392b'); R(c, x + w - 12, floorY - 7, 6, 1.4, '#999'); R(c, x + w - 18, floorY - 4, 5, 1.6, '#7a8aa0');   // lata de tinta e rolo
  const bx = x + w / 2 - 20; R(c, bx - 1, floorY - 24, 42, 17, '#fff'); R(c, bx, floorY - 23, 40, 15, home ? '#c0392b' : '#2a5fa8');
  c.fillStyle = '#fff'; c.font = 'bold 7px system-ui'; c.textAlign = 'center'; c.fillText(txt, bx + 20, floorY - 14.5); c.font = '4px system-ui'; c.fillText(home ? 'trate aqui' : 'tel. 0800-TORRE', bx + 20, floorY - 10);
  R(c, bx + 6, floorY - 7, 1, 7, '#888'); R(c, bx + 33, floorY - 7, 1, 7, '#888');
}
// janela de uma faixa: Premium tem vidro panorâmico com a cidade ao fundo; Promoção, persiana meio descida e vidro encardido
const SKIN_TONES = ['#e8b98f', '#c98f66', '#8a5a3c', '#f0cfae'];
function glass(c, x, y, w, h, night, lit, wl, step) {
  if (wl >= 3) {
    R(c, x, y, w, h, night ? (LIGHT.tv ? windowLight(0, x, 0) : lit ? LIGHT_TONES[LIGHT.tone] : '#141b2b') : '#a5d3ee');
    for (let i = 0; i < w - 2; i += 6) { const bh = 2 + hash(Math.floor(x) + i * 3) * (h - 4); R(c, x + i, y + h - bh, 5, bh, night ? '#0b111d' : '#7fa7c4'); }
    R(c, x, y, w, 1, GOLD); R(c, x, y + h - 1, w, 1, GOLD);
    return;
  }
  windows(c, x, y, w, h, night, lit, step || (wl === 0 ? 12 : 16));
  if (wl === 0) R(c, x, y, w, h * .35, 'rgba(110,100,70,.45)');
}
function curtains(c, x, w, y, wl, col) {
  if (wl < 2) return;
  R(c, x - 2, y - 1, 3, 13, col); R(c, x + w - 1, y - 1, 3, 13, col); R(c, x - 2, y - 2, w + 5, 1.5, '#555');
}
function frame(c, x, y, w, h, wl, col) {
  R(c, x, y, w, h, wl >= 3 ? GOLD : '#6b4f3a'); R(c, x + 1, y + 1, w - 2, h - 2, col);
  R(c, x + 2, y + h * .5, w - 4, h * .3, 'rgba(255,255,255,.28)');
}
function chandelier(c, cx, y, lit) {
  R(c, cx - .5, y, 1, 5, '#caa'); R(c, cx - 6, y + 5, 12, 2, GOLD); R(c, cx - 5, y + 7, 2, 3, lit ? '#ffe9a0' : '#d8c890'); R(c, cx - 1, y + 7, 2, 3, lit ? '#ffe9a0' : '#d8c890'); R(c, cx + 3, y + 7, 2, 3, lit ? '#ffe9a0' : '#d8c890');
}
// quantos "cômodos" cabem na largura da sala e a sequência de cada modelo
const nZones = w => Math.max(1, Math.floor(w / 56));
const SEQ = [[0, 1, 2, 3], [2, 0, 3, 1], [3, 2, 1, 0], [1, 3, 0, 2], [2, 3, 0, 1], [0, 2, 1, 3]];

// ------------------------------------------------------------ moradias (kitnet, apartamento, cobertura)
const HOME_PAL = [
  {wall: '#cbc1ae', floor: '#7f705b', sofa: '#6e6e6e', bed: '#8f9aa6', wood: '#8a6a47', acc: '#a56a5a'},
  {wall: '#ddd0b0', floor: '#9a8564', sofa: '#4f7fa0', bed: '#9ec1d8', wood: '#a07a4f', acc: '#d9a441'},
  {wall: '#e8d9c4', floor: '#b09470', sofa: '#7a4f9a', bed: '#d9c1e8', wood: '#7a5535', acc: '#4a8c6a'},
  {wall: '#f1eadf', floor: '#d8cdb8', sofa: '#1f4a5e', bed: '#f4e6b8', wood: '#3a2618', acc: GOLD},
];
const HOME_ZONES = [
  // sala: sofá, TV e abajur
  (c, X, zw, y, fy, p, wl, o, f) => {
    if (wl >= 2) R(c, X + 4, fy - 1.5, zw - 8, 1.5, p.acc);
    glass(c, X + 6, y + 5, Math.min(26, zw * .4), 11, o.night, o.lit, wl, 13); curtains(c, X + 6, Math.min(26, zw * .4), y + 5, wl, p.acc);
    const sw = clamp(zw * .4, 18, 30), sx = X + 6, dk = mixHex(p.sofa, '#000000', .25);
    R(c, sx, fy - 8, sw, 6, p.sofa); R(c, sx, fy - 14, sw, 6, dk); R(c, sx - 2, fy - 10, 3, 8, dk); R(c, sx + sw - 1, fy - 10, 3, 8, dk); R(c, sx, fy - 2, 2, 2, '#333'); R(c, sx + sw - 2, fy - 2, 2, 2, '#333');
    if (wl === 0) R(c, sx + 5, fy - 11, 9, 3, '#c9a');
    if (wl >= 1 && zw > 70) { R(c, sx + sw + 3, fy - 4, 9, 2, p.wood); R(c, sx + sw + 4, fy - 2, 1, 2, p.wood); R(c, sx + sw + 10, fy - 2, 1, 2, p.wood); }
    const tw = 7 + wl * 2, th = 5 + wl, tx = X + zw - tw - 7;
    R(c, tx - 2, fy - 5, tw + 4, 5, p.wood); R(c, tx, fy - 5 - th, tw, th, '#15181f');
    R(c, tx + 1, fy - 4 - th, tw - 2, th - 2, o.night && o.lit ? ['#6aa8ff', '#c8d8ff', '#9a7aff', '#7fe0c8'][Math.floor((o.time || 0) * 5 + f.id) % 4] : '#2a3140');
    if (wl >= 2) { R(c, sx + sw + 1, fy - 19, 1.5, 17, '#555'); R(c, sx + sw - 1, fy - 23, 6, 5, o.lit ? '#ffe9a0' : '#d8c890'); }
    if (wl >= 3) chandelier(c, X + zw * .55, y, o.lit);
  },
  // cozinha: bancada, armário suspenso e geladeira
  (c, X, zw, y, fy, p, wl, o) => {
    const cw = zw - 22;
    R(c, X + 4, fy - 11, cw, 11, wl >= 3 ? '#e8e4dc' : wl === 2 ? p.wood : wl === 1 ? '#b9b19f' : '#9a9486');
    R(c, X + 4, fy - 12, cw, 2, wl >= 3 ? '#6b6b6b' : '#999');
    R(c, X + 8, fy - 17, 6, 5, '#aaa'); R(c, X + 9, fy - 19, 4, 2, '#888');
    if (wl === 0) { R(c, X + 20, fy - 16, 7, 4, '#ddd'); R(c, X + 21, fy - 18, 5, 2, '#bbb'); }
    if (wl >= 1) { R(c, X + 4, fy - 28, cw, 8, p.wood); R(c, X + 4 + cw / 2, fy - 28, 1, 8, 'rgba(0,0,0,.3)'); }
    else R(c, X + 6, fy - 26, cw - 4, 3, '#8a8478');
    if (wl >= 3) { chandelier(c, X + cw / 2 + 4, y, o.lit); }
    const fw = wl >= 3 ? 13 : 11, fh = wl === 0 ? 16 : wl >= 2 ? 25 : 21;
    R(c, X + zw - fw - 4, fy - fh, fw, fh, wl >= 3 ? '#c8ccd0' : '#e3e3e3'); R(c, X + zw - fw - 4, fy - fh * .62, fw, 1, '#999'); R(c, X + zw - 7, fy - fh * .8, 1.5, 5, '#777');
  },
  // quarto: cama, criado-mudo e guarda-roupa
  (c, X, zw, y, fy, p, wl, o) => {
    const bw = clamp(zw * .48, 26, 40), bx = X + 8, dk = mixHex(p.bed, '#000000', .18);
    glass(c, bx + 4, y + 5, Math.min(22, bw - 4), 8, o.night, o.lit, wl, 11); curtains(c, bx + 4, Math.min(22, bw - 4), y + 5, wl, p.acc);
    if (wl >= 2) R(c, X + 4, fy - 1.5, zw - 8, 1.5, p.acc);
    R(c, bx, fy - 7, bw, 5, p.bed); R(c, bx + 9, fy - 7, bw - 9, 5, dk); if (wl >= 3) R(c, bx + 9, fy - 7, 1, 5, GOLD);
    R(c, bx + 2, fy - 10, 7, 4, wl === 0 ? '#ddd' : '#fff'); R(c, bx - 1, fy - 14, 3, 12, wl >= 3 ? GOLD : p.wood); R(c, bx - 1, fy - 2, 2, 2, '#333'); R(c, bx + bw - 2, fy - 2, 2, 2, '#333');
    R(c, bx + bw + 2, fy - 6, 6, 6, p.wood); R(c, bx + bw + 3, fy - 9, 3, 3, o.lit ? '#ffe9a0' : '#d8c890');
    if (wl >= 1) { R(c, X + zw - 17, fy - 25, 13, 25, p.wood); R(c, X + zw - 11, fy - 25, 1, 25, 'rgba(0,0,0,.35)'); R(c, X + zw - 12.5, fy - 13, 1, 3, '#ccc'); R(c, X + zw - 9.5, fy - 13, 1, 3, '#ccc'); }
    else { R(c, X + zw - 16, fy - 22, 1.5, 22, '#777'); R(c, X + zw - 16, fy - 22, 12, 1.5, '#777'); for (let i = 0; i < 3; i++) R(c, X + zw - 14 + i * 4, fy - 20, 3, 9, ['#c66', '#6a8', '#68c'][i]); }
  },
  // escritório em casa: mesa com computador e estante
  (c, X, zw, y, fy, p, wl, o, f) => {
    glass(c, X + 6, y + 5, Math.min(24, zw * .4), 8, o.night, o.lit, wl, 12); curtains(c, X + 6, Math.min(24, zw * .4), y + 5, wl, p.acc);
    if (wl >= 2) R(c, X + 4, fy - 1.5, zw - 8, 1.5, p.acc);
    R(c, X + 6, fy - 9, 26, 2, p.wood); R(c, X + 7, fy - 7, 2, 7, p.wood); R(c, X + 29, fy - 7, 2, 7, p.wood);
    R(c, X + 17, fy - 8, 7, 4, wl >= 3 ? '#7a1f2b' : '#333'); R(c, X + 19, fy - 15, 3, 7, wl >= 3 ? '#7a1f2b' : '#333');
    const mw = 7 + (wl >= 2 ? 3 : 0);
    R(c, X + 10, fy - 17, mw, 7, '#15181f'); R(c, X + 11, fy - 16, mw - 2, 5, o.lit ? '#7fd4ff' : '#3a4a5c'); R(c, X + 12 + mw / 2 - 3, fy - 10, 2, 1, '#555');
    if (wl === 0) { R(c, X + zw - 21, fy - 10, 15, 10, '#b08a5a'); R(c, X + zw - 19, fy - 19, 11, 9, '#c49a66'); R(c, X + zw - 21, fy - 6, 15, 1, 'rgba(0,0,0,.25)'); }
    else {
      R(c, X + zw - 21, fy - 28, 17, 28, p.wood);
      for (let r = 0; r < 3; r++) { R(c, X + zw - 20, fy - 25 + r * 9, 15, 1, 'rgba(0,0,0,.35)'); for (let b = 0; b < 5; b++) R(c, X + zw - 19 + b * 3, fy - 33 + r * 9 + 4, 2, 7 - (b % 2), ['#c44', '#48a', '#cb4', '#4a8', '#a6c'][(b + r + f.id) % 5]); }
      if (wl >= 3) { R(c, X + zw - 12, fy - 34, 4, 4, '#4a8ccb'); R(c, X + zw - 11, fy - 30, 2, 2, GOLD); }
    }
  },
];
function paintHome(c, f, x, y, w, h, o) {
  const wl = wealth(f), p = HOME_PAL[wl], vac = o.vacant, floorY = y + h - SLAB, v = vr(f, 6);
  R(c, x, y, w, h, vac ? mixHex(p.wall, '#9a9488', .5) : p.wall);
  R(c, x, floorY - 3, w, 3, p.floor);
  if (!o.lod) return;
  for (let i = 0; i < w; i += 6) R(c, x + i, y, 3, h - SLAB - 3, 'rgba(160,120,80,.10)');
  if (vac) { vacantRoom(c, f, x, y, w, h, o, 'À VENDA', true); return; }
  const n = nZones(w), zw = w / n;
  for (let i = 0; i < n; i++) {
    HOME_ZONES[SEQ[v][i % 4]](c, x + i * zw, zw, y, floorY, p, wl, o, f);
    if (i) R(c, x + i * zw - .5, y, 1, h - SLAB - 3, 'rgba(0,0,0,.12)');
  }
  if (o.night && o.lit) R(c, x, y, w, h - SLAB, 'rgba(110,150,255,.06)');
}

// ------------------------------------------------------------ escritórios
const OFFICE_PAL = [
  {wall: '#c9c9bd', floor: '#85857a', desk: '#8c8c84', chair: '#555', acc: '#b9b05a', part: '#a8a89a'},
  {wall: '#d5dde8', floor: '#8793a3', desk: '#a98b63', chair: '#3d5a80', acc: '#5b8fb0', part: '#a9b6c8'},
  {wall: '#e6e0d2', floor: '#a79c86', desk: '#7a5535', chair: '#2f4858', acc: '#4a8c6a', part: '#bfb6a0'},
  {wall: '#5a463a', floor: '#2f2620', desk: '#2b1d14', chair: '#7a1f2b', acc: GOLD, part: '#3c2d24'},
];
const OFFICE_ZONES = [
  // baias: mesas com monitor e divisória
  (c, X, zw, y, fy, p, wl, o) => {
    glass(c, X + 3, y + 4, zw - 6, 9, o.night, o.lit, wl, wl === 0 ? 12 : 18);
    const n = Math.max(2, Math.floor(zw / 28)), sl = (zw - 6) / n;
    for (let i = 0; i < n; i++) {
      const dx = X + 5 + i * sl;
      R(c, dx + sl - 6, fy - 17, 1.5, 17, p.part);
      R(c, dx, fy - 8, 14, 2, p.desk); R(c, dx + 1, fy - 6, 2, 6, p.desk); R(c, dx + 11, fy - 6, 2, 6, p.desk);
      R(c, dx + 4, fy - 15, wl >= 2 ? 8 : 6, wl >= 2 ? 7 : 6, '#222a36'); R(c, dx + 5, fy - 14, wl >= 2 ? 6 : 4, wl >= 2 ? 5 : 4, o.lit ? '#7fd4ff' : '#3a4a5c');
      if (wl >= 1) { R(c, dx - 4, fy - 8, 3, 8, p.chair); R(c, dx - 5, fy - 12, 2, 5, p.chair); }
    }
    if (wl === 0) { R(c, X + 3, fy - 5, 8, 5, '#b99a66'); R(c, X + 4, fy - 9, 6, 4, '#c9aa76'); }
    if (wl >= 3) chandelier(c, X + zw / 2, y, o.lit);
  },
  // sala de reunião: mesa, cadeiras e lousa
  (c, X, zw, y, fy, p, wl, o) => {
    R(c, X + 6, y + 6, Math.min(30, zw * .5), 14, '#f4f4ee'); R(c, X + 6, y + 6, Math.min(30, zw * .5), 1.5, '#999');
    if (wl >= 2) { R(c, X + 9, y + 9, 9, 1, p.acc); R(c, X + 9, y + 12, 14, 1, '#999'); R(c, X + 9, y + 15, 7, 1, '#c44'); }
    else { R(c, X + 9, y + 10, 6, 1, '#999'); }
    const tw = zw - 22;
    R(c, X + 10, fy - 10, tw, 3, wl >= 3 ? '#4a2f20' : p.desk); R(c, X + 14, fy - 7, 2, 7, p.desk); R(c, X + 10 + tw - 6, fy - 7, 2, 7, p.desk);
    for (let i = 0; i < 3; i++) { const cx = X + 11 + i * (tw - 6) / 2.4; R(c, cx, fy - 16, 4, 6, p.chair); R(c, cx, fy - 6, 4, 2, p.chair); }
    if (wl >= 1) { R(c, X + zw - 8, fy - 11, 5, 4, '#3a8'); R(c, X + zw - 7, fy - 7, 3, 7, '#7a5535'); }
    if (wl >= 3) { chandelier(c, X + zw * .5, y, o.lit); frame(c, X + zw - 20, y + 8, 12, 9, wl, '#4a6fa5'); }
    else if (wl >= 2) R(c, X + zw - 18, y + 8, 12, 8, '#15181f');
  },
  // arquivo: armários, impressora e uma mesa
  (c, X, zw, y, fy, p, wl, o) => {
    glass(c, X + zw - 26, y + 5, 20, 8, o.night, o.lit, wl, 20);
    for (let i = 0; i < 2; i++) { const cx = X + 4 + i * 11; R(c, cx, fy - 22, 10, 22, wl >= 3 ? '#3c2d24' : '#8a929d'); for (let r = 0; r < 3; r++) { R(c, cx + 1, fy - 20 + r * 7, 8, 6, wl >= 3 ? '#4a382b' : '#9ba4af'); R(c, cx + 4, fy - 17 + r * 7, 2, 1.5, wl >= 3 ? GOLD : '#555'); } }
    R(c, X + 28, fy - 8, 15, 2, p.desk); R(c, X + 29, fy - 6, 2, 6, p.desk); R(c, X + 40, fy - 6, 2, 6, p.desk);
    R(c, X + 31, fy - 13, 8, 5, '#d9d9d9'); R(c, X + 32, fy - 11, 6, 1, '#555');
    if (wl >= 1) { R(c, X + zw - 9, fy - 14, 5, 14, wl >= 2 ? '#3a8' : '#6a8'); R(c, X + zw - 8, fy - 17, 3, 4, '#7a5535'); R(c, X + zw - 9, fy - 3, 6, 3, '#7a5535'); }
    if (wl === 0) { R(c, X + 46, fy - 5, 12, 5, '#b99a66'); R(c, X + 48, fy - 9, 8, 4, '#c9aa76'); }
    if (wl >= 3) chandelier(c, X + zw * .55, y, o.lit);
  },
  // sala executiva: mesa grande, poltrona e quadro (só nas faixas mais caras; nas baratas vira baia)
  (c, X, zw, y, fy, p, wl, o, f) => {
    if (wl < 2) return OFFICE_ZONES[0](c, X, zw, y, fy, p, wl, o, f);
    glass(c, X + 4, y + 4, zw * .45, 11, o.night, o.lit, wl, 18);
    frame(c, X + zw * .62, y + 7, 14, 10, wl, '#a55');
    R(c, X + 6, fy - 11, 30, 4, p.desk); R(c, X + 8, fy - 7, 3, 7, p.desk); R(c, X + 31, fy - 7, 3, 7, p.desk);
    R(c, X + 14, fy - 16, 8, 5, '#222a36'); R(c, X + 15, fy - 15, 6, 3, o.lit ? '#7fd4ff' : '#3a4a5c');
    R(c, X + zw - 19, fy - 7, 14, 7, p.chair); R(c, X + zw - 19, fy - 14, 4, 8, p.chair);
    if (wl >= 3) chandelier(c, X + zw * .5, y, o.lit); else R(c, X + zw - 8, fy - 14, 4, 14, '#3a8');
  },
];
function paintOffice(c, f, x, y, w, h, o) {
  const wl = wealth(f), p = OFFICE_PAL[wl], vac = o.vacant, floorY = y + h - SLAB, v = vr(f, 6);
  R(c, x, y, w, h, vac ? mixHex(p.wall, '#9aa0a8', .55) : p.wall);
  R(c, x, floorY - 3, w, 3, p.floor);
  if (wl >= 3 && !vac) R(c, x, y + 14, w, 1, GOLD);
  if (!o.lod) return;
  if (vac) { vacantRoom(c, f, x, y, w, h, o, 'ALUGA-SE', false); return; }
  const n = nZones(w), zw = w / n;
  for (let i = 0; i < n; i++) {
    // 1 zona: os 3 modelos são baia, reunião e arquivo; salas largas combinam (e a executiva aparece nas faixas caras)
    const seq = n === 1 ? [0, 1, 2, 3, 0, 2][v] : [[0, 1], [3, 0], [2, 3], [1, 2], [0, 3], [2, 1]][v][i % 2];
    OFFICE_ZONES[seq](c, x + i * zw, zw, y, floorY, p, wl, o, f);
    if (i) R(c, x + i * zw - .5, y, 1, h - SLAB - 3, 'rgba(0,0,0,.15)');
  }
  if (wl <= 1) R(c, x, y, w, 3, o.lit ? 'rgba(255,255,230,.35)' : 'rgba(255,255,230,.15)');   // lâmpada fluorescente
}

// ------------------------------------------------------------ hotel (quarto simples, duplo, suíte)
const HOTEL_WALL = {single: ['#c4cbbd', '#cfe3cc', '#dfe9d8', '#efe9d2'], suite: ['#cbc3d6', '#d8cfe8', '#e2d8f0', '#efe6d0']};
const HOTEL_BED = ['#9aa5ab', '#e3ece8', '#ffffff', '#f4e6b8'], HOTEL_ACC = ['#a56a5a', '#4a8c6a', '#4a6fa5', GOLD], HOTEL_WOOD = ['#8a6a47', '#a07a4f', '#7a5535', '#3a2618'];
function paintHotel(c, f, x, y, w, h, o) {
  const wl = wealth(f), occ = f.guests.length > 0, floorY = y + h - SLAB, v = vr(f, 3), dirty = f.dirty, k = f.k;
  const wall = (k === 'suite' ? HOTEL_WALL.suite : HOTEL_WALL.single)[wl], acc = HOTEL_ACC[wl], wood = HOTEL_WOOD[wl];
  R(c, x, y, w, h, occ ? wall : mixHex(wall, '#8f9690', .35));
  R(c, x, floorY - 3, w, 3, wl >= 3 ? '#8a6a47' : wl === 2 ? '#a89572' : '#8d8a7c');
  if (!o.lod) return;
  R(c, x, y, w, 8, 'rgba(0,0,0,.06)');
  const nb = k === 'twin' ? 2 : 1, bedW = k === 'suite' ? 28 : 15, gap = 3, total = nb * bedW + (nb - 1) * gap;
  const bx0 = v === 1 ? x + 4 : v === 0 ? x + w - total - 4 : x + (w - total) / 2;
  // janela (modelos 0 e 2) ou quadro e TV (modelo 1)
  if (v !== 1) {
    const gw = v === 0 ? Math.min(w - total - 12, 26) : Math.min(w - 6, 26), gx = v === 0 ? x + 4 : x + (w - gw) / 2;
    if (gw >= 6) { glass(c, gx, y + 5, gw, 10, o.night, o.lit, wl, 14); curtains(c, gx, gw, y + 5, wl, acc); }
  } else {
    const tx = x + w - 14;
    if (w >= 32) { R(c, tx, y + 9, 10, 7, '#15181f'); R(c, tx + 1, y + 10, 8, 5, o.lit ? '#6aa8ff' : '#2a3140'); }
    if (w >= 60) frame(c, x + w * .55 - 7, y + 7, 12, 9, wl, acc);
  }
  for (let i = 0; i < nb; i++) {
    const bx = bx0 + i * (bedW + gap), sheet = dirty ? '#b99' : HOTEL_BED[wl];
    R(c, bx, floorY - 6, bedW, 5, sheet); R(c, bx + (k === 'suite' ? 3 : 1), floorY - 9, 5, 4, dirty ? '#977' : '#fff');
    R(c, bx + 6, floorY - 6, bedW - 6, 5, dirty ? '#a88' : mixHex(HOTEL_BED[wl], acc, wl === 0 ? .2 : .45));
    R(c, bx - 1, floorY - 12 - (wl >= 2 ? 2 : 0), 2, 10 + (wl >= 2 ? 2 : 0), wl >= 3 ? GOLD : wood); R(c, bx, floorY - 2, 2, 2, '#555'); R(c, bx + bedW - 2, floorY - 2, 2, 2, '#555');
    if (wl >= 3 && k === 'suite') R(c, bx + 6, floorY - 6, 1, 5, GOLD);
  }
  // criado-mudo com abajur, mesa ou poltrona conforme o modelo e a largura
  if (w >= 32 + (nb - 1) * 20) {
    const nx = v === 1 ? bx0 + total + 2 : bx0 - 7;
    if (nx > x + 1 && nx + 5 < x + w) { R(c, nx, floorY - 5, 5, 5, wood); R(c, nx + 1, floorY - 8, 3, 3, o.lit ? '#ffe9a0' : '#d8c890'); }
  }
  if (w >= 64 && v !== 1) { const ax = v === 0 ? x + 6 : x + w - 14; R(c, ax, floorY - 8, 9, 8, wl >= 2 ? acc : '#8a8a8a'); R(c, ax, floorY - 12, 3, 6, wl >= 2 ? acc : '#8a8a8a'); }
  if (k === 'suite') {
    const sx = v === 1 ? x + w - 30 : x + 6;
    if (v !== 0 || w > 80) { R(c, sx, floorY - 7, 22, 5, wl >= 2 ? '#6f5b8a' : '#8a7f94'); R(c, sx, floorY - 12, 22, 5, wl >= 2 ? '#5b4a75' : '#766b80'); }
    if (wl >= 3) chandelier(c, x + w * .5, y, o.lit);
    if (wl >= 2) { R(c, x + w - 8, floorY - 14, 5, 14, '#3a8'); R(c, x + w - 9, floorY - 3, 7, 3, '#7a5535'); }
  }
  if (wl >= 3 && k !== 'suite') R(c, x + 2, y + 2, w - 4, 1.5, GOLD);   // faixa dourada da decoração
  if (wl === 0) { R(c, x + 2, y + 16, 5, 5, 'rgba(120,100,60,.35)'); }   // mancha de infiltração
  if (f.k === 'suite' && occ) R(c, x, y, w, h, 'rgba(160,120,200,.10)');
  if (occ && f._dark && !f.bugs && !dirty) {   // madrugada: hóspede dormindo, cortina fechada e luz apagada
    for (let i = 0; i < nb; i++) {
      const bx = bx0 + i * (bedW + gap);
      c.fillStyle = SKIN_TONES[(f.id + i) % SKIN_TONES.length]; c.beginPath(); c.arc(bx + 5, floorY - 8.5, 2.2, 0, 7); c.fill();
      R(c, bx + 3, floorY - 7.5, bedW - 5, 3.5, mixHex(HOTEL_BED[wl], '#445', .3));   // corpo sob o cobertor
    }
    R(c, x, y, w, h - SLAB, 'rgba(8,10,25,.42)');
    const zt = (o.time || 0) * 1.2;
    c.fillStyle = 'rgba(220,230,255,.8)'; c.font = 'bold 6px system-ui'; c.textAlign = 'left';
    for (let i = 0; i < 2; i++) { const p = (zt + i * .5) % 1; c.globalAlpha = 1 - p; c.fillText('z', bx0 + 9 + p * 5 + i * 4, floorY - 12 - p * 9); }
    c.globalAlpha = 1;
  }
  if (dirty) { c.fillStyle = '#c22'; c.font = 'bold 7px system-ui'; c.textAlign = 'center'; c.fillText('SUJO', x + w / 2, y + 10); }
  if (!occ && !dirty && !f.bugs) sign(c, x + 3, y + 9, 'LIVRE', '#fff', '#2a8f4a');
  if (f.bugs) {
    c.fillStyle = 'rgba(90,40,100,.25)'; c.fillRect(x, y, w, h - SLAB);
    c.fillStyle = '#3a2412';
    for (let i = 0; i < 5; i++) { const t = (o.time || 0) * 2 + i * 1.9; c.beginPath(); c.ellipse(x + 6 + ((Math.sin(t) * .5 + .5) * (w - 12)), floorY - 2 - (i % 2) * 5, 1.9, 1.1, 0, 0, 7); c.fill(); }
    c.fillStyle = '#c3d'; c.font = 'bold 6px system-ui'; c.textAlign = 'center'; c.fillText('BARATAS', x + w / 2, y + 9);
  }
}

// ------------------------------------------------------------ boutique (3 lojas × 4 faixas)
const SHOP_NAMES = [['BAZAR', 'MODA', 'BOUTIQUE', 'GRIFE'], ['SAPATARIA', 'CALÇADOS', 'SAPATOS', 'ATELIÊ'], ['USADOS', 'LIVROS', 'TECNOLOGIA', 'GALERIA'], ['FEIRA', 'FLORES', 'PRESENTES', 'JARDIM'], ['BRINQUEDOS', 'JOGOS', 'GAMES', 'COLEÇÃO'], ['BIJU', 'ACESSÓRIOS', 'RELÓGIOS', 'JOALHERIA']];
// ------------------------------------------------------------ comércio sem faixa de preço (4 modelos cada)
function awning(c, x, y, w, a, b, step = 8) { R(c, x, y, w, 4, a); for (let i = 0; i < w; i += step * 2) R(c, x + i, y, step, 4, b); }
function paintResto(c, f, x, y, w, h, o) {
  const floorY = y + h - SLAB, v = vr(f, 6), glow = o.night || o.lit;
  R(c, x, y, w, h, ['#5f3030', '#3a1f1a', '#6b3a22', '#1d2a44', '#7a3a2a', '#2f5a4a'][v]);
  if (!o.lod) return;
  for (let i = 0; i < w; i += 5) R(c, x + i, y, 2, h - SLAB, 'rgba(255,255,255,.04)');
  const AW = [['#a3202a', '#f4f1ea'], ['#222', '#c0392b'], ['#5a2a14', '#d9a23a'], ['#14203a', '#d4af37'], ['#2e7a3a', '#f4f1ea'], ['#3f7a42', '#d9f0c8']][v];
  awning(c, x, y, w, AW[0], AW[1], 6);   // toldo da fachada, com a cor de cada temática
  const n = Math.floor(w / 28);
  if (v === 0) {   // clássico
    for (let i = 0; i < 4; i++) { const lx = x + 12 + i * (w - 24) / 3; R(c, lx, y, 1, 5, '#caa'); R(c, lx - 3, y + 5, 7, 3, glow ? '#ffd98a' : '#d8c890'); }
    for (let i = 0; i < n; i++) { const tx = x + 8 + i * (w - 16) / n; R(c, tx, floorY - 8, 14, 2, '#f1ead8'); R(c, tx + 6, floorY - 6, 2, 6, '#caa'); R(c, tx - 1, floorY - 12, 3, 5, '#c9a'); R(c, tx + 12, floorY - 12, 3, 5, '#c9a'); }
    sign(c, x + 4, y + 16, 'RESTAURANTE', '#ffe9b0', '#7a1f26');
  } else if (v === 1) {   // japonês
    for (let i = 0; i < 5; i++) { const lx = x + 14 + i * (w - 28) / 4; R(c, lx, y, 1, 4, '#caa'); R(c, lx - 3, y + 4, 7, 8, glow ? '#e8453c' : '#a8362f'); R(c, lx - 3, y + 4, 7, 1, '#222'); R(c, lx - 3, y + 11, 7, 1, '#222'); }
    R(c, x + 4, floorY - 9, w - 8, 3, '#d9b88a'); R(c, x + 4, floorY - 6, w - 8, 6, '#4a2f1c');
    for (let i = 0; i < 6; i++) { const sx = x + 10 + i * (w - 24) / 5; R(c, sx, floorY - 12, 6, 3, '#f4f1e8'); R(c, sx, floorY - 13, 6, 1.5, i % 2 ? '#f08a5d' : '#e0443a'); R(c, sx + 2, floorY - 3, 2, 3, '#caa'); }
    sign(c, x + 4, y + 17, 'SUSHI BAR', '#f4d58a', '#1c1c1c');
  } else if (v === 2) {   // churrascaria
    R(c, x + 6, floorY - 16, 34, 16, '#2a1a12'); R(c, x + 8, floorY - 8, 30, 6, glow ? '#ff7a1c' : '#9a4a12'); R(c, x + 10, floorY - 5, 26, 3, '#ffd24a');
    for (let i = 0; i < 4; i++) { R(c, x + 10 + i * 7, floorY - 22, 1.5, 20, '#ccc'); R(c, x + 8 + i * 7, floorY - 19, 5, 4, '#a0412a'); }
    for (let i = 0; i < Math.floor((w - 56) / 30); i++) { const tx = x + 52 + i * 30; R(c, tx, floorY - 8, 16, 2, '#c43b2a'); R(c, tx + 7, floorY - 6, 2, 6, '#caa'); R(c, tx - 1, floorY - 12, 3, 5, '#c9a'); R(c, tx + 14, floorY - 12, 3, 5, '#c9a'); }
    sign(c, x + 48, y + 16, 'CHURRASCARIA', '#ffd9a0', '#5a2a14');
  } else if (v === 3) {   // gourmet
    for (let i = 0; i < 3; i++) chandelier(c, x + w * (i + .5) / 3, y, glow);
    for (let i = 0; i < n; i++) { const tx = x + 8 + i * (w - 16) / n; R(c, tx - 1, floorY - 9, 16, 3, '#fff'); R(c, tx + 5, floorY - 6, 4, 6, '#fff'); R(c, tx + 6, floorY - 12, 2, 3, GOLD); R(c, tx - 2, floorY - 13, 3, 6, '#2b3a5c'); R(c, tx + 13, floorY - 13, 3, 6, '#2b3a5c'); }
    R(c, x + 4, y + 16, 3, floorY - y - 16, '#14203a'); R(c, x + w - 7, y + 16, 3, floorY - y - 16, '#14203a');
    sign(c, x + w - 44, y + 16, 'BISTRÔ', '#14203a', GOLD);
  } else if (v === 4) {   // cantina italiana: toalhas xadrez e garrafas de vinho
    for (let i = 0; i < n; i++) { const tx = x + 8 + i * (w - 16) / n; for (let k = 0; k < 4; k++) R(c, tx + k * 3.5, floorY - 9, 3.5, 2.5, k % 2 ? '#fff' : '#d33'); R(c, tx + 6, floorY - 6.5, 2, 6.5, '#caa'); R(c, tx + 6, floorY - 12, 2, 3, '#4a8c4a'); R(c, tx + 5, floorY - 13, 4, 1.5, '#fff'); R(c, tx - 1, floorY - 12, 3, 5, '#c9a'); R(c, tx + 12, floorY - 12, 3, 5, '#c9a'); }
    for (let i = 0; i < 6; i++) R(c, x + 6 + i * 5, y + 6, 3, 8, ['#2a6a2a', '#7a1f2b', '#caa'][i % 3]);
    R(c, x + 4, y + 15, 34, 1.5, '#caa');
    sign(c, x + w - 46, y + 16, 'CANTINA', '#fff', '#2e7a3a');
  } else {   // vegetariano: madeira clara e muitas plantas
    R(c, x, y, w, 5, '#3f7a42');
    for (let i = 0; i < 6; i++) { const px = x + 8 + i * (w - 16) / 5; R(c, px, y + 5, 1, 5 + (i % 3) * 3, '#3f7a42'); R(c, px - 2, y + 9 + (i % 3) * 3, 5, 3, '#6bbf4a'); }
    for (let i = 0; i < n; i++) { const tx = x + 8 + i * (w - 16) / n; R(c, tx, floorY - 8, 14, 2, '#e8d5a8'); R(c, tx + 6, floorY - 6, 2, 6, '#b99a66'); R(c, tx + 5, floorY - 11, 4, 3, '#6bbf4a'); R(c, tx - 1, floorY - 12, 3, 5, '#b99a66'); R(c, tx + 12, floorY - 12, 3, 5, '#b99a66'); }
    sign(c, x + 6, y + 18, 'VERDE & CIA', '#fff', '#3f7a42');
  }
}

function paintBar(c, f, x, y, w, h, o) {
  const floorY = y + h - SLAB, v = vr(f, 6), on = o.night || o.lit, t = o.time || 0;
  R(c, x, y, w, h, ['#2e2140', '#2f5d4a', '#150f26', '#1a2740', '#4a3018', '#3a1626'][v]);
  if (!o.lod) return;
  if (v === 0) {   // pub
    R(c, x, y, w, 4, '#6a3d8f');
    R(c, x + 4, floorY - 9, w - 8, 3, '#6b4a2c'); R(c, x + 4, floorY - 6, w - 8, 6, '#3a2412');
    for (let i = 0; i < 4; i++) R(c, x + 7 + i * (w - 16) / 3, floorY - 14, 3, 5, ['#d46', '#4b6', '#fc4', '#4cd'][i]);
    for (let i = 0; i < 3; i++) { const sx = x + 8 + i * (w - 16) / 2; R(c, sx, floorY - 4, 1.5, 4, '#caa'); R(c, sx - 2, floorY - 5, 5, 1.5, '#caa'); }
    c.fillStyle = on ? '#ff7ad9' : '#b58fc4'; c.font = 'bold 7px system-ui'; c.textAlign = 'center'; c.fillText('BAR', x + w / 2, y + 12);
  } else if (v === 1) {   // boteco
    for (let i = 0; i < w; i += 8) R(c, x + i, y + 4, 7, h - SLAB - 12, i % 16 ? '#3a7a5c' : '#2c6a4e');
    R(c, x, floorY - 12, w, 1.5, '#e8e4dc');
    R(c, x + 8, y + 6, 40, 11, '#f4f1e8'); c.fillStyle = '#c0392b'; c.font = 'bold 7px system-ui'; c.textAlign = 'center'; c.fillText('BOTECO', x + 28, y + 14.5);
    R(c, x + w - 34, y + 7, 28, 14, '#d9a441'); c.fillStyle = '#fff'; c.font = 'bold 5px system-ui'; c.fillText('CERVEJA', x + w - 20, y + 16);
    for (let i = 0; i < 2; i++) { const tx = x + 10 + i * 40; R(c, tx, floorY - 8, 14, 2, '#c43b2a'); R(c, tx + 6, floorY - 6, 2, 6, '#999'); R(c, tx + 3, floorY - 11, 3, 3, '#e8c648'); R(c, tx + 9, floorY - 11, 3, 3, '#e8c648'); R(c, tx - 1, floorY - 12, 3, 5, '#caa'); R(c, tx + 12, floorY - 12, 3, 5, '#caa'); }
    R(c, x + w - 36, floorY - 10, 30, 3, '#6b4a2c'); R(c, x + w - 36, floorY - 7, 30, 7, '#3a2412');
  } else if (v === 2) {   // balada e karaokê, com neon
    const blink = Math.sin(t * 6) > -.3;
    R(c, x + 6, floorY - 13, w * .42, 13, '#241a40'); R(c, x + 6, floorY - 14, w * .42, 1.5, '#ff4fd0');
    R(c, x + 24, floorY - 25, 2, 12, '#ccc'); R(c, x + 21, floorY - 27, 8, 4, '#222');
    c.strokeStyle = on ? '#4fe3ff' : '#2c7c8a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x + w * .55, y + 8); c.lineTo(x + w * .7, y + 20); c.lineTo(x + w * .85, y + 8); c.stroke();
    c.fillStyle = on && blink ? '#ff4fd0' : '#8a2d76'; c.font = 'bold 8px system-ui'; c.textAlign = 'center'; c.fillText('KARAOKÊ', x + w * .7, y + 31);
    for (let i = 0; i < 4; i++) R(c, x + 8 + i * 12, y + 6, 6, 3, on ? ['#ff4fd0', '#4fe3ff', '#ffd24a', '#7cff6b'][(i + Math.floor(t * 3)) % 4] : '#444');
  } else if (v === 3) {   // lounge
    R(c, x, y, w, 3, '#3a5ca8');
    for (let i = 0; i < 2; i++) { const sx = x + 6 + i * (w * .5); R(c, sx, floorY - 8, 24, 6, '#3a5ca8'); R(c, sx, floorY - 14, 24, 6, '#2c4686'); R(c, sx - 2, floorY - 10, 3, 8, '#2c4686'); R(c, sx + 23, floorY - 10, 3, 8, '#2c4686'); R(c, sx + 8, floorY - 4, 9, 2, '#caa'); }
    for (let i = 0; i < 4; i++) { const lx = x + 12 + i * (w - 24) / 3; R(c, lx, y + 4, 1, 6, '#668'); R(c, lx - 2, y + 10, 5, 3, on ? '#9ad0ff' : '#667'); }
    c.fillStyle = on ? '#9ad0ff' : '#667'; c.font = 'italic bold 7px serif'; c.textAlign = 'center'; c.fillText('Lounge', x + w / 2, y + 24);
  } else if (v === 4) {   // cervejaria artesanal: barris e torneiras
    for (let i = 0; i < 3; i++) { const bx = x + 6 + i * 20; R(c, bx, floorY - 14, 16, 14, '#8a5a2c'); R(c, bx, floorY - 11, 16, 1.5, '#444'); R(c, bx, floorY - 5, 16, 1.5, '#444'); R(c, bx + 6, floorY - 8, 4, 2, '#d9a441'); }
    R(c, x + w * .5, floorY - 10, w * .45, 3, '#6b4a2c'); R(c, x + w * .5, floorY - 7, w * .45, 7, '#2a1a0c');
    for (let i = 0; i < 4; i++) { const tx = x + w * .53 + i * 10; R(c, tx, floorY - 16, 2, 6, '#ccc'); R(c, tx - 1, floorY - 17, 4, 2, '#aaa'); R(c, tx + 5, floorY - 13, 3, 3, '#e8c648'); }
    c.fillStyle = on ? '#ffd98a' : '#b89a62'; c.font = 'bold 7px system-ui'; c.textAlign = 'center'; c.fillText('CERVEJARIA', x + w / 2, y + 12);
  } else {   // wine bar: adega e taças
    for (let r = 0; r < 3; r++) for (let i = 0; i < Math.floor((w - 10) / 7); i++) { R(c, x + 5 + i * 7, y + 5 + r * 7, 5, 5, ['#7a1f2b', '#2a4a2a', '#caa', '#5a1030'][(i + r) % 4]); }
    R(c, x + 4, floorY - 9, w * .6, 3, '#caa'); R(c, x + 4, floorY - 6, w * .6, 6, '#3a1626');
    for (let i = 0; i < 3; i++) { const gx = x + 12 + i * 14; R(c, gx, floorY - 15, 3, 4, on ? '#cde' : '#889'); R(c, gx + 1, floorY - 11, .8, 2, '#cde'); }
    c.fillStyle = on ? '#ff9ab0' : '#b0707e'; c.font = 'italic bold 7px serif'; c.textAlign = 'right'; c.fillText('Vinhos', x + w - 6, floorY - 6);
  }
}

// ------------------------------------------------------------ serviços de bairro: café, mercadinho, lavanderia, banco e jardim (3 modelos cada)
function sign(c, x, y, txt, col, bg) { c.fillStyle = bg; const wd = txt.length * 4.2 + 6; c.fillRect(x, y - 7, wd, 9); c.fillStyle = col; c.font = 'bold 6px system-ui'; c.textAlign = 'left'; c.fillText(txt, x + 3, y); }
function paintBike(c, f, x, y, w, h, o) {
  const floorY = y + h - SLAB, n = Math.max(2, Math.floor((w - 6) / 9)), fill = Math.max(0, Math.min(1, o.fill === undefined ? .5 : o.fill)), have = Math.round(fill * n);
  R(c, x, y, w, h, ['#c9d6c4', '#b9c8b4', '#d3dcce'][vr(f, 3)]);
  if (!o.lod) return;
  R(c, x + 2, floorY - 1.5, w - 4, 1.5, '#7a867a');   // canaleta do paraciclo
  const cols = ['#c0392b', '#2e6fb5', '#e8a317', '#3a9d5d', '#7a4a9e', '#444a55'];
  for (let i = 0; i < n; i++) {
    const bx = x + 5 + i * ((w - 10) / n) + 3;
    R(c, bx - 4.5, floorY - 6, 1, 5, '#59615a'); R(c, bx + 3.5, floorY - 6, 1, 5, '#59615a');   // arco do paraciclo, sempre visível
    if (i >= have) continue;   // a vaga enche e esvazia com os ciclistas que estão por perto
    c.strokeStyle = '#3d4640'; c.lineWidth = 1;
    for (const dx of [-3, 3]) { c.beginPath(); c.arc(bx + dx, floorY - 4, 3, 0, 7); c.stroke(); }
    c.strokeStyle = cols[(f.id + i) % 6]; c.beginPath(); c.moveTo(bx - 3, floorY - 4); c.lineTo(bx, floorY - 9); c.lineTo(bx + 3, floorY - 4); c.moveTo(bx, floorY - 9); c.lineTo(bx + 2, floorY - 11); c.stroke();
  }
  sign(c, x + 3, y + 6, 'BICICLETÁRIO'.slice(0, Math.max(4, Math.floor((w - 10) / 4.2))) , '#fff', '#4a6a45');
}
function paintPiscina(c, f, x, y, w, h, o) {
  const floorY = y + h - SLAB;
  R(c, x, y, w, h, ['#cfe9f2', '#c4dff0', '#d8eef0'][vr(f, 3)]);
  if (!o.lod) return;
  R(c, x + 3, floorY - 12, w - 6, 12, '#3a9ccc');
  c.strokeStyle = '#d6f1fb'; c.lineWidth = 1;
  for (let k = 0; k < 3; k++) { c.beginPath(); for (let i = 0; i <= w - 10; i += 4) c.lineTo(x + 5 + i, floorY - 9 + k * 3 + (i / 4 % 2 ? 1 : -1)); c.stroke(); }
  for (let i = 10; i < w - 6; i += 12) { R(c, x + i, floorY - 14, 1, 14, '#fff'); }
  sign(c, x + 3, y + 8, 'SPA', '#fff', '#2a7ca8');
}
function paintAuditorio(c, f, x, y, w, h, o) {
  const floorY = y + h - SLAB, glow = o.lit || !o.night;
  R(c, x, y, w, h, ['#c7bfd8', '#bdb3cc', '#cfc8de'][vr(f, 3)]);
  if (!o.lod) return;
  R(c, x + 4, floorY - 18, w - 8, 18, '#3a2f55');
  R(c, x + w / 2 - 14, floorY - 18, 28, 5, glow ? '#e8c26a' : '#7a6a4a');
  for (let r = 0; r < 3; r++) for (let i = 0; i < Math.floor((w - 16) / 5); i++) R(c, x + 8 + i * 5, floorY - 11 + r * 3.5, 3, 2.5, '#8a2f3a');
  sign(c, x + 3, y + 8, 'CONVENÇÕES', '#fff', '#4a3a6f');
}
// fila do ponto: bonequinhos esperando (f.rush = tamanho da fila)
function waiters(c, f, x, floorY, w, o = {}) {
  const n = Math.min(Math.floor((w - 8) / 4), Math.round(o.rushNow !== undefined ? o.rushNow : f.rush || 0));
  for (let i = 0; i < n; i++) {
    const px = x + 5 + i * 4, col = ['#c0392b', '#2e6fb5', '#3a9d5d', '#e8a317', '#7a4a9e'][(f.id + i) % 5];
    R(c, px, floorY - 8, 2.4, 5, col); R(c, px + .2, floorY - 3, 2, 3, '#333'); c.fillStyle = '#f0c9a0'; c.beginPath(); c.arc(px + 1.2, floorY - 10, 1.5, 0, 7); c.fill();
  }
}
function paintBusstop(c, f, x, y, w, h, o) {
  const floorY = y + h - SLAB;
  R(c, x, y, w, h, ['#dfe3e8', '#d3d9e0', '#e4e0d4'][vr(f, 3)]);
  if (!o.lod) return;
  R(c, x + 2, y + 5, w - 4, 3, '#b5832a'); R(c, x + 3, y + 8, 1.5, floorY - y - 8, '#666'); R(c, x + w - 4.5, y + 8, 1.5, floorY - y - 8, '#666');
  R(c, x + 6, floorY - 5, w - 12, 1.5, '#8a6a3a');
  waiters(c, f, x, floorY, w, o);
  sign(c, x + 4, y + 20, 'ÔNIBUS', '#fff', '#b5832a');
}
function paintTaxi(c, f, x, y, w, h, o) {
  const floorY = y + h - SLAB;
  R(c, x, y, w, h, ['#e8e4d0', '#e0dcc8', '#ece8d8'][vr(f, 3)]);
  if (!o.lod) return;
  R(c, x + 1, y + 5, w - 2, 3, '#e8c623'); for (let i = 0; i < w - 2; i += 6) R(c, x + 1 + i, y + 5, 3, 3, '#222');
  waiters(c, f, x, floorY, w, o);
  sign(c, x + 2, y + 20, 'TÁXI', '#222', '#e8c623');
}
function paintGerador(c, f, x, y, w, h, o) {
  const floorY = y + h - SLAB, tm = o.time || 0;
  R(c, x, y, w, h, '#a89f86');
  if (!o.lod) return;
  const sh = Math.sin(tm * 40) * .5;   // vibra enquanto roda
  R(c, x + 3 + sh, floorY - 16, w - 6, 16, '#6a5f3a'); R(c, x + 5 + sh, floorY - 14, w - 10, 3, '#8a7d4c');
  for (let i = 0; i < 3; i++) R(c, x + 6 + sh + i * ((w - 14) / 2.5), floorY - 9, 4, 6, '#c9a23a');
  R(c, x + w - 8, y + 12, 2, 7, '#444');
  for (let i = 0; i < 3; i++) { const p = (tm * .6 + i / 3) % 1; c.fillStyle = `rgba(110,110,110,${(.6 * (1 - p)).toFixed(2)})`; c.beginPath(); c.arc(x + w - 7 + Math.sin(p * 6 + i) * 1.5, y + 12 - p * 6, 1.4 + p * 2, 0, 7); c.fill(); }   // fumaça sobe do escapamento (dentro do quadro)
  R(c, x + 4, y + 10, 3, 3, Math.sin(tm * 6) > 0 ? '#ff4a3a' : '#6a2a22');
  sign(c, x + 3, y + 8, 'GERADOR', '#fff', '#6a5f3a');
}
function paintSolar(c, f, x, y, w, h, o) {
  R(c, x, y + h * .6, w, h * .4, '#6f7783');
  if (!o.lod) return;
  const n = Math.max(2, Math.floor(w / 9)), sun = o.sun || 0, tm = o.time || 0;
  for (let i = 0; i < n; i++) {
    const px = x + 2 + i * ((w - 4) / n), pw = (w - 4) / n;
    c.fillStyle = o.night ? '#1d2b45' : sun > .3 ? '#2f5fa8' : '#2a4f8a'; c.beginPath(); c.moveTo(px, y + h * .6); c.lineTo(px + 2, y + 6); c.lineTo(px + pw - 1, y + 6); c.lineTo(px + pw - 3, y + h * .6); c.fill();
    c.strokeStyle = '#9cc2f0'; c.lineWidth = .5; c.beginPath(); c.moveTo(px + 1, y + 14); c.lineTo(px + pw - 2, y + 14); c.stroke();
    if (sun > .1) { const g = ((tm * .5 + i * .15) % 1); if (g < .25) { c.fillStyle = `rgba(255,255,255,${(.7 * sun * (1 - g * 4)).toFixed(2)})`; c.fillRect(px + 2 + g * 4 * (pw - 4), y + 7, 2, h * .6 - 8); } }   // brilho varre os painéis
  }
  if (sun > .1) { c.fillStyle = `rgba(255,214,90,${(.6 * sun).toFixed(2)})`; c.beginPath(); c.arc(x + w - 5, y + 4, 2 + sun * 1.5, 0, 7); c.fill(); }
}
function paintCaixa(c, f, x, y, w, h, o) {
  R(c, x, y, w, h, '#d9dfe6');
  if (!o.lod) return;
  const tm = o.time || 0, lvl = Math.max(0, Math.min(1, o.lvl || 0)), floorY = y + h - SLAB;
  // torre d'água: tanque alto com pernas; a água sobe pelo cano da direita (enchendo) e desce pelo da esquerda (consumo), sempre na vertical
  const tw = 26, tx = x + w / 2 - tw / 2, ty = y + 6, th = h - 6 - SLAB - 16;
  R(c, tx - 1, ty + th, 3, 16, '#7a838c'); R(c, tx + tw - 2, ty + th, 3, 16, '#7a838c'); R(c, tx + tw / 2 - 1, ty + th, 2, 16, '#8b949d');
  const wall = c.createLinearGradient(tx, 0, tx + tw, 0); wall.addColorStop(0, '#aeb8c2'); wall.addColorStop(.5, '#e4e9ee'); wall.addColorStop(1, '#9aa5b0');
  c.fillStyle = wall; c.beginPath(); c.roundRect ? c.roundRect(tx, ty, tw, th, 4) : c.rect(tx, ty, tw, th); c.fill();
  const iy = ty + 3, ih = th - 6, wh = ih * lvl;
  R(c, tx + 3, iy, tw - 6, ih, '#46515e');
  if (wh > 0) {
    const wg = c.createLinearGradient(0, iy + ih - wh, 0, iy + ih); wg.addColorStop(0, '#7fcaf2'); wg.addColorStop(1, '#2f86c4'); c.fillStyle = wg; c.fillRect(tx + 3, iy + ih - wh, tw - 6, wh);
    c.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 3; i++) { const p = (tm * .5 + i / 3) % 1; c.fillRect(tx + 5 + i * 7, iy + ih - p * wh, 1.2, Math.min(5, p * wh)); }   // reflexos subindo
    c.fillStyle = '#b9e6fb'; c.fillRect(tx + 3, iy + ih - wh, tw - 6, 1.4);
  }
  for (let i = 1; i < 4; i++) R(c, tx + tw - 5, iy + ih * i / 4, 2, 1, 'rgba(255,255,255,.55)');   // escala do nível
  const px = x + w - 9, nx = x + 7;   // canos verticais
  R(c, px, ty + th * .25, 3, floorY - ty - th * .25, '#5d6b78'); R(c, nx, ty + th * .25, 3, floorY - ty - th * .25, '#5d6b78');
  R(c, tx + tw, ty + th * .25, px - tx - tw, 3, '#5d6b78'); R(c, nx + 3, ty + th * .25, tx - nx - 3, 3, '#5d6b78');
  const span = floorY - ty - th * .25 - 4;
  if (lvl < 1) for (let i = 0; i < 4; i++) { const p = (tm * .9 + i / 4) % 1; R(c, px + .5, floorY - 3 - p * span, 2, 3, '#7fcaf2'); }   // sobe pelo cano da direita
  if (lvl > 0) for (let i = 0; i < 3; i++) { const p = (tm * .7 + i / 3) % 1; R(c, nx + .5, ty + th * .25 + 3 + p * span, 2, 3, '#7fcaf2'); }   // desce pelo da esquerda
  sign(c, x + 3, floorY - 3, Math.round(lvl * 100) + '%', '#fff', '#3a6f98');
}
// tanque de água com nível visível (usado pelas caixas média, grande e torre)
function caixaTanque(c, tx, ty, tw, th, lvl, tm, aros) {
  const wall = c.createLinearGradient(tx, 0, tx + tw, 0); wall.addColorStop(0, '#aeb8c2'); wall.addColorStop(.5, '#e4e9ee'); wall.addColorStop(1, '#9aa5b0');
  c.fillStyle = wall; c.beginPath(); c.roundRect ? c.roundRect(tx, ty, tw, th, 4) : c.rect(tx, ty, tw, th); c.fill();
  const iy = ty + 3, ih = th - 6, wh = ih * lvl;
  R(c, tx + 3, iy, tw - 6, ih, '#46515e');
  if (wh > 0) {
    const wg = c.createLinearGradient(0, iy + ih - wh, 0, iy + ih); wg.addColorStop(0, '#7fcaf2'); wg.addColorStop(1, '#2f86c4'); c.fillStyle = wg; c.fillRect(tx + 3, iy + ih - wh, tw - 6, wh);
    c.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 3; i++) { const p = (tm * .5 + i / 3) % 1; c.fillRect(tx + 5 + i * Math.max(4, (tw - 10) / 3), iy + ih - p * wh, 1.2, Math.min(5, p * wh)); }
    c.fillStyle = '#b9e6fb'; c.fillRect(tx + 3, iy + ih - wh, tw - 6, 1.4);
  }
  for (let i = 1; i <= aros; i++) R(c, tx, ty + th * i / (aros + 1), tw, 1.5, 'rgba(60,70,82,.55)');   // aros de reforço
  for (let i = 1; i < 4; i++) R(c, tx + tw - 5, iy + ih * i / 4, 2, 1, 'rgba(255,255,255,.55)');   // escala do nível
}
function caixaCanos(c, px, nx, y0, floorY, lvl, tm) {   // sobe pelo cano da direita (enchendo), desce pelo da esquerda (consumo)
  R(c, px, y0, 3, floorY - y0, '#5d6b78'); R(c, nx, y0, 3, floorY - y0, '#5d6b78');
  const span = floorY - y0 - 4;
  if (lvl < 1) for (let i = 0; i < 4; i++) { const p = (tm * .9 + i / 4) % 1; R(c, px + .5, floorY - 3 - p * span, 2, 3, '#7fcaf2'); }
  if (lvl > 0) for (let i = 0; i < 3; i++) { const p = (tm * .7 + i / 3) % 1; R(c, nx + .5, y0 + 3 + p * span, 2, 3, '#7fcaf2'); }
}
function paintCaixaMedia(c, f, x, y, w, h, o) {   // média: dois tanques lado a lado, ligados por um tubo de equilíbrio
  R(c, x, y, w, h, '#d3dbe3');
  if (!o.lod) return;
  const tm = o.time || 0, lvl = Math.max(0, Math.min(1, o.lvl || 0)), floorY = y + h - SLAB, tw = 24, th = h - 6 - SLAB - 14, ty = y + 6;
  for (const tx of [x + w / 2 - tw - 3, x + w / 2 + 3]) {
    R(c, tx + 1, ty + th, 3, 14, '#7a838c'); R(c, tx + tw - 4, ty + th, 3, 14, '#7a838c'); R(c, tx + 3, ty + th + 7, tw - 6, 1, '#7a838c');   // pernas e travessa
    caixaTanque(c, tx, ty, tw, th, lvl, tm, 1);
  }
  R(c, x + w / 2 - 3, ty + th - 5, 6, 2, '#5d6b78');   // tubo de equilíbrio
  caixaCanos(c, x + w - 9, x + 6, ty + th * .3, floorY, lvl, tm);
  R(c, x + 9, ty + th * .3, 14, 2, '#5d6b78'); R(c, x + w - 31, ty + th * .3, 22, 2, '#5d6b78');
  sign(c, x + 3, floorY - 3, Math.round(lvl * 100) + '%', '#fff', '#3a6f98');
}
function paintCaixaGrande(c, f, x, y, w, h, o) {   // grande: reservatório cilíndrico largo, com escada marinheiro, aros e medidor de nível
  R(c, x, y, w, h, '#cfd7df');
  if (!o.lod) return;
  const tm = o.time || 0, lvl = Math.max(0, Math.min(1, o.lvl || 0)), floorY = y + h - SLAB, tw = 60, tx = x + w / 2 - tw / 2, ty = y + 8, th = h - 8 - SLAB - 22;
  for (const lx of [tx + 2, tx + tw / 2 - 2, tx + tw - 5]) R(c, lx, ty + th, 4, floorY - ty - th, '#6e7882');   // três pernas
  R(c, tx + 4, ty + th + 10, tw - 8, 2, '#6e7882'); R(c, tx + 4, ty + th + 10, tw - 8, 1, '#8b949d');   // travessa
  caixaTanque(c, tx, ty, tw, th, lvl, tm, 3);
  R(c, tx + 8, ty - 4, tw - 16, 4, '#8b949d'); R(c, tx + tw / 2 - 2, ty - 8, 4, 4, '#6e7882');   // cúpula e respiro
  R(c, tx + tw + 4, ty, 1.5, floorY - ty, '#6e7882'); R(c, tx + tw + 9, ty, 1.5, floorY - ty, '#6e7882'); for (let yy = ty + 3; yy < floorY - 2; yy += 5) R(c, tx + tw + 4, yy, 6.5, 1, '#6e7882');   // escada marinheiro
  c.fillStyle = '#e8eef2'; c.beginPath(); c.arc(tx - 6, ty + th * .5, 3.2, 0, 7); c.fill(); R(c, tx - 6, ty + th * .5 - 1.2, 1, 3.2 * lvl + .2, 'rgba(0,0,0,0)');
  c.strokeStyle = '#333'; c.lineWidth = 1; c.beginPath(); c.moveTo(tx - 6, ty + th * .5); c.lineTo(tx - 6 + Math.cos(-2.4 + lvl * 2.8) * 2.6, ty + th * .5 + Math.sin(-2.4 + lvl * 2.8) * 2.6); c.stroke();   // manômetro
  caixaCanos(c, x + w - 18, x + 10, ty + th * .55, floorY, lvl, tm);
  R(c, x + 13, ty + th * .55, tx - x - 22, 3, '#5d6b78'); R(c, tx + tw, ty + th * .55, x + w - 18 - tx - tw, 3, '#5d6b78');
  sign(c, x + 3, floorY - 3, Math.round(lvl * 100) + '%', '#fff', '#2f6f98');
}
function paintCaixaTorre(c, f, x, y, w, h, o) {   // torre pressurizada: tanque em coluna alta, casa de bombas embutida na base, setas de recalque e luz de aviso
  R(c, x, y, w, h, '#c7d1db');
  if (!o.lod) return;
  const tm = o.time || 0, lvl = Math.max(0, Math.min(1, o.lvl || 0)), floorY = y + h - SLAB, tw = 38, tx = x + w / 2 - tw / 2, ty = y + 9, th = h - 9 - SLAB - 30;
  R(c, tx + 5, ty + th, 5, 30, '#59636d'); R(c, tx + tw - 10, ty + th, 5, 30, '#59636d');   // colunas grossas
  caixaTanque(c, tx, ty, tw, th, lvl, tm, 4);
  c.fillStyle = '#9aa5b0'; c.beginPath(); c.moveTo(tx + 3, ty); c.lineTo(tx + tw / 2, ty - 7); c.lineTo(tx + tw - 3, ty); c.fill();   // tampa cônica
  R(c, tx + tw / 2 - .5, ty - 12, 1, 5, '#59636d'); c.fillStyle = Math.sin(tm * 4) > 0 ? '#ff5a4a' : '#7a2a24'; c.beginPath(); c.arc(tx + tw / 2, ty - 13, 2, 0, 7); c.fill();   // luz de aviso
  const hy = floorY - 22;   // casa de bombas
  R(c, x + 6, hy, w - 12, 22, '#6f7b85'); R(c, x + 6, hy, w - 12, 3, '#4a545d');
  const cx1 = x + 24, cx2 = x + w - 24;
  for (const px of [cx1, cx2]) {
    c.fillStyle = '#2a4a63'; c.beginPath(); c.arc(px, hy + 12, 7, 0, 7); c.fill();
    c.strokeStyle = '#cfe3f0'; c.lineWidth = 1; for (let i = 0; i < 3; i++) { const a = tm * 12 + i * Math.PI * 2 / 3 + px; c.beginPath(); c.moveTo(px, hy + 12); c.lineTo(px + Math.cos(a) * 6, hy + 12 + Math.sin(a) * 6); c.stroke(); }
  }
  R(c, x + w / 2 - 6, hy + 5, 12, 14, '#17202a'); for (let i = 0; i < 3; i++) R(c, x + w / 2 - 4 + i * 3.5, hy + 7, 2.5, 3, Math.sin(tm * 5 + i * 1.7) > -.2 ? '#6fe39b' : '#2f5d3a');   // painel
  const lift = (tm * 1.4) % 1;
  for (const px of [x + 10, x + w - 12]) { R(c, px - 1, ty + th * .3, 3, hy - ty - th * .3, '#5d6b78'); for (let i = 0; i < 3; i++) { const p = (lift + i / 3) % 1, yy = hy - p * (hy - ty - th * .3 - 6); c.fillStyle = '#ffd36b'; c.beginPath(); c.moveTo(px + .5, yy - 3); c.lineTo(px - 2.5, yy + 1); c.lineTo(px + 3.5, yy + 1); c.fill(); } }   // setas douradas de recalque
  sign(c, x + 3, y + 8, Math.round(lvl * 100) + '% ↑', '#fff', '#2f6c9a');
}
// bombas: cada tipo tem o seu desenho (tamanho, quantidade de conjuntos e canos acompanham vazão e alcance)
function bombaRotor(c, cx, cy, r, tm, v) {   // voluta com rotor girando
  c.fillStyle = '#2a4a63'; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill();
  c.strokeStyle = '#cfe3f0'; c.lineWidth = 1;
  for (let i = 0; i < 3; i++) { const a = tm * v + i * Math.PI * 2 / 3; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * (r - 1), cy + Math.sin(a) * (r - 1)); c.stroke(); }
  c.fillStyle = '#9fb7c8'; c.beginPath(); c.arc(cx, cy, 1.2, 0, 7); c.fill();
}
function bombaGotas(c, px, y0, y1, tm, n, v, col) {   // água subindo por um cano vertical
  for (let i = 0; i < n; i++) { const p = (tm * v + i / n) % 1; R(c, px + .5, y1 - p * (y1 - y0), 2, 2, col || '#8fd0f5'); }
}
function paintBomba(c, f, x, y, w, h, o) {   // simples: um conjunto motor + voluta, um cano
  const floorY = y + h - SLAB, tm = o.time || 0;
  R(c, x, y, w, h, '#a9b4bd');
  if (!o.lod) return;
  R(c, x + 6, floorY - 3, 30, 3, '#5d6a73');   // base
  R(c, x + 6, floorY - 13, 14, 10, '#6f8aa0'); R(c, x + 8, floorY - 11, 10, 1, '#9fb7c8'); R(c, x + 8, floorY - 8, 10, 1, '#9fb7c8');   // motor com aletas
  R(c, x + 20, floorY - 8, 4, 2, '#555d63');   // eixo
  bombaRotor(c, x + 28, floorY - 9, 6, tm, 8);
  R(c, x + 33, floorY - 9, 12, 3, '#59707f'); R(c, x + w - 14, y + 4, 3, floorY - y - 8, '#59707f'); R(c, x + 33, floorY - 9, 15, 3, '#59707f');   // cano de saída
  bombaGotas(c, x + w - 14, y + 5, floorY - 8, tm, 3, 1.4);
  sign(c, x + 3, y + 8, 'BOMBA', '#fff', '#3a6a88');
}
function paintBombaMedia(c, f, x, y, w, h, o) {   // reforçada: dois conjuntos em paralelo, coletor, manômetro e quadro de comando
  const floorY = y + h - SLAB, tm = o.time || 0;
  R(c, x, y, w, h, '#a2b0bc');
  if (!o.lod) return;
  R(c, x + 3, floorY - 3, w - 18, 3, '#4f5c66');
  for (let k = 0; k < 2; k++) {
    const bx = x + 4 + k * 22;
    R(c, bx, floorY - 12, 8, 9, '#4f7f9f'); R(c, bx + 1, floorY - 10, 6, 1, '#9fb7c8'); R(c, bx + 1, floorY - 7, 6, 1, '#9fb7c8');
    bombaRotor(c, bx + 14, floorY - 8, 5, tm, 10 + k);
    R(c, bx + 14, floorY - 17, 2, 9, '#59707f');   // recalque de cada bomba sobe até o coletor
  }
  R(c, x + 6, y + 6, 36, 3, '#6a8294'); R(c, x + 40, y + 6, 3, 8, '#6a8294');   // coletor
  R(c, x + 38, y + 3, 8, 3, '#59707f');
  bombaGotas(c, x + 18, y + 9, floorY - 12, tm, 2, 1.6); bombaGotas(c, x + 40, y + 9, floorY - 12, tm, 2, 1.6);
  c.fillStyle = '#e8eef2'; c.beginPath(); c.arc(x + 31, y + 15, 3, 0, 7); c.fill(); c.strokeStyle = '#333'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 31, y + 15); c.lineTo(x + 31 + Math.cos(-1 + Math.sin(tm * 3) * .15) * 2.5, y + 15 + Math.sin(-1 + Math.sin(tm * 3) * .15) * 2.5); c.stroke();   // manômetro
  R(c, x + w - 12, floorY - 20, 9, 20, '#7a8791'); R(c, x + w - 10, floorY - 18, 5, 4, '#17202a'); R(c, x + w - 9, floorY - 11, 2, 2, Math.sin(tm * 5) > 0 ? '#6fe39b' : '#2f5d3a');   // quadro de comando
  sign(c, x + 3, y + 8, 'REFORÇADA', '#fff', '#2f5f80');
}
function paintBombaForte(c, f, x, y, w, h, o) {   // industrial (128 px): três conjuntos grandes, coletor grosso, válvulas, painel e faixas de alerta
  const floorY = y + h - SLAB, tm = o.time || 0, tr = o.lod ? Math.sin(tm * 40) * .35 : 0;
  R(c, x, y, w, h, '#98a6b2');
  if (!o.lod) return;
  R(c, x + 2, floorY - 4, w - 30, 4, '#3f4a53');
  for (let i = 0; i < w - 30; i += 8) R(c, x + 2 + i, floorY - 4, 4, 4, '#e8c648');   // faixa de alerta
  for (let k = 0; k < 3; k++) {
    const bx = x + 5 + k * 31;
    R(c, bx, floorY - 17 + tr, 15, 13, '#2f5f80'); R(c, bx + 1, floorY - 17 + tr, 13, 2, '#4f87ad');
    for (let i = 0; i < 4; i++) R(c, bx + 2 + i * 3, floorY - 14 + tr, 1, 8, '#1d3d55');   // aletas
    R(c, bx + 15, floorY - 12, 3, 3, '#555d63');
    bombaRotor(c, bx + 24, floorY - 10, 6.5, tm, 14 + k);
    R(c, bx + 23, y + 17, 3, floorY - y - 27, '#59707f');   // tubo de recalque
    R(c, bx + 21, y + 22, 7, 3, '#c0392b');   // válvula
  }
  R(c, x + 6, y + 14, w - 38, 4, '#6a8294'); R(c, x + 6, y + 14, w - 38, 1, '#9fb7c8');   // coletor grosso
  R(c, x + w - 33, y + 5, 3, floorY - y - 8, '#6a8294'); R(c, x + w - 33, y + 3, 33, 4, '#6a8294'); R(c, x + w - 33, y + 14, 3, 4, '#6a8294');   // sobe e sai
  bombaGotas(c, x + w - 32, y + 8, floorY - 6, tm, 4, 1.8);
  R(c, x + w - 24, floorY - 24, 20, 24, '#6f7b85'); R(c, x + w - 22, floorY - 22, 16, 8, '#17202a');   // painel/inversor
  for (let i = 0; i < 4; i++) { const on = Math.sin(tm * 5 + i * 1.7) > -.2; R(c, x + w - 21 + i * 4, floorY - 20, 3, 4, on ? '#6fe39b' : '#2f5d3a'); }
  R(c, x + w - 22, floorY - 11, 16, 2, '#4a545d'); R(c, x + w - 22, floorY - 7, 16, 2, '#4a545d');
  sign(c, x + 3, y + 3, 'INDUSTRIAL', '#fff', '#2f5f80');
}
function paintBombaRecalque(c, f, x, y, w, h, o) {   // recalque: booster vertical, cano entra pelo piso e sai pelo teto levando a água para cima
  const floorY = y + h - SLAB, tm = o.time || 0;
  R(c, x, y, w, h, '#a6b6b6');
  if (!o.lod) return;
  const px = x + 14;
  R(c, px, y, 4, h, '#59707f'); R(c, px - 1, y, 6, 2, '#3f5563'); R(c, px - 1, floorY - 2, 6, 2, '#3f5563');   // coluna que atravessa laje e teto
  R(c, px - 5, floorY - 24, 14, 14, '#3f7f8f'); R(c, px - 4, floorY - 23, 12, 2, '#6fb0bf');   // câmara do booster
  bombaRotor(c, px + 2, floorY - 17, 5, tm, 12);
  R(c, px - 5, floorY - 10, 14, 3, '#2f5f6a');
  const lift = (tm * 1.6) % 1;
  for (let i = 0; i < 3; i++) { const p = (lift + i / 3) % 1; c.fillStyle = '#8fd0f5'; c.beginPath(); c.moveTo(px + 2, y + 3 + (1 - p) * (h - 8) - 3); c.lineTo(px - 1, y + 3 + (1 - p) * (h - 8)); c.lineTo(px + 5, y + 3 + (1 - p) * (h - 8)); c.fill(); }   // setas de subida
  R(c, x + 28, floorY - 14, 16, 14, '#d8dfe0'); R(c, x + 28, floorY - 14, 16, 2, '#9eb0b2'); R(c, x + 30, floorY - 18, 12, 4, '#9eb0b2');   // tanque de pressão
  R(c, px + 9, floorY - 8, 19, 2, '#59707f');
  c.fillStyle = '#e8eef2'; c.beginPath(); c.arc(x + 50, floorY - 12, 3, 0, 7); c.fill(); R(c, x + 50, floorY - 9, 1, 5, '#59707f');   // manômetro
  sign(c, x + 22, y + 8, 'RECALQUE', '#fff', '#2f6f7f');
}
function paintBateria(c, f, x, y, w, h, o) {
  const floorY = y + h - SLAB, tm = o.time || 0, lvl = Math.max(0, Math.min(1, o.lvl === undefined ? .5 : o.lvl));
  R(c, x, y, w, h, '#a9b8ad');
  if (!o.lod) return;
  for (let i = 0; i < 3; i++) {   // células: o verde acompanha a carga; o raio pisca quando carrega
    const bx = x + 4 + i * ((w - 8) / 3), bw = (w - 8) / 3 - 2;
    R(c, bx, floorY - 14, bw, 14, '#2f5d3a'); R(c, bx, floorY - 14 * lvl, bw, 14 * lvl, lvl < .2 ? '#d9a13a' : '#6fd08a'); R(c, bx + 3, floorY - 16, 3, 2, '#ccc');
  }
  if (Math.sin(tm * 4) > 0) { c.fillStyle = lvl > .98 ? '#6fe39b' : '#ffe27a'; c.beginPath(); c.moveTo(x + w / 2 + 1, y + 5); c.lineTo(x + w / 2 - 2, y + 10); c.lineTo(x + w / 2, y + 10); c.lineTo(x + w / 2 - 1, y + 15); c.lineTo(x + w / 2 + 3, y + 8); c.lineTo(x + w / 2 + 1, y + 8); c.fill(); }
  sign(c, x + 3, y + 8, Math.round(lvl * 100) + '%', '#fff', '#2f5d3a');
}
function paintBateriaPequena(c, f, x, y, w, h, o) {   // compacta: uma célula só, de pé, com o nível visível
  const floorY = y + h - SLAB, tm = o.time || 0, lvl = Math.max(0, Math.min(1, o.lvl === undefined ? .5 : o.lvl));
  R(c, x, y, w, h, '#adbcb1');
  if (!o.lod) return;
  const bx = x + 6, bw = w - 12, bh = 20, by = floorY - bh;
  R(c, bx + bw / 2 - 3, by - 3, 6, 3, '#ccc');
  R(c, bx, by, bw, bh, '#2f5d3a'); R(c, bx + 1, by + bh - (bh - 2) * lvl - 1, bw - 2, (bh - 2) * lvl, lvl < .2 ? '#d9a13a' : '#6fd08a');
  R(c, bx, by, bw, 2, 'rgba(255,255,255,.25)');
  if (Math.sin(tm * 4) > 0) { c.fillStyle = lvl > .98 ? '#6fe39b' : '#ffe27a'; c.beginPath(); c.moveTo(bx + bw / 2 + 1, by + 4); c.lineTo(bx + bw / 2 - 3, by + 11); c.lineTo(bx + bw / 2 - .5, by + 11); c.lineTo(bx + bw / 2 - 2, by + 17); c.lineTo(bx + bw / 2 + 3, by + 9); c.lineTo(bx + bw / 2, by + 9); c.fill(); }
  sign(c, x + 2, y + 9, Math.round(lvl * 100) + '%', '#fff', '#2f5d3a');
}
function paintBateriaGrande(c, f, x, y, w, h, o) {   // banco: contêiner com duas fileiras de módulos, inversor com ventoinha e LEDs de estado
  const floorY = y + h - SLAB, tm = o.time || 0, lvl = Math.max(0, Math.min(1, o.lvl === undefined ? .5 : o.lvl));
  R(c, x, y, w, h, '#9fb0a4');
  if (!o.lod) return;
  R(c, x + 3, y + 6, w - 33, floorY - y - 6, '#3d4a42'); R(c, x + 3, y + 6, w - 33, 2, '#5d6d63');
  const n = 4, mw = (w - 41) / n;
  for (let r = 0; r < 2; r++) for (let i = 0; i < n; i++) {   // módulos: cada um acende conforme a carga (a fileira de cima enche por último)
    const mx = x + 6 + i * (mw + 1), my = y + 10 + r * 11, fill = Math.max(0, Math.min(1, lvl * 2 - (1 - r)));
    R(c, mx, my, mw, 9, '#2f5d3a'); R(c, mx, my + 9 * (1 - fill), mw, 9 * fill, lvl < .2 ? '#d9a13a' : '#6fd08a'); R(c, mx + mw / 2 - 2, my - 1.5, 4, 1.5, '#ccc');
  }
  const ix = x + w - 28;   // inversor
  R(c, ix, y + 6, 25, floorY - y - 6, '#6f7b85'); R(c, ix, y + 6, 25, 2, '#4a545d');
  c.fillStyle = '#2a343c'; c.beginPath(); c.arc(ix + 12.5, y + 18, 7, 0, 7); c.fill();
  c.strokeStyle = '#cfe3f0'; c.lineWidth = 1; for (let i = 0; i < 4; i++) { const a = tm * 9 + i * Math.PI / 2; c.beginPath(); c.moveTo(ix + 12.5, y + 18); c.lineTo(ix + 12.5 + Math.cos(a) * 6, y + 18 + Math.sin(a) * 6); c.stroke(); }
  for (let i = 0; i < 3; i++) R(c, ix + 4 + i * 6, floorY - 7, 4, 3, i === 0 ? (lvl > .98 ? '#6fe39b' : '#ffe27a') : (Math.sin(tm * 5 + i * 2) > -.2 ? '#6fe39b' : '#2f5d3a'));
  if (Math.sin(tm * 4) > 0) { c.fillStyle = lvl > .98 ? '#6fe39b' : '#ffe27a'; c.beginPath(); c.moveTo(ix + 14, y + 10); c.lineTo(ix + 10, y + 14); c.lineTo(ix + 12, y + 14); c.lineTo(ix + 11, y + 17); c.lineTo(ix + 15, y + 12); c.lineTo(ix + 13, y + 12); c.fill(); }
  sign(c, x + 5, floorY - 2, Math.round(lvl * 100) + '%', '#fff', '#2f5d3a');
}
function paintGeradorGas(c, f, x, y, w, h, o) {
  const floorY = y + h - SLAB, tm = o.time || 0;
  R(c, x, y, w, h, '#b3a58f');
  if (!o.lod) return;
  R(c, x + 3, floorY - 16, w - 6, 16, '#6a5238');
  const fl = 1 + Math.sin(tm * 14) * .18 + Math.sin(tm * 23) * .1;   // chama tremulando
  c.fillStyle = '#d96a2e'; c.beginPath(); c.ellipse(x + w / 2, floorY - 8, 5 * fl, 6.5 * fl, 0, 0, 7); c.fill();
  c.fillStyle = '#ffd36b'; c.beginPath(); c.ellipse(x + w / 2, floorY - 7, 2.8 * fl, 4 * fl, 0, 0, 7); c.fill();
  c.strokeStyle = 'rgba(255,200,120,.35)'; c.lineWidth = 1; c.beginPath(); for (let i = 0; i < 3; i++) { const yy = y + 4 - i * 2; c.moveTo(x + 4, yy); for (let k = 0; k <= w - 8; k += 3) c.lineTo(x + 4 + k, yy + Math.sin(tm * 6 + k + i) * .8); } c.stroke();   // ar quente
  sign(c, x + 3, y + 8, 'GÁS', '#fff', '#6a5238');
}
function paintTratamento(c, f, x, y, w, h, o) {
  const floorY = y + h - SLAB, tm = o.time || 0;
  R(c, x, y, w, h, '#a9b8b8');
  if (!o.lod) return;
  for (const tx of [x + 4, x + w / 2 + 2]) {
    const tw = w / 2 - 6; R(c, tx, floorY - 14, tw, 14, '#4a7a7a'); R(c, tx + 2, floorY - 11, tw - 4, 4, '#7fc4d6');
    for (let i = 0; i < 4; i++) { const p = (tm * .8 + i * .27 + tx * .01) % 1; c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(tx + 3 + ((i * 7 + tx) % Math.max(1, tw - 6)), floorY - 4 - p * 9, 1, 0, 7); c.fill(); }   // bolhas sobem
  }
  sign(c, x + 3, y + 7, 'TRATAMENTO', '#fff', '#3a5f5f');
}
function paintLixo(c, f, x, y, w, h, o) {
  // galpão alto no subsolo: o lixo se acumula em monte (7 níveis) debaixo de uma calha; o caminhão entra pela doca da direita e esvazia
  const floorY = y + h - SLAB, cap = FAC.lixo.waste.cap, lvl = Math.min(1, (f.lixo || 0) / cap), tm = o.time || 0, steps = Math.ceil(lvl * 7) / 7;
  R(c, x, y, w, h, '#8a8f84');
  if (!o.lod) return;
  const g = c.createLinearGradient(0, y, 0, floorY); g.addColorStop(0, '#454a40'); g.addColorStop(1, '#2f332b'); c.fillStyle = g; c.fillRect(x + 2, y + 3, w - 4, floorY - y - 3);
  for (let i = 0; i < w - 4; i += 6) R(c, x + 3 + i, y + 5, 1, floorY - y - 6, 'rgba(255,255,255,.05)');   // chapa corrugada
  R(c, x + 2, y + 3, w - 4, 3, '#23261f'); for (let i = 0; i < 3; i++) { R(c, x + 18 + i * 34, y + 6, 1, 6, '#999'); R(c, x + 14 + i * 34, y + 12, 9, 3, o.lit || o.night ? '#ffe9a0' : '#d8d0a0'); }   // luminárias
  R(c, x + 6, y + 8, 12, 24, '#5d6358'); R(c, x + 8, y + 10, 8, 20, '#3d4238');   // calha por onde o lixo cai
  if (lvl < 1) for (let i = 0; i < 3; i++) { const p = (tm * .7 + i / 3) % 1, by = y + 26 + p * (floorY - y - 28 - (floorY - y - 14) * steps * .55); c.fillStyle = ['#c0392b', '#2e6fb5', '#e8a317'][i]; c.fillRect(x + 10 + i * 2, by, 3, 3); }
  const dockX = x + w - 30, mh = (floorY - y - 16) * steps, mw = (dockX - x - 20) * Math.min(1, .3 + steps * .7);
  if (steps > 0) {   // monte (cada nível acrescenta uma camada)
    c.fillStyle = '#5b6250'; c.beginPath(); c.moveTo(x + 12, floorY); c.quadraticCurveTo(x + 12 + mw * .5, floorY - mh * 1.5, x + 12 + mw, floorY); c.fill();
    const cols = ['#c0392b', '#2e6fb5', '#e8a317', '#d9d9d9', '#3a9d5d', '#7a4a9e', '#444a55'];
    for (let i = 0; i < Math.round(steps * 60); i++) { const t = (i * .6180339) % 1, bx = x + 12 + t * mw, top = mh * 1.5 * (1 - Math.pow(2 * t - 1, 2)) * .75, by = floorY - 2 - (((i * 7) % 11) / 11) * top; c.fillStyle = cols[(i + f.id) % 7]; c.beginPath(); c.ellipse(bx, by, 2.6, 1.9, 0, 0, 7); c.fill(); }
  }
  R(c, dockX, y + 10, 26, floorY - y - 10, '#1b1d18'); R(c, dockX - 2, y + 8, 30, 3, '#e8c648'); R(c, dockX - 2, y + 8, 30, 1, '#222'); for (let i = 0; i < 6; i++) R(c, dockX - 2 + i * 5, y + 8, 2.5, 3, '#222');   // porta da doca com listras
  R(c, dockX - 3, floorY - 1, 32, 1.5, '#e8c648');
  if (f.truckEta && o.truckP !== undefined) {   // caminhão: entra pela doca, para e sai (recortado na sala: não passa por cima da vizinha)
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    const e = o.truckP, tx = x + w + 24 - (x + w + 24 - (dockX + 2)) * Math.min(1, e * 2.2) + Math.max(0, e - .75) * 4 * 60;
    R(c, tx, floorY - 22, 26, 17, '#1f5ea8'); R(c, tx, floorY - 22, 26, 3, '#2a74c8'); R(c, tx - 11, floorY - 16, 11, 11, '#2a74c8'); R(c, tx - 9, floorY - 15, 6, 5, '#9fd0f0');
    R(c, tx + 3, floorY - 18, 18, 2, 'rgba(255,255,255,.35)'); c.fillStyle = '#111'; c.beginPath(); c.arc(tx + 5, floorY - 4, 3, 0, 7); c.arc(tx + 20, floorY - 4, 3, 0, 7); c.arc(tx - 6, floorY - 4, 3, 0, 7); c.fill();
    if (e > .35 && e < .8 && steps > 0) { c.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 3; i++) c.fillRect(dockX - 6 - i * 6 - ((tm * 20) % 6), floorY - 12 - i, 3, 1.4); }   // lixo sendo puxado para a caçamba
    c.restore();
  }
  const txt = lvl >= 1 ? 'CHEIO' : 'LIXO ' + Math.round(lvl * 100) + '%';
  if (lvl >= 1 && Math.sin(tm * 6) > 0) sign(c, x + 22, y + 22, txt, '#fff', '#c33'); else sign(c, x + 22, y + 22, txt, '#fff', lvl >= 1 ? '#7a2a2a' : '#59603f');
}
// ---- salas grandes e de serviço, redesenhadas: limpas, com detalhes que contam o que a sala faz
function paintPiscina(c, f, x, y, w, h, o) {
  const floorY = y + h - SLAB, tm = o.time || 0, glow = o.lit || !o.night;
  R(c, x, y, w, h, '#d8eef0');
  if (!o.lod) { R(c, x + 6, floorY - 20, w - 40, 18, '#4aa3d9'); return; }
  for (let i = 0; i < w; i += 8) R(c, x + i, y, 1, h - SLAB, 'rgba(255,255,255,.35)');   // azulejos
  const wx = x + w * .3, ww = w * .4; R(c, wx - 2, y + 6, ww + 4, 24, '#6a7f86'); R(c, wx, y + 8, ww, 20, o.night ? '#1f2b45' : '#bfe6f7'); R(c, wx + ww / 2 - .5, y + 8, 1, 20, '#6a7f86');   // janelão
  const px = x + 8, pw = w * .62, py = floorY - 20;   // piscina
  R(c, px - 3, py - 2, pw + 6, 22, '#b9c6c9'); const wg = c.createLinearGradient(0, py, 0, py + 18); wg.addColorStop(0, '#6fc3ee'); wg.addColorStop(1, '#2f86c4'); c.fillStyle = wg; c.fillRect(px, py, pw, 18);
  c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1; for (let k = 0; k < 3; k++) { c.beginPath(); for (let i = 0; i <= pw; i += 3) c.lineTo(px + i, py + 5 + k * 5 + Math.sin(tm * 2.2 + i * .3 + k) * 1); c.stroke(); }   // ondas
  for (let i = 0; i < 6; i++) { R(c, px + 4 + i * (pw - 8) / 5, py + 9, 2.4, 1.6, i % 2 ? '#e8527a' : '#f4f1ea'); }   // raias
  const sx = px + 8 + ((tm * 6) % (pw - 16)); c.fillStyle = '#f0cfae'; c.beginPath(); c.arc(sx, py + 8, 1.8, 0, 7); c.fill(); R(c, sx - 2, py + 9.5, 5, 1.6, '#e8527a');   // nadador
  R(c, px + pw + 8, floorY - 5, 18, 3, '#8a6a47'); R(c, px + pw + 8, floorY - 8, 7, 3, '#f4f1ea'); R(c, px + pw + 24, floorY - 22, 1.4, 20, '#7a5535'); c.fillStyle = '#e8527a'; c.beginPath(); c.arc(px + pw + 24.5, floorY - 22, 9, Math.PI, 0); c.fill();   // espreguiçadeira e guarda-sol
  const sx2 = x + w - 22; R(c, sx2, floorY - 26, 14, 24, '#8a6440'); R(c, sx2 + 2, floorY - 24, 10, 20, '#a37a50');   // sauna
  for (let i = 0; i < 3; i++) { const p = (tm * .5 + i / 3) % 1; c.fillStyle = `rgba(255,255,255,${(.5 * (1 - p)).toFixed(2)})`; c.beginPath(); c.arc(sx2 + 7 + Math.sin(p * 5 + i) * 2, floorY - 27 - p * 8, 2 + p * 2, 0, 7); c.fill(); }
  sign(c, x + 3, y + 9, 'PISCINA E SPA', '#fff', '#2a7ca8');
}
function paintAuditorio(c, f, x, y, w, h, o) {
  const floorY = y + h - SLAB, tm = o.time || 0, half = h / 2;
  R(c, x, y, w, h, '#2b2640');
  if (!o.lod) return;
  const g = c.createLinearGradient(0, y, 0, floorY); g.addColorStop(0, '#3a3358'); g.addColorStop(1, '#241f38'); c.fillStyle = g; c.fillRect(x, y, w, h - SLAB);
  R(c, x, y, w * .08, h - SLAB, '#7a1f2e'); R(c, x + w * .92, y, w * .08, h - SLAB, '#7a1f2e');   // cortinas
  const sx = x + w * .22, sw = w * .56, sy = y + 6, sh = 26; R(c, sx - 3, sy - 3, sw + 6, sh + 6, '#0e0f1c'); R(c, sx, sy, sw, sh, '#eef2fa');
  const slide = Math.floor(tm / 3) % 3; c.fillStyle = '#2a7ca8'; c.fillRect(sx + 6, sy + 5, sw * .45, 4);   // slide da palestra, troca a cada 3 s
  c.fillStyle = '#9aa6b8'; for (let i = 0; i < 3; i++) c.fillRect(sx + 6, sy + 12 + i * 4, sw * (slide === i ? .7 : .5), 1.8);
  if (slide === 2) { R(c, sx + sw * .6, sy + 10, sw * .3, 12, '#f2c230'); R(c, sx + sw * .6 + 2, sy + 14, 4, 8, '#e8527a'); R(c, sx + sw * .6 + 8, sy + 11, 4, 11, '#2a7ca8'); }
  R(c, x + w * .1, floorY - 13, w * .8, 3, '#6a4a2a'); R(c, x + w / 2 - 5, floorY - 21, 10, 8, '#8a6440');   // palco e púlpito
  c.fillStyle = '#e8b98f'; c.beginPath(); c.arc(x + w / 2 + 9, floorY - 18, 2, 0, 7); c.fill(); R(c, x + w / 2 + 7, floorY - 16, 4, 6, '#2e6fb5');   // palestrante
  const rows = 2, seatsN = Math.floor(w * .72 / 9);
  for (let r = 0; r < rows; r++) for (let i = 0; i < seatsN; i++) {
    const px = x + w * .14 + i * (w * .72 / seatsN) + (r % 2) * 3, py = floorY - 8 + r * 4;
    R(c, px, py, 6, 3, '#7e2230'); R(c, px, py, 6, 1, '#a23545');
    if (i + r * seatsN < o.lit) { c.fillStyle = '#0c0d16'; c.beginPath(); c.arc(px + 3, py - 1.4, 2, 0, 7); c.fill(); }
  }
  c.fillStyle = 'rgba(255,240,180,.08)'; c.beginPath(); c.moveTo(x + w * .3, y); c.lineTo(x + w * .36, y); c.lineTo(x + w * .5, floorY - 14); c.lineTo(x + w * .25, floorY - 14); c.fill();
  sign(c, x + 4, y + 9, 'CONVENÇÕES', '#fff', '#4a3a6f');
}
function paintParty(c, f, x, y, w, h, o) {
  const floorY = y + h - SLAB, tm = o.time || 0, n = o.lit || 0;
  R(c, x, y, w, h, '#2a1f45');
  if (!o.lod) return;
  const g = c.createLinearGradient(0, y, 0, floorY); g.addColorStop(0, '#3a2a63'); g.addColorStop(1, '#5a2a73'); c.fillStyle = g; c.fillRect(x, y, w, h - SLAB);
  const dx = x + w * .28, dw = w * .44;   // pista de dança com piso colorido que pisca
  for (let i = 0; i < 10; i++) { const hue = (i * 36 + tm * 90) % 360; c.fillStyle = `hsl(${hue},70%,${45 + 10 * Math.sin(tm * 6 + i)}%)`; c.fillRect(dx + i * dw / 10, floorY - 4, dw / 10 - 1, 4); }
  const bx = x + w / 2, by = y + 12;   // globo de luz com feixes girando
  R(c, bx - .5, y, 1, 8, '#ccc'); c.fillStyle = '#d9dfe8'; c.beginPath(); c.arc(bx, by, 5, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 5; i++) c.fillRect(bx - 4 + ((i * 3 + Math.floor(tm * 5)) % 8), by - 3 + (i * 2) % 6, 1.5, 1.5);
  for (let i = 0; i < 5; i++) { const a = tm * 1.1 + i * 1.26, hue = (i * 70 + tm * 40) % 360; c.fillStyle = `hsla(${hue},80%,65%,.16)`; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + Math.cos(a) * 60, floorY); c.lineTo(bx + Math.cos(a + .25) * 60, floorY); c.fill(); }
  R(c, x + 6, floorY - 14, 36, 14, '#1b1830'); R(c, x + 8, floorY - 12, 12, 8, '#4a4570'); R(c, x + 6, floorY - 22, 7, 8, '#111'); R(c, x + 36, floorY - 22, 7, 8, '#111');   // cabine do DJ e caixas de som que pulsam
  const pul = 2 + Math.sin(tm * 9) * 1; c.fillStyle = '#6fe3ff'; c.beginPath(); c.arc(x + 9.5, floorY - 18, pul, 0, 7); c.arc(x + 39.5, floorY - 18, pul, 0, 7); c.fill();
  for (let i = 0; i < 4; i++) { c.fillStyle = ['#e8527a', '#f2c230', '#6fe3ff', '#8f6ae0'][i]; c.beginPath(); c.arc(x + w - 14 + (i % 2) * 6, y + 14 + Math.floor(i / 2) * 7 + Math.sin(tm * 2 + i) * 1, 3.2, 0, 7); c.fill(); R(c, x + w - 14 + (i % 2) * 6, y + 17 + Math.floor(i / 2) * 7, .6, 6, '#bbb'); }   // balões
  R(c, x + w - 46, floorY - 12, 30, 12, '#7a3d2a'); R(c, x + w - 46, floorY - 13, 30, 2, '#d8b48a');   // bar
  for (let i = 0; i < Math.min(14, n); i++) { const px = dx + 4 + ((i * 17) % Math.floor(dw - 8)), bob = Math.sin(tm * 7 + i * 1.7) * 1.4; c.fillStyle = ['#111', '#222', '#1a1a2e'][i % 3]; c.beginPath(); c.arc(px, floorY - 12 + bob, 1.9, 0, 7); c.fill(); c.fillRect(px - 1.5, floorY - 10 + bob, 3, 6); }   // gente dançando
  sign(c, x + 4, y + 9, 'SALÃO DE FESTAS', '#fff', '#8f2a8a');
}
function paintClinica(c, f, x, y, w, h, o) {
  const floorY = y + h - SLAB, glow = o.lit || !o.night;
  R(c, x, y, w, h, '#e6f2f2');
  if (!o.lod) return;
  R(c, x, floorY - 12, w, 12, '#cfe3e3'); R(c, x, y, w, 3, '#9fc7c9');
  R(c, x + 6, floorY - 17, 38, 17, '#7a5a3a'); R(c, x + 6, floorY - 18, 38, 2, '#a07a52'); R(c, x + 14, floorY - 29, 22, 10, '#2a3a50'); R(c, x + 15, floorY - 28, 20, 8, glow ? '#bfe3f5' : '#6a8099');   // recepção
  R(c, x + 48, floorY - 24, 6, 24, '#3f8a4a'); c.fillStyle = '#4fa35a'; c.beginPath(); c.arc(x + 51, floorY - 26, 7, 0, 7); c.fill();
  R(c, x + 62, y + 5, 14, 14, '#fff'); R(c, x + 67, y + 7, 4, 10, '#d2323d'); R(c, x + 64, y + 10, 10, 4, '#d2323d');   // cruz
  const bx0 = x + 90, bw = 28;
  for (let i = 0; i < 3; i++) {
    const bx = bx0 + i * (bw + 6); if (bx + bw > x + w - 6) break;
    R(c, bx, y + 4, bw, 2, '#9aa6b0'); R(c, bx + 1, y + 6, 2, 14, 'rgba(120,170,200,.55)'); R(c, bx + bw - 3, y + 6, 2, 14, 'rgba(120,170,200,.55)');   // cortina
    R(c, bx + 3, floorY - 11, bw - 8, 5, '#f4f6f8'); R(c, bx + 3, floorY - 14, 8, 3, '#fff'); R(c, bx + 2, floorY - 6, 2, 6, '#8a929c'); R(c, bx + bw - 7, floorY - 6, 2, 6, '#8a929c');   // maca
    R(c, bx + bw - 6, floorY - 22, 5, 9, '#10202e'); const beat = Math.sin((o.time || 0) * 5 + i) > .4; R(c, bx + bw - 5, floorY - 21, 3, 2, beat ? '#6fe39b' : '#2a5a40'); c.strokeStyle = '#6fe39b'; c.lineWidth = .8; c.beginPath(); c.moveTo(bx + bw - 5, floorY - 17); c.lineTo(bx + bw - 3.5, floorY - 17 - (beat ? 2 : 0)); c.lineTo(bx + bw - 2, floorY - 17); c.stroke();   // monitor
  }
  R(c, x + w - 24, floorY - 22, 16, 22, '#cfd8dc'); R(c, x + w - 22, floorY - 20, 12, 8, '#f6f8f9'); R(c, x + w - 22, floorY - 10, 12, 8, '#f6f8f9');   // armário de remédios
  sign(c, x + 3, y + 9, 'CLÍNICA', '#fff', '#2a8f8f');
}
function paintSeguranca(c, f, x, y, w, h, o) {
  const floorY = y + h - SLAB, tm = o.time || 0;
  R(c, x, y, w, h, '#2a3342');
  if (!o.lod) return;
  R(c, x, y, w, 3, '#1b2230'); R(c, x, floorY - 5, w, 5, '#3a4455');
  const n = Math.max(3, Math.floor((w - 100) / 17));
  for (let i = 0; i < n; i++) {   // parede de monitores com imagens de câmera que variam
    const mx = x + 50 + i * 17, hue = [200, 130, 30, 260][i % 4]; R(c, mx, y + 6, 15, 11, '#0b0f17'); R(c, mx + 1, y + 7, 13, 9, `hsl(${hue},35%,${22 + 6 * Math.sin(tm * .7 + i)}%)`);
    c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(mx + 1, y + 7 + ((tm * 6 + i * 3) % 9), 13, 1);
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(mx + 3 + ((tm * 3 + i * 5) % 8), y + 11, 2, 4);   // vulto na câmera
  }
  R(c, x + 4, floorY - 14, 44, 3, '#5a4a38'); R(c, x + 6, floorY - 11, 40, 6, '#7a6448'); R(c, x + 12, floorY - 21, 12, 7, '#10202e'); R(c, x + 13, floorY - 20, 10, 5, '#2a8f6a');   // mesa com terminal
  R(c, x + 30, floorY - 18, 8, 5, '#222'); c.fillStyle = '#ffe27a'; c.beginPath(); c.arc(x + 38, floorY - 16, 1.2, 0, 7); c.fill();
  R(c, x + w - 30, y + 20, 22, 14, '#c9d2dc'); R(c, x + w - 28, y + 22, 18, 10, '#3a8a5a'); c.fillStyle = '#e8c648'; c.fillRect(x + w - 24, y + 25, 3, 3); c.fillRect(x + w - 17, y + 28, 3, 3);   // mapa do prédio
  c.fillStyle = '#e8c648'; c.beginPath(); c.moveTo(x + w - 52, y + 8); c.lineTo(x + w - 42, y + 8); c.lineTo(x + w - 42, y + 15); c.lineTo(x + w - 47, y + 19); c.lineTo(x + w - 52, y + 15); c.fill();
  sign(c, x + 3, y + 9, 'SEGURANÇA', '#fff', '#1a2c50');
}
function paintReciclagem(c, f, x, y, w, h, o) {
  const floorY = y + h - SLAB, tm = o.time || 0;
  R(c, x, y, w, h, '#b9c4b8');
  if (!o.lod) return;
  R(c, x, y, w, h - SLAB, '#9fb09e'); R(c, x, y, w, 3, '#6f8570');
  const by = floorY - 22;   // esteira com materiais passando
  R(c, x + 6, by, w * .55, 4, '#3a3f44'); for (let i = 0; i < w * .55; i += 6) R(c, x + 6 + ((i + tm * 14) % (w * .55 - 2)), by, 3, 1.2, '#7a8088');
  const cols = ['#c0392b', '#2e6fb5', '#e8a317', '#3a9d5d'];
  for (let i = 0; i < 6; i++) { const px = x + 8 + ((i * 24 + tm * 14) % (w * .55 - 8)); c.fillStyle = cols[i % 4]; c.fillRect(px, by - 4, 4, 4); }
  const mx = x + w * .62, mw = w * .22; R(c, mx, floorY - 38, mw, 36, '#58666a'); R(c, mx + 2, floorY - 36, mw - 4, 10, '#3a4548'); R(c, mx + 4, floorY - 24, mw - 8, 12, '#2a3336');   // máquina de triagem
  c.fillStyle = '#c9d2dc'; for (let i = 0; i < 2; i++) { const a = tm * (i ? -3 : 3); c.beginPath(); c.arc(mx + 10 + i * 11, floorY - 30, 4, 0, 7); c.fill(); c.strokeStyle = '#58666a'; c.lineWidth = 1; for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(mx + 10 + i * 11, floorY - 30); c.lineTo(mx + 10 + i * 11 + Math.cos(a + k * 1.57) * 4, floorY - 30 + Math.sin(a + k * 1.57) * 4); c.stroke(); } }   // engrenagens girando
  const bin = ['#2e6fb5', '#e8c623', '#3a9d5d', '#c0392b'];   // lixeiras de coleta seletiva
  for (let i = 0; i < 4; i++) { const bx = x + 8 + i * 14; R(c, bx, floorY - 12, 11, 12, bin[i]); R(c, bx - 1, floorY - 13, 13, 2, 'rgba(0,0,0,.25)'); c.fillStyle = '#fff'; c.font = 'bold 5px system-ui'; c.textAlign = 'center'; c.fillText('♻', bx + 5.5, floorY - 4); }
  R(c, x + w - 18, y + 4, 8, 16, '#6a7570'); for (let i = 0; i < 3; i++) { const p = (tm * .5 + i / 3) % 1; c.fillStyle = `rgba(190,200,190,${(.6 * (1 - p)).toFixed(2)})`; c.beginPath(); c.arc(x + w - 14 + Math.sin(p * 4 + i) * 2, y + 4 - p * 3, 2 + p * 1.6, 0, 7); c.fill(); }   // chaminé
  sign(c, x + 3, y + 14, 'RECICLAGEM', '#fff', '#3a6a45');
}
function paintCapela(c, f, x, y, w, h, o) {
  // capela celeste: duas torres com agulhas, nave com rosácea, vitrais em arco, portal com escadaria e tapete; sino balançando, pombas, luz dos vitrais à noite e convidados na escadaria
  const tm = o.time || 0, night = o.night, floorY = y + h - SLAB, cx = x + w / 2, tw = Math.min(46, w * .2), n = o.lit || 0;
  const stone = '#e9dfb8', stone2 = '#d6c99a', roof = '#7a8aa8';
  const tower = (tx, dir) => {
    R(c, tx, y + h * .26, tw, h * .74 - SLAB, stone); R(c, tx, y + h * .26, 3, h * .74 - SLAB, 'rgba(255,255,255,.25)'); R(c, tx + tw - 3, y + h * .26, 3, h * .74 - SLAB, 'rgba(0,0,0,.12)');
    c.fillStyle = roof; c.beginPath(); c.moveTo(tx - 3, y + h * .26); c.lineTo(tx + tw / 2, y + 6); c.lineTo(tx + tw + 3, y + h * .26); c.fill();
    R(c, tx + tw / 2 - .8, y - 8, 1.6, 16, '#c9a23a'); R(c, tx + tw / 2 - 4, y - 4, 8, 1.6, '#c9a23a');   // cruz na agulha
    const wx = tx + tw / 2 - 5, wy = y + h * .36; c.fillStyle = '#6a5a3a'; c.beginPath(); c.rect(wx - 1, wy, 12, 20); c.arc(wx + 5, wy, 6, Math.PI, 0); c.fill(); c.fillStyle = '#243049'; c.beginPath(); c.rect(wx, wy, 10, 19); c.arc(wx + 5, wy, 5, Math.PI, 0); c.fill();   // abertura do sino
    const sw = Math.sin(tm * 2 + dir) * 3; c.fillStyle = '#c9a23a'; c.beginPath(); c.moveTo(wx + 5 + sw, wy - 2); c.lineTo(wx + 1 + sw * .6, wy + 11); c.lineTo(wx + 9 + sw * .6, wy + 11); c.fill();
    for (let k = 0; k < 3; k++) R(c, tx + 2, y + h * .26 + 40 + k * 22, tw - 4, 1.2, 'rgba(0,0,0,.12)');
  };
  tower(x + 6, 0); tower(x + w - 6 - tw, 1);
  const nx = x + 6 + tw, nw = w - 12 - tw * 2;
  R(c, nx, y + h * .42, nw, h * .58 - SLAB, stone2); R(c, nx, y + h * .42, nw, 3, '#c9b980');
  c.fillStyle = stone; c.beginPath(); c.moveTo(nx - 4, y + h * .42); c.lineTo(cx, y + h * .2); c.lineTo(nx + nw + 4, y + h * .42); c.fill(); c.strokeStyle = '#c9b980'; c.lineWidth = 1.4; c.stroke();   // frontão
  c.fillStyle = night ? '#355a78' : '#6fa0c0'; c.beginPath(); c.arc(cx, y + h * .33, 13, 0, 7); c.fill(); c.strokeStyle = '#c9b980'; c.lineWidth = 2; c.stroke();   // rosácea
  const rc = ['#c0392b', '#e8a317', '#3a9d5d', '#8f6ae0', '#2e6fb5']; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + tm * .05; c.fillStyle = rc[k % 5]; c.beginPath(); c.moveTo(cx, y + h * .33); c.arc(cx, y + h * .33, 11, a, a + .7); c.fill(); }
  R(c, cx - .8, y + h * .2 - 10, 1.6, 12, '#c9a23a'); R(c, cx - 4, y + h * .2 - 6, 8, 1.6, '#c9a23a');
  if (!o.lod) return;
  const cols = ['#c0392b', '#2e6fb5', '#e8a317', '#3a9d5d', '#8f6ae0'], k = Math.max(3, Math.floor(nw / 30));
  for (let i = 0; i < k; i++) {   // vitrais em arco, acesos à noite
    const ww = 14, wx = nx + 10 + i * (nw - 20 - ww) / (k - 1), wy = y + h * .56, wh = h * .14;
    c.fillStyle = '#8a7a4a'; c.beginPath(); c.rect(wx - 1.5, wy, ww + 3, wh); c.arc(wx + ww / 2, wy, ww / 2 + 1.5, Math.PI, 0); c.fill();
    const g = c.createLinearGradient(0, wy - ww / 2, 0, wy + wh); g.addColorStop(0, cols[i % 5]); g.addColorStop(1, cols[(i + 2) % 5]); c.fillStyle = g; c.beginPath(); c.rect(wx, wy, ww, wh - 1); c.arc(wx + ww / 2, wy, ww / 2, Math.PI, 0); c.fill();
    if (night) { c.fillStyle = `rgba(255,230,160,${(.22 + .1 * Math.sin(tm * 2 + i)).toFixed(2)})`; c.beginPath(); c.rect(wx, wy, ww, wh - 1); c.arc(wx + ww / 2, wy, ww / 2, Math.PI, 0); c.fill(); }
    c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(wx + ww / 2 - .5, wy - ww / 2, 1, wh + ww / 2);
  }
  const dw = 26, dh = 38; c.fillStyle = '#6a4a2a'; c.beginPath(); c.rect(cx - dw / 2, floorY - dh, dw, dh); c.arc(cx, floorY - dh, dw / 2, Math.PI, 0); c.fill(); R(c, cx - dw / 2 + 2, floorY - dh + 2, dw / 2 - 2, dh - 2, '#8a6440'); R(c, cx + .5, floorY - dh + 2, dw / 2 - 2, dh - 2, '#8a6440'); R(c, cx - .5, floorY - dh, 1, dh, '#3a2a1a');   // portal em arco
  if (night) { c.fillStyle = 'rgba(255,226,150,.3)'; c.beginPath(); c.arc(cx, floorY - dh / 2, 26, 0, 7); c.fill(); }
  for (let i = 0; i < 4; i++) R(c, cx - 15 - i * 2.4, floorY - 3 + i * .5, 30 + i * 4.8, 1.6, i % 2 ? '#d6c99a' : '#e9dfb8');   // degraus
  R(c, cx - 4, floorY - 3, 8, 3, '#a3202a');   // tapete vermelho
  for (let i = 0; i < Math.min(20, n); i++) { const gx = cx - 36 + ((i * 11) % 72), gy = floorY - 1 + (i % 3) * -.4; c.fillStyle = ['#222', '#2a2f44', '#7a2f3a', '#e8e4d8', '#3a4a6a'][i % 5]; c.beginPath(); c.arc(gx, gy - 7, 1.8, 0, 7); c.fill(); c.fillRect(gx - 1.4, gy - 5.4, 2.8, 5.4); }   // convidados na escadaria
  for (let i = 0; i < 3; i++) { const p = (tm * .15 + i / 3) % 1, dx = x + 20 + p * (w - 40), dy = y + h * .12 + Math.sin(p * 9 + i) * 5 + i * 6; c.fillStyle = '#fff'; c.beginPath(); c.ellipse(dx, dy, 2.4, 1.1, Math.sin(tm * 14 + i) * .5, 0, 7); c.fill(); }   // pombas
}
function paintMetro(c, f, x, y, w, h, o) {
  const floorY = y + h - SLAB, tm = o.time || 0, ln = LINES[f.line || 0] || LINES[0], LC = ln.col, LD = ln.dark, INK = ln.ink;
  // solo (acima e abaixo) com pedrinhas fixas
  R(c, x, y, w, h, '#3a2a20');
  for (let i = 0; i < w / 5; i++) { const px = x + hash(f.id * 97 + i) * w, py = y + hash(f.id * 31 + i * 7) * 9; R(c, px, py, 1.6, 1.4, i % 3 ? '#4b372a' : '#2b1f18'); }
  if (!o.lod) { R(c, x, y + 10, w, h - 10 - SLAB, '#aeb4ba'); return; }
  const cy = y + 10, wy = y + 24, platY = floorY - 13;
  R(c, x, cy, w, 14, '#2a2f38'); R(c, x, cy + 12, w, 2, '#1a1e25'); R(c, x, cy + 5, w, 1, '#7a2a2a');   // laje do teto, tubulação vermelha
  for (let i = 0; i < w; i += 16) R(c, x + i, cy, 1, 12, 'rgba(255,255,255,.07)');
  R(c, x, wy, w, platY - wy, '#c4c8cc');   // parede de azulejos
  for (let i = 0; i < w; i += 16) R(c, x + i, wy, 1, platY - wy, 'rgba(0,0,0,.07)'); for (let j = wy + 14; j < platY; j += 14) R(c, x, j, w, 1, 'rgba(0,0,0,.05)');
  R(c, x, wy, w, 6, '#9aa0a7');
  R(c, x, y + h * .45, w, 4, LC);   // faixa azul
  for (const lx of w > 300 ? [.06, .16, .27, .38, .5, .62, .73, .84, .94] : [.1, .3, .5, .72, .9]) { R(c, x + w * lx - 11, wy + 2, 22, 2.5, '#f3f6fa'); R(c, x + w * lx - 13, wy + 4, 26, 5, 'rgba(255,255,255,.08)'); }   // lâmpadas fluorescentes
  for (const cxp of w > 300 ? [w * .2, w * .38, w * .62, w * .8] : [w * .35, w * .65]) { R(c, x + cxp - 3, wy - 2, 6, platY - wy + 2, '#a4a9b0'); R(c, x + cxp - 3, wy - 2, 1.5, platY - wy + 2, '#d0d4d9'); R(c, x + cxp - 3, y + h * .45, 6, 4, LC); }   // colunas
  // placas
  const sx = x + w / 2 - 28; R(c, sx, wy + 6, 56, 15, LD); R(c, sx, wy + 6, 56, 1, mixHex(LD, '#ffffff', .3));
  c.fillStyle = INK; c.beginPath(); c.arc(sx + 10, wy + 13.5, 5, 0, 7); c.fill(); c.fillStyle = LD; c.font = 'bold 7px system-ui'; c.textAlign = 'center'; c.fillText('M', sx + 10, wy + 16.2);
  c.fillStyle = INK; c.font = 'bold 8px system-ui'; c.textAlign = 'left'; c.fillText('Metrô', sx + 19, wy + 16.5);
  const arrow = (ax, dir) => { R(c, ax, wy + 8, 56, 11, LD); c.fillStyle = INK; c.font = 'bold 6px system-ui'; c.textAlign = 'left'; const t = dir < 0 ? '← Linha ' + ln.name : 'Linha ' + ln.name + ' →'; c.fillText(t, ax + 4, wy + 15.5); };
  arrow(w > 300 ? x + w * .26 : x + 36, -1); arrow(w > 300 ? x + w * .74 - 56 : x + w - 86, 1);
  // pôster, bancos, lixeiras, mapa
  R(c, x + 14, wy + 22, 17, 25, LD); R(c, x + 15, wy + 23, 15, 23, '#2a6fd0'); c.fillStyle = '#fff'; c.font = 'bold 3.5px system-ui'; c.textAlign = 'center'; ['Uma', 'cidade', 'melhor'].forEach((t, i) => c.fillText(t, x + 22.5, wy + 28 + i * 4.5)); R(c, x + 15, wy + 37, 15, 9, '#1b3a6a'); for (let i = 0; i < 4; i++) R(c, x + 17 + i * 3.4, wy + 40 - (i % 3) * 2, 2.4, 6 + (i % 3) * 2, '#3b5f9a');
  const bench = bx => { for (let i = 0; i < 3; i++) { R(c, bx + i * 6, platY - 9, 5, 4, LC); R(c, bx + i * 6, platY - 12, 5, 3, LC); } R(c, bx, platY - 5, 18, 1.4, '#444'); R(c, bx + 1, platY - 5, 1.4, 5, '#444'); R(c, bx + 15.6, platY - 5, 1.4, 5, '#444'); };
  bench(x + w * .17); bench(x + w * .78); if (w > 300) { bench(x + w * .3); bench(x + w * .66); }
  const bin = bx => { R(c, bx, platY - 10, 7, 10, '#2a2f38'); R(c, bx - .5, platY - 11, 8, 2, '#3a404a'); }; bin(x + 38); bin(x + w - 42);
  R(c, x + w - 30, wy + 22, 20, 14, '#e8eaee'); R(c, x + w - 29, wy + 23, 18, 12, '#f6f7f9'); c.strokeStyle = '#d9a23a'; c.lineWidth = .8; c.beginPath(); c.moveTo(x + w - 27, wy + 32); c.lineTo(x + w - 22, wy + 26); c.lineTo(x + w - 17, wy + 31); c.stroke(); c.strokeStyle = '#d2323d'; c.beginPath(); c.moveTo(x + w - 27, wy + 27); c.lineTo(x + w - 14, wy + 33); c.stroke();   // mapa das linhas
  const tr = o.train, ph = tr && tr.phase;   // painel de próximo trem
  R(c, x + w - 62, wy + 24, 30, 10, '#0a0d12'); c.fillStyle = ph === 'open' ? '#6fe39b' : ph && ph !== 'none' ? '#ffd24a' : '#ff9a3a'; c.font = 'bold 5px monospace'; c.textAlign = 'left';
  c.fillText(ph === 'open' ? 'EMBARQUE' : ph && ph !== 'none' ? 'SAINDO' : 'PRÓX. ' + Math.ceil((tr ? tr.next : 0) / 4) + 's', x + w - 60, wy + 31);
  // plataforma, faixa amarela e trilhos
  R(c, x, platY, w, floorY - platY, '#20242b'); R(c, x, platY, w, 3, '#d9a23a'); R(c, x, platY + 3, w, 1, '#8a6a1a');
  R(c, x, floorY - 5, w, 1.4, '#9aa3b2'); R(c, x, floorY - 9, w, 1.4, '#9aa3b2'); for (let i = 0; i < w; i += 8) R(c, x + i, floorY - 3, 3, 3, '#4a3a2a');
  R(c, x, floorY - 14 - 0, 0, 0, '#000');
  // pontas: listras de segurança e boca do túnel
  for (const ex of [x + 3, x + w - 7]) { for (let k = 0; k < 8; k++) R(c, ex, wy + 4 + k * 8, 4, 4, k % 2 ? '#e8c648' : '#222'); }
  R(c, x, wy + 6, 3, platY - wy - 6, '#0a0c10'); R(c, x + w - 3, wy + 6, 3, platY - wy - 6, '#0a0c10');
  // trem branco com faixa azul
  if (tr && ph !== 'none') {
    const tl = Math.min(w - 40, 340), mid = x + (w - tl) / 2, ease = t => 1 - (1 - t) * (1 - t), dir = o.tdir === undefined ? 1 : o.tdir;
    let tx = mid;
    if (o.tclip) { c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); }
    if (ph === 'arrive') tx = dir > 0 ? x - tl + (mid - (x - tl)) * ease(tr.p) : x + w + (mid - (x + w)) * ease(tr.p);
    else if (ph === 'leave') tx = dir > 0 ? mid + (x + w + 6 - mid) * tr.p * tr.p : mid + (x - tl - 6 - mid) * tr.p * tr.p;
    const ty = platY - 34, th = 34, cars = Math.max(2, Math.floor(tl / 56)), cw = tl / cars;
    for (let i = 0; i < cars; i++) {
      const cx = tx + i * cw; R(c, cx + 1, ty, cw - 2, th, '#e6eaef'); R(c, cx + 1, ty, cw - 2, 3, '#cfd5dc'); R(c, cx + 1, ty + th - 5, cw - 2, 5, '#5a6270');
      R(c, cx + 1, ty + 5, cw - 2, 2, LC); R(c, cx + 1, ty + th - 11, cw - 2, 2, LC);   // faixas azuis
      for (const wx of [.12, .62]) { R(c, cx + cw * wx, ty + 9, cw * .22, 9, '#1f2a3a'); R(c, cx + cw * wx + 1, ty + 10, cw * .22 - 2, 3, 'rgba(160,200,230,.35)'); }   // janelas
      const dx = cx + cw * .4; R(c, dx, ty + 6, cw * .2, th - 11, '#9aa3ae'); const gap = ph === 'open' ? cw * .05 : 0;
      R(c, dx + cw * .1 - gap, ty + 7, cw * .1 - 0.5 + gap, th - 13, '#c7ced6'); R(c, dx + 1, ty + 7, cw * .1 - 1 - gap + 0, th - 13, '#c7ced6');
      if (ph === 'open') R(c, dx + cw * .1 - gap, ty + 7, 2 * gap, th - 13, '#ffe9a0'); else R(c, dx + cw * .1 - .5, ty + 7, 1, th - 13, '#6b727c');
      R(c, dx + 2, ty + 10, 3, 5, '#1f2a3a'); R(c, dx + cw * .2 - 5, ty + 10, 3, 5, '#1f2a3a');
      if (i) R(c, cx - 1, ty + 4, 2, th - 8, '#111');   // engate entre os carros
      c.fillStyle = '#222'; for (const wx of [.18, .75]) c.fillRect(cx + cw * wx, ty + th, 6, 3);
    }
    const front = dir > 0 ? tx + tl : tx; R(c, dir > 0 ? front - 3 : front, ty + 8, 3, 6, '#ffeaa0'); R(c, dir > 0 ? front - 3 : front, ty + 18, 3, 3, '#d2323d');
    if (o.tclip) c.restore();
  }
}
// ---- comércios e serviços pequenos, com temas: cada modelo tem a sua fachada, balcão e detalhes animados (vapor, neon, tambor girando...)
// fachada de comércio: faixa com o nome no topo e toldo de listras; a cena fica por baixo, comprimida na vertical (SK) para caber entre a faixa e o piso
const SK = .74;
const shopFront = (o, c, x, y, w, name, col, col2 = '#f4f1ea', ink = '#fff') => {
  R(c, x, y, w, 10, col); R(c, x, y + 9, w, 1, 'rgba(0,0,0,.25)'); R(c, x, y, w, 1, 'rgba(255,255,255,.2)');
  c.fillStyle = ink; c.font = 'bold 7px system-ui'; c.textAlign = 'left'; c.fillText(name, x + 4, y + 7.6);
  awning(c, x, y + 10, w, col, col2, 6);
  if (o.open !== undefined) { const t = o.open ? 'ABERTO' : 'FECHADO', pw = t.length * 3.5 + 5; R(c, x + w - pw - 3, y + 2, pw, 6.5, o.open ? '#2a8f4a' : '#b3262e'); c.fillStyle = '#fff'; c.font = 'bold 4.6px system-ui'; c.textAlign = 'center'; c.fillText(t, x + w - pw / 2 - 3, y + 6.9); }   // placa na porta
};
const sceneOn = (c, floorY) => { c.save(); c.translate(0, floorY); c.scale(1, SK); c.translate(0, -floorY); };
const steam = (c, x, y, tm, n = 3, col = '255,255,255') => { for (let i = 0; i < n; i++) { const p = (tm * .6 + i / n) % 1; c.fillStyle = `rgba(${col},${(.5 * (1 - p)).toFixed(2)})`; c.beginPath(); c.arc(x + Math.sin(p * 5 + i * 2) * 1.6, y - p * 9, 1.1 + p * 1.8, 0, 7); c.fill(); } };
const neon = (c, x, y, txt, col, tm, ph = 0) => { const on = Math.sin(tm * 4 + ph) > -.7; c.font = 'bold 7px system-ui'; c.textAlign = 'left'; c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(x - 2, y - 8, txt.length * 4.4 + 5, 11); c.fillStyle = on ? col : mixHex(col, '#000000', .6); c.fillText(txt, x, y); };
const tableRound = (c, x, floorY, col = '#8a6a47') => { R(c, x, floorY - 8, 9, 2, col); R(c, x + 4, floorY - 6, 1.4, 6, '#555'); R(c, x + 1, floorY - 1.4, 7, 1.4, '#555'); };
const cup = (c, x, y) => { R(c, x, y, 2.4, 2.4, '#f4f1ea'); R(c, x + 2.4, y + .6, 1, 1.2, '#f4f1ea'); };
function paintCafe2(c, f, x, y, w, h, o) {
  const floorY = y + h - SLAB, v = vr(f, 4), tm = o.time || 0, glow = o.lit || o.night;
  R(c, x, y, w, h, ['#e8d3b0', '#f0dcb8', '#f6dde4', '#d7e3cf'][v]); R(c, x, floorY - 6, w, 6, ['#8a6a47', '#a07a50', '#c98a9a', '#7a8a6a'][v]);
  if (!o.lod) return;
  sceneOn(c, floorY);
  if (v === 0) {   // café expresso
    R(c, x + 3, floorY - 16, 34, 10, '#4a3022'); R(c, x + 3, floorY - 17, 34, 2, '#7a5535'); R(c, x + 6, floorY - 25, 10, 8, '#c9ccd0'); R(c, x + 7, floorY - 24, 8, 3, '#888'); steam(c, x + 11, floorY - 25, tm);   // balcão e máquina de espresso
    R(c, x + 20, floorY - 25, 14, 8, '#2a2f38'); c.fillStyle = '#f4f1ea'; c.font = '3.5px system-ui'; c.textAlign = 'left'; ['Café 4', 'Latte 6', 'Capuc 6'].forEach((t, i) => c.fillText(t, x + 22, floorY - 22.5 + i * 2.4));   // cardápio
    tableRound(c, x + 42, floorY); cup(c, x + 44, floorY - 11);
    R(c, x + 54, y + 12, 1, 5, '#caa'); c.fillStyle = glow ? '#ffd98a' : '#d8c890'; c.beginPath(); c.arc(x + 54.5, y + 19, 3, 0, 7); c.fill();
  } else if (v === 1) {   // padaria
    R(c, x + 3, floorY - 14, 36, 8, '#6a4a2e'); R(c, x + 3, floorY - 24, 36, 10, 'rgba(180,220,235,.45)'); R(c, x + 3, floorY - 24, 36, 1, '#9ab');   // vitrine
    for (let i = 0; i < 5; i++) { c.fillStyle = '#c98a3a'; c.beginPath(); c.ellipse(x + 8 + i * 6.5, floorY - 17, 3, 1.8, 0, 0, 7); c.fill(); R(c, x + 6 + i * 6.5, floorY - 17.5, 4, .8, '#e0a850'); }
    R(c, x + 43, floorY - 14, 14, 8, '#7a5535'); for (let i = 0; i < 3; i++) R(c, x + 44 + i * 4.4, floorY - 24 + i, 1.8, 11 - i, '#d9a54a');   // cesta de baguetes
    steam(c, x + 28, floorY - 24, tm, 2, '255,240,200');
  } else if (v === 2) {   // confeitaria
    R(c, x + 3, floorY - 12, 40, 6, '#f4e6ee'); R(c, x + 3, floorY - 26, 40, 14, 'rgba(255,255,255,.5)'); R(c, x + 3, floorY - 26, 40, 1, '#e6c6d4');
    for (let i = 0; i < 3; i++) { const bx = x + 8 + i * 12; R(c, bx, floorY - 17, 8, 5, ['#e8527a', '#f2c230', '#8f6ae0'][i]); R(c, bx + 1.5, floorY - 21, 5, 4, '#fff'); c.fillStyle = '#d2323d'; c.beginPath(); c.arc(bx + 4, floorY - 22, 1.2, 0, 7); c.fill(); }   // bolos
    for (let i = 0; i < 4; i++) { R(c, x + 47 + (i % 2) * 5, floorY - 9 - Math.floor(i / 2) * 4, 4, 3, ['#c98a9a', '#7a5535'][i % 2]); }   // cupcakes
  } else {   // casa de chás
    R(c, x + 3, y + 10, 40, 2, '#6a4a2e'); for (let i = 0; i < 6; i++) { R(c, x + 5 + i * 6.4, y + 4, 4.4, 6, ['#7a9a5a', '#c98a3a', '#a04a4a', '#6a8aaa'][i % 4]); }   // potes de chá
    R(c, x + 3, y + 20, 40, 2, '#6a4a2e'); for (let i = 0; i < 6; i++) R(c, x + 5 + i * 6.4, y + 14, 4.4, 6, ['#a04a4a', '#7a9a5a', '#6a8aaa', '#c98a3a'][i % 4]);
    R(c, x + 3, floorY - 11, 22, 5, '#5a3a22'); R(c, x + 8, floorY - 17, 6, 6, '#c9ccd0'); steam(c, x + 11, floorY - 17, tm);   // chaleira
    R(c, x + 40, floorY - 8, 20, 6, '#7a5a8a'); R(c, x + 40, floorY - 13, 6, 5, '#8f6aa8'); R(c, x + 54, floorY - 13, 6, 5, '#8f6aa8');   // almofadas
  }
  c.restore(); shopFront(o, c, x, y, w, ['CAFÉ', 'PADARIA', 'DOCES', 'CHÁS'][v], ['#5a3a22', '#a06a2e', '#c0446a', '#3f7a42'][v]);
}
function paintMercado2(c, f, x, y, w, h, o) {
  const floorY = y + h - SLAB, v = vr(f, 4), tm = o.time || 0, glow = o.lit || o.night;
  R(c, x, y, w, h, ['#e9efe0', '#f2e6c4', '#dfe6ee', '#e6d6c4'][v]); R(c, x, floorY - 4, w, 4, '#b9b4a2');
  if (!o.lod) return;
  sceneOn(c, floorY);
  const cols = ['#c0392b', '#2e6fb5', '#e8a317', '#3a9d5d', '#8f6ae0', '#e8527a'];
  if (v === 0) {   // mercearia: gôndolas e caixa
    for (let g = 0; g < 3; g++) { const gx = x + 4 + g * 22; R(c, gx, floorY - 22, 18, 22, '#9aa4ad'); for (let r = 0; r < 3; r++) { R(c, gx + 1, floorY - 20 + r * 7, 16, 1, '#6a737c'); for (let i = 0; i < 5; i++) R(c, gx + 2 + i * 3, floorY - 26 + 6 + r * 7 + 0, 2.4, 5, cols[(i + r * 2 + g) % 6]); } }
    R(c, x + 72, floorY - 12, 20, 4, '#3a3f44'); R(c, x + 74, floorY - 14, 10, 2, '#888'); R(c, x + 88, floorY - 20, 4, 8, '#555'); R(c, x + 86, floorY - 24, 8, 4, '#2a8f6a');   // esteira e caixa
    R(c, x + 60, floorY - 10, 8, 10, '#d2323d'); R(c, x + 60, floorY - 12, 8, 2, '#b31b27');
  } else if (v === 1) {   // hortifruti
    for (let i = 0; i < 4; i++) { const bx = x + 4 + i * 22; R(c, bx, floorY - 9, 19, 9, '#a07a4a'); R(c, bx, floorY - 9, 19, 2, '#c4975a'); for (let k = 0; k < 6; k++) { c.fillStyle = [['#d2323d', '#e8a317', '#3a9d5d', '#e86a1c'][i], '#f2c230'][k % 2 && i % 2 ? 1 : 0]; c.beginPath(); c.arc(bx + 3 + k * 2.8, floorY - 11 - (k % 2), 1.9, 0, 7); c.fill(); } }
    R(c, x + 6, y + 14, 34, 9, '#2a3a2a'); c.fillStyle = '#f4f1ea'; c.font = 'bold 5px system-ui'; c.textAlign = 'left'; c.fillText('FRUTAS R$5', x + 8, y + 20.5);
    R(c, x + 78, floorY - 14, 12, 14, '#c9ccd0'); R(c, x + 80, floorY - 16, 8, 2, '#333'); // balança
  } else if (v === 2) {   // conveniência 24h
    for (let i = 0; i < 3; i++) { const bx = x + 4 + i * 14; R(c, bx, floorY - 24, 12, 24, '#2a323a'); R(c, bx + 1, floorY - 23, 10, 22, glow ? '#bfe3f5' : '#8aa6b8'); for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) R(c, bx + 2 + k * 3, floorY - 21 + r * 7, 2.2, 5, cols[(i + r + k) % 6]); }   // geladeiras
    R(c, x + 50, floorY - 18, 22, 18, '#6a737c'); for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) R(c, x + 52 + k * 5, floorY - 16 + r * 5.4, 3.6, 4, cols[(r * 2 + k) % 6]);   // snacks
    neon(c, x + 4, y + 20, '24H ABERTO', '#6fe3a6', tm);
  } else {   // empório e adega
    for (let i = 0; i < 4; i++) { R(c, x + 4 + i * 11, floorY - 24, 9, 22, '#5a3a22'); for (let r = 0; r < 4; r++) R(c, x + 5 + i * 11, floorY - 22 + r * 5, 7, 1.8, ['#7a1f2b', '#3a6a2a', '#d9a23a'][(i + r) % 3]); }   // adega
    R(c, x + 52, floorY - 12, 30, 12, '#8a6a47'); R(c, x + 52, floorY - 13, 30, 2, '#caa070'); R(c, x + 56, floorY - 18, 8, 5, '#f2c230'); R(c, x + 68, floorY - 17, 9, 4, '#e8c06a');   // balcão de queijos
    for (let i = 0; i < 3; i++) { R(c, x + 56 + i * 9, y + 10, .8, 6, '#555'); c.fillStyle = '#c4604a'; c.beginPath(); c.ellipse(x + 56.4 + i * 9, y + 20, 2.2, 3.5, 0, 0, 7); c.fill(); }   // presuntos pendurados
  }
  c.restore(); shopFront(o, c, x, y, w, ['MERCADINHO', 'HORTIFRUTI', 'CONVENIÊNCIA', 'EMPÓRIO'][v], ['#2e6a46', '#b3571b', '#1d4fa8', '#5a2327'][v]);
}
function paintLavanderia2(c, f, x, y, w, h, o) {
  const floorY = y + h - SLAB, v = vr(f, 3), tm = o.time || 0;
  R(c, x, y, w, h, ['#e3f0f7', '#f0eadf', '#e8e3f5'][v]); R(c, x, floorY - 4, w, 4, '#b8c2cc');
  if (!o.lod) return;
  sceneOn(c, floorY);
  if (v === 0) {   // autoatendimento: máquinas com o tambor girando
    for (let i = 0; i < 6; i++) { const mx = x + 4 + i * 15.5; R(c, mx, floorY - 20, 13, 20, '#f4f6f9'); R(c, mx, floorY - 20, 13, 3, '#9aa6bf'); R(c, mx + 8, floorY - 18, 3, 1.5, '#d2323d');
      c.fillStyle = '#7fb6d9'; c.beginPath(); c.arc(mx + 6.5, floorY - 9, 4.6, 0, 7); c.fill(); c.strokeStyle = '#6b7a96'; c.lineWidth = 1; c.stroke();
      c.fillStyle = ['#e8527a', '#f2c230', '#fff', '#3a9d5d'][i % 4]; const a = tm * 5 * (i % 2 ? 1 : -1) + i; c.beginPath(); c.arc(mx + 6.5 + Math.cos(a) * 2.2, floorY - 9 + Math.sin(a) * 2.2, 1.3, 0, 7); c.fill(); }
  } else if (v === 1) {   // lavagem a seco: cabides correndo no varal
    R(c, x + 3, y + 12, w - 6, 1.5, '#888'); for (let i = 0; i < 9; i++) { const hx = x + 6 + ((i * 10 + tm * 8) % (w - 12)); R(c, hx, y + 13, .8, 3, '#888'); R(c, hx - 2, y + 16, 5, 11, ['#3a6aa8', '#c0392b', '#e8e0d0', '#6a8a4a'][i % 4]); }
    R(c, x + 6, floorY - 10, 36, 6, '#8a6a47'); R(c, x + 6, floorY - 11, 36, 1.5, '#caa070'); R(c, x + 60, floorY - 14, 28, 14, '#d8d2c4'); R(c, x + 62, floorY - 12, 24, 8, '#e8e0d0');   // balcão e prensa
  } else {   // lava e seca: secadoras empilhadas, mesa de dobrar, cestos
    for (let i = 0; i < 3; i++) { const mx = x + 4 + i * 16; R(c, mx, floorY - 22, 14, 22, '#cfd5dc'); for (let r = 0; r < 2; r++) { c.fillStyle = '#7a8aa0'; c.beginPath(); c.arc(mx + 7, floorY - 16 + r * 10, 4.2, 0, 7); c.fill(); c.fillStyle = ['#e8527a', '#2e6fb5'][r]; const a = tm * 6 + r + i; c.beginPath(); c.arc(mx + 7 + Math.cos(a) * 1.8, floorY - 16 + r * 10 + Math.sin(a) * 1.8, 1.2, 0, 7); c.fill(); } }
    R(c, x + 56, floorY - 11, 26, 3, '#8a6a47'); R(c, x + 58, floorY - 8, 2, 8, '#6a4a2e'); R(c, x + 78, floorY - 8, 2, 8, '#6a4a2e'); for (let i = 0; i < 3; i++) R(c, x + 59 + i * 7, floorY - 14, 6, 3, ['#e8527a', '#f2c230', '#fff'][i]);
    R(c, x + 86, floorY - 10, 8, 10, '#d9a54a'); R(c, x + 86, floorY - 12, 8, 2, '#b8863a');
  }
  c.restore(); shopFront(o, c, x, y, w, ['LAVANDERIA', 'LAVA A SECO', 'LAVA E SECA'][v], ['#3a78b8', '#6a4a2e', '#5a3a90'][v]);
}
function paintBanco2(c, f, x, y, w, h, o) {
  const floorY = y + h - SLAB, v = vr(f, 3), tm = o.time || 0, glow = o.lit || o.night;
  R(c, x, y, w, h, ['#d5dbe4', '#cfd8d8', '#e0e0ea'][v]); R(c, x, floorY - 4, w, 4, ['#8a93a0', '#7a8a8a', '#9a9ab0'][v]);
  if (!o.lod) return;
  sceneOn(c, floorY);
  R(c, x, y, w, 5, ['#33506f', '#2a5a5a', '#4a4a7a'][v]);
  if (v === 0) {   // agência clássica: guichês e cofre
    for (let i = 0; i < 3; i++) { const gx = x + 4 + i * 24; R(c, gx, floorY - 14, 20, 10, '#7a5a3a'); R(c, gx, floorY - 15, 20, 2, '#a07a52'); R(c, gx + 2, floorY - 26, 16, 12, 'rgba(170,210,230,.45)'); R(c, gx + 2, floorY - 26, 16, 1, '#789'); c.fillStyle = '#e8b98f'; c.beginPath(); c.arc(gx + 10, floorY - 19, 2, 0, 7); c.fill(); R(c, gx + 8, floorY - 17, 4, 4, ['#2a4a7a', '#7a2a3a', '#2a6a4a'][i]); }
    R(c, x + 76, floorY - 24, 16, 24, '#59647a'); c.fillStyle = '#8a95aa'; c.beginPath(); c.arc(x + 84, floorY - 12, 6, 0, 7); c.fill(); c.strokeStyle = '#d9a23a'; c.lineWidth = 1.2; c.beginPath(); c.arc(x + 84, floorY - 12, 3, 0, 7); c.stroke();   // cofre
    R(c, x + 70, floorY - 8, 1, 8, '#d9a23a'); for (let i = 0; i < 3; i++) R(c, x + 4 + i * 24 + 10, floorY - 4, 6 - i, 1, '#a33');
  } else if (v === 1) {   // caixas 24h
    for (let i = 0; i < 3; i++) { const ax = x + 8 + i * 28; R(c, ax, floorY - 28, 20, 28, '#2a3038'); R(c, ax + 2, floorY - 26, 16, 10, glow ? '#7fe3e3' : '#2f6f6f'); c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(ax + 3, floorY - 24 + ((tm * 6 + i * 3) % 7), 14, 1); for (let k = 0; k < 6; k++) R(c, ax + 4 + (k % 3) * 4, floorY - 13 + Math.floor(k / 3) * 3.2, 3, 2.2, '#8a95aa'); R(c, ax + 6, floorY - 5, 8, 2, '#111'); }
    neon(c, x + 22, y + 15, 'CAIXA 24H', '#7fe3e3', tm, 2);
  } else {   // banco digital: sofás, telas e tablets
    R(c, x + 6, floorY - 22, 30, 16, '#1a1f2a'); R(c, x + 7, floorY - 21, 28, 14, '#2a8aff'); c.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 4; i++) c.fillRect(x + 10 + i * 6, floorY - 12 - ((tm * 3 + i) % 4) - i, 3, 4 + i);   // gráfico animado
    R(c, x + 46, floorY - 9, 22, 7, '#4a4a7a'); R(c, x + 46, floorY - 13, 22, 4, '#6a6aa0'); R(c, x + 44, floorY - 11, 3, 9, '#3a3a60'); R(c, x + 67, floorY - 11, 3, 9, '#3a3a60');
    R(c, x + 74, floorY - 16, 14, 16, '#c9ccd0'); R(c, x + 76, floorY - 14, 10, 7, glow ? '#bfe3f5' : '#8aa6b8'); c.fillStyle = '#3f8a4a'; c.beginPath(); c.arc(x + 90, floorY - 6, 3.5, 0, 7); c.fill(); R(c, x + 89, floorY - 4, 2, 4, '#7a5535');
  }
  c.restore(); shopFront(o, c, x, y, w, ['BANCO', 'CAIXAS', 'BANCO DIGITAL'][v], ['#33506f', '#2a5a5a', '#4a4a7a'][v]);
}
function paintJardim2(c, f, x, y, w, h, o) {
  const floorY = y + h - SLAB, v = vr(f, 4), tm = o.time || 0, night = o.night;
  const sky = c.createLinearGradient(0, y, 0, floorY); sky.addColorStop(0, night ? '#1d2b45' : ['#cfe9f5', '#d9eef2', '#e8f0d8', '#f6e4e8'][v]); sky.addColorStop(1, night ? '#243049' : '#eaf4ee'); c.fillStyle = sky; c.fillRect(x, y, w, h);
  R(c, x, floorY - 5, w, 5, ['#5aa04a', '#4a8a3f', '#7a9a4a', '#6aa05a'][v]);
  if (!o.lod) return;
  const tree = (tx, th, col) => { R(c, tx - 1.2, floorY - 5 - th * .45, 2.4, th * .45, '#7a5535'); c.fillStyle = col; c.beginPath(); c.arc(tx, floorY - 5 - th * .6, th * .32, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.arc(tx - th * .1, floorY - 5 - th * .7, th * .16, 0, 7); c.fill(); };
  const bench = bx => { R(c, bx, floorY - 9, 12, 2, '#8a6440'); R(c, bx, floorY - 13, 12, 1.6, '#8a6440'); R(c, bx + 1, floorY - 7, 1.4, 5, '#555'); R(c, bx + 9.6, floorY - 7, 1.4, 5, '#555'); };
  if (v === 0) {   // praça com chafariz
    tree(x + 10, 24, '#3f8a4a'); tree(x + w - 12, 26, '#4f9a52'); tree(x + 30, 18, '#5aaa5a');
    const fx = x + w / 2; R(c, fx - 12, floorY - 9, 24, 4, '#b9b4a2'); R(c, fx - 9, floorY - 12, 18, 3, '#c9c4b2'); R(c, fx - 1, floorY - 22, 2, 10, '#c9c4b2');
    c.strokeStyle = 'rgba(140,200,240,.85)'; c.lineWidth = 1.2; for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(fx, floorY - 22); c.quadraticCurveTo(fx + k * 7, floorY - 28 - Math.sin(tm * 3 + k) * 1.5, fx + k * 10, floorY - 12); c.stroke(); }
    bench(x + 44); bench(x + w - 60);
  } else if (v === 1) {   // bosque com trilha e luminária
    for (let i = 0; i < 6; i++) tree(x + 8 + i * 22 + (i % 2) * 4, 22 + (i % 3) * 6, ['#2f7a3e', '#3f8a4a', '#4f9a52'][i % 3]);
    R(c, x + 30, floorY - 5, 70, 2, '#c9b98a'); bench(x + 58); R(c, x + 90, floorY - 22, 1.6, 17, '#555'); c.fillStyle = night ? '#ffe9a0' : '#e8dcb0'; c.beginPath(); c.arc(x + 90.8, floorY - 23, 3, 0, 7); c.fill();
    for (let i = 0; i < 4; i++) { const p = (tm * .15 + i * .26) % 1; c.fillStyle = '#f2c230'; c.fillRect(x + 10 + p * (w - 20), y + 8 + i * 7 + Math.sin(tm * 2 + i) * 2, 1.6, 1.6); }   // vaga-lumes / borboletas
  } else if (v === 2) {   // horta comunitária
    for (let r = 0; r < 3; r++) for (let i = 0; i < 12; i++) { const hx = x + 6 + i * 10; R(c, hx, floorY - 7 - r * 4, 7, 1.6, '#6a4a2e'); c.fillStyle = ['#3a9d5d', '#d2323d', '#e86a1c', '#8fc84a'][(i + r) % 4]; c.beginPath(); c.arc(hx + 3.5, floorY - 9 - r * 4, 2.1 + (i % 2) * .5, 0, 7); c.fill(); }
    R(c, x + w - 18, floorY - 24, 1.6, 19, '#7a5535'); R(c, x + w - 24, floorY - 22, 13, 1.6, '#7a5535'); c.fillStyle = '#d9b66a'; c.beginPath(); c.arc(x + w - 17.2, floorY - 26, 3, 0, 7); c.fill();   // espantalho
  } else {   // jardim japonês: lago, ponte, lanterna e cerejeira
    c.fillStyle = '#4a9ac9'; c.beginPath(); c.ellipse(x + w * .45, floorY - 5, 34, 5, 0, 0, 7); c.fill(); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = .8; c.beginPath(); for (let i = 0; i < 40; i += 2) c.lineTo(x + w * .45 - 20 + i, floorY - 5 + Math.sin(tm * 2 + i * .5) * .8); c.stroke();
    c.strokeStyle = '#a3202a'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + w * .45 - 16, floorY - 6); c.quadraticCurveTo(x + w * .45, floorY - 16, x + w * .45 + 16, floorY - 6); c.stroke();   // ponte
    R(c, x + 12, floorY - 12, 6, 7, '#8a8f99'); R(c, x + 10, floorY - 15, 10, 3, '#6a6f78'); R(c, x + 13, floorY - 9, 4, 3, night ? '#ffd98a' : '#c9b98a');   // lanterna
    R(c, x + w - 22, floorY - 24, 2.4, 19, '#6a4a3a'); for (let i = 0; i < 7; i++) { c.fillStyle = ['#f6c6d6', '#f2a6bf'][i % 2]; c.beginPath(); c.arc(x + w - 21 + Math.cos(i) * 8, floorY - 26 + Math.sin(i * 1.7) * 6, 4.4, 0, 7); c.fill(); }
    for (let i = 0; i < 3; i++) { const p = (tm * .2 + i / 3) % 1; c.fillStyle = '#f6c6d6'; c.fillRect(x + w - 30 + p * -40 + Math.sin(p * 9) * 3, floorY - 24 + p * 20, 1.6, 1.2); }   // pétalas caindo
  }
  sign(c, x + 3, y + 9, ['PRAÇA', 'BOSQUE', 'HORTA', 'JARDIM ZEN'][v], '#fff', ['#3f7a42', '#2f6a3a', '#6a4a2e', '#a3202a'][v]);
}
function paintAcademia2(c, f, x, y, w, h, o) {
  const floorY = y + h - SLAB, v = vr(f, 4), tm = o.time || 0, glow = o.lit || !o.night;
  R(c, x, y, w, h, ['#e8dcd0', '#2a2f44', '#efe9dc', '#2f2a30'][v]); R(c, x, floorY - 4, w, 4, ['#6a5a4a', '#1b1e30', '#c9b98a', '#4a2a2a'][v]);
  if (!o.lod) return;
  sceneOn(c, floorY);
  R(c, x + 1, y + 8, w - 2, 12, v === 1 ? '#3a4466' : 'rgba(190,220,235,.55)'); R(c, x + w * .5 - .5, y + 8, 1, 12, 'rgba(0,0,0,.2)');   // janelão / espelho
  if (v === 0) {   // musculação: barras, anilhas e halteres
    R(c, x + 6, floorY - 12, 30, 2, '#666'); R(c, x + 4, floorY - 16, 4, 10, '#222'); R(c, x + 34, floorY - 16, 4, 10, '#222'); R(c, x + 12, floorY - 10, 1.6, 10, '#555'); R(c, x + 28, floorY - 10, 1.6, 10, '#555');
    const lift = Math.abs(Math.sin(tm * 1.6)) * 5; R(c, x + 8, floorY - 17 - lift, 26, 1.8, '#999'); R(c, x + 6, floorY - 21 - lift, 3, 9, '#c0392b'); R(c, x + 33, floorY - 21 - lift, 3, 9, '#c0392b');   // barra subindo
    R(c, x + 50, floorY - 7, 16, 3, '#333'); for (let i = 0; i < 4; i++) { R(c, x + 52 + i * 4, floorY - 11, 2.4, 3, '#c0392b'); R(c, x + 52 + i * 4 - .6, floorY - 10.6, 3.6, 1, '#222'); }
    R(c, x + 74, floorY - 14, 14, 8, '#555'); R(c, x + 76, floorY - 20, 10, 6, '#7a7f88');
  } else if (v === 1) {   // spinning: bicicletas pedalando com luz de balada
    for (let i = 0; i < 3; i++) { const bx = x + 8 + i * 28; c.strokeStyle = '#d9d9d9'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(bx, floorY - 4); c.lineTo(bx + 6, floorY - 16); c.lineTo(bx + 14, floorY - 12); c.stroke(); c.beginPath(); c.arc(bx + 5, floorY - 6, 3.4, tm * 6 + i, tm * 6 + i + 5.5); c.stroke(); R(c, bx + 12, floorY - 18, 5, 1.6, '#c0392b'); R(c, bx - 1, floorY - 4, 14, 2, '#444'); c.fillStyle = '#e8b98f'; c.beginPath(); c.arc(bx + 7, floorY - 22 + Math.sin(tm * 6 + i) * .8, 2, 0, 7); c.fill(); R(c, bx + 5, floorY - 20, 4, 8, ['#e8527a', '#2e6fb5', '#f2c230'][i]); }
    for (let i = 0; i < 4; i++) { c.fillStyle = `hsla(${(tm * 60 + i * 90) % 360},80%,60%,.25)`; c.fillRect(x + 4 + i * 22, y + 3, 14, 3); }
  } else if (v === 2) {   // yoga: tapetes, plantas e luz suave
    for (let i = 0; i < 4; i++) { const mx = x + 6 + i * 22; R(c, mx, floorY - 3, 18, 2.4, ['#7a9a5a', '#9a7aa8', '#c98a6a', '#6a8aaa'][i]); c.fillStyle = '#e8b98f'; c.beginPath(); c.arc(mx + 9, floorY - 12 - (i % 2) * 1.5, 2, 0, 7); c.fill(); R(c, mx + 6, floorY - 10 - (i % 2) * 1.5, 6, 6, ['#d2a6c6', '#a6c6d2', '#c6d2a6', '#d2c6a6'][i]); R(c, mx + 3, floorY - 5, 12, 2, ['#d2a6c6', '#a6c6d2', '#c6d2a6', '#d2c6a6'][i]); }
    R(c, x + w - 10, floorY - 22, 7, 18, '#3f8a4a'); c.fillStyle = '#4fa35a'; c.beginPath(); c.arc(x + w - 6.5, floorY - 24, 6, 0, 7); c.fill(); c.fillStyle = 'rgba(255,230,160,.12)'; c.fillRect(x, y, w, h - SLAB);
  } else {   // lutas: ringue com dois lutadores trocando golpes e um saco de pancada
    R(c, x + 6, floorY - 9, 66, 5, '#c0392b'); R(c, x + 6, floorY - 9, 66, 1.4, '#e8e0d0');   // lona
    for (const px of [x + 7, x + 70]) R(c, px, floorY - 24, 1.8, 15, '#ddd');   // postes
    for (const [yy, col] of [[-22, '#2e6fb5'], [-17, '#e8e0d0'], [-12, '#d2323d']]) R(c, x + 7, floorY + yy, 64, 1, col);   // cordas
    const fight = (fx, dir, shirt, glove, ph) => {
      const hit = Math.max(0, Math.sin(tm * 5 + ph)), bob = Math.sin(tm * 8 + ph) * .8;
      R(c, fx - 2.4, floorY - 17 + bob, 4.8, 8, shirt); R(c, fx - 2.4, floorY - 11 + bob, 4.8, 3, '#222');   // tronco e calção
      R(c, fx - 1.8, floorY - 9, 1.6, 4.6, '#e8b98f'); R(c, fx + .4, floorY - 9, 1.6, 4.6, '#e8b98f');   // pernas
      c.fillStyle = '#e8b98f'; c.beginPath(); c.arc(fx, floorY - 20 + bob, 2.4, 0, 7); c.fill(); R(c, fx - 2.4, floorY - 22.4 + bob, 4.8, 1.2, '#222');
      c.strokeStyle = '#e8b98f'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(fx + dir * 2, floorY - 15 + bob); c.lineTo(fx + dir * (4 + hit * 8), floorY - 15 - hit * 1 + bob); c.stroke();   // braço do golpe
      c.fillStyle = glove; c.beginPath(); c.arc(fx + dir * (5 + hit * 8), floorY - 15 - hit + bob, 2.2, 0, 7); c.fill();
      c.beginPath(); c.arc(fx + dir * 3, floorY - 12 + bob, 2, 0, 7); c.fill();   // luva de guarda
    };
    const sep = Math.sin(tm * 2.2) * 2; fight(x + 28 + sep, 1, '#d2323d', '#c0392b', 0); fight(x + 52 - sep, -1, '#2e6fb5', '#2e6fb5', 3);
    // saco de pancada: pêndulo preso ao teto por uma corrente (gira em torno do gancho, não desliza)
    const ang = Math.sin(tm * 2.4) * .16, sx = x + 86; c.save(); c.translate(sx, y + 3); c.rotate(ang);
    R(c, -1.5, -1, 3, 2, '#666'); c.strokeStyle = '#888'; c.lineWidth = .8; c.beginPath(); c.moveTo(-2, 0); c.lineTo(-2.4, 9); c.moveTo(2, 0); c.lineTo(2.4, 9); c.stroke();
    c.fillStyle = '#b8322a'; c.beginPath(); c.roundRect ? c.roundRect(-3.6, 9, 7.2, 16, 2.4) : c.rect(-3.6, 9, 7.2, 16); c.fill();
    R(c, -3.6, 13, 7.2, 1.2, '#7a1f1a'); R(c, -3.6, 20, 7.2, 1.2, '#7a1f1a'); R(c, -2.2, 10, 1.1, 14, 'rgba(255,255,255,.25)'); c.restore();
  }
  c.restore(); shopFront(o, c, x, y, w, ['MUSCULAÇÃO', 'SPINNING', 'YOGA', 'LUTAS'][v], ['#a8602e', '#5a4aa8', '#5a7a4a', '#a02828'][v]);
}
function paintCreche2(c, f, x, y, w, h, o) {
  const floorY = y + h - SLAB, v = vr(f, 3), tm = o.time || 0;
  R(c, x, y, w, h, ['#fbe9b0', '#d6ecc8', '#f6dde4'][v]); R(c, x, floorY - 5, w, 5, ['#e29a4a', '#6aa05a', '#d9a6b8'][v]);
  if (!o.lod) return;
  sceneOn(c, floorY);
  R(c, x + 6, y + 8, w - 12, 9, 'rgba(255,255,255,.4)'); const cols = ['#e5484d', '#3a78b8', '#4fa84a', '#f2c230', '#8f6ae0'];
  for (let i = 0; i < 6; i++) { c.fillStyle = cols[i % 5]; c.beginPath(); c.arc(x + 12 + i * 14, y + 12.5, 3, 0, 7); c.fill(); }   // varal de desenhos / mural
  if (v === 0) {   // salinha: blocos e tapete
    R(c, x + 8, floorY - 3, 40, 3, '#e8527a'); for (let i = 0; i < 5; i++) R(c, x + 12 + i * 7, floorY - 9 - (i % 2) * 5, 6, 6 + (i % 2) * 5 - 1, cols[i % 5]);
    R(c, x + 58, floorY - 10, 26, 3, '#a07a50'); R(c, x + 60, floorY - 7, 2, 7, '#7a5535'); R(c, x + 80, floorY - 7, 2, 7, '#7a5535'); for (let i = 0; i < 3; i++) { c.fillStyle = '#f0cfae'; c.beginPath(); c.arc(x + 63 + i * 8, floorY - 14, 2, 0, 7); c.fill(); R(c, x + 61 + i * 8, floorY - 12, 4, 3, cols[(i + 2) % 5]); }
  } else if (v === 1) {   // parquinho: escorregador e bola quicando
    c.fillStyle = '#e5484d'; c.beginPath(); c.moveTo(x + 10, floorY - 24); c.lineTo(x + 14, floorY - 24); c.lineTo(x + 36, floorY - 5); c.lineTo(x + 31, floorY - 5); c.fill(); R(c, x + 8, floorY - 26, 7, 2, '#3a78b8'); R(c, x + 9, floorY - 24, 1.6, 20, '#888'); R(c, x + 13, floorY - 24, 1.6, 20, '#888');
    const by = floorY - 6 - Math.abs(Math.sin(tm * 3)) * 12; c.fillStyle = '#f2c230'; c.beginPath(); c.arc(x + 58, by, 3.2, 0, 7); c.fill(); c.fillStyle = '#e5484d'; c.fillRect(x + 56.5, by - 1, 3, 2);
    R(c, x + 72, floorY - 14, 12, 14, '#8a6a47'); for (let i = 0; i < 3; i++) R(c, x + 73 + i * 4, floorY - 12, 3, 4, cols[i]);
  } else {   // berçário: berços e móbile girando
    for (let i = 0; i < 3; i++) { const bx = x + 6 + i * 29; R(c, bx, floorY - 12, 22, 8, '#fff'); for (let k = 0; k < 6; k++) R(c, bx + 1 + k * 4, floorY - 17, 1, 6, '#d9b8c8'); R(c, bx + 2, floorY - 12, 18, 3, '#f6c6d6'); c.fillStyle = '#f0cfae'; c.beginPath(); c.arc(bx + 6, floorY - 12, 2, 0, 7); c.fill(); }
    for (let i = 0; i < 3; i++) { const mx = x + 17 + i * 29, a = tm * 2 + i; R(c, mx, y + 14, .8, 6, '#aaa'); for (let k = 0; k < 3; k++) { c.fillStyle = cols[(k + i) % 5]; c.beginPath(); c.arc(mx + Math.cos(a + k * 2.1) * 5, y + 22 + Math.sin(a + k * 2.1) * 1.2, 1.7, 0, 7); c.fill(); } }
  }
  c.restore(); shopFront(o, c, x, y, w, ['CRECHE', 'PARQUINHO', 'BERÇÁRIO'][v], ['#c78a20', '#3f7a42', '#c0446a'][v]);
}
function paintFast2(c, f, x, y, w, h, o) {
  const floorY = y + h - SLAB, v = vr(f, 6), tm = o.time || 0, glow = o.lit || o.night;
  R(c, x, y, w, h, ['#f6dba0', '#f4e4c4', '#f8d6e2', '#d9bf9a', '#f2dcb4', '#dfeccc'][v]); R(c, x, floorY - 5, w, 5, ['#a8643a', '#8a4a2e', '#d9a6b8', '#7a5535', '#b88a54', '#6aa05a'][v]);
  if (!o.lod) return;
  sceneOn(c, floorY);
  const stool = sx => { R(c, sx, floorY - 11, 6, 2, '#c0392b'); R(c, sx + 2.5, floorY - 9, 1, 8, '#777'); R(c, sx, floorY - 1.4, 6, 1.4, '#555'); };
  const board = (bx, by, bw, lines, col = '#24303a') => { R(c, bx, by, bw, 8 + lines.length * 3.6, col); c.fillStyle = '#f4f1ea'; c.font = '3.6px system-ui'; c.textAlign = 'left'; lines.forEach((t, i) => c.fillText(t, bx + 2, by + 7 + i * 3.6)); };
  if (v === 0) {   // hamburgueria: chapa com fumaça, hambúrguer e cardápio
    R(c, x + 4, floorY - 18, 46, 13, '#5a3a22'); R(c, x + 4, floorY - 19, 46, 2, '#8a5a32'); R(c, x + 8, floorY - 24, 16, 6, '#3a3f44'); steam(c, x + 16, floorY - 24, tm, 3, '210,210,210');
    for (let i = 0; i < 3; i++) { const bx = x + 27 + i * 7; R(c, bx, floorY - 24, 6, 2, '#d9a441'); R(c, bx, floorY - 22, 6, 1.4, '#4a8c3a'); R(c, bx, floorY - 20.6, 6, 1.6, '#8a3a2a'); R(c, bx, floorY - 19, 6, 1.6, '#d9a441'); }
    board(x + 56, y + 13, 30, ['X-BURGER 18', 'BATATA 9', 'REFRI 6']); stool(x + 92); stool(x + 102); stool(x + 112);
    R(c, x + 90, floorY - 15, 32, 3, '#6b4a2c');
  } else if (v === 1) {   // pizzaria: forno a lenha com fogo, pizzas e mesas xadrez
    R(c, x + 4, floorY - 26, 22, 22, '#8a4a2e'); c.fillStyle = '#2a1a12'; c.beginPath(); c.arc(x + 15, floorY - 14, 7, Math.PI, 0); c.rect(x + 8, floorY - 14, 14, 10); c.fill();
    for (let i = 0; i < 4; i++) { c.fillStyle = ['#ff7a1c', '#ffd24a', '#ff4a1c'][i % 3]; const fl = 3 + Math.sin(tm * 9 + i * 2) * 1.5; c.beginPath(); c.moveTo(x + 10 + i * 3, floorY - 4); c.quadraticCurveTo(x + 11 + i * 3, floorY - 4 - fl * 1.6, x + 12.5 + i * 3, floorY - 4); c.fill(); }
    for (let i = 0; i < 3; i++) { c.fillStyle = '#e8b04a'; c.beginPath(); c.arc(x + 38 + i * 13, floorY - 11, 5, 0, 7); c.fill(); c.fillStyle = '#c0392b'; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(x + 36 + i * 13 + (k % 2) * 4, floorY - 12 + (k > 1 ? 3 : 0), 1.2, 0, 7); c.fill(); } }
    R(c, x + 34, floorY - 6, 46, 2, '#8a6a47');
    for (let i = 0; i < 2; i++) { const tx = x + 88 + i * 20; for (let k = 0; k < 4; k++) R(c, tx + k * 4, floorY - 9, 4, 2.4, k % 2 ? '#fff' : '#c0392b'); R(c, tx + 7, floorY - 6.5, 2, 6.5, '#555'); }
  } else if (v === 2) {   // sorveteria: cubas de sabores e casquinha gigante
    R(c, x + 4, floorY - 14, 60, 9, '#f4f6f9'); R(c, x + 4, floorY - 15, 60, 2, '#cfe3f0'); const fl = ['#f6c6d6', '#7a4a2e', '#f2e0a0', '#a6dcc2', '#c6a6f2', '#f2a65a'];
    for (let i = 0; i < 6; i++) { c.fillStyle = fl[i]; c.beginPath(); c.arc(x + 10 + i * 9.4, floorY - 16, 4, Math.PI, 0); c.fill(); R(c, x + 6 + i * 9.4, floorY - 16, 8, 3, fl[i]); }
    const bob = Math.sin(tm * 2) * 1.4; R(c, x + 78, floorY - 8 + bob, 9, 1, '#caa'); c.fillStyle = '#d9a54a'; c.beginPath(); c.moveTo(x + 76, floorY - 18 + bob); c.lineTo(x + 90, floorY - 18 + bob); c.lineTo(x + 83, floorY - 4 + bob); c.fill();
    c.fillStyle = '#f6c6d6'; c.beginPath(); c.arc(x + 83, floorY - 21 + bob, 6.5, 0, 7); c.fill(); c.fillStyle = '#7a4a2e'; c.beginPath(); c.arc(x + 83, floorY - 27 + bob, 4.5, 0, 7); c.fill(); c.fillStyle = '#d2323d'; c.beginPath(); c.arc(x + 83, floorY - 31 + bob, 1.6, 0, 7); c.fill();
    board(x + 96, y + 13, 26, ['BOLA 5', 'CASQUINHA 7']);
  } else if (v === 3) {   // café e pão: estufa de pães, máquina, bolos
    R(c, x + 4, floorY - 24, 50, 20, '#6a4a2e'); for (let r = 0; r < 3; r++) { R(c, x + 6, floorY - 22 + r * 6.2, 46, 1, '#8a6a47'); for (let i = 0; i < 6; i++) { c.fillStyle = '#c98a3a'; c.beginPath(); c.ellipse(x + 11 + i * 7.5, floorY - 24 + r * 6.2 + 4.2, 3, 1.8, 0, 0, 7); c.fill(); } }
    R(c, x + 62, floorY - 20, 14, 15, '#c9ccd0'); R(c, x + 64, floorY - 18, 10, 4, '#2a2f38'); steam(c, x + 69, floorY - 21, tm); R(c, x + 62, floorY - 8, 14, 3, '#888');
    R(c, x + 84, floorY - 12, 34, 7, '#f4e6ee'); for (let i = 0; i < 3; i++) { R(c, x + 88 + i * 10, floorY - 17, 7, 5, ['#e8527a', '#7a4a2e', '#f2c230'][i]); R(c, x + 89.5 + i * 10, floorY - 19, 4, 2, '#fff'); }
  } else if (v === 4) {   // cachorro-quente: carrinho com guarda-sol
    R(c, x + 12, floorY - 12, 40, 8, '#c0392b'); R(c, x + 12, floorY - 13, 40, 2, '#f4f1ea'); c.fillStyle = '#222'; c.beginPath(); c.arc(x + 18, floorY - 3, 3, 0, 7); c.arc(x + 46, floorY - 3, 3, 0, 7); c.fill();
    R(c, x + 31, floorY - 30, 1.4, 18, '#888'); c.fillStyle = '#d2323d'; c.beginPath(); c.moveTo(x + 14, floorY - 24); c.quadraticCurveTo(x + 32, floorY - 38, x + 50, floorY - 24); c.fill(); for (let i = 0; i < 4; i++) { R(c, x + 18 + i * 8, floorY - 29 + (i % 2) * 2, 4, 5, '#f4f1ea'); }
    for (let i = 0; i < 3; i++) { R(c, x + 18 + i * 8, floorY - 15, 6, 2.4, '#c4604a'); R(c, x + 18 + i * 8, floorY - 14.2, 6, .8, '#f2c230'); } steam(c, x + 28, floorY - 15, tm, 3, '230,230,230');
    for (let i = 0; i < 2; i++) { R(c, x + 62 + i * 6, floorY - 10, 3, 6, ['#d2323d', '#f2c230'][i]); R(c, x + 62.6 + i * 6, floorY - 12, 1.8, 2, '#eee'); }
    board(x + 78, y + 13, 30, ['HOT DOG 8', 'COMPLETO 12', 'REFRI 6']); stool(x + 110);
  } else {   // açaí e sucos: liquidificador, frutas e copos
    R(c, x + 4, floorY - 14, 48, 9, '#f4f6f9'); R(c, x + 4, floorY - 15, 48, 2, '#9ad08a'); for (let i = 0; i < 5; i++) { R(c, x + 8 + i * 9, floorY - 22, 6, 8, ['#6a2a8a', '#e86a1c', '#8fc84a', '#d2323d', '#f2c230'][i]); R(c, x + 9 + i * 9, floorY - 24, 4, 2, '#eee'); }
    R(c, x + 60, floorY - 24, 8, 12, 'rgba(200,230,240,.7)'); R(c, x + 61, floorY - 18, 6, 6, '#6a2a8a'); const sh = Math.sin(tm * 30) * .6; R(c, x + 59 + sh, floorY - 26, 10, 3, '#444'); R(c, x + 58, floorY - 12, 12, 5, '#555');
    for (let i = 0; i < 3; i++) { R(c, x + 80 + i * 10, floorY - 12, 6, 7, 'rgba(220,235,240,.8)'); R(c, x + 80 + i * 10, floorY - 12, 6, 4, ['#6a2a8a', '#e86a1c', '#8fc84a'][i]); }
    for (let i = 0; i < 4; i++) { c.fillStyle = ['#d2323d', '#f2c230', '#8fc84a', '#e86a1c'][i]; c.beginPath(); c.arc(x + 110 + (i % 2) * 5, floorY - 8 - Math.floor(i / 2) * 5, 2.3, 0, 7); c.fill(); }
  }
  c.restore();
  shopFront(o, c, x, y, w, ['LANCHES', 'PIZZARIA', 'SORVETERIA', 'CAFÉ & PÃO', 'HOT DOG', 'AÇAÍ & SUCOS'][v], ['#c83b2e', '#2e8b57', '#e8527a', '#7a5535', '#d9731b', '#6a2a8a'][v]);
}
function paintCamareiras(c, f, x, y, w, h, o) {
  const floorY = y + h - SLAB, tm = o.time || 0, big = w > 200;
  R(c, x, y, w, h, '#cfe1de'); R(c, x, floorY - 6, w, 6, '#8fa8a4'); R(c, x, y, w, 3, '#9fbab6');
  if (!o.lod) return;
  for (let i = 0; i < w; i += 16) R(c, x + i, y + 3, 1, floorY - y - 9, 'rgba(255,255,255,.25)');   // azulejos
  // máquinas de lavar com o tambor girando
  for (let i = 0; i < 2; i++) { const mx = x + 4 + i * 15; R(c, mx, floorY - 20, 13, 20, '#f4f6f9'); R(c, mx, floorY - 20, 13, 3, '#9aa6bf'); c.fillStyle = '#7fb6d9'; c.beginPath(); c.arc(mx + 6.5, floorY - 9, 4.8, 0, 7); c.fill(); c.strokeStyle = '#6b7a96'; c.lineWidth = 1; c.stroke(); c.fillStyle = ['#fff', '#e8527a'][i]; const a = tm * 5 * (i ? -1 : 1); c.beginPath(); c.arc(mx + 6.5 + Math.cos(a) * 2.2, floorY - 9 + Math.sin(a) * 2.2, 1.3, 0, 7); c.fill(); }
  // estante de roupa de cama e toalhas
  const sx = x + 38, sw = big ? 60 : 26; R(c, sx, floorY - 26, sw, 26, '#8a6a47'); for (let r = 0; r < 3; r++) { R(c, sx + 1, floorY - 25 + r * 8.4, sw - 2, 1.4, '#6a4a2e'); for (let k = 0; k < Math.floor((sw - 3) / 8); k++) { const hh = 4 + (k + r) % 3; R(c, sx + 2 + k * 8, floorY - 24 + r * 8.4 + (7 - hh), 7, hh, ['#fff', '#cfe3f0', '#f6dde4', '#e8e0d0'][(k + r) % 4]); } }
  // carrinho(s) de camareira: toalhas, saco de roupa suja e produtos
  const carts = big ? 2 : 1;
  for (let i = 0; i < carts; i++) { const cx = sx + sw + 5 + i * 28; R(c, cx, floorY - 14, 22, 3, '#7a838c'); R(c, cx + 2, floorY - 11, 1.6, 9, '#666'); R(c, cx + 18, floorY - 11, 1.6, 9, '#666'); c.fillStyle = '#222'; c.beginPath(); c.arc(cx + 3, floorY - 1.6, 1.8, 0, 7); c.arc(cx + 19, floorY - 1.6, 1.8, 0, 7); c.fill();
    for (let k = 0; k < 3; k++) R(c, cx + 2 + k * 5, floorY - 18, 4.4, 4, ['#fff', '#cfe3f0', '#f6dde4'][(k + i) % 3]); R(c, cx + 17, floorY - 21, 5, 7, i ? '#2e8b57' : '#8a6aa8'); R(c, cx + 16, floorY - 29, 1.4, 9, '#8a6a47'); R(c, cx + 13, floorY - 29, 6, 1.4, '#8a6a47'); R(c, cx + 18, floorY - 24, 3, 3, '#e8527a'); }
  // uniformes pendurados (e tábua de passar nas salas largas)
  const ux = x + w - (big ? 24 : 26); R(c, ux - 2, y + 10, 24, 1.2, '#888'); for (let i = 0; i < 3; i++) { R(c, ux + i * 7, y + 11, .8, 3, '#888'); R(c, ux - 2 + i * 7, y + 14, 6, 11, ['#7fc8c0', '#fff', '#7fc8c0'][i]); R(c, ux - 1 + i * 7, y + 14, 4, 2, '#e8e0d0'); }
  if (big) { const ix = x + w - 60; R(c, ix, floorY - 11, 26, 2.4, '#e8e0d0'); R(c, ix + 4, floorY - 9, 1.2, 9, '#777'); R(c, ix + 20, floorY - 9, 1.2, 9, '#777'); R(c, ix + 6, floorY - 14, 8, 3, '#6a7a8a'); steam(c, ix + 10, floorY - 14, tm, 2); }
  sign(c, x + 3, y + 12, 'CAMAREIRAS', '#fff', '#3a7a6e');
}
function paintShop2(c, f, x, y, w, h, o) {
  const floorY = y + h - SLAB, v = vr(f, 6), tm = o.time || 0, glow = o.lit || o.night;
  if (o.vacant) { vacantRoom(c, f, x, y, w, h, o, 'ALUGA-SE', false); R(c, x, y, w, 10, '#7a7568'); c.fillStyle = '#e8e4d8'; c.font = 'bold 7px system-ui'; c.textAlign = 'left'; c.fillText('LOJA VAGA', x + 4, y + 7.6); awning(c, x, y + 10, w, '#7a7568', '#c9c4b4', 6); return; }
  R(c, x, y, w, h, ['#efe3f2', '#efe0c8', '#dfe5ee', '#f1ead6', '#e6dcc4', '#ece6ef'][v]); R(c, x, floorY - 4, w, 4, '#b9b4a2');
  if (!o.lod) return;
  sceneOn(c, floorY);
  const cols = ['#c0392b', '#2e6fb5', '#e8a317', '#3a9d5d', '#8f6ae0', '#e8527a'];
  if (v === 0) {   // boutique: manequins, araras de roupas e espelho
    for (let i = 0; i < 2; i++) { const mx = x + 10 + i * 24; R(c, mx + 4, floorY - 8, 1.2, 8, '#888'); R(c, mx, floorY - 2, 10, 1.4, '#666'); c.fillStyle = '#e9d9c4'; c.beginPath(); c.arc(mx + 4.6, floorY - 25, 2.4, 0, 7); c.fill(); c.fillStyle = cols[(i * 2 + 1) % 6]; c.beginPath(); c.moveTo(mx + 1, floorY - 22); c.lineTo(mx + 8.4, floorY - 22); c.lineTo(mx + 11, floorY - 7); c.lineTo(mx - 2, floorY - 7); c.fill(); }
    for (let r = 0; r < 2; r++) { const rx = x + 58 + r * 20; R(c, rx, floorY - 26, 16, 1.2, '#888'); R(c, rx + 1, floorY - 26, 1.2, 26, '#888'); R(c, rx + 14, floorY - 26, 1.2, 26, '#888'); for (let k = 0; k < 5; k++) { R(c, rx + 2 + k * 2.8, floorY - 25, 2.2, 13 + (k % 2) * 3, cols[(k + r * 2) % 6]); } }
    R(c, x + 88, floorY - 26, 7, 24, '#bfe3f5'); R(c, x + 88, floorY - 26, 7, 1.4, '#888');
  } else if (v === 1) {   // sapatos: prateleiras de pares e banquinho com caixas
    for (let r = 0; r < 3; r++) { R(c, x + 4, floorY - 25 + r * 8, 62, 1.4, '#7a5535'); for (let k = 0; k < 7; k++) { R(c, x + 6 + k * 8.6, floorY - 28.5 + r * 8, 6.5, 2.4, cols[(k + r) % 6]); R(c, x + 6 + k * 8.6, floorY - 27 + r * 8, 4, 2, '#222'); } }
    R(c, x + 74, floorY - 8, 20, 4, '#8a6a47'); R(c, x + 76, floorY - 4, 1.4, 4, '#555'); R(c, x + 90, floorY - 4, 1.4, 4, '#555'); for (let k = 0; k < 3; k++) R(c, x + 76 + k * 6, floorY - 13 - k % 2 * 2, 5, 5, ['#d9a54a', '#fff', '#c0392b'][k]);
  } else if (v === 2) {   // tecnologia: parede de TVs com imagem, notebooks e vitrine de celulares
    for (let i = 0; i < 3; i++) { const tx = x + 4 + i * 22, hue = (tm * 25 + i * 90) % 360; R(c, tx, floorY - 27, 20, 13, '#0b0e14'); const g = c.createLinearGradient(tx, 0, tx + 20, 0); g.addColorStop(0, `hsl(${hue},70%,45%)`); g.addColorStop(1, `hsl(${(hue + 80) % 360},70%,35%)`); c.fillStyle = g; c.fillRect(tx + 1, floorY - 26, 18, 11); c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(tx + 1 + ((tm * 8 + i * 5) % 14), floorY - 26, 4, 11); R(c, tx + 8, floorY - 14, 4, 2, '#444'); }
    R(c, x + 70, floorY - 9, 24, 2.4, '#6a737c'); for (let i = 0; i < 2; i++) { R(c, x + 72 + i * 11, floorY - 15, 9, 6, '#1a1f2a'); R(c, x + 73 + i * 11, floorY - 14, 7, 4, '#6fc3ee'); R(c, x + 71 + i * 11, floorY - 9.5, 11, 1.4, '#9aa'); }
    R(c, x + 4, floorY - 8, 60, 6, '#2a323a'); R(c, x + 4, floorY - 9, 60, 1.4, '#8fd0f5'); for (let i = 0; i < 6; i++) R(c, x + 8 + i * 9.4, floorY - 7, 3.4, 5, ['#333', '#c9ccd0', '#2e6fb5'][i % 3]);
  } else if (v === 3) {   // presentes: caixas com laço, balões e ursinho
    for (let i = 0; i < 4; i++) { const bx = x + 6 + i * 14, hh = 8 + (i % 2) * 5; R(c, bx, floorY - hh, 12, hh, cols[(i * 2) % 6]); R(c, bx + 5, floorY - hh, 2, hh, '#f2c230'); R(c, bx, floorY - hh * .6, 12, 1.6, '#f2c230'); c.fillStyle = '#f2c230'; c.beginPath(); c.arc(bx + 4, floorY - hh - 1.4, 1.8, 0, 7); c.arc(bx + 8, floorY - hh - 1.4, 1.8, 0, 7); c.fill(); }
    for (let i = 0; i < 5; i++) { const bob = Math.sin(tm * 1.6 + i) * 1.4; R(c, x + 66 + i * 6, floorY - 26 + 11 + bob, .6, 12, '#bbb'); c.fillStyle = cols[(i + 2) % 6]; c.beginPath(); c.ellipse(x + 66 + i * 6, floorY - 28 + bob, 3, 3.8, 0, 0, 7); c.fill(); }
    c.fillStyle = '#c98a5a'; c.beginPath(); c.arc(x + 86, floorY - 15, 4.4, 0, 7); c.arc(x + 83, floorY - 19, 2, 0, 7); c.arc(x + 89, floorY - 19, 2, 0, 7); c.arc(x + 86, floorY - 8, 5, 0, 7); c.fill(); c.fillStyle = '#222'; c.fillRect(x + 84.4, floorY - 16, 1, 1); c.fillRect(x + 87, floorY - 16, 1, 1);
  } else if (v === 4) {   // games: fliperama piscando, prateleira de consoles e telão
    for (let i = 0; i < 2; i++) { const ax = x + 6 + i * 20; R(c, ax, floorY - 28, 16, 28, ['#2e6fb5', '#8f2a8a'][i]); R(c, ax + 2, floorY - 25, 12, 10, '#0b0e14'); c.fillStyle = `hsl(${(tm * 90 + i * 120) % 360},80%,55%)`; c.fillRect(ax + 3, floorY - 24, 10, 8); R(c, ax + 3 + ((tm * 6 + i * 3) % 8), floorY - 22, 2, 2, '#fff'); R(c, ax + 3, floorY - 12, 4, 4, '#d2323d'); R(c, ax + 9, floorY - 12, 4, 4, '#f2c230'); }
    for (let r = 0; r < 2; r++) { R(c, x + 50, floorY - 22 + r * 10, 28, 1.4, '#6a4a2e'); for (let k = 0; k < 4; k++) R(c, x + 52 + k * 6.4, floorY - 28 + r * 10 + 3, 5, 6, cols[(k + r * 2) % 6]); }
    R(c, x + 82, floorY - 26, 14, 24, '#1a1f2a'); R(c, x + 83, floorY - 25, 12, 22, `hsl(${(tm * 60) % 360},60%,35%)`);
  } else {   // relógios: parede de relógios com ponteiros e vitrines
    for (let i = 0; i < 4; i++) { const cx = x + 12 + i * 22, cy = floorY - 20; c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, cy, 7.5, 0, 7); c.fill(); c.strokeStyle = ['#7a5535', '#222', '#c9a23a', '#7a5535'][i]; c.lineWidth = 1.6; c.stroke();
      c.strokeStyle = '#222'; c.lineWidth = 1; const a = tm * (.4 + i * .1); c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * 5.4, cy + Math.sin(a) * 5.4); c.stroke(); c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a / 12) * 3.6, cy + Math.sin(a / 12) * 3.6); c.stroke(); }
    R(c, x + 4, floorY - 9, 88, 7, '#5a3a22'); R(c, x + 5, floorY - 9, 86, 1.6, 'rgba(190,225,240,.55)'); for (let i = 0; i < 8; i++) { R(c, x + 8 + i * 10.4, floorY - 7, 5, 2.4, '#c9a23a'); R(c, x + 9.4 + i * 10.4, floorY - 6.6, 2.4, 1.6, '#fff'); }
  }
  c.restore();
  shopFront(o, c, x, y, w, ['BOUTIQUE', 'SAPATOS', 'TECNOLOGIA', 'PRESENTES', 'GAMES', 'RELÓGIOS'][v], ['#8a4aa0', '#8a5a2e', '#2a5fa8', '#c0446a', '#d98a1c', '#4a3a6a'][v]);
}
function paintTunnelPortal(c, f, x, y, w, h, o) {
  // boca de túnel de veículos com a própria saída para a rua: concreto, listras de segurança, luz do dia na ponta e carros que entram e saem (2 níveis = duas pistas, uma em cada andar)
  const tm = o.time || 0, decks = Math.max(1, Math.round(h / FH)), dh = h / decks, night = o.night, rev = f.dir === -1;   // rev: a saída para a rua fica na ponta esquerda
  R(c, x, y, w, h, '#0f1217');
  for (let d = 0; d < decks; d++) {
    const dy = y + d * dh, fy = dy + dh - SLAB, topDeck = d === 0 && decks > 1;
    const g = c.createLinearGradient(0, dy, 0, fy); g.addColorStop(0, '#12151b'); g.addColorStop(1, '#232830'); c.fillStyle = g; c.fillRect(x, dy, w, dh - SLAB);
    R(c, x, dy, w, 5, '#2c323c'); R(c, x, dy + 4, w, 1, '#0c0e12');
    if (o.lod) {
      for (let i = 0; i < w; i += 32) R(c, x + i, dy + 5, 1, dh - SLAB - 6, 'rgba(255,255,255,.05)');
      { const nl = Math.max(1, Math.round((w - 24) / 32)); for (let k = 0; k < nl; k++) { const lx = x + (k + .5) * (w - 24) / nl; R(c, lx - 6, dy + 6, 12, 2, '#fff6cf'); c.fillStyle = 'rgba(255,246,207,.12)'; c.beginPath(); c.moveTo(lx - 6, dy + 8); c.lineTo(lx + 6, dy + 8); c.lineTo(lx + 16, dy + 22); c.lineTo(lx - 16, dy + 22); c.fill(); } }   // lâmpadas centradas no trecho de túnel
      R(c, x, fy - 0, w, SLAB, '#4a4f5a'); R(c, x, fy - 5, w, 5, '#3a3f48'); R(c, x, fy - 5, w, 1.4, '#6a707c');
      c.fillStyle = '#e8c648'; for (let k = 0; k < Math.round((w - 24) / 16); k++) c.fillRect(x + (k + .5) * 16 - 3, fy - 2.6, 6, 1);
      // portal na ponta da saída (direita, ou esquerda se f.dir = -1): moldura de concreto com listras e abertura para a rua iluminada
      const px = rev ? x + 2 : x + w - 22; R(c, px - 2, dy + 2, 24, dh - SLAB - 2, '#59606c'); c.fillStyle = night ? '#1d2b45' : '#8cc6e6'; c.beginPath(); c.rect(px + 2, dy + 8, 16, dh - SLAB - 8); c.arc(px + 10, dy + 8, 8, Math.PI, 0); c.fill();
      for (let k = 0; k < 7; k++) R(c, rev ? px + 19 : px - 2, dy + 4 + k * ((dh - SLAB - 6) / 7), 3, (dh - SLAB - 6) / 14, k % 2 ? '#e8c648' : '#222');
      if (!night) { c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(px + 4, dy + 12, 4, 6); }
      // carros indo e vindo (pistas por andar)
      tunnelTraffic(c, f.L + (decks - 1 - d), x, w, fy, tm, dy, dh);   // o mesmo fluxo dos túneis: o carro que sai do portal segue pelos túneis
      if (!topDeck || decks === 1) sign(c, rev ? x + w - 36 : x + 4, dy + 16, 'ACESSO', '#fff', '#3a4252');
    }
    if (decks > 1 && d === 0) R(c, x, dy + dh - SLAB, w, SLAB, '#4a4f5a');
  }
}
function paintHeliporto(c, f, x, y, w, h, o) {
  // heliponto no topo da torre: laje de concreto com o H, luzes de borda piscando, guarda-corpo, biruta ao vento e um helicóptero estacionado com o rotor girando devagar
  const tm = o.time || 0, floorY = y + h - SLAB, night = o.night, cx = x + w / 2;
  R(c, x, floorY - 8, w, 8 + SLAB, '#6b717c'); R(c, x, floorY - 8, w, 2, '#aab2bf'); R(c, x, floorY - 1, w, 1.4, '#4a4f58');
  if (!o.lod) return;
  c.fillStyle = '#3f4651'; c.beginPath(); c.ellipse(cx, floorY - 5, w * .34, 3.4, 0, 0, 7); c.fill(); c.strokeStyle = '#e8c648'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(cx, floorY - 5, w * .34 - 2, 2.6, 0, 0, 7); c.stroke();
  c.fillStyle = '#f2f5fa'; c.font = 'bold 8px system-ui'; c.textAlign = 'center'; c.fillText('H', cx, floorY - 2.4);
  for (let i = 0; i < 9; i++) { const lx = x + 4 + i * (w - 8) / 8, on = Math.sin(tm * 5 - i * .7) > 0; R(c, lx - 1, floorY - 10.5, 2, 2.4, on ? (night ? '#ffd36b' : '#f2c230') : '#7a6a30'); if (on && night) { c.fillStyle = 'rgba(255,211,107,.25)'; c.beginPath(); c.arc(lx, floorY - 9.5, 4, 0, 7); c.fill(); } }   // luzes de pouso em sequência
  R(c, x + 1, floorY - 17, 1.2, 9, '#9aa3b2'); R(c, x + w - 3, floorY - 17, 1.2, 9, '#9aa3b2'); R(c, x + 1, floorY - 17, w - 3, 1, '#9aa3b2');   // guarda-corpo
  const sx = x + w - 12; R(c, sx, floorY - 26, 1.4, 18, '#666'); const wind = Math.sin(tm * 2.4) * 1.6; c.fillStyle = '#e5522d'; c.beginPath(); c.moveTo(sx + 1.4, floorY - 26); c.lineTo(sx + 11 + wind, floorY - 24 + wind * .3); c.lineTo(sx + 10 + wind, floorY - 20 + wind * .3); c.lineTo(sx + 1.4, floorY - 21); c.fill(); c.fillStyle = '#fff'; c.fillRect(sx + 5, floorY - 25, 2, 4);   // biruta
  if (o.heliAway) return;   // o helicóptero do VIP está pousado/voando: o estacionado sai de cena
  const hx = cx - 4, hy = floorY - 9;   // helicóptero estacionado
  R(c, hx - 10, hy - 8, 20, 9, '#c0392b'); R(c, hx - 6, hy - 11, 10, 4, '#c0392b'); R(c, hx + 2, hy - 9, 6, 5, '#bfe3f5'); R(c, hx - 22, hy - 6, 13, 2, '#992d22'); R(c, hx - 23, hy - 10, 2, 6, '#992d22'); R(c, hx - 9, hy + 1, 18, 1.2, '#555');
  const rl = 15 * Math.abs(Math.cos(tm * 3)); R(c, hx - rl, hy - 13, rl * 2, 1.2, '#222'); R(c, hx - 1, hy - 13, 2, 3, '#444');
}
const VARIANTS = {housekeeping: paintCamareiras, shop: paintShop2, tunnelPortal: paintTunnelPortal, tunnelPortal2: paintTunnelPortal, heliport: paintHeliporto, fastfood: paintFast2, cafe: paintCafe2, mercado: paintMercado2, lavanderia: paintLavanderia2, banco: paintBanco2, jardim: paintJardim2, academia: paintAcademia2, creche: paintCreche2, transit: paintMetro, piscina: paintPiscina, auditorio: paintAuditorio, party: paintParty, clinic: paintClinica, security: paintSeguranca, recycling: paintReciclagem, landmark: paintCapela, lixo: paintLixo, bateria: paintBateria, bateriaPequena: paintBateriaPequena, bateriaGrande: paintBateriaGrande, geradorGas: paintGeradorGas, bomba: paintBomba, bombaMedia: paintBombaMedia, bombaRecalque: paintBombaRecalque, bombaForte: paintBombaForte, gerador: paintGerador, solar: paintSolar, caixa: paintCaixa, caixaMedia: paintCaixaMedia, caixaGrande: paintCaixaGrande, caixaTorre: paintCaixaTorre, tratamento: paintTratamento, busstop: paintBusstop, taxi: paintTaxi, bike: paintBike, coworking: paintOffice, office: paintOffice, officeEx: paintOffice, kitnet: paintHome, condo: paintHome, penthouse: paintHome, single: paintHotel, twin: paintHotel, suite: paintHotel, restaurant: paintResto, bar: paintBar};
