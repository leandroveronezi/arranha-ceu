'use strict';
// Arranha-Céu — saves por slot. Lógica pura (sem DOM): o armazenamento entra pelo construtor, para testar no Node.
// O autosave continua na chave antiga (`arranha-ceu-v1`); os slots ficam em `arranha-ceu-slot-N` e o índice em `arranha-ceu-slots`.

const SAVE_SLOTS = 5;
const SAVE_KEYS = {auto: 'arranha-ceu-v1', index: 'arranha-ceu-slots', slot: id => 'arranha-ceu-slot-' + id};

// confere se um save (de slot, autosave ou arquivo importado) tem cara de torre; lança erro se não tiver.
// Formatos antigos (sem `v` ou v < 3) continuam valendo: `Game.load` reconstrói as pessoas a partir da torre.
// migrações do formato: SAVE_MIGRATIONS[n] converte um save da versão n para n+1 (hoje vazio: `Game.load` ainda tolera v1 e v2 sozinho)
const SAVE_MIGRATIONS = {
  // v3 → v4: a laje deixou de ser uma lista com um item por andar (índice 0 = andar -10) e virou [[andar, trechos], ...]
  3: d => { d.slab = d.slab.map((runs, i) => [i - 10, runs]).filter(e => e[1].length); },
};
function upgradeSave(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.facs) || !Array.isArray(d.slab) || typeof d.funds !== 'number') throw new Error('Não é um save do Arranha-Céu.');
  if (!d.v) d.v = 1;
  if (d.v > SAVE_VERSION) throw new Error('Este save é de uma versão mais nova do jogo (v' + d.v + ').');
  while (d.v < SAVE_VERSION) {
    const step = SAVE_MIGRATIONS[d.v];
    if (step) step(d);
    d.v++;
  }
  if (!Array.isArray(d.shafts)) d.shafts = [];
  if (!Array.isArray(d.stairs)) d.stairs = [];
  return d;
}

class SaveStore {
  constructor(storage) { this.st = storage; }
  _get(k) { try { const t = this.st.getItem(k); return t == null ? null : JSON.parse(t); } catch (_) { return null; } }
  _raw(k) { try { return this.st.getItem(k); } catch (_) { return null; } }
  _set(k, v) { try { this.st.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); return true; } catch (_) { return false; } }
  _del(k) { try { this.st.removeItem(k); } catch (_) {} }
  _index() {
    const i = this._get(SAVE_KEYS.index);
    return i && typeof i === 'object' && i.slots && typeof i.slots === 'object' ? i : {v: 1, slots: {}, last: null};
  }
  // resumo mostrado na lista: estrelas, população, dinheiro e quando foi salvo
  meta(d, name, now) {
    return {name, savedAt: now, star: d.star || 1, funds: Math.round(d.funds), day: Math.floor((d.t || 0) / 1440) + 1, pop: Array.isArray(d.people) ? d.people.length : 0};
  }
  // os N slots, na ordem; null = vazio. `last` = último slot usado.
  list() {
    const idx = this._index();
    return Array.from({length: SAVE_SLOTS}, (_, i) => {
      const id = i + 1, m = idx.slots[id];
      return m && this._raw(SAVE_KEYS.slot(id)) != null ? {id, ...m, last: idx.last === id} : {id, empty: true, last: false};
    });
  }
  save(id, data, name, now = Date.now()) {
    if (!(id >= 1 && id <= SAVE_SLOTS)) return {ok: false, err: 'Slot inválido.'};
    const idx = this._index(), prev = idx.slots[id];
    const n = (name || (prev && prev.name) || 'Torre ' + id).trim().slice(0, 24) || 'Torre ' + id;
    const key = SAVE_KEYS.slot(id), before = this._raw(key);
    if (!this._set(key, JSON.stringify(data))) return {ok: false, err: 'Não foi possível salvar neste navegador (sem espaço?).'};
    idx.slots[id] = this.meta(data, n, now); idx.last = id;
    if (!this._set(SAVE_KEYS.index, idx)) {   // desfaz: o slot volta ao que era
      if (before != null) this._set(key, before); else this._del(key);
      return {ok: false, err: 'Não foi possível salvar o índice dos slots.'};
    }
    return {ok: true, meta: idx.slots[id]};
  }
  load(id) {
    const d = this._get(SAVE_KEYS.slot(id));
    if (!d) return null;
    try { return upgradeSave(d); } catch (_) { return null; }
  }
  remove(id) {
    const idx = this._index();
    delete idx.slots[id]; if (idx.last === id) idx.last = null;
    this._del(SAVE_KEYS.slot(id)); this._set(SAVE_KEYS.index, idx);
  }
  rename(id, name) {
    const idx = this._index(), m = idx.slots[id], n = (name || '').trim().slice(0, 24);
    if (!m || !n) return false;
    m.name = n; return this._set(SAVE_KEYS.index, idx);
  }
  get last() { return this._index().last; }
  // autosave (chave antiga, sem mudar o formato)
  autosave(data) { return this._set(SAVE_KEYS.auto, JSON.stringify(data)); }
  loadAutosave() {
    const d = this._get(SAVE_KEYS.auto);
    if (!d) return null;
    try { return upgradeSave(d); } catch (_) { return null; }
  }
  clearAutosave() { this._del(SAVE_KEYS.auto); }
  // primeira vez com slots: o save que já existia vira o slot 1, sem perda (o autosave continua lá)
  migrateLegacy(now = Date.now()) {
    if (this._raw(SAVE_KEYS.index) != null) return false;
    const d = this.loadAutosave();
    if (!d) return false;
    return this.save(1, d, 'Torre salva', now).ok;
  }
}
