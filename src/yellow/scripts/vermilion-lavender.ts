// Ported Yellow map scripts. See docs/YELLOW_PORTING.md.
// Vermilion City, the S.S. Anne, Route 11/12, Rock Tunnel, Lavender Town and Pokémon Tower.
import { MAP } from "../symbols";
import { oaksAide } from "./shared";
import { defineMap, SHARED_TEXTS, type Game } from "../script";

const at = (g: Game, x: number, y: number) => g.player.x === x && g.player.y === y;
const random = (n: number) => Math.floor(Math.random() * n);


// Both Snorlax maps' flute hooks chain onto each other.
type FluteHook = (g: Game) => Promise<boolean>;
const hooks = globalThis as unknown as { __yellowFlute?: FluteHook };
const otherFlute = hooks.__yellowFlute;
hooks.__yellowFlute = async g => {
  if (g.mapLabel === "Route12" && !g.ev("EVENT_BEAT_ROUTE12_SNORLAX")) {
    // One space west, north, south or east of Snorlax.
    if ([[9, 62], [10, 61], [10, 63], [11, 62]].some(([x, y]) => at(g, x, y))) {
      await g.text("PlayedFluteHadEffectText");
      g.set("EVENT_FIGHT_ROUTE12_SNORLAX");
      await route12Snorlax(g);
      return true;
    }
  }
  return otherFlute ? otherFlute(g) : false;
};
SHARED_TEXTS.PlayedFluteHadEffectText ??= async () => {};

// ---------------------------------------------------------------- Vermilion City

const SAILOR_COORDS = [18, 30] as const;

defineMap("VermilionCity", {
  async onStep(g) {
    // Chairman's voucher: once the player has it and leaves the Fan Club, the Club's talk changes.
    if (!g.ev("EVENT_LEFT_FANCLUB_AFTER_BIKE_VOUCHER") && g.ev("EVENT_GOT_BIKE_VOUCHER"))
      g.set("EVENT_LEFT_FANCLUB_AFTER_BIKE_VOUCHER");
    // Coming off the ship after it has sailed: the first visit afterwards walks the player up two steps.
    if (g.ev("EVENT_SS_ANNE_LEFT") && !g.ev("EVENT_WALKED_PAST_GUARD_AFTER_SS_ANNE_LEFT")) {
      g.set("EVENT_WALKED_PAST_GUARD_AFTER_SS_ANNE_LEFT");
      await g.move("player", "U2");
      return;
    }
    // The guard at the dock: state 4 (ALLOWED_TO_PASS) lasts until the player steps off his square.
    if (g.state === 4) {
      if (at(g, ...SAILOR_COORDS)) return;
      g.state = 0;
    }
    if (g.player.facing !== "down" || !at(g, ...SAILOR_COORDS)) return;
    await g.text("TEXT_VERMILIONCITY_SAILOR1");
    if (!g.ev("EVENT_SS_ANNE_LEFT") && g.hasItem("S_S_TICKET")) return;
    await g.move("player", "U");
    await g.delay(10);
  },
  texts: {
    async VermilionCityGambler1Text(g) {
      await g.text(g.ev("EVENT_SS_ANNE_LEFT") ? "VermilionCityGambler1Text.SSAnneDepartedText" : "VermilionCityGambler1Text.DidYouSeeText");
    },
    async VermilionCitySailor1Text(g) {
      if (g.ev("EVENT_SS_ANNE_LEFT")) return g.text("VermilionCitySailor1Text.ShipSetSailText");
      // Facing right, or standing in front of / behind the guard, only gets the greeting.
      if (g.player.facing === "right" || at(g, 19, 29) || at(g, 19, 31)) return g.text("VermilionCitySailor1Text.WelcomeToSSAnneText");
      await g.text("VermilionCitySailor1Text.DoYouHaveATicketText");
      if (!g.hasItem("S_S_TICKET")) return g.text("VermilionCitySailor1Text.YouNeedATicketText");
      await g.text("VermilionCitySailor1Text.FlashedTicketText");
      g.state = 4;
    },
    async VermilionCityMachopText(g) {
      g.cry("MACHOP");
      await g.delay(40);
      await g.text("VermilionCityMachopText.StompingTheLandFlatText");
    },
    async VermilionCityPrintOfficerJennyText(g) {
      if (g.ev("EVENT_GOT_SQUIRTLE_FROM_OFFICER_JENNY")) return g.text("OfficerJennyText5");
      if (!g.hasBadge(2)) return g.text("OfficerJennyText1");
      await g.text("OfficerJennyText2", { wait: false });
      if (!(await g.yesNo())) return g.text("OfficerJennyText4");
      if (!(await g.giveMon("SQUIRTLE", 10))) return;
      await g.text("OfficerJennyText3");
      g.set("EVENT_GOT_SQUIRTLE_FROM_OFFICER_JENNY");
    },
  },
});

