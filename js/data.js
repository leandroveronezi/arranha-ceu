'use strict';
// Arranha-Céu — dados estáticos. 1 unidade = 8 px de largura, 1 andar = 36 px de altura.
// Tudo fica numa grade de caixas: 1 caixa (BOX) = 4 unidades. Toda largura é múltiplo de BOX e toda posição X é múltiplo de BOX.
// Nível 0 = térreo (andar 1), 1 = andar 2, ... Negativos = subsolos (B1, B2, ...). O mundo não tem teto prático: guarda só o que foi construído e cresce para x e andares positivos ou negativos.

const U = 8, FH = 36, SLAB = 4, BOX = 4;
// limites só para os números caberem nas chaves de rota: ±131.000 unidades de largura e ±2.000 andares (na prática, infinito)
const X_MIN = -131000, X_MAX = 131000, MIN_L = -2000, MAX_L = 2000, TOP_L = MAX_L + 4;
// carros, helicóptero e caminhões entram e saem de cena a esta distância (unidades) do centro da torre, onde quer que ela esteja
const STREET = 240;
// chave de um trecho de piso contínuo (nó de rota): (andar, início do trecho) em um número só
const NODE = {xOff: 131072, xSpan: 262144, lOff: 2048};
const START_FUNDS = 3000000, FLOOR_COST = 500;
const SEASON_DAYS = 2;       // dias por estação (≈ 12 min reais): o ano tem 8 dias; aluguéis seguem o trimestre (QDAYS), consumo e clima seguem a estação
const YEAR_DAYS = SEASON_DAYS * 4;
const SEASONS = [   // consumo por estação (sobre USE), rendimento da placa solar e nome
  {name: 'Primavera', energia: 1, agua: 1, sol: 1}, {name: 'Verão', energia: 1, agua: 2, sol: 1.2},
  {name: 'Outono', energia: 1, agua: 1, sol: 0.9}, {name: 'Inverno', energia: 2, agua: 1, sol: 0.6}];
const QDAYS = 2;              // dias por trimestre: aluguéis e manutenção; calibrado com tools/sim-jogador.js (com 3 o 2★ vem no dia ~28 e o 3★ no ~68; com 2 e 3M iniciais: 2★ no dia ~12 e 3★ no ~40)
const MAX_PEOPLE = 20000;     // teto de visitantes e hóspedes simultâneos (protege memória e CPU); medido com tools/bench.js: 20.000 pessoas = ~4 ms por passo (mediana) e ~190 MB
const isLobbyLevel = L => L <= 0 || L % 15 === 14;
const floorLabel = L => L >= 0 ? String(L + 1) : 'B' + (-L);
const isExpressStop = L => L < 0 || isLobbyLevel(L);

// níveis de preço: 0 = Premium ... 3 = Promoção; padrão = 1
// preço alto = inquilino exigente (malus); preço baixo = satisfeito com o custo-benefício (bônus)
const PRICE_EVAL_OFFSET = [-15, 0, 10, 20];
const PRICE_MOVE_FACTOR = [0.5, 1.0, 1.3, 1.6];
const PRICE_NAMES = ['Premium', 'Padrão', 'Econômico', 'Promoção'];

