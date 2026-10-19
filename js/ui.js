'use strict';
// Arranha-Céu — interface: barra de ferramentas, entrada, painéis.

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const money = fmtMoney;

const MODE = {lobby: 'h', floor: 'h', parkspace: 'h', carlift: 'v', elevator: 'v', express: 'v', service: 'v', stairs: 's', escalator: 's', bulldoze: 'b', adjust: 'a', inspect: 'i'};
const TOOLS = [
  ['inspect'], ['bulldoze'], ['adjust'],
  // dentro de cada grupo, os itens seguem a ordem de estrelas (1★, 2★, 3★...)
  ['Construir', 'lobby', 'floor', 'corridor', 'corridorCam', 'corridorExt', 'corridorHyd', 'corridorSpr'], ['Escadas', 'stairs', 'escalator'],
  ['Elevadores', 'elevator', 'service', 'express'],
  ['Escritórios', 'office', 'coworking', 'officeEx'], ['Apartamentos', 'kitnet', 'condo', 'penthouse'],
  ['Hotel', 'single', 'housekeeping', 'twin', 'suite'],
  ['Comida', 'cafe', 'fastfood', 'bar', 'restaurant'], ['Comércio', 'mercado', 'shop', 'banco'],
  ['Lazer', 'jardim', 'academia', 'party', 'cinema', 'piscina', 'auditorio'],
  ['Serviços', 'security', 'lavanderia', 'creche', 'clinic'], ['Lixo', 'lixo', 'recycling'],
  ['Garagem', 'bike', 'parkspace', 'parkramp', 'carlift'],
  ['Utilidades', 'bomba', 'bombaMedia', 'bombaRecalque', 'bombaForte', 'caixa', 'caixaMedia', 'caixaGrande', 'caixaTorre', 'gerador', 'bateriaPequena', 'bateria', 'bateriaGrande', 'solar', 'geradorGas', 'tratamento'], ['Transporte', 'busstop', 'taxi', 'transit'], ['Túneis', 'tunnel', 'tunnelPortal', 'tunnelPortal2', 'tunnelCam', 'tunnelExt', 'tunnelHyd', 'tunnelSpr'], ['heliport'], ['landmark'],
];
const TOOL_LABEL = {inspect: 'Inspecionar', bulldoze: 'Demolir', adjust: 'Ajustar', floor: 'Piso'};
const LABEL = id => TOOL_LABEL[id] || (FAC[id] && FAC[id].label) || (TRANSPORT[id] && TRANSPORT[id].label) || id;
const STAR = id => (FAC[id] && FAC[id].star) || (TRANSPORT[id] && TRANSPORT[id].star) || 1;
const COST = id => FAC[id] ? money(FAC[id].cost) : TRANSPORT[id] ? money(TRANSPORT[id].cost) : id === 'floor' ? money(FLOOR_COST) + '/un.' : '';

// ------------------------------------------------------------ ícones
function icon(id) {
  if (id === 'tunnelDown' || id.startsWith('tunnelPortal')) return icon('parkramp');
  if (id.startsWith('tunnel')) return icon(id.replace('tunnel', 'corridor'));
  const col = (FAC[id] && FAC[id].col) || '#8aa0c0';
  const W = '#f2f5fa';
  const body = {
    inspect: `<circle cx="11" cy="9" r="5.2" fill="none" stroke="${W}" stroke-width="2"/><path d="M15 13l6 6" stroke="${W}" stroke-width="2.4" stroke-linecap="round"/>`,
    bulldoze: `<path d="M4 17h15l-2.5-8H9z" fill="#e5484d"/><rect x="2" y="17" width="20" height="2.5" fill="${W}"/><path d="M9 9l-3-4" stroke="${W}" stroke-width="2"/>`,
    adjust: `<path d="M3 6h20M3 11h20M3 16h20" stroke="#6b7a96" stroke-width="2"/><circle cx="8" cy="6" r="2.4" fill="${W}"/><circle cx="16" cy="11" r="2.4" fill="#f6c445"/><circle cx="11" cy="16" r="2.4" fill="${W}"/>`,
    lobby: `<rect x="3" y="4" width="20" height="15" rx="1" fill="${col}"/><rect x="6" y="7" width="5" height="12" fill="#bfe6f7"/><rect x="15" y="7" width="5" height="12" fill="#bfe6f7"/><rect x="11" y="8" width="4" height="11" fill="#6b6350"/>`,
    floor: `<rect x="2" y="12" width="22" height="4" fill="#7b7f86"/><path d="M5 12v-4M13 12v-4M21 12v-4" stroke="#aeb4bd" stroke-width="1.5"/>`,
    stairs: `<path d="M3 19h5v-4h5v-4h5v-4h5" fill="none" stroke="${W}" stroke-width="2.2"/><path d="M3 19h20" stroke="#6b7a96" stroke-width="1"/>`,
    escalator: `<path d="M3 18L23 6" stroke="${W}" stroke-width="2.2"/><path d="M3 22L23 10" stroke="#9aa6bf" stroke-width="1.5"/><path d="M12 8l3 3" stroke="#f6c445" stroke-width="2"/>`,
    elevator: `<rect x="5" y="2" width="16" height="19" rx="1.5" fill="none" stroke="${W}" stroke-width="2"/><path d="M10 9l3-4 3 4M10 14l3 4 3-4" fill="${W}"/>`,
    express: `<rect x="5" y="2" width="16" height="19" rx="1.5" fill="none" stroke="#f6c445" stroke-width="2"/><path d="M10 10l3-5 3 5M10 17l3-5 3 5" fill="#f6c445"/>`,
    carlift: `<rect x="4" y="2" width="18" height="19" rx="1.5" fill="none" stroke="#8fb4d9" stroke-width="2"/><path d="M7 15l1.6-3.6h8.8L19 15v3H7z" fill="#8fb4d9"/><circle cx="10" cy="18" r="1.6" fill="#1d2230"/><circle cx="16" cy="18" r="1.6" fill="#1d2230"/><path d="M13 4v5M11 6.5l2-2.5 2 2.5" stroke="#fff" stroke-width="1.6" fill="none"/>`,
    service: `<rect x="5" y="2" width="16" height="19" rx="1.5" fill="none" stroke="#7fc08a" stroke-width="2"/><path d="M9 11h8M13 7v8" stroke="#7fc08a" stroke-width="2"/>`,
    corridor: `<rect x="2" y="6" width="22" height="12" fill="${col}"/><rect x="2" y="16" width="22" height="3" fill="#6f684f"/><path d="M6 9h14" stroke="#7c7460" stroke-width="1.5" stroke-dasharray="3 2"/>`,
    corridorExt: `<rect x="2" y="6" width="22" height="12" fill="#a39a80"/><rect x="2" y="16" width="22" height="3" fill="#6f684f"/><rect x="10" y="8" width="6" height="10" rx="2" fill="#d33"/><rect x="11.5" y="6" width="3" height="3" fill="#333"/><path d="M16 8c3 0 3 4 5 4" stroke="#222" stroke-width="1.2" fill="none"/>`,
    corridorSpr: `<rect x="2" y="6" width="22" height="12" fill="#a39a80"/><rect x="2" y="16" width="22" height="3" fill="#6f684f"/><path d="M2 8h22" stroke="#7aa6c2" stroke-width="2"/><path d="M8 8v3M18 8v3" stroke="#7aa6c2" stroke-width="1.5"/><path d="M6 13l2 2 2-2M16 13l2 2 2-2" stroke="#5bb8ff" stroke-width="1.2" fill="none"/>`,
    corridorHyd: `<rect x="2" y="6" width="22" height="12" fill="#a39a80"/><rect x="2" y="16" width="22" height="3" fill="#6f684f"/><rect x="10" y="9" width="6" height="9" rx="2" fill="#f2c230"/><rect x="9" y="8" width="8" height="2" fill="#d4a017"/><rect x="7.5" y="12" width="2.5" height="3" fill="#d4a017"/><rect x="16" y="12" width="2.5" height="3" fill="#d4a017"/>`,
    corridorCam: `<rect x="2" y="6" width="22" height="12" fill="#a39a80"/><rect x="2" y="16" width="22" height="3" fill="#6f684f"/><rect x="8" y="8" width="10" height="5" rx="2" fill="#2b3440"/><circle cx="17" cy="10.5" r="2.2" fill="#7fe3e3"/><path d="M13 13v3M10 16h6" stroke="#2b3440" stroke-width="1.4"/>`,
    cafe: `<path d="M6 8h11v6a5 5 0 01-5 5h-1a5 5 0 01-5-5z" fill="#f4efe6" stroke="#6b4a2c" stroke-width="1.6"/><path d="M17 10h2a2.5 2.5 0 010 5h-2" fill="none" stroke="#6b4a2c" stroke-width="1.6"/><path d="M9 3c-1 1.5 1 2.5 0 4M13 3c-1 1.5 1 2.5 0 4" stroke="${W}" stroke-width="1.2" fill="none"/>`,
    coworking: `<rect x="3" y="12" width="20" height="3" fill="#9aa59a"/><rect x="5" y="15" width="2" height="5" fill="#9aa59a"/><rect x="19" y="15" width="2" height="5" fill="#9aa59a"/><rect x="7" y="5" width="12" height="7" rx="1" fill="#33506f"/><rect x="8.5" y="6.5" width="9" height="4" fill="#bfe6f7"/>`,
    mercado: `<path d="M3 5h3l2 9h10l2-7H8" fill="none" stroke="${W}" stroke-width="1.8" stroke-linejoin="round"/><circle cx="10" cy="18" r="1.8" fill="${W}"/><circle cx="17" cy="18" r="1.8" fill="${W}"/><rect x="10" y="8" width="3" height="3" fill="#e5484d"/><rect x="14" y="8" width="3" height="3" fill="#6fbf4a"/>`,
    lavanderia: `<rect x="5" y="3" width="16" height="18" rx="2" fill="#e8f0f8" stroke="#6b7a96" stroke-width="1.5"/><circle cx="13" cy="13" r="5.5" fill="#7fb8e0" stroke="#4a6f9f" stroke-width="1.5"/><circle cx="8" cy="6.5" r="1" fill="#e5484d"/><path d="M10.5 13c1-1.5 2-1.5 3 0s2 1.5 3 0" stroke="${W}" stroke-width="1" fill="none"/>`,
    jardim: `<circle cx="13" cy="8" r="6" fill="#4f9f4a"/><circle cx="9" cy="10" r="4" fill="#5fb85a"/><circle cx="17" cy="10" r="4" fill="#5fb85a"/><rect x="12" y="12" width="2" height="8" fill="#7a5535"/><rect x="3" y="19" width="20" height="2" fill="#6b8f4a"/>`,
    banco: `<path d="M3 9l10-6 10 6z" fill="#c9d3e0"/><rect x="5" y="10" width="3" height="8" fill="#e8ecf2"/><rect x="11.5" y="10" width="3" height="8" fill="#e8ecf2"/><rect x="18" y="10" width="3" height="8" fill="#e8ecf2"/><rect x="3" y="18" width="20" height="3" fill="#9aa6bf"/><text x="13" y="8.5" font-size="6" text-anchor="middle" fill="#33506f" font-weight="bold">$</text>`,
    office: `<rect x="4" y="3" width="18" height="17" fill="${col}"/>${[0, 1, 2].map(r => [0, 1, 2].map(c2 => `<rect x="${6 + c2 * 5.5}" y="${5 + r * 5}" width="3.4" height="3" fill="#33506f"/>`).join('')).join('')}`,
    officeEx: `<rect x="2" y="2" width="22" height="18" fill="${col}"/>${[0, 1, 2].map(r => [0, 1, 2, 3].map(c2 => `<rect x="${4 + c2 * 5}" y="${4 + r * 5.2}" width="3.3" height="3.2" fill="#33506f"/>`).join('')).join('')}`,
    kitnet: `<path d="M5 11L13 4l8 7z" fill="#b5532d"/><rect x="6" y="11" width="14" height="9" fill="${col}"/><rect x="11" y="15" width="4" height="5" fill="#7a5535"/>`,
    condo: `<path d="M3 11L13 3l10 8z" fill="#b5532d"/><rect x="5" y="11" width="16" height="9" fill="${col}"/><rect x="11" y="14" width="4" height="6" fill="#7a5535"/>`,
    penthouse: `<rect x="2" y="12" width="22" height="8" fill="${col}"/><path d="M4 12L13 5l9 7z" fill="#b5532d"/><rect x="6" y="2" width="8" height="4" fill="#9fb8cc"/><rect x="9" y="15" width="5" height="5" fill="#7a5535"/>`,
    single: `<rect x="3" y="11" width="20" height="6" fill="#f4f1e8"/><rect x="3" y="8" width="5" height="5" fill="#fff"/><rect x="3" y="17" width="2" height="3" fill="#7a5535"/><rect x="21" y="17" width="2" height="3" fill="#7a5535"/>`,
    twin: `<rect x="2" y="12" width="10" height="5" fill="#f4f1e8"/><rect x="14" y="12" width="10" height="5" fill="#f4f1e8"/><rect x="2" y="9" width="4" height="4" fill="#fff"/><rect x="14" y="9" width="4" height="4" fill="#fff"/><rect x="2" y="17" width="22" height="2" fill="#7a5535"/>`,
    suite: `<rect x="3" y="12" width="20" height="6" fill="#e8dcf4"/><rect x="3" y="9" width="6" height="5" fill="#fff"/><path d="M17 3l1.4 3 3.2.4-2.4 2.2.7 3.2-2.9-1.7-2.9 1.7.7-3.2-2.4-2.2 3.2-.4z" fill="#f6c445"/>`,
    housekeeping: `<rect x="5" y="10" width="14" height="8" fill="#7ab"/><path d="M7 10V5h5" stroke="${W}" stroke-width="2" fill="none"/><circle cx="8" cy="20" r="1.8" fill="${W}"/><circle cx="16" cy="20" r="1.8" fill="${W}"/>`,
    fastfood: `<path d="M5 10a8 6 0 0116 0z" fill="#e8a24a"/><rect x="5" y="11" width="16" height="2.4" fill="#4a8a3a"/><rect x="5" y="13.4" width="16" height="2.6" fill="#8a3a2a"/><path d="M5 16h16v2a2 2 0 01-2 2H7a2 2 0 01-2-2z" fill="#e8a24a"/>`,
    restaurant: `<circle cx="13" cy="12" r="8" fill="none" stroke="${W}" stroke-width="1.6"/><path d="M8 4v16M6.5 4v5a1.5 1.5 0 003 0V4M19 4c-2 2-2 6 0 8v8" stroke="${W}" stroke-width="1.5" fill="none"/>`,
    bar: `<path d="M5 5h16l-8 9z" fill="none" stroke="${W}" stroke-width="1.6"/><path d="M13 14v6M9 20h8" stroke="${W}" stroke-width="1.6"/><circle cx="18" cy="6" r="2" fill="#9acd32"/>`,
    shop: `<path d="M5 9h16l-1.5 11h-13z" fill="${col}"/><path d="M9 9V6a4 4 0 018 0v3" fill="none" stroke="${W}" stroke-width="1.8"/>`,
    party: `<circle cx="9" cy="8" r="4" fill="#e5484d"/><circle cx="16" cy="7" r="4" fill="#f6c445"/><circle cx="13" cy="12" r="4" fill="#4aa3df"/><path d="M9 12l2 9M16 11l-3 10M13 16l1 5" stroke="${W}" stroke-width="1"/>`,
    cinema: `<rect x="3" y="6" width="20" height="13" rx="1" fill="#2b2f4a" stroke="${W}" stroke-width="1.5"/><path d="M11 9.5l6 3.2-6 3.2z" fill="${W}"/><path d="M3 6l3-4M9 6l3-4M15 6l3-4" stroke="${W}" stroke-width="1.6"/>`,
    security: `<path d="M13 2l9 3v6c0 5-4 9-9 11C8 20 4 16 4 11V5z" fill="#3b5878" stroke="#e8c648" stroke-width="1.6"/><path d="M13 7l1.3 2.8 3 .4-2.2 2.1.6 3L13 13.8 10.3 15.3l.6-3L8.7 10.2l3-.4z" fill="#e8c648"/>`,
    clinic: `<rect x="4" y="4" width="18" height="16" rx="2" fill="#e4f0f1"/><path d="M13 7v10M8 12h10" stroke="#d33" stroke-width="3"/>`,
    recycling: `<path d="M13 3l4 7H9zM20 15l-4 7-4-4zM6 15l-4 4h8z" fill="none"/><path d="M7 12a6 6 0 019-5M19 12a6 6 0 01-9 5" fill="none" stroke="#7fd68a" stroke-width="2.2"/><path d="M16 4l1 4-4 1M10 20l-1-4 4-1" fill="#7fd68a"/>`,
    parkspace: `<rect x="3" y="3" width="20" height="17" rx="2" fill="#5a5f6b"/><path d="M10 17V6h4a3.2 3.2 0 010 6.4h-4" fill="none" stroke="${W}" stroke-width="2.2"/>`,
    academia: `<rect x="3" y="3" width="20" height="17" rx="2" fill="#d98a4e"/><path d="M6 11.5h14M7 8v7M10 9.5v4M16 9.5v4M19 8v7" stroke="${W}" stroke-width="2" fill="none"/>`,
    creche: `<rect x="3" y="3" width="20" height="17" rx="2" fill="#f0c75e"/><circle cx="13" cy="9" r="3" fill="${W}"/><path d="M7 18c0-4 3-5 6-5s6 1 6 5z" fill="${W}"/>`,
    piscina: `<rect x="3" y="3" width="20" height="17" rx="2" fill="#5db7d9"/><path d="M5 12q2-2 4 0t4 0 4 0 4 0M5 16q2-2 4 0t4 0 4 0 4 0" stroke="${W}" stroke-width="1.8" fill="none"/>`,
    auditorio: `<rect x="3" y="3" width="20" height="17" rx="2" fill="#6a4a8a"/><path d="M6 8h14l-2 5H8zM8 16h10" stroke="${W}" stroke-width="1.8" fill="none"/>`,
    busstop: `<rect x="3" y="3" width="20" height="17" rx="2" fill="#d9a441"/><rect x="5" y="8" width="16" height="7" rx="2" fill="${W}"/><rect x="7" y="9.5" width="3" height="2.5" fill="#9ad"/><rect x="12" y="9.5" width="3" height="2.5" fill="#9ad"/><circle cx="8" cy="16" r="1.5" fill="#333"/><circle cx="18" cy="16" r="1.5" fill="#333"/>`,
    taxi: `<rect x="3" y="3" width="20" height="17" rx="2" fill="#e8c623"/><rect x="5" y="10" width="16" height="5" rx="1.5" fill="#222"/><rect x="10" y="7" width="6" height="3" fill="#222"/><circle cx="8" cy="16" r="1.5" fill="${W}"/><circle cx="18" cy="16" r="1.5" fill="${W}"/>`,
    heliport: `<rect x="3" y="3" width="20" height="17" rx="2" fill="#8a929e"/><circle cx="13" cy="11.5" r="6.5" fill="none" stroke="${W}" stroke-width="1.6"/><path d="M10.5 8v7M15.5 8v7M10.5 11.5h5" stroke="${W}" stroke-width="2"/>`,
    gerador: `<rect x="3" y="3" width="20" height="17" rx="2" fill="#7a6a3a"/><path d="M14 4l-5 9h4l-1 6 6-10h-4z" fill="#ffd24a"/>`,
    solar: `<rect x="3" y="3" width="20" height="17" rx="2" fill="#2a4f8a"/><path d="M5 9h16M5 14h16M10 5v13M16 5v13" stroke="#9cc2f0" stroke-width="1.2"/>`,
    bomba: `<rect x="3" y="3" width="20" height="17" rx="2" fill="#4f7f9f"/><circle cx="11" cy="12" r="4.5" fill="none" stroke="${W}" stroke-width="1.6"/><path d="M15 12h6M11 8v8" stroke="${W}" stroke-width="1.6"/>`,
    bombaMedia: `<rect x="3" y="3" width="20" height="17" rx="2" fill="#4f7f9f"/><circle cx="11" cy="12" r="4.5" fill="none" stroke="${W}" stroke-width="1.6"/><path d="M15 12h6M11 8v8" stroke="${W}" stroke-width="1.6"/>`,
    bombaRecalque: `<rect x="3" y="3" width="20" height="17" rx="2" fill="#4f7f9f"/><circle cx="11" cy="12" r="4.5" fill="none" stroke="${W}" stroke-width="1.6"/><path d="M15 12h6M11 8v8" stroke="${W}" stroke-width="1.6"/>`,
    bombaForte: `<rect x="3" y="3" width="20" height="17" rx="2" fill="#4f7f9f"/><circle cx="11" cy="12" r="4.5" fill="none" stroke="${W}" stroke-width="1.6"/><path d="M15 12h6M11 8v8" stroke="${W}" stroke-width="1.6"/>`,
    bateria: `<rect x="3" y="3" width="20" height="17" rx="2" fill="#4a8a5a"/><rect x="6" y="8" width="13" height="8" rx="1.5" fill="none" stroke="${W}" stroke-width="1.6"/><rect x="19" y="10.5" width="2" height="3" fill="${W}"/><path d="M12 9l-2 4h3l-1 3 3-5h-3z" fill="${W}"/>`,
    bateriaPequena: `<rect x="3" y="3" width="20" height="17" rx="2" fill="#5a9a6a"/><rect x="9" y="7" width="8" height="10" rx="1.5" fill="none" stroke="${W}" stroke-width="1.5"/><rect x="11.5" y="5.5" width="3" height="1.5" fill="${W}"/>`,
    bateriaGrande: `<rect x="3" y="3" width="20" height="17" rx="2" fill="#3a7a4a"/><rect x="5" y="8" width="5" height="8" rx="1" fill="none" stroke="${W}" stroke-width="1.3"/><rect x="10.5" y="8" width="5" height="8" rx="1" fill="none" stroke="${W}" stroke-width="1.3"/><rect x="16" y="8" width="5" height="8" rx="1" fill="none" stroke="${W}" stroke-width="1.3"/><path d="M13 4.5l-2 3h2.5l-1 2.5" stroke="#ffd36b" stroke-width="1.2" fill="none"/>`,
    geradorGas: `<rect x="3" y="3" width="20" height="17" rx="2" fill="#8a6a4a"/><path d="M13 5c3 4 5 6 5 9a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3 0-5 1-8z" fill="#ffb23a"/>`,
    caixa: `<rect x="3" y="3" width="20" height="17" rx="2" fill="#5a8fb8"/><path d="M13 5c3 4 5 6 5 9a5 5 0 01-10 0c0-3 2-5 5-9z" fill="${W}"/>`,
    caixaMedia: `<rect x="3" y="3" width="20" height="17" rx="2" fill="#4f86b0"/><path d="M13 5c3 4 5 6 5 9a5 5 0 01-10 0c0-3 2-5 5-9z" fill="${W}"/><path d="M6 17h14" stroke="${W}" stroke-width="1.4"/>`,
    caixaGrande: `<rect x="3" y="3" width="20" height="17" rx="2" fill="#3f78a4"/><path d="M13 5c3 4 5 6 5 9a5 5 0 01-10 0c0-3 2-5 5-9z" fill="${W}"/><path d="M6 16h14M6 18.5h14" stroke="${W}" stroke-width="1.2"/>`,
    caixaTorre: `<rect x="3" y="3" width="20" height="17" rx="2" fill="#2f6c9a"/><path d="M13 5c3 4 5 6 5 9a5 5 0 01-10 0c0-3 2-5 5-9z" fill="${W}"/><path d="M20 17V9M17.5 11.5L20 9l2.5 2.5" stroke="#ffd36b" stroke-width="1.6" fill="none"/>`,
    tratamento: `<rect x="3" y="3" width="20" height="17" rx="2" fill="#4a7a7a"/><circle cx="13" cy="11" r="5" fill="none" stroke="${W}" stroke-width="1.6"/><path d="M8 11h10M13 6v10" stroke="${W}" stroke-width="1.2"/>`,
    lixo: `<rect x="3" y="3" width="20" height="17" rx="2" fill="#6a6f55"/><path d="M8 8h10l-1 11H9z" fill="none" stroke="${W}" stroke-width="1.6"/><path d="M7 8h12M11 6h4" stroke="${W}" stroke-width="1.6"/>`,
    bike: `<rect x="3" y="3" width="20" height="17" rx="2" fill="#6f8a6a"/><circle cx="8" cy="15" r="3" fill="none" stroke="${W}" stroke-width="1.6"/><circle cx="18" cy="15" r="3" fill="none" stroke="${W}" stroke-width="1.6"/><path d="M8 15l4-6h4l2 6M12 9l-1-2" fill="none" stroke="${W}" stroke-width="1.6"/>`,
    parkramp: `<path d="M2 19h22V8z" fill="#6a6f7c"/><path d="M4 17l16-7" stroke="#ddd" stroke-dasharray="2 2"/>`,
    transit: `<rect x="4" y="4" width="18" height="14" rx="4" fill="#c8d"/><rect x="7" y="7" width="5" height="4" fill="#9df"/><rect x="14" y="7" width="5" height="4" fill="#9df"/><circle cx="8" cy="15" r="1.2" fill="#222"/><circle cx="18" cy="15" r="1.2" fill="#222"/><path d="M6 21l3-3M20 21l-3-3" stroke="${W}" stroke-width="1.6"/>`,
    landmark: `<path d="M4 20V11l9-7 9 7v9z" fill="#e8d28a"/><rect x="12.4" y="1" width="1.4" height="5" fill="#caa"/><circle cx="13" cy="12" r="3" fill="#4a6f9f"/>`,
  }[id] || `<rect x="4" y="4" width="18" height="15" fill="${col}"/>`;
  return `<svg viewBox="0 0 26 22" aria-hidden="true">${body}</svg>`;
}

