// Saffron City, its gym, the Fighting Dojo, Silph Co., and Route 15's upstairs gate.
import { defineMap, type Game } from "../script";

// ---------------------------------------------------------------------------
// Silph Co. Card Key doors
// ---------------------------------------------------------------------------

/** A locked gate: block coordinates, the block shown while locked and the event that remembers it is open. */
interface Door { x: number; y: number; locked: number; event: string }

const OPEN_DOOR_BLOCK = 0x0e;

const DOORS: Record<number, Door[]> = {
  2: [
    { x: 2, y: 2, locked: 0x54, event: "EVENT_SILPH_CO_2_UNLOCKED_DOOR1" },
    { x: 2, y: 5, locked: 0x54, event: "EVENT_SILPH_CO_2_UNLOCKED_DOOR2" },
  ],
  3: [
    { x: 4, y: 4, locked: 0x5f, event: "EVENT_SILPH_CO_3_UNLOCKED_DOOR1" },
    { x: 8, y: 4, locked: 0x5f, event: "EVENT_SILPH_CO_3_UNLOCKED_DOOR2" },
  ],
  4: [
    { x: 2, y: 6, locked: 0x54, event: "EVENT_SILPH_CO_4_UNLOCKED_DOOR1" },
    { x: 6, y: 4, locked: 0x54, event: "EVENT_SILPH_CO_4_UNLOCKED_DOOR2" },
  ],
  5: [
    { x: 3, y: 2, locked: 0x5f, event: "EVENT_SILPH_CO_5_UNLOCKED_DOOR1" },
    { x: 3, y: 6, locked: 0x5f, event: "EVENT_SILPH_CO_5_UNLOCKED_DOOR2" },
    { x: 7, y: 5, locked: 0x5f, event: "EVENT_SILPH_CO_5_UNLOCKED_DOOR3" },
  ],
  6: [{ x: 2, y: 6, locked: 0x5f, event: "EVENT_SILPH_CO_6_UNLOCKED_DOOR" }],
  7: [
    { x: 5, y: 3, locked: 0x54, event: "EVENT_SILPH_CO_7_UNLOCKED_DOOR1" },
    { x: 10, y: 2, locked: 0x54, event: "EVENT_SILPH_CO_7_UNLOCKED_DOOR2" },
    { x: 10, y: 6, locked: 0x54, event: "EVENT_SILPH_CO_7_UNLOCKED_DOOR3" },
  ],
  8: [{ x: 3, y: 4, locked: 0x5f, event: "EVENT_SILPH_CO_8_UNLOCKED_DOOR" }],
  9: [
    { x: 1, y: 4, locked: 0x5f, event: "EVENT_SILPH_CO_9_UNLOCKED_DOOR1" },
    { x: 9, y: 2, locked: 0x54, event: "EVENT_SILPH_CO_9_UNLOCKED_DOOR2" },
    { x: 9, y: 5, locked: 0x54, event: "EVENT_SILPH_CO_9_UNLOCKED_DOOR3" },
    { x: 5, y: 6, locked: 0x5f, event: "EVENT_SILPH_CO_9_UNLOCKED_DOOR4" },
  ],
  10: [{ x: 5, y: 4, locked: 0x54, event: "EVENT_SILPH_CO_10_UNLOCKED_DOOR" }],
  11: [{ x: 3, y: 6, locked: 0x20, event: "EVENT_SILPH_CO_11_UNLOCKED_DOOR" }],
};

/** The map was just set up: remember the floor and lock the gates that are still closed. */
function silphEnter(g: Game, floor: number) {
  g.vars.silphFloor = floor;
  for (const door of DOORS[floor] ?? []) if (!g.ev(door.event)) g.setBlock(door.x, door.y, door.locked);
}

