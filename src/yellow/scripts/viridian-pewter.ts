// Ported Yellow map scripts: Viridian City, Route 1, Route 2, Route 22, Pewter City. See docs/YELLOW_PORTING.md.
import { MAP } from "../generated/symbols";
import { defineMap, type Game } from "../script";

// ---------------------------------------------------------------- Viridian City

const VC_OLD_MAN2 = 8;

/** wViridianCityCurScript: 0 default, 1 after the Pokédex, 2 after the catching lesson. */
const viridianState = (g: Game) => g.vars["script:ViridianCity"] ?? 0;

/** The gym only opens for a player holding exactly the first seven badges. */
function hasSevenBadges(g: Game) {
  for (let i = 0; i < 7; i++) if (!g.hasBadge(i)) return false;
  return !g.hasBadge(7);
}

async function viridianCheckGymOpen(g: Game) {
  if (g.ev("EVENT_VIRIDIAN_GYM_OPEN")) return;
  if (hasSevenBadges(g)) {
    g.set("EVENT_VIRIDIAN_GYM_OPEN");
    return;
  }
  if (g.player.x !== 32 || g.player.y !== 8) return;
  await g.text("TEXT_VIRIDIANCITY_GYM_LOCKED");
  await g.move("player", "D");
}

/** The old man's demonstration catch of a Rattata. */
async function catchDemo(g: Game) {
  await g.showcase("RATTATA", [
    "Wild RATTATA appeared!",
    "OLD MAN used POKé BALL!",
    "All right! RATTATA was caught!",
  ]);
}

defineMap("ViridianCity", {
  async onStep(g) {
    const state = viridianState(g);
    if (state === 0) {
      await viridianCheckGymOpen(g);
      // The sleeping old man blocks the way to the north.
      if (g.player.x === 19 && g.player.y === 9) await g.text("TEXT_VIRIDIANCITY_OLD_MAN_SLEEPY");
      return;
    }
    if (state === 1 && !g.ev("EVENT_COMPLETED_CATCH_TRAINING") && g.player.x === 19 && g.player.y === 9) {
      // The awake old man wants to show how to catch Pokémon.
      g.face(VC_OLD_MAN2, "right");
      g.face("player", "left");
      await g.text("TEXT_VIRIDIANCITY_OLD_MAN2");
      return;
    }
    await viridianCheckGymOpen(g);
  },
  texts: {
    async ViridianCityPrintGambler1Text(g) {
      if (hasSevenBadges(g) || g.ev("EVENT_BEAT_VIRIDIAN_GYM_GIOVANNI")) return g.text("ViridianCityPrintGambler1Text.GymLeaderReturnedText");
      await g.text("ViridianCityPrintGambler1Text.GymAlwaysClosedText");
    },
    async ViridianCityPrintYoungster2Text(g) {
      await g.text("ViridianCityPrintYoungster2Text.YouWantToKnowAboutText");
      if (await g.yesNo()) await g.text("ViridianCityPrintYoungster2Text.CaterpieAndWeedleDescriptionText");
      else await g.text("ViridianCityPrintYoungster2Text.OkThenText");
    },
    async ViridianCityPrintGirlText(g) {
      await g.text(g.ev("EVENT_GOT_POKEDEX") ? "ViridianCityPrintGirlText.WhenIGoShopText" : "ViridianCityPrintGirlText.HasntHadHisCoffeeYetText");
    },
    async ViridianCityPrintOldManSleepyText(g) {
      await g.text("ViridianCityPrintOldManSleepyText.PrivatePropertyText");
      await g.move("player", "D");
    },
    async ViridianCityPrintFisherText(g) {
      if (g.ev("EVENT_GOT_TM42")) return g.text("ViridianCityPrintFisherText.TM42ExplanationText");
      await g.text("ViridianCityPrintFisherText.YouCanHaveThisText");
      if (!g.give("TM_DREAM_EATER")) return g.text("ViridianCityPrintFisherText.TM42NoRoomText");
      await g.text("ViridianCityPrintFisherText.ReceivedTM42Text");
      g.set("EVENT_GOT_TM42");
    },
    /** The old man who offers the catching lesson again. */
    async ViridianCityPrintOldManText(g) {
      await g.text("ViridianCityPrintOldManText.WantMeToShowYouAgainText");
      await g.delay(2);
      if (!(await g.yesNo())) return g.text("ViridianCityPrintOldManText.NotGoodEnoughForYouText");
      await g.text("ViridianCityPrintOldManText.WatchCloselyText");
      g.reset("EVENT_INITIAL_CATCH_TRAINING");
      await catchDemo(g);
      g.set("EVENT_COMPLETED_CATCH_TRAINING_AGAIN");
      await g.text("TEXT_VIRIDIANCITY_OLD_MAN_YOU_NEED_TO_WEAKEN_THE_TARGET");
    },
    /** The old man with the coffee: the first catching lesson, then he leaves. */
    async ViridianCityOldMan2Text(g) {
      if (g.ev("EVENT_COMPLETED_CATCH_TRAINING")) return g.text("ViridianCityOldMan2Text.LosingMyTouchText");
      await g.text("ViridianCityOldMan2Text.HadMyCoffeeNowText");
      await g.delay(2);
      g.set("EVENT_INITIAL_CATCH_TRAINING");
      await catchDemo(g);
      g.set("EVENT_COMPLETED_CATCH_TRAINING");
      await g.text("ViridianCityOldMan2Text.LosingMyTouchText");
      // He walks off down the street, going around the player if need be.
      await g.move(VC_OLD_MAN2, g.player.x === 19 ? "D6" : "R1D6");
      g.hide("HS_OLD_MAN_2");
      g.vars["script:ViridianCity"] = 2;
    },
  },
});

