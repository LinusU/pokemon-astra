// Ported Yellow map scripts: Fuchsia City, Seafoam Islands, Cinnabar Island, the Pokémon Mansion and the Power Plant.
// See docs/YELLOW_PORTING.md.
import { defineMap, SHARED_TEXTS, type Game } from "../script";

const hidden = (routine: string, handler: (g: Game) => Promise<void>) => { SHARED_TEXTS["hidden:" + routine] = handler; };

// ---------------------------------------------------------------- Fuchsia City

/** Sign texts that print a line and then open the Pokédex entry. */
const dexSign = (label: string, species: string) => async (g: Game) => {
  await g.text(label + ".Text");
  await g.showDex(species);
};

defineMap("FuchsiaCity", {
  texts: {
    FuchsiaCityChanseySignText: dexSign("FuchsiaCityChanseySignText", "CHANSEY"),
    FuchsiaCityVoltorbSignText: dexSign("FuchsiaCityVoltorbSignText", "VOLTORB"),
    FuchsiaCityKangaskhanSignText: dexSign("FuchsiaCityKangaskhanSignText", "KANGASKHAN"),
    FuchsiaCitySlowpokeSignText: dexSign("FuchsiaCitySlowpokeSignText", "SLOWPOKE"),
    FuchsiaCityLaprasSignText: dexSign("FuchsiaCityLaprasSignText", "LAPRAS"),
    async FuchsiaCityFossilSignText(g) {
      if (g.ev("EVENT_GOT_DOME_FOSSIL")) {
        await g.text("FuchsiaCityFossilSignText.OmanyteText");
        return g.showDex("OMANYTE");
      }
      if (g.ev("EVENT_GOT_HELIX_FOSSIL")) {
        await g.text("FuchsiaCityFossilSignText.KabutoText");
        return g.showDex("KABUTO");
      }
      await g.text("FuchsiaCityFossilSignText.UndeterminedText");
    },
  },
});

defineMap("FuchsiaPokecenter", { generic: true });

defineMap("WardensHouse", {
  texts: {
    async WardensHouseWardenText(g) {
      if (g.ev("EVENT_GOT_HM04")) return g.text("WardensHouseWardenText.HM04ExplanationText");
      if (g.hasItem("GOLD_TEETH")) {
        await g.text("WardensHouseWardenText.GaveTheGoldTeethText");
        g.take("GOLD_TEETH");
        g.set("EVENT_GAVE_GOLD_TEETH");
      } else if (!g.ev("EVENT_GAVE_GOLD_TEETH")) {
        await g.text("WardensHouseWardenText.Gibberish1Text", { wait: false });
        return g.text((await g.yesNo()) ? "WardensHouseWardenText.Gibberish2Text" : "WardensHouseWardenText.Gibberish3Text");
      }
      await g.text("WardensHouseWardenText.ThanksText");
      if (!g.give("HM_STRENGTH")) return g.text("WardensHouseWardenText.HM04NoRoomText");
      await g.text("WardensHouseWardenText.ReceivedHM04Text");
      g.set("EVENT_GOT_HM04");
    },
    // The two display cases are the signs at x = 4 (left) and x = 5 (right).
    async WardensHouseDisplayText(g) {
      await g.text(g.player.x === 4 ? "WardensHouseDisplayText.PhotosAndFossilsText" : "WardensHouseDisplayText.MerchandiseText");
    },
  },
});

defineMap("SafariZoneSecretHouse", {
  texts: {
    async SafariZoneSecretHouseFishingGuruText(g) {
      const t = "SafariZoneSecretHouseFishingGuruText.";
      if (g.ev("EVENT_GOT_HM03")) return g.text(t + "HM03ExplanationText");
      await g.text(t + "YouHaveWonText");
      if (!g.give("HM_SURF")) return g.text(t + "HM03NoRoomText");
      await g.text(t + "ReceivedHM03Text");
      g.set("EVENT_GOT_HM03");
    },
  },
});

defineMap("FuchsiaGoodRodHouse", {
  texts: {
    async FuchsiaGoodRodHouseFishingGuruText(g) {
      const t = "FuchsiaGoodRodHouseFishingGuruText.";
      // BIT_GOT_GOOD_ROD of wStatusFlags1.
      if (g.vars.gotGoodRod) return g.text(t + "HowAreTheFishText");
      await g.text(t + "Text", { wait: false });
      if (!(await g.yesNo())) return g.text(t + "ThatsSoDisappointingText");
      if (!g.give("GOOD_ROD")) return g.text(t + "NoRoomText");
      g.vars.gotGoodRod = 1;
      await g.text(t + "ReceivedGoodRodText");
    },
  },
});

