import * as THREE from 'three';
import { KEYCHAIN, SUNFLOWER } from '../data/settings';
import { glow, mat, PALETTE, temp } from './materials';
import { haloTexture, signTexture, stripeTexture } from './textures';

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const me = new THREE.Mesh(geo, m);
  me.position.set(x, y, z);
  return me;
}

/** Tamtam keychain — PLACEHOLDER charm design (colours in settings.ts). */
export function makeKeychain(): THREE.Group {
  const g = new THREE.Group();
  const ring = mesh(new THREE.TorusGeometry(0.03, 0.006, 5, 12), mat(KEYCHAIN.ring, { rough: 0.3 }), 0, 0, 0);
  g.add(ring);
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.SphereGeometry(0.008, 5, 4), mat(KEYCHAIN.ring, { rough: 0.3 }), 0, -0.035 - i * 0.016, 0));
  const charm = new THREE.Group();
  charm.position.y = -0.12;
  const body = mesh(new THREE.IcosahedronGeometry(0.06, 1), mat(KEYCHAIN.charm, { emissive: KEYCHAIN.charm, ei: 0.12 }));
  body.scale.set(1, 0.92, 0.85);
  charm.add(body);
  for (const sx of [1, -1]) {
    charm.add(mesh(new THREE.SphereGeometry(0.022, 6, 5), mat(KEYCHAIN.charm), 0.04 * sx, 0.05, 0));
    charm.add(mesh(new THREE.SphereGeometry(0.008, 5, 4), mat('#2a1d24'), 0.022 * sx, 0.008, 0.05));
    const b = mesh(new THREE.SphereGeometry(0.011, 5, 4), mat(KEYCHAIN.accent), 0.036 * sx, -0.012, 0.045);
    b.scale.set(1, 0.6, 0.5);
    charm.add(b);
  }
  g.add(charm);
  g.userData.dynamic = true;
  g.traverse((o) => (o.userData.dynamic = true));
  return g;
}

/** A small bouquet of exactly one purple sunflower. */
export function makeSunflower(): { group: THREE.Group; head: THREE.Group } {
  const g = new THREE.Group();
  const wrap = mesh(new THREE.ConeGeometry(0.075, 0.2, 7, 1, true), mat(SUNFLOWER.wrap, { side: THREE.DoubleSide }), 0, 0.06, 0);
  wrap.rotation.x = Math.PI;
  g.add(wrap);
  const ribbon = mesh(new THREE.TorusGeometry(0.038, 0.012, 5, 10), mat(SUNFLOWER.ribbon), 0, 0.03, 0);
  ribbon.rotation.x = Math.PI / 2;
  g.add(ribbon);
  g.add(mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.34, 5), mat('#4f8a4a'), 0, 0.2, 0));
  const leaf = mesh(new THREE.SphereGeometry(0.045, 6, 4), mat('#5aa457'), 0.035, 0.2, 0);
  leaf.scale.set(1.3, 0.25, 0.6);
  leaf.rotation.z = 0.5;
  g.add(leaf);
  const head = new THREE.Group();
  head.position.set(0, 0.38, 0.015);
  head.rotation.x = -0.35;
  const petalMat = mat(SUNFLOWER.petals, { emissive: SUNFLOWER.petalGlow, ei: 0.45 });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const p = mesh(new THREE.SphereGeometry(0.05, 6, 4), petalMat, Math.cos(a) * 0.075, Math.sin(a) * 0.075, 0);
    p.scale.set(0.42, 1, 0.16);
    p.rotation.z = a - Math.PI / 2;
    head.add(p);
  }
  const center = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 10), mat(SUNFLOWER.center, { emissive: '#7a4b10', ei: 0.25 }));
  center.rotation.x = Math.PI / 2;
  head.add(center);
  const seeds = mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.034, 8), mat(SUNFLOWER.seeds));
  seeds.rotation.x = Math.PI / 2;
  head.add(seeds);
  g.add(head);
  g.traverse((o) => (o.userData.dynamic = true));
  return { group: g, head };
}

