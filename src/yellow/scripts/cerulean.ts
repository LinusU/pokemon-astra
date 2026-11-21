// Ported Yellow map scripts. See docs/YELLOW_PORTING.md.
// Mt. Moon, Cerulean City, Bill's House, Nugget Bridge, the Route 5-8 gates, the Day-Care.
import { DEX, MAP, MOVE } from "../generated/symbols";
import { defineMap, SHARED_TEXTS, type Game } from "../script";

// ---------------------------------------------------------------- Mt. Moon

const NERD = 1, JESSIE = 2, JAMES = 6, DOME = 7, HELIX = 8;
/** MtMoonB2F script state: the Super Nerd is waiting to take the other fossil. */
const NERD_WAITING = 1;

defineMap("MtMoonB1F", { generic: true });

defineMap("MtMoonPokecenter", {
  generic: true,
  texts: {
    async MagikarpSalesman(g) {
      if (g.ev("EVENT_BOUGHT_MAGIKARP")) return g.text("MagikarpSalesman.NoRefundsText");
      await g.text("MagikarpSalesman.IGotADealText", { wait: false });
      if (!(await g.yesNo())) return g.text("MagikarpSalesman.NoText");
      if (g.money < 500) return g.text("MagikarpSalesman.NoMoneyText");
      await g.giveMon("MAGIKARP", 5);
      g.money -= 500;
      g.set("EVENT_BOUGHT_MAGIKARP");
    },
  },
});

defineMap("MtMoonB2F", {
  async onStep(g) {
    const { x, y } = g.player;
    // The Super Nerd takes whichever fossil the player left.
    if (g.state === NERD_WAITING) await nerdTakesOtherFossil(g);
    // Standing at the fossils, the Super Nerd challenges the player first.
    const gotFossil = g.ev("EVENT_GOT_DOME_FOSSIL") || g.ev("EVENT_GOT_HELIX_FOSSIL");
    if (!gotFossil && !g.ev("EVENT_BEAT_MT_MOON_EXIT_SUPER_NERD") && x === 13 && y === 8) {
      g.face("player", "left");
      await superNerd(g);
    }
    if (!g.ev("EVENT_BEAT_MT_MOON_3_JESSIE_JAMES") && x === 3 && y === 5) await jessieAndJames(g);
    // API REQUEST: the original sets BIT_NO_BATTLES while the player stands in the fossil area
    // (x 11-14, y 5-8) after beating the Super Nerd. There is no API to suppress wild battles.
  },
  texts: {
    MtMoonB2FSuperNerdText: superNerd,
    async MtMoonB2FDomeFossilText(g) {
      await takeFossil(g, "DOME_FOSSIL", "MtMoonB2FDomeFossilText.YouWantText", "EVENT_GOT_DOME_FOSSIL", "HS_MT_MOON_B2F_FOSSIL_1");
    },
    async MtMoonB2FHelixFossilText(g) {
      await takeFossil(g, "HELIX_FOSSIL", "MtMoonB2FHelixFossilText.YouWantText", "EVENT_GOT_HELIX_FOSSIL", "HS_MT_MOON_B2F_FOSSIL_2");
    },
    // Printed text runs first; these are the trailing pauses.
    async MtMoonB2FText12(g) {
      await g.delay(10);
      g.face("player", "up");
      await g.emote("player", "exclamation");
      await g.delay(20);
    },
    async MtMoonB2FText14(g) {
      await g.delay(64);
    },
  },
});

async function superNerd(g: Game) {
  if (g.ev("EVENT_BEAT_MT_MOON_EXIT_SUPER_NERD")) {
    if (g.ev("EVENT_GOT_DOME_FOSSIL") || g.ev("EVENT_GOT_HELIX_FOSSIL")) return g.text("MtMoonB2FSuperNerdTheresAPokemonLabText");
    return g.text("MtMoonB2fSuperNerdEachTakeOneText");
  }
  await g.text("MtMoonB2FSuperNerdTheyreBothMineText");
  const won = await g.trainerBattle("SUPER_NERD", 2, { win: "MtMoonB2FSuperNerdOkIllShareText", lose: "MtMoonB2FSuperNerdOkIllShareText" });
  if (won) g.set("EVENT_BEAT_MT_MOON_EXIT_SUPER_NERD");
}

