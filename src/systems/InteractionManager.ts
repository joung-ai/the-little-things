import * as THREE from 'three';

export interface Interactable {
  id: string;
  /** Verb shown in the prompt, e.g. "Talk", "Catch the letter" */
  prompt: string;
  position: () => THREE.Vector3;
  radius: number;
  enabled: () => boolean;
  action: () => void;
  /** optional floating marker; shown only while enabled */
  marker?: THREE.Object3D;
  completed?: boolean;
}

/** One reusable proximity-interaction system for every interactable. */
export class InteractionManager {
  items: Interactable[] = [];
  current: Interactable | null = null;
  locked = false;
  onChange: (i: Interactable | null) => void = () => {};
  private t = 0;
  private tmp = new THREE.Vector3();

  add(i: Interactable): Interactable {
    this.items.push(i);
    return i;
  }

  clear(): void {
    this.items = [];
    this.setCurrent(null);
  }

  private setCurrent(i: Interactable | null): void {
    if (i !== this.current) {
      this.current = i;
      this.onChange(i);
    }
  }

  update(dt: number, player: THREE.Vector3 | null): void {
    this.t += dt;
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const it of this.items) {
      const en = it.enabled();
      if (it.marker) {
        it.marker.visible = en;
        if (en) {
          const p = it.position();
          it.marker.position.set(p.x, p.y + 0.15 * Math.sin(this.t * 2.6), p.z);
          it.marker.rotation.y += dt * 1.6;
        }
      }
      if (!en || !player || this.locked) continue;
      const p = it.position();
      this.tmp.set(p.x - player.x, 0, p.z - player.z);
      const d = this.tmp.length();
      if (d < it.radius && d < bestD) {
        best = it;
        bestD = d;
      }
    }
    this.setCurrent(best);
  }

  trigger(): boolean {
    if (this.locked || !this.current || !this.current.enabled()) return false;
    const it = this.current;
    this.setCurrent(null);
    it.action();
    return true;
  }
}
