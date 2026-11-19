import type { WorldMap } from "./index";

type Habitat = [level: number, species: number[]];

/** Common residents lead each pool. Evolutions and uncommon visitors follow. */
const routeHabitats: Record<string, Habitat> = {
  // Dewpath and Orchard Lane are the first partners' practice grounds.
  "01": [4, [10, 13, 16, 19, 21, 25, 29, 32, 46, 163, 165, 167]],
  "02": [6, [43, 48, 69, 108, 161, 179, 187, 191, 209]],
  // The approach shares a shallow stream with Lantern Wood.
  "03": [8, [23, 37, 41, 52, 60, 194, 42, 123, 164, 168]],
  "04": [10, [27, 39, 50, 56, 74, 77, 84, 95, 104, 111, 185, 207]],
  // Salt marsh, then the canal-side stock enclosures around Copperwick.
  "05": [12, [72, 98, 116, 118, 120, 170, 73, 86, 90, 129, 211, 222]],
  "06": [14, [24, 28, 51, 75, 78, 82, 96, 101, 110, 112, 113, 143]],
  "07": [16, [81, 100, 109, 172, 239, 89, 125, 137, 205, 208, 88]],
  // Dunes favor burrowers and sun-loving Pokémon, with an oasis on Glassway.
  "08": [18, [66, 105, 231, 228, 38, 57, 67, 68, 232, 229]],
  "09": [20, [54, 55, 177, 206, 36, 175, 176, 178, 201]],
  // Boardwalk pools and bamboo canopy are different survey habitats.
  "10": [22, [64, 59, 183, 193, 61, 62, 70, 186, 195, 80]],
  "11": [24, [83, 102, 114, 190, 44, 45, 47, 71, 103, 182, 204, 214]],
  "12": [26, [58, 218, 240, 234, 126, 136, 219, 77, 85]],
  "13": [28, [75, 105, 76, 227, 126, 219, 212]],
  // Rimepeak tree line, alpine lake, and sheltered flowering slopes.
  "14": [30, [216, 220, 225, 215, 221, 217, 124, 238, 207]],
  "15": [32, [86, 87, 90, 91, 131, 220, 225, 124]],
  "16": [34, [180, 135, 188, 202, 18, 189, 49, 169, 192, 203, 241]],
  "17": [36, [92, 93, 198, 200, 94, 97, 197, 149, 235]],
  "18": [38, [63, 122, 133, 176, 65, 132, 196, 197, 242]],
  "19": [40, [181, 164, 233, 178, 26, 53, 65, 148, 235]],
  "20": [42, [246, 215, 197, 226, 142, 196, 247, 248]],
  // Shortcuts each have their own isolated pools, with some early visitors.
  "21": [
    12,
    [11, 14, 166, 17, 12, 15, 20, 22, 30, 31, 33, 34, 35, 40, 162, 173, 174],
  ],
  "22": [26, [79, 99, 117, 119, 121, 130, 134, 171, 184, 199, 223, 224]],
  "23": [32, [138, 140, 106, 107, 115, 139, 141, 142, 210, 213, 236, 237]],
  "24": [44, [147, 148, 170, 222, 223, 224, 226, 230, 149]],
  "25": [48, [1, 4, 7, 152, 155, 158, 127, 128, 211, 242]],
};

const sanctuaryHabitats: Record<string, Habitat> = {
  aurora_1: [48, [1, 152, 2, 153, 3, 154]],
  aurora_2: [48, [7, 158, 8, 159, 9, 160]],
  aurora_3: [48, [4, 155, 5, 156, 6, 157]],
};