/** The leaders' reward scene: Soul Badge and TM06 (Koga) or Volcano Badge and TM38 (Blaine). */
const FUCHSIA_TRAINER_EVENTS = [
  "EVENT_BEAT_FUCHSIA_GYM_TRAINER_0", "EVENT_BEAT_FUCHSIA_GYM_TRAINER_1", "EVENT_BEAT_FUCHSIA_GYM_TRAINER_2",
  "EVENT_BEAT_FUCHSIA_GYM_TRAINER_3", "EVENT_BEAT_FUCHSIA_GYM_TRAINER_4", "EVENT_BEAT_FUCHSIA_GYM_TRAINER_5",
];
export async function kogaReward(g: Game) {
  await g.text("TEXT_FUCHSIAGYM_KOGA_SOUL_BADGE_INFO");
  g.set("EVENT_BEAT_KOGA");
  if (g.give("TM_TOXIC")) {
    await g.text("TEXT_FUCHSIAGYM_KOGA_RECEIVED_TM06");
    g.set("EVENT_GOT_TM06");
  } else {
    await g.text("TEXT_FUCHSIAGYM_KOGA_TM06_NO_ROOM");
  }
  g.badge(4);
  for (const e of FUCHSIA_TRAINER_EVENTS) g.set(e);
}

defineMap("FuchsiaGym", {
  generic: true,
  texts: {
    async FuchsiaGymKogaText(g) {
      if (g.ev("EVENT_BEAT_KOGA")) {
        if (g.ev("EVENT_GOT_TM06")) return g.text("FuchsiaGymKogaText.PostBattleAdviceText");
        return kogaReward(g);
      }
      await g.text("FuchsiaGymKogaText.BeforeBattleText");
      if (await g.trainerBattle("KOGA", 1, { win: "FuchsiaGymKogaText.ReceivedSoulBadgeText" })) await kogaReward(g);
    },
    async FuchsiaGymGymGuideText(g) {
      await g.text(g.ev("EVENT_BEAT_KOGA") ? "FuchsiaGymGymGuideText.BeatKogaText" : "FuchsiaGymGymGuideText.ChampInMakingText");
    },
  },
});

// ---------------------------------------------------------------- Seafoam Islands

interface SeafoamFloor {
  /** Squares where a boulder fills a hole, in the order of the dungeon warp list. */
  holes: [number, number][];
  /** Where the player lands on the floor below for each hole. */
  landing: [number, number][];
  below: string;
  /** Map object indexes of the boulders that can be pushed into the holes. */
  boulders: number[];
  events: [string, string];
  hide: [string, string];
  show: [string, string];
}

