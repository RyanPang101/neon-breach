// Generic object pool — avoids GC churn at high particle/projectile counts.
// factory() builds a blank object once; resetFn(obj, ...args) reinitializes
// it on every checkout, so pooled objects never leak state between uses.
export function makePool(factory, resetFn) {
  const pool = [];
  const active = [];
  return {
    get(...args) {
      let obj = pool.pop();
      if (!obj) obj = factory();
      resetFn(obj, ...args);
      active.push(obj);
      return obj;
    },
    release(obj) {
      const i = active.indexOf(obj);
      if (i >= 0) active.splice(i, 1);
      pool.push(obj);
    },
    active,
    reclaim() {
      for (let i = active.length - 1; i >= 0; i--) {
        if (active[i].dead) { pool.push(active[i]); active.splice(i, 1); }
      }
    },
  };
}
