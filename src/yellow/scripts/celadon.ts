// Celadon City, its Mart, Mansion, Game Corner and Gym, the Rocket Hideout, and Routes 16 to 18.
import { defineMap, type Game } from "../script";

const cry = (species: string) => async (g: Game) => g.cry(species);
const haveCoinCase = (g: Game) => g.hasItem("COIN_CASE");

// ---------------------------------------------------------------- Celadon City

defineMap("CeladonCity", {
  // The Saffron guard drink flags are cleared whenever the player is back in town.
  onEnter(g) {
    g.reset("EVENT_1B8");
    g.reset("EVENT_1BF");
    g.reset("EVENT_67F");
  },
  texts: {
    async CeladonCityGramps3Text(g) {
      if (g.ev("EVENT_GOT_TM41")) return g.text("CeladonCityGramps3Text.TM41ExplanationText");
      await g.text("CeladonCityGramps3Text.Text");
      if (!g.give("TM_SOFTBOILED")) return g.text("CeladonCityGramps3Text.TM41NoRoomText");
      await g.text("CeladonCityGramps3Text.ReceivedTM41Text");
      g.set("EVENT_GOT_TM41");
    },
    CeladonCityPoliwrathText: cry("POLIWRATH"),
  },
});

// ---------------------------------------------------------------- Celadon Mart

/** Where each Mart floor's elevator door leads back to: map and 0-based warp. */
const MART_FLOORS = [
  { floor: "1F", map: "CELADON_MART_1F", warp: 5 },
  { floor: "2F", map: "CELADON_MART_2F", warp: 2 },
  { floor: "3F", map: "CELADON_MART_3F", warp: 2 },
  { floor: "4F", map: "CELADON_MART_4F", warp: 2 },
  { floor: "5F", map: "CELADON_MART_5F", warp: 2 },
];
// Elevator exits default to the floor the player came from; remember it on entering each floor.
const martFloor = (floor: number) => ({ onEnter(g: Game) { g.vars.martFloor = floor; } });
defineMap("CeladonMart1F", martFloor(1));
defineMap("CeladonMart2F", martFloor(2));
defineMap("CeladonMart4F", martFloor(4));
defineMap("CeladonMart5F", martFloor(5));
defineMap("CeladonMart3F", {
  ...martFloor(3),
  texts: {
    async CeladonMart3FClerkText(g) {
      if (g.ev("EVENT_GOT_TM18")) return g.text("CeladonMart3FPrintClerkText.TM18ExplanationText");
      await g.text("CeladonMart3FPrintClerkText.TM18PreReceiveText");
      if (!g.give("TM_COUNTER")) return g.text("CeladonMart3FPrintClerkText.TM18NoRoomText");
      g.set("EVENT_GOT_TM18");
      await g.text("CeladonMart3FPrintClerkText.ReceivedTM18Text");
    },
  },
});

/** The elevator's shaking while it travels. */
async function shakeElevator(g: Game) {
  await g.delay(10);
  for (let i = 0; i < 12; i++) {
    g.sfx("SFX_COLLISION");
    await g.delay(8);
  }
}

defineMap("CeladonMartElevator", {
  onEnter(g) {
    const from = MART_FLOORS[(g.vars.martFloor || 1) - 1];
    g.setWarp(0, from.map, from.warp);
    g.setWarp(1, from.map, from.warp);
  },
  texts: {
    async CeladonMartElevatorText(g) {
      await g.text("WhichFloorText", { wait: false });
      const pick = await g.choose("Floor", MART_FLOORS.map(f => f.floor));
      if (pick === undefined) return;
      const to = MART_FLOORS[pick];
      g.setWarp(0, to.map, to.warp);
      g.setWarp(1, to.map, to.warp);
      await shakeElevator(g);
    },
  },
});