const SEAFOAM_FLOORS: Record<string, SeafoamFloor> = {
  SeafoamIslands1F: {
    holes: [[17, 6], [24, 6]], landing: [[18, 7], [23, 7]], below: "SEAFOAM_ISLANDS_B1F", boulders: [1, 2],
    events: ["EVENT_SEAFOAM1_BOULDER1_DOWN_HOLE", "EVENT_SEAFOAM1_BOULDER2_DOWN_HOLE"],
    hide: ["HS_SEAFOAM_ISLANDS_1F_BOULDER_1", "HS_SEAFOAM_ISLANDS_1F_BOULDER_2"],
    show: ["HS_SEAFOAM_ISLANDS_B1F_BOULDER_1", "HS_SEAFOAM_ISLANDS_B1F_BOULDER_2"],
  },
  SeafoamIslandsB1F: {
    holes: [[18, 6], [23, 6]], landing: [[19, 7], [22, 7]], below: "SEAFOAM_ISLANDS_B2F", boulders: [1, 2],
    events: ["EVENT_SEAFOAM2_BOULDER1_DOWN_HOLE", "EVENT_SEAFOAM2_BOULDER2_DOWN_HOLE"],
    hide: ["HS_SEAFOAM_ISLANDS_B1F_BOULDER_1", "HS_SEAFOAM_ISLANDS_B1F_BOULDER_2"],
    show: ["HS_SEAFOAM_ISLANDS_B2F_BOULDER_1", "HS_SEAFOAM_ISLANDS_B2F_BOULDER_2"],
  },
  SeafoamIslandsB2F: {
    holes: [[19, 6], [22, 6]], landing: [[18, 7], [19, 7]], below: "SEAFOAM_ISLANDS_B3F", boulders: [1, 2],
    events: ["EVENT_SEAFOAM3_BOULDER1_DOWN_HOLE", "EVENT_SEAFOAM3_BOULDER2_DOWN_HOLE"],
    hide: ["HS_SEAFOAM_ISLANDS_B2F_BOULDER_1", "HS_SEAFOAM_ISLANDS_B2F_BOULDER_2"],
    show: ["HS_SEAFOAM_ISLANDS_B3F_BOULDER_3", "HS_SEAFOAM_ISLANDS_B3F_BOULDER_4"],
  },
  SeafoamIslandsB3F: {
    holes: [[3, 16], [6, 16]], landing: [[4, 14], [5, 14]], below: "SEAFOAM_ISLANDS_B4F", boulders: [1, 2, 3, 4],
    events: ["EVENT_SEAFOAM4_BOULDER1_DOWN_HOLE", "EVENT_SEAFOAM4_BOULDER2_DOWN_HOLE"],
    hide: ["HS_SEAFOAM_ISLANDS_B3F_BOULDER_1", "HS_SEAFOAM_ISLANDS_B3F_BOULDER_2"],
    show: ["HS_SEAFOAM_ISLANDS_B4F_BOULDER_1", "HS_SEAFOAM_ISLANDS_B4F_BOULDER_2"],
  },
};

/**
 * Boulders resting on a hole drop to the floor below (CheckBoulderCoords), and the
 * player stepping on a hole falls through (IsPlayerOnDungeonWarp). Resolves true if the player fell.
 */
async function seafoamHoles(g: Game, floor: SeafoamFloor) {
  floor.holes.forEach(([x, y], k) => {
    if (!g.shown(floor.hide[k])) return;
    for (const index of floor.boulders) {
      const boulder = g.npc(index);
      if (!boulder || boulder.x !== x || boulder.y !== y) continue;
      g.set(floor.events[k]);
      g.hide(floor.hide[k]);
      g.show(floor.show[k]);
      return;
    }
  });
  const k = floor.holes.findIndex(([x, y]) => g.player.x === x && g.player.y === y);
  if (k < 0) return false;
  await g.warp(floor.below, floor.landing[k][0], floor.landing[k][1]);
  return true;
}

/** The current on B3F/B4F runs while a floor's upper holes are not both plugged with boulders. */
const currentBlocked = (g: Game, a: string, b: string) => g.ev(a) && g.ev(b);

defineMap("SeafoamIslands1F", {
  onEnter(g) {
    g.set("EVENT_IN_SEAFOAM_ISLANDS");
  },
  async onStep(g) {
    await seafoamHoles(g, SEAFOAM_FLOORS.SeafoamIslands1F);
  },
});

defineMap("SeafoamIslandsB1F", {
  async onStep(g) {
    await seafoamHoles(g, SEAFOAM_FLOORS.SeafoamIslandsB1F);
  },
});

defineMap("SeafoamIslandsB2F", {
  async onStep(g) {
    await seafoamHoles(g, SEAFOAM_FLOORS.SeafoamIslandsB2F);
  },
});

defineMap("SeafoamIslandsB3F", {
  async onStep(g) {
    if (await seafoamHoles(g, SEAFOAM_FLOORS.SeafoamIslandsB3F)) return;
    const { x, y } = g.player;
    // Falling into the water from B2F puts the player on a surfboard (ForcedBikeOrSurfMaps).
    if (y === 7 && (x === 18 || x === 19)) g.save.surfing = true;
    if (currentBlocked(g, "EVENT_SEAFOAM3_BOULDER1_DOWN_HOLE", "EVENT_SEAFOAM3_BOULDER2_DOWN_HOLE")) return;
    // The strong current sweeps the player down to the hole to B4F (the original joypad lists, in playing order).
    let path: string | undefined;
    if (x === 15 && y === 8) path = "D3R5D6";
    else if (x === 18 && y === 7) path = "D4R2D6";
    else if (x === 19 && y === 7) path = "L1D4R2D6";
    if (!path) return;
    g.save.surfing = true;
    await g.move("player", path, { ignoreCollision: true });
    await g.warp("SEAFOAM_ISLANDS_B4F", 20, 17, "up");
  },
});

