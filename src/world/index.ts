import { populateRequests } from "./requests";
import { composeGeography, dimensions } from "./geography";
import { localTrail, opposite, routes, settlements } from "./atlas";
import { expeditions, expeditionCrew, finalNeeds, type Fieldwork } from "./expeditions";
import { dungeonPlans } from "./dungeon-plans";
import { gyms } from "./gyms";
import { populateHabitats } from "./habitats";

/** Pokémon Astra's authored campaign. Species numbers use the National Pokédex. */
export type Ability =
  | "cut"
  | "surf"
  | "flash"
  | "strength"
  | "rockSmash"
  | "whirlpool"
  | "waterfall"
  | "fly";
export interface Requirement {
  flags?: string[];
  badges?: number;
  ability?: Ability;
  caught?: number;
  items?: string[];
  species?: number[];
  types?: { type: string; count: number }[];
}
export interface TeamMember {
  species: number;
  level: number;
}
export interface Trainer {
  id: string;
  name: string;
  team: TeamMember[];
  reward?: number;
}
export interface Reward {
  takeItem?: string;
  items?: { item: string; amount?: number }[];
  item?: string;
  amount?: number;
  species?: number;
  level?: number;
  badge?: number;
  ability?: Ability;
  money?: number;
}
export type ObjectKind =
  | "person"
  | "sign"
  | "item"
  | "switch"
  | "trainer"
  | "leader"
  | "legendary"
  | "healer"
  | "shop"
  | "starter"
  | "gate";
export type Direction = "north" | "south" | "east" | "west";
export interface WorldObject {
  id: string;
  kind: ObjectKind;
  x: number;
  y: number;
  name: string;
  dialogue: string;
  requires?: Requirement;
  lockedDialogue?: string;
  victoryDialogue?: string;
  setsFlag?: string;
  reward?: Reward;
  trainer?: Trainer;
  repeatable?: boolean;
  quest?: string;
  request?: string;
  facing?: "up" | "down" | "left" | "right";
  sprite?: string;
  roam?: number;
  sightRange?: number;
  /** A wild resident that can be observed for the Pokédex. */
  wildlife?: number;
  field?: Fieldwork;
}
export type BarrierKind = Exclude<Ability, "fly"> | "warden" | "shutter";
export interface ExitBarrier {
  kind: BarrierKind;
  /** A field action clears both ends of a shortcut permanently. */
  flag?: string;
}

export interface Exit {
  direction?: Direction;
  span?: number;
  entrance?: "door" | "cave" | "stairs" | "mat";
  /** Horizontal tile count for a non-directional exit, anchored at x. */
  width?: number;
  barrier?: ExitBarrier;
  x: number;
  y: number;
  to: string;
  toX: number;
  toY: number;
  requires?: Requirement;
  lockedDialogue?: string;
  label: string;
}
export interface Encounter {
  species: number;
  minLevel: number;
  maxLevel: number;
  weight: number;
}
export interface WorldMap {
  id: string;
  name: string;
  width: number;
  height: number;
  tiles: string[];
  palette: string;
  terrainVariant?: string;
  exits: Exit[];
  objects: WorldObject[];
  encounters: Encounter[];
  kind: "town" | "route" | "dungeon" | "gym" | "interior";
}
export interface Quest {
  id: string;
  name: string;
  description: string;
  prerequisite?: Requirement;
  completedFlag: string;
  reward: string;
}
export const ABILITIES: Ability[] = [
  "cut",
  "surf",
  "flash",
  "strength",
  "rockSmash",
  "whirlpool",
  "waterfall",
  "fly",
];
export const BADGES = [
  "Canopy",
  "Tidal",
  "Dynamo",
  "Mirage",
  "Ember",
  "Rime",
  "Chime",
  "Astral",
];
export const WORLD: Record<string, WorldMap> = {};
export const QUESTS: Quest[] = [];

function map(
  id: string,
  name: string,
  kind: WorldMap["kind"],
  palette: string,
): WorldMap {
  const [width, height] = dimensions(id, kind);
  const value: WorldMap = {
    id,
    name,
    kind,
    palette,
    width,
    height,
    tiles: Array.from({ length: height }, () => ".".repeat(width)),
    exits: [],
    objects: [],
    encounters: [],
  };
  WORLD[id] = value;
  return value;
}
function portalSlots(m: WorldMap): [number, number][] {
  const w = m.width,
    h = m.height,
    cx = Math.floor(w / 2),
    cy = Math.floor(h / 2);
  return [
    [1, cy],
    [w - 2, cy],
    [cx, 1],
    [cx, h - 2],
    [1, cy + 1],
    [w - 2, cy + 1],
    [cx - 1, 1],
    [cx + 1, h - 2],
    [1, cy - 1],
    [w - 2, cy - 1],
    [cx - 2, 1],
    [cx + 2, h - 2],
    [1, cy + 2],
    [w - 2, cy + 2],
    [cx - 3, 1],
    [cx + 3, h - 2],
  ];
}
function connect(
  a: string,
  b: string,
  labelA: string,
  labelB: string,
  requiresAB?: Requirement,
  requiresBA?: Requirement,
) {
  const left = WORLD[a],
    right = WORLD[b];
  const p = portalSlots(left)[left.exits.length],
    q = portalSlots(right)[right.exits.length];
  if (!p || !q) throw new Error(`Too many exits: ${a} or ${b}`);
  left.exits.push({
    x: p[0],
    y: p[1],
    to: b,
    toX: q[0],
    toY: q[1],
    label: labelA,
    requires: requiresAB,
    lockedDialogue: requiresAB
      ? "The way is closed. Check your journal for the next objective."
      : undefined,
  });
  right.exits.push({
    x: q[0],
    y: q[1],
    to: a,
    toX: p[0],
    toY: p[1],
    label: labelB,
    requires: requiresBA,
    lockedDialogue: requiresBA ? "A field ability is needed here." : undefined,
  });
}
function obj(
  mapId: string,
  value: Omit<WorldObject, "x" | "y"> & Partial<Pick<WorldObject, "x" | "y">>,
) {
  const m = WORLD[mapId];
  const slots: [[number, number], ...[number, number][]] = [
    [10, 7],
    [13, 7],
    [8, 8],
    [15, 8],
    [10, 10],
    [13, 10],
    [8, 6],
    [15, 6],
    [11, 5],
    [12, 11],
    [7, 7],
    [16, 7],
    [9, 9],
    [14, 9],
    [11, 9],
    [12, 9],
  ];
  const pos = slots[m.objects.length % slots.length];
  const dx = Math.floor((m.width - 24) / 2),
    dy = Math.floor((m.height - 16) / 2);
  m.objects.push({
    ...value,
    x: value.x ?? pos[0] + dx,
    y: value.y ?? pos[1] + dy,
  });
}
const townData = Object.entries(settlements).map(([id, t]) => [id, t.name, t.palette]);
townData.forEach(([id, name, palette]) => map(id, name, "town", palette));
const routeData = Object.keys(routes).sort().map(n => {
  const { name, from, to, palette } = routes[n];
  return [n, name, from, to, palette];
});
routeData.forEach(([n, name, , , palette]) =>
  map(`route${n}`, `Route ${n} · ${name}`, "route", palette),
);
for (const [id, site] of Object.entries(expeditions))
  dungeonPlans[id].forEach((room, i) => map(id + "_" + (i + 1), site.name + " · " + room.name, "dungeon", site.palette));