/**
 * Pressing A on a locked gate with the Card Key opens it (PrintCardKeyText).
 * API REQUEST: a hook for "A pressed on the tile in front of the player" so the
 * gate can also say CardKeyFailText without the key. Workaround: the gate opens
 * as soon as the player stands in front of it holding the Card Key.
 */
async function silphCardKey(g: Game, floor: number) {
  if (!g.hasItem("CARD_KEY")) return;
  const step = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[g.player.facing];
  const bx = (g.player.x + step[0]) >> 1, by = (g.player.y + step[1]) >> 1;
  const door = (DOORS[floor] ?? []).find(d => d.x === bx && d.y === by && !g.ev(d.event) && g.block(bx, by) === d.locked);
  if (!door) return;
  await g.text("CardKeySuccessText");
  g.setBlock(door.x, door.y, floor === 11 ? 0x03 : OPEN_DOOR_BLOCK);
  g.set(door.event);
  g.sfx("SFX_GO_INSIDE");
}

/** Silph Co. workers say one thing while Team Rocket holds the building and another afterwards. */
const beatGiovanni = (g: Game, before: string, after: string) => g.text(g.ev("EVENT_BEAT_SILPH_CO_GIOVANNI") ? after : before);

// ---------------------------------------------------------------------------
// Saffron City
// ---------------------------------------------------------------------------

defineMap("SaffronCity", { generic: true });
defineMap("SaffronPokecenter", { generic: true });
defineMap("SaffronMart", { generic: true });

defineMap("SaffronPidgeyHouse", {
  texts: {
    async SaffronPidgeyHousePidgeyText(g) {
      g.cry("PIDGEY");
    },
  },
});

defineMap("MrPsychicsHouse", {
  texts: {
    async MrPsychicsHouseMrPsychicText(g) {
      if (g.ev("EVENT_GOT_TM29")) return g.text("MrPsychicsHouseMrPsychicText.TM29ExplanationText");
      await g.text("MrPsychicsHouseMrPsychicText.YouWantedThisText");
      if (!g.give("TM_PSYCHIC_M")) return g.text("MrPsychicsHouseMrPsychicText.TM29NoRoomText");
      await g.text("MrPsychicsHouseMrPsychicText.ReceivedTM29Text");
      g.set("EVENT_GOT_TM29");
    },
  },
});

defineMap("CopycatsHouse1F", {
  texts: {
    async CopycatsHouse1FChanseyText(g) {
      g.cry("CHANSEY");
    },
  },
});

defineMap("CopycatsHouse2F", {
  texts: {
    async CopycatsHouse2FCopycatText(g) {
      const T = "CopycatsHouse2FCopycatText.";
      if (g.ev("EVENT_GOT_TM31")) return g.text(T + "TM31Explanation2Text");
      await g.text(T + "DoYouLikePokemonText", { wait: false });
      if (!g.hasItem("POKE_DOLL")) return;
      await g.text(T + "TM31PreReceiveText");
      if (!g.give("TM_MIMIC")) return g.text(T + "TM31NoRoomText");
      await g.text(T + "ReceivedTM31Text");
      g.take("POKE_DOLL");
      g.set("EVENT_GOT_TM31");
    },
    async CopycatsHouse2FPCText(g) {
      await g.text(g.player.facing === "up" ? "CopycatsHouse2FPCText.MySecretsText" : "CopycatsHouse2FPCText.CantSeeText");
    },
  },
});

// ---------------------------------------------------------------------------
// Saffron Gym
// ---------------------------------------------------------------------------

/** Sabrina's rewards: the Marsh Badge's explanation, TM46 and the badge itself. */
async function sabrinaRewards(g: Game) {
  await g.text("TEXT_SAFFRONGYM_SABRINA_MARSH_BADGE_INFO");
  g.set("EVENT_BEAT_SABRINA");
  if (g.give("TM_PSYWAVE")) {
    await g.text("TEXT_SAFFRONGYM_SABRINA_RECEIVED_TM46");
    g.set("EVENT_GOT_TM46");
  } else {
    await g.text("TEXT_SAFFRONGYM_SABRINA_TM46_NO_ROOM");
  }
  g.badge(5);
  for (let i = 0; i <= 6; i++) g.set(`EVENT_BEAT_SAFFRON_GYM_TRAINER_${i}`);
}

