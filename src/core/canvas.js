// The single shared canvas/context — every drawing module imports from here
// instead of touching the DOM directly, so there is exactly one place that
// knows the game's logical resolution.
export const W = 960, H = 640;
export const canvas = document.getElementById('game');
export const ctx = canvas.getContext('2d');