const leaders: [string, string, string, TeamMember[]][] = [
  [
    "Fern",
    "Bug",
    "bramble",
    [
      { species: 167, level: 11 },
      { species: 165, level: 11 },
      { species: 123, level: 13 },
    ],
  ],
  [
    "Marina",
    "Water",
    "tideglass",
    [
      { species: 194, level: 16 },
      { species: 120, level: 17 },
      { species: 117, level: 18 },
    ],
  ],
  [
    "Volt",
    "Electric",
    "copperwick",
    [
      { species: 100, level: 22 },
      { species: 81, level: 22 },
      { species: 181, level: 24 },
    ],
  ],
  [
    "Sable",
    "Ground",
    "sunspire",
    [
      { species: 27, level: 26 },
      { species: 207, level: 27 },
      { species: 232, level: 29 },
    ],
  ],
  [
    "Flint",
    "Fire",
    "cinderfall",
    [
      { species: 126, level: 33 },
      { species: 78, level: 34 },
      { species: 59, level: 36 },
    ],
  ],
  [
    "Neve",
    "Ice",
    "rimepeak",
    [
      { species: 215, level: 39 },
      { species: 87, level: 40 },
      { species: 221, level: 42 },
    ],
  ],
  [
    "Lyra",
    "Psychic",
    "bellweather",
    [
      { species: 178, level: 44 },
      { species: 122, level: 45 },
      { species: 196, level: 47 },
    ],
  ],
  [
    "Orion",
    "Dragon",
    "aster",
    [
      { species: 148, level: 49 },
      { species: 230, level: 50 },
      { species: 149, level: 52 },
    ],
  ],
];
leaders.forEach(([name, type, town], i) => {
  const id = `gym${i + 1}`;
  map(id, `${gyms[id].name} · ${type} Gym`, "gym", WORLD[town].palette);
  connect(town, `gym${i + 1}`, `${name}'s Gym`, town);
});
const serviceVisitors: Record<string, [[string, string], [string, string]]> = {
  dewdrop: [
    [
      "Bug catcher",
      "I practice with Scout Ari on Dewpath. If you’ve already beaten him, talk to him for another battle.",
    ],
    [
      "Supply runner",
      "Alder hands new trainers a few Poké Balls and Potions. I buy more when I’ve found a place worth exploring.",
    ],
  ],
  mossford: [
    [
      "Orchard picker",
      "Poison can cut a trip short. Heal here before taking Orchard Lane east.",
    ],
    [
      "Orchard shopper",
      "Look in the grass beside the bridge on Orchard Lane. Someone dropped a Fire Stone there.",
    ],
  ],
  bramble: [
    [
      "Survey volunteer",
      "The surveyor is somewhere past the north trail. Look for pale moths on the paired lantern blooms.",
    ],
    [
      "Woodland guide",
      "Keep a few Poké Balls ready for the Lantern Approach. The locals’ Pokémon are good at wearing down a new team.",
    ],
  ],
  tideglass: [
    [
      "Harbor fisher",
      "Once you learn Surf, you can set off from the buoys on the east quay. That takes you toward Copperwick.",
    ],
    [
      "Sailor",
      "I keep a stronger ball for Pokémon that get away from the first one. The harbor has a fine fishing spot.",
    ],
  ],
  copperwick: [
    [
      "Line worker",
      "The lights flicker even here. The old power station is up Switchyard Road.",
    ],
    [
      "Scrap picker",
      "Three parts went missing from the workshop. The collector in town is still looking for them.",
    ],
  ],
  sunspire: [
    [
      "Desert traveler",
      "The trails around Glassway curve between old walls. A break here saves a longer trip back through the dunes.",
    ],
    [
      "Glassworks hand",
      "Evolution stones work on particular species. Check the Party screen before using one.",
    ],
  ],
  reedhaven: [
    [
      "Field ranger",
      "You can carry six partners. Look under Storage in the menu if you want to rotate in a new catch.",
    ],
    [
      "Bird watcher",
      "Repel buys you time to look around in tall grass when you’re already going somewhere.",
    ],
  ],
  cinderfall: [
    [
      "Mine hand",
      "Our crews carry extras of anything that heals a burn. The steam vents don’t always give much notice.",
    ],
    [
      "Furnace apprentice",
      "The artisan in town is collecting a special ore. If you’re visiting the mine, keep an eye out for it.",
    ],
  ],
  rimepeak: [
    [
      "Pass hiker",
      "Use a Center before you head into Frostvault. The spa crew left a sketch of the ice plug at the snow shed.",
    ],
    [
      "Mountain guide",
      "I stock up before going north. If you run low on move PP halfway through a route, an Ether helps.",
    ],
  ],
  bellweather: [
    [
      "Tower pilgrim",
      "When you climb Echo Bell Tower, listen for the order in which the bells sound.",
    ],
    [
      "Archivist",
      "The old tower has a side chamber. You’ll find the route clearer once you have Flash.",
    ],
  ],
  aster: [
    [
      "Sky watcher",
      "The final beacon is in the observatory east of town. Astra’s sky should start moving again once it’s back.",
    ],
    [
      "Observatory aide",
      "Follow Crown Road west to Victory Ascent. Take restoration supplies before you head up, especially if you plan to challenge the League.",
    ],
  ],
  crown: [
    [
      "League challenger",
      "Rowan starts with Grass types around Lv 55. I brought a Fire type and saved my Ice moves for Mira.",
    ],
    [
      "Returning challenger",
      "I forgot to check my move PP last time. Look at your whole party before you go in.",
    ],
  ],
};
// Homes, services and facilities are real maps, not decorative buildings.
for (const [town, name] of townData) {
  for (const [suffix, title] of [
    ["center", "Pokémon Center"],
    ["mart", "Mart"],
  ] as const) {
    const id = `${town}_${suffix}`;
    map(id, `${name} ${title}`, "interior", WORLD[town].palette);
    connect(town, id, title, name);
    obj(id, {
      id: `${id}_clerk`,
      kind: suffix === "center" ? "healer" : "shop",
      name: suffix === "center" ? "Nurse" : "Shopkeeper",
      dialogue:
        suffix === "center"
          ? "Welcome! Your Pokémon can rest here."
          : "Welcome! Stock up for the road.",
    });
    const [visitor, dialogue] =
      serviceVisitors[town][suffix === "center" ? 0 : 1];
    obj(id, { id: `${id}_visitor`, kind: "person", name: visitor, dialogue });
  }
}
for (const [id, name, town] of [
  ["home", "Your home", "dewdrop"],
  ["lab", "Professor Alder's Lab", "dewdrop"],
  ["league", "Astral League", "crown"],
] as const) {
  map(id, name, "interior", WORLD[town].palette);
  connect(town, id, name, town);
}
for (const [town, title, host, dialogue] of [
  [
    "mossford",
    "Windmill Cottage",
    "Millwright",
    "My father measured the wind by the bell above Bramble. Fern will lend you Cut after you earn the Canopy Badge. With it you can walk straight back to Dewdrop through the old grove.",
  ],
  [
    "bramble",
    "Lantern Lodge",
    "Trail warden",
    "If you’re looking for the surveyor, take the Lantern Approach north. The moth scouts say paired blossoms mark the way to the hollow oak.",
  ],
  [
    "tideglass",
    "Harbor Office",
    "Pilot",
    "The western road is safe on foot. To go east, follow the buoys off the end of the quay and use Surf once Marina has given you the Tidal Badge.",
  ],
  [
    "sunspire",
    "Glassworks",
    "Lens maker",
    "Keep a Sun Stone or Moon Stone for a Pokémon that responds to it. You can find more among the offerings beside the Hourglass Ruins.",
  ],
  [
    "reedhaven",
    "Ranger Cabin",
    "Field researcher",
    "An extra catch goes to Storage when you already travel with six. It still counts in our habitat census.",
  ],
  [
    "rimepeak",
    "Pass Shelter",
    "Shelter keeper",
    "Steep fresh silverleaf in the village spa before traveling. The healer who uses it lives by the bridge in Mossford.",
  ],
  [
    "aster",
    "Chart Room",
    "Cartographer",
    "Write down the names of every beacon you visit. The astronomer in the plaza gives an award when your chart is complete.",
  ],
] as const) {
  const id = `${town}_house`;
  map(id, title, "interior", WORLD[town].palette);
  connect(town, id, title, WORLD[town].name);
  obj(id, { id: `${id}_host`, kind: "person", name: host, dialogue });
}
obj("home", {
  id: "mother",
  kind: "person",
  name: "Mom",
  dialogue:
    "Alder is waiting at the lab. The whole region is yours to discover.",
});
obj("lab", {
  id: "alder",
  kind: "starter",
  name: "Professor Alder",
  dialogue:
    "Choose Growlithe, Poliwag, or Bellsprout. Take these supplies and survey the beacons with Robin.",
  setsFlag: "partner",
  reward: { item: "starter_supplies", amount: 1 },
});
obj("dewdrop", {
  id: "robin_start",
  kind: "person",
  name: "Robin",
  dialogue:
    "The Aurora Current guides Pokémon across Astra. Let’s find out why the beacons are failing!",
  requires: { flags: ["partner"] },
  lockedDialogue:
    "Alder’s waiting at the lab by the north garden. Go pick your partner, then we can see what happened to the beacons.",
});
// Main road gates ensure each community's story is completed before leaving.
const gates: Record<string, Requirement> = {
  "01": { flags: ["partner"] },
  "04": { badges: 1, ability: "cut", flags: ["surveyor"] },
  "06": { badges: 2, ability: "surf" },
  "08": { badges: 3, ability: "flash" },
  "12": { flags: ["ranger_report"] },
  "16": { badges: 6, ability: "whirlpool" },
  "18": { badges: 7, ability: "waterfall" },
  "20": { badges: 8, flags: ["engine_stopped"] },
  "21": { ability: "cut" },
  "22": { ability: "surf", badges: 3 },
  "23": { ability: "strength" },
  "24": { ability: "whirlpool", badges: 6 },
  "25": { flags: ["champion"] },
};
const roadAdvice: Record<string, string> = {
  "01": "Visit Professor Alder at the north end of Dewdrop and choose your partner first.",
  "04": "The east trail needs Cut from Fern and the safe route marked by the surveyor in Lantern Wood.",
  "06": "The quay ends here. Restore the signal in Undertow Cave, then earn Surf from Marina.",
  "08": "The passage is too dark to follow. Restore power at Copperworks, then earn Flash from Volt.",
  "12": "The ranger crew has closed the trail. Find their report across the bridge in Bamboo Sanctuary.",
  "16": "Meltwater pours through the pass. Reopen the route in Frostvault, then earn Whirlpool from Neve.",
  "18": "The trail climbs past a waterfall. Follow the bells in Echo Bell Tower, then earn Waterfall from Lyra.",
  "20": "Earn the Astral Badge and shut down the Celestial Engine before climbing to Crown Summit.",
  "21": "Fern’s Canopy Badge teaches Cut, which opens the overgrown trail.",
  "22": "The harbor launches for Reedhaven when the Copperwick beacon has power. Bring Surf and three badges.",
  "23": "A quarry cart has jumped its rails. Bring Strength from Sunspire to clear the freight road.",
  "24": "Cross the whirlpool with Neve’s field ability once six beacons are lit.",
  "25": "The sanctuary researchers open this trail once you enter the Hall of Fame.",
};
for (const [n, name, a, b] of routeData) {
  const id = `route${n}`;
  connect(a, id, name, WORLD[a].name, gates[n]);
  connect(
    id,
    b,
    WORLD[b].name,
    name,
    undefined,
    ["21", "22", "23", "24", "25"].includes(n) ? gates[n] : undefined,
  );
  if (roadAdvice[n]) {
    WORLD[a].exits.find((e) => e.to === id)!.lockedDialogue = roadAdvice[n];
    const arrival = WORLD[b].exits.find((e) => e.to === id)!;
    if (arrival.requires) arrival.lockedDialogue = roadAdvice[n];
  }
}
// The two ends of the old freight road have different obstructions. Either
// western keeper can open a way back to the orchards from their own side.
const quarryCut = WORLD.cinderfall.exits.find(e => e.to === "route23")!;
quarryCut.requires = { ability: "rockSmash" };
quarryCut.lockedDialogue = "A rockslide covers the freight cutting. Flint’s Rock Smash can reopen it from the mine side.";

