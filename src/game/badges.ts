import { ABILITIES, type WorldObject } from "../world";
import type { Save } from "./save";

/** Field abilities and native badge bits share a permanent one-to-one identity. */
export function badgeMask(save: Pick<Save, "abilities">) {
  return ABILITIES.reduce((bits, ability, i) =>
    save.abilities.includes(ability) ? bits | (1 << i) : bits, 0);
}

export function awardBadge(save: Save, badge: number) {
  const ability = ABILITIES[badge - 1];
  if (!save.abilities.includes(ability)) save.abilities.push(ability);
  save.badges = save.abilities.length;
}

const shoreAces = [29, 36, 42];

export function fieldTeam(object: WorldObject, badges: number) {
  const team = object.trainer!.team;
  const keeper = object.reward?.badge;
  const ace = shoreAces[Math.min(2, Math.max(0, badges - 3))];
  if (keeper && keeper >= 4 && keeper <= 6) {
    const adjustment = ace - Math.max(...team.map(m => m.level));
    return team.map(m => ({ ...m, level: m.level + adjustment }));
  }
  // These roads and sanctuaries can be reached by sea before the usual climb.
  if (/route(?:1[0-5]|2[23])|^(?:ember|frostvault|bamboo)_guardian|^rival_3$/.test(object.id))
    return team.map(m => ({ ...m, level: Math.min(m.level, ace - 2) }));
  return team;
}