const FAC = {
  lobby:     {label: 'Saguão',            w: 4,  h: 1, cost: 20000,  star: 1, above: true, under: true, struct: true, col: '#cfc3a4'},
  corridor:  {label: 'Corredor',         w: 4,  h: 1, cost: 2000,   star: 1, above: true, under: true, struct: true, corr: 'plain', col: '#a39a80'},
  corridorExt: {label: 'Corredor com extintor', w: 4, h: 1, cost: 5000, star: 1, above: true, under: true, struct: true, corr: 'ext', col: '#b5574c'},
  corridorSpr: {label: 'Corredor com sprinklers', w: 4, h: 1, cost: 40000, star: 3, above: true, under: true, struct: true, corr: 'spr', col: '#5b8fb0'},
  corridorCam: {label: 'Corredor com câmera', w: 4, h: 1, cost: 8000, star: 1, above: true, under: true, struct: true, corr: 'cam', col: '#6a8f9a'},
  corridorHyd: {label: 'Corredor com hidrante', w: 4, h: 1, cost: 20000, star: 2, above: true, under: true, struct: true, corr: 'hyd', col: '#c9a23a'},
  office:    {label: 'Escritório',        w: 8,  h: 1, cost: 40000,  star: 1, pop: 6, prices: [15000, 10000, 5000, 2000], per: 'trimestre', under: true, above: true, tenant: true, office: true, col: '#d9dfe8'},
  officeEx:  {label: 'Escritório executivo', w: 16, h: 1, cost: 90000, star: 3, pop: 12, prices: [35000, 25000, 15000, 6000], per: 'trimestre', under: true, above: true, tenant: true, office: true, col: '#c3cfe0'},
  kitnet:    {label: 'Kitnet',            w: 12, h: 1, cost: 55000,  star: 1, pop: 2, maxOcc: 3, prices: [120000, 85000, 55000, 20000], per: 'venda', above: true, sensitive: true, tenant: true, condo: true, col: '#ddd0b0'},
  condo:     {label: 'Apartamento',       w: 16, h: 1, cost: 80000,  star: 1, pop: 3, maxOcc: 5, prices: [200000, 150000, 100000, 40000], per: 'venda', above: true, sensitive: true, tenant: true, condo: true, col: '#e8d9c4'},
  penthouse: {label: 'Cobertura',         w: 32, h: 1, cost: 220000, star: 4, pop: 5, maxOcc: 5, prices: [600000, 450000, 300000, 120000], per: 'venda', above: true, sensitive: true, tenant: true, condo: true, col: '#f0c9a0'},
  fastfood:  {label: 'Lanchonete',        w: 16, h: 1, cost: 100000, star: 1, under: true, above: true, noisy: true, commercial: true, jobs: 3, cap: 48, perCustomer: 100, dailyCost: 1000, open: [10 * 60, 21 * 60], visitors: [10, 48], col: '#f2c14e'},
  cafe:      {label: 'Café',             w: 8,  h: 1, cost: 50000,  star: 1, under: true, above: true, commercial: true, svc: 'cafe', jobs: 2, cap: 20, perCustomer: 100, dailyCost: 200, open: [7 * 60, 19 * 60], visitors: [8, 24], col: '#b98a5a'},
  coworking: {label: 'Coworking',         w: 12, h: 1, cost: 65000,  star: 2, pop: 8, prices: [20000, 14000, 8000, 3000], per: 'trimestre', under: true, above: true, tenant: true, office: true, svc: 'coworking', col: '#c9d6c4'},
  mercado:   {label: 'Mercadinho',        w: 12, h: 1, cost: 90000,  star: 2, under: true, above: true, commercial: true, svc: 'mercado', jobs: 2, cap: 30, perCustomer: 120, dailyCost: 400, open: [8 * 60, 22 * 60], visitors: [10, 28], col: '#b9d9a0'},
  lavanderia: {label: 'Lavanderia',       w: 12, h: 1, cost: 60000,  star: 2, under: true, above: true, commercial: true, svc: 'lavanderia', jobs: 1, cap: 14, perCustomer: 120, dailyCost: 250, open: [7 * 60, 21 * 60], visitors: [6, 14], col: '#cfe3f0'},
  jardim:    {label: 'Jardim',            w: 16, h: 1, cost: 60000,  star: 2, under: true, above: true, svc: 'jardim', dailyCost: 400, col: '#8fcf8a'},
  academia:  {label: 'Academia',         w: 12, h: 1, cost: 80000,  star: 2, under: true, above: true, noisy: true, svc: 'academia', dailyCost: 600, col: '#d98a4e'},
  creche:    {label: 'Creche',            w: 12, h: 1, cost: 90000,  star: 3, under: true, above: true, svc: 'creche', dailyCost: 700, col: '#f0c75e'},
  piscina:   {label: 'Piscina e spa',     w: 16, h: 2, cost: 250000, star: 4, under: true, above: true, svc: 'piscina', dailyCost: 1200, col: '#5db7d9'},
  auditorio: {label: 'Auditório',         w: 24, h: 2, cost: 400000, star: 4, under: true, above: true, noisy: true, limitGroup: 'ent', svc: 'convencoes', dailyCost: 1500, col: '#6a4a8a'},
  banco:     {label: 'Banco',             w: 12, h: 1, cost: 110000, star: 3, under: true, above: true, commercial: true, svc: 'banco', jobs: 2, cap: 16, perCustomer: 300, dailyCost: 450, open: [9 * 60, 17 * 60], visitors: [6, 14], col: '#c9d3e0'},
  single:    {label: 'Quarto simples',    w: 4,  h: 1, cost: 20000,  star: 2, pop: 1, prices: [3000, 2000, 1500, 500], per: 'diária', above: true, sensitive: true, hotel: true, guests: 1, col: '#cfe3cc'},
  twin:      {label: 'Quarto duplo',      w: 8,  h: 1, cost: 50000,  star: 3, pop: 2, prices: [6000, 4000, 2700, 1000], per: 'diária', above: true, hotel: true, guests: 2, col: '#cfe3cc'},
  suite:     {label: 'Suíte',             w: 12, h: 1, cost: 100000, star: 3, pop: 2, prices: [12000, 8000, 5300, 2000], per: 'diária', above: true, sensitive: true, hotel: true, guests: 2, col: '#d8cfe8'},
  housekeeping: {label: 'Camareiras',     w: 16, h: 1, cost: 50000,  star: 2, pop: 6, removable: false, under: true, above: true, staff: true, col: '#9bb7b0'},
  security:  {label: 'Posto de segurança',w: 16, h: 1, cost: 100000, star: 2, pop: 6, removable: false, under: true, above: true, staff: true, col: '#3b5878'},
  bar:       {label: 'Bar',               w: 16, h: 1, cost: 120000, star: 2, under: true, above: true, noisy: true, commercial: true, jobs: 3, jobShift: 'night', workHours: [18 * 60 + 30, 24 * 60 + 20], cap: 40, perCustomer: 180, dailyCost: 600, open: [19 * 60, 24 * 60], visitors: [8, 36], col: '#4a3560'},
  restaurant:{label: 'Restaurante',       w: 24, h: 1, cost: 200000, star: 3, under: true, above: true, noisy: true, commercial: true, jobs: 5, jobShift: 'both', cap: 60, perCustomer: 200, dailyCost: 1500, open: [17 * 60, 23 * 60], visitors: [10, 30], col: '#7a3f3f'},
  shop:      {label: 'Boutique',          w: 12, h: 1, cost: 100000, star: 3, prices: [20000, 15000, 10000, 4000], per: 'trimestre', under: true, above: true, noisy: true, commercial: true, tenant: true, jobs: 2, cap: 40, open: [10 * 60, 21 * 60], visitors: [5, 20], col: '#c9a7d6'},
  party:     {label: 'Salão de festas',   w: 24, h: 2, cost: 200000, star: 3, under: true, above: true, noisy: true, limitGroup: 'ent', dailyCost: 600, col: '#8a5a9e'},
  cinema:    {label: 'Cinema',            w: 32, h: 2, cost: 500000, star: 3, under: true, above: true, noisy: true, limitGroup: 'ent', dailyCost: 2000, jobs: 4, jobShift: 'night', workHours: [17 * 60 + 30, 22 * 60 + 30], col: '#2b2f4a'},
  clinic:    {label: 'Clínica',           w: 28, h: 1, cost: 250000, star: 3, under: true, above: true, col: '#e4f0f1'},
  recycling: {label: 'Usina de reciclagem',w: 24, h: 2, cost: 500000, star: 3, svc: 'lixo', waste: {cap: 1500, process: 600}, removable: false, under: true, above: true, noisy: true, col: '#4a7a4f'},
  parkspace: {label: 'Vaga',              w: 4,  h: 1, cost: 3000,   star: 3, under: true, underOnly: true, park: true, col: '#5a5f6b'},
  bike:      {label: 'Bicicletário',      w: 8,  h: 1, cost: 30000,   star: 1, under: true, above: true, svc: 'bike', dailyCost: 100, col: '#6f8a6a'},
  busstop:   {label: 'Ponto de ônibus',   w: 16, h: 1, cost: 120000, svc: 'transporte', tier: 2, star: 2, under: true, above: true, maxL: 0, needRamp: true, dailyCost: 300, col: '#d9a441'},
  taxi:      {label: 'Ponto de táxi',     w: 8,  h: 1, cost: 60000,  svc: 'transporte', tier: 1, star: 2, under: true, above: true, maxL: 0, needRamp: true, dailyCost: 150, col: '#e8c623'},
  heliport:  {label: 'Heliponto',         w: 16, h: 1, cost: 800000, star: 5, above: true, roof: true, dailyCost: 2000, col: '#8a929e'},
  parkramp:  {label: 'Rampa de carros',   w: 16, h: 1, cost: 50000,  star: 3, under: true, underOnly: true, slope: true, veh: true, col: '#4b505c'},
  transit:   {label: 'Estação de metrô',  w: 64, h: 3, cost: 1000000,svc: 'transporte', tier: 3, star: 4, removable: false, under: true, underOnly: true, noisy: true, col: '#3a6f86'},   // quantas quiser, lado a lado: cada estação tem o seu trilho e o seu trem
  ruin:      {label: 'Ruína queimada',    w: 4,  h: 1, cost: 0,      star: 1, nobuild: true, above: true, under: true, col: '#2a2522'},
  landmark:  {label: 'Capela celeste',    w: 28, h: 5, cost: 3000000,star: 5, removable: false, above: true, limit: 1, col: '#e8d28a'},
};
// serviços de bairro que as salas oferecem (`svc` em FAC) e o que cada tipo de unidade procura por perto; só conta o que já existe no catálogo
// túneis de veículos (subsolo): ligam a rampa aos pontos de ônibus e táxi; mesmas proteções dos corredores (câmera, extintor, hidrante, sprinklers)
for (const k of ['corridor', 'corridorExt', 'corridorSpr', 'corridorCam', 'corridorHyd']) {
  const d = FAC[k], t = 'tunnel' + k.slice(8);
  FAC[t] = {...d, label: d.label.replace('Corredor', 'Túnel'), cost: Math.round(d.cost * 1.5), above: false, under: true, underOnly: true, veh: true, star: Math.max(d.star, FAC.parkramp.star), col: '#50545e'};   // só servem a quem já pode construir a rampa
}
// túnel descendente: aposentado (a rampa de carros já cumpre esse papel); fica só para carregar saves antigos que o tenham, sem poder ser construído
FAC.tunnelDown = {...FAC.tunnel, label: 'Túnel descendente', cost: 25000, slope: true, nobuild: true, col: '#5c606a'};
// túnel com portal (como a estação de metrô): tem a própria entrada para a rua, então não precisa ser ligado à superfície por rampas; custa mais, em 1 ou 2 níveis de altura
FAC.tunnelPortal = {...FAC.tunnel, label: 'Túnel com portal', w: 8, cost: 150000, star: 5, portal: true, col: '#6b7080'};
FAC.tunnelPortal2 = {...FAC.tunnelPortal, label: 'Túnel com portal (2 níveis)', h: 2, cost: 280000, star: 5};
// fontes de energia e água (capacidade em unidades; `util`) — a placa solar só rende de dia e fica no topo (`roof`)
FAC.gerador = {label: 'Gerador a diesel', w: 8, h: 1, cost: 120000, star: 1, under: true, above: true, noisy: true, dailyCost: 800, util: {energia: 160}, col: '#7a6a3a'};
FAC.solar = {label: 'Placa solar', w: 16, h: 1, cost: 250000, star: 3, above: true, roof: true, dailyCost: 200, util: {energia: 180, solar: true}, col: '#2a4f8a'};
FAC.geradorGas = {label: 'Gerador a gás', w: 8, h: 1, cost: 200000, star: 4, under: true, above: true, noisy: true, dailyCost: 1200, util: {energia: 300}, col: '#8a6a4a'};
FAC.bateriaPequena = {label: 'Bateria pequena', w: 4, h: 1, cost: 100000, star: 2, under: true, above: true, dailyCost: 120, util: {store: {res: 'energia', cap: 167, rate: 107, fill: 107}}, col: '#5a9a6a'};   // 1/3 da bateria comum, por metade do preço
FAC.bateria = {label: 'Bateria', w: 8, h: 1, cost: 200000, star: 3, under: true, above: true, dailyCost: 300, util: {store: {res: 'energia', cap: 500, rate: 320, fill: 320}}, col: '#4a8a5a'};   // enche com a sobra de energia (rede, geradores, placas) e esvazia no déficit
FAC.bateriaGrande = {label: 'Bateria grande', w: 12, h: 1, cost: 300000, star: 4, under: true, above: true, dailyCost: 480, util: {store: {res: 'energia', cap: 1500, rate: 960, fill: 960}}, col: '#3a7a4a'};   // 3x a bateria comum
FAC.lixo = {label: 'Depósito de lixo', w: 16, h: 2, cost: 90000, star: 3, under: true, underOnly: true, svc: 'lixo', waste: {cap: 400}, dailyCost: 150, col: '#6a6f55'};   // galpão alto no subsolo: o caminhão chega até a doca e esvazia
FAC.bomba = {label: 'Bomba d\'água', w: 8, h: 1, cost: 90000, star: 1, under: true, underOnly: true, noisy: true, dailyCost: 400, util: {agua: 260, reach: 128}, col: '#4f7f9f'};   // só no subsolo; alcance de 16 andares
FAC.bombaMedia = {label: 'Bomba reforçada', w: 8, h: 1, cost: 190000, star: 2, under: true, underOnly: true, noisy: true, dailyCost: 700, util: {agua: 520, reach: 256}, col: '#3f6f90'};   // 2x a vazão e o alcance (24 andares)
FAC.bombaForte = {label: 'Bomba industrial', w: 16, h: 1, cost: 450000, star: 4, under: true, underOnly: true, noisy: true, dailyCost: 1500, util: {agua: 1040, reach: 640}, col: '#2f5f80'};   // 4x a vazão, alcance de 80 andares
FAC.bombaRecalque = {label: 'Bomba de recalque', w: 8, h: 1, cost: 120000, star: 3, under: true, above: true, noisy: true, dailyCost: 500, util: {lift: 300}, col: '#3f7f8f'};   // em qualquer andar: eleva água de uma caixa para outra caixa ACIMA (a água só desce sozinha); não produz água
FAC.caixa = {label: 'Caixa d\'água', w: 8, h: 2, cost: 150000, star: 1, under: true, above: true, dailyCost: 200, util: {store: {res: 'agua', cap: 600, rate: 360, pump: true, fill: 90, down: true}}, col: '#5a8fb8'};   // reservatório: enche com a sobra da água e esvazia no déficit; só funciona com uma bomba num andar abaixo
FAC.caixaMedia = {label: 'Caixa d\'água média', w: 12, h: 2, cost: 380000, star: 2, under: true, above: true, dailyCost: 450, util: {reach: 96, store: {res: 'agua', cap: 1800, rate: 900, pump: true, fill: 220, down: true}}, col: '#4f86b0'};   // 3x a capacidade da caixa simples
FAC.caixaGrande = {label: 'Caixa d\'água grande', w: 16, h: 3, cost: 950000, star: 4, under: true, above: true, dailyCost: 1000, util: {reach: 128, store: {res: 'agua', cap: 6000, rate: 2000, pump: true, fill: 500, down: true}}, col: '#3f78a4'};   // 10x a capacidade, para torres altas
FAC.caixaTorre = {label: 'Torre d\'água pressurizada', w: 16, h: 3, cost: 1600000, star: 5, under: true, above: true, noisy: true, dailyCost: 1800, util: {reach: 160, lift: 600, store: {res: 'agua', cap: 8000, rate: 2400, pump: true, fill: 600, down: true}}, col: '#2f6c9a'};   // caixa com bomba de recalque embutida: enche como as outras e manda a própria água para caixas ACIMA dela (gasta energia)
FAC.tratamento = {label: 'Estação de tratamento', w: 16, h: 1, cost: 300000, star: 4, under: true, underOnly: true, noisy: true, dailyCost: 1500, util: {agua: 800}, col: '#4a7a7a'};
const LIXO = {range: 40, perPerson: 0.5, perWidth: 0.1, callAt: 0.7, annoy: 0.5, eta: 45, cost: 12000, penalty: 25};   // o jogador chama o caminhão; o lixo acumulado incomoda a partir de `annoy` e transborda cheio   // coleta: o depósito enche com as unidades por perto; cheio, o lixo transborda e pesa nelas
const SERVICES = new Set(Object.values(FAC).map(d => d.svc).filter(Boolean));
// estrela a partir da qual cada serviço existe para o jogador: a demanda só cobra o que ele já pode construir
const SVC_STAR = {}; for (const d of Object.values(FAC)) if (d.svc) SVC_STAR[d.svc] = Math.min(SVC_STAR[d.svc] ?? 9, d.star);
// serviços com vários níveis na mesma família: transporte público = táxi (1) < ônibus (2) < metrô (3); o melhor nível presente vale, em toda a torre
const SVC_NAMES = {transporte: 'transporte público'};
const SVC_TIERS = 3;
// EXIGÊNCIAS (no máximo 2 por bloco, o que define o perfil dele): faltando, a nota cai um pouco e a procura por aluguel também.
const DEMAND = {
  kitnet: ['cafe', 'lavanderia'], condo: ['mercado', 'creche'], penthouse: ['piscina'],
  office: ['cafe', 'transporte'], officeEx: ['cafe', 'coworking'], coworking: ['cafe'],
  single: ['lavanderia'], twin: ['lavanderia', 'piscina'], suite: ['piscina'],
  shop: ['banco'],   // o banco só pesa para a boutique
};
// EXTRAS: não são exigência. Com o serviço por perto a nota sobe (e o jardim ainda abafa o barulho); sem ele não se perde nada. Só quem não sofre com o barulho ganha extras barulhentos (academia, convenções).
const DEMAND_EXTRA = {
  kitnet: ['bike', 'transporte', 'jardim'], condo: ['jardim', 'lixo'], penthouse: ['jardim', 'mercado'],
  office: ['bike', 'academia', 'lixo'], officeEx: ['convencoes', 'lixo'], coworking: ['academia', 'lixo'],
  single: ['transporte', 'lixo'], twin: ['convencoes', 'transporte'], suite: ['jardim', 'transporte'],
  shop: ['cafe', 'lixo'],
};
// range = alcance (unidades); met = bônus por serviço atendido (× peso por distância); miss = desconto por serviço que falta; caps; rent = quanto a nota pesa na procura por aluguel
const DEMANDV = {range: 32, met: 8, extra: 6, capExtra: 14, miss: 12, capMet: 24, capMiss: 24, rent: 100, quiet: 0.5};
for (const k in FAC) { FAC[k].key = k; if (FAC[k].removable === undefined) FAC[k].removable = true; }

