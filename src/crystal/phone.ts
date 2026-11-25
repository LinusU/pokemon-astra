/**
 * The Pokégear phone (engine/phone): contacts' own call scripts from the
 * cartridge, special calls scripts queue, and the occasional random call.
 */
import { C, CONST, ITEM, SYM, TEXT } from "./symbols";
import type { CrystalGame } from "./runtime";
import { runScript } from "./script";

export interface Contact { index: number; klass: number; id: number; group: number; number: number; callee: number; caller: number; calleeTime: number; callerTime: number }

export function contact(game: CrystalGame, index: number): Contact {
  const r = game.rom, o = SYM.PhoneContacts + index * 12;
  return {
    index, klass: r.u8(o), id: r.u8(o + 1), group: r.u8(o + 2), number: r.u8(o + 3),
    calleeTime: r.u8(o + 4), callee: r.far(o + 5), callerTime: r.u8(o + 8), caller: r.far(o + 9),
  };
}
export function contactName(game: CrystalGame, c: Contact) {
  if (c.klass) return `${game.trainerName(c.klass, c.id)} (${game.rom.trainerClassName(c.klass)})`;
  const names: Record<string, string> = { PHONECONTACT_MOM: game.save.mom, PHONECONTACT_BIKESHOP: "BIKE SHOP", PHONECONTACT_BILL: "BILL", PHONECONTACT_ELM: "PROF.ELM", PHONECONTACT_BUENA: "BUENA" };
  const name = Object.keys(names).find(n => CONST[n] === c.index);
  return name ? names[name] : "?";
}

async function ring(game: CrystalGame, c: Contact) {
  game.sfx("SFX_CALL");
  await game.say(`Ring! Ring! It's ${contactName(game, c)}.`);
}

/** A call a script queued with `specialphonecall`. */
export async function specialCall(game: CrystalGame) {
  const id = game.save.specialCall;
  const o = SYM.SpecialPhoneCallList + (id - 1) * 6;
  const condition = game.rom.near(o);
  const outsideOnly = SYM.SpecialCallOnlyWhenOutside !== undefined ? condition === SYM.SpecialCallOnlyWhenOutside : true;
  const env = game.map.environment;
  if (outsideOnly && env !== C("TOWN") && env !== C("ROUTE")) return false;
  const c = contact(game, game.rom.u8(o + 2));
  game.save.vars.caller = c.index;
  await ring(game, c);
  // The caller's script reads the call's id (VAR_SPECIALPHONECALL) to choose
  // what to say, and clears it itself with `specialphonecall SPECIALCALL_NONE`.
  await runScript(game, game.rom.far(o + 3));
  if (game.save.specialCall === id) game.save.specialCall = 0;
  await finishIncomingCall(game);
  return true;
}

/** Start a call if a contact is available. */
export function startRandomCall(game: CrystalGame) {
  // GetAvailableCallers: contacts who call at this time of day, from somewhere else.
  const time = game.timeOfDayFlag();
  const callers = game.save.phone.map(i => contact(game, i)).filter(c =>
    (c.callerTime & time) && (c.group !== game.map.group || c.number !== game.map.number));
  if (!callers.length) return;
  const c = callers[Math.floor(Math.random() * callers.length)];
  void game.runScript(async () => {
    await game.settle();
    game.save.vars.caller = c.index;
    await ring(game, c);
    await runScript(game, c.caller);
    await finishIncomingCall(game);
  });
}

/** The player calls a contact from the Pokégear. */
export async function call(game: CrystalGame, index: number) {
  const c = contact(game, index);
  game.save.vars.caller = c.index;
  // MakePhoneCallFromPokegear: no service here, or the contact can't take a
  // call at this time of day, is out of the area; a contact on this map
  // should just be talked to.
  const answers = c.calleeTime & (1 << game.timeOfDay());
  if (game.map.phoneService || !answers) return phoneText(game, "_PhoneOutOfAreaText", "That number is out of the area.");
  if (c.group === game.map.group && c.number === game.map.number) return phoneText(game, "_PhoneJustTalkToThemText", "Just go talk to that person!");
  game.sfx("SFX_CALL");
  await runScript(game, c.callee);
  await hangUp(game);
}