// ------------------------------------------------------------ UI
class UI {
  constructor(app) {
    this.app = app;
    this.tool = 'inspect';
    this.groupSel = {};
    this.anchor = null; this.drag = null;
    this.pointers = new Map(); this.panDrag = null;
    this.space = false; this.modalOpen = false;
    this.prevSpeed = 1; this.overlay = 'none';
    this.tq = []; this.cycle = []; this.day0 = null; this.dayNew = 0; this.tickerIdle = true; this.notes = [];
    this.panelRefresh = null;
    this.buildToolbar(); this.bindInput(); this.bindBar();
    this.nextTicker(); setInterval(() => this.pruneNotes(), 500); setInterval(() => { if (this.tickerIdle) this.nextTicker(); }, 3000);
  }
  get g() { return this.app.game; }
  get r() { return this.app.renderer; }

  // ------------------------------------------------------------ mensagens
  onGameEvent(type, d) {
    if (type === 'msg') { this.showTicker(d.text, d.cls, d); this.notify(d); }
    else if (type === 'sound') this.app.soundAt(d.name, d.L, d.x, d);
    else if (type === 'star') { this.buildToolbar(); this.showStarPanel(true); }
    else if (type === 'day') { this.dailySummary(); this.app.autosave(); }
    else if (type === 'quarter') { if (!this.modalOpen) this.showFinance(true); }   // o trimestre acabou de zerar: abre o relatório do que fechou (senão a janela aberta depois mostraria tudo zerado); não pausa o jogo
  }
  // notificações na tela (estilo SimCity): cartões empilhados, clicáveis. Incêndio, bomba e briga ficam até o problema acabar
  notify(d) {
    const box = $('#notes'); if (!box || this.msgKind(d.text) === 'quiet') return;
    const now = Date.now(), kind = d.fac ? ({'🔥': 'fire', '💣': 'bomb', '👊': 'fight'})[[...d.text][0]] : null;
    const sticky = kind && d.fac[kind] && !/espalhou|destruiu|explodiu|Prejuízo/.test(d.text);
    if (this.notes.some(n => n.text === d.text && now - n.born < 3000)) return;
    const el = document.createElement('div');
    el.className = 'note ' + (d.cls || 'info') + (sticky ? ' sticky' : '');
    el.innerHTML = `<span class="nt">${esc(d.text)}</span>${d.at ? '<small>toque para ver</small>' : ''}<button class="nx" aria-label="Dispensar">×</button>`;
    const n = {el, text: d.text, born: now, ttl: sticky ? 120000 : d.cls === 'bad' ? 15000 : 8000, sticky, kind, fac: d.fac, at: d.at};
    el.onclick = e => {
      if (e.target.classList.contains('nx')) { this.dropNote(n); return; }
      if (!n.at) return;
      this.r.centerOn(n.at.x * U, -(n.at.L + .5) * FH);
      if (n.fac && !n.fac.dead) this.r.selected = n.fac;
      if (!n.sticky) this.dropNote(n);
    };
    this.notes.push(n); box.appendChild(el);
    while (this.notes.length > 5) this.dropNote(this.notes.find(x => !x.sticky) || this.notes[0]);
  }
  dropNote(n) {
    const i = this.notes.indexOf(n); if (i < 0) return;
    this.notes.splice(i, 1); n.el.classList.add('out'); setTimeout(() => n.el.remove(), 250);
  }
  pruneNotes() {
    const now = Date.now();
    for (const n of this.notes.slice()) {
      const age = now - n.born;
      if (n.sticky && age > 4000 && (!n.fac || n.fac.dead || !n.fac[n.kind])) this.dropNote(n);
      else if (age > n.ttl) this.dropNote(n);
    }
  }
  // letreiro deslizante, em ciclos: 1º o que exige ação (incêndio, bomba, briga, baratas, quartos sujos, fila, sala sem acesso...),
  // repetido a cada ciclo até resolver; depois os avisos que só informam (furto, fogo apagado...), cada um uma única vez.
  // Rotina (nova empresa, trimestre, obras...) não vira aviso, e problemas parecidos (inquilinos insatisfeitos) viram uma linha só.
  msgKind(text) {
    if (/^(🔥 Incêndio|💣 Ameaça|👊 Briga|🪳|🏨)/.test(text)) return 'action';
    if (/Nova empresa|Apartamento vendido|Nova boutique|Fim de trimestre|instalados|Dedetização|Reconstrução|extintor|devolvid|substituído|Os sprinklers|Papai Noel deixou/.test(text)) return 'quiet';
    return 'info';
  }
  showTicker(text, cls, d) {
    const k = this.msgKind(text);
    if (/Nova empresa|Apartamento vendido|Nova boutique/.test(text)) this.dayNew++;
    if (k === 'quiet') return;
    if (k === 'action') {
      // não corta o que está passando: o problema novo vira o próximo da fila, antes do resto do ciclo
      const items = this.actionItems(), i = d && d.fac ? items.findIndex(x => x.fac === d.fac) : -1;
      if (i > 0) items.unshift(items.splice(i, 1)[0]);
      this.cycle = items.concat(this.tq.splice(0));
      if (this.tickerIdle) this.nextTicker();
      return;
    }
    this.tq.push({text, cls, at: d && d.at, fac: d && d.fac}); if (this.tq.length > 8) this.tq.shift();
    if (this.tickerIdle) this.nextTicker();
  }
  alertTarget(a) {
    const go = a.actions.find(x => x.type === 'goto');
    return go ? {at: {L: go.L, x: go.x}, fac: go.fac} : {};
  }
  goTo(it) {
    if (!it.at) return;
    this.r.centerOn(it.at.x * U, -(it.at.L + .5) * FH);
    if (it.fac && !it.fac.dead) this.r.selected = it.fac;
  }
  // resumo do dia (como o jornal do SimCity): só o que mudou de verdade, e nada se não mudou nada
  dailySummary() {
    const g = this.g, p = this.day0, now = {pop: g.pop, ev: g.avgEval, funds: g.funds};
    this.day0 = now;
    const n = this.dayNew; this.dayNew = 0;
    if (!p) return;
    const parts = [];
    if (n) parts.push(n + (n > 1 ? ' novos inquilinos' : ' novo inquilino'));
    if (Math.abs(now.pop - p.pop) >= 10) parts.push('população ' + (now.pop > p.pop ? 'subiu' : 'caiu') + ' para ' + now.pop);
    if (Math.abs(now.ev - p.ev) >= 5) parts.push('o humor ' + (now.ev > p.ev ? 'melhorou' : 'caiu') + ' (' + Math.round(now.ev) + ')');
    if (now.funds - p.funds <= -50000) parts.push('o caixa caiu ' + fmtMoney(p.funds - now.funds));
    if (parts.length) this.showTicker('📰 Resumo do dia: ' + parts.join(' · ') + '.', now.ev < p.ev - 5 || now.funds < p.funds - 50000 ? 'bad' : 'good');
  }
  actionItems() {
    const out = [], groups = {};
    for (const a of this.g.alerts()) {
      if (a.sev < 2 && /^(😠|🚫)/.test(a.title)) { (groups[a.title.slice(0, 2)] = groups[a.title.slice(0, 2)] || []).push(a); continue; }
      out.push({text: a.title + (a.cause ? ' — ' + a.cause : ''), cls: a.sev === 2 ? 'bad' : 'dem', ...this.alertTarget(a)});
    }
    for (const k in groups) {
      const l = groups[k], one = l.length === 1;
      out.push({text: one ? l[0].title : k === '😠' ? '😠 ' + l.length + ' unidades com inquilinos insatisfeitos (abra o 😐 no topo)' : '🚫 ' + l.length + ' salas sem acesso por elevador ou escada', cls: 'dem', ...this.alertTarget(l[0])});
    }
    return out.sort((x, y) => (y.cls === 'bad') - (x.cls === 'bad'));
  }
  nextTicker() {
    const t = $('#ticker'); if (!t) return;
    if (!this.cycle.length) this.cycle = this.actionItems().concat(this.tq.splice(0));
    let it = this.cycle.shift();
    this.tickerIdle = !it;
    if (!it) {   // sem nada a dizer o letreiro fica vazio (só a dica inicial, antes do primeiro saguão)
      if (this.g.hasGroundLobby()) { t.innerHTML = ''; return; }
      it = {text: 'Comece arrastando um saguão pelo térreo.', cls: ''};
    }
    const s = document.createElement('span');
    s.className = 'mq ' + (it.cls || '') + (it.at ? ' go' : ''); if (it.at) { s.title = 'Clique para ver o local'; s.onclick = () => this.goTo(it); } s.textContent = it.text; t.innerHTML = ''; t.appendChild(s);
    const W = t.clientWidth, w = s.offsetWidth;
    s.style.setProperty('--from', W + 'px');
    s.style.animationDuration = Math.max(6, (W + w) / 75) + 's';
    s.onanimationend = () => this.nextTicker();
  }
  hint(text, bad, ms = 2500) {
    const h = $('#hint');
    if (!text) { h.style.display = 'none'; return; }
    h.textContent = text; h.className = bad ? 'bad' : ''; h.style.display = 'block';
    clearTimeout(this._ht); if (ms) this._ht = setTimeout(() => { h.style.display = 'none'; }, ms);
  }

