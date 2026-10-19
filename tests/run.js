#!/usr/bin/env node
'use strict';
// Roda todos os testes (tests/*.test.js) e a simulação de humor. Uso: node tests/run.js
// A simulação de humor é aleatória (eventos, mortes do acaso): falha de vez em quando sem ser bug (~2%), então só reprova se falhar 3 vezes seguidas.
const {spawnSync} = require('child_process'), fs = require('fs'), path = require('path');
const jobs = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort().map(f => [f, [path.join(__dirname, f)], 1]);
jobs.push(['sim-humor', [path.join(__dirname, '..', 'tools', 'sim-humor.js'), '3', '8'], 3]);
let bad = 0;
for (const [name, args, tries] of jobs) {
  let r, out, n = 0;
  do { r = spawnSync(process.execPath, args, {encoding: 'utf8'}); out = (r.stdout + r.stderr).trim().split('\n'); n++; } while (r.status !== 0 && n < tries);
  console.log(`${r.status === 0 ? '✔' : '✘'} ${name}: ${out[out.length - 1]}${r.status === 0 && n > 1 ? ` (passou na ${n}ª tentativa)` : ''}`);
  if (r.status !== 0) { bad++; console.log(out.filter(l => /FAIL|Error/.test(l)).join('\n')); }
}
process.exit(bad ? 1 : 0);
