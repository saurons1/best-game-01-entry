// HADAL DIVE — the world: spawning, depths, pickups, collisions, scoring.
// One fixed-step simulation. The loop feeds it a control object each step; it
// returns event flags and leaves every visible change in `state` for render.js.
import {
  VIEW_W, VIEW_H, STEP, MAX_DEPTH, EVENT_HIT, EVENT_LEVELUP, EVENT_DEPTH,
  EVENT_OVER, EVENT_WIN, EVENT_ELITE, EVENT_BOSS,
  depthQuota, spawnInterval, spawnCap, xpForLevel, PLAYER,
} from './config.js';
import { createPlayer, updatePlayer, damagePlayer, healPlayer } from './player.js';
import { makeEnemy, pickKind, updateEnemy, damageEnemy, KIND_LEVIATHAN } from './enemies.js';
import { rollDraft, applyUpgrade } from './upgrades.js';

/** A fresh trench: depth 1, three amber thermal vents, drifting plankton motes. */
export function createWorld(random) {
  const state = {
    random,
    time: 0,
    depth: 1,
    depthKills: 0,
    score: 0,
    kills: 0,
    xp: 0,
    level: 1,
    xpNext: xpForLevel(1),
    player: createPlayer(),
    harpoons: [],
    enemyShots: [],
    enemies: [],
    pickups: [],
    particles: [],
    popups: [],
    vents: [
      { x: 180, y: 620, r: 70 },
      { x: 1100, y: 180, r: 70 },
      { x: 640, y: 140, r: 60 },
    ],
    motes: [],
    spawnTimer: 1.2,
    eliteSpawned: false,
    boss: null,
    bossSpawned: false,
    draft: null,
    shake: 0,
    flash: 0,
    banner: '',
    bannerTime: 0,
    boost: 1,
    stats: { shotsFired: 0, hits: 0, damageDealt: 0, pickups: 0 },
    over: false,
    won: false,
  };
  for (let i = 0; i < 70; i++) {
    state.motes.push({ x: random.range(0, VIEW_W), y: random.range(0, VIEW_H), r: random.range(1, 2.6), s: random.range(4, 14), p: random.range(0, 6.28) });
  }
  return { state, random };
}

export function resetWorld(world) {
  const fresh = createWorld(world.random);
  Object.keys(world.state).forEach((k) => delete world.state[k]);
  Object.assign(world.state, fresh.state);
}

function burst(state, x, y, color, count, speed) {
  for (let i = 0; i < count; i++) {
    const a = state.random.range(0, Math.PI * 2);
    const v = state.random.range(speed * 0.3, speed);
    state.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: state.random.range(0.3, 0.8), max: 0.8, color, r: state.random.range(1.5, 4) });
  }
}

function popup(state, x, y, text, color) {
  state.popups.push({ x, y, text, color, life: 0.9 });
}

function spawnEdge(state, kind, elite) {
  const side = state.random.int(0, 3);
  let x;
  let y;
  if (side === 0) { x = state.random.range(40, VIEW_W - 40); y = 30; }
  else if (side === 1) { x = state.random.range(40, VIEW_W - 40); y = VIEW_H - 30; }
  else if (side === 2) { x = 30; y = state.random.range(40, VIEW_H - 40); }
  else { x = VIEW_W - 30; y = state.random.range(40, VIEW_H - 40); }
  // Never drop a foe on top of the sub.
  const p = state.player;
  if (Math.hypot(x - p.x, y - p.y) < 220) {
    x = VIEW_W - x;
    y = VIEW_H - y;
  }
  state.enemies.push(makeEnemy(kind, x, y, elite, state.depth));
}

function dropPickup(state, x, y, kind, value) {
  state.pickups.push({ x, y, kind, value, vx: state.random.range(-30, 30), vy: state.random.range(-30, 30), life: 14 });
}

function killEnemy(state, enemy) {
  state.kills += 1;
  state.depthKills += 1;
  state.score += enemy.score;
  popup(state, enemy.x, enemy.y - enemy.radius, `+${enemy.score}`, '#ffd76a');
  burst(state, enemy.x, enemy.y, enemy.kind === KIND_LEVIATHAN ? '#ff4fd8' : '#4de8ff', enemy.elite ? 26 : 12, 160);
  // Glow-plankton (XP) always; repair cells from tough foes.
  const xpValue = enemy.elite ? 6 : enemy.kind === KIND_LEVIATHAN ? 0 : 1;
  for (let i = 0; i < xpValue; i++) dropPickup(state, enemy.x + state.random.range(-24, 24), enemy.y + state.random.range(-24, 24), 'xp', 1);
  if ((enemy.kind === 'crusher' || enemy.elite) && state.random.chance(0.6)) dropPickup(state, enemy.x, enemy.y, 'repair', 18);
  if (enemy.kind === KIND_LEVIATHAN) {
    state.boss = null;
    state.won = true;
  }
}

