// Handlers shared by many maps: hidden objects and common text routines.
import { MAP, SYM } from "../symbols";
import { SHARED_TEXTS, type Game } from "../script";

const hidden = (routine: string, handler: (g: Game) => Promise<void>) => { SHARED_TEXTS["hidden:" + routine] = handler; };

// Item balls are picked up by the runtime before their text runs.
SHARED_TEXTS.PickUpItemText = async () => {};

// Yellow's Pokémon Center Chansey.
SHARED_TEXTS.PokecenterChanseyText = async g => {
  await g.text("NurseChanseyText");
  g.cry("CHANSEY");
};

const BENCH: Record<string, string> = {
  VIRIDIAN_POKECENTER: "ViridianCityPokecenterBenchGuyText", PEWTER_POKECENTER: "PewterCityPokecenterBenchGuyText",
  CERULEAN_POKECENTER: "CeruleanCityPokecenterBenchGuyText", LAVENDER_POKECENTER: "LavenderCityPokecenterBenchGuyText",
  VERMILION_POKECENTER: "VermilionCityPokecenterBenchGuyText", CELADON_POKECENTER: "CeladonCityPokecenterBenchGuyText",
  CELADON_HOTEL: "CeladonCityHotelText", FUCHSIA_POKECENTER: "FuchsiaCityPokecenterBenchGuyText",
  CINNABAR_POKECENTER: "CinnabarIslandPokecenterBenchGuyText", SAFFRON_POKECENTER: "SaffronCityPokecenterBenchGuyText",
  MT_MOON_POKECENTER: "MtMoonPokecenterBenchGuyText", ROCK_TUNNEL_POKECENTER: "RockTunnelPokecenterBenchGuyText",
  SAFARI_ZONE_WEST_REST_HOUSE: "UnusedBenchGuyText1",
};
hidden("PrintBenchGuyText", async g => {
  if (g.player.facing !== "left") return;
  const name = Object.keys(BENCH).find(k => MAP[k] === g.map);
  if (name) await g.text(BENCH[name]);
});

const GYM_BADGES = ["PEWTER_GYM", "CERULEAN_GYM", "VERMILION_GYM", "CELADON_GYM", "FUCHSIA_GYM", "SAFFRON_GYM", "CINNABAR_GYM", "VIRIDIAN_GYM"];
hidden("GymStatues", async g => {
  if (g.player.facing !== "up") return;
  const badge = GYM_BADGES.findIndex(k => MAP[k] === g.map);
  if (badge < 0) return;
  g.textVar("wGymCityName", gymCity(g.mapLabel));
  g.textVar("wGymLeaderName", GYM_LEADERS[badge]);
  await g.text(g.hasBadge(badge) ? "GymStatueText2" : "GymStatueText1");
});
const GYM_LEADERS = ["BROCK", "MISTY", "LT.SURGE", "ERIKA", "KOGA", "SABRINA", "BLAINE", "GIOVANNI"];
function gymCity(label: string) {
  return label.replace(/Gym$/, "").replace(/([a-z])([A-Z])/g, "$1 $2").toUpperCase() + (label.startsWith("Lavender") || label.startsWith("Pallet") ? " TOWN" : label.startsWith("Cinnabar") ? " ISLAND" : " CITY");
}

