import type { Quest, Requirement, Reward, WorldMap, WorldObject } from "./index";

type Prop = Omit<WorldObject, "x" | "y">;
type Stop = [map: string, object: Prop];
type Request = {
  name: string;
  where: string;
  who: string;
  brief: string;
  ending: string;
  prize: string;
  reward?: Reward;
  requires: Requirement;
  stops?: Stop[];
  field?: WorldObject["field"];
  claimId?: string;
};
function find(
  id: string,
  name: string,
  dialogue: string,
  setsFlag: string,
  illustration: string,
  requires?: Requirement,
): Prop {
  return { id, name, kind: "switch", dialogue, setsFlag, field: { illustration }, requires };
}
const chartSites: [string, string, string][] = [
  ["lantern", "Lantern Wood", "surveyor"],
  ["undertow", "Undertow Cave", "fog_signal"],
  ["copperworks", "Copperworks", "power_restored"],
  ["hourglass", "Hourglass Ruins", "lens_restored"],
  ["ember", "Ember Mine", "pokemon_freed"],
  ["frostvault", "Frostvault Cavern", "pass_open"],
  ["echo", "Echo Bell Tower", "revelation"],
  ["starfall", "Starfall Observatory", "last_lens"],
];
export function chartVisit(map: string) {
  return chartSites.find(([id]) => map === id + "_3")?.[0];
}
export function recordedSites(flags: readonly string[]) {
  return chartSites.filter(([id, , restored]) => flags.includes("chart_" + id) || flags.includes(restored));
}

