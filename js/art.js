'use strict';
// Arranha-Céu — arte procedural. Tudo é desenhado em "pixels de mundo": 1 unidade = 8 px, 1 andar = 36 px.

const STRESS_COL = ['#26313f', '#f2a541', '#e5484d'];
const SHIRTS = ['#4f7fbf', '#6aa56a', '#b0658a', '#8a74c0', '#c9894a', '#4aa0a0', '#9a9a52', '#7c8794'];
const SKIN = ['#f2cfa8', '#d9a67a', '#a8714c', '#7a4b2f'];

function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; }
function R(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}

// ------------------------------------------------------------ céu
function skyColors(min) {
  const h = (min / 60) % 24;
  const keys = [
    [0, '#070b1c', '#101a3a'], [4.5, '#0b1330', '#1c2a55'], [6, '#34416f', '#f09a6a'], [7.5, '#5ea2dd', '#bfe3f6'],
    [12, '#4f9be0', '#c4e6f8'], [16.5, '#5a9ede', '#cfe6f2'], [18.3, '#4a5f9e', '#f2a25f'], [19.5, '#1d2a55', '#6a4f78'], [21, '#0b1330', '#1c2a55'], [24, '#070b1c', '#101a3a'],
  ];
  let i = 0;
  while (i < keys.length - 2 && h >= keys[i + 1][0]) i++;
  const a = keys[i], b = keys[i + 1], t = clamp((h - a[0]) / (b[0] - a[0]), 0, 1);
  return [mixHex(a[1], b[1], t), mixHex(a[2], b[2], t), h];
}
const isNight = min => { const h = (min / 60) % 24; return h < 6.3 || h > 19.3; };
const daylight = min => { const h = (min / 60) % 24; return clamp(Math.sin((h - 6) * Math.PI / 12) * 2.2, 0, 1); };

// véu de cor sobre a cena: entardecer alaranjado, noite azul que aprofunda na madrugada e amanhecer rosado
function skyTint(min) {
  const h = (min / 60) % 24;
  if (h >= 17.5 && h < 19.3) return [255, 120, 60, .13 * (h - 17.5) / 1.8];
  if (h >= 19.3 && h < 22) return [14, 14, 40, .18 + .04 * (h - 19.3) / 2.7];
  if (h >= 22 || h < 4) return [5, 8, 22, .22];
  if (h < 6.3) return [10, 14, 38, .22 - .06 * (h - 4) / 2.3];
  if (h < 7.5) return [255, 150, 110, .12 * (7.5 - h) / 1.2];
  return null;
}

// ------------------------------------------------------------ borda da grama
// tufos, arbustos, árvores, flores e postes de luz sobre a faixa de grama (y de -14 a -5; a rua ocupa -5 a 0), por hash da posição:
// o que é verde segue a estação (flores na primavera, folhas alaranjadas no outono, galhos nus e neve no inverno).
const VERGE_PAL = [   // [folha escura, média, clara, tronco]
  ['#2f6a30', '#3f7f3a', '#5aa650', '#6b4a2b'], ['#256a2c', '#2f7a35', '#4aa14c', '#6b4a2b'],
  ['#8a5a22', '#b9832f', '#d9a441', '#5e4126'], ['#244a30', '#2d5a3a', '#3b6b48', '#4e3a28']];
function paintVerge(c, vx0, vx1, season, night, lod, tm) {
  const pal = VERGE_PAL[season], winter = season === 3, CW = 26, yb = -5;
  const K = col => night && col[0] === '#' ? '#' + [1, 3, 5].map(k => Math.round(parseInt(col.slice(k, k + 2), 16) * (k === 5 ? .62 : .42)).toString(16).padStart(2, '0')).join('') : col;   // à noite a vegetação escurece e puxa para o azul
  const cx0 = Math.floor((vx0 - 20) / CW), cx1 = Math.floor((vx1 + 20) / CW);
  if (lod) {   // tufos de grama na borda de cima
    c.fillStyle = K(winter ? '#cfdbe4' : pal[2]);
    for (let x = Math.floor((vx0 - 10) / 5) * 5; x < vx1 + 10; x += 5) { const hh = 1 + hash(x * 3 + 11) * 3.2; if (hash(x + 5) < .7) c.fillRect(x, -14 - hh, 1, hh + 1); }
    if (winter) { c.fillStyle = K('#f4f8fb'); for (let x = Math.floor((vx0 - 10) / 18) * 18; x < vx1 + 10; x += 18) { const r = 3 + hash(x + 2) * 4; c.beginPath(); c.arc(x + 6, -13, r, Math.PI, 0); c.fill(); } }
  }
  for (let cx = cx0; cx <= cx1; cx++) {
    const h = hash(cx * 131 + 7), px = cx * CW + 4 + hash(cx * 17 + 3) * (CW - 8), sway = Math.sin(tm * 1.2 + cx * .7) * .8;
    if (h < .30) {   // arbusto: 3 bolas de folha com sombra embaixo
      const r = 3.5 + hash(cx + 55) * 3;
      c.fillStyle = K('rgba(0,0,0,.22)'); c.fillRect(px - r * 1.5, yb - 1, r * 3, 2);
      for (let i = 0; i < 3; i++) { const bx = px + (i - 1) * r * .9 + (i === 1 ? sway * .4 : 0), by = yb - r * (i === 1 ? 1.35 : .8); c.fillStyle = K(pal[i === 1 ? 1 : 0]); c.beginPath(); c.arc(bx, by, r, 0, 7); c.fill(); }
      if (lod) {
        c.fillStyle = K(pal[2]); c.beginPath(); c.arc(px - r * .3, yb - r * 1.7, r * .55, 0, 7); c.fill();
        if (winter) { c.fillStyle = K('#f4f8fb'); c.beginPath(); c.arc(px, yb - r * 2.2, r * .8, Math.PI, 0); c.fill(); }
        else if (season <= 1 && hash(cx + 77) < (season === 0 ? .8 : .35)) { const fl = ['#ff9ec4', '#fff3a0', '#ffffff', '#ff7a7a'][Math.floor(hash(cx + 9) * 4)]; c.fillStyle = K(fl); for (let i = 0; i < 4; i++) c.fillRect(px - r + hash(cx * 5 + i) * r * 2, yb - r * (.6 + hash(cx * 7 + i) * 1.6), 1.6, 1.6); }
      }
    } else if (h < .37) {   // árvore: tronco e copa de três bolas (no inverno, só galhos)
      const ht = 14 + hash(cx + 21) * 10, r = 7 + hash(cx + 33) * 4, ty = yb - ht;
      c.fillStyle = K('rgba(0,0,0,.2)'); c.fillRect(px - 7, yb - 1, 14, 2);
      c.fillStyle = K(pal[3]); c.fillRect(px - 1.5, ty, 3, ht + 1);
      if (winter) {
        c.strokeStyle = K(pal[3]); c.lineWidth = 1.2; c.beginPath();
        for (const d of [-1, 0, 1]) { c.moveTo(px, ty + 4); c.lineTo(px + d * r * .9, ty - r * .7); } c.stroke();
        c.fillStyle = K('#f4f8fb'); for (const d of [-1, 1]) c.fillRect(px + d * r * .9 - 2, ty - r * .7 - 1, 4, 1.4);
      } else {
        c.fillStyle = K(pal[0]); c.beginPath(); c.arc(px + sway - r * .6, ty - r * .2, r * .85, 0, 7); c.arc(px + sway + r * .6, ty - r * .2, r * .85, 0, 7); c.fill();
        c.fillStyle = K(pal[1]); c.beginPath(); c.arc(px + sway, ty - r * .7, r, 0, 7); c.fill();
        if (lod) { c.fillStyle = K(pal[2]); c.beginPath(); c.arc(px + sway - r * .3, ty - r * 1.05, r * .45, 0, 7); c.fill(); if (season === 2) { c.fillStyle = K(pal[1]); for (let i = 0; i < 3; i++) c.fillRect(px + sway + (hash(cx + i * 3) - .5) * r * 2, yb - 2 - ((tm * 6 + i * 4 + cx) % 14) * .4, 1.5, 1.5); } }
      }
    } else if (h < .46 && lod && !winter) {   // canteiro de flores rasteiras
      for (let i = 0; i < 5; i++) { c.fillStyle = K(['#ff9ec4', '#fff3a0', '#ffffff', '#c9a0ff', '#ff7a7a'][Math.floor(hash(cx * 11 + i) * 5)]); c.fillRect(px - 6 + i * 3 + hash(cx + i) * 2, yb - 2 - hash(cx * 3 + i) * 3, 1.8, 1.8); }
    } else if (h < .50 && lod) {   // pedra de jardim
      c.fillStyle = K(winter ? '#e4ecf0' : '#8f8b84'); c.beginPath(); c.arc(px, yb - 1, 2.6, Math.PI, 0); c.fill(); c.fillRect(px - 2.6, yb - 1, 5.2, 1);
    }
  }
  // postes de luz em células livres, espaçados; acesos à noite
  for (let cx = cx0; cx <= cx1; cx++) {
    if (hash(cx * 131 + 7) < .5 || hash(cx * 53 + 1) > .09) continue;
    const lx = cx * CW + 12;
    c.fillStyle = '#2e3138'; c.fillRect(lx, yb - 24, 1.6, 24); c.fillRect(lx - 4, yb - 25, 6, 1.6); c.fillRect(lx - 1, yb - 2, 4, 2);
    if (night) { c.fillStyle = 'rgba(255,236,160,.16)'; c.beginPath(); c.moveTo(lx - 4, yb - 23); c.lineTo(lx + 2, yb - 23); c.lineTo(lx + 14, yb); c.lineTo(lx - 16, yb); c.fill(); c.fillStyle = '#fff1b0'; c.fillRect(lx - 4, yb - 24, 4, 2); }
    else { c.fillStyle = '#d8d2b8'; c.fillRect(lx - 4, yb - 24, 4, 2); }
  }
}

// ------------------------------------------------------------ terra do subsolo
// camadas de verdade: húmus, argila, areia e rocha, com veios ondulados, pedras, raízes, minhocas, fósseis e cristais no fundo.
// Tudo sai de hash da posição (nada sorteado), e os detalhes só entram com zoom de perto (lod) e dentro da tela.
const SOIL_LAYERS = [[0, '#6b5541'], [3, '#5f4833'], [7, '#7a5236'], [13, '#6d4a33'], [19, '#74644a'], [26, '#625a4c'], [34, '#4f5158'], [50, '#3a3c43'], [80, '#2a2c33']];
function paintSoil(c, vx0, vx1, vy0, vy1, bottom, night, lod, tm) {
  const w = vx1 - vx0 + 20, last = SOIL_LAYERS[SOIL_LAYERS.length - 1][0] * FH;
  const sg = c.createLinearGradient(0, 0, 0, last);
  for (const [d, col] of SOIL_LAYERS) sg.addColorStop(d * FH / last, col);
  c.fillStyle = sg; c.fillRect(vx0 - 10, 0, w, bottom);
  if (night) { c.fillStyle = 'rgba(8,6,10,.55)'; c.fillRect(vx0 - 10, 0, w, bottom); }
  // veios: fitas onduladas entre as camadas, mais claras em cima e mais escuras embaixo
  const yA = Math.max(0, vy0 - 20), yB = Math.min(bottom, vy1 + 20), step = 24;
  for (let k = Math.max(0, Math.floor(yA / (5 * FH)) - 1); k * 5 * FH <= yB; k++) {
    const base = (k + 1) * 5 * FH + (hash(k * 7 + 3) - .5) * FH, amp = 2 + hash(k + 40) * 4, ph = hash(k + 90) * 6.28;
    for (const [dy, col] of [[0, 'rgba(255,235,200,.07)'], [3, 'rgba(0,0,0,.12)']]) {
      c.fillStyle = col;
      for (let x = Math.floor((vx0 - 10) / step) * step; x < vx1 + 10; x += step) c.fillRect(x, base + dy + Math.sin(x * .021 + ph) * amp, step + 1, 2);
    }
  }
  if (!lod) return;
  // detalhes por célula de 40 x 36 px
  const CW = 40, CH = 36, cx0 = Math.floor((vx0 - 10) / CW), cx1 = Math.floor((vx1 + 10) / CW), cy0 = Math.max(0, Math.floor(yA / CH)), cy1 = Math.floor(yB / CH);
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    const s = cx * 73 + cy * 1301, h = hash(s), px = cx * CW + hash(s + 1) * (CW - 12) + 4, py = cy * CH + hash(s + 2) * (CH - 10) + 4, depth = cy;
    if (h < .22) {   // pedra: polígono torto com um brilho no canto
      const r = 2 + hash(s + 3) * (depth > 25 ? 7 : 5), rock = depth > 20;
      c.fillStyle = rock ? '#7d8088' : '#8a7660';
      c.beginPath(); c.moveTo(px - r, py + r * .5); c.lineTo(px - r * .5, py - r * .6); c.lineTo(px + r * .6, py - r * .7); c.lineTo(px + r, py + r * .2); c.lineTo(px + r * .3, py + r * .7); c.fill();
      c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(px - r * .4, py - r * .5, r * .6, 1.2);
      c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(px - r * .6, py + r * .55, r * 1.4, 1.2);
    } else if (h < .36) {   // cascalho
      for (let i = 0; i < 4; i++) { c.fillStyle = hash(s + i * 5) < .5 ? 'rgba(210,190,160,.35)' : 'rgba(0,0,0,.25)'; c.fillRect(px + i * 3 + hash(s + i) * 3, py + hash(s + i + 9) * 4, 1.6, 1.6); }
    } else if (h < .44) {   // raiz fina que desce da grama
      if (depth >= 6) continue;
      c.strokeStyle = 'rgba(190,160,110,.45)'; c.lineWidth = 1; c.beginPath(); c.moveTo(px, cy * CH);
      for (let i = 1; i <= 4; i++) c.lineTo(px + Math.sin(s + i) * 4, cy * CH + i * 7);
      c.stroke();
    } else if (h < .48) {   // minhoca
      if (depth >= 5) continue;
      c.strokeStyle = 'rgba(214,150,140,.7)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(px, py);
      for (let i = 1; i <= 5; i++) c.lineTo(px + i * 2, py + Math.sin(i * 1.6 + s + tm * 2.2) * 1.8);
      c.stroke();
    } else if (h < .49) {   // osso velho (raro)
      if (depth < 8 || depth >= 30) continue;
      c.fillStyle = 'rgba(232,224,196,.75)'; c.fillRect(px, py, 9, 1.8); c.beginPath(); c.arc(px, py + .9, 1.9, 0, 7); c.arc(px + 9, py + .9, 1.9, 0, 7); c.fill();
    } else if (h < .52) {   // cristal que brilha devagar
      if (depth < 24) continue;
      const tw = .55 + .45 * Math.sin(tm * 1.6 + s), col = hash(s + 6) < .5 ? '120,220,255' : '170,255,190';
      c.fillStyle = `rgba(${col},${(.35 + .4 * tw).toFixed(2)})`;
      c.beginPath(); c.moveTo(px, py + 5); c.lineTo(px + 2, py); c.lineTo(px + 4, py + 5); c.fill();
      c.fillStyle = `rgba(${col},${(.1 * tw).toFixed(2)})`; c.beginPath(); c.arc(px + 2, py + 3, 7, 0, 7); c.fill();
    }
  }
}

