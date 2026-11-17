// Run after build-native.sh; optionally pass an English Crystal 1.1 ROM path.
// The ROM is read locally and never copied to build output.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
(async () => {
 const romPath = process.argv[2] || 'pokecrystal11.gbc';
 const rom = fs.readFileSync(romPath);
 assert.equal(crypto.createHash('sha1').update(rom).digest('hex'), 'f4cd194bdee0d04ca4eac29e09b8e4e9d818c133');
 const { instance } = await WebAssembly.instantiate(fs.readFileSync('public/astra_native.wasm'), {});
 const w = instance.exports;
 function bytes(data, fn) { const p=w.alloc(data.length);new Uint8Array(w.memory.buffer,p,data.length).set(data);try {const out=fn(p,data.length);return new Uint8Array(w.memory.buffer,out,w.output_len()).slice()} finally {w.dealloc(p,data.length)} }
 function call(value) {const result=JSON.parse(Buffer.from(bytes(Buffer.from(JSON.stringify(value)),w.request)).toString());if(result.error)throw Error(result.error);return result}
 const mon=call({op:'make',id:58,level:6});assert.equal(mon.species,58);
 const party=Array.from({length:6},(_,i)=>({...mon,nickname:`MON${i}`}));
 const setup={player:{name:'ASTRA',id:4660,gender:0,money:3000,johto_badges:0,kanto_badges:0,mom_saving:0,mom_money:0},party,bag:{items:[],balls:[[1,1]]},opponent:{Wild:{species:19,level:3}},options:{battle_scene:true},world:{time_of_day:2,unlocked_unowns:0,rival_name:'ROBIN',seen:[],caught:[],unown_dex:[],location:0}};
 let battle=call({op:'start',setup,seed:1});const ball=battle.legal.findIndex(a=>a.Item?.id===1);assert.notEqual(ball,-1);battle=call({op:'act',index:ball});assert.equal(battle.outcome,'caught');assert.equal(battle.result.caught,6);assert.deepEqual(battle.result.party.map(m=>m.nickname),['MON0','MON1','MON2','MON3','MON4','MON5','RATTATA']);
 // Potion updates the actual battle and consumes a bag item.
 const injured={...setup,party:[{...mon,hp:1}],bag:{items:[[18,2]],balls:[]}};
 battle=call({op:'start',setup:injured,seed:5});const potion=battle.legal.findIndex(a=>a.Item?.id===18 && a.Item.target===0);assert.notEqual(potion,-1);battle=call({op:'act',index:potion});assert.ok(battle.state.player.active.hp>1);
 // A faint prompts a forced switch and preserves the knocked-out member.
 const forced={...setup,party:[{...mon,hp:1},mon],bag:{items:[],balls:[]},opponent:{Wild:{species:19,level:20}}};
 battle=call({op:'start',setup:forced,seed:4});let growl=battle.legal.findIndex(a=>a.Move?.slot===1);battle=call({op:'act',index:growl});assert.equal(battle.site,'ForcedSwitch');const replacement=battle.legal.findIndex(a=>a.ForcedSwitch?.slot===1);assert.notEqual(replacement,-1);battle=call({op:'act',index:replacement});assert.equal(battle.state.player.active_slot,1);assert.equal(battle.state.player.party[0].hp,0);
 // A trainer with a custom two-member party, switching and persistent results.
 const enemy=call({op:'make',id:19,level:3});
 const trainer={...setup,party:[{...mon,hp:1},mon],bag:{items:[[18,2]],balls:[]},opponent:{Trainer:{class:1,id:1,party:[enemy,enemy],items:null,ai_flags:null,control:'original'}}};
 battle=call({op:'start',setup:trainer,seed:7});let switchIndex=battle.legal.findIndex(a=>a.Switch?.slot===1);assert.notEqual(switchIndex,-1);battle=call({op:'act',index:switchIndex});
 for(let turns=0;!battle.outcome&&turns<100;turns++){let pick=battle.legal.findIndex(a=>a.Move);if(pick<0)pick=battle.legal.findIndex(a=>a.OfferSwitch?.keep);if(pick<0)pick=battle.legal.findIndex(a=>a.ForcedSwitch);if(pick<0)pick=0;battle=call({op:'act',index:pick})}assert.ok(battle.result,'trainer battle should finish');assert.equal(battle.result.party.length,2);assert.equal(battle.result.party[0].hp,1);
 for(let id=1;id<=251;id++)for(let back=0;back<2;back++){const q=(id===201?0x124000:0x120000+(id-1)*6)+back*3;const offset=(rom[q]+0x36)*0x4000+((rom[q+1]|rom[q+2]<<8)&0x3fff);const data=bytes(rom.subarray(offset,offset+0x4000),w.decompress);const side=back?6:rom[0x51424+(id-1)*32+17]>>4;assert.ok(side>=5&&side<=7,`species ${id} size ${side}`);assert.ok(data.length>=side*side*16,`species ${id} picture truncated`)}
 const single=bytes(rom,(p,n)=>w.music(p,n,0x3a,0x7808,0,48000));assert.ok(single.some(x=>x));const p=w.alloc(rom.length);new Uint8Array(w.memory.buffer,p,rom.length).set(rom);assert.equal(w.music_start(p,rom.length,0x3a,0x7808),1);w.dealloc(p,rom.length);let ptr=w.music_next(24000),a=Buffer.from(new Uint8Array(w.memory.buffer,ptr,w.output_len()).slice());ptr=w.music_next(24000);let b=Buffer.from(new Uint8Array(w.memory.buffer,ptr,w.output_len()).slice());assert.deepEqual(Buffer.concat([a,b]),Buffer.from(single));assert.ok(bytes(rom,(p,n)=>w.cry(p,n,25)).some(x=>x));
 console.log('Native WASM: full-party capture, trainer switching, 502 ROM pictures, title music and Pikachu cry passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
