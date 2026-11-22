// Route 23, Victory Road, the Indigo Plateau and the Elite Four, the Hall of Fame,
// Cerulean Cave, the Summer Beach House and the link-cable rooms.
import { defineMap, type Game } from "../script";
import { MAP, MOVE, MON } from "../symbols";

/** In-progress guards for scripted sequences (kept outside the save so a reload can't leave one stuck). */
const busy = new Set<string>();
async function once(key: string, body: () => Promise<void>) {
  if (busy.has(key)) return;
  busy.add(key);
  try {
    await body();
  } finally {
    busy.delete(key);
  }
}

// ---------------------------------------------------------------- Route 23

/** Badge checkpoints, from the top of the route down: Earth first, Cascade last. */
const ROUTE23_GUARD_Y = [35, 56, 85, 96, 105, 119, 136];
const BADGE_NAMES = ["CASCADE", "THUNDER", "RAINBOW", "SOUL", "MARSH", "VOLCANO", "EARTH"];

/** `which` indexes BADGE_NAMES (0 = Cascade). The badge bit is one past it, as Boulder comes first. */
async function route23CheckBadge(g: Game, which: number) {
  g.textVar("wNameBuffer", `${BADGE_NAMES[which]}BADGE`);
  if (!g.hasBadge(which + 1)) {
    await g.text("Route23YouDontHaveTheBadgeYetText");
    g.sfx("SFX_DENIED");
    // The guard turns the player back one step.
    await g.move("player", "D");
    return;
  }
  await g.text("Route23OhThatIsTheBadgeText");
  g.set(`EVENT_PASSED_${BADGE_NAMES[which]}BADGE_CHECK`);
}

const route23Guard = (which: number) => (g: Game) => route23CheckBadge(g, which);

defineMap("Route23", {
  onEnter(g) {
    // Victory Road's boulders are reset whenever the route is entered.
    for (const ev of [
      "EVENT_VICTORY_ROAD_2_BOULDER_ON_SWITCH1", "EVENT_VICTORY_ROAD_2_BOULDER_ON_SWITCH2",
      "EVENT_VICTORY_ROAD_3_BOULDER_ON_SWITCH1", "EVENT_VICTORY_ROAD_3_BOULDER_ON_SWITCH2",
    ]) g.reset(ev);
    g.show("HS_VICTORY_ROAD_3F_BOULDER");
    g.hide("HS_VICTORY_ROAD_2F_BOULDER");
  },
  async onStep(g) {
    const i = ROUTE23_GUARD_Y.indexOf(g.player.y);
    if (i < 0) return;
    // The topmost checkpoint only applies left of the Victory Road gate.
    if (g.player.y === 35 && g.player.x >= 14) return;
    const which = 6 - i;
    if (g.ev(`EVENT_PASSED_${BADGE_NAMES[which]}BADGE_CHECK`)) return;
    await once("Route23", () => route23CheckBadge(g, which));
  },
  texts: {
    Route23Guard1Text: route23Guard(6),
    Route23Guard2Text: route23Guard(5),
    Route23Swimmer1Text: route23Guard(4),
    Route23Swimmer2Text: route23Guard(3),
    Route23Guard3Text: route23Guard(2),
    Route23Guard4Text: route23Guard(1),
    Route23Guard5Text: route23Guard(0),
  },
});

// ------------------------------------------------------------ Victory Road

/** Is any of the given boulder objects standing on (x, y)? */
function boulderAt(g: Game, boulders: number[], x: number, y: number) {
  return boulders.some(i => {
    const n = g.npc(i);
    return !!n && n.x === x && n.y === y;
  });
}

const VR1_BOULDERS = [5, 6, 7];
defineMap("VictoryRoad1F", {
  onEnter(g) {
    if (g.ev("EVENT_VICTORY_ROAD_1_BOULDER_ON_SWITCH")) g.setBlock(4, 6, 0x1d);
  },
  onStep(g) {
    if (g.ev("EVENT_VICTORY_ROAD_1_BOULDER_ON_SWITCH")) return;
    if (!boulderAt(g, VR1_BOULDERS, 17, 13)) return;
    g.set("EVENT_VICTORY_ROAD_1_BOULDER_ON_SWITCH");
    g.setBlock(4, 6, 0x1d);
  },
});