hidden("PrintNewBikeText", g => g.text("NewBicycleText"));
hidden("PrintMagazinesText", g => g.text("MagazinesText"));
hidden("PrintTrashText", g => g.text("VermilionGymTrashText"));
hidden("PrintBookcaseText", g => g.text("BookcaseText").catch(() => g.text("PokemonBooksText")));
hidden("PrintIndigoPlateauHQText", async g => { if (g.player.facing === "up") await g.text("IndigoPlateauHQText"); });
hidden("PrintFightingDojoText", g => g.text("FightingDojoText"));
hidden("PrintFightingDojoText2", g => g.text("EnemiesOnEverySideText"));
hidden("PrintFightingDojoText3", g => g.text("WhatGoesAroundComesAroundText"));
hidden("DisplayOakLabEmailText", async g => { if (g.player.facing === "up") await g.text("OakLabEmailText"); });
hidden("DisplayOakLabLeftPoster", g => g.text("PushStartText"));
hidden("DisplayOakLabRightPoster", g => g.text(g.save.caught.length < 2 ? "SaveOptionText" : "StrengthsAndWeaknessesText"));
hidden("PrintRedSNESText", g => g.text("RedBedroomSNESText"));
hidden("Route15GateLeftBinoculars", async g => {
  if (g.player.facing !== "up") return;
  g.cry("ARTICUNO");
  await g.text("Route15UpstairsBinocularsText");
});
hidden("FanClubPicture1", g => g.text("FanClubPicture1Text"));
hidden("FanClubPicture2", g => g.text("FanClubPicture2Text"));
hidden("AerodactylFossil", g => g.text("AerodactylFossilText"));
hidden("KabutopsFossil", g => g.text("KabutopsFossilText"));
hidden("CableClubLeftGameboy", g => g.say("The link is not available in this adventure."));
hidden("CableClubRightGameboy", g => g.say("The link is not available in this adventure."));
// The Viridian school's blackboard and notebooks print one of the cartridge's text predefs.
hidden("PrintBlackboardLinkCableText", g => g.predefText(g.hiddenArg));
hidden("PrintNotebookText", g => g.predefText(g.hiddenArg));

/** Notebook pages ask whether to keep reading. */
SHARED_TEXTS.ViridianSchoolNotebook = async g => {
  for (let page = 1; page <= 5; page++) {
    await g.text(`ViridianSchoolNotebookText${page}`);
    if (page >= 4) continue;
    await g.text("TurnPageText", { wait: false });
    if (!(await g.yesNo())) return;
  }
};
/** The school blackboard explains status conditions, one topic at a time. */
SHARED_TEXTS.ViridianSchoolBlackboard = async g => {
  await g.text("ViridianSchoolBlackboardText1");
  const topics = ["SLP", "PSN", "PAR", "BRN", "FRZ"];
  const texts = ["ViridianBlackboardSleepText", "ViridianBlackboardPoisonText", "ViridianBlackboardPrlzText", "ViridianBlackboardBurnText", "ViridianBlackboardFrozenText"];
  for (;;) {
    const pick = await g.choose("Blackboard", [...topics, "Quit"]);
    if (pick === undefined || pick === topics.length) return;
    await g.text(texts[pick]);
  }
};
SHARED_TEXTS.LinkCableHelp = async g => {
  await g.text("LinkCableHelpText1");
  for (;;) {
    const pick = await g.choose("How to link", ["How to link", "Colosseum", "Trade center", "Stop reading"]);
    if (pick === undefined || pick === 3) return;
    await g.text(["LinkCableInfoText1", "LinkCableInfoText2", "LinkCableInfoText3"][pick]);
  }
};
SHARED_TEXTS.TMNotebook = g => g.text("TMNotebook");
SHARED_TEXTS.BookOrSculptureText = async g => {
  const sculpture = g.map === MAP.CELADON_MANSION_1F && false;
  await g.text(sculpture ? "DiglettSculptureText" : "PokemonBooksText");
};
SHARED_TEXTS.ElevatorText = g => g.text("ElevatorText");
SHARED_TEXTS.TownMapText = async g => { await g.townMap(); };
void SYM;

/** Professor Oak's aides give an item once the player owns enough species (engine/events/oaks_aide.asm). */
export async function oaksAide(g: Game, need: number, item: string) {
  const owned = g.save.caught.filter(n => n <= 151).length;
  g.textVar("hOaksAideRequirement", need);
  g.textVar("hOaksAideNumMonsOwned", owned);
  g.textVar("wOaksAideRewardItemName", g.itemName(item));
  await g.text("OaksAideHiText", { wait: false });
  if (!(await g.yesNo())) {
    await g.text("OaksAideComeBackText");
    return false;
  }
  if (owned < need) {
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
