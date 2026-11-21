// Pallet Town, the player's and rival's homes, and Professor Oak's lab.
import { defineMap, type Game } from "../script";

const OAK = 1;

defineMap("PalletTown", {
  async onStep(g) {
    if (g.ev("EVENT_GOT_POKEBALLS_FROM_OAK")) g.set("EVENT_PALLET_AFTER_GETTING_POKEBALLS");
    // Daisy gets up from the table once the player has the Town Map.
    if (!g.ev("EVENT_DAISY_WALKING") && g.ev("EVENT_GOT_TOWN_MAP") && g.ev("EVENT_ENTERED_BLUES_HOUSE")) {
      g.set("EVENT_DAISY_WALKING");
      g.hide("HS_DAISY_SITTING");
      g.show("HS_DAISY_WALKING");
    }
    if (g.ev("EVENT_GOT_POKEBALLS_FROM_OAK")) g.set("EVENT_PALLET_AFTER_GETTING_POKEBALLS_2");
    if (g.ev("EVENT_FOLLOWED_OAK_INTO_LAB") || g.player.y !== 0) return;
    await oakStopsPlayer(g);
  },
  texts: {
    async "PalletTownOakText"(g) {
      // Talking to Oak is only possible during his scene; repeat his last line.
      await g.text("PalletTownOakText.WhewText");
    },
    async "PalletTownOakText.HeyWaitDontGoOutText"(g) {
      await g.delay(10);
      g.face("player", "down");
      await g.emote("player", "exclamation");
    },
  },
});

/** Oak stops the player at the edge of the tall grass and catches Pikachu. */
async function oakStopsPlayer(g: Game) {
  const right = g.player.x !== 10;
  if (right) g.set("EVENT_PLAYER_AT_RIGHT_EXIT_TO_PALLET_TOWN");
  else g.reset("EVENT_PLAYER_AT_RIGHT_EXIT_TO_PALLET_TOWN");
  g.face("player", "up");
  g.music("MUSIC_MEET_PROF_OAK");
  g.set("EVENT_OAK_APPEARED_IN_PALLET");
  await g.text("PalletTownOakText.HeyWaitDontGoOutText");
  g.show("HS_PALLET_TOWN_OAK");
  g.place(OAK, 10, 4, "up");
  await g.approach(OAK);
  g.face("player", "down");
  await g.text("PalletTownOakText.ThatWasCloseText");
  // Oak turns toward the grass where a wild Pikachu is hiding.
  g.face(OAK, right ? "right" : "left");
  await g.delay(20);
  await g.showcase("PIKACHU", [
    "A wild PIKACHU appeared!",
    "OAK used POKé BALL!",
    "All right! PIKACHU was caught!",
  ]);
  g.face(OAK, "up");
  await g.text("PalletTownOakText.WhewText");
  await g.text("TEXT_PALLETTOWN_OAK_COME_WITH_ME");
  // Oak leads the player to his lab.
  g.music("MUSIC_MUSEUM_GUY");
  const oak = g.npc(OAK)!;
  if (g.player.x !== 10) {
    await g.move(OAK, "L".repeat(g.player.x - 10));
    await g.move("player", "L".repeat(g.player.x - 10));
  }
  void oak;
  await Promise.all([
    g.move(OAK, "D6L1D5R3U1"),
    g.move("player", "D7L1D5R3"),
  ]);
  g.hide("HS_PALLET_TOWN_OAK");
  g.music();
  await g.warp("OAKS_LAB", 5, 11, "up");
}

defineMap("RedsHouse1F", {
  texts: {
    async RedsHouse1FPrintMomText(g) {
      if (!g.vars.gotStarter) return g.text("RedsHouse1FPrintMomText.WakeUpText");
      await g.text("RedsHouse1FMomYouShouldRestText");
      await g.fade(() => g.heal());
      g.music("MUSIC_PKMN_HEALED");
      await g.delay(120);
      g.music();
      await g.text("RedsHouse1FMomLookingGreatText");
    },
    async RedsHouse1FPrintTVText(g) {
      await g.text(g.player.facing === "up" ? "RedsHouse1FPrintTVText.StandByMeMovieText" : "RedsHouse1FPrintTVText.WrongSideText");
    },
  },
});