defineMap("VermilionPokecenter", { generic: true });
defineMap("VermilionPidgeyHouse", {
  texts: {
    async VermilionPidgeyHousePidgeyText(g) { g.cry("PIDGEY"); await g.delay(40); },
  },
});
defineMap("VermilionTradeHouse", { generic: true });

defineMap("VermilionOldRodHouse", {
  texts: {
    async VermilionOldRodHouseFishingGuruText(g) {
      const guru = "VermilionOldRodHouseFishingGuruText.";
      if (g.hasItem("OLD_ROD")) return g.text(guru + "HowAreTheFishBitingText");
      await g.text(guru + "DoYouLikeToFishText", { wait: false });
      if (!(await g.yesNo())) return g.text(guru + "ThatsSoDisappointingText");
      if (!g.give("OLD_ROD")) return g.text(guru + "NoRoomText");
      await g.text(guru + "TakeThisText");
    },
  },
});

// ---------------------------------------------------------------- Pokémon Fan Club

defineMap("PokemonFanClub", {
  // The original also has Pikachu dash to the Seel when it enters with the player and wanders off the leash.
  // API REQUEST: Pikachu movement scripts (ApplyPikachuMovementData) and a temporary follower pause.
  generic: true,
  texts: {
    async PokemonFanClubClefairyFanText(g) {
      const t = "PokemonFanClubClefairyFanText.";
      if (g.ev("EVENT_LEFT_FANCLUB_AFTER_BIKE_VOUCHER")) return g.text(t + "yellowtext");
      if (g.ev("EVENT_PIKACHU_FAN_BOAST")) {
        g.reset("EVENT_PIKACHU_FAN_BOAST");
        return g.text(t + "bettertext");
      }
      g.set("EVENT_SEEL_FAN_BOAST");
      await g.text(t + "normaltext");
    },
    async PokemonFanClubSeelFanText(g) {
      const t = "PokemonFanClubSeelFanText.";
      if (g.ev("EVENT_LEFT_FANCLUB_AFTER_BIKE_VOUCHER")) return g.text(t + "yellowtext");
      if (g.ev("EVENT_SEEL_FAN_BOAST")) {
        g.reset("EVENT_SEEL_FAN_BOAST");
        return g.text(t + "bettertext");
      }
      g.set("EVENT_PIKACHU_FAN_BOAST");
      await g.text(t + "normaltext");
    },
    async PokemonFanClubClefairyText(g) {
      await g.text("PokemonFanClubClefairyText.Text");
      g.cry("CLEFAIRY");
      await g.delay(40);
    },
    async PokemonFanClubSeelText(g) {
      await g.text("PokemonFanClubSeelText.Text");
      g.cry("SEEL");
      await g.delay(40);
    },
    async PokemonFanClubChairmanText(g) {
      const t = "PokemonFanClubChairmanText.";
      if (g.ev("EVENT_LEFT_FANCLUB_AFTER_BIKE_VOUCHER")) {
        // Yellow: he offers to print a Pokémon's portrait.
        await g.text("FanClubChairPrintText1", { wait: false });
        if (!(await g.yesNo())) return g.text("FanClubChairPrintText2");
        const slot = await g.choosePartyMon("Print which?");
        if (slot === undefined) return g.text("FanClubChairPrintText2");
        // API REQUEST: Game Boy Printer portrait (PrintFanClubPortrait); nothing is printed here.
        return g.text("FanClubChairPrintText4");
      }
      if (g.ev("EVENT_GOT_BIKE_VOUCHER")) return g.text(t + "FinalText");
      await g.text(t + "IntroText", { wait: false });
      if (!(await g.yesNo())) return g.text(t + "NoStoryText");
      await g.text(t + "StoryText");
      if (!g.give("BIKE_VOUCHER")) return g.text(t + "BagFullText");
      await g.text(t + "BikeVoucherText");
      g.set("EVENT_GOT_BIKE_VOUCHER");
    },
  },
});