const DRINKS = [
  { item: "FRESH_WATER", event: "EVENT_GOT_TM13", tm: "TM_ICE_BEAM", yay: "CeladonMartRoofLittleGirlYayFreshWaterText", got: "CeladonMartRoofLittleGirlReceivedTM13Text" },
  { item: "SODA_POP", event: "EVENT_GOT_TM48", tm: "TM_ROCK_SLIDE", yay: "CeladonMartRoofLittleGirlYaySodaPopText", got: "CeladonMartRoofLittleGirlReceivedTM48Text" },
  { item: "LEMONADE", event: "EVENT_GOT_TM49", tm: "TM_TRI_ATTACK", yay: "CeladonMartRoofLittleGirlYayLemonadeText", got: "CeladonMartRoofLittleGirlReceivedTM49Text" },
];
defineMap("CeladonMartRoof", {
  generic: true,
  texts: {
    // The thirsty little girl trades a TM for a vending machine drink.
    async CeladonMartRoofLittleGirlText(g) {
      const owned = DRINKS.filter(d => g.hasItem(d.item));
      if (!owned.length) return g.text("CeladonMartRoofLittleGirlText.ImThirstyText");
      await g.text("CeladonMartRoofLittleGirlText.GiveHerADrinkText", { wait: false });
      if (!(await g.yesNo())) return;
      await g.text("CeladonMartRoofLittleGirlGiveHerWhichDrinkText", { wait: false });
      const pick = await g.choose("Drink", owned.map(d => d.item.replace("_", " ")));
      if (pick === undefined) return;
      const drink = owned[pick];
      if (g.ev(drink.event)) return g.text("CeladonMartRoofLittleGirlImNotThirstyText");
      await g.text(drink.yay);
      g.take(drink.item);
      if (!g.give(drink.tm)) return g.text("CeladonMartRoofLittleGirlNoRoomText");
      await g.text(drink.got);
      g.set(drink.event);
    },
  },
});

// ---------------------------------------------------------------- Celadon Mansion

/** The starter Pikachu, if it is in the party. */
const starterPikachu = (g: Game) => g.save.party.find(m => m.species === 25 && m.ot_id === g.vars.otId);

defineMap("CeladonMansion1F", {
  generic: true,
  texts: {
    CeladonMansion1FMeowthText: cry("MEOWTH"),
    CeladonMansion1FClefairyText: cry("CLEFAIRY"),
    CeladonMansion1FNidoranFText: cry("NIDORAN_F"),
    // The granny tells how Pikachu feels about the player.
    async CeladonMansion1FGrannyText(g) {
      await g.text("CeladonMansion1Text_f1e96", { wait: false });
      const pikachu = starterPikachu(g);
      if (!pikachu) return;
      await g.text("CeladonMansionText_f1e9c", { wait: false });
      const h = pikachu.happiness;
      const feeling = h < 51 ? "f1ed5" : h < 101 ? "f1eda" : h < 131 ? "f1edf" : h < 161 ? "f1ee4" : h < 201 ? "f1ee9" : "f1eee";
      await g.text(`CeladonMansion1Text_${feeling}`);
      if (h >= 251) {
        await g.delay(50);
        g.cry("PIKACHU");
      }
    },
  },
});

/** The Pokédex is complete when all but Mew are owned. */
const dexComplete = (g: Game) => g.save.caught.filter(n => n <= 151).length >= 150;

defineMap("CeladonMansion3F", {
  generic: true,
  texts: {
    async CeladonMansion3FProgrammerText(g) {
      await g.text(dexComplete(g) ? "CeladonMansion3Text_486f5" : "CeladonMansion3Text_486f0");
    },
    async CeladonMansion3FGraphicArtistText(g) {
      if (!dexComplete(g)) return g.text("CeladonMansion3FGraphicArtistText.Text1");
      await g.text("CeladonMansion3FGraphicArtistText.Text2", { wait: false });
      if (!(await g.yesNo())) return g.text("CeladonMansion3FGraphicArtistText.Text3");
      // API REQUEST: a way to show the Pokédex diploma (PrintDiploma) and print it. Without it the
      // diploma screen is skipped and the "printing finished" line is shown.
      await g.text("CeladonMansion3FGraphicArtistText.Text4");
    },
    async CeladonMansion3FWriterText(g) {
      await g.text(dexComplete(g) ? "CeladonMansion3FWriterText.Text2" : "CeladonMansion3FWriterText.Text1");
    },
    async CeladonMansion3FGameDesignerText(g) {
      if (!dexComplete(g)) return g.text("CeladonMansion3FGameDesignerText.Text");
      await g.text("CeladonMansion3FGameDesignerText.CompletedDexText");
      await g.delay(3);
      await g.text("CeladonMansion3FGameDesignerText.UnlockedDiplomaPrinting");
    },
    // API REQUEST: DisplayDiploma (the Pokédex diploma screen) shown after the designer's line.
    async "CeladonMansion3FGameDesignerText.CompletedDexText"() {},
  },
});