const requests: Record<string, Request> = {
  parcel: {
    name: "Lost Parcel",
    where: "bramble",
    who: "Bramble courier",
    claimId: "parcel_recipient",
    brief:
      "Orchard Lane’s post is missing a parcel of silkworm eggs. Ask the Mossford courier for the box, then carry it east to Bramble.",
    ending:
      "The box gives a tiny rustle. “Just in time! They’ve started hatching.” The courier tucks the eggs into a fold of warm silk and hands you the delivery fee.",
    prize: "5 Great Balls",
    requires: { flags: ["found_parcel", "parcel_wrapped"], items: ["courier_parcel"] },
    reward: { takeItem: "courier_parcel", item: "great_ball", amount: 5 },
    stops: [
      [
        "mossford",
        {
          id: "quest_parcel",
          name: "Mossford courier",
          kind: "person",
          dialogue:
            "Silkworm eggs for Bramble. Their straw sleeve tore! The packing bench on Orchard Lane has clean apple wool. Wrap them before the bumpy last mile.",
          setsFlag: "found_parcel",
          reward: { item: "courier_parcel" },
        },
      ],
      [
        "route02",
        {
          ...find(
            "parcel_bench",
            "Orchard packing bench",
            "You tuck the eggs into curls of apple wool. The lid closes snugly for the last mile to Bramble.",
            "parcel_wrapped",
            "nest",
            { flags: ["found_parcel"] },
          ),
          lockedDialogue:
            "The bench is stocked with apple wool for fragile parcels. The Mossford courier works the west end of this lane.",
        },
      ],
    ],
  },
  hearth: {
    name: "A Warm Hearth",
    where: "dewdrop",
    who: "Garden elder",
    brief:
      "Take a Growlithe or Vulpix to the cold stove in the village home. The elder has a loaf ready for its first firing.",
    ending:
      "The loaf comes out crackling. The elder slips a warm Fire Stone into your mitten and puts the first heel of bread aside for your helper.",
    prize: "Fire Stone",
    reward: { item: "fire_stone" },
    requires: { flags: ["hearth_baked"] },
    stops: [
      [
        "home",
        {
          ...find(
            "hearth_oven",
            "Bread oven",
            "Your fire partner breathes across the kindling. The first loaf begins to rise. You leave the iron door ajar to warm the cottage.",
            "hearth_baked",
            "oven",
            { species: [58, 37] },
          ),
          lockedDialogue: "The dough is ready. Bring Growlithe or Vulpix in your party to light the stove.",
          victoryDialogue: "A loaf cools on the sill. The stove still glows.",
        },
      ],
    ],
  },
  pollinators: {
    name: "Orchard Pollinators",
    where: "mossford",
    who: "Orchard keeper",
    brief:
      "Register three Bug species and dust the windward blossoms on Orchard Lane. Look for the blue pollen brush.",
    ending:
      "The keeper holds up a tiny apple where your brushed blossom used to be. “The wind rows finally took!” A green stone rolls out of the pruning apron.",
    prize: "Leaf Stone",
    reward: { item: "leaf_stone" },
    requires: { flags: ["orchard_brushed"], types: [{ type: "bug", count: 3 }] },
    stops: [
      [
        "route02",
        find(
          "orchard_brush",
          "Windward blossom",
          "You brush loose pollen from one open blossom onto its neighbor. A little green ovary shows under the petals.",
          "orchard_brushed",
          "blossom",
        ),
      ],
    ],
  },
  angler: {
    name: "Tideglass Angler",
    where: "tideglass",
    who: "Quay angler",
    brief:
      "Register three Water species, then try the angler’s practice float. Feel the line until the float goes under.",
    ending:
      "A silver flash breaks the surface. The angler lets it swim free and shows you how to rig your own line. Face shallow water and press A to fish.",
    prize: "Water Stone and fishing access",
    reward: { item: "water_stone" },
    requires: { types: [{ type: "water", count: 3 }] },
    field: { device: "float" },
  },
  lighthouse: {
    name: "Lighthouse Lens",
    where: "tideglass",
    who: "Lighthouse keeper",
    brief:
      "Take the sea tunnel from Undertow’s horn mouth to the pilot’s sound. Surf beside the waiting Lapras. Bring it home by catching it.",
    ending:
      "The keeper turns the lamp seaward. Lapras answers with the same three rising notes. The keeper writes its name on the harbor pilot roll.",
    prize: "Lapras encounter",
    requires: { flags: ["lighthouse_lapras_safe"] },
    stops: [
      [
        "undertow_4",
        {
          id: "lighthouse_lapras",
          field: { afloat: true },
          name: "Pilot Lapras",
          kind: "wild",
          dialogue:
            "You paddle out on the horn’s last note. Lapras surfaces alongside you, ready to meet your team.",
          requires: { ability: "surf", flags: ["fog_signal"] },
          lockedDialogue: "The pilot swims beyond the horn. Restore its signal and come back with Surf.",
          setsFlag: "lighthouse_lapras_safe",
          trainer: { id: "pilot_lapras", name: "Pilot Lapras", team: [{ species: 131, level: 25 }] },
        },
      ],
    ],
  },
  collector: {
    name: "Copper Collector",
    where: "copperwick",
    who: "Canal tinkerer",
    brief:
      "Rebuild the tide clock with a floating cork from Canal Road, a magnetic pawl from Switchyard and a spring from the feeder gallery.",
    ending:
      "The cork lifts, the pawl clicks and the spring carries the little blue tide hand round the dial. The tinkerer gives you the Thunder Stone that used to power it.",
    prize: "Thunder Stone",
    reward: { item: "thunder_stone" },
    requires: { flags: ["found_part_a", "found_part_b", "found_part_c"] },
    stops: [
      [
        "route06",
        find(
          "pickup_part_a",
          "Canal float",
          "A length of net keeps the brass-capped cork from drifting away. You ease it free.",
          "found_part_a",
          "wheel",
        ),
      ],
      [
        "route07",
        find(
          "pickup_part_b",
          "Magnetic pawl",
          "The missing ratchet tooth sticks to a rail spike. A twist breaks the magnetic hold.",
          "found_part_b",
          "meter",
        ),
      ],
      [
        "copperworks_2",
        find(
          "pickup_part_c",
          "Spiral spring",
          "A blued steel spring lies coiled in the feeder’s parts tray. Its square end fits the tide clock.",
          "found_part_c",
          "disk",
        ),
      ],
    ],
  },
  fossil: {
    name: "Fossil Memory",
    where: "route23",
    who: "Quarry preparator",
    brief:
      "Expose the shell seam in the Old Quarry cutting. Follow its ribbed impressions with the soft brush, then choose which fossil to revive.",
    ending:
      "The preparator lifts the fossil from its plaster jacket. Inside the incubator a tiny shell rocks, then turns toward your hand.",
    prize: "Omanyte or Kabuto",
    reward: { species: 138, level: 20 },
    requires: { flags: ["found_fossil"] },
    stops: [
      [
        "route23",
        {
          ...find(
            "pickup_fossil",
            "Fossil cutting",
            "The three impressions lift together in a jacket of chalk. You carry the slab to the preparator.",
            "found_fossil",
            "shell",
          ),
          field: { illustration: "shell", device: "fossil" },
        },
      ],
    ],
  },
  oasis: {
    name: "Oasis Offering",
    where: "sunspire",
    who: "Glassworker",
    brief:
      "Fill the glassworker’s cracked offering bowl at the Sunspire spring. Let the restored lens fuse its rim in the buried aperture.",
    ending:
      "The repaired bowl throws two reflections across the water. The glassworker fishes out a Sun Stone and a Moon Stone from the old offering shelf.",
    prize: "Moon Stone and Sun Stone",
    reward: { items: [{ item: "moon_stone" }, { item: "sun_stone" }] },
    requires: { flags: ["oasis_glazed"] },
    stops: [
      [
        "sunspire",
        find(
          "oasis_spring",
          "Cracked offering bowl",
          "Cold mineral water fills the cloudy bowl. The crack glitters where salt has begun to collect.",
          "oasis_filled",
          "bowl",
        ),
      ],
      [
        "hourglass_3",
        {
          ...find(
            "oasis_kiln",
            "Lens focus",
            "You set the brimming bowl in the beam. Water flashes into mist, leaving a smooth glaze across the crack.",
            "oasis_glazed",
            "disk",
            { flags: ["oasis_filled", "lens_restored"] },
          ),
          lockedDialogue:
            "Fill the bowl at the Sunspire spring, then place it here once the ancient lens is uncovered.",
        },
      ],
    ],
  },
  census: {
    name: "Ranger’s Census",
    where: "reedhaven",
    who: "Reserve registrar",
    brief:
      "Record 30 catches and watch the resident Quagsire on Reedwalk. The reserve needs a behavior note beside its species counts.",
    ending:
      "The registrar pins your Quagsire feeding note next to thirty species records. “A name tells me who lives here. This tells me where to keep the water.”",
    prize: "Exp Share",
    reward: { item: "exp_share" },
    requires: { caught: 30, flags: ["census_feeding"] },
  },
  bamboo_friend: {
    name: "Bamboo Friend",
    where: "bamboo_3",
    who: "Reed cutter",
    brief:
      "Cut the tangled reeds on Ranger Island. Approach Farfetch’d from the south to leave its northern escape clear.",
    ending:
      "Farfetch’d is already on the ranger’s pack, whittling a new leek. The reed cutter gives you the scent lure the bird carried home.",
    prize: "Rare lure",
    reward: { item: "rare_lure" },
    requires: { flags: ["farfetchd_home"] },
    stops: [
      [
        "bamboo_3",
        {
          ...find(
            "bamboo_thicket",
            "Tangled leek bed",
            "Cut opens a lane through the dry stems. Farfetch’d can run north if you give it room.",
            "farfetchd_lane",
            "reeds",
            { ability: "cut" },
          ),
          lockedDialogue: "Fern’s Cut will clear the tangled reeds.",
        },
      ],
      [
        "bamboo_3",
        {
          id: "bamboo_perch",
          kind: "sign",
          name: "Farfetch’d at home",
          wildlife: 83,
          dialogue:
            "Farfetch’d balances on the pack frame, sharpening its leek. The ranger holds the pack very still.",
          field: { appearsAfter: "farfetchd_home" },
        },
      ],
      [
        "bamboo_3",
        {
          id: "bamboo_bird",
          kind: "sign",
          name: "Wary Farfetch’d",
          wildlife: 83,
          dialogue:
            "With the way ahead clear, Farfetch’d scoops up its leek and scuttles home to the reed cutter.",
          requires: { flags: ["farfetchd_lane"] },
          lockedDialogue: "Its leek is caught in the tangled bed. Free it with Cut first.",
          setsFlag: "farfetchd_home",
          field: {
            approach: "south",
            approachHint:
              "The bird backs away. Stand directly south and face north so you leave its escape open.",
            disappear: true,
          },
        },
      ],
    ],
  },
  furnace: {
    name: "Furnace Delivery",
    where: "cinderfall",
    who: "Kiln smith",
    brief:
      "Salvage blue ore from the freight siding, free the mine captives, then temper a coupling with the kiln smith.",
    ending:
      "The coupling rings cleanly on the anvil. The smith keeps it for the refuge tram and gives you a Metal Coat and a spare Link Cable.",
    prize: "Metal Coat and Link Cable",
    reward: { items: [{ item: "metal_coat" }, { item: "link_cable" }] },
    requires: { flags: ["found_mine_ore", "pokemon_freed"] },
    field: { device: "forge" },
    stops: [
      [
        "ember_2",
        find(
          "pickup_mine_ore",
          "Blue tram ore",
          "The chipped rail junction exposes a blue vein. One loose piece is exactly the size of the smith’s coupling mould.",
          "found_mine_ore",
          "ore",
        ),
      ],
    ],
  },
  medicine: {
    name: "Mountain Medicine",
    where: "mossford",
    who: "Orchard herbalist",
    brief:
      "Gather silverleaf in Frostvault’s sheltered traverse. Steep it in the Rimepeak spa before the long trip back to Mossford.",
    ending:
      "The herbalist unrolls a sleeping child’s fist and spoons in the warm infusion. A little later the child asks for breakfast. The herbalist presses a friendship charm into your palm.",
    prize: "Friendship charm",
    reward: { item: "friendship_charm" },
    requires: { flags: ["herb_steeped"] },
    stops: [
      [
        "frostvault_2",
        find(
          "pickup_snow_herb",
          "Silverleaf",
          "Beneath the snow crust the leaves are still green. You take the outer leaves and cover the roots again.",
          "found_snow_herb",
          "blossom",
        ),
      ],
      [
        "rimepeak",
        {
          ...find(
            "medicine_spring",
            "Spa infusion pot",
            "The spring keeps the pot just below boiling. The silverleaf turns the water amber. You stopper the flask for Mossford.",
            "herb_steeped",
            "bowl",
            { flags: ["found_snow_herb"] },
          ),
          lockedDialogue:
            "The pot is warm. Bring silverleaf from the Frostvault traverse to make the infusion.",
        },
      ],
    ],
  },
  echoes: {
    name: "Echoes of the Past",
    where: "echo_4",
    who: "Wax historian",
    brief:
      "After the carillon plays, shine Flash across the unmarked wax in the archive. Its grooves point to the silent choir behind the shelves.",
    ending:
      "The historian reads your rubbing sideways. The last letter wriggles off the page. Unown has been answering the choir for years.",
    prize: "Unown",
    reward: { species: 201, level: 25 },
    requires: { flags: ["echo_impression"] },
    stops: [
      [
        "echo_3",
        {
          ...find(
            "echo_rubbing",
            "Unmarked wax",
            "Flash catches a groove too shallow for the needle. You take a rubbing. The last letter has an eye.",
            "echo_impression",
            "file",
            { ability: "flash", flags: ["bell_rung"] },
          ),
          lockedDialogue: "Ring the watch peal and bring Flash to read the grooves in the wax.",
        },
      ],
    ],
  },
  promise: {
    name: "A Rival’s Promise",
    where: "aster",
    who: "Robin",
    brief:
      "Finish the four friendly battles on Orchard Lane, Canal Road, Ashen Trail and Starlit Avenue. Meet Robin in the Aster gardens.",
    ending:
      "“Eevee took the whole trip with me. This time I’d like you to choose where its road goes.” Robin hands over the Poké Ball and the stone you picked.",
    prize: "Eevee and an evolution stone",
    reward: { species: 133, level: 30 },
    requires: { flags: [1, 2, 3, 4].map((n) => "rival_" + n + "_won") },
    field: { device: "promise" },
  },
  chart: {
    name: "Stargazer’s Chart",
    where: "aster",
    who: "Stargazer",
    brief:
      "Visit the inner sites of Astra’s eight keeper beacons. Your field book plots each arrival, even before you meet the stargazer.",
    ending:
      "Eight sight lines meet over the central sea. The stargazer inks in the crossing and signs over the Master Ball from the observatory’s survey kit.",
    prize: "Master Ball",
    reward: { item: "master_ball" },
    requires: { flags: ["beacon_chart_full"] },
  },
  atlas: {
    name: "Living Atlas",
    where: "aurora_3",
    who: "Atlas editor",
    brief:
      "Restore the sanctuary and record all 251 species. Choose the habitat that will open Astra’s first complete field atlas.",
    ending:
      "The editor stitches the last signature into the atlas. Your chosen habitat opens the first page. The nursery team signs an Aurora certificate in your name.",
    prize: "Aurora certificate",
    reward: { item: "aurora_certificate" },
    requires: { flags: ["aurora_restored"], caught: 251 },
    field: { device: "atlas" },
  },
};