// ---------------------------------------------------------------- Vermilion Gym

const GYM_DOOR = [2, 2] as const;
const CLEAR_FLOOR = 0x05, GYM_DOUBLE_DOOR = 0x24;

/** The cans are a 3 wide, 5 tall grid, indexed row by row; the second switch is under a neighbour of the first. */
function trashNeighbours(can: number) {
  const row = Math.floor(can / 3), col = can % 3, out: number[] = [];
  if (col > 0) out.push(can - 1);
  if (col < 2) out.push(can + 1);
  if (row > 0) out.push(can - 3);
  if (row < 4) out.push(can + 3);
  return out;
}

SHARED_TEXTS["hidden:GymTrashScript"] = async g => {
  const can = g.hiddenArg;
  if (g.ev("EVENT_2ND_LOCK_OPENED")) return g.text("VermilionGymTrashText");
  if (!g.ev("EVENT_1ST_LOCK_OPENED")) {
    if (can !== g.vars.gymFirstLock) return g.text("VermilionGymTrashText");
    // The next can is the one with the second switch (either of two neighbours in Yellow).
    g.set("EVENT_1ST_LOCK_OPENED");
    const near = trashNeighbours(can);
    const first = near[random(near.length)];
    const rest = near.filter(n => n !== first);
    g.vars.gymSecondLock = first;
    g.vars.gymSecondLock2 = rest.length ? rest[random(rest.length)] : -1;
    return g.text("VermilionGymTrashSuccessText1");
  }
  if (can === g.vars.gymSecondLock || can === g.vars.gymSecondLock2) {
    g.set("EVENT_2ND_LOCK_OPENED");
    g.setBlock(...GYM_DOOR, CLEAR_FLOOR);
    return g.text("VermilionGymTrashSuccessText3");
  }
  g.reset("EVENT_1ST_LOCK_OPENED");
  g.vars.gymFirstLock = random(8) * 2;
  await g.text("VermilionGymTrashFailText");
};

async function receiveTM24(g: Game) {
  await g.text("TEXT_VERMILIONGYM_LT_SURGE_THUNDER_BADGE_INFO");
  g.set("EVENT_BEAT_LT_SURGE");
  if (g.give("TM_THUNDERBOLT")) {
    await g.text("TEXT_VERMILIONGYM_LT_SURGE_RECEIVED_TM24");
    g.set("EVENT_GOT_TM24");
  } else {
    await g.text("TEXT_VERMILIONGYM_LT_SURGE_TM24_NO_ROOM");
  }
  g.badge(2);
  for (const i of [0, 1, 2]) g.set(`EVENT_BEAT_VERMILION_GYM_TRAINER_${i}`);
}

defineMap("VermilionGym", {
  onEnter(g) {
    // The trash-can switches re-pick the first can on every visit; the door opens once both are found.
    g.vars.gymFirstLock = random(8) * 2;
    g.setBlock(...GYM_DOOR, g.ev("EVENT_2ND_LOCK_OPENED") ? CLEAR_FLOOR : GYM_DOUBLE_DOOR);
  },
  texts: {
    async VermilionGymLTSurgeText(g) {
      if (g.ev("EVENT_BEAT_LT_SURGE")) {
        if (g.ev("EVENT_GOT_TM24")) return g.text("VermilionGymLTSurgeText.PostBattleAdviceText");
        return receiveTM24(g);
      }
      await g.text("VermilionGymLTSurgeText.PreBattleText");
      const won = await g.trainerBattle("LT_SURGE", 1, { win: "VermilionGymLTSurgeReceivedThunderBadgeText" });
      if (won) await receiveTM24(g);
    },
    async VermilionGymGymGuideText(g) {
      await g.text(g.hasBadge(2) ? "VermilionGymGymGuideText.BeatLTSurgeText" : "VermilionGymGymGuideText.ChampInMakingText");
    },
    async VermilionGymTrashSuccessText1(g) { g.sfx("SFX_SWITCH"); await g.delay(30); },
    async VermilionGymTrashSuccessText3(g) { g.sfx("SFX_GO_INSIDE"); await g.delay(30); },
    async VermilionGymTrashFailText(g) { g.sfx("SFX_DENIED"); await g.delay(30); },
  },
});

