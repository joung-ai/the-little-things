
export type MemoryId = 'keychain' | 'tteokbokki' | 'sunflower' | 'letter' | 'pets';

export interface Memory {
  id: MemoryId;
  title: string;
  chapter: string;
  description: string;
  object: string;
}

export const MEMORIES: Memory[] = [
  {
    id: 'keychain',
    title: 'The Beginning',
    chapter: 'Chapter One · The LRT · one afternoon or pahapon',
    description: 'One afternoon on the LRT, you typed a question on your phone about my Tamtam keychain kung saan galing. I gave it to you to keep bigla hehe.',
    object: 'Tamtam keychain',
  },
  {
    id: 'tteokbokki',
    title: 'Our First Date',
    chapter: 'Pasig River Esplanade · one evening',
    description: 'We bought tteokbokki from the stalls and ate it beside the river, on our first date.',
    object: 'Tteokbokki',
  },
  {
    id: 'sunflower',
    title: 'One Little Sunflower',
    chapter: 'Pasig River',
    description: 'Its the sunflower in purple wrapping, from a night I will always remember.',
    object: 'Sunflower bouquet',
  },
  {
    id: 'letter',
    title: 'The Letter',
    chapter: 'By the river',
    description: 'I hope you read this letter, and I hope it makes you smile.',
    object: 'Letter',
  },
  {
    id: 'pets',
    title: 'Zed & Kooki',
    chapter: 'By the river',
    description: 'dalawa nating makukulit na bebes',
    object: 'Zed and Kooki',
  },
];