connect("bellweather", "meridian_1", "Meridian HQ", "Bellweather", {
  flags: ["revelation"],
});
connect("crown", "victory_1", "Victory Ascent", "Crown Summit", {
  badges: 8,
  flags: ["engine_stopped"],
});
WORLD.bellweather.exits.find((e) => e.to === "meridian_1")!.lockedDialogue =
  "The records office is closed to visitors. The keeper in Echo Bell Tower can tell you what Meridian is hiding.";
WORLD.crown.exits.find((e) => e.to === "victory_1")!.lockedDialogue =
  "The ascent wardens need all eight badges and confirmation that the Celestial Engine has shut down.";
for (const [id, site] of Object.entries(expeditions)) {
  const [entry, middle, final] = [1, 2, 3].map(i => id + "_" + i);
  connect(entry, middle, "", "", site.gates?.[0]);
  connect(middle, final, "", "", site.gates?.[1]);
  const finished = { flags: [site.finish] };
  connect(final, entry, site.shortcut, site.shortcut, finished, finished);
  obj(entry, { id: id + "_trail_clue", kind: "sign", name: site.clue[0], dialogue: site.clue[1] });
  obj(entry, expeditionCrew(id));
  for (const actor of site.actors) {
    const room = dungeonPlans[id].findIndex(r => r.marks.includes(actor.id));
    if (room < 0) throw Error("Missing room for " + actor.id);
    obj(id + "_" + (room + 1), actor);
  }
  obj(final, { id: id + "_objective", kind: id === "lantern" || id === "bamboo" ? "person" : "switch",
    name: site.name, dialogue: "", setsFlag: site.finish,
    requires: finalNeeds[id] ? { flags: finalNeeds[id] } : undefined, lockedDialogue: site.clue[1] });
}
leaders.forEach(([name, , , team], i) => {
  const id = `gym${i + 1}`;
  const gym = gyms[id];
  for (const [slot, crew] of gym.crew.entries()) {
    const trainerId = `${id}_${slot + 1}`;
    obj(id, {
      id: trainerId, kind: "trainer", name: crew.name, sprite: crew.sprite,
      facing: crew.facing, sightRange: crew.range,
      dialogue: crew.intro, victoryDialogue: crew.after, setsFlag: trainerId + "_won",
      trainer: { id: trainerId, name: crew.name, reward: 120 * (i + 1),
        team: crew.team.map(([species, level]) => ({ species, level })) },
    });
  }
  for (const landmark of Object.values(gym.landmarks ?? {})) obj(id, landmark);
  obj(id, {
    id: `leader_${i + 1}`, kind: "leader", name, sprite: gym.sprite, facing: "down",
    dialogue: gym.intro, lockedDialogue: gym.advice,
    requires: { flags: gym.requirement, badges: i >= 3 && i <= 5 ? 3 : i },
    setsFlag: `badge${i + 1}`,
    reward: { badge: i + 1, ability: ABILITIES[i] },
    trainer: { id: `leader_${i + 1}`, name, team, reward: 1000 * (i + 1) },
  });
});
const habitats = routeData.map(([n]) => WORLD[`route${n}`]);
populateHabitats(WORLD);
const routeTrainers = [
  "Scout Ari",
  "Orchard hand Bea",
  "Surveyor Cleo",
  "Ferry hand Dara",
  "Deckhand Emil",
  "Lockkeeper Nessa",
  "Mechanic Oren",
  "Dune guide Iona",
  "Glass apprentice May",
  "Wader Taran",
  "Ranger Kestrel",
  "Kiln hand Bran",
  "Prospector Luz",
  "Climber Asa",
  "Skater Sanna",
  "Botanist Eira",
  "Pilgrim Sol",
  "Nightwatcher Hala",
  "Lab aide Nico",
  "Mountaineer Liv",
  "Forester Fenn",
  "Swimmer Keo",
  "Excavator Esti",
  "Diver Valea",
  "Ecologist Ren",
];
const trailItems = [
  [
    "potion",
    "Meadow first-aid tin",
    "You find two Potions under the pond boardwalk.",
  ],
  [
    "potion",
    "Orchard kit",
    "Someone left two Potions at the foot of the orchard bridge.",
  ],
  [
    "potion",
    "Surveyor supplies",
    "The survey team left two spare Potions here.",
  ],
  ["potion", "Ford supplies", "A watertight pouch holds two Potions."],
  [
    "great_ball",
    "Tidepool pouch",
    "Two Great Balls are tucked in a dry cleft above the tide line.",
  ],
  [
    "great_ball",
    "Canal locker",
    "You find two Great Balls left by the old lockkeeper.",
  ],
  [
    "great_ball",
    "Yard toolbox",
    "A disused toolbox holds two clean Great Balls.",
  ],
  [
    "great_ball",
    "Dune cache",
    "You brush the sand off a box containing two Great Balls.",
  ],
  [
    "great_ball",
    "Glassworks jar",
    "Two Great Balls are wrapped in cloth inside the jar.",
  ],
  [
    "great_ball",
    "Reed bundle",
    "You untie a bundle of reeds and find two Great Balls.",
  ],
  [
    "great_ball",
    "Ranger pack",
    "A waterproof ranger pack holds two Great Balls.",
  ],
  [
    "great_ball",
    "Trail bivouac",
    "You find two Great Balls in the shade of a lava shelf.",
  ],
  [
    "ultra_ball",
    "Miner’s pouch",
    "A discarded ore pouch holds two Ultra Balls.",
  ],
  [
    "ultra_ball",
    "Climbing tin",
    "A small tin by the cairn contains two Ultra Balls.",
  ],
  [
    "ultra_ball",
    "Winter stash",
    "You lift the lid of an insulated box and find two Ultra Balls.",
  ],
  [
    "ultra_ball",
    "Gardener’s spare kit",
    "A canvas roll tucked among the flowers holds two Ultra Balls.",
  ],
  [
    "ultra_ball",
    "Pilgrim’s supplies",
    "Two Ultra Balls are tucked under a dry niche in the wall.",
  ],
  [
    "ultra_ball",
    "Lakeside parcel",
    "You open a dry package in the reeds and find two Ultra Balls.",
  ],
  [
    "ultra_ball",
    "Maintenance box",
    "Two Ultra Balls rattle in an old observatory maintenance box.",
  ],
  [
    "ultra_ball",
    "Summit trail cache",
    "A climbing party left two Ultra Balls for the next traveler.",
  ],
  [
    "ultra_ball",
    "Grove supplies",
    "A field kit protected by the old trees holds two Ultra Balls.",
  ],
  [
    "ultra_ball",
    "Flotsam pouch",
    "A pouch washed up on the island contains two Ultra Balls.",
  ],
  [
    "ultra_ball",
    "Quarry locker",
    "You find two Ultra Balls in a dry crevice above the fossil beds.",
  ],
  [
    "ultra_ball",
    "Beacon offering",
    "Two Ultra Balls rest in a weatherproof box by the shrine.",
  ],
  [
    "ultra_ball",
    "Research supplies",
    "The researchers left two Ultra Balls for sanctuary visitors.",
  ],
];
routeData.forEach(([n, name], i) => {
  const id = `route${n}`;
  const level = Math.min(53, 7 + i * 2);
  const trainer = routeTrainers[i];
  const [item, cache, description] = trailItems[i];
  const team = habitats[i].encounters
    .slice(0, i < 4 ? 1 : 2)
    .map(({ species }) => ({ species, level }));
  obj(id, {
    id: `trainer_route${n}`,
    kind: "trainer",
    name: trainer,
    dialogue: `I know ${name} well. Let’s see how your team handles this stretch.`,
    setsFlag: `trainer_route${n}_won`,
    trainer: {
      id: `trainer_route${n}`,
      name: trainer,
      team,
      reward: level * 40,
    },
  });
  obj(id, {
    id: `item_route${n}`,
    kind: "item",
    name: cache,
    dialogue: description,
    setsFlag: `item_route${n}_found`,
    reward: { item, amount: 2 },
  });
});
// Robin's observations tie the communities together as the plot unfolds.
const scenes: [string, string, string, Requirement?][] = [
  [
    "mossford",
    "robin_mossford",
    "Meridian says its new machine will help the beacons. I hope they are right.",
    { flags: ["partner"] },
  ],
  [
    "copperwick",
    "robin_copperwick",
    "The power is being diverted from the canal. I will ask Meridian what is happening.",
    { badges: 2 },
  ],
  [
    "bellweather",
    "robin_bellweather",
    "I saw the trapped Pokémon. Vale must be stopped; I am leaving Meridian.",
    { flags: ["revelation"] },
  ],
  [
    "aster",
    "robin_aster",
    "The Engine is holding both guardians. I will help you reach the observatory.",
    { flags: ["vale_defeated"] },
  ],
];
const robinAdvice: Record<string, string> = {
  robin_mossford:
    "Did you meet Alder yet? Head west down Dewpath to Dewdrop if you still need your first partner.",
  robin_copperwick:
    "I’m watching this power line. If you’re coming from the harbor, talk to Marina about the fog signal first.",
  robin_bellweather:
    "I heard odd things about the tower. Find the bells on Pilgrim Walk, then come back and tell me what they remember.",
  robin_aster:
    "Robin’s voice comes over the radio. “Try the records office in Bellweather. Vale has the clearance for the observatory door.”",
};
scenes.forEach(([where, id, dialogue, requires]) =>
  obj(where, {
    id,
    kind: id === "robin_aster" ? "sign" : "person",
    name: id === "robin_aster" ? "Field radio" : "Robin",
    dialogue,
    requires,
    lockedDialogue: robinAdvice[id],
  }),
);
obj("reedhaven", {
  id: "ranger",
  kind: "person",
  name: "Ranger",
  dialogue:
    "Check the nest and mudflat blind in Bamboo Sanctuary. Our ranger needs both field observations for the reserve report.",
});
obj("bellweather", {
  id: "meridian_director",
  kind: "person",
  name: "Keeper",
  dialogue:
    "The bells remember what Meridian has forgotten. Follow their echo, then confront Vale at headquarters.",
});
// The Engine is inaccessible until Vale has been confronted at HQ.
const observatory = WORLD.route19.exits.find((e) => e.to === "starfall_1");
if (observatory) {
  observatory.requires = { flags: ["vale_defeated"] };
  observatory.lockedDialogue =
    "The observatory door needs Vale’s override. Confront him at Meridian HQ in Bellweather.";
}
// Vale's defeat opens the observatory; its lens earns Orion's trust before
// the eight badges can be used to disable the Engine.
const vale = WORLD.meridian_3.objects.find(
  (o) => o.id === "meridian_objective",
)!;
vale.kind = "trainer";
vale.name = "Director Vale";
vale.dialogue =
  "A permanent dawn could have saved every habitat. Show me another way!";
