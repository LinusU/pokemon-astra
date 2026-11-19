import { expect, it } from "vitest";
import { WORLD, QUESTS, type WorldMap } from "../src/world";
import { expeditions, expeditionState } from "../src/world/expeditions";
import { updateChart, requestHint } from "../src/world/requests";
import { freshSave, restoreExpeditions, meetsRequirement } from "../src/game/save";
import { objectVisible, interactionTarget } from "../src/game/actors";
import { instrument } from "../src/ui/fieldwork";

function walk(map: WorldMap, x: number, y: number, obstacle?: { x: number; y: number }) {
  const seen = new Set<string>();
  const queue = [[x, y]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i],
      key = [x, y].join();
    const tile = map.tiles[y]?.[x];
    if (!tile || "#ow~BCPTS".includes(tile) || seen.has(key) || (x === obstacle?.x && y === obstacle.y)) continue;
    seen.add(key);
    queue.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
  }
  return seen;
}

it.each([
  ["undertow_2", "low_tide", "undertow_3"],
  ["copperworks_2", "relay_on", "copperworks_3"],
  ["hourglass_2", "stone_aligned", "hourglass_3"],
  ["frostvault_2", "ice_thawed", "frostvault_3"],
  ["starfall_2", "stars_aligned", "starfall_3"],
  ["victory_2", "east_pitch", "victory_3"],
  ["victory_2", "west_pitch", "victory_3"],
  ["bamboo_3", "farfetchd_lane", "bamboo_bird"],
])("changes actual walking access in %s", (id, flag, target) => {
  const base = WORLD[id],
    entrance = base.exits[0];
  const end = base.exits.find((e) => e.to === target) ?? base.objects.find((o) => o.id === target)!;
  for (const [flags, reachable] of [
    [[], false],
    [[flag], true],
  ] as const) {
    const map = expeditionState(base, flags);
    expect(walk(map, entrance.x, entrance.y).has([end.x, end.y].join())).toBe(reachable);
  }
});

it("keeps both meter-loft ladders and the feeder controls accessible before isolation", () => {
  const map = expeditionState(WORLD.copperworks_2, []);
  const entry = map.exits.find(e => e.to === "copperworks_1")!;
  const nearBank = walk(map, entry.x, entry.y);
  const ladder = map.exits.find(e => e.to === "copperworks_4")!;
  for (const point of [ladder, ...map.objects])
    expect(nearBank.has([point.x, point.y].join()), "Feeder gallery").toBe(true);
});

it("restores moving ice and prevents a rescued passenger appearing in two places", () => {
  const origin = WORLD.frostvault_2;
  const plug = (f: string[]) => expeditionState(origin, f).objects.find((o) => o.id === "frost_plug")!;
  expect(plug(["frost_push_1"]).x).toBe(plug([]).x + 1);
  expect(plug(["frost_push_1", "frost_push_2"]).x).toBe(plug([]).x + 2);
  expect(objectVisible(plug([]), new Set(["ice_thawed"]))).toBe(false);
  const bird = WORLD.bamboo_3.objects.find((o) => o.id === "bamboo_bird")!;
  const home = WORLD.bamboo_3.objects.find((o) => o.id === "bamboo_perch")!;
  for (const flags of [new Set<string>(), new Set(["farfetchd_home"])])
    expect([bird, home].filter((o) => objectVisible(o, flags))).toEqual(flags.size ? [home] : [bird]);
});

it("lets the player get behind each ice plug position before the cornice thaws", () => {
  const base = WORLD.frostvault_2;
  const entrance = base.exits.find(e => e.to === "frostvault_1")!;
  const finish = base.exits.find(e => e.to === "frostvault_3")!;
  for (const flags of [[], ["frost_push_1"], ["frost_push_1", "frost_push_2"]]) {
    const map = expeditionState(base, flags);
    const plug = map.objects.find(o => o.id === "frost_plug")!;
    const floor = walk(map, entrance.x, entrance.y, plug);
    expect(floor.has([plug.x - 1, plug.y].join())).toBe(true);
    expect(floor.has([finish.x, finish.y].join())).toBe(false);
  }
});

it("lets a surfing player call Lapras from the marked shallows", () => {
  const map = WORLD.undertow_4,
    lapras = map.objects.find((o) => o.id === "lighthouse_lapras")!;
  const player = { x: lapras.x - 0.5, y: lapras.y + 0.5, facing: "right" };
  expect(map.tiles[Math.floor(player.y)][Math.floor(player.x)]).toBe("~");
  expect(interactionTarget(map, player, new Set(), (o) => ({ x: o.x + 0.5, y: o.y + 0.5 }))).toBe(lapras);
});

