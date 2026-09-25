// Shared read-mostly blackboard for facts entities need about the world
// (current enemy list, current wave) without importing the Game singleton
// directly. Keeps entities/systems free of a circular dependency on game.js
// and free of a hard dependency on "the one global Game object" at all.
export const World = {
  enemies: [],
  wave: 0,
  player: null,
};