/** Folded letter: envelope with an opening flap and a sliding paper. */
export function makeLetter(): { group: THREE.Group; flap: THREE.Group; paper: THREE.Mesh } {
  const g = new THREE.Group();
  const cream = mat(PALETTE.cream, { emissive: '#3a2c1a', ei: 0.25 });
  const body = mesh(new THREE.BoxGeometry(0.3, 0.2, 0.012), cream);
  g.add(body);
  const paper = mesh(new THREE.PlaneGeometry(0.26, 0.3), mat('#fffaf0', { side: THREE.DoubleSide, emissive: '#3a2c1a', ei: 0.2 }), 0, 0, -0.002);
  paper.scale.y = 0.6;
  g.add(paper);
  const flap = new THREE.Group();
  flap.position.set(0, 0.1, 0.007);
  const tri = new THREE.Shape();
  tri.moveTo(-0.15, 0);
  tri.lineTo(0.15, 0);
  tri.lineTo(0, -0.12);
  tri.closePath();
  const fm = mesh(new THREE.ShapeGeometry(tri), mat('#f4e6c8', { side: THREE.DoubleSide, emissive: '#3a2c1a', ei: 0.25 }));
  flap.add(fm);
  const seal = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.008, 10), mat(PALETTE.purple, { emissive: '#4a1fb0', ei: 0.5 }), 0, -0.1, 0.004);
  seal.rotation.x = Math.PI / 2;
  flap.add(seal);
  g.add(flap);
  g.traverse((o) => (o.userData.dynamic = true));
  return { group: g, flap, paper };
}

export const BENCH_SEAT_Y = 0.42;
export function makeBench(): THREE.Group {
  const g = new THREE.Group();
  const wood = mat('#9a6644');
  const metal = mat(PALETTE.metal, { rough: 0.5 });
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.BoxGeometry(1.7, 0.04, 0.13), wood, 0, BENCH_SEAT_Y - 0.02, -0.15 + i * 0.15));
  for (let i = 0; i < 2; i++) {
    const s = mesh(new THREE.BoxGeometry(1.7, 0.11, 0.035), wood, 0, 0.62 + i * 0.16, -0.27);
    s.rotation.x = -0.12;
    g.add(s);
  }
  for (const x of [-0.75, 0.75]) {
    g.add(mesh(new THREE.BoxGeometry(0.05, BENCH_SEAT_Y, 0.42), metal, x, BENCH_SEAT_Y / 2 - 0.02, 0));
    g.add(mesh(new THREE.BoxGeometry(0.05, 0.42, 0.05), metal, x, 0.62, -0.28));
    g.add(mesh(new THREE.BoxGeometry(0.06, 0.04, 0.4), metal, x, 0.6, -0.08));
  }
  return g;
}

export function makeBowl(withFood = true): THREE.Group {
  const g = new THREE.Group();
  const bowl = mesh(new THREE.CylinderGeometry(0.08, 0.055, 0.06, 9), mat('#f6efe6'), 0, 0.03, 0);
  g.add(bowl);
  if (withFood) {
    g.add(mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.01, 9), mat('#d8352a', { emissive: '#5a0f08', ei: 0.4 }), 0, 0.058, 0));
    const cake = mat('#ff7a4a', { emissive: '#5a1a08', ei: 0.3 });
    for (let i = 0; i < 6; i++) {
      const a = i * 1.1;
      const c = mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.06, 6), cake, Math.cos(a) * 0.035, 0.068, Math.sin(a) * 0.035);
      c.rotation.set(Math.PI / 2, 0, a);
      g.add(c);
    }
    g.add(mesh(new THREE.SphereGeometry(0.01, 4, 3), mat('#5fb35a'), 0.02, 0.075, -0.02));
  }
  return g;
}

