# World content

[`src/world/index.ts`](../src/world/index.ts) defines the connections, story flags, trainers, quests and rewards. [`src/world/geography.ts`](../src/world/geography.ts) composes the terrain, roads, doors and landmark placements. [`src/world/habitats.ts`](../src/world/habitats.ts) assigns regional encounter pools.

Dewdrop and Mossford use 25×20 maps. Later settlements fit within 24×18, with 23×16 routes and 20×16 dungeon rooms. Town paths connect the services to the local landscape. Tideglass uses a harbor promenade and jetties, Copperwick crosses its canals, Sunspire clusters around a desert oasis, and Reedhaven spans a wetland on boardwalks. Route markers give directions at bends and point out supplies and optional terrain.

Buildings open onto compact rooms with a mat at the south threshold. The Centers have a healing station, benches and a local visitor. Marts place their clerk behind a counter and reserve browsing space by the shelves. Face the clerk across the counter to heal or shop. The lab, home and seven local buildings also have furnished interiors.

## Travel around Astra

```text
East   Dewdrop → Mossford → Bramble → Tideglass → Copperwick
North  Copperwick → Sunspire
West   Sunspire → Reedhaven → Cinderfall → Rimepeak
North  Rimepeak → Bellweather
West   Bellweather → Aster
North  Aster → Crown Summit
```

The arrows between places follow the campaign. Travel heads east through Copperwick, then north along Saffron Dunes to Sunspire. The far shore runs west via Reedhaven and Cinderfall to Rimepeak. Bellflower Way heads north to Bellweather. Starlit Avenue continues west to Aster, and Crown Road takes the last climb north. A town guide lists the actual direction of each local road, and side routes lead to dungeon entrances.

Dewdrop Grove reconnects Dewdrop to Bramble using Cut. Tidal Crossing links Tideglass and Reedhaven through an open channel, Old Quarry links Mossford and Cinderfall using Strength, and Moonwater Reach links Tideglass and Bellweather using Whirlpool. These shortcuts check the badge prerequisites for their far landings. Aurora Trail leads south from Dewdrop after the player enters the Hall of Fame.

Road exits have three-tile approaches at the map edge. Reciprocal exits face the opposite direction and preserve the lateral offset. Doors, caves and stairs use portal coordinates. A building return places the player on the path in front of the door. Tile coordinates are integers. Paths use `.`, encounter grass uses `g`, bridges use `=`, and `,` and `f` are walkable surroundings. `#`, `r`, `w` and `BCPTS` block movement. Water `~` is passable with Surf. The League uses walkable arena inlay `a`, crest `h` and uplights `l`.

## Progression

Trees, rocks, dark passages, rapids and trail barriers occupy the roads they close. Face an obstacle and press A to inspect it. Most field abilities clear a landmark with an explicit action that persists in the save. Surf lets the player move directly into the water at an open launch point.

A dungeon’s entrance holds the clue and first mechanism. Completing it opens the next room, where the second interaction powers the passage to the objective chamber. The objective opens the return stairs between the chamber and the entrance. The twelve sites use distinct layouts and local devices, including sluice tunnels, a flooded bridgehouse, a relay hall, a gallery of bells and a security wing. Puzzle state uses persisted flags and gated exits.

Keeper challenges require the local dungeon objective and the gym sequence. Orion’s four constellations lead into the Astral Badge, which is needed to shut down the Celestial Engine. Victory Ascent opens the Astral League challenge. Rowan, Petra, Nyx, Gale and Mira each have a chamber. Mira’s arena centers the League’s beacon crest in a gold-edged floor inlay. Each victory opens the next chamber, and the Hall of Fame shortcut leads back to the League entrance.

Requirements combine flags, minimum badge counts, field abilities, species and type checks, caught counts and items. A successful switch or NPC interaction records its flag and grants its reward once. Trainers and leaders grant them after victory. Legendary encounters remain retryable until capture.

## Habitats and research

Encounter grass is optional on main roads. Habitat pools group species by landscape and progression, with evolved forms appearing at lower weights in many pools. The Aurora rooms split the late research grounds into starter plant, water and fire families. Legendary hints name the appropriate ability or story milestone, while the Living Atlas quest checks all 251 catches after the sanctuary is restored. The prerequisite for entering the sanctuary itself is the Hall of Fame.

[`tests/world.test.ts`](../tests/world.test.ts) checks reciprocal doors, paths around solid characters, dry approaches to Surf landings, reachable grass, service interactions, badge barriers, puzzle and League ordering, and species coverage. It models campaign unlocks with zero research catches. [`tests/navigation.test.ts`](../tests/navigation.test.ts) checks continuous seams, obstacle collision and interaction, and arrivals at entry mats and beyond one-way barriers.