const VR2_BOULDERS = [11, 12, 13];
defineMap("VictoryRoad2F", {
  onEnter(g) {
    g.reset("EVENT_VICTORY_ROAD_1_BOULDER_ON_SWITCH");
    if (g.ev("EVENT_VICTORY_ROAD_2_BOULDER_ON_SWITCH1")) g.setBlock(3, 4, 0x15);
    if (g.ev("EVENT_VICTORY_ROAD_2_BOULDER_ON_SWITCH2")) g.setBlock(11, 7, 0x1d);
  },
  onStep(g) {
    if (!g.ev("EVENT_VICTORY_ROAD_2_BOULDER_ON_SWITCH1") && boulderAt(g, VR2_BOULDERS, 1, 16)) {
      g.set("EVENT_VICTORY_ROAD_2_BOULDER_ON_SWITCH1");
      g.setBlock(3, 4, 0x15);
    }
    if (!g.ev("EVENT_VICTORY_ROAD_2_BOULDER_ON_SWITCH2") && boulderAt(g, VR2_BOULDERS, 9, 16)) {
      g.set("EVENT_VICTORY_ROAD_2_BOULDER_ON_SWITCH2");
      g.setBlock(11, 7, 0x1d);
    }
  },
});

const VR3_BOULDERS = [7, 8, 9, 10];
defineMap("VictoryRoad3F", {
  onEnter(g) {
    if (g.ev("EVENT_VICTORY_ROAD_3_BOULDER_ON_SWITCH1")) g.setBlock(3, 5, 0x1d);
  },
  async onStep(g) {
    if (!g.ev("EVENT_VICTORY_ROAD_3_BOULDER_ON_SWITCH1") && boulderAt(g, VR3_BOULDERS, 3, 5)) {
      g.set("EVENT_VICTORY_ROAD_3_BOULDER_ON_SWITCH1");
      g.setBlock(3, 5, 0x1d);
    }
    // A boulder dropped into the hole lands on Victory Road 2F.
    if (!g.ev("EVENT_VICTORY_ROAD_3_BOULDER_ON_SWITCH2") && boulderAt(g, VR3_BOULDERS, 23, 15)) {
      g.set("EVENT_VICTORY_ROAD_3_BOULDER_ON_SWITCH2");
      g.hide("HS_VICTORY_ROAD_3F_BOULDER");
      g.show("HS_VICTORY_ROAD_2F_BOULDER");
    }
    // The player falls through the hole to Victory Road 2F.
    if (g.player.x === 23 && g.player.y === 15) await once("VictoryRoad3F", () => g.warp("VICTORY_ROAD_2F", 22, 16));
  },
});

// ----------------------------------------------------------- Indigo Plateau

const E4_EVENTS = [
  "EVENT_BEAT_LORELEIS_ROOM_TRAINER_0", "EVENT_AUTOWALKED_INTO_LORELEIS_ROOM",
  "EVENT_BEAT_BRUNOS_ROOM_TRAINER_0", "EVENT_AUTOWALKED_INTO_BRUNOS_ROOM",
  "EVENT_BEAT_AGATHAS_ROOM_TRAINER_0", "EVENT_AUTOWALKED_INTO_AGATHAS_ROOM",
  "EVENT_BEAT_LANCES_ROOM_TRAINER_0", "EVENT_BEAT_LANCE", "EVENT_LANCES_ROOM_LOCK_DOOR",
];

function resetEliteFour(g: Game, includeChampion: boolean) {
  for (const ev of E4_EVENTS) g.reset(ev);
  if (includeChampion) g.reset("EVENT_BEAT_CHAMPION_RIVAL");
  g.vars.championsIntro = 0;
}

defineMap("IndigoPlateauLobby", {
  onEnter(g) {
    g.reset("EVENT_VICTORY_ROAD_1_BOULDER_ON_SWITCH");
    // Starting over after an unfinished run resets the Elite Four.
    if (g.vars.elite4Started) {
      g.vars.elite4Started = 0;
      resetEliteFour(g, false);
    }
  },
});

const E4_ENTRANCE: [number, number][] = [[4, 10], [5, 10], [4, 11], [5, 11]];

interface EliteRoom {
  beat: string;
  autowalk: string;
  open: number;
  closed: number;
  dontRun: string;
  /** Lorelei's room marks the start of the run. */
  first?: boolean;
}

/** Lorelei, Bruno and Agatha: the door behind the player is locked and the exit opens after the win. */
function eliteRoom(label: string, o: EliteRoom) {
  const exit = (g: Game) => {
    const want = g.ev(o.beat) ? o.open : o.closed;
    if (g.block(2, 0) !== want) g.setBlock(2, 0, want);
  };
  defineMap(label, {
    onEnter(g) {
      if (o.first) g.vars.elite4Started = 1;
      exit(g);
    },
    async onStep(g) {
      exit(g);
      const i = E4_ENTRANCE.findIndex(([x, y]) => x === g.player.x && y === g.player.y);
      if (i < 0) return;
      await once(label, async () => {
        // The first time in, the player is walked into the room; otherwise there is no turning back.
        if (i >= 2 && !g.ev(o.autowalk)) {
          g.set(o.autowalk);
          await g.move("player", "U6");
          await g.delay(3);
          return;
        }
        await g.text(o.dontRun);
        await g.move("player", "U");
        await g.delay(3);
      });
    },
  });
}