export type StallKind = 'tteok' | 'skewer' | 'drinks' | 'balls' | 'corn';
export interface StallOpts {
  sign: string;
  sub?: string;
  signBg: string;
  signFg: string;
  awningA: string;
  awningB: string;
  wood: string;
  kind: StallKind;
}

/**
 * Night-market stall. Local front faces +z. Returns positions of bulbs (for
 * glow points) and the pan (for steam).
 */
export function makeStall(o: StallOpts): { group: THREE.Group; bulbs: THREE.Vector3[]; pan: THREE.Vector3 } {
  const g = new THREE.Group();
  const W = 3.0;
  const D = 1.5;
  const wood = mat(o.wood);
  const dark = mat('#3b2b2a');
  for (const [x, z] of [[-W / 2, D / 2], [W / 2, D / 2], [-W / 2, -D / 2], [W / 2, -D / 2]]) {
    g.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 2.2, 6), dark, x, 1.1, z));
  }
  // counter
  g.add(mesh(new THREE.BoxGeometry(W - 0.1, 0.78, 0.6), wood, 0, 0.39, D / 2 - 0.35));
  g.add(mesh(new THREE.BoxGeometry(W - 0.02, 0.05, 0.7), mat('#efe3cf'), 0, 0.8, D / 2 - 0.35));
  const front = mesh(new THREE.BoxGeometry(W - 0.3, 0.42, 0.02), mat(o.awningA), 0, 0.42, D / 2 - 0.04);
  g.add(front);
  // back shelf
  g.add(mesh(new THREE.BoxGeometry(W - 0.2, 1.0, 0.35), dark, 0, 0.5, -D / 2 + 0.18));
  // awning
  const tex = stripeTexture(o.awningA, o.awningB, 10);
  const aw = mesh(new THREE.BoxGeometry(W + 0.5, 0.05, D + 0.6), temp(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, flatShading: true })), 0, 2.28, 0.15);
  aw.rotation.x = 0.16;
  g.add(aw);
  const valance = mesh(new THREE.BoxGeometry(W + 0.5, 0.22, 0.03), temp(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 })), 0, 2.08, D / 2 + 0.46);
  g.add(valance);
  // sign (unlit, glows at night)
  const st = signTexture(o.sign, { bg: o.signBg, fg: o.signFg, sub: o.sub, border: o.signFg });
  const sign = mesh(new THREE.PlaneGeometry(2.1, 0.66), temp(new THREE.MeshBasicMaterial({ map: st, fog: true })), 0, 2.72, D / 2 + 0.2);
  g.add(sign);
  g.add(mesh(new THREE.BoxGeometry(2.2, 0.74, 0.05), dark, 0, 2.72, D / 2 + 0.17));
  // bulbs along the front edge
  const bulbs: THREE.Vector3[] = [];
  const bulbMat = glow('#ffe2a8');
  for (let i = 0; i < 7; i++) {
    const x = -W / 2 - 0.1 + (i / 6) * (W + 0.2);
    const y = 1.93 - Math.sin((i / 6) * Math.PI) * 0.12;
    g.add(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.1, 3), dark, x, y + 0.08, D / 2 + 0.5));
    g.add(mesh(new THREE.SphereGeometry(0.045, 6, 5), bulbMat, x, y, D / 2 + 0.5));
    bulbs.push(new THREE.Vector3(x, y, D / 2 + 0.5));
  }
  // food on the counter
  const top = 0.83;
  const pan = new THREE.Vector3(0, top + 0.06, D / 2 - 0.35);
  if (o.kind === 'tteok') {
    g.add(mesh(new THREE.CylinderGeometry(0.52, 0.46, 0.08, 12), mat('#2f2a33', { rough: 0.4 }), -0.35, top + 0.04, D / 2 - 0.35));
    g.add(mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.02, 12), mat('#d8352a', { emissive: '#7a1508', ei: 0.55 }), -0.35, top + 0.08, D / 2 - 0.35));
    const cake = mat('#ff8155', { emissive: '#5a1a08', ei: 0.35 });
    for (let i = 0; i < 26; i++) {
      const a = i * 2.39996;
      const r = 0.07 + Math.sqrt(i / 26) * 0.34;
      const c = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.13, 6), cake, -0.35 + Math.cos(a) * r, top + 0.1, D / 2 - 0.35 + Math.sin(a) * r);
      c.rotation.set(Math.PI / 2, 0, a);
      g.add(c);
    }
    const fish = mat('#f4d7a3');
    for (let i = 0; i < 4; i++) {
      const sk = mesh(new THREE.BoxGeometry(0.11, 0.09, 0.012), fish, 0.55 + i * 0.13, top + 0.15, D / 2 - 0.25);
      sk.rotation.z = 0.1 * (i - 1.5);
      g.add(sk);
      g.add(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.3, 3), mat('#d9b98c'), 0.55 + i * 0.13, top + 0.2, D / 2 - 0.25));
    }
    for (let i = 0; i < 3; i++) {
      const b = makeBowl(true);
      b.position.set(0.55 + i * 0.2, top, D / 2 - 0.5);
      g.add(b);
    }
    pan.set(-0.35, top + 0.12, D / 2 - 0.35);
  } else if (o.kind === 'skewer' || o.kind === 'balls') {
    g.add(mesh(new THREE.BoxGeometry(1.4, 0.06, 0.4), mat('#2f2a33'), -0.2, top + 0.03, D / 2 - 0.35));
    const c1 = mat(o.kind === 'balls' ? '#e9a24a' : '#8a3b2a', { emissive: '#3a1004', ei: 0.3 });
    for (let i = 0; i < 9; i++) {
      const x = -0.8 + i * 0.15;
      g.add(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.32, 3), mat('#d9b98c'), x, top + 0.12, D / 2 - 0.35));
      for (let j = 0; j < 3; j++) g.add(mesh(new THREE.SphereGeometry(0.035, 6, 4), c1, x, top + 0.12 + j * 0.07, D / 2 - 0.35));
    }
    pan.set(-0.2, top + 0.1, D / 2 - 0.35);
  } else if (o.kind === 'drinks') {
    const cols = ['#ffd166', '#ff9fb8', '#9ae6b4', '#c4b0ff', '#ffb27a'];
    for (let i = 0; i < 10; i++) {
      const c = mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.16, 7), mat(cols[i % cols.length], { emissive: cols[i % cols.length], ei: 0.18 }), -1.1 + i * 0.24, top + 0.08, D / 2 - 0.3);
      g.add(c);
    }
    pan.set(0, top + 0.1, D / 2 - 0.35);
  } else {
    const corn = mat('#ffd34e', { emissive: '#5a4004', ei: 0.3 });
    for (let i = 0; i < 8; i++) {
      const c = mesh(new THREE.CapsuleGeometry(0.035, 0.14, 2, 6), corn, -0.9 + i * 0.25, top + 0.05, D / 2 - 0.35);
      c.rotation.z = Math.PI / 2;
      g.add(c);
    }
    pan.set(0, top + 0.1, D / 2 - 0.35);
  }
  return { group: g, bulbs, pan };
}