defineMap("CeladonMansionRoofHouse", {
  generic: true,
  texts: {
    // The Eevee in the Poké Ball is a gift.
    async CeladonMansionRoofHouseEeveePokeballText(g) {
      const mon = await g.giveMon("EEVEE", 25);
      if (mon) g.hide("HS_CELADON_MANSION_EEVEE_GIFT");
    },
  },
});

defineMap("CeladonPokecenter", { generic: true });

defineMap("CeladonDiner", {
  generic: true,
  texts: {
    // The gym guide has lost his coins and hands over the Coin Case.
    async CeladonDinerGymGuideText(g) {
      if (g.ev("EVENT_GOT_COIN_CASE")) return g.text("CeladonDinerPrintGymGuideText.WinItBackText");
      await g.text("CeladonDinerPrintGymGuideText.ImFlatOutBustedText");
      if (!g.give("COIN_CASE")) return g.text("CeladonDinerPrintGymGuideText.CoinCaseNoRoomText");
      g.set("EVENT_GOT_COIN_CASE");
      await g.text("CeladonDinerPrintGymGuideText.ReceivedCoinCaseText");
    },
  },
});

// ---------------------------------------------------------------- Celadon Gym

/** The Rainbow Badge and Erika's TM. */
async function receiveTM21(g: Game) {
  await g.text("TEXT_CELADONGYM_RAINBOWBADGE_INFO");
  g.set("EVENT_BEAT_ERIKA");
  if (g.give("TM_MEGA_DRAIN")) {
    await g.text("TEXT_CELADONGYM_RECEIVED_TM21");
    g.set("EVENT_GOT_TM21");
  } else {
    await g.text("TEXT_CELADONGYM_TM21_NO_ROOM");
  }
  g.badge(3);
  for (let i = 0; i <= 6; i++) g.set(`EVENT_BEAT_CELADON_GYM_TRAINER_${i}`);
}

defineMap("CeladonGym", {
  generic: true,
  texts: {
    async CeladonGymErikaText(g) {
      if (g.ev("EVENT_BEAT_ERIKA")) {
        if (g.ev("EVENT_GOT_TM21")) return g.text("CeladonGymErikaText.PostBattleAdviceText");
        return receiveTM21(g);
      }
      await g.text("CeladonGymErikaText.PreBattleText");
      const won = await g.trainerBattle("ERIKA", 1, { win: "CeladonGymErikaText.ReceivedRainbowBadgeText" });
      if (won) await receiveTM21(g);
    },
  },
});

// ---------------------------------------------------------------- Game Corner

const GC_ROCKET = 11;
/** Receives coins from a man in the Game Corner. `full` says the Coin Case can take no more. */
async function coinGift(g: Game, o: { event: string; ask: string; thanks: string; amount: number; full: string; done: string; full9990?: boolean }) {
  if (g.ev(o.event)) return g.text(o.done);
  await g.text(o.ask);
  if (!haveCoinCase(g)) return g.text("GameCornerOopsForgotCoinCaseText");
  if (o.full9990 ? g.coins === 9990 : g.coins >= 9990) return g.text(o.full);
  g.coins = Math.min(9999, g.coins + o.amount);
  g.set(o.event);
  await g.text(o.thanks);
}