const TRANSPORT = {
  stairs:    {label: 'Escada',             w: 8, cost: 5000,   star: 1, mode: 'stairs'},
  escalator: {label: 'Escada rolante',     w: 8, cost: 20000,  star: 3, mode: 'esc'},
  elevator:  {label: 'Elevador',           w: 4, cost: 200000, star: 1, mode: 'elev', cap: 21, maxSpan: 30,  carCost: 50000,  vmax: 4,  board: 0.6},
  express:   {label: 'Elevador expresso',  w: 8, cost: 400000, star: 3, mode: 'elev', cap: 42, maxSpan: 200, carCost: 100000, vmax: 10, board: 0.9},
  service:   {label: 'Elevador de serviço',w: 4, cost: 150000, star: 2, mode: 'elev', cap: 17, maxSpan: 30,  carCost: 50000,  vmax: 4,  board: 0.6},
  // só carros, do térreo para baixo (`maxHi` 0): se chega ao térreo é uma entrada de carros por conta própria (sem rampa); só no subsolo (ex.: B10 a B15) liga níveis de vagas que já têm saída. Casa de máquinas em cima e poço embaixo, como o elevador comum
  carlift:   {label: 'Elevador de carros', w: 8, cost: 300000, star: 4, mode: 'carlift', carlift: true, maxHi: 0, cap: 2, maxSpan: 16, carCost: 80000, vmax: 3, board: 0.5},
};
for (const k in TRANSPORT) TRANSPORT[k].key = k;

