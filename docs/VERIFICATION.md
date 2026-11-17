# Verification record — November 17, 2026

## Automated checks passed

- `npm run build`: compiles the actual Rust WASM bridge, typechecks TypeScript, builds Vite assets, and generates a content-versioned offline worker. Final bundle excludes ROMs and saves.
- `npm test`: 49 tests across nine files: world content/progression, actors, navigation, input, audio scheduling, battle presentation, offline caching, save validation, and native bridge integration.
- `npm run test:native`: three Rust tests plus an actual WASM/ROM smoke script. Covers persistent battle outcomes, genuine interactive move replacement, healing, forced switching, multi-member trainer battles, full-party capture into storage, decompression of 502 front/back sprite images, continuous music sample equivalence, and Pokémon cries.
- World checks: 108 connected maps; 12 settlements; 25 routes; 36 dungeon rooms; eight gyms; 95 trainer battles; 16 quests; all 251 species obtainable via wild/static/gift sources; legendary species absent from ordinary grass; main story and badge gates unlock in order; all objects and transitions are physically reachable.
- Input checks: quick taps between frames, no held-confirm repeat, aliased keyboard directions, multitouch release/cancellation, and ignoring an idle gamepad receiver while following the actively used controller.
- Save checks: native array/scalar validation, invalid or duplicate Pokédex entries, round trip with full Pokémon data, and recovery from an obstructed saved position.
- Actor/navigation checks: solid roaming NPCs, forward trainer sight with occlusion, notice/approach sequencing and cancellation, directional interaction range, reciprocal three-tile road mouths, fractional-position continuity across map boundaries, and collision while straddling an edge.
- Battle/graphics checks: native damage/status/capture events, all 251 move classifications, trainer names and prizes, replacement Pokémon HP, level-up move choices, directional walk frames, and exterior-only sprite transparency.
- Audio/offline checks: gesture-unlocked scheduling, scene changes and mute handling; generated service worker installation and offline shell/JS/CSS/WASM retrieval with cartridge/save exclusion. Eight music tracks and seven emitted native sound-effect IDs produced nonzero PCM during local ROM verification.

## Browser checks passed

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

## Limits

This remains a playable alpha with a substantial presentation pass. No full human playthrough from new save to Champion and 251 catches has been completed. Difficulty, economy, dialogue pacing, and all postgame quests require sustained playtesting. A physical 8BitDo FlipPad and native phone home-screen installation were not available for testing. The original battle library still has explicitly unported paths (notably PP Up and contest-only mechanics), which Astra does not offer. Move effects use custom animation families covering all 251 move IDs and native battle events; Crystal's complete per-move animation-script interpreter and its script-only sound cues are not implemented. Some reserve habitats and mechanism puzzles remain simple. The opening towns received the most detailed visual playtesting.

The synthesizer's Gen 2 music wave channel is implemented in the vendored 0.2.3 code; the upstream README checkbox is stale.
