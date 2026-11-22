// Yellow Legacy's additions to Yellow's map logic, from the diff of its V1.0.10
// scripts against the pret/pokeyellow snapshot it forked. They run only with
// Legacy's cartridge, layered over Yellow's ports, and may use names that only
// Legacy's symbol table has (tests check this file against that table alone).
import { defineLegacy, defineLegacyText, type Game } from "../script";
import { MAP } from "../symbols";
import { receiveTM21 } from "./celadon";
import { kogaReward } from "./fuchsia-cinnabar";
import { championScene, eliteRoomScript, ELITE_ROOMS, once, type ChampionScene } from "./indigo";
import { sabrinaRewards } from "./saffron";

/** wGameStage: set by the Hall of Fame. Leaders, the League and a few others then offer rematches. */
const postGame = (g: Game) => !!g.vars.gameStage;

function badgeCount(g: Game) {
  let n = 0;
  for (let b = g.save.badges; b; b &= b - 1) n++;
  return n;
}

/** Asks with `ask`; on no, shows `refused` and resolves false. */
async function offer(g: Game, ask: string, refused: string) {
  await g.text(ask, { wait: false });
  if (await g.yesNo()) return true;
  await g.text(refused);
  return false;
}

// ---------------------------------------------------------------- Gym leaders

interface Leader {
  map: string;
  text: string;
  klass: string;
  beat: string;
  tm: string;
  /** The party the leader fields in a post-game rematch. */
  rematch: number;
  /** Where the rematch prompts live: the leader's text, or Blaine's rematch script. */
  prompts?: string;
  after: string;
  /** Erika, Koga and Sabrina field the team matching how many badges the player already has. */
  scaled?: { party(badges: number): number; pre: string; win: string; lose?: string; reward(g: Game): Promise<void> };
  onBeat?(g: Game): void;
}

const LEADERS: Leader[] = [
  { map: "PewterGym", text: "PewterGymBrockText", klass: "BROCK", beat: "EVENT_BEAT_BROCK", tm: "EVENT_GOT_TM34", rematch: 2, after: "TEXT_PEWTERGYM_REMATCH_POST_BATTLE" },
  { map: "CeruleanGym", text: "CeruleanGymMistyText", klass: "MISTY", beat: "EVENT_BEAT_MISTY", tm: "EVENT_GOT_TM11", rematch: 2, after: "TEXT_CERULEANGYM_REMATCH_POST_BATTLE" },
  { map: "VermilionGym", text: "VermilionGymLTSurgeText", klass: "LT_SURGE", beat: "EVENT_BEAT_LT_SURGE", tm: "EVENT_GOT_TM24", rematch: 2, after: "TEXT_VERMILIONGYM_REMATCH_POST_BATTLE" },
  {
    map: "CeladonGym", text: "CeladonGymErikaText", klass: "ERIKA", beat: "EVENT_BEAT_ERIKA", tm: "EVENT_GOT_TM21", rematch: 4, after: "TEXT_CELADONGYM_REMATCH_POST_BATTLE",
    scaled: { party: n => n >= 5 ? 3 : n >= 4 ? 2 : 1, pre: "CeladonGymErikaText.PreBattleText", win: "CeladonGymErikaText.ReceivedRainbowBadgeText", reward: receiveTM21 },
    // Beating Erika brings a Mr. Mime to Red's house.
    onBeat: g => g.show("HS_REDS_HOUSE_2F_MR_MIME"),
  },
  {
    map: "FuchsiaGym", text: "FuchsiaGymKogaText", klass: "KOGA", beat: "EVENT_BEAT_KOGA", tm: "EVENT_GOT_TM06", rematch: 3, after: "TEXT_FUCHSIAGYM_REMATCH_POST_BATTLE",
    scaled: { party: n => n >= 5 ? 2 : 1, pre: "FuchsiaGymKogaText.BeforeBattleText", win: "FuchsiaGymKogaText.ReceivedSoulBadgeText", reward: kogaReward },
  },
  {
    map: "SaffronGym", text: "SaffronGymSabrinaText", klass: "SABRINA", beat: "EVENT_BEAT_SABRINA", tm: "EVENT_GOT_TM46", rematch: 3, after: "TEXT_SAFFRONGYM_REMATCH_POST_BATTLE",
    // Sabrina's own party is her sixth-gym team; with fewer badges she fields her second.
    scaled: {
      party: n => n >= 5 ? 1 : 2, pre: "SaffronGymSabrinaText.Text",
      win: "SaffronGymSabrinaText.ReceivedMarshBadgeText", lose: "SaffronGymSabrinaText.ReceivedMarshBadgeText", reward: sabrinaRewards,
    },
  },
  {
    map: "CinnabarGym", text: "CinnabarGymBlaineText", klass: "BLAINE", beat: "EVENT_BEAT_BLAINE", tm: "EVENT_GOT_TM38", rematch: 2,
    prompts: "CinnabarGymStartRematchScript", after: "TEXT_CINNABARGYM_REMATCH_POST_BATTLE",
  },
];

