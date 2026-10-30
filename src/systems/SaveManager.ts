import type { MemoryId } from '../data/memories';

export interface Settings {
  muted: boolean;
  music: number;
  ambience: number;
  sfx: number;
  reducedMotion: boolean;
  lowEffects: boolean;
  rememberAnswer: boolean;
}

export type Checkpoint = 'lrt' | 'esplanade' | 'garden' | null;

export interface SaveData {
  version: 1;
  checkpoint: Checkpoint;
  memories: MemoryId[];
  proposalComplete: boolean;
  gardenUnlocked: boolean;
  answer: 'yes' | 'talk' | null;
  settings: Settings;
}

const KEY = 'the-little-things.save.v1';

function defaults(): SaveData {
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    version: 1,
    checkpoint: null,
    memories: [],
    proposalComplete: false,
    gardenUnlocked: false,
    answer: null,
    settings: {
      muted: false,
      music: 0.6,
      ambience: 0.7,
      sfx: 0.8,
      reducedMotion: reduced,
      lowEffects: false,
      rememberAnswer: false,
    },
  };
}

/** Local-only persistence (localStorage). Nothing is synced between devices. */
export class SaveManager {
  data: SaveData = defaults();

  load(): SaveData {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SaveData>;
        const d = defaults();
        this.data = { ...d, ...parsed, settings: { ...d.settings, ...(parsed.settings || {}) } } as SaveData;
      }
    } catch {
      this.data = defaults();
    }
    return this.data;
  }

  save(): void {
    try {
      const copy = { ...this.data };
      if (!copy.settings.rememberAnswer) copy.answer = null;
      localStorage.setItem(KEY, JSON.stringify(copy));
    } catch {
      /* storage unavailable (private mode etc.) — the game still works */
    }
  }

  unlock(id: MemoryId): boolean {
    if (this.data.memories.includes(id)) return false;
    this.data.memories.push(id);
    this.save();
    return true;
  }

  has(id: MemoryId): boolean {
    return this.data.memories.includes(id);
  }

  /** Restart the story but keep settings and the garden unlock. */
  restartStory(): void {
    const keep = this.data.settings;
    const garden = this.data.gardenUnlocked;
    const answer = this.data.answer;
    const done = this.data.proposalComplete;
    this.data = defaults();
    this.data.settings = keep;
    this.data.gardenUnlocked = garden;
    this.data.proposalComplete = done;
    this.data.answer = answer;
    this.save();
  }

  eraseAll(): void {
    this.data = defaults();
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }
}