async function takeFossil(g: Game, item: string, ask: string, event: string, hs: string) {
  await g.text(ask, { wait: false });
  if (!(await g.yesNo())) return;
  if (!g.give(item)) return g.text("MtMoonB2FYouHaveNoRoomText.Text");
  await g.text("MtMoonB2FReceivedFossilText.Text");
  g.hide(hs);
  g.set(event);
  g.state = NERD_WAITING;
  await nerdTakesOtherFossil(g);
}

/** The Super Nerd walks to the fossil that was left, once the player stands somewhere he can pass. */
async function nerdTakesOtherFossil(g: Game) {
  const key = `${g.player.x},${g.player.y}`;
  const aroundDome = ["12,7", "11,6", "12,5"];
  const aroundHelix = ["13,7", "14,6", "14,5"];
  if (aroundDome.includes(key)) await g.move(NERD, "RU", { ignoreCollision: true });
  else if (aroundHelix.includes(key)) await g.move(NERD, "U", { ignoreCollision: true });
  else return; // keeps waiting until the player steps onto one of those squares
  g.state = 0;
  await g.text("MtMoonB2FSuperNerdThenThisIsMineText", { wait: false });
  g.hide(g.ev("EVENT_GOT_HELIX_FOSSIL") ? "HS_MT_MOON_B2F_FOSSIL_1" : "HS_MT_MOON_B2F_FOSSIL_2");
}

async function jessieAndJames(g: Game) {
  g.music("MUSIC_MEET_JESSIE_JAMES");
  g.show("HS_MT_MOON_B2F_JESSIE");
  g.show("HS_MT_MOON_B2F_JAMES");
  await g.delay(3);
  await g.text("MtMoonB2FText12", { wait: false });
  await g.move("player", "U");
  await g.delay(3);
  await g.move(JESSIE, "L6", { ignoreCollision: true });
  g.face(JESSIE, "down");
  await g.move(JAMES, "L5", { ignoreCollision: true });
  g.face(JAMES, "left");
  await g.delay(3);
  await g.text("MtMoonB2FText13");
  g.set("EVENT_57E");
  const won = await g.trainerBattle("ROCKET", 0x2a, { win: "MtMoonB2FJessieJamesEndBattleText", lose: "MtMoonB2FJessieJamesEndBattleText" });
  if (!won) {
    g.reset("EVENT_57E");
    g.hide("HS_MT_MOON_B2F_JESSIE");
    g.hide("HS_MT_MOON_B2F_JAMES");
    return;
  }
  g.face(JESSIE, "down");
  g.face(JAMES, "down");
  await g.text("MtMoonB2FText14", { wait: false });
  g.music("MUSIC_MEET_JESSIE_JAMES");
  await g.fade(() => {
    g.hide("HS_MT_MOON_B2F_JESSIE");
    g.hide("HS_MT_MOON_B2F_JAMES");
  });
  g.music();
  g.set("EVENT_BEAT_MT_MOON_3_JESSIE_JAMES");
  g.reset("EVENT_57E");
}

// ---------------------------------------------------------------- Cerulean City

const RIVAL = 1, ROCKET = 2;

