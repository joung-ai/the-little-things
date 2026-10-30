import * as THREE from 'three';
import type { Game } from '../app/Game';
import { S } from '../data/story';

/**
 * Demo / test mode, enabled by opening the game with `#autoplay`.
 * Plays the whole story hands-free: walks to each story point, advances
 * dialogue, reads the letter for a few seconds and answers "Yes".
 * Never active during normal play.
 */
export class Autopilot {
  private t = 0;
  private lastAdvance = 0;
  private letterSince = -1;
  private proposalSince = -1;
  private phoneSince = -1;
  private endingSince = -1;
  private order = ['tteokbokki', 'eat', 'sunflower', 'bench', 'letter'];

  constructor(private game: Game, public answer: 'yes' | 'talk' = 'yes') {}

  static fromHash(game: Game): Autopilot | null {
    const h = location.hash.replace('#', '');
    if (h === 'autoplay' || h === 'autoplay-talk') return new Autopilot(game, h === 'autoplay-talk' ? 'talk' : 'yes');
    return null;
  }

  update(dt: number): void {
    const g = this.game;
    this.t += dt;
    const vis = (id: string) => {
      const el = document.getElementById(id);
      return !!el && !el.hidden;
    };
    if (g.story.is(S.TITLE)) {
      if (this.t > 2.5 && vis('title') && document.body.classList.contains('ready')) {
        this.t = 0;
        (document.getElementById('btn-start') as HTMLButtonElement).click();
      }
      return;
    }
    // dialogue
    if (g.ui.dialogueActive && this.t - this.lastAdvance > 2.2) {
      this.lastAdvance = this.t;
      g.ui.advance();
    }
    // letter: read for a while, then close
    if (vis('letter')) {
      if (this.letterSince < 0) this.letterSince = this.t;
      if (this.t - this.letterSince > 6) {
        this.letterSince = -1;
        (document.getElementById('btn-letter-done') as HTMLButtonElement).click();
      }
    }
    if (vis('phone')) {
      if (this.phoneSince < 0) this.phoneSince = this.t;
      if (this.t - this.phoneSince > 4) {
        this.phoneSince = -1;
        (document.getElementById('btn-phone-done') as HTMLButtonElement).click();
      }
    }
    if (vis('proposal')) {
      if (this.proposalSince < 0) this.proposalSince = this.t;
      if (this.t - this.proposalSince > 3) {
        this.proposalSince = -1;
        (document.getElementById(this.answer === 'yes' ? 'btn-yes' : 'btn-talk') as HTMLButtonElement).click();
      }
    }
    if (vis('ending')) {
      if (this.endingSince < 0) this.endingSince = this.t;
      if (this.t - this.endingSince > 5) {
        this.endingSince = -1;
        const b = document.querySelector('#ending-buttons .btn.primary') as HTMLButtonElement | null;
        b?.click();
      }
    }
    // walk toward the next story point
    const s = g.scene;
    if (!s || !s.player || g.ui.dialogueActive || g.paused) return;
    const cur = g.interactions.current;
    if (cur && this.order.includes(cur.id) && cur.enabled()) {
      g.act();
      return;
    }
    if (!s.control) return;
    const target = this.order.map((id) => g.interactions.items.find((i) => i.id === id)).find((i) => i && i.enabled());
    if (!target) return;
    if (g.interactions.current === target) {
      g.act();
      return;
    }
    const tp = target.position();
    const p = s.player.root.position;
    const goal = new THREE.Vector3(tp.x, 0, tp.z + (tp.z > 0 ? -1.3 : 1.0));
    const d = goal.clone().sub(p).setY(0);
    const len = d.length();
    if (len > 0.05) {
      const step = Math.min(len, 2.6 * dt);
      p.addScaledVector(d.normalize(), step);
      s.player.speed = 2.4;
      s.player.facing = Math.atan2(d.x, d.z);
      if (len > 14) p.copy(goal); // skip long walks
    }
  }
}
