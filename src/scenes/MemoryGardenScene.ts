import * as THREE from 'three';
import type { Game } from '../app/Game';
import { makeSky } from '../art/environment';
import { glow, mat, PALETTE } from '../art/materials';
import { mergeStatic } from '../art/merge';
import { makeBowl, makeGlowPoints, makeKeychain, makeLetter, makeMarker, makeSunflower, makeTree, Particles } from '../art/props';
import { signTexture } from '../art/textures';
import { makeBouquet, makeJoung, makeKooki, makeTteokCup, makeZed, makeZena } from '../art/models';
import { Character } from '../characters/CharacterFactory';
import { Pet } from '../characters/PetController';
import { box } from '../characters/PlayerController';
import { OBJECTIVES } from '../data/dialogue';
import { MEMORIES } from '../data/memories';
import { GIRL, KOOKI, PROTAGONIST, ZED } from '../data/settings';
import { BaseScene } from './BaseScene';

/** Epilogue: a small night garden where each keepsake rests on a pedestal. */
export class MemoryGardenScene extends BaseScene {
  private him!: Character;
  private her!: Character;
  private zed!: Pet;
  private kooki!: Pet;
  private keepsakes: THREE.Object3D[] = [];
  private fireflies!: Particles;
  private t = 0;
  private reading = false;

  constructor(game: Game) {
    super(game);
    this.camDistance = 5;
  }

