# Pokémon Astra — game design

## Vision

A complete, single-player, browser-native Gen 2 Pokémon adventure in the new Astra region. A bright, slightly richer Crystal palette, crisp pixel art, subtle environmental animation, and smooth eight-direction movement. A fixed, deliberately designed region, not a random campaign. Play at 320×240 logical resolution; touch controls occupy the lower screen. ROM assets remain local and are decoded on first import. All 251 species are obtainable without trading, external events, or a second version.

## Story

Astra's eight ancient beacons guide migrating Pokémon along the Aurora Current. The Meridian Company is replacing them with a machine that promises unlimited energy. Its director Vale believes a controlled, permanent dawn will prevent another disaster. In fact, the machine is draining habitats and trapping the guardian Pokémon. Professor Alder sends the player and their childhood friend/rival Robin to survey the failing beacons. Gym leaders are the local beacon keepers. Each badge is both a competitive achievement and a trust earned by helping that community. Robin initially admires Meridian, then discovers the damage and helps expose Vale. After eight badges, the player disables the Celestial Engine, releases Lugia and Ho-Oh's influence, and challenges the Astral League. The postgame restores time to the region and opens the legendary expeditions and final 251-species research challenge.

The player starts in Dewdrop with a choice of Growlithe, Poliwag, or Bellsprout, level 6. All have good early STAB, meaningful evolution choices, and locally available evolution items. Rival chooses the type advantage. Professor grants 10 Poké Balls, 5 Potions, running shoes, the journal, and the Pokédex immediately. Opening tutorial is skippable, and first wild encounter is within two minutes.

## Geography and campaign

Twelve settlements, twenty-five numbered routes, twelve substantial dungeon locations, eight gym interiors, home/lab, centers, marts, League, and optional shrines. The main path crosses a looping central sea; shortcuts reconnect earlier towns. Each route needs a clear navigable main path, optional grass pockets, trainers, a secret/item, and distinct terrain dressing. Each dungeon needs multiple connected rooms, an objective/puzzle and an exit shortcut. Named settlements:

| Stop | Place | Identity / story / objective | Levels |
|---|---|---|---|
| Start | Dewdrop Village | Blue roofs, flower gardens, Alder's lab; receive partner and beacon journal | 6–8 |
| Service | Mossford | Windmills and orchards; missing courier tutorial, first fossil hints | 8–11 |
| Gym 1 | Bramble Town | Autumn forest hamlet; rescue a surveyor in Lantern Wood | 10–13 |
| Gym 2 | Tideglass Port | Quays, gulls, lighthouse; repair the fog signal in Undertow Cave | 14–18 |
| Gym 3 | Copperwick City | Canals and power station; investigate Meridian's brownouts | 19–24 |
| Gym 4 | Sunspire Town | Desert oasis and glassworks; restore the hourglass shrine | 25–29 |
| Service | Reedhaven | Bamboo wetlands; ranger camp, breeding and nature reserve | 29–32 |
| Gym 5 | Cinderfall City | Volcanic mine and warm springs; release captive fire Pokémon | 32–36 |
| Gym 6 | Rimepeak Village | Alpine spa, snowfields; reopen the icebound pass | 37–42 |
| Gym 7 | Bellweather City | Sacred towers, purple roofs; Robin leaves Meridian | 43–47 |
| Gym 8 | Aster City | Observatory and star gardens; recover the last beacon lens | 48–52 |
| League | Crown Summit | Victory ascent and four specialist chambers; Champion Mira | 55–62 |

Route numbers and endpoints: 01 Dewpath (Dewdrop–Mossford), 02 Orchard Lane (Mossford–Bramble), 03 Lantern Approach, 04 Amberbank (Bramble–Tideglass), 05 Saltwind Coast, 06 Canal Road (Tideglass–Copperwick), 07 Switchyard, 08 Saffron Dunes (Copperwick–Sunspire), 09 Glassway, 10 Reedwalk (Sunspire–Reedhaven), 11 Bamboo Reach, 12 Ashen Trail (Reedhaven–Cinderfall), 13 Ember Slope, 14 High Pass (Cinderfall–Rimepeak), 15 Snowmelt Road, 16 Bellflower Way (Rimepeak–Bellweather), 17 Pilgrim Walk, 18 Starlit Avenue (Bellweather–Aster), 19 Observatory Approach, 20 Crown Road (Aster–League), 21 Dewdrop Grove (Cut return), 22 Tidal Crossing (Surf return), 23 Old Quarry (Strength return), 24 Moonwater Reach (Whirlpool return), 25 Aurora Trail (postgame).

