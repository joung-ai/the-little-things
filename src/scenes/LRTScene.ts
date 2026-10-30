import * as THREE from 'three';
import type { Game } from '../app/Game';
import { glow, mat, temp } from '../art/materials';
import { mergeStatic } from '../art/merge';
import { makeJoung, makePhone, makeZena } from '../art/models';
import { makeKeychain, Particles } from '../art/props';
import { cityDayTexture, signTexture, sunPatchTexture } from '../art/textures';
import { Character } from '../characters/CharacterFactory';
import { box } from '../characters/PlayerController';
import { DIALOGUE, PHONE_NOTE } from '../data/dialogue';
import { GIRL, PROTAGONIST, type HumanLook } from '../data/settings';
import { S } from '../data/story';
import { Ease } from '../systems/Tweens';
import { BaseScene } from './BaseScene';

const HALF_W = 1.47;
const LEN = 8;
const DOORS = [-4, 4];

const PASSENGER_LOOKS: Partial<HumanLook>[] = [
  { top: '#7a9e7e', bottom: '#3b3b4f', hair: '#1b1a20', hairStyle: 'fluffy' },
  { top: '#e8c07d', bottom: '#4a4e69', hair: '#2b211f', hairStyle: 'bob' },
  { top: '#9fb4d9', bottom: '#2d3142', hair: '#141216', hairStyle: 'bun' },
  { top: '#d68c8c', bottom: '#f2e9e4', hair: '#3a2a22', hairStyle: 'ponytail', bottomType: 'skirt' },
  { top: '#6c757d', bottom: '#22223b', hair: '#18161a', hairStyle: 'fluffy' },
  { top: '#b8a1d9', bottom: '#3d405b', hair: '#2a1e1a', hairStyle: 'long' },
  { top: '#f4a261', bottom: '#264653', hair: '#111', hairStyle: 'bun' },
  { top: '#90be6d', bottom: '#463f3a', hair: '#30221c', hairStyle: 'bob' },
];

export class LRTScene extends BaseScene {
  private him!: Character;
  private her!: Character;
  private passengers: Character[] = [];
  private doors: { leaf: THREE.Group; closedX: number; openX: number }[] = [];
  private texA!: THREE.Texture;
  private texB!: THREE.Texture;
  private trainSpeed = 0;
  private keychain!: THREE.Group;
  private sparkles!: Particles;
  private phone!: { group: THREE.Group; setScreen: (text: string, typed: number) => void };
  private sun!: THREE.Texture;
  private t = 0;

  constructor(game: Game) {
    super(game);
    this.camDistance = 3.0;
  }

  build(): void {
    const sc = this.scene;
    // one afternoon: bright sky outside, warm sun through the windows
    sc.background = new THREE.Color('#cfe3f3');
    sc.fog = new THREE.Fog('#dbe8f2', 16, 34);
    sc.add(new THREE.HemisphereLight('#f1f7ff', '#9a8f84', 2.3));
    const key = new THREE.DirectionalLight('#ffe2b0', 1.5);
    key.position.set(-3, 6, 6);
    sc.add(key);
    for (const x of [-4.5, 4.5]) {
      const pl = new THREE.PointLight('#fff1dc', 1.4, 9, 1.4);
      pl.position.set(x, 2.2, 0);
      sc.add(pl);
    }

    const shell = new THREE.Group();
    sc.add(shell);
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, ry = 0) => {
      const me = new THREE.Mesh(geo, m);
      me.position.set(x, y, z);
      me.rotation.y = ry;
      shell.add(me);
      return me;
    };
    const cream = mat('#e3dfe9');
    const panel = mat('#cdd2e0');
    const floor = mat('#5b6177');
    const seat = mat('#4a78b0');
    const steel = mat('#c7ccd8', { rough: 0.35 });
    const darkFrame = mat('#39405a');

    add(new THREE.BoxGeometry(LEN * 2, 0.1, HALF_W * 2), floor, 0, -0.05, 0);
    add(new THREE.BoxGeometry(LEN * 2, 0.012, 0.5), mat('#6a718a'), 0, 0.006, 0);
    add(new THREE.BoxGeometry(LEN * 2, 0.1, HALF_W * 2 + 0.1), cream, 0, 2.5, 0);
    for (const z of [-0.62, 0.62]) add(new THREE.BoxGeometry(LEN * 2 - 0.6, 0.04, 0.22), glow('#fff6e2'), 0, 2.44, z);
    // end walls with gangway windows
    for (const sx of [-1, 1]) {
      add(new THREE.BoxGeometry(0.1, 2.5, HALF_W * 2), cream, sx * LEN, 1.25, 0);
      add(new THREE.BoxGeometry(0.02, 0.9, 0.7), glow('#bcd6ee'), sx * (LEN - 0.06), 1.4, 0);
    }