async function leader(g: Game, l: Leader, yellow?: (g: Game) => Promise<void>) {
  if (g.ev(l.beat) && g.ev(l.tm) && postGame(g)) {
    const p = `${l.prompts ?? l.text}.`;
    if (!(await offer(g, p + "PreBattleRematch1Text", p + "PreBattleRematchRefusedText"))) return;
    await g.text(p + "PreBattleRematch2Text");
    if (await g.trainerBattle(l.klass, l.rematch)) await g.text(l.after);
  } else if (l.scaled && !g.ev(l.beat)) {
    const s = l.scaled;
    await g.text(s.pre);
    if (await g.trainerBattle(l.klass, s.party(badgeCount(g)), { win: s.win, lose: s.lose })) await s.reward(g);
  } else {
    await yellow?.(g);
  }
  if (g.ev(l.beat)) l.onBeat?.(g);
}

for (const l of LEADERS) defineLegacy(l.map, { texts: { [l.text]: (g, yellow) => leader(g, l, yellow) } });

defineLegacy("ViridianGym", {
  texts: {
    async ViridianGymGiovanniText(g, yellow) {
      // Legacy plays Yellow's unused song as Giovanni steps up. Astra plays Kanto with Crystal's
      // arrangements, which have no version of it, so his challenge gets Crystal's Team Rocket theme.
      const challenge = !g.ev("EVENT_BEAT_VIRIDIAN_GYM_GIOVANNI");
      if (challenge) g.music("MUSIC_MEET_EVIL_TRAINER");
      try {
        await yellow?.(g);
      } finally {
        if (challenge) g.music();
      }
    },
  },
});

// ---------------------------------------------------------- The Elite Four

const REMATCH_EVENTS: Record<string, string> = {
  LoreleisRoom: "EVENT_BEAT_LORELEIS_ROOM_TRAINER_1",
  BrunosRoom: "EVENT_BEAT_BRUNOS_ROOM_TRAINER_1",
  AgathasRoom: "EVENT_BEAT_AGATHAS_ROOM_TRAINER_1",
  LancesRoom: "EVENT_BEAT_LANCES_ROOM_TRAINER_1",
};
const resetRematches = (g: Game) => Object.values(REMATCH_EVENTS).forEach(e => g.reset(e));

// After the Hall of Fame each room holds the member's rematch self, whose win opens the exit.
for (const [label, room] of Object.entries(ELITE_ROOMS)) {
  const script = eliteRoomScript(label, room, g => g.ev(postGame(g) ? REMATCH_EVENTS[label] : room.beat));
  defineLegacy(label, { onEnter: g => script.onEnter?.(g), onStep: g => script.onStep?.(g) });
}

defineLegacy("IndigoPlateauLobby", {
  async onEnter(g, yellow) {
    // Starting over after an unfinished run also resets the rematches.
    const started = g.vars.elite4Started;
    await yellow?.(g);
    if (started) resetRematches(g);
  },
});

defineLegacy("LancesRoom", {
  async onStep(g, yellow) {
    if (postGame(g) && g.ev("EVENT_BEAT_LANCES_ROOM_TRAINER_1")) g.set("EVENT_BEAT_LANCE");
    await yellow?.(g);
  },
  texts: {
    TEXT_LANCESROOM_LANCE: g => g.text(postGame(g) ? "LancesRoomLanceRematchText" : "LancesRoomLanceText"),
    // The rematch's after-battle entry only records the win.
    async LancesRoomLanceRematchAfterBattleText(g) {
      g.set("EVENT_BEAT_LANCE");
    },
  },
});