defineMap("BluesHouse", {
  onEnter(g) {
    g.set("EVENT_ENTERED_BLUES_HOUSE");
  },
  texts: {
    async BluesHouseDaisySittingText(g) {
      if (g.ev("EVENT_GOT_TOWN_MAP")) return g.text("BluesHouseDaisyUseMapText");
      if (!g.ev("EVENT_GOT_POKEDEX")) return g.text("BluesHouseDaisyRivalAtLabText");
      await g.text("BluesHouseDaisyOfferMapText");
      if (!g.give("TOWN_MAP")) return g.text("BluesHouseDaisyBagFullText");
      g.hide("HS_TOWN_MAP");
      await g.text("GotMapText");
      g.set("EVENT_GOT_TOWN_MAP");
    },
  },
});

const RIVAL = 1, BALL = 2, OAK1 = 3, OAK2 = 6;

defineMap("OaksLab", {
  async onStep(g) {
    // Oak walks in right ahead of the player and takes his place at the desk.
    if (g.ev("EVENT_OAK_APPEARED_IN_PALLET") && !g.ev("EVENT_FOLLOWED_OAK_INTO_LAB_2")) {
      g.show("HS_OAKS_LAB_OAK_2");
      g.place(OAK2, 5, 10, "up");
      await g.move(OAK2, "U3");
      g.hide("HS_OAKS_LAB_OAK_2");
      g.show("HS_OAKS_LAB_OAK_1");
      await g.move("player", "U8");
      g.face(RIVAL, "down");
      g.face(OAK1, "down");
      g.set("EVENT_FOLLOWED_OAK_INTO_LAB");
      g.set("EVENT_FOLLOWED_OAK_INTO_LAB_2");
      g.face(RIVAL, "up");
      g.music();
      g.set("EVENT_OAK_ASKED_TO_CHOOSE_MON");
      await g.text("TEXT_OAKSLAB_RIVAL_FED_UP_WITH_WAITING");
      await g.text("TEXT_OAKSLAB_OAK_CHOOSE_MON");
      g.face(RIVAL, "up");
      await g.text("TEXT_OAKSLAB_RIVAL_WHAT_ABOUT_ME");
      await g.text("TEXT_OAKSLAB_OAK_BE_PATIENT");
      return;
    }
    // Before choosing, Oak calls the player back from the door.
    if (g.ev("EVENT_OAK_ASKED_TO_CHOOSE_MON") && !g.ev("EVENT_GOT_STARTER") && g.player.y === 6) {
      g.face(OAK1, "down");
      g.face(RIVAL, "down");
      await g.text("TEXT_OAKSLAB_OAK_DONT_GO_AWAY_YET");
      await g.move("player", "U");
      return;
    }
    // The rival challenges the player on the way out.
    if (g.ev("EVENT_GOT_STARTER") && !g.ev("EVENT_BATTLED_RIVAL_IN_OAKS_LAB") && g.player.y === 6) {
      g.face("player", "up");
      g.face(RIVAL, "down");
      g.music("MUSIC_MEET_RIVAL");
      await g.text("TEXT_OAKSLAB_RIVAL_ILL_TAKE_YOU_ON");
      await g.approach(RIVAL);
      g.face("player", "up");
      g.music();
      const won = await g.trainerBattle("RIVAL1", 1, {
        canLose: true, win: "OaksLabRivalIPickedTheWrongPokemonText", lose: "OaksLabRivalAmIGreatOrWhatText",
      });
      // Eevee becomes Vaporeon if the player lost; otherwise Flareon (or Jolteon after Route 22).
      g.vars.rivalStarter = won ? 2 : 1;
      g.heal();
      g.set("EVENT_BATTLED_RIVAL_IN_OAKS_LAB");
      await g.delay(20);
      await g.text("TEXT_OAKSLAB_RIVAL_SMELL_YOU_LATER");
      g.music("MUSIC_MEET_RIVAL");
      const rival = g.npc(RIVAL)!;
      await g.move(RIVAL, (g.player.x === 4 ? "R" : "L") + "D5", { ignoreCollision: true });
      void rival;
      g.face("player", "down");
      g.hide("HS_OAKS_LAB_RIVAL");
      g.music();
      // Pikachu refuses its Poké Ball.
      g.face("player", "up");
      g.follower(true);
      g.cry("PIKACHU");
      await g.text("TEXT_OAKSLAB_PIKACHU_DISLIKES_POKEBALLS1");
      await g.text("TEXT_OAKSLAB_PIKACHU_DISLIKES_POKEBALLS2");
    }
  },
  texts: {
    async OaksLabRivalText(g) {
      if (!g.ev("EVENT_FOLLOWED_OAK_INTO_LAB_2")) return g.text("OaksLabRivalText.GrampsIsntAroundText");
      if (!g.ev("EVENT_GOT_STARTER")) return g.text("OaksLabRivalText.IllGetABetterPokemonThanYou");
      await g.text("OaksLabRivalText.MyPokemonLooksStrongerText");
    },
    async OaksLabEeveePokeBallText(g) {
      if (!g.ev("EVENT_OAK_ASKED_TO_CHOOSE_MON") || g.ev("EVENT_GOT_STARTER")) return g.text("OaksLabEeveePokeBallText.Text");
      // The rival grabs the Poké Ball before the player can.
      await g.emote(RIVAL, "exclamation");
      await g.move(RIVAL, "D");
      const pushed = g.player.y === 4;
      await Promise.all([g.move(RIVAL, "R3", { ignoreCollision: true }), pushed ? g.delay(14).then(() => g.move("player", "RR", { ignoreCollision: true })) : Promise.resolve()]);
      g.face("player", "left");
      g.hide("HS_STARTER_BALL_1");
      g.face(RIVAL, "up");
      g.textVar("wNameBuffer", "EEVEE");
      await g.text("TEXT_OAKSLAB_RIVAL_RECEIVED_MON");
      // Oak calls the player over and hands over the Pikachu he caught.
      if (g.player.y === 4) await g.move("player", "LDL3U2", { ignoreCollision: true });
      else await g.move("player", "L", { ignoreCollision: true });
      g.face("player", "up");
      await givePikachu(g);
    },
    async OaksLabOak1Text(g) {
      const owned = g.save.caught.length;
      if (g.ev("EVENT_PALLET_AFTER_GETTING_POKEBALLS") || owned >= 2) {
        if (g.ev("EVENT_PALLET_AFTER_GETTING_POKEBALLS") || g.ev("EVENT_GOT_POKEBALLS_FROM_OAK")) {
          await g.text("OaksLabOak1Text.HowIsYourPokedexComingText");
          return dexRating(g);
        }
      }
      if (g.hasItem("POKE_BALL") || owned >= 2) return g.text("OaksLabOak1Text.ComeSeeMeSometimesText");
      if (g.ev("EVENT_BEAT_ROUTE22_RIVAL_1ST_BATTLE")) {
        if (g.ev("EVENT_GOT_POKEBALLS_FROM_OAK")) return g.text("OaksLabOak1Text.ComeSeeMeSometimesText");
        g.set("EVENT_GOT_POKEBALLS_FROM_OAK");
        g.give("POKE_BALL", 5);
        return g.text("OaksLabOak1Text.GivePokeballsText");
      }
      if (g.ev("EVENT_GOT_POKEDEX")) return g.text("OaksLabOak1Text.PokemonAroundTheWorldText");
      if (g.ev("EVENT_BATTLED_RIVAL_IN_OAKS_LAB")) {
        if (!g.hasItem("OAKS_PARCEL")) return g.text("OaksLabOak1Text.YouShouldTalkToIt");
        await g.text("OaksLabOak1Text.DeliverParcelText");
        g.take("OAKS_PARCEL");
        return rivalArrivesForPokedex(g);
      }
      if (g.vars.gotStarter) return g.text("OaksLabOak1Text.YourPokemonCanFightText");
      await g.text("OaksLabOak1Text.GoAheadItsYours");
    },
  },
});

