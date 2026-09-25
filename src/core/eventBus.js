// Decouples systems from the Game singleton: entities/effects emit facts
// ("a thing died", "the player leveled up") instead of reaching into Game
// directly, so new listeners (achievements, analytics, quest triggers) can
// be added later without touching the code that emits the event.
function createEventBus() {
  const listeners = new Map();
  const bus = {
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(fn);
      return () => bus.off(event, fn);
    },
    off(event, fn) {
      const set = listeners.get(event);
      if (set) set.delete(fn);
    },
    emit(event, payload) {
      const set = listeners.get(event);
      if (!set) return;
      for (const fn of [...set]) fn(payload);
    },
  };
  return bus;
}

export const EventBus = createEventBus();
