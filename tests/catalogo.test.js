'use strict';
// O catálogo (catalogo.html) lê catalogo-dados.js, gerado por tools/gerar-catalogo.js (npm run catalogo).
// Sala nova, transporte novo ou mudança no número de modelos sem regerar o arquivo falha aqui.
const fs = require('fs'), path = require('path'), {spawnSync} = require('child_process');
const {FAC, TRANSPORT, ok, done} = require('./helpers');

const raiz = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(raiz, 'catalogo.html'), 'utf8');
const r = spawnSync(process.execPath, [path.join(raiz, 'tools', 'gerar-catalogo.js'), '--check'], {encoding: 'utf8'});
ok(r.status === 0, 'catalogo-dados.js está em dia e todo item tem grupo' + (r.status ? ' (' + (r.stderr || '').trim() + ')' : ''));

const CATALOGO = new Function(fs.readFileSync(path.join(raiz, 'catalogo-dados.js'), 'utf8') + ';return CATALOGO;')();
const listed = new Set(CATALOGO.grupos.flatMap(g => g[1]));
const all = [...Object.keys(FAC), ...Object.keys(TRANSPORT)].filter(k => k !== 'ruin' && !(FAC[k] && FAC[k].nobuild));
const missing = all.filter(k => !listed.has(k));
ok(missing.length === 0, 'todas as salas e transportes aparecem no catálogo' + (missing.length ? ' (faltam: ' + missing.join(', ') + ')' : ''));
const unknown = [...listed].filter(k => !k.startsWith('@') && !FAC[k] && !TRANSPORT[k]);
ok(unknown.length === 0, 'o catálogo não lista nada que não exista' + (unknown.length ? ' (sobram: ' + unknown.join(', ') + ')' : ''));
ok(CATALOGO.grupos.length >= 10 && /catalogo-dados\.js/.test(html) && /paintFacility/.test(html), 'a página lê o arquivo gerado e usa os mesmos painters do jogo');
done('catalogo');