export function makeLampPost(): { group: THREE.Group; lamp: THREE.Vector3 } {
  const g = new THREE.Group();
  const metal = mat('#2c3042', { rough: 0.5 });
  g.add(mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.25, 7), metal, 0, 0.12, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.045, 0.055, 2.7, 6), metal, 0, 1.45, 0));
  g.add(mesh(new THREE.ConeGeometry(0.2, 0.16, 6), metal, 0, 3.05, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.26, 6), glow('#ffd59a'), 0, 2.86, 0));
  return { group: g, lamp: new THREE.Vector3(0, 2.86, 0) };
}

export function makeTree(scale = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.2, 6), mat('#5a3d2b'), 0, 0.6, 0));
  g.add(mesh(new THREE.IcosahedronGeometry(0.75, 0), mat(PALETTE.leaf), 0, 1.6, 0));
  g.add(mesh(new THREE.IcosahedronGeometry(0.55, 0), mat(PALETTE.leafDark), 0.3, 2.05, 0.1));
  g.add(mesh(new THREE.IcosahedronGeometry(0.5, 0), mat('#386b55'), -0.3, 1.95, -0.15));
  g.scale.setScalar(scale);
  return g;
}

export function makeTable(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 10), mat('#f3e5cf'), 0, 0.62, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6), mat(PALETTE.metal), 0, 0.3, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.03, 8), mat(PALETTE.metal), 0, 0.015, 0));
  return g;
}

