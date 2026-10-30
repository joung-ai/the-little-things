import * as THREE from 'three';
import { temp } from './materials';

export type AgentMode = 'walk' | 'stand';
interface Agent {
  x: number;
  z: number;
  baseZ: number;
  dir: number;
  speed: number;
  mode: AgentMode;
  facing: number;
  phase: number;
  side: number;
  scale: number;
}

const BODY_COLORS = ['#e07a5f', '#3d5a80', '#81b29a', '#f2cc8f', '#9b5de5', '#f15bb5', '#00bbf9', '#ef476f', '#ffd166', '#06d6a0', '#8d99ae', '#e9c46a', '#264653', '#c77dff'];
const SKIN = ['#f1c7a5', '#e0ac85', '#c98d66', '#a8714f', '#f6d3b8'];
const HAIR = ['#1d1a22', '#3a2723', '#24201f', '#5a3b2c', '#121016'];

/**
 * Ambient crowd: three instanced meshes (body, head, hair) for all NPCs, so
 * dozens of people cost three draw calls. No AI, just looping lanes and a
 * cheap side-step around the player.
 */
export class Crowd {
  group = new THREE.Group();
  agents: Agent[] = [];
  private body: THREE.InstancedMesh;
  private head: THREE.InstancedMesh;
  private hair: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();
  private t = 0;
  /** walkers inside this x-range keep away from the river edge (bench area) */
  quiet: { x0: number; x1: number; z: number }[] = [];

  constructor(count: number, public xMin: number, public xMax: number) {
    const bodyGeo = new THREE.CylinderGeometry(0.15, 0.22, 0.78, 7);
    bodyGeo.translate(0, 0.39, 0);
    const headGeo = new THREE.IcosahedronGeometry(0.21, 1);
    const hairGeo = new THREE.SphereGeometry(0.225, 8, 5, 0, Math.PI * 2, 0, 1.6);
    const mk = (geo: THREE.BufferGeometry) => {
      const im = new THREE.InstancedMesh(geo, temp(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true })), count);
      im.frustumCulled = false;
      im.userData.dynamic = true;
      this.group.add(im);
      return im;
    };
    this.body = mk(bodyGeo);
    this.head = mk(headGeo);
    this.hair = mk(hairGeo);
    this.group.userData.dynamic = true;
  }

  add(a: Partial<Agent> & { x: number; z: number; mode: AgentMode }): void {
    const i = this.agents.length;
    if (i >= this.body.count) return;
    const r = (n: number) => Math.abs(Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1;
    this.agents.push({
      x: a.x,
      z: a.z,
      baseZ: a.z,
      dir: a.dir ?? (r(1) < 0.5 ? 1 : -1),
      speed: a.speed ?? 0.55 + r(2) * 0.6,
      mode: a.mode,
      facing: a.facing ?? 0,
      phase: r(3) * 10,
      side: 0,
      scale: 0.9 + r(4) * 0.18,
    });
    const c = new THREE.Color();
    this.body.setColorAt(i, c.set(BODY_COLORS[Math.floor(r(5) * BODY_COLORS.length)]));
    this.head.setColorAt(i, c.set(SKIN[Math.floor(r(6) * SKIN.length)]));
    this.hair.setColorAt(i, c.set(HAIR[Math.floor(r(7) * HAIR.length)]));
  }

  finalize(): void {
    this.body.count = this.agents.length;
    this.head.count = this.agents.length;
    this.hair.count = this.agents.length;
    for (const im of [this.body, this.head, this.hair]) if (im.instanceColor) im.instanceColor.needsUpdate = true;
    this.update(0, []);
  }

  update(dt: number, avoid: THREE.Vector3[], reducedMotion = false): void {
    this.t += dt;
    const span = this.xMax - this.xMin;
    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      let bob = 0;
      if (a.mode === 'walk') {
        a.x += a.dir * a.speed * dt;
        if (a.x > this.xMax) a.x -= span;
        if (a.x < this.xMin) a.x += span;
        // side-step around the couple
        let want = 0;
        let maxSide = 1.1;
        for (const q of this.quiet) {
          if (a.baseZ < q.z && a.x > q.x0 && a.x < q.x1) {
            want = q.z - a.baseZ;
            maxSide = Math.max(maxSide, want);
          }
        }
        for (const p of avoid) {
          const dx = p.x - a.x;
          const dz = p.z - (a.baseZ + a.side);
          if (Math.abs(dx) < 1.6 && Math.abs(dz) < 0.9) want = dz > 0 ? -1.0 : 1.0;
        }
        a.side += (want - a.side * (want === 0 ? 1 : 0)) * Math.min(1, dt * 2.5);
        a.side = THREE.MathUtils.clamp(a.side, -1.1, maxSide);
        a.z = a.baseZ + a.side;
        a.facing = a.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        a.phase += dt * a.speed * 9;
        bob = Math.abs(Math.sin(a.phase)) * 0.04;
      } else {
        a.phase += dt;
        bob = reducedMotion ? 0 : Math.sin(a.phase * 1.3) * 0.008;
      }
      const sway = a.mode === 'walk' ? Math.sin(a.phase) * 0.06 : 0;
      this.e.set(0, a.facing, sway);
      this.q.setFromEuler(this.e);
      this.s.setScalar(a.scale);
      this.v.set(a.x, bob, a.z);
      this.m.compose(this.v, this.q, this.s);
      this.body.setMatrixAt(i, this.m);
      this.v.set(a.x, (0.98 + bob) * a.scale, a.z);
      this.m.compose(this.v, this.q, this.s);
      this.head.setMatrixAt(i, this.m);
      this.v.set(a.x - Math.sin(a.facing) * 0.02 * a.scale, (1.0 + bob) * a.scale, a.z - Math.cos(a.facing) * 0.02 * a.scale);
      this.m.compose(this.v, this.q, this.s);
      this.hair.setMatrixAt(i, this.m);
    }
    this.body.instanceMatrix.needsUpdate = true;
    this.head.instanceMatrix.needsUpdate = true;
    this.hair.instanceMatrix.needsUpdate = true;
  }
}