defineMap("CeruleanCity", {
  async onStep(g) {
    const { x, y } = g.player;
    // The Rocket who stole the TM stands in the way on the north-east side of the houses.
    if (!g.ev("EVENT_BEAT_CERULEAN_ROCKET_THIEF") && x === 30 && (y === 7 || y === 9)) {
      const above = y === 7;
      g.face("player", above ? "down" : "up");
      g.face(ROCKET, above ? "up" : "down");
      await g.delay(3);
      await g.text("TEXT_CERULEANCITY_ROCKET");
      return;
    }
    if (!g.ev("EVENT_BEAT_CERULEAN_RIVAL") && y === 6 && (x === 20 || x === 21)) await rivalEncounter(g);
  },
  texts: {
    async CeruleanCityRivalText(g) {
      if (g.ev("EVENT_BEAT_CERULEAN_RIVAL")) return g.text("CeruleanCityRivalIWentToBillsText");
      await g.text("CeruleanCityRivalText.PreBattleText");
    },
    async CeruleanCityRocketText(g) {
      if (!g.ev("EVENT_BEAT_CERULEAN_ROCKET_THIEF")) {
        await g.text("CeruleanCityRocketText.Text");
        const won = await g.trainerBattle("ROCKET", 5, { win: "CeruleanCityRocketText.IGiveUpText", lose: "CeruleanCityRocketText.IGiveUpText" });
        if (!won) return;
        g.set("EVENT_BEAT_CERULEAN_ROCKET_THIEF");
      }
      await g.text("CeruleanCityRocketText.IllReturnTheTMText");
      if (!g.give("TM_DIG")) return g.text("CeruleanCityRocketText.TM28NoRoomText");
      await g.text("CeruleanCityRocketText.ReceivedTM28Text", { wait: false });
      await g.fade(() => {
        g.show("HS_CERULEAN_GUARD_1");
        g.hide("HS_CERULEAN_GUARD_2");
        g.hide("HS_CERULEAN_ROCKET");
      });
    },
    async CeruleanCityCooltrainerF1Text(g) {
      const roll = Math.floor(Math.random() * 256);
      if (roll >= 180) await g.text("CeruleanCityCooltrainerF1Text.ElectrodeUseSonicboomText");
      else if (roll >= 100) await g.text("CeruleanCityCooltrainerF1Text.ElectrodePunchText");
      else await g.text("CeruleanCityCooltrainerF1Text.ElectrodeWithdrawText");
    },
    async CeruleanCityElectrodeText(g) {
      const roll = Math.floor(Math.random() * 256);
      if (roll >= 180) await g.text("CeruleanCityElectrodeText.TookASnoozeText");
      else if (roll >= 120) await g.text("CeruleanCityElectrodeText.IsLoafingAroundText");
      else if (roll >= 60) await g.text("CeruleanCityElectrodeText.TurnedAwayText");
      else await g.text("CeruleanCityElectrodeText.IgnoredOrdersText");
    },
  },
});

/** The rival waits on the bridge and battles the player, once. */
async function rivalEncounter(g: Game) {
  const right = g.player.x === 20; // standing on the bridge's left lane means the rival drops in directly above
  g.music("MUSIC_MEET_RIVAL");
  g.show("HS_CERULEAN_RIVAL");
  g.place(RIVAL, right ? 20 : 21, 2, "down");
  await g.move(RIVAL, "D3");
  g.face(RIVAL, "down");
  await g.text("TEXT_CERULEANCITY_RIVAL");
  const won = await g.trainerBattle("RIVAL1", 3, { win: "CeruleanCityRivalDefeatedText", lose: "CeruleanCityRivalVictoryText" });
  if (!won) {
    g.hide("HS_CERULEAN_RIVAL");
    return;
  }
  g.face(RIVAL, "down");
  g.set("EVENT_BEAT_CERULEAN_RIVAL");
  await g.text("TEXT_CERULEANCITY_RIVAL");
  g.music("MUSIC_MEET_RIVAL");
  await g.move(RIVAL, right ? "RD6" : "LD6", { ignoreCollision: true });
  g.hide("HS_CERULEAN_RIVAL");
  g.music();
}

defineMap("CeruleanTrashedHouse", {
  generic: true,
  texts: {
    async CeruleanTrashedHouseFishingGuruText(g) {
      await g.text(g.hasItem("TM_DIG")
        ? "CeruleanTrashedHouseFishingGuruText.WhatsLostIsLostText"
        : "CeruleanTrashedHouseFishingGuruText.TheyStoleATMText");
    },
  },
});