// sem teto de poços, escadas, vagas, clínicas, postos ou salas de lazer: o limite é o dinheiro e o desempenho. Ficam só o que é único por natureza (metrô, capela) e as 3 pistas por poço.
const LIMITS = {shafts: Infinity, carsPerShaft: 3, stairsEsc: Infinity, parkspace: Infinity, clinic: Infinity, security: Infinity, ent: Infinity, landmark: 1};

// manutenção por trimestre
const MAINT = {carlift: 12000, elevator: 10000, express: 20000, service: 10000, escalator: 5000, parkramp: 10000, recycling: 50000, transit: 100000, housekeeping: 10000, security: 20000, lobbyUnit: 100, corridor: 200, corridorExt: 500, corridorSpr: 2000, corridorHyd: 1000, corridorCam: 500};
const INCOME_CATS = ['office', 'coworking', 'officeEx', 'single', 'twin', 'suite', 'shop', 'cafe', 'mercado', 'lavanderia', 'banco', 'fastfood', 'restaurant', 'bar', 'party', 'cinema', 'auditorio', 'kitnet', 'condo', 'penthouse', 'parking', 'vip', 'landmark'];
const INCOME_LABELS = {office: 'Escritórios', coworking: 'Coworking', cafe: 'Cafés', mercado: 'Mercadinhos', lavanderia: 'Lavanderias', banco: 'Bancos', officeEx: 'Escritórios executivos', single: 'Quartos simples', twin: 'Quartos duplos', suite: 'Suítes', shop: 'Boutiques', fastfood: 'Lanchonetes', restaurant: 'Restaurantes', bar: 'Bares', party: 'Festas', cinema: 'Cinema', auditorio: 'Auditório', kitnet: 'Venda de kitnets', condo: 'Venda de apartamentos', penthouse: 'Venda de coberturas', parking: 'Estacionamento', vip: 'VIP e presentes', landmark: 'Casamentos na capela'};
const WAGE = 2500, HIRE_COST = 3000, MAX_CREW = 12, PEST_COST = 25000;
// sistemas do prédio inteiro: nenhum (sprinklers e câmeras agora são corredores, que protegem só uma área)
const SYSTEMS = {};
// corredores de segurança: alcance do extintor/sprinklers em unidades, chance de o fogo atravessar o corredor, etc.
const CORR = {range: 12, spreadPlain: 0.25, spreadSpr: 0.05, sprSlow: 2, sprContain: 1.35, sprIgnition: 0.4, camFight: 0.5, camTheft: 0.5, extEvery: 10, extChance: 0.6, extRefill: 1000, extMax: 1.3, rebuildMult: 0.6};
// bombeiros: só atendem salas cobertas por hidrante e com escada (ou escada rolante) do térreo até lá; são `trucks` caminhões (um de cada lado do prédio), cada um com `crew` bombeiros; chegam por terra (eta, em minutos de jogo), a equipe sobe a pé (speed = vezes a velocidade de uma pessoa), combate por fightSec segundos; se o fogo passar de backup o helicóptero vem como reforço
// posto de segurança: cobre as salas até `floors` andares acima/abaixo e `reach` unidades para cada lado; crimes: peso do tipo de local
// versão do formato de save: aumente quando serialize() mudar de jeito que load() não tolera e registre a migração em SAVE_MIGRATIONS (saves.js)
const SAVE_VERSION = 4;
const SEC = {floors: 6, reach: 40, fastSec: 20, costPerSec: 0.6};   // fastSec: resposta até esse tempo (s) é "rápida"; costPerSec: custo de rota por segundo de caminhada
// efeitos visuais de eventos (só desenho, não entram no save): duração em segundos de jogo
const FX_DUR = {ext: 3.5, spr: 3, boom: 2.5, amb: 10, thief: 4};
const CRIME_KINDS = ['restaurant', 'fastfood', 'bar', 'cinema', 'party', 'shop'], CRIME_W = {bar: 1.6};
// furtos: só em unidades ocupadas e vazias de gente; não tiram dinheiro, derrubam a segurança do prédio e o humor do local (que se recupera em `days` dias)
const THEFT = {p: 0.004, stress: 30};
// bicicleta: parte de quem trabalha/mora em kitnet pedala; sem bicicletário por perto, a bicicleta sobe no elevador (ocupa `slots` vagas); com ele, fica guardada (e pode ser furtada de madrugada)
// ônibus e táxi atendem o prédio inteiro (visitantes e moradores chegam por eles); o preço é a fila: `rate` = pessoas por minuto que o ponto escoa,
// `share` = fatia das chegadas, `access` = ganho de visitantes; quem espera acumula estresse (`stress` por minuto de espera, até `maxStress`)
// elevador de carros: cada cabine escoa `rate` carros por minuto de jogo; quem espera fica estressado e, acima de `giveUp` minutos de fila, o motorista desiste daquela vaga
const CARLIFT = {rate: 3, stress: 2.5, maxStress: 30, giveUp: 4};
const HAIL = {busstop: {rate: 4, share: 0.12, access: 0.12, dwell: 3}, taxi: {rate: 2.5, share: 0.06, access: 0.08, dwell: 2}, stress: 2.5, maxStress: 40, tunnel: 28, heliVip: 1.5};
// trem do metrô (minutos de jogo; 1 s real = 4 min): passa a cada `cycle` min (30 s reais), chega, abre as portas e parte; quem chega de metro vem em levas quando as portas abrem
const TRAIN = {cycle: 120, arrive: 4, open: 8, leave: 4};
// linhas do metrô: cada estação pertence a uma (cor da faixa, das placas, dos bancos e do trem); `ink` = cor do texto sobre a placa
const LINES = [
  {name: 'Azul', col: '#2a56b8', dark: '#1d4fa8', ink: '#fff'}, {name: 'Vermelha', col: '#d2323d', dark: '#b3222d', ink: '#fff'}, {name: 'Amarela', col: '#e8b400', dark: '#c99800', ink: '#222'},
  {name: 'Verde', col: '#2e9a4a', dark: '#1f7a37', ink: '#fff'}, {name: 'Lilás', col: '#8f5bd0', dark: '#7640b8', ink: '#fff'}];
