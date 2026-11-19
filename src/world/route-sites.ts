import type { Point } from "./atlas";

// Each plan sits at the surveyed bend of a side trail. Blank cells retain the
// surrounding landscape. @ is the landmark, * the supply cache, p the resident.
// Digits place existing field interactions in the terrain they refer to.
const sites: Record<string, string[]> = {
  // Minnow Bend. A split boardwalk reaches into the pond; Caterpie feeds on its bank.
  "01": [
    "   ffg,,,    ",
    "  ,pggf,~~~  ",
    "  ,ggg,,~~~~ ",
    ",::::::=~~~, ",
    "::::@:*===~~ ",
    " f,,:,,=~~~, ",
    "  f,f,,~~~~, ",
    "   fgg,~~~,  ",
  ],
  // Cider Mill Ford. Wool and pollen sit on opposite sides of the irrigation race.
  "02": [
    "  #f#f#f#,   ",
    "  ,2,f,pg,,  ",
    " ,,,,,,gggg, ",
    " ~~~==~~~~~~ ",
    "::::==:@::1::",
    " ,g,=,,::,,  ",
    " gg,*,,:::,  ",
    "  ,,::::,    ",
  ],
  // Lamplighter's Rest. A camp in a horseshoe of trees with a clear sightline across it.
  "03": [
    "   ##gg,:::  ",
    "  ##gg,::,p  ",
    "  #ggg,:@:,  ",
    " ,gg,,,:,##  ",
    " ,,:::::,##  ",
    " ,,*,,:,,##  ",
    "  :,,:,f##   ",
    "  :::,ff#    ",
  ],
  // Ochre Bluff. A switchback follows the head of an eroded tidal inlet.
  "04": [
    "    ,::::::  ",
    "  ,,,p:##,   ",
    " ,,::::##*:  ",
    " ,::###,::,  ",
    ":::@,::::~,  ",
    ",,,,:,,~~~~  ",
    " fgggg~~~~   ",
    "  ggg,~~~    ",
  ],
  // Gullwatch Steps. Landings between tide pools lead down to a shell beach.
  "05": [
    "  ,::,##     ",
    " ~~:=:,##    ",
    " ~~===:,,,   ",
    " ~~~,::@,g,  ",
    " ,~,::,,ggg  ",
    " ,*::~~,gg,  ",
    " ,:,,~~,p,   ",
    "  ,:::::,    ",
  ],
  // Three Locks. Cross the three pounds along the lock gates to find the brass float.
  "06": [
    "   ,,,1,,    ",
    "~~===~~=~~=~ ",
    "~~=~~p~=~~=~ ",
    " ,=~~===~~=~ ",
    "::=::@::::=::",
    " ,,~,~=~,~=: ",
    "  ,~,~=~,~*, ",
    "   ,,ggggg,  ",
  ],
  // Signal Box. A disused siding splits from the yard to the parts bay.
  "07": [
    "    #gggg#   ",
    "  ##,gpg,#   ",
    "  ,*,1,,,,   ",
    "  ,ttttt,,,  ",
    " ,t,:::@:::::",
    ",t,::::,,#,, ",
    "t::::ggggg,  ",
    ":::,ggg##    ",
  ],
  // Singing Saddle. Wind has cut a pass through the rock around a sheltered oasis.
  "08": [
    "  ,::,###    ",
    "  ,:::,,##   ",
    " ,##,:@,,##  ",
    " #~~,,::,,#  ",
    " ,~~~,::p,,  ",
    " ,~~~,::gg*  ",
    "  ,,,::,gg,  ",
    " ,::::,,g,   ",
  ],
  // Fulgurite Field. Follow the trenches branching off the glassworkers' haul road.
  "09": [
    "    ,,::,,   ",
    "  ###,:,,g,  ",
    " #,p:::@,gg  ",
    " ,,:#,:#,,g  ",
    "  ,:#,:###,  ",
    " ,,:,,::::*  ",
    "  g::,:,,##  ",
    "   ,:::,     ",
  ],
  // Kingfisher Hide. A boardwalk winds to Quagsire's feeding pool.
  "10": [
    "  ~~~,::~~   ",
    " ~~===::~~~, ",
    " ~~=~~:=,,~, ",
    " ~~=~~==@~~~ ",
    " ,p=~~:=~~*~ ",
    " g,=~~:=~~=~ ",
    " gg====:===, ",
    "  gg,,::,    ",
  ],
  // Ranger's Blind. Bamboo screens form two quiet lanes around the nesting ground.
  "11": [
    "    ,::::::, ",
    "   ,p:,##gg, ",
    "  ##,:##ggg  ",
    "  ,:::,@,gg  ",
    " ,,:##,::#,  ",
    " ,*:##,::#,  ",
    " ,::::::,#,  ",
    "   ,,,::,    ",
  ],
  // Charcoal Kilns. The old hearth ring is overgrown; a second kiln is still hot.
  "12": [
    " ::,,  ,##   ",
    " ,:::,#ggg#  ",
    " ,##::ggpg#  ",
    " ,#*::,gg,,  ",
    " ,#,:,,:@:,  ",
    " ,,::::,:::, ",
    "  ##,gg,:::: ",
    "    ,ggg,,:::",
  ],
  // Furnace Lip. Black shelves split around a warm basin and meet at the miners' cache.
  "13": [
    "    ,,:::,   ",
    "   ##,::,,   ",
    "    ,:@,:##  ",
    "   ,::#,:p#  ",
    "   ,:*#,::,  ",
    "  ,,::##,:,  ",
    "  g::::::,,  ",
    "  ggg::,,    ",
  ],
  // Goatherd's Cairn. A long ridge landing, with Swinub in the lee of its crest.
  "14": [
    "    ##,,##   ",
    "  ##ggp,,#   ",
    " ,*::gg,##   ",
    ",,:#::::@,,  ",
    "::::::#:,,#  ",
    " ,gg,##:::#  ",
    "  ggg##,:,,  ",
    "   ##,,:::   ",
  ],
  // Blue Ice Shelf. Fresh water has opened a channel under the ledge.
  "15": [
    "   ##,::,    ",
    "   #gg:::#   ",
    "   ggp,#:##  ",
    "  ~~~,,@:##  ",
    "  ~~~~:::*,  ",
    "  ~~==:~,:,  ",
    "  ,,,,:~~:,  ",
    "   ,,::::,   ",
  ],
  // Shepherd's Chime. Two flower borders flank a little bell court.
  "16": [
    "     ,,,,,:: ",
    "   ,fff::::  ",
    "  ,fgp::ff,  ",
    " ,fg,:@,ffg  ",
    " ,f::::,,fg  ",
    " ,::fff:,fg  ",
    ":::,,ff::*g  ",
    " ,,,,ffff,   ",
  ],
  // Ribbon Gate. Follow the pilgrim walk or slip through the gap to Murkrow's nest.
  "17": [
    "     ,,::,,  ",
    "    f#:,:#,  ",
    "   fp#:::##  ",
    "   f,:@,:g,  ",
    "   ,::#,:gg  ",
    "  ,,:##,::,  ",
    "  ,:::,,*:,  ",
    " ,::,ggg,,   ",
  ],
  // Mirror Terrace. A rim walk surrounds a dark reflecting pool; the pier is a dead end.
  "18": [
    "    ,,:::,   ",
    "  ,f::::::,  ",
    " ,p,:~~~~:,  ",
    " ,f,:~@=~:,  ",
    " ,g,:~~=~:,  ",
    " ,g,:~~=~:,  ",
    " ,g,*:::::,  ",
    "   ,,,::,,   ",
  ],
  // Transit Stones. Broken sightlines converge on the observation platform.
  "19": [
    "    ##ggg,,  ",
    "   ,ggg,p~,, ",
    "  ,,::::,::*,",
    "  ,:##:::::::",
    "  ,:,,@:#,,  ",
    "  ,:::::##,  ",
    " ,:::ggg,,   ",
    ":::,,gg,     ",
  ],
  // The Last Mile. A cairn-lined stair rises above the returning challengers' path.
  "20": [
    "  ####,ggg,  ",
    "  #:::,gp,,  ",
    " ,,##:::::,, ",
    ":::,#,:##::::",
    " ,:::,@:,,   ",
    " ,g##,::*#   ",
    " ,ggg,::##   ",
    "  ,ggg,,#    ",
  ],
  // The Hollow Oak. Two entrances thread a grove opening with an old tree at its center.
  "21": [
    "::,##ggg##   ",
    ",::ggpggg#,  ",
    " #:::,g,,,## ",
    " #,:,##,:,,# ",
    " #,:,,@,:::::",
    " #,::::::,#, ",
    "  #,*,ff,,#  ",
    "   ###fff#   ",
  ],
  // Cormorant Bank. Pilot posts frame a tidal channel across the middle of the sandbar.
  "22": [
    "    ,,::,,   ",
    "  ,gg,::~~,  ",
    " ,,pg,:@~~~, ",
    " ,~~,,:=~~~, ",
    " ,~~~~==~*~, ",
    " ,~~===,,=~, ",
    "  ,,:::::=,  ",
    "   ,::,,,,   ",
  ],
  // Ammonite Cut. The narrow-gauge siding stops where the fossil bed begins.
  "23": [
    " ,::,###     ",
    " ,::::,###   ",
    " ,#1,::::#   ",
    " ,#,:#,@::,  ",
    " ,p,:,ttt:,  ",
    " ,gg,tt,2:,  ",
    "  gg,t,:,*,  ",
    "   ,,t::,,   ",
  ],
  // Moon Pool. Walk the narrow causeway into a permanently flooded ring.
  "24": [
    "   ,~~,,,    ",
    "  ,~~~~~~,,  ",
    " ,~~:*:~~::, ",
    " ~~~:~:=::@, ",
    " ~p,:~~=~~~~ ",
    " ::::===~~~, ",
    ":::,gg,~~~,  ",
    "  ,gggg,,,   ",
  ],
  // First Light. Flower spokes open out of the woods to a meadow of migrating starters.
  "25": [
    "   #gg::f#   ",
    "  #gpg::ff#  ",
    "  ,gg,:f,,#  ",
    "  ,ff:@::ff  ",
    "  ,,::f#::f  ",
    "  ,*:fff,:,  ",
    "  ff::::::,  ",
    "   ggg::f,   ",
  ],
};

