import * as THREE from 'three';
import type { CameraController } from '../systems/CameraController';
import type { InputManager } from '../systems/InputManager';
import type { Character } from './CharacterFactory';

/** Axis-aligned box on the ground plane. */
export interface Box2 {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface WalkArea {
  bounds: Box2;
  colliders: Box2[];
}

export function box(cx: number, cz: number, w: number, d: number): Box2 {
  return { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 };
}

/** Push a circle out of all colliders and keep it inside the bounds. */
export function resolveCircle(p: THREE.Vector3, r: number, area: WalkArea): void {
  for (let iter = 0; iter < 2; iter++) {
    for (const b of area.colliders) {
      const cx = THREE.MathUtils.clamp(p.x, b.minX, b.maxX);
      const cz = THREE.MathUtils.clamp(p.z, b.minZ, b.maxZ);
      const dx = p.x - cx;
      const dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          p.x = cx + (dx / d) * r;
          p.z = cz + (dz / d) * r;
        } else {
          // centre inside the box: push along the smallest overlap
          const pens = [p.x - b.minX + r, b.maxX - p.x + r, p.z - b.minZ + r, b.maxZ - p.z + r];
          const i = pens.indexOf(Math.min(...pens));
          if (i === 0) p.x = b.minX - r;
          else if (i === 1) p.x = b.maxX + r;
          else if (i === 2) p.z = b.minZ - r;
          else p.z = b.maxZ + r;
        }
      }
    }
  }
  const B = area.bounds;
  p.x = THREE.MathUtils.clamp(p.x, B.minX + r, B.maxX - r);
  p.z = THREE.MathUtils.clamp(p.z, B.minZ + r, B.maxZ - r);
}

export class PlayerController {
  vel = new THREE.Vector3();
  maxSpeed = 2.5;
  radius = 0.28;
  private desired = new THREE.Vector3();

  constructor(public ch: Character) {}

  update(dt: number, input: InputManager, cam: CameraController, area: WalkArea, enabled: boolean): void {
    cam.moveVector(enabled ? input.move : { x: 0, y: 0 }, this.desired).multiplyScalar(this.maxSpeed);
    const accel = this.desired.lengthSq() > this.vel.lengthSq() ? 9 : 12;
    this.vel.lerp(this.desired, 1 - Math.exp(-accel * dt));
    const p = this.ch.root.position;
    p.x += this.vel.x * dt;
    p.z += this.vel.z * dt;
    resolveCircle(p, this.radius, area);
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.ch.speed = sp;
    if (sp > 0.15) this.ch.facing = Math.atan2(this.vel.x, this.vel.z);
  }

  stop(): void {
    this.vel.set(0, 0, 0);
    this.ch.speed = 0;
  }
}

/** The girl walks with the player during the Esplanade date. */
export class Follower {
  enabled = true;
  private vel = new THREE.Vector3();
  constructor(public ch: Character, public leader: Character) {}

  update(dt: number, area: WalkArea): void {
    if (!this.enabled) {
      this.ch.speed = 0;
      return;
    }
    const L = this.leader.root.position;
    const p = this.ch.root.position;
    // stand beside and slightly behind the leader
    const f = this.leader.root.rotation.y;
    const tx = L.x - Math.sin(f) * 0.55 + Math.cos(f) * 0.75;
    const tz = L.z - Math.cos(f) * 0.55 - Math.sin(f) * 0.75;
    const dx = tx - p.x;
    const dz = tz - p.z;
    const dist = Math.hypot(dx, dz);
    const want = dist > 0.25 ? Math.min(2.9, dist * 2.4) : 0;
    const vx = dist > 0.001 ? (dx / dist) * want : 0;
    const vz = dist > 0.001 ? (dz / dist) * want : 0;
    this.vel.x += (vx - this.vel.x) * (1 - Math.exp(-dt * 6));
    this.vel.z += (vz - this.vel.z) * (1 - Math.exp(-dt * 6));
    p.x += this.vel.x * dt;
    p.z += this.vel.z * dt;
    // keep personal space from the leader
    const lx = p.x - L.x;
    const lz = p.z - L.z;
    const ld = Math.hypot(lx, lz);
    if (ld < 0.6 && ld > 1e-4) {
      p.x = L.x + (lx / ld) * 0.6;
      p.z = L.z + (lz / ld) * 0.6;
    }
    resolveCircle(p, 0.26, area);
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.ch.speed = sp;
    if (sp > 0.2) this.ch.facing = Math.atan2(this.vel.x, this.vel.z);
    else this.ch.facing = this.leader.root.rotation.y;
  }

  stop(): void {
    this.vel.set(0, 0, 0);
    this.ch.speed = 0;
  }
}