// ------------------------------------------------------------ janelas e paredes
// cada unidade tem a sua luz: incandescente, âmbar, LED frio ou fluorescente (escritório puxa para o frio); paintFacility preenche LIGHT antes de pintar
const LIGHT_TONES = ['#ffe39a', '#ffd27a', '#f2f6ff', '#e3f3d3'];
const LIGHT = {tone: 0, tv: false, t: 0};
const lightTone = (f, d) => { const h = hash(f.id * 29 + 5); return d.office ? (h < .6 ? 2 : h < .85 ? 3 : 0) : (h < .55 ? 0 : h < .9 ? 1 : 3); };
// luz da janela i: acesa em parte das janelas de uma sala ocupada (a primeira sempre), a TV pisca azul na sala às escuras
function windowLight(i, x, lit) {
  if (LIGHT.tv) return i === 0 ? (Math.sin(LIGHT.t * 7 + x) > -.3 ? '#7fa8ff' : '#4a68b0') : '#18202e';
  if (!(lit > 0)) return '#18202e';
  return i === 0 || hash(Math.floor(x) * 7 + i * 13 + LIGHT.tone) < .55 + .15 * Math.min(lit, 3) ? LIGHT_TONES[LIGHT.tone] : '#262d3a';
}
function windows(c, x, y, w, h, night, lit, step = 14) {
  const n = Math.max(1, Math.floor(w / step));
  const gw = w / n;
  for (let i = 0; i < n; i++) {
    const wx = x + i * gw + 3, ww = gw - 6;
    R(c, wx, y, ww, h, night ? windowLight(i, wx, lit) : '#a9d4ee');
    if (!night) R(c, wx, y, ww, 2, 'rgba(255,255,255,.45)');
    R(c, wx + ww / 2 - .5, y, 1, h, 'rgba(40,50,60,.5)');
  }
}

// ------------------------------------------------------------ obra
function paintScaffold(c, x, y, w, h, p, tm = 0, id = 0) {
  // obra: a estrutura de aço sobe conforme o andamento (colunas, vigas, contraventamento), com faíscas de solda onde o trabalho está e um guindaste girando
  R(c, x, y, w, h, '#2f3b4f'); c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 1;
  for (let i = 0; i <= w; i += 8) { c.beginPath(); c.moveTo(x + i, y); c.lineTo(x + i, y + h); c.stroke(); }
  const top = y + h - SLAB, sh = (h - SLAB - 3) * Math.min(1, p * 1.25), gy = top - sh;
  R(c, x, top, w, SLAB, '#6a6f78');
  const col = '#d9732b', dk = '#a8541c', cols = Math.max(2, Math.round(w / 24));
  for (let i = 0; i <= cols; i++) { const cx = x + 1 + i * (w - 3) / cols; R(c, cx, gy, 3, sh, col); R(c, cx + 2, gy, 1, sh, dk); }
  c.strokeStyle = col; c.lineWidth = 2;
  for (let k = 0; k <= 2; k++) { const by = top - (k + 1) * (h - SLAB - 3) / 3; if (by >= gy - 1) { c.beginPath(); c.moveTo(x + 1, by); c.lineTo(x + w - 2, by); c.stroke(); } }
  c.strokeStyle = dk; c.lineWidth = 1;
  for (let i = 0; i < cols; i++) { const x0 = x + 2 + i * (w - 3) / cols, x1 = x + 2 + (i + 1) * (w - 3) / cols; c.beginPath(); c.moveTo(x0, top); c.lineTo(x1, Math.max(gy, top - sh * .6)); c.stroke(); c.beginPath(); c.moveTo(x1, top); c.lineTo(x0, Math.max(gy, top - sh * .6)); c.stroke(); }
  if (p > .55) { c.fillStyle = 'rgba(150,170,190,.28)'; c.fillRect(x + 3, top - (h - SLAB - 3) * (p - .45), w - 6, (h - SLAB - 3) * (p - .45) * .8); }   // painéis de vedação
  if (p < 1 && sh > 4) { const sx = x + ((id * 13) % Math.max(1, Math.floor(w - 8))) + 4; if (Math.sin(tm * 18 + id) > -.2) { c.fillStyle = '#fff6b0'; c.beginPath(); c.arc(sx, gy, 1.6, 0, 7); c.fill(); c.fillStyle = 'rgba(255,200,60,.6)'; for (let k = 0; k < 3; k++) c.fillRect(sx + Math.sin(tm * 30 + k * 2) * 3, gy + 1 + k * 1.5, 1, 1); } }   // faíscas de solda
  if (w >= 48) {   // guindaste: torre, lança e gancho com carga balançando
    const tx = x + w - 18, ty = y + 3; R(c, tx, ty, 2.4, h - SLAB - 3, '#e0b628'); R(c, tx - 9, ty, 26, 2.2, '#e0b628'); R(c, tx + 14, ty + 2, 1, 4, '#888');
    const sw = Math.sin(tm * 1.3) * 2; R(c, tx - 6 + sw * .2, ty + 2, .8, 9, '#999'); R(c, tx - 8 + sw * .2, ty + 11, 5, 3, '#c0392b');
  }
  R(c, x + 2, y + h - 4, w - 4, 2, 'rgba(0,0,0,.4)'); R(c, x + 2, y + h - 4, (w - 4) * p, 2, '#6fe39b');
  if (w >= 40) { c.fillStyle = '#e8c648'; c.fillRect(x + 3, y + 4, 40, 9); for (let i = 0; i < 40; i += 8) { c.fillStyle = '#222'; c.fillRect(x + 3 + i, y + 4, 4, 9); } R(c, x + 4, y + 5, 38, 7, '#e8c648'); c.fillStyle = '#222'; c.font = 'bold 5.4px system-ui'; c.textAlign = 'left'; c.fillText('OBRA ' + Math.round(p * 100) + '%', x + 7, y + 10.8); }   // placa de obra
}