defineMap("SaffronGym", {
  generic: true,
  texts: {
    async SaffronGymSabrinaText(g) {
      const T = "SaffronGymSabrinaText.";
      if (g.ev("EVENT_BEAT_SABRINA")) {
        if (!g.ev("EVENT_GOT_TM46")) return sabrinaRewards(g);
        return g.text(T + "PostBattleAdviceText");
      }
      await g.text(T + "Text");
      const won = await g.trainerBattle("SABRINA", 1, { win: T + "ReceivedMarshBadgeText", lose: T + "ReceivedMarshBadgeText" });
      if (won) await sabrinaRewards(g);
    },
    async SaffronGymGymGuideText(g) {
      await g.text(g.ev("EVENT_BEAT_SABRINA") ? "SaffronGymGymGuideText.BeatSabrinaText" : "SaffronGymGymGuideText.ChampInMakingText");
    },
  },
});

// ---------------------------------------------------------------------------
// Fighting Dojo
// ---------------------------------------------------------------------------

const KARATE_MASTER = 1;

/** Choosing one of the two Poké Balls (Hitmonlee or Hitmonchan); only one can be taken. */
async function dojoGift(g: Game, species: string, ballText: string, ball: string, got: string) {
  if (g.ev("EVENT_GOT_HITMONLEE") || g.ev("EVENT_GOT_HITMONCHAN")) return g.text("FightingDojoBetterNotGetGreedyText");
  await g.showDex(species);
  await g.text(ballText, { wait: false });
  if (!(await g.yesNo())) return;
  if (!(await g.giveMon(species, 30))) return;
  g.hide(ball);
  g.set(got);
  g.set("EVENT_DEFEATED_FIGHTING_DOJO");
}

defineMap("FightingDojo", {
  async onStep(g) {
    // Standing left of the Karate Master challenges him.
    if (g.ev("EVENT_DEFEATED_FIGHTING_DOJO") || g.ev("EVENT_BEAT_KARATE_MASTER")) return;
    if (g.player.x !== 4 || g.player.y !== 3) return;
    g.face("player", "right");
    g.face(KARATE_MASTER, "left");
    await g.text("TEXT_FIGHTINGDOJO_KARATE_MASTER");
  },
  texts: {
    async FightingDojoKarateMasterText(g) {
      const T = "FightingDojoKarateMasterText.";
      if (g.ev("EVENT_DEFEATED_FIGHTING_DOJO")) return g.text(T + "StayAndTrainWithUsText");
      if (g.ev("EVENT_BEAT_KARATE_MASTER")) return g.text(T + "IWillGiveYouAPokemonText");
      await g.text(T + "Text");
      const won = await g.trainerBattle("BLACKBELT", 1, { win: T + "DefeatedText", lose: T + "DefeatedText" });
      if (!won) return;
      g.face("player", "right");
      g.face(KARATE_MASTER, "left");
      g.set("EVENT_BEAT_KARATE_MASTER");
      for (let i = 0; i <= 3; i++) g.set(`EVENT_BEAT_FIGHTING_DOJO_TRAINER_${i}`);
      await g.text(T + "IWillGiveYouAPokemonText");
    },
    FightingDojoHitmonleePokeBallText: g =>
      dojoGift(g, "HITMONLEE", "FightingDojoHitmonleePokeBallText.Text", "HS_FIGHTING_DOJO_GIFT_1", "EVENT_GOT_HITMONLEE"),
    FightingDojoHitmonchanPokeBallText: g =>
      dojoGift(g, "HITMONCHAN", "FightingDojoHitmonchanPokeBallText.Text", "HS_FIGHTING_DOJO_GIFT_2", "EVENT_GOT_HITMONCHAN"),
  },
});

