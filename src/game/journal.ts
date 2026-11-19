import { expeditions, expeditionState } from "../world/expeditions";
import {
  WORLD,
  QUESTS,
  type Exit,
  type Requirement,
  type WorldMap,
  type WorldObject,
} from "../world";
import { requestHint } from "../world/requests";
import { exitOpen, fieldActions } from "./navigation";
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
    steps: [...expeditions[id].steps, id + "_objective"],
  };
}
function gym(n: number, title: string, ...steps: string[]): Chapter {
  return { title, steps: [...steps, "leader_" + n] };
}
const chapters: Chapter[] = [
  { title: "Choose a partner at Alder’s lab", steps: ["alder"] },
  dungeon("lantern", "Rescue the surveyor in Lantern Wood"),
  gym(1, "Earn Fern’s Canopy Badge"),
  dungeon("undertow", "Restore the harbor’s fog signal"),
  gym(2, "Challenge Marina in Tideglass"),
  dungeon("copperworks", "Trace the missing current at Copperworks"),
  gym(3, "Take either operator’s catwalk to Volt"),
  dungeon("hourglass", "Recover the Hourglass lens"),
  gym(4, "Challenge Sable in Sunspire"),
  dungeon("bamboo", "Collect the Reedhaven ranger’s report"),
  dungeon("ember", "Free the Pokémon in Ember Mine"),
  gym(5, "Challenge Flint in Cinderfall"),
  dungeon("frostvault", "Reopen the mountain pass"),
  gym(6, "Challenge Neve in Rimepeak"),
  dungeon("echo", "Listen to the memory in Echo Bell Tower"),
  gym(7, "Stand with Robin at the witness rail", "gym7_witness"),
  dungeon("meridian", "Confront Director Vale at Meridian HQ"),
  dungeon("starfall", "Recover the final beacon lens"),
  gym(8, "Bring the lens to Orion in Aster", "gym8_2"),
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

export function campaignObjective(save: Pick<Save, "flags" | "survey">) {
  const done = (id: string) =>
    save.flags.includes(landmarks.get(id)!.object.setsFlag!);
  // A chosen shore takes priority until its keeper awards the badge.
  const shore = save.survey;
  const ids = shore === 4 ? ["hourglass", "gym4"] :
    shore === 5 ? ["bamboo", "ember", "gym5"] : ["bamboo", "frostvault", "gym6"];
  const selected = shore && save.flags.includes("badge3") && !save.flags.includes("badge" + shore)
    ? ids.map(id => chapters.find(chapter => landmarks.get(chapter.steps[0])!.map.id.startsWith(id))!)
    : [];
  for (const chapter of [...selected, ...chapters]) {
    // A completed chapter stays complete when maps gain new mechanisms.
    if (done(chapter.steps[chapter.steps.length - 1])) continue;
    const step = chapter.steps.find((id) => !done(id))!;
    const landmark = landmarks.get(step)!;
    const map = expeditionState(landmark.map, save.flags);
    const object = map === landmark.map ? landmark.object : map.objects.find(o => o.id === step)!;
    return { title: chapter.title, map, object };
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
  if (save.map === "gym3" && goal.object.id === "leader_3" &&
      !save.flags.includes("gym3_1_won") && !save.flags.includes("gym3_2_won")) {
    const roster = goal.map.objects.find(o => o.id === "gym3_roster")!;
    return {
      title: goal.title,
      hint: "Tess works the west catwalk. Dex works the east. Beat either operator to cross to Volt.",
      marker: roster,
    };
  }
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

export type JournalNote = {
  id: string;
  title: string;
  status: "Active" | "Ready" | "Filed" | "Blocked" | "Clearable" | "Open";
  place: string;
  note: string;
  reward?: string;
};

const requesters = new Map(
  [...landmarks.values()].flatMap(landmark =>
    landmark.object.quest ? [[landmark.object.quest, landmark] as const] : [],
  ),
);

export function journalRequests(
  save: Save,
  permitted: (requirement?: Requirement) => boolean,
  typesOf: (id: number) => number[],
) {
  const entries = QUESTS.flatMap(quest => {
    const { map, object } = requesters.get(quest.id)!;
    const done = save.flags.includes(quest.completedFlag);
    const discovered = done || save.flags.includes("met_" + object.id) ||
      save.flags.includes("request_" + quest.id) ||
      (quest.id === "parcel" && save.flags.includes("found_parcel"));
    if (!discovered) return [];
    const ready = !done && permitted(object.requires);
    return [{
      id: quest.id,
      title: quest.name,
      status: done ? "Filed" as const : ready ? "Ready" as const : "Active" as const,
      place: map.name,
      note: done ? object.victoryDialogue || "Request complete."
        : ready ? `Return to ${object.name} in ${map.name}.`
        : requestHint(quest.id, save.flags, save.caught, typesOf),
      reward: quest.reward,
    }];
  });
  const priority = { Ready: 0, Active: 1, Filed: 2 };
  const here = WORLD[save.map].name;
  return entries.sort((a, b) =>
    priority[a.status] - priority[b.status] || Number(b.place === here) - Number(a.place === here),
  );
}

export function journalPaths(save: Save, permitted: (requirement?: Requirement) => boolean): JournalNote[] {
  return Object.values(WORLD).flatMap(map => map.exits.flatMap(exit => {
    const id = `gate_${map.id}_${exit.to}`;
    if (!save.flags.includes(id)) return [];
    const open = exitOpen(exit, permitted, save.flags);
    const action = exit.barrier && permitted(exit.requires) && fieldActions[exit.barrier.kind];
    return [{
      id,
      title: WORLD[exit.to].name,
      status: open ? "Open" : action ? "Clearable" : "Blocked",
      place: map.name,
      note: open ? "The way is open." : action ? action[1] + " here."
        : exit.lockedDialogue || "Check the next beacon objective.",
    } satisfies JournalNote];
  }));
}