defineMap("SeafoamIslandsB4F", {
  async onStep(g) {
    const { x, y } = g.player;
    if (y === 14 && (x === 4 || x === 5)) {
      // Landing from the holes in B3F; the current carries the player to the shore.
      g.save.surfing = true;
      if (currentBlocked(g, "EVENT_SEAFOAM4_BOULDER1_DOWN_HOLE", "EVENT_SEAFOAM4_BOULDER2_DOWN_HOLE")) return;
      await g.move("player", x === 4 ? "U1R3U3" : "U1R2U3", { ignoreCollision: true });
      g.save.surfing = false;
      return;
    }
    // Arriving from the current on B3F, the player is pushed up out of the water.
    if (currentBlocked(g, "EVENT_SEAFOAM3_BOULDER1_DOWN_HOLE", "EVENT_SEAFOAM3_BOULDER2_DOWN_HOLE")) return;
    if ((x === 20 || x === 21) && y === 17) await g.move("player", "U2", { ignoreCollision: true });
    else if ((x === 20 || x === 21) && y === 16) await g.move("player", "U1", { ignoreCollision: true });
  },
  texts: {
    async SeafoamIslandsB4FArticunoText(g) {
      if (g.ev("EVENT_BEAT_ARTICUNO")) return;
      await g.text("SeafoamIslandsB4FArticunoBattleText");
      const result = await g.wildBattle("ARTICUNO", 50, { stationary: true });
      if (result === "win" || result === "caught") {
        g.set("EVENT_BEAT_ARTICUNO");
        g.hide("HS_ARTICUNO");
      }
    },
    // The text ends by playing the bird's cry.
    async SeafoamIslandsB4FArticunoBattleText(g) {
      g.cry("ARTICUNO");
    },
  },
});

defineMap("Route20", {
  onEnter(g) {
    // Coming out of the Seafoam Islands, the boulders are put back unless both holes of a floor were plugged.
    if (!g.ev("EVENT_IN_SEAFOAM_ISLANDS")) return;
    g.reset("EVENT_IN_SEAFOAM_ISLANDS");
    if (!(g.ev("EVENT_SEAFOAM3_BOULDER1_DOWN_HOLE") && g.ev("EVENT_SEAFOAM3_BOULDER2_DOWN_HOLE"))) {
      g.show("HS_SEAFOAM_ISLANDS_1F_BOULDER_1");
      g.show("HS_SEAFOAM_ISLANDS_1F_BOULDER_2");
      for (const hs of [
        "HS_SEAFOAM_ISLANDS_B1F_BOULDER_1", "HS_SEAFOAM_ISLANDS_B1F_BOULDER_2",
        "HS_SEAFOAM_ISLANDS_B2F_BOULDER_1", "HS_SEAFOAM_ISLANDS_B2F_BOULDER_2",
        "HS_SEAFOAM_ISLANDS_B3F_BOULDER_3", "HS_SEAFOAM_ISLANDS_B3F_BOULDER_4",
      ]) g.hide(hs);
    }
    if (!(g.ev("EVENT_SEAFOAM4_BOULDER1_DOWN_HOLE") && g.ev("EVENT_SEAFOAM4_BOULDER2_DOWN_HOLE"))) {
      g.show("HS_SEAFOAM_ISLANDS_B3F_BOULDER_1");
      g.show("HS_SEAFOAM_ISLANDS_B3F_BOULDER_2");
      g.hide("HS_SEAFOAM_ISLANDS_B4F_BOULDER_1");
      g.hide("HS_SEAFOAM_ISLANDS_B4F_BOULDER_2");
    }
  },
});

// ---------------------------------------------------------------- Cinnabar Island

defineMap("CinnabarIsland", {
  onEnter(g) {
    // Coming back to the island flips the Mansion switch back and finishes any fossil revival.
    g.reset("EVENT_MANSION_SWITCH_ON");
    g.reset("EVENT_LAB_STILL_REVIVING_FOSSIL");
  },
  async onStep(g) {
    // The Gym door is locked until the player has the Secret Key.
    if (g.hasItem("SECRET_KEY") || g.player.y !== 4 || g.player.x !== 18) return;
    await g.text("TEXT_CINNABARISLAND_DOOR_IS_LOCKED");
    await g.move("player", "D");
    await g.delay(3);
  },
});

