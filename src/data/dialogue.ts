/**
 * STORY TEXT — all dialogue and narration lives here.
 *
 * Narration lines restate only the facts that were provided. The few spoken
 * lines are short dramatizations of those facts (she asked for the keychain,
 * he gave it to her to keep). Replace any line with what was really said.
 *
 * speaker: 'him' | 'her' | 'zed' | 'kooki' | 'narration'
 * cue: optional animation/event hook handled by the scene.
 */
export type Speaker = 'him' | 'her' | 'zed' | 'kooki' | 'narration';

export interface DialogueLine {
  speaker: Speaker;
  text: string;
  cue?: string;
}

export const DIALOGUE: Record<string, DialogueLine[]> = {
  lrtIntro: [
    { speaker: 'narration', text: 'One afternoon on the LRT. I was standing by the doors naka NU uniform.' },
  ],
  lrtNotice: [
    { speaker: 'narration', text: 'And someone kept looking at the little Tamtam on my ID Lace. (sino shea, joke)' },
  ],
  lrtTyping: [
    { speaker: 'narration', text: 'Then she started typing something on her phone…' },
  ],
  keychain: [
    { speaker: 'narration', text: 'I took the Tamtam off my uniform and gave it to her to keep.', cue: 'handoff' },
  ],
  lrtChat: [
    { speaker: 'narration', text: 'She kept it. And the two of us talked for a while, right there beside the doors.' },
  ],
  lrtArrive: [
    { speaker: 'narration', text: 'That was the beginning.' },
  ],
  esplanadeArrive: [
    { speaker: 'narration', text: 'At the Pasig River Esplanade, around 8:00 in the evening.' },
    { speaker: 'narration', text: 'Get some tteokbokki from the stalls' },
  ],
  tteokBuy: [
    { speaker: 'narration', text: 'Two cups of tteokbokki.' },
  ],
  tteokbokki: [
    { speaker: 'narration', text: 'We ate it right there, beside the river.' },
    { speaker: 'narration', text: 'The lights on the water, the crowd behind us, the steam from the cups.' },
  ],
  sunflower: [
    { speaker: 'narration', text: 'Suddenly, I went out and brought water and secretly bought you one sunflower, wrapped in purple. hehehe', cue: 'give' },
  ],
  bench: [
    { speaker: 'narration', text: 'The market keeps humming behind us. For a moment it’s just the two of us and the river.' },
  ],
  letterNotice: [
    { speaker: 'narration', text: 'Wait… ano yun, may lumilipad mwehehe' },
  ],
  pets: [
    { speaker: 'zed', text: 'Hi pi! pinapatanong kasi ng lalaking yan' },
    { speaker: 'kooki', text: 'ako na masasabi... Will you be his girlfriend?' },
  ],
  sitAgain: [
    { speaker: 'narration', text: 'You sit by the river again. Take all the time you need.' },
  ],
};

export const PHONE_NOTE = {
  text: 'Where did you get your Tamtam keychain?',
  hint: 'She turned her phone so you could read it',
};

export const PROPOSAL = {
  question: 'Will you be my girlfriend? 💜',
  yes: 'Yes! 💜',
  talk: 'Yes parin',
  yesTitle: '💜',
  yesMessage: 'Here’s to all the little things that brought us here, and all the memories we still have to make.',
  talkMessage: 'hihihi wala kang choice, you’re stuck with me forever',
};

export const OBJECTIVES = {
  lrtStart: 'Look around the carriage',
  lrtTalk: 'Someone by the doors wants to say hi',
  esplanadeBoth: 'Buy tteokbokki · Give her the sunflower',
  esplanadeTteok: 'Buy tteokbokki at the stall',
  esplanadeEat: 'Eat it beside the river',
  esplanadeFlower: 'Give her the sunflower',
  bench: 'Sit together by the river',
  letter: 'Catch the letter',
  garden: 'Revisit your keepsakes',
  freeRoam: 'Enjoy the river · Sit by the bench whenever you like',
};
