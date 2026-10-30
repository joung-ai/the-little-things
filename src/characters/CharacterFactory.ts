import * as THREE from 'three';
import { mat } from '../art/materials';
import type { HumanLook } from '../data/settings';
import { graft, node } from '../app/AssetManager';

const HIP = 0.42;

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const me = new THREE.Mesh(geo, m);
  me.position.set(x, y, z);
  return me;
}

export function dampAngle(cur: number, target: number, k: number): number {
  let d = target - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return cur + d * k;
}

/**
 * Cute low-poly human with procedural animation (walk, idle, sit, reach,
 * hold-in-front, look-at, hop). Appearance comes entirely from HumanLook.
 */
export class Character {
  root = new THREE.Group();
  hips = new THREE.Group();
  torso = new THREE.Group();
  headPivot = new THREE.Group();
  head = new THREE.Group();
  armL = new THREE.Group();
  armR = new THREE.Group();
  legL = new THREE.Group();
  legR = new THREE.Group();
  handL = new THREE.Object3D();
  handR = new THREE.Object3D();
  bag: THREE.Group | null = null;
  bagAnchor = new THREE.Object3D();

  speed = 0;
  facing = 0;
  sit = 0;
  sitTarget = 0;
  reachL = 0;
  reachR = 0;
  reachLTarget = 0;
  reachRTarget = 0;
  hold = 0;
  holdTarget = 0;
  lookYaw = 0;
  lookPitch = 0;
  hop = 0;
  sway = 0;
  private phase = Math.random() * 10;
  private t = Math.random() * 10;

  constructor(public look: HumanLook, opts: { bag?: boolean; scale?: number } = {}) {
    const L = look;
    this.root.add(this.hips);
    this.hips.position.y = HIP;
    this.hips.add(this.torso);

    const skin = mat(L.skin);
    const top = mat(L.top);
    const bottom = mat(L.bottom);
    const shoe = mat(L.shoes);
    const legMat = L.bottomType === 'skirt' ? skin : bottom;

    // legs
    for (const [leg, x] of [[this.legL, 0.085], [this.legR, -0.085]] as const) {
      leg.position.set(x, 0, 0);
      leg.add(mesh(new THREE.CylinderGeometry(0.072, 0.064, 0.34, 7), legMat, 0, -0.17, 0));
      const s = mesh(new THREE.SphereGeometry(0.075, 7, 5), shoe, 0, -0.37, 0.03);
      s.scale.set(1, 0.7, 1.45);
      leg.add(s);
      this.hips.add(leg);
    }

    // torso + lower clothing
    this.torso.add(mesh(new THREE.CylinderGeometry(0.155, 0.2, 0.42, 8), top, 0, 0.21, 0));
    if (L.bottomType === 'skirt') {
      this.torso.add(mesh(new THREE.CylinderGeometry(0.19, 0.31, 0.24, 9), bottom, 0, -0.03, 0));
    } else {
      this.torso.add(mesh(new THREE.CylinderGeometry(0.2, 0.19, 0.12, 8), bottom, 0, 0.0, 0));
    }

    // arms
    for (const [arm, hand, x] of [[this.armL, this.handL, 0.205], [this.armR, this.handR, -0.205]] as const) {
      arm.position.set(x, 0.38, 0);
      arm.add(mesh(new THREE.CylinderGeometry(0.058, 0.05, 0.3, 6), top, 0, -0.15, 0));
      arm.add(mesh(new THREE.SphereGeometry(0.062, 7, 5), skin, 0, -0.33, 0));
      hand.position.set(0, -0.37, 0.02);
      arm.add(hand);
      this.torso.add(arm);
    }

    // head
    this.headPivot.position.set(0, 0.42, 0);
    this.torso.add(this.headPivot);
    this.headPivot.add(this.head);
    this.head.position.y = 0.25;
    this.head.add(mesh(new THREE.IcosahedronGeometry(0.27, 1), skin));
    // face
    const eye = mat('#1d1622', { rough: 0.4 });
    const shine = mat('#ffffff', { emissive: '#ffffff', ei: 0.6 });
    for (const sx of [1, -1]) {
      const e = mesh(new THREE.SphereGeometry(0.036, 8, 6), eye, 0.093 * sx, -0.015, 0.243);
      e.scale.set(1, 1.25, 0.6);
      this.head.add(e);
      this.head.add(mesh(new THREE.SphereGeometry(0.012, 5, 4), shine, 0.083 * sx, 0.005, 0.262));
      const b = mesh(new THREE.SphereGeometry(0.045, 7, 5), mat(L.blush, { rough: 1 }), 0.15 * sx, -0.075, 0.215);
      b.scale.set(1, 0.55, 0.35);
      this.head.add(b);
      // ears
      this.head.add(mesh(new THREE.SphereGeometry(0.05, 6, 5), skin, 0.262 * sx, -0.02, 0));
    }
    const mouth = mesh(new THREE.TorusGeometry(0.032, 0.009, 4, 8, Math.PI), mat('#7a3540'), 0, -0.085, 0.252);
    mouth.rotation.z = Math.PI;
    this.head.add(mouth);
    this.buildHair(L);

    if (opts.bag) {
      const bag = new THREE.Group();
      bag.position.set(-0.2, 0.08, 0.06);
      const b = mesh(new THREE.BoxGeometry(0.08, 0.17, 0.2), mat('#6b4a36'));
      bag.add(b);
      const strap = mesh(new THREE.TorusGeometry(0.3, 0.014, 4, 18, Math.PI * 0.9), mat('#4e3526'), 0.2, 0.22, -0.02);
      strap.rotation.set(0, Math.PI / 2, 2.1);
      this.torso.add(strap);
      this.bagAnchor.position.set(0.0, 0.04, 0.12);
      bag.add(this.bagAnchor);
      this.torso.add(bag);
      this.bag = bag;
    }

    // blob shadow
    const sh = new THREE.Mesh(
      new THREE.CircleGeometry(0.32, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }),
    );
    sh.material.userData.temp = true;
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.012;
    sh.renderOrder = -1;
    this.root.add(sh);

