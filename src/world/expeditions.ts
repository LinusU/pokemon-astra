import type { Requirement, WorldMap, WorldObject } from "./index";
import { dungeonPlans } from "./dungeon-plans";

export type FieldDevice =
  | "breaker"
  | "carillon"
  | "telescope"
  | "float"
  | "fossil"
  | "forge"
  | "promise"
  | "atlas";
export interface Fieldwork {
  device?: FieldDevice;
  approach?: "west" | "south";
  approachHint?: string;
  light?: "day" | "night";
  camp?: boolean;
  disappear?: boolean;
  appearsAfter?: string;
  afloat?: boolean;
  solid?: boolean;
  illustration?: string;
}
type Actor = Omit<WorldObject, "x" | "y">;
type Site = {
  name: string;
  palette: string;
  finish: string;
  steps: string[];
  clue: [string, string];
  crew: [string, string, number, number, string];
  actors: Actor[];
  gates?: [Requirement | undefined, Requirement | undefined];
  shortcut: string;
};
function landmark(
  id: string,
  name: string,
  dialogue: string,
  flag?: string,
  field?: Fieldwork,
  requires?: Requirement,
): Actor {
  return { id, name, dialogue, setsFlag: flag, kind: "switch", field, requires };
}
function resident(
  id: string,
  species: number,
  name: string,
  text: string,
  flag: string,
  field?: Fieldwork,
): Actor {
  return { ...landmark(id, name, text, flag, field), kind: "sign", wildlife: species };
}
export const expeditions: Record<string, Site> = {
  lantern: {
    name: "Lantern Wood",
    palette: "autumn",
    finish: "surveyor",
    steps: [],
    clue: [
      "Moth scout’s ribbon",
      "Lost? Pale moths feed on pairs of lantern blooms. Follow the paired flowers through the fallen wood. The solitary blooms lead to the old snare.",
    ],
    crew: [
      "Moth Scout Pia",
      "bugCatcher",
      48,
      9,
      "My Venonat can find its way home on a moonless night. Can yours?",
    ],
    shortcut: "Surveyor’s rope trail",
    actors: [
      landmark(
        "lantern_tracks",
        "Abandoned snare",
        "A single bloom hangs from an empty loop. The paired blossoms on the other trail have fresh boot prints.",
        undefined,
        { illustration: "rope" },
      ),
    ],
  },
  undertow: {
    name: "Undertow Cave",
    palette: "coast",
    finish: "fog_signal",
    steps: ["undertow_sluice"],
    clue: [
      "Tide staff",
      "See the white barnacle line? A bar of shells runs under the breathing pool. Pull the relief wheel on the near bank to uncover it.",
    ],
    crew: [
      "Shell Diver Nori",
      "fisher",
      90,
      15,
      "Shellder snaps shut just before the pool exhales. That’s my cue to dive.",
    ],
    shortcut: "Horn keeper’s ladder",
    gates: [undefined, { flags: ["low_tide"] }],
    actors: [
      landmark(
        "undertow_sluice",
        "Relief wheel",
        "The water curls into the drain. A pale shell bar breaks the surface all the way to the horn stair.",
        "low_tide",
        { illustration: "wheel" },
      ),
    ],
  },
  copperworks: {
    name: "Copperworks",
    palette: "industrial",
    finish: "power_restored",
    steps: ["copper_breaker"],
    clue: [
      "Night shift ticket",
      "Keep the clinic and canal pumps live. Find the feeder drawing current after its building has closed. Take the alley ladder up to the meter loft for the night readings.",
    ],
    crew: [
      "Cable Splicer Dot",
      "scientist",
      81,
      21,
      "Magnemite pulls harder on a live cable. Watch which way its magnets point.",
    ],
    shortcut: "Turbine service lift",
    gates: [undefined, { flags: ["relay_on"] }],
    actors: [
      landmark(
        "copper_load",
        "Night load meter",
        "CLINIC · 4 lamps lit. PUMP · 2 screws turning. FOUNDRY · 9 furnaces drawing power. The foundry has been cold for weeks.",
        undefined,
        { illustration: "meter" },
      ),
      landmark(
        "copper_breaker",
        "Feeder isolator",
        "The foundry meter falls to zero. The clinic lamps stay lit. Behind the false feeder, a live cable leads to Meridian’s intake.",
        "relay_on",
        { device: "breaker", illustration: "meter" },
      ),
    ],
  },
  hourglass: {
    name: "Hourglass Ruins",
    palette: "desert",
    finish: "lens_restored",
    steps: ["hourglass_mirror"],
    clue: [
      "Shadow frieze",
      "A traveler stands on the long western shadow, looking east into a disk. A band of glass runs from the disk to a buried doorway.",
    ],
    crew: [
      "Glass Cutter Tes",
      "scientist",
      27,
      26,
      "Stand where the glass casts a shadow. From there you can see straight through it.",
    ],
    shortcut: "Sand chute",
    gates: [undefined, { flags: ["stone_aligned"] }],
    actors: [
      landmark(
        "hourglass_mirror",
        "Slotted sun disk",
        "From the shadow, you sight the eastern notch. The beam melts a strip of sand into a glass causeway.",
        "stone_aligned",
        {
          approach: "west",
          approachHint: "The disk dazzles from here. Stand on the shadow due west of it and face east.",
          illustration: "disk",
        },
      ),
    ],
  },
  bamboo: {
    name: "Bamboo Sanctuary",
    palette: "wetland",
    finish: "ranger_report",
    steps: ["bamboo_nest", "bamboo_bank"],
    clue: [
      "Ranger’s field book",
      "I can’t count the missing birds from camp. Look inside the dry nest at the east end of the boardwalk and under the exposed bank in the mudflat blind. Either order is fine.",
    ],
    crew: [
      "Reed Warden Fen",
      "fisher",
      194,
      25,
      "Wooper’s gills tell me more about these pools than any water gauge.",
    ],
    shortcut: "Ranger’s ferry",
    actors: [
      landmark(
        "bamboo_nest",
        "Stranded nest",
        "The woven nest is high above the new waterline. You sketch the dry band of silt beneath the eggs.",
        "bamboo_nesting",
        { illustration: "nest" },
      ),
      resident(
        "bamboo_bank",
        194,
        "Mudflat Wooper",
        "One Wooper shelters under a plank. Its usual pool is empty. You mark the exposed burrow beside the dry nest on the ranger’s map.",
        "bamboo_burrow",
      ),
    ],
  },
  ember: {
    name: "Ember Mine",
    palette: "volcanic",
    finish: "pokemon_freed",
    steps: ["ember_dispatcher", "ember_cyndaquil", "ember_slugma"],
    clue: [
      "Freight manifest",
      "Two passengers, no destination on the docket. The dispatcher holds the siding key. Once inside, open both wagons and send the passengers to Flint’s refuge.",
    ],
    crew: [
      "Kiln Tender Solvi",
      "kilnKeeper",
      218,
      31,
      "Slugma can keep a kiln warm all winter. The handlers here don’t deserve their help.",
    ],
    shortcut: "Empty ore tram",
    gates: [undefined, { flags: ["mine_clear"] }],
    actors: [
      {
        id: "ember_dispatcher",
        name: "Freight Boss Rusk",
        kind: "trainer",
        sprite: "hiker",
        dialogue: "Those wagons leave on my whistle. If you want my siding key, earn it.",
        victoryDialogue: "Take the key. Two locks, two passengers. Neither of them signed on for this shift.",
        setsFlag: "mine_clear",
        trainer: {
          id: "ember_dispatcher",
          name: "Freight Boss Rusk",
          team: [
            { species: 109, level: 31 },
            { species: 75, level: 32 },
          ],
          reward: 900,
        },
      },
      resident(
        "ember_cyndaquil",
        155,
        "Sooty Cyndaquil",
        "Cyndaquil slips out of the straw and sneezes a puff of soot. A kiln tender wraps it in an apron for the trip home.",
        "ember_kit_safe",
        { disappear: true },
      ),
      resident(
        "ember_slugma",
        218,
        "Crated Slugma",
        "You lift the iron grate. Slugma flows down the ramp, leaving a warm red line all the way to the refuge tram.",
        "ember_slug_safe",
        { disappear: true },
      ),
    ],
  },
  frostvault: {
    name: "Frostvault Cavern",
    palette: "snow",
    finish: "pass_open",
    steps: ["frost_plug"],
    clue: [
      "Spa engineer’s sketch",
      "A blue plug of ice jams the steam cut. Walk up behind it from the west and push it along the groove into the hissing vent. The warm draft will do the rest.",
    ],
    crew: [
      "Spa Patroller Lumi",
      "skier",
      220,
      38,
      "Swinub feels the hot spring long before I see steam coming through the snow.",
    ],
    shortcut: "Patrol toboggan run",
    gates: [undefined, { flags: ["ice_thawed"] }],
    actors: [
      landmark(
        "frost_plug",
        "Blue ice plug",
        "The plug drops into the exhaust cup and melts. A plume of warm air clears the upper pass.",
        "ice_thawed",
        {
          illustration: "ice",
          solid: true,
          disappear: true,
          approach: "west",
          approachHint:
            "The groove runs east. Stand directly west of the blue ice and push toward the steaming cup.",
        },
      ),
    ],
  },
  echo: {
    name: "Echo Bell Tower",
    palette: "violet",
    finish: "revelation",
    steps: ["echo_carillon"],
    clue: [
      "Choir stall carving",
      "The old watch climbed from the harbor to the roof, then came halfway home. The three ropes are marked Harbor (low), Street (middle), and Roof (high).",
    ],
    crew: [
      "Cantor Nell",
      "medium",
      200,
      43,
      "Misdreavus always sings the missing note. Listen to the room when it falls quiet.",
    ],
    shortcut: "Bell rope stair",
    gates: [undefined, { flags: ["bell_rung"] }],
    actors: [
      landmark(
        "echo_carillon",
        "Three-rope carillon",
        "The last note hangs in the air. A wax cylinder starts turning in the archive overhead.",
        "bell_rung",
        { device: "carillon", illustration: "bell" },
      ),
    ],
  },
  meridian: {
    name: "Meridian HQ",
    palette: "industrial",
    finish: "vale_defeated",
    steps: ["meridian_clerk", "meridian_deposition"],
    clue: [
      "Visitors’ register",
      "Request a staff pass from the night clerk at the east desk. The marshal on the loading dock also issues passes to anyone who defeats his security partner.",
    ],
    crew: [
      "Lobby Marshal Venn",
      "scientist",
      233,
      45,
      "Battle clearance? Beat my Porygon2 and I’ll swipe you into records myself.",
    ],
    shortcut: "Director’s express lift",
    gates: [{ flags: ["keycard"] }, { flags: ["meridian_evidence"] }],
    actors: [
      {
        id: "meridian_clerk",
        kind: "person",
        sprite: "clerk",
        name: "Night clerk Ina",
        dialogue:
          "I filed those overtime slips myself. They ran the intake every night the harbor went dark. Here’s my staff pass. Take the signed copy upstairs.",
        setsFlag: "keycard",
      },
      landmark(
        "meridian_deposition",
        "Signed diversion order",
        "The top copy blames the storm. The carbon underneath bears Vale’s signature beside the hours of every brownout. You take the carbon to his office.",
        "meridian_evidence",
        { illustration: "file" },
      ),
    ],
  },
  starfall: {
    name: "Starfall Observatory",
    palette: "night",
    finish: "last_lens",
    steps: ["starfall_scope"],
    clue: [
      "Glass negative",
      "Twin stars mark the guardian’s eye. Center the eye in the telescope’s brass crosshair. Turn the two mount wheels separately.",
    ],
    crew: [
      "Plate Keeper Ivo",
      "astronomer",
      164,
      48,
      "Noctowl can hold a pose for an entire exposure. I’ve never managed it myself.",
    ],
    shortcut: "Observer’s spiral stair",
    gates: [undefined, { flags: ["stars_aligned"] }],
    actors: [
      landmark(
        "starfall_scope",
        "Equatorial telescope",
        "Two points of light merge in the sight. The counterweight releases and the final beacon lens rolls into its cradle.",
        "stars_aligned",
        { device: "telescope", illustration: "scope" },
      ),
    ],
  },
  victory: {
    name: "Victory Ascent",
    palette: "mountain",
    finish: "ascent_complete",
    steps: ["victory_crag"],
    clue: [
      "Ascent register",
      "Pick your pitch. Smash the west scree into footholds, or climb the east cataract with Waterfall. Both lines meet at the cairn of names.",
    ],
    crew: [
      "Rope Captain Tor",
      "mountaineer",
      207,
      54,
      "Gligar sets the high anchor. I get the job of carrying all the rope.",
    ],
    shortcut: "Summit rappel",
    gates: [undefined, { flags: ["summit_open"] }],
    actors: [
      landmark(
        "victory_crag",
        "West scree pitch",
        "Rock Smash breaks the shale lip into a staircase. You fix a line up the west pitch.",
        "summit_open",
        { illustration: "rope" },
        { ability: "rockSmash" },
      ),
      landmark(
        "victory_falls",
        "East waterfall pitch",
        "You climb the cataract with Waterfall and fix a safety line for the return. The summit ridge is open.",
        "summit_open",
        { illustration: "wheel" },
        { ability: "waterfall" },
      ),
    ],
  },
  aurora: {
    name: "Aurora Sanctuary",
    palette: "night",
    finish: "aurora_restored",
    steps: ["aurora_pollen", "aurora_spawn"],
    clue: [
      "Phenology notebook",
      "Log a daylight pollen flight and a night spawning ripple. The research tents let you wait for either watch. No catches needed.",
    ],
    crew: [
      "Field Ecologist Rue",
      "scientist",
      154,
      56,
      "Meganium’s breath brings the meadow into flower. Watch who shows up to feed.",
    ],
    shortcut: "Nursery footbridge",
    actors: [
      resident(
        "aurora_pollen",
        12,
        "Dawn pollinator",
        "Butterfree opens its wings in the sun. Yellow dust rises from the primroses. The pollen flight is back on the daylight watch.",
        "aurora_day_record",
        { light: "day" },
      ),
      resident(
        "aurora_spawn",
        194,
        "Moon pool watch",
        "By moonlight, strings of Wooper eggs shine like beads. You enter the first spawning record since the Engine stopped.",
        "aurora_night_record",
        { light: "night" },
      ),
      landmark("aurora_camp", "Meadow tent", "Change watch at the field tent.", undefined, {
        camp: true,
        illustration: "tent",
      }),
      landmark("aurora_hide", "Pool hide", "Change watch at the pool hide.", undefined, {
        camp: true,
        illustration: "tent",
      }),
    ],
  },
};

