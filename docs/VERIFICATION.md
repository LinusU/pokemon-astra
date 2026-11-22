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
- Using a copy of the eight-badge journey, the player deposited Magcargo at Crown Summit with the D-pad, then used Fly to visit the other eleven towns. The player entered each Center, walked up to its terminal and found the same stored Magcargo. Withdrawing it at Aster and reloading offline preserved its complete Pokémon record.
- With a 251-species save at Crown Summit, the D-pad opened a stored Wartortle’s summary, displayed its held Potion, moves and growth, and returned to its transfer screen. Pressing left on the first page kept the selected row. A full-party swap, deposit and withdrawal persisted through an offline reload. The detail and growth screens fit at 320 pixels wide.
- In a separate Crown Summit save, the species finder listed all 251 species across the 26 initials. The simulated D-pad found Celebi under C and showed three stored partners. Locate returned to the first Celebi in Pokédex order, a level-five partner nicknamed Spruce. A full-party swap preserved its native record. Cancelling the finder returned to the original cursor. The initials and names fit on a 320-pixel-wide screen.
- The D-pad stopped at the left, right, top and bottom edges of the initials grid, including the final row containing only Z. An equal-species, equal-level swap placed the outgoing partner after the partners already stored at that level. The 165 automated checks and native cartridge checks passed.
- Two seeded native surveys used copies of the same eight-badge Crown Summit save. Each started with 13 living species, captured 211 additional partners and finished with 224 distinct species in the party and PC. Both used False Swipe, sleep moves, regular shops and repeat road battles to pay for supplies. With the ₽600 grant for first wild registrations, the survey needed 43 funding rematches. The previous economy took 254. Travel and Center visits were simulated.
- In Chrome, a full-party fishing catch sent Magikarp to the PC and credited ₽600. A wallet with room for ₽29 received exactly ₽29, and a full wallet stayed at ₽999,999. Each balance survived a reload and a repeat catch. All 251 native species descriptions, names, categories and type combinations fit the first-catch card at 320 pixels wide. All 164 Vitest checks, the native cartridge checks and 18 seeded League campaigns passed.
- A separate Growlithe campaign won the League in the native simulator. In Chrome, the player took its team west from Dewdrop, logged Aurora’s daylight pollen flight and night spawning watch, and restored the sanctuary. Starting with those 20 living species, a native encounter survey caught the other 231, including all eleven guardians, using ordinary Poké Balls and earned funds. It took 1,475 encounters and 14 funding rematches. Back in Chrome, the Dewdrop PC listed 245 stored species with the remaining six in the party. The player took the collection to the Aurora editor, chose the Moon pool cover and opened the certificate from the Bag. The sorted collection and certificate survived an offline reload.

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

At Bellweather’s PC, the player withdrew the Dewgong caught on Snowmelt Road. Waterfall opened Route 18. The player aligned the Starfall telescope, defeated Aster’s three gym trainers and won the eighth badge from Orion. After shutting down the Celestial Engine, the team took the west pitch of Victory Ascent, defeated Rope Captain Tor and signed the summit register.

At Crown Summit, the player used the PC to exchange Diglett for Noctowl and stocked up for the League. The team beat Rowan, Petra and Nyx before falling to Gale. The party woke up healed at Crown Summit and the League challenge reset.

The player caught Aerodactyl on Crown Road and Ampharos on Observatory Approach and withdrew them at Crown Summit and Aster. Gale won the next attempt. Ampharos then led the party against the remaining route trainers, including Robin on Route 18, reaching level 51 before the third attempt. The team defeated the Elite Four and Champion Mira and entered the Hall of Fame with Arcanine (63), Aerodactyl (48), Noctowl (41), Dewgong (61), Ampharos (59) and Magcargo (36). This journey used scripted browser inputs and normal saves from Dewdrop through the League. Its battle driver used the native campaign suite’s decision rules for the final attempt.

After reloading the same journey, the player flew to Dewdrop, walked Aurora Trail and restored the sanctuary by observing Butterfree in daylight and the Wooper eggs at night. A separate native survey started from a copy of this save with 16 living species. It caught the other 235 across 1,524 encounters and paid for supplies with field grants and 25 rematches. In Chrome the player checked the 245 stored species at Dewdrop’s PC, selected the Ember nursery cover at Aurora, read the certificate and reloaded offline with all 251 partners.

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

## Regional map and field playtests