    if (opts.scale) this.root.scale.setScalar(opts.scale);
    this.root.traverse((o) => (o.userData.dynamic = true));
  }

  private buildHair(L: HumanLook): void {
    const hm = mat(L.hair, { side: THREE.DoubleSide });
    const hmS = mat(L.hair);
    const h = this.head;
    const cap = mesh(new THREE.SphereGeometry(0.295, 9, 6, 0, Math.PI * 2, 0, 1.22), hm, 0, 0.035, -0.01);
    h.add(cap);
    const backDepth = L.hairStyle === 'bob' ? 2.35 : L.hairStyle === 'long' ? 2.25 : 1.95;
    const phiStart = L.hairStyle === 'bob' ? Math.PI - 0.55 : Math.PI;
    const phiLen = L.hairStyle === 'bob' ? Math.PI + 1.1 : Math.PI;
    h.add(mesh(new THREE.SphereGeometry(0.3, 9, 7, phiStart, phiLen, 0, backDepth), hm, 0, 0.02, -0.015));

    const tuft = (x: number, y: number, z: number, r: number, sx = 1, sy = 1, sz = 1) => {
      const t = mesh(new THREE.IcosahedronGeometry(r, 0), hmS, x, y, z);
      t.scale.set(sx, sy, sz);
      t.rotation.set(x * 7, y * 5, z * 3);
      h.add(t);
    };

    if (L.hairStyle === 'fluffy') {
      // fringe
      for (let i = 0; i < 5; i++) {
        const a = -0.55 + i * 0.275;
        tuft(Math.sin(a) * 0.24, 0.15 + Math.cos(i * 1.7) * 0.015, Math.cos(a) * 0.19, 0.095, 1, 0.8, 1);
      }
      // crown and sides
      const crown: [number, number, number, number][] = [
        [0, 0.29, 0.02, 0.12], [0.13, 0.26, -0.06, 0.11], [-0.13, 0.26, -0.06, 0.11], [0.04, 0.27, 0.12, 0.1],
        [0.24, 0.12, 0.05, 0.09], [-0.24, 0.12, 0.05, 0.09], [0.22, 0.1, -0.12, 0.1], [-0.22, 0.1, -0.12, 0.1],
        [0, 0.16, -0.25, 0.12], [0.14, 0.0, -0.22, 0.1], [-0.14, 0.0, -0.22, 0.1], [0, 0.32, -0.12, 0.1],
      ];
      for (const c of crown) tuft(c[0], c[1], c[2], c[3]);
    } else {
      // soft fringe for the other styles
      for (let i = 0; i < 4; i++) {
        const a = -0.45 + i * 0.3;
        tuft(Math.sin(a) * 0.23, 0.16, Math.cos(a) * 0.19, 0.085, 1.2, 0.6, 0.8);
      }
    }
    if (L.hairStyle === 'long') {
      const back = mesh(new THREE.BoxGeometry(0.5, 0.5, 0.12), hmS, 0, -0.24, -0.17);
      back.rotation.x = 0.12;
      h.add(back);
      for (const sx of [1, -1]) {
        const lock = mesh(new THREE.BoxGeometry(0.08, 0.42, 0.1), hmS, 0.255 * sx, -0.17, 0.04);
        lock.rotation.z = -0.06 * sx;
        h.add(lock);
      }
    } else if (L.hairStyle === 'ponytail') {
      const tie = mesh(new THREE.TorusGeometry(0.045, 0.018, 5, 10), mat('#8b5cf6'), 0, 0.1, -0.29);
      h.add(tie);
      const tail = mesh(new THREE.CapsuleGeometry(0.075, 0.28, 3, 7), hmS, 0, -0.08, -0.36);
      tail.rotation.x = 0.35;
      h.add(tail);
    } else if (L.hairStyle === 'bun') {
      h.add(mesh(new THREE.IcosahedronGeometry(0.125, 1), hmS, 0, 0.27, -0.14));
    }
  }

  get position(): THREE.Vector3 {
    return this.root.position;
  }

  /** true when the Blender model replaced the procedural meshes */
  modelled = false;

  /**
   * Replace the procedural meshes with a Blender model whose pivots (Hips,
   * Torso, ArmL/R, LegL/R, Head) match this rig. Anchors (hands, bag) stay.
   */
  applyModel(model: THREE.Object3D | null): this {
    if (!model) return this;
    const remove: THREE.Object3D[] = [];
    this.hips.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) remove.push(o);
    });
    for (const o of remove) o.parent?.remove(o);
    graft(node(model, 'Torso'), this.torso);
    graft(node(model, 'ArmL'), this.armL);
    graft(node(model, 'ArmR'), this.armR);
    graft(node(model, 'Head'), this.headPivot);
    graft(node(model, 'LegL'), this.legL);
    graft(node(model, 'LegR'), this.legR);
    this.root.traverse((o) => (o.userData.dynamic = true));
    this.modelled = true;
    return this;
  }

  faceTowards(p: THREE.Vector3, instant = false): void {
    const a = Math.atan2(p.x - this.root.position.x, p.z - this.root.position.z);
    this.facing = a;
    if (instant) this.root.rotation.y = a;
  }

  /** Set head look so the character looks at a world point (yaw relative to body). */
  lookAtPoint(p: THREE.Vector3 | null): void {
    if (!p) {
      this.lookYaw = 0;
      this.lookPitch = 0;
      return;
    }
    const dx = p.x - this.root.position.x;
    const dz = p.z - this.root.position.z;
    let yaw = Math.atan2(dx, dz) - this.root.rotation.y;
    while (yaw > Math.PI) yaw -= Math.PI * 2;
    while (yaw < -Math.PI) yaw += Math.PI * 2;
    this.lookYaw = THREE.MathUtils.clamp(yaw, -1.1, 1.1);
    const dist = Math.hypot(dx, dz);
    const headY = this.root.position.y + (this.sit > 0.5 ? 1.05 : 1.1);
    this.lookPitch = THREE.MathUtils.clamp(-Math.atan2(p.y - headY, dist), -0.5, 0.5);
  }

  update(dt: number, reducedMotion = false): void {
    this.t += dt;
    const k = 1 - Math.exp(-dt * 8);
    this.root.rotation.y = dampAngle(this.root.rotation.y, this.facing, 1 - Math.exp(-dt * 10));
    this.sit += (this.sitTarget - this.sit) * k;
    this.reachL += (this.reachLTarget - this.reachL) * k;
    this.reachR += (this.reachRTarget - this.reachR) * k;
    this.hold += (this.holdTarget - this.hold) * k;

    const amp = Math.min(1, this.speed / 2.2) * (1 - this.sit);
    this.phase += dt * this.speed * 3.3;
    const s = Math.sin(this.phase);
    const sit = this.sit;

    this.legL.rotation.x = s * 0.7 * amp - 1.42 * sit;
    this.legR.rotation.x = -s * 0.7 * amp - 1.42 * sit;
    const breathe = reducedMotion ? 0 : Math.sin(this.t * 2.1) * 0.012;
    this.hips.position.y = HIP + Math.abs(Math.cos(this.phase)) * 0.035 * amp + this.hop;
    this.torso.scale.y = 1 + breathe;
    this.torso.rotation.x = amp * 0.08 + this.sway * Math.sin(this.t * 1.6) * 0.03;

    const armSwing = s * 0.6 * amp;
    const restX = -0.45 * sit;
    this.armL.rotation.x = -armSwing + restX - this.reachL * 1.3 - this.hold * 0.95;
    this.armR.rotation.x = armSwing + restX - this.reachR * 1.3 - this.hold * 0.95;
    this.armL.rotation.z = 0.1 - this.hold * 0.42;
    this.armR.rotation.z = -0.1 + this.hold * 0.42;

    const idleYaw = reducedMotion ? 0 : Math.sin(this.t * 0.7) * 0.05;
    this.headPivot.rotation.y += (this.lookYaw + idleYaw - this.headPivot.rotation.y) * (1 - Math.exp(-dt * 5));
    this.headPivot.rotation.x += (this.lookPitch - this.headPivot.rotation.x) * (1 - Math.exp(-dt * 5));
    this.headPivot.rotation.z = reducedMotion ? 0 : Math.sin(this.t * 1.1) * 0.03;
  }
}