defineMap("CeruleanMelaniesHouse", {
  generic: true,
  texts: {
    async CeruleanMelanieHouseMelanieText(g) {
      if (g.ev("EVENT_GOT_BULBASAUR_IN_CERULEAN")) return g.text("CeruleanHouse1Text_1cfd9", { wait: false });
      await g.text("CeruleanHouse1Text_1cfc8", { wait: false });
      const pikachu = g.save.party.find(m => m.species === 25);
      const happiness = pikachu ? pikachu.happiness : g.save.pikachu.happiness;
      if (happiness < 147) return;
      await g.text("CeruleanHouse1Text_1cfce", { wait: false });
      if (!(await g.yesNo())) return g.text("CeruleanHouse1Text_1cfdf", { wait: false });
      await g.giveMon("BULBASAUR", 10);
      await g.text("CeruleanHouse1Text_1cfd3", { wait: false });
      g.hide("HS_CERULEAN_BULBASAUR");
      g.set("EVENT_GOT_BULBASAUR_IN_CERULEAN");
    },
    async CeruleanMelanieHouseBulbasaurText(g) { g.cry("BULBASAUR"); },
    async CeruleanMelanieHouseOddishText(g) { g.cry("ODDISH"); },
    async CeruleanMelanieHouseSandshrewText(g) { g.cry("SANDSHREW"); },
  },
});

defineMap("CeruleanPokecenter", { generic: true });

defineMap("CeruleanGym", {
  generic: true, // Misty's battle and rewards happen in her text handler.
  texts: {
    async CeruleanGymMistyText(g) {
      if (g.ev("EVENT_BEAT_MISTY")) {
        if (g.ev("EVENT_GOT_TM11")) return g.text("CeruleanGymMistyText.TM11ExplanationText");
        return mistyRewards(g);
      }
      await g.text("CeruleanGymMistyText.PreBattleText");
      const won = await g.trainerBattle("MISTY", 1, {
        win: "CeruleanGymMistyReceivedCascadeBadgeText", lose: "CeruleanGymMistyReceivedCascadeBadgeText",
      });
      if (won) await mistyRewards(g);
    },
    async CeruleanGymGymGuideText(g) {
      await g.text(g.ev("EVENT_BEAT_MISTY") ? "CeruleanGymGymGuideText.BeatMistyText" : "CeruleanGymGymGuideText.ChampInMakingText");
    },
  },
});

async function mistyRewards(g: Game) {
  await g.text("TEXT_CERULEANGYM_MISTY_CASCADE_BADGE_INFO");
  g.set("EVENT_BEAT_MISTY");
  if (g.give("TM_BUBBLEBEAM")) {
    await g.text("TEXT_CERULEANGYM_MISTY_RECEIVED_TM11");
    g.set("EVENT_GOT_TM11");
  } else {
    await g.text("TEXT_CERULEANGYM_MISTY_TM11_NO_ROOM");
  }
  g.badge(1);
  g.set("EVENT_BEAT_CERULEAN_GYM_TRAINER_0");
  g.set("EVENT_BEAT_CERULEAN_GYM_TRAINER_1");
}

defineMap("BikeShop", {
  generic: true,
  texts: {
    async BikeShopClerkText(g) {
      if (g.ev("EVENT_GOT_BICYCLE")) return g.text("BikeShopClerkHowDoYouLikeYourBicycleText");
      if (g.hasItem("BIKE_VOUCHER")) {
        await g.text("BikeShopClerkOhThatsAVoucherText");
        if (!g.give("BICYCLE")) return g.text("BikeShopBagFullText");
        g.take("BIKE_VOUCHER");
        g.set("EVENT_GOT_BICYCLE");
        return g.text("BikeShopExchangedVoucherText");
      }
      await g.text("BikeShopClerkWelcomeText");
      await g.text("BikeShopClerkDoYouLikeItText", { wait: false });
      const pick = await g.choose("Bicycle", ["BICYCLE  ¥1000000", "CANCEL"]);
      if (pick === 0) await g.text("BikeShopCantAffordText");
      await g.text("BikeShopComeAgainText");
    },
    async BikeShopYoungsterText(g) {
      await g.text(g.ev("EVENT_GOT_BICYCLE") ? "BikeShopYoungsterText.CoolBikeText" : "BikeShopYoungsterText.TheseBikesAreExpensiveText");
    },
  },
});

