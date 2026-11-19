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

## Gym redesign

- The production build, 116 Vitest checks, three Rust tests and WASM cartridge smoke test passed. Each of the three starter campaigns defeated the eight keepers and Champion Mira in the seeded native battle simulation.
- Gym traversal tests cover both Copperwick releases, both rims of Sunspire’s fossil bed, optional sight lines, Aster’s mandatory observer, the closed harbor with Surf, and a route back to the entrance from every reachable skating stop. Journal tests cover all six orders of the middle badges.
- In an isolated Chrome profile with the verification cartridge, prepared saves started all eight leader battles with their own illustrated arenas. Keyboard movement crossed the rink to Neve. Robin’s testimony persisted through the dialogue UI. Dex spotted the player, fought a native battle and released the east catwalk on defeat.

## Dungeon and field-request redesign

- The production build, 133 Vitest checks, three Rust tests and the native WASM cartridge smoke check passed. World checks cover 40 rooms across 12 expeditions. They verify the shell bar, sun disk, cut reed crossing, both summit pitches, saved ice-plug positions, side passages and the two security clearances.
- All three starter parties reached the Hall of Fame in each of the six middle-keeper orders in the seeded native battle simulation. The simulation fights the freight dispatcher, uses the summit PC and buys its own supplies. The Bellsprout party on the Sunspire → Rimepeak → Cinderfall itinerary blacked out against Mira once and cleared the League on its second registration.
- In an isolated Chrome profile, prepared saves exercised all 16 field requests through the game UI, including a native Lapras capture, the Kabuto fossil choice, Robin’s stone, and the selected atlas cover. The tests supplied Pokédex records for the census and atlas thresholds.
- Keyboard movement stopped at Undertow’s high water and crossed the same tiles on foot after drainage. Both summit field actions persisted independently. At Echo Tower, a player played the peal, read the wax, walked through the revealed archive door and received Unown. The overnight sanctuary watch and each intermediate ice push survived a reload.
- At a 390×844 viewport, directional controls and confirm operated both telescope wheels while the sight stayed visible. Inspecting an orchard blossom added its progress to the journal before meeting the orchard keeper.

## November 19 playability pass

- In an isolated Chrome profile, a new journey imported the local cartridge, walked from home to Alder, previewed all three partners and chose Poliwag. Back returned to the same candidate. Previewing left the party empty until confirmation. Poliwag received its two displayed moves and the starting supplies.
- A prepared fishing save exercised a move, a first capture, a repeat capture with six occupied party slots, and a successful escape. The first catch opened its species record. The second showed the caught marker in battle and went to storage. Escaping returned to the pond after the native escape text. The saved journey then resumed offline.
- At 1100×700, the screen and keyboard legend fit together. The partner card fit at 320 and 390 pixels wide. A simulated touch steered from up through a diagonal to right and released. Portrait and landscape were inspected in Chrome.
- The production build, 136 Vitest checks, three Rust tests and the native cartridge smoke test passed. The ROM checks read both description pages for all 251 species. All three starter campaigns cleared the League in the seeded simulation.

## Pokémon Center storage