// salas que não exigem acesso desde o térreo: entram pela própria rua/rampa (transporte público e rampa de carros), saguão e ruína
const NO_ACCESS = new Set(['lobby', 'ruin', 'transit', 'busstop', 'taxi', 'parkramp']);
const BIKE = {rack: 6, share: 0.12, slots: 2, theft: 0.01, stress: 10};

// ---- efeitos locais: nada age no prédio inteiro. Tudo pesa pela distância entre salas = folga horizontal (unidades) + andares inteiros entre elas × floorUnits.
// O peso vai de 1 (colado) até 0 (no alcance `range`); `neighbor` é a fração que as unidades vizinhas sentem do que acontece na unidade atingida.
const PROX = {floorUnits: 8, neighbor: 0.5};
const NOISE = {range: 16, loudRange: 24, loud: ['bar', 'party', 'cinema', 'recycling', 'transit', 'gerador'], perSource: 25, cap: 60};
// ocorrências recentes (cada uma some linearmente em `days` dias): mag = quanto derruba a nota da unidade atingida; watch = bônus da área vigiada sem ocorrências
const INCIDENT = {cap: 80, theft: {mag: 35, days: 3, range: 16}, fight: {mag: 25, days: 5, range: 24}, bomb: {mag: 60, days: 7, range: 40}, watch: 10};
const NEAR = {
  service: {range: 32, bonus: 10, cap: 30},           // clínica e reciclagem por perto
  traffic: {range: 48, per: 12, cap: 25, quiet: 30},  // boutique: gente que circula perto dela
  mood: {range: 48},                                  // humor da vizinhança → procura por aluguel e por hóspedes
  hotel: {range: 24, demand: 64, scale: 150},         // reputação do quarto (quartos sujos por perto) e atração de hóspedes
  visit: {range: 64, scale: 1500},                    // atração de visitantes de bares, restaurantes, cinema...
};
// moradores: quem não tem carro depende do metrô, quem tem carro depende das vagas; a chance de ter carro cresce com a faixa de preço (0 Premium … 3 Promoção)
const RIDE = {metro: 8, parking: 8, carBase: 0.15, carWealth: 0.65, typeBonus: {kitnet: -0.1, penthouse: 0.2}};
const TRUCK = {cost: 50000, callAt: 1.1, eta: 12, trucks: 2, crew: 4, speed: 5, fightSec: 4, maxStay: 400, backup: 1.6};
const MAINT_CATS = ['carlift', 'wages', 'systems', 'corridors', 'refills', 'brigade', 'lobby', 'elevator', 'express', 'service', 'escalator', 'parkramp', 'recycling', 'transit', 'housekeeping', 'security', 'lixo', 'daily'];
const MAINT_LABELS = {carlift: 'Elevadores de carros', wages: 'Salários da equipe', systems: 'Sprinklers e câmeras', corridors: 'Corredores', refills: 'Recargas de extintores', brigade: 'Bombeiros', lobby: 'Saguões', elevator: 'Elevadores', express: 'Elevadores expressos', service: 'Elevadores de serviço', escalator: 'Escadas rolantes', parkramp: 'Rampas', recycling: 'Reciclagem', transit: 'Metrô', housekeeping: 'Camareiras', security: 'Segurança', lixo: 'Coleta de lixo', daily: 'Custo diário (comida)'};

// metas de população por estrela
const STAR_POP = {2: 300, 3: 900, 4: 4000, 5: 12000, 6: 15000};   // calibrado com tools/sim-jogador.js (QDAYS=2, 3M iniciais): 2★ dia ~13, 3★ ~40, 4★ ~81, 5★ ~109; o 6★ é o Marco (capela)
const STAR_NEEDS_GOOD = {2: false, 3: true, 4: true, 5: true, 6: true};   // avaliação média precisa ser "boa"
const STRESS_MAX = 300;
const stressTier = s => s < 80 ? 0 : s < 150 ? 1 : 2;
const EVAL_GOOD = 100, EVAL_GREAT = 170;
const evalTier = e => e < EVAL_GOOD ? 0 : e < EVAL_GREAT ? 1 : 2;   // 0 ruim, 1 bom, 2 ótimo
const EVAL_FACE = ['😠', '😐', '😀'];
// gradiente contínuo: vermelho (<=40) → amarelo (100) → verde (>=260), alinhado às faixas Ruim/Boa/Ótima
const evalHue = e => e <= 40 ? 0 : e < EVAL_GOOD ? (e - 40) / 60 * 48 : e < EVAL_GREAT ? 48 + (e - EVAL_GOOD) / 80 * 27 : Math.min(135, 75 + (e - EVAL_GREAT) / 80 * 60);
const evalCol = (e, a = 1) => `hsla(${evalHue(e).toFixed(0)},${e < EVAL_GOOD ? 72 : 62}%,${e < EVAL_GREAT ? 52 : 46}%,${a})`;
const AMENITY_BIT = {restaurant: 1, fastfood: 2, shop: 4, cinema: 8, party: 16, bar: 32}, AMENITY_RANGE = 40;   // em unidades de roomDist (4 andares com folga horizontal de 8)
const EVAL_NAMES = ['Ruim', 'Boa', 'Ótima'];

const FILMS = [
  {title: 'Meia-noite na Baía de Marlow', kind: 'new'},
  {title: 'A Lua do Relojoeiro', kind: 'new'},
  {title: 'Dezesseis Pipas de Papel', kind: 'new'},
  {title: 'Ferrugem e Alecrim', kind: 'new'},
  {title: 'Órbita do Peixe-Lanterna', kind: 'new'},
  {title: 'Um Farol no Cerrado', kind: 'classic'},
  {title: 'O Bonde de Veludo', kind: 'classic'},
  {title: 'Balada para um Rádio Quebrado', kind: 'classic'},
  {title: 'O Retorno do Capitão Junípero', kind: 'classic'},
];
const FILM_COST = {new: 150000, classic: 30000};
const FILM_DRAW = {new: 1.0, classic: 0.5};
const DAY_NAMES = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