const aftercare: Record<string, string> = {
  parcel: "Listen to the mulberry basket. Every one of those eggs made it through the orchard.",
  hearth: "Another loaf tomorrow. Bring your fire partner by for the first heel.",
  pollinators: "See those little apples? Each started as a blossom on the windward row.",
  angler: "Face shallow water and press A. Keep the line loose until you feel a proper bite.",
  lighthouse: "When Lapras sings outside the harbor, even the old pilots stop to listen.",
  collector: "Two clicks before high water. The old tide clock is right on time.",
  fossil:
    "Both shell families once shared this cutting. You can still find their descendants along the freight road.",
  oasis: "Come see the sunlight through the bowl. It holds water right up to the mended rim.",
  census: "Your feeding note helped us keep the muddy bank inside the reserve boundary.",
  bamboo_friend: "Hear that scraping? Farfetch’d is sharpening its leek on my pack buckle again.",
  furnace: "That coupling you tempered is pulling its weight on the refuge tram.",
  medicine: "Our patient is back on her feet. This morning she raced me all the way to the windmill.",
  echoes: "When the last bell dies away, look at the margins. Sometimes the letters change seats.",
  promise: "The first match feels a long time ago. I’m glad the road brought us both here.",
  chart: "All eight bearings cross over open water. The current really does belong to the whole region.",
  atlas: "Your atlas is bound and signed. There’s already a waiting list at the ranger cabin.",
};

