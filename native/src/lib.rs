use crystal_battle::{
    battle::{Battle, BattleSetup, Pokemon, Status},
    data::{GameData, move_pp, names},
};
use serde_json::{Value, json};
use std::cell::RefCell;
thread_local! { static BATTLE: RefCell<Option<Battle>> = const { RefCell::new(None) }; static OUTPUT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) }; }

fn make_mon(id: u8, level: u8) -> Result<Pokemon, String> {
    let cfg = json!({"battle":{"type":"wild_encounter"},"player_party":[{"species":names::species_name(id),"level":level}],"enemy_party":[{"species":"RATTATA","level":2}]});
    let cfg = serde_json::from_value(cfg).map_err(|e| format!("{e}"))?;
    let (setup, _) = BattleSetup::from_config(&cfg, 12345)?;
    setup
        .party
        .into_iter()
        .next()
        .ok_or("could not generate Pokémon".into())
}
fn snapshot(b: &Battle) -> Value {
    let (site, legal, state, events, outcome) = match b.status() {
        Status::Decision(d) => (
            json!(d.site),
            json!(d.legal),
            json!(d.state),
            json!(d.events),
            Value::Null,
        ),
        Status::Ended {
            outcome,
            state,
            events,
        } => (
            Value::Null,
            json!([]),
            json!(state),
            json!(events),
            json!(outcome),
        ),
    };
    json!({"site":site,"legal":legal,"state":state,"events":events,"outcome":outcome,"result":b.result()})
}
fn run(v: Value) -> Result<Value, String> {
    match v["op"].as_str().unwrap_or("") {
        "species" => {
            let id = v["id"].as_u64().unwrap_or(0) as u8;
            if !(1..=251).contains(&id) {
                return Err("Invalid species".into());
            }
            Ok(json!({"id":id,"name":names::species_name(id)}))
        }
        "move" => {
            let id = v["id"].as_u64().unwrap_or(0) as u8;
            Ok(json!({"id":id,"name":names::move_name(id),"pp":move_pp::max_pp(id,0)}))
        }
        "make" => {
            let id = v["id"].as_u64().unwrap_or(0) as u8;
            let level = v["level"].as_u64().unwrap_or(1) as u8;
            if !(1..=251).contains(&id) || !(1..=100).contains(&level) {
                return Err("Invalid species or level".into());
            }
            Ok(json!(make_mon(id, level)?))
        }
        "heal" => {
            let mut m: Pokemon =
                serde_json::from_value(v["mon"].clone()).map_err(|e| e.to_string())?;
            m.hp = m.stats[0];
            m.status = 0;
            for i in 0..4 {
                m.pp[i] = move_pp::max_pp(m.moves[i], m.pp[i]) | (m.pp[i] & 0xc0);
            }
            Ok(json!(m))
        }
        "start" => {
            let mut setup: BattleSetup =
                serde_json::from_value(v["setup"].clone()).map_err(|e| e.to_string())?;
            if setup.party.is_empty() {
                return Err("Party is empty".into());
            }
            setup.party.truncate(6);
            let b = Battle::start(GameData::crystal(), &setup, v["seed"].as_u64().unwrap_or(1))
                .map_err(|e| e.to_string())?;
            let out = snapshot(&b);
            BATTLE.with(|slot| *slot.borrow_mut() = Some(b));
            Ok(out)
        }
        "act" => BATTLE.with(|slot| {
            let mut slot = slot.borrow_mut();
            let b = slot.as_mut().ok_or("No battle")?;
            let index = v["index"].as_u64().ok_or("Missing action index")? as usize;
            let action = *b
                .decision()
                .ok_or("Battle ended")?
                .legal
                .get(index)
                .ok_or("Invalid action")?;
            b.step(action).map_err(|e| e.to_string())?;
            Ok(snapshot(b))
        }),
        _ => Err("Unknown operation".into()),
    }
}
#[unsafe(no_mangle)]
pub extern "C" fn alloc(len: usize) -> *mut u8 {
    let mut v = Vec::<u8>::with_capacity(len);
    let p = v.as_mut_ptr();
    std::mem::forget(v);
    p
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn dealloc(ptr: *mut u8, len: usize) {
    unsafe { drop(Vec::from_raw_parts(ptr, 0, len)) }
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn request(ptr: *const u8, len: usize) -> *const u8 {
    let input = unsafe { std::slice::from_raw_parts(ptr, len) };
    let response = match serde_json::from_slice(input) {
        Ok(v) => run(v).unwrap_or_else(|e| json!({"error":e})),
        Err(e) => json!({"error":e.to_string()}),
    };
    OUTPUT.with(|o| {
        let mut o = o.borrow_mut();
        *o = serde_json::to_vec(&response).unwrap();
        o.as_ptr()
    })
}
#[unsafe(no_mangle)]
pub extern "C" fn output_len() -> usize {
    OUTPUT.with(|o| o.borrow().len())
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn decompress(ptr: *const u8, len: usize) -> *const u8 {
    let bytes = unsafe { std::slice::from_raw_parts(ptr, len) };
    let data = pokemon_sprite_compression::gen2::decompress(bytes);
    OUTPUT.with(|o| {
        let mut o = o.borrow_mut();
        *o = data;
        o.as_ptr()
    })
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn music(
    ptr: *const u8,
    len: usize,
    bank: u32,
    addr: u32,
    start: u32,
    count: u32,
) -> *const u8 {
    let rom = unsafe { std::slice::from_raw_parts(ptr, len) };
    let pcm: Vec<f32> = pokemon_synthesizer::gen2::music(rom, bank as u8, addr as u16, 48000)
        .unwrap()
        .skip(start as usize)
        .take(count.min(48000 * 30) as usize)
        .collect();
    OUTPUT.with(|o| {
        let mut o = o.borrow_mut();
        *o = pcm.iter().flat_map(|s| s.to_le_bytes()).collect();
        o.as_ptr()
    })
}
#[unsafe(no_mangle)]
pub unsafe extern "C" fn cry(ptr: *const u8, len: usize, id: u32) -> *const u8 {
    let rom = unsafe { std::slice::from_raw_parts(ptr, len) };
    let i = 0xf2787 + (id as usize - 1) * 6;
    let word = |p: usize| u16::from_le_bytes([rom[p], rom[p + 1]]);
    let cry = word(i) as usize;
    let p = 0xe91b0 + cry * 3;
    let bank = rom[p];
    let addr = word(p + 1);
    let pitch = word(i + 2) as i16;
    let length = word(i + 4);
    let pcm: Vec<f32> = pokemon_synthesizer::gen2::synthesis(rom, bank, addr, pitch, length)
        .iter()
        .step_by(22)
        .take(48000 * 8)
        .collect();
    OUTPUT.with(|o| {
        let mut o = o.borrow_mut();
        *o = pcm.iter().flat_map(|s| s.to_le_bytes()).collect();
        o.as_ptr()
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn creates_and_heals_real_mon() {
        let mut mon = make_mon(58, 6).unwrap();
        assert_eq!(mon.species, 58);
        assert!(mon.hp > 0);
        mon.hp = 1;
        mon.status = 8;
        let healed = run(json!({"op":"heal","mon":mon})).unwrap();
        assert_eq!(healed["hp"], healed["stats"][0]);
        assert_eq!(healed["status"], 0);
    }
    #[test]
    fn wild_battle_produces_persistent_result() {
        let mon = make_mon(58, 6).unwrap();
        let cfg = json!({"battle":{"type":"wild_encounter"},"player_party":[{"species":"GROWLITHE","level":6}],"enemy_party":[{"species":"RATTATA","level":3}]});
        let cfg = serde_json::from_value(cfg).unwrap();
        let (mut setup, _) = BattleSetup::from_config(&cfg, 1).unwrap();
        setup.party = vec![mon];
        let mut b = Battle::start(GameData::crystal(), &setup, 1).unwrap();
        for _ in 0..100 {
            let Some(d) = b.decision() else { break };
            let action = *d
                .legal
                .iter()
                .find(|a| matches!(a, crystal_battle::battle::Action::Move { .. }))
                .unwrap_or(&d.legal[0]);
            b.step(action).unwrap();
        }
        let result = b.result().expect("battle should end");
        assert_eq!(result.party[0].species, 58);
        assert!(result.party[0].exp > 270);
        assert!(result.party[0].pp[0] < 25);
    }
}
#[cfg(test)]
mod learn_tests {
    use super::*;
    use crystal_battle::battle::{Action, PromptSite};
    #[test]
    fn level_up_offers_move_choice_and_honours_it() {
        let mut mon = make_mon(1, 6).unwrap();
        mon.moves = [33, 45, 39, 52];
        mon.pp = [35, 40, 30, 25];
        mon.hp = 500;
        mon.stats = [500, 500, 500, 500, 500, 500];
        let cfg = json!({"battle":{"type":"wild_encounter"},"player_party":[{"species":"BULBASAUR","level":6}],"enemy_party":[{"species":"CATERPIE","level":20}]});
        let cfg = serde_json::from_value(cfg).unwrap();
        let (mut setup, _) = BattleSetup::from_config(&cfg, 42).unwrap();
        setup.party = vec![mon];
        let mut battle = Battle::start(GameData::crystal(), &setup, 42).unwrap();
        for _ in 0..50 {
            let d = battle.decision().expect("ended before learn prompt");
            if d.site == PromptSite::LearnMove {
                assert!(d.legal.contains(&Action::LearnMove { slot: None }));
                assert!(d.legal.contains(&Action::LearnMove { slot: Some(2) }));
                battle.step(Action::LearnMove { slot: Some(2) }).unwrap();
                break;
            }
            let a = *d
                .legal
                .iter()
                .find(|a| matches!(a, Action::Move { slot: 3 }))
                .unwrap();
            battle.step(a).unwrap();
        }
        let result = battle
            .result()
            .expect("battle should finish after learning");
        assert_eq!(result.party[0].moves, [33, 45, 73, 52]);
    }
}
// The verified browser ROM is copied once, so the synthesizer can keep a
// stable borrowed cartridge while yielding successive continuous chunks.
static AUDIO_ROM: std::sync::OnceLock<Box<[u8]>> = std::sync::OnceLock::new();
thread_local! { static MUSIC_STREAM: RefCell<Option<pokemon_synthesizer::gen2::MusicIterator<'static>>> = const { RefCell::new(None) }; }
#[unsafe(no_mangle)]
pub unsafe extern "C" fn music_start(ptr: *const u8, len: usize, bank: u32, addr: u32) -> u32 {
    let bytes = unsafe { std::slice::from_raw_parts(ptr, len) };
    let rom = AUDIO_ROM.get_or_init(|| bytes.to_vec().into_boxed_slice());
    let stream = pokemon_synthesizer::gen2::music(rom, bank as u8, addr as u16, 48000);
    let ok = stream.is_some();
    MUSIC_STREAM.with(|m| *m.borrow_mut() = stream);
    u32::from(ok)
}
#[unsafe(no_mangle)]
pub extern "C" fn music_next(count: u32) -> *const u8 {
    let samples = MUSIC_STREAM.with(|m| {
        let mut m = m.borrow_mut();
        m.as_mut()
            .map(|s| s.take(count.min(48000 * 10) as usize).collect::<Vec<_>>())
            .unwrap_or_default()
    });
    OUTPUT.with(|o| {
        let mut o = o.borrow_mut();
        *o = samples.iter().flat_map(|s| s.to_le_bytes()).collect();
        o.as_ptr()
    })
}