// ---------------------------------------------------------------------------
// Silph Co.
// ---------------------------------------------------------------------------

defineMap("SilphCo1F", {
  onEnter(g) {
    g.vars.silphFloor = 1;
    // Once Giovanni is beaten the receptionist is back at her desk.
    if (!g.ev("EVENT_BEAT_SILPH_CO_GIOVANNI") || g.ev("EVENT_SILPH_CO_RECEPTIONIST_AT_DESK")) return;
    g.set("EVENT_SILPH_CO_RECEPTIONIST_AT_DESK");
    g.show("HS_SILPH_CO_1F_RECEPTIONIST");
  },
});

defineMap("SilphCo2F", {
  onEnter: g => silphEnter(g, 2),
  onStep: g => silphCardKey(g, 2),
  texts: {
    async SilphCo2FSilphWorkerFText(g) {
      const T = "SilphCo2FSilphWorkerFText.";
      if (g.ev("EVENT_GOT_TM36")) return g.text(T + "TM36ExplanationText");
      await g.text(T + "PleaseTakeThisText");
      if (!g.give("TM_SELFDESTRUCT")) return g.text(T + "TM36NoRoomText");
      g.set("EVENT_GOT_TM36");
      await g.text(T + "ReceivedTM36Text");
    },
  },
});

defineMap("SilphCo3F", {
  onEnter: g => silphEnter(g, 3),
  onStep: g => silphCardKey(g, 3),
  texts: {
    SilphCo3FSilphWorkerMText: g => beatGiovanni(g, "SilphCo3FSilphWorkerMText.WhatShouldIDoText", "SilphCo3FSilphWorkerMText.YouSavedUsText"),
  },
});

defineMap("SilphCo4F", {
  onEnter: g => silphEnter(g, 4),
  onStep: g => silphCardKey(g, 4),
  texts: {
    SilphCo4FSilphWorkerMText: g => beatGiovanni(g, "SilphCo4FSilphWorkerMText.ImHidingText", "SilphCo4FSilphWorkerMText.TeamRocketIsGoneText"),
  },
});

defineMap("SilphCo5F", {
  onEnter: g => silphEnter(g, 5),
  onStep: g => silphCardKey(g, 5),
  texts: {
    SilphCo5FSilphWorkerMText: g => beatGiovanni(g, "SilphCo5FSilphWorkerMText.ThatsYouRightText", "SilphCo5FSilphWorkerMText.YoureOurHeroText"),
  },
});

defineMap("SilphCo6F", {
  onEnter: g => silphEnter(g, 6),
  onStep: g => silphCardKey(g, 6),
  texts: {
    SilphCo6FSilphWorkerM1Text: g => beatGiovanni(g, "SilphCo6FSilphWorkerM1Text.TookOverTheBuildingText", "SilphCo6FSilphWorkerM1Text.BackToWorkText"),
    SilphCo6FSilphWorkerM2Text: g => beatGiovanni(g, "SilphCo6FSilphWorkerM2Text.HelpMePleaseText", "SilphCo6FSilphWorkerM2Text.WeGotEngagedText"),
    SilphCo6FSilphWorkerF1Text: g => beatGiovanni(g, "SilphCo6FSilphWorkerF1Text.SuchACowardText", "SilphCo6FSilphWorkerF1Text.HaveToMarryHimText"),
    SilphCo6FSilphWorkerF2Text: g => beatGiovanni(g, "SilphCo6FSilphWorkerF2Text.TeamRocketConquerWorldText", "SilphCo6FSilphWorkerF2Text.TeamRocketRanText"),
    SilphCo6FSilphWorkerM3Text: g => beatGiovanni(g, "SilphCo6FSilphWorkerM3Text.TargetedSilphText", "SilphCo6FSilphWorkerM3Text.WorkForSilphText"),
  },
});