// ------------------------------------------------------------ salas
// f: instalação; (x,y,w,h) em px de mundo; opts: night, lit (nº de pessoas dentro), lod (detalhe), vacant, tint
function paintFacility(c, f, x, y, w, h, o) {
  const d = FAC[f.k];
  LIGHT.tone = f.id === undefined ? 0 : lightTone(f, d); LIGHT.t = o.time || 0;
  LIGHT.tv = !!(o.night && o.dark && f.id !== undefined && hash(f.id * 11 + 3) < .3);   // apagou a luz, mas a TV ficou ligada
  paintFacilityBody(c, f, x, y, w, h, o);
  // clima do ambiente à noite: quarto sem ninguém fica escuro, com gente ganha um tom quente ou frio da lâmpada
  if (o.night && o.lod && f.id !== undefined && f.build >= 1 && !o.vacant && (d.tenant || d.hotel) && !d.biz) {
    const hh = h - SLAB;
    if (LIGHT.tv) { R(c, x, y, w, hh, 'rgba(4,8,22,.28)'); R(c, x, y, w, hh, 'rgba(90,140,255,' + (.05 + .04 * Math.sin(LIGHT.t * 7 + f.id)).toFixed(2) + ')'); }
    else if (!(o.lit > 0)) R(c, x, y, w, hh, 'rgba(4,8,22,.34)');
    else R(c, x, y, w, hh, LIGHT.tone >= 2 ? 'rgba(210,230,255,.045)' : 'rgba(255,205,130,.06)');
  }
}
function paintFacilityBody(c, f, x, y, w, h, o) {
  const d = FAC[f.k], night = o.night, lit = o.lit > 0, vac = o.vacant, lod = o.lod;
  const base = d.col;
  const floorY = y + h - SLAB;
  if (f.build < 1) { paintScaffold(c, x, y, w, h, f.build, o.time || 0, f.id); return; }
  if (o.vacant && d.biz) { vacantRoom(c, f, x, y, w, h, o, 'ALUGA-SE', false); R(c, x, y, w, 10, '#7a7568'); c.fillStyle = '#e8e4d8'; c.font = 'bold 7px system-ui'; c.textAlign = 'left'; c.fillText(d.label.toUpperCase() + ' · VAGO', x + 4, y + 7.6); awning(c, x, y + 10, w, '#7a7568', '#c9c4b4', 6); return; }   // o comerciante se mudou
  const vp = VARIANTS[f.k];   // salas com vários modelos (art-salas.js)
  if (vp) vp(c, f, x, y, w, h, o);
  else switch (f.k) {
    case 'lobby': {
      const th = LOBBY_THEMES[o.theme || 0];
      R(c, x, y, w, h, th.wall);                       // parede
      R(c, x, y + h * .55, w, h * .45 - SLAB, th.wain);   // lambri
      R(c, x, y + h * .55, w, 1.5, th.rail);
      R(c, x, y, w, 3, 'rgba(0,0,0,.1)');
      if (th.trim) { R(c, x, y + 3, w, 1, th.trim); R(c, x, y + h * .55 + 1.5, w, .8, th.trim); }
      if (lod) {
        for (let i = 0; i < w; i += 4) R(c, x + i, floorY - 3, 2, 3, (i / 4) % 2 ? th.fa : th.fb);   // piso xadrez
        lobbyDeco(c, f, x, y, w, h, floorY, night, o.lit, o.edgeL, o.edgeR, o.theme || 0);
        if (f.L > 0 && o.edgeL) { R(c, x + 3, y + 2, 20, 9, 'rgba(20,20,20,.7)'); c.fillStyle = '#ffd24a'; c.font = 'bold 7px system-ui'; c.textAlign = 'left'; c.fillText(floorLabel(f.L), x + 6, y + 9.5); }
      }
      break;
    }
    case 'party': {
      R(c, x, y, w, h, '#6f4a85');
      if (lod) {
        for (let i = 0; i < 5; i++) { const lx = x + 14 + i * (w - 28) / 4; R(c, lx, y, 1, 8, '#caa'); R(c, lx - 4, y + 8, 9, 4, '#ffd98a'); R(c, lx - 2, y + 12, 5, 3, 'rgba(255,217,138,.5)'); }
        R(c, x + 4, floorY - 14, w * .22, 14, '#4a2f5c'); R(c, x + 4, floorY - 26, w * .22, 2, '#d4a');
        c.fillStyle = '#ffd24a'; c.font = 'bold 8px system-ui'; c.textAlign = 'center'; c.fillText('FESTA', x + w * .65, y + 14);
        for (let i = 0; i < 6; i++) { const tx = x + w * .35 + (i % 3) * 26, ty = floorY - 8 - (i > 2 ? 0 : 0); R(c, tx, ty, 14, 2, '#f1ead8'); R(c, tx + 6, ty + 2, 2, 6, '#caa'); }
        R(c, x, y + h / 2, w, 3, 'rgba(0,0,0,.3)');
      }
      break;
    }
    case 'cinema': {
      const half = h / 2, tm = o.time || 0;
      R(c, x, y, w, h, '#1b2038');
      if (lod) {
        // ---- sala (andar de cima): cortinas, tela, poltronas em fileiras
        const film = FILMS[f.film], playing = o.lit > 0, sx = x + w * .2, sw = w * .6, sy = y + 6, sh = half - 22;
        const wg = c.createLinearGradient(0, y, 0, y + half); wg.addColorStop(0, '#242a4a'); wg.addColorStop(1, '#161a30'); c.fillStyle = wg; c.fillRect(x, y, w, half);
        R(c, x, y, w * .13, half, '#8a1f2b'); R(c, x + w * .87, y, w * .13, half, '#8a1f2b');
        for (let i = 0; i < 4; i++) { R(c, x + 2 + i * w * .03, y, 1, half, 'rgba(0,0,0,.25)'); R(c, x + w * .88 + i * w * .03, y, 1, half, 'rgba(0,0,0,.25)'); }
        R(c, sx - 3, sy - 3, sw + 6, sh + 6, '#0d0f1c');
        if (playing) {   // cena que muda devagar de cor, com um brilho que passeia
          const hue = (f.film * 47 + tm * 7) % 360, g1 = c.createLinearGradient(sx, sy, sx + sw, sy + sh);
          g1.addColorStop(0, `hsl(${hue},62%,${film.kind === 'classic' ? 46 : 52}%)`); g1.addColorStop(1, `hsl(${(hue + 120) % 360},58%,30%)`);
          c.fillStyle = g1; c.fillRect(sx, sy, sw, sh);
          const gx = sx + ((tm * 18) % (sw + 30)) - 15; c.fillStyle = 'rgba(255,255,255,.14)'; c.beginPath(); c.moveTo(gx, sy); c.lineTo(gx + 14, sy); c.lineTo(gx + 4, sy + sh); c.lineTo(gx - 10, sy + sh); c.fill();
          if (film.kind === 'classic') { c.fillStyle = 'rgba(40,30,10,.28)'; c.fillRect(sx, sy, sw, sh); }
          c.fillStyle = 'rgba(255,255,255,.05)'; c.beginPath(); c.moveTo(x + w / 2 - 6, y + half - 2); c.lineTo(x + w / 2 + 6, y + half - 2); c.lineTo(sx + sw, sy + sh); c.lineTo(sx, sy + sh); c.fill();   // feixe do projetor
        } else { R(c, sx, sy, sw, sh, '#e9edf5'); c.fillStyle = '#6b7388'; c.font = 'bold 7px system-ui'; c.textAlign = 'center'; c.fillText(film.title.slice(0, 28), x + w / 2, sy + sh / 2 + 2); }
        const rows = 3, seatsN = Math.floor((w * .66) / 10);
        for (let r = 0; r < rows; r++) {
          const ry = y + half - 11 + r * 3.6, off = (rows - 1 - r) * 3;
          for (let i = 0; i < seatsN; i++) {
            const sxp = x + w * .17 + off + i * ((w * .66 - off * 2) / seatsN);
            R(c, sxp, ry, 6.4, 3.4, '#7e2230'); R(c, sxp, ry, 6.4, 1.1, '#a23545');
            if (i + r * seatsN < o.lit) { c.fillStyle = '#0c0d16'; c.beginPath(); c.arc(sxp + 3.2, ry - 1.2, 2, 0, 7); c.fill(); }
          }
        }
        R(c, x, y + half - 1.5, w, 2.5, '#0d0f1c');
        // ---- foyer (andar de baixo): paredes quentes, tapete, bilheteria, cartazes e pipoca
        const fy = y + half + 1;
        R(c, x, fy, w, half - 1 - SLAB, '#e9dcc0'); R(c, x, fy, w, 2, 'rgba(0,0,0,.12)');
        R(c, x, floorY - 5, w, 5, '#8a1f2b'); R(c, x, floorY - 5, w, 1, '#c24a58');   // tapete
        R(c, x + 6, floorY - 17, 38, 12, '#6b4a2e'); R(c, x + 6, floorY - 18, 38, 2, '#8a6440'); R(c, x + 12, floorY - 29, 26, 11, '#2a3a50'); R(c, x + 13, floorY - 28, 24, 9, '#bfe3f5');   // bilheteria com vidro
        R(c, x + 6, fy + 4, 38, 8, '#2a2f44'); c.fillStyle = '#ffd24a'; c.font = 'bold 6px system-ui'; c.textAlign = 'center'; c.fillText('INGRESSOS', x + 25, fy + 10.2);
        R(c, x + w * .32, fy + 3, w * .4, 9, '#2a2f44'); c.fillStyle = Math.sin(tm * 3) > -.6 ? '#ff7a9a' : '#a84a62'; c.font = 'bold 8px system-ui'; c.fillText('CINEMA', x + w * .52, fy + 10.5);   // letreiro
        const pc = ['#c44a4a', '#4a8f9c', '#d9a23a', '#7a5ab0', '#4aa06a'];
        for (let i = 0; i < 4; i++) { const px = x + w * .34 + i * w * .105; R(c, px, fy + 15, 17, 17, '#2a2f44'); R(c, px + 1.5, fy + 16.5, 14, 14, pc[(f.film + i) % 5]); R(c, px + 3, fy + 25, 11, 1.8, 'rgba(255,255,255,.7)'); R(c, px + 3, fy + 27.5, 8, 1.4, 'rgba(255,255,255,.5)'); }
        const qx = x + w - 52; R(c, qx, floorY - 15, 40, 10, '#b8452e'); R(c, qx, floorY - 17, 40, 2, '#f4e6c8'); R(c, qx + 4, floorY - 29, 14, 12, 'rgba(255,255,255,.55)');
        for (let i = 0; i < 6; i++) { c.fillStyle = '#fff3c4'; c.beginPath(); c.arc(qx + 6 + (i % 3) * 4, floorY - 21 - (i > 2 ? 3 : 0), 2, 0, 7); c.fill(); }   // pipoca
        R(c, qx - 2, fy + 3, 44, 5, '#f4f1ea'); for (let i = 0; i < 44; i += 8) R(c, qx - 2 + i, fy + 3, 4, 5, '#c0392b');   // toldo da pipoqueira
      }
      break;
    }
    case 'housekeeping': {
      R(c, x, y, w, h, base);
      if (lod) {
        R(c, x + 4, floorY - 18, w - 8, 18, 'rgba(255,255,255,.2)');
        for (let i = 0; i < 4; i++) { R(c, x + 8 + i * (w - 20) / 4, floorY - 16, 12, 6, '#fff'); R(c, x + 8 + i * (w - 20) / 4, floorY - 9, 12, 9, '#7ab'); }
        c.fillStyle = '#143'; c.font = 'bold 6px system-ui'; c.textAlign = 'left'; c.fillText('CAMAREIRAS', x + 4, y + 8);
      }
      break;
    }
    case 'security': {
      R(c, x, y, w, h, base);
      if (lod) {
        for (let i = 0; i < 4; i++) R(c, x + 6 + i * 16, y + 6, 13, 9, i % 2 ? '#2d4a2d' : '#102a40');
        R(c, x + 4, floorY - 8, w * .4, 3, '#222'); R(c, x + 6, floorY - 5, w * .4 - 4, 5, '#334');
        // emblema
        c.fillStyle = '#e8c648'; c.beginPath(); c.moveTo(x + w - 24, y + 8); c.lineTo(x + w - 14, y + 8); c.lineTo(x + w - 14, y + 18); c.lineTo(x + w - 19, y + 22); c.lineTo(x + w - 24, y + 18); c.fill();
      }
      break;
    }
    case 'clinic': {
      R(c, x, y, w, h, '#e4f0f1');
      if (lod) {
        R(c, x + 6, y + 6, 14, 14, '#fff'); R(c, x + 12, y + 8, 3, 10, '#d33'); R(c, x + 9, y + 11.5, 9, 3, '#d33');
        for (let i = 0; i < 3; i++) { const bx = x + 40 + i * 36; R(c, bx, floorY - 7, 22, 4, '#fff'); R(c, bx, floorY - 11, 5, 4, '#9cf'); R(c, bx + 2, floorY - 3, 2, 3, '#555'); R(c, bx + 18, floorY - 3, 2, 3, '#555'); }
      }
      break;
    }
    case 'recycling': {
      R(c, x, y, w, h, '#3f5f43');
      if (lod) {
        R(c, x + 8, y + 12, w - 16, 7, '#555'); for (let i = 0; i < w - 20; i += 8) R(c, x + 10 + i, y + 13, 4, 5, '#999');
        for (let i = 0; i < 4; i++) R(c, x + 10 + i * 16, y + h - SLAB - 18, 12, 18, ['#3a8', '#58c', '#cb4', '#c55'][i]);
        c.fillStyle = '#cfe'; c.font = 'bold 7px system-ui'; c.textAlign = 'left'; c.fillText('♻ RECICLAGEM', x + w - 70, y + h - 10);
      }
      break;
    }
    case 'parkspace': {
      // vaga numerada, com faixas no chão e batente de roda; o carro entra deslizando da pista (freios acesos), estaciona e, quando o dono sai, dá ré e parte soltando fumaça
      R(c, x, y, w, h, '#3d424d'); R(c, x, floorY - 3, w, 3, '#2f333c'); R(c, x, y, w, 3, '#2a2e36');
      if (lod) {
        const st = o.st === undefined ? 0 : o.st, T = 2.6, cx = x + w / 2;
        R(c, x + .5, floorY - 14, 1.2, 14, 'rgba(255,255,255,.55)'); R(c, x + w - 1.7, floorY - 14, 1.2, 14, 'rgba(255,255,255,.55)'); R(c, cx - 5, floorY - 1.4, 10, 1.4, '#9aa0ab');   // faixas e batente
        R(c, cx - 4, y + 5, 8, 6, '#2a5fa8'); c.fillStyle = '#fff'; c.font = 'bold 5px system-ui'; c.textAlign = 'center'; c.fillText('P', cx, y + 10);   // placa da vaga
        if (o.night || !o.lit) { c.fillStyle = 'rgba(255,240,190,.10)'; c.beginPath(); c.moveTo(cx - 3, y + 3); c.lineTo(cx + 3, y + 3); c.lineTo(cx + 12, floorY); c.lineTo(cx - 12, floorY); c.fill(); }
        const esperaCabine = f.carWait && st - f.carT < 90, segurado = !f.owner && f.holdCar && st - f.carT < 90;   // a cabine ainda não entregou / ainda não pegou o carro (com validade, para nunca ficar preso)
        const arriving = f.owner && !esperaCabine && f.carT !== undefined && st - f.carT >= 0 && st - f.carT < T, leaving = !f.owner && f.leaveT !== undefined && st - f.leaveT >= 0 && st - f.leaveT < T;
        if ((f.owner && !esperaCabine) || leaving || segurado) {
          const col = f.carCol !== undefined ? f.carCol : f.id % 6, ease = t => 1 - (1 - t) * (1 - t);
          let px = cx, braking = false, moving = false;
          if (arriving) { const p = (st - f.carT) / T; px = x - 16 + (cx - (x - 16)) * ease(p); braking = p > .72; moving = true; }
          else if (leaving) { const p = (st - f.leaveT) / T; px = cx + (x + w + 18 - cx) * p * p; braking = p < .15; moving = true; }
          c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
          paintParkedCar(c, px, floorY - 3, col, braking, moving && o.night, leaving ? -1 : 1);
          if (leaving) steam(c, px - 12, floorY - 4, st, 3, '170,170,170');
          c.restore();
        }
      }
      break;
    }
    case 'parkramp': case 'tunnelDown': {
      const rev = f.dir === -1, hx = rev ? x : x + w, lx = rev ? x + w : x;   // ponta alta (hx) e baixa (lx)
      R(c, x, y, w, h, f.k === 'tunnelDown' ? '#2b2e35' : '#40444e');
      c.fillStyle = f.k === 'tunnelDown' ? '#5c606a' : '#6a6f7c'; c.beginPath(); c.moveTo(lx, floorY); c.lineTo(hx, y + 4); c.lineTo(hx, floorY); c.fill();
      if (lod) {
        c.strokeStyle = '#e8c648'; c.lineWidth = 1; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(rev ? hx + 4 : lx + 4, rev ? y + 7 : floorY - 2); c.lineTo(rev ? lx - 4 : hx - 4, rev ? floorY - 2 : y + 7); c.stroke(); c.setLineDash([]);
        if (f.k === 'parkramp') { c.fillStyle = '#fff'; c.font = 'bold 7px system-ui'; c.textAlign = 'left'; c.fillText('GARAGEM', x + 4, y + 12); }
        else { c.fillStyle = '#e8c648'; c.beginPath(); const ax = x + w / 2, ay = y + 8; c.moveTo(ax + (rev ? -4 : 4), ay); c.lineTo(ax + (rev ? 2 : -2), ay - 3); c.lineTo(ax + (rev ? 2 : -2), ay + 3); c.fill(); }
      }
      break;
    }
    case 'transit': {
      R(c, x, y, w, h, '#2b4f61');
      if (lod) {
        R(c, x, y + h * .33, w, 3, '#9bd'); R(c, x + w * .1, y + h * .35, w * .8, 2, '#ccc');
        // plataforma e trilhos
        R(c, x, floorY - 20, w, 6, '#4b5563'); R(c, x, floorY - 14, w, 14, '#1c232b');
        R(c, x, floorY - 3, w, 1.4, '#9aa3b2'); R(c, x, floorY - 8, w, 1.4, '#9aa3b2');
        for (let i = 0; i < w; i += 8) R(c, x + i, floorY - 2, 3, 2, '#5a4632');
        R(c, x, floorY - 22, w, 2, '#e8c648');
        c.fillStyle = '#fff'; c.font = 'bold 9px system-ui'; c.textAlign = 'left'; c.fillText('METRÔ', x + 8, y + 14);
        R(c, x + w - 60, y + 6, 52, 12, '#111'); c.fillStyle = '#6fe39b'; c.font = '7px monospace';
        c.fillText(o.train && o.train.phase !== 'none' ? 'EMBARQUE' : 'AGUARDE', x + w - 57, y + 15);
        const tr = o.train;
        if (tr && tr.phase !== 'none') {
          const tl = Math.min(w - 20, 210), mid = x + (w - tl) / 2, ease = t => 1 - (1 - t) * (1 - t), dir = o.tdir === undefined ? 1 : o.tdir;
          let tx = mid;
          if (o.tclip) { c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); }   // cercada por outras salas: o trem sai da boca do túnel, na parede
          if (tr.phase === 'arrive') tx = dir > 0 ? x - tl + (mid - (x - tl)) * ease(tr.p) : x + w + (mid - (x + w)) * ease(tr.p);
          else if (tr.phase === 'leave') tx = dir > 0 ? mid + (x + w + 6 - mid) * tr.p * tr.p : mid + (x - tl - 6 - mid) * tr.p * tr.p;
          const ty = floorY - 26;
          R(c, tx, ty, tl, 22, '#cfd5df'); R(c, tx, ty + 14, tl, 3, '#d33'); R(c, tx, ty + 20, tl, 3, '#555');
          const nw = Math.floor(tl / 26);
          for (let i = 0; i < nw; i++) {
            const wx = tx + 4 + i * 26;
            R(c, wx, ty + 3, 18, 8, '#7fb4d8');
            if (tr.phase === 'open') R(c, wx + 20, ty + 2, 4, 18, '#1a2230'); else R(c, wx + 20, ty + 2, 4, 18, '#aab');
          }
          R(c, dir >= 0 ? tx + tl - 6 : tx, ty + 2, 6, 8, '#ffe9a0');
          if (o.tclip) c.restore();
        }
      }
      break;
    }
    case 'landmark': {
      R(c, x, y + h * .25, w, h * .75, '#d9c37a');
      c.fillStyle = '#e8d28a'; c.beginPath(); c.moveTo(x + w * .15, y + h * .25); c.lineTo(x + w * .5, y); c.lineTo(x + w * .85, y + h * .25); c.fill();
      R(c, x + w * .46, y - 14, 2, 14, '#caa'); R(c, x + w * .42, y - 10, 10, 2, '#caa');
      if (lod) { c.fillStyle = '#4a6f9f'; c.beginPath(); c.arc(x + w / 2, y + h * .5, 16, 0, 7); c.fill(); for (let i = 0; i < 5; i++) R(c, x + 12 + i * (w - 24) / 5, y + h - SLAB - 30, 8, 30, '#a6b9d8'); }
      break;
    }
    case 'corridor': case 'corridorExt': case 'corridorSpr': case 'corridorHyd': case 'corridorCam':
    case 'tunnel': case 'tunnelExt': case 'tunnelSpr': case 'tunnelHyd': case 'tunnelCam': {
      const tun = f.k.startsWith('tunnel'), kk = f.k.replace('tunnel', 'corridor');   // túnel de veículos: mesmas proteções do corredor
      if (tun) {   // túnel de concreto: anéis, lâmpadas no teto, pista com faixa tracejada e meio-fio, como o túnel do trem
        const g = c.createLinearGradient(0, y, 0, floorY); g.addColorStop(0, '#12151b'); g.addColorStop(1, '#232830'); c.fillStyle = g; c.fillRect(x, y, w, h);
        R(c, x, y, w, 5, '#2c323c'); R(c, x, y + 4, w, 1, '#0c0e12');
        for (let i = 0; i < w; i += 32) R(c, x + i, y + 5, 1, floorY - y - 9, 'rgba(255,255,255,.05)');   // anéis do túnel (nas emendas)
        if (lod) { const nl = Math.max(1, Math.round(w / 32)); for (let k = 0; k < nl; k++) { const lx = x + (k + .5) * w / nl; R(c, lx - 6, y + 6, 12, 2, '#fff6cf'); c.fillStyle = 'rgba(255,246,207,.12)'; c.beginPath(); c.moveTo(lx - 6, y + 8); c.lineTo(lx + 6, y + 8); c.lineTo(lx + 16, y + 22); c.lineTo(lx - 16, y + 22); c.fill(); } }   // lâmpadas no centro de cada quadrado, com o cone de luz
        R(c, x, floorY - 5, w, 5, '#3a3f48'); R(c, x, floorY - 5, w, 1.4, '#6a707c');
        if (lod) { c.fillStyle = '#e8c648'; for (let k = 0; k < Math.round(w / 16); k++) c.fillRect(x + (k + .5) * 16 - 3, floorY - 2.6, 6, 1); }   // faixa tracejada centrada
        if (lod && o.traffic) tunnelTraffic(c, f.L, x, w, floorY, o.time || 0, y, h);
      }
      else {   // o corredor acompanha o nível do saguão: 1★ concreto · 2★ bege · 3★ lambri · 4★ painéis e mármore · 5★ dourado com tapete
        const tr = o.theme || 0, cw = [['#9d9a90', '#7a776c'], ['#a39a80', '#6f684f'], ['#b9a49a', '#7d6a5e'], ['#c9c5a0', '#3a3d3a'], ['#e0cf8a', '#5a4a22']][tr];
        R(c, x, y, w, h, cw[0]); R(c, x, y, w, 3, 'rgba(255,255,255,.12)'); R(c, x, floorY - 4, w, 4, cw[1]);
        if (tr >= 2) R(c, x, y + h * .55, w, h * .45 - 4, ['', '', '#8a3a3e', '#2f5a46', '#8a6a1a'][tr]);   // lambri
        if (tr >= 2) R(c, x, y + h * .55, w, 1.2, ['', '', '#c9a23a', '#d4af37', '#ffd24a'][tr]);
        if (tr === 3) { for (let i = 0; i < w; i += 8) R(c, x + i, floorY - 4, 4, 4, '#eeeadf'); }   // piso de mármore xadrez
        if (tr === 4) { R(c, x, floorY - 4, w, 4, '#9b1c2e'); R(c, x, floorY - 4, w, .8, '#d4af37'); R(c, x, y + 3, w, 1.4, '#ffd24a'); }
        if (lod) {
          if (tr === 0) { R(c, x + w / 2 - .4, y, .8, 5, '#555'); c.fillStyle = '#fff3b0'; c.beginPath(); c.arc(x + w / 2, y + 6.5, 1.8, 0, 7); c.fill(); }   // lâmpada nua
          else if (tr === 1) R(c, x + w / 2 - 7, y + 1.5, 14, 2, '#eee');   // calha fluorescente
          else { const sx = x + w - 6; R(c, sx, y + 9, 3, 5, tr === 4 ? '#ffd24a' : '#c9a23a'); c.fillStyle = 'rgba(255,233,160,.55)'; c.beginPath(); c.arc(sx + 1.5, y + 8, tr === 4 ? 3 : 2.2, 0, 7); c.fill(); }   // arandela
          if (tr === 2) { R(c, x + 6, y + 10, 8, 6, '#6a4a2a'); R(c, x + 7, y + 11, 6, 4, '#d9b66a'); }   // quadrinho
          if (tr === 3) { R(c, x + 5, y + 8, 9, 7, '#6a4a2a'); R(c, x + 6.2, y + 9.2, 6.6, 4.6, '#7fb0c9'); R(c, x + 17, floorY - 12, 5, 8, '#8a6a47'); R(c, x + 18.5, floorY - 17, 2, 5, '#3f8a4a'); }   // quadro e vaso numa mesinha
          if (tr === 4) { R(c, x + 4, y + 8, 10, 12, '#d4af37'); R(c, x + 5.2, y + 9.2, 7.6, 9.6, '#cfe6f0'); R(c, x + 6, y + 10, 2, 8, 'rgba(255,255,255,.5)'); R(c, x + 17, floorY - 13, 5, 9, '#e8e3d4'); R(c, x + 18.2, floorY - 18, 2.6, 5, '#d4af37'); }   // espelho e pedestal
        }
      }
      if (lod) {
        R(c, x + 3, y + 8, w - 6, 1, 'rgba(0,0,0,.25)');
        if (kk === 'corridorExt') {
          const cx = x + w / 2;
          R(c, cx - 4, floorY - 17, 8, 13, '#d33'); R(c, cx - 4, floorY - 17, 8, 2, '#a11');
          R(c, cx - 2, floorY - 20, 4, 3, '#333'); R(c, cx + 4, floorY - 17, 3, 1, '#222'); R(c, cx + 6, floorY - 16, 1, 6, '#222');
          R(c, x + 2, y + 6, 5, 5, '#2e8b57'); R(c, x + 3, y + 7, 3, 3, '#cfe');
        } else if (kk === 'corridorCam') {
          R(c, x + 6, y + 5, w - 12, 5, '#2b3440'); R(c, x + w - 11, y + 6, 4, 3, '#7fe3e3'); R(c, x + w / 2 - 1, y + 10, 2, 6, '#2b3440');
          if (Math.sin((o.time || 0) * 3) > 0) R(c, x + 4, y + 4, 2, 2, '#ff3b3b');
        } else if (kk === 'corridorHyd') {   // abrigo de mangueira embutido na parede: porta vermelha com visor redondo "INCÊNDIO", venezianas, puxador, registro de latão e mangueira
          const bx = x + w / 2 - 8, by = floorY - 25;
          R(c, bx - 1.2, by - 1.2, 18.4, 22.4, '#8f1a1f'); R(c, bx, by, 16, 20, '#c4272d'); R(c, bx + 1.4, by + 1.4, 13.2, 17.2, '#d6343a');
          c.fillStyle = '#1a1214'; c.beginPath(); c.arc(bx + 8, by + 6.2, 3.6, 0, 7); c.fill(); R(c, bx + 4.6, by + 5.4, 6.8, 1.6, '#ff6a5a');   // visor com a palavra em vermelho
          for (let i = 0; i < 3; i++) R(c, bx + 3.4, by + 13 + i * 1.7, 9.2, .7, '#8f1a1f');   // venezianas
          R(c, bx + 13, by + 9, 1.2, 3.4, '#e8e8e8');   // puxador
          R(c, x + 3, y + 10, 4, 3, '#b8892e'); R(c, x + 4.4, y + 8, 1.2, 2.4, '#b8892e'); R(c, x + 3, y + 7.4, 4, 1.2, '#d33');   // registro de latão com volante vermelho
          c.strokeStyle = '#f4f1ea'; c.lineWidth = 1.2; c.beginPath(); c.arc(x + w - 5, floorY - 7, 3.2, 0, 7); c.stroke(); c.beginPath(); c.arc(x + w - 5, floorY - 7, 1.6, 0, 7); c.stroke();   // rolo de mangueira branca
          R(c, x + 2, y + 16, 5, 5, '#2e6fb5'); R(c, x + 3, y + 17, 3, 3, '#cfe');
        } else if (kk === 'corridorSpr') {
          R(c, x, y + 4, w, 2, '#7aa6c2');
          for (const hx of [x + w * .28, x + w * .72]) { R(c, hx - .5, y + 6, 1, 4, '#7aa6c2'); R(c, hx - 2, y + 10, 4, 2, '#5bb8ff'); }
        }
      }
      break;
    }
    case 'ruin': {
      R(c, x, y, w, h, '#241f1d'); R(c, x, y + h * .5, w, h * .5, '#3a302c');
      if (lod) { R(c, x + 1, y + 6, 2, h * .4, '#111'); }
      break;
    }
    default: R(c, x, y, w, h, base);
  }
  // laje
  R(c, x, floorY, w, SLAB, f.k === 'ruin' ? '#2b2b2b' : '#7b7f86'); R(c, x, floorY, w, 1, 'rgba(255,255,255,.25)');
  // borda
  if (f.k === 'lobby') { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x, y, w, 1); c.fillRect(x, y + h - 1, w, 1); }   // saguão contínuo: sem moldura entre as peças
  else if (f.k !== 'parkspace' && f.k !== 'ruin') { c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1; c.strokeRect(x + .5, y + .5, w - 1, h - 1); }
  else if (f.k === 'parkspace') { c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1; c.strokeRect(x + .5, y + .5, w - 1, h - 1); }
}

