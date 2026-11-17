import {
  WORLD,
  type Exit,
  type Requirement,
  type WorldMap,
  type WorldObject,
} from "../world";
import type { Save } from "./save";

type Landmark = { map: WorldMap; object: WorldObject };
const landmarks = new Map<string, Landmark>();
for (const map of Object.values(WORLD)) {
  for (const object of map.objects) landmarks.set(object.id, { map, object });
}

type Chapter = { title: string; steps: string[] };
function dungeon(id: string, title: string): Chapter {
  return {
    title,
    steps: ["step1", "step2", "mechanism", "objective"].map(
      (step) => id + "_" + step,
    ),
  };
}
function gym(n: number, title: string): Chapter {
  const id = "gym" + n;
  return {
    title,
    steps: [
      ...WORLD[id].objects.filter((o) => o.kind === "switch").map((o) => o.id),
      "leader_" + n,
    ],
  };
}
const chapters: Chapter[] = [
  { title: "Choose a partner at Alder’s lab", steps: ["alder"] },
  dungeon("lantern", "Rescue the surveyor in Lantern Wood"),
  gym(1, "Earn Fern’s Canopy Badge"),
  dungeon("undertow", "Restore the harbor’s fog signal"),
  gym(2, "Challenge Marina in Tideglass"),
  dungeon("copperworks", "Trace the missing current at Copperworks"),
  gym(3, "Challenge Volt in Copperwick"),
  dungeon("hourglass", "Recover the Hourglass lens"),
  gym(4, "Challenge Sable in Sunspire"),
  dungeon("bamboo", "Collect the Reedhaven ranger’s report"),
  dungeon("ember", "Free the Pokémon in Ember Mine"),
  gym(5, "Challenge Flint in Cinderfall"),
  dungeon("frostvault", "Reopen the mountain pass"),
  gym(6, "Challenge Neve in Rimepeak"),
  dungeon("echo", "Listen to the memory in Echo Bell Tower"),
  gym(7, "Challenge Lyra in Bellweather"),
  dungeon("meridian", "Confront Director Vale at Meridian HQ"),
  dungeon("starfall", "Recover the final beacon lens"),
  gym(8, "Bring the lens to Orion in Aster"),
  {
    title: "Return to Starfall and stop the Engine",
    steps: ["celestial_engine"],
  },
  dungeon("victory", "Open the summit gate in Victory Ascent"),
  {
    title: "Challenge the Astral League",
    steps: Array.from({ length: 5 }, (_, i) => "league_" + i),
  },
  dungeon("aurora", "Restore the Aurora Sanctuary"),
  { title: "Record 251 species for the Living Atlas", steps: ["quest_atlas"] },
];

export function campaignObjective(save: Pick<Save, "flags">) {
  const done = (id: string) =>
    save.flags.includes(landmarks.get(id)!.object.setsFlag!);
  for (const chapter of chapters) {
    // A completed chapter stays complete when maps gain new mechanisms.
    if (done(chapter.steps[chapter.steps.length - 1])) continue;
    const step = chapter.steps.find((id) => !done(id))!;
    return { title: chapter.title, ...landmarks.get(step)! };
  }
}

export function routeTo(
  from: string,
  to: string,
  permitted: (r?: Requirement) => boolean,
): Exit[] {
  if (from === to) return [];
  const queue = [from];
  const enteredBy = new Map<string, { from: string; exit: Exit }>();
  for (let i = 0; i < queue.length && !enteredBy.has(to); i++) {
    for (const exit of WORLD[queue[i]].exits) {
      if (
        exit.to === from ||
        enteredBy.has(exit.to) ||
        !permitted(exit.requires)
      )
        continue;
      queue.push(exit.to);
      enteredBy.set(exit.to, { from: queue[i], exit });
    }
  }
  const path: Exit[] = [];
  for (let step = enteredBy.get(to); step; step = enteredBy.get(step.from))
    path.unshift(step.exit);
  return path;
}

export function bearings(
  x: number,
  y: number,
  target: { x: number; y: number },
) {
  const dx = target.x + 0.5 - x,
    dy = target.y + 0.5 - y;
  if (Math.hypot(dx, dy) < 1.8) return "nearby";
  const ns =
    Math.abs(dy) > Math.abs(dx) * 0.45 ? (dy < 0 ? "north" : "south") : "";
  const ew =
    Math.abs(dx) > Math.abs(dy) * 0.45 ? (dx < 0 ? "west" : "east") : "";
  return ns + ew;
}

export function directions(
  save: Save,
  permitted: (r?: Requirement) => boolean,
) {
  const goal = campaignObjective(save);
  if (!goal)
    return {
      title: "Living Atlas complete",
      hint: "All eight beacons are shining. Revisit a keeper for a rematch.",
    };
  if (goal.object.id === "quest_atlas" && save.caught.length < 251)
    return {
      title: goal.title,
      hint: `${save.caught.length} caught. Use the Pokédex to look up habitats.`,
    };
  if (save.map === goal.map.id)
    return {
      title: goal.title,
      hint: `${goal.object.name} · ${bearings(save.x, save.y, goal.object)}`,
      marker: goal.object,
    };
  const path = routeTo(save.map, goal.map.id, permitted);
  if (path.length > 3 && save.abilities.includes("fly")) {
    let bestLength = path.length - 2,
      fly: string | undefined;
    for (const id of save.visited) {
      if (WORLD[id].kind !== "town" || id === save.map) continue;
      const walk = routeTo(id, goal.map.id, permitted);
      if ((walk.length || id === goal.map.id) && walk.length < bestLength) {
        bestLength = walk.length;
        fly = id;
      }
    }
    if (fly)
      return {
        title: goal.title,
        hint: "Fly to " + WORLD[fly].name + " from the Map menu.",
        fly,
      };
  }
  const next = path[0];
  return {
    title: goal.title,
    hint: next
      ? `Head for ${WORLD[next.to].name} · ${bearings(save.x, save.y, next)}`
      : goal.map.name,
    marker: next,
  };
}