defineMap("CinnabarPokecenter", { generic: true });

defineMap("CinnabarLabMetronomeRoom", {
  texts: {
    async CinnabarLabMetronomeRoomScientist1Text(g) {
      const t = "CinnabarLabMetronomeRoomScientist1Text.";
      if (g.ev("EVENT_GOT_TM35")) return g.text(t + "TM35ExplanationText");
      await g.text(t + "Text");
      if (!g.give("TM_METRONOME")) return g.text(t + "TM35NoRoomText");
      await g.text(t + "ReceivedTM35Text");
      g.set("EVENT_GOT_TM35");
    },
  },
});

const TRADE_FOR_STICKY = 3, TRADE_FOR_BUFFY = 7, TRADE_FOR_CEZANNE = 8;

defineMap("CinnabarLabTradeRoom", {
  texts: {
    CinnabarLabTradeRoomGrampsText: g => g.trade(TRADE_FOR_BUFFY),
    CinnabarLabTradeRoomBeautyText: g => g.trade(TRADE_FOR_CEZANNE),
  },
});

/** Fossils the lab can revive: bag item, its name, the revived species. */
const FOSSILS = [
  { item: "DOME_FOSSIL", name: "DOME FOSSIL", mon: "KABUTO" },
  { item: "HELIX_FOSSIL", name: "HELIX FOSSIL", mon: "OMANYTE" },
  { item: "OLD_AMBER", name: "OLD AMBER", mon: "AERODACTYL" },
];

defineMap("CinnabarLabFossilRoom", {
  texts: {
    async CinnabarLabFossilRoomScientist1Text(g) {
      const t = "CinnabarLabFossilRoomScientist1Text.";
      if (!g.ev("EVENT_GAVE_FOSSIL_TO_LAB")) {
        await g.text(t + "Text");
        const owned = FOSSILS.filter(f => g.hasItem(f.item));
        if (!owned.length) return g.text(t + "NoFossilsText");
        // GiveFossilToCinnabarLab
        const pick = await g.choose("FOSSILS", owned.map(f => f.name));
        if (pick === undefined) return g.text("GiveFossilToCinnabarLab.ComeAgainText");
        const fossil = owned[pick];
        g.textVar("wNameBuffer", fossil.name);
        g.textVar("wStringBuffer", fossil.mon);
        await g.text("GiveFossilToCinnabarLab.ScientistSeesFossilText", { wait: false });
        if (!(await g.yesNo())) return g.text("GiveFossilToCinnabarLab.ComeAgainText");
        await g.text("GiveFossilToCinnabarLab.ScientistTakesFossilText");
        g.take(fossil.item);
        await g.text("GiveFossilToCinnabarLab.GoForAWalkText");
        g.set("EVENT_GAVE_FOSSIL_TO_LAB");
        g.set("EVENT_LAB_STILL_REVIVING_FOSSIL");
        g.vars.fossilRevived = FOSSILS.indexOf(fossil) + 1;
        return;
      }
      if (g.ev("EVENT_LAB_STILL_REVIVING_FOSSIL")) return g.text(t + "GoForAWalkText");
      const fossil = FOSSILS[Math.max(0, (g.vars.fossilRevived ?? 1) - 1)];
      g.textVar("wNameBuffer", fossil.name);
      g.textVar("wStringBuffer", fossil.mon);
      await g.text(t + "FossilIsBackToLifeText");
      g.set("EVENT_LAB_HANDING_OVER_FOSSIL_MON");
      if (await g.giveMon(fossil.mon, g.legacy ? 40 : 30)) { // Yellow Legacy: level 40
        g.reset("EVENT_GAVE_FOSSIL_TO_LAB");
        g.reset("EVENT_LAB_STILL_REVIVING_FOSSIL");
        g.reset("EVENT_LAB_HANDING_OVER_FOSSIL_MON");
      }
    },
    CinnabarLabFossilRoomScientist2Text: g => g.trade(TRADE_FOR_STICKY),
  },
});

// ---------------------------------------------------------------- Cinnabar Gym