defineMap("GameCorner", {
  onEnter(g) {
    // The poster hides the stairs to the Rocket hideout until the switch behind it is found.
    if (!g.ev("EVENT_FOUND_ROCKET_HIDEOUT")) g.setBlock(8, 2, 0x2a);
    // One slot machine is lucky; the slot machines read which one from here.
    const random = Math.floor(Math.random() * 256);
    g.vars.luckySlot = (random < 7 ? 8 : random) >> 3;
  },
  texts: {
    // The clerk sells 50 coins for 1000 yen.
    async GameCornerClerkText(g) {
      await g.text("GameCornerClerkText.DoYouNeedSomeGameCoins", { wait: false });
      if (!(await g.yesNo())) return g.text("GameCornerClerkText.PleaseComePlaySometime");
      if (!haveCoinCase(g)) return g.text("GameCornerClerkText.DontHaveCoinCase");
      if (g.coins >= 9990) return g.text("GameCornerClerkText.CoinCaseIsFull");
      if (g.money < 1000) return g.text("GameCornerClerkText.CantAffordTheCoins");
      g.money -= 1000;
      g.coins = Math.min(9999, g.coins + 50);
      await g.text("GameCornerClerkText.ThanksHereAre50Coins");
    },
    GameCornerFishingGuru1Text: g => coinGift(g, {
      event: "EVENT_GOT_10_COINS", ask: "GameCornerFishingGuru1Text.WantToPlayText", amount: 10,
      thanks: "GameCornerFishingGuru1Text.Received10CoinsText", full: "GameCornerFishingGuru1Text.DontNeedMyCoinsText",
      done: "GameCornerFishingGuru1Text.WinsComeAndGoText",
    }),
    GameCornerMiddleAgedMan2Text: g => coinGift(g, {
      event: "EVENT_GOT_20_COINS_2", ask: "GameCornerMiddleAgedMan2Text.WantSomeCoinsText", amount: 20,
      thanks: "GameCornerMiddleAgedMan2Text.Received20CoinsText", full: "GameCornerMiddleAgedMan2Text.YouHaveLotsOfCoinsText",
      done: "GameCornerMiddleAgedMan2Text.INeedMoreCoinsText",
    }),
    GameCornerFishingGuru2Text: g => coinGift(g, {
      event: "EVENT_GOT_20_COINS", ask: "GameCornerFishingGuru2Text.ThrowingMeOffText", amount: 20,
      thanks: "GameCornerFishingGuru2Text.Received20CoinsText", full: "GameCornerFishingGuru2Text.YouGotYourOwnCoinsText",
      done: "GameCornerFishingGuru2Text.CloselyWatchTheReelsText", full9990: true,
    }),
    async GameCornerGymGuideText(g) {
      await g.text(g.ev("EVENT_BEAT_ERIKA") ? "GameCornerGymGuideTheyOfferRarePokemonText" : "GameCornerGymGuideChampInMakingText");
    },
    // The Rocket guarding the poster battles the player and then walks away.
    async GameCornerRocketText(g) {
      await g.text("GameCornerRocketText.ImGuardingThisPosterText");
      const won = await g.trainerBattle("ROCKET", 7, { win: "GameCornerRocketText.BattleEndText" });
      if (!won) return;
      await g.text("TEXT_GAMECORNER_ROCKET_AFTER_BATTLE");
      const direct = g.player.y === 6 || g.player.x === 8;
      await g.move(GC_ROCKET, direct ? "R5" : "D1R3U1R3");
      g.hide("HS_GAME_CORNER_ROCKET");
    },
    // The switch behind the poster reveals the stairs.
    async GameCornerPosterText(g) {
      await g.text("GameCornerPosterText.SwitchBehindPosterText", { wait: false });
      await g.delay(20);
      g.sfx("SFX_GO_INSIDE");
      await g.delay(20);
      g.set("EVENT_FOUND_ROCKET_HIDEOUT");
      g.setBlock(8, 2, 0x43);
    },
    async "GameCornerPosterText.SwitchBehindPosterText"(g) {
      g.sfx("SFX_SWITCH");
    },
  },
});

defineMap("GameCornerPrizeRoom", { generic: true });

// ---------------------------------------------------------------- Rocket Hideout

/** Arrow tiles push the player along a fixed path (listed here in the order it is walked). */
const B2F_ARROWS: Record<string, string> = {
  "4,9": "L2",
  "4,11": "R4",
  "4,15": "R4U4",
  "4,16": "U1R4U4",
  "4,19": "L2",
  "4,22": "U3L2",
  "5,14": "R4D2",
  "6,22": "U2",
  "6,24": "U4",
  "8,9": "L6",
  "8,12": "U1",
  "8,15": "U4",
  "8,19": "L6",
  "8,23": "U4L6",
  "9,14": "D2",
  "9,22": "D2",
  "10,9": "L8",
  "10,10": "U1L8",
  "10,15": "U6L8",
  "10,17": "R4U2",
  "10,19": "U2R4U2",
  "10,25": "R4",
  "11,14": "D2R4D2",
  "11,16": "R4D2",
  "11,18": "D2",
  "12,9": "L10",
  "12,11": "U2L10",
  "12,13": "U4L10",
  "12,17": "R2U2",
  "13,10": "D2R1",
  "13,12": "R1",
  "13,16": "R2D2",
  "13,18": "L2D2",
  "13,19": "L3U2R4U2",
  "13,22": "L4D2",
  "13,23": "L5U4L6",
  "14,17": "U2",
  "15,16": "D2",
  "16,14": "U1",
  "16,16": "U3",
  "16,18": "U5",
  "17,10": "L4D2R1",
  "17,11": "L5U2L10",
};
const B3F_ARROWS: Record<string, string> = {
  "10,13": "R4",
  "10,19": "R4U4R4",
  "11,18": "R4D4",
  "12,11": "L2",
  "12,17": "R2U2R4",
  "12,20": "U3R2U2R4",
  "13,16": "R4",
  "14,11": "R2",
  "14,15": "R4",
  "14,17": "U2R4",
  "14,19": "U4R4",
  "15,16": "R2",
  "15,18": "D4",
  "16,13": "U2",
  "17,12": "D4",
  "18,16": "U1",
};

