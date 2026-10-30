import { S, StoryState, TRANSITIONS } from '../data/story';

type Listener = (to: StoryState, from: StoryState) => void;

/** Explicit story state machine. Illegal transitions are refused. */
export class GameState {
  state: StoryState = S.TITLE;
  private listeners: Listener[] = [];

  can(to: StoryState): boolean {
    return TRANSITIONS[this.state].includes(to);
  }

  is(...states: StoryState[]): boolean {
    return states.includes(this.state);
  }

  go(to: StoryState): boolean {
    if (!this.can(to)) {
      console.warn(`[story] refused transition ${this.state} -> ${to}`);
      return false;
    }
    const from = this.state;
    this.state = to;
    for (const l of this.listeners) l(to, from);
    return true;
  }

  /** Only used for restart / title. */
  reset(): void {
    const from = this.state;
    this.state = S.TITLE;
    for (const l of this.listeners) l(S.TITLE, from);
  }

  onChange(l: Listener): void {
    this.listeners.push(l);
  }
}