// ---- gente: nomes, perfis de rotina e tipos de família
const FIRST_NAMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabi', 'Heitor', 'Inês', 'João', 'Karina', 'Lucas', 'Marta', 'Nando', 'Olívia', 'Paulo', 'Quézia', 'Rafael', 'Sara', 'Tiago', 'Ursula', 'Victor', 'Wanda', 'Xavier', 'Yara', 'Zeca', 'Bia', 'Caio', 'Dora', 'Enzo', 'Flávia', 'Gil', 'Helena', 'Ivo', 'Júlia', 'Kléber', 'Lara', 'Mateus', 'Nina', 'Otávio', 'Paula', 'Rui', 'Sofia', 'Téo', 'Vera', 'Wagner'];
const SURNAMES = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Costa', 'Ribeiro', 'Almeida', 'Carvalho', 'Gomes', 'Martins', 'Rocha', 'Barbosa', 'Moreira', 'Nunes', 'Teixeira', 'Araújo', 'Cardoso', 'Freitas', 'Duarte', 'Pinto', 'Monteiro', 'Cunha'];
const PROF_LABELS = {
  day: 'trabalha em horário comercial', early: 'trabalha no turno da manhã', late: 'trabalha no turno da tarde', night: 'trabalha à noite',
  home: 'trabalha de casa', retired: 'aposentado(a)', homemaker: 'cuida da casa e da família',
  school_am: 'estuda de manhã', school_pm: 'estuda à tarde', toddler: 'criança pequena (fica em casa)',
};
// emprego de moradores dentro do prédio: chance de preferir uma vaga do prédio quando existe alguma
const INHOUSE_JOB_CHANCE = 0.3, LAYOFF_DAILY = 0.01;
const SHIFT_LABELS = {day: 'horário comercial (9h–17h)', early: 'turno da manhã (7h–15h)', late: 'turno da tarde (11h–20h)', night: 'central 24h, turno da noite'};
// tipos de família: m = perfis dos moradores; w = peso por nível de preço [Premium, Padrão, Econômico, Promoção]
const HOUSEHOLDS = [
  {m: ['day'],                                              w: [3, 2, 2, 2]},
  {m: ['night'],                                            w: [1, 1, 1, 1]},
  {m: ['home'],                                             w: [3, 2, 1, 1]},
  {m: ['day', 'day'],                                       w: [3, 3, 2, 1]},
  {m: ['day', 'night'],                                     w: [1, 1, 2, 2]},
  {m: ['day', 'home'],                                      w: [2, 2, 1, 1]},
  {m: ['retired', 'retired'],                               w: [2, 2, 3, 3]},
  {m: ['day', 'homemaker', 'school_am'],                    w: [1, 3, 4, 4]},
  {m: ['day', 'home', 'school_pm'],                         w: [1, 2, 2, 2]},
  {m: ['day', 'homemaker', 'school_am', 'toddler'],         w: [1, 3, 4, 4]},
  {m: ['day', 'school_pm'],                                 w: [0, 1, 2, 3]},
  {m: ['day', 'homemaker', 'school_am', 'school_pm', 'toddler'], w: [0, 1, 2, 3]},
  {m: ['retired', 'school_pm'],                             w: [0, 1, 2, 2]},
];
function ageFor(prof) {
  const r = (a, b) => Math.round(a + Math.random() * (b - a));
  return prof === 'toddler' ? r(1, 5) : prof === 'school_am' || prof === 'school_pm' ? r(6, 16) : prof === 'retired' ? r(62, 84) : r(24, 58);
}

const DESC = {
  inspect: 'Clique em salas, elevadores ou pessoas para ver detalhes.',
  bulldoze: 'Clique para demolir uma sala, escada ou elevador.',
  adjust: 'Mude preços, filmes e andares atendidos pelos elevadores.',
  lobby: 'Arraste no térreo, nos subsolos ou em saguões aéreos (a cada 15 andares). Tudo na grade de caixas (1 caixa = 4 unidades).',
  floor: 'Arraste para criar laje (piso) vazia, caixa a caixa. No subsolo também cresce de lado.',
  stairs: 'Liga dois andares seguidos. Barata, mas lenta e cansativa.',
  escalator: 'Liga dois andares seguidos. Mais rápida que a escada, mas gasta energia: sem energia ela pára e vira uma escada comum (a escada comum não gasta nada).',
  elevator: 'Arraste na vertical. Até 30 andares. Pare em todos os andares.',
  carlift: 'Só para carros, do térreo para baixo. Arraste na vertical; a casa de máquinas fica uma casa acima do primeiro nível (no térreo, no 2º andar) e o poço uma abaixo. Se chega ao térreo, é uma entrada de carros por conta própria: dispensa rampa e túnel, e as vagas coladas a ele, em qualquer nível, estão ligadas. Se fica só no subsolo (por exemplo B10 a B15), liga níveis de vagas que já têm saída, direto ou por uma fileira de vagas. O carro desce nele para estacionar e sobe para sair: cada cabine escoa 3 carros por minuto, fila grande estressa os motoristas e acima de 4 minutos eles desistem da vaga. Gasta energia (sem ela as vagas dele ficam sem ligação).',
  express: 'Só para nos saguões (térreo, subsolos e saguões aéreos). Rápido, até 200 andares.',
  service: 'Só funcionários (camareiras, segurança) usam: alivia os elevadores comuns.',
  corridor: 'Não queima nem gera renda. O fogo atravessa com pouca chance (~25%): serve de barreira entre salas.',
  corridorExt: 'Alguém por perto tenta apagar fogo pequeno (60% de chance, recarga de R$ 1.000 por tentativa). Alcance: 3 caixas para cada lado e 1 andar acima e abaixo.',
  corridorSpr: 'Protege a área: o fogo cresce na metade da velocidade, é contido sozinho ao passar de 1,35, quase não atravessa o corredor (~5%) e o risco de incêndio nas salas cobertas cai 60%.',
  corridorCam: 'Câmera na área: reduz em 50% a chance de brigas e de furtos nas salas cobertas (mesmo alcance do extintor). Não encerra brigas nem bombas: isso é com a segurança.',
  corridorHyd: 'Ponto de água para os bombeiros: se o fogo passar de 1,1 numa sala coberta e ninguém da segurança estiver combatendo, dois caminhões com 4 bombeiros cada são chamados (R$ 50.000 no total), um de cada lado do prédio. Chegam por terra e a equipe sobe só por escadas ou escadas rolantes. Mesmo alcance do extintor.',
  office: 'Aluguel cobrado a cada trimestre. 4 a 6 funcionários, em turnos que variam de empresa para empresa.',
  officeEx: 'Sala maior e mais cara, com o dobro dos funcionários e aluguel mais alto.',
  kitnet: 'Apartamento compacto e barato. Famílias de 1 a 3 moradores. Sensível a barulho.',
  condo: 'Vendido uma única vez. Famílias de 1 a 5 moradores, cada um com a sua rotina (quem trabalha de noite, quem fica em casa, crianças na escola). Sensível a barulho.',
  penthouse: 'Apartamento amplo e de luxo, o dobro da largura normal, vendido por muito mais. Sensível a barulho.',
  single: 'Hóspede paga por diária. Precisa de camareiras.',
  twin: 'Quarto para duas pessoas.',
  suite: 'Quarto de luxo. Sensível a barulho.',
  housekeeping: 'Limpa os quartos de hotel depois que os hóspedes saem.',
  cafe: 'Versão pequena e barata da lanchonete: ganha por cliente, sem barulho. Escritórios e kitnets por perto gostam de ter um café.',
  coworking: 'Aluguel por trimestre, entre o escritório e o executivo. Também serve de apoio aos escritórios por perto.',
  mercado: 'Ganha por cliente e atende os moradores por perto: apartamentos e coberturas gostam de ter um mercadinho.',
  lavanderia: 'Ganha por cliente. Apartamentos, kitnets e quartos de hotel por perto gostam de ter lavanderia.',
  jardim: 'Sem renda e sem barulho. Não é exigência de ninguém: moradias e hotéis por perto ganham humor (e o verde abafa metade do barulho das salas vizinhas), e quem não tem jardim não perde nada.',
  banco: 'Comércio pequeno e estável: ganha por cliente. Escritórios por perto gostam de ter um banco.',
  fastfood: 'Ganha por cliente. Barulhento.',
  restaurant: 'Funciona à noite. Barulhento.',
  bar: 'Funciona à noite, até meia-noite. Muito barulhento.',
  shop: 'Aluguel por trimestre e atrai visitantes. Barulhenta.',
  party: 'Eventos aos fins de semana. Ocupa 2 andares.',
  cinema: 'Escolha o filme com a ferramenta Ajustar. Ocupa 2 andares.',
  security: 'Combate incêndios, brigas e ameaças de bomba só nas salas da sua área: até 6 andares acima e abaixo e 40 unidades para cada lado. Prédios grandes precisam de mais de um posto.',
  clinic: 'Melhora a satisfação das unidades por perto (até 4 andares e 32 unidades de distância; quanto mais perto, mais).',
  recycling: 'Melhora a satisfação das unidades por perto, mas custa caro e faz muito barulho.',
  bike: 'Guarda as bicicletas de quem trabalha ou mora por perto (em qualquer andar, mas só atende o que está a até 4 andares). Quem pedala e não tem onde deixar a bicicleta leva ela no elevador (ocupa 2 vagas) e causa fila. Escritórios e kitnets próximos gostam; à noite as bicicletas podem ser furtadas.',
  academia: 'Moradores e funcionários por perto gostam, mas o barulho incomoda os vizinhos. Custa manutenção diária.',
  creche: 'Apoio a famílias: apartamentos e escritórios executivos por perto ficam mais satisfeitos. Custa manutenção diária.',
  piscina: 'Serve ao hotel e às coberturas. Ocupa 2 andares e custa manutenção diária.',
  auditorio: 'Convenções nos dias úteis: traz multidões, ajuda a ocupação do hotel e rende por participante. Barulhento. Ocupa 2 andares.',
  busstop: 'Ônibus levam e trazem gente do prédio inteiro (mais visitantes), mas se a fila crescer, quem espera fica estressado: construa mais pontos. Fica no térreo ou no subsolo (no subsolo precisa de rampa de carros).',
  taxi: 'Táxis levam e trazem gente do prédio inteiro; escoam menos gente por minuto que o ônibus, mas são menores e mais baratos. Fica no térreo ou no subsolo (no subsolo precisa de rampa de carros).',
  heliport: 'Só no topo da torre (nada pode ficar acima). Atrai convidados VIP: eles chegam de helicóptero.',
  parkspace: 'Vaga de estacionamento (só subsolo). Pode ser construída em qualquer lugar do subsolo, mas só funciona (e só é ocupada) se estiver ligada à entrada dos carros (rampa, túnel com portal ou elevador de carros que chegue ao térreo): encoste numa rampa, num túnel ligado a ela ou a um túnel com portal, direto ou por uma fileira de vagas. Sem essa ligação não funciona. Rende R$ 40 por carro. Moradores com carro (mais comum nas faixas de preço altas) ficam mais satisfeitos quando há vagas para todos. Arraste.',
  parkramp: 'Rampa de acesso para carros (só subsolo).',
  transit: 'Estação de metrô no subsolo: trens trazem passageiros à plataforma e satisfazem os moradores sem carro (mais comuns nas faixas de preço baixas). Ligue-a ao térreo com elevadores ou escadas. Cada estação pertence a uma linha (azul, vermelha, amarela, verde ou lilás): escolha a cor clicando na estação.',
  landmark: 'A obra final da torre: construí-la (5★) completa o jogo, com a classificação máxima "Torre completa". Também rende: nos fins de semana há casamentos, com convidados que pagam R$ 3.000 cada ao chegar (precisa de escada ou elevador até ela). Só pode haver uma, no alto da torre (andar 31 ou mais).',
};