// Resident Pokémon are visible at particular survey spots. Seeing one supplies
// a field record; catching it still uses the habitat's ordinary encounters.
const residents: Record<string, [number, string, string]> = {
  "01": [10, "Caterpie", "A Caterpie is chewing a neat crescent out of a leaf. Only the stem is left on the one beside it."],
  "02": [187, "Hoppip", "The Hoppip catches a gust, touches down, then catches the very next gust back to its apple tree."],
  "03": [164, "Noctowl", "Noctowl has picked the only branch above both paths. Its head turns long before its feet do."],
  "04": [27, "Sandshrew", "Sandshrew brushes loose clay off a shell with its claws. The shell rolls down one ledge. Sandshrew follows."],
  "05": [98, "Krabby", "Krabby sifts the damp sand into tiny pellets. A perfect little fan of them surrounds its burrow."],
  "06": [82, "Magneton", "Each of Magneton’s three eyes watches a different gate. The middle eye blinks as the water settles."],
  "07": [81, "Magnemite", "Magnemite hovers over a discarded rail spike. When it turns, the spike turns with it."],
  "08": [231, "Phanpy", "Phanpy has dug a hollow on the shady side of the dune. Only the tip of its trunk shows."],
  "09": [177, "Natu", "Natu peers down a hollow glass tube. You see its round eye blink at the far end."],
  "10": [195, "Quagsire", "Quagsire hardly moves. Then a single bubble breaks the surface and it snaps up a mouthful of reeds."],
  "11": [83, "Farfetch’d", "Farfetch’d slides its leek between two bamboo poles. The poles spring apart just far enough to let it through."],
  "12": [218, "Slugma", "A Slugma is inching across the cinders. A dark trail behind it is still warm enough to shimmer."],
  "13": [227, "Skarmory", "Skarmory holds one silver wing over the hot rocks. An updraft catches the feathers and fans them apart."],
  "14": [220, "Swinub", "Swinub noses beneath the scree. It comes up with a root and trots back to the sheltered side of the pass."],
  "15": [86, "Seel", "Seel nudges a shard of blue ice back into the channel. It waits for the current to carry the shard around again."],
  "16": [188, "Skiploom", "Skiploom drifts above the bellflowers. Each time the little bell rings it turns toward the sound."],
  "17": [198, "Murkrow", "A Murkrow has woven a purple ribbon through its nest. The loose end flutters all the way to the path."],
  "18": [133, "Eevee", "Eevee stoops to sniff the other Eevee in the pool. Their noses meet and the reflected stars scatter."],
  "19": [164, "Noctowl", "Noctowl balances on a survey stone. From the telescope platform its eyes could pass for a pair of stars."],
  "20": [246, "Larvitar", "Larvitar rolls a pebble around in its mouth. It spits the shiny bit onto the cairn and eats the rest."],
  "21": [12, "Butterfree", "Butterfree leaves a dusting of pollen on the old bark, then circles back for another visit."],
  "22": [79, "Slowpoke", "Slowpoke has been fishing here so long that the tide has gone out from under its tail."],
  "23": [213, "Shuckle", "The little red stone has legs. Shuckle draws them back inside its shell when a pebble rattles downhill."],
  "24": [222, "Corsola", "A pale branch at the rim of the pool waves back. The stone beneath it picks itself up and shuffles sideways."],
  "25": [152, "Chikorita", "The Chikorita points its leaf into the morning wind. A second set of tracks follows the first into the grass."],
};

export function populateHabitats(world: Record<string, WorldMap>) {
  const habitats = {
    ...Object.fromEntries(
      Object.entries(routeHabitats).map(([n, pool]) => [`route${n}`, pool]),
    ),
    ...sanctuaryHabitats,
  };
  for (const [id, [level, species]] of Object.entries(habitats)) {
    const resident = residents[id.slice(5)];
    if (resident) {
      const [wildlife, name, dialogue] = resident;
      world[id].objects.push({ id: "resident_" + id, wildlife, name, dialogue, kind: "sign", x: 0, y: 0 });
    }
    world[id].encounters = species.map((species, index) => ({
      species,
      minLevel: level,
      maxLevel: level + 2,
      weight: index < 4 ? 6 : 2,
    }));
  }
}