- All twelve Centers have a solid PC with a clear interaction tile in front. The field menu no longer offers remote storage. Tests cover transfers with duplicate species, a full party, a fainted Pokémon and the last healthy partner.
- An isolated Chrome session imported a legacy save containing all 251 species in reverse order. At the Crown Summit terminal, simulated gamepad input browsed the sorted register, paged through it, cancelled a full-party swap, then completed a swap, deposit and withdrawal. The party and collection matched the saved native Pokémon records after an offline reload.
- A separate Chrome check aborted the browser's write transaction during a full-party swap. The terminal kept the selected Pokémon and both original rosters. Retrying committed one exchange, which survived a reload. Aborting a backup import also preserved the previous journey.
- Compact portrait screenshots at 320 and 390 pixels wide were inspected. The production build, 141 Vitest checks, native Rust and cartridge smoke checks, and the three starter campaign simulations passed.
- On a subsequent production build, unplugging and reconnecting a simulated pad with its stick held kept the PC cursor in place. Pressing right on the D-pad with the stick held up advanced one page. The release passed 146 Vitest checks.
- On a fresh adventure, Growlithe caught a Rattata on Dewpath. The player deposited Rattata at the Mossford PC, crossed the orchard and withdrew it at the Bramble PC.
- With a 251-species save at Crown Summit, the D-pad opened a stored Wartortle’s summary, displayed its held Potion, moves and growth, and returned to its transfer screen. Pressing left on the first page kept the selected row. A full-party swap, deposit and withdrawal persisted through an offline reload. The detail and growth screens fit at 320 pixels wide.
- In a separate Crown Summit save, the species finder listed all 251 species across the 26 initials. The simulated D-pad found Celebi under C and showed three stored partners. Locate returned to the first Celebi in Pokédex order, a level-five partner nicknamed Spruce. A full-party swap preserved its native record. Cancelling the finder returned to the original cursor. The initials and names fit on a 320-pixel-wide screen.
- The D-pad stopped at the left, right, top and bottom edges of the initials grid, including the final row containing only Z. An equal-species, equal-level swap placed the outgoing partner after the partners already stored at that level. The 165 automated checks and native cartridge checks passed.
- Two seeded native surveys used copies of the same eight-badge Crown Summit save. Each started with 13 living species, captured 211 additional partners and finished with 224 distinct species in the party and PC. Both used False Swipe, sleep moves, regular shops and repeat road battles to pay for supplies. With the ₽600 grant for first wild registrations, the survey needed 43 funding rematches. The previous economy took 254. Travel and Center visits were simulated.
- In Chrome, a full-party fishing catch sent Magikarp to the PC and credited ₽600. A wallet with room for ₽29 received exactly ₽29, and a full wallet stayed at ₽999,999. Each balance survived a reload and a repeat catch. All 251 native species descriptions, names, categories and type combinations fit the first-catch card at 320 pixels wide. All 164 Vitest checks, the native cartridge checks and 18 seeded League campaigns passed.

## Wild encounters and Reedhaven nursery

- A cartridge integration check started a native wild battle for each of the 251 species using its authored habitat or guardian encounter. Each fixture supplied a Master Ball. Both day and night catches recorded the field clock, and Route 09 Unown completed its battle introduction and capture.
- In an isolated Chrome profile, Raichu and Clefairy stayed in the Reedhaven cabin after a reload. Walking ripened their egg, the keeper returned both parents, and the Key Items pocket showed the egg until Pichu hatched with Encore. Its record survived a second reload. The hatch screen and Continue button fit at 320 pixels wide.
- All 144 Vitest checks, three Rust tests, the native cartridge smoke check, the production build and all three starter campaign simulations passed.

## Party summaries and held items

- In a 320-pixel-wide Chrome session, the party cards showed Eevee’s five evolution paths and Tyrogue’s three Attack/Defense branches. A level-100 Crobat showed the level cap. The card showed all five battle stats, move PP and friendship. A fainted party member had no Make lead command.
- A nicknamed Eevee’s Berry was taken into the Bag, given back, and retained when Eevee moved to the lead and the save reloaded. The native bridge tests compare the summary’s experience thresholds to freshly generated Pokémon and round-trip all 255 held-item IDs through the Bag.
- In a native wild battle a level-nine Metapod with Tackle earned level ten, evolved and learned Confusion in its open slot. A separate Chrome session resumed two pending evolution decisions, accepted one, deferred the other and then used a Water Stone on a level-16 Eevee. The four-move choice fit at 320 pixels. Back kept the old moves. Reloading reopened the choice, and learning Water Gun replaced only the selected move and spent one stone.
- All 150 Vitest checks, three Rust tests, the cartridge smoke check and the production build passed. All 18 starter and middle-badge-order combinations won the League using the updated evolution and move-learning rules in the campaign simulations.

## Marts and field medicine