const CHAMPION_REMATCH: ChampionScene = {
  intro: "TEXT_CHAMPIONSROOM_RIVAL_REMATCH_INTRO",
  team: () => 4,
  win: "RivalRematchDefeatedText", lose: "RivalRematchVictoryText", beat: false,
  after: "TEXT_CHAMPIONSROOM_RIVAL_REMATCH_AFTER_BATTLE",
  congratulates: "TEXT_CHAMPIONSROOM_REMATCH_OAK_CONGRATULATES_PLAYER",
  disappointed: "TEXT_CHAMPIONSROOM_REMATCH_OAK_DISAPPOINTED_WITH_RIVAL",
  comeWithMe: "TEXT_CHAMPIONSROOM_REMATCH_OAK_COME_WITH_ME",
};

defineLegacy("ChampionsRoom", {
  async onStep(g, yellow) {
    if (!postGame(g)) return yellow?.(g);
    if (!g.ev("EVENT_BEAT_LANCE") || g.vars.championsIntro) return;
    await once("ChampionsRoom", () => championScene(g, CHAMPION_REMATCH));
  },
});

defineLegacy("HallOfFame", {
  async onStep(g, yellow) {
    await yellow?.(g);
    // Yellow's scene ends by sending the player home; until then the ceremony is still running.
    if (g.map === MAP.HALL_OF_FAME) return;
    g.vars.gameStage = 1;
    resetRematches(g);
    // Oak waits on Route 1, the lobby's second clerk sells TMs, and the Elite Four are ready for rematches.
    for (const hs of ["HS_OAKS_LAB_OAK_1", "HS_CHAMPIONS_ROOM_OAK", "HS_LORELEISROOM_LORELEI", "HS_BRUNOSROOM_BRUNO", "HS_AGATHASROOM_AGATHA", "HS_LANCESROOM_LANCE"]) g.hide(hs);
    for (const hs of [
      "HS_ROUTE_1_OAK", "HS_INDIGO_PLATEU_LOBBY_CLERK_HS", "HS_LORELEISROOM_LORELEI_REMATCH", "HS_BRUNOSROOM_BRUNO_REMATCH",
      "HS_AGATHASROOM_AGATHA_REMATCH", "HS_LANCESROOM_LANCE_REMATCH",
    ]) g.show(hs);
    // The rival's Eevee evolution waits in the Champion's room.
    g.show(["HS_CHAMPIONS_ROOM_JOLTEON", "HS_CHAMPIONS_ROOM_FLAREON", "HS_CHAMPIONS_ROOM_VAPOREON"][Math.min(3, Math.max(1, g.vars.rivalStarter || 1)) - 1]);
  },
  texts: {
    TEXT_HALLOFFAME_OAK: g => g.text(postGame(g) ? "HallOfFameRematchOakText" : "HallOfFameOakText"),
  },
});

// ------------------------------------------------------ Professor Oak's battles

const MANSION_OAK = 2;

async function oakBattle(g: Game, party: number, t: { ask: string; refused: string; challenge: string; win: string; lose: string; after: string }) {
  if (!(await offer(g, t.ask, t.refused))) return false;
  g.music("MUSIC_MEET_MALE_TRAINER");
  await g.text(t.challenge);
  const won = await g.trainerBattle("PROF_OAK", party, { win: t.win, lose: t.lose });
  g.music();
  if (won) await g.text(t.after);
  return won;
}

defineLegacy("Route1", {
  texts: {
    async Route1OakText(g) {
      const won = await oakBattle(g, 1, {
        ask: "OakBeforeBattleText", refused: "OakRefusedBattleText", challenge: "OakRealChallengeBattleText",
        win: "OakDefeatedText", lose: "OakWonText", after: "OakPostBattleText",
      });
      if (!won) return;
      // Oak heads back to his lab.
      await g.fade(() => {
        g.set("EVENT_BEAT_ROUTE_1_OAK");
        g.show("HS_OAKS_LAB_OAK_1");
        g.hide("HS_ROUTE_1_OAK");
      });
    },
  },
});