- Chrome rendered all 25 route landmarks and all 12 settlements with the verification cartridge. A walking test for each route closes the middle of the main road and checks that the side trail still reaches both junctions, the cache and the resident Pokémon.
- A fresh production save chose Growlithe in Alder’s lab, fought Scout Ari on Dewpath, visited Minnow Bend, caught a wild Pidgey and healed at Mossford. Chrome then reloaded the journey offline. Separate saves observed the returning Poliwag in Dewdrop, Krabby in Tideglass and Clefairy in Aster.
- Prepared saves solved the revised Copperworks isolator, Frostvault ice plug and Starfall telescope in Chrome. Fern’s battle awarded Cut and the first badge. All eight award screens were checked at 320 pixels wide.
- All three starters cleared the Astral League in the native battle simulation for each of the six middle-gym orders. These runs use informed team and supply choices.
- All 123 local maps rendered at 320×660, 390×844 and 844×390 browser sizes. The D-pad scrolled a long Copperworks gate note on the smallest screen. An imported postgame save used Fly from the local map to reach Tideglass.

## November 19 gameplay checks

- The production build, 211 Vitest checks and four Rust tests passed. The WASM smoke test used the local verification cartridge for a full-party catch, a trainer switch, 502 sprite decodes, music and a cry.
- All three starters beat the League in each of the six middle-gym orders. These 18 seeded campaigns used informed battle and supply choices. A separate field traversal reached all 123 maps, all 16 requests and catch sources for all 251 species, assuming successful catches, battles and puzzles.
- A fresh Chrome journey chose Growlithe, fought Scout Ari, caught a wild Pokémon on Dewpath, healed in Mossford and resumed offline. A second journey chose Poliwag using two simultaneous touch contacts, then opened and closed the party screen in landscape. Controller checks used simulated input. Physical 8BitDo hardware remains unverified.
- The Victory Ascent trainer cleared the Rope School corridor after battle. Running out of Old Quarry on a slow frame landed inside the Cinderfall road. A Repel counted the full Dewdrop road crossing and expired during a Rimepeak glide. Renewing spent one item and survived reload. Declining kept the spare. Reloading with a Rare Lure brought a grass encounter within two tiles.
- The Bramble courier left the parcel in the Bag when five Great Balls would have exceeded the stack limit. The incomplete delivery survived a reload. With room for all five, the courier took the parcel and the stack reached 99.
- Battle tests covered Pay Day on victory, capture and escape, an active or benched Amulet Coin holder, and combined prize and coin receipts at the wallet limit. In Chrome, the player reconsidered both replacing a move and keeping the old moves. Back from the field Ether move list returned to the sixth partner with the Ether still in the Bag.
- Prepared Chrome saves caught all eleven guardians at their perches. Each capture spent one Master Ball and recorded its completion flag. The Center PC and partner summary agreed on individual Unown portraits. Ordinary and shiny Magikarp kept their different palettes.
- In a short headless Chrome sample with 4× CPU throttling, the 95th-percentile game-loop callback took 0.9 ms while standing and walking in Dewdrop. The 95th-percentile frame interval was 16.8 ms. These timings cover that local scene and machine.

## Handheld, battle and exploration polish

- The production build, TypeScript check, 222 Vitest tests, four Rust tests and the local-cartridge WASM smoke test passed. All three starters beat Mira in each of the six middle-gym orders. Seventeen seeded campaigns cleared the League on their first attempt and one cleared it on its second.
- A fresh Chrome journey imported Crystal 1.1, chose Growlithe, defeated Scout Ari, caught Hoothoot on Dewpath and healed both partners at Mossford Center. With networking disabled, the journey reopened at the Center with the healed party.
- Chrome checked cartridge selection, an invalid file drop, the opening journal and Options at 320- and 390-pixel phone widths, in landscape and on desktop. Simulated gamepad input changed the A/B layout without closing Options on the held button. The new layout, battle speed, sound and camp settings survived a reload. In the final production build, Chrome touch emulation paged through all five guide topics at 320 pixels, walked in Dewdrop, rotated to landscape, and reopened Options after an offline reload.
- The cartridge test decoded effects for all 251 moves. In a 320×240 battle the player highlighted all four moves and reconsidered a level-up replacement. The partner summary and evolution lesson showed the same effects.
- Pokédex checks opened known, unseen, locked and local habitats, zoomed out to the region and returned to the same record. All eleven guardian sites have checks for their locked, available and captured states. At Copperworks, Chrome showed the locked coil, encountered Zapdos after unlocking the perch, then found its claw marks after capture and reload.
- Backup review at 320 pixels compared a one-badge Tideglass journey with an eight-badge backup. Export and cancellation preserved the original. An aborted restore retried with the same file. A competing window kept its newer save. First-launch and damaged-save recovery still opened valid backups directly.
- A production install under a subdirectory received two failed responses for a required icon. Both retries were available while the journey stayed open. The retry from Options finished, and Chrome reloaded the saved game after the test server stopped.