defineMap("ViridianPokecenter", { generic: true });

const MART_OLD_MAN_1 = "HS_OLD_MAN_1";

defineMap("ViridianMart", {
  async onStep(g) {
    // wViridianMartCurScript: 0 default, 1 running, 2 parcel handed over.
    if (g.state === 0) {
      g.state = 1;
      await g.text("ViridianMartClerkYouCameFromPalletTownText");
      await g.move("player", "U2L1");
      await g.delay(3);
      await g.text("ViridianMartClerkParcelQuestText");
      g.give("OAKS_PARCEL");
      g.set("EVENT_GOT_OAKS_PARCEL");
      g.state = 2;
    }
    // Once the lesson is done, the old man shows up in the street instead of the one with the coffee.
    if (g.state === 2 && g.ev("EVENT_COMPLETED_CATCH_TRAINING") && !g.ev("EVENT_SPAWNED_OLD_MAN_1")) {
      g.set("EVENT_SPAWNED_OLD_MAN_1");
      g.hide("HS_OLD_MAN_2");
      g.show(MART_OLD_MAN_1);
    }
  },
  // API REQUEST: ViridianMart swaps its text table (wCurMapTextPtr) to ViridianMart_TextPointers2 once
  // EVENT_OAK_GOT_PARCEL is set, so that the clerk sells things instead of saying "say hi to Oak".
  // The runtime always reads the first table; the clerk (object 1) keeps greeting with the Oak line until
  // it can redirect a map's text id, e.g. a `texts["TEXT_VIRIDIANMART_CLERK"]` override for plain text
  // entries. Workaround: none; the mart itself stays closed.
});

defineMap("ViridianNicknameHouse", {
  texts: {
    async ViridianNicknameHouseSpearowText(g) {
      await g.text("ViridianNicknameHouseSpearowText.Text");
      g.cry("SPEAROW");
      await g.delay(30);
    },
  },
});

// ---------------------------------------------------------------- Viridian Gym

/** Spinner arrow tiles: x, y of the tile and the forced walk that follows. */
const VIRIDIAN_ARROWS: [number, number, string][] = [
  [19, 11, "U9"], [19, 1, "L8"], [18, 2, "D9"], [11, 2, "R6"], [16, 10, "D2"], [4, 6, "D7"],
  [5, 13, "R8"], [4, 14, "R9"], [0, 15, "U8"], [1, 15, "U6"], [13, 16, "L6"], [13, 17, "L12"],
];

