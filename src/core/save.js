import { SAVE_KEY } from '../config.js';

export const Save = {
  data: null,
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      this.data = raw ? JSON.parse(raw) : this.defaults();
    } catch (e) { this.data = this.defaults(); }
    // backfill any new fields added since an older save was written
    const d = this.defaults();
    for (const k in d) if (!(k in this.data)) this.data[k] = d[k];
    return this.data;
  },
  defaults() {
    return { cores: 0, unlockedLoadouts: ['assault'], perks: {}, bestWave: 0, runsPlayed: 0 };
  },
  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) {}
  },
  reset() {
    this.data = this.defaults();
    this.save();
  },
  perkLevel(id) { return this.data.perks[id] || 0; },
  persistent: true,
  testPersistence() {
    try {
      const t = '__nbr_test__';
      localStorage.setItem(t, '1');
      const ok = localStorage.getItem(t) === '1';
      localStorage.removeItem(t);
      this.persistent = ok;
    } catch (e) { this.persistent = false; }
    return this.persistent;
  },
};

Save.load();
Save.testPersistence();
