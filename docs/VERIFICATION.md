# Verification record — November 17, 2026

## Automated checks passed

- `npm run build`: compiles the actual Rust WASM bridge, typechecks TypeScript, builds Vite assets, and generates a content-versioned offline worker. Final bundle excludes ROMs and saves.
- `npm test`: 18 tests across world content/progression, input, save validation, and native bridge integration.
- `npm run test:native`: three Rust tests plus an actual WASM/ROM smoke script. Covers persistent battle outcomes, genuine interactive move replacement, healing, forced switching, multi-member trainer battles, full-party capture into storage, decompression of 502 front/back sprite images, continuous music sample equivalence, and Pokémon cries.
- World checks: 108 connected maps; 12 settlements; 25 routes; 36 dungeon rooms; eight gyms; 95 trainer battles; 16 quests; all 251 species obtainable via wild/static/gift sources; legendary species absent from ordinary grass; main story and badge gates unlock in order; all objects and transitions are physically reachable.
- Input checks: quick taps between frames, no held-confirm repeat, aliased keyboard directions, multitouch release/cancellation, and ignoring an idle gamepad receiver while following the actively used controller.
- Save checks: native array/scalar validation, invalid or duplicate Pokédex entries, round trip with full Pokémon data, and recovery from an obstructed saved position.

## Browser checks passed

Using the actual production JavaScript/WASM and the user's local English Crystal 1.1 ROM:

1. First-launch file selection accepts the correct cartridge and starts the adventure. Reload uses IndexedDB without asking again.
2. Smooth keyboard movement, collisions, entering/leaving the lab, and entering Route 01.
3. Starter choice and persistent Growlithe party state.
4. An actual Scout Ari trainer battle through victory: PP decreases, damage, flinching and opponent turns occur through the native engine.
5. A wild Pikachu encounter, an unsuccessful Poké Ball attempt, a successful catch, and both Pokémon visible in the saved party.
6. Production update loads the new content-hashed bundle while preserving cartridge and save.
7. **Offline startup:** the local HTTP server was stopped, then the page was reloaded. The game loaded from the service worker and continued the saved adventure with ROM graphics available.
8. Portrait and landscape viewport inspection; directional touch targets measured 48×48 CSS pixels. Touch event semantics are also unit-tested.

Browser QA found and fixed lost short keyboard taps, empty ball types appearing in battle, excessive first-encounter variance, Growlithe lacking an early Fire move, custom trainer prizes missing from the campaign economy, and unsafe map spawn positions after furnishing.

## Limits

This is a playable alpha. No full human playthrough from new save to Champion and 251 catches has been completed. Difficulty, economy, dialogue pacing, and all postgame quests require sustained playtesting. A physical 8BitDo FlipPad and native phone home-screen installation were not available for testing. The original battle library still has explicitly unported paths (notably PP Up and contest-only mechanics), which Astra does not offer. Presentation is custom, not Crystal's complete animation interpreter. Some reserve habitats and mechanism puzzles are deliberately simple.

The synthesizer's Gen 2 music wave channel is implemented in the vendored 0.2.3 code; the upstream README checkbox is stale.