async function receiveTM27(g: Game) {
  await g.text("TEXT_VIRIDIANGYM_GIOVANNI_EARTH_BADGE_INFO");
  g.set("EVENT_BEAT_VIRIDIAN_GYM_GIOVANNI");
  if (g.give("TM_FISSURE")) {
    await g.text("TEXT_VIRIDIANGYM_GIOVANNI_RECEIVED_TM27");
    g.set("EVENT_GOT_TM27");
  } else {
    await g.text("TEXT_VIRIDIANGYM_GIOVANNI_TM27_NO_ROOM");
  }
  g.badge(7);
  for (let i = 0; i <= 7; i++) g.set(`EVENT_BEAT_VIRIDIAN_GYM_TRAINER_${i}`);
  g.show("HS_ROUTE_22_RIVAL_2");
  g.set("EVENT_2ND_ROUTE22_RIVAL_BATTLE");
  g.set("EVENT_ROUTE22_RIVAL_WANTS_BATTLE");
}

defineMap("ViridianGym", {
  async onStep(g) {
    const arrow = VIRIDIAN_ARROWS.find(([x, y]) => x === g.player.x && y === g.player.y);
    if (!arrow) return;
    g.sfx("SFX_ARROW_TILES");
    await g.move("player", arrow[2]);
  },
  texts: {
    async ViridianGymGiovanniText(g) {
      if (!g.ev("EVENT_BEAT_VIRIDIAN_GYM_GIOVANNI")) {
        await g.text("ViridianGymGiovanniText.PreBattleText");
        const won = await g.trainerBattle("GIOVANNI", 3, { win: "ViridianGymGiovanniText.ReceivedEarthBadgeText" });
        if (won) await receiveTM27(g);
        return;
      }
      if (!g.ev("EVENT_GOT_TM27")) return receiveTM27(g);
      await g.text("ViridianGymGiovanniText.PostBattleAdviceText");
      await g.fade(() => g.hide("HS_VIRIDIAN_GYM_GIOVANNI"));
    },
    async ViridianGymGymGuideText(g) {
      await g.text(g.ev("EVENT_BEAT_VIRIDIAN_GYM_GIOVANNI") ? "ViridianGymGuidePostBattleText" : "ViridianGymGuidePreBattleText");
    },
  },
});

// ---------------------------------------------------------------- Route 1

defineMap("Route1", {
  generic: true,
  texts: {
    async Route1PrintYoungster1Text(g) {
      // The event is set before the potion is handed over, as in the original.
      if (g.ev("EVENT_GOT_POTION_SAMPLE")) return g.text("Route1PrintYoungster1Text.AlsoGotPokeballsText");
      g.set("EVENT_GOT_POTION_SAMPLE");
      await g.text("Route1PrintYoungster1Text.MartSampleText");
      await g.text(g.give("POTION") ? "Route1PrintYoungster1Text.GotPotionText" : "Route1PrintYoungster1Text.NoRoomText");
    },
  },
});

// ---------------------------------------------------------------- Route 22

const R22_RIVAL1 = 1, R22_RIVAL2 = 2;

/** The rival waits at the Route 22 / Route 23 edge. Coordinates are x = 29, y = 4 or 5. */
async function rivalAppears(g: Game, rival: number) {
  const upper = g.player.y === 4;
  g.face("player", "left");
  await g.emote(rival, "exclamation");
  await g.move(rival, upper ? "R4" : "R3");
  if (upper) {
    g.face("player", "down");
    g.face(rival, "up");
  } else {
    g.face(rival, "right");
  }
  return upper;
}