defineLegacy("OaksLab", {
  texts: {
    async OaksLabOak1Text(g, yellow) {
      // Yellow's Oak rates the Pokédex once the player has Poké Balls from him.
      const rates = g.ev("EVENT_PALLET_AFTER_GETTING_POKEBALLS") || (g.save.caught.length >= 2 && g.ev("EVENT_GOT_POKEBALLS_FROM_OAK"));
      await yellow?.(g);
      // Every Pokémon but Mew: Oak goes to the Pokémon Mansion.
      if (!rates || g.ev("EVENT_BEAT_POKEMONMANSION2F_OAK") || g.save.caught.filter(n => n <= 151).length < 150) return;
      await g.text("CompletedDexText");
      await g.fade(() => {
        g.hide("HS_OAKS_LAB_OAK_1");
        g.show("HS_POKEMON_MANSION_2F_OAK");
      });
    },
  },
});

defineLegacy("PokemonMansion2F", {
  texts: {
    async PokemonMansion2FOakText(g) {
      const said = async (n: number, turn: () => void) => {
        await g.text(`PokemonMansion2F_OakBeforeBattleText${n}`);
        turn();
        await g.delay(3);
      };
      // Oak reads the diary beside him, turning between it and the player.
      await said(1, () => g.face(MANSION_OAK, "right"));
      await said(2, () => g.facePlayer(MANSION_OAK));
      await said(3, () => g.face(MANSION_OAK, g.player.facing === "down" ? "down" : "up"));
      await said(4, () => g.face(MANSION_OAK, "right"));
      await said(5, () => g.facePlayer(MANSION_OAK));
      const won = await oakBattle(g, 2, {
        ask: "PokemonMansion2F_OakBeforeBattleText6", refused: "PokemonMansion2F_OakRefusedBattleText",
        challenge: "PokemonMansion2F_OakRealChallengeBattleText", win: "PokemonMansion2F_OakDefeatedText",
        lose: "PokemonMansion2F_OakWonText", after: "PokemonMansion2F_OakPostBattleText",
      });
      if (!won) return;
      // Oak returns to his lab, and Mew appears in the basement.
      await g.fade(() => {
        g.set("EVENT_BEAT_POKEMONMANSION2F_OAK");
        g.show("HS_OAKS_LAB_OAK_1");
        g.hide("HS_POKEMON_MANSION_2F_OAK");
        g.show("HS_POKEMON_MANSION_B1F_MEW");
      });
      await g.text("PokemonMansion2F_MewText");
    },
  },
});

// ------------------------------------------------------- Post-game battles

defineLegacy("VermilionCity", {
  texts: {
    async VermilionCityPrintOfficerJennyText(g, yellow) {
      if (!g.ev("EVENT_GOT_SQUIRTLE_FROM_OFFICER_JENNY") || !postGame(g)) return yellow?.(g);
      if (!(await offer(g, "JennyPreBattleText", "JennyRefusedText"))) return;
      await g.text("JennyAcceptedText");
      if (!(await g.trainerBattle("JENNY", 1))) return;
      await g.text("VermilionCityJennyPostBattleText");
      g.set("EVENT_BEAT_JENNY");
    },
  },
});

defineLegacy("FuchsiaPokecenter", {
  texts: {
    async FuchsiaPokecenterNurseText(g) {
      await g.service("nurse");
      if (!postGame(g)) return;
      const ask = g.ev("EVENT_BEAT_NURSE_JOY") ? "NurseJoyPreBattleText2" : "NurseJoyPreBattleText";
      if (!(await offer(g, ask, "NurseJoyRefusedText"))) return;
      await g.text("NurseJoyAcceptedText");
      if (!(await g.trainerBattle("JOY", 1))) return;
      g.set("EVENT_BEAT_NURSE_JOY");
      await g.text("NurseJoyAfterBattleText");
    },
  },
});