export function populateRequests(world: Record<string, WorldMap>, quests: Quest[]) {
  for (const [id, r] of Object.entries(requests)) {
    const completedFlag = "quest_" + id + "_complete";
    quests.push({
      id,
      name: r.name,
      description: r.brief,
      prerequisite: r.requires,
      completedFlag,
      reward: r.prize,
    });
    const claim: Prop = {
      id: r.claimId ?? "quest_" + id,
      quest: id,
      name: r.who,
      kind: "person",
      dialogue: r.ending,
      victoryDialogue: aftercare[id],
      lockedDialogue: r.brief,
      setsFlag: completedFlag,
      requires: r.requires,
      reward: r.reward,
      field: r.field,
    };
    for (const [map, object] of [[r.where, claim] as Stop, ...(r.stops ?? [])])
      world[map].objects.push({ ...object, request: id, x: 0, y: 0 });
  }
  const quagsire = world.route10.objects.find((o) => o.id === "resident_route10")!;
  quagsire.request = "census";
  quagsire.setsFlag = "census_feeding";
}

export function updateChart(flags: string[], map: string) {
  const site = chartVisit(map);
  if (site && !flags.includes("chart_" + site)) flags.push("chart_" + site);
  if (!flags.includes("beacon_chart_full") && recordedSites(flags).length === chartSites.length)
    flags.push("beacon_chart_full");
}