function paintFire(c, x, y, w, h, t, p, fighting) {
  const n = Math.max(2, Math.floor(w / 10));
  for (let i = 0; i < n; i++) {
    const fx = x + (i + .5) * w / n, ph = t * 6 + i * 1.7;
    const fh = (10 + Math.sin(ph) * 3) * (0.6 + p * 0.5);
    c.fillStyle = '#f05a1a'; c.beginPath(); c.moveTo(fx - 5, y + h - SLAB); c.quadraticCurveTo(fx, y + h - SLAB - fh * 1.8, fx + 5, y + h - SLAB); c.fill();
    c.fillStyle = '#ffd24a'; c.beginPath(); c.moveTo(fx - 2.5, y + h - SLAB); c.quadraticCurveTo(fx, y + h - SLAB - fh, fx + 2.5, y + h - SLAB); c.fill();
  }
  R(c, x, y, w, h - SLAB, 'rgba(255,80,20,.12)');
  if (fighting) {
    c.strokeStyle = 'rgba(150,210,255,.85)'; c.lineWidth = 1.4;
    for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(x + w * .3, y + h - SLAB - 7); c.quadraticCurveTo(x + w * (.4 + i * .06), y + 6 + (i % 2) * 6, x + w * (.5 + i * .07), y + h - SLAB - 2); c.stroke(); }
  }
}
// ------------------------------------------------------------ efeitos de eventos (extintor, sprinklers, bomba, ambulância, ladrão)
function paintActor(c, x, y, dir, t, shirt, run) {   // y = pés
  const sw = run ? Math.sin(t * 16) * 2 : 0;
  R(c, x - 1.6 + sw * .5, y - 5, 1.4, 5, '#2b2f3a'); R(c, x + .2 - sw * .5, y - 5, 1.4, 5, '#2b2f3a');
  R(c, x - 2.2, y - 10, 4.4, 5.5, shirt);
  c.fillStyle = '#f2cfa8'; c.beginPath(); c.arc(x, y - 12, 2.1, 0, 7); c.fill();
}
function paintSprinkle(c, x, y, w, h, t) {   // gotas caindo do teto da sala
  c.strokeStyle = 'rgba(120,190,255,.85)'; c.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    const gx = x + 3 + (w - 6) * ((i + .5) / 10), ph = (t * 2.2 + i * .37) % 1, gy = y + 4 + ph * (h - SLAB - 8);
    c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx - .5, gy + 4); c.stroke();
  }
  R(c, x + 2, y + 2, w - 4, 1.5, 'rgba(150,200,230,.9)');
}
function paintBomb(c, x, y, w, h, t, left) {   // left = minutos de jogo até explodir
  const urgent = left < 60, cx = x + w / 2, cy = y + h - SLAB - 8, on = Math.sin(t * (urgent ? 12 : 5)) > 0;
  c.fillStyle = on ? 'rgba(255,60,60,.22)' : 'rgba(255,210,70,.12)'; c.fillRect(x, y, w, h - SLAB);
  c.fillStyle = '#1b1b1f'; c.beginPath(); c.arc(cx, cy, 5, 0, 7); c.fill();
  R(c, cx - 1, cy - 9, 2, 4, '#7a5535');
  if (on) { c.fillStyle = '#ffd24a'; c.beginPath(); c.arc(cx, cy - 10, 2, 0, 7); c.fill(); }
  c.fillStyle = on ? '#ff3b3b' : '#ffd24a'; c.font = 'bold 8px system-ui'; c.textAlign = 'center';
  c.fillText(Math.max(0, Math.ceil(left)) + ' min', cx, y + 10);
}
function paintFx(c, e, u, t) {
  const f = e.f, x = f.x * U, w = f.w * U, h = f.h * FH, y = -(f.L + f.h) * FH, fy = y + h - SLAB, cx = x + w / 2;
  if (e.k === 'ext') {
    const k = e.from, kx = (k.x + k.w / 2) * U, ky = -k.L * FH - SLAB, edge = kx < cx ? x - 5 : x + w + 5;
    const run = clamp(u / 0.35, 0, 1), back = e.ok ? 0 : clamp((u - 0.85) / 0.15, 0, 1), ax = kx + (edge - kx) * (run - back * 0.6);
    const left = e.ok ? 1 - clamp((u - 0.35) / 0.5, 0, 1) : 1;
    if (left > 0) paintFire(c, x, y, w, h, t, 1 + (e.level - 1) * left, false);
    if (u > 0.35 && u < 0.85) for (let i = 0; i < 9; i++) {
      const ph = ((u - 0.35) * 5 + i / 9) % 1, px = ax + (cx - ax) * ph, py = (ky - 8) + ((fy - 14) - (ky - 8)) * ph - Math.sin(ph * Math.PI) * 10;
      c.fillStyle = 'rgba(245,250,255,.9)'; c.beginPath(); c.arc(px, py, 1.4 + ph, 0, 7); c.fill();
    }
    paintActor(c, ax, ky, edge > kx ? 1 : -1, t, '#c4272d', run < 1 || back > 0);
    R(c, ax + (edge > kx ? 2.5 : -4.5), ky - 8, 2, 5, '#c4272d');
    if (u > 0.85) { c.fillStyle = e.ok ? '#3fb27f' : '#e5484d'; c.font = 'bold 12px system-ui'; c.textAlign = 'center'; c.fillText(e.ok ? '✔' : '✘', cx, y + 12); }
  } else if (e.k === 'spr') {
    if (u < 0.85) paintSprinkle(c, x, y, w, h, t);
    paintFire(c, x, y, w, h, t, 1 + (e.level - 1) * (1 - clamp(u / 0.7, 0, 1)), false);
    if (u > 0.4) for (let i = 0; i < 4; i++) { const ph = (u - 0.4) * 1.4 + i * .17; c.fillStyle = `rgba(200,205,215,${(.5 * (1 - u)).toFixed(2)})`; c.beginPath(); c.arc(x + w * (.2 + i * .2), fy - 4 - ph * 22, 5 + ph * 5, 0, 7); c.fill(); }
  } else if (e.k === 'boom') {
    const r = (0.25 + u * 0.85) * Math.max(w, h) * 0.7, a = 1 - u;
    c.fillStyle = `rgba(90,80,75,${(.55 * a).toFixed(2)})`; c.beginPath(); c.arc(cx, y + h / 2 - u * 12, r * 1.1, 0, 7); c.fill();
    c.fillStyle = `rgba(255,120,30,${(.9 * a).toFixed(2)})`; c.beginPath(); c.arc(cx, y + h / 2, r * .8, 0, 7); c.fill();
    c.fillStyle = `rgba(255,225,110,${(.95 * a).toFixed(2)})`; c.beginPath(); c.arc(cx, y + h / 2, r * .45, 0, 7); c.fill();
    c.strokeStyle = `rgba(255,255,255,${(.6 * a).toFixed(2)})`; c.lineWidth = 2; c.beginPath(); c.arc(cx, y + h / 2, r * 1.3, 0, 7); c.stroke();
  } else if (e.k === 'amb') {
    const goal = cx, start = goal + (f.id % 2 ? 1 : -1) * 1700, dir = Math.sign(goal - start);
    const ease = p => p * p * (3 - 2 * p), pos = u < 0.4 ? start + (goal - start) * ease(u / 0.4) : u < 0.7 ? goal : goal + (start - goal) * ease((u - 0.7) / 0.3);
    const d = u < 0.7 ? dir : -dir, bx = pos - 11;
    R(c, bx, 0.5, 22, 6.5, '#f4f4f6'); R(c, bx, 4, 22, 1.2, '#d33'); R(c, d > 0 ? bx + 15 : bx, -2.5, 7, 4, '#f4f4f6');
    R(c, bx + 8, 1.2, 5, 1.2, '#d33'); R(c, bx + 9.9, -.2, 1.2, 4.2, '#d33');
    R(c, bx + 9, -4, 4, 1.6, Math.sin(t * 10) > 0 ? '#ff3b3b' : '#3b6bff');
    c.fillStyle = '#1b1b1f'; for (const wx of [bx + 5, bx + 17]) { c.beginPath(); c.arc(wx, 7, 1.9, 0, 7); c.fill(); }
    if (u >= 0.4 && u < 0.7) paintActor(c, goal + dir * -16, 7, dir, t, '#f4f4f6', false);
  } else if (e.k === 'thief') {
    const dir = f.id % 2 ? 1 : -1, px = cx + dir * u * (w / 2 + 14);
    c.globalAlpha = 1 - clamp((u - 0.7) / 0.3, 0, 1);
    paintActor(c, px, fy, dir, t, '#1b1b1f', true);
    R(c, px - dir * 4, fy - 9, 3, 4, '#7a5535');
    c.globalAlpha = 1;
  }
}
function paintSparkles(c, x, y, w, h, t) {
  c.fillStyle = '#fff';
  for (let i = 0; i < 5; i++) { const ph = (t * 1.6 + i * .37) % 1, sx = x + 6 + hash(i * 13 + Math.floor(t * 1.6 + i * .37)) * (w - 12), sy = y + h - SLAB - 4 - ph * 14; c.globalAlpha = 1 - ph; c.fillRect(sx, sy, 1.6, 1.6); c.fillRect(sx - 1.2, sy + .4, 4, .8); }
  c.globalAlpha = 1;
}