- At Rimepeak’s counter in an isolated Chrome save, the D-pad changed departments, paged through medicine, adjusted a purchase and cancelled it. A stack of 99 and an unaffordable stone both showed the reason the sale could not go through. Buying two Burn Heals and two Ethers cost ₽1,700. A Burn Heal cured only the burned target. An Ether restored 10 PP to the selected move and retained its PP Ups across a reload.
- In Scout Ari’s trainer battle, the Bag offered the reserve’s depleted move for Ether and its poisoning for Antidote. Back returned to the same party member before confirming. Both items were consumed once. The lead Metapod won, reached level ten, evolved into Butterfree and learned Confusion through the production UI.
- The production build, 152 Vitest checks and 18 seeded starter and middle-badge-order campaigns passed. The native item checks cover each of the five individual status cures, Full Heal, and move-specific PP recovery on a fainted partner.

## Fresh browser journey

A five-badge save had a trainer win on Dewpath, but Rattata’s habitat record still labelled Dewpath “Unvisited.” After updating, an isolated copy of that save showed “Visited” for Dewpath. Walking onto High Pass, returning to Cinderfall and reloading retained the new route alongside the recovered ones.

A Chrome playthrough using the local verification cartridge followed one save from the Dewdrop doorstep onto Route 04. Growlithe caught Rattata on Dewpath and defeated Scout Ari. Rattata stayed in the Mossford PC during the orchard crossing and rejoined the party at Bramble. The journal led the player to the stranded surveyor in Lantern Wood and then to Fern’s gym.

After losing to Fern, the player picked up the orchard’s Fire Stone, evolved Growlithe, fought local trainers and bought Potions with the winnings. The rematch awarded the Canopy Badge and Cut. Reloading in the gym retained both rewards. The player then used Cut on Bramble’s east road and crossed into Amberbank, where the saved game recorded the cleared tree.

The same adventure reached Tideglass. After an offline restart, its PC returned Rattata with its original record. The player drained the breathing pool in Undertow Cave, crossed the shell bar and restored the fog signal. They caught Chinchou on the coast, crossed the lightship’s lowered gangway and fought both dock trainers. After the first loss to Marina, optional trainers on Amberbank and Saltwind Coast and a return to the Mart prepared the party for a rematch. The win awarded the Tidal Badge and Surf.

From Tideglass the player followed Canal Road to Copperwick, read the night meter in the loft and isolated the foundry feeder. The service lift reopened after the intake was restored. Beating Coil Winder Tess opened the west catwalk to Volt. After a loss, the player trained Diglett near Copperworks, beat Line Runner Dex on the east catwalk and returned to Volt with Diglett leading. The rematch ended with three badges, Flash and a level-16 Diglett in the saved party.

The player used Flash on Copperwick’s north road, crossed Saffron Dunes and caught Marowak. In the Hourglass Ruins, the player read the frieze, sighted the disk from its western shadow, restored the lens and used the sand chute to return. The save recorded both gym trainers defeated, Sable’s Mirage Badge and Strength.

The Sunspire glassworker accepted the repaired offering bowl and awarded a Moon Stone and a Sun Stone. From Reedhaven the player inspected the nest and the burrow in Bamboo Sanctuary, filed the ranger report, and crossed Ashen Trail to the Cinderfall Center.

After several losses on Ember Slope, the party defeated the freight dispatcher and freed Cyndaquil and Slugma in the mine. Flint won the first gym challenge. At the Cinderfall PC the player exchanged Rattata and Tentacool for the Magcargo and Golduck caught earlier. Magcargo led the team against Robin and the kiln trainers, then reached level 36 in the rematch that awarded the fifth badge and Rock Smash.

At the Cinderfall forge the player heated, hammered and quenched the salvaged ore for a Metal Coat and Link Cable. The team crossed High Pass, pushed the Frostvault ice plug three times and reopened the pass. They picked silverleaf on the traverse and steeped it at the spa. After battling both rink trainers, the player skated five stretches to Neve. Arcanine led the team to the Rime Badge and Whirlpool.

Whirlpool opened Bellflower Way. At Echo Bell Tower the player rang the three-rope watch peal, heard the recording and took a rubbing to the historian, who introduced Unown. Robin’s testimony opened the way to Lyra. After winning the seventh badge, the player collected the night clerk’s pass, found the signed diversion order and defeated Director Vale in his office.