const WEEBRA = 4;
defineLegacy("SeafoamIslandsB4F", {
  texts: {
    async SeafoamIslandsWeebraText1(g) {
      if (!g.ev("EVENT_BEAT_WEEBRA")) {
        await g.text("SeafoamIslandsWeebraBattleText1");
        if (!(await g.trainerBattle("WEEBRA", 1))) return;
        await g.text("SeafoamIslandsWeebraEndBattleText1");
        g.set("EVENT_BEAT_WEEBRA");
      } else {
        await g.text("SeafoamIslandsWeebraAfterBattleText1");
      }
      // Weebra steps aside, unless already out of the way.
      const weebra = g.npc(WEEBRA);
      if (!weebra || weebra.x !== 7 || weebra.y !== 2) return;
      await g.move(WEEBRA, "R3");
      g.face(WEEBRA, "left");
    },
  },
});

// ---------------------------------------------------------- Gifts and rods

defineLegacy("RedsHouse1F", {
  texts: {
    async RedsHouse1FPrintMomText(g, yellow) {
      if (!postGame(g) || g.ev("EVENT_MOM_CONGRATULATE_CHAMPION")) return yellow?.(g);
      await g.text("RedsHouse1FMomChampionText");
      g.set("EVENT_MOM_CONGRATULATE_CHAMPION");
    },
  },
});

defineLegacy("ViridianMart", {
  texts: {
    // The Old Rod moved here from Vermilion.
    async ViridianCityFishingGuruText(g) {
      const t = "ViridianCityFishingGuruText.";
      if (g.hasItem("OLD_ROD")) return g.text(t + "HowAreTheFishBitingText");
      if (!(await offer(g, t + "DoYouLikeToFishText", t + "ThatsSoDisappointingText"))) return;
      if (!g.give("OLD_ROD")) return g.text(t + "NoRoomText");
      await g.text(t + "TakeThisText");
    },
  },
});

defineLegacy("VermilionOldRodHouse", {
  texts: {
    // Vermilion's guru now gives the Good Rod.
    async VermilionOldRodHouseFishingGuruText(g) {
      const t = "VermilionOldRodHouseFishingGuruText.";
      if (g.vars.gotGoodRod) return g.text(t + "HowAreTheFishText");
      if (!(await offer(g, t + "Text", t + "ThatsSoDisappointingText"))) return;
      if (!g.give("GOOD_ROD")) return g.text(t + "NoRoomText");
      g.vars.gotGoodRod = 1;
      await g.text(t + "ReceivedGoodRodText");
    },
  },
});

defineLegacy("FuchsiaGoodRodHouse", {
  texts: {
    // Fuchsia's guru gives the fossil Pokémon the player passed up at Mt. Moon.
    async FuchsiaGoodRodHouseFishingGuruText(g) {
      const t = "FuchsiaGoodRodHouseFishingGuruText.";
      if (g.ev("EVENT_GOT_FUCHSIA_FOSSIL_GIFT")) return g.text(t + "HowAreTheFishText");
      if (!(await offer(g, t + "Text", t + "ThatsSoDisappointingText"))) return;
      if (await g.giveMon(g.ev("EVENT_GOT_DOME_FOSSIL") ? "OMANYTE" : "KABUTO", 10)) g.set("EVENT_GOT_FUCHSIA_FOSSIL_GIFT");
    },
  },
});

defineLegacy("Route15Gate2F", {
  texts: {
    // Oak's aide hands over the Exp. All without asking how many Pokémon the player owns.
    async Route15Gate2FOaksAideText(g) {
      const t = "Route15Gate2FOaksAideText.";
      if (!g.ev("EVENT_GOT_EXP_ALL")) {
        await g.text(t + "Route15Gate2FOaksAideHiText");
        if (g.give("EXP_ALL")) {
          await g.text(t + "Route15Gate2FOaksAideGotItemText");
          g.set("EVENT_GOT_EXP_ALL");
        } else {
          await g.text(t + "Route15Gate2FOaksAideNoRoomText");
        }
      }
      await g.text(t + "ExpAllText");
    },
  },
});

defineLegacy("SSAnneBow", {
  texts: {
    // A passenger gives ¥500 once.
    async SSAnneBowSuperNerd2Text(g) {
      const t = "SSAnneBowSuperNerd2Text.";
      if (g.ev("EVENT_SS_ANNE_PARTOFTHEGAME")) return g.text(t + "Text3");
      await g.text(t + "Text1");
      await g.text(t + "Text2");
      g.set("EVENT_SS_ANNE_PARTOFTHEGAME");
      g.money = Math.min(999999, g.money + 500);
    },
  },
});