export function requestHint(
  id: string,
  flags: readonly string[],
  caught: readonly number[],
  typesOf: (n: number) => number[],
) {
  const has = (flag: string) => flags.includes(flag);
  const missing = (pairs: string[][]) =>
    pairs
      .filter(([flag]) => !has(flag))
      .map(([, clue]) => clue)
      .join(", ");
  switch (id) {
    case "parcel":
      return !has("found_parcel")
        ? "Pick up the egg parcel from the Mossford courier."
        : !has("parcel_wrapped")
          ? "Wrap the eggs at the Orchard Lane packing bench."
          : "Deliver the protected eggs to the Bramble courier.";
    case "collector":
      return (
        "Still needed: " +
        missing([
          ["found_part_a", "brass cork on Canal Road"],
          ["found_part_b", "pawl at Switchyard"],
          ["found_part_c", "spring in the feeder gallery"],
        ])
      );
    case "chart": {
      const logged = recordedSites(flags);
      return (
        logged.length +
        "/8 beacons plotted. Remaining: " +
        chartSites
          .filter((site) => !logged.includes(site))
          .map((s) => s[1])
          .join(", ")
      );
    }
    case "pollinators":
      return (
        Math.min(3, caught.filter((n) => typesOf(n).includes(7)).length) +
        "/3 Bug species. " +
        (has("orchard_brushed") ? "Windward blossoms dusted." : "Dust the windward blossom on Orchard Lane.")
      );
    case "angler":
      return (
        Math.min(3, caught.filter((n) => typesOf(n).includes(21)).length) +
        "/3 Water species registered for the quay lesson."
      );
    case "census":
      return (
        Math.min(30, caught.length) +
        "/30 caught. " +
        (has("census_feeding") ? "Quagsire feeding note filed." : "Observe Quagsire on Reedwalk.")
      );
    case "medicine":
      return has("found_snow_herb")
        ? "Steep the silverleaf in Rimepeak’s spa infusion pot."
        : "Gather silverleaf in Frostvault’s cornice traverse.";
    case "oasis":
      return has("oasis_filled")
        ? "Glaze the bowl at the restored lens in the buried aperture."
        : "Fill the cracked offering bowl at the Sunspire spring.";
    case "bamboo_friend":
      return has("farfetchd_lane")
        ? "Approach Farfetch’d from due south on Ranger Island."
        : "Use Cut on the tangled leek bed on Ranger Island.";
    case "promise":
      return (
        "Meet Robin on " +
        missing([
          ["rival_1_won", "Orchard Lane"],
          ["rival_2_won", "Canal Road"],
          ["rival_3_won", "Ashen Trail"],
          ["rival_4_won", "Starlit Avenue"],
        ]) +
        "."
      );
    case "atlas":
      return caught.length + "/251 caught. " + requests.atlas.brief;
    default:
      return requests[id].brief;
  }
}