defineMap("Route22", {
  async onStep(g) {
    if (!g.ev("EVENT_ROUTE22_RIVAL_WANTS_BATTLE")) return;
    if (g.player.x !== 29 || (g.player.y !== 4 && g.player.y !== 5)) return;
    if (g.ev("EVENT_1ST_ROUTE22_RIVAL_BATTLE")) return firstRivalBattle(g);
    if (g.ev("EVENT_2ND_ROUTE22_RIVAL_BATTLE")) return secondRivalBattle(g);
  },
  texts: {
    async Route22PrintRival1Text(g) {
      await g.text(g.ev("EVENT_BEAT_ROUTE22_RIVAL_1ST_BATTLE") ? "Route22RivalAfterBattleText1" : "Route22RivalBeforeBattleText1");
    },
    async Route22PrintRival2Text(g) {
      await g.text(g.ev("EVENT_BEAT_ROUTE22_RIVAL_2ND_BATTLE") ? "Route22RivalAfterBattleText2" : "Route22RivalBeforeBattleText2");
    },
  },
});

async function firstRivalBattle(g: Game) {
  g.music("MUSIC_MEET_RIVAL");
  const upper = await rivalAppears(g, R22_RIVAL1);
  await g.text("TEXT_ROUTE22_RIVAL1");
  const won = await g.trainerBattle("RIVAL1", 2, { win: "Route22Rival1DefeatedText", lose: "Route22Rival1VictoryText" });
  if (!won) {
    g.place(R22_RIVAL1, 25, 5);
    return;
  }
  // The rival's Eevee turns into a Jolteon after beating him here (1 Vaporeon, 2 Flareon, 3 Jolteon).
  if (g.vars.rivalStarter === 2) g.vars.rivalStarter = 3;
  g.face(R22_RIVAL1, g.player.facing === "down" ? "up" : "right");
  g.set("EVENT_BEAT_ROUTE22_RIVAL_1ST_BATTLE");
  await g.text("TEXT_ROUTE22_RIVAL1");
  g.music("MUSIC_MEET_RIVAL");
  await g.move(R22_RIVAL1, upper ? "R2D5" : "U1R3D6");
  g.hide("HS_ROUTE_22_RIVAL_1");
  g.music();
  g.reset("EVENT_1ST_ROUTE22_RIVAL_BATTLE");
  g.reset("EVENT_ROUTE22_RIVAL_WANTS_BATTLE");
}

async function secondRivalBattle(g: Game) {
  g.music("MUSIC_MEET_RIVAL");
  const upper = await rivalAppears(g, R22_RIVAL2);
  await g.text("TEXT_ROUTE22_RIVAL2");
  // The rival's party (RIVAL2 8 = Jolteon, 9 = Flareon, 10 = Vaporeon) follows his Eevee's evolution.
  const number = 11 - (g.vars.rivalStarter || 2);
  const won = await g.trainerBattle("RIVAL2", number, { win: "Route22Rival2DefeatedText", lose: "Route22Rival2VictoryText" });
  if (!won) {
    g.place(R22_RIVAL2, 25, 5);
    return;
  }
  g.set("EVENT_BEAT_ROUTE22_RIVAL_2ND_BATTLE");
  await g.text("TEXT_ROUTE22_RIVAL2");
  g.music("MUSIC_MEET_RIVAL");
  await g.move(R22_RIVAL2, upper ? "L4" : "L3");
  g.hide("HS_ROUTE_22_RIVAL_2");
  g.music();
  g.reset("EVENT_2ND_ROUTE22_RIVAL_BATTLE");
  g.reset("EVENT_ROUTE22_RIVAL_WANTS_BATTLE");
}

defineMap("Route22Gate", {
  async onStep(g) {
    // Exits lead back to Route 22 in the south and Route 23 in the north.
    g.save.lastMap = g.player.y < 4 ? MAP.ROUTE_23 : MAP.ROUTE_22;
    if (g.state === 2) return;
    if (g.player.y !== 2 || (g.player.x !== 4 && g.player.x !== 5)) return;
    g.face(1, "left");
    await g.text("TEXT_ROUTE22GATE_GUARD");
  },
  texts: {
    async Route22GateGuardText(g) {
      if (g.hasBadge(0)) {
        await g.text("Route22GateGuardGoRightAheadText");
        g.state = 2;
        return;
      }
      await g.text("Route22GateGuardNoBoulderbadgeText");
      await g.move("player", "D");
    },
    // The text continues after a "denied" sound.
    async Route22GateGuardNoBoulderbadgeText(g) {
      g.sfx("SFX_DENIED");
      await g.delay(20);
      await g.text("Route22GateGuardICantLetYouPassText");
    },
  },
});