// ---------------------------------------------------------------- Vermilion Dock

const DOCK_BLOCKS: [number, number][] = [[5, 2], [6, 2], [7, 2], [8, 2]];

defineMap("VermilionDock", {
  async onStep(g) {
    if (g.ev("EVENT_STARTED_WALKING_OUT_OF_DOCK")) return;
    if (!g.ev("EVENT_GOT_HM01")) return;
    // Only when arriving from the S.S. Anne (the dock's second warp).
    if (!at(g, 14, 2)) return;
    if (!g.ev("EVENT_SS_ANNE_LEFT")) await ssAnneLeaves(g);
    g.set("EVENT_STARTED_WALKING_OUT_OF_DOCK");
    await g.delay(3);
    await g.move("player", "U2");
    g.set("EVENT_WALKED_OUT_OF_DOCK");
    await g.warp("VERMILION_CITY", 18, 31, "up");
  },
});

/** The S.S. Anne sails away. */
async function ssAnneLeaves(g: Game) {
  g.set("EVENT_SS_ANNE_LEFT");
  g.music("MUSIC_SURFING");
  await g.delay(120);
  // API REQUEST: the horn's smoke puffs and the scrolling ship (VermilionDockSSAnneLeavesScript); only the
  // horn, the pause and the water blocks the original writes are reproduced.
  g.sfx("SFX_SS_ANNE_HORN");
  await g.delay(120);
  for (const [x, y] of DOCK_BLOCKS) g.setBlock(x, y, 0x0d);
  g.sfx("SFX_SS_ANNE_HORN");
  await g.delay(120);
  g.music();
}

// ---------------------------------------------------------------- S.S. Anne

const RIVAL_2F = 2;

defineMap("SSAnne1F", { generic: true });
defineMap("SSAnne3F", { generic: true });
defineMap("SSAnneBow", { generic: true });
defineMap("SSAnne2FRooms", {
  generic: true,
  texts: {
    async SSAnne2FRoomsGentleman3Text(g) {
      await g.text("SSAnne2FRoomsGentleman3Text.Text");
      await g.showDex("SNORLAX");
    },
  },
});
defineMap("SSAnne1FRooms", {
  generic: true,
  texts: {
    async SSAnne1FRoomsWigglytuffText(g) { g.cry("WIGGLYTUFF"); await g.delay(40); },
  },
});
defineMap("SSAnneB1FRooms", {
  generic: true,
  texts: {
    async SSAnneB1FRoomsMachokeText(g) { g.cry("MACHOKE"); await g.delay(40); },
  },
});

defineMap("SSAnneKitchen", {
  generic: true,
  texts: {
    async SSAnneKitchenCook7Text(g) {
      await g.text("SSAnneKitchenCook7Text.MainCourseIsText");
      const dish = ["SSAnneKitchenCook7Text.SalmonDuSaladText", "SSAnneKitchenCook7Text.EelsAuBarbecueText", "SSAnneKitchenCook7Text.PrimeBeefSteakText"];
      await g.text(dish[random(3)]);
    },
  },
});

defineMap("SSAnne2F", {
  async onStep(g) {
    if (g.state === 4) return;
    const onRight = at(g, 37, 8);
    if (!onRight && !at(g, 36, 8)) return;
    g.music("MUSIC_MEET_RIVAL");
    g.show("HS_SS_ANNE_2F_RIVAL");
    await g.delay(3);
    await g.move(RIVAL_2F, onRight ? "D4" : "D3");
    const face = () => {
      g.face(RIVAL_2F, onRight ? "right" : "down");
      if (onRight) g.face("player", "left");
    };
    face();
    await g.text("TEXT_SSANNE2F_RIVAL");
    await g.delay(3);
    const won = await g.trainerBattle("RIVAL2", 1, { win: "SSAnne2FRivalDefeatedText", lose: "SSAnne2FRivalVictoryText" });
    if (!won) return;
    face();
    await g.text("TEXT_SSANNE2F_RIVAL_CUT_MASTER");
    g.music("MUSIC_MEET_RIVAL");
    await g.move(RIVAL_2F, onRight ? "D4" : "RD5");
    g.hide("HS_SS_ANNE_2F_RIVAL");
    g.music();
    g.state = 4;
  },
  texts: {
    async SSAnne2FRivalText(g) {
      // The battle itself is started by the map script.
      await g.text("SSAnne2FRivalText.Text");
    },
  },
});