export function makeStool(color = '#d9534f'): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 8), mat(color), 0, 0.4, 0));
  for (const [x, z] of [[0.1, 0.1], [-0.1, 0.1], [0.1, -0.1], [-0.1, -0.1]]) {
    g.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.4, 4), mat(PALETTE.metal), x, 0.2, z));
  }
  return g;
}

/** Floating purple diamond that marks a story interaction. */
export function makeMarker(): THREE.Group {
  const g = new THREE.Group();
  const d = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), glow('#c9b2ff'));
  d.scale.y = 1.4;
  g.add(d);
  const halo = new THREE.Sprite(
    temp(new THREE.SpriteMaterial({ map: haloTexture(), color: 0x9b6dff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 })),
  );
  halo.scale.setScalar(0.7);
  g.add(halo);
  g.userData.dynamic = true;
  g.traverse((o) => (o.userData.dynamic = true));
  return g;
}

/** Many soft glows in one draw call. */
export function makeGlowPoints(points: { p: THREE.Vector3; color: string; size?: number }[], size = 0.9): THREE.Points {
  const pos = new Float32Array(points.length * 3);
  const col = new Float32Array(points.length * 3);
  const c = new THREE.Color();
  points.forEach((pt, i) => {
    pos.set([pt.p.x, pt.p.y, pt.p.z], i * 3);
    c.set(pt.color);
    col.set([c.r, c.g, c.b], i * 3);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = temp(
    new THREE.PointsMaterial({ size, map: haloTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85, sizeAttenuation: true }),
  );
  const pts = new THREE.Points(geo, m);
  pts.userData.dynamic = true;
  pts.frustumCulled = false;
  return pts;
}

/** Simple CPU particle system (steam, sparkles, petals, fireflies). */
export class Particles {
  points: THREE.Points;
  private pos: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private max: number;
  private next = 0;
  gravity = 0;
  drag = 0.4;
  constructor(max: number, color: string, size: number, opts: { map?: THREE.Texture; additive?: boolean; opacity?: number } = {}) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    for (let i = 0; i < max; i++) this.pos[i * 3 + 1] = -999;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    const m = temp(
      new THREE.PointsMaterial({
        size,
        color: new THREE.Color(color),
        map: opts.map || haloTexture(),
        transparent: true,
        opacity: opts.opacity ?? 0.8,
        depthWrite: false,
        blending: opts.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    );
    this.points = new THREE.Points(geo, m);
    this.points.frustumCulled = false;
    this.points.userData.dynamic = true;
  }

  emit(p: THREE.Vector3, v: THREE.Vector3, life: number): void {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.pos.set([p.x, p.y, p.z], i * 3);
    this.vel.set([v.x, v.y, v.z], i * 3);
    this.life[i] = life;
  }

  update(dt: number): void {
    const damp = Math.exp(-this.drag * dt);
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.pos[i * 3 + 1] = -999;
        continue;
      }
      this.vel[i * 3 + 1] -= this.gravity * dt;
      for (let k = 0; k < 3; k++) {
        this.vel[i * 3 + k] *= damp;
        this.pos[i * 3 + k] += this.vel[i * 3 + k] * dt;
      }
    }
    (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }
}