let spinning = false;
/** Rides arrow tiles until the player lands on a square that has none. */
async function spin(g: Game, arrows: Record<string, string>) {
  if (spinning) return;
  spinning = true;
  try {
    for (let i = 0; i < 20; i++) {
      const path = arrows[`${g.player.x},${g.player.y}`];
      if (!path) return;
      g.sfx("SFX_ARROW_TILES");
      await g.move("player", path, { ignoreCollision: true });
    }
  } finally {
    spinning = false;
  }
}

const ROCKET_ELEVATOR_FLOORS = [
  { floor: "B1F", map: "ROCKET_HIDEOUT_B1F", warp: 4 },
  { floor: "B2F", map: "ROCKET_HIDEOUT_B2F", warp: 4 },
  { floor: "B4F", map: "ROCKET_HIDEOUT_B4F", warp: 2 },
];
const rocketFloor = (index: number) => (g: Game) => { g.vars.rocketFloor = index; };

defineMap("RocketHideoutB1F", {
  onEnter(g) {
    rocketFloor(0)(g);
    // The door at the back opens once the Rocket guarding it is beaten.
    g.setBlock(12, 8, g.ev("EVENT_BEAT_ROCKET_HIDEOUT_1_TRAINER_4") ? 0x0e : 0x54);
  },
  texts: {
    "after:5"(g) {
      g.sfx("SFX_GO_INSIDE");
      g.setBlock(12, 8, 0x0e);
      return Promise.resolve();
    },
  },
});

defineMap("RocketHideoutB2F", {
  onEnter: rocketFloor(1),
  onStep: g => spin(g, B2F_ARROWS),
});

defineMap("RocketHideoutB3F", {
  onStep: g => spin(g, B3F_ARROWS),
});

const JAMES = 2, JESSIE = 3;
let jessieJamesScene = false;
/** Jessie and James block the way to Giovanni's side of the hideout. */
async function jessieAndJames(g: Game) {
  if (jessieJamesScene || g.ev("EVENT_BEAT_ROCKET_HIDEOUT_4_JESSIE_JAMES")) return;
  if (g.player.y !== 14 || (g.player.x !== 24 && g.player.x !== 25)) return;
  jessieJamesScene = true;
  try {
    const onLeft = g.player.x === 25;
    if (onLeft) g.set("EVENT_ROCKET_HIDEOUT_4_JESSIE_JAMES_ON_LEFT");
    else g.reset("EVENT_ROCKET_HIDEOUT_4_JESSIE_JAMES_ON_LEFT");
    g.music("MUSIC_MEET_JESSIE_JAMES");
    await g.delay(6);
    await g.text("TEXT_ROCKETHIDEOUTB4F_TEXT11");
    g.show("HS_ROCKET_HIDEOUT_B4F_JAMES");
    g.show("HS_ROCKET_HIDEOUT_B4F_JESSIE");
    await g.delay(6);
    await g.move(JAMES, onLeft ? "D3" : "D4");
    g.face(JAMES, onLeft ? "down" : "left");
    await g.delay(3);
    await g.move(JESSIE, onLeft ? "D4" : "D3");
    g.face(JESSIE, onLeft ? "right" : "down");
    await g.delay(3);
    await g.text("TEXT_ROCKETHIDEOUTB4F_TEXT12");
    g.set("EVENT_6A0");
    g.music();
    const won = await g.trainerBattle("ROCKET", 0x2b, { win: "RocketHideoutB4FJessieJamesEndBattleText" });
    if (!won) {
      g.reset("EVENT_6A0");
      g.hide("HS_ROCKET_HIDEOUT_B4F_JAMES");
      g.hide("HS_ROCKET_HIDEOUT_B4F_JESSIE");
      return;
    }
    g.face(JAMES, "down");
    g.face(JESSIE, "down");
    await g.text("TEXT_ROCKETHIDEOUTB4F_TEXT13");
    g.music("MUSIC_MEET_JESSIE_JAMES");
    await g.fade(() => {
      g.hide("HS_ROCKET_HIDEOUT_B4F_JAMES");
      g.hide("HS_ROCKET_HIDEOUT_B4F_JESSIE");
    });
    g.music();
    g.set("EVENT_BEAT_ROCKET_HIDEOUT_4_JESSIE_JAMES");
  } finally {
    jessieJamesScene = false;
  }
}