async function givePikachu(g: Game) {
  g.textVar("wNameBuffer", "PIKACHU");
  await g.text("OaksLabOakGivesText", { wait: false });
  await g.text("OaksLabReceivedText");
  const mon = await g.giveMon("PIKACHU", 5, { message: false });
  if (mon) mon.happiness = 90;
  g.set("EVENT_GOT_STARTER");
  g.vars.gotStarter = 1;
  g.vars.pikachuStarter = 0;
}

async function rivalArrivesForPokedex(g: Game) {
  g.music("MUSIC_MEET_RIVAL");
  await g.text("TEXT_OAKSLAB_RIVAL_GRAMPS");
  // The rival walks in from the door to stand beside the player.
  const x = g.player.y === 3 ? 6 : g.player.y === 1 ? 6 : g.player.x === 4 ? 6 : 4;
  const y = g.player.y === 3 ? 11 : g.player.y === 1 ? 9 : 10;
  const steps = g.player.y === 3 ? 4 : g.player.y === 1 ? 2 : 3;
  g.show("HS_OAKS_LAB_RIVAL");
  g.place(RIVAL, x, y, "up");
  await g.move(RIVAL, "U".repeat(steps));
  g.music();
  const faceUp = () => {
    g.face(RIVAL, "up");
    g.face(OAK1, "down");
  };
  faceUp();
  await g.text("TEXT_OAKSLAB_RIVAL_MY_POKEMON_HAS_GROWN_STRONGER");
  faceUp();
  await g.text("TEXT_OAKSLAB_OAK_I_HAVE_A_REQUEST");
  faceUp();
  await g.text("TEXT_OAKSLAB_OAK_MY_INVENTION_POKEDEX");
  await g.text("TEXT_OAKSLAB_OAK_GOT_POKEDEX");
  g.hide("HS_POKEDEX_1");
  g.hide("HS_POKEDEX_2");
  faceUp();
  await g.text("TEXT_OAKSLAB_OAK_THAT_WAS_MY_DREAM");
  g.face(RIVAL, "right");
  await g.delay(3);
  await g.text("TEXT_OAKSLAB_RIVAL_LEAVE_IT_ALL_TO_ME");
  g.set("EVENT_GOT_POKEDEX");
  g.vars["script:ViridianCity"] = 1;
  g.set("EVENT_OAK_GOT_PARCEL");
  g.hide("HS_LYING_OLD_MAN");
  g.show("HS_OLD_MAN_2");
  g.music("MUSIC_MEET_RIVAL");
  await g.move(RIVAL, "D".repeat(steps));
  g.music();
  g.hide("HS_OAKS_LAB_RIVAL");
  g.set("EVENT_1ST_ROUTE22_RIVAL_BATTLE");
  g.reset("EVENT_2ND_ROUTE22_RIVAL_BATTLE");
  g.set("EVENT_ROUTE22_RIVAL_WANTS_BATTLE");
  g.show("HS_ROUTE_22_RIVAL_1");
}

/** Oak's Pokédex rating, by the number of species owned. */
export async function dexRating(g: Game) {
  const owned = g.save.caught.filter(n => n <= 151).length;
  const seen = g.save.seen.filter(n => n <= 151).length;
  g.textVar("wDexRatingNumMonsSeen", seen);
  g.textVar("wDexRatingNumMonsOwned", owned);
  await g.text("DexCompletionText");
  const tier = Math.min(15, Math.floor(owned / 10));
  await g.text(tier === 15 ? "DexRatingText_Own150To151" : `DexRatingText_Own${tier * 10}To${tier * 10 + 9}`);
}