vale.trainer = {
  id: "director_vale",
  name: "Director Vale",
  team: [
    { species: 82, level: 46 },
    { species: 89, level: 47 },
    { species: 233, level: 48 },
  ],
  reward: 4800,
};
obj("starfall_3", {
  id: "celestial_engine",
  kind: "switch",
  name: "Celestial Engine",
  dialogue:
    "The beacons reunite. Lugia and Ho-Oh are free, and the Aurora Current flows again.",
  requires: { badges: 8, flags: ["last_lens", "vale_defeated"] },
  lockedDialogue:
    "The Engine needs all eight badges and the recovered lens to shut down safely.",
  setsFlag: "engine_stopped",
});
const leagueTeam: [string, TeamMember[]][] = [
  [
    "Rowan",
    [
      { species: 3, level: 55 },
      { species: 45, level: 55 },
      { species: 71, level: 56 },
      { species: 169, level: 56 },
    ],
  ],
  [
    "Petra",
    [
      { species: 76, level: 56 },
      { species: 208, level: 56 },
      { species: 139, level: 57 },
      { species: 248, level: 57 },
    ],
  ],
  [
    "Nyx",
    [
      { species: 94, level: 57 },
      { species: 197, level: 57 },
      { species: 200, level: 58 },
      { species: 229, level: 58 },
    ],
  ],
  [
    "Gale",
    [
      { species: 18, level: 58 },
      { species: 130, level: 58 },
      { species: 142, level: 59 },
      { species: 227, level: 59 },
    ],
  ],
  [
    "Champion Mira",
    [
      { species: 135, level: 59 },
      { species: 131, level: 59 },
      { species: 214, level: 60 },
      { species: 229, level: 60 },
      { species: 248, level: 61 },
      { species: 251, level: 62 },
    ],
  ],
];
const leagueRooms = [
  "league",
  "league_petra",
  "league_nyx",
  "league_gale",
  "league_mira",
];
leagueTeam.forEach(([name, team], i) => {
  const room = leagueRooms[i];
  if (i) {
    map(room, `Astral League · ${name}`, "interior", "mountain");
    connect(leagueRooms[i - 1], room, `${name}’s chamber`, "Previous chamber", {
      flags: [`league_${i - 1}_won`],
    });
    const onward = WORLD[leagueRooms[i - 1]].exits.find((e) => e.to === room)!;
    onward.lockedDialogue = "Defeat the specialist in this chamber to proceed.";
  }
  obj(room, {
    id: `league_${i}`,
    kind: "trainer",
    name,
    dialogue: `${name} awaits your challenge.`,
    requires: i
      ? { flags: [`league_${i - 1}_won`] }
      : { flags: ["ascent_complete"], badges: 8 },
    lockedDialogue: i
      ? `Challenge ${leagueTeam[i - 1][0]} in the previous chamber first.`
      : "Ask the wardens at Victory Ascent to open the summit gate before you challenge the League.",
    setsFlag: i === 4 ? "champion" : `league_${i}_won`,
    trainer: { id: `league_${i}`, name, team, reward: 5000 },
  });
});
connect(
  "league_mira",
  "league",
  "Hall of Fame return",
  "Hall of Fame",
  {
    flags: ["champion"],
  },
  {
    flags: ["champion"],
  },
);
populateRequests(WORLD, QUESTS);
const legendary: [string, string, number, Requirement][] = [
  ["frostvault_3", "Articuno", 144, { ability: "waterfall" }],
  ["copperworks_3", "Zapdos", 145, { flags: ["champion"] }],
  ["ember_3", "Moltres", 146, { ability: "rockSmash" }],
  ["meridian_3", "Mewtwo", 150, { flags: ["champion"] }],
  ["route21", "Mew", 151, { caught: 100 }],
  ["route22", "Raikou", 243, { flags: ["champion"] }],
  ["route23", "Entei", 244, { flags: ["champion"] }],
  ["route24", "Suicune", 245, { flags: ["champion"] }],
  ["undertow_3", "Lugia", 249, { ability: "whirlpool" }],
  ["echo_3", "Ho-Oh", 250, { flags: ["champion"] }],
  ["aurora_3", "Celebi", 251, { flags: ["champion", "aurora_restored"] }],
];
const guardianAdvice: Record<number, string> = {
  144: "A frozen cascade hides the roost. Lyra’s badge grants Waterfall and opens the way to Articuno.",
  145: "The intake is still too unstable for Zapdos. The keepers will finish repairs after your League challenge.",
  146: "The old ore vault is behind fractured rock. Return with Rock Smash from Flint.",
  150: "The lab capsule is sealed. It can be opened once the League recognizes your work restoring the beacons.",
  151: "The oldest tree stirs. Return with records of at least 100 different species from your journey.",
  243: "The island beacon remains dark until a trainer from Astra enters the Hall of Fame.",
  244: "Heat rises from the quarry stone. The beacon can call Entei once you reach the Hall of Fame.",
  245: "The moonwater shrine needs a fully restored current. Return after the League challenge.",
  249: "An eddy covers the deep tunnel. Neve’s badge teaches Whirlpool, which can calm it.",
  250: "The top bell sounds only after the League recognizes the work of the eight keepers.",
  251: "The grove is quiet. Record both sanctuary watches and restore the nursery to call Celebi.",
};
legendary.forEach(([where, name, species, requires]) =>
  obj(where, {
    id: `legendary_${species}`,
    kind: "legendary",
    name,
    dialogue: `${name} is waiting. The guardian will return if you cannot catch it.`,
    requires,
    lockedDialogue: guardianAdvice[species],
    setsFlag: `caught_legendary_${species}`,
    trainer: {
      id: `legendary_${species}`,
      name,
      team: [{ species, level: 60 }],
    },
    repeatable: true,
  }),
);