  // ------------------------------------------------------------ barra de ferramentas
  // estilo SimCity: só ícones, só o que já está liberado; nome, custo e descrição aparecem na dica ao passar o mouse
  buildToolbar() {
    const tb = $('#toolbar'), keep = tb.scrollLeft;   // refazer a barra não pode jogar a rolagem de volta ao começo
    tb.innerHTML = ''; this.hideTip();
    // itens recém-liberados ganham um pontinho até serem vistos (o que já estava liberado ao abrir o jogo não conta)
    this.fresh = this.fresh || new Set();
    if (!this.seen) this.seen = new Set();
    const first = this.seen.size === 0;
    for (const t of TOOLS) for (const id of (t.length > 1 ? t.slice(1) : t)) if (STAR(id) <= this.g.star && !this.seen.has(id)) { this.seen.add(id); if (!first) this.fresh.add(id); }
    for (const t of TOOLS) {
      const isGroup = t.length > 1;
      const open = (isGroup ? t.slice(1) : t).filter(id => STAR(id) <= this.g.star);
      if (!open.length) continue;   // grupo ainda bloqueado não aparece
      let id = isGroup ? (this.groupSel[t[0]] || open[0]) : t[0];
      if (!open.includes(id)) id = open[0];
      const b = document.createElement('button');
      b.className = 'tool';
      if (this.tool === id || (isGroup && t.slice(1).includes(this.tool))) b.classList.add('on');
      b.innerHTML = icon(id) + (isGroup ? '<span class="grp">▴</span>' : '') + (open.some(x => this.fresh.has(x)) ? '<span class="new"></span>' : '');
      b.setAttribute('aria-label', isGroup ? t[0] : LABEL(id));
      this.bindTip(b, () => isGroup ? {title: t[0], sub: open.map(LABEL).join(' · ')} : this.tipOf(id));
      b.onclick = e => { e.stopPropagation(); if (!isGroup) this.fresh.delete(id); if (isGroup) this.openFlyout(t, b); else this.setTool(id); };
      tb.appendChild(b);
    }
    tb.scrollLeft = keep;
    const on = tb.querySelector('.tool.on'); if (on && on.scrollIntoView) { const r = on.getBoundingClientRect(), b = tb.getBoundingClientRect(); if (r.left < b.left || r.right > b.right) on.scrollIntoView({inline: 'nearest', block: 'nearest'}); }   // a ferramenta ativa sempre fica à vista
  }
  tipOf(id) {
    const c = COST(id);
    return {title: LABEL(id), cost: c, desc: DESC[id] || '', star: STAR(id) > 1 ? STAR(id) : 0};
  }
  // dica própria (a nativa demora e some): aparece acima do botão
  bindTip(el, get) {
    el.addEventListener('pointerenter', e => { if (e.pointerType === 'touch') return; this.showTip(el, get()); });
    el.addEventListener('pointerleave', () => this.hideTip());
  }
  showTip(el, d) {
    let tip = $('#tbtip');
    if (!tip) { tip = document.createElement('div'); tip.id = 'tbtip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
    tip.innerHTML = `<b>${esc(d.title)}</b>` + (d.cost ? ` <span class="c">${esc(d.cost)}</span>` : '') + (d.star ? ` <span class="s">${d.star}★</span>` : '') + (d.desc ? `<small>${esc(d.desc)}</small>` : '') + (d.sub ? `<small>${esc(d.sub)}</small>` : '');
    tip.style.display = 'block';
    const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
    tip.style.top = Math.max(8, r.top - h - 8) + 'px';
  }
  hideTip() { const tip = $('#tbtip'); if (tip) tip.style.display = 'none'; }
  openFlyout(t, btn) {
    const fo = $('#flyout');
    if (!fo.classList.contains('hidden') && fo.dataset.g === t[0]) { fo.classList.add('hidden'); this.hideTip(); return; }
    fo.dataset.g = t[0]; fo.innerHTML = ''; this.hideTip();
    for (const id of t.slice(1)) {
      if (STAR(id) > this.g.star) continue;
      const b = document.createElement('button');
      if (this.tool === id) b.classList.add('on');
      b.innerHTML = icon(id) + (this.fresh.has(id) ? '<span class="new"></span>' : '');
      b.setAttribute('aria-label', LABEL(id));
      this.bindTip(b, () => { const d = this.tipOf(id); if (this.fresh.delete(id)) { const n = b.querySelector('.new'); if (n) n.remove(); } return d; });
      b.onclick = e => { e.stopPropagation(); this.groupSel[t[0]] = id; this.setTool(id); fo.classList.add('hidden'); this.hideTip(); };
      fo.appendChild(b);
    }
    // grade responsiva: mais larga que alta, mas limitada pela largura e pela altura livres da tela
    const n = fo.children.length, r0 = btn.getBoundingClientRect(), CELL = 52, PAD = 16;
    const maxCols = Math.max(1, Math.floor((innerWidth - 16 - PAD + 4) / CELL)), maxRows = Math.max(1, Math.floor((r0.top - 14 - PAD + 4) / 46));
    let cols = Math.min(maxCols, Math.max(1, Math.ceil(Math.sqrt(n * 2))));
    if (Math.ceil(n / cols) > maxRows) cols = Math.min(maxCols, Math.ceil(n / maxRows));
    fo.style.setProperty('--cols', Math.min(cols, n));
    fo.classList.remove('hidden');
    const r = btn.getBoundingClientRect(), fr = fo.getBoundingClientRect();
    fo.style.left = Math.max(8, Math.min(innerWidth - fr.width - 8, r.left)) + 'px';
    fo.style.top = Math.max(8, r.top - fr.height - 6) + 'px';
    const room = r.top - 14; fo.style.maxHeight = Math.max(160, room) + 'px';   // lista longa rola dentro do menu em telas baixas
    const fr2 = fo.getBoundingClientRect(); fo.style.top = Math.max(8, r.top - fr2.height - 6) + 'px';
  }
  setTool(id) {
    if (STAR(id) > this.g.star) { this.hint(LABEL(id) + ' libera com ' + STAR(id) + ' estrelas.', true); return; }
    this.tool = id; this.anchor = null; this.drag = null; this.r.ghost = null;
    this.buildToolbar(); this.toolOptions();
    this.hint(LABEL(id) + ': ' + (DESC[id] || ''), false, 3500);
  }
  toolOptions() {
    const o = $('#toolopts'), id = this.tool, parts = [];
    if (id === 'lobby' && !this.g.hasGroundLobby()) {
      parts.push('<span>Altura do saguão do térreo:</span>' + [1, 2, 3].map(h => `<button data-lh="${h}" class="${this.g.lobbyH === h ? 'on' : ''}">${h} andar${h > 1 ? 'es' : ''}</button>`).join(''));
    }
    if (this.anchor) parts.push('<span>Escolha o andar final do elevador.</span><button id="cancelAnchor">Cancelar</button>');
    if (!parts.length) { o.classList.remove('show'); this.app.layout(); return; }
    o.innerHTML = parts.join(''); o.classList.add('show');
    o.querySelectorAll('[data-lh]').forEach(b => b.onclick = () => { this.g.lobbyH = +b.dataset.lh; this.toolOptions(); });
    const ca = o.querySelector('#cancelAnchor'); if (ca) ca.onclick = () => { this.anchor = null; this.r.ghost = null; this.toolOptions(); };
    this.app.layout();
  }

  // ------------------------------------------------------------ entrada
  cell(sx, sy) {
    const w = this.r.toWorld(sx, sy);
    return {ux: w.x / U, L: levelAt(w.y), wx: w.x, wy: w.y};
  }
  rel(e) { const b = this.r.cv.getBoundingClientRect(); return {x: e.clientX - b.left, y: e.clientY - b.top}; }
  bindInput() {
    const cv = $('#view');
    cv.addEventListener('contextmenu', e => e.preventDefault());
    const tbEl = $('#toolbar'); tbEl.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { tbEl.scrollLeft += e.deltaY; e.preventDefault(); } }, {passive: false});   // roda do mouse rola a barra de ferramentas na horizontal
    cv.addEventListener('pointerdown', e => this.down(e));
    cv.addEventListener('pointermove', e => this.move(e));
    cv.addEventListener('pointermove', e => this.moodTip(e));
    cv.addEventListener('pointerleave', () => { $('#tip').style.display = 'none'; });
    cv.addEventListener('pointerup', e => this.up(e));
    cv.addEventListener('pointercancel', e => { this.pointers.delete(e.pointerId); this.drag = null; this.panDrag = null; });
    cv.addEventListener('pointerleave', () => { if (!this.drag && !this.anchor) { this.r.ghost = null; this.hint(null); } });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const p = this.rel(e);
      if (e.ctrlKey || e.metaKey) { this.r.zoomAt(p.x, p.y, this.r.cam.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); return; }
      const k = e.deltaMode === 1 ? 30 : 1;
      let dx = e.deltaX * k, dy = e.deltaY * k;
      if (e.shiftKey && !dx) { dx = dy; dy = 0; }
      this.r.cam.x += dx / this.r.cam.z; this.r.cam.y += dy / this.r.cam.z; this.r.clampCam();
    }, {passive: false});
    addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      if (this.titleOpen && !(e.key === 'Escape' && this.modalOpen)) return;   // atrás da tela inicial o jogo não responde ao teclado
      if (e.key === ' ') { e.preventDefault(); this.space = true; if (!e.repeat) this.app.togglePause(); }
      else if (e.key === 'r' || e.key === 'R') { this.dir = -(this.dir || 1); if (FAC[this.tool] && FAC[this.tool].slope) this.hint('Sobe para a ' + (this.dir === 1 ? 'direita' : 'esquerda') + ' (R gira)', false); else if (FAC[this.tool] && FAC[this.tool].portal) this.hint('Saída para a rua à ' + (this.dir === 1 ? 'direita' : 'esquerda') + ' (R gira)', false); }
      else if (e.key === 'v' || e.key === 'V') this.cycleOverlay();
      else if (e.key >= '1' && e.key <= '4') this.app.setSpeed([1, 2, 4, 8][+e.key - 1]);
      else if (e.key === 'Escape') { if (this.modalOpen) this.closePanel(); else { this.anchor = null; this.r.ghost = null; this.setTool('inspect'); } }
      else if (e.key === '+' || e.key === '=') this.r.zoomAt(this.r.vw / 2, this.r.vh / 2, this.r.cam.z * 1.25);
      else if (e.key === '-') this.r.zoomAt(this.r.vw / 2, this.r.vh / 2, this.r.cam.z / 1.25);
      else if (e.key.startsWith('Arrow')) {
        const s = 60 / this.r.cam.z;
        if (e.key === 'ArrowLeft') this.r.cam.x -= s; if (e.key === 'ArrowRight') this.r.cam.x += s;
        if (e.key === 'ArrowUp') this.r.cam.y -= s; if (e.key === 'ArrowDown') this.r.cam.y += s;
        this.r.clampCam(); e.preventDefault();
      }
    });
    addEventListener('keydown', e => { if (e.key === 'Shift') this.shiftKey = true; });
    addEventListener('keyup', e => { if (e.key === 'Shift') this.shiftKey = false; });
    addEventListener('keyup', e => { if (e.key === ' ') this.space = false; });
    addEventListener('pointerdown', e => { const fo = $('#flyout'); if (!fo.contains(e.target)) fo.classList.add('hidden'); }, true);
  }
  // tudo na grade de caixas: o saguão cobre as caixas tocadas pelo arrasto
  lobbySpan(a, b) { const sn = v => Math.floor(clamp(v, X_MIN, X_MAX - 1) / BOX) * BOX; return [sn(Math.min(a, b)), sn(Math.max(a, b)) + BOX - 1]; }
  placeUx(def, c) { return clamp(Math.round((c.ux - def.w / 2) / BOX) * BOX, X_MIN, X_MAX - def.w); }
  down(e) {
    try { this.r.cv.setPointerCapture(e.pointerId); } catch (_) {}
    const p = this.rel(e);
    this.pointers.set(e.pointerId, {x: p.x, y: p.y});
    if (this.pointers.size === 2) { this.drag = null; this.panDrag = null; this.pinch = this.pinchState(); return; }
    const c = this.cell(p.x, p.y), mode = MODE[this.tool] || 'c';
    const forcePan = e.button === 1 || e.button === 2 || this.space;
    if (!forcePan && (mode === 'i' || mode === 'a')) {   // alça do elevador (casa de máquinas / poço): arrastar estende ou encurta
      const cap = this.g.shaftCapAt(c.L, Math.floor(c.ux));
      if (cap) { this.capDrag = {s: cap, dir: c.L > cap.hi ? 1 : -1, L1: c.L}; this.capGhost(c); return; }
    }
    if (forcePan || mode === 'i' || mode === 'a' || mode === 'b') {
      this.panDrag = {x: p.x, y: p.y, cx: this.r.cam.x, cy: this.r.cam.y, moved: false, force: forcePan};
      return;
    }
    if (mode === 'h') { this.drag = {L: c.L, x0: Math.floor(c.ux), x1: Math.floor(c.ux), sx: p.x, sy: p.y, panned: false, cx: this.r.cam.x, cy: this.r.cam.y}; this.updateGhost(c); }
    else if (mode === 'v') {
      const t = TRANSPORT[this.tool];
      this.drag = {x: this.placeUx(t, c), L0: this.anchor ? this.anchor.L0 : c.L, L1: c.L, sx: p.x, sy: p.y, moved: false, anchored: !!this.anchor};
      if (this.anchor) this.drag.x = this.anchor.x;
      this.updateGhost(c);
    } else this.panDrag = {x: p.x, y: p.y, cx: this.r.cam.x, cy: this.r.cam.y, moved: false, build: true};
  }
  pinchState() {
    const a = [...this.pointers.values()];
    return {d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), z: this.r.cam.z, mx: (a[0].x + a[1].x) / 2, my: (a[0].y + a[1].y) / 2};
  }
  move(e) {
    const p = this.rel(e);
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, {x: p.x, y: p.y});
    if (this.pointers.size === 2 && this.pinch) {
      const a = [...this.pointers.values()], d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
      this.r.zoomAt((a[0].x + a[1].x) / 2, (a[0].y + a[1].y) / 2, this.pinch.z * d / (this.pinch.d || 1));
      return;
    }
    const c = this.cell(p.x, p.y);
    if (this.capDrag) { this.capDrag.L1 = c.L; this.capGhost(c); return; }
    if (this.panDrag) {
      const dx = p.x - this.panDrag.x, dy = p.y - this.panDrag.y;
      if (Math.hypot(dx, dy) > 5) this.panDrag.moved = true;
      if (this.panDrag.moved && !this.panDrag.build) {
        this.r.cam.x = this.panDrag.cx - dx / this.r.cam.z; this.r.cam.y = this.panDrag.cy - dy / this.r.cam.z; this.r.clampCam();
        this.r.ghost = null;
        return;
      }
    }
    if (this.drag) {
      if (this.drag.x0 !== undefined) this.drag.x1 = clamp(Math.floor(c.ux), X_MIN, X_MAX - 1);
      else { this.drag.L1 = clamp(c.L, MIN_L + 1, MAX_L); if (Math.hypot(p.x - this.drag.sx, p.y - this.drag.sy) > 6) this.drag.moved = true; }
    }
    this.updateGhost(c);
  }
  updateGhost(c) {
    const g = this.g, id = this.tool, mode = MODE[id] || 'c', gh = null;
    this.r.ghost = null;
    if (c.L < MIN_L || c.L > MAX_L) { this.hint(null); return; }
    if (mode === 'i' || mode === 'a') {   // sobre a casa de máquinas ou o poço de um elevador: dica de como estendê-lo
      const cap = g.shaftCapAt(c.L, Math.floor(c.ux));
      if (cap) { this._capHint = true; this.hint((c.L > cap.hi ? 'Casa de máquinas' : 'Poço') + ': clique ou ARRASTE ' + (c.L > cap.hi ? 'para cima' : 'para baixo') + ' para estender o elevador (arraste de volta para encurtar)', false, 0); }
      else if (this._capHint) { this._capHint = false; this.hint(null); }
      return;
    }
    if (mode === 'c' && FAC[id]) {
      const d = FAC[id], x = this.placeUx(d, c), res = g.canPlaceFac(id, c.L, x, {dir: this.dir || 1});
      this.r.ghost = {x, L: c.L, w: d.w, h: res.h || d.h, ok: !!res.ok, slope: !!d.slope, portal: !!d.portal, dir: this.dir || 1, k: id};
      this.hint(res.ok ? `${d.label} · ${money(res.cost)} · andar ${floorLabel(c.L)}` + (d.slope ? ` · ponta alta à ${this.dir === -1 ? 'esquerda' : 'direita'} (R gira)` : d.portal ? ` · saída à ${this.dir === -1 ? 'esquerda' : 'direita'}: só liga o que encosta do outro lado (R gira)` : '') : res.err, !res.ok, 0);
    } else if (mode === 'h') {
      if (this.drag) {
        const a = Math.min(this.drag.x0, this.drag.x1), b = Math.max(this.drag.x0, this.drag.x1);
        const [la, lb] = this.lobbySpan(a, b);
        const w = lb - la + 1;
        const ax = id === 'lobby' ? la : Math.floor(a / BOX) * BOX;
        const h = id === 'lobby' && this.drag.L === 0 ? g.groundLobbyH() : 1;
        let ok = true, err = '', cost = 0;
        if (id === 'lobby') { const pv = g.lobbyPreview(this.drag.L, la, lb); ok = pv.ok; err = pv.err; cost = pv.cost; }
        else if (id === 'floor') { const fc = g.floorCheck(this.drag.L, la, lb); ok = !!fc.ok; err = fc.err; cost = fc.cost || (fc.r ? fc.r.n * FLOOR_COST : 0); }
        else {   // vagas: confere cada caixa do trecho; vale se ao menos uma couber (as ocupadas são puladas)
          let n = 0;
          for (let x = Math.floor(a / BOX) * BOX; x <= b; x += BOX) { const r1 = g.canPlaceFac(id, this.drag.L, x); if (r1.ok) { n++; cost += r1.cost; } else if (!err) err = r1.err; }
          ok = n > 0;
        }
        this.r.ghost = {x: ax, L: this.drag.L, w, h, ok};
        this.hint(ok ? `${LABEL(id)} · ${money(cost)}` : err, !ok, 0);
      } else {
        const lh = id === 'lobby' && c.L === 0 ? g.groundLobbyH() : 1;
        if (id === 'lobby') {
          const [la, lb] = this.lobbySpan(Math.floor(c.ux), Math.floor(c.ux)), pv = g.lobbyPreview(c.L, la, lb);
          this.r.ghost = {x: la, L: c.L, w: lb - la + 1, h: lh, ok: pv.ok};
          this.hint(pv.ok ? `${LABEL(id)} · ${money(pv.cost)} · arraste na horizontal` : pv.err, !pv.ok, 0);
        } else {
          const fx = Math.floor(c.ux / BOX) * BOX, fc = id === 'floor' ? g.floorCheck(c.L, fx, fx) : FAC[id] ? g.canPlaceFac(id, c.L, fx) : null;
          this.r.ghost = {x: fx, L: c.L, w: BOX, h: lh, ok: fc ? !!fc.ok : true};
          if (fc && !fc.ok) { this.hint(fc.err, true, 0); return; }
          this.hint(`${LABEL(id)}: arraste na horizontal`, false, 0);
        }
      }
    } else if (mode === 'v') {
      const t = TRANSPORT[id];
      const x = this.drag ? this.drag.x : this.anchor ? this.anchor.x : this.placeUx(t, c);
      const L0 = this.drag ? this.drag.L0 : this.anchor ? this.anchor.L0 : c.L;
      const L1 = this.drag ? this.drag.L1 : c.L;
      const lo = Math.min(L0, L1), hi = Math.max(L0, L1);
      const res = g.shaftCheck(id, x, lo, hi);
      this.r.ghost = {x, L: lo, w: t.w, h: hi - lo + 1, ok: !!res.ok};
      this.hint(res.ok ? `${t.label} · andares ${floorLabel(lo)}–${floorLabel(hi)} · ${money(res.cost)}` : res.err, !res.ok, 0);
    } else if (mode === 's') {
      const t = TRANSPORT[id], x = this.placeUx(t, c), res = g.canPlaceStairs(id, c.L, x);
      this.r.ghost = {x, L: c.L, w: t.w, h: 1, ok: !!res.ok};
      this.hint(res.ok ? `${t.label} · liga ${floorLabel(c.L)} ao ${floorLabel(c.L + 1)} · ${money(res.cost)}` : res.err, !res.ok, 0);
    } else if (mode === 'b') {
      const o = g.tgAt(c.L, Math.floor(c.ux)) || g.facAt(c.L, Math.floor(c.ux));
      if (o) {
        const label = o.cat === 'fac' ? FAC[o.k].label : TRANSPORT[o.k].label;
        this.r.ghost = o.cat === 'shaft' ? {x: o.x, L: o.lo, w: o.w, h: o.hi - o.lo + 1, ok: false} : {x: o.x, L: o.L, w: o.w, h: o.cat === 'fac' ? o.h : 1, ok: false};
        this.hint('Demolir ' + label.toLowerCase(), true, 0);
      } else this.hint(null);
    } else this.hint(null);
  }
  up(e) {
    const p = this.rel(e), c = this.cell(p.x, p.y);
    this.pointers.delete(e.pointerId);
    if (this.capDrag) { const d = this.capDrag; this.capDrag = null; this.r.ghost = null; this.capApply(d, c.L); return; }
    if (this.pinch) { if (this.pointers.size < 2) this.pinch = null; this.drag = null; this.panDrag = null; return; }
    const g = this.g, id = this.tool, mode = MODE[id] || 'c';
    if (this.drag) {
      const d = this.drag; this.drag = null; this.r.ghost = null;
      if (d.x0 !== undefined) {
        const a = Math.min(d.x0, d.x1), b = Math.max(d.x0, d.x1);
        let res;
        if (id === 'lobby') { if (!g.hasGroundLobby() && d.L === 0) g.lobbyH = g.lobbyH; const [la, lb] = this.lobbySpan(a, b); res = g.placeLobbySpan(d.L, la, lb); }
        else if (id === 'floor') res = g.placeFloorSpan(d.L, a, b);
        else { // vagas de estacionamento
          let n = 0, err = '';
          for (let x = Math.floor(a / 4) * 4; x <= b; x += 4) { const r2 = g.placeFac(id, d.L, x); if (r2.ok) n++; else if (!err) err = r2.err; }
          res = n ? {ok: true} : {err};
        }
        if (res.err) this.hint(res.err, true); else this.app.sound('build');
      } else {
        if (!d.moved && !d.anchored) { this.anchor = {x: d.x, L0: d.L0}; this.toolOptions(); this.updateGhost(c); return; }
        const lo = Math.min(d.L0, d.L1), hi = Math.max(d.L0, d.L1);
        const res = g.placeShaft(id, d.x, lo, hi);
        this.anchor = null; this.toolOptions();
        if (res.err) this.hint(res.err, true); else this.app.sound('build');
      }
      this.updateGhost(c);
      return;
    }
    if (this.panDrag) {
      const pd = this.panDrag; this.panDrag = null;
      if (!pd.moved && !pd.force) this.click(c, mode, p);
    }
  }
  click(c, mode, p) {
    const g = this.g, id = this.tool;
    if (mode === 'c') {
      if (FAC[id]) {
        const res = g.placeFac(id, c.L, this.placeUx(FAC[id], c), {dir: this.dir || 1});
        if (res.err) this.hint(res.err, true); else this.app.sound('build');
        this.updateGhost(c);
      }
    } else if (mode === 's') {
      const res = g.placeStairs(id, c.L, this.placeUx(TRANSPORT[id], c));
      if (res.err) this.hint(res.err, true); else this.app.sound('build');
      this.updateGhost(c);
    } else if (mode === 'b') {
      const res = g.bulldoze(c.L, Math.floor(c.ux));
      if (res.err) this.hint(res.err, true); else { this.hint(res.what + ' demolido.'); this.r.selected = null; }
      this.updateGhost(c);
    } else if (mode === 'i') this.inspect(c);
    else if (mode === 'a') this.adjust(c);
  }
  pickPerson(c) {
    let best = null, bd = 9 / this.r.cam.z + 3;
    for (const q of this.g.people) {
      if (q.st === 'away' || q.st === 'ride' || q.dead) continue;
      if (q.st === 'idle' && q.at && !['restaurant', 'cinema', 'fastfood', 'bar', 'shop', 'lobby', 'party', 'auditorio'].includes(q.at.k)) continue;
      const L = q.st === 'stair' ? q.fy : q.L;
      const dx = q.x * U - c.wx, dy = (-L * FH - SLAB - 6) - c.wy;
      const d = Math.hypot(dx, dy);
      if (d < bd) { bd = d; best = q; }
    }
    return best;
  }
  // alça arrastada: o andar onde o ponteiro está vira a nova ponta do poço (clicar sem arrastar = +1 andar; arrastar de volta para dentro do poço encurta)
  capTarget(d, L) { return d.dir > 0 ? {n: L - d.s.hi} : {n: d.s.lo - L}; }
  capGhost(c) {
    const d = this.capDrag, s = d.s, n = this.capTarget(d, c.L).n, ext = n > 0, k = Math.abs(n);
    const r = ext ? this.g.extendShaft(s, d.dir, k, true) : this.g.shrinkShaft ? {ok: s.hi - s.lo + 1 - k >= 2} : {ok: false};
    const L0 = d.dir > 0 ? (ext ? s.hi + 1 : s.hi - k + 1) : (ext ? s.lo - k : s.lo);
    this.r.ghost = {x: s.x, L: L0, w: s.w, h: Math.max(1, k), ok: !!r.ok};
    this.hint(r.ok ? (ext ? 'Estender ' + k + ' andar(es) para ' + (d.dir > 0 ? 'cima' : 'baixo') + ' · ' + money(r.cost) : 'Encurtar ' + k + ' andar(es)') : (r.err || 'Não dá para encurtar mais'), !r.ok, 0);
  }
  capApply(d, L) {
    const n = this.capTarget(d, L).n, s = d.s, g = this.g;
    const r = n > 0 ? g.extendShaft(s, d.dir, n) : n < 0 ? g.shrinkShaft(s, d.dir, -n) : {ok: true};
    if (r.err) this.hint(r.err, true); else { this.app.sound('build'); this.r.selected = s; this.hint(n > 0 ? 'Poço estendido ' + n + ' andar(es) · ' + money(r.cost) : n < 0 ? 'Poço encurtado ' + (-n) + ' andar(es)' : null); }
  }
  // casa de máquinas (alça de cima) e poço (alça de baixo): um clique estende o elevador um andar; com Shift encurta
  capClick(s, dir, shrink) {
    const r = shrink ? this.g.shrinkShaft(s, dir) : this.g.extendShaft(s, dir);
    if (r.err) this.hint(r.err, true);
    else { this.app.sound('build'); this.hint(shrink ? 'Poço encurtado (' + floorLabel(r.lo) + ' a ' + floorLabel(r.hi) + ')' : 'Poço estendido para ' + floorLabel(dir > 0 ? r.hi : r.lo) + ' · ' + money(r.cost)); this.r.selected = s; }
  }
  inspect(c) {
    const g = this.g;
    const sa = this.g.santa;
    if (sa && sa.sx !== undefined && Math.hypot(c.wx - sa.sx - 20, c.wy - sa.sy + 8) < 40 / Math.min(1, this.r.cam.z) + 20 && this.g.claimSanta()) return;
    const person = this.pickPerson(c);
    if (person) { this.showPerson(person); return; }
    const u = Math.floor(c.ux);
    const cap = g.shaftCapAt(c.L, u);
    if (cap) { this.capClick(cap, c.L > cap.hi ? 1 : -1, this.shiftKey); return; }
    const o = g.tgAt(c.L, u) || g.facAt(c.L, u);
    if (!o) { this.r.selected = null; this.closePanel(); return; }
    this.r.selected = o;
    if (o.cat === 'shaft') this.showShaft(o);
    else if (o.cat === 'fac') this.showFac(o);
    else this.showStairs(o);
  }
  adjust(c) {
    const g = this.g, u = Math.floor(c.ux);
    const o = g.tgAt(c.L, u) || g.facAt(c.L, u);
    if (!o) return;
    this.r.selected = o;
    if (o.cat === 'shaft') return this.showShaft(o);
    if (o.cat === 'fac') {
      const d = FAC[o.k];
      if (d.prices || o.k === 'cinema' || o.k === 'transit') return this.showFac(o);
    }
    this.hint('Nada para ajustar aqui.', true);
  }

  // ------------------------------------------------------------ barra superior
  bindBar() {
    $('#speed').querySelectorAll('button').forEach(b => b.onclick = () => this.app.setSpeed(+b.dataset.speed));
    $('#overlays').querySelectorAll('button').forEach(b => b.onclick = () => this.setOverlay(b.dataset.ov));
    $('#miniToggle').onclick = () => { $('#mini').classList.toggle('collapsed'); $('#miniToggle').textContent = $('#mini').classList.contains('collapsed') ? '▴' : '▾'; this.r.resizeMini(); };
    $('#miniMode').onclick = () => { this.r.setMiniMode(this.r.miniMode === 'fit' ? 'world' : 'fit'); this.r.miniZ = 1; this.hint(this.r.miniMode === 'fit' ? 'Minimapa: enquadrando o prédio construído' : 'Minimapa: a torre com uma margem larga ao redor', false, 2000); };
    $('#zoom').querySelectorAll('button').forEach(b => b.onclick = () => this.r.zoomAt(this.r.vw / 2, this.r.vh / 2, this.r.cam.z * (b.dataset.z === 'in' ? 1.25 : 1 / 1.25)));
    $('#starsBtn').onclick = () => this.showStarPanel();
    $('#alertBtn').onclick = () => this.showAlerts();
    $('#moodBtn').onclick = () => this.showMood();
    $('#finBtn').onclick = () => this.showFinance();
    $('#menuBtn').onclick = () => this.showMenu();
    $('#previewEnd').onclick = () => {};
    if (innerWidth < 560 || innerHeight < 480) { $('#mini').classList.add('collapsed'); $('#miniToggle').textContent = '▴'; }   // em tela pequena o minimapa começa recolhido (o botão ▴ abre)
    const mm = $('#minimap');
    const jump = e => { const b = mm.getBoundingClientRect(); const w = this.r.miniToWorld(e.clientX - b.left, e.clientY - b.top); if (w) this.r.centerOn(w.x, w.y); };
    let down = false;
    // enquanto arrasta, o enquadramento fica congelado (senão ele seguiria a câmera e o dedo "fugiria")
    mm.addEventListener('pointerdown', e => { down = true; this.r.miniHold = true; try { mm.setPointerCapture(e.pointerId); } catch (_) {} jump(e); });
    mm.addEventListener('pointermove', e => { if (down) jump(e); });
    const end = () => { down = false; this.r.miniHold = false; };
    mm.addEventListener('pointerup', end); mm.addEventListener('pointercancel', end);
    mm.addEventListener('dblclick', e => { jump(e); this.r.zoomAt(this.r.vw / 2, this.r.vh / 2, Math.max(this.r.cam.z, 1)); });
    mm.addEventListener('wheel', e => {
      e.preventDefault();
      const b = mm.getBoundingClientRect(), w = this.r.miniToWorld(e.clientX - b.left, e.clientY - b.top);
      if (w) this.r.centerOn(w.x, w.y);
      this.r.miniZ = clamp(this.r.miniZ * (e.deltaY < 0 ? 1.3 : 1 / 1.3), 1, 8);
    }, {passive: false});
    $('#modal').addEventListener('pointerdown', e => { if (e.target.id === 'modal') this.closePanel(); });
    // clique em andamento no painel: o refresh espera (ver _panelBusy)
    $('#panel').addEventListener('pointerdown', () => { this._ptrDown = true; });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('#panel').addEventListener(ev, () => { setTimeout(() => { this._ptrDown = false; }, 120); });
  }
  setOverlay(ov) {
    this.overlay = ov; this.r.overlay = ov; this.r._msKey = '';
    $('#overlays').querySelectorAll('button').forEach(b => { const on = b.dataset.ov === ov; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    $('#legend').innerHTML = this.legendHtml(ov);
    if (ov === 'none') { $('#tip').style.display = 'none'; return; }
    this.hint(ov === 'energia' ? 'Energia: cada fonte (saguão do térreo = rede pública, geradores, placa solar, bateria) só alcança as salas perto dela. Vermelho = sem energia.' : ov === 'agua' ? 'Água: cada fonte (rede pública do saguão, bomba, caixa com bomba abaixo, tratamento) só alcança as salas perto dela. Vermelho = sem água.' : ov === 'eval' ? 'Humor: 😠 vermelho = ruim · 😐 amarelo = bom · 😀 verde = ótimo (passe o mouse para ver o motivo)' : ov === 'price' ? 'Faixas de preço: roxo = Premium, azul = Padrão, verde = Econômico, amarelo = Promoção' : ov === 'fire' ? 'Cobertura contra incêndio: azul = sprinklers, amarelo = hidrante, verde = extintor, vermelho = sem proteção (vale o melhor que cobre a sala; passe o mouse para ver tudo)' : ov === 'sec' ? 'Segurança: cada posto cobre até 6 andares e 40 unidades para cada lado. Verde = resposta rápida, laranja = lenta, amarelo = posto sem ninguém agora, vermelho = sem rota para os seguranças, ciano = só câmera, vermelho escuro = sem posto (passe o mouse para ver o tempo de resposta)' : 'Hotel: verde = ocupado, cinza = vago, vermelho = sujo, roxo = baratas', false, 5000);
  }
  legendHtml(ov) {
    const sw = (c, t, cls = '') => `<span class="lg"><i class="${cls}" style="background:${c};color:${c}"></i>${t}</span>`;
    if (ov === 'eval') return `<span class="bar" style="background:linear-gradient(90deg,${[40, 70, 100, 140, 180, 230].map(e => evalCol(e)).join(',')})"></span><span class="bl"><span>😠 ruim</span><span>😐 boa</span><span>😀 ótima</span></span>${sw('#ff4646', 'vai sair', 'ring')}`;
    if (ov === 'price') return sw('#b45ae6', 'Premium') + sw('#4696e6', 'Padrão') + sw('#46c896', 'Econ.') + sw('#f0c846', 'Promo');
    if (ov === 'fire') return sw('#4696e6', 'sprinklers') + sw('#f0c846', 'hidrante') + sw('#3fb27f', 'extintor') + sw('#d6484d', 'sem cobertura');
    if (ov === 'sec') return sw('#3fb27f', 'resposta rápida') + sw('#f08c3c', 'resposta lenta') + sw('#f0c846', 'posto sem segurança agora') + sw('#e5484d', 'sem rota') + sw('#6ed7d7', 'só câmera') + sw('#963c3c', 'sem posto');
    if (ov === 'energia') return sw('#fff08c', 'fonte') + sw('#c8a028', 'com energia') + sw('#d6484d', 'sem energia (fora do alcance ou capacidade)');
    if (ov === 'agua') return sw('#96d7ff', 'fonte') + sw('#3278c8', 'com água') + sw('#d6484d', 'sem água (fora do alcance ou capacidade)');
    if (ov === 'hotel') return sw('#3fb27f', 'ocupado') + sw('#78829a', 'vago') + sw('#e5484d', 'sujo') + sw('#a03cc8', 'baratas');
    return sw('#ff7a1a', 'fogo', 'dotc') + sw('#ff3b3b', 'briga/bomba', 'dotc') + sw('#ff6b6b', 'sem acesso', 'ring') + sw('#ffb83c', 'fila no poço') + sw('#3fb27f', 'extintor', 'dotc') + sw('#5bb8ff', 'sprinklers', 'dotc') + sw('#f2c230', 'hidrante', 'dotc') + sw('#7fe3e3', 'câmera', 'dotc');
  }
  cycleOverlay() { const o = ['none', 'eval', 'price', 'hotel', 'fire', 'sec', 'energia', 'agua']; this.setOverlay(o[(o.indexOf(this.overlay) + 1) % o.length]); }
  // dica ao passar o mouse na visão de humor: nota, tendência, melhor e pior fator
  // dica das visões Fogo e Segurança: o que cobre a sala sob o mouse
  coverTip(e) {
    const tip = $('#tip'), p = this.rel(e), c = this.cell(p.x, p.y), f = this.g.facAt(c.L, Math.floor(c.ux)), def = f && FAC[f.k], g = this.g;
    if (!f || f.build < 1 || def.struct || f.k === 'ruin') { tip.style.display = 'none'; return; }
    const cv = g.coverage(f), yes = t => `<span class="pos">✔ ${t}</span>`, no = t => `<span class="neg">✘ ${t}</span>`, L = [];
    if (this.overlay === 'fire') {
      const have = [g.corrNear(f, 'spr') && 'sprinklers', g.corrNear(f, 'hyd') && 'hidrante', g.corrNear(f, 'ext') && 'extintor'].filter(Boolean);
      L.push(have.length ? yes(have.join(', ')) : no('sem nada contra incêndio'));
      L.push(g.corrNear(f, 'hyd') ? (cv.stairs ? yes('bombeiros sobem pela escada') : no('hidrante, mas sem escada até aqui')) : no('sem hidrante: só helicóptero'));
    } else {
      L.push(cv.post ? yes('na área de um posto de segurança') : no('fora da área de qualquer posto'));
      if (cv.post) L.push(cv.resp === null ? no('os seguranças não têm rota até aqui') : cv.guards ? yes('resposta em ~' + cv.resp + ' s (' + cv.guards + ' em serviço)') : no('posto sem segurança em serviço agora'));
      L.push(cv.cam ? yes('câmera (brigas e furtos −50%)') : no('sem câmera'));
    }
    tip.innerHTML = `<b>${esc(f.name || def.label)}</b> · andar ${floorLabel(f.L)}<br>` + L.join('<br>');
    tip.style.display = 'block';
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = clamp(p.x + 14, 4, Math.max(4, this.r.vw - w - 4)) + 'px'; tip.style.top = clamp(p.y + 14, 4, Math.max(4, this.r.vh - h - 4)) + 'px';
  }
  moodTip(e) {
    const tip = $('#tip');
    if (this.overlay === 'fire' || this.overlay === 'sec') return this.coverTip(e);
    if (this.overlay !== 'eval') { tip.style.display = 'none'; return; }
    const p = this.rel(e), c = this.cell(p.x, p.y), f = this.g.facAt(c.L, Math.floor(c.ux)), def = f && FAC[f.k];
    if (f && f.build >= 1 && def.tenant && !f.occ) {   // unidade vaga: o que pesa na chance de alugar
      tip.innerHTML = `<b>${esc(f.name || def.label)}</b> · andar ${floorLabel(f.L)} · <b>vago</b>` + this.g.vacancyReasons(f).map(r => `<br><span class="${r.sev === 'bad' ? 'neg' : ''}">${r.sev === 'bad' ? '✘' : '•'} ${esc(r.text)}</span>`).join('');
      tip.style.display = 'block';
      const w = tip.offsetWidth, h = tip.offsetHeight;
      tip.style.left = clamp(p.x + 14, 4, Math.max(4, this.r.vw - w - 4)) + 'px'; tip.style.top = clamp(p.y + 14, 4, Math.max(4, this.r.vh - h - 4)) + 'px';
      return;
    }
    if (!f || f.build < 1 || !((def.tenant && f.occ) || (def.hotel && f.guests.length))) { tip.style.display = 'none'; return; }
    const br = this.g.evalBreakdown(f).filter(o => o.label !== 'Base' && Math.round(o.v));
    const worst = br.filter(o => o.v < 0).sort((a, b) => a.v - b.v)[0], best = br.filter(o => o.v > 0).sort((a, b) => b.v - a.v)[0];
    const t = evalTier(f.eval), tr = f.trend > 3 ? ' ↑' : f.trend < -3 ? ' ↓' : '';
    tip.innerHTML = `<b>${esc(f.name || def.label)}</b> · andar ${floorLabel(f.L)}<br>${EVAL_FACE[t]} ${EVAL_NAMES[t]} (${Math.round(f.eval)})${tr}`
      + (best ? `<br><span class="pos">▲ ${esc(best.label)} +${Math.round(best.v)}</span>` : '') + (worst ? `<br><span class="neg">▼ ${esc(worst.label)} ${Math.round(worst.v)}</span>` : '')
      + (() => { const miss = this.g.demandFactors(f).filter(d => !d.met).map(d => d.label.replace(/^Falta /, '').replace(/ por perto$/, '')); return miss.length ? `<br><span class="sub">Procura por perto: ${esc(miss.join(', '))}</span>` : ''; })();
    tip.style.display = 'block';
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = clamp(p.x + 14, 4, Math.max(4, this.r.vw - w - 4)) + 'px'; tip.style.top = clamp(p.y + 14, 4, Math.max(4, this.r.vh - h - 4)) + 'px';
  }
  showMood() {
    const g = this.g;
    const render = () => {
      const rank = g.moodRank(10), ta = evalTier(g.avgEval), th = evalTier(g.avgHotelEval);
      let h = `<h2>${EVAL_FACE[ta]} Humor do prédio</h2><div class="sub">Inquilinos: ${this.tierBar(g.avgEval)} · Hotel: ${this.tierBar(g.avgHotelEval)}<br>A nota se atualiza a cada hora. Abaixo de ${EVAL_GOOD} por 2 dias, o inquilino vai embora; a média precisa ser "Boa" para subir de estrela.</div>`;
      h += '<h3>Unidades mais insatisfeitas</h3>';
      if (!rank.length) h += '<p class="sub">Nenhum inquilino ou hóspede ainda.</p>';
      rank.forEach((o, i) => {
        const f = o.f, tr = f.trend > 3 ? ' ↑' : f.trend < -3 ? ' ↓' : '';
        h += `<div class="moodrow"><span>${EVAL_FACE[evalTier(o.e)]}</span><div class="nm"><b>${esc(f.name || FAC[f.k].label)}</b> · andar ${floorLabel(f.L)}<small>${esc(o.why)}</small></div><span class="pill t${evalTier(o.e)}">${Math.round(o.e)}${tr}</span><button data-go="${i}">Ir</button></div>`;
      });
      h += '<div class="actions"><button data-close class="primary">Fechar</button></div>';
      const sc = $('#panel').scrollTop;
      $('#panel').innerHTML = h; $('#panel').scrollTop = sc;
      $('#panel').querySelectorAll('[data-close]').forEach(b => b.onclick = () => this.closePanel());
      $('#panel').querySelectorAll('[data-go]').forEach(b => b.onclick = () => { const o = rank[+b.dataset.go]; if (!o) return; this.r.centerOn((o.f.x + o.f.w / 2) * U, -(o.f.L + .5) * FH); this.r.selected = o.f; this.closePanel(); });
    };
    this.openPanel('', render); render();
  }
  refreshBar() {
    const g = this.g;
    $('#clock').textContent = hourStr(g.minute);
    const d = g.day;
    $('#date').textContent = `Ano ${g.year} · ${SEASONS[g.season].name} ${WEATHER[g.weather].icon} ${weatherName(g.weather, g.season)} · ${g.dayName} (dia ${d % YEAR_DAYS + 1}/${YEAR_DAYS})`;
    const f = $('#funds'); f.textContent = money(g.funds); f.classList.toggle('neg', g.funds < 0);
    $('#pop').textContent = 'Pop. ' + g.pop.toLocaleString('pt-BR') + ' · ' + (g.star >= 6 ? 'Marco!' : 'próx. ★ ' + (g.star < 5 ? STAR_POP[g.star + 1] : 'Capela'));
    const ut = g.utilFresh(), uel = $('#util');
    if (uel) { const f = (r, ic) => ic + ' ' + Math.round(r.use) + '/' + Math.round(r.cap); uel.textContent = f(ut.energia, '⚡') + (ut.energia.storeCap ? ' 🔋' + Math.round(100 * ut.energia.store / ut.energia.storeCap) + '%' : '') + ' · ' + f(ut.agua, '💧') + (ut.agua.storeCap ? ' 🛢' + Math.round(100 * ut.agua.store / ut.agua.storeCap) + '%' : ''); uel.classList.toggle('neg', ut.energia.cut > 0 || ut.agua.cut > 0); }
    const st = $('#stars');
    const full = Math.min(5, g.star);
    st.textContent = '★'.repeat(full) + '☆'.repeat(5 - full) + (g.star >= 6 ? ' ♛' : '');
    $('#speed').querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.speed === g.speed));
    const mt = evalTier(g.avgEval);
    $('#moodFace').textContent = EVAL_FACE[mt]; $('#moodN').textContent = Math.round(g.avgEval);
    $('#moodBtn').className = 'iconbtn t' + mt;
    this._an = (this._an || 0) + 1;
    if (this._an % 4 === 1) {
      const al = g.alerts(), n = $('#alertN');
      n.textContent = al.length; n.classList.toggle('on', al.length > 0); n.classList.toggle('hot', al.some(a => a.sev === 2));
    }
  }
  runAction(a, after) {
    const g = this.g;
    let err = null;
    if (a.type === 'goto') { this.r.centerOn(a.x * U, -(a.L + .5) * FH); if (a.fac && !a.fac.dead) this.r.selected = a.fac; this.closePanel(); return; }
    if (a.type === 'hire') err = g.hire(a.fac);
    else if (a.type === 'dismiss') err = g.dismiss(a.fac);
    else if (a.type === 'sys') err = g.buySystem(a.name);
    else if (a.type === 'pest') err = g.pestControl(a.fac);
    else if (a.type === 'garbage') err = g.callGarbage(a.fac);
    else if (a.type === 'rebuild') err = g.rebuild(a.fac);
    else if (a.type === 'car') err = g.addCar(a.shaft);
    else if (a.type === 'price') a.fac.price = a.level;
    else if (a.type === 'build') { this.closePanel(); this.setTool(a.what); return; }
    if (err) this.hint(err, true); else this.app.sound('build');
    this.refreshBar();
    if (after) after();
  }
  actBtn(a, i) {
    return `<button data-a="${i}">${esc(a.label)}${a.cost ? ' <small>' + money(a.cost) + '</small>' : ''}</button>`;
  }
  showAlerts() {
    const g = this.g, LV = ['Baixo', 'Médio', 'Alto'];
    let list = [];
    const render = () => {
      list = g.alerts();
      const risk = (title, r, extra) => `<div class="card risk"><b class="t">${title}<span class="lv lv${r.level}">${LV[r.level]}</span></b><ul>${r.factors.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div>`;
      let h = `<h2>🔔 Alertas e riscos</h2><div class="sub">Cada problema mostra a causa, o efeito e o que você pode fazer.</div>`;
      h += '<h3>Riscos do prédio</h3><div class="risks">' + risk('🔥 Incêndio', g.fireRisk()) + risk('👊 Violência', g.crimeRisk()) + risk('🧹 Higiene do hotel', g.hygieneRisk()) + '</div>';
      h += '<h3>Ocorrências' + (list.length ? ' (' + list.length + ')' : '') + '</h3>';
      if (!list.length) h += '<p class="sub">Nenhum problema agora. 👍</p>';
      let n = 0;
      list.forEach(a => {
        a._i0 = n;
        h += `<div class="card s${a.sev}"><b class="t">${esc(a.title)}</b>
          <div class="k"><b>Causa:</b> ${esc(a.cause)}</div><div class="k"><b>Efeito:</b> ${esc(a.effect)}</div>${a.status ? `<div class="k"><b>Situação:</b> ${esc(a.status)}</div>` : ''}
          <div class="btns">${a.actions.map((x, j) => `<button data-al="${list.indexOf(a)}" data-a="${j}">${esc(x.label)}${x.cost ? ' <small>' + money(x.cost) + '</small>' : ''}</button>`).join('')}</div></div>`;
      });
      if (Object.keys(SYSTEMS).length) h += '<h3>Sistemas do prédio</h3>';
      for (const k in SYSTEMS) {
        const s = SYSTEMS[k];
        h += `<div class="card"><b class="t">${esc(s.label)} ${g.sys[k] ? '✔ instalado' : ''}</b><div class="k">${esc(s.desc)} Manutenção: ${money(s.upkeep)}/trimestre.</div>${g.sys[k] ? '' : `<div class="btns"><button data-sys="${k}">Instalar <small>${money(s.cost)}</small></button></div>`}</div>`;
      }
      h += `<h3>Equipes</h3><div class="card"><div class="k">Salário: <b>${money(WAGE)}</b> por funcionário a cada trimestre; contratação custa <b>${money(HIRE_COST)}</b>. Gerencie a equipe clicando no posto de segurança ou nas camareiras.</div></div>`;
      h += '<div class="actions"><button data-close class="primary">Fechar</button></div>';
      const sc = $('#panel').scrollTop;
      $('#panel').innerHTML = h; $('#panel').scrollTop = sc;
      $('#panel').querySelectorAll('[data-close]').forEach(b => b.onclick = () => this.closePanel());
      $('#panel').querySelectorAll('[data-al]').forEach(b => b.onclick = () => { const a = list[+b.dataset.al]; if (a) this.runAction(a.actions[+b.dataset.a], render); });
      $('#panel').querySelectorAll('[data-sys]').forEach(b => b.onclick = () => this.runAction({type: 'sys', name: b.dataset.sys}, render));
    };
    this.openPanel('', render); render();
  }

  // ------------------------------------------------------------ painéis
  openPanel(html, refresh) {
    $('#panel').innerHTML = html; $('#modal').classList.remove('hidden'); this.modalOpen = true;
    this.panelRefresh = refresh || null;
    clearInterval(this._pr);
    // o painel se refaz a cada 0,5 s; não refaz enquanto há um clique em andamento, o mouse está sobre um botão ou um campo de texto tem o foco (senão o clique se perde e o texto digitado some)
    if (refresh) this._pr = setInterval(() => { if (this.modalOpen && this.panelRefresh && !this._panelBusy()) this.panelRefresh(); }, 500);
    $('#panel').querySelectorAll('[data-close]').forEach(b => b.onclick = () => this.closePanel());
    if (!this.pausedByModal && this.g.speed && this.modalPauses) { this.pausedByModal = this.g.speed; this.app.setSpeed(0); }
  }
  _panelBusy() {
    const p = $('#panel');
    return !!(this._ptrDown || p.querySelector('button:hover, input:focus, textarea:focus, select:focus'));
  }
  closePanel() {
    $('#modal').classList.add('hidden'); this.modalOpen = false; clearInterval(this._pr); this.panelRefresh = null;
    if (this.pausedByModal) { this.app.setSpeed(this.pausedByModal); this.pausedByModal = 0; }
    this.modalPauses = false;
  }
  tierBar(v) { const t = evalTier(v); return `<span class="pill t${t}">${EVAL_NAMES[t]} (${Math.round(v)})</span>`; }
  showPerson(p) {
    const role = p.kind === 'staff' && p.home ? p.home.k : '';
    const kinds = {firefighter: 'Bombeiro', worker: 'Funcionário', resident: 'Morador', guest: 'Hóspede', visitor: 'Visitante', vip: 'Convidado VIP', staff: role === 'security' ? 'Segurança' : role === 'housekeeping' ? 'Camareira' : 'Funcionário do prédio'};
    const tier = stressTier(p.stress);
    const who = p.kind === 'visitor' ? '' : `${esc(p.name)}, ${p.age} anos`;
    const rot = p.prof && PROF_LABELS[p.prof] ? ` · ${esc(PROF_LABELS[p.prof])}` : '';
    this.openPanel(`<h2>${kinds[p.kind] || 'Pessoa'}</h2>
      ${who ? `<div class="sub">${who}${rot}</div>` : ''}
      <div class="sub">Estresse: <b style="color:${['#6fe39b', '#f2a541', '#e5484d'][tier]}">${['Calmo', 'Irritado', 'Furioso'][tier]}</b> (${Math.round(p.stress)}/${STRESS_MAX})</div>
      <p>Estado: ${({idle: 'parado', walk: 'andando', wait: 'esperando o elevador', ride: 'no elevador', stair: 'na escada', away: 'fora do prédio', work: 'trabalhando'})[p.st]}${p.task ? ' · tarefa: ' + (p.task.fire ? 'apagar incêndio' : p.task.bomb ? 'desarmar bomba' : 'limpar quarto') + ' no andar ' + floorLabel(p.task.L) : ''}</p>
      ${this.jobLine(p)}
      <p>Andar: ${floorLabel(Math.round(p.L))}${p.home ? ' · mora/trabalha: ' + FAC[p.home.k].label + ' (andar ' + floorLabel(p.home.L) + ')' : ''}</p>
      <div class="actions"><button data-close>Fechar</button></div>`);
  }
  // onde o morador trabalha: no prédio (com o andar) ou fora
  jobLine(p) {
    if (p.kind !== 'resident' || (p.prof !== 'day' && p.prof !== 'night')) return '';
    const w = this.g.jobOf(p);
    return `<p>Emprego: ${w ? '<b>' + esc(w.name || FAC[w.k].label) + '</b> no andar ' + floorLabel(w.L) + ' (no prédio)' : 'fora do prédio'}</p>`;
  }
  jobTag(q) {
    if (q.kind !== 'resident' || (q.prof !== 'day' && q.prof !== 'night')) return '';
    const w = this.g.jobOf(q);
    return w ? ' · trabalha: ' + esc(FAC[w.k].label.toLowerCase()) + ' (andar ' + floorLabel(w.L) + ')' : ' · trabalha fora';
  }
  // moradores que ocupam vagas deste local
  empLine(f) {
    const d = FAC[f.k];
    if (!(d.office || d.jobs) || !f.emp.length) return '';
    return `<p>Moradores empregados aqui: <b>${f.emp.length}</b> de ${this.g.jobCap(f)} vagas</p><ul class="sub">` + f.emp.map(q => `<li>${esc(q.name)}${q.home ? ' · mora no andar ' + floorLabel(q.home.L) : ''}</li>`).join('') + '</ul>';
  }
  showStairs(s) {
    this.openPanel(`<h2>${TRANSPORT[s.k].label}</h2><div class="sub">Liga os andares ${floorLabel(s.L)} e ${floorLabel(s.L + 1)}.</div>${s.dark ? `<p class="bad">⚡ Sem energia: virou uma escada comum.<br><small>${esc(this.g.darkText(s))}</small></p>` : ''}
      <div class="actions"><button data-close>Fechar</button></div>`);
  }
  showFac(f) {
    const def = FAC[f.k], g = this.g;
    const render = () => {
      if (f.dead) { this.closePanel(); return; }
      let h = `<h2>${esc(f.name || def.label)}</h2><div class="sub">${f.name ? esc(def.label) + ' · ' : ''}Andar ${floorLabel(f.L)}${f.h > 1 ? '–' + floorLabel(f.L + f.h - 1) : ''}</div>`;
      if (f.build < 1) h += `<p>Em obras: <b>${Math.round(f.build * 100)}%</b></p>`;
      else {
        if (f.fire) h += `<p class="bad">🔥 Em chamas!</p>`;
        h += this.empLine(f);
        if (def.tenant) {
          h += `<p>Situação: <b>${f.occ ? 'ocupado' : 'vago'}</b></p>`;
          if (!f.occ) h += '<h3>Por que está vago?</h3><ul class="why">' + g.vacancyReasons(f).map(r => `<li class="${r.sev === 'bad' ? 'neg' : ''}">${esc(r.text)}</li>`).join('') + '</ul>';
          if (f.occ && def.pop) {
            const avg = f.persons.length ? f.persons.reduce((a, p) => a + p.stress, 0) / f.persons.length : 0;
            h += `<p>${def.condo && f.family ? 'Família ' + esc(f.family) : 'Ocupantes'}: <b>${f.persons.length}</b> · estresse médio ${Math.round(avg)}</p><p>Avaliação: ${this.tierBar(f.eval)}</p>`;
            if (def.office && f.shift) h += `<p class="sub">Funcionamento: ${esc(SHIFT_LABELS[f.shift])}</p>`;
            h += `<ul class="sub">` + f.persons.map(q => `<li>${esc(q.name.split(' ')[0])}, ${q.age} anos${q.prof && PROF_LABELS[q.prof] ? ' · ' + esc(PROF_LABELS[q.prof]) : ''}${this.jobTag(q)}</li>`).join('') + `</ul>`;
          } else if (f.occ) h += `<p>Avaliação: ${this.tierBar(f.eval)}</p>`;
          if (f.occ) h += `<h3>Por que esta avaliação?</h3><table class="bd">${g.evalBreakdown(f).map(o => `<tr><td>${esc(o.label)}</td><td class="${o.v < 0 ? 'neg' : o.v > 0 ? 'pos' : ''}">${o.v > 0 ? '+' : ''}${Math.round(o.v)}</td></tr>`).join('')}</table>`;
          h += `<h3>Preço (${def.per})</h3><div class="row">` + def.prices.map((pr, i) => `<button data-pr="${i}" class="${f.price === i ? 'on' : ''}">${PRICE_NAMES[i]}<br><small>${money(pr)}</small></button>`).join('') + '</div>';
          h += `<p class="sub">Preços baixos atraem inquilinos mais rápido, mas rendem menos. Preços altos reduzem a satisfação.</p>`;
        } else if (def.hotel) {
          h += `<p>Situação: <b>${f.bugs ? '🪳 infestado de baratas' : f.dirty ? 'sujo (precisa de camareiras)' : f.guests.length ? 'hóspede' : 'vago'}</b></p><p>Diária: ${money(def.prices[f.price])}</p>`;
          h += `<p>Avaliação: ${this.tierBar(f.eval)}${f.trend > 3 ? ' ↑' : f.trend < -3 ? ' ↓' : ''}</p><h3>Por que esta avaliação?</h3><table class="bd">${g.evalBreakdown(f).map(o => `<tr><td>${esc(o.label)}</td><td class="${o.v < 0 ? 'neg' : o.v > 0 ? 'pos' : ''}">${o.v > 0 ? '+' : ''}${Math.round(o.v)}</td></tr>`).join('')}</table>`;
          if (f.bugs) h += `<div class="row"><button id="pest">🧪 Dedetizar agora <small>${money(PEST_COST)}</small></button></div>`;
          h += `<h3>Preço da diária</h3><div class="row">` + def.prices.map((pr, i) => `<button data-pr="${i}" class="${f.price === i ? 'on' : ''}">${PRICE_NAMES[i]}<br><small>${money(pr)}</small></button>`).join('') + '</div>';
        } else if (f.k === 'cinema') {
          h += `<h3>Filme em cartaz</h3><div class="col">` + FILMS.map((fl, i) => `<button data-film="${i}" class="${f.film === i ? 'on' : ''}">${esc(fl.title)} <small>${fl.kind === 'new' ? 'lançamento · ' + money(FILM_COST.new) : 'clássico · ' + money(FILM_COST.classic)}</small></button>`).join('') + '</div>';
        } else if (f.k === 'ruin') {
          const cost = g.rebuildCost(f);
          if (cost !== null) {
            const grp = g.ruinGroup(f);
            h += `<p>Restos de um(a) <b>${esc(FAC[f.was.k].label.toLowerCase())}</b> queimado(a).</p><div class="row"><button id="rebuild">🔨 Reconstruir <small>${money(cost)}</small></button><span class="sub">${Math.round(CORR.rebuildMult * 100)}% do custo original${grp.length > 1 ? ' · ' + grp.length + ' trechos' : ''}</span></div>`;
          } else h += `<p>Restos de uma sala queimada. Demolir limpa o espaço.</p>`;
        } else if (def.staff) {
          const crew = f.persons.length, busy = f.persons.filter(q => q.task).length;
          const pend = f.k === 'housekeeping' ? g.facs.filter(o => o.dirty || o.bugs).length : g.facs.filter(o => o.fire || o.bomb).length;
          h += `<div class="row"><button id="hire">+ Contratar <small>${money(HIRE_COST)}</small></button><button id="fire">− Dispensar</button><span class="sub">Salário ${money(WAGE)}/trimestre cada · máx. ${MAX_CREW}</span></div>`;
          h += `<p>Equipe: <b>${crew}</b> · em tarefa: <b>${busy}</b></p><p>${f.k === 'housekeeping' ? 'Quartos para limpar' : 'Ocorrências abertas'}: <b>${pend}</b></p><p class="sub">${f.k === 'security' ? 'Dois turnos (6h–18h e 18h–6h). Os seguranças vão até o incêndio ou a bomba.' : 'As camareiras vão aos quartos sujos ou infestados. Elevadores de serviço agilizam o trajeto.'}</p>`;
        } else if (FAC[f.k].waste) {
          const w = FAC[f.k].waste, lv = (f.lixo || 0) / w.cap;
          h += `<p>Lixo guardado: <b>${Math.round(lv * 100)}%</b> (${Math.round(f.lixo || 0)} de ${w.cap})</p><div class="meter"><i style="width:${Math.min(100, lv * 100)}%;background:${lv >= 1 ? '#e5484d' : lv >= LIXO.annoy ? '#f2a541' : '#3fb27f'}"></i></div>`;
          if (w.process) h += `<p class="sub">Esta usina processa o lixo sozinha (${w.process} por dia): não precisa de caminhão.</p>`;
          else h += `<p class="${lv >= 1 ? 'bad' : lv >= LIXO.annoy ? 'neg' : 'sub'}">${f.truckEta ? '🚛 O caminhão está a caminho.' : lv >= 1 ? 'Cheio! O lixo transborda e as pessoas por perto estão descontentes.' : lv >= LIXO.annoy ? 'Já incomoda quem está por perto: chame o caminhão.' : 'Ainda com folga. Quando passar de metade as pessoas por perto começam a reclamar.'}</p><div class="row"><button id="truck" ${f.truckEta || !f.lixo ? 'disabled' : ''}>🚛 Chamar caminhão <small>${money(LIXO.cost)}</small></button></div>`;
          h += `<p class="sub">${esc(DESC[f.k] || '')}</p>`;
        } else if (f.k === 'transit') {
          h += `<p>Linha: <b>${LINES[f.line].name}</b></p><div class="row">` + LINES.map((l, i) => `<button data-line="${i}" class="${f.line === i ? 'on' : ''}" style="border-left:6px solid ${l.col}">${l.name}</button>`).join('') + `</div><p class="sub">${esc(DESC[f.k] || '')}</p>`;
        } else if (def.park) {
          if (g.vehUnlinked(f)) h += `<p class="bad">⚠ Sem ligação com a entrada dos carros: não funciona.<br><small>${esc(g.vehWhy(f))}</small></p>`;
          if (f.stuck && f.owner) h += `<p class="bad">🚗 Carro preso: o dono saiu a pé. Ele sai sozinho quando a ligação voltar.</p>`;
          h += `<p class="sub">${esc(DESC[f.k] || '')}</p>`;
        } else if (f.k === 'busstop' || f.k === 'taxi') {
          const q = g.hailQueue(f), r = HAIL[f.k].rate, w = q / r;
          if (g.vehUnlinked(f)) h += `<p class="bad">⚠ Sem ligação com a rampa de carros (a cadeia de túneis precisa chegar a uma rampa): não funciona.</p>`;
          h += `<p>Fila agora: <b>${Math.round(q)}</b> pessoa(s) · espera de ${w < 0.5 ? 'menos de 1' : Math.round(w)} min</p><p class="sub">Escoa ${String(r).replace('.', ',')} pessoas por minuto. ${w > 3 ? '<span class="neg">Fila longa: quem espera chega estressado. Construa mais pontos.</span>' : 'A fila só vira problema nos horários de pico.'}</p><p>Custo diário: ${money(def.dailyCost)}</p><p>${esc(DESC[f.k] || '')}</p>`;
        } else if (def.biz && f.closed) {
          h += `<p class="bad">🏪 Fechado: o comerciante se mudou (${esc(f.closeWhy || 'sem movimento')}).</p><p class="sub">O ponto está vago, sem renda nem custo. Melhore o movimento e a segurança por perto: um novo comerciante abre sozinho.</p>`;
        } else if (def.commercial) h += `<p>Receita por cliente: ${money(def.perCustomer)}</p><p>Custo diário: ${money(def.dailyCost)}</p><p>Funciona das ${def.open[0] / 60}h às ${def.open[1] / 60}h.</p>`;
        else h += `<p>${esc(DESC[f.k] || '')}</p>`;
        if (g.needsAccess(f) && !g.reachable(f)) h += `<p class="bad">⚠ Sem acesso desde o térreo por escada ou elevador.</p>`;
      }
      if (def.removable !== false || f.k === 'lobby') h += `<h3>Nome</h3><div class="row"><input id="nm" maxlength="20" value="${esc(f.name || '')}" placeholder="${esc(def.label)}" style="flex:1;background:#171d2c;color:#e8ecf4;border:1px solid #39445f;border-radius:8px;padding:5px 8px"><button id="nmOk">Renomear</button></div>`;
      h += `<div class="actions">${def.removable ? '<button id="demo">Demolir</button>' : ''}<button data-close>Fechar</button></div>`;
      $('#panel').innerHTML = h;
      $('#panel').querySelectorAll('[data-close]').forEach(b => b.onclick = () => this.closePanel());
      $('#panel').querySelectorAll('[data-pr]').forEach(b => b.onclick = () => { f.price = +b.dataset.pr; render(); });
      $('#panel').querySelectorAll('[data-line]').forEach(b => b.onclick = () => { f.line = +b.dataset.line; render(); });
      $('#panel').querySelectorAll('[data-film]').forEach(b => b.onclick = () => {
        const i = +b.dataset.film;
        if (i === f.film) return;
        const cost = FILM_COST[FILMS[i].kind];
        if (g.funds < cost) { this.hint('Dinheiro insuficiente.', true); return; }
        g.expense('daily', cost); f.film = i; render();
      });
      const tk = $('#truck'); if (tk) tk.onclick = () => this.runAction({type: 'garbage', fac: f}, render);
      const hb = $('#hire'); if (hb) hb.onclick = () => this.runAction({type: 'hire', fac: f}, render);
      const fb = $('#fire'); if (fb) fb.onclick = () => this.runAction({type: 'dismiss', fac: f}, render);
      const rb = $('#rebuild'); if (rb) rb.onclick = () => this.runAction({type: 'rebuild', fac: f}, render);
      const pb = $('#pest'); if (pb) pb.onclick = () => this.runAction({type: 'pest', fac: f}, render);
      const nmOk = $('#nmOk'); if (nmOk) nmOk.onclick = () => { f.name = $('#nm').value.trim().slice(0, 20); render(); };
      const dm = $('#demo'); if (dm) dm.onclick = () => { const res = g.bulldoze(f.L, f.x); if (res.err) this.hint(res.err, true); else this.hint(res.what + ' demolido.'); this.r.selected = null; this.closePanel(); };
    };
    this.openPanel('', render); render();
  }
  showShaft(s) {
    const g = this.g, def = TRANSPORT[s.k];
    const render = () => {
      if (s.dead) { this.closePanel(); return; }
      if (s.carlift) {
        const linked = g.vehLinked().has(s), wm = g.liftWaitMin(s), rate = CARLIFT.rate * s.cars.length;
        const vagas = g.facs.filter(f => FAC[f.k].park && g.liftsFor(f).includes(s)).length;
        let h = `<h2>${def.label}</h2><div class="sub">Níveis ${floorLabel(s.lo)}–${floorLabel(s.hi)} · ${s.cars.length} cabine(s) · escoa ${rate} carros por minuto · ${vagas} vaga(s) dependem dele</div>`;
        if (s.dark) h += `<p class="bad">⚡ Sem energia: parado, e as vagas que dependem dele ficam sem ligação.<br><small>${esc(g.darkText(s))}</small></p>`;
        else if (!linked) h += `<p class="bad">⚠ Sem ligação com a entrada dos carros: encoste numa vaga que chegue à rampa ou ao portal. As vagas dele não funcionam.</p>`;
        h += `<p>Fila agora: <b>${Math.round(s.rush || 0)}</b> carro(s) · espera de ${wm < 0.5 ? 'menos de 1' : wm.toFixed(1).replace('.', ',')} min</p><p class="sub">${wm >= CARLIFT.giveUp ? '<span class="neg">Fila longa: os motoristas desistem das vagas atrás dele. Adicione cabines.</span>' : 'Quem espera chega estressado; acima de ' + CARLIFT.giveUp + ' min desiste da vaga.'}</p><p class="sub">${esc(DESC.carlift || '')}</p>`;
        h += `<div class="row"><button id="addCar" ${s.cars.length >= LIMITS.carsPerShaft ? 'disabled' : ''}>Adicionar cabine (${money(def.carCost)})</button><button id="rmCar" ${s.cars.length <= 1 ? 'disabled' : ''}>Remover cabine</button></div>`;
        h += `<h3>Andares atendidos <small>(clique para ativar/desativar; vagas de um andar desativado não ficam ligadas por este elevador)</small></h3><div class="floors">`;
        for (let L = s.hi; L >= s.lo; L--) h += `<button data-fl="${L}" class="${s.off[L] ? 'off' : ''}" title="${L === 0 ? 'A rua: sem este andar o elevador não é entrada de carros' : ''}">${floorLabel(L)}</button>`;
        h += `</div><div class="actions"><button id="demo">Demolir</button><button data-close>Fechar</button></div>`;
        $('#panel').innerHTML = h;
        $('#panel').querySelectorAll('[data-fl]').forEach(b => b.onclick = () => {
          const L = +b.dataset.fl, ativos = g.stopsOf(s);
          if (!s.off[L] && ativos.length <= 2) { this.hint('Mantenha pelo menos 2 andares ativos.', true); return; }
          g.setStopOff(s, L, !s.off[L]); render();
        });
        $('#panel').querySelectorAll('[data-close]').forEach(b => b.onclick = () => this.closePanel());
        $('#addCar').onclick = () => { const e = g.addCar(s); if (e) this.hint(e, true); render(); };
        $('#rmCar').onclick = () => { const e = g.removeCar(s); if (e) this.hint(e, true); render(); };
        $('#demo').onclick = () => { g.removeShaft(s); this.r.selected = null; this.closePanel(); };
        return;
      }
      const stops = g.stopsOf(s);
      let waiting = 0; for (const k in s.q) waiting += s.q[k].length;
      let riding = 0; for (const c of s.cars) riding += c.pax.length;
      let h = `<h2>${def.label}</h2><div class="sub">Andares ${floorLabel(s.lo)}–${floorLabel(s.hi)} · ${s.cars.length} cabine(s) · capacidade ${def.cap} · esperando: ${waiting} · a bordo: ${riding}</div>`;
      if (s.dark) h += `<p class="bad">⚡ Sem energia: parado, todos vão de escada.<br><small>${esc(g.darkText(s))}</small></p>`;
      h += `<div class="row"><button id="addCar" ${s.cars.length >= LIMITS.carsPerShaft ? 'disabled' : ''}>Adicionar cabine (${money(def.carCost)})</button><button id="rmCar" ${s.cars.length <= 1 ? 'disabled' : ''}>Remover cabine</button><label class="toggle"><input type="checkbox" id="hide" ${s.hidden ? 'checked' : ''}> Ocultar poço</label></div>`;
      h += `<h3>Andares atendidos <small>(clique para ativar/desativar)</small></h3><div class="floors">`;
      const carAt = new Set(s.cars.map(c => Math.round(c.y)));
      for (let L = s.hi; L >= s.lo; L--) {
        const exp = s.k === 'express' && !isExpressStop(L);
        const off = !!s.off[L] || exp, q = s.q[L] ? s.q[L].length : 0;
        h += `<button data-fl="${L}" class="${off ? 'off' : ''} ${carAt.has(L) ? 'car' : ''}" ${exp ? 'disabled' : ''} title="${q} esperando">${floorLabel(L)}${q ? '·' + q : ''}</button>`;
      }
      h += `</div><div class="actions"><button id="demo">Demolir</button><button data-close>Fechar</button></div>`;
      $('#panel').innerHTML = h;
      $('#panel').querySelectorAll('[data-close]').forEach(b => b.onclick = () => this.closePanel());
      $('#addCar').onclick = () => { const e = g.addCar(s); if (e) this.hint(e, true); render(); };
      $('#rmCar').onclick = () => { const e = g.removeCar(s); if (e) this.hint(e, true); render(); };
      $('#hide').onchange = ev => { s.hidden = ev.target.checked; };
      $('#panel').querySelectorAll('[data-fl]').forEach(b => b.onclick = () => {
        const L = +b.dataset.fl;
        if (!s.off[L] && stops.length <= 2) { this.hint('Mantenha pelo menos 2 andares ativos.', true); return; }
        g.setStopOff(s, L, !s.off[L]); render();
      });
      $('#demo').onclick = () => { g.removeShaft(s); this.r.selected = null; this.closePanel(); };
    };
    this.openPanel('', render); render();
  }
  showStarPanel(just) {
    const g = this.g;
    const unlock = {};
    for (const k in FAC) { const s = FAC[k].star; if (s > 1 && !FAC[k].nobuild) (unlock[s] = unlock[s] || []).push(FAC[k].label); }
    for (const k in TRANSPORT) { const s = TRANSPORT[k].star; if (s > 1) (unlock[s] = unlock[s] || []).push(TRANSPORT[k].label); }
    const dem = g.demandsList();
    let h = `<h2>${just ? '★ Nova estrela!' : 'Classificação'}</h2><div class="sub big gold">${'★'.repeat(Math.min(5, g.star))}${'☆'.repeat(5 - Math.min(5, g.star))}${g.star >= 6 ? ' ♛' : ''}</div>`;
    if (g.star < 6) {
      h += `<h3>Para a próxima estrela</h3><ul class="dm">` + dem.map(d => `<li class="${d.met ? 'met' : ''}">${d.met ? '✔' : '○'} ${esc(d.text)}</li>`).join('') + '</ul>';
    } else h += '<p>Sua torre é um marco da cidade. Parabéns!</p>';
    h += '<h3>Liberações</h3><ul class="dm">';
    for (let s = 2; s <= 5; s++) if (unlock[s]) h += `<li class="${g.star >= s ? 'met' : ''}"><b>${s}★</b> ${unlock[s].map(esc).join(', ')}</li>`;
    h += '</ul><div class="actions"><button data-close class="primary">Ok</button></div>';
    this.openPanel(h);
  }
  showFinance(fim) {
    // aberta na virada do trimestre, o "atual" acabou de zerar: mostra o trimestre que fechou
    const g = this.g, enc = fim && g.fin.last, cur = enc ? g.fin.last : g.fin.cur, last = enc ? null : g.fin.last, fc = enc ? {rent: 0, inc: {}, mnt: {}} : g.quarterCalc();
    const fmn = {}; for (const k in fc.mnt) fmn[k] = Math.round(fc.mnt[k]);   // aluguéis e manutenção só são lançados na virada do trimestre: aqui entram como previsão
    const ex = t => enc ? '' : t;
    const row = (lbl, a, b, c) => `<tr><td>${esc(lbl)}</td><td class="n">${money(a || 0)}</td>${ex(`<td class="n">${money(c || 0)}</td><td class="n mut">${last ? money(b || 0) : '—'}</td>`)}</tr>`;
    const sum = o => Object.values(o || {}).reduce((a, v) => a + v, 0);
    let h = `<h2>Finanças</h2><div class="sub">Dinheiro: <b>${money(g.funds)}</b> · ${enc ? 'trimestre encerrado' : `trimestre atual: dia ${g.quarterDay + 1} de ${QDAYS}`}</div>`;
    h += `<table><tr><th>Receitas</th><th class="n">${enc ? 'Trimestre encerrado' : 'Até agora'}</th>${enc ? '' : '<th class="n">Previsto no fim</th><th class="n">Anterior</th>'}</tr>`;
    for (const k of INCOME_CATS) if (cur.inc[k] || fc.inc[k] || (last && last.inc[k])) h += row(INCOME_LABELS[k], cur.inc[k], last && last.inc[k], (cur.inc[k] || 0) + (fc.inc[k] || 0));
    h += `<tr class="tot"><td>Total</td><td class="n">${money(sum(cur.inc))}</td>${ex(`<td class="n">${money(sum(cur.inc) + fc.rent)}</td><td class="n mut">${last ? money(sum(last.inc)) : '—'}</td>`)}</tr>`;
    h += `<tr><th>Despesas</th><th></th>${ex('<th></th><th></th>')}</tr>`;
    for (const k of MAINT_CATS) if (cur.mnt[k] || fmn[k] || (last && last.mnt[k])) h += row(MAINT_LABELS[k], -(cur.mnt[k] || 0), last ? -(last.mnt[k] || 0) : 0, -((cur.mnt[k] || 0) + (fmn[k] || 0)));
    h += `<tr class="tot"><td>Total</td><td class="n">${money(-sum(cur.mnt))}</td>${ex(`<td class="n">${money(-sum(cur.mnt) - sum(fmn))}</td><td class="n mut">${last ? money(-sum(last.mnt)) : '—'}</td>`)}</tr>`;
    h += `<tr class="tot"><td>Resultado</td><td class="n">${money(sum(cur.inc) - sum(cur.mnt))}</td>${ex(`<td class="n">${money(sum(cur.inc) + fc.rent - sum(cur.mnt) - sum(fmn))}</td><td class="n mut">${last ? money(sum(last.inc) - sum(last.mnt)) : '—'}</td>`)}</tr></table>`;
    h += '<div class="actions"><button data-close class="primary">Fechar</button></div>';
    this.modalPauses = !enc;   // aberta à mão, pausa; o relatório automático do fim do trimestre não pausa
    this.openPanel(h);
  }
  // ------------------------------------------------------------ tela inicial
  // o jogo fica pausado atrás dela (a torre aparece esmaecida ao fundo); `titleSpeed` guarda a velocidade para "Continuar"
  showTitle() {
    const app = this.app, el = $('#title');
    if (!this.titleOpen) { this.titleSpeed = this.g.speed || this.prevSpeed || 1; this.app.setSpeed(0); this.app.startDemo(); }
    this.titleOpen = true; document.body.classList.add('intro');
    const auto = app.saves.loadAutosave(), last = app.saves.list().filter(s => !s.empty).sort((a, b) => b.savedAt - a.savedAt)[0];
    const info = d => `${'★'.repeat(Math.min(5, d.star || 1))} · dia ${d.day || Math.floor((d.t || 0) / 1440) + 1} · ${money(d.funds)}`;
    const hasSlots = app.saves.list().some(s => !s.empty);
    const soundLabel = () => app.muted ? 'Som: desligado' : 'Som: ligado';
    const item = (id, label, sub, cls = '') => `<button id="${id}" class="${cls}" style="--i:${item.n}"><span class="no">${String(++item.n).padStart(2, '0')}</span><span class="tx">${label}<small>${sub}</small></span><span class="ar" aria-hidden="true"></span></button>`;
    item.n = 0;
    const dicas = ['Elevadores expressos e saguões aéreos ligam torres de mais de 30 andares.', 'Cada sala só vale a pena se alguém conseguir chegar até ela: ligue escadas e elevadores.', 'Energia e água são locais: construa geradores e bombas perto de quem precisa.', 'Sprinklers, extintores e hidrantes protegem só a área deles.', 'Comércio e lazer por perto deixam os inquilinos mais felizes.', 'A cada estrela, novas salas e novos desafios.', 'Use a visão Humor do minimapa para achar as unidades mais insatisfeitas.'];
    let di = Math.floor(Math.random() * dicas.length);
    const sparks = Array.from({length: 26}, (_, i) => `<i style="--x:${(i * 37 + 11) % 100}%;--s:${2 + (i * 7) % 5}px;--d:${9 + (i * 5) % 11}s;--l:${-(i * 3) % 14}s;--o:${.25 + (i % 4) * .15}"></i>`).join('');
    el.innerHTML = `<div class="fx rays"></div><div class="fx flare"></div><div class="fx sparks">${sparks}</div><div class="fx grain"></div><div class="fx bars"></div>
      <div class="top"><span class="live"><b></b>Cidade ao vivo</span><span id="tClock"></span></div>
      <div class="box">
      ${this.logoSvg()}
      <p class="tag"><i></i>Construa. Conecte. Alcance o céu.<i></i></p>
      <nav>
        ${auto ? item('tCont', 'Continuar', info(auto), 'primary') : ''}
        ${item('tNew', 'Novo jogo', 'Comece uma torre do zero, no térreo.', auto ? '' : 'primary')}
        ${item('tLoad', 'Carregar jogo', last ? `${esc(last.name)} · ${info(last)}` : 'Retome um dos cinco slots salvos.', hasSlots ? '' : 'off')}
        ${item('tImp', 'Importar torre', 'Abra uma torre de um arquivo.')}
        ${item('tHelp', 'Como jogar', 'O básico de construir, ligar e administrar.')}
        ${item('tSound', soundLabel(), 'Liga ou desliga a trilha e os sons da cidade.')}
      </nav></div>
      <div class="dica"><b>Dica</b><span id="tDica">${dicas[di]}</span></div>
      <div class="keys"><span><kbd>↑</kbd><kbd>↓</kbd> Navegar</span><span><kbd>Enter</kbd> Selecionar</span><em>Salvamento automático neste navegador</em></div>`;
    clearInterval(this._tc); clearInterval(this._td);
    this._tc = setInterval(() => { const e = $('#tClock'), d = app.demo; if (!e || !d || !this.titleOpen) return; e.textContent = 'Dia ' + (Math.floor(d.t / 1440) + 1) + ' · ' + hourStr(d.minute); }, 1000);
    this._td = setInterval(() => { const e = $('#tDica'); if (!e || !this.titleOpen) return; e.style.opacity = 0; setTimeout(() => { di = (di + 1) % dicas.length; e.textContent = dicas[di]; e.style.opacity = 1; }, 400); }, 8000);
    clearTimeout(this._tt); el.classList.remove('hidden', 'saindo');
    const go = $('#tCont') || $('#tNew'); if (go) go.focus({preventScroll: true});
    if ($('#tCont')) $('#tCont').onclick = () => this.hideTitle(true);
    $('#tNew').onclick = () => {
      if (auto && !confirm('Começar um novo jogo? O autosave atual será apagado (os slots salvos continuam).')) return;
      this.app.newGame(); this.hideTitle(false); this.showHelp();
    };
    $('#tLoad').onclick = () => { if (hasSlots) this.showSlots(); };
    $('#tImp').onclick = () => this.app.importSave();
    $('#tHelp').onclick = () => this.showHelp();
    $('#tSound').onclick = () => { this.app.setMuted(!this.app.muted); $('#tSound .tx').firstChild.textContent = soundLabel(); };
    // setas ↑/↓ percorrem o menu como num jogo de console
    el.onkeydown = e => {
      if (this.modalOpen || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
      const bs = [...el.querySelectorAll('nav button:not(.off)')], i = bs.indexOf(document.activeElement);
      bs[(i + (e.key === 'ArrowDown' ? 1 : bs.length - 1)) % bs.length].focus(); e.preventDefault();
    };
  }
  // logotipo desenhado como marca: letras geométricas de traço único com volume (borda, extrusão e brilho), sobre um horizonte de prédios.
  // Desenhado em SVG, e não com fonte do sistema, que muda de máquina para máquina.
  logoSvg() {
    const G = {   // cada letra numa caixa de 44 × 68
      A: ['M6 66 L22 6 L38 66', 'M12 44 H32'], R: ['M7 66 V6 H25 Q38 6 38 20 Q38 34 25 34 H7', 'M24 34 L38 66'],
      N: ['M7 66 V6 L37 66 V6'], H: ['M7 6 V66 M37 6 V66', 'M7 36 H37'],
      C: ['M38 17 Q34 6 22 6 Q7 6 7 36 Q7 66 22 66 Q34 66 38 55'], E: ['M37 6 H7 V66 H37', 'M7 36 H31'],
      U: ['M7 6 V46 Q7 66 22 66 Q37 66 37 46 V6'], '-': ['M3 36 H25'],
    };
    const word = 'ARRANHA-CÉU', adv = ch => (ch === '-' ? 28 : 44) + 8;
    // uma camada = a palavra inteira com o mesmo traço (atributos em cada grupo: estilo não atravessa <use>)
    const layer = (stroke, w, acc, accW, dx = 0, dy = 0) => {
      let x = 0, out = '';
      for (const ch of word) {
        const k = ch === 'É' ? 'E' : ch;
        out += `<g transform="translate(${x} 0)">${G[k].map(d => `<path d="${d}"/>`).join('')}${ch === 'É' ? `<path d="M16 -6 L30 -17" stroke="${acc}" stroke-width="${accW}"/>` : ''}</g>`;
        x += adv(ch);
      }
      return `<g fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="miter" stroke-miterlimit="2.2" transform="translate(${dx} ${dy})">${out}</g>`;
    };
    const W = [...word].reduce((a, ch) => a + adv(ch), -8);
    let sky = '', bx = 0, n = 0;   // horizonte: prédios de alturas variadas, com antenas e janelas acesas
    while (bx < W) {
      const w = 7 + (n * 5) % 9, h = 6 + Math.abs(Math.round(Math.sin(n * 2.3) * 12 + Math.cos(n * 0.9) * 5));
      sky += `<rect x="${bx}" y="${100 - h}" width="${w - 1}" height="${h}"/>`;
      if (n % 5 === 2) sky += `<rect x="${bx + w / 2 - 1}" y="${100 - h - 6}" width="1" height="6"/>`;
      if (n % 3 === 0) sky += `<rect class="wn" x="${bx + 2}" y="${100 - h + 3}" width="1.6" height="1.6"/>`;
      bx += w; n++;
    }
    let ext = '';   // extrusão: cópias deslocadas, do azul médio ao quase preto
    for (let i = 9; i >= 1; i--) { const c = Math.round(70 - i * 5); ext += layer(`rgb(8,${c},${c + 60})`, 12, '#8a3306', 7, i * .8, i * .8); }
    return `<h1 class="logo" aria-label="Arranha-Céu"><svg viewBox="-8 -26 ${W + 20} 140" aria-hidden="true">
      <defs><linearGradient id="lgf" gradientUnits="userSpaceOnUse" x1="0" y1="-6" x2="0" y2="72"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#e4f3ff"/><stop offset=".52" stop-color="#9fd4ff"/><stop offset="1" stop-color="#58b0f4"/></linearGradient>
        <linearGradient id="lgs" x1="0" x2="1"><stop offset="0" stop-color="#35b6ff" stop-opacity="0"/><stop offset=".5" stop-color="#35b6ff"/><stop offset="1" stop-color="#ff8a3d"/></linearGradient></defs>
      <g class="sky">${sky}</g><rect class="hz" x="0" y="100" width="${W}" height="1.6"/>
      ${ext}${layer('#0a2552', 17, '#5a2203', 12)}${layer('url(#lgf)', 12, '#ff8a3d', 7)}${layer('rgba(255,255,255,.9)', 1.4, 'rgba(255,225,190,.9)', 1.4, -2.4, -2.4)}
    </svg></h1>`;
  }
  // resume: volta à velocidade de antes; ao carregar um save ou começar de novo, a velocidade já veio do próprio jogo
  hideTitle(resume) {
    if (!this.titleOpen) return;
    this.titleOpen = false; document.body.classList.remove('intro'); clearInterval(this._tc); clearInterval(this._td);
    const el = $('#title'); el.classList.add('saindo');   // some em fade; o jogo já começa por baixo
    clearTimeout(this._tt); this._tt = setTimeout(() => { if (!this.titleOpen) el.classList.add('hidden'); el.classList.remove('saindo'); }, 450);
    this.app.stopDemo(resume);
    if (resume) this.app.setSpeed(this.titleSpeed || 1);
  }
  showMenu() {
    this.openPanel(`<h2>☰ Menu</h2>
      <div class="col">
        <button id="mHome">🏠 Menu principal</button>
        <button id="mSave">💾 Salvar e carregar (slots)</button>
        <button id="mMsgs">💬 Mensagens recentes</button>
        <button id="mStats">📈 Estatísticas</button>
        <div class="vols" style="display:grid;grid-template-columns:auto 1fr;gap:2px 8px;align-items:center;font-size:12px;padding:2px 4px">${[['master', 'Geral'], ...Object.keys(SOM_CATS).map(k => [k, SOM_CATS[k].label])].map(([k, n]) => `<label for="vol_${k}">${n}</label><input type="range" id="vol_${k}" data-vol="${k}" min="0" max="1" step="0.05" value="${k === 'master' ? this.app.mix.master : this.app.mix.cats[k]}">`).join('')}</div>
        <button id="mSound">${this.app.muted ? '🔇 Som: desligado' : '🔊 Som: ligado'}</button>
        <button id="mHelp">❓ Como jogar</button>
        <button id="mExport">⬇ Exportar torre (arquivo)</button>
        <button id="mImport">⬆ Importar torre (arquivo)</button>
        <button id="mNew">🗑 Novo jogo</button>
      </div><div class="actions"><button data-close class="primary">Continuar</button></div>`);
    $('#mHome').onclick = () => { this.closePanel(); this.app.autosave(); this.showTitle(); };
    $('#mSave').onclick = () => this.showSlots();
    $('#mMsgs').onclick = () => this.showMessages();
    $('#mHelp').onclick = () => this.showHelp();
    $('#mStats').onclick = () => this.showStats();
    document.querySelectorAll('#panel [data-vol]').forEach(el => { el.oninput = () => { this.app.setVolume(el.dataset.vol, el.value); if (!this.app.muted && el.dataset.vol !== 'master') this.app.sound(el.dataset.vol === 'voz' ? 'voz' : el.dataset.vol === 'alerta' ? 'amb' : el.dataset.vol === 'ambiente' ? 'carro' : 'ding', {seed: 3, mood: 'festa'}); }; });
    $('#mSound').onclick = e => { this.app.setMuted(!this.app.muted); e.target.textContent = this.app.muted ? '🔇 Som: desligado' : '🔊 Som: ligado'; };
    $('#mExport').onclick = () => this.app.exportSave();
    $('#mImport').onclick = () => this.app.importSave();
    $('#mNew').onclick = () => { if (confirm('Começar um novo jogo? O progresso não salvo será perdido.')) { this.app.newGame(); this.closePanel(); } };
  }
  // lista dos 5 slots (salvar, carregar, renomear, apagar) e o autosave
  showSlots() {
    const app = this.app, when = t => new Date(t).toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: 'short'});
    const render = () => {
      let h = '<h2>💾 Salvar e carregar</h2><p class="sub">Cinco slots. O jogo também salva sozinho (autosave) a cada dia e ao fechar a página.</p>';
      for (const s of app.saves.list()) {
        h += `<div class="card"><b class="t">Slot ${s.id}${s.empty ? ' — vazio' : ' — ' + esc(s.name) + (s.last ? ' · último usado' : '')}</b>`;
        if (!s.empty) h += `<div class="k">${'★'.repeat(Math.min(5, s.star))} · dia ${s.day} · ${s.pop} pessoas · ${money(s.funds)}<br>${esc(when(s.savedAt))}</div>`;
        h += `<div class="btns"><button data-sv="${s.id}">${s.empty ? 'Salvar aqui' : 'Sobrescrever'}</button>${s.empty ? '' : `<button data-ld="${s.id}">Carregar</button><button data-rn="${s.id}">Renomear</button><button data-dl="${s.id}">Apagar</button>`}</div></div>`;
      }
      const auto = app.saves.loadAutosave();
      h += `<div class="card"><b class="t">Autosave</b>${auto ? `<div class="k">${'★'.repeat(Math.min(5, auto.star || 1))} · dia ${Math.floor((auto.t || 0) / 1440) + 1} · ${money(auto.funds)}</div><div class="btns"><button id="ldAuto">Carregar</button></div>` : '<div class="k">Ainda não há autosave.</div>'}</div>`;
      h += '<div class="actions"><button data-close class="primary">Fechar</button></div>';
      $('#panel').innerHTML = h;
      $('#panel').querySelectorAll('[data-close]').forEach(b => b.onclick = () => this.closePanel());
      $('#panel').querySelectorAll('[data-sv]').forEach(b => b.onclick = () => {
        const id = +b.dataset.sv, cur = app.saves.list()[id - 1];
        if (cur.empty) { const n = prompt('Nome do slot ' + id + ':', 'Torre ' + id); if (n === null) return; app.saveSlot(id, n || undefined); }
        else if (confirm('Sobrescrever o slot ' + id + ' (' + cur.name + ')?')) app.saveSlot(id);
        render();
      });
      $('#panel').querySelectorAll('[data-ld]').forEach(b => b.onclick = () => { if (confirm('Carregar o slot ' + b.dataset.ld + '? O progresso não salvo será perdido.')) app.loadSlot(+b.dataset.ld); });
      $('#panel').querySelectorAll('[data-rn]').forEach(b => b.onclick = () => {
        const id = +b.dataset.rn, n = prompt('Novo nome:', app.saves.list()[id - 1].name);
        if (n && app.saves.rename(id, n)) render();
      });
      $('#panel').querySelectorAll('[data-dl]').forEach(b => b.onclick = () => { if (confirm('Apagar o slot ' + b.dataset.dl + '? Não dá para desfazer.')) { app.saves.remove(+b.dataset.dl); render(); } });
      const la = $('#ldAuto'); if (la) la.onclick = () => { if (confirm('Carregar o autosave? O progresso não salvo será perdido.')) app.loadData(app.saves.loadAutosave()); };
    };
    this.openPanel('', render); render();
  }
  showStats() {
    const h = this.g.hist, uh = this.g.uhist || [];
    const chart = (key, label, col, fmt) => {
      if (h.length < 2) return `<h3>${label}</h3><p class="sub">Aguarde alguns dias para ver o gráfico.</p>`;
      const vals = h.map(o => o[key]), mn = Math.min(...vals), mx = Math.max(...vals), W = 420, H = 80, rng = mx - mn || 1;
      const pts = vals.map((v, i) => `${(i / (vals.length - 1) * W).toFixed(1)},${(H - 6 - (v - mn) / rng * (H - 12)).toFixed(1)}`).join(' ');
      return `<h3>${label} <small>${fmt(vals[vals.length - 1])} · mín ${fmt(mn)} · máx ${fmt(mx)}</small></h3>
        <svg viewBox="0 0 ${W} ${H}" width="100%" style="background:#171d2c;border-radius:8px"><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2"/></svg>`;
    };
    // gráfico por hora com várias séries (escala 0–max); a linha tracejada marca 100% (a capacidade)
    const hourly = (label, series, max, unit, note) => {
      if (uh.length < 2) return `<h3>${label}</h3><p class="sub">Aguarde algumas horas de jogo para ver o gráfico.</p>`;
      const W = 420, H = 80, y = v => H - 6 - Math.min(max, v) / max * (H - 12);
      const lines = series.map(s => `<polyline points="${uh.map((o, i) => `${(i / (uh.length - 1) * W).toFixed(1)},${y(o[s.key]).toFixed(1)}`).join(' ')}" fill="none" stroke="${s.col}" stroke-width="2"/>`).join('');
      const out = uh.map((o, i) => (o.oe || o.oa) && series.some(s => s.key === 'e' || s.key === 'a') ? `<rect x="${(i / (uh.length - 1) * W - 2).toFixed(1)}" y="0" width="4" height="${H}" fill="rgba(229,72,77,.25)"/>` : '').join('');
      const last = uh[uh.length - 1];
      return `<h3>${label} <small>${series.map(s => `<span style="color:${s.col}">${s.name} ${last[s.key]}${unit}</span>`).join(' · ')}</small></h3>
        <svg viewBox="0 0 ${W} ${H}" width="100%" style="background:#171d2c;border-radius:8px">${max >= 100 ? `<line x1="0" x2="${W}" y1="${y(100)}" y2="${y(100)}" stroke="#e5484d" stroke-dasharray="4 3" stroke-width="1"/>` : ''}${out}${lines}</svg>${note ? `<p class="sub">${note}</p>` : ''}`;
    };
    const u = this.g.utilFresh();
    this.openPanel(`<h2>📈 Estatísticas</h2><div class="sub">Dias: últimos ${h.length} · Horas: últimas ${uh.length}</div>
      ${chart('pop', 'População', '#6fe39b', v => v.toLocaleString('pt-BR'))}
      ${chart('funds', 'Dinheiro', '#f6c445', v => fmtMoney(v))}
      ${chart('ev', 'Avaliação média (0–300)', '#4aa3df', v => String(v))}
      <h2 style="margin-top:14px">⚡💧 Utilidades e serviços</h2>
      ${hourly('Energia', [{key: 'e', name: 'consumo', col: '#f6c445'}, {key: 'se', name: 'bateria', col: '#6fe39b'}], 130, '%', 'Consumo em % da capacidade (linha vermelha = 100%); faixas vermelhas = apagão da rede. Agora: ' + Math.round(u.energia.use) + ' de ' + Math.round(u.energia.cap) + '.')}
      ${hourly('Água', [{key: 'a', name: 'consumo', col: '#4aa3df'}, {key: 'sa', name: 'caixas', col: '#9ad8ff'}], 130, '%', 'Consumo em % da capacidade; faixas vermelhas = falta d\'água. Agora: ' + Math.round(u.agua.use) + ' de ' + Math.round(u.agua.cap) + '.')}
      ${hourly('Lixo', [{key: 'l', name: 'depósito mais cheio', col: '#c9a23a'}], 100, '%', 'A partir de 50% as pessoas por perto reclamam; chame o caminhão pelo painel do depósito.')}
      ${hourly('Fila nos pontos de ônibus e táxi', [{key: 'q', name: 'maior fila', col: '#e8a317'}], Math.max(10, ...uh.map(o => o.q)), ' pessoas', 'Fila grande deixa quem espera estressado: construa mais pontos.')}
      <p class="sub">Carros no estacionamento: ${this.g.facs.filter(f => f.owner).length}/${this.g.count('parkspace')} · Estações de metrô: ${this.g.stations().length} (nível de transporte público: ${this.g.transportTier()}/3) · Depósitos de lixo: ${this.g.deposits().length}</p>
      <div class="actions"><button data-close class="primary">Fechar</button></div>`);
  }
  showMessages() {
    const l = this.g.log;
    this.openPanel(`<h2>Mensagens</h2><ul class="msgs">${l.length ? l.map(m => `<li><small>${hourStr(m.t)}</small> ${esc(m.text)}</li>`).join('') : '<li>Nenhuma mensagem ainda.</li>'}</ul><div class="actions"><button data-close class="primary">Fechar</button></div>`);
  }
  showHelp() {
    this.openPanel(`<h2>🏙 Como jogar</h2>
      <ul class="dm">
        <li><b>Comece</b> arrastando um <b>saguão</b> pelo térreo (ferramenta Construir). Ele ganha acabamento conforme as estrelas da torre.</li>
        <li>Construa <b>escritórios</b> e <b>apartamentos</b> nos andares (cada sala precisa de apoio no andar de baixo; o piso é criado sozinho). Ligue os andares: <b>arraste na vertical</b> para um elevador ou clique para uma <b>escada</b> (grupo Escadas, junto com a escada rolante). Elevadores comuns vão a 30 andares; use <b>saguões aéreos</b> (15, 30, 45...) e <b>expressos</b> para o resto.</li>
        <li><b>Estender o elevador:</b> em Inspecionar, clique ou <b>arraste</b> a seta da casa de máquinas (topo) ou do poço (base); arrastar de volta encurta. <b>R</b> escolhe o lado das rampas e túneis descendentes.</li>
        <li><b>Estrelas:</b> vêm da população (e do humor). Cada estrela libera salas novas e eventos: o jogo só cobra o que você já pode construir.</li>
        <li><b>Humor e demanda:</b> cada unidade procura serviços por perto (café, academia, creche, bicicletário, transporte público...). Veja o que falta em <b>Por que está vago?</b>, na dica da visão Humor e na nota da unidade. Filas, barulho, sujeira, lixo acumulado, falta de energia ou água e insegurança derrubam a nota; inquilinos insatisfeitos vão embora.</li>
        <li><b>Comércio e serviços</b> atraem visitantes e rendem, mas <b>fecham</b> (e o ponto fica vago) se ficarem dias sem movimento ou com insegurança; um novo comerciante abre quando melhora. Hotéis precisam de <b>camareiras</b>.</li>
        <li><b>Transporte:</b> ponto de <b>ônibus</b> e <b>táxi</b> (2★, térreo ou subsolo) atendem a torre inteira, mas a fila estressa. O <b>metrô</b> (4★) pode ter várias estações e linhas (escolha a cor clicando). No subsolo, carros usam <b>rampa</b>, <b>túneis</b> e o <b>túnel com portal</b> (entrada direta para a rua).</li>
        <li><b>Energia e água são locais:</b> <b>energia</b>: a rede pública entra pelo saguão do térreo, mas é pouca; construa <b>geradores</b>, <b>placas solares</b> e <b>baterias</b> (a bateria é carregada pelo gerador, placa ou outra bateria por perto: uma alimenta a próxima, andar após andar). <b>Água</b>: não vem da rua. <b>Bombas</b> de subsolo (comum, reforçada e industrial, com vazão e alcance diferentes) abastecem as salas ao alcance e a sobra enche as <b>caixas d'água</b> acima delas. A água <b>desce sozinha</b> (a caixa abastece o andar dela e os de baixo, e enche caixas mais baixas), mas para <b>subir</b> é preciso bomba: a de subsolo ou uma <b>bomba de recalque</b> (em qualquer andar, gasta energia) que eleva de uma caixa para outra acima. Caixa vazia não fornece nada. Sala fora do alcance de qualquer fonte, ou que a fonte não dá conta, fica <b>escura com um ⚡ amarelo</b> (ou com uma 💧): comércio fecha na hora, ninguém atende nela e o humor cai. Use as visões <b>⚡ Energia</b> e <b>💧 Água</b> para ver até onde a rede chega. Sem água no corredor, sprinklers e hidrantes falham; sem energia, câmeras e elevadores. Apagões derrubam só a rede pública de energia.</li>
        <li><b>Clima e estações:</b> verão pede mais água, inverno mais energia; garoa, chuva e <b>tempestades</b> (com raios) podem causar apagões; chuva vira neve no inverno. A previsão de amanhã aparece às 18h. As <b>Estatísticas</b> mostram energia, água, lixo e filas por hora.</li>
        <li><b>Lixo</b> (3★): o depósito no subsolo enche aos poucos; quando passar da metade as pessoas por perto reclamam e <b>você chama o caminhão</b> (painel ou alerta). A usina de reciclagem processa sozinha.</li>
        <li><b>Segurança e fogo:</b> corredores com extintor, câmera, hidrante ou sprinklers protegem só a área deles; o posto de segurança cobre alguns andares. Bombeiros chegam a pé pelas escadas.</li>
        <li><b>Mais:</b> convidados <b>VIP</b> (3★) avaliam uma suíte limpa; o <b>heliponto</b> (5★) os traz de helicóptero; a <b>Capela celeste</b> (5★) completa a torre e rende com casamentos. Use <b>Ajustar</b> para preços, filmes e paradas dos elevadores.</li>
        <li>Aluguéis e manutenção são cobrados no fim de cada trimestre (${QDAYS} dias). <b>Console:</b> digite <code>cheat('ajuda')</code> (F12) para o modo deus.</li>
      </ul>
      <p class="sub">Mover: arraste · Zoom: Ctrl+roda, +/− ou pinça · Rolar: roda · Espaço: pausa · V: visão do mapa · 1–4: velocidade · R: lado da rampa · Shift: encurtar elevador · Esc: cancelar</p>
      <div class="actions"><button data-close class="primary">Entendi</button></div>`);
  }
}