eliteRoom("LoreleisRoom", {
  beat: "EVENT_BEAT_LORELEIS_ROOM_TRAINER_0", autowalk: "EVENT_AUTOWALKED_INTO_LORELEIS_ROOM",
  open: 0x05, closed: 0x24, dontRun: "TEXT_LORELEISROOM_DONT_RUN_AWAY", first: true,
});
eliteRoom("BrunosRoom", {
  beat: "EVENT_BEAT_BRUNOS_ROOM_TRAINER_0", autowalk: "EVENT_AUTOWALKED_INTO_BRUNOS_ROOM",
  open: 0x05, closed: 0x24, dontRun: "TEXT_BRUNOSROOM_BRUNO_DONT_RUN_AWAY",
});
eliteRoom("AgathasRoom", {
  beat: "EVENT_BEAT_AGATHAS_ROOM_TRAINER_0", autowalk: "EVENT_AUTOWALKED_INTO_AGATHAS_ROOM",
  open: 0x0e, closed: 0x3b, dontRun: "TEXT_AGATHASROOM_AGATHA_DONT_RUN_AWAY",
});

const LANCE_TRIGGERS: [number, number][] = [[5, 1], [6, 2], [5, 11], [6, 11], [24, 16]];

function lanceEntrance(g: Game, locked: boolean) {
  g.setBlock(2, 6, locked ? 0x72 : 0x31);
  g.setBlock(3, 6, locked ? 0x73 : 0x32);
}

defineMap("LancesRoom", {
  onEnter(g) {
    lanceEntrance(g, g.ev("EVENT_LANCES_ROOM_LOCK_DOOR"));
  },
  async onStep(g) {
    // The original sets this in the after-battle text of Lance's trainer header.
    if (g.ev("EVENT_BEAT_LANCES_ROOM_TRAINER_0")) g.set("EVENT_BEAT_LANCE");
    if (g.ev("EVENT_BEAT_LANCE")) return;
    const i = LANCE_TRIGGERS.findIndex(([x, y]) => x === g.player.x && y === g.player.y);
    if (i < 0) return;
    await once("LancesRoom", async () => {
      if (i < 2) {
        // Next to Lance: he challenges the player.
        await g.text("TEXT_LANCESROOM_LANCE");
      } else if (i < 4) {
        // The entrance closes behind the player.
        if (g.ev("EVENT_LANCES_ROOM_LOCK_DOOR")) return;
        g.set("EVENT_LANCES_ROOM_LOCK_DOOR");
        g.sfx("SFX_GO_INSIDE");
        lanceEntrance(g, true);
      } else {
        // On the entrance staircase: walked down the hallway to Lance.
        await g.move("player", "L6D7L12U13");
        await g.delay(3);
      }
    });
  },
});

defineMap("ChampionsRoom", {
  async onStep(g) {
    // The scene starts when the player arrives after Lance (the original arms it when Agatha is beaten).
    if (!g.ev("EVENT_BEAT_LANCE") || g.ev("EVENT_BEAT_CHAMPION_RIVAL") || g.vars.championsIntro) return;
    await once("ChampionsRoom", () => championScene(g));
  },
  texts: {
    async ChampionsRoomRivalText(g) {
      await g.text(g.ev("EVENT_BEAT_CHAMPION_RIVAL") ? "ChampionsRoomRivalAfterBattleText" : "ChampionsRoomRivalText.IntroText");
    },
    async ChampionsRoomOakCongratulatesPlayerText(g) {
      g.textVar("wNameBuffer", "PIKACHU");
      await g.text("ChampionsRoomOakCongratulatesPlayerText.Text");
    },
  },
});

const CHAMPION_RIVAL = 1, CHAMPION_OAK = 2;