Dungeons: Lantern Wood; Undertow Cave; Copperworks; Hourglass Ruins; Bamboo Sanctuary; Ember Mine; Frostvault Cavern; Echo Bell Tower; Meridian HQ; Starfall Observatory / Celestial Engine; Victory Ascent; Aurora Sanctuary. Dungeon interiors should differ mechanically: wood trail switch, tidal switches, power relays, rotating runestones, bridges, push boulders, slippery patches, bell sequence, keycard doors, constellation switches, mixed field moves, final research gates. The first implementation may use explicit inspectable switches and persisted flags for these puzzles, but must enforce actual ordering and unlocks rather than decorate with nonfunctional props.

The in-game region map shares town positions, route polylines and walking distances with the overworld. The Dynamo Badge opens two ways to the far shore, through Saffron Dunes and across the Tidal Crossing. The three central keepers accept challenges in any order, each after the local rescue or restoration. Their listed teams describe the Sunspire → Cinderfall → Rimepeak itinerary. On another itinerary their ace levels follow the fourth, fifth and sixth badge milestones. All eight badges still power the Celestial Engine.

## Eight gyms

| # | Leader / type | Badge / field ability | Team (level) | Gym approach |
|---|---|---|---|---|
| 1 | Fern / Bug | Canopy / Cut | Spinarak 11, Ledyba 11, Scyther 13 | Walk straight through the silk nursery to Fern. The two bug scouts train in the side beds. Rescue the surveyor before taking the east road. |
| 2 | Marina / Water | Tidal / Surf | Wooper 16, Staryu 17, Seadra 18 | Restore the Undertow fog signal to lower the lightship’s boarding gangway. Skirt the net-mending crew on the pier. |
| 3 | Volt / Electric | Dynamo / Flash | Voltorb 22, Magnemite 22, Ampharos 24 | Investigate the power theft. Beat either the twin-coil specialist on the west line or the speed specialist on the east line to release that catwalk. |
| 4 | Sable / Ground | Mirage / Strength | Sandshrew 26, Gligar 27, Donphan 29 | Bring the Hourglass lens to the fossil cut. Read the herd tracks on the long rim or pass the excavators on the short rim. |
| 5 | Flint / Fire | Ember / Rock Smash | Magmar 33, Rapidash 34, Arcanine 36 | Free the mine captives. Find Cyndaquil and Slugma recovering in the kiln refuge and challenge Flint across the ward. |
| 6 | Neve / Ice | Rime / Whirlpool | Sneasel 39, Dewgong 40, Piloswine 42 | Reopen Frostvault Pass. Coast across the rink and use the gold grit patches to change direction. |
| 7 | Lyra / Psychic | Chime / Waterfall | Xatu 44, Mr. Mime 45, Espeon 47 | Hear the Echo Bell recording and countersign Robin’s public testimony at the witness rail before facing Lyra. |
| 8 | Orion / Dragon | Astral / Fly | Dragonair 49, Kingdra 50, Dragonite 52 | Recover the Starfall lens to project the flight chart. The transit observer guards the brass meridian to Orion. The two side observers are optional. |

Field abilities are permanent badge tools; no HM move-slot tax. Cut opens groves, Surf lets the player traverse shallow-marked waterways, Flash reveals hidden cave paths, Strength clears marked boulders, Rock Smash opens cracked walls, Whirlpool unlocks marine shrines, Waterfall opens summit pools, Fly is a discovered-town travel menu. Gates should explain the required ability and mark the journal. Do not allow an optional secret to block the main story accidentally.

Elite Four: Rowan (Grass/Poison, 55–56), Petra (Rock/Steel, 56–57), Nyx (Ghost/Dark, 57–58), Gale (Flying/mixed, 58–59). Champion Mira has a balanced six: Jolteon 59, Lapras 59, Heracross 60, Houndoom 60, Tyranitar 61, Celebi 62. Full healing before League attempt, limited preparation between battles, defeat returns to a center without destroying progress. Rematch teams scale after Champion.

## Quest catalogue

Story: Partner & first survey → Lantern rescue → Tideglass fog signal → Copperworks power theft → Hourglass lens → Reedhaven ranger report → Ember Mine liberation → Frostvault passage → Bell Tower revelation / rival → Meridian HQ keycard and Vale → Observatory final engine → Eight badges / Victory Ascent → League → Aurora restoration.

