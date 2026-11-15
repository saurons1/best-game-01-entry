// HADAL DIVE — the bathyscaphe.
// Movement, dash, aiming and harpoon fire live here. The world owns the arrays the
// player shoots into; this file only moves the sub and fills those arrays.
import { PLAYER, VIEW_W, VIEW_H } from './config.js';

/** A fresh bathyscaphe in the middle of the trench. */
export function createPlayer() {
  return {
    x: VIEW_W / 2,
    y: VIEW_H / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    hull: PLAYER.maxHull,
    maxHull: PLAYER.maxHull,
    speed: PLAYER.speed,
    fireInterval: PLAYER.fireInterval,
    fireTimer: 0,
    damage: PLAYER.harpoonDamage,
    multishot: 1,
    pierce: 0,
    magnet: PLAYER.magnet,
    dashTimer: 0,
    dashCooldown: 0,
    dashX: 0,
    dashY: 0,
    invuln: 0,
    radius: PLAYER.radius,
    shotsFired: 0,
    thrust: 0,
  };
}

/**
 * Advance the player one step. `harpoons` receives new harpoons, `fx` gets
 * { shake, flash } nudges on dash. Returns true when a harpoon was fired.
 */
export function updatePlayer(player, ctrl, dt, harpoons, sfx) {
  player.invuln = Math.max(0, player.invuln - dt);
  player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  player.fireTimer -= dt;

  // Aim follows the mouse; the harpoon leaves from the bow.
  player.angle = Math.atan2(ctrl.aimY - player.y, ctrl.aimX - player.x);

  if (ctrl.dash && player.dashCooldown <= 0 && player.dashTimer <= 0) {
    const dx = ctrl.x;
    const dy = ctrl.y;
    const len = Math.hypot(dx, dy);
    const ax = len > 0.01 ? dx / len : Math.cos(player.angle);
    const ay = len > 0.01 ? dy / len : Math.sin(player.angle);
    player.dashX = ax;
    player.dashY = ay;
    player.dashTimer = PLAYER.dashTime;
    player.dashCooldown = PLAYER.dashCooldown * (player.dashMult ?? 1);
    player.invuln = Math.max(player.invuln, 0.25);
    if (sfx) sfx.dash?.();
  }

  if (player.dashTimer > 0) {
    player.dashTimer -= dt;
    player.vx = player.dashX * PLAYER.dashSpeed;
    player.vy = player.dashY * PLAYER.dashSpeed;
  } else {
    const targetX = ctrl.x * player.speed;
    const targetY = ctrl.y * player.speed;
    const k = Math.min(1, dt * 10);
    player.vx += (targetX - player.vx) * k;
    player.vy += (targetY - player.vy) * k;
  }
  player.x = Math.min(VIEW_W - player.radius, Math.max(player.radius, player.x + player.vx * dt));
  player.y = Math.min(VIEW_H - player.radius, Math.max(player.radius, player.y + player.vy * dt));
  player.thrust = Math.min(1, Math.hypot(player.vx, player.vy) / player.speed);

  // Auto-fire: the harpoon gun never needs a trigger pull, only an aim.
  if (player.fireTimer <= 0) {
    player.fireTimer = player.fireInterval;
    const spread = 0.14;
    const count = player.multishot;
    for (let i = 0; i < count; i++) {
      const offset = count === 1 ? 0 : (i - (count - 1) / 2) * spread;
      const a = player.angle + offset;
      harpoons.push({
        x: player.x + Math.cos(a) * (player.radius + 6),
        y: player.y + Math.sin(a) * (player.radius + 6),
        vx: Math.cos(a) * PLAYER.harpoonSpeed,
        vy: Math.sin(a) * PLAYER.harpoonSpeed,
        damage: player.damage,
        pierce: player.pierce,
        life: PLAYER.harpoonLife,
        hitIds: new Set(),
      });
    }
    player.shotsFired += count;
    return true;
  }
  return false;
}

/** Damage the hull; returns true when the hit landed (not during invulnerability). */
export function damagePlayer(player, amount) {
  if (player.invuln > 0 || player.dashTimer > 0) return false;
  player.hull -= amount;
  player.invuln = PLAYER.invulnTime;
  return true;
}

export function healPlayer(player, amount) {
  player.hull = Math.min(player.maxHull, player.hull + amount);
}