type Branch = [from: number, to: number, mark: "+" | "^", requires?: Requirement, hint?: string];
export const sidePassages: Record<string, Branch[]> = {
  undertow: [
    [
      3,
      4,
      "+",
      { ability: "surf" },
      "The pilot’s sound is a flooded sea tunnel. Come back with Marina’s Surf.",
    ],
  ],
  copperworks: [
    [1, 4, "+"],
    [2, 4, "^"],
  ],
  echo: [
    [
      3,
      4,
      "+",
      { flags: ["echo_impression"] },
      "The door blends into the wax shelves. Read the unmarked cylinder with Flash.",
    ],
  ],
  meridian: [
    [1, 4, "+"],
    [2, 4, "^"],
  ],
};
export const finalNeeds: Record<string, string[]> = {
  bamboo: ["bamboo_nesting", "bamboo_burrow"],
  ember: ["ember_kit_safe", "ember_slug_safe"],
  aurora: ["aurora_day_record", "aurora_night_record"],
};
export function expeditionCrew(id: string): Actor {
  const [name, sprite, species, level, dialogue] = expeditions[id].crew;
  const key = id + "_guardian_trainer";
  return {
    id: key,
    kind: "trainer",
    name,
    sprite,
    dialogue,
    setsFlag: id === "meridian" ? "keycard" : key + "_won",
    trainer: { id: key, name, team: [{ species, level }], reward: level * 40 },
  };
}