// ---------------------------------------------------------------- Route 2

/** Professor Oak's aide trades an item for owning enough different Pokémon. */
async function oaksAide(g: Game, requirement: number, item: string, name: string) {
  g.textVar("wOaksAideRewardItemName", name);
  // API REQUEST: the aide's greeting prints hOaksAideRequirement, which is not a known text variable;
  // the count is left out of the line until a variable for it exists.
  try { g.textVar("hOaksAideRequirement", requirement); } catch { /* not available */ }
  await g.text("OaksAideHiText");
  if (!(await g.yesNo())) {
    await g.text("OaksAideComeBackText");
    return false;
  }
  if (g.save.caught.length < requirement) {
    await g.text("OaksAideUhOhText");
    return false;
  }
  await g.text("OaksAideHereYouGoText");
  if (!g.give(item)) {
    await g.text("OaksAideNoRoomText");
    return false;
  }
  await g.text("OaksAideGotItemText");
  return true;
}

defineMap("Route2Gate", {
  generic: true,
  texts: {
    async Route2GateOaksAideText(g) {
      if (!g.ev("EVENT_GOT_HM05")) {
        if (!(await oaksAide(g, 10, "HM_FLASH", "HM05"))) return;
        g.set("EVENT_GOT_HM05");
      }
      await g.text("Route2GateOaksAideText.FlashExplanationText");
    },
  },
});

defineMap("Route2TradeHouse", {
  generic: true,
  texts: {
    async Route2TradeHouseGameboyKidText(g) {
      await g.trade(1); // TRADE_FOR_MILES
    },
  },
});

defineMap("DiglettsCaveRoute2", {
  onStep(g) {
    g.save.lastMap = MAP.ROUTE_2;
  },
});

// ---------------------------------------------------------------- Pewter City

const PC_SUPER_NERD1 = 3, PC_YOUNGSTER = 5;

defineMap("PewterCity", {
  async onStep(g) {
    g.reset("EVENT_BOUGHT_MUSEUM_TICKET");
    g.vars["script:Museum1F"] = 0;
    if (g.ev("EVENT_BEAT_BROCK")) return;
    // Leaving to the east before beating Brock: the gym guide stops the player.
    const { x, y } = g.player;
    if ((y === 17 && (x === 35 || x === 36)) || (x === 37 && (y === 18 || y === 19))) await g.text("TEXT_PEWTERCITY_YOUNGSTER");
  },
  texts: {
    async PewterCitySuperNerd1Text(g) {
      await g.text("PewterCitySuperNerd1Text.DidYouCheckOutMuseumText");
      if (await g.yesNo()) return g.text("PewterCitySuperNerd1Text.WerentThoseFossilsAmazingText");
      await g.text("PewterCitySuperNerd1Text.YouHaveToGoText");
      await walkToMuseum(g);
    },
    async PewterCitySuperNerd2Text(g) {
      await g.text("PewterCitySuperNerd2Text.DoYouKnowWhatImDoingText");
      await g.text((await g.yesNo()) ? "PewterCitySuperNerd2Text.ThatsRightText" : "PewterCitySuperNerd2Text.ImSprayingRepelText");
    },
    async PewterCityYoungsterText(g) {
      await g.text("PewterCityYoungsterText.YoureATrainerFollowMeText");
      await walkToGym(g);
    },
  },
});