defineMap("SSAnneCaptainsRoom", {
  // The original only stops the Captain from turning to face the player until he has been cured.
  generic: true,
  texts: {
    async SSAnneCaptainsRoomCaptainText(g) {
      if (g.ev("EVENT_GOT_HM01")) return g.text("SSAnneCaptainsRoomCaptainNotSickAnymoreText");
      await g.text("SSAnneCaptainsRoomRubCaptainsBackText");
      await g.text("SSAnneCaptainsRoomCaptainIFeelMuchBetterText");
      if (!g.give("HM_CUT")) return g.text("SSAnneCaptainsRoomCaptainHM01NoRoomText");
      await g.text("SSAnneCaptainsRoomCaptainReceivedHM01Text");
      g.set("EVENT_GOT_HM01");
    },
    async SSAnneCaptainsRoomRubCaptainsBackText(g) {
      g.music("MUSIC_PKMN_HEALED");
      await g.delay(150);
      g.music();
      g.set("EVENT_RUBBED_CAPTAINS_BACK");
    },
  },
});

// ---------------------------------------------------------------- Route 11, Diglett's Cave, Rock Tunnel

defineMap("DiglettsCaveRoute11", { generic: true });
defineMap("Route11", { generic: true });
defineMap("RockTunnelPokecenter", { generic: true });
defineMap("RockTunnel1F", { generic: true });
defineMap("RockTunnelB1F", { generic: true });

defineMap("Route11Gate2F", {
  generic: true,
  texts: {
    async Route11Gate2FYoungsterText(g) { await g.trade(0); }, // TRADE_FOR_GURIO
    async Route11Gate2FOaksAideText(g) {
      if (!g.ev("EVENT_GOT_ITEMFINDER") && !(await oaksAide(g, 30, "ITEMFINDER"))) return;
      g.set("EVENT_GOT_ITEMFINDER");
      await g.text("Route11Gate2FOaksAideText.ItemfinderDescriptionText");
    },
    async Route11Gate2FLeftBinocularsText(g) {
      if (g.player.facing !== "up") return;
      await g.text(g.ev("EVENT_BEAT_ROUTE12_SNORLAX") ? "Route11Gate2FLeftBinocularsText.NoSnorlaxText" : "Route11Gate2FLeftBinocularsText.SnorlaxText");
    },
    async Route11Gate2FRightBinocularsText(g) {
      if (g.player.facing === "up") await g.text("Route11Gate2FRightBinocularsText.Text");
    },
  },
});

// ---------------------------------------------------------------- Route 12

/** Snorlax wakes up (EVENT_FIGHT_ROUTE12_SNORLAX is set by the Poké Flute) and attacks. */
async function route12Snorlax(g: Game) {
  if (g.ev("EVENT_BEAT_ROUTE12_SNORLAX") || !g.ev("EVENT_FIGHT_ROUTE12_SNORLAX")) return;
  g.reset("EVENT_FIGHT_ROUTE12_SNORLAX");
  await g.text("TEXT_ROUTE12_SNORLAX_WOKE_UP");
  g.hide("HS_ROUTE_12_SNORLAX");
  const result = await g.wildBattle("SNORLAX", 30);
  if (result === "lose") return;
  if (result !== "caught") await g.text("TEXT_ROUTE12_SNORLAX_CALMED_DOWN");
  g.set("EVENT_BEAT_ROUTE12_SNORLAX");
  await g.delay(3);
}

defineMap("Route12", {
  async onStep(g) {
    await route12Snorlax(g);
  },
});