const SILPH_RIVAL = 9;

/** The rival waits on 7F and walks up to the player. */
async function silphRival(g: Game) {
  const upper = g.player.y === 2;
  g.music("MUSIC_MEET_RIVAL");
  g.face("player", "down");
  await g.text("TEXT_SILPHCO7F_RIVAL");
  await g.move(SILPH_RIVAL, upper ? "U4" : "U3");
  await g.text("TEXT_SILPHCO7F_RIVAL_WAITED_HERE");
  await g.delay(3);
  // Yellow's rival fights with the Eevee evolution he chose: Vaporeon, Flareon or Jolteon.
  const party = Math.max(1, g.vars.rivalStarter ?? 1) + 4;
  const won = await g.trainerBattle("RIVAL2", party, { win: "SilphCo7FRivalDefeatedText", lose: "SilphCo7FRivalVictoryText" });
  if (!won) return;
  g.set("EVENT_BEAT_SILPH_CO_RIVAL");
  g.face("player", "down");
  g.face(SILPH_RIVAL, "up");
  await g.text("TEXT_SILPHCO7F_RIVAL_GOOD_LUCK_TO_YOU");
  // He leaves to the right, around the player if he stands in the way.
  await g.move(SILPH_RIVAL, upper ? "R2" : "L1U2R3D1");
  g.hide("HS_SILPH_CO_7F_RIVAL");
  g.music();
}

defineMap("SilphCo7F", {
  onEnter: g => silphEnter(g, 7),
  async onStep(g) {
    await silphCardKey(g, 7);
    if (g.ev("EVENT_BEAT_SILPH_CO_RIVAL")) return;
    if (g.player.x === 3 && (g.player.y === 2 || g.player.y === 3)) await silphRival(g);
  },
  texts: {
    async SilphCo7FSilphWorkerM1Text(g) {
      const T = "SilphCo7FSilphWorkerM1Text.";
      if (g.vars.gotLapras) return g.text(T + (g.ev("EVENT_BEAT_SILPH_CO_GIOVANNI") ? "SavedText" : "IsOurPresidentOkText"));
      await g.text(T + "HaveThisPokemonText");
      if (!(await g.giveMon("LAPRAS", 15))) return;
      await g.text(T + "LaprasDescriptionText");
      g.vars.gotLapras = 1;
    },
    SilphCo7FSilphWorkerM2Text: g => beatGiovanni(g, "SilphCo7FSilphWorkerM2Text.AfterTheMasterBallText", "SilphCo7FSilphWorkerM2Text.CancelledTheMasterBallText"),
    SilphCo7FSilphWorkerM3Text: g => beatGiovanni(g, "SilphCo7FSilphWorkerM3Text.ItWouldBeBadText", "SilphCo7FSilphWorkerM3Text.YouChasedOffTeamRocketText"),
    SilphCo7FSilphWorkerM4Text: g => beatGiovanni(g, "SilphCo7FSilphWorkerM4Text.ItsReallyDangerousHereText", "SilphCo7FSilphWorkerM4Text.SafeAtLastText"),
  },
});

defineMap("SilphCo8F", {
  onEnter: g => silphEnter(g, 8),
  onStep: g => silphCardKey(g, 8),
  texts: {
    SilphCo8FSilphWorkerMText: g => beatGiovanni(g, "SilphCo8FSilphWorkerMText.SilphIsFinishedText", "SilphCo8FSilphWorkerMText.ThanksForSavingUsText"),
  },
});

defineMap("SilphCo9F", {
  onEnter: g => silphEnter(g, 9),
  onStep: g => silphCardKey(g, 9),
  texts: {
    async SilphCo9FNurseText(g) {
      const T = "SilphCo9FNurseText.";
      if (g.ev("EVENT_BEAT_SILPH_CO_GIOVANNI")) return g.text(T + "ThankYouText");
      await g.text(T + "YouLookTiredText");
      await g.fade(() => g.heal());
      await g.text(T + "DontGiveUpText");
    },
  },
});