defineMap("RocketHideoutB4F", {
  onEnter: rocketFloor(2),
  onStep: jessieAndJames,
  texts: {
    "after:4"(g) {
      // The beaten Rocket drops the Lift Key.
      g.set("EVENT_ROCKET_DROPPED_LIFT_KEY");
      g.show("HS_ROCKET_HIDEOUT_B4F_ITEM_5");
      return Promise.resolve();
    },
    // The scene's first line ends with the player's surprise.
    async RocketHideoutB4FText11(g) {
      await g.delay(10);
      g.face("player", "up");
      await g.emote("player", "exclamation");
      await g.delay(20);
    },
    async RocketHideoutB4FText13(g) {
      await g.delay(64);
    },
    async RocketHideoutB4FGiovanniText(g) {
      if (g.ev("EVENT_BEAT_ROCKET_HIDEOUT_GIOVANNI")) return g.text("RocketHideoutB4FGiovanniHopeWeMeetAgainText");
      await g.text("RocketHideoutB4FGiovanniText.ImpressedYouGotHereText");
      const won = await g.trainerBattle("GIOVANNI", 1, { win: "RocketHideoutB4FGiovanniText.WhatCannotBeText" });
      if (!won) return;
      g.set("EVENT_BEAT_ROCKET_HIDEOUT_GIOVANNI");
      await g.text("TEXT_ROCKETHIDEOUTB4F_GIOVANNI_HOPE_WE_MEET_AGAIN");
      // Giovanni leaves and the Silph Scope is left behind.
      await g.fade(() => {
        g.hide("HS_ROCKET_HIDEOUT_B4F_GIOVANNI");
        g.show("HS_ROCKET_HIDEOUT_B4F_ITEM_4");
      });
    },
  },
});

defineMap("RocketHideoutElevator", {
  onEnter(g) {
    const from = ROCKET_ELEVATOR_FLOORS[g.vars.rocketFloor || 0];
    g.setWarp(0, from.map, from.warp);
    g.setWarp(1, from.map, from.warp);
  },
  texts: {
    async RocketHideoutElevatorText(g) {
      if (!g.hasItem("LIFT_KEY")) return g.text("RocketHideoutElevatorText.AppearsToNeedKeyText");
      await g.text("WhichFloorText", { wait: false });
      const pick = await g.choose("Floor", ROCKET_ELEVATOR_FLOORS.map(f => f.floor));
      if (pick === undefined) return;
      const to = ROCKET_ELEVATOR_FLOORS[pick];
      g.setWarp(0, to.map, to.warp);
      g.setWarp(1, to.map, to.warp);
      await shakeElevator(g);
    },
    // Not real texts: the coverage scan reads the data after the text pointer table as entries.
    "@cea": async () => {},
  },
});

// ---------------------------------------------------------------- Routes 16 to 18

// Snorlax wakes when the Poké Flute is played beside it. The runtime's flute item calls this hook;
// anything another script already installed is kept.
const flute = globalThis as { __yellowFlute?: (g: Game) => Promise<boolean> };
const previousFlute = flute.__yellowFlute;
flute.__yellowFlute = async g => {
  if (g.mapLabel === "Route16" && !g.ev("EVENT_BEAT_ROUTE16_SNORLAX") && g.player.y === 10 && (g.player.x === 27 || g.player.x === 25)) {
    await g.text("PlayedFluteHadEffectText");
    g.set("EVENT_FIGHT_ROUTE16_SNORLAX");
    return true;
  }
  return previousFlute ? previousFlute(g) : false;
};

