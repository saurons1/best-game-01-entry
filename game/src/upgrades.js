// HADAL DIVE — the level-up draft.
// On every level the dive pauses and three upgrade cards are dealt; the player
// picks one (click, or keys 1/2/3). Each upgrade is a small permanent change with
// a name, a plain description and a cap, so a build takes shape across a run.
export const UPGRADES = {
  harpoonDamage: { name: 'Barbed Harpoons', desc: '+6 harpoon damage', max: 5, apply: (p) => { p.damage += 6; } },
  fireRate: { name: 'Rapid Winch', desc: '+14% fire rate', max: 5, apply: (p) => { p.fireInterval *= 0.88; } },
  multishot: { name: 'Twin Harpoons', desc: '+1 harpoon per shot', max: 3, apply: (p) => { p.multishot += 1; } },
  pierce: { name: 'Piercing Tips', desc: 'Harpoons pierce +1 foe', max: 3, apply: (p) => { p.pierce += 1; } },
  hullPlating: { name: 'Titanium Hull', desc: '+25 max hull, repair 25', max: 4, apply: (p) => { p.maxHull += 25; p.hull = Math.min(p.maxHull, p.hull + 25); } },
  thrusters: { name: 'Ion Thrusters', desc: '+12% move speed', max: 4, apply: (p) => { p.speed *= 1.12; } },
  magnet: { name: 'Plankton Lure', desc: '+55% pickup magnet range', max: 3, apply: (p) => { p.magnet *= 1.55; } },
  dashCool: { name: 'Pressure Jets', desc: 'Dash recharges 30% faster', max: 3, apply: (p) => { /* dash cooldown is read from config; store a multiplier on the player */ p.dashMult = (p.dashMult ?? 1) * 0.7; } },
};

/** Deal three distinct upgrades the player has not maxed out. */
export function rollDraft(random, player) {
  const taken = player.upgradesTaken ?? {};
  const pool = Object.keys(UPGRADES).filter((id) => (taken[id] ?? 0) < UPGRADES[id].max);
  const draft = [];
  while (draft.length < 3 && pool.length > 0) {
    const index = Math.floor(random.next() * pool.length);
    draft.push(pool.splice(index, 1)[0]);
  }
  return draft;
}

/** Apply a drafted upgrade and record it on the player. */
export function applyUpgrade(player, id) {
  const def = UPGRADES[id];
  if (!def) return false;
  player.upgradesTaken = player.upgradesTaken ?? {};
  if ((player.upgradesTaken[id] ?? 0) >= def.max) return false;
  def.apply(player);
  player.upgradesTaken[id] = (player.upgradesTaken[id] ?? 0) + 1;
  return true;
}
