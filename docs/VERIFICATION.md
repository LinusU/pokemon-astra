# Verification record

## Earlier build checks

- `npm run build`: compiles the actual Rust WASM bridge, typechecks TypeScript, builds Vite assets, and generates a content-versioned offline worker. Final bundle excludes ROMs and saves.
- `npm test`: 49 tests across nine files: world content/progression, actors, navigation, input, audio scheduling, battle presentation, offline caching, save validation, and native bridge integration.
- `npm run test:native`: three Rust tests plus an actual WASM/ROM smoke script. Covers persistent battle outcomes, genuine interactive move replacement, healing, forced switching, multi-member trainer battles, full-party capture into storage, decompression of 502 front/back sprite images, continuous music sample equivalence, and Pokémon cries.
- World checks: 108 connected maps; 12 settlements; 25 routes; 36 dungeon rooms; eight gyms; 95 trainer battles; 16 quests; all 251 species obtainable via wild/static/gift sources; legendary species absent from ordinary grass; main story and badge gates unlock in order; all objects and transitions are physically reachable.
- Input checks: quick taps between frames, no held-confirm repeat, aliased keyboard directions, multitouch release/cancellation, and ignoring an idle gamepad receiver while following the actively used controller.
- Save checks: native array/scalar validation, invalid or duplicate Pokédex entries, round trip with full Pokémon data, and recovery from an obstructed saved position.
- Actor/navigation checks: solid roaming NPCs, forward trainer sight with occlusion, notice/approach sequencing and cancellation, directional interaction range, reciprocal three-tile road mouths, fractional-position continuity across map boundaries, and collision while straddling an edge.
- Battle/graphics checks: native damage/status/capture events, all 251 move classifications, trainer names and prizes, replacement Pokémon HP, level-up move choices, directional walk frames, and exterior-only sprite transparency.
- Audio/offline checks: gesture-unlocked scheduling, scene changes and mute handling; generated service worker installation and offline shell/JS/CSS/WASM retrieval with cartridge/save exclusion. Eight music tracks and seven emitted native sound-effect IDs produced nonzero PCM during local ROM verification.

## Earlier browser checks

Using the actual production JavaScript/WASM and the user's local English Crystal 1.1 ROM:

1. First-launch file selection accepts the correct cartridge and starts the adventure. Reload uses IndexedDB without asking again.
2. Animated keyboard movement, NPC collision, roaming residents, entering/leaving the lab, and entering Route 01. The Route 01 → Mossford crossing displays the neighboring map before crossing and preserves direction and position through the boundary.
3. Starter choice and persistent Growlithe party state.
4. Scout Ari visibly notices and approaches the player, then battles through victory. Fixed opponent/player HUDs, A-acknowledged text, PP consumption, HP animation, stat changes, fainting and experience were inspected. Returning to the world no longer restores the title artwork.
5. Wild Ledyba and Caterpie encounters: encounter transition, move effects, failed and successful ball attempts, visible ball throw, Potion target selection/healing, opponent response, persistent captures, and return to the world. The saved party contains Growlithe, Ledyba and Caterpie.
6. Production update loads the new content-hashed bundle while preserving cartridge and save.
7. **Offline startup:** the first polish-build attempt exposed a blank screen. The worker now serves the complete matching build from its cache, registration starts immediately, and the UI reports readiness. After the fix, the local HTTP server was stopped and the page reloaded successfully; the saved Mossford adventure continued with ROM graphics available.
8. Portrait (390×844) and landscape (844×390) viewport inspection; directional touch targets measured 48×48 CSS pixels. Landscape button overlap was found and fixed, then visually verified. Touch event semantics are also unit-tested.
9. Talking to the Mossford courier acquires the parcel; the journal then shows the delivery destination. No parcel pickup lies on the ground.
10. Sound unlock, saved sound setting, music scene changes and Potion use produced no browser warnings/errors during the online production-build playtest. Actual audio output was also checked as synthesized PCM; physical speaker fidelity was not measured.

Polish QA additionally caught incorrect overworld tree cells, opaque white sprite regions being removed, oversized small Pokémon, stale replacement HP, missing capture-ball positioning, raw native trainer names/prize text, parcel feedback, landscape controls, and offline startup. These were fixed before this publication.

## November 17 release

- The production build compiled the Rust engine and TypeScript, emitted 13 offline assets, and passed the cartridge-exclusion check.
- All 61 Vitest checks passed across 11 test files, alongside three Rust tests and the native WASM smoke check using the local English Crystal 1.1 ROM.
- The revised region contains 112 maps, 95 authored trainer battles, and 46,092 total map tiles. The previous build had 108 maps and 77,504 tiles. Separate suites check reachability with solid characters, grass and species coverage, badge barriers, League chamber order, and a valid journal route at each step from a fresh save through the Living Atlas.
- Three native campaign runs, one per starter, won 64 pre-League trainer battles each and cleared all eight gyms and the five League fights. They caught 15–16 Pokémon, included one optional trainer per numbered campaign route, used Centers between pre-League fights, and made informed switch, evolution and inventory choices. Each could buy a ₽40,400 League kit with earned funds. No repeated wild fights for experience were needed. The check is reproducible with `npm run test:campaign`.
- Chrome rendered all 112 maps using the local cartridge. Visual review covered all 12 settlements plus representative routes, gyms, caves and service interiors. A 390×780 browser test used simulated standard Gamepad input to verify two-column navigation, held-direction scrolling, confirm and back.
- In an isolated browser save, a new journey imported the local ROM, walked from home to the lab and chose Poliwag. The party screen showed Bubble, Water Gun, their PP and the level-25 evolution. Local maps displayed the player, next destination, exits and bearings.
- A save from the campaign simulation was imported in Mira’s chamber. The entire six-opponent Champion battle was played through the production UI. It awarded victory, showed the six winning partners in the Hall of Fame, and advanced the journal to the Aurora Sanctuary. Reloading retained Champion progress. A later browser check confirmed the updated ceremonial arena, a scaled rematch, staged trainer introduction, Pokémon reveals and twilight battle scene.
- Tideglass was visited using Fly. Its pier, lighthouse, Surf skiff, and route map were inspected. With the local server stopped, a reload continued the saved Tideglass adventure and the postgame map still offered Fly to Dewdrop. The worker’s update flow was also exercised against successive production builds.