/** The museum guy walks the player to the museum. */
async function walkToMuseum(g: Game) {
  g.music("MUSIC_MUSEUM_GUY");
  // First the player gets in line behind him, from whichever side he was spoken to.
  const { x, y } = g.player;
  const prefix = x === 27 && y === 18 ? "UU" : x === 27 && y === 16 ? "LR" : x === 26 && y === 17 ? "RU" : x === 28 && y === 17 ? "LU" : "";
  await Promise.all([
    g.move(PC_SUPER_NERD1, "U6L13U3L1", { ignoreCollision: true }),
    g.move("player", prefix + "U5L13U3", { ignoreCollision: true }),
  ]);
  g.face(PC_SUPER_NERD1, "up");
  g.music();
  await g.text("TEXT_PEWTERCITY_SUPER_NERD1_ITS_RIGHT_HERE");
  await g.move(PC_SUPER_NERD1, "D4");
  // He goes back to his post.
  g.place(PC_SUPER_NERD1, 27, 17, "down");
}

/** The gym guide walks the player to the gym. */
async function walkToGym(g: Game) {
  g.music("MUSIC_MUSEUM_GUY");
  const { x, y } = g.player;
  let prefix = "";
  let wait = false;
  if (x === 34 && y === 16) prefix = "RDDL";
  else if (x === 35 && y === 17) prefix = "LRDL";
  else if (x === 37 && y === 18) { prefix = "LLL"; wait = true; }
  else if (x === 37 && y === 19) prefix = "LULL";
  else if (x === 36 && y === 17) { prefix = "LDL"; wait = true; }
  await Promise.all([
    g.move(PC_YOUNGSTER, "D2L15U5L11D5R3", { ignoreCollision: true }),
    (async () => {
      if (wait) await g.delay(60);
      await g.move("player", prefix + "L14U5L11D5R2", { ignoreCollision: true });
    })(),
  ]);
  g.face(PC_YOUNGSTER, "left");
  g.music();
  await g.text("TEXT_PEWTERCITY_YOUNGSTER_GO_TAKE_ON_BROCK");
  await g.move(PC_YOUNGSTER, "R5");
  g.place(PC_YOUNGSTER, 35, 16, "down");
}

// ---------------------------------------------------------------- Museum

defineMap("Museum1F", {
  async onStep(g) {
    // The ticket seller stops anyone passing the counter without a ticket.
    if (g.vars["script:Museum1F"] === 1) return;
    if (g.player.y === 4 && (g.player.x === 9 || g.player.x === 10)) await g.text("TEXT_MUSEUM1F_SCIENTIST1");
  },
  texts: {
    async Museum1FPrintScientist1Text(g) {
      const { x, y } = g.player;
      const behindCounter = (y === 4 && x === 13) || (y === 3 && x === 12);
      if (behindCounter) {
        await g.text("Museum1FPrintScientist1Text.DoYouKnowWhatAmberIsText");
        await g.text((await g.yesNo()) ? "Museum1FPrintScientist1Text.TheresALabSomewhereText" : "Museum1FPrintScientist1Text.AmberIsFossilizedTreeSapText");
        return;
      }
      const bought = g.ev("EVENT_BOUGHT_MUSEUM_TICKET");
      if (y !== 4 || bought) {
        await g.text(bought ? "Museum1FPrintScientist1Text.TakePlentyOfTimeText" : "Museum1FPrintScientist1Text.GoToOtherSideText");
        return;
      }
      await g.text("Museum1FPrintScientist1Text.WouldYouLikeToComeInText");
      if (!(await g.yesNo()) || g.money < 50) {
        if (g.money < 50) await g.text("Museum1FPrintScientist1Text.DontHaveEnoughMoneyText");
        await g.text("Museum1FPrintScientist1Text.ComeAgainText");
        await g.move("player", "D");
        return;
      }
      await g.text("Museum1FPrintScientist1Text.ThankYouText");
      g.set("EVENT_BOUGHT_MUSEUM_TICKET");
      g.money -= 50;
      g.sfx("SFX_PURCHASE");
      await g.delay(30);
      g.vars["script:Museum1F"] = 1;
    },
    async Museum1FPrintScientist2Text(g) {
      if (g.ev("EVENT_GOT_OLD_AMBER")) return g.text("Museum1FPrintScientist2Text.GetTheOldAmberCheckText");
      await g.text("Museum1FPrintScientist2Text.TakeThisToAPokemonLabText");
      if (!g.give("OLD_AMBER")) return g.text("Museum1FPrintScientist2Text.YouDontHaveSpaceText");
      g.set("EVENT_GOT_OLD_AMBER");
      g.hide("HS_OLD_AMBER");
      await g.text("Museum1FPrintScientist2Text.ReceivedOldAmberText");
    },
  },
});