/** Gate blocks of the Gym: block x, y and the locked gate's block. Unlocked gates become plain floor. */
const GATES: [number, number, number][] = [[9, 3, 0x54], [6, 3, 0x54], [6, 6, 0x54], [3, 8, 0x5f], [2, 6, 0x54], [2, 3, 0x54]];
const GATE_EVENTS = [
  "EVENT_CINNABAR_GYM_GATE1_UNLOCKED", "EVENT_CINNABAR_GYM_GATE2_UNLOCKED", "EVENT_CINNABAR_GYM_GATE3_UNLOCKED",
  "EVENT_CINNABAR_GYM_GATE4_UNLOCKED", "EVENT_CINNABAR_GYM_GATE5_UNLOCKED", "EVENT_CINNABAR_GYM_GATE6_UNLOCKED",
];
const GYM_TRAINER_EVENTS = [
  "EVENT_BEAT_CINNABAR_GYM_TRAINER_0", "EVENT_BEAT_CINNABAR_GYM_TRAINER_1", "EVENT_BEAT_CINNABAR_GYM_TRAINER_2",
  "EVENT_BEAT_CINNABAR_GYM_TRAINER_3", "EVENT_BEAT_CINNABAR_GYM_TRAINER_4", "EVENT_BEAT_CINNABAR_GYM_TRAINER_5",
  "EVENT_BEAT_CINNABAR_GYM_TRAINER_6",
];
/** The seven Super Nerds: object index, trainer class and party number. Nerd n guards gate n - 1. */
const NERDS: [string, number][] = [
  ["SUPER_NERD", 9], ["BURGLAR", 4], ["SUPER_NERD", 10], ["BURGLAR", 5], ["SUPER_NERD", 11], ["BURGLAR", 6], ["SUPER_NERD", 12],
];
const BLAINE = 1;

function updateGates(g: Game) {
  GATES.forEach(([x, y, locked], i) => g.setBlock(x, y, g.ev(GATE_EVENTS[i]) ? 0x0e : locked));
}

/** Beating a gate's Super Nerd (or answering its quiz) opens the gate. */
async function openGate(g: Game, gate: number) {
  if (gate < 1) return;
  const wasLocked = !g.ev(GATE_EVENTS[gate - 1]);
  if (wasLocked) await g.delay(30);
  g.set(GATE_EVENTS[gate - 1]);
  updateGates(g);
  if (wasLocked) g.sfx("SFX_GO_INSIDE");
}

async function fightNerd(g: Game, n: number) {
  const [klass, party] = NERDS[n - 1];
  const t = `CinnabarGymSuperNerd${n}.`;
  await g.text(t + "BattleText");
  if (!(await g.trainerBattle(klass, party, { win: t + "EndBattleText" }))) return;
  g.set(GYM_TRAINER_EVENTS[n - 1]);
  await openGate(g, n - 1);
}

async function talkToNerd(g: Game, n: number) {
  if (g.ev(GYM_TRAINER_EVENTS[n - 1])) return g.text(`CinnabarGymSuperNerd${n}.AfterBattleText`);
  // Until the quiz is answered, the nerd behind a closed gate sends the player to the quiz machine.
  if (n >= 2 && !g.ev(GATE_EVENTS[n - 2])) {
    return g.text(["CinnabarGymText_f2169", "CinnabarGymText_f216e", "CinnabarGymText_f2173", "CinnabarGymText_f2178", "CinnabarGymText_f217d", "CinnabarGymText_f2182"][n - 2]);
  }
  await fightNerd(g, n);
}

async function blaineReward(g: Game) {
  await g.text("TEXT_CINNABARGYM_BLAINE_VOLCANO_BADGE_INFO");
  g.set("EVENT_BEAT_BLAINE");
  if (g.give("TM_FIRE_BLAST")) {
    await g.text("TEXT_CINNABARGYM_BLAINE_RECEIVED_TM38");
    g.set("EVENT_GOT_TM38");
  } else {
    await g.text("TEXT_CINNABARGYM_BLAINE_TM38_NO_ROOM");
  }
  g.badge(6);
  for (const e of GYM_TRAINER_EVENTS) g.set(e);
  updateGates(g);
}

// The disassembly labels the Super Nerds' entries CinnabarGymSuperNerd1 and so on; the generator publishes them with a Text suffix.
const NERD_ENTRIES = [1, 2, 3, 4, 5, 6, 7].map(n => `CinnabarGymSuperNerd${n}Text`);