defineMap("Route12Gate2F", {
  generic: true,
  texts: {
    async Route12Gate2FBrunetteGirlText(g) {
      const t = "Route12Gate2FBrunetteGirlText.";
      if (g.ev("EVENT_GOT_TM39")) return g.text(t + "TM39ExplanationText");
      await g.text(t + "YouCanHaveThisText");
      if (!g.give("TM_SWIFT")) return g.text(t + "TM39NoRoomText");
      await g.text(t + "ReceivedTM39Text");
      g.set("EVENT_GOT_TM39");
    },
    async Route12Gate2FLeftBinocularsText(g) {
      if (g.player.facing === "up") await g.text("Route12Gate2FLeftBinocularsText.Text");
    },
    async Route12Gate2FRightBinocularsText(g) {
      if (g.player.facing === "up") await g.text("Route12Gate2FRightBinocularsText.Text");
    },
  },
});

defineMap("Route12SuperRodHouse", {
  texts: {
    async Route12SuperRodHouseFishingGuruText(g) {
      const t = "Route12SuperRodHouseFishingGuruText.";
      if (g.hasItem("SUPER_ROD")) return g.text(t + "TryFishingText");
      await g.text(t + "DoYouLikeToFishText", { wait: false });
      if (!(await g.yesNo())) return g.text(t + "ThatsDisappointingText");
      if (!g.give("SUPER_ROD")) return g.text(t + "NoRoomText");
      await g.text(t + "ReceivedSuperRodText");
    },
  },
});

// ---------------------------------------------------------------- Lavender Town

defineMap("LavenderTown", {
  generic: true,
  texts: {
    async LavenderTownLittleGirlText(g) {
      const t = "LavenderTownLittleGirlText.";
      await g.text(t + "DoYouBelieveInGhostsText", { wait: false });
      await g.text(t + ((await g.yesNo()) ? "SoThereAreBelieversText" : "HaHaGuessNotText"));
    },
  },
});

defineMap("LavenderPokecenter", { generic: true });

defineMap("LavenderMart", {
  texts: {
    async LavenderMartCooltrainerMText(g) {
      await g.text(g.ev("EVENT_RESCUED_MR_FUJI") ? "LavenderMartCooltrainerMText.NuggetText" : "LavenderMartCooltrainerMText.ReviveText");
    },
  },
});

defineMap("LavenderCuboneHouse", {
  texts: {
    async LavenderCuboneHouseCuboneText(g) { g.cry("CUBONE"); await g.delay(40); },
    async LavenderCuboneHouseBrunetteGirlText(g) {
      await g.text(g.ev("EVENT_RESCUED_MR_FUJI") ? "LavenderCuboneHouseBrunetteGirlText.TheGhostIsGoneText" : "LavenderCuboneHouseBrunetteGirlText.PoorCubonesMotherText");
    },
  },
});

defineMap("MrFujisHouse", {
  texts: {
    async MrFujisHouseSuperNerdText(g) {
      await g.text(g.ev("EVENT_RESCUED_MR_FUJI") ? "MrFujisHouseSuperNerdText.MrFujiHadBeenPrayingText" : "MrFujisHouseSuperNerdText.MrFujiIsntHereText");
    },
    async MrFujisHouseLittleGirlText(g) {
      await g.text(g.ev("EVENT_RESCUED_MR_FUJI") ? "MrFujisHouseLittleGirlText.PokemonAreNiceToHugText" : "MrFujisHouseLittleGirlText.ThisIsMrFujisHouseText");
    },
    async MrFujisHousePsyduckText(g) { g.cry("PSYDUCK"); await g.delay(40); },
    async MrFujisHouseNidorinoText(g) { g.cry("NIDORINO"); await g.delay(40); },
    async MrFujisHouseMrFujiText(g) {
      const t = "MrFujisHouseMrFujiText.";
      if (g.ev("EVENT_GOT_POKE_FLUTE")) return g.text(t + "HasMyFluteHelpedYouText");
      await g.text(t + "IThinkThisMayHelpYourQuestText");
      if (!g.give("POKE_FLUTE")) return g.text(t + "PokeFluteNoRoomText");
      await g.text(t + "ReceivedPokeFluteText");
      g.set("EVENT_GOT_POKE_FLUTE");
    },
  },
});

