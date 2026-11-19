import type { Requirement, WorldMap, WorldObject } from "./index";

export type GuardianRelief = "ice" | "coil" | "vent" | "capsule" | "oak" | "signal" | "cairn" | "mirror" | "shell" | "chime" | "sapling";
type Perch = {
  name: string;
  relief: GuardianRelief;
  clue: string;
  encounter: string;
  after: string;
};

export const guardianPerches: Record<number, Perch> = {
  144: {
    name: "Glacier roost", relief: "ice",
    clue: "A frozen cascade hides the roost. Lyra’s badge grants Waterfall and opens the way to Articuno.",
    encounter: "Snow lifts off the roost without a breath of wind. Articuno opens its wings above the falls.",
    after: "A single blue feather lies frozen into the ledge. Meltwater runs clear beneath it.",
  },
  145: {
    name: "Turbine coil", relief: "coil",
    clue: "The intake is still too unstable for Zapdos. The keepers will finish repairs after your League challenge.",
    encounter: "The turbine slows to a stop. The hum goes on. Zapdos is perched across the two copper poles.",
    after: "The coil carries a steady current again. Two sets of claw marks score the copper.",
  },
  146: {
    name: "Cinder vault", relief: "vent",
    clue: "The old ore vault is behind fractured rock. Return with Rock Smash from Flint.",
    encounter: "Hot air pours from the ore vault. The flame above the broken rock lifts its head. Moltres steps into the light.",
    after: "A red feather has fused to the edge of the vault. The ore beneath it is still warm.",
  },
  150: {
    name: "Meridian capsule", relief: "capsule",
    clue: "The lab capsule is sealed. It can be opened once the League recognizes your work restoring the beacons.",
    encounter: "The capsule latch falls open. Mewtwo stands perfectly still, watching you through the glass.",
    after: "The capsule stands empty. The glass is cracked from the inside.",
  },
  151: {
    name: "Hollow elder tree", relief: "oak",
    clue: "The oldest tree stirs. Return with records of at least 100 different species from your journey.",
    encounter: "A pink tail slips out of the hollow. Mew peers over your shoulder at the pages of your field book.",
    after: "There is a tiny pink pawprint in the dust of the hollow.",
  },
  243: {
    name: "Island storm beacon", relief: "signal",
    clue: "The island beacon remains dark until a trainer from Astra enters the Hall of Fame.",
    encounter: "The hairs on your arms lift. Raikou steps onto the sandbar just as thunder rolls over the crossing.",
    after: "Lightning has melted the sand around the post into little glass beads.",
  },
  244: {
    name: "Quarry hearthstone", relief: "cairn",
    clue: "Heat rises from the quarry stone. The beacon can call Entei once you reach the Hall of Fame.",
    encounter: "Loose pebbles tick down the quarry wall. Entei climbs onto the hearthstone, its mane trailing smoke.",
    after: "Four deep pawprints mark the warm dust beside the stone.",
  },
  245: {
    name: "Moonwater basin", relief: "mirror",
    clue: "The moonwater shrine needs a fully restored current. Return after the League challenge.",
    encounter: "A ribbon trails across the still pool. Suicune comes to drink, and the cloudy water clears beneath its paws.",
    after: "Even the deepest part of the basin is clear enough to see the pebbles at the bottom.",
  },
  249: {
    name: "Tide-shell hollow", relief: "shell",
    clue: "An eddy covers the deep tunnel. Neve’s badge teaches Whirlpool, which can calm it.",
    encounter: "The last eddy settles. A low answering note travels up the sea tunnel, and Lugia rises beside the shelf.",
    after: "You put your ear to the hollow. The tide still carries a low, steady note.",
  },
  250: {
    name: "Crown bell", relief: "chime",
    clue: "The top bell sounds only after the League recognizes the work of the eight keepers.",
    encounter: "The crown bell rings once. Seven colors run across its bronze as Ho-Oh lowers a wing to the sill.",
    after: "A many-colored feather catches the light each time the old bell swings.",
  },
  251: {
    name: "Nursery sapling", relief: "sapling",
    clue: "The grove is quiet. Record both sanctuary watches and restore the nursery to call Celebi.",
    encounter: "A bud opens, flowers and opens again. Celebi hangs beneath the new leaves, watching the nursery.",
    after: "One branch holds a bud, a flower and a ripe green fruit at the same time.",
  },
};

type PerchStates = { encounter: WorldObject; sealed: WorldMap; captured: WorldMap };
const perches = new WeakMap<WorldMap, PerchStates | null>();

/** Keep a readable landmark at each perch before the encounter and after the catch. */
export function guardianField(map: WorldMap, flags: readonly string[], has: (r?: Requirement) => boolean): WorldMap {
  let states = perches.get(map);
  if (states === undefined) {
    const encounter = map.objects.find(o => o.kind === "legendary");
    states = null;
    if (encounter) {
      const perch = guardianPerches[encounter.trainer!.team[0].species];
      const landmark = (dialogue: string): WorldMap => ({
        ...map,
        objects: map.objects.map(o => o !== encounter ? o : {
          id: o.id, kind: "sign", x: o.x, y: o.y, name: perch.name, dialogue, shrine: perch.relief,
        }),
      });
      states = { encounter, sealed: landmark(perch.clue), captured: landmark(perch.after) };
    }
    perches.set(map, states);
  }
  if (!states) return map;
  if (flags.includes(states.encounter.setsFlag!)) return states.captured;
  return has(states.encounter.requires) ? map : states.sealed;
}
