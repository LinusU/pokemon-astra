/**
 * What the Crystal adventures can't run yet: walks every script reachable
 * from every map (scene scripts, callbacks, coord, bg and object events,
 * trainers) and every standard and phone script, and lists commands,
 * specials and assembly routines without a port.
 */
import { SCRIPT_COMMANDS, SPECIALS, STD, SYM, asmName, C, CONST } from "./symbols";
import type { CrystalRom } from "./rom";
import { SUPPORTED_COMMANDS } from "./script";
import { SUPPORTED_ASM, specialSupported } from "./specials";

/** Argument bytes after each command, from macros/scripts/events.asm. */
const ARGS: Record<string, number | "pointer" | "far"> = {
  scall: "pointer", farscall: "far", memcall: 2, sjump: "pointer", farsjump: "far", memjump: 2, ifequal: 3, ifnotequal: 3, iffalse: "pointer",
  iftrue: "pointer", ifgreater: 3, ifless: 3, jumpstd: 2, callstd: 2, callasm: 3, special: 2, memcallasm: 2, checkmapscene: 2, setmapscene: 3,
  checkscene: 0, setscene: 1, setval: 1, addval: 1, random: 1, checkver: 0, readmem: 2, writemem: 2, loadmem: 3, readvar: 1, writevar: 1, loadvar: 2,
  giveitem: 2, takeitem: 2, checkitem: 1, givemoney: 4, takemoney: 4, checkmoney: 4, givecoins: 2, takecoins: 2, checkcoins: 2, addcellnum: 1,
  delcellnum: 1, checkcellnum: 1, checktime: 1, checkpoke: 1, givepoke: -1, giveegg: 2, givepokemail: 2, checkpokemail: 2, checkevent: 2,
  clearevent: 2, setevent: 2, checkflag: 2, clearflag: 2, setflag: 2, wildon: 0, wildoff: 0, xycompare: 2, warpmod: 3, blackoutmod: 2, warp: 4,
  getmoney: 2, getcoins: 1, getnum: 1, getmonname: 2, getitemname: 2, getcurlandmarkname: 1, gettrainername: 3, getstring: 3, itemnotify: 0,
  pocketisfull: 0, opentext: 0, reanchormap: 1, refreshscreen: 1, closetext: 0, writeunusedbyte: 1, farwritetext: 3, writetext: 2, repeattext: 2,
  yesorno: 0, loadmenu: 2, closewindow: 0, jumptextfaceplayer: 2, farjumptext: 3, jumptext: 2, waitbutton: 0, promptbutton: 0, pokepic: 1,
  closepokepic: 0, _2dmenu: 0, verticalmenu: 0, loadpikachudata: 0, randomwildmon: 0, loadtemptrainer: 0, loadwildmon: 2, loadtrainer: 2,
  startbattle: 0, reloadmapafterbattle: 0, catchtutorial: 1, trainertext: 1, trainerflagaction: 1, winlosstext: 4, scripttalkafter: 0,
  endifjustbattled: 0, checkjustbattled: 0, setlasttalked: 1, applymovement: 3, applymovementlasttalked: 2, faceplayer: 0, faceobject: 2,
  variablesprite: 2, disappear: 1, appear: 1, follow: 2, stopfollow: 0, moveobject: 3, writeobjectxy: 1, loademote: 1, showemote: 3,
  turnobject: 2, follownotexact: 2, earthquake: 1, changemapblocks: 3, changeblock: 3, reloadmap: 0, refreshmap: 0, reloadmappart: 0,
  writecmdqueue: 2, delcmdqueue: 1, playmusic: 2, encountermusic: 0, musicfadeout: 3, playmapmusic: 0, dontrestartmapmusic: 0, cry: 2,
  playsound: 2, waitsfx: 0, warpsound: 0, specialsound: 0, autoinput: 3, newloadmap: 1, pause: 1, deactivatefacing: 1, sdefer: "pointer",
  priorityjump: "pointer", prioritysjump: "pointer", warpcheck: 0, stopandsjump: "pointer", endcallback: 0, end: 0, reloadend: 1, endall: 0,
  pokemart: 3, elevator: 2, trade: 1, askforphonenumber: 1, phonecall: 2, hangup: 0, describedecoration: 1, fruittree: 1, specialphonecall: 2,
  checkphonecall: 0, verbosegiveitem: 2, verbosegiveitemvar: 2, swarm: 3, halloffame: 0, credits: 0, warpfacing: 5, battletowertext: 1,
  getlandmarkname: 2, gettrainerclassname: 2, getname: 3, wait: 1, checksave: 0,
};
const ENDS = new Set(["end", "endall", "endcallback", "sjump", "farsjump", "memjump", "jumpstd", "jumptext", "farjumptext", "jumptextfaceplayer",
  "reloadend", "stopandsjump", "halloffame", "credits", "fruittree", "describedecoration", "scripttalkafter"]);

export interface Gap { kind: "command" | "special" | "asm"; name: string; where: string }

