import type { YellowGame } from "./runtime";

/** Talking to the Pikachu that follows you shows how it feels about you. */
export async function talkToPikachu(game: YellowGame) {
  const pikachu = game.save.party.find(m => m.species === 25);
  if (!pikachu) return;
  const happiness = pikachu.happiness;
  game.ctx.cry(25);
  const mood = happiness >= 200 ? "smile" : happiness >= 100 ? "smile" : "question";
  await game.emote("pikachu", mood);
  const name = pikachu.nickname || "PIKACHU";
  const line = happiness >= 220 ? `${name} looks delighted to be with you!`
    : happiness >= 150 ? `${name} is happy!`
    : happiness >= 100 ? `${name} seems content.`
    : happiness >= 50 ? `${name} is keeping its distance.`
    : `${name} looks grumpy…`;
  await game.say(line);
}
