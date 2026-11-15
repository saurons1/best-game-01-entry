// HADAL DIVE — tuning and constants.
// One place holds every number the game balances on, so the rest of the code reads
// like rules instead of magic numbers. Depths 1-10, escalating spawns, an elite on
// every third depth, and the Trench Leviathan waiting at depth 10.
export const VIEW_W = 1280;
export const VIEW_H = 800;
export const STEP = 1 / 60;
export const MAX_DEPTH = 10;
export const BEST_KEY = 'hadal-dive-best';

/** Hull, speed and fire numbers for the bathyscaphe. */
export const PLAYER = {
  radius: 22,
  maxHull: 100,
  speed: 250,
  fireInterval: 0.34,
  harpoonSpeed: 640,
  harpoonDamage: 22,
  harpoonLife: 1.1,
  dashSpeed: 720,
  dashTime: 0.16,
  dashCooldown: 2.4,
  magnet: 90,
  invulnTime: 0.9,
};

/** Kills needed to descend from each depth (index = depth). */
export function depthQuota(depth) {
  return 10 + depth * 4;
}

/** How fast new foes arrive, and how many may be alive at once, per depth. */
export function spawnInterval(depth) {
  return Math.max(0.55, 1.7 - depth * 0.11);
}
export function spawnCap(depth) {
  return Math.min(26, 6 + depth * 2);
}

/** XP to go from `level` to `level + 1`. */
export function xpForLevel(level) {
  return 8 + (level - 1) * 7;
}

/** The trench palette: abyssal indigo/teal water, bioluminescent cyan and magenta, amber vents. */
export const COLORS = {
  waterTop: '#0a1230',
  waterMid: '#071230',
  waterDeep: '#03081f',
  teal: '#19c8b9',
  cyan: '#4de8ff',
  magenta: '#ff4fd8',
  amber: '#ffb347',
  gold: '#ffd76a',
  hull: '#dfe9ff',
  hullDark: '#5a6b8f',
  danger: '#ff5a6e',
  plankton: '#7dffd4',
};

export const SCREENS = {
  TITLE: 'title',
  PLAY: 'play',
  DRAFT: 'draft',
  PAUSED: 'paused',
  OVER: 'over',
  VICTORY: 'victory',
};

/** World events the step function reports to the loop (bit flags). */
export const EVENT_HIT = 1;
export const EVENT_LEVELUP = 2;
export const EVENT_DEPTH = 4;
export const EVENT_OVER = 8;
export const EVENT_WIN = 16;
export const EVENT_ELITE = 32;
export const EVENT_BOSS = 64;
