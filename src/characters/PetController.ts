import * as THREE from 'three';
import { mat } from '../art/materials';
import type { PetLook } from '../data/settings';
import { dampAngle } from './CharacterFactory';
import { graft, node } from '../app/AssetManager';

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const me = new THREE.Mesh(geo, m);
  me.position.set(x, y, z);
  return me;
}

/**
 * Zed (dog) and Kooki (cat). Placeholder-but-configurable low-poly models
 * with procedural walk, tail, head look and hop.
 */
export class Pet {
  root = new THREE.Group();
  body = new THREE.Group();
  headPivot = new THREE.Group();
  tail = new THREE.Group();
  tailSegs: THREE.Group[] = [];
  legs: THREE.Group[] = [];
  /** small sign Kooki can present */
  signAnchor = new THREE.Object3D();
  speed = 0;
  facing = 0;
  wag = 0.4;
  hop = 0;
  lookYaw = 0;
  lookPitch = 0;
  baseY: number;
  private phase = 0;
  private t = Math.random() * 5;

  constructor(public kind: 'dog' | 'cat', public look: PetLook) {
    const fur = mat(look.fur);
    const acc = mat(look.accent);
    const dark = mat(new THREE.Color(look.fur).multiplyScalar(0.72).getStyle());
    const eye = mat(look.eyes, { rough: 0.3 });
    const black = mat('#1a1418', { rough: 0.4 });
    const shine = mat('#ffffff', { emissive: '#ffffff', ei: 0.6 });
    const isDog = kind === 'dog';
    const bodyY = isDog ? 0.28 : 0.23;
    const bodyR = isDog ? 0.14 : 0.115;
    const bodyLen = isDog ? 0.24 : 0.2;
    this.baseY = bodyY;
    this.root.add(this.body);
    this.body.position.y = bodyY;
    const torso = mesh(new THREE.CapsuleGeometry(bodyR, bodyLen, 3, 8), fur);
    torso.rotation.x = Math.PI / 2;
    this.body.add(torso);
    const belly = mesh(new THREE.SphereGeometry(bodyR * 0.85, 8, 6), acc, 0, -bodyR * 0.35, 0.03);
    belly.scale.set(0.85, 0.6, 1.3);
    this.body.add(belly);

    // legs
    const legH = bodyY - 0.03;
    const lz = bodyLen / 2 + 0.01;
    for (const [x, z] of [[0.075, lz], [-0.075, lz], [0.075, -lz], [-0.075, -lz]]) {
      const leg = new THREE.Group();
      leg.position.set(isDog ? x : x * 0.85, -0.02, z);
      leg.add(mesh(new THREE.CylinderGeometry(0.045, 0.04, legH, 6), fur, 0, -legH / 2, 0));
      const paw = mesh(new THREE.SphereGeometry(0.05, 6, 5), acc, 0, -legH, 0.015);
      paw.scale.set(1, 0.6, 1.2);
      leg.add(paw);
      this.body.add(leg);
      this.legs.push(leg);
    }

    // head
    this.headPivot.position.set(0, isDog ? 0.13 : 0.12, bodyLen / 2 + 0.07);
    this.body.add(this.headPivot);
    const hr = isDog ? 0.155 : 0.135;
    const head = mesh(new THREE.IcosahedronGeometry(hr, 1), fur, 0, 0.04, 0.03);
    this.headPivot.add(head);
    const hz = 0.03 + hr * 0.85;
    for (const sx of [1, -1]) {
      const e = mesh(new THREE.SphereGeometry(0.027, 7, 5), isDog ? black : eye, 0.058 * sx, 0.075, hz - 0.01);
      e.scale.set(1, 1.15, 0.6);
      this.headPivot.add(e);
      if (!isDog) {
        const pupil = mesh(new THREE.BoxGeometry(0.008, 0.032, 0.01), black, 0.058 * sx, 0.075, hz + 0.006);
        this.headPivot.add(pupil);
      }
      this.headPivot.add(mesh(new THREE.SphereGeometry(0.009, 4, 3), shine, 0.052 * sx, 0.088, hz + 0.008));
    }
    if (isDog) {
      const muzzle = mesh(new THREE.SphereGeometry(0.08, 8, 6), acc, 0, 0.0, hz);
      muzzle.scale.set(1, 0.75, 0.9);
      this.headPivot.add(muzzle);
      this.headPivot.add(mesh(new THREE.SphereGeometry(0.03, 6, 5), black, 0, 0.025, hz + 0.07));
      const tongue = mesh(new THREE.SphereGeometry(0.025, 6, 4), mat('#f07a8a'), 0, -0.045, hz + 0.045);
      tongue.scale.set(1, 0.5, 1);
      this.headPivot.add(tongue);
      for (const sx of [1, -1]) {
        const ear = mesh(new THREE.SphereGeometry(0.06, 6, 5), dark, 0.135 * sx, 0.06, 0.0);
        ear.scale.set(0.55, 1.5, 0.95);
        ear.rotation.z = 0.35 * sx;
        this.headPivot.add(ear);
      }
      // collar + tag
      const collar = mesh(new THREE.TorusGeometry(0.1, 0.02, 5, 14), mat(look.collar), 0, 0.02, bodyLen / 2 + 0.03);
      this.body.add(collar);
      this.body.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.01, 8), mat('#ffd36e', { emissive: '#ffb84a', ei: 0.3 }), 0, -0.09, bodyLen / 2 + 0.07));
    } else {
      this.headPivot.add(mesh(new THREE.SphereGeometry(0.018, 5, 4), mat('#f28fa0'), 0, 0.03, hz + 0.012));
      const muzzle = mesh(new THREE.SphereGeometry(0.05, 7, 5), acc, 0, 0.0, hz - 0.02);
      muzzle.scale.set(1.2, 0.7, 0.7);
      this.headPivot.add(muzzle);
      for (const sx of [1, -1]) {
        const ear = mesh(new THREE.ConeGeometry(0.055, 0.1, 4), fur, 0.075 * sx, 0.19, 0.0);
        ear.rotation.z = -0.25 * sx;
        this.headPivot.add(ear);
        const inner = mesh(new THREE.ConeGeometry(0.03, 0.06, 4), mat('#f4b2bd'), 0.072 * sx, 0.18, 0.02);
        inner.rotation.z = -0.25 * sx;
        this.headPivot.add(inner);
        for (const wy of [0.0, 0.025]) {
          const w = mesh(new THREE.BoxGeometry(0.11, 0.004, 0.004), mat('#f5f2ea'), 0.09 * sx, wy, hz - 0.01);
          w.rotation.z = (wy ? 0.12 : -0.08) * sx;
          this.headPivot.add(w);
        }
      }
      const collar = mesh(new THREE.TorusGeometry(0.082, 0.016, 5, 14), mat(look.collar), 0, 0.03, bodyLen / 2 + 0.03);
      this.body.add(collar);
      this.body.add(mesh(new THREE.SphereGeometry(0.022, 6, 5), mat('#ffd36e', { emissive: '#ffb84a', ei: 0.3 }), 0, -0.06, bodyLen / 2 + 0.07));
    }

    // tail
    this.tail.position.set(0, 0.06, -(bodyLen / 2 + bodyR * 0.8));
    this.body.add(this.tail);
    if (isDog) {
      const seg = new THREE.Group();
      seg.add(mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.2, 6), fur, 0, 0.1, 0));
      seg.add(mesh(new THREE.SphereGeometry(0.035, 6, 5), acc, 0, 0.2, 0));
      seg.rotation.x = -0.7;
      this.tail.add(seg);
      this.tailSegs.push(seg);
    } else {
      let parent: THREE.Object3D = this.tail;
      for (let i = 0; i < 4; i++) {
        const seg = new THREE.Group();
        seg.add(mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.11, 6), i === 3 ? dark : fur, 0, 0.055, 0));
        if (i > 0) seg.position.y = 0.11;
        seg.rotation.x = i === 0 ? -1.0 : 0.32;
        parent.add(seg);
        this.tailSegs.push(seg);
        parent = seg;
      }
    }

    this.signAnchor.position.set(0.16, 0.25, 0.1);
    this.body.add(this.signAnchor);

    const sh = new THREE.Mesh(
      new THREE.CircleGeometry(isDog ? 0.3 : 0.24, 14),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false }),
    );
    sh.material.userData.temp = true;
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.012;
    sh.scale.set(0.8, 1.25, 1);
    this.root.add(sh);
    this.root.scale.setScalar(look.size);
    this.root.traverse((o) => (o.userData.dynamic = true));
  }

  get position(): THREE.Vector3 {
    return this.root.position;
  }

  /** Swap in the Blender model (pivots: Body, Head, Leg0-3, Tail / TailSeg0-3). */
  applyModel(model: THREE.Object3D | null): this {
    if (!model) return this;
    const B = node(model, 'Body');
    if (!B) return this;
    const remove: THREE.Object3D[] = [];
    this.body.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) remove.push(o);
    });
    for (const o of remove) o.parent?.remove(o);
    this.baseY = B.position.y;
    this.body.position.y = this.baseY;
    graft(B, this.body);
    const H = node(model, 'Head');
    if (H) {
      this.headPivot.position.copy(H.position);
      graft(H, this.headPivot);
    }
    for (let i = 0; i < 4; i++) {
      const L = node(model, 'Leg' + i);
      if (L) {
        this.legs[i].position.copy(L.position);
        graft(L, this.legs[i]);
      }
    }
    const T = node(model, 'Tail');
    if (T) this.tail.position.copy(T.position);
    if (this.kind === 'dog') graft(T, this.tailSegs[0]);
    else for (let i = 0; i < this.tailSegs.length; i++) graft(node(model, 'TailSeg' + i), this.tailSegs[i]);
    this.signAnchor.position.set(0.16, 0.2, 0.1);
    this.root.traverse((o) => (o.userData.dynamic = true));
    return this;
  }

  lookAtPoint(p: THREE.Vector3 | null): void {
    if (!p) {
      this.lookYaw = 0;
      this.lookPitch = 0;
      return;
    }
    let yaw = Math.atan2(p.x - this.root.position.x, p.z - this.root.position.z) - this.root.rotation.y;
    while (yaw > Math.PI) yaw -= Math.PI * 2;
    while (yaw < -Math.PI) yaw += Math.PI * 2;
    this.lookYaw = THREE.MathUtils.clamp(yaw, -0.9, 0.9);
    const dist = Math.hypot(p.x - this.root.position.x, p.z - this.root.position.z);
    this.lookPitch = THREE.MathUtils.clamp(-Math.atan2(p.y - 0.45, dist), -0.75, 0.2);
  }

  update(dt: number, reducedMotion = false): void {
    this.t += dt;
    this.root.rotation.y = dampAngle(this.root.rotation.y, this.facing, 1 - Math.exp(-dt * 8));
    const amp = Math.min(1, this.speed / 1.4);
    this.phase += dt * this.speed * 9;
    const s = Math.sin(this.phase);
    this.legs[0].rotation.x = s * 0.7 * amp;
    this.legs[3].rotation.x = s * 0.7 * amp;
    this.legs[1].rotation.x = -s * 0.7 * amp;
    this.legs[2].rotation.x = -s * 0.7 * amp;
    this.body.position.y = this.baseY + Math.abs(Math.cos(this.phase)) * 0.025 * amp + this.hop;
    const k = 1 - Math.exp(-dt * 6);
    this.headPivot.rotation.y += (this.lookYaw - this.headPivot.rotation.y) * k;
    this.headPivot.rotation.x += (this.lookPitch - this.headPivot.rotation.x) * k;
    if (this.kind === 'dog') {
      const w = this.wag;
      this.tailSegs[0].rotation.z = Math.sin(this.t * (6 + w * 10)) * (0.25 + w * 0.6);
      this.headPivot.rotation.z = reducedMotion ? 0 : Math.sin(this.t * 2) * 0.06 * w;
    } else {
      for (let i = 0; i < this.tailSegs.length; i++) {
        this.tailSegs[i].rotation.z = Math.sin(this.t * (1.6 + this.wag * 2) - i * 0.6) * (0.18 + this.wag * 0.25);
      }
    }
  }
}