const BADGES = ["BOULDER", "CASCADE", "THUNDER", "RAINBOW", "SOUL", "MARSH", "VOLCANO", "EARTH"];
const BADGE_TEXTS = [
  "CeruleanBadgeHouseBoulderBadgeText", "CeruleanBadgeHouseCascadeBadgeText", "CeruleanBadgeHouseThunderBadgeText",
  "CeruleanBadgeHouseRainbowBadgeText", "CeruleanBadgeHouseSoulBadgeText", "CeruleanBadgeHouseMarshBadgeText",
  "CeruleanBadgeHouseVolcanoBadgeText", "CeruleanBadgeHouseEarthBadgeText",
];

defineMap("CeruleanBadgeHouse", {
  generic: true,
  texts: {
    async CeruleanBadgeHouseMiddleAgedManText(g) {
      await g.text("CeruleanBadgeHouseMiddleAgedManText.Text");
      for (;;) {
        await g.text("CeruleanBadgeHouseMiddleAgedManText.WhichBadgeText", { wait: false });
        const pick = await g.choose("Badges", BADGES.map(b => `${b}BADGE`));
        if (pick === undefined) break;
        await g.text(BADGE_TEXTS[pick]);
      }
      await g.text("CeruleanBadgeHouseMiddleAgedManText.VisitAnyTimeText");
    },
  },
});

// ---------------------------------------------------------------- Routes 24 and 25

defineMap("Route24", {
  async onStep(g) {
    // The Rocket at the end of Nugget Bridge speaks to the player on the bridge's last square.
    if (g.ev("EVENT_GOT_NUGGET") || g.player.x !== 10 || g.player.y !== 15) return;
    await g.text("TEXT_ROUTE24_COOLTRAINER_M1");
    // Without room for the Nugget the player is sent back to make room.
    if (g.ev("EVENT_NUGGET_REWARD_AVAILABLE")) {
      g.reset("EVENT_NUGGET_REWARD_AVAILABLE");
      await g.move("player", "D");
    }
  },
  texts: {
    async Route24CooltrainerM1Text(g) {
      g.reset("EVENT_NUGGET_REWARD_AVAILABLE");
      if (g.ev("EVENT_GOT_NUGGET")) return g.text("Route24CooltrainerM1Text.YouCouldBecomeATopLeaderText");
      await g.text("Route24CooltrainerM1Text.YouBeatOurContestText");
      if (!g.give("NUGGET")) {
        await g.text("Route24CooltrainerM1Text.NoRoomText");
        g.set("EVENT_NUGGET_REWARD_AVAILABLE");
        return;
      }
      g.set("EVENT_GOT_NUGGET");
      await g.text("Route24CooltrainerM1Text.ReceivedNuggetText");
      await g.text("Route24CooltrainerM1Text.JoinTeamRocketText");
      const won = await g.trainerBattle("ROCKET", 6, { win: "Route24CooltrainerM1Text.DefeatedText", lose: "Route24CooltrainerM1Text.DefeatedText" });
      if (!won) return;
      g.set("EVENT_BEAT_ROUTE24_ROCKET");
      await g.text("Route24CooltrainerM1Text.YouCouldBecomeATopLeaderText");
    },
    async Route24CooltrainerM4Text(g) {
      if (g.ev("EVENT_54F")) return g.text("Route24Text_515ee");
      await g.text("Route24Text_515de");
      if (!(await g.yesNo())) return g.text("Route24Text_515e9");
      await g.giveMon("CHARMANDER", 10);
      await g.text("Route24Text_515e3", { wait: false });
      g.set("EVENT_54F");
    },
  },
});

defineMap("Route25", {
  // Bill is either still a Pokémon, gone, or waiting at home, depending on the cell separator errand.
  onEnter(g) {
    if (g.ev("EVENT_LEFT_BILLS_HOUSE_AFTER_HELPING")) return;
    if (!g.ev("EVENT_MET_BILL_2")) {
      g.reset("EVENT_BILL_SAID_USE_CELL_SEPARATOR");
      g.show("HS_BILL_POKEMON");
    } else if (g.ev("EVENT_GOT_SS_TICKET")) {
      g.set("EVENT_LEFT_BILLS_HOUSE_AFTER_HELPING");
      g.hide("HS_NUGGET_BRIDGE_GUY");
      g.hide("HS_BILL_1");
      g.show("HS_BILL_2");
    }
  },
  generic: true,
});