defineMap("SilphCo10F", {
  onEnter: g => silphEnter(g, 10),
  onStep: g => silphCardKey(g, 10),
  texts: {
    SilphCo10FSilphWorkerFText: g => beatGiovanni(g, "SilphCo10FSilphWorkerFText.ImScaredText", "SilphCo10FSilphWorkerFText.QuietAboutMyCryingText"),
  },
});

// ---- 11F: Jessie and James, Giovanni, the President

const GIOVANNI = 3, JAMES = 4, JESSIE = 6;

/** Jessie and James step up to the player at the top of the room and fight as a pair. */
async function jessieAndJames(g: Game) {
  const x = g.player.x; // 3 = right edge, 2, or 1
  g.music("MUSIC_MEET_JESSIE_JAMES");
  await g.text("TEXT_SILPHCO11F_TEXT8", { wait: false });
  await g.move(JAMES, x === 3 ? "U5" : x === 2 ? "U4" : "U2L1U2");
  g.face(JAMES, x === 3 ? "right" : "up");
  await g.delay(3);
  await g.move(JESSIE, x === 3 ? "U4" : x === 2 ? "U5" : "U3L1U2");
  g.face(JESSIE, x === 3 ? "up" : "left");
  await g.delay(3);
  await g.text("TEXT_SILPHCO11F_TEXT9");
  const won = await g.trainerBattle("ROCKET", 45, { win: "SilphCo11FText_624c2", lose: "SilphCo11FText_624c2" });
  if (!won) return;
  g.face(JAMES, "down");
  g.face(JESSIE, "down");
  await g.text("TEXT_SILPHCO11F_TEXT10", { wait: false });
  g.music("MUSIC_MEET_JESSIE_JAMES");
  await g.fade(() => {
    g.hide("HS_SILPH_CO_11F_JAMES");
    g.hide("HS_SILPH_CO_11F_JESSIE");
  });
  g.music();
  g.set("EVENT_BEAT_SILPH_CO_11F_JESSIE_JAMES");
}

/** Giovanni's departure: Team Rocket leaves the building and Saffron's citizens return. */
function teamRocketLeaves(g: Game) {
  const hide: string[] = ["HS_SILPH_CO_11F_1", "HS_SILPH_CO_11F_JAMES", "HS_SILPH_CO_11F_2", "HS_SILPH_CO_11F_JESSIE"];
  for (const n of [1, 2, 3, 4, 5, 6, 7, "E", "F"]) hide.push(`HS_SAFFRON_CITY_${n}`);
  const floors: [number, number][] = [[2, 5], [3, 2], [4, 3], [5, 4], [6, 3], [7, 4], [8, 3], [9, 3], [10, 2]];
  for (const [floor, count] of floors) for (let n = floor === 2 ? 2 : 1; n <= count; n++) hide.push(`HS_SILPH_CO_${floor}F_${n}`);
  for (const hs of hide) g.hide(hs);
  for (const n of [8, 9, "A", "B", "C", "D"]) g.show(`HS_SAFFRON_CITY_${n}`);
}

async function giovanniMeetsPlayer(g: Game) {
  const first = g.player.x === 6 && g.player.y === 13;
  const facePlayer = () => {
    g.face("player", first ? "up" : "left");
    g.face(GIOVANNI, first ? "down" : "right");
  };
  await g.text("TEXT_SILPHCO11F_GIOVANNI");
  await g.move(GIOVANNI, "D3");
  facePlayer();
  await g.delay(3);
  const won = await g.trainerBattle("GIOVANNI", 2, { win: "SilphCo10FGiovanniILostAgainText", lose: "SilphCo10FGiovanniILostAgainText" });
  if (!won) return;
  facePlayer();
  await g.text("TEXT_SILPHCO11F_GIOVANNI_YOU_RUINED_OUR_PLANS");
  await g.fade(() => teamRocketLeaves(g));
  g.set("EVENT_BEAT_SILPH_CO_GIOVANNI");
}

