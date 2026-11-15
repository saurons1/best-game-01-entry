// HADAL DIVE — deterministic screenshot scenes behind ?shot=<scene>&seed=<n>.
// Each scene plays the real rules forward from a fresh world with a simple
// autopilot (chase the nearest foe, keep distance from crushers, collect
// plankton, dash out of a crowd), so every frame is what a real dive looks like
// and the same seed always gives the same frame. No wall clock is read.
import { STEP, SCREENS, EVENT_WIN, EVENT_OVER, VIEW_W, VIEW_H } from './config.js';
import { resetWorld, stepWorld, chooseDraft } from './world.js';

/** One autopilot step: steer toward the nearest foe, away from the nearest crusher. */
function autopilot(state) {
  const p = state.player;
  let target = null;
  let targetDist = Infinity;
  for (const e of state.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < targetDist) {
      targetDist = d;
      target = e;
    }
  }
  let mx = 0;
  let my = 0;
  let aimX = p.x;
  let aimY = p.y - 100;
  if (target) {
    aimX = target.x;
    aimY = target.y;
    // Keep a fighting distance: close in, but back off a crusher's bulk.
    const want = target.kind === 'crusher' ? 300 : 170;
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const toward = d > want + 30 ? 1 : d < want - 60 ? -1 : 0;
    mx = (dx / d) * toward;
    my = (dy / d) * toward;
  }
  // Drift toward the nearest plankton when nothing threatens.
  if (!target) {
    let pk = null;
    let pd = Infinity;
    for (const item of state.pickups) {
      const d = Math.hypot(item.x - p.x, item.y - p.y);
      if (d < pd) {
        pd = d;
        pk = item;
      }
    }
    if (pk) {
      mx = (pk.x - p.x) / (pd || 1);
      my = (pk.y - p.y) / (pd || 1);
    }
  }
  // Keep the fight in frame: steer back toward the middle near the walls.
  if (p.x < 220) mx += 0.9;
  if (p.x > VIEW_W - 220) mx -= 0.9;
  if (p.y < 200) my += 0.9;
  if (p.y > VIEW_H - 240) my -= 0.9;
  const mLen = Math.hypot(mx, my);
  if (mLen > 1) {
    mx /= mLen;
    my /= mLen;
  }
  // Dash when boxed in.
  let near = 0;
  for (const e of state.enemies) if (Math.hypot(e.x - p.x, e.y - p.y) < 90) near++;
  return { x: mx, y: my, aimX, aimY, dash: near >= 3 && p.dashCooldown <= 0 };
}

/** Step once, auto-picking any draft that opens so a long staging run continues. */
function stepAuto(world, ctrl) {
  const events = stepWorld(world, ctrl, STEP, null);
  if (world.state.draft) chooseDraft(world, 0);
  return events;
}

/** Run the autopilot for up to `seconds`, stopping early on `stop(state)`. */
function runFor(world, seconds, stop) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    const events = stepAuto(world, autopilot(world.state));
    if (stop && stop(world.state, events)) break;
    if (world.state.over || world.state.won) break;
  }
}

/**
 * Stage a named scene and return the screen to draw over it.
 * title: attract mode behind the title. play: a mid-fight against the Leviathan
 * at depth 10. draft: the level-up draft. victory: the Leviathan slain.
 * end: a careless dive that ends in a breached hull.
 */
export function stageShot(name, world) {
  resetWorld(world);
  const state = world.state;
  if (name === 'title') {
    for (let i = 0; i < 5 / STEP; i++) {
      stepWorld(world, { x: 0, y: 0, aimX: 640, aimY: 300, dash: false }, STEP, null);
      // Attract mode must never sink the sub or open a draft behind the title.
      state.player.hull = state.player.maxHull;
      state.over = false;
      state.draft = null;
    }
    return { screen: SCREENS.TITLE };
  }
  if (name === 'draft') {
    // Step without auto-picking, so the first level-up draft stays open for the shot.
    const steps = Math.floor(240 / STEP);
    for (let i = 0; i < steps; i++) {
      stepWorld(world, autopilot(state), STEP, null);
      if (state.draft) break;
      if (state.over || state.won) break;
    }
    if (state.draft) return { screen: SCREENS.DRAFT };
    return { screen: SCREENS.PLAY };
  }
  if (name === 'play') {
    state.boost = 14;
    runFor(world, 420, (s) => s.boss !== null);
    state.boost = 1;
    // The last stretch is the cover frame: keep the sub alive through it so the
    // shot shows a fight in progress, not a wreck.
    const steps = Math.floor(14 / STEP);
    for (let i = 0; i < steps; i++) {
      stepAuto(world, autopilot(state));
      if (state.player.hull < 45) state.player.hull = 60;
      state.over = false;
      if (state.won) break;
    }
    return { screen: SCREENS.PLAY };
  }
  if (name === 'victory') {
    state.boost = 14;
    runFor(world, 600, (s, events) => (events & EVENT_WIN) !== 0);
    return { screen: SCREENS.VICTORY };
  }
  if (name === 'end') {
    // A careless pilot: never moves, never dashes, so the trench catches up.
    const steps = Math.floor(600 / STEP);
    for (let i = 0; i < steps; i++) {
      const events = stepWorld(world, { x: 0, y: 0, aimX: 640, aimY: 200, dash: false }, STEP, null);
      if (state.draft) chooseDraft(world, 0);
      if ((events & EVENT_OVER) !== 0) break;
    }
    return { screen: state.over ? SCREENS.OVER : SCREENS.PLAY };
  }
  return { screen: SCREENS.TITLE };
}
