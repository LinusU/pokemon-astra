import { describe, expect, it } from "vitest";
import { WORLD, QUESTS, ABILITIES, type Requirement } from "../src/world";

const maps = Object.values(WORLD);
function can(
  req: Requirement | undefined,
  flags: Set<string>,
  badges: number,
  caught = 251,
) {
  return (
    !req ||
    ((req.flags ?? []).every((f) => flags.has(f)) &&
      badges >= (req.badges ?? 0) &&
      (!req.ability || ABILITIES.indexOf(req.ability) < badges) &&
      caught >= (req.caught ?? 0))
  );
}
describe("authored region", () => {
  it("has the promised areas and all 251 species in reachable habitats", () => {
    expect(maps.filter((m) => m.kind === "town")).toHaveLength(12);
    expect(maps.filter((m) => m.kind === "route")).toHaveLength(25);
    expect(maps.filter((m) => m.kind === "dungeon")).toHaveLength(36);
    expect(maps.filter((m) => m.kind === "gym")).toHaveLength(8);
    const species = new Set(
      maps.flatMap((m) => [
        ...m.encounters.map((e) => e.species),
        ...m.objects
          .filter((o) => o.kind === "legendary")
          .flatMap((o) => o.trainer?.team.map((p) => p.species) ?? []),
      ]),
    );
    expect(
      maps
        .flatMap((m) => m.encounters)
        .some((e) =>
          [144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251].includes(
            e.species,
          ),
        ),
    ).toBe(false);
    expect([...Array(251)].every((_, i) => species.has(i + 1))).toBe(true);
    expect(QUESTS).toHaveLength(16);
  });
  it("has valid, mutually connected and physically reachable exits and objects", () => {
    for (const m of maps) {
      expect(m.tiles).toHaveLength(m.height);
      expect(m.tiles.every((row) => row.length === m.width)).toBe(true);
      const start = m.exits[0];
      expect(start, m.id).toBeDefined();
      const visited = new Set<string>();
      const queue: [[number, number], ...[number, number][]] = [
        [start.x, start.y],
      ];
      while (queue.length) {
        const [x, y] = queue.shift()!;
        const key = `${x},${y}`;
        if (
          visited.has(key) ||
          x < 0 ||
          y < 0 ||
          x >= m.width ||
          y >= m.height ||
          "#rw~BCPTS".includes(m.tiles[y][x])
        )
          continue;
        visited.add(key);
        queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
      for (const exit of m.exits) {
        expect(
          visited.has(`${exit.x},${exit.y}`),
          `${m.id} exit ${exit.label}`,
        ).toBe(true);
        expect(WORLD[exit.to], exit.to).toBeDefined();
        expect(
          WORLD[exit.to].exits.some(
            (e) => e.to === m.id && e.x === exit.toX && e.y === exit.toY,
          ),
          `${m.id}->${exit.to}`,
        ).toBe(true);
      }
      for (const o of m.objects)
        expect(visited.has(`${o.x},${o.y}`), `${m.id} object ${o.id}`).toBe(
          true,
        );
    }
  });
  it("includes the campaign narrative and victory acknowledgements", () => {
    for (const id of [
      "lantern",
      "undertow",
      "copperworks",
      "hourglass",
      "bamboo",
      "ember",
      "frostvault",
      "echo",
      "meridian",
      "starfall",
      "victory",
      "aurora",
    ]) {
      const objective = WORLD[`${id}_3`].objects.find(
        (o) => o.id === `${id}_objective`,
      )!;
      expect(objective.dialogue.split(/\s+/).length).toBeGreaterThan(15);
    }
    for (let i = 1; i <= 8; i++)
      expect(
        WORLD[`gym${i}`].objects.find((o) => o.kind === "leader")
          ?.victoryDialogue,
      ).toBeTruthy();
    expect(
      WORLD.league.objects.find((o) => o.id === "league_4")?.victoryDialogue,
    ).toContain("Hall of Fame");
    for (const m of maps.filter((m) => m.kind === "town"))
      expect(
        m.objects.filter((o) => o.id.startsWith(`resident_${m.id}_`)),
      ).toHaveLength(2);
  });
  it("provides evolution items in the region", () => {
    const items = new Set(
      maps.flatMap((m) =>
        m.objects.flatMap((o) => [
          ...(o.reward?.item ? [o.reward.item] : []),
          ...(o.reward?.items ?? []).map((r) => r.item),
        ]),
      ),
    );
    for (const item of [
      "fire_stone",
      "water_stone",
      "thunder_stone",
      "leaf_stone",
      "moon_stone",
      "sun_stone",
      "metal_coat",
      "kings_rock",
      "dragon_scale",
      "up_grade",
      "link_cable",
    ])
      expect(items.has(item), item).toBe(true);
    expect(WORLD.lab.exits[0]).toMatchObject({ x: 12, y: 14 });
    expect(WORLD.lab.objects.find((o) => o.id === "alder")).toMatchObject({
      x: 12,
      y: 4,
    });
  });
  it("keeps named quest objectives and ordered mechanisms persistent", () => {
    const objects = maps.flatMap((m) => m.objects);
    expect(new Set(objects.map((o) => o.id)).size).toBe(objects.length);
    expect(
      objects.find((o) => o.id === "parcel_recipient")?.requires?.flags,
    ).toContain("found_parcel");
    expect(
      objects.find((o) => o.id === "quest_collector")?.requires?.flags,
    ).toEqual(["found_part_a", "found_part_b", "found_part_c"]);
    expect(
      objects.find((o) => o.id === "quest_pollinators")?.requires?.types,
    ).toEqual([{ type: "bug", count: 3 }]);
    for (const id of [
      "lantern",
      "undertow",
      "copperworks",
      "hourglass",
      "bamboo",
      "ember",
      "frostvault",
      "echo",
      "meridian",
      "starfall",
      "victory",
      "aurora",
    ]) {
      expect(
        objects.find((o) => o.id === `${id}_step2`)?.requires?.flags,
      ).toContain(`${id}_step1`);
      expect(
        objects.find((o) => o.id === `${id}_mechanism`)?.requires?.flags,
      ).toContain(`${id}_step2`);
    }
  });
  it("keeps field shortcuts and story gates locked until their prerequisites", () => {
    const exit = (from: string, to: string) =>
      WORLD[from].exits.find((e) => e.to === to)!;
    expect(exit("dewdrop", "route01").requires?.flags).toContain("partner");
    expect(exit("bramble", "route04").requires?.badges).toBe(1);
    expect(exit("dewdrop", "route21").requires?.ability).toBe("cut");
    expect(exit("tideglass", "route22").requires?.ability).toBe("surf");
    expect(exit("mossford", "route23").requires?.ability).toBe("strength");
    expect(exit("tideglass", "route24").requires?.ability).toBe("whirlpool");
    expect(exit("dewdrop", "route25").requires?.flags).toContain("champion");
    expect(
      WORLD.starfall_3.objects.find((o) => o.id === "celestial_engine")
        ?.requires?.badges,
    ).toBe(8);
    expect(
      WORLD.gym8.objects.find((o) => o.kind === "leader")?.requires?.flags,
    ).toContain("last_lens");
    expect(
      WORLD.league.objects.find((o) => o.id === "league_0")?.requires?.flags,
    ).toContain("ascent_complete");
  });
  it("does not reach later main-road settlements before their badge gates", () => {
    const barriers: [number, string][] = [
      [0, "tideglass"],
      [1, "copperwick"],
      [2, "sunspire"],
      [3, "reedhaven"],
      [4, "rimepeak"],
      [5, "bellweather"],
      [6, "aster"],
      [7, "crown"],
    ];
    for (const [cap, blocked] of barriers) {
      const flags = new Set<string>(),
        seen = new Set(["dewdrop"]);
      let badges = 0;
      for (let pass = 0; pass < 100; pass++) {
        let changed = false;
        for (const id of [...seen]) {
          const m = WORLD[id];
          for (const o of m.objects)
            if (can(o.requires, flags, badges)) {
              if (o.reward?.badge && o.reward.badge > cap) continue;
              if (o.setsFlag && !flags.has(o.setsFlag)) {
                flags.add(o.setsFlag);
                changed = true;
              }
              if (o.reward?.badge && o.reward.badge > badges) {
                badges = o.reward.badge;
                changed = true;
              }
            }
          for (const e of m.exits)
            if (can(e.requires, flags, badges) && !seen.has(e.to)) {
              seen.add(e.to);
              changed = true;
            }
        }
        if (!changed) break;
      }
      expect(seen.has(blocked), `${blocked} with ${cap} badges`).toBe(false);
    }
  });
  it("unlocks the full campaign in order without inaccessible dependencies", () => {
    const flags = new Set<string>();
    let badges = 0;
    const reachable = new Set(["dewdrop"]);
    for (let pass = 0; pass < 100; pass++) {
      let changed = false;
      for (const id of [...reachable]) {
        const m = WORLD[id];
        for (const o of m.objects)
          if (can(o.requires, flags, badges)) {
            if (o.setsFlag && !flags.has(o.setsFlag)) {
              flags.add(o.setsFlag);
              changed = true;
            }
            if (o.reward?.badge && o.reward.badge > badges) {
              badges = o.reward.badge;
              changed = true;
            }
          }
        for (const e of m.exits)
          if (can(e.requires, flags, badges) && !reachable.has(e.to)) {
            reachable.add(e.to);
            changed = true;
          }
      }
      if (!changed) break;
    }
    expect(badges).toBe(8);
    expect(flags.has("engine_stopped")).toBe(true);
    expect(flags.has("champion")).toBe(true);
    expect(maps.filter((m) => !reachable.has(m.id)).map((m) => m.id)).toEqual(
      [],
    );
  });
});
