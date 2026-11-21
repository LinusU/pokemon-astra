// The Safari Zone gate and its game: entry fee, Safari Balls, the step limit and leaving.
import { defineMap, type Game } from "../script";

const WORKER1 = 1;
const ENTRY = "SafariZoneGatePrintSafariZoneWorker1WouldYouLikeToJoinText";

defineMap("SafariZoneGate", {
  async onStep(g) {
    const inSafari = g.ev("EVENT_IN_SAFARI_ZONE");
    // Coming back from the Safari Zone: either the game is over or the player is leaving early.
    if (inSafari && g.player.y <= 1) {
      g.face("player", "down");
      if (g.ev("EVENT_SAFARI_GAME_OVER")) {
        g.reset("EVENT_SAFARI_GAME_OVER");
        g.reset("EVENT_IN_SAFARI_ZONE");
        await g.text("TEXT_SAFARIZONEGATE_SAFARI_ZONE_WORKER1_GOOD_HAUL_COME_AGAIN");
        g.save.safari = undefined;
        await g.move("player", "D3");
        return;
      }
      await g.text("_SafariZoneGateSafariZoneWorker1LeavingEarlyText", { wait: false });
      return leaveEarly(g);
    }
    if (inSafari || g.player.y !== 2 || (g.player.x !== 3 && g.player.x !== 4)) return;
    await g.text("TEXT_SAFARIZONEGATE_SAFARI_ZONE_WORKER1_1");
    g.face("player", "right");
    await join(g);
  },
  texts: {
    async SafariZoneGatePrintSafariZoneWorker1WouldYouLikeToJoinText(g) {
      await join(g);
    },
    // Shown after "_SafariZoneGateSafariZoneWorker1LeavingEarlyText" when the text id is used directly.
    async SafariZoneGateSafariZoneWorker1LeavingEarlyText(g) {
      await leaveEarly(g);
    },
    async SafariZoneGatePrintSafariZoneWorker2Text(g) {
      await g.text("SafariZoneGatePrintSafariZoneWorker2Text.FirstTimeHereText", { wait: false });
      if (await g.yesNo()) await g.text("SafariZoneGatePrintSafariZoneWorker2Text.SafariZoneExplanationText");
      else await g.text("SafariZoneGatePrintSafariZoneWorker2Text.YoureARegularHereText");
    },
  },
});

async function leaveEarly(g: Game) {
  if (await g.yesNo()) {
    await g.text("SafariZoneGateSafariZoneWorker1LeavingEarlyText.ReturnSafariBallsText");
    g.reset("EVENT_SAFARI_GAME_OVER");
    g.reset("EVENT_IN_SAFARI_ZONE");
    g.save.safari = undefined;
    await g.move("player", "D3");
  } else {
    await g.text("SafariZoneGateSafariZoneWorker1LeavingEarlyText.GoodLuckText");
    await g.move("player", "U");
    await g.takeWarp();
  }
}

async function join(g: Game) {
  await g.text(`${ENTRY}.WelcomeText`, { wait: false });
  if (!(await g.yesNo())) {
    await g.text(`${ENTRY}.PleaseComeAgainText`);
    return g.move("player", "D");
  }
  let balls = 30;
  if (g.money >= 500) {
    g.money -= 500;
    g.sfx("SFX_PURCHASE");
    await g.text(`${ENTRY}.MakePaymentText`);
  } else if (g.money > 0) {
    // Yellow's low-cost admission: every coin the player has, a ball for each ₽23.
    await g.text(`${ENTRY}.NotEnoughMoneyText`);
    balls = Math.min(29, Math.floor(g.money / 23));
    g.money = 0;
    await g.text("SafariZoneEntranceText_f20c4");
    await g.text("SafariZoneEntranceText_f20c9");
    if (!balls) return g.move("player", "D");
  } else {
    const tries = g.vars.safariBroke ?? 0;
    g.vars.safariBroke = tries + 1;
    await g.text(["SafariZoneEntranceText_f210a", "SafariZoneEntranceText_f210f", "SafariZoneEntranceText_f2114", "SafariZoneEntranceText_f2119"][Math.min(3, tries)]);
    if (tries < 3) return g.move("player", "D");
    await g.text("SafariZoneEntranceText_f20f6");
    balls = 1;
  }
  g.save.safari = { balls, steps: 502 };
  g.set("EVENT_IN_SAFARI_ZONE");
  g.reset("EVENT_SAFARI_GAME_OVER");
  // Walk to the stairs on the north wall and go in.
  const x = g.player.x;
  await g.move("player", x > 4 ? "L".repeat(x - 4) + "U2" : "U2");
  await g.takeWarp();
}

/** Time's up or out of balls: the PA calls and the player is brought back to the gate. */
export async function safariGameOver(g: Game) {
  g.music("MUSIC_SAFARI_ZONE");
  if ((g.save.safari?.balls ?? 0) > 0) await g.text("TimesUpText");
  await g.text("GameOverText");
  g.set("EVENT_SAFARI_GAME_OVER");
  g.music();
  await g.warp("SAFARI_ZONE_GATE", 4, 0, "down");
}