## Journeys and the Yellow adventure

- Storage tests cover the one-time move of an earlier single save into the journey list, separate journeys with their own summaries, deletion, and conflicts between two windows on the same journey. In the browser, an earlier-format Astra save appeared in the list as Mossford with one badge and continued from there. A new Astra journey and three Yellow journeys sat side by side.
- Yellow tests use the local English Yellow cartridge (`pokeyellow.gbc`, SHA-1 `cc7d0326…`). They decode map headers, connections, warps, objects, dialogue, trainer parties, prize money, encounters, item names and prices, and the gym leaders' special moves. They check TM and HM numbering, Gen 1 to Crystal item matching (Poké Balls included), and that every map script, custom text routine and hidden object in the cartridge has a port: zero gaps across 227 maps. A further test resolves every cartridge table and text label the runtime and scripts use.
- A browser sweep warped to all 227 maps and ran their entry scripts without errors.
- A fresh Yellow journey was walked with real movement from the bedroom to Oak, through the Pikachu catch, the lab, the rival battle, Route 1, Viridian's Mart, Oak's Pokédex and the Route 22 rival. A development harness (`yellowDebug()` in the dev console) auto-played battles on the native engine with a debug team. It confirmed Brock, Misty, Bill's cell separator and S.S. Ticket, the S.S. Anne Captain's HM01, Cut, Lt. Surge's trash cans, the ghost Marowak with and without the Silph Scope, Silph Co.'s elevator and Card Key doors, Snorlax and the Poké Flute, the Safari Zone's fee, balls, steps and catches, a Cinnabar quiz gate, Surf, Fly, Flash in Rock Tunnel, Mewtwo, the Elite Four and Champion, the Hall of Fame and credits, and the Pokémon Center nurse.
- Free movement was driven in the browser with held keys, frame by frame. It covered diagonal walking in Pallet Town, entering Red's house through its one-square door from half a square off-line, leaving by the mat, Route 1's ledges and the Route 1 ↔ Pallet Town crossing (Pikachu shifting with the player), surfing in Pallet Town's pond and landing, and a Route 3 trainer's sightline. The player finished the square and the trainer walked over before the battle. It also covered the Viridian Gym spinner (a forced walk of nine squares), pushing a Strength boulder twice in Victory Road, and Oak stopping the player at Pallet Town's north edge and leading them into the lab. Option → Movement switches to square-by-square steps.
- Crystal graphics: tests check that every Crystal look names real Crystal tilesets and tile ids, that every tile used on every Yellow map of a covered tileset is mapped, that Crystal's tables sit at the generated offsets, that Pallet Town's pond uses Crystal's animated water, and that every Yellow sprite has a Crystal sprite or Crystal colors. In the browser, Pallet Town, Route 1, Viridian's Pokémon Center, Vermilion Gym and Mt. Moon were drawn with Crystal's tiles, colors and sprites. Tall grass covered the lower half of the player and Pikachu, and Option → Graphics switched back to Yellow's look. Each interior tileset was compared with its original in rendered previews of the maps that use it. A browser sweep drew all 227 maps, their animated tiles and the 1,746 people placed on them with the Crystal look, without errors.
- Not verified: an uninterrupted human playthrough of Yellow, battle balance with a normally raised team, Seafoam's boulder currents, Victory Road's boulder switches, and the Rocket Hideout spinners in play. The scripts for these were ported from the disassembly and pass the reference and coverage checks.

## Yellow Legacy