async function championScene(g: Game) {
  g.vars.championsIntro = 1;
  // The rival walks up to the player.
  await g.move("player", "U3R1U1");
  await g.delay(3);
  // API REQUEST: the original also turns battle animations on (wOptions) here; there is no option accessor.
  await g.text("ChampionsRoomRivalText.IntroText");
  await g.delay(3);
  // Yellow's rival fields one team per Eevee evolution: 1 Vaporeon, 2 Flareon, 3 Jolteon.
  const team = Math.min(3, Math.max(1, g.vars.rivalStarter || 1));
  const won = await g.trainerBattle("RIVAL3", team, { win: "RivalDefeatedText", lose: "RivalVictoryText" });
  if (!won) return;
  g.set("EVENT_BEAT_CHAMPION_RIVAL");
  await g.text("ChampionsRoomRivalAfterBattleText");
  // Oak arrives.
  g.music("MUSIC_CITIES1");
  await g.text("ChampionsRoomOakText");
  g.show("HS_CHAMPIONS_ROOM_OAK");
  await g.move(CHAMPION_OAK, "U5");
  g.face("player", "left");
  g.face(CHAMPION_RIVAL, "left");
  g.face(CHAMPION_OAK, "down");
  await g.text("TEXT_CHAMPIONSROOM_OAK_CONGRATULATES_PLAYER");
  g.face(CHAMPION_OAK, "right");
  await g.text("ChampionsRoomOakDisappointedWithRivalText");
  g.face(CHAMPION_OAK, "down");
  await g.text("ChampionsRoomOakComeWithMeText");
  await g.move(CHAMPION_OAK, "U2");
  g.hide("HS_CHAMPIONS_ROOM_OAK");
  // The player follows Oak to the Hall of Fame.
  await g.move("player", "L1U2");
  await g.warp("HALL_OF_FAME", 4, 7, "up");
}

const HOF_OAK = 1;
defineMap("HallOfFame", {
  async onStep(g) {
    await once("HallOfFame", async () => {
      await g.move("player", "U5");
      g.face("player", "right");
      g.face(HOF_OAK, "left");
      await g.delay(3);
      await g.text("TEXT_HALLOFFAME_OAK");
      g.hide("HS_CERULEAN_CAVE_GUY");
      await g.hallOfFame();
      // The original saves and restarts; here the player is sent home, with Pallet Town as the blackout town.
      g.save.blackout = MAP.PALLET_TOWN;
      g.vars.elite4Started = 0;
      resetEliteFour(g, true);
      await g.warp("PALLET_TOWN", 5, 6, "down");
    });
  },
});

// ------------------------------------------------------ Summer Beach House

const SURFIN = "SummerBeachHouseSurfinDudeText.";
const PRINTER = "SummerBeachHousePrinterText.";

/** Is there a Pikachu in the party that knows Surf? (bit 6 of wd471) */
function surfingPikachu(g: Game) {
  return g.save.party.some(m => m.species === MON.PIKACHU && m.moves.includes(MOVE.SURF));
}

const poster = (n: number) => async (g: Game) => {
  const label = `SummerBeachHousePoster${n}Text`;
  await g.text(`${label}.${label}${surfingPikachu(g) ? 1 : 2}`);
};

defineMap("SummerBeachHouse", {
  texts: {
    async SummerBeachHouseSurfinDudeText(g) {
      if (!surfingPikachu(g)) return g.text(`${SURFIN}SurfinDudeText4`);
      await g.text(`${SURFIN}${g.vars.beachDudeMet ? "SurfinDudeText3" : "SurfinDudeText1"}`);
      g.vars.beachDudeMet = 1;
      if (!(await g.yesNo())) return g.text(`${SURFIN}SurfinDudeText2`);
      // API REQUEST: the Surfing Pikachu minigame (SurfingPikachuMinigame) is not implemented, so
      // accepting only records that it was played, as the original does afterwards.
      g.vars.beachMinigamePlayed = 1;
    },
    async SummerBeachHousePikachuText(g) {
      await g.text("SummerBeachHousePikachuText.SummerBeachHousePikachuText");
      g.cry("PIKACHU");
    },
    SummerBeachHousePoster1Text: poster(1),
    SummerBeachHousePoster2Text: poster(2),
    SummerBeachHousePoster3Text: poster(3),
    async SummerBeachHousePrinterText(g) {
      if (!surfingPikachu(g)) return g.text(`${PRINTER}SummerBeachHousePrinterText1`, { wait: false });
      const played = !!g.vars.beachMinigamePlayed;
      await g.text(`${PRINTER}SummerBeachHousePrinterText2`, { wait: played });
      if (!played) return;
      await g.text(`${PRINTER}SummerBeachHousePrinterText3`, { wait: false });
      // API REQUEST: "yes" prints the minigame's high score screen (PrintSurfingMinigameHighScore), and
      // "no" shows the high score tile map; neither exists without the minigame, so both just end here.
      await g.yesNo();
    },
  },
});

// ------------------------------------------------------------- Link rooms

// The Trade Center and Colosseum only turn the opponent's sprite toward the player for the link cable.
defineMap("TradeCenter", { generic: true });
defineMap("Colosseum", { generic: true });