function hourStr(min) {
  const h = ((min % 1440) + 1440) % 1440;
  return String(Math.floor(h / 60)).padStart(2, '0') + ':' + String(Math.floor(h % 60)).padStart(2, '0');
}

// manutenção e textos dos túneis de veículos (derivados dos corredores)
for (const k of ['corridor', 'corridorExt', 'corridorSpr', 'corridorCam', 'corridorHyd']) {
  const t = 'tunnel' + k.slice(8);
  MAINT[t] = Math.round(MAINT[k] * 1.5);
  DESC[t] = 'Túnel de veículos no subsolo: liga a rampa de carros aos pontos de ônibus e táxi (encostado, lado a lado). ' + DESC[k];
}
MAINT.tunnelDown = 400;
DESC.tunnelDown = '(Aposentado: use a rampa de carros.) Desce um andar em diagonal (a tecla R escolhe o lado: desce para a esquerda ou para a direita). A ponta alta encosta num andar acima e a ponta baixa continua no andar dele. Encadeie para chegar a níveis fundos.';
DESC.parkramp = (DESC.parkramp || '') + ' Tem dois lados (tecla R): a ponta alta fica no andar de cima, a ponta baixa continua no andar dela. Encadeie rampas ou túneis descendentes para chegar a níveis fundos.';
MAINT.tunnelPortal = 800; MAINT.tunnelPortal2 = 1400;
DESC.tunnelPortal = 'Boca de túnel por onde os veículos entram e saem do subsolo direto para a rua, sem precisar de rampas: tem a própria abertura com luz do dia. Tem lado (tecla R): a saída fica numa ponta e só o que encosta na outra ponta, o lado de dentro, está ligado a ela. Encoste pontos de ônibus e táxi, vagas e outros túneis nesse lado, em qualquer nível do subsolo. Mais caro que o túnel comum.';
DESC.tunnelPortal2 = 'Igual ao túnel com portal, mas com duas pistas, uma em cada um dos 2 andares que ocupa: liga os dois níveis do subsolo à rua. Ainda mais caro.';