At Bellweather’s PC, the player withdrew the Dewgong caught on High Pass. Waterfall opened Route 18. The player aligned the Starfall telescope, defeated Aster’s three gym trainers and won the eighth badge from Orion. After shutting down the Celestial Engine, the team took the west pitch of Victory Ascent, defeated Rope Captain Tor and signed the summit register.

At Crown Summit, the player used the PC to exchange Diglett for Noctowl and stocked up for the League. The team beat Rowan, Petra and Nyx before falling to Gale. The party woke up healed at Crown Summit and the League challenge reset.

## Save recovery

- An isolated production build distinguished an invalid cartridge, an unavailable game engine, a failed cartridge cache write and a failed save read. Retrying the engine and cache used the file already selected. Playing with an uncached cartridge wrote a working save that reopened after choosing the cartridge again.
- Both a damaged record and a working Tideglass journey exported to JSON and matched the stored originals. Backing out of a replacement, aborting its first write or aborting a backup import preserved the previous record. Retrying successfully started a new journey or restored the selected backup. A fresh browser also restored the Tideglass backup directly from the opening screen.
- Aborting an autosave left the previous battle speed on disk. A landscape viewport showed the unsaved-progress notice. The exported backup contained the new setting, and retrying saved it in the browser. The recovery screen fit at 320 pixels wide.
- Two open game windows reproduced a lost update. One restored an Amberbank backup while the other held a Tideglass journey. After the fix, changing battle speed in Tideglass preserved Amberbank on disk. The older window exported its Tideglass progress, cancelled a reload, then opened the newer journey. Separate checks covered two simultaneous new-game starts and a full-party PC swap from an older session.
- Automated IndexedDB tests cover competing writes to a legacy save, queued snapshots, idle autosaves and rollback of both the save and its revision on an aborted transaction.

## Individual Pokémon appearances

- The native encounter test caught all 26 Unown letters. Each capture retained the appearance from battle, and all letters decoded distinct front and back pictures from the local cartridge. The Magikarp check compared both sides against the normal and shiny cartridge colors.
- An isolated Chrome save at Crown Summit showed four distinct Unown portraits, including shiny I and V. The stored partner’s summary matched its PC portrait, and the party tab distinguished ordinary and shiny Magikarp. The individual letter and shiny labels fit at 320 pixels wide.
- Older Hall of Fame records with only species and level still open with the standard species portrait. New records include the winning partners’ DVs.
- In a staged battle at the Copperworks perch, switching from an ordinary Unown to a shiny Unown changed its back picture. Zapdos returned after the player escaped and again after a knockout and reload. Capturing it registered the same front portrait seen in the encounter and marked the perch complete.
- In a seeded Route 18 encounter, wild Ditto copied shiny Unown V. From the transformation message onward its picture matched an ordinary V in the test party. The HUD still identified Ditto as uncaught. The first-catch card and the saved partner matched the original Ditto’s portrait and DVs.
- Two Unown V showed Grass and Electric Hidden Power in their summaries, each with 49 power. The Fight menu showed the lead’s Grass move. In a separate Route 09 encounter a player’s Ditto copied a wild Unown and the menu changed to Flying with 60 power. The native calculation was checked for every 16-bit DV combination. All 160 Vitest checks, four Rust tests, the WASM cartridge smoke test and all 18 seeded League campaigns passed.

## Legendary encounters

- In isolated Chrome fixtures with the required progress, the player interacted with each of the eleven guardians at its authored perch. A Master Ball at each site registered the species, added its individual record to the party and set the encounter’s completion flag.
- A separate fixture brought one injured partner to Zapdos. Defeat returned the healed party to Copperwick Center. The player withdrew a reserve at the PC, walked through Switchyard, took the reopened lift and captured Zapdos at the same perch.
- Native battles compared an ordinary wild encounter with a fixed shrine encounter using the same species and seed. Ordinary Raikou and Entei fled on the first turn. At their shrines both took turns, fell asleep, were weakened to 1 HP and were caught in Ultra Balls.
- Seeded Chrome checks repeated the captures at the Tidal Crossing and Old Quarry shrines with Smeargle. Raikou took three Ultra Balls and Entei took four. Both saves retained the guardian at 1 HP.
