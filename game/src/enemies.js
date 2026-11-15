// HADAL DIVE — the trench's foes.
// Four kinds plus elites and the boss, each with its own movement and attack:
// gulpers chase, darters lunge fast and fragile, crushers crawl armored, spitters
// keep their distance and fire globs. The Leviathan charges, spits rings and
// summons darters. Every foe is drawn from code in render.js; this file is behavior.
import { VIEW_W, VIEW_H } from './config.js';

export const KIND_GULPER = 'gulper';
export const KIND_DARTER = 'darter';
export const KIND_CRUSHER = 'crusher';
export const KIND_SPITTER = 'spitter';
export const KIND_LEVIATHAN = 'leviathan';

let nextId = 1;

/** Base stats per kind: [hp, speed, radius, damage, score]. */
const STATS = {
  [KIND_GULPER]: { hp: 34, speed: 95, radius: 20, damage: 12, score: 50 },
  [KIND_DARTER]: { hp: 16, speed: 205, radius: 13, damage: 8, score: 40 },
  [KIND_CRUSHER]: { hp: 120, speed: 48, radius: 30, damage: 20, score: 120 },
  [KIND_SPITTER]: { hp: 30, speed: 70, radius: 18, damage: 10, score: 80 },
  [KIND_LEVIATHAN]: { hp: 950, speed: 62, radius: 64, damage: 26, score: 5000 },
};

export function makeEnemy(kind, x, y, elite, depth) {
  const base = STATS[kind];
  const hpScale = 1 + (depth - 1) * 0.22 + (elite ? 1.6 : 0);
  const hp = Math.round(base.hp * hpScale);
  return {
    id: nextId++,
    kind,
    x, y,
    vx: 0, vy: 0,
    angle: 0,
    hp, maxHp: hp,
    speed: base.speed * (elite ? 0.85 : 1),
    radius: base.radius * (elite ? 1.35 : 1),
    damage: base.damage + Math.floor((depth - 1) * 1.5) + (elite ? 8 : 0),
    score: base.score * (elite ? 5 : 1),
    elite,
    flash: 0,
    shootTimer: 2 + Math.random() * 2,
    lungeTimer: 1.5,
    attackTimer: 3,
    wobble: Math.random() * Math.PI * 2,
    dead: false,
  };
}

/** Which kinds may spawn at this depth, weighted toward the trench's mood. */
export function pickKind(random, depth) {
  const roll = random.next();
  if (depth >= 4 && roll < 0.14) return KIND_CRUSHER;
  if (depth >= 3 && roll < 0.36) return KIND_SPITTER;
  if (roll < 0.62) return KIND_GULPER;
  return KIND_DARTER;
}

/**
 * Steer one foe for a step. `enemyShots` receives spitter globs and Leviathan
 * rings; `spawn` is a callback(kind, x, y) the boss uses to summon darters.
 */
export function updateEnemy(enemy, player, dt, time, enemyShots, spawn, random) {
  enemy.flash = Math.max(0, enemy.flash - dt * 6);
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;
  enemy.angle = Math.atan2(dy, dx);

  if (enemy.kind === KIND_GULPER) {
    const wob = Math.sin(time * 2.2 + enemy.wobble) * 0.5;
    enemy.vx = (nx - ny * wob * 0.4) * enemy.speed;
    enemy.vy = (ny + nx * wob * 0.4) * enemy.speed;
  } else if (enemy.kind === KIND_DARTER) {
    enemy.lungeTimer -= dt;
    if (enemy.lungeTimer <= 0) {
      enemy.lungeTimer = 1.6 + random.next() * 1.2;
      enemy.vx = nx * enemy.speed * 2.1;
      enemy.vy = ny * enemy.speed * 2.1;
    } else {
      enemy.vx *= 1 - Math.min(1, dt * 3);
      enemy.vy *= 1 - Math.min(1, dt * 3);
      enemy.vx += nx * enemy.speed * 0.25 * dt * 10;
      enemy.vy += ny * enemy.speed * 0.25 * dt * 10;
    }
  } else if (enemy.kind === KIND_CRUSHER) {
    enemy.vx = nx * enemy.speed;
    enemy.vy = ny * enemy.speed;
  } else if (enemy.kind === KIND_SPITTER) {
    // Holds a ring around the player and fires globs.
    const want = 260;
    const radial = dist < want - 40 ? -1 : dist > want + 40 ? 1 : 0;
    const orbit = 0.6;
    enemy.vx = (nx * radial - ny * orbit) * enemy.speed;
    enemy.vy = (ny * radial + nx * orbit) * enemy.speed;
    enemy.shootTimer -= dt;
    if (enemy.shootTimer <= 0 && dist < 560) {
      enemy.shootTimer = 2.4 + random.next();
      enemyShots.push({
        x: enemy.x, y: enemy.y,
        vx: nx * 210, vy: ny * 210,
        damage: enemy.damage, radius: 8, life: 3.5,
      });
    }
  } else if (enemy.kind === KIND_LEVIATHAN) {
    enemy.attackTimer -= dt;
    if (enemy.attackTimer <= 0) {
      enemy.attackTimer = 4 + random.next() * 2;
      const mode = random.next();
      if (mode < 0.45) {
        // Charge straight at the sub.
        enemy.vx = nx * enemy.speed * 4.2;
        enemy.vy = ny * enemy.speed * 4.2;
      } else if (mode < 0.8) {
        // A ring of globs.
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          enemyShots.push({
            x: enemy.x, y: enemy.y,
            vx: Math.cos(a) * 170, vy: Math.sin(a) * 170,
            damage: 14, radius: 9, life: 4,
          });
        }
      } else {
        // Summon darters.
        for (let i = 0; i < 3; i++) {
          spawn(KIND_DARTER, enemy.x + random.range(-90, 90), enemy.y + random.range(-90, 90));
        }
      }
    } else {
      const drift = Math.sin(time * 0.9 + enemy.wobble) * 0.4;
      enemy.vx += ((nx - ny * drift) * enemy.speed - enemy.vx) * Math.min(1, dt * 1.5);
      enemy.vy += ((ny + nx * drift) * enemy.speed - enemy.vy) * Math.min(1, dt * 1.5);
    }
  }

  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
  enemy.x = Math.min(VIEW_W - enemy.radius, Math.max(enemy.radius, enemy.x));
  enemy.y = Math.min(VIEW_H - enemy.radius, Math.max(enemy.radius, enemy.y));
}

/** Apply damage; returns true when the foe died. */
export function damageEnemy(enemy, amount) {
  enemy.hp -= amount;
  enemy.flash = 1;
  if (enemy.hp <= 0) {
    enemy.dead = true;
    return true;
  }
  return false;
}
