// HADAL DIVE — the renderer: every pixel the player sees.
// Canvas vector art only: the trench, the vents, the foes, the bathyscaphe, the
// HUD and every screen. Nothing is loaded from a file, so the game has no assets
// to fetch. The renderer never touches game logic; it paints a state.
import { VIEW_W, VIEW_H, COLORS, SCREENS, depthQuota, xpForLevel } from './config.js';
import { UPGRADES } from './upgrades.js';
import { KIND_GULPER, KIND_DARTER, KIND_CRUSHER, KIND_SPITTER, KIND_LEVIATHAN } from './enemies.js';

export { SCREENS };

/** Draft card rectangles, shared with the loop's click handling. */
export function draftCardRects() {
  const w = 300;
  const h = 210;
  const gap = 28;
  const total = w * 3 + gap * 2;
  const x0 = (VIEW_W - total) / 2;
  const y = 300;
  return [0, 1, 2].map((i) => ({ x: x0 + i * (w + gap), y, w, h }));
}

function bar(ctx, x, y, w, h, frac, fill, back) {
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
}

function circle(ctx, x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawVent(ctx, vent, time) {
  const pulse = 0.7 + Math.sin(time * 2 + vent.x) * 0.3;
  const grad = ctx.createRadialGradient(vent.x, vent.y, 4, vent.x, vent.y, vent.r * 1.4);
  grad.addColorStop(0, `rgba(255, 179, 71, ${0.55 * pulse})`);
  grad.addColorStop(1, 'rgba(255, 179, 71, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(vent.x, vent.y, vent.r * 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a2c14';
  ctx.beginPath();
  ctx.ellipse(vent.x, vent.y + 14, vent.r * 0.8, 16, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#ffb347';
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.35;
    const bx = vent.x + Math.cos(a) * vent.r * 0.45;
    const by = vent.y + Math.sin(a) * vent.r * 0.4 - Math.sin(time * 3 + i) * 6;
    circle(ctx, bx, by, 3.5, '#ffd76a');
  }
}

function drawEnemy(ctx, enemy, time) {
  const { x, y, radius: r } = enemy;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(enemy.angle);
  if (enemy.elite) {
    ctx.shadowColor = '#ff4fd8';
    ctx.shadowBlur = 22;
  }
  if (enemy.kind === KIND_GULPER) {
    ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : '#2b6cb0';
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : '#1d4e89';
    ctx.beginPath();
    ctx.moveTo(r * 0.55, -r * 0.45);
    ctx.lineTo(r * 1.25, 0);
    ctx.lineTo(r * 0.55, r * 0.45);
    ctx.closePath();
    ctx.fill();
    circle(ctx, r * 0.3, -r * 0.3, 4.5, '#4de8ff');
    ctx.fillStyle = '#0a1230';
    ctx.beginPath();
    ctx.arc(r * 0.72, 0, r * 0.34, -0.9, 0.9);
    ctx.lineTo(r * 0.72, 0);
    ctx.fill();
    ctx.fillStyle = '#dfe9ff';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(r * 0.95, i * 7);
      ctx.lineTo(r * 0.62, i * 7 + 4);
      ctx.lineTo(r * 0.62, i * 7 - 4);
      ctx.closePath();
      ctx.fill();
    }
  } else if (enemy.kind === KIND_DARTER) {
    ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : '#ff4fd8';
    ctx.beginPath();
    ctx.moveTo(r * 1.5, 0);
    ctx.lineTo(-r * 0.9, -r * 0.7);
    ctx.lineTo(-r * 0.4, 0);
    ctx.lineTo(-r * 0.9, r * 0.7);
    ctx.closePath();
    ctx.fill();
    circle(ctx, r * 0.5, -r * 0.18, 3.5, '#fff');
  } else if (enemy.kind === KIND_CRUSHER) {
    ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : '#5a4a8f';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 3;
    ctx.stroke();
    circle(ctx, r * 0.3, -r * 0.25, 5, '#ff5a6e');
    circle(ctx, r * 0.3, r * 0.25, 5, '#ff5a6e');
    ctx.fillStyle = '#dfe9ff';
    ctx.beginPath();
    ctx.moveTo(r * 0.9, -6);
    ctx.lineTo(r * 1.25, 0);
    ctx.lineTo(r * 0.9, 6);
    ctx.closePath();
    ctx.fill();
  } else if (enemy.kind === KIND_SPITTER) {
    ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : '#19c8b9';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4de8ff';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + time * 0.6;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
      ctx.lineTo(Math.cos(a) * (r + 9), Math.sin(a) * (r + 9));
      ctx.stroke();
    }
    circle(ctx, r * 0.35, -r * 0.2, 5, '#071230');
    circle(ctx, r * 0.35, r * 0.2, 5, '#071230');
    circle(ctx, r * 0.55, 0, 6, '#ff5a6e');
  } else if (enemy.kind === KIND_LEVIATHAN) {
    // A long segmented serpent: the tail trails behind the head's heading.
    ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : '#3d2a6e';
    for (let i = 5; i >= 1; i--) {
      const tx = -i * r * 0.85;
      const ty = Math.sin(time * 2.4 - i * 0.9) * 18;
      circle(ctx, tx, ty, r * (0.62 - i * 0.05), i % 2 ? '#3d2a6e' : '#2c1d52');
      circle(ctx, tx, ty - r * 0.3, 4, '#4de8ff');
    }
    ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : '#5a3d9e';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.25, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff4fd8';
    circle(ctx, r * 0.5, -r * 0.3, 8, '#ff4fd8');
    circle(ctx, r * 0.5, r * 0.3, 8, '#ff4fd8');
    ctx.fillStyle = '#0a1230';
    ctx.beginPath();
    ctx.ellipse(r * 0.95, 0, r * 0.42, r * 0.5, 0, -0.8, 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#dfe9ff';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(r * 1.3, i * 9);
      ctx.lineTo(r * 0.95, i * 9 + 5);
      ctx.lineTo(r * 0.95, i * 9 - 5);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
  if (enemy.elite) {
    ctx.fillStyle = '#ff4fd8';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ELITE', x, y - r - 14);
  }
  if (enemy.hp < enemy.maxHp) {
    bar(ctx, x - r, y - r - 10, r * 2, 4, enemy.hp / enemy.maxHp, enemy.elite ? '#ff4fd8' : '#ff5a6e', 'rgba(0,0,0,0.5)');
  }
}

function drawPlayer(ctx, player, time) {
  ctx.save();
  ctx.translate(player.x, player.y);
  if (player.invuln > 0 && Math.floor(time * 14) % 2 === 0) ctx.globalAlpha = 0.45;
  // Searchlight cone toward the aim.
  ctx.save();
  ctx.rotate(player.angle);
  const beam = ctx.createLinearGradient(0, 0, 320, 0);
  beam.addColorStop(0, 'rgba(255, 240, 180, 0.28)');
  beam.addColorStop(1, 'rgba(255, 240, 180, 0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(320, -52);
  ctx.lineTo(320, 52);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Thruster bubbles.
  if (player.thrust > 0.2) {
    for (let i = 0; i < 3; i++) {
      const bx = -Math.cos(player.angle) * 30 - player.vx * 0.05 + ((i * 37 + Math.floor(time * 30)) % 40) - 20;
      const by = -Math.sin(player.angle) * 30 + Math.sin(time * 9 + i * 2) * 8;
      circle(ctx, bx, by, 2.5, 'rgba(125, 255, 212, 0.7)');
    }
  }
  ctx.rotate(player.angle);
  ctx.shadowColor = '#4de8ff';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#dfe9ff';
  ctx.beginPath();
  ctx.ellipse(0, 0, 30, 19, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#5a6b8f';
  ctx.beginPath();
  ctx.ellipse(-4, 0, 20, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  // Glass dome with a glowing pilot light.
  ctx.fillStyle = '#9fe8ff';
  ctx.beginPath();
  ctx.arc(8, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  circle(ctx, 8, 0, 4, '#0a1230');
  // Harpoon gun on the bow.
  ctx.fillStyle = '#ffb347';
  ctx.fillRect(26, -3, 14, 6);
  // Tail fins.
  ctx.fillStyle = '#ffb347';
  ctx.beginPath();
  ctx.moveTo(-26, -6);
  ctx.lineTo(-38, -16);
  ctx.lineTo(-34, 0);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-26, 6);
  ctx.lineTo(-38, 16);
  ctx.lineTo(-34, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawHud(ctx, state, screen, best) {
  const p = state.player;
  // Top bar.
  ctx.fillStyle = 'rgba(3, 8, 31, 0.72)';
  ctx.fillRect(0, 0, VIEW_W, 64);
  ctx.fillStyle = '#dfe9ff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('HADAL DIVE', 20, 28);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#4de8ff';
  ctx.fillText(`DEPTH ${state.depth} / ${10}   •   ${1200 + state.depth * 900}m`, 20, 50);
  // Hull bar.
  ctx.fillStyle = '#dfe9ff';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('HULL', 300, 28);
  bar(ctx, 355, 14, 220, 18, p.hull / p.maxHull, p.hull / p.maxHull > 0.3 ? '#19c8b9' : '#ff5a6e', '#123');
  ctx.fillStyle = '#dfe9ff';
  ctx.font = '15px sans-serif';
  ctx.fillText(`${Math.ceil(p.hull)} / ${p.maxHull}`, 585, 28);
  // Score, kills, level.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`SCORE ${state.score}`, 800, 30);
  ctx.fillStyle = '#dfe9ff';
  ctx.font = '15px sans-serif';
  ctx.fillText(`KILLS ${state.kills}    LV ${state.level}    BEST ${best ?? 0}`, 800, 52);
  // Dash cooldown.
  const dashFrac = 1 - p.dashCooldown / (2.4 * (p.dashMult ?? 1));
  ctx.textAlign = 'right';
  ctx.fillStyle = dashFrac >= 1 ? '#7dffd4' : '#8fa3c8';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(dashFrac >= 1 ? 'DASH READY [SPACE]' : 'DASH …', 1255, 28);
  bar(ctx, 1100, 36, 155, 8, dashFrac, '#7dffd4', '#123');
  // Boss bar — only while the fight is live, never over an end screen.
  if (state.boss && !state.boss.dead && screen !== SCREENS.OVER && screen !== SCREENS.VICTORY) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff4fd8';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('THE TRENCH LEVIATHAN', VIEW_W / 2, 92);
    bar(ctx, VIEW_W / 2 - 260, 100, 520, 12, state.boss.hp / state.boss.maxHp, '#ff4fd8', '#123');
  }
  // Depth progress + XP bar along the bottom.
  ctx.fillStyle = 'rgba(3, 8, 31, 0.72)';
  ctx.fillRect(0, VIEW_H - 46, VIEW_W, 46);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#dfe9ff';
  ctx.font = '15px sans-serif';
  const quota = state.depth < 10 ? depthQuota(state.depth) : state.kills;
  ctx.fillText(`DEPTH KILLS ${state.depthKills} / ${state.depth < 10 ? quota : '—'}`, 20, VIEW_H - 17);
  ctx.fillText('XP', 300, VIEW_H - 17);
  bar(ctx, 330, VIEW_H - 30, 420, 14, state.xp / state.xpNext, '#7dffd4', '#123');
  ctx.fillText(`LV ${state.level}   ${state.xp} / ${state.xpNext} XP`, 760, VIEW_H - 17);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#8fa3c8';
  ctx.fillText('WASD move  •  mouse aim  •  SPACE dash', VIEW_W - 20, VIEW_H - 17);
  // Banner.
  if (state.bannerTime > 0 && state.banner) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, state.bannerTime);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText(state.banner, VIEW_W / 2, 190);
    ctx.restore();
  }
  if (screen === SCREENS.PAUSED) {
    ctx.fillStyle = 'rgba(3, 8, 31, 0.7)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#dfe9ff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText('PAUSED', VIEW_W / 2, VIEW_H / 2 - 10);
    ctx.font = '20px sans-serif';
    ctx.fillText('Press P or click to keep diving', VIEW_W / 2, VIEW_H / 2 + 30);
  }
}

function drawDraft(ctx, state) {
  ctx.fillStyle = 'rgba(3, 8, 31, 0.82)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText(`LEVEL ${state.level} — CHOOSE AN UPGRADE`, VIEW_W / 2, 210);
  ctx.fillStyle = '#dfe9ff';
  ctx.font = '20px sans-serif';
  ctx.fillText('Click a card, or press 1 / 2 / 3', VIEW_W / 2, 248);
  const rects = draftCardRects();
  state.draft.forEach((id, i) => {
    const def = UPGRADES[id];
    const r = rects[i];
    ctx.fillStyle = '#0d1a3d';
    ctx.strokeStyle = '#4de8ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#4de8ff';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`[ ${i + 1} ]`, r.x + r.w / 2, r.y + 36);
    ctx.fillStyle = '#dfe9ff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(def.name, r.x + r.w / 2, r.y + 82);
    ctx.fillStyle = '#7dffd4';
    ctx.font = '19px sans-serif';
    ctx.fillText(def.desc, r.x + r.w / 2, r.y + 122);
    const taken = (state.player.upgradesTaken?.[id] ?? 0) + 1;
    ctx.fillStyle = '#8fa3c8';
    ctx.font = '15px sans-serif';
    ctx.fillText(`Rank ${taken} / ${def.max}`, r.x + r.w / 2, r.y + 168);
  });
}

function drawTitle(ctx, state, best) {
  const time = state.time;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#4de8ff';
  ctx.font = 'bold 92px sans-serif';
  ctx.shadowColor = '#19c8b9';
  ctx.shadowBlur = 30;
  ctx.fillText('HADAL DIVE', VIEW_W / 2, 240);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('SURVIVE THE TRENCH  •  SLAY THE LEVIATHAN', VIEW_W / 2, 292);
  ctx.fillStyle = '#dfe9ff';
  ctx.font = '21px sans-serif';
  ctx.fillText('Pilot your bathyscaphe through 10 depths of the hadal trench.', VIEW_W / 2, 350);
  ctx.fillText('Gulpers chase. Darters lunge. Crushers endure. Spitters fire back.', VIEW_W / 2, 382);
  ctx.fillText('Gather glow-plankton, draft upgrades, rest at amber thermal vents.', VIEW_W / 2, 414);
  ctx.fillStyle = '#7dffd4';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('WASD move   •   MOUSE aim   •   HARPOON auto-fires   •   SPACE dash', VIEW_W / 2, 480);
  const blink = 0.6 + Math.sin(time * 4) * 0.4;
  ctx.fillStyle = `rgba(255, 215, 106, ${blink})`;
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('PRESS ENTER OR CLICK TO DIVE', VIEW_W / 2, 550);
  ctx.fillStyle = '#8fa3c8';
  ctx.font = '17px sans-serif';
  ctx.fillText(`BEST SCORE ${best}    •    DEPTH 10 HOLDS THE LEVIATHAN    •    P PAUSE    •    M MUTE`, VIEW_W / 2, 610);
}

function drawEnd(ctx, state, victory, best) {
  ctx.fillStyle = 'rgba(3, 8, 31, 0.78)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = victory ? '#7dffd4' : '#ff5a6e';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(victory ? 'LEVIATHAN SLAIN!' : 'HULL BREACHED', VIEW_W / 2, 230);
  ctx.fillStyle = '#dfe9ff';
  ctx.font = '24px sans-serif';
  ctx.fillText(
    victory ? 'The trench is yours. The bathyscaphe surfaces into the light.' : 'The trench keeps its secrets — and your bathyscaphe.',
    VIEW_W / 2, 282,
  );
  const rows = [
    ['FINAL SCORE', String(state.score)],
    ['BEST SCORE', String(Math.max(best, state.score))],
    ['DEPTH REACHED', `${state.depth} / 10`],
    ['FOES SLAIN', String(state.kills)],
    ['LEVEL', String(state.level)],
    ['HARPOONS FIRED', String(state.stats.shotsFired)],
    ['HITS', String(state.stats.hits)],
    ['PICKUPS', String(state.stats.pickups)],
  ];
  ctx.font = 'bold 22px sans-serif';
  rows.forEach(([label, value], i) => {
    const y = 340 + i * 34;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#8fa3c8';
    ctx.fillText(label, VIEW_W / 2 - 20, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd76a';
    ctx.fillText(value, VIEW_W / 2 + 20, y);
  });
  const blink = 0.6 + Math.sin(state.time * 4) * 0.4;
  ctx.fillStyle = `rgba(255, 215, 106, ${blink})`;
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PRESS ENTER OR CLICK TO DIVE AGAIN', VIEW_W / 2, 640);
}

export function createRenderer(canvas) {
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  const ctx = canvas.getContext('2d');

  function drawBackground(state) {
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, COLORS.waterTop);
    grad.addColorStop(0.55, COLORS.waterMid);
    grad.addColorStop(1, COLORS.waterDeep);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // Rock silhouettes along the floor.
    ctx.fillStyle = '#0a0f26';
    ctx.beginPath();
    ctx.moveTo(0, VIEW_H);
    for (let x = 0; x <= VIEW_W; x += 80) {
      ctx.lineTo(x, VIEW_H - 26 - Math.abs(Math.sin(x * 0.013 + 2)) * 34);
    }
    ctx.lineTo(VIEW_W, VIEW_H);
    ctx.closePath();
    ctx.fill();
    // Drifting plankton motes.
    for (const mote of state.motes) {
      ctx.fillStyle = `rgba(125, 255, 212, ${0.25 + 0.2 * Math.sin(state.time + mote.p)})`;
      circle(ctx, mote.x, mote.y, mote.r, ctx.fillStyle);
    }
  }

  function draw(state, screen, best) {
    ctx.save();
    if (state.shake > 0) {
      ctx.translate((Math.random() - 0.5) * state.shake * 14, (Math.random() - 0.5) * state.shake * 14);
    }
    drawBackground(state);
    for (const vent of state.vents) drawVent(ctx, vent, state.time);
    // Pickups.
    for (const pk of state.pickups) {
      const blink = pk.life < 3 ? (Math.floor(pk.life * 6) % 2 === 0 ? 0.3 : 1) : 1;
      ctx.save();
      ctx.globalAlpha = blink;
      if (pk.kind === 'xp') {
        ctx.shadowColor = '#7dffd4';
        ctx.shadowBlur = 12;
        circle(ctx, pk.x, pk.y, 6, '#7dffd4');
      } else {
        ctx.shadowColor = '#19c8b9';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#19c8b9';
        ctx.fillRect(pk.x - 8, pk.y - 8, 16, 16);
        ctx.fillStyle = '#071230';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('+', pk.x, pk.y + 5);
      }
      ctx.restore();
    }
    // Harpoons.
    ctx.strokeStyle = '#bfe9ff';
    ctx.lineWidth = 3;
    for (const h of state.harpoons) {
      ctx.beginPath();
      ctx.moveTo(h.x - h.vx * 0.02, h.y - h.vy * 0.02);
      ctx.lineTo(h.x, h.y);
      ctx.stroke();
      circle(ctx, h.x, h.y, 3, '#ffd76a');
    }
    // Enemy globs.
    for (const s of state.enemyShots) {
      ctx.shadowColor = '#ff5a6e';
      ctx.shadowBlur = 10;
      circle(ctx, s.x, s.y, s.radius, '#ff5a6e');
      ctx.shadowBlur = 0;
    }
    for (const enemy of state.enemies) drawEnemy(ctx, enemy, state.time);
    if (screen !== SCREENS.OVER) drawPlayer(ctx, state.player, state.time);
    // Particles.
    for (const pt of state.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      circle(ctx, pt.x, pt.y, pt.r, pt.color);
      ctx.restore();
    }
    // Floating score popups.
    ctx.textAlign = 'center';
    ctx.font = 'bold 17px sans-serif';
    for (const pp of state.popups) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, pp.life / 0.5);
      ctx.fillStyle = pp.color;
      ctx.fillText(pp.text, pp.x, pp.y);
      ctx.restore();
    }
    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255, 90, 110, ${state.flash * 0.22})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    ctx.restore();

    if (screen === SCREENS.TITLE) {
      ctx.fillStyle = 'rgba(3, 8, 31, 0.45)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      drawTitle(ctx, state, best);
    } else if (screen === SCREENS.DRAFT) {
      drawHud(ctx, state, screen, best);
      drawDraft(ctx, state);
    } else if (screen === SCREENS.OVER) {
      drawHud(ctx, state, screen, best);
      drawEnd(ctx, state, false, best);
    } else if (screen === SCREENS.VICTORY) {
      drawHud(ctx, state, screen, best);
      drawEnd(ctx, state, true, best);
    } else {
      drawHud(ctx, state, screen, best);
    }
  }

  return { draw };
}