const rivals: [string, string, number, number, Requirement?][] = [
  ["route02", "rival_1", 12, 16],
  ["route06", "rival_2", 22, 17, { badges: 2 }],
  ["route12", "rival_3", 34, 18, { badges: 4 }],
  ["route18", "rival_4", 47, 18, { badges: 7 }],
];
rivals.forEach(([where, id, level, bird, requires]) =>
  obj(where, {
    id,
    kind: "trainer",
    name: "Robin",
    dialogue: "Let’s see how far we have come together!",
    requires,
    setsFlag: `${id}_won`,
    trainer: {
      id,
      name: "Robin",
      team: [
        { species: bird, level },
        { species: 133, level: level + 1 },
      ],
      reward: level * 80,
    },
  }),
);

const townFlavor: Record<string, string> = {
  dewdrop:
    "Alder’s garden points toward the lab. The first beacon watches over the village.",
  mossford:
    "The orchard windmills turn with the breeze. A courier prepares a delivery for Bramble.",
  bramble: "Lanterns mark the forest path. Fern keeps the Canopy beacon.",
  tideglass:
    "The fog signal guides ships through the harbor. Marina tends the Tidal beacon.",
  copperwick:
    "Canals carry water past the workshops. The beacon dims whenever the power fails.",
  sunspire:
    "Glass catches the desert sun above the oasis. The old stones remember its path.",
  reedhaven:
    "The market and camp sit on opposite sides of the reed beds. The sanctuary is on higher ground.",
  cinderfall:
    "The washhouse stands below the springs. The mine trail climbs between the high roofs.",
  rimepeak:
    "The mountain pass glitters with snow. Travelers rest here before the ascent.",
  bellweather:
    "Every bell has a memory. Listen closely to learn what Meridian has hidden.",
  aster:
    "The observatory watches the stars while the last beacon waits for its lens.",
  crown:
    "Beyond the ascent, the Astral League awaits those who have restored the beacons.",
};
for (const [id] of townData)
  obj(id, {
    id: `sign_${id}`,
    kind: "sign",
    name: "Town guide",
    dialogue: townFlavor[id],
  });