const siteObjects: Record<string, string[]> = {
  "02": ["parcel_bench", "orchard_brush"],
  "06": ["pickup_part_a"],
  "07": ["pickup_part_b"],
  "23": ["pickup_fossil", "quest_fossil"],
};

export function layRouteSite(route: string, grid: string[][], [cx, cy]: Point) {
  const rows = sites[route];
  const left = Math.max(1, Math.min(grid[0].length - rows[0].length - 1, cx - Math.floor(rows[0].length / 2)));
  const top = Math.max(1, Math.min(grid.length - rows.length - 1, cy - Math.floor(rows.length / 2)));
  const anchors: Record<string, Point> = {};
  const map = "route" + route;
  const objects: Record<string, string> = { "@": "sign_" + map, "*": "item_" + map, p: "resident_" + map };
  siteObjects[route]?.forEach((id, i) => { objects[i + 1] = id; });
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      const tile = row[dx];
      if (tile === " ") continue;
      const x = left + dx, y = top + dy;
      const object = objects[tile];
      if (object) anchors[object] = [x, y];
      // A cache or wildlife at the end of a pier shares its deck.
      const onDeck = object && [row[dx - 1], row[dx + 1], rows[dy - 1]?.[dx], rows[dy + 1]?.[dx]].includes("=");
      grid[y][x] = object ? (onDeck ? "=" : ",") : tile;
    }
  });
  return anchors;
}