    // side walls in segments around the doors
    const segs: [number, number][] = [[-LEN, -4.7], [-3.3, 3.3], [4.7, LEN]];
    this.texA = cityDayTexture();
    this.texB = cityDayTexture();
    this.texA.repeat.set(1.4, 1);
    this.texB.repeat.set(1.4, 1);
    for (const sz of [-1, 1]) {
      for (const [a, b] of segs) {
        const w = b - a;
        const cx = (a + b) / 2;
        add(new THREE.BoxGeometry(w, 0.86, 0.08), panel, cx, 0.43, sz * HALF_W);
        add(new THREE.BoxGeometry(w, 0.66, 0.08), cream, cx, 2.17, sz * HALF_W);
        // window glass showing the afternoon city scrolling past
        const tex = sz > 0 ? this.texA : this.texB;
        const glass = add(new THREE.PlaneGeometry(w - 0.1, 0.98), temp(new THREE.MeshBasicMaterial({ map: tex, color: '#ffffff', fog: false })), cx, 1.35, sz * (HALF_W + 0.02), sz > 0 ? Math.PI : 0);
        glass.userData.dynamic = true;
        // mullions
        for (let x = a + 0.05; x <= b; x += Math.max(1.2, w / Math.round(w / 1.6))) add(new THREE.BoxGeometry(0.06, 1.0, 0.1), darkFrame, x, 1.35, sz * HALF_W);
        add(new THREE.BoxGeometry(w, 0.06, 0.12), darkFrame, cx, 0.86, sz * HALF_W);
        add(new THREE.BoxGeometry(w, 0.06, 0.12), darkFrame, cx, 1.84, sz * HALF_W);
        // longitudinal seats
        const sa = a + (a === -LEN ? 0.2 : 0.1);
        const sb = b - (b === LEN ? 0.2 : 0.1);
        const sw = sb - sa;
        const scx = (sa + sb) / 2;
        add(new THREE.BoxGeometry(sw, 0.1, 0.48), seat, scx, 0.45, sz * (HALF_W - 0.3));
        add(new THREE.BoxGeometry(sw, 0.45, 0.08), seat, scx, 0.72, sz * (HALF_W - 0.08));
        add(new THREE.BoxGeometry(sw, 0.4, 0.42), panel, scx, 0.2, sz * (HALF_W - 0.3));
        this.area.colliders.push(box(scx, sz * (HALF_W - 0.3), sw, 0.62));
      }
      // door frames, header and threshold
      for (const dx of DOORS) {
        add(new THREE.BoxGeometry(1.5, 0.5, 0.1), cream, dx, 2.25, sz * HALF_W);
        add(new THREE.BoxGeometry(1.4, 0.015, 0.25), mat('#f2c14e'), dx, 0.008, sz * (HALF_W - 0.12));
        for (const e of [-0.72, 0.72]) add(new THREE.BoxGeometry(0.06, 2.0, 0.14), darkFrame, dx + e, 1.0, sz * HALF_W);
        // poles by the doors
        for (const e of [-0.85, 0.85]) {
          add(new THREE.CylinderGeometry(0.03, 0.03, 2.45, 6), steel, dx + e, 1.22, sz * (HALF_W - 0.5));
          this.area.colliders.push(box(dx + e, sz * (HALF_W - 0.5), 0.12, 0.12));
        }
        // door leaves (animated)
        for (const side of [-1, 1]) {
          const leaf = new THREE.Group();
          leaf.userData.dynamic = true;
          const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.98, 0.05), mat('#b9c0d3'));
          body.position.y = 0.99;
          leaf.add(body);
          const win = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.8), temp(new THREE.MeshBasicMaterial({ map: sz > 0 ? this.texA : this.texB, color: '#f4f8ff', fog: false })));
          win.position.set(0, 1.35, -sz * 0.03);
          win.rotation.y = sz > 0 ? Math.PI : 0;
          leaf.add(win);
          const strip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.98, 0.06), mat('#2e3446'));
          strip.position.set(-side * 0.34, 0.99, 0);
          leaf.add(strip);
          const closedX = dx + side * 0.35;
          leaf.position.set(closedX, 0, sz * (HALF_W + 0.03));
          sc.add(leaf);
          this.doors.push({ leaf, closedX, openX: dx + side * 1.05 });
        }
        // little LED sign above the door
        const sign = new THREE.Mesh(
          new THREE.PlaneGeometry(0.9, 0.18),
          temp(new THREE.MeshBasicMaterial({ map: signTexture('NEXT STATION ▸', { bg: '#120d1a', fg: '#ffb347', w: 512, h: 96, font: '"Courier New", monospace' }) })),
        );
        sign.position.set(dx, 2.22, sz * (HALF_W - 0.06));
        sign.rotation.y = sz > 0 ? Math.PI : 0;
        sign.userData.dynamic = true;
        sc.add(sign);
      }
      // overhead handrail with straps
      add(new THREE.CylinderGeometry(0.022, 0.022, LEN * 2 - 0.4, 6), steel, 0, 2.02, sz * 0.82).rotation.z = Math.PI / 2;
      for (let x = -LEN + 0.6; x < LEN - 0.4; x += 0.55) {
        if (DOORS.some((d) => Math.abs(x - d) < 0.5)) continue;
        add(new THREE.BoxGeometry(0.03, 0.22, 0.012), mat('#e8e4ef'), x, 1.9, sz * 0.82);
        const ring = add(new THREE.TorusGeometry(0.055, 0.012, 4, 10), mat('#f0b84a'), x, 1.74, sz * 0.82);
        ring.rotation.y = Math.PI / 2;
      }
    }
    mergeStatic(shell);

    // sunlight from the windows sliding across the floor
    this.sun = sunPatchTexture();
    this.sun.repeat.set(5, 1);
    const sunPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(LEN * 2 - 0.4, 1.15),
      temp(new THREE.MeshBasicMaterial({ map: this.sun, transparent: true, depthWrite: false, opacity: 0.85, fog: false })),
    );
    sunPlane.rotation.x = -Math.PI / 2;
    sunPlane.position.set(0, 0.014, 0.25);
    sunPlane.userData.dynamic = true;
    sc.add(sunPlane);

    this.area.bounds = { minX: -LEN + 0.15, maxX: LEN - 0.15, minZ: -HALF_W + 0.18, maxZ: HALF_W - 0.18 };
    this.camBounds = { min: new THREE.Vector3(-LEN + 0.35, 0.6, -HALF_W + 0.25), max: new THREE.Vector3(LEN - 0.35, 2.25, HALF_W - 0.25) };

    // passengers
    const seats: [number, number][] = [[-6.8, 1], [-5.6, -1], [-2.6, 1], [-1.2, -1], [-1.4, 1], [1.6, -1], [0.4, -1], [6.2, -1], [7.0, 1], [-7.0, -1]];
    seats.forEach(([x, sz], i) => {
      const look = { ...GIRL, ...PASSENGER_LOOKS[i % PASSENGER_LOOKS.length], skin: ['#e9b98f', '#c98d66', '#f1c7a5', '#a8714f'][i % 4] } as HumanLook;
      if (!PASSENGER_LOOKS[i % PASSENGER_LOOKS.length].bottomType) look.bottomType = 'pants';
      const p = new Character(look);
      p.root.position.set(x, 0, sz * (HALF_W - 0.36));
      p.facing = sz > 0 ? Math.PI : 0;
      p.root.rotation.y = p.facing;
      p.sitTarget = p.sit = 1;
      p.sway = 1;
      sc.add(p.root);
      this.passengers.push(p);
    });
    // two standing passengers holding the straps
    for (const [x, z] of [[-2.0, -0.55], [1.0, 0.6]] as const) {
      const look = { ...PROTAGONIST, top: x < 0 ? '#c97b63' : '#6d8fa8', hair: '#221d1b', hairStyle: x < 0 ? 'bob' : 'fluffy' } as HumanLook;
      const p = new Character(look);
      p.root.position.set(x, 0, z);
      p.facing = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      p.root.rotation.y = p.facing;
      p.reachRTarget = 1.7;
      p.sway = 1;
      sc.add(p.root);
      this.passengers.push(p);
      this.area.colliders.push(box(x, z, 0.45, 0.45));
    }

    // the couple: Joung in his NU uniform by the doors, Zena in black with her phone
    const A = this.game.assets;
    this.him = makeJoung(A, 'lrt');
    this.him.root.position.set(3.5, 0, 0.98);
    this.him.facing = -Math.PI / 2 - 0.35;
    this.him.root.rotation.y = this.him.facing;
    sc.add(this.him.root);
    this.setPlayer(this.him);

    this.her = makeZena(A, 'lrt');
    this.her.root.position.set(4.6, 0, -0.9);
    this.her.faceTowards(this.him.root.position, true);
    this.her.facing += 0.5;
    this.her.root.rotation.y = this.her.facing;
    sc.add(this.her.root);

    this.keychain = makeKeychain();
    this.keychain.scale.setScalar(1.6);
    this.him.bagAnchor.add(this.keychain);

    // her phone, held low in her right hand at first
    this.phone = makePhone(A);
    this.phone.group.scale.setScalar(1.35);
    this.her.handR.add(this.phone.group);
    this.phone.group.position.set(0, -0.02, 0.05);
    this.phone.group.rotation.set(-1.2, 0, 0);
    this.her.reachRTarget = 0.35;

    this.sparkles = new Particles(60, '#d9c6ff', 0.12);
    sc.add(this.sparkles.points);

    // doors start open (the train is at a station)
    for (const d of this.doors) d.leaf.position.x = d.openX;
  }

  async start(): Promise<void> {
    const g = this.game;
    g.ui.hud(true);
    g.ui.controls(false);
    g.ui.objective(null);
    g.audio.setAmbience('train');
    g.audio.setMusic('none');
    const him = this.him.root.position;
    const her = this.her.root.position;
    // establishing shot from inside the carriage
    await g.cam.shot(new THREE.Vector3(1.1, 1.55, -0.55), new THREE.Vector3(4.0, 0.95, 0.15), 0);
    await g.ui.fade(0, 900);
    if (!this.alive()) return;
    await g.ui.chapter('Chapter One · one afternoon', 'The LRT', 1900);
    if (!this.alive()) return;
    g.audio.sfx('door');
    await this.moveDoors(false, 1.0);
    this.game.tweens.to(2.5, (k) => (this.trainSpeed = k), Ease.inOut);
    await g.ui.play(DIALOGUE.lrtIntro);
    if (!this.alive()) return;
    g.story.go(S.LRT_EXPLORATION);

    // she notices the keychain
    const kc = new THREE.Vector3();
    this.keychain.getWorldPosition(kc);
    this.her.lookAtPoint(kc);
    await g.cam.shot(new THREE.Vector3(2.35, 1.2, 0.2), new THREE.Vector3(3.6, 0.78, 0.95), 1.4);
    if (!this.alive()) return;
    await g.ui.play(DIALOGUE.lrtNotice);
    if (!this.alive()) return;

    // she types on her phone (over-the-shoulder)
    g.story.go(S.KEYCHAIN_DIALOGUE);
    this.her.reachRTarget = 0.95;
    this.her.lookPitch = 0.45;
    this.her.lookYaw = 0;
    const toHim = new THREE.Vector3(him.x - her.x, 0, him.z - her.z).normalize();
    const right = new THREE.Vector3(-toHim.z, 0, toHim.x);
    // three-quarter view from in front of her, looking down at her phone
    const f = new THREE.Vector3(Math.sin(this.her.facing), 0, Math.cos(this.her.facing));
    const perp = new THREE.Vector3(-f.z, 0, f.x);
    const over = her.clone().addScaledVector(f, 1.05).addScaledVector(perp, 0.45).setY(1.32);
    over.z = THREE.MathUtils.clamp(over.z, -1.25, 1.25);
    over.x = Math.min(over.x, 7.6);
    const shot = g.cam.shot(over, her.clone().addScaledVector(f, 0.15).setY(0.98), 1.4);
    await g.tweens.to(0.6, (k) => this.phone.group.rotation.set(-1.2 + 0.75 * k, 0, 0));
    await shot;
    if (!this.alive()) return;
    const text = PHONE_NOTE.text;
    const typing = g.tweens.to(g.settings.reducedMotion ? 0.3 : 3.2, (k) => {
      this.phone.setScreen(text, k * text.length);
      if (Math.random() < 0.18) g.audio.sfx('select');
    }, Ease.linear);
    await g.ui.play(DIALOGUE.lrtTyping);
    await typing;
    if (!this.alive()) return;

    // she steps closer and turns the screen towards him (side two-shot)
    const to = her.clone().addScaledVector(toHim, Math.max(0, her.distanceTo(him) - 0.95));
    const mid = him.clone().add(to).multiplyScalar(0.5);
    const side = right.clone();
    if (side.x > 0) side.negate();
    const two = mid.clone().addScaledVector(side, 2.2).setY(1.35);
    two.z = THREE.MathUtils.clamp(two.z, -1.2, 1.2);
    const twoShot = g.cam.shot(two, mid.clone().setY(0.95), 1.6);
    this.her.facing = Math.atan2(toHim.x, toHim.z);
    this.him.faceTowards(to);
    this.her.speed = 1.1;
    const from = her.clone();
    await g.tweens.to(Math.max(0.4, from.distanceTo(to) / 1.1), (k) => this.her.root.position.lerpVectors(from, to, k), Ease.linear);
    this.her.speed = 0;
    this.her.lookPitch = 0;
    this.her.lookAtPoint(this.him.root.position.clone().setY(1.05));
    this.him.lookAtPoint(this.her.root.position.clone().setY(0.95));
    await twoShot;
    if (!this.alive()) return;
    g.audio.sfx('pop');
    await g.tweens.to(0.7, (k) => {
      this.phone.group.rotation.set(-0.45 + 0.45 * k, Math.PI * k, 0);
    });
    this.him.lookAtPoint(this.her.root.position.clone().setY(0.98));
    await g.tweens.wait(0.6);
    if (!this.alive()) return;
    await g.ui.showPhone(text, PHONE_NOTE.hint);
    if (!this.alive()) return;

    await g.ui.play(DIALOGUE.keychain, { onCue: (c) => (c === 'handoff' ? this.handoff() : undefined) });
    if (!this.alive()) return;
    g.story.go(S.LRT_CHAT);
    this.her.lookAtPoint(this.him.root.position.clone().setY(1.05));
    await g.ui.play(DIALOGUE.lrtChat);
    if (!this.alive()) return;
    await this.arrive();
  }

  private async moveDoors(open: boolean, dur: number): Promise<void> {
    const from = this.doors.map((d) => d.leaf.position.x);
    await this.game.tweens.to(dur, (k) => {
      this.doors.forEach((d, i) => (d.leaf.position.x = THREE.MathUtils.lerp(from[i], open ? d.openX : d.closedX, k)));
    });
  }

  private async handoff(): Promise<void> {
    const g = this.game;
    g.story.go(S.KEYCHAIN_HANDOFF);
    this.him.reachRTarget = 0.9;
    await g.tweens.wait(0.35);
    // detach keychain into world space and fly it to her hand
    const start = new THREE.Vector3();
    this.keychain.getWorldPosition(start);
    this.scene.attach(this.keychain);
    this.her.reachLTarget = 0.85;
    this.her.reachRTarget = 0.4;
    this.phone.group.rotation.set(-1.0, 0, 0);
    await g.tweens.wait(0.25);
    const end = new THREE.Vector3();
    g.audio.sfx('sparkle');
    await g.tweens.to(1.1, (k) => {
      this.her.handL.getWorldPosition(end);
      this.keychain.position.lerpVectors(start, end, k);
      this.keychain.position.y += Math.sin(k * Math.PI) * 0.25;
      this.keychain.rotation.y = k * Math.PI * 2;
      if (Math.random() < 0.5) this.sparkles.emit(this.keychain.position, new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.3, (Math.random() - 0.5) * 0.4), 0.8);
    });
    this.her.handL.attach(this.keychain);
    this.keychain.position.set(0, -0.02, 0.04);
    this.keychain.scale.setScalar(1.6);
    this.him.reachRTarget = 0;
    await g.tweens.wait(0.3);
    this.her.reachLTarget = 0.35;
    g.unlockMemory('keychain');
    await g.tweens.wait(0.6);
  }

  private async arrive(): Promise<void> {
    const g = this.game;
    g.story.go(S.TRANSITION_TO_ESPLANADE);
    g.save.data.checkpoint = 'esplanade';
    g.save.save();
    g.audio.sfx('ding');
    await g.tweens.to(2.2, (k) => (this.trainSpeed = 1 - k), Ease.out);
    g.audio.sfx('door');
    await this.moveDoors(true, 1.0);
    if (!this.alive()) return;
    await g.ui.play(DIALOGUE.lrtArrive);
    g.audio.sfx('whoosh');
    await g.ui.fade(1, 900);
    if (!this.alive()) return;
    g.ui.hud(false);
    await g.ui.chapter('Later · around 7:00 PM', 'Pasig River Esplanade', 2400);
    if (!this.alive()) return;
    await g.switchTo('esplanade');
  }

  update(dt: number): void {
    super.update(dt);
    this.t += dt;
    const g = this.game;
    this.texA.offset.x += dt * 0.35 * this.trainSpeed;
    this.texB.offset.x -= dt * 0.35 * this.trainSpeed;
    g.cam.sway = this.trainSpeed;
    const rm = g.settings.reducedMotion;
    for (const p of this.passengers) {
      p.sway = this.trainSpeed;
      p.update(dt, rm);
    }
    this.him.update(dt, rm);
    this.her.update(dt, rm);
    this.sparkles.update(dt);
    this.sun.offset.x -= dt * 0.12 * this.trainSpeed;
    this.t += 0;
  }
}