defineMap("SilphCo11F", {
  onEnter: g => silphEnter(g, 11),
  async onStep(g) {
    await silphCardKey(g, 11);
    const { x, y } = g.player;
    if (!g.ev("EVENT_BEAT_SILPH_CO_11F_JESSIE_JAMES") && y === 3 && x < 4) return jessieAndJames(g);
    if (!g.ev("EVENT_BEAT_SILPH_CO_GIOVANNI") && ((x === 6 && y === 13) || (x === 7 && y === 12))) return giovanniMeetsPlayer(g);
  },
  texts: {
    async SilphCo11FSilphPresidentText(g) {
      const T = "SilphCo11FSilphPresidentText.";
      if (g.ev("EVENT_GOT_MASTER_BALL")) return g.text(T + "MasterBallDescriptionText");
      await g.text(T + "Text");
      if (!g.give("MASTER_BALL")) return g.text(T + "NoRoomText");
      await g.text(T + "ReceivedMasterBallText");
      g.set("EVENT_GOT_MASTER_BALL");
    },
    // Jessie and James startle the player: a "!" over the player's head.
    async SilphCo11FJessieJamesText(g) {
      await g.delay(10);
      g.face("player", "down");
      await g.emote("player", "exclamation");
      await g.delay(20);
    },
    async SilphCo11FText10(g) {
      await g.delay(64);
    },
  },
});

// ---- The elevator

const FLOOR_NAMES = ["1F", "2F", "3F", "4F", "5F", "6F", "7F", "8F", "9F", "10F", "11F"];
/** The warp (0-based) that leads out of the elevator on each floor. */
const ELEVATOR_EXIT = [3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1];

function elevatorExit(g: Game, floor: number) {
  g.setWarp(0, `SILPH_CO_${floor + 1}F`, ELEVATOR_EXIT[floor]);
  g.setWarp(1, `SILPH_CO_${floor + 1}F`, ELEVATOR_EXIT[floor]);
}

defineMap("SilphCoElevator", {
  onEnter(g) {
    // Both exits lead back to the floor the player came from until another is picked.
    const from = g.vars.silphFloor;
    if (from >= 1 && from <= 11) elevatorExit(g, from - 1);
  },
  texts: {
    async SilphCoElevatorElevatorText(g) {
      await g.text("WhichFloorText", { wait: false });
      const pick = await g.choose("Floor", FLOOR_NAMES);
      if (pick === undefined) return;
      elevatorExit(g, pick);
      g.vars.silphFloor = pick + 1;
    },
  },
});

// ---------------------------------------------------------------------------
// Route 15's gate
// ---------------------------------------------------------------------------

defineMap("Route15Gate2F", {
  generic: true,
  texts: {
    async Route15Gate2FOaksAideText(g) {
      if (!g.ev("EVENT_GOT_EXP_ALL")) {
        // Oak's aide hands over the Exp. All to a trainer who has caught 50 kinds of Pokémon.
        await g.text("OaksAideHiText", { wait: false });
        if (!(await g.yesNo())) return g.text("OaksAideComeBackText");
        if (g.save.caught.length < 50) return g.text("OaksAideUhOhText");
        await g.text("OaksAideHereYouGoText");
        if (!g.give("EXP_ALL")) return g.text("OaksAideNoRoomText");
        await g.text("OaksAideGotItemText");
        g.set("EVENT_GOT_EXP_ALL");
      }
      await g.text("Route15Gate2FOaksAideText.ExpAllText");
    },
    async Route15Gate2FBinocularsText(g) {
      if (g.player.facing === "up") await g.text("Route15Gate2FBinocularsText.Text");
    },
  },
});