defineMap("NameRatersHouse", {
  texts: {
    async NameRatersHouseNameRaterText(g) {
      const t = "NameRatersHouseNameRaterText.";
      await g.text(t + "WantMeToRateText", { wait: false });
      if (!(await g.yesNo())) return g.text(t + "ComeAnyTimeYouLikeText");
      await g.text(t + "WhichPokemonText");
      const slot = await g.choosePartyMon("Rate which?");
      const mon = slot === undefined ? undefined : g.save.party[slot];
      if (slot === undefined || !mon) return g.text(t + "ComeAnyTimeYouLikeText");
      g.textVar("wNameBuffer", mon.nickname);
      // A Pokémon the player did not receive from the original trainer (traded) has a name that is already perfect.
      if (mon.ot_id !== g.vars.otId || mon.ot_name !== g.save.name) return g.text(t + "ATrulyImpeccableNameText");
      await g.text(t + "GiveItANiceNameText", { wait: false });
      if (!(await g.yesNo())) return g.text(t + "ComeAnyTimeYouLikeText");
      await g.text(t + "WhatShouldWeNameItText");
      if (!(await g.rename(slot))) return g.text(t + "ComeAnyTimeYouLikeText");
      await g.text(t + "PokemonHasBeenRenamedText");
    },
  },
});

// ---------------------------------------------------------------- Pokémon Tower

defineMap("PokemonTower1F", { generic: true });
defineMap("PokemonTower3F", { generic: true });
defineMap("PokemonTower4F", { generic: true });

const TOWER_RIVAL = 1;

/** The rival waits on 2F; after the battle he leaves toward the stairs. */
async function towerRival(g: Game, playerOnRight: boolean) {
  g.music("MUSIC_MEET_RIVAL");
  if (playerOnRight) g.set("EVENT_POKEMON_TOWER_RIVAL_ON_LEFT");
  else g.reset("EVENT_POKEMON_TOWER_RIVAL_ON_LEFT");
  g.face("player", playerOnRight ? "left" : "up");
  g.face(TOWER_RIVAL, playerOnRight ? "right" : "down");
  await g.delay(3);
  await g.text("PokemonTower2FRivalText.WhatBringsYouHereText");
  const won = await g.trainerBattle("RIVAL2", (g.vars.rivalStarter ?? 1) + 1, {
    win: "PokemonTower2FRivalText.DefeatedText", lose: "PokemonTower2FRivalText.VictoryText",
  });
  if (!won) return;
  g.set("EVENT_BEAT_POKEMON_TOWER_RIVAL");
  await g.text("PokemonTower2FRivalText.HowsYourDexText");
  g.music("MUSIC_MEET_RIVAL");
  await g.move(TOWER_RIVAL, playerOnRight ? "D2R4D2" : "RD2RD2R2");
  g.hide("HS_POKEMON_TOWER_2F_RIVAL");
  g.music();
}

defineMap("PokemonTower2F", {
  async onStep(g) {
    if (g.ev("EVENT_BEAT_POKEMON_TOWER_RIVAL")) return;
    if (at(g, 15, 5)) await towerRival(g, true);
    else if (at(g, 14, 6)) await towerRival(g, false);
  },
  texts: {
    async PokemonTower2FRivalText(g) {
      if (g.ev("EVENT_BEAT_POKEMON_TOWER_RIVAL")) return g.text("PokemonTower2FRivalText.HowsYourDexText");
      await towerRival(g, g.player.x > (g.npc(TOWER_RIVAL)?.x ?? 0));
    },
  },
});

defineMap("PokemonTower5F", {
  async onStep(g) {
    // The purified zone heals the party once, on entering.
    const inZone = g.player.x >= 10 && g.player.x <= 11 && g.player.y >= 8 && g.player.y <= 9;
    // BIT_NO_BATTLES: no wild battles inside the purified zone.
    g.vars.noWildBattles = inZone ? 1 : 0;
    if (!inZone) {
      g.reset("EVENT_IN_PURIFIED_ZONE");
      return;
    }
    if (g.ev("EVENT_IN_PURIFIED_ZONE")) return;
    g.set("EVENT_IN_PURIFIED_ZONE");
    g.heal();
    await g.fade();
    await g.delay(6);
    await g.text("TEXT_POKEMONTOWER5F_PURIFIEDZONE");
  },
});

