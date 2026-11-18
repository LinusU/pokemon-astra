import type { WorldMap, WorldObject } from "./index";

/** Each plan is drawn at walking scale. L is the keeper, @ the two-tile mat,
 * digits are trainers and lowercase letters in landmarks are story objects. */
interface GymTrainer {
  name: string;
  sprite: string;
  facing: NonNullable<WorldObject["facing"]>;
  range: number;
  team: [species: number, level: number][];
  intro: string;
  after: string;
}
interface Gym {
  name: string;
  plan: string[];
  sprite: string;
  intro: string;
  advice: string;
  requirement: string[];
  crew: GymTrainer[];
  landmarks?: Record<string, Omit<WorldObject, "x" | "y">>;
  /** Flag that makes a marked section of floor passable. */
  passages?: Record<string, { flag: string; floor: string }>;
}

export const gyms: Record<string, Gym> = {
  gym1: {
    name: "Bramble Silkhouse", sprite: "bugCatcher",
    intro: "Mind the thread above your head! My Spinarak strung it clear across the silkhouse this morning. Let's give her room to work.",
    advice: "Bring a partner from Alder's lab. The middle aisle is yours.",
    requirement: ["partner"],
    plan: [
      "#################",
      "###PP..BBB..PP###",
      "##P.....L.....P##",
      "#...ff.....ff...#",
      "#.1.ff.....ff.2.#",
      "#...PP.....PP...#",
      "##....:::::....##",
      "###.ff.:::..ff###",
      "####...:::...####",
      "#######@.########",
    ],
    crew: [
      { name: "Silkwinder Kit", sprite: "bugCatcher", facing: "down", range: 1, team: [[10,9],[14,10]], intro: "Each cocoon goes on its own spool. Watch what happens when this one wakes up!", after: "The hollow cocoons make good lantern shades." },
      { name: "Leaf Scout May", sprite: "lass", facing: "left", range: 2, team: [[46,10]], intro: "My Paras found the dampest bed in the nursery. Bet you can guess its favorite move.", after: "The center aisle leads straight to Fern. I like it here among the leaves." },
    ],
  },
  gym2: {
    name: "Tideglass Lightship", sprite: "sailor",
    intro: "Hear the horn answer from Undertow? That's my cue to weigh anchor. You've got until the tide turns, challenger!",
    advice: "The lightship comes alongside when the fog signal in Undertow Cave sounds again.",
    requirement: ["fog_signal"], passages: { A: { flag: "fog_signal", floor: "=" } },
    plan: [
      "##########################",
      "#~~~~~~~~~~~~~~~oooooo~~~#",
      "#~~~~~~~~~~~~~oo.BBB..oo~#",
      "#~~~~~~~~~~~~~o....L...oo#",
      "#~~~~~~~~~~~~~o..::::...o#",
      "#~~======~~~~~o....:...oo#",
      "#~~=....=======AA...2.oo~#",
      "#~~=..1.=~~~~~oooooooo~~~#",
      "#~~===..=~~~~~~~~~~~~~~~~#",
      "#....=..=..n..P.....P....#",
      "#.P......................#",
      "#####@.###################",
    ],
    crew: [
      { name: "Net Mender Rue", sprite: "fisher", facing: "left", range: 2, team: [[90,14],[72,15]], intro: "Something in my net keeps cutting the knots. Shellder, show them your teeth!", after: "The long way round the net rack keeps your boots dry." },
      { name: "Lookout Sol", sprite: "sailor", facing: "up", range: 2, team: [[116,16]], intro: "See the little spout off the bow? That's my Horsea calling for a match.", after: "A clean signal all the way to port. First time in weeks." },
    ],
    landmarks: { n: { id: "gym2_notice", kind: "sign", name: "Harbor movements", dialogue: "Lightship landing. In fog, the gangway stays up until the Undertow signal answers." } },
  },
  gym3: {
    name: "Copperwick Turbine Hall", sprite: "scientist",
    intro: "Both feeds are reading steady again. Let's see how your team handles a sudden load.",
    advice: "Trace the power theft at Copperworks. Then take either operator's test to cross the safety line.",
    requirement: ["power_restored"],
    passages: { A: { flag: "gym3_1_won", floor: "=" }, D: { flag: "gym3_2_won", floor: "=" } },
    plan: [
      "#####################",
      "#CC...::::L::::...CC#",
      "#CC..=========....CC#",
      "####=###########=####",
      "####A###########D####",
      "#CC....#######....CC#",
      "#CC.1..#BBBBB#..2.CC#",
      "#......#BBBBB#......#",
      "###....#######....###",
      "#...====.....====...#",
      "#.CC.....n......CC..#",
      "#.CC............CC..#",
      "#########@.##########",
    ],
    crew: [
      { name: "Coil Winder Tess", sprite: "scientist", facing: "down", range: 2, team: [[81,20],[81,21]], intro: "My winding bench runs in pairs. Two Magnemite, one after the other. Ready?", after: "My breaker is open. Take the west catwalk up to Volt." },
      { name: "Line Runner Dex", sprite: "biker", facing: "down", range: 2, team: [[101,21]], intro: "My shift is the fast one. Beat Electrode to clear the east catwalk.", after: "East line released. Go see Volt!" },
    ],
    landmarks: { n: { id: "gym3_roster", kind: "sign", name: "Shift board", dialogue: "West catwalk • Tess, twin coils. East catwalk • Dex, high-speed line. Either operator can admit a challenger to the control deck." } },
  },
  gym4: {
    name: "Sunspire Fossil Cut", sprite: "hiker",
    intro: "Look at the footprints under the glass. Three herds used this trail centuries apart. Donphan still knows the way.",
    advice: "The lens in Hourglass Ruins holds the missing record of this migration. Bring it up to the cut.",
    requirement: ["lens_restored"],
    plan: [
      "###################",
      "########...L..#####",
      "######...:::...####",
      "####...::####..####",
      "###..::########.2.#",
      "##..::##BBBB###...#",
      "#..::###BBBB####..#",
      "#..:####BBBB###...#",
      "#..::########...1.#",
      "##..:::####...::..#",
      "###...:::::::...###",
      "#####.........#####",
      "######..###########",
      "######@.###########",
    ],
    crew: [
      { name: "Fossil Preparer Pia", sprite: "scientist", facing: "up", range: 2, team: [[104,24],[111,25]], intro: "That horn mark in the glass? My Rhyhorn makes the very same print.", after: "Walk the rim and you can read the layers from oldest to youngest." },
      { name: "Dune Guide Enzo", sprite: "hiker", facing: "down", range: 2, team: [[50,25],[28,25]], intro: "My Diglett can follow a fault by touch. Shall we show you?", after: "The west rim is longer, but the prints show up better there." },
    ],
  },
  gym5: {
    name: "Cinderfall Kiln Refuge", sprite: "biker",
    intro: "That little Cyndaquil slept through the kiln whistle today. First good sleep it's had since the mine. Let's battle over here, away from the beds.",
    advice: "The beds are warm. The Pokémon meant for them are still in the transport cages at Ember Mine.",
    requirement: ["pokemon_freed"],
    plan: [
      "#######################",
      "#BBB#.PP..#....PP....##",
      "#BBB#..u..#..v....L...#",
      "#BBB......#....::::...#",
      "#....1....#..::::.....#",
      "#..=====..#..::...PP..#",
      "#..=......#..::..2....#",
      "#..==============.....#",
      "#.....PP......PP....###",
      "##....PP............###",
      "##@.###################",
    ],
    crew: [
      { name: "Kiln Tender Ash", sprite: "biker", facing: "left", range: 2, team: [[218,31],[126,32]], intro: "Slugma sleeps on the warm bricks. When it wakes up, the whole kiln wants to battle.", after: "You can feel the heat down the copper strip in the floor." },
      { name: "Burn Nurse Jo", sprite: "nurse", facing: "right", range: 2, team: [[37,31],[77,32]], intro: "These two are well enough to run again. Want to be their first opponent?", after: "Rapidash will take the next shift ferrying blankets from town." },
    ],
    landmarks: {
      u: { id: "gym5_cyndaquil", kind: "sign", name: "Rescued Cyndaquil", wildlife: 155, dialogue: "Cyndaquil pokes its nose out of a wool blanket. The number on its old transport collar has been rubbed away." },
      v: { id: "gym5_slugma", kind: "sign", name: "Rescued Slugma", wildlife: 218, dialogue: "Slugma has melted a perfect hollow into its bed of kiln bricks. It hums when the hot pipes tick." },
    },
  },
  gym6: {
    name: "Rimepeak Brakewater Rink", sprite: "skier",
    intro: "Listen to the ice. A high note means it's thin. My team knows this stretch by ear. Do you?",
    advice: "The rink crew is on rescue duty until warm water flows through Frostvault and the pass reopens.",
    requirement: ["pass_open"],
    plan: [
      "###############",
      "#PP...L...PP###",
      "#...::::....###",
      "######i########",
      "#PiiiiiiiiiiiP#",
      "#Piiii.ii.iiiP#",
      "#PiiiiiiiiiiiP#",
      "#PiiiiiiiiiiiP#",
      "#Pii.i.ii.iiiP#",
      "#PiiiiiiiiiiiP#",
      "#Pii.iiiiiiiiP#",
      "####ii#########",
      "#P1......n...2#",
      "#..PP......PP.#",
      "######@.#######",
    ],
    crew: [
      { name: "Ice Medic Liv", sprite: "nurse", facing: "left", range: 1, team: [[220,37],[124,38]], intro: "Pillows, plasters, and a Swinub to pull the stretcher. That's my kit.", after: "The gold grit patches give your boots purchase. Turn there." },
      { name: "Slalom Coach Bo", sprite: "skier", facing: "left", range: 1, team: [[86,37],[215,38]], intro: "If Sneasel beats me across the rink, it gets first tracks tomorrow.", after: "Look for the short chute north from the middle grit patch." },
    ],
    landmarks: { n: { id: "gym6_rules", kind: "sign", name: "Skate hire", dialogue: "Blue ice carries you straight. Gold grit lets you turn. Take the left launch lane and look for the grit below the north chute." } },
  },
  gym7: {
    name: "Bellweather Witness Hall", sprite: "medium",
    intro: "When Robin spoke, even the rafters rang. A memory changes when somebody else agrees to carry it. Espeon and I are listening.",
    advice: "Hear the memory in Echo Bell Tower, then stand with Robin at the witness rail.",
    requirement: ["revelation", "gym7_testimony"],
    plan: [
      "#####################",
      "#####BBB...BBB#######",
      "###....:.L.:....#####",
      "#.....:::::::.......#",
      "#..TT..:::::..TT..2.#",
      "#..TT....r....TT....#",
      "#.....:::::::.......#",
      "#..TT..:::::..TT....#",
      "#.1TT..:::::..TT....#",
      "#.....:::::::.......#",
      "####.......n.....####",
      "#########@.##########",
    ],
    crew: [
      { name: "Cantor Ione", sprite: "medium", facing: "down", range: 1, team: [[201,42],[96,43]], intro: "Unown has one note. Drowzee hears the dream behind it. Can your team hear both?", after: "Robin asked to speak where the whole hall could hear." },
      { name: "Archivist Ren", sprite: "sage", facing: "down", range: 2, team: [[203,43],[64,44]], intro: "Girafarig keeps watch behind me while I transcribe the bells. It heard you first.", after: "Your names go beside the tower recording. Nobody can quietly file it away now." },
    ],
    landmarks: {
      r: { id: "gym7_witness", kind: "person", name: "Robin", sprite: "rival", facing: "down", requires: { flags: ["revelation"] }, setsFlag: "gym7_testimony", lockedDialogue: "I need to hear that recording for myself. Meet me in Echo Bell Tower.", dialogue: "Robin unpins their Meridian badge. “I told you the Engine would keep your homes safe. I heard the tower. I was wrong.” You countersign the transcript. Lyra opens the hearing to the town.", victoryDialogue: "The transcript is public now. I'll take a copy to Meridian myself." },
      n: { id: "gym7_docket", kind: "sign", name: "Hearing docket", dialogue: "Beacon testimony today. Witnesses report to the center rail. Training in the side aisles is open to the public." },
    },
  },
  gym8: {
    name: "Aster Meridian Dome", sprite: "dragonTamer",
    intro: "Stand on the brass meridian and look up. The dark between the stars is where my dragons fly. Shall we give them back their sky?",
    advice: "Recover the lens at Starfall and earn the transit observer's clearance on the brass meridian.",
    requirement: ["last_lens", "gym8_2_won"],
    plan: [
      "#########################",
      "#########BBBBBBB#########",
      "######....:::::....######",
      "####....:::L:::......####",
      "###...::::...::::.....###",
      "##...::.........::.....##",
      "##..::...........::....##",
      "###########=#############",
      "##########2=#############",
      "###########=#############",
      "####.....:::::.......####",
      "###..1..::...::.......###",
      "###....::.....::......###",
      "#####.::..PP...::...#####",
      "#######.........#########",
      "##########@.#############",
    ],
    crew: [
      { name: "Comet Spotter Ena", sprite: "scientist", facing: "right", range: 2, team: [[147,46],[130,47]], intro: "See the long streak on the star plate? Gyarados insisted on swimming through the exposure.", after: "Dragonair's shed scales catch even the dimmest starlight." },
      { name: "Transit Observer Hal", sprite: "dragonTamer", facing: "right", range: 1.75, team: [[148,47],[230,48]], intro: "One last transit to record. Take the brass line and let my dragons measure your approach.", after: "Transit clear. Orion has the north dome." },
    ],
  },
};