// ------------------------------------------------------------ piso vazio, escadas, elevadores
function paintBareFloor(c, x0, x1, y, night) {
  // estrutura metálica: laje com viga, postes a cada caixa e contraventamento em X
  const top = y - FH, bw = BOX * U, steel = night ? '#5d6678' : '#7b8494', dark = night ? '#2f3544' : '#4e5666';
  R(c, x0, top + SLAB, x1 - x0, FH - SLAB, night ? 'rgba(20,28,45,.45)' : 'rgba(120,140,160,.16)');
  c.strokeStyle = steel; c.lineWidth = 1;
  for (let x = x0; x < x1; x += bw) {
    c.beginPath(); c.moveTo(x + 1, top + SLAB + 1); c.lineTo(x + bw - 1, y - SLAB - 1); c.moveTo(x + bw - 1, top + SLAB + 1); c.lineTo(x + 1, y - SLAB - 1); c.stroke();
  }
  for (let x = x0; x <= x1; x += bw) R(c, x === x1 ? x - 2 : x, top, 2, FH, dark);
  R(c, x0, top, x1 - x0, SLAB, steel);                 // viga superior
  R(c, x0, y - SLAB, x1 - x0, SLAB, '#7b7f86');       // laje
  R(c, x0, y - SLAB, x1 - x0, 1, 'rgba(255,255,255,.25)');
}
function paintStairs(c, s, anim, busy, tier = 1) {
  // ocupa a linha do andar inferior: o voo sobe da esquerda (piso inferior) até a direita (piso superior); o acabamento acompanha o nível da torre
  const x = s.x * U, w = s.w * U, esc = s.k === 'escalator', y = -(s.L + 1) * FH;
  const bg = esc ? ['#2a303c', '#262d3a', '#2a2f40', '#2a3a40', '#33283a'][tier] : ['#3a3d44', '#33384a', '#3d3438', '#2f3a38', '#3a2a2e'][tier];
  R(c, x, y, w, FH - SLAB, bg);
  R(c, x, y, w, FH - SLAB, 'rgba(0,0,0,.18)');
  const x0 = x + 4, x1 = x + w - 4, y0 = y + FH - SLAB, y1 = y + 1;
  const steps = esc ? 14 : 9;
  const stepCol = esc ? ['#8a93a3', '#a1aabd', '#b4bccb', '#c9d2e0', '#e8d58a'] : ['#9a9a92', '#b9b4a2', '#a98a62', '#e8e3d4', '#c9a23a'];   // concreto, pedra, madeira, mármore, dourado
  for (let i = 0; i < steps; i++) {
    const t = i / steps, sx = x0 + t * (x1 - x0), sy = y0 - t * (y0 - y1);
    const col = esc ? (((i + Math.floor(anim * 6)) % 2) ? stepCol[tier] : mixHex(stepCol[tier], '#000000', .22)) : stepCol[tier];
    R(c, sx, sy - 1, (x1 - x0) / steps + 1, 3, col);
    if (!esc) { R(c, sx, sy + 2, 1, y0 - sy, 'rgba(0,0,0,.25)'); if (tier === 4) R(c, sx, sy - 1, (x1 - x0) / steps + 1, .8, '#ffd24a'); if (tier >= 3) R(c, sx, sy - 1, (x1 - x0) / steps + 1, .6, 'rgba(255,255,255,.5)'); }
  }
  if (!esc && tier === 4) { c.strokeStyle = 'rgba(155,28,46,.9)'; c.lineWidth = 3; c.beginPath(); c.moveTo(x0 + 2, y0 - 2); c.lineTo(x1 - 2, y1 + 1); c.stroke(); }   // tapete vermelho no meio dos degraus
  c.strokeStyle = esc ? '#d6dbe8' : ['#7a7a74', '#8a7a5a', '#6a4a2a', '#b8892e', '#ffd24a'][tier]; c.lineWidth = tier >= 2 ? 1.8 : 1.4;
  c.beginPath(); c.moveTo(x0, y0 - 9); c.lineTo(x1, y1 - 8 + 7); c.stroke();
  if (!esc && tier >= 2) for (let i = 0; i <= 4; i++) { const t = i / 4, px = x0 + t * (x1 - x0), py = y0 - 9 - t * (y0 - y1 - 1); R(c, px - .5, py, 1, 6, c.strokeStyle); }   // balaústres
  if (esc && tier >= 3) { c.strokeStyle = 'rgba(190,230,255,.45)'; c.lineWidth = 3; c.beginPath(); c.moveTo(x0, y0 - 6); c.lineTo(x1, y1 - 5 + 7); c.stroke(); }   // painel de vidro
  R(c, x, y, w, 2, ['#5b5f68', '#6b6f78', '#6a5a48', '#aaa598', '#c9a23a'][tier]);
  if (busy) R(c, x + w / 2 - 1, y + 4, 2, 2, '#6fe39b');
}
function paintShaft(c, s, cam, night) {
  const x = s.x * U, w = s.w * U, top = -(s.hi + 1) * FH, h = (s.hi - s.lo + 1) * FH;
  const exp = s.k === 'express', svc = s.k === 'service', cl = !!s.carlift;
  R(c, x, top, w, h, '#161b26');
  R(c, x + 1, top, w - 2, h, exp ? '#1f2a3a' : svc ? '#272320' : cl ? '#1c2630' : '#1d2230');
  c.strokeStyle = exp ? '#e0b64a' : svc ? '#8a6' : cl ? '#8fb4d9' : '#7d899e'; c.lineWidth = 1.2;
  c.strokeRect(x + .5, top + .5, w - 1, h - 1);
  if (cam.z > 0.35) {
    c.strokeStyle = 'rgba(255,255,255,.1)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x + w * .3, top); c.lineTo(x + w * .3, top + h); c.moveTo(x + w * .7, top); c.lineTo(x + w * .7, top + h); c.stroke();
  }
}
// casa de máquinas (acima do poço) e poço (abaixo): motor com polia que gira com as cabines em movimento; as setas são as alças de estender o poço
function paintMachineRoom(c, s, time, powered, cam) {
  const x = s.x * U, w = s.w * U, y = -(s.hi + 2) * FH, h = FH, moving = powered && s.cars.some(k => k.dir !== 0);
  R(c, x, y, w, h, '#252a35'); R(c, x, y, w, 3, '#3a4152'); R(c, x, y + h - SLAB, w, SLAB, '#4a5163');
  c.strokeStyle = '#7d899e'; c.lineWidth = 1; c.strokeRect(x + .5, y + .5, w - 1, h - 1);
  if (cam.z < 0.3) return;
  const cx = x + w / 2, cy = y + 13, r = Math.min(w * .28, 8), ang = moving ? time * 5 : 0;
  R(c, cx - r - 3, cy + r - 1, 2 * r + 6, 4, '#3a4152');
  c.fillStyle = '#5b6578'; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill();
  c.strokeStyle = '#c9d2e3'; c.lineWidth = 1.2;
  for (let i = 0; i < 3; i++) { const a = ang + i * Math.PI * 2 / 3; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); c.stroke(); }
  c.fillStyle = '#222'; c.beginPath(); c.arc(cx, cy, 1.6, 0, 7); c.fill();
  c.strokeStyle = '#a9b2c4'; c.lineWidth = 1;   // cabos descem até o poço
  const lanes = s.cars.length; for (let i = 0; i < lanes; i++) { const lx = x + 2 + (i + .5) * (w - 4) / lanes; c.beginPath(); c.moveTo(lx, y + h - 1); c.lineTo(lx, y + h); c.stroke(); }
  R(c, x + 2, y + 3, 3, 3, powered ? (moving ? '#6fe39b' : '#e8c648') : '#444');
  const pulse = .75 + .25 * Math.sin(time * 4); R(c, x + w - 15, y + 3, 12, 12, '#141a26'); c.strokeStyle = `rgba(232,198,72,${pulse.toFixed(2)})`; c.lineWidth = 1; c.strokeRect(x + w - 14.5, y + 3.5, 11, 11); c.fillStyle = `rgba(232,198,72,${pulse.toFixed(2)})`; c.beginPath(); c.moveTo(x + w - 12, y + 12); c.lineTo(x + w - 6, y + 12); c.lineTo(x + w - 9, y + 6); c.fill();   // alça: estender para cima
}
function paintShaftPit(c, s, cam) {
  const x = s.x * U, w = s.w * U, y = -s.lo * FH, h = FH;
  R(c, x, y, w, h, '#1b1f29'); R(c, x, y + h - SLAB, w, SLAB, '#3a4152');
  c.strokeStyle = '#7d899e'; c.lineWidth = 1; c.strokeRect(x + .5, y + .5, w - 1, h - 1);
  if (cam.z < 0.3) return;
  const lanes = s.cars.length;
  for (let i = 0; i < lanes; i++) {   // amortecedor sob cada pista
    const bx = x + 2 + (i + .5) * (w - 4) / lanes;
    R(c, bx - 3, y + h - SLAB - 4, 6, 4, '#59647a');
    c.strokeStyle = '#b9c2d3'; c.lineWidth = 1; c.beginPath(); c.moveTo(bx - 2, y + h - SLAB - 4); c.lineTo(bx + 2, y + h - SLAB - 8); c.lineTo(bx - 2, y + h - SLAB - 12); c.lineTo(bx + 2, y + h - SLAB - 16); c.stroke();
  }
  R(c, x + w - 15, y + 3, 12, 12, '#141a26'); c.strokeStyle = 'rgba(232,198,72,.9)'; c.lineWidth = 1; c.strokeRect(x + w - 14.5, y + 3.5, 11, 11); c.fillStyle = 'rgba(232,198,72,.95)'; c.beginPath(); c.moveTo(x + w - 12, y + 7); c.lineTo(x + w - 6, y + 7); c.lineTo(x + w - 9, y + 13); c.fill();   // alça: estender para baixo
}
// decoração do saguão, como um saguão de verdade: janelas, sofás com mesinha, plantas, quadros, flores e luminárias numa sequência com ritmo, que muda de trecho para trecho.
// Tudo é sorteado pela posição no mundo (andar e coluna): o saguão ganha itens ao se expandir e recarregar a página não muda nada. Só as pontas do térreo têm porta com toldo vermelho
// (para fora); nos saguões altos há lustres.
// o saguão evolui com as estrelas da torre (1★ a 5★, o 6★ mantém o 5★): cada nível troca o estilo, não só a cor.
// 1★ simples e pobre (concreto, bancos de plástico, lâmpada nua) · 2★ sofás e plantas · 3★ lambri de madeira, recepção e abajures ·
// 4★ mármore, colunas, cortinas e lustres · 5★ dourado, tapete vermelho, fonte, estátuas e lustres de cristal
const LOBBY_THEMES = [
  {wall: '#cdc8b8', wain: '#b3ad9a', rail: '#9d9784', fa: '#8f8c82', fb: '#9a978c', sofa: '#7c2f33', sofa2: '#93403f', chair: '#d8782f', tier: 0},
  {wall: '#d6ccb2', wain: '#bfb28f', rail: '#a89b78', fa: '#9a8f70', fb: '#c9bf9d', sofa: '#7c2f33', sofa2: '#93403f', chair: '#4f6f8f', tier: 1},
  {wall: '#dccbc0', wain: '#8a3a3e', rail: '#c9a23a', fa: '#8f8680', fb: '#e4ddd6', sofa: '#5a2a40', sofa2: '#7a3a58', chair: '#6a4a8a', trim: '#c9a23a', tier: 2},
  {wall: '#d9d6ae', wain: '#2f5a46', rail: '#d4af37', fa: '#2a2e2c', fb: '#eeeadf', sofa: '#1f4a5a', sofa2: '#2f6a7a', chair: '#8a6a2a', trim: '#d4af37', marble: true, tier: 3},
  {wall: '#ecdc9a', wain: '#8a6a1a', rail: '#ffd24a', fa: '#3a3322', fb: '#fff3c4', sofa: '#7a1f2e', sofa2: '#a8323f', chair: '#c9a23a', trim: '#ffd24a', marble: true, gold: true, tier: 4},
];
// peças de cada nível, em sequência (a posição no mundo sorteia o ponto de partida)
const LOBBY_SEQS = [
  ['window', 'bench', 'board', 'window', 'bench', 'clock', 'window', 'bench'],
  ['window', 'sofa', 'plant', 'painting', 'window', 'sofa', 'plant', 'armchair'],
  ['window', 'sofa', 'plant', 'painting', 'desk', 'flowers', 'sofa', 'armchair'],
  ['column', 'window', 'sofa', 'statue', 'painting', 'flowers', 'column', 'armchair'],
  ['column', 'window', 'sofa', 'fountain', 'painting', 'statue', 'column', 'flowers'],
];
function lobbyDeco(c, f, x, y, w, h, floorY, night, lit, edgeL, edgeR, theme = 0) {
  const th = LOBBY_THEMES[theme] || LOBBY_THEMES[0];
  const hs = (u, k) => ((Math.imul(u + 1013, 374761393) ^ Math.imul(f.L + 77 + k * 31, 668265263)) >>> 0) / 4294967296;
  const glow = lit || night;
  for (let u = f.x; u < f.x + f.w; u += 4) {
    const px = x + (u - f.x) * U, left = f.L === 0 && edgeL && u === f.x, right = f.L === 0 && edgeR && u === f.x + f.w - 4;
    if (left || right) {   // entrada: porta de vidro e toldo vermelho e branco que avança para fora do prédio
      const ax = left ? px - 9 : px + 1, aw = 40;
      R(c, px + 6, floorY - 25, 20, 25, night ? '#27324a' : '#8cc1d8'); R(c, px + 15.5, floorY - 25, 1, 25, '#556070'); R(c, px + 5, floorY - 26, 22, 1.5, '#556070');
      if (night) R(c, px + 7, floorY - 24, 8, 22, 'rgba(255,226,150,.5)');
      R(c, px + 8, floorY - 24, 16, 5.5, '#1a2230'); c.fillStyle = '#6fe39b'; c.font = 'bold 4.2px system-ui'; c.textAlign = 'center'; c.fillText('ENTRADA', px + 16, floorY - 19.8);   // placa luminosa da porta
      R(c, ax, y + 2, aw, 5, '#a3202a'); for (let i = 0; i < aw; i += 8) R(c, ax + i, y + 2, 4, 5, '#f4f1ea');
      c.fillStyle = '#a3202a'; for (let i = 0; i < aw; i += 8) { c.beginPath(); c.arc(ax + i + 2, y + 7, 2, 0, Math.PI); c.fill(); } for (let i = 4; i < aw; i += 8) { c.fillStyle = '#f4f1ea'; c.beginPath(); c.arc(ax + i + 2, y + 7, 2, 0, Math.PI); c.fill(); }
      continue;
    }
    const tier = th.tier, type = LOBBY_SEQS[tier][((u >> 2) + Math.floor(hs(Math.floor(u / 32), 5) * 8)) % 8];
    if (tier === 4) { R(c, px, floorY - 3, 32, 3, '#9b1c2e'); R(c, px, floorY - 3, 32, .8, '#d4af37'); R(c, px, floorY - .8, 32, .8, '#d4af37'); }   // tapete vermelho com friso dourado
    if (tier === 3) { for (let i = 0; i < 32; i += 8) R(c, px + i + 2, floorY - 2, 3, .6, 'rgba(255,255,255,.35)'); }   // veios do mármore
    if (tier >= 2) R(c, px, y + 3, 32, 2.4, th.trim); if (tier === 4) { R(c, px, y + 5.4, 32, 1, '#fff3c4'); for (let i = 0; i < 32; i += 4) R(c, px + i + 1, y + 6.4, 2, 1.4, th.trim); }   // sanca: friso no teto
    if (type === 'window') {
      if (tier >= 3) { R(c, px + 2, y + 5, 5, 23, tier === 4 ? '#7a1f2e' : '#8a1f2e'); R(c, px + 25, y + 5, 5, 23, tier === 4 ? '#7a1f2e' : '#8a1f2e'); R(c, px + 1, y + 4, 30, 1.6, th.trim); if (tier === 4) { R(c, px + 6, y + 14, 1.2, 8, '#ffd24a'); R(c, px + 24.8, y + 14, 1.2, 8, '#ffd24a'); } }   // cortinas
      R(c, px + 5, y + 6, 22, 20, tier === 0 ? '#8a8472' : '#7a6c4c'); R(c, px + 6.5, y + 7.5, 19, 17, night ? (lit ? '#ffe9b0' : '#243049') : '#bfe6f7'); R(c, px + 15.5, y + 7.5, 1, 17, '#7a6c4c'); R(c, px + 6.5, y + 15, 19, 1, '#7a6c4c');
      if (!night) { c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.moveTo(px + 8, y + 24); c.lineTo(px + 14, y + 8); c.lineTo(px + 17, y + 8); c.lineTo(px + 11, y + 24); c.fill(); }
      R(c, px + 4, y + 26, 24, 2, '#a89b78');
    } else if (type === 'sofa') {
      R(c, px + 3, floorY - 12, 20, 12, th.sofa); R(c, px + 2, floorY - 9, 4, 9, mixHex(th.sofa, '#000000', .2)); R(c, px + 20, floorY - 9, 4, 9, mixHex(th.sofa, '#000000', .2)); R(c, px + 6, floorY - 8, 7, 5, th.sofa2); R(c, px + 13, floorY - 8, 7, 5, th.sofa2);
      R(c, px + 25, floorY - 8, 5, 8, '#8a6a47'); R(c, px + 26.5, floorY - 13, 2, 5, '#3f8a4a'); c.fillStyle = '#e86a8a'; c.beginPath(); c.arc(px + 27.5, floorY - 14, 2, 0, 7); c.fill();   // mesinha com florzinha
    } else if (type === 'plant') {
      R(c, px + 11, floorY - 7, 10, 7, '#a9623c'); R(c, px + 10, floorY - 8.5, 12, 2, '#c4764a');
      c.fillStyle = '#2f7a3e'; c.beginPath(); c.arc(px + 16, floorY - 17, 7.5, 0, 7); c.fill(); c.fillStyle = '#3f9a4e'; c.beginPath(); c.arc(px + 12.5, floorY - 14, 5, 0, 7); c.arc(px + 19.5, floorY - 15, 5.5, 0, 7); c.fill(); c.fillStyle = '#55b462'; c.beginPath(); c.arc(px + 16, floorY - 21, 4, 0, 7); c.fill();
    } else if (type === 'painting') {
      const col = ['#d9b66a', '#7fb0c9', '#c98a7f'][Math.floor(hs(u, 2) * 3)];
      R(c, px + 7, y + 8, 18, 14, '#6a4a2a'); R(c, px + 8.5, y + 9.5, 15, 11, col); c.fillStyle = 'rgba(255,255,255,.28)'; c.fillRect(px + 8.5, y + 14, 15, 3);
      R(c, px + 6, floorY - 7, 20, 3, '#8a6a47'); R(c, px + 8, floorY - 4, 2, 4, '#6a4a2a'); R(c, px + 22, floorY - 4, 2, 4, '#6a4a2a');   // aparador
    } else if (type === 'statue') {   // estátua sobre pedestal (acabamentos mais ricos)
      R(c, px + 11, floorY - 7, 10, 7, th.gold ? '#d4af37' : '#a9a49a'); R(c, px + 10, floorY - 8.4, 12, 1.8, th.gold ? '#ffd24a' : '#c9c4b8');
      c.fillStyle = th.gold ? '#f0c64a' : '#d9d4c8'; c.beginPath(); c.arc(px + 16, floorY - 22, 2.6, 0, 7); c.fill(); R(c, px + 13.6, floorY - 19.6, 4.8, 11, th.gold ? '#f0c64a' : '#d9d4c8'); R(c, px + 11.4, floorY - 18, 2.4, 8, th.gold ? '#f0c64a' : '#d9d4c8'); R(c, px + 18.2, floorY - 18, 2.4, 8, th.gold ? '#f0c64a' : '#d9d4c8');
    } else if (type === 'flowers') {
      R(c, px + 5, floorY - 11, 22, 3, '#8a6a47'); R(c, px + 7, floorY - 8, 2, 8, '#6a4a2a'); R(c, px + 23, floorY - 8, 2, 8, '#6a4a2a');
      R(c, px + 13, floorY - 17, 6, 6, '#7fb0c9'); R(c, px + 14, floorY - 19, 4, 2, '#7fb0c9');
      const fc = ['#e8527a', '#f2c230', '#f4f1ea', '#b06ad8'];
      for (let i = 0; i < 5; i++) { c.fillStyle = '#3f8a4a'; c.fillRect(px + 14 + i * 1, floorY - 25, .8, 7); c.fillStyle = fc[(i + Math.floor(hs(u, 4) * 4)) % 4]; c.beginPath(); c.arc(px + 13 + i * 1.6, floorY - 25 - (i % 2), 2, 0, 7); c.fill(); }
    } else if (type === 'bench') {   // 1★: banco de plástico com três cadeiras laranja
      R(c, px + 4, floorY - 5, 24, 1.6, '#555'); R(c, px + 6, floorY - 4, 1.4, 4, '#555'); R(c, px + 25, floorY - 4, 1.4, 4, '#555');
      for (let i = 0; i < 3; i++) { R(c, px + 5 + i * 8, floorY - 10, 6.5, 5, th.chair); R(c, px + 5 + i * 8, floorY - 14, 6.5, 3.4, mixHex(th.chair, '#000000', .15)); }
    } else if (type === 'board') {   // quadro de avisos de cortiça e extintor
      R(c, px + 6, y + 10, 18, 13, '#7a5535'); R(c, px + 7.5, y + 11.5, 15, 10, '#b98a55'); for (const [qx, qy, qc] of [[9, 13, '#fff'], [14, 14, '#ffe08a'], [18, 12.5, '#cfe3f0']]) R(c, px + qx, y + qy, 4, 5, qc);
      R(c, px + 26, floorY - 12, 4, 12, '#c4272d'); R(c, px + 26.6, floorY - 14, 2.8, 2.4, '#222');
    } else if (type === 'clock') {   // relógio de parede e lixeira
      c.fillStyle = '#eee'; c.beginPath(); c.arc(px + 16, y + 14, 6, 0, 7); c.fill(); c.strokeStyle = '#444'; c.lineWidth = 1; c.stroke(); c.beginPath(); c.moveTo(px + 16, y + 14); c.lineTo(px + 16, y + 10); c.moveTo(px + 16, y + 14); c.lineTo(px + 19, y + 15); c.stroke();
      R(c, px + 4, floorY - 9, 7, 9, '#5a6a5a'); R(c, px + 3.4, floorY - 10, 8.2, 1.6, '#6f806f');
    } else if (type === 'desk') {   // recepção com balcão, computador, sino e placa
      R(c, px + 3, floorY - 10, 27, 10, '#6a4a2a'); R(c, px + 2, floorY - 11.4, 29, 2, th.trim || '#c9a23a'); R(c, px + 5, floorY - 8, 23, 1, 'rgba(255,255,255,.2)');
      R(c, px + 8, floorY - 16, 7, 4.6, '#222'); R(c, px + 9, floorY - 15, 5, 3, glow ? '#8fe0ff' : '#4a6a7a'); R(c, px + 11, floorY - 12, 1.6, 1, '#222'); R(c, px + 22, floorY - 13, 4, 2, '#d4af37');
      R(c, px + 8, y + 9, 16, 6, '#1a2230'); c.fillStyle = '#ffd24a'; c.font = 'bold 4px system-ui'; c.textAlign = 'center'; c.fillText('RECEPÇÃO', px + 16, y + 13.4);
    } else if (type === 'column') {   // coluna com capitel e base
      const g = th.gold ? '#ffd24a' : '#e8e3d4';
      R(c, px + 11, y + 4, 10, floorY - y - 4, g); R(c, px + 9, y + 4, 14, 3, th.gold ? '#d4af37' : '#cfc9b8'); R(c, px + 9, floorY - 4, 14, 4, th.gold ? '#d4af37' : '#cfc9b8'); R(c, px + 13.4, y + 7, 1, floorY - y - 11, 'rgba(0,0,0,.12)'); R(c, px + 17.6, y + 7, 1, floorY - y - 11, 'rgba(0,0,0,.12)');
    } else if (type === 'fountain') {   // 5★: fonte de mármore com água
      R(c, px + 5, floorY - 5, 22, 5, '#e8e3d4'); R(c, px + 5, floorY - 5, 22, 1.4, '#fff'); R(c, px + 7, floorY - 4, 18, 2.4, glow ? '#7fd0ff' : '#5fb0e0'); R(c, px + 14.4, floorY - 14, 3.2, 9, '#d4af37'); R(c, px + 10, floorY - 15, 12, 2.4, '#e8e3d4');
      c.fillStyle = 'rgba(160,220,255,.75)'; for (let i = -1; i <= 1; i++) { c.beginPath(); c.arc(px + 16 + i * 4, floorY - 17 + Math.abs(i) * 2, 1.2, 0, 7); c.fill(); } R(c, px + 15.5, floorY - 23, 1, 8, 'rgba(160,220,255,.7)');
    } else {   // poltrona com luminária de pé (armchair)
      R(c, px + 6, floorY - 11, 11, 11, th.chair); R(c, px + 5, floorY - 8, 3, 8, mixHex(th.chair, '#000000', .18)); R(c, px + 15, floorY - 8, 3, 8, mixHex(th.chair, '#000000', .18));
      R(c, px + 24, floorY - 22, 1.6, 22, '#555'); R(c, px + 21, floorY - 3, 8, 3, '#444'); R(c, px + 20, floorY - 27, 10, 6, glow ? '#ffe9a0' : '#e8dcb0');
      if (glow) { c.fillStyle = 'rgba(255,233,160,.22)'; c.beginPath(); c.moveTo(px + 20, floorY - 21); c.lineTo(px + 30, floorY - 21); c.lineTo(px + 34, floorY); c.lineTo(px + 16, floorY); c.fill(); }
    }
    const lampP = hs(u, 3);   // luz do teto por nível: lâmpada nua, calha fluorescente, pendente, lustre e lustre de cristal
    if (tier === 0) { if (lampP < .6) { R(c, px + 15.5, y, .8, 6, '#555'); c.fillStyle = glow ? '#fff3b0' : '#e8e0b8'; c.beginPath(); c.arc(px + 16, y + 7.5, 2, 0, 7); c.fill(); } }
    else if (tier === 1) { R(c, px + 7, y + 1.5, 18, 2.4, glow ? '#fffbe0' : '#e8e8e8'); R(c, px + 7, y + 3.9, 18, .6, 'rgba(0,0,0,.2)'); }
    else if (tier === 2) { if (lampP < .7) { R(c, px + 15.5, y, 1, 5, '#caa'); c.fillStyle = '#c9a23a'; c.beginPath(); c.moveTo(px + 11, y + 11); c.lineTo(px + 21, y + 11); c.lineTo(px + 18.5, y + 5); c.lineTo(px + 13.5, y + 5); c.fill(); c.fillStyle = glow ? 'rgba(255,233,160,.5)' : 'rgba(255,233,160,.2)'; c.fillRect(px + 12, y + 11, 8, 2); } }
    else { const big = tier === 4, rr = big ? 7 : 5;
      R(c, px + 15, y, 1, big ? 8 : 6, '#caa'); c.fillStyle = '#ffd98a'; c.beginPath(); c.arc(px + 15.5, y + (big ? 12 : 10), rr, 0, 7); c.fill(); c.fillStyle = 'rgba(255,217,138,.4)'; c.beginPath(); c.arc(px + 15.5, y + (big ? 12 : 10), rr + 3.5, 0, 7); c.fill();
      if (big) { c.fillStyle = '#fff'; for (let i = -2; i <= 2; i++) { R(c, px + 15 + i * 3, y + 17 - Math.abs(i), .8, 2.4 + Math.abs(i) * .4, '#e8f6ff'); } R(c, px + 8, y + 12, 15, 1, '#d4af37'); } }
  }
}
// tráfego contínuo nos túneis: a mesma fase vale para o mundo inteiro, então cada carro passa de um quadrado ao outro (e pelo portal); cada carro é uma cópia periódica (n) que anda sem
// parar, então mantém a cor do começo ao fim; o desenho é recortado no quadrado da peça (nada aparece fora dele); cada andar tem o seu sentido
function tunnelTraffic(c, L, x, w, floorY, tm, y, h) {
  const PER = 520, dir = (L % 2 === 0) ? 1 : -1, xc = x + w / 2;
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  for (let k = 0; k < 2; k++) {
    const u = tm * 22 * dir + k * 260 + L * 91, n = Math.round((xc - u) / PER), cx = u + n * PER;
    if (Math.abs(xc - cx) < w / 2 + 12) paintCarSide(c, cx, floorY - 1.5, dir, (Math.abs(n) * 3 + k * 2 + (L & 7)) % 6, .8);
  }
  c.restore();
}
// geometria das pistas: a porta de cada andar tem a mesma largura e a mesma altura (22) da cabine da sua pista
function shaftLane(s, lane, lanes) { const full = s.w * U - 4, w = lanes > 1 ? (full - (lanes - 1)) / lanes : full; return {w, x: s.x * U + 2 + lane * (w + 1)}; }
function paintShaftDoors(c, s, stops, cam) {
  if (cam.z < 0.3) return;
  const lanes = Math.max(1, s.cars.length);
  for (const L of stops) {
    const y = -L * FH - SLAB;
    if (s.carlift) {   // portão de garagem: abertura larga com viga listrada
      const gw = s.w * U - 4, gx = s.x * U + 2, gh = FH - SLAB - 2;
      R(c, gx, y - gh, gw, gh, 'rgba(8,10,16,.55)'); R(c, gx, y - gh, gw, 3, '#e8c648');
      for (let k = 0; k < gw; k += 8) R(c, gx + k, y - gh, 4, 3, '#222');
      R(c, gx, y - 1.5, gw, 1.5, '#3a4152');
      continue;
    }
    for (let i = 0; i < lanes; i++) {
      const {x, w} = shaftLane(s, i, lanes);
      R(c, x, y - 22, w, 22, '#59647a');
      R(c, x + w / 2 - .5, y - 22, 1, 22, '#222');
    }
    const full = s.w * U;
    R(c, s.x * U + full / 2 - 2, y - 26, 4, 3, s.q[L] && s.q[L].length ? '#ffd24a' : '#444');
  }
}
function paintCar(c, s, car, lane = 0, lanes = 1, load) {
  if (s.carlift) {   // cabine de carro: moldura de aço pendurada em cabos, piso de plataforma alinhado ao piso do nível e o carro em cima (grande, para dar para ver)
    const {w, x} = shaftLane(s, lane, lanes), H = FH - SLAB - 2, fl = -car.y * FH - SLAB, y = fl - H, top = -(s.hi + 1) * FH;
    c.strokeStyle = '#a9b2c4'; c.lineWidth = 1;
    for (const k of [.25, .75]) { c.beginPath(); c.moveTo(x + w * k, top); c.lineTo(x + w * k, y); c.stroke(); }   // cabos até a casa de máquinas
    c.fillStyle = 'rgba(143,180,217,.14)'; c.fillRect(x, y, w, H);
    R(c, x, y, w, 3, '#8fb4d9'); R(c, x, y, 2, H, '#8fb4d9'); R(c, x + w - 2, y, 2, H, '#8fb4d9');   // viga de cima e colunas
    R(c, x, fl - 3, w, 3, '#59647a'); R(c, x, fl - 3, w, 1, '#c9d2e3');   // plataforma
    if (car.full) paintCarSide(c, x + w / 2, fl - 3, car.dir < 0 ? 1 : -1, (car.id || 0) % 6, Math.max(.8, Math.min(2.2, (w - 10) / 15)));
    R(c, x + w / 2 - 2, y + 4, 4, 2, car.full ? '#6fe39b' : '#e8c648');   // luz de estado
    return;
  }
  // cabines do mesmo poço correm em pistas lado a lado
  const {w, x} = shaftLane(s, lane, lanes), H = 22;   // mesma largura e altura da porta
  const y = -car.y * FH - SLAB - H;
  const open = car.dwell > 0 ? 1 : 0;
  R(c, x, y, w, H, '#d9b84a');
  R(c, x + 1, y + 1, w - 2, H - 2, '#fdf1c4');
  if (!open) R(c, x + w / 2 - .5, y + 1, 1, H - 2, '#a98');
  if (w >= 5 && car.dir) { c.fillStyle = car.dir > 0 ? '#6fe39b' : '#ff8a5c'; c.beginPath(); const cx = x + w / 2; if (car.dir > 0) { c.moveTo(cx - 2.5, y - .5); c.lineTo(cx + 2.5, y - .5); c.lineTo(cx, y - 4); } else { c.moveTo(cx - 2.5, y - 3.5); c.lineTo(cx + 2.5, y - 3.5); c.lineTo(cx, y); } c.fill(); }   // seta de direção
  else R(c, x + w / 2 - Math.min(3, w / 2), y - 3, Math.min(6, w), 3, car.dir > 0 ? '#6fe39b' : car.dir < 0 ? '#ff8a5c' : '#888');
  const cap = TRANSPORT[s.k].cap;
  const n = load !== undefined ? load : car.pax.length;   // carga real em vagas (ciclista sem bicicletário ocupa 2)
  if (n) {
    if (w >= 7) { c.fillStyle = n >= cap ? '#c33' : '#333'; c.font = 'bold ' + Math.min(8, w - 1) + 'px system-ui'; c.textAlign = 'center';
    c.fillText(n, x + w / 2, y + 16); }   // o número cabe na pista (com 3 cabines a pista é estreita)
  }
}