- Yellow Legacy V1.0.10 was built from its tag with rgbds 0.6.1. The ROM is byte for byte the official V1.0.10 patch applied to the English Yellow (SHA-1 `2ac87de4…`), and its symbol table was generated from that build. Yellow's own table still regenerates identically.
- Tests with the official patch (`yellow-legacy.bps`) apply it in the browser's BPS code and identify both cartridges. A synthetic patch checks the BPS reader, including a source with the wrong checksum.
- Against Legacy's table and cartridge, tests read TM04 as Flamethrower, Janine's new trainer class and Brock's full boss moveset, and round-trip a fresh Yellow Legacy save, which Yellow's validator rejects. Every trainer party on the 227 used maps (337 in all), their hand-picked moves and 630 wild slots decode to Gen 1 species, levels and moves.
- Every map label, text label and constant the ports use resolves in Legacy's table. Renamed Jessie and James events are aliased to Legacy's trainer events in the generator.
- The coverage check finds no unported map script or hidden object on Legacy's cartridge, and 42 text routines that are Legacy's own logic (15 distinct): Strength at boulders, the move relearner and deleter, the Cinnabar Gym quiz, the prize corner clerk, the Fuchsia nurse, post-game Oak, the Seafoam fight and a few town characters. They print their text without the logic.
- Machine items now teach the move their table entry holds (TM01–TM50 before the HMs, as in Yellow's TMToMove), in both Yellow adventures. Compatibility comes from Crystal Legacy's TM, HM and tutor sets for moves Crystal has a machine for; a test compares all 151 species with the engine's sets, and Gen 1 machines such as Mega Punch keep the cartridge's list.

## Shared free movement

- Both adventures walk with `src/game/free-movement.ts`. Its tests cover walking and running pace, diagonal speed and facing, stopping at a wall after a long frame, sliding along a wall on a diagonal, easing into a one-square gap from off-line, and stopping on reaching a new square.
- In the browser, Astra walked at 5.1–5.2 squares a second in Mossford and ran at 7.2 with B or Shift. Walking up at the Mossford Mart door 0.4 of a square off-line, from either side, slid the player in through the door. A plain wall stopped them. On Neve's rink the player still glided from the grit to the next grit square.
- Yellow walked at 5.0–5.3 squares a second in Pallet Town and ran at 6.8–7.5 with B or Shift. Readings vary because the walk pauses for a frame at each new square, so that square's events run first. Red's house was entered from 0.4 of a square off-line on either side, and walking diagonally into the fence slid the player along it.

## Shared battle launch

- Both adventures start battles with `src/ui/battle-launch.ts`. It runs the encounter transition, the battle screen with its sounds and music cues, and development auto-play, then reports how the battle ended. Its tests cover telling wins, losses, catches, escapes and draws apart (including a team with no Pokémon standing), sending a seventh Pokémon to storage, and auto-playing a wild battle to a win on the native engine.
- In the browser, a test Astra journey ran from a wild Pidgey back to Mossford Mart, won a battle with Ember (the EXP was saved), and caught a Pidgey with a Poké Ball. The catch added Pidgey to the party, used one ball and opened its new Pokédex entry. B backed out of the move list in both adventures.
- In a test Yellow journey, a wild Pidgey battle was won on screen (Pikachu's EXP was saved), running away returned `run` to the map script, and the debug harness's auto-play won a battle with no battle screen. Both journeys' saves were restored afterwards.

## Crystal Legacy's game data

- Every adventure battles with Crystal Legacy V1.3.1's data (`GameData::crystal_legacy()`, vendored from crystal-battle `ba9cb13`). The data was generated from a build of the V1.3.1 tag. That ROM is byte for byte the official V1.3.1 patch applied to Crystal 1.0 (SHA-1 `74a6727e…`). Crystal's own data still regenerates identically.
- In the engine, the library tests (with Legacy's evolutions, Cut's Bug type, its item layout and 60 random battles on its data) and the workspace tests passed. The differential testers matched the transpiled original in all 449 trainer, link and wild battles, after base PP moved to the game's data.
- In Astra, the TypeScript check, 257 Vitest tests, four Rust tests, the WASM cartridge smoke test and the production build passed. Tests that pinned Crystal's learnsets now pin Legacy's (for example, Growlithe opens with Roar, Ember and Leer at 6).
- All three starters won the League in each of the six middle-gym orders (18 seeded campaigns). Legacy's Wooper knows Mud-Slap at 16, so Marina's gym is harder: the Poliwag run now keeps its Route 02 Bellsprout for her.
- Battles also follow Crystal Legacy's battle code (`Rules::CRYSTAL_LEGACY`): Ghost moves are special and Dark moves physical, Legacy's bug and AI fixes apply, the Zephyr Badge raises obedience to level 16, trainers' Pokémon fight with their own DVs, happiness and stat experience, and level-100 Pokémon take no experience. The engine's tests play each rule both ways; its differential testers still match the transpiled original under Crystal's rules. With the rules, all 18 seeded campaigns won the League, one of them on its second League attempt.
- Not verified: an in-game check in the browser (the development server refuses to serve cartridge files). Legacy's rules have no transpiled original to compare with: each is checked against its own reading of Legacy's asm.