  build(): void {
    const sc = this.scene;
    sc.background = new THREE.Color('#0b1230');
    sc.fog = new THREE.Fog('#121a3e', 16, 60);
    sc.add(makeSky({ horizon: '#4a3d84' }));
    sc.add(new THREE.HemisphereLight('#8f8ae0', '#2a2440', 1.3));
    const l1 = new THREE.PointLight('#c9a8ff', 6, 14, 1.3);
    l1.position.set(0, 3.2, -2.5);
    sc.add(l1);
    const l2 = new THREE.PointLight('#ffcf8a', 4, 12, 1.3);
    l2.position.set(0, 2.6, 3);
    sc.add(l2);

    const stat = new THREE.Group();
    sc.add(stat);
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
      const me = new THREE.Mesh(geo, m);
      me.position.set(x, y, z);
      stat.add(me);
      return me;
    };
    const glowPts: { p: THREE.Vector3; color: string }[] = [];
    add(new THREE.CylinderGeometry(10, 10.4, 0.5, 28), mat('#2b5a49'), 0, -0.25, 0);
    add(new THREE.CylinderGeometry(60, 60, 0.2, 24), mat('#101a33'), 0, -0.7, 0);
    // stone path ring
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const s = add(new THREE.CylinderGeometry(0.32, 0.34, 0.06, 6), mat('#8a83a0'), Math.cos(a) * 2.6, 0.02, Math.sin(a) * 2.6);
      s.rotation.y = a;
    }
    // flowers
    const flowerCols = ['#b48cff', '#f2a7c3', '#ffd36e', '#c4b0ff', '#8b5cf6'];
    for (let i = 0; i < 90; i++) {
      const a = i * 2.39996;
      const r = 6.2 + (i % 7) * 0.45;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      add(new THREE.CylinderGeometry(0.01, 0.01, 0.2, 3), mat('#4f8a4a'), x, 0.1, z);
      add(new THREE.IcosahedronGeometry(0.07, 0), mat(flowerCols[i % 5], { emissive: flowerCols[i % 5], ei: 0.25 }), x, 0.22, z);
    }
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + 0.2;
      const tr = makeTree(1 + (i % 3) * 0.15);
      tr.position.set(Math.cos(a) * 8.6, 0, Math.sin(a) * 8.6);
      stat.add(tr);
      this.area.colliders.push(box(tr.position.x, tr.position.z, 0.5, 0.5));
    }
    // fairy-light arch at the back
    const archR = 3.2;
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI;
      const p = new THREE.Vector3(Math.cos(a) * archR, 0.2 + Math.sin(a) * 3.2, -5.6);
      add(new THREE.SphereGeometry(0.06, 5, 4), glow(i % 2 ? '#ffd79a' : '#c9b2ff'), p.x, p.y, p.z);
      glowPts.push({ p, color: i % 2 ? '#ffcf8a' : '#b69bff' });
    }
    for (const sx of [-1, 1]) add(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 5), mat(PALETTE.woodDark), sx * archR, 0.2, -5.6);

    // pedestals in an arc
    const items: (() => THREE.Object3D)[] = [
      () => {
        const k = makeKeychain();
        k.scale.setScalar(4);
        k.position.y = 0.4;
        return k;
      },
      () => {
        const b = makeTteokCup(this.game.assets);
        b.scale.setScalar(2.4);
        return b;
      },
      () => {
        const f = makeBouquet(this.game.assets);
        f.group.scale.multiplyScalar(1.2);
        return f.group;
      },
      () => {
        const l = makeLetter();
        l.group.scale.setScalar(1.6);
        l.group.position.y = 0.2;
        l.flap.rotation.x = -2.6;
        l.paper.position.y = 0.16;
        l.paper.scale.y = 1;
        return l.group;
      },
      () => {
        const g = new THREE.Group();
        const d = makeZed(this.game.assets);
        d.root.scale.setScalar(0.55);
        d.root.position.x = -0.13;
        const c = makeKooki(this.game.assets);
        c.root.scale.setScalar(0.55);
        c.root.position.x = 0.13;
        g.add(d.root, c.root);
        g.userData.pets = [d, c];
        return g;
      },
    ];
    MEMORIES.forEach((m, i) => {
      const a = Math.PI + 0.45 + (i / (MEMORIES.length - 1)) * (Math.PI - 0.9);
      const x = Math.cos(a) * 4.4;
      const z = Math.sin(a) * 4.4 + 0.6;
      add(new THREE.CylinderGeometry(0.34, 0.42, 0.75, 8), mat('#d8d0e6'), x, 0.37, z);
      add(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 8), mat('#b9aed0'), x, 0.77, z);
      add(new THREE.TorusGeometry(0.36, 0.02, 4, 16), glow('#c9b2ff'), x, 0.8, z).rotation.x = Math.PI / 2;
      glowPts.push({ p: new THREE.Vector3(x, 0.85, z), color: '#9b6dff' });
      const item = items[i]();
      const holder = new THREE.Group();
      holder.userData.dynamic = true;
      holder.position.set(x, 0.82, z);
      holder.add(item);
      sc.add(holder);
      this.keepsakes.push(holder);
      this.area.colliders.push(box(x, z, 0.8, 0.8));
      const marker = makeMarker();
      marker.scale.setScalar(0.7);
      sc.add(marker);
      this.game.interactions.add({
        id: `keepsake-${m.id}`,
        prompt: `Remember: ${m.title}`,
        radius: 1.5,
        position: () => new THREE.Vector3(x, 2.0, z),
        enabled: () => !this.reading,
        action: async () => {
          this.reading = true;
          this.control = false;
          this.game.audio.sfx('sparkle');
          await this.game.ui.memoryCard(m);
          this.reading = false;
          this.control = true;
        },
        marker,
      });
    });

    // signpost back to the start
    const post = new THREE.Group();
    post.position.set(2.6, 0, 6.4);
    post.rotation.y = -0.5;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.5, 6), mat(PALETTE.woodDark));
    pole.position.y = 0.75;
    post.add(pole);
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 0.4),
      new THREE.MeshBasicMaterial({ map: signTexture('Back to the start', { bg: '#f6ead2', fg: '#3b2f4a', w: 512, h: 150 }), side: THREE.DoubleSide }),
    );
    board.material.userData.temp = true;
    board.position.y = 1.35;
    post.add(board);
    post.userData.dynamic = true;
    post.traverse((o) => (o.userData.dynamic = true));
    sc.add(post);
    this.area.colliders.push(box(2.6, 6.4, 0.3, 0.3));
    this.game.interactions.add({
      id: 'garden-exit',
      prompt: 'Back to the title screen',
      radius: 1.4,
      position: () => new THREE.Vector3(2.6, 2.0, 6.4),
      enabled: () => !this.reading,
      action: async () => {
        this.control = false;
        await this.game.ui.fade(1, 700);
        await this.game.showTitle();
      },
    });

    mergeStatic(stat);
    sc.add(makeGlowPoints(glowPts, 0.7));

    // the family
    this.him = makeJoung(this.game.assets, 'date');
    this.him.root.position.set(0, 0, 4.4);
    this.him.facing = Math.PI;
    this.him.root.rotation.y = Math.PI;
    sc.add(this.him.root);
    this.setPlayer(this.him);

    this.her = makeZena(this.game.assets, 'date');
    this.her.root.position.set(0.5, 0, 0.6);
    this.her.facing = 0;
    sc.add(this.her.root);
    const flower = makeBouquet(this.game.assets);
    flower.group.position.set(0, -0.03, 0.05);
    flower.group.rotation.set(0.55, 0, 0);
    this.her.handR.add(flower.group);
    this.her.reachRTarget = 0.4;
    const kc = makeKeychain();
    kc.scale.setScalar(1.6);
    kc.position.set(0, -0.02, 0.04);
    this.her.handL.add(kc);
    this.her.reachLTarget = 0.2;
    this.area.colliders.push(box(0.5, 0.6, 0.5, 0.5));

    this.zed = makeZed(this.game.assets);
    this.zed.root.position.set(-0.4, 0, 0.9);
    this.zed.facing = 0.3;
    this.kooki = makeKooki(this.game.assets);
    this.kooki.root.position.set(1.25, 0, 0.95);
    this.kooki.facing = -0.4;
    this.zed.wag = 0.8;
    sc.add(this.zed.root, this.kooki.root);
    this.area.colliders.push(box(-0.4, 0.9, 0.5, 0.6), box(1.25, 0.95, 0.4, 0.5));

    this.fireflies = new Particles(70, '#ffe7a3', 0.13);
    this.fireflies.drag = 0.1;
    sc.add(this.fireflies.points);

    this.area.bounds = { minX: -7.6, maxX: 7.6, minZ: -7.2, maxZ: 7.2 };
    this.camBounds = { min: new THREE.Vector3(-12, 0.4, -12), max: new THREE.Vector3(12, 10, 12) };
  }

  async start(): Promise<void> {
    const g = this.game;
    g.ui.hud(true);
    g.audio.setAmbience('garden');
    g.audio.setMusic('garden');
    g.cam.snap(this.him.root.position, 0, 0.42);
    await g.ui.fade(0, 900);
    if (!this.alive()) return;
    await g.ui.chapter('Epilogue', 'The Memory Garden', 2000);
    if (!this.alive()) return;
    this.control = true;
    g.ui.controls(true);
    g.ui.objective(OBJECTIVES.garden);
  }

  update(dt: number): void {
    super.update(dt);
    this.t += dt;
    const rm = this.game.settings.reducedMotion;
    this.him.update(dt, rm);
    this.her.lookAtPoint(this.him.root.position.clone().setY(1.1));
    this.her.update(dt, rm);
    this.zed.lookAtPoint(this.him.root.position.clone().setY(0.8));
    this.kooki.lookAtPoint(this.him.root.position.clone().setY(0.8));
    this.zed.update(dt, rm);
    this.kooki.update(dt, rm);
    this.keepsakes.forEach((k, i) => {
      if (!rm) k.rotation.y += dt * 0.5;
      k.position.y = 0.82 + Math.sin(this.t * 1.5 + i) * 0.03;
      const pets = k.children[0]?.userData.pets as Pet[] | undefined;
      if (pets) for (const p of pets) p.update(dt, rm);
    });
    if (dt > 0 && Math.random() < 0.5) {
      const a = Math.random() * Math.PI * 2;
      const r = 2 + Math.random() * 6;
      this.fireflies.emit(
        new THREE.Vector3(Math.cos(a) * r, 0.3 + Math.random() * 1.5, Math.sin(a) * r),
        new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.05 + Math.random() * 0.1, (Math.random() - 0.5) * 0.3),
        3.5,
      );
    }
    this.fireflies.update(dt);
  }
}