// ------------------------------------------------------------ pessoas
// o que cada pessoa faz dentro da sala onde está: senta para comer ou assistir, dança, bebe, olha as vitrines, olha o relógio, briga...
const PERSON_ACT = {restaurant: 'sit', fastfood: 'sit', cafe: 'sit', cinema: 'sit', auditorio: 'sit', bar: 'drink', party: 'dance', shop: 'browse', mercado: 'browse', lobby: 'wait', banco: 'wait', academia: 'gym', piscina: 'gym'};
// aparência de cada pessoa, fixa e sorteada pelo id e pela idade: altura (criança, adulto, idoso), corpo, cabelo, roupa, calçado e acessórios
const SHIRT_COLS = ['#4f7fbf', '#6aa56a', '#b0658a', '#8a74c0', '#c9894a', '#4aa0a0', '#9a9a52', '#7c8794', '#c0504d', '#e0c24a', '#5a6fa8', '#d98aa8'];
const PANTS_COLS = ['#2b2f3a', '#3a4a6a', '#5a4a38', '#6a6a5a', '#222', '#4a3a5a'];
const HAIR_COLS = ['#2a1d12', '#4a3020', '#7a5230', '#c9a23a', '#a8452a', '#1b1b1b', '#6a6a6a'];
function personTraits(p) {
  if (p._tr) return p._tr;
  const r = k => hash(p.id * 37 + k * 101), age = p.age || 30, kid = age < 14 || p.prof === 'school_am' || p.prof === 'school_pm' || p.prof === 'student', elder = age >= 65 || p.prof === 'retired';
  const tr = {
    scale: kid ? .78 : elder ? .95 : .92 + r(1) * .16, build: r(2) < .25 ? 0 : r(2) < .8 ? 1 : 2, skin: SKIN[Math.floor(r(3) * 4)], kid, elder,
    hair: kid ? (r(4) < .5 ? 'short' : 'ponytail') : ['short', 'short', 'long', 'bald', 'curly', 'ponytail'][Math.floor(r(4) * 6)], hairCol: elder ? '#b8b8b8' : HAIR_COLS[Math.floor(r(5) * HAIR_COLS.length)],
    shirt: SHIRT_COLS[Math.floor(r(6) * SHIRT_COLS.length)], pants: PANTS_COLS[Math.floor(r(7) * PANTS_COLS.length)], skirt: !kid && r(8) < .22, shoe: r(9) < .5 ? '#1b1b1b' : r(9) < .8 ? '#e8e4d8' : '#7a4a2a',
    glasses: !kid && r(10) < .16, hat: r(11) < .1, pack: kid ? r(12) < .8 : r(12) < .1, tie: false, suit: false,
  };
  if (p.kind === 'worker' || p.prof === 'day' || p.prof === 'night') { if (r(13) < .5) { tr.suit = true; tr.shirt = ['#2f3a52', '#3a3a3a', '#4a4a5a', '#5a3a3a'][Math.floor(r(14) * 4)]; tr.tie = r(15) < .6; } }
  if (p.kind === 'guest' && r(16) < .3) tr.hat = true;
  return (p._tr = tr);
}
function paintPerson(c, p, x, y, t, lod, act) {
  const tr = personTraits(p), tier = stressTier(p.stress), moving = p.st === 'walk' || p.st === 'stair', panic = !!p.panic;
  c.save(); c.translate(x, y); c.scale(tr.scale, tr.scale); x = 0; y = 0;
  const sw = Math.sin(t * (panic ? 18 : 9) + p.id) * (moving ? (panic ? 2.6 : 1.6) : 0);
  const dir = p.step && p.step.x !== undefined ? Math.sign(p.step.x - p.x) || 1 : (p.id % 2 ? 1 : -1);
  const sit = act === 'sit', dance = act === 'dance', gym = act === 'gym', fight = act === 'fight', ph = t * 2.5 + p.id * 1.3;
  const bob = dance ? Math.sin(t * 8 + p.id) * 1.1 : gym ? Math.abs(Math.sin(t * 3 + p.id)) * -1.2 : panic ? Math.abs(Math.sin(t * 18 + p.id)) * -1.1 : 0, yb = (sit ? y + 2.4 : y) + bob;
  const role = p.kind === 'staff' && p.home ? p.home.k : '', bw = [3.6, 4.4, 5.4][tr.build], lean = fight ? dir * 1.2 : tr.elder ? -dir * .6 : panic ? dir * 1.4 : 0;
  const shirt = role === 'security' ? '#27456b' : role === 'housekeeping' ? '#7fc8c0' : tier ? STRESS_COL[tier] : tr.shirt;
  // carrinho de camareira (empurrado à frente, com toalhas e produtos; as rodas giram quando ela anda)
  if (role === 'housekeeping') {
    const cx = x + dir * 8.5, wr = moving ? t * 10 : 0;
    R(c, cx - 5, y - 8, 10, 4, '#8a929c'); R(c, cx - 5, y - 8.8, 10, 1.2, '#b9c0c8'); R(c, cx - 4, y - 5, 1.2, 4, '#666'); R(c, cx + 3, y - 5, 1.2, 4, '#666');
    for (let k = 0; k < 3; k++) R(c, cx - 4.4 + k * 3, y - 11.4 - (k % 2) * .6, 2.8, 2.6 + (k % 2) * .6, ['#fff', '#cfe3f0', '#f6dde4'][k]);
    R(c, cx + 2.6, y - 12.4, 1.8, 3.6, '#2e8b57'); R(c, cx + 2.8, y - 13.2, 1.4, .9, '#e8527a'); R(c, cx - 5.4, y - 11, .9, 3, '#7a838c');
    c.fillStyle = '#222'; for (const wx of [cx - 3.6, cx + 3.6]) { c.beginPath(); c.arc(wx, y - 1.4, 1.5, 0, 7); c.fill(); c.strokeStyle = '#999'; c.lineWidth = .6; c.beginPath(); c.moveTo(wx, y - 1.4); c.lineTo(wx + Math.cos(wr) * 1.3, y - 1.4 + Math.sin(wr) * 1.3); c.stroke(); }
  }
  // pernas (sentado: coxa para a frente e canela para baixo; de saia: pernas de pele)
  const leg = tr.skirt && !role ? tr.skin : tr.pants;
  if (sit) { R(c, x - 1.6, y - 2.8, 4.2, 1.4, leg); R(c, x + 1.6, y - 2.8, 1.4, 3, leg); R(c, x + 1.4, y + .1, 2.2, .8, tr.shoe); }
  else { R(c, x - 1.6 + sw * .5, y - 5, 1.4, 5, leg); R(c, x + .2 - sw * .5, y - 5, 1.4, 5, leg); R(c, x - 1.8 + sw * .5, y - .8, 2, .9, tr.shoe); R(c, x + .1 - sw * .5, y - .8, 2, .9, tr.shoe); }
  // corpo: camisa/terno, saia ou vestido; mochila nas costas
  if (tr.pack && lod && !role) R(c, x - dir * (bw / 2 + 1.4) + lean, yb - 9.4, 2, 4.4, '#7a4a2a');
  R(c, x - bw / 2 + lean, yb - 10, bw, 5.5, shirt);
  if (tr.skirt && !role) { c.fillStyle = shirt; c.beginPath(); c.moveTo(x - bw / 2 + lean, yb - 5); c.lineTo(x + bw / 2 + lean, yb - 5); c.lineTo(x + bw / 2 + 1.2, yb - 3); c.lineTo(x - bw / 2 - 1.2, yb - 3); c.fill(); }
  if (tr.suit && lod && !role) { R(c, x - .5 + lean, yb - 10, 1, 5.5, '#e8e4d8'); if (tr.tie) R(c, x - .35 + lean, yb - 9.6, .7, 3.4, '#a3202a'); }
  // cabeça e cabelo
  const hx = x + lean + (act === 'browse' ? Math.sin(t * .8 + p.id) * .7 : 0), hy = yb - 12;
  c.fillStyle = tr.skin; c.beginPath(); c.arc(hx, hy, 2.1, 0, 7); c.fill();
  if (lod) {
    c.fillStyle = tr.hairCol;
    if (tr.hair === 'short') R(c, hx - 2, hy - 2.4, 4, 1.5, tr.hairCol);
    else if (tr.hair === 'long') { R(c, hx - 2.2, hy - 2.4, 4.4, 1.6, tr.hairCol); R(c, hx - 2.3, hy - 1, 1.2, 4.6, tr.hairCol); R(c, hx + 1.1, hy - 1, 1.2, 4.6, tr.hairCol); }
    else if (tr.hair === 'curly') { for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(hx - 1.7 + k * 1.15, hy - 2, 1.05, 0, 7); c.fill(); } }
    else if (tr.hair === 'ponytail') { R(c, hx - 2, hy - 2.4, 4, 1.5, tr.hairCol); R(c, hx - dir * 2.8, hy - 1.4, 1.2, 3, tr.hairCol); }
    if (tr.glasses) { R(c, hx - 1.9, hy - .4, 1.6, 1.1, '#222'); R(c, hx + .3, hy - .4, 1.6, 1.1, '#222'); R(c, hx - .3, hy - .1, .6, .4, '#222'); }
    if (tr.hat && !role) { R(c, hx - 2.5, hy - 3.2, 5, 1.4, ['#c0392b', '#2e6fb5', '#3a3a3a'][p.id % 3]); R(c, hx - 1.5, hy - 4.3, 3, 1.4, ['#c0392b', '#2e6fb5', '#3a3a3a'][p.id % 3]); }
    if (tr.elder) { R(c, hx + dir * 3.2, yb - 7.6, .9, 8, '#7a5535'); R(c, hx + dir * 2.6, yb - 7.8, 2, .9, '#7a5535'); }   // bengala
  }
  // braços e objetos conforme a ação
  if (lod && (act || panic)) {
    const skin = tr.skin, up = Math.max(0, Math.sin(ph));
    if (panic) { const a = Math.sin(t * 18 + p.id); R(c, x - 3.4, yb - 11.5 - Math.abs(a) * 2, 1.2, 4, skin); R(c, x + 2.2, yb - 11.5 - Math.abs(-a) * 2, 1.2, 4, skin); if (Math.sin(t * 6 + p.id) > .2) { c.fillStyle = '#ff4a3a'; c.font = 'bold 5px system-ui'; c.textAlign = 'center'; c.fillText('!', x, yb - 15.6); } }   // foge do incêndio, de braços para cima
    else if (fight) { const j = Math.max(0, Math.sin(t * 9 + p.id * 2)); R(c, x + dir * 2, yb - 8.6, 1.4 + j * 3.6, 1.5, skin); R(c, x + dir * (3.2 + j * 3.6), yb - 9.1, 1.9, 2, '#d2323d'); R(c, x - dir * 1.2, yb - 8, 1.3, 3, skin); }
    else if (sit && p.at && p.at.k !== 'cinema' && p.at.k !== 'auditorio') { R(c, x + dir * 2, yb - 8.4 - up * 3, 1.3, 3.2, skin); R(c, x + dir * 2 - 0.4, yb - 9.6 - up * 3, 2, 1.2, '#d9d9d9'); }
    else if (sit) { R(c, x + dir * 2, yb - 8, 1.3, 2.6, skin); R(c, x + dir * 2.4, yb - 9.5 - (up > .8 ? 1.2 : 0), 1.6, 1.8, '#f4e6c4'); }
    else if (dance) { const s2 = Math.sin(t * 8 + p.id); R(c, x - 3.6, yb - 10 - Math.abs(s2) * 3, 1.2, 4, skin); R(c, x + 2.4, yb - 10 - Math.abs(-s2) * 3, 1.2, 4, skin); }
    else if (act === 'drink') { R(c, x + dir * 2.2, yb - 8 - up * 3.4, 1.3, 3, skin); R(c, x + dir * 2.4, yb - 10.4 - up * 3.4, 2, 2.6, '#bfe3f5'); R(c, x + dir * 2.4, yb - 9.4 - up * 3.4, 2, 1.4, '#e8a317'); }
    else if (act === 'wait') { R(c, x + dir * 2.2, yb - 8.4, 1.3, 2.4, skin); R(c, x + dir * 2, yb - 7, 2, 1.1, Math.sin(t * 3 + p.id) > .6 ? '#f6c445' : '#888'); }
    else if (gym) { const l = Math.abs(Math.sin(t * 3 + p.id)); R(c, x - 3.4, yb - 8 - l * 3, 1.2, 3.4, skin); R(c, x + 2.2, yb - 8 - l * 3, 1.2, 3.4, skin); R(c, x - 4.4, yb - 9.6 - l * 3, 3.2, 1.2, '#444'); R(c, x + 1.8, yb - 9.6 - l * 3, 3.2, 1.2, '#444'); }
  }
  if (role === 'housekeeping') { R(c, x - 2.4, hy - 3.2, 4.8, 1.2, '#fff'); R(c, x - bw / 2 + lean, yb - 8.6, bw, 3.4, '#fff'); }
  else if (role === 'security') { R(c, hx - 2.6, hy - 3.2, 5.2, 1.8, '#1b2f4d'); R(c, x - 1, yb - 9, 2, 1.4, '#f6c445'); }
  if (p.kind === 'firefighter') { R(c, x - bw / 2, yb - 10, bw, 5.5, '#c4272d'); R(c, x - bw / 2, yb - 8, bw, 1, '#f2c230'); R(c, hx - 2.8, hy - 3.4, 5.6, 2.2, '#f2c230'); }
  if (p.kind === 'vip') { R(c, hx - 2.6, hy - 3.6, 5.2, 1.6, '#f6c445'); R(c, x - bw / 2, yb - 9, bw, 5.5, '#f6c445'); if (lod) { c.fillStyle = '#fff'; c.font = 'bold 5px system-ui'; c.textAlign = 'center'; c.fillText('★', x, yb - 5.6); } }
  if (p.kind === 'visitor' && lod && !act && !tr.pack && p.look % 2) R(c, x + dir * 2.5, yb - 8, 2, 3, '#a55');   // sacola
  c.restore();
}