/** Every command, special and routine reachable from `entries`, with the scripts reached. */
export function walkScripts(rom: CrystalRom, entries: { at: number; where: string }[]) {
  const seen = new Set<number>(), gaps = new Map<string, Gap>(), specials = new Set<string>(), routines = new Set<string>();
  const queue = [...entries];
  const gap = (g: Gap) => { if (!gaps.has(`${g.kind}:${g.name}`)) gaps.set(`${g.kind}:${g.name}`, g); };
  while (queue.length) {
    const { at, where } = queue.shift()!;
    let pos = at;
    for (let guard = 0; guard < 2000 && pos > 0 && pos < rom.bytes.length; guard++) {
      if (seen.has(pos)) break;
      seen.add(pos);
      const op = rom.u8(pos), name = SCRIPT_COMMANDS[op];
      if (!name) { gap({ kind: "command", name: "$" + op.toString(16), where: `${where} at ${pos.toString(16)}` }); break; }
      if (!SUPPORTED_COMMANDS.has(name)) gap({ kind: "command", name, where });
      const args = ARGS[name];
      const bank = rom.bankOf(pos);
      const p = pos + 1;
      let size: number;
      if (args === "pointer") { size = 2; queue.push({ at: rom.at(bank, rom.u16(p)), where }); }
      else if (args === "far") { size = 3; queue.push({ at: rom.far(p), where }); }
      else if (args === -1) size = rom.u8(p + 3) ? 8 : 4;
      else size = args ?? 0;
      if (name === "iftrue" || name === "iffalse") { /* both branches */ }
      if (["ifequal", "ifnotequal", "ifgreater", "ifless"].includes(name)) queue.push({ at: rom.at(bank, rom.u16(p + 1)), where });
      if (name === "jumpstd" || name === "callstd") queue.push({ at: rom.far(SYM.StdScripts + rom.u16(p) * 3), where: `${where} → std ${STD[rom.u16(p)]}` });
      if (name === "special") {
        const s = SPECIALS[rom.u16(p)];
        specials.add(s);
        if (!s || !specialSupported(s)) gap({ kind: "special", name: s ?? `#${rom.u16(p)}`, where });
      }
      if (name === "callasm") {
        const r = asmName(rom.far(p)) ?? `$${rom.far(p).toString(16)}`;
        routines.add(r);
        if (!SUPPORTED_ASM.has(r)) gap({ kind: "asm", name: r, where });
      }
      if (name === "fruittree") queue.push({ at: SYM.FruitTreeScript, where });
      pos = p + size;
      if (ENDS.has(name)) break;
    }
  }
  return { gaps: [...gaps.values()], specials, routines, scripts: seen.size };
}

/** Every script a map can run. */
export function mapEntries(rom: CrystalRom) {
  const out: { at: number; where: string }[] = [];
  // The Battle Tower isn't part of these adventures.
  for (const map of rom.allMaps().filter(m => !m.name.startsWith("BATTLE_TOWER_") || m.name === "BATTLE_TOWER_OUTSIDE")) {
    const where = map.name;
    map.scenes.forEach(at => out.push({ at, where }));
    map.callbacks.forEach(c => out.push({ at: c.script, where }));
    map.coords.forEach(c => out.push({ at: c.script, where }));
    for (const bg of map.bgs) {
      if (bg.kind === C("BGEVENT_ITEM")) continue;
      if (bg.kind === C("BGEVENT_IFSET") || bg.kind === C("BGEVENT_IFNOTSET")) out.push({ at: rom.at(map.bank, rom.u16(bg.script + 2)), where });
      else if (bg.kind !== C("BGEVENT_COPY")) out.push({ at: bg.script, where });
    }
    for (const o of map.objects) {
      if (o.type === C("OBJECTTYPE_SCRIPT")) out.push({ at: o.script, where });
      // A trainer pointing into the home bank (the Burned Tower rival's ObjectEvent) has no header.
      else if (o.type === C("OBJECTTYPE_TRAINER") && o.script >= 0x4000) out.push({ at: rom.at(map.bank, rom.u16(o.script + 10)), where });
    }
  }
  return out;
}

/** Phone scripts and the engine's own helper scripts. */
export function engineEntries(rom: CrystalRom) {
  const out: { at: number; where: string }[] = [];
  STD.forEach((name, i) => out.push({ at: rom.far(SYM.StdScripts + i * 3), where: `std ${name}` }));
  for (let i = 0; i < (CONST.NUM_PHONE_CONTACTS ?? 0) + 1; i++) {
    const o = SYM.PhoneContacts + i * 12;
    out.push({ at: rom.far(o + 5), where: `phone ${i}` }, { at: rom.far(o + 9), where: `phone ${i}` });
  }
  for (const label of ["FindItemInBallScript", "HiddenItemScript", "FruitTreeScript", "BugCatchingContestOverScript"]) if (SYM[label] !== undefined) out.push({ at: SYM[label], where: label });
  return out;
}