// Optional trainers provide experience between each community and its keeper.
// Their placement is selected from open cells after the authored terrain is built.
const firstRival = WORLD.route02.objects.find((o) => o.id === "rival_1")!;
firstRival.trainer!.team.forEach((mon, i) => {
  mon.level = 8 + i;
});
function freePosition(m: WorldMap): [number, number] {
  const cx = Math.floor(m.width / 2),
    cy = Math.floor(m.height / 2),
    candidates: [number, number][] = [];
  for (let y = 2; y < m.height - 2; y++)
    for (let x = 2; x < m.width - 2; x++)
      if (
        !"#rw~".includes(m.tiles[y][x]) &&
        m.objects.every((o) => Math.hypot(o.x - x, o.y - y) >= 2.5) &&
        m.exits.every((e) => Math.hypot(e.x - x, e.y - y) >= 2)
      )
        candidates.push([x, y]);
  candidates.sort(
    (a, b) =>
      Math.abs(a[0] - cx) +
      Math.abs(a[1] - cy) -
      Math.abs(b[0] - cx) -
      Math.abs(b[1] - cy),
  );
  if (!candidates.length) throw Error(`No trainer position in ${m.id}`);
  return candidates[0];
}
for (let i = 0; i < 20; i++) {
  const m = habitats[i],
    base = Math.max(5, 5 + i * 2);
  for (let j = 0; j < 2; j++) {
    const [x, y] = freePosition(m),
      name = `${["Youngster", "Picnicker", "Backpacker", "Ranger"][(i + j) % 4]} ${["Nell", "Kai", "Mika", "Tess", "Ollie"][(i * 2 + j) % 5]}`;
    const species = m.encounters[(j + 2) % m.encounters.length]?.species ?? 19;
    obj(m.id, {
      id: `${m.id}_optional_${j}`,
      kind: "trainer",
      name,
      x,
      y,
      dialogue: "Let’s practice together before the road ahead!",
      setsFlag: `${m.id}_optional_${j}_won`,
      trainer: {
        id: `${m.id}_optional_${j}`,
        name,
        team: [{ species, level: base + j }],
        reward: (base + j) * 35,
      },
    });
  }
}
// Evolution supplies can be found in the world as well as bought at later marts.
const evolutionSupplies: [string, string, string, Requirement?][] = [
  ["route02", "fire_stone", "Fire Stone"],
  ["route04", "water_stone", "Water Stone"],
  ["route07", "thunder_stone", "Thunder Stone"],
  ["route10", "leaf_stone", "Leaf Stone"],
  ["hourglass_3", "sun_stone", "Sun Stone"],
  ["route14", "moon_stone", "Moon Stone"],
  ["ember_3", "metal_coat", "Metal Coat"],
  ["undertow_3", "kings_rock", "King’s Rock"],
  ["route18", "dragon_scale", "Dragon Scale"],
  ["meridian_3", "up_grade", "Up-Grade"],
  ["route16", "link_cable", "Link Cable"],
  ["route20", "link_cable", "Link Cable"],
];
evolutionSupplies.forEach(([where, item, name], i) => {
  const m = WORLD[where],
    [x, y] = m.kind === "dungeon" ? [0, 0] : freePosition(m);
  obj(where, {
    id: `evolution_supply_${i}`,
    kind: "item",
    x,
    y,
    name,
    dialogue: `You found a ${name}!`,
    setsFlag: `evolution_supply_${i}_found`,
    reward: { item },
  });
});
// Three partner displays flank Alder; the professor remains reachable from the door.
{
  const m = WORLD.lab,
    grid = m.tiles.map((row) => row.split(""));
  const alder = m.objects.find((o) => o.id === "alder")!;
  alder.x = 12;
  alder.y = 4;
  for (const x of [8, 10, 14]) grid[4][x] = "S";
  grid[4][12] = ".";
  m.tiles = grid.map((row) => row.join(""));
}