// ---------------------------------------------------------------- Bill's House

const BILL_POKEMON = 1, BILL = 2;

// The PC here runs Bill's cell separator instead of opening the Pokémon Storage System.
SHARED_TEXTS["hidden:BillsHousePC"] = async g => {
  if (g.player.facing !== "up") return;
  if (g.ev("EVENT_LEFT_BILLS_HOUSE_AFTER_HELPING")) return billsPokemonList(g);
  if (g.ev("EVENT_USED_CELL_SEPARATOR_ON_BILL") || !g.ev("EVENT_BILL_SAID_USE_CELL_SEPARATOR")) return g.text("BillsHouseMonitorText");
  await g.text("BillsHouseInitiatedText", { wait: false });
  await g.delay(32);
  g.sfx("SFX_TINK");
  await g.delay(80);
  g.sfx("SFX_SHRINK");
  await g.delay(48);
  g.sfx("SFX_TINK");
  await g.delay(32);
  g.sfx("SFX_GET_ITEM_1");
  await g.delay(30);
  g.music();
  g.set("EVENT_USED_CELL_SEPARATOR_ON_BILL");
};

async function billsPokemonList(g: Game) {
  const list = ["EEVEE", "FLAREON", "JOLTEON", "VAPOREON"];
  await g.text("BillsHousePokemonListText1", { wait: false });
  for (;;) {
    await g.text("BillsHousePokemonListText2", { wait: false });
    const pick = await g.choose("Pokémon", [...list, "CANCEL"]);
    if (pick === undefined || pick >= list.length) return;
    await g.showDex(list[pick]);
  }
}

defineMap("BillsHouse", {
  async onStep(g) {
    // After the cell separator is run, Bill steps out of the machine and hands over the ticket.
    if (g.ev("EVENT_MET_BILL_2") || !g.ev("EVENT_BILL_SAID_USE_CELL_SEPARATOR") || !g.ev("EVENT_USED_CELL_SEPARATOR_ON_BILL")) return;
    g.place(BILL, 1, 2, "down");
    g.show("HS_BILL_1");
    await g.delay(8);
    await g.move(BILL, "DR3D", { ignoreCollision: true });
    g.set("EVENT_MET_BILL_2");
    g.set("EVENT_MET_BILL");
    g.face("player", "up");
    await g.move("player", "R3", { ignoreCollision: true });
    g.face("player", "up");
    g.face(BILL, "down");
    await g.delay(3);
    await g.text("TEXT_BILLSHOUSE_BILL_SS_TICKET");
  },
  texts: {
    async BillsHousePrintBillPokemonText(g) {
      await g.text("BillsHousePrintBillPokemonText.ImNotAPokemonText");
      if (!(await g.yesNo())) await g.text("BillsHousePrintBillPokemonText.NoYouGottaHelpText");
      await g.text("BillsHousePrintBillPokemonText.UseSeparationSystemText");
      // He goes into the machine; if the player blocks the way he walks around.
      await g.move(BILL_POKEMON, g.player.facing === "down" ? "RU2LU" : "U3", { ignoreCollision: true });
      g.hide("HS_BILL_POKEMON");
      g.set("EVENT_BILL_SAID_USE_CELL_SEPARATOR");
    },
    async BillsHousePrintBillSSTicketText(g) {
      if (!g.ev("EVENT_GOT_SS_TICKET")) {
        await g.text("BillsHousePrintBillSSTicketText.ThankYouText");
        if (!g.give("S_S_TICKET")) return g.text("BillsHousePrintBillSSTicketText.SSTicketNoRoomText");
        await g.text("BillsHousePrintBillSSTicketText.SSTicketReceivedText");
        g.set("EVENT_GOT_SS_TICKET");
        g.show("HS_CERULEAN_GUARD_1");
        g.hide("HS_CERULEAN_GUARD_2");
      }
      await g.text("BillsHousePrintBillSSTicketText.WhyDontYouGoInsteadOfMeText");
    },
    // Text shown by the cell separator: music stops, the machine switches on.
    async BillsHouseInitiatedText(g) {
      g.sfx("SFX_STOP_ALL_MUSIC");
      await g.delay(16);
      g.sfx("SFX_SWITCH");
      await g.delay(60);
    },
  },
});