defineMap("CinnabarGym", {
  onEnter(g) {
    updateGates(g);
  },
  texts: {
    async CinnabarGymBlaineText(g) {
      if (g.ev("EVENT_BEAT_BLAINE")) {
        if (g.ev("EVENT_GOT_TM38")) return g.text("CinnabarGymBlaineText.PostBattleAdviceText");
        return blaineReward(g);
      }
      await g.text("CinnabarGymBlaineText.PreBattleText");
      if (await g.trainerBattle("BLAINE", 1, { win: "CinnabarGymBlaineText.ReceivedVolcanoBadgeText" })) await blaineReward(g);
    },
    async CinnabarGymPrintGymGuideText(g) {
      await g.text(g.ev("EVENT_BEAT_BLAINE") ? "CinnabarGymPrintGymGuideText.BeatBlaineText" : "CinnabarGymPrintGymGuideText.ChampInMakingText");
    },
    ...Object.fromEntries(NERD_ENTRIES.map((label, i) => [label, (g: Game) => talkToNerd(g, i + 1)])),
  },
});

// The sound of the gate opening plays only if the gate was still closed when the text is shown.
SHARED_TEXTS.CinnabarGymQuizCorrectText = async g => {
  if (!g.ev(GATE_EVENTS[(g.hiddenArg & 0xf) - 1])) g.sfx("SFX_GO_INSIDE");
};

hidden("PrintCinnabarQuiz", async g => {
  if (g.player.facing !== "up") return;
  const gate = g.hiddenArg & 0xf, answer = g.hiddenArg >> 4;
  await g.text(gate === 1 ? "CinnabarGymQuizIntroText" : "CinnabarGymQuizShortIntroText");
  await g.text(`CinnabarQuizQuestionsText${gate}`, { wait: false });
  const yes = await g.yesNo();
  if ((yes ? 0 : 1) === answer) {
    await g.text("CinnabarGymQuizCorrectText");
    g.set(GATE_EVENTS[gate - 1]);
    updateGates(g);
    return;
  }
  g.sfx("SFX_DENIED");
  await g.text("CinnabarGymQuizIncorrectText");
  // A wrong answer makes the gate's Super Nerd come and fight.
  const n = gate + 1;
  if (g.ev(GYM_TRAINER_EVENTS[n - 1])) return;
  const nerd = n + 1;
  if (nerd === 4) {
    g.face("player", "down");
    await g.move(nerd, "LU");
  } else {
    g.face("player", "right");
    await g.move(nerd, "L");
  }
  g.facePlayer(nerd);
  await fightNerd(g, n);
});

// ---------------------------------------------------------------- Pokémon Mansion

/** Blocks flipped by the switches: block x, y, block with the switch off, block with it on. */
const MANSION_BLOCKS: Record<string, [number, number, number, number][]> = {
  PokemonMansion1F: [[12, 6, 0x0e, 0x2d], [8, 3, 0x2d, 0x0e], [10, 8, 0x2d, 0x0e], [13, 13, 0x2d, 0x0e]],
  PokemonMansion2F: [[4, 2, 0x0e, 0x5f], [9, 4, 0x54, 0x0e], [3, 11, 0x5f, 0x0e]],
  PokemonMansion3F: [[7, 2, 0x0e, 0x5f], [7, 5, 0x5f, 0x0e]],
  PokemonMansionB1F: [[13, 8, 0x0e, 0x2d], [6, 11, 0x0e, 0x5f], [4, 3, 0x5f, 0x0e], [8, 8, 0x54, 0x0e]],
};

function mansionBlocks(g: Game) {
  const on = g.ev("EVENT_MANSION_SWITCH_ON");
  for (const [x, y, off, onBlock] of MANSION_BLOCKS[g.mapLabel] ?? []) g.setBlock(x, y, on ? onBlock : off);
}

/** The switch text of every floor: asks, then toggles EVENT_MANSION_SWITCH_ON. */
const mansionSwitch = (label: string, notPressed: string) => async (g: Game) => {
  await g.text(label + ".Text", { wait: false });
  if (!(await g.yesNo())) return g.text(label + "." + notPressed);
  await g.text(label + ".PressedText", { wait: false });
  g.sfx("SFX_GO_INSIDE");
  if (g.ev("EVENT_MANSION_SWITCH_ON")) g.reset("EVENT_MANSION_SWITCH_ON");
  else g.set("EVENT_MANSION_SWITCH_ON");
  mansionBlocks(g);
};

// 3F and B1F reuse the 2F switch text in the cartridge.
SHARED_TEXTS.PokemonMansion2FSwitchText = mansionSwitch("PokemonMansion2FSwitchText", "NotPressed");