// Dialogue carries the beacon survey through each location; flags and rewards
// remain independent from the prose so saved progression stays stable.
const dungeonStory: Record<string, { name: string; dialogue: string }> = {
  lantern: {
    name: "Stranded surveyor",
    dialogue:
      "You free the surveyor from the fallen branch. “Thank you! The beacon dimmed when Meridian’s machines arrived. Fern needs to hear this.” The surveyor marks a safe trail back to Bramble.",
  },
  undertow: {
    name: "Fog signal",
    dialogue:
      "You clear the horn mouth. Air rushes through the exposed pipe and the foghorn sounds across the quay. A clear signal sweeps the harbor. Marina discovers a Meridian intake pipe drawing water away from the cave and asks you to follow it inland.",
  },
  copperworks: {
    name: "Power regulator",
    dialogue:
      "You reconnect the town’s power. A maintenance log shows Meridian diverted the beacon’s current to its desert installation. Robin reads the record in disbelief: “They told us the brownouts were accidents.”",
  },
  hourglass: {
    name: "Ancient beacon lens",
    dialogue:
      "The shaft of light falls across the buried lens. Its inscription says the beacons guide living migrations, not merely electricity. Sable asks you to carry that warning to the Reedhaven rangers.",
  },
  bamboo: {
    name: "Ranger report",
    dialogue:
      "The ranger lays your nest and burrow sketches over last year’s shoreline. Both sites used to be underwater at high tide. The census agrees: Pokémon are leaving drained habitats. The report identifies a Meridian shipment bound for Ember Mine. The ranger asks you to stop it.",
  },
  ember: {
    name: "Captive Pokémon",
    dialogue:
      "Both wagons stand empty. You strike the two passengers from the manifest. The miner says Meridian wanted their heat to feed the Engine. Flint promises to shelter them and restore the city’s beacon.",
  },
  frostvault: {
    name: "Icebound pass",
    dialogue:
      "The thawed channels carry warm water through the frozen gate. The mountain pass opens again. Neve finds a Meridian badge beside the abandoned pump: the freezing was caused by a deliberate diversion.",
  },
  echo: {
    name: "Beacon memory",
    dialogue:
      "The bells replay an old keeper’s warning: the Aurora Current must change with the seasons. Robin hears it too. “I believed Meridian was protecting Astra. I was wrong.” Together you decide to confront Vale.",
  },
  meridian: {
    name: "Director Vale",
    dialogue:
      "Vale studies the restored beacon records. “A storm once took everything I loved. A permanent dawn could prevent another loss.” He challenges you to prove Astra can be protected without controlling it.",
  },
  starfall: {
    name: "Final beacon lens",
    dialogue:
      "The constellations converge on the last lens. Orion can now restore the Astral beacon. Beyond the glass, the Celestial Engine holds the currents of Lugia and Ho-Oh in a trembling artificial dawn.",
  },
  victory: {
    name: "Summit gate",
    dialogue:
      "You tie your line beside the names of the trainers who climbed before you. The path to the Astral League is clear. Rest at the center, then meet the four specialists and Champion Mira when you are ready.",
  },
  aurora: {
    name: "Restored sanctuary",
    dialogue:
      "The researchers lay your day and night entries side by side. Both halves of the migration are back. The restored current moves through its trees in a gentle cycle. The researchers can continue their work, and Celebi’s sanctuary is open to respectful visitors.",
  },
};
for (const id of Object.keys(expeditions)) {
  const o = WORLD[`${id}_3`].objects.find((o) => o.id === `${id}_objective`)!;
  Object.assign(o, dungeonStory[id]);
}
const valeStory = WORLD.meridian_3.objects.find(
  (o) => o.id === "meridian_objective",
)!;
valeStory.victoryDialogue =
  "Vale lowers his keycard. “I mistook stillness for safety. Take this; the Engine is yours to stop. I will help the communities repair what I damaged.”";
const engineStory = WORLD.starfall_3.objects.find(
  (o) => o.id === "celestial_engine",
)!;
engineStory.dialogue =
  "All eight badges illuminate the lens. The Engine winds down, releasing Lugia and Ho-Oh’s currents into the sky. Dawn gives way to moving clouds. Robin smiles: “Astra gets to choose its own tomorrow.”";
const leaderVictory = [
  "Take the Canopy Badge. Cut opens our old groves! On the east road, follow the safe trail marked by the surveyor from Lantern Wood.",
  "You brought the harbor its light and earned the Tidal Badge. Surf will carry you across the marked shallows.",
  "Take the Dynamo Badge! The dune lamps and the Tideglass ferry signal are lit. Head into the dunes for Sable, or cross to Reedhaven for Flint and Neve. The three keepers will meet you in any order.",
  "You listened to the ruins and earned the Mirage Badge. Strength will move the marked boulders in your path.",
  "You stood up for the Pokémon in the mine. Take the Ember Badge; Rock Smash will open cracked walls.",
  "You reopened the pass and earned the Rime Badge. Whirlpool will calm the marked marine currents.",
  "You heard the truth in the bells and earned the Chime Badge. Waterfall opens the summit pools.",
  "The final lens shines because you trusted the keepers. Take the Astral Badge and Fly between towns you have visited.",
];
leaders.forEach((_, i) => {
  WORLD[`gym${i + 1}`].objects.find(
    (o) => o.id === `leader_${i + 1}`,
  )!.victoryDialogue = leaderVictory[i];
});
const champion = WORLD.league_mira.objects.find((o) => o.id === "league_4")!;
champion.dialogue =
  "I am Mira, Champion of the Astral League. You brought the beacons together without asking Astra to stand still. Let us see the strength of the bond that carried you here.";
champion.victoryDialogue =
  "Champion Mira welcomes you to the Hall of Fame. Across Astra, the beacons glow with the changing sky. Robin and Alder await your next discovery: the living atlas of all 251 species. Take Aurora Trail west from Dewdrop to reach the restored sanctuary.";
const townVoices: Record<string, [string, string][]> = {
  dewdrop: [
    [
      "Gardener",
      "The flowers follow the morning light. Alder says the beacons help migrating Pokémon find their way.",
    ],
    [
      "Neighbor",
      "Robin has always wanted to make Astra safer. The two of you used to race down Dewpath.",
    ],
  ],
  mossford: [
    [
      "Miller",
      "The orchard windmills should turn steadily, but the wind has been strange since the beacon dimmed.",
    ],
    [
      "Courier’s friend",
      "The courier has a delivery for Bramble. Perhaps you could carry it along Orchard Lane.",
    ],
  ],
  bramble: [
    [
      "Woodcutter",
      "Lantern Wood used to be easy to cross. Follow the leaf trail if you go looking for the surveyor.",
    ],
    [
      "Keeper’s apprentice",
      "Fern takes challengers as soon as they arrive. The silkhouse has a straight aisle between the nursery beds.",
    ],
  ],
  tideglass: [
    [
      "Sailor",
      "Without the fog signal, boats wait outside the harbor. The cave sluices feed the lighthouse.",
    ],
    [
      "Dockworker",
      "The tide leaves old stones and unusual Pokémon along the shore. Surf can reach the distant crossing.",
    ],
  ],
  copperwick: [
    [
      "Mechanic",
      "The lights go out whenever Meridian’s new line draws power. The Switchyard leads to Copperworks.",
    ],
    [
      "Canal resident",
      "We were promised cleaner power. I only want the pumps to work and the water to keep moving.",
    ],
  ],
  sunspire: [
    [
      "Glassblower",
      "The old lens was made to follow the sun, not trap it. The ruins still hold its markings.",
    ],
    [
      "Oasis traveler",
      "Take water for the road. The rangers beyond the dunes know every trail through the reeds.",
    ],
  ],
  reedhaven: [
    [
      "Ranger apprentice",
      "Our census keeps track of which habitats are recovering. Please record what you catch.",
    ],
    [
      "Bridge keeper",
      "Our nesting platforms used to sit at the waterline. Take a field note in each blind and the ranger can work out where the water went.",
    ],
  ],
  cinderfall: [
    [
      "Miner",
      "Meridian sealed a lower tunnel and brought cages through after dark. The Pokémon sounded frightened.",
    ],
    [
      "Bath attendant",
      "The kiln tenders pipe spare heat into the refuge. They have beds ready for the Pokémon in Ember Mine.",
    ],
  ],
  rimepeak: [
    [
      "Climber",
      "The pass froze almost overnight. A pump in Frostvault once carried warm water beneath it.",
    ],
    [
      "Herbalist",
      "Snow herbs grow in the cavern. Mossford’s healer has been waiting for a fresh supply.",
    ],
  ],
  bellweather: [
    [
      "Bell keeper",
      "The bells remember more than any one person. Their tones can open the tower’s inner chamber.",
    ],
    [
      "Pilgrim",
      "Robin came through looking worried. They asked whether the ancient keepers feared the dark.",
    ],
  ],
  aster: [
    [
      "Astronomer",
      "The observatory charts a moving sky. Orion says the last lens can bring its beacon back.",
    ],
    [
      "Student",
      "The Engine makes a sunrise that never changes. Even the migrating Pokémon seem confused.",
    ],
  ],
  crown: [
    [
      "Mountaineer",
      "Victory Ascent has a gate built to test every keeper’s trust. The League lies just beyond.",
    ],
    [
      "League attendant",
      "Mira has six Pokémon, up to Lv 62. The trainers on Crown Road will practice with you before you register.",
    ],
  ],
};
for (const [id] of townData)
  townVoices[id].forEach(([name, dialogue], i) => {
    const m = WORLD[id],
      [x, y] = freePosition(m);
    obj(id, {
      id: `resident_${id}_${i}`,
      kind: "person",
      name,
      dialogue,
      x,
      y,
    });
  });
