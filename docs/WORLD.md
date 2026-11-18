# World content

[`src/world/index.ts`](../src/world/index.ts) defines the connections, story flags, trainers, quests and rewards. [`src/world/geography.ts`](../src/world/geography.ts) composes the terrain, roads, doors and landmark placements. [`src/world/habitats.ts`](../src/world/habitats.ts) assigns regional encounter pools.

The regional survey in [`src/world/atlas.ts`](../src/world/atlas.ts) places settlements, roads, side paths and dungeon entrances in walking tiles. Each outdoor area owns a local collision map. Its footprint can include inaccessible headlands, deep water or forest. Gaps between roads leave room for those landscapes. Dewdrop and Mossford occupy 25×20 tiles and the other settlements occupy 24×18. The numbered trails range from 41 to 208 tile centers along their main paths.

Buildings open onto compact rooms with a mat at the south threshold. The Centers have a healing station, benches and a local visitor. Marts place their clerk behind a counter and reserve browsing space by the shelves. Face the clerk across the counter to heal or shop. The lab, home and seven local buildings also have furnished interiors.

## Travel around Astra

Open **Menu → Map** for the entire region. Select a town or route on the chart, or browse with the two arrows. Zoom enlarges the selected area. The trainer pin follows your position on outdoor maps and marks the exterior entrance when you go inside. The journal star follows your selected survey. **Local map** shows the current tile grid, doors, obstacles and next step. Fly is available for previously visited towns once Orion awards the Astral Badge.

Dewpath, Orchard Lane, Amberbank and Canal Road take the player east through Copperwick. The road to Sunspire turns north through the dunes. After Volt, the northern harbor buoys also open the Tidal Crossing to Reedhaven. From the ranger camp, Reedwalk heads east to Sunspire and Ashen Trail crosses the kiln country west to Cinderfall. High Pass winds south into Rimepeak. Sable, Flint and Neve can be challenged in any order. The journal lets the player choose which community to help next.

Bellflower Way leaves Rimepeak to the south, then bends east into Bellweather. Starlit Avenue runs north to Aster, and Crown Road takes the western ridge to the League. Dewdrop Grove loops south of Mossford, Old Quarry joins Mossford to Cinderfall, with a freight cart cleared by Strength at the orchard end and a rockslide cleared by Rock Smash at the mine end, and Moonwater Reach links the port with Bellweather after Whirlpool and six badges. The postgame Aurora Trail begins west of Dewdrop.

Road exits have three-tile approaches at the map edge. Reciprocal exits face the opposite direction and preserve the lateral offset. Doors, caves and stairs use portal coordinates. A building return places the player on the path in front of the door. Tile coordinates are integers. Main roads use `.`, footpaths use `:`, encounter grass uses `g`, bridges use `=`, and `,` and `f` are walkable surroundings. `#`, `r`, `w` and `BCPTS` block movement. Shallow water `~` is passable with Surf. Offshore water `o` is impassable. Quarry and switchyard rails use `t`. The League uses walkable arena inlay `a`, crest `h` and uplights `l`.

## Progression

Trees, rocks, dark passages, rapids and trail barriers occupy the roads they close. Face an obstacle and press A to inspect it. Most field abilities clear a landmark with an explicit action that persists in the save. Surf lets the player move directly into the water at an open launch point.

A dungeon’s entrance holds the clue and first mechanism. Completing it opens the next room, where the second interaction powers the passage to the objective chamber. The objective opens the return stairs between the chamber and the entrance. The twelve sites use distinct layouts and local devices, including sluice tunnels, a flooded bridgehouse, a relay hall, a gallery of bells and a security wing. Puzzle state uses persisted flags and gated exits.

The [eight gym plans](../src/world/gyms.ts) place each trainer, sight line, mat and keeper on its own tile survey. Fern accepts challengers on arrival. The surveyor marks the onward route to Tideglass. Marina’s gangway lowers with the fog signal. Either Copperwick operator can release a catwalk to Volt. Awarding the Dynamo Badge opens both for return visits.

Sable’s excavators work the short rim of the fossil bed. Flint’s refuge receives the Pokémon released at Ember Mine. Neve’s rink carries the player straight across ice until grit or a bank stops them. Each of these keepers can be fourth, fifth or sixth, with an ace at level 29, 36 or 42. The gym crew, local trainers and habitats follow the chosen survey tier. Robin gives public testimony before Lyra’s match. Orion’s transit observer challenges anyone crossing the meridian under the recovered lens. All eight badges together can shut down the Celestial Engine.

The layouts borrow three principles from the reference games. Pewter places its junior trainer off the center line. Jasmine returns to her gym after the player treats the lighthouse Pokémon. Petalburg opens different doors according to the specialist the player defeated. Astra uses those ideas for the silkhouse aisle, the harbor rescue and Copperwick’s two operators. [Yellow map objects](https://github.com/pret/pokeyellow/blob/master/data/maps/objects/PewterGym.asm) · [Crystal lighthouse script](https://github.com/pret/pokecrystal/blob/master/maps/OlivineLighthouse6F.asm) · [Emerald gym doors](https://github.com/pret/pokeemerald/blob/master/data/maps/PetalburgCity_Gym/scripts.inc)

Victory Ascent opens the Astral League challenge. Rowan, Petra, Nyx, Gale and Mira each have a chamber. Mira’s arena centers the League’s beacon crest in a gold-edged floor inlay. Each victory opens the next chamber, and the Hall of Fame shortcut leads back to the League entrance.

Requirements combine flags, minimum badge counts, field abilities, species and type checks, caught counts and items. A successful switch or NPC interaction records its flag and grants its reward once. Trainers and leaders grant them after victory. Legendary encounters remain retryable until capture.

## Habitats and research

Side trails lead to overlooks, supplies and optional trainers. Sixteen habitats also have a visible wild resident. Inspecting one plays its cry and registers it as seen. Encounter grass is optional on main roads. Habitat pools group species by landscape and progression, with evolved forms appearing at lower weights in many pools. The Aurora rooms split the late research grounds into starter plant, water and fire families. Legendary hints name the appropriate ability or story milestone, while the Living Atlas quest checks all 251 catches after the sanctuary is restored. The prerequisite for entering the sanctuary itself is the Hall of Fame.

[`tests/world.test.ts`](../tests/world.test.ts) checks reciprocal doors, paths around solid characters, dry approaches to Surf landings, reachable grass, service interactions, badge barriers, puzzle and League ordering, and species coverage. It models campaign unlocks with zero research catches. [`tests/navigation.test.ts`](../tests/navigation.test.ts) checks continuous seams, obstacle collision and interaction, and arrivals at entry mats and beyond one-way barriers.