## November 18 playability checks

- The region contains 119 maps and 34,758 tiles, including seven additional local buildings. The previous version contained 112 maps and 46,092 tiles. All 12 Centers and 12 Marts have a service counter and a second character.
- The world tests exercise the eight-badge route, recover older saves from new solid tiles, and verify dry approaches, water crossings, and field obstacles. In the production browser, walking into the Bramble tree kept the game in the overworld. Inspecting it explained Cut. Using Cut after earning the badge opened Route 04 and persisted the cleared tree. The village camera framed the nearby streets at the starting doorstep and scrolled continuously across the opened road.
- A new journey walked from the doorstep in Dewdrop to Alder’s lab using directional input, chose Growlithe, and received ten Poké Balls and five Potions. A separate check walked out of the home using its south-wall doormat.
- In an isolated save, an injured Growlithe healed across the nurse’s counter. Buying five Poké Balls at once cost ₽1,000 and added five to the Bag. D-pad, A, B and touch were exercised through pockets, the item action menu, Pokémon selection, cancellation and returning to the selected item.
- A battle against Scout Ari opened with FIGHT selected. Moving the cursor between attacks changed the move details. The dialogue box retained its measured bounds from the command grid through move selection. Both sprites stayed within the arena. Choosing a trainer battle’s ball pocket displayed the restriction and disabled Throw.
- Growlithe defeated Ari’s Pokémon and gained 79 EXP. The reserve Caterpie’s EXP stayed at 64 and the Bag retained every ball. A separate wild Pikachu capture showed the throw animation, consumed the ball and added Pikachu to the party. An explicit practice rematch with Ari paid ₽140, retained the story flags and left Caterpie’s EXP alone. The production app resumed the saved journey with the browser offline.

- On an iPhone Air simulator running iOS 26.2, Safari installed the production build using Add to Home Screen. Launching its icon opened the standalone app. The local cartridge imported through Files and the adventure began in Dewdrop. Portrait and landscape screenshots were inspected. The canvas and controls were inside the system safe areas.
- All 71 Vitest checks, three Rust tests, and the native WASM/ROM smoke check passed. The production build generated 13 offline assets. Three seeded native campaign runs cleared all eight gyms and the five League fights. Each run won 84 pre-League trainer battles and eight practice rematches across two rounds with four route trainers and caught 17–19 Pokémon. The simulator used the player’s earned money for supplies and tested the participant-only experience rules.

## Regional atlas and open shores

- All 110 Vitest checks passed. The geographic checks follow the shared survey across the tile grid, compare both sides of every outdoor seam, and check that roads neither cross other roads nor run through unrelated towns. Indoor rooms resolve to exterior entrances. All exits, NPCs and encounter habitats remain accessible.
- All six Sunspire, Cinderfall and Rimepeak orders reached the Hall of Fame with each of the three starters in the native battle simulation (18 runs). The simulations recruit locally available Pokémon, use Centers, spend earned money and allow practice rematches. The journal tests exercise actual gate prerequisites for each order. To repeat a combat itinerary, use `npm run test:campaign -- --shores 654` for Neve, Flint and Sable, for example.
- Chrome opened all 37 chart entries, toggled the local map and zoom, located a trainer in Frostvault at its Snowmelt Road entrance and used Fly from the chart. Inspecting the resident Caterpie on Dewpath registered it as seen. Keyboard input crossed Dewpath from Dewdrop to Mossford, Bellflower Way from Rimepeak to Bellweather and Tidal Crossing from Tideglass to Reedhaven end to end, using prepared saves to isolate navigation.
- The desktop chart, 390×844 mobile viewport and nine representative overworld routes were visually inspected. In the production build, a fresh local cartridge import opened the atlas, and the saved game reopened it after an offline reload. The native Rust tests and WASM cartridge smoke check also passed.

## Limits

The scripted campaign measures playability with informed team choices. Uninterrupted first-time human playthroughs, time to complete the 251-species Pokédex, physical FlipPad input, and installation on a physical iPhone remain unverified. Puzzles use themed mechanisms and persistent conditions. Move effects use custom animation families; upstream battle paths such as PP Up and contest-only mechanics remain unported.

The synthesizer’s Gen 2 music wave channel is implemented in the vendored 0.2.3 code. The upstream README checkbox is stale.