defineMap("PokemonTower6F", {
  async onStep(g) {
    if (g.ev("EVENT_BEAT_GHOST_MAROWAK") || !at(g, 10, 16)) return;
    await g.text("TEXT_POKEMONTOWER6F_BEGONE");
    const result = await g.wildBattle("MAROWAK", 30, { ghost: true });
    if (result === "lose") return;
    if (result === "win" || result === "caught") {
      g.set("EVENT_BEAT_GHOST_MAROWAK");
      await g.text("TEXT_POKEMONTOWER6F_MAROWAK_DEPARTED");
      return;
    }
    // The ghost cannot be identified: the player is pushed one step to the right.
    await g.move("player", "R");
    await g.delay(3);
  },
  texts: {
    async PokemonTower6FMarowakDepartedText(g) {
      await g.text("PokemonTower6FGhostWasCubonesMotherText");
      g.cry("MAROWAK");
      await g.delay(90);
      await g.text("PokemonTower6FSoulWasCalmedText");
    },
  },
});

const JESSIE = 1, JAMES = 2;

/** Jessie and James. Their line is printed, then the player turns up with a "!". */
async function jessieJamesAppear(g: Game) {
  await g.delay(10);
  g.face("player", "up");
  await g.emote("player", "exclamation");
  await g.delay(20);
}

const jessieJamesText = async (g: Game) => {
  await jessieJamesAppear(g);
};

defineMap("PokemonTower7F", {
  async onStep(g) {
    if (g.ev("EVENT_BEAT_POKEMONTOWER_7_JESSIE_JAMES") || g.player.y !== 12) return;
    // Player at x = 10: they come down on either side; at x = 11 they swap places.
    const left = g.player.x === 11;
    if (!left && g.player.x !== 10) return;
    if (left) g.set("EVENT_POKEMONTOWER_7_JESSIE_JAMES_ON_LEFT");
    else g.reset("EVENT_POKEMONTOWER_7_JESSIE_JAMES_ON_LEFT");
    g.music("MUSIC_MEET_JESSIE_JAMES");
    g.show("HS_POKEMON_TOWER_7F_JESSIE");
    g.show("HS_POKEMON_TOWER_7F_JAMES");
    await g.delay(3);
    await g.text("TEXT_POKEMONTOWER7F_TEXT4", { wait: false });
    await Promise.all([g.move(JESSIE, left ? "D4" : "D3"), g.move(JAMES, left ? "D3" : "D4")]);
    g.face(JESSIE, left ? "right" : "down");
    g.face(JAMES, left ? "down" : "left");
    await g.delay(3);
    await g.text("TEXT_POKEMONTOWER7F_TEXT5");
    const won = await g.trainerBattle("ROCKET", 0x2c);
    if (!won) return;
    g.face(JESSIE, "down");
    g.face(JAMES, "down");
    await g.text("TEXT_POKEMONTOWER7F_TEXT6", { wait: false });
    g.music("MUSIC_MEET_JESSIE_JAMES");
    await g.fade(() => {
      g.hide("HS_POKEMON_TOWER_7F_JESSIE");
      g.hide("HS_POKEMON_TOWER_7F_JAMES");
    });
    g.music();
    g.set("EVENT_BEAT_POKEMONTOWER_7_JESSIE_JAMES");
  },
  texts: {
    PokemonTower7FText4: jessieJamesText,
    PokemonTower7FJessieJamesText: jessieJamesText,
    async PokemonTower7FText6(g) { await g.delay(64); },
    async PokemonTower7FMrFujiText(g) {
      await g.text("PokemonTower7FMrFujiText.RescueText");
      g.set("EVENT_RESCUED_MR_FUJI");
      g.set("EVENT_RESCUED_MR_FUJI_2");
      g.show("HS_MR_FUJIS_HOUSE_MR_FUJI");
      g.hide("HS_SAFFRON_CITY_E");
      g.show("HS_SAFFRON_CITY_F");
      g.hide("HS_POKEMON_TOWER_7F_MR_FUJI");
      // Mr. Fuji takes the player home: Mr. Fuji's House warp 2, with Lavender Town as the town outside.
      g.save.lastMap = MAP.LAVENDER_TOWN;
      await g.warp("MR_FUJIS_HOUSE", 3, 7, "up");
    },
  },
});