// ---------------------------------------------------------------- Routes 5-8: gates and the underground path

/** BIT_GAVE_SAFFRON_GUARDS_DRINK (shared by all four gates and Saffron City). */
const GAVE_DRINK = "gaveSaffronGuardsDrink";

/** Takes the first of the guards' drinks the player carries. */
function removeGuardDrink(g: Game) {
  for (const drink of ["FRESH_WATER", "SODA_POP", "LEMONADE"]) if (g.take(drink)) return true;
  return false;
}

/** Walking into the gate's guard square without a drink sends the player back a step. */
async function thirstyGuardStep(g: Game, squares: [number, number][], face: "up" | "down" | "left" | "right", back: string, gate: string) {
  if (g.vars[GAVE_DRINK]) return;
  if (!squares.some(([x, y]) => g.player.x === x && g.player.y === y)) return;
  g.face("player", face);
  if (removeGuardDrink(g)) {
    g.vars[GAVE_DRINK] = 1;
    await g.text(`TEXT_${gate}_GUARD_GIVE_DRINK`);
    return;
  }
  await g.text(`TEXT_${gate}_GUARD_GEE_IM_THIRSTY`);
  await g.move("player", back);
}

/** Talking to the guard. */
function guardTalk(back: string) {
  return async (g: Game) => {
    if (g.vars[GAVE_DRINK]) return g.text("SaffronGateGuardThanksForTheDrinkText");
    if (removeGuardDrink(g)) {
      g.vars[GAVE_DRINK] = 1;
      return g.text("SaffronGateGuardGiveDrinkText");
    }
    await g.text("SaffronGateGuardGeeImThirstyText");
    await g.move("player", back);
  };
}

defineMap("Route5Gate", {
  async onStep(g) {
    await thirstyGuardStep(g, [[3, 3], [4, 3]], "left", "U", "ROUTE5GATE");
  },
  texts: { SaffronGateGuardText: guardTalk("U") },
});
defineMap("Route6Gate", {
  async onStep(g) {
    await thirstyGuardStep(g, [[3, 2], [4, 2]], "right", "D", "ROUTE6GATE");
  },
  texts: { SaffronGateGuardText: guardTalk("D") },
});
defineMap("Route7Gate", {
  async onStep(g) {
    await thirstyGuardStep(g, [[3, 3], [3, 4]], "up", "L", "ROUTE7GATE");
  },
  texts: { SaffronGateGuardText: guardTalk("L") },
});
defineMap("Route8Gate", {
  async onStep(g) {
    await thirstyGuardStep(g, [[2, 3], [2, 4]], "up", "R", "ROUTE8GATE");
  },
  texts: { SaffronGateGuardText: guardTalk("R") },
});

// Leaving through the exit warp of an underground path always returns to its own route.
const underground = (route: string) => ({ onEnter(g: Game) { g.save.lastMap = MAP[route]; } });
defineMap("UndergroundPathRoute5", {
  ...underground("ROUTE_5"),
  texts: {
    async UndergroundPathRoute5LittleGirlText(g) {
      await g.trade(9); // TRADE_FOR_RICKY
    },
  },
});
defineMap("UndergroundPathRoute6", underground("ROUTE_6"));
defineMap("UndergroundPathRoute7", underground("ROUTE_7"));
defineMap("UndergroundPathRoute7Copy", underground("ROUTE_7"));
defineMap("UndergroundPathRoute8", underground("ROUTE_8"));

// ---------------------------------------------------------------- Day-Care

const HM_MOVES = [MOVE.CUT, MOVE.FLY, MOVE.SURF, MOVE.STRENGTH, MOVE.FLASH];