async function phoneText(game: CrystalGame, label: string, fallback: string) {
  const at = TEXT[label];
  if (at !== undefined) await game.engineText(at);
  else await game.say(fallback);
  game.closeText();
}

/** Script_ReceivePhoneCall and the Pokégear's call: the last words stay up until A, then the line clicks off. */
async function hangUp(game: CrystalGame) {
  if (game.textOpen) await game.waitButton();
  game.sfx("SFX_HANG_UP");
  game.closeText();
}

async function finishIncomingCall(game: CrystalGame) {
  await hangUp(game);
  game.resetPhoneCallTimer();
}

// ------------------------------------------------------------------ Mom's shopping
/** data/items/mom_phone.asm: the money that sets Mom shopping, what it costs and what she buys. */
const MOM_ITEMS_1: [number, number, string][] = [
  [0, 600, "SUPER_POTION"], [0, 90, "ANTIDOTE"], [0, 180, "POKE_BALL"], [0, 450, "ESCAPE_ROPE"], [0, 500, "GREAT_BALL"],
];
const MOM_ITEMS_2: [number, number, string][] = [
  [900, 600, "SUPER_POTION"], [4000, 270, "REPEL"], [7000, 600, "SUPER_POTION"], [10000, 1800, "DOLL"], [15000, 3000, "MOON_STONE"],
  [19000, 600, "SUPER_POTION"], [30000, 4800, "DOLL"], [40000, 900, "HYPER_POTION"], [50000, 8000, "DOLL"], [100000, 22800, "DOLL"],
];
const MOM_MONEY = 2300;

/**
 * MomTriesToBuySomething, after a won trainer battle: with enough saved, Mom
 * buys the next thing on her list (or, now and then, something from her
 * everyday list) and calls to say it's in the player's PC. Astra has no room
 * decorations, so she passes over the dolls without spending anything.
 */
export async function momTriesToBuySomething(game: CrystalGame) {
  if (game.map.phoneService) return;
  const v = game.save.vars;
  let pick: [number, number, string] | undefined;
  let fromList2 = false;
  const next = v.momItem ?? 0;
  if (next < MOM_ITEMS_2.length && game.save.momMoney >= MOM_ITEMS_2[next][0]) {
    pick = MOM_ITEMS_2[next];
    fromList2 = true;
  } else {
    // .check_have_2300: every 2,300 saved, if the balance lands on the mark exactly.
    let trigger = v.momTrigger ?? MOM_MONEY;
    while (trigger < game.save.momMoney) trigger += MOM_MONEY;
    if (trigger === game.save.momMoney) {
      trigger += MOM_MONEY;
      pick = MOM_ITEMS_1[Math.floor(Math.random() * MOM_ITEMS_1.length)];
    }
    v.momTrigger = trigger;
  }
  if (!pick) return;
  const [, cost, name] = pick;
  if (fromList2) v.momItem = next + 1;
  if (name === "DOLL" || game.save.momMoney < cost) return;
  // The item goes to the player's PC; a full PC means she doesn't buy it.
  const item = ITEM[name], stored = game.save.pcItems[item] ?? 0;
  if (stored >= 99) return;
  game.save.pcItems[item] = stored + 1;
  game.save.momMoney -= cost;
  const mom = contact(game, C("PHONECONTACT_MOM"));
  await ring(game, mom);
  for (const label of ["MomHiHowAreYouText", "MomFoundAnItemText", "MomBoughtWithYourMoneyText", "MomItsInPCText"]) {
    const at = TEXT[label];
    if (at !== undefined) await game.writeText(at);
  }
  await finishIncomingCall(game);
}