// ---- energia e água: a rede pública atende uma torre pequena; passando disso o jogador precisa de fontes
// `USE`: consumo por unidade de largura [energia, água] (salas vagas gastam 20%); prioridade de atendimento em `UPRIO` (maior = cai por último)
// quedas de energia e de água: chance por dia (sobe com a sobrecarga), duração em minutos de jogo
const OUTAGE = {minStar: 1, chance: 0.04, overload: 6, minutes: [45, 150], crime: 1.6};
const UTIL = {grid: {energia: 600, agua: 0}, reach: {grid: 128, own: 80}, liftReach: 24, vacant: 0.2, elevator: 6, escalator: 2, penalty: {energia: 60, agua: 50}, rent: 0.5};
const USE = {
  office: [0.5, 0.15], coworking: [0.5, 0.15], officeEx: [1, 0.2], kitnet: [0.4, 0.5], condo: [0.5, 0.7], penthouse: [0.8, 1], single: [0.6, 0.8], twin: [0.6, 0.8], suite: [0.6, 0.8],
  fastfood: [1.2, 0.9], restaurant: [1.2, 0.9], bar: [1.2, 0.9], cafe: [1.2, 0.9], shop: [0.6, 0.2], banco: [0.6, 0.2], mercado: [0.6, 0.2], lavanderia: [0.8, 1.8],
  cinema: [1, 0.2], party: [1, 0.2], auditorio: [1, 0.2], academia: [0.8, 1.2], piscina: [1, 2.5], clinic: [0.6, 0.5], creche: [0.6, 0.5], security: [0.3, 0],
  recycling: [1, 0.5], bomba: [0.6, 0], bombaRecalque: [0.8, 0], bombaMedia: [1, 0], bombaForte: [1.8, 0], caixaTorre: [0.5, 0], tratamento: [1, 0], transit: [1.5, 0.5], jardim: [0.1, 0.8],  busstop: [0.1, 0], taxi: [0.1, 0], heliport: [0.3, 0], housekeeping: [0.2, 0.3], landmark: [0.3, 0.3],
};
const UPRIO = {security: 6, clinic: 5, single: 5, twin: 5, suite: 5, condo: 4, kitnet: 4, penthouse: 4, creche: 4, housekeeping: 4, office: 3, officeEx: 3, coworking: 3, bike: 0, parkspace: 0, busstop: 1, taxi: 1, heliport: 1};
DESC.gerador = 'Produz energia (160 unidades) para a torre quando a rede pública não basta. Barulhento: incomoda os vizinhos. Manutenção diária.';
DESC.solar = 'Só no topo da torre (nada pode ficar acima). Silenciosa: rende até 180 unidades de energia, só de dia.';
DESC.bomba = 'Só no subsolo. Vazão de 260 de água e alcance de 16 andares: abastece as salas por perto e o que sobra enche as caixas d\'água acima dela (a água só sobe por bomba). Barulhenta e gasta energia.';
DESC.bombaRecalque = 'Em qualquer andar. A água só desce sozinha: esta bomba eleva até 300 de água por hora de uma caixa para outra caixa que está ACIMA dela e ao alcance (a até 3 andares da caixa de baixo). Gasta energia; sem energia não eleva. Não produz água nem abastece salas.';
DESC.bombaMedia = 'Bomba de subsolo com o dobro da vazão (520) e do alcance (32 andares). Mais cara e mais barulhenta; o que sobra enche as caixas acima, repartido pela necessidade de cada uma.';
DESC.bombaForte = 'Bomba industrial de subsolo: vazão de 1.040 e alcance de 80 andares, para torres altas. Cara e muito barulhenta.';
DESC.caixaMedia = 'Reservatório de 1.800 de água (entrega até 900 por hora), três vezes a caixa simples, com alcance de 12 andares. Mesmas regras: a água desce sozinha e só sobe por bomba. Ocupa 2 andares.';
DESC.caixaGrande = 'Reservatório de 6.000 de água (entrega até 2.000 por hora e enche 500 por hora) com alcance de 16 andares: o estoque das torres altas. Mesmas regras da caixa simples. Ocupa 3 andares.';
DESC.caixaTorre = 'Caixa d\'água com bomba de recalque embutida: enche como as outras (pelas bombas de baixo) e guarda 8.000 de água (entrega até 2.400 por hora). Além disso BOMBEIA a própria água, até 600 por hora, para encher as caixas que estão ACIMA dela e ao alcance (20 andares), sem precisar de bomba de recalque. Gasta energia: sem ela continua guardando e abastecendo para baixo, mas não bombeia para cima. Ocupa 3 andares.';
DESC.tratamento = 'Estação de tratamento no subsolo: 800 unidades de água. Faz barulho.';
// gerador, bateria e caixa d'água não consomem nada (só a bomba e a estação de tratamento gastam energia)
delete USE.geradorGas; delete USE.bateria; delete USE.bateriaPequena; delete USE.bateriaGrande; delete USE.caixa;
DESC.geradorGas = 'Gerador a gás: 300 unidades de energia, mais potente e menos poluente que o diesel, mas ainda barulhento. Manutenção diária.';
DESC.bateriaPequena = 'Bateria compacta (1 casa): guarda 167 de energia e entrega até 107 por hora, um terço da bateria comum, por metade do preço. Mesmas regras: enche com a sobra da rede, dos geradores e das placas e esvazia no déficit.';
DESC.bateriaGrande = 'Banco de baterias (3 casas): guarda 1.500 de energia e entrega até 960 por hora, o triplo da bateria comum. Para torres grandes e apagões longos. Mesmas regras das outras baterias.';
DESC.bateria = 'Armazena energia: enche com a sobra da rede, dos geradores, das placas solares e de outras baterias carregadas por perto (uma bateria alimenta a próxima, andar após andar), e esvazia quando o consumo passa da produção (ou num apagão). Capacidade 500, entrega até 320 por hora.';
DESC.caixa = 'Reservatório de 600 de água (entrega até 360 por hora) em qualquer andar. A água desce sozinha: a caixa abastece as salas que estão no andar dela ou abaixo, e enche as caixas mais baixas. Para SUBIR é preciso bomba: as de subsolo enchem a caixa acima delas e ao alcance, e a bomba de recalque eleva de uma caixa para outra acima. Caixa vazia não fornece nada. Ocupa 2 andares.';

// clima do dia (sorteado pela estação; o de amanhã é previsto): ajusta consumo, rendimento solar e a chance de apagão
const WEATHER = {
  sol: {name: 'Ensolarado', icon: '☀️', sun: 1, energia: 1, agua: 1, outage: 1},
  nublado: {name: 'Nublado', icon: '☁️', sun: 0.5, energia: 1, agua: 1, outage: 1},
  garoa: {name: 'Garoa', snow: 'Neve fraca', icon: '🌦️', sun: 0.45, energia: 1, agua: 0.95, outage: 1.1, rain: true, level: 0.3},
  chuva: {name: 'Chuva', snow: 'Neve', icon: '🌧️', sun: 0.25, energia: 1, agua: 0.9, outage: 1.3, rain: true, level: 0.65},
  tempestade: {name: 'Tempestade', snow: 'Nevasca', icon: '⛈️', sun: 0.08, energia: 1.05, agua: 0.85, outage: 5, rain: true, level: 1, storm: true},   // chuva pesada: raios, ventos e apagões
  calor: {name: 'Onda de calor', icon: '🥵', sun: 1.1, energia: 1.15, agua: 1.25, outage: 2},
  frio: {name: 'Frio forte', icon: '🥶', sun: 0.9, energia: 1.25, agua: 1, outage: 1.5},
};
const WEATHER_KEYS = Object.keys(WEATHER);
const WEATHER_ODDS = [   // por estação: primavera, verão, outono, inverno (sol, nublado, garoa, chuva, tempestade, calor, frio)
  [0.3, 0.2, 0.2, 0.2, 0.05, 0.05, 0], [0.4, 0.1, 0.05, 0.05, 0.05, 0.35, 0], [0.25, 0.25, 0.2, 0.2, 0.05, 0, 0.05], [0.2, 0.2, 0.1, 0.1, 0.05, 0, 0.35]];
const weatherName = (w, season) => (season === 3 && WEATHER[w].snow) || WEATHER[w].name;   // no inverno a chuva vira neve
const STORM = {blackout: 0.06, flash: [7, 20]};   // tempestade: chance por hora de um raio derrubar a rede; intervalo (s reais) entre raios
USE.lixo = [0.1, 0];
DESC.lixo = 'Galpão de 2 andares no subsolo que guarda o lixo das unidades por perto (até 40 unidades de distância). Quando enche é você quem chama o caminhão (botão no painel ou no alerta; R$ 12.000 por coleta): ele chega até a doca e esvazia o depósito. Enquanto o lixo se acumula as pessoas por perto ficam descontentes, e cheio ele transborda. A usina de reciclagem é a versão grande: processa o lixo sozinha, sem caminhão.';
DESC.recycling = 'Melhora a satisfação das unidades por perto e processa o lixo delas sozinha (sem caminhão), mas custa caro e faz muito barulho.';

// comércios e serviços que podem fechar e voltar a ficar vagos (o comerciante se muda): pouco movimento por perto ou insegurança por `days` dias seguidos.
// Fechado = vago ("ALUGA-SE"), sem renda nem custo diário, sem visitantes; um novo comerciante abre sozinho, com chance diária, quando o movimento volta.
const BIZ = {days: 3, minPop: 14, minSafe: 0.62, reopen: 0.35, minPopDay: 150, minDay: 3};
for (const k of ['cafe', 'fastfood', 'restaurant', 'bar', 'mercado', 'lavanderia', 'banco', 'academia', 'creche']) FAC[k].biz = true;