const TRADE_FOR_LOLA = 6;
defineLegacy("SaffronPidgeyHouse", {
  texts: {
    SaffronPidgeyHouseGamblerText: g => g.trade(TRADE_FOR_LOLA),
  },
});

defineLegacy("GameCornerPrizeRoom", {
  texts: {
    // A clerk sells 500 coins for ¥11,000.
    async GameCornerPrizeRoomClerkText(g) {
      const t = "GameCornerPrizeRoomClerkText.";
      if (!(await offer(g, t + "DoYouNeedSomeGameCoins", t + "PleaseComePlaySometime"))) return;
      if (!g.hasItem("COIN_CASE")) return g.text(t + "DontHaveCoinCase");
      if (g.coins >= 9990) return g.text(t + "CoinCaseIsFull");
      if (g.money < 11000) return g.text(t + "CantAffordTheCoins");
      g.money -= 11000;
      g.coins = Math.min(9999, g.coins + 500);
      await g.text(t + "ThanksHereAre500Coins");
    },
  },
});

// ------------------------------------------------- Move relearner and deleter

const RELEARN_COST = 1000;

async function moveRelearner(g: Game) {
  if (!(await offer(g, "MoveRelearnerGreetingText", "MoveRelearnerByeText"))) return;
  if (g.money < RELEARN_COST) return g.text("MoveRelearnerNotEnoughMoneyText");
  await g.text("MoveRelearnerSaidYesText");
  const slot = await g.choosePartyMon("Relearn a move");
  if (slot === undefined) return g.text("MoveRelearnerByeText");
  // Level-up moves up to the Pokémon's level that it doesn't know, from the game data.
  const mon = g.save.party[slot];
  const moves = [...new Set(g.learnset(mon.species).filter(e => e.level <= mon.level && !mon.moves.includes(e.move)).map(e => e.move))];
  if (!moves.length) return g.text("MoveRelearnerNoMovesText");
  await g.text("MoveRelearnerWhichMoveText", { wait: false });
  const pick = await g.choose("Which move?", moves.map(m => g.moveName(m)));
  if (pick !== undefined && await g.learnMove(slot, moves[pick])) g.money -= RELEARN_COST;
  await g.text("MoveRelearnerByeText");
}

async function moveDeleter(g: Game) {
  await g.text("MoveDeleterGreetingText", { wait: false });
  for (;;) {
    if (!(await g.yesNo())) return g.text("MoveDeleterByeText");
    await g.text("MoveDeleterSaidYesText");
    const slot = await g.choosePartyMon("Forget a move");
    if (slot === undefined) return g.text("MoveDeleterByeText");
    const known = g.save.party[slot].moves.filter(m => m);
    // A Pokémon must keep one move; the deleter asks whether to pick another.
    if (known.length < 2) {
      await g.text("MoveDeleterOneMoveText", { wait: false });
      continue;
    }
    for (;;) {
      await g.text("MoveDeleterWhichMoveText", { wait: false });
      const pick = await g.choose("Forget which move?", known.map(m => g.moveName(m)));
      if (pick === undefined) return g.text("MoveDeleterByeText");
      g.textVar("wStringBuffer", g.moveName(known[pick]));
      await g.text("MoveDeleterConfirmText", { wait: false });
      if (!(await g.yesNo())) continue;
      const mon = g.save.party[slot], i = mon.moves.indexOf(known[pick]);
      // The later moves move up, as the original shifts them.
      g.save.party[slot] = { ...mon, moves: [...mon.moves.filter((_, j) => j !== i), 0], pp: [...mon.pp.filter((_, j) => j !== i), 0] };
      await g.text("MoveDeleterForgotText");
      return g.text("MoveDeleterByeText");
    }
  }
}

defineLegacy("CinnabarLabFossilRoom", {
  texts: {
    MoveRelearnerText1: moveRelearner,
    MoveDeleterText1: moveDeleter,
  },
});

// ------------------------------------------------------------ Shared texts

// With the Rainbow Badge, inspecting a boulder has a Pokémon that knows Strength use it.
defineLegacyText("BoulderText", async g => {
  if (g.hasBadge(3)) await g.fieldMove("strength");
});