let snorlaxFight = false;
defineMap("Route16", {
  async onStep(g) {
    if (snorlaxFight || g.ev("EVENT_BEAT_ROUTE16_SNORLAX") || !g.ev("EVENT_FIGHT_ROUTE16_SNORLAX")) return;
    snorlaxFight = true;
    try {
      g.reset("EVENT_FIGHT_ROUTE16_SNORLAX");
      await g.text("TEXT_ROUTE16_SNORLAX_WOKE_UP");
      g.hide("HS_ROUTE_16_SNORLAX");
      const outcome = await g.wildBattle("SNORLAX", 30);
      if (outcome === "lose") return;
      if (outcome !== "caught") await g.text("TEXT_ROUTE16_SNORLAX_RETURNED_TO_MOUNTAINS");
      g.set("EVENT_BEAT_ROUTE16_SNORLAX");
    } finally {
      snorlaxFight = false;
    }
  },
});

/** The cycling road gate keeps walkers out: without a Bicycle the guard stops the player at the counter. */
function cyclingRoadGate(stops: number[], waitText: string, guardText: string) {
  let running = false;
  return async (g: Game) => {
    if (running || g.hasItem("BICYCLE") || g.player.x !== 4) return;
    const index = stops.indexOf(g.player.y);
    if (index < 0) return;
    running = true;
    try {
      await g.text(waitText);
      if (index > 0) await g.move("player", `U${index}`);
      await g.text(guardText);
      await g.move("player", "R");
    } finally {
      running = false;
    }
  };
}

defineMap("Route16Gate1F", {
  onStep: cyclingRoadGate([7, 8, 9, 10], "TEXT_ROUTE16GATE1F_GUARD_WAIT_UP", "TEXT_ROUTE16GATE1F_GUARD"),
  texts: {
    // Not a real text: the coverage scan reads the data after the text pointer table as an entry.
    "@87d3": async () => {},
    async Route16Gate1FGuardText(g) {
      await g.text(g.hasItem("BICYCLE") ? "Route16Gate1FGuardText.CyclingRoadExplanationText" : "Route16Gate1FGuardText.NoPedestriansAllowedText");
    },
  },
});

defineMap("Route18Gate1F", {
  onStep: cyclingRoadGate([3, 4, 5, 6], "TEXT_ROUTE18GATE1F_GUARD_EXCUSE_ME", "TEXT_ROUTE18GATE1F_GUARD"),
  texts: {
    async Route18Gate1FGuardText(g) {
      await g.text(g.hasItem("BICYCLE") ? "Route18Gate1FGuardText.CyclingRoadUphillText" : "Route18Gate1FGuardText.YouNeedABicycleText");
    },
  },
});

/** Binoculars only work when looked into from below. */
const binoculars = (label: string) => async (g: Game) => {
  if (g.player.facing === "up") await g.text(`${label}.Text`);
};

defineMap("Route16Gate2F", {
  generic: true,
  texts: {
    Route16Gate2FLeftBinocularsText: binoculars("Route16Gate2FLeftBinocularsText"),
    Route16Gate2FRightBinocularsText: binoculars("Route16Gate2FRightBinocularsText"),
  },
});

defineMap("Route18Gate2F", {
  generic: true,
  texts: {
    // The cook trades a Pokémon for SPIKE (TRADE_FOR_SPIKE).
    async Route18Gate2FCookText(g) {
      await g.trade(5);
    },
    Route18Gate2FLeftBinocularsText: binoculars("Route18Gate2FLeftBinocularsText"),
    Route18Gate2FRightBinocularsText: binoculars("Route18Gate2FRightBinocularsText"),
  },
});

defineMap("Route16FlyHouse", {
  generic: true,
  texts: {
    // The girl gives HM02 (Fly).
    async Route16FlyHouseBrunetteGirlText(g) {
      if (g.ev("EVENT_GOT_HM02")) return g.text("Route16FlyHouseBrunetteGirlText.HM02ExplanationText");
      await g.text("Route16FlyHouseBrunetteGirlText.Text");
      if (!g.give("HM_FLY")) return g.text("Route16FlyHouseBrunetteGirlText.HM02NoRoomText");
      g.set("EVENT_GOT_HM02");
      await g.text("Route16FlyHouseBrunetteGirlText.ReceivedHM02Text");
    },
    async Route16FlyHouseFearowText(g) {
      await g.text("Route16FlyHouseFearowText.Text");
      g.cry("FEAROW");
      await g.delay(40);
    },
  },
});