Side quests (persistent journal with discoverable prerequisites, objective, reward and completed state):
1. Lost Parcel: Mossford courier → deliver to Bramble → Great Balls.
2. A Warm Hearth: show Growlithe/Vulpix to Dewdrop elder → Fire Stone.
3. Orchard Pollinators: catch three Bug species → Leaf Stone.
4. Tideglass Angler: catch three Water species → Water Stone and fishing access.
5. Lighthouse Lens: return with Surf → Lapras encounter.
6. Copper Collector: three hidden machine parts → Thunder Stone.
7. Fossil Memory: excavate Old Quarry → choose Omanyte/Kabuto; other available later.
8. Oasis Offering: restore ruin markers → Moon/Sun Stones.
9. Ranger's Census: 30 caught species → Exp Share / team XP boost.
10. Bamboo Friend: rescue Farfetch'd behind Cut → rare lure.
11. Furnace Delivery: bring mine ore to artisan → Metal Coat / Link Cable.
12. Mountain Medicine: collect snow herb and return to Mossford → friendship charm.
13. Echoes of the Past: bell sequence after Flash → Unown chamber.
14. A Rival's Promise: win all rival battles → Eevee and choice evolution stones.
15. Stargazer's Chart: visit all eight beacon sites → Master Ball.
16. Living Atlas: 251 caught → final researcher scene and Aurora certificate.

Legendary expeditions: Articuno in Frostvault after Waterfall, Zapdos in Copperworks after Champion, Moltres deep in Ember Mine, Mewtwo in Meridian's sealed lab, Mew in Dewdrop's hidden grove after a regional survey, Raikou/Entei/Suicune in three restored beacon shrines, Lugia beneath Undertow after Whirlpool, Ho-Oh atop Echo Bell Tower, Celebi in Aurora Sanctuary. Legendary losses must remain retryable. All nonlegendary species appear in encounter tables somewhere (rare evolved species acceptable alongside evolution). Starter families appear in late reserve habitats. No real-time exclusive windows: use an in-game clock / camp day-night switch. No trade locks: Link Cable and evolution items; friendship methods exposed. Pokédex includes seen/caught and habitat hints; PC storage supports every species.

## Systems and pace

- Accurate battles driven by the supplied `crystal-battle` Rust engine compiled to WASM, not a simplified damage calculator. Preserve HP, status, PP, experience, bag, money and catches from native results. Display legal actions, forced switches, move learning and evolution prompts correctly.
- Use `pokemon-sprite-compression` to decode the player's Crystal ROM, `pokemon-synthesizer` for music/cries. Never embed or publish a ROM or extracted proprietary asset files. Pin/vendor library source and acknowledge upstream limitations rather than claiming missing channels are implemented.
- 251-entry Pokédex, six-member party, storage, switching, healing, shops, catch rewards, experience, evolution and native move learning. Full save/import/export, autosave, versioned schema, persistent ROM in IndexedDB.
- Running default; normalized diagonal movement with swept collision and soft camera, eight-direction free positioning, interaction facing and generous radius. Grass encounter cooldown and step-distance accumulation. Repels, quick dialogue, battle speed 1×/2×/3×, instant healing, minimal mandatory grinding.
- Keyboard: arrows/WASD, Z/Enter/Space confirm, X/Escape cancel, Tab/M menu, Shift speed. Touch: lower-screen D-pad plus A/B and menu, multitouch pointer capture, safe-area support. Standard Gamepad API: last actively used controller (ignore idle receivers), axes/D-pad, A confirm, B back, Start menu, support 8BitDo FlipPad modes plus remapping if needed.
- PWA manifest with icons and standalone display; service worker caches application assets including WASM, never ROM URLs. Import UI explains browser-only storage; file picker and drop zone. Offline after one successful load and ROM import. Responsive desktop and mobile landscape/portrait.

## Technical division and acceptance

TypeScript + Vite, Canvas 2D pixel renderer, plain DOM overlays, a small Rust WASM bridge. Agents coordinate public APIs; source modules are separated by ownership.

1. Native engine/ROM/audio agent: `native/`, `vendor/`, `src/engine/`, build scripts and tests. Expose async initialization from Uint8Array, sprite canvases/pixel buffers, species metadata, make/heal/evolve Pokémon, start/act battle with serializable snapshots and results. Actual libraries must execute in-browser.
2. World/content agent: `src/world/`, content tests and content docs. Export deterministic authored world with typed maps, entities, exits, encounters, gym/trainer teams, quests and progression. Every declared area reachable at its intended badge threshold; all 251 obtainable; progression gates enforce requirements.
3. Runtime/UI agent: `src/main.ts`, `src/game/`, `src/ui/`, `src/styles.css`, HTML and PWA scaffolding. Own game loop, rendering, input, persistence, menus, story and battle presentation. Communicate integration needs to other agents early.
4. Lead: plan, generated new art, integration review, functional browser QA, full campaign checks, honest completion report.

Release checks: typecheck/build, ROM checksum validation, actual WASM smoke battle with local ROM sprite/audio decode, world reachability and species coverage, save round trip, first-launch import/choose starter/movement/encounter/capture/center/menu in browser, eight gym and story gating validation, install/offline infrastructure. Physical 8BitDo testing must be reported as unverified unless hardware is accessible. Full campaign balance and subjective quality cannot be declared proven by a smoke test.
