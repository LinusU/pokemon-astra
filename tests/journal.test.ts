import { expect, it } from "vitest";
import { WORLD, type Requirement } from "../src/world";
import { campaignObjective, directions, routeTo } from "../src/game/journal";
import { freshSave } from "../src/game/save";

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
