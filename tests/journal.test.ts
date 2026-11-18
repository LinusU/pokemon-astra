import { expect, it } from "vitest";
import { WORLD, type Requirement } from "../src/world";
import { campaignObjective, directions, routeTo } from "../src/game/journal";
import { awardBadge, badgeMask, fieldTeam } from "../src/game/badges";
import { freshSave, meetsRequirement } from "../src/game/save";

it("guides a fresh survey along open exits to every prerequisite in campaign order", () => {
  const s = freshSave();
  const permitted = (r?: Requirement) =>
    !r ||
    ((r.flags || []).every((f) => s.flags.includes(f)) &&
      (r.badges || 0) <= s.badges &&
      (!r.ability || s.abilities.includes(r.ability)) &&
      (r.caught || 0) <= s.caught.length);
  for (let step = 0; step < 130; step++) {
    const goal = campaignObjective(s);
    if (!goal) break;
    if (goal.object.id === "quest_atlas") {
      expect(directions(s, permitted).hint).toContain("Pokédex");
      s.caught = Array.from({ length: 251 }, (_, i) => i + 1);
    }
    const way = directions(s, permitted);
    expect(way.marker || way.fly, goal.title).toBeDefined();
    if (s.map !== goal.map.id) {
      const path = routeTo(s.map, goal.map.id, permitted);
      expect(path.at(-1)?.to, goal.object.id).toBe(goal.map.id);
      expect(path.every((e) => permitted(e.requires))).toBe(true);
    }
    s.map = goal.map.id;
    expect(permitted(goal.object.requires), goal.object.id).toBe(true);
    s.flags.push(goal.object.setsFlag!);
    if (goal.object.reward?.badge) s.badges = goal.object.reward.badge;
    if (goal.object.reward?.ability)
      s.abilities.push(goal.object.reward.ability);
  }
  expect(s.badges).toBe(8);
  expect(s.flags).toContain("champion");
  expect(s.flags).toContain("quest_atlas_complete");
  expect(campaignObjective(s)).toBeUndefined();
  expect(WORLD[s.map].kind).toBe("dungeon");
});


it.each(["456", "465", "546", "564", "645", "654"])("can survey the three shores in order %s", order => {
  const save = freshSave();
  const has = (req?: Requirement) => meetsRequirement(save, req);
  const earned: number[] = [];
  for (let i = 0; i < 110 && !save.flags.includes("champion"); i++) {
    if (save.badges >= 3 && save.badges < 6) save.survey = Number(order[save.badges - 3]);
    const goal = campaignObjective(save)!;
    if (save.map !== goal.map.id)
      expect(routeTo(save.map, goal.map.id, has).at(-1)?.to, goal.title).toBe(goal.map.id);
    expect(has(goal.object.requires), goal.title).toBe(true);
    save.map = goal.map.id;
    const badge = goal.object.reward?.badge;
    if (badge) {
      if (save.badges >= 3 && save.badges < 6)
        expect(fieldTeam(goal.object, save).at(-1)?.level).toBe([29, 36, 42][save.badges - 3]);
      awardBadge(save, badge);
      awardBadge(save, badge);
      earned.push(badge);
      expect(save.badges).toBe(earned.length);
      expect(badgeMask(save)).toBe(earned.reduce((bits, id) => bits | (1 << (id - 1)), 0));
    }
    save.flags.push(goal.object.setsFlag!);
  }
  expect(earned.join("")).toBe("123" + order + "78");
  expect(save.flags).toContain("champion");
});