/** Apply only the few changes that a particular gym's story can make. The base
 * survey stays immutable so a new game or a different imported save is safe. */
const variants = new WeakMap<WorldMap, Map<string, WorldMap>>();
export function gymState(map: WorldMap, flags: readonly string[]): WorldMap {
  const gym = gyms[map.id];
  if (!gym) return map;
  const closed = Object.entries(gym.passages ?? {}).filter(([, p]) =>
    !flags.includes(p.flag) && !flags.includes("badge" + map.id.slice(3)));
  const emptyBeds = map.id === "gym5" && !flags.includes("pokemon_freed");
  if (!closed.length && !emptyBeds) return map;
  const key = closed.map(([mark]) => mark).join("") + (emptyBeds ? "empty" : "");
  let cache = variants.get(map);
  if (!cache) variants.set(map, cache = new Map());
  let variant = cache.get(key);
  if (!variant) {
    const tiles = map.tiles.map((row, y) => Array.from(row, (tile, x) =>
      closed.some(([mark]) => gym.plan[y][x] === mark) ? "o" : tile).join(""));
    variant = { ...map, tiles, terrainVariant: key, objects: emptyBeds ? map.objects.filter(o => !o.wildlife) : map.objects };
    cache.set(key, variant);
  }
  return variant;
}