type Crossing = { flag: string; closed: string; open: string };
const crossings: Record<string, Record<string, Crossing>> = {
  undertow_2: { "*": { flag: "low_tide", closed: "o", open: ":" } },
  hourglass_2: { "*": { flag: "stone_aligned", closed: "#", open: "=" } },
  bamboo_3: { "*": { flag: "farfetchd_lane", closed: "o", open: "=" } },
  victory_2: {
    "*": { flag: "west_pitch", closed: "#", open: ":" },
    "!": { flag: "east_pitch", closed: "#", open: ":" },
  },
};
export function expeditionFloor(mapId: string, mark: string) {
  return crossings[mapId]?.[mark]?.open ?? mark;
}
export function pitchFlag(objectId: string) {
  if (objectId === "victory_crag") return "west_pitch";
  if (objectId === "victory_falls") return "east_pitch";
}

const variants = new WeakMap<WorldMap, Map<string, WorldMap>>();
export function expeditionState(map: WorldMap, flags: readonly string[]): WorldMap {
  if (map.kind !== "dungeon") return map;
  const passages = crossings[map.id];
  // The original summit and the first expedition release saved a single open ridge.
  const oldRidge =
    map.id === "victory_2" &&
    flags.includes("summit_open") &&
    !flags.includes("west_pitch") &&
    !flags.includes("east_pitch");
  const closed =
    passages && !oldRidge ? Object.keys(passages).filter((mark) => !flags.includes(passages[mark].flag)) : [];
  let plug = -1;
  if (map.id === "frostvault_2" && !flags.includes("ice_thawed"))
    plug = flags.includes("frost_push_2") ? 2 : flags.includes("frost_push_1") ? 1 : 0;
  if (!closed.length && plug < 0) return map;
  const key = closed.join("") + "/" + plug;
  let cache = variants.get(map);
  if (!cache) variants.set(map, (cache = new Map()));
  let state = cache.get(key);
  if (state) return state;
  const [id, floor] = map.id.split("_");
  const drawing = dungeonPlans[id][Number(floor) - 1].plan;
  const objects =
    plug < 0 ? map.objects : map.objects.map((o) => (o.id === "frost_plug" ? { ...o, x: o.x + plug } : o));
  const tiles = map.tiles.map((row, y) =>
    Array.from(row, (tile, x) => {
      const mark = drawing[y][x];
      return closed.includes(mark) ? passages[mark].closed : tile;
    }).join(""),
  );
  state = { ...map, tiles, objects, terrainVariant: key };
  cache.set(key, state);
  return state;
}