it("accepts either clearance, either ascent and either order of wetland observations", () => {
  for (const [ids, gate] of [
    [
      ["meridian_clerk", "meridian_guardian_trainer"],
      WORLD.meridian_1.exits.find((e) => e.to === "meridian_2")!,
    ],
    [["victory_falls", "victory_crag"], WORLD.victory_2.exits.find((e) => e.to === "victory_3")!],
  ] as const) {
    for (const id of ids) {
      const o = Object.values(WORLD)
        .flatMap((m) => m.objects)
        .find((o) => o.id === id)!;
      expect(meetsRequirement({ ...freshSave(), flags: [o.setsFlag!] }, gate.requires)).toBe(true);
    }
  }
  const report = WORLD.bamboo_3.objects.find((o) => o.id === "bamboo_objective")!;
  expect(meetsRequirement({ ...freshSave(), flags: ["bamboo_burrow"] }, report.requires)).toBe(false);
  expect(
    meetsRequirement({ ...freshSave(), flags: ["bamboo_burrow", "bamboo_nesting"] }, report.requires),
  ).toBe(true);
});

it("plots actual visits before accepting the chart and honors records from earlier saves", () => {
  const flags: string[] = [];
  for (const id of ["starfall", "echo", "lantern", "undertow", "ember", "copperworks", "frostvault"])
    updateChart(flags, id + "_3");
  expect(requestHint("chart", flags, [], () => [])).toContain("Remaining: Hourglass Ruins");
  updateChart(flags, "hourglass_1");
  expect(flags).not.toContain("beacon_chart_full");
  updateChart(flags, "hourglass_3");
  updateChart(flags, "hourglass_3");
  expect(flags.filter((f) => f === "beacon_chart_full")).toHaveLength(1);
  const old = {
    ...freshSave(),
    map: "ember_3",
    flags: [
      "found_parcel",
      "pokemon_freed",
      "quest_lighthouse_complete",
      ...Object.values(expeditions).map((s) => s.finish),
    ],
  };
  const restored = restoreExpeditions(old);
  expect(restored.flags).toEqual(
    expect.arrayContaining([
      "ember_slug_safe",
      "lighthouse_lapras_safe",
      "parcel_wrapped",
      "beacon_chart_full",
    ]),
  );
  expect(restored.items.courier_parcel).toBe(1);
  expect(restoreExpeditions(restored)).toBe(restored);
});

it("keeps one claim per side quest and gives every request a discoverable lead", () => {
  const all = Object.values(WORLD).flatMap((m) => m.objects);
  for (const q of QUESTS) {
    const claims = all.filter((o) => o.quest === q.id);
    expect(claims).toHaveLength(1);
    expect(claims[0].setsFlag).toBe(q.completedFlag);
    expect(claims[0].request).toBe(q.id);
    expect(claims[0].dialogue.length).toBeGreaterThan(70);
  }
});

it.each([
  ["breaker", [0, 2, 1]],
  ["carillon", [1, 0, 1, 0, 2, 1]],
  ["telescope", [0, 0, 1]],
  ["float", [1, 0, 0, 1]],
  ["fossil", [0, 1, 1, 3, 7]],
  ["forge", [2, 1, 0, 0, 1, 2]],
] as const)("allows retries and a reproducible solution for %s", (device, keys) => {
  const scene = instrument(device, () => {});
  for (const key of keys.slice(0, -1)) expect(scene.use(key)).toBe(false);
  expect(scene.use(keys.at(-1)!)).toBe(true);
});

it("links the side rooms to their local landmarks and lets players bypass the security match", () => {
  const exit = (from: string, to: string) => WORLD[from].exits.find((e) => e.to === to)!;
  expect(exit("echo_3", "echo_4").requires?.flags).toEqual(["echo_impression"]);
  expect(exit("undertow_3", "undertow_4").requires?.ability).toBe("surf");
  expect(WORLD.copperworks_4.exits.map((e) => e.to).sort()).toEqual(["copperworks_1", "copperworks_2"]);
  expect(exit("meridian_1", "meridian_4").requires).toBeUndefined();
  expect(exit("meridian_4", "meridian_2").requires?.flags).toEqual(["keycard"]);
  expect(exit("meridian_1", "meridian_2").requires?.flags).toEqual(["keycard"]);
  expect(WORLD.meridian_1.objects.some((o) => o.kind === "trainer")).toBe(false);
});