for (const [, id] of rivals) {
  const o = Object.values(WORLD)
    .flatMap((m) => m.objects)
    .find((o) => o.id === id)!;
  o.victoryDialogue =
    id === "rival_1"
      ? "You and your partner are already a great team. I’ll keep training too!"
      : id === "rival_2"
        ? "That was close! I still believe Meridian can help, but I want to understand the power records."
        : id === "rival_3"
          ? "The rangers’ report is hard to ignore. I’m going to find out what Meridian is hiding."
          : "We can protect Astra together. Let’s stop the Engine and meet again after the League.";
}

// Both sides of a seam use the very same tile survey as the regional chart.
for (const [n, , from, to] of routeData) {
  const spec = routes[n];
  const route = WORLD["route" + n];
  const points = localTrail(spec);
  function seam(townId: string, side: Direction, [x, y]: [number, number]) {
    const town = settlements[townId as keyof typeof settlements];
    const a = WORLD[townId].exits.find(e => e.to === route.id)!;
    const b = route.exits.find(e => e.to === townId)!;
    a.x = b.toX = x + spec.x - town.x + (side === "east" ? -1 : side === "west" ? 1 : 0);
    a.y = b.toY = y + spec.y - town.y + (side === "south" ? -1 : side === "north" ? 1 : 0);
    b.x = a.toX = x;
    b.y = a.toY = y;
    a.direction = side;
    b.direction = opposite[side];
    a.span = b.span = 1;
  }
  seam(from, spec.departure, points[0]);
  if (spec.arrival) seam(to, spec.arrival, points.at(-1)!);
}

for (const m of Object.values(WORLD))
  for (const e of m.exits) {
    if (e.direction) continue;
    const dest = WORLD[e.to];
    e.entrance =
      (m.id.startsWith("league") && dest.id.startsWith("league")) ||
      (m.kind === "dungeon" && dest.kind === "dungeon")
        ? "stairs"
        : (m.kind === "interior" || m.kind === "gym") && dest.kind === "town"
          ? "mat"
          : m.kind === "dungeon" || dest.kind === "dungeon"
            ? "cave"
            : "door";
    if (e.entrance === "mat") e.width = 2;
  }

composeGeography(WORLD);

const facings = ["down", "left", "up", "right"] as const;
for (const m of Object.values(WORLD)) {
  m.objects.forEach((o, i) => {
    if (["person", "healer", "shop", "starter"].includes(o.kind)) {
      o.facing ??= facings[(i + m.id.length) % facings.length];
      if (o.kind === "person" && o.id.startsWith("resident_")) o.roam = 1;
    }
  });
}
for (const m of Object.values(WORLD)) {
  for (const e of m.exits) {
    if (!e.requires) continue;
    const ability = e.requires.ability;
    const kind = !e.direction
      ? "shutter"
      : ability && ability !== "fly"
        ? ability
        : "warden";
    e.barrier = {
      kind,
      flag:
        kind !== "warden" && kind !== "surf" && kind !== "shutter"
          ? e === quarryCut ? "field_quarry_cut" : `field_${e.to.startsWith("route") ? e.to : m.id}`
          : undefined,
    };
  }
}
// Poses for story characters.
for (const [mapId, id, facing] of [
  ["dewdrop", "robin_start", "down"],
  ["mossford", "quest_parcel", "left"],
] as const) {
  const o = WORLD[mapId].objects.find((object) => object.id === id);
  if (o) o.facing = facing;
}
// The road span is one tile on either side of its center. Keep the matching
// destination's edge and inner approach clear for every preserved lateral offset.
for (const m of Object.values(WORLD)) {
  const roads = m.exits.filter((e) => e.direction);
  if (!roads.length) continue;
  const grid = m.tiles.map((row) => row.split(""));
  for (const e of roads)
    for (let lateral = -1; lateral <= 1; lateral++)
      for (let inset = 0; inset <= 1; inset++) {
        const vertical = e.direction === "north" || e.direction === "south";
        const x =
          e.x + (vertical ? lateral : e.direction === "west" ? inset : -inset);
        const y =
          e.y +
          (vertical ? (e.direction === "north" ? inset : -inset) : lateral);
        if (
          x >= 0 &&
          y >= 0 &&
          x < m.width &&
          y < m.height &&
          !"rwd".includes(grid[y][x])
        )
          grid[y][x] = "~=".includes(grid[y][x]) ? "=" : ".";
      }
  m.tiles = grid.map((row) => row.join(""));
}

// Surf is a physical crossing. Once the buoys on the arc are open, the same
// water at both shores keeps movement and the rider sprite continuous.
for (const m of Object.values(WORLD)) {
  const grid = m.tiles.map((row) => row.split(""));
  for (const e of m.exits) {
    if (!e.direction) continue;
    const peer = WORLD[e.to].exits.find(
      (other) => other.to === m.id && other.x === e.toX && other.y === e.toY,
    );
    if (e.barrier?.kind !== "surf" && peer?.barrier?.kind !== "surf") continue;
    const vertical = e.direction === "north" || e.direction === "south";
    for (let lateral = -1; lateral <= 1; lateral++) {
      const x = e.x + (vertical ? lateral : 0);
      const y = e.y + (vertical ? 0 : lateral);
      grid[y][x] = "~";
    }
  }
  m.tiles = grid.map((row) => row.join(""));
}
