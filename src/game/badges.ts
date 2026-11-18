import { ABILITIES, type WorldMap, type WorldObject } from "../world";
import type { Save } from "./save";

/** Field abilities and native badge bits share a permanent one-to-one identity. */
export function badgeMask(save: Pick<Save, "abilities">) {
  return ABILITIES.reduce(
    (bits, ability, i) => (save.abilities.includes(ability) ? bits | (1 << i) : bits),
    0,
  );
}

export function awardBadge(save: Save, badge: number) {
  const ability = ABILITIES[badge - 1];
  if (!save.abilities.includes(ability)) save.abilities.push(ability);
  save.badges = save.abilities.length;
}

const shoreAces = [29, 36, 42];

type Survey = Pick<Save, "badges" | "abilities">;

function shoreOf(id: string) {
  if (/route0[89]|^hourglass_|^leader_4$|^gym4_/.test(id)) return 4;
  if (/route1[23]|^ember_|^rival_3$|^leader_5$|^gym5_/.test(id)) return 5;
  if (/route1[45]|^frostvault_|^leader_6$|^gym6_/.test(id)) return 6;
}

/** Keep a completed survey at the tier in which its keeper was challenged. */
function shoreAdjustment(shore: number, save: Survey) {
  const earnedAt = save.abilities.indexOf(ABILITIES[shore - 1]);
  const count = earnedAt < 0 ? save.badges : earnedAt;
  return shoreAces[Math.min(2, Math.max(0, count - 3))] - shoreAces[shore - 4];
}

export function fieldTeam(object: WorldObject, save: Survey) {
  const team = object.trainer!.team;
  const shore = shoreOf(object.id);
  if (shore) {
    const change = shoreAdjustment(shore, save);
    return team.map((m) => ({ ...m, level: Math.max(1, m.level + change) }));
  }
  if (object.id === "trainer_route21")
    return team.map((m) => ({ ...m, level: Math.min(m.level, 10 + 5 * save.badges) }));
  if (/route(?:1[01]|2[23])|^bamboo_guardian/.test(object.id)) {
    const ace = shoreAces[Math.min(2, Math.max(0, save.badges - 3))];
    return team.map((m) => ({ ...m, level: Math.min(m.level, ace - 2) }));
  }
  return team;
}

/** Encounter previews, fishing and actual wild battles use the same levels. */
export function fieldHabitats(map: WorldMap, save: Survey) {
  const shore = shoreOf(map.id);
  if (shore) {
    const change = shoreAdjustment(shore, save);
    return map.encounters.map((e) => ({
      ...e,
      minLevel: e.minLevel + change,
      maxLevel: e.maxLevel + change,
    }));
  }
  if (save.badges >= 5 || !/^route(?:1[01]|2[23])$/.test(map.id)) return map.encounters;
  const cap = save.badges <= 3 ? 26 : 32;
  return map.encounters.map((e) => ({
    ...e,
    minLevel: Math.min(e.minLevel, cap - 2),
    maxLevel: Math.min(e.maxLevel, cap),
  }));
}