function gainXp(state, amount) {
  state.xp += amount;
  while (state.xp >= state.xpNext) {
    state.xp -= state.xpNext;
    state.level += 1;
    state.xpNext = xpForLevel(state.level);
    state.draft = rollDraft(state.random, state.player);
    return true;
  }
  return false;
}

/**
 * One fixed step. `ctrl` is { x, y, aimX, aimY, dash }; `sfx` may be null (shots).
 * Returns an event bitmask. When a draft opens, the caller must pause stepping.
 */
export function stepWorld(world, ctrl, dt, sfx) {
  const state = world.state;
  if (state.over || state.won || state.draft) return 0;
  let events = 0;
  state.time += dt;
  state.bannerTime = Math.max(0, state.bannerTime - dt);
  state.shake = Math.max(0, state.shake - dt * 2.2);
  state.flash = Math.max(0, state.flash - dt * 3);
  const player = state.player;

  // Thermal vents slowly repair a sub that rests in their amber glow.
  for (const vent of state.vents) {
    if (Math.hypot(player.x - vent.x, player.y - vent.y) < vent.r) {
      healPlayer(player, 7 * dt);
    }
  }

  const fired = updatePlayer(player, ctrl, dt, state.harpoons, sfx);
  if (fired && sfx) sfx.shoot();
  state.stats.shotsFired = player.shotsFired;

  // Spawning: faster and denser the deeper the dive goes.
  if (!state.bossSpawned || state.boss) {
    state.spawnTimer -= dt;
    const cap = state.boss ? 8 : spawnCap(state.depth);
    if (state.spawnTimer <= 0 && state.enemies.length < cap) {
      state.spawnTimer = spawnInterval(state.depth) * state.random.range(0.7, 1.3);
      spawnEdge(state, pickKind(state.random, state.depth), false);
    }
  }

  // Elite on every third depth, once per depth.
  if (state.depth % 3 === 0 && !state.eliteSpawned && state.depthKills >= 2) {
    state.eliteSpawned = true;
    const kind = state.random.pick(['gulper', 'crusher', 'spitter']);
    spawnEdge(state, kind, true);
    state.banner = 'ELITE SURFACES — BEWARE';
    state.bannerTime = 2.6;
    events |= EVENT_ELITE;
    if (sfx) sfx.elite();
  }

  // The Leviathan at depth 10.
  if (state.depth === MAX_DEPTH && !state.bossSpawned) {
    state.bossSpawned = true;
    const boss = makeEnemy(KIND_LEVIATHAN, VIEW_W / 2, 90, false, state.depth);
    state.enemies.push(boss);
    state.boss = boss;
    state.banner = 'THE TRENCH LEVIATHAN';
    state.bannerTime = 3;
    events |= EVENT_BOSS;
    if (sfx) sfx.roar();
  }

  // Foes move and act.
  const spawnFn = (kind, x, y) => { state.enemies.push(makeEnemy(kind, x, y, false, state.depth)); };
  for (const enemy of state.enemies) {
    updateEnemy(enemy, player, dt, state.time, state.enemyShots, spawnFn, state.random);
  }

  // Harpoons fly and strike.
  for (const h of state.harpoons) {
    h.x += h.vx * dt;
    h.y += h.vy * dt;
    h.life -= dt;
    for (const enemy of state.enemies) {
      if (enemy.dead || h.hitIds.has(enemy.id)) continue;
      if (Math.hypot(h.x - enemy.x, h.y - enemy.y) < enemy.radius + 6) {
        h.hitIds.add(enemy.id);
        state.stats.hits += 1;
        state.stats.damageDealt += h.damage * state.boost;
        if (damageEnemy(enemy, h.damage * state.boost)) killEnemy(state, enemy);
        else burst(state, h.x, h.y, '#bfe9ff', 4, 90);
        if (sfx) sfx.hit();
        if (h.pierce <= 0 || h.hitIds.size > h.pierce) { h.life = 0; break; }
      }
    }
  }
  state.harpoons = state.harpoons.filter((h) => h.life > 0 && h.x > -20 && h.x < VIEW_W + 20 && h.y > -20 && h.y < VIEW_H + 20);
  state.enemies = state.enemies.filter((e) => !e.dead);

  // Enemy globs fly and strike the sub.
  for (const shot of state.enemyShots) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.life -= dt;
    if (Math.hypot(shot.x - player.x, shot.y - player.y) < player.radius + shot.radius) {
      shot.life = 0;
      if (damagePlayer(player, shot.damage)) {
        state.shake = 0.5;
        state.flash = 0.5;
        events |= EVENT_HIT;
        if (sfx) sfx.hurt();
      }
    }
  }
  state.enemyShots = state.enemyShots.filter((s) => s.life > 0 && s.x > -20 && s.x < VIEW_W + 20 && s.y > -20 && s.y < VIEW_H + 20);

  // Contact damage.
  for (const enemy of state.enemies) {
    if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < enemy.radius + player.radius - 4) {
      if (damagePlayer(player, enemy.damage)) {
        state.shake = 0.7;
        state.flash = 0.6;
        events |= EVENT_HIT;
        if (sfx) sfx.hurt();
        // Shove the foe back so one touch is not a chain of touches.
        const a = Math.atan2(enemy.y - player.y, enemy.x - player.x);
        enemy.x += Math.cos(a) * 26;
        enemy.y += Math.sin(a) * 26;
      }
    }
  }

  // Pickups drift, magnet toward the sub, and get collected.
  for (const pk of state.pickups) {
    pk.life -= dt;
    const d = Math.hypot(player.x - pk.x, player.y - pk.y);
    if (d < player.magnet) {
      const pull = 420 * (1 - d / (player.magnet + 60));
      pk.vx += ((player.x - pk.x) / (d || 1)) * pull * dt * 4;
      pk.vy += ((player.y - pk.y) / (d || 1)) * pull * dt * 4;
    }
    pk.x += pk.vx * dt;
    pk.y += pk.vy * dt;
    pk.vx *= 1 - Math.min(1, dt * 2);
    pk.vy *= 1 - Math.min(1, dt * 2);
    if (d < player.radius + 12) {
      pk.life = 0;
      state.stats.pickups += 1;
      if (pk.kind === 'xp') {
        if (gainXp(state, pk.value)) {
          events |= EVENT_LEVELUP;
          if (sfx) sfx.levelup();
        } else if (sfx) sfx.pickup();
      } else if (pk.kind === 'repair') {
        healPlayer(player, pk.value);
        popup(state, player.x, player.y - 34, `+${pk.value} HULL`, '#7dffd4');
        if (sfx) sfx.heal();
      }
    }
  }
  state.pickups = state.pickups.filter((p) => p.life > 0);

  // Particles and popups fade.
  for (const pt of state.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
  for (const pp of state.popups) {
    pp.y -= 34 * dt;
    pp.life -= dt;
  }
  state.popups = state.popups.filter((p) => p.life > 0);
  for (const mote of state.motes) {
    mote.y -= mote.s * dt;
    mote.x += Math.sin(state.time * 0.5 + mote.p) * 6 * dt;
    if (mote.y < -4) { mote.y = VIEW_H + 4; mote.x = state.random.range(0, VIEW_W); }
  }

  // Descend: enough kills clears the depth.
  if (!state.won && state.depth < MAX_DEPTH && state.depthKills >= depthQuota(state.depth)) {
    state.depth += 1;
    state.depthKills = 0;
    state.eliteSpawned = false;
    state.banner = `DEPTH ${state.depth} — ${1200 + state.depth * 900}m`;
    state.bannerTime = 2.6;
    healPlayer(player, 12);
    events |= EVENT_DEPTH;
    if (sfx) sfx.depth();
  }

  if (state.won) {
    events |= EVENT_WIN;
    return events;
  }
  if (player.hull <= 0) {
    player.hull = 0;
    state.over = true;
    burst(state, player.x, player.y, '#ffb347', 40, 260);
    events |= EVENT_OVER;
  }
  return events;
}

/** Apply a drafted card and close the draft. */
export function chooseDraft(world, index) {
  const state = world.state;
  if (!state.draft || index < 0 || index >= state.draft.length) return false;
  const id = state.draft[index];
  if (!applyUpgrade(state.player, id)) return false;
  state.draft = null;
  return true;
}
