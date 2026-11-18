// Each drawing is the walkable survey inside a one-tile outer wall. Short rows
// end in cliff or canopy. @ is the way back, > the way onward, < the shortcut.
// + and ^ connect side passages. Digits locate actors and objects.
// * and ! mark terrain changed by the story.
export interface DungeonRoom {
  name: string;
  plan: string[];
  marks: string[];
}
function room(name: string, marks: string[], drawing: string): DungeonRoom {
  const rows = drawing.trim().split("\n").map(row => row.trim());
  const width = Math.max(...rows.map(row => row.length));
  const wall = "#".repeat(width + 2);
  return { name, marks, plan: [wall, ...rows.map(row => "#" + row.padEnd(width, "#") + "#"), wall] };
}

export const dungeonPlans: Record<string, DungeonRoom[]> = {
  lantern: [
    room("Ribbon fork", ["lantern_trail_clue", "lantern_guardian_trainer"], `
      ##,,,ff###,,,,,#####,<,,
      #,,,1,,###,fff,,####,,,,
      ,,,##,,,,,,,,,,,#,,,,,,,
      ff,#####,,##,,,,,,,fff,,
      ,,,,,,,,,,###,########,,
      ,@,,0,ffff###,,,,,,,,,>,
    `),
    room("Moth trail", ["lantern_tracks"], `
      #######,,,,,ff,,,>,##
      #######,ff,##########
      ##,,f,,,##,,,,,,,ff,#
      ##,#######,#####,,#,#
      ##,#######,##,,,ff,,#
      ##,,,,f,0#,##,#######
      ####,#####,##,,,,ff,#
      ##,,,ff,,,,########,#
      ##,############,,,,,#
      ##,,,,,,ff,,,,,,ff,,#
      #######,#############
      ##,@,ff,,,,f,,,,,,,##
    `),
    room("The hollow oak", ["lantern_objective"], `
      ####,ffff,####
      ##,,,,0,,,,,##
      ,,,ff,,,,ff,,,
      ,,,,##,,##,,,,
      ,@,,,,,,,f,,<,
    `),
  ],
  undertow: [
    room("Barnacle shelf", ["undertow_trail_clue", "undertow_guardian_trainer"], `
      oooooooo.....<.
      oo....oo..###..
      ..1.......###..
      ..##oooo..ooo..
      @.0.....==...>.
    `),
    room("Breathing pool", ["undertow_sluice"], `
      ##....ooooooo....>..
      ...0..ooooooo.......
      ......ooooooo..###..
      ..##..*******.......
      ..##..ooooooo.......
      @.....ooooooo....###
    `),
    room("Horn mouth", ["undertow_objective", "evolution_supply_7"], `
      ooo.......ooooo
      oo...0..+..oooo
      ooo..==...ooooo
      ooo..==..oooooo
      .........oooooo
      @..1.......<...
    `),
    room("Pilot’s sound", ["lighthouse_lapras", "legendary_249"], `
      ooooooooooo...,..oooooo
      oooooooo...1...##.ooooo
      ooooooo..#####.....oooo
      ooo~~~~~~~~~~o....ooooo
      oo~~~0~~~~~~~~~~ooooooo
      ooo~~~~~~~~~oo~~ooooooo
      ooooo~~.....ooooooo
      ####....+...#######
    `),
  ],
  copperworks: [
    room("Meter alley", ["copperworks_trail_clue", "copperworks_guardian_trainer"], `
      ....CC.....CC....<...
      .1..CC..+..CC....CC..
      .....................
      .CC..CC.....CC..CC...
      @..0...............>.
    `),
    room("Feeder gallery", ["copper_breaker", "pickup_part_c"], `
      ^.CC..0..CC..
      ..CC.....CC..
      ...tttttt....
      ..tt..C.ttt..
      ..t...C...t>.
      ..t.1.C...t..
      @.ttttt...t..
    `),
    room("Black-start turbine", ["copperworks_objective", "legendary_145"], `
      ...CCCCCCC....
      ..1.......0...
      ...CC...CC....
      .....tt.......
      @.......<.....
    `),
    room("Meter loft", ["copper_load"], `
      ...CC..0..CC...
      ..CCCC...CCCC..
      ..ttttttttttt..
      ..t..#####..t..
      .+t..#####..t^.
    `),
  ],
  hourglass: [
    room("Gnomon court", ["hourglass_trail_clue", "hourglass_guardian_trainer"], `
      ####..f....<..####
      ##..##...##....###
      .0..##...##.....>.
      .@.............1..
      ##..##...##.....##
      ####..f....f..####
    `),
    room("The noon shadow", ["hourglass_mirror"], `
      ##..ffff..####
      ..@.......####
      ....::0...####
      ....##....####
      ##..##....####
      ########****.>
      ##########....
    `),
    room("Buried aperture", ["hourglass_objective", "evolution_supply_4", "oasis_kiln"], `
      ######....######
      ####...0....####
      ##...ff..ff.2.##
      ...1..........<.
      ##....@......###
    `),
  ],
  bamboo: [
    room("Bittern hide", ["bamboo_trail_clue", "bamboo_guardian_trainer", "bamboo_nest"], `
      oooo,,,,,oooooo,2,,oo
      oo,1,,,,,oooooo,ff,oo
      oo,,=====,,=====,,,oo
      oooo,,ooo,,ooooo,oooo
      @,,0,,,oo,,ooooo,,,,>
      ,,,,ooo,,,,,,<,,,,,oo
    `),
    room("Mudflat blind", ["bamboo_bank"], `
      oooooooo,,,0,,oo
      ,@,,oooo,,ff,,oo
      ,,,,====,,,ooooo
      oooooooo,ooooooo
      ooo,,,,,,,,,,ooo
      ooo,ff,,oooo,>,o
    `),
    room("Ranger island", ["bamboo_objective", "quest_bamboo_friend", "bamboo_thicket", "bamboo_bird", "bamboo_perch"], `
      ooo,,,,,,,ooooo,,,,,
      oo,,0,,f,,ooooo,,,,,
      oo,,,,,,,,,****,,3,,
      oooo,,f,,2ooooo,,,,,
      oooo,,,,,,,,oooo,,,,
      ooo,@,,,1,4,,<,ooooo
    `),
  ],
  ember: [
    room("Shift change", ["ember_trail_clue", "ember_guardian_trainer"], `
      ....CC....##....<...
      ..0.CC..1.##........
      @.tttttttttttttttt>.
      ..tt..##..##..CC....
    `),
    room("Freight siding", ["ember_dispatcher", "pickup_mine_ore"], `
      ...###...##....>.
      ..1###...##..tt..
      ...tttttttttttt..
      ...tt..CC..0..t..
      ..tt...CC.....t..
      @ttt.............
    `),
    room("Kiln wagons", ["ember_objective", "legendary_146", "evolution_supply_6", "ember_cyndaquil", "ember_slugma"], `
      ..CCC...CCC...CCC....
      ..C3....C4....C1.....
      .....................
      @.tttttttttttttttt.<.
      ....2..##...0..CC....
    `),
  ],
  frostvault: [
    room("Snow shed", ["frostvault_trail_clue", "frostvault_guardian_trainer"], `
      ####....#....>.
      ###..1..#...###
      ##....#....####
      .....###..#####
      .@.0.......<...
    `),
    room("Cornice traverse", ["frost_plug", "pickup_snow_herb"], `
      ######..........>.
      ###....###########
      ##..0:::.....#####
      #######.....######
      ###..........1..##
      ###..#########..##
      .......###########
      .@................
    `),
    room("Steam cut", ["frostvault_objective", "legendary_144"], `
      ###...1...###
      ##..##...####
      ##.....0..###
      ####....#####
      ##........###
      .@.....<.....
    `),
  ],
  echo: [
    room("Choir stalls", ["echo_trail_clue", "echo_guardian_trainer"], `
      .......>......
      ..BB......BB..
      ..BB..0...BB..
      ..BB......BB..
      ...1..........
      ..@........<..
    `),
    room("Peal loft", ["echo_carillon"], `
      ####......####
      ##...BB.....##
      .....0......>.
      ...BB..BB.....
      ##...@......##
    `),
    room("Wax archive", ["echo_objective", "legendary_250", "echo_rubbing"], `
      ...BBBB....1..
      ..0....BB.....
      .....2.....BB.
      .BB...BB...BB.
      ....+.........
      @..........<..
    `),
    room("Silent choir", ["quest_echoes"], `
      ######...######
      ####..B.B..####
      ##..B.....B..##
      ...B...0...B...
      ##..B.....B..##
      ####...+...####
    `),
  ],
  meridian: [
    room("Public lobby", ["meridian_trail_clue", "meridian_clerk"], `
      ..BB..BB.....CC.....
      .............CC.1...
      ..CC....0...........
      ..CC.........###....
      ..+....<.....###..>.
      .@..................
    `),
    room("Night-shift records", ["meridian_deposition"], `
      ...BB.....BB.....BB..
      ...BB..0..BB.....BB..
      ...................>.
      ..BBBBB...BBBBB...^..
      .@...............###.
    `),
    room("Director’s floor", ["meridian_objective", "legendary_150", "evolution_supply_9"], `
      ..BB...0...BB...
      ..............1.
      ..CC......CC....
      ..2.............
      @.............<.
    `),
    room("Loading dock", ["meridian_guardian_trainer"], `
      ######.....^.##
      .CCC....#.CC...
      .CCC.0..#.CC...
      ....tttttttt...
      .CC.t..###.t...
      .CC.t..###.t...
      .+..tttttttt...
    `),
  ],
  starfall: [
    room("Photographic plates", ["starfall_trail_clue", "starfall_guardian_trainer"], `
      ####......<...####
      ##....CC......1.##
      ...,.......CC.....
      .@.0..CC........>.
      ##............####
    `),
    room("Equatorial mount", ["starfall_scope"], `
      ####.....####
      ##....0....##
      ...CC...CC...
      .>.........@.
      ##...CC....##
      ####.....####
    `),
    room("Split horizon", ["starfall_objective", "celestial_engine"], `
      ####....1....####
      ##....CCCC.....##
      ##.............##
      ...0.............
      .......CC.....<..
      ####.@.......####
    `),
  ],
  victory: [
    room("Rope school", ["victory_trail_clue", "victory_guardian_trainer"], `
      ##....<...######
      ...##...1.....##
      ..0######.##..##
      ...######.##...>
      @.........####..
    `),
    room("Twin pitches", ["victory_crag", "victory_falls"], `
      ####....>....####
      ###...#####...###
      ####*#######!####
      #...0.#####.1...#
      ...##..ooo..##...
      ..###..ooo..###..
      ......=====......
      ####...@....#####
    `),
    room("Cairn of names", ["victory_objective"], `
      ######...0...##
      ###.....##....#
      ...#######....#
      .@.........<..#
    `),
  ],
  aurora: [
    room("Dawn meadow", ["aurora_trail_clue", "aurora_guardian_trainer", "aurora_pollen", "aurora_camp"], `
      ###,ggggg,ff,,#####,,
      #,,,ggggg,,2,,,,,,>,,
      ,,1,,ff,,,####,,ff,,,
      ,,,,,,,,,,,,##,,,####
      ,@,0,,,3,,,,,,<,,,,
    `),
    room("Moon pool", ["aurora_spawn", "aurora_hide"], `
      ,gggg,,,oooooo,,,,
      ,gggg,,0,oooooo,>,
      ,,,,,,,,,ooo,==,,,
      ###,,,oooooo,=,###
      ,,1,,,=======,,###
      ,@,,,,ooooooo,,###
    `),
    room("Ember nursery", ["aurora_objective", "legendary_251", "quest_atlas"], `
      ####ggggg,,,ff,,,###
      ##,,ggggg,,,1,,,,,##
      ,,ff,,,,,,,,,,,ff,,,
      ,,,,,##,,,0,,,##,,,,
      ,,@,,,,,,2,,,,,,,<,,
    `),
  ],
};