const switchRoutine = (text: string) => async (g: Game) => {
  if (g.player.facing === "up") await g.text(text);
};
hidden("Mansion1Script_Switches", switchRoutine("TEXT_POKEMONMANSION1F_SWITCH"));
hidden("Mansion2Script_Switches", switchRoutine("TEXT_POKEMONMANSION2F_SWITCH"));
hidden("Mansion3Script_Switches", switchRoutine("TEXT_POKEMONMANSION3F_SWITCH"));
hidden("Mansion4Script_Switches", switchRoutine("TEXT_POKEMONMANSIONB1F_SWITCH"));

defineMap("PokemonMansion1F", {
  onEnter: mansionBlocks,
  texts: {
    PokemonMansion1FSwitchText: mansionSwitch("PokemonMansion1FSwitchText", "NotPressedText"),
  },
});
defineMap("PokemonMansion2F", { onEnter: mansionBlocks });
defineMap("PokemonMansionB1F", { onEnter: mansionBlocks });

defineMap("PokemonMansion3F", {
  onEnter: mansionBlocks,
  async onStep(g) {
    // The holes drop to 1F (the two on the left) and 2F.
    const { x, y } = g.player;
    if (y !== 14) return;
    if (x === 16 || x === 17) await g.warp("POKEMON_MANSION_1F", 16, 14);
    else if (x === 19) await g.warp("POKEMON_MANSION_2F", 18, 14);
  },
});

// ---------------------------------------------------------------- Power Plant

/**
 * The Power Plant's Voltorbs, Electrodes and Zapdos are static Pokémon: the text shows their
 * battle cry, then a wild battle starts. They vanish once defeated or caught.
 */
const staticEncounter = (event: string, hs: string, species: string, level: number, text: string) => async (g: Game) => {
  if (g.ev(event)) return;
  await g.text(text);
  const result = await g.wildBattle(species, level, { stationary: true });
  if (result === "win" || result === "caught") {
    g.set(event);
    g.hide(hs);
  }
};

defineMap("PowerPlant", {
  generic: true,
  texts: {
    PowerPlantVoltorb1Text: staticEncounter("EVENT_BEAT_POWER_PLANT_VOLTORB_0", "HS_VOLTORB_1", "VOLTORB", 40, "PowerPlantVoltorbBattleText"),
    PowerPlantVoltorb2Text: staticEncounter("EVENT_BEAT_POWER_PLANT_VOLTORB_1", "HS_VOLTORB_2", "VOLTORB", 40, "PowerPlantVoltorbBattleText"),
    PowerPlantVoltorb3Text: staticEncounter("EVENT_BEAT_POWER_PLANT_VOLTORB_2", "HS_VOLTORB_3", "VOLTORB", 40, "PowerPlantVoltorbBattleText"),
    PowerPlantElectrode1Text: staticEncounter("EVENT_BEAT_POWER_PLANT_VOLTORB_3", "HS_ELECTRODE_1", "ELECTRODE", 43, "PowerPlantVoltorbBattleText"),
    PowerPlantVoltorb4Text: staticEncounter("EVENT_BEAT_POWER_PLANT_VOLTORB_4", "HS_VOLTORB_4", "VOLTORB", 40, "PowerPlantVoltorbBattleText"),
    PowerPlantVoltorb5Text: staticEncounter("EVENT_BEAT_POWER_PLANT_VOLTORB_5", "HS_VOLTORB_5", "VOLTORB", 40, "PowerPlantVoltorbBattleText"),
    PowerPlantElectrode2Text: staticEncounter("EVENT_BEAT_POWER_PLANT_VOLTORB_6", "HS_ELECTRODE_2", "ELECTRODE", 43, "PowerPlantVoltorbBattleText"),
    PowerPlantVoltorb6Text: staticEncounter("EVENT_BEAT_POWER_PLANT_VOLTORB_7", "HS_VOLTORB_6", "VOLTORB", 40, "PowerPlantVoltorbBattleText"),
    PowerPlantZapdosText: staticEncounter("EVENT_BEAT_ZAPDOS", "HS_ZAPDOS", "ZAPDOS", 50, "PowerPlantZapdosBattleText"),
    // The text ends by playing the bird's cry.
    async PowerPlantZapdosBattleText(g) {
      g.cry("ZAPDOS");
    },
  },
});