/** The species constant for a Pokédex number, with the printed name for text. */
function speciesName(dex: number) {
  const key = Object.keys(DEX).find(k => DEX[k] === dex)?.replace(/^DEX_/, "") ?? "";
  const printed: Record<string, string> = { NIDORAN_M: "NIDORAN♂", NIDORAN_F: "NIDORAN♀", MR_MIME: "MR.MIME", FARFETCH_D: "FARFETCH'D" };
  return { key, printed: printed[key] ?? key };
}
const monName = (mon: { nickname: string; species: number }) => mon.nickname || speciesName(mon.species).printed;

/** Levels the Pokémon grows from one experience point per step walked (Gen 1 Day-Care). */
function levelsGrown(level: number, steps: number) {
  let exp = steps, now = level;
  while (now < 100) {
    const need = (now + 1) ** 3 - now ** 3;
    if (exp < need) break;
    exp -= need;
    now++;
  }
  return now - level;
}

defineMap("Daycare", {
  generic: true,
  texts: {
    async DaycareGentlemanText(g) {
      const kept = g.save.daycare;
      if (!kept) return depositMon(g);
      await collectMon(g, kept);
    },
  },
});

async function depositMon(g: Game) {
  await g.text("DaycareGentlemanText.IntroText");
  if (!(await g.yesNo())) return g.text("DaycareGentlemanText.ComeAgainText");
  if (g.save.party.length <= 1) return g.text("DaycareGentlemanText.OnlyHaveOneMonText");
  await g.text("DaycareGentlemanText.WhichMonText");
  const slot = await g.choosePartyMon("Which Pokémon?");
  if (slot === undefined) return g.text("DaycareGentlemanText.AllRightThenText");
  const mon = g.save.party[slot];
  if (mon.moves.some(m => HM_MOVES.includes(m))) return g.text("DaycareGentlemanText.CantAcceptMonWithHMText");
  g.textVar("wNameBuffer", monName(mon));
  await g.text("DaycareGentlemanText.WillLookAfterMonText");
  g.save.party.splice(slot, 1);
  g.save.daycare = { mon, steps: g.save.steps };
  if (mon.species === 25) g.follower(false);
  g.cry(speciesName(mon.species).key);
  await g.text("DaycareGentlemanText.ComeSeeMeInAWhileText");
}

async function collectMon(g: Game, kept: { mon: import("../../engine").Pokemon; steps: number }) {
  const { mon } = kept;
  const gained = Math.max(0, g.save.steps - kept.steps);
  const grown = levelsGrown(mon.level, gained);
  g.textVar("wNameBuffer", monName(mon));
  g.textVar("wDayCareMonName", monName(mon));
  if (grown === 0) await g.text("DaycareGentlemanText.MonNeedsMoreTimeText");
  else {
    g.textVar("wDayCareNumLevelsGrown", grown);
    await g.text("DaycareGentlemanText.MonHasGrownText");
  }
  if (g.save.party.length >= 6) return g.text("DaycareGentlemanText.NoRoomForMonText");
  const cost = 100 * (grown + 1);
  g.textVar("wDayCareTotalCost", cost);
  await g.text("DaycareGentlemanText.OweMoneyText", { wait: false });
  if (!(await g.yesNo())) return g.text("DaycareGentlemanText.AllRightThenText");
  if (g.money < cost) return g.text("DaycareGentlemanText.NotEnoughMoneyText");
  g.money -= cost;
  g.sfx("SFX_PURCHASE");
  await g.text("DaycareGentlemanText.HeresYourMonText");
  // API REQUEST: Game has no way to level a Pokémon up (recalculate stats, learn moves).
  // Workaround: raise the level and experience and restore HP without recomputing other stats.
  mon.level += grown;
  mon.exp += gained;
  mon.hp = mon.stats[0];
  g.save.party.push(mon);
  g.save.daycare = undefined;
  if (mon.species === 25) g.follower(true);
  g.cry(speciesName(mon.species).key);
  await g.text("DaycareGentlemanText.GotMonBackText");
}