// ------------------------------------------------------------ caminhão de bombeiros
function paintTruck(c, x, y, dir, t, working) {
  // x = centro, y = linha do chão
  const w = 24, h = 6, x0 = x - w / 2;
  R(c, x0, y - h - 1.5, w, h, '#c4272d'); R(c, x0, y - 3.5, w, 1, '#f2f2f2');
  const cab = dir > 0 ? x0 + w - 8 : x0;
  R(c, cab, y - h - 4.5, 8, 4.5, '#d6323a'); R(c, cab + (dir > 0 ? 4 : 1.5), y - h - 3.6, 2.5, 2, '#bfe6f7');
  R(c, dir > 0 ? x0 + 2 : x0 + 10, y - h - 3.2, 11, 1.4, '#e8e8e8');   // escada
  const on = Math.sin(t * 10) > 0;
  R(c, cab + (dir > 0 ? 2.5 : 3), y - h - 6, 2.5, 1.5, on ? '#ff3b3b' : '#3b6bff');
  c.fillStyle = '#1b1b1f'; for (const wx of [x0 + 4, x0 + w - 5]) { c.beginPath(); c.arc(wx, y - 1.3, 1.9, 0, 7); c.fill(); }
  if (working) { R(c, x0 - 2, y - 1, w + 4, 1, '#f6c445'); }
}

