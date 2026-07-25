/**
 * Prompt banks keep the games replayable: the mechanic stays fixed, the
 * content rotates. Categories are deliberately affectionate — a family app
 * with elders and kids should tease, not roast.
 */

export const AWARD_PROMPTS = [
  'Craziest laugh',
  'Most likely to be late to a wedding',
  'Best cook in the family',
  'Most likely to fall asleep during a movie',
  'Biggest gossip',
  'Best hugger',
  'Worst dancer',
  'Most likely to lose their phone',
  'Family comedian',
  'Most likely to take 100 photos of one thing',
  'Best at giving advice',
  'Most likely to start a food fight',
  'Loudest on a phone call',
  'Most likely to cry at a happy moment',
  'Best gift giver',
  'Most likely to forget a birthday',
  'Family peacemaker',
  'Most likely to sing in the shower',
  'Best storyteller',
  'Most likely to plan the next family trip',
  'Most competitive at board games',
  'Biggest tea/coffee addict',
  'Most likely to reply to messages last',
  'Best at remembering everyone’s birthdays',
];

export const CAPTION_PROMPTS = [
  'Caption this',
  'What are they really thinking?',
  'Give this photo a movie title',
  'Write the group chat message that came right after this',
  'What did they say one second later?',
  'Title this like a newspaper headline',
];

function pick<T>(list: T[], count: number): T[] {
  const pool = [...list];
  const out: T[] = [];
  while (out.length < count && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

export function suggestPrompts(count = 6) {
  return {
    familyAwards: pick(AWARD_PROMPTS, count),
    captionBattle: pick(CAPTION_PROMPTS, Math.min(count, CAPTION_PROMPTS.length)),
  };
}
