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

export function populateHabitats(world: Record<string, WorldMap>) {
  const habitats = {
    ...Object.fromEntries(
      Object.entries(routeHabitats).map(([n, pool]) => [`route${n}`, pool]),
    ),
    ...sanctuaryHabitats,
  };
  for (const [id, [level, species]] of Object.entries(habitats)) {
    world[id].encounters = species.map((species, index) => ({
      species,
      minLevel: level,
      maxLevel: level + 2,
      weight: index < 4 ? 6 : 2,
    }));
  }
}