defineMap("Museum2F", {
  generic: true,
  texts: {
    async Museum2FHikerText(g) {
      // The hiker comments on a Pikachu travelling with the player.
      if (!g.partyHas("PIKACHU")) return g.text("Museum2FText_5c20e");
      await g.text(g.save.pikachu.happiness >= 101 ? "Museum2FText_5c218" : "Museum2FText_5c213");
    },
  },
});

// ---------------------------------------------------------------- Pewter Gym

defineMap("PewterGym", {
  generic: true,
  texts: {
    async PewterGymBrockText(g) {
      if (!g.ev("EVENT_BEAT_BROCK")) {
        await g.text("PewterGymBrockText.PreBattleText");
        const won = await g.trainerBattle("BROCK", 1, { win: "PewterGymBrockReceivedBoulderBadgeText" });
        if (won) await receiveTM34(g);
        return;
      }
      if (!g.ev("EVENT_GOT_TM34")) return receiveTM34(g);
      await g.text("PewterGymBrockText.PostBattleAdviceText");
    },
    async PewterGymGuideText(g) {
      if (g.hasBadge(0)) return g.text("PewterGymGuidePostBattleText");
      await g.text("PewterGymGuidePreAdviceText");
      if (!(await g.yesNo())) {
        await g.text("PewterGymGuideFreeServiceText");
        return g.text("PewterGymGuideAdviceText");
      }
      if (g.partyHas("PIKACHU")) return g.text("PewterGymText_5c41c");
      await g.text("PewterGymGuideBeginAdviceText");
      await g.text("PewterGymGuideAdviceText");
    },
  },
});

async function receiveTM34(g: Game) {
  await g.text("TEXT_PEWTERGYM_BROCK_WAIT_TAKE_THIS");
  g.set("EVENT_BEAT_BROCK");
  if (g.give("TM_BIDE")) {
    await g.text("TEXT_PEWTERGYM_RECEIVED_TM34");
    g.set("EVENT_GOT_TM34");
  } else {
    await g.text("TEXT_PEWTERGYM_TM34_NO_ROOM");
  }
  g.badge(0);
  g.hide("HS_GYM_GUY");
  g.hide("HS_ROUTE_22_RIVAL_1");
  g.reset("EVENT_1ST_ROUTE22_RIVAL_BATTLE");
  g.reset("EVENT_ROUTE22_RIVAL_WANTS_BATTLE");
  g.set("EVENT_BEAT_PEWTER_GYM_TRAINER_0");
}

defineMap("PewterNidoranHouse", {
  generic: true,
  texts: {
    async PewterNidoranHouseNidoranText(g) {
      g.cry("NIDORAN_M");
      await g.delay(30);
    },
  },
});

defineMap("PewterMart", { generic: true });

const JIGGLYPUFF = 3;

defineMap("PewterPokecenter", {
  generic: true,
  texts: {
    async PewterJigglypuff(g) {
      await g.text("PewterJigglypuff.Text", { wait: false });
      await g.delay(32);
      // Jigglypuff sings and spins in place; Pikachu is put to sleep and stops following.
      g.music("MUSIC_JIGGLYPUFF_SONG");
      const turns = ["down", "left", "up", "right"] as const;
      for (let i = 0; i < 12; i++) {
        g.face(JIGGLYPUFF, turns[i % 4]);
        await g.delay(24);
      }
      await g.delay(48);
      g.music();
      if (g.partyHas("PIKACHU")) g.follower(false);
    },
  },
});