// ------------------------------------------------------------ carros
const CAR_COLS = ['#c0392b', '#2e6fb5', '#d9d9d9', '#3a9d5d', '#e8a317', '#444a55'];
// carro estacionado visto de lado, com mais detalhe que o do trânsito: carroceria, vidros com coluna, maçaneta, rodas com calota, faróis (e faixa de luz à noite) e lanternas
function paintParkedCar(c, x, y, col, brake, lights, dir) {
  const body = CAR_COLS[col % CAR_COLS.length], w = 22, h = 6;
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x, y - .4, w / 2 + 1, 1.3, 0, 0, 7); c.fill();
  R(c, x - w / 2, y - h - 1.5, w, h, body); R(c, x - w / 2, y - 3, w, 1.4, 'rgba(0,0,0,.28)'); R(c, x - w / 2 + 1, y - h - 1.5, w - 2, 1, 'rgba(255,255,255,.3)');
  R(c, x - w * .27, y - h - 5, w * .52, 3.6, body); R(c, x - w * .23, y - h - 4.4, w * .2, 2.6, '#bfe3f5'); R(c, x + w * .02, y - h - 4.4, w * .2, 2.6, '#bfe3f5'); R(c, x - w * .03, y - h - 4.6, .8, 3, 'rgba(0,0,0,.35)');
  R(c, x - 1, y - h, 2, .9, 'rgba(0,0,0,.35)');   // maçaneta
  const f = dir || 1; R(c, x + f * (w / 2 - 1.6), y - h - .4, 1.6, 1.6, '#ffe9a0'); R(c, x - f * (w / 2 - .1) - (f > 0 ? 0 : 1.2), y - h - .4, 1.2, 1.6, brake ? '#ff2a2a' : '#8a2a2a');
  if (brake) { c.fillStyle = 'rgba(255,40,40,.25)'; c.beginPath(); c.arc(x - f * (w / 2 + 1), y - h + .4, 3, 0, 7); c.fill(); }
  if (lights) { c.fillStyle = 'rgba(255,240,170,.22)'; c.beginPath(); c.moveTo(x + f * (w / 2), y - h); c.lineTo(x + f * (w / 2 + 16), y - h - 3); c.lineTo(x + f * (w / 2 + 16), y - 1); c.fill(); }
  c.fillStyle = '#15171c'; for (const wx of [x - w * .3, x + w * .3]) { c.beginPath(); c.arc(wx, y - 1.5, 2.1, 0, 7); c.fill(); c.fillStyle = '#9aa0ab'; c.beginPath(); c.arc(wx, y - 1.5, .9, 0, 7); c.fill(); c.fillStyle = '#15171c'; }
}
function paintCarSide(c, x, y, dir, col, s = 1) {
  // x = centro, y = linha do chão
  const w = 15 * s, h = 4.2 * s;
  c.fillStyle = CAR_COLS[col % CAR_COLS.length];
  c.fillRect(x - w / 2, y - h - 1.5 * s, w, h);
  c.fillRect(x - w * .28 + dir * w * .04, y - h - 4 * s, w * .56, 3 * s);
  c.fillStyle = '#bfe3f5'; c.fillRect(x - w * .22 + dir * w * .04, y - h - 3.4 * s, w * .44, 2 * s);
  c.fillStyle = '#111'; c.beginPath(); c.arc(x - w * .3, y - 1, 1.6 * s, 0, 7); c.arc(x + w * .3, y - 1, 1.6 * s, 0, 7); c.fill();
  c.fillStyle = dir > 0 ? '#ffe9a0' : '#e33'; c.fillRect(x + w / 2 - 1, y - h - .5 * s, 1.4, 1.6 * s);
  c.fillStyle = dir > 0 ? '#e33' : '#ffe9a0'; c.fillRect(x - w / 2 - .4, y - h - .5 * s, 1.4, 1.6 * s);
}
function paintGarbageTruck(c, x, y, dir, s = 1) {
  const w = 24 * s, h = 7 * s, f = dir > 0 ? 1 : -1;
  c.fillStyle = '#1f5ea8'; c.fillRect(x - w / 2, y - h - 1.5 * s, w * .7, h);
  c.fillStyle = '#2a74c8'; c.fillRect(x + f * w * .2 - (f > 0 ? 0 : w * .3), y - h - .5 * s, w * .3, h - 1 * s);
  c.fillStyle = '#9fd0f0'; c.fillRect(x + f * (w * .32) - 1.5 * s, y - h + .5 * s, 3 * s, 2.4 * s);
  c.fillStyle = '#8a8f99'; c.fillRect(x - w / 2 + 1, y - h - 3 * s, w * .6, 1.8 * s);
  c.fillStyle = '#111'; c.beginPath(); c.arc(x - w * .3, y - 1, 1.7 * s, 0, 7); c.arc(x + w * .3, y - 1, 1.7 * s, 0, 7); c.fill();
}
function paintBus(c, x, y, dir, s = 1) {
  const w = 30 * s, h = 7 * s;
  c.fillStyle = '#d9a441'; c.fillRect(x - w / 2, y - h - 1.5 * s, w, h);
  c.fillStyle = '#b5832a'; c.fillRect(x - w / 2, y - 3 * s, w, 1.2 * s);
  c.fillStyle = '#bfe3f5'; for (let i = 0; i < 5; i++) c.fillRect(x - w / 2 + 2 * s + i * 5.4 * s, y - h, 4 * s, 2.6 * s);
  c.fillStyle = '#111'; c.beginPath(); c.arc(x - w * .3, y - 1, 1.7 * s, 0, 7); c.arc(x + w * .3, y - 1, 1.7 * s, 0, 7); c.fill();
  c.fillStyle = dir > 0 ? '#ffe9a0' : '#e33'; c.fillRect(x + w / 2 - 1, y - h - .5 * s, 1.4, 1.6 * s);
  c.fillStyle = dir > 0 ? '#e33' : '#ffe9a0'; c.fillRect(x - w / 2 - .4, y - h - .5 * s, 1.4, 1.6 * s);
}
function paintRain(c, W, H, t, amount, storm) {  // chuva: a quantidade, o comprimento e a inclinação (vento) crescem com a intensidade; na tempestade em duas camadas
  const layers = storm ? 2 : 1;
  for (let L = 0; L < layers; L++) {
    c.strokeStyle = 'rgba(' + (L ? '150,175,210' : '190,210,235') + ',' + ((L ? .28 : .35) * Math.min(1, amount)).toFixed(2) + ')'; c.lineWidth = L ? 1.4 : 1;
    c.beginPath();
    const n = Math.floor((storm ? 260 : 190) * amount * (L ? .6 : 1)), slant = storm ? .42 : .12, len = 8 + amount * (L ? 12 : 8);
    for (let i = 0; i < n; i++) {
      const rx = hash(i * 7 + L * 977) * (W + 120), ry = ((hash(i * 7 + 3 + L * 31) * H) + t * ((L ? 800 : 500) + hash(i) * 300)) % H;
      const ox = (ry * slant) % 60; c.moveTo(rx - ox, ry); c.lineTo(rx - ox - len * slant, ry + len);
    }
    c.stroke();
  }
}

// ------------------------------------------------------------ helicóptero, Papai Noel, neve, fogos
function paintHeli(c, x, y, t, dir, spin = 30) {
  c.save(); c.translate(x, y); c.scale(dir, 1);
  R(c, -10, -6, 20, 9, '#c0392b'); R(c, -6, -9, 10, 4, '#c0392b'); R(c, 2, -8, 6, 5, '#bfe3f5');
  R(c, -22, -4, 13, 2, '#992d22'); R(c, -23, -8, 2, 6, '#992d22');
  R(c, -9, 5, 18, 1.2, '#555'); R(c, -6, 3, 1.2, 2.5, '#555'); R(c, 5, 3, 1.2, 2.5, '#555');
  const rl = 14 * Math.abs(Math.cos(t * spin));
  R(c, -rl, -11, rl * 2, 1.2, '#222'); R(c, -1, -11, 2, 3, '#444');
  c.restore();
}
// o que o helicóptero larga enquanto paira: a sacola do resgate da bomba, ou água sobre a sala em chamas
function paintHeliDrop(c, hl, x, y, t) {
  if (hl.phase !== 'hold') return;
  if (hl.reason === 'bomb') {
    const u = clamp(1 - hl.hold / 6, 0, 1), by = y + 6 + u * 22;
    c.strokeStyle = '#d9d2c0'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y + 4); c.lineTo(x, by); c.stroke();
    R(c, x - 4, by, 8, 7, '#7a5535'); R(c, x - 2, by - 2, 4, 2, '#7a5535');
    c.fillStyle = '#ffd24a'; c.font = 'bold 7px system-ui'; c.textAlign = 'center'; c.fillText('$', x, by + 6);
  } else if (hl.reason === 'fire' && hl.fac && !hl.fac.dead) {
    const tx = (hl.fac.x + hl.fac.w / 2) * U, ty = -(hl.fac.L + 0.5) * FH;
    for (let i = 0; i < 9; i++) {
      const ph = (t * 1.6 + i / 9) % 1, px = x + (tx - x) * ph, py = y + 5 + (ty - y - 5) * ph * ph;
      c.fillStyle = 'rgba(130,200,255,.85)'; c.beginPath(); c.arc(px, py, 1.3 + ph * 1.2, 0, 7); c.fill();
    }
  }
}
function paintSanta(c, x, y, t) {
  c.save(); c.translate(x, y);
  for (let i = 0; i < 3; i++) { const rx = 26 + i * 15; R(c, rx, -4 + Math.sin(t * 6 + i) * 1.5, 9, 4, '#8a5a2b'); R(c, rx + 8, -7 + Math.sin(t * 6 + i) * 1.5, 3, 3, '#8a5a2b'); R(c, rx + 11, -8 + Math.sin(t * 6 + i) * 1.5, 1, 2, '#d9d9d9'); }
  R(c, 0, -5, 22, 7, '#b21f2d'); R(c, -2, 2, 26, 1.6, '#c9a227'); R(c, 4, -12, 6, 7, '#c0392b'); R(c, 4, -15, 6, 3, '#f2cfa8'); R(c, 3, -17, 8, 2.4, '#b21f2d'); R(c, 11, -17, 2, 2, '#fff');
  R(c, 24, -2, 3, 1, '#c9a227');
  c.restore();
}
function paintSnow(c, W, H, t, amount, storm) {   // neve: flocos mais numerosos, maiores e levados pelo vento conforme a intensidade (nevasca)
  c.fillStyle = 'rgba(255,255,255,' + (0.8 * Math.min(1, amount)).toFixed(2) + ')';
  const n = Math.floor((storm ? 260 : 170) * amount), sz = amount > .8 ? 3 : 2, drift = storm ? 90 : 14;
  for (let i = 0; i < n; i++) {
    const rx = (hash(i * 5) * W + Math.sin(t * .8 + i) * 12 + t * drift * (storm ? 1 : .15) * (.4 + hash(i + 9)) + W * 4) % W, ry = (hash(i * 5 + 2) * H + t * (30 + hash(i) * 40) * (storm ? 1.8 : 1)) % H;
    c.fillRect(rx, ry, sz, sz);
  }
}
function paintFireworks(c, cx, cy, t) {
  for (let k = 0; k < 3; k++) {
    const ph = (t * .35 + k * .33) % 1, id = Math.floor(t * .35 + k * .33), ox = (hash(id * 3 + k) - .5) * 260, oy = -50 - hash(id * 5 + k) * 70;
    if (ph < .12) continue;
    const r = (ph - .12) * 90, a = 1 - ph;
    c.fillStyle = ['#ffd24a', '#ff6b6b', '#6fe39b', '#7fb4ff'][(id + k) % 4];
    c.globalAlpha = Math.max(0, a);
    for (let i = 0; i < 18; i++) { const an = i / 18 * 6.283; c.fillRect(cx + ox + Math.cos(an) * r, cy + oy + Math.sin(an) * r + ph * 20, 2, 2); }
    c.globalAlpha = 1;
  }
}

function paintFight(c, x, y, w, h, t) {
  const cx = x + w / 2;
  c.fillStyle = 'rgba(200,200,200,.55)';
  for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(cx + Math.sin(t * 7 + i * 1.7) * 10, y + h - SLAB - 8 + Math.cos(t * 9 + i) * 3, 5 + (i % 2) * 2, 0, 7); c.fill(); }
  c.fillStyle = (Math.floor(t * 4) % 2) ? '#ff4040' : '#ffd24a'; c.font = 'bold 12px system-ui'; c.textAlign = 'center'; c.fillText('!!', cx, y + 12);
}

// sala sem energia (escurece e mostra um raio amarelo piscando) e/ou sem água (gota azul): o jogador vê até onde a rede chega
function paintNoUtil(c, x, y, w, h, cutE, cutA, t, lod) {
  if (cutE) R(c, x, y, w, h - SLAB, 'rgba(8,12,24,.5)');
  if (!lod) return;
  const on = Math.sin(t * 4) > -.3, cx = x + 6;
  if (cutE && on) { c.fillStyle = '#ffd23a'; c.beginPath(); c.moveTo(cx + 2, y + 3); c.lineTo(cx - 3, y + 11); c.lineTo(cx, y + 11); c.lineTo(cx - 2, y + 18); c.lineTo(cx + 4, y + 9); c.lineTo(cx + 1, y + 9); c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = .6; c.stroke(); }
  if (cutA) { const dx = cutE ? cx + 9 : cx; c.fillStyle = '#4fb0ff'; c.beginPath(); c.moveTo(dx, y + 4); c.quadraticCurveTo(dx + 4, y + 11, dx, y + 14); c.quadraticCurveTo(dx - 4, y + 11, dx, y + 4); c.fill(); c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = .6; c.stroke(); }
}
