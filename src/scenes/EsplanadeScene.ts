import * as THREE from 'three';
import type { Game } from '../app/Game';
import { Crowd } from '../art/crowd';
import { makeSky, makeWater, scaleUV } from '../art/environment';
import { glow, mat, PALETTE, temp } from '../art/materials';
import { mergeStatic } from '../art/merge';
import {
  BENCH_SEAT_Y,
  makeBench,
  makeBowl,
  makeGlowPoints,
  makeLampPost,
  makeLetter,
  makeMarker,
  makeStall,
  makeStool,
  makeSunflower,
  makeTable,
  makeTree,
  Particles,
  type StallOpts,
} from '../art/props';
import { buildingTexture, heartSignTexture, paverTexture, petalTexture } from '../art/textures';
import { makeBouquet, makeJoung, makeKooki, makeTteokCup, makeZed, makeZena } from '../art/models';
import { Character } from '../characters/CharacterFactory';
import { Pet } from '../characters/PetController';
import { box, Follower } from '../characters/PlayerController';
import { DIALOGUE, OBJECTIVES, PROPOSAL } from '../data/dialogue';
import { GIRL, KOOKI, PROTAGONIST, RENDER, ZED, type HumanLook } from '../data/settings';
import { S } from '../data/story';
import { Ease } from '../systems/Tweens';
import { BaseScene } from './BaseScene';

const RAIL_Z = -5.9;
const STALL_Z = 5;
const BENCH = new THREE.Vector3(18, 0, -4.55);
const TTEOK_X = -8;
const TABLE = new THREE.Vector3(-10.4, 0, 2.5);
const FLOWER_SPOT = new THREE.Vector3(6, 0, -4.3);
/** the riverside bench where they ate the tteokbokki */
const EAT = new THREE.Vector3(0, 0, -4.55);

interface Walker {
  root: THREE.Object3D;
  speed: number;
  facing: number;
}

const STALLS: (StallOpts & { x: number })[] = [
  { x: -17, sign: 'ISAW', sub: 'grilled skewers', signBg: '#2b1b14', signFg: '#ffb35c', awningA: '#c0392b', awningB: '#f3e1c7', wood: '#7b4a32', kind: 'skewer' },
  { x: -12.5, sign: 'FISHBALLS', sub: 'sweet & spicy sauce', signBg: '#14223b', signFg: '#ffd166', awningA: '#2a6f97', awningB: '#f7f1e3', wood: '#6d4c3d', kind: 'balls' },
  { x: TTEOK_X, sign: '떡볶이', sub: 'TTEOKBOKKI', signBg: '#3a0f18', signFg: '#ff8a5c', awningA: '#e4572e', awningB: '#ffe8cc', wood: '#8a3b2a', kind: 'tteok' },
  { x: -3.5, sign: 'MANGO SHAKE', signBg: '#2a2410', signFg: '#ffd34e', awningA: '#f4a259', awningB: '#fff3d6', wood: '#7f5539', kind: 'drinks' },
  { x: 1, sign: 'GRILLED CORN', signBg: '#1e2a16', signFg: '#e9f5a1', awningA: '#588157', awningB: '#f1f7e8', wood: '#6b4f33', kind: 'corn' },
  { x: 5.5, sign: 'TAKOYAKI', signBg: '#21162e', signFg: '#ffb3c7', awningA: '#9d4edd', awningB: '#f5ecff', wood: '#5e3b5a', kind: 'balls' },
  { x: 10, sign: 'MILK TEA', signBg: '#2b1f1a', signFg: '#f2d0a4', awningA: '#a47148', awningB: '#fbefe0', wood: '#6e4a31', kind: 'drinks' },
];

export class EsplanadeScene extends BaseScene {
  private him!: Character;
  private her!: Character;
  private follower!: Follower;
  private vendors: Character[] = [];
  private extras: Character[] = [];
  private crowd!: Crowd;
  private water!: { mesh: THREE.Mesh; uniforms: Record<string, THREE.IUniform> };
  private steam!: Particles;
  private sparkles!: Particles;
  private petals!: Particles;
  private steamSources: THREE.Vector3[] = [];
  private sunflower!: { group: THREE.Group; head: THREE.Object3D };
  private flowerScale = 1;
  private cups: THREE.Group[] = [];
  private bought = false;
  private eating = false;
  private steamObjs: THREE.Object3D[] = [];
  private letter!: { group: THREE.Group; flap: THREE.Group; paper: THREE.Mesh };
  private letterHover = new THREE.Vector3(BENCH.x + 1.05, 1.25, BENCH.z - 0.45);
  private zed!: Pet;
  private kooki!: Pet;
  private sign!: THREE.Group;
  private bowls!: THREE.Group;
  private benchLight!: THREE.PointLight;
  private t = 0;
  private titleT = 0;

  constructor(game: Game, private mode: 'title' | 'play') {
    super(game);
    this.camDistance = 4.6;
  }

  // =================================================================== build
  build(): void {
    const sc = this.scene;
    const low = this.game.settings.lowEffects;
    sc.background = new THREE.Color('#0c1434');
    sc.fog = new THREE.Fog('#141c40', 30, 150);
    sc.add(makeSky());
    sc.add(new THREE.HemisphereLight('#7d88d8', '#3a2638', 1.15));
    const moon = new THREE.DirectionalLight('#a9b8ff', 0.55);
    moon.position.set(-20, 40, -50);
    sc.add(moon);
    const pl = (x: number, y: number, z: number, color: string, i: number, d: number) => {
      const l = new THREE.PointLight(color, i, d, 1.3);
      l.position.set(x, y, z);
      sc.add(l);
      return l;
    };
    pl(TTEOK_X, 2.3, 3.4, '#ffb46b', 9, 11);
    pl(-14.8, 2.3, 3.4, '#ffc27a', 6, 10);
    pl(3.2, 2.3, 3.4, '#ffc27a', 6, 10);
    pl(FLOWER_SPOT.x, 2.6, -4.8, '#b48cff', 5, 7);
    this.benchLight = pl(BENCH.x, 2.6, -4.0, '#ffcf8a', 5, 8);
    // soft fill from the river side so faces read during the finale
    pl(BENCH.x + 0.6, 1.7, BENCH.z - 1.9, '#d9c8ff', 2.6, 5.5);

    const stat = new THREE.Group();
    sc.add(stat);
    const glowPts: { p: THREE.Vector3; color: string }[] = [];

    // ground & promenade
    const pav = paverTexture();
    pav.repeat.set(64, 20);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 48), temp(new THREE.MeshStandardMaterial({ map: pav, roughness: 0.95, color: '#9a93b2' })));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 18);
    ground.userData.dynamic = true;
    sc.add(ground);
    const gm = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
      const me = new THREE.Mesh(geo, m);
      me.position.set(x, y, z);
      stat.add(me);
      return me;
    };
    // embankment and railing
    gm(new THREE.BoxGeometry(160, 0.18, 0.55), mat('#8e889e'), 0, 0.02, -6.05);
    gm(new THREE.BoxGeometry(160, 1.0, 0.3), mat('#3c3a4d'), 0, -0.5, -6.3);
    const railM = mat('#2d3245', { rough: 0.45 });
    for (const y of [0.98, 0.58]) {
      const r = gm(new THREE.CylinderGeometry(0.03, 0.03, 160, 6), railM, 0, y, RAIL_Z);
      r.rotation.z = Math.PI / 2;
    }
    for (let x = -60; x <= 60; x += 1.5) gm(new THREE.BoxGeometry(0.06, 1.0, 0.06), railM, x, 0.5, RAIL_Z);

    // grass strip, trees, back buildings
    gm(new THREE.BoxGeometry(160, 0.25, 6), mat(PALETTE.grass), 0, 0.12, 10.5);
    for (let x = -30; x <= 30; x += 6.5) {
      const tr = makeTree(0.9 + ((x * 7) % 3) * 0.1);
      tr.position.set(x + 1.5, 0.2, 9.5);
      stat.add(tr);
    }
    for (let i = 0; i < 14; i++) {
      const w = 6 + (i % 3) * 2;
      const h = 6 + ((i * 5) % 7);
      const tex = buildingTexture(i + 3, '#1a1f3f');
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      const geo = scaleUV(new THREE.BoxGeometry(w, h, 4), w / 6, h / 8);
      gm(geo, temp(new THREE.MeshBasicMaterial({ map: tex, color: '#8d8fb8', fog: true })), -40 + i * 6.5, h / 2, 17);
    }

    // far bank skyline
    const tints = ['#1c2350', '#222a5c', '#18204a'];
    for (let i = 0; i < 34; i++) {
      const w = 5 + ((i * 7) % 6);
      const h = 7 + ((i * 13) % 26);
      const tex = buildingTexture(i, tints[i % 3]);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      const geo = scaleUV(new THREE.BoxGeometry(w, h, 6), w / 6, h / 9);
      gm(geo, temp(new THREE.MeshBasicMaterial({ map: tex, fog: true })), -110 + i * 6.6, h / 2 - 0.5, -66 - (i % 4) * 4);
    }
    gm(new THREE.BoxGeometry(260, 1.2, 4), mat('#151a35'), 0, -0.2, -60);
    // bridge on the left
    gm(new THREE.BoxGeometry(7, 0.7, 56), mat('#2a2d48'), -46, 3.2, -33);
    for (let z = -8; z >= -58; z -= 10) gm(new THREE.BoxGeometry(2, 4, 2), mat('#20233b'), -46, 1.0, z);
    for (let z = -6; z >= -60; z -= 3) {
      for (const dx of [-3.4, 3.4]) {
        gm(new THREE.SphereGeometry(0.12, 5, 4), glow('#ffd59a'), -46 + dx, 3.9, z);
        glowPts.push({ p: new THREE.Vector3(-46 + dx, 3.9, z), color: '#ffcf8a' });
      }
    }

    // water
    this.water = makeWater(300, 120, -6.2, -0.7);
    sc.add(this.water.mesh);

    // lamps and string lights
    const lampXs: number[] = [];
    for (let x = -27; x <= 27; x += 6) lampXs.push(x);
    for (const x of lampXs) {
      const lp = makeLampPost();
      lp.group.position.set(x, 0, -5.45);
      stat.add(lp.group);
      glowPts.push({ p: new THREE.Vector3(x, 2.86, -5.45), color: '#ffd08a' });
      this.area.colliders.push(box(x, -5.45, 0.3, 0.3));
    }
    const bulbA = glow('#ffd79a');
    const bulbB = glow('#c9b2ff');
    const strand = (a: THREE.Vector3, b: THREE.Vector3, n: number, sag: number) => {
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const p = new THREE.Vector3().lerpVectors(a, b, t);
        p.y -= sag * 4 * t * (1 - t);
        const lav = i % 3 === 0;
        gm(new THREE.SphereGeometry(0.05, 5, 4), lav ? bulbB : bulbA, p.x, p.y, p.z);
        glowPts.push({ p, color: lav ? '#b69bff' : '#ffcf8a' });
      }
    };
    for (let i = 0; i < lampXs.length - 1; i++) {
      strand(new THREE.Vector3(lampXs[i], 2.7, -5.45), new THREE.Vector3(lampXs[i + 1], 2.7, -5.45), 12, 0.45);
    }
    for (const s of STALLS) {
      strand(new THREE.Vector3(s.x - 1.6, 2.2, STALL_Z - 1.2), new THREE.Vector3(s.x + 1.2, 2.75, -5.45), 16, 0.6);
    }

    // stalls
    for (const s of STALLS) {
      const st = makeStall(s);
      st.group.position.set(s.x, 0, STALL_Z);
      st.group.rotation.y = Math.PI;
      stat.add(st.group);
      st.group.updateMatrixWorld(true);
      for (const b of st.bulbs) glowPts.push({ p: b.clone().applyMatrix4(st.group.matrixWorld), color: '#ffcf8a' });
      if (s.kind === 'tteok') {
        const pan = st.pan.clone().applyMatrix4(st.group.matrixWorld);
        this.steamSources.push(pan, pan.clone().add(new THREE.Vector3(0.2, 0, 0.1)));
      }
      this.area.colliders.push(box(s.x, STALL_Z, 3.4, 1.9));
      // vendor
      const v = new Character({ ...PROTAGONIST, top: s.awningA, bottom: '#2f2a33', hair: '#1c1718', hairStyle: s.x > 0 ? 'bun' : 'fluffy', skin: ['#c98d66', '#e0ac85', '#a8714f'][Math.abs(Math.round(s.x)) % 3] } as HumanLook);
      v.root.position.set(s.x + 0.4, 0, STALL_Z + 0.3);
      v.facing = Math.PI;
      v.root.rotation.y = Math.PI;
      sc.add(v.root);
      this.vendors.push(v);
    }

    // tables near the tteokbokki stall
    const table = makeTable();
    table.position.copy(TABLE);
    stat.add(table);
    for (const dx of [-0.62, 0.62]) {
      const stool = makeStool(dx < 0 ? '#d9534f' : '#f2a541');
      stool.position.set(TABLE.x + dx, 0, TABLE.z);
      stat.add(stool);
    }
    this.area.colliders.push(box(TABLE.x, TABLE.z, 1.7, 0.8));
    const table2 = makeTable();
    table2.position.set(-5.6, 0, 2.4);
    stat.add(table2);
    for (const dx of [-0.62, 0.62]) {
      const stool = makeStool('#4ea8de');
      stool.position.set(-5.6 + dx, 0, 2.4);
      stat.add(stool);
    }
    this.area.colliders.push(box(-5.6, 2.4, 1.7, 0.8));
    this.bowls = new THREE.Group();
    this.bowls.userData.dynamic = true;
    for (const dx of [-0.18, 0.18]) {
      const b = makeBowl(true);
      b.position.set(dx, 0.645, 0);
      this.bowls.add(b);
    }
    this.bowls.position.set(TABLE.x, 0, TABLE.z);
    this.bowls.visible = false;
    sc.add(this.bowls);

    // benches
    const bench = makeBench();
    bench.position.copy(BENCH);
    bench.rotation.y = Math.PI;
    stat.add(bench);
    this.area.colliders.push(box(BENCH.x, BENCH.z, 1.85, 0.6));
    for (const bx of [-21, 12, EAT.x]) {
      const b = makeBench();
      b.position.set(bx, 0, BENCH.z);
      b.rotation.y = Math.PI;
      stat.add(b);
      this.area.colliders.push(box(bx, BENCH.z, 1.85, 0.6));
    }
    // a couple sitting on the far bench (ambient)
    for (const [dx, look] of [[-0.4, { top: '#e07a5f', hairStyle: 'ponytail', bottomType: 'skirt' }], [0.4, { top: '#3d5a80', hairStyle: 'fluffy', bottomType: 'pants' }]] as const) {
      const c = new Character({ ...GIRL, ...look, hair: '#241c1a', bottom: '#2f3046' } as HumanLook);
      c.root.position.set(-21 + dx, 0, BENCH.z);
      c.facing = Math.PI;
      c.root.rotation.y = Math.PI;
      c.sit = c.sitTarget = 1;
      sc.add(c.root);
      this.extras.push(c);
    }
    // purple accent at the sunflower spot
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const p = new THREE.Vector3(FLOWER_SPOT.x + Math.cos(a) * 0.9, 0.06, FLOWER_SPOT.z + Math.sin(a) * 0.45);
      gm(new THREE.SphereGeometry(0.05, 5, 4), bulbB, p.x, p.y, p.z);
      glowPts.push({ p, color: '#a989ff' });
    }

    mergeStatic(stat);
    sc.add(makeGlowPoints(glowPts, 0.75));

    // crowd
    const n = low ? RENDER.crowdCountLow : RENDER.crowdCount;
    this.crowd = new Crowd(n, -30, 30);
    const lanes = [-3.7, -1.4, 1.0];
    const walkers = Math.round(n * 0.55);
    for (let i = 0; i < walkers; i++) {
      this.crowd.add({ x: -30 + ((i * 37) % 60), z: lanes[i % lanes.length] + ((i * 13) % 5) * 0.08, mode: 'walk' });
    }
    let k = 0;
    for (const s of STALLS) {
      if (this.crowd.agents.length >= n) break;
      for (const dx of [-0.7, 0.5]) {
        if (s.kind === 'tteok' && dx > 0) continue;
        this.crowd.add({ x: s.x + dx + (k % 2) * 0.2, z: STALL_Z - 1.55, mode: 'stand', facing: 0 });
        k++;
      }
    }
    for (const x of [-25, -19, -14, -9.5, 9.5, -26.5, 24]) {
      if (this.crowd.agents.length >= n) break;
      this.crowd.add({ x, z: -5.2, mode: 'stand', facing: Math.PI });
    }
    // keep walkers out of the camera's way at the sunflower spot and the bench
    this.crowd.quiet = [
      { x0: FLOWER_SPOT.x - 3, x1: FLOWER_SPOT.x + 3, z: -2.2 },
      { x0: EAT.x - 3.5, x1: EAT.x + 3.5, z: -2.2 },
      { x0: BENCH.x - 4, x1: BENCH.x + 4.5, z: 0.6 },
    ];
    this.crowd.finalize();
    sc.add(this.crowd.group);

    // particles
    this.steam = new Particles(90, '#ffffff', 0.45, { opacity: 0.18 });
    this.sparkles = new Particles(120, '#d6c2ff', 0.14);
    this.petals = new Particles(160, '#a37bff', 0.2, { map: petalTexture(), additive: false, opacity: 0.95 });
    this.petals.gravity = 0.35;
    this.petals.drag = 1.2;
    sc.add(this.steam.points, this.sparkles.points, this.petals.points);

    this.area.bounds = { minX: -28, maxX: 28, minZ: -5.6, maxZ: 7.3 };
    this.camBounds = { min: new THREE.Vector3(-31, 0.4, -10), max: new THREE.Vector3(31, 14, 10) };

    if (this.mode === 'play') this.buildStoryActors();
  }

  private buildStoryActors(): void {
    const sc = this.scene;
    const g = this.game;
    const A = g.assets;
    this.him = makeJoung(A, 'date');
    this.him.root.position.set(-24.5, 0, -1.2);
    this.him.facing = Math.PI / 2;
    this.him.root.rotation.y = this.him.facing;
    sc.add(this.him.root);
    this.setPlayer(this.him);

    this.her = makeZena(A, 'date');
    this.her.root.position.set(-25.3, 0, -0.4);
    this.her.facing = Math.PI / 2;
    sc.add(this.her.root);
    this.follower = new Follower(this.her, this.him);

    this.sunflower = makeBouquet(A);
    this.flowerScale = this.sunflower.group.scale.x;
    this.sunflower.group.visible = false;
    sc.add(this.sunflower.group);

    this.letter = makeLetter();
    this.letter.group.visible = false;
    sc.add(this.letter.group);

    this.zed = makeZed(A);
    this.kooki = makeKooki(A);
    this.zed.root.visible = false;
    this.kooki.root.visible = false;
    sc.add(this.zed.root, this.kooki.root);

    // Kooki's little sign
    this.sign = new THREE.Group();
    this.sign.userData.dynamic = true;
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 5), mat('#9a6644'));
    stick.position.y = 0.21;
    this.sign.add(stick);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), temp(new THREE.MeshBasicMaterial({ map: heartSignTexture(), side: THREE.DoubleSide })));
    board.position.y = 0.52;
    this.sign.add(board);
    this.sign.visible = false;
    sc.add(this.sign);

    const has = (id: 'tteokbokki' | 'sunflower') => g.save.has(id);
    const exploring = () => g.story.is(S.ESPLANADE_EXPLORATION);

    g.interactions.add({
      id: 'tteokbokki',
      prompt: 'Buy tteokbokki',
      radius: 2.4,
      position: () => new THREE.Vector3(TTEOK_X, 2.0, STALL_Z - 1.4),
      enabled: () => exploring() && !has('tteokbokki') && !this.bought,
      action: () => this.buyTteokbokki(),
      marker: this.addMarker(),
    });
    g.interactions.add({
      id: 'eat',
      prompt: 'Eat it beside the river',
      radius: 2.3,
      position: () => new THREE.Vector3(EAT.x, 1.5, EAT.z + 0.4),
      enabled: () => exploring() && !has('tteokbokki') && this.bought,
      action: () => this.eatByRiver(),
      marker: this.addMarker(),
    });
    g.interactions.add({
      id: 'sunflower',
      prompt: 'Give her the sunflower',
      radius: 2.2,
      position: () => new THREE.Vector3(FLOWER_SPOT.x, 1.7, FLOWER_SPOT.z),
      enabled: () => exploring() && !has('sunflower'),
      action: () => this.giveSunflower(),
      marker: this.addMarker(),
    });
    g.interactions.add({
      id: 'bench',
      prompt: 'Sit together by the river',
      radius: 2.3,
      position: () => new THREE.Vector3(BENCH.x, 1.5, BENCH.z + 0.4),
      enabled: () => (exploring() && has('tteokbokki') && has('sunflower')) || g.story.is(S.FREE_ROAM),
      action: () => this.benchScene(),
      marker: this.addMarker(),
    });
    g.interactions.add({
      id: 'letter',
      prompt: 'Catch the letter',
      radius: 4,
      position: () => this.letter.group.position.clone().setY(1.75),
      enabled: () => g.story.is(S.LETTER_INTERACTION) && !this.catching,
      action: () => this.catchLetter(),
    });

    if (g.save.has('sunflower')) this.giveFlowerInstant();
  }

  private addMarker(): THREE.Group {
    const m = makeMarker();
    this.scene.add(m);
    return m;
  }

  private updateObjective(): void {
    const g = this.game;
    if (g.story.is(S.FREE_ROAM)) return g.ui.objective(OBJECTIVES.freeRoam);
    if (!g.story.is(S.ESPLANADE_EXPLORATION)) return g.ui.objective(null);
    const t = g.save.has('tteokbokki');
    const f = g.save.has('sunflower');
    const tt = this.bought ? OBJECTIVES.esplanadeEat : OBJECTIVES.esplanadeTteok;
    g.ui.objective(!t && !f ? `${tt} · Give her the sunflower` : !t ? tt : !f ? OBJECTIVES.esplanadeFlower : OBJECTIVES.bench);
  }

  private setControl(on: boolean): void {
    this.control = on;
    this.game.ui.controls(on);
    if (this.follower) {
      this.follower.enabled = on;
      if (!on) this.follower.stop();
    }
  }

  // =================================================================== start
  async start(): Promise<void> {
    const g = this.game;
    g.audio.setAmbience('market');
    if (this.mode === 'title') {
      g.audio.setMusic('title');
      this.titleT = 0;
      this.update(0);
      return;
    }
    if (g.story.is(S.TRANSITION_TO_ESPLANADE)) g.story.go(S.ESPLANADE_EXPLORATION);
    g.audio.setMusic('market');
    g.ui.hud(true);
    this.setControl(false);
    g.cam.snap(this.him.root.position, -Math.PI / 2 + 0.25, 0.32);
    await g.ui.fade(0, 900);
    if (!this.alive()) return;
    if (!(g.save.has('tteokbokki') && g.save.has('sunflower'))) await g.ui.play(DIALOGUE.esplanadeArrive);
    if (!this.alive()) return;
    this.setControl(true);
    this.updateObjective();
  }

  // =================================================================== helpers
  private async walkTo(w: Walker, target: THREE.Vector3, speed = 1.4): Promise<void> {
    const from = w.root.position.clone();
    const d = from.distanceTo(target);
    if (d < 0.02) return;
    w.facing = Math.atan2(target.x - from.x, target.z - from.z);
    w.speed = speed;
    await this.game.tweens.to(d / speed, (k) => w.root.position.lerpVectors(from, target, k), Ease.linear);
    w.speed = 0;
  }

  private emitSparkles(p: THREE.Vector3, n = 14, spread = 0.5): void {
    for (let i = 0; i < n; i++) {
      this.sparkles.emit(p, new THREE.Vector3((Math.random() - 0.5) * spread, Math.random() * 0.8, (Math.random() - 0.5) * spread), 0.8 + Math.random() * 0.6);
    }
  }

  private seat(c: Character, x: number, z: number, facing: number): void {
    c.root.position.set(x, 0, z);
    c.facing = facing;
    c.root.rotation.y = facing;
    c.sit = c.sitTarget = 1;
    c.speed = 0;
  }

  private stand(c: Character, x: number, z: number, facing: number): void {
    c.root.position.set(x, 0, z);
    c.facing = facing;
    c.root.rotation.y = facing;
    c.sit = c.sitTarget = 0;
    c.hold = c.holdTarget = 0;
    c.lookAtPoint(null);
  }

  // =================================================================== tteokbokki
  /** Hold the bouquet upright in a hand. */
  private holdFlower(hand: 'L' | 'R'): void {
    const h = hand === 'L' ? this.her.handL : this.her.handR;
    h.add(this.sunflower.group);
    this.sunflower.group.position.set(0, -0.03, 0.05);
    this.sunflower.group.rotation.set(0.55, 0, 0);
    this.sunflower.group.scale.setScalar(this.flowerScale);
    this.sunflower.group.visible = true;
  }

  private async buyTteokbokki(): Promise<void> {
    const g = this.game;
    if (!g.story.go(S.TTEOKBOKKI_INTERACTION)) return;
    this.setControl(false);
    g.ui.objective(null);
    const front = STALL_Z - 1.55;
    const himTo = new THREE.Vector3(TTEOK_X - 0.35, 0, front);
    const herTo = new THREE.Vector3(TTEOK_X + 0.45, 0, front + 0.05);
    if (this.her.root.position.distanceTo(this.him.root.position) > 3) this.her.root.position.copy(this.him.root.position).add(new THREE.Vector3(0.8, 0, -0.3));
    const shot = g.cam.shot(new THREE.Vector3(TTEOK_X + 1.9, 1.65, front - 2.3), new THREE.Vector3(TTEOK_X - 0.1, 1.0, STALL_Z - 0.8), 1.4);
    await Promise.all([this.walkTo(this.him, himTo, 1.8), this.walkTo(this.her, herTo, 1.8)]);
    if (!this.alive()) return;
    this.him.facing = 0;
    this.her.facing = -0.25;
    const vendor = this.vendors[STALLS.findIndex((x) => x.kind === 'tteok')];
    this.him.lookAtPoint(vendor.root.position.clone().setY(1.05));
    this.her.lookAtPoint(vendor.root.position.clone().setY(1.05));
    await shot;
    // the vendor scoops two cups and hands them over
    vendor.reachRTarget = 1.0;
    vendor.reachLTarget = 1.0;
    await g.tweens.wait(0.5);
    this.cups = [makeTteokCup(g.assets), makeTteokCup(g.assets)];
    const counter = [new THREE.Vector3(TTEOK_X - 0.15, 0.86, STALL_Z - 0.55), new THREE.Vector3(TTEOK_X + 0.25, 0.86, STALL_Z - 0.55)];
    this.cups.forEach((c, i) => {
      c.position.copy(counter[i]);
      c.scale.setScalar(1.25);
      this.scene.add(c);
      this.steamObjs.push(c);
    });
    g.audio.sfx('pop');
    await g.ui.play(DIALOGUE.tteokBuy);
    if (!this.alive()) return;
    this.him.reachLTarget = 0.85;
    this.her.reachLTarget = 0.85;
    await g.tweens.wait(0.35);
    const hands = [this.him.handL, this.her.handL];
    const end = new THREE.Vector3();
    const starts = this.cups.map((c) => c.position.clone());
    await g.tweens.to(0.7, (k) => {
      this.cups.forEach((c, i) => {
        hands[i].getWorldPosition(end);
        c.position.lerpVectors(starts[i], end, k);
        c.position.y += Math.sin(k * Math.PI) * 0.12;
      });
    });
    this.cups.forEach((c, i) => {
      hands[i].attach(c);
      c.position.set(0, -0.06, 0.05);
      c.rotation.set(0, 0, 0);
    });
    vendor.reachRTarget = vendor.reachLTarget = 0.35;
    this.him.reachLTarget = 0.55;
    this.her.reachLTarget = 0.55;
    this.him.lookAtPoint(null);
    this.her.lookAtPoint(null);
    this.bought = true;
    g.cam.release(this.him.root.position);
    g.story.go(S.ESPLANADE_EXPLORATION);
    this.setControl(true);
    this.updateObjective();
  }

  private async eatByRiver(): Promise<void> {
    const g = this.game;
    if (!g.story.go(S.TTEOKBOKKI_INTERACTION)) return;
    this.setControl(false);
    g.ui.objective(null);
    await g.ui.fade(1, 450);
    if (!this.alive()) return;
    this.seat(this.him, EAT.x - 0.42, EAT.z + 0.02, Math.PI);
    this.seat(this.her, EAT.x + 0.42, EAT.z + 0.02, Math.PI);
    // if she already has the sunflower, it rests on the bench beside her
    const hadFlower = this.sunflower.group.visible && this.sunflower.group.parent === this.her.handR;
    if (hadFlower) {
      this.scene.add(this.sunflower.group);
      this.sunflower.group.position.set(EAT.x + 0.92, 0.47, EAT.z + 0.05);
      this.sunflower.group.rotation.set(Math.PI / 2, 0, 0.35);
      this.sunflower.group.scale.setScalar(this.flowerScale);
      this.her.reachRTarget = 0;
    }
    this.him.reachLTarget = 0.7;
    this.her.reachLTarget = 0.7;
    this.eating = true;
    g.audio.duck(0.6, 1);
    await g.cam.shot(new THREE.Vector3(EAT.x + 0.55, 1.65, EAT.z - 2.0), new THREE.Vector3(EAT.x + 0.1, 0.82, EAT.z), 0);
    await g.ui.fade(0, 600);
    if (!this.alive()) return;
    await g.ui.play(DIALOGUE.tteokbokki);
    if (!this.alive()) return;
    this.him.lookAtPoint(this.her.root.position.clone().setY(1.0));
    this.her.lookAtPoint(this.him.root.position.clone().setY(1.0));
    g.unlockMemory('tteokbokki');
    await g.tweens.wait(2.0);
    await g.ui.fade(1, 450);
    if (!this.alive()) return;
    this.eating = false;
    for (const c of this.cups) {
      c.parent?.remove(c);
      this.steamObjs.splice(this.steamObjs.indexOf(c), 1);
    }
    this.cups = [];
    this.him.reachLTarget = this.her.reachLTarget = 0;
    this.him.reachRTarget = 0;
    this.stand(this.him, EAT.x - 0.4, EAT.z + 1.1, 0);
    this.stand(this.her, EAT.x + 0.4, EAT.z + 1.15, 0);
    if (hadFlower || g.save.has('sunflower')) {
      this.holdFlower('R');
      this.her.reachRTarget = 0.4;
    }
    g.audio.duck(1, 1);
    g.cam.snap(this.him.root.position, 0.2, 0.34);
    g.story.go(S.ESPLANADE_EXPLORATION);
    await g.ui.fade(0, 500);
    this.setControl(true);
    this.updateObjective();
  }

  // =================================================================== sunflower
  private giveFlowerInstant(): void {
    this.holdFlower('R');
    this.her.reachRTarget = 0.4;
  }

  private async giveSunflower(): Promise<void> {
    const g = this.game;
    if (!g.story.go(S.SUNFLOWER_INTERACTION)) return;
    this.setControl(false);
    g.ui.objective(null);
    if (this.her.root.position.distanceTo(this.him.root.position) > 3) {
      this.her.root.position.copy(this.him.root.position).add(new THREE.Vector3(0.9, 0, 0.4));
    }
    const himTo = new THREE.Vector3(FLOWER_SPOT.x - 0.5, 0, FLOWER_SPOT.z + 0.1);
    const herTo = new THREE.Vector3(FLOWER_SPOT.x + 0.45, 0, FLOWER_SPOT.z + 0.1);
    const shot = g.cam.shot(new THREE.Vector3(FLOWER_SPOT.x + 0.3, 1.8, FLOWER_SPOT.z - 2.5), new THREE.Vector3(FLOWER_SPOT.x, 0.95, FLOWER_SPOT.z + 0.2), 1.6);
    await Promise.all([this.walkTo(this.him, himTo, 1.8), this.walkTo(this.her, herTo, 1.8)]);
    if (!this.alive()) return;
    // face each other, opened up towards the camera on the river side
    this.him.facing = 2.0;
    this.her.facing = -2.0;
    this.him.lookAtPoint(this.her.root.position.clone().setY(1.05));
    this.her.lookAtPoint(this.him.root.position.clone().setY(1.05));
    await shot;
    await g.ui.play(DIALOGUE.sunflower, {
      onCue: async (cue) => {
        if (cue !== 'give') return;
        // he brings out the flower and offers it
        this.him.handR.add(this.sunflower.group);
        this.sunflower.group.position.set(0, -0.03, 0.05);
        this.sunflower.group.rotation.set(0.55, 0, 0);
        this.sunflower.group.visible = true;
        this.sunflower.group.scale.setScalar(0.01);
        g.audio.sfx('sparkle');
        await g.tweens.to(0.6, (k) => this.sunflower.group.scale.setScalar(0.01 + k * (this.flowerScale - 0.01)), Ease.outBack);
        this.him.reachRTarget = 0.95;
        const p = new THREE.Vector3();
        this.sunflower.head.getWorldPosition(p);
        this.emitSparkles(p, 18, 0.6);
        await g.tweens.wait(0.9);
        this.her.reachRTarget = 0.9;
        await g.tweens.wait(0.6);
        this.her.handR.attach(this.sunflower.group);
        await g.tweens.to(0.4, (k) => this.sunflower.group.position.lerp(new THREE.Vector3(0, -0.03, 0.05), k));
        this.him.reachRTarget = 0;
        this.her.reachRTarget = 0.4;
        this.sunflower.head.getWorldPosition(p);
        this.emitSparkles(p, 24, 0.8);
        g.unlockMemory('sunflower');
        await g.tweens.wait(0.8);
      },
    });
    if (!this.alive()) return;
    g.cam.release(this.him.root.position);
    g.story.go(S.ESPLANADE_EXPLORATION);
    this.setControl(true);
    this.updateObjective();
  }

  // =================================================================== bench → letter → pets → proposal
  private async benchScene(): Promise<void> {
    const g = this.game;
    const again = g.story.is(S.FREE_ROAM);
    if (!g.story.go(S.BENCH_CINEMATIC)) return;
    this.setControl(false);
    g.ui.objective(null);
    g.save.data.checkpoint = 'esplanade';
    g.save.save();
    await g.ui.fade(1, 600);
    if (!this.alive()) return;
    // reset props for (re)playing the finale
    this.zed.root.visible = false;
    this.kooki.root.visible = false;
    this.sign.visible = false;
    this.letter.group.visible = false;
    this.letter.flap.rotation.x = 0;
    this.letter.paper.position.y = 0;
    this.letter.paper.scale.y = 0.6;
    this.scene.attach(this.letter.group);
    this.benchLight.color.set('#ffcf8a');
    this.benchLight.intensity = 5;

    this.seat(this.him, BENCH.x - 0.42, BENCH.z + 0.02, Math.PI);
    this.seat(this.her, BENCH.x + 0.42, BENCH.z + 0.02, Math.PI);
    // flower moves to her left hand so the right hand can catch the letter
    this.holdFlower('L');
    this.her.reachLTarget = this.her.reachL = 0.3;
    this.her.reachRTarget = 0;
    this.him.lookAtPoint(null);
    this.her.lookAtPoint(null);
    g.audio.duck(0.4, 2);
    g.audio.setMusic('tender');
    await g.cam.shot(new THREE.Vector3(BENCH.x - 1.6, 1.75, BENCH.z + 3.2), new THREE.Vector3(BENCH.x + 0.3, 0.85, BENCH.z - 1.2), 0);
    await g.ui.fade(0, 900);
    if (!this.alive()) return;
    await g.tweens.wait(1.2);
    await g.ui.play(again ? DIALOGUE.sitAgain : DIALOGUE.bench);
    if (!this.alive()) return;
    // a quiet moment
    this.her.lookAtPoint(this.him.root.position.clone().setY(1.0));
    await g.tweens.wait(1.4);
    this.him.lookAtPoint(this.her.root.position.clone().setY(1.0));
    await g.tweens.wait(1.6);
    this.her.lookAtPoint(null);
    this.him.lookAtPoint(null);
    await g.tweens.wait(1.0);
    if (!this.alive()) return;

    // ---- the letter arrives, unexpectedly
    g.story.go(S.LETTER_ARRIVAL);
    const flight = this.flyLetter();
    await g.tweens.wait(0.8);
    await g.ui.play(DIALOGUE.letterNotice);
    await flight;
    if (!this.alive()) return;
    this.her.lookAtPoint(this.letterHover);
    this.him.lookAtPoint(this.letterHover);
    await g.cam.shot(new THREE.Vector3(BENCH.x + 1.3, 1.75, BENCH.z - 2.05), new THREE.Vector3(BENCH.x + 0.55, 0.95, BENCH.z), 1.6);
    if (!this.alive()) return;
    g.story.go(S.LETTER_INTERACTION);
    g.ui.objective(OBJECTIVES.letter);
  }

  private async flyLetter(): Promise<void> {
    const g = this.game;
    const L = this.letter.group;
    L.visible = true;
    const p0 = new THREE.Vector3(BENCH.x + 6, 3.6, BENCH.z - 9);
    const p1 = new THREE.Vector3(BENCH.x + 3.6, 3.0, BENCH.z - 2.5);
    const p2 = this.letterHover.clone();
    L.position.copy(p0);
    g.audio.sfx('whoosh');
    const q = new THREE.Vector3();
    await g.tweens.to(
      g.settings.reducedMotion ? 1.8 : 4.2,
      (k) => {
        const a = (1 - k) * (1 - k);
        const b = 2 * (1 - k) * k;
        const c = k * k;
        q.set(a * p0.x + b * p1.x + c * p2.x, a * p0.y + b * p1.y + c * p2.y, a * p0.z + b * p1.z + c * p2.z);
        q.y += Math.sin(k * Math.PI * 3) * 0.12 * (1 - k);
        L.position.copy(q);
        L.rotation.set(-0.5 + Math.sin(k * 7) * 0.15, k * Math.PI * 2.2 + 0.4, Math.sin(k * 5) * 0.25);
        if (Math.random() < 0.6) this.sparkles.emit(L.position, new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.1, (Math.random() - 0.5) * 0.3), 1.0);
      },
      Ease.inOut,
    );
    g.audio.sfx('sparkle');
  }

  private catching = false;

  private async catchLetter(): Promise<void> {
    const g = this.game;
    if (!g.story.is(S.LETTER_INTERACTION) || this.catching) return;
    this.catching = true;
    g.ui.objective(null);
    const L = this.letter.group;
    // she reaches out and catches it
    this.her.reachRTarget = 1.0;
    this.her.lookAtPoint(L.position);
    await g.tweens.wait(0.45);
    const from = L.position.clone();
    const rot0 = L.rotation.clone();
    const hand = new THREE.Vector3();
    await g.tweens.to(0.6, (k) => {
      this.her.handR.getWorldPosition(hand);
      L.position.lerpVectors(from, hand, k);
      L.rotation.set(rot0.x * (1 - k), rot0.y * (1 - k), rot0.z * (1 - k));
    });
    g.audio.sfx('paper');
    this.emitSparkles(L.position, 16, 0.5);
    // hold it up in front of her and open it
    this.her.root.attach(L);
    const lp0 = L.position.clone();
    const lr0 = L.quaternion.clone();
    const target = new THREE.Vector3(0, 0.98, 0.36);
    const tq = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35, Math.PI, 0));
    this.her.reachRTarget = 0;
    this.her.holdTarget = 0.85;
    this.her.lookPitch = 0.3;
    await g.tweens.to(0.7, (k) => {
      L.position.lerpVectors(lp0, target, k);
      L.quaternion.slerpQuaternions(lr0, tq, k);
    });
    this.her.lookYaw = 0;
    this.her.lookPitch = 0.35;
    g.audio.sfx('paper');
    await g.tweens.to(0.6, (k) => (this.letter.flap.rotation.x = -2.7 * k));
    await g.tweens.to(0.6, (k) => {
      this.letter.paper.position.y = 0.17 * k;
      this.letter.paper.scale.y = 0.6 + 0.4 * k;
    });
    if (!this.alive()) return;

    // read at her own pace
    g.story.go(S.LETTER_READING);
    g.ui.controls(false);
    await g.ui.openLetter();
    if (!this.alive()) return;
    g.unlockMemory('letter');

    // close it
    g.story.go(S.LETTER_CLOSING);
    g.audio.sfx('paper');
    await g.tweens.to(0.5, (k) => {
      this.letter.paper.position.y = 0.17 * (1 - k);
      this.letter.paper.scale.y = 1 - 0.4 * k;
    });
    await g.tweens.to(0.5, (k) => (this.letter.flap.rotation.x = -2.7 * (1 - k)));
    const lp1 = L.position.clone();
    await g.tweens.to(0.6, (k) => L.position.lerpVectors(lp1, new THREE.Vector3(0.05, 0.56, 0.3), k));
    this.her.holdTarget = 0.25;
    this.her.lookPitch = 0;
    // let the moment breathe before anything else happens
    await g.tweens.wait(2.2);
    if (!this.alive()) return;
    this.catching = false;
    await this.petsReveal();
  }

  private async petsReveal(): Promise<void> {
    const g = this.game;
    if (!g.story.go(S.PETS_REVEAL)) return;
    const z = this.zed;
    const c = this.kooki;
    z.root.position.set(BENCH.x + 2.2, 0, BENCH.z + 5.6);
    c.root.position.set(BENCH.x + 1.7, 0, BENCH.z + 5.9);
    z.root.visible = true;
    c.root.visible = true;
    z.wag = 0.8;
    c.wag = 0.5;
    const steps = window.setInterval(() => g.audio.sfx('step'), 260);
    await g.tweens.wait(0.6);
    this.her.lookAtPoint(new THREE.Vector3(BENCH.x + 1.6, 0.4, BENCH.z + 1.5));
    const pathZ = [new THREE.Vector3(BENCH.x + 1.55, 0, BENCH.z + 0.8), new THREE.Vector3(BENCH.x + 1.3, 0, BENCH.z - 0.35)];
    const pathC = [new THREE.Vector3(BENCH.x + 1.25, 0, BENCH.z + 0.9), new THREE.Vector3(BENCH.x + 0.95, 0, BENCH.z - 0.85)];
    await Promise.all([this.walkTo(z, pathZ[0], 1.3), this.walkTo(c, pathC[0], 1.25)]);
    if (!this.alive()) return clearInterval(steps);
    this.her.lookAtPoint(pathC[1].clone().setY(0.3));
    this.him.lookAtPoint(pathC[1].clone().setY(0.3));
    await Promise.all([this.walkTo(z, pathZ[1], 1.1), this.walkTo(c, pathC[1], 1.1)]);
    clearInterval(steps);
    if (!this.alive()) return;
    const herHead = this.her.root.position.clone().setY(1.05);
    z.facing = Math.atan2(herHead.x - z.root.position.x, herHead.z - z.root.position.z);
    c.facing = Math.atan2(herHead.x - c.root.position.x, herHead.z - c.root.position.z);
    z.lookAtPoint(herHead);
    c.lookAtPoint(herHead);
    z.wag = 1;
    this.her.facing = Math.PI + 0.35;
    this.her.lookAtPoint(c.root.position.clone().setY(0.3));
    this.him.lookAtPoint(c.root.position.clone().setY(0.3));
    g.unlockMemory('pets');
    await g.cam.shot(new THREE.Vector3(BENCH.x + 3.3, 2.0, BENCH.z - 1.75), new THREE.Vector3(BENCH.x + 0.45, 0.72, BENCH.z - 0.3), 1.6);
    if (!this.alive()) return;

    // Kooki presents a little sign
    this.sign.visible = true;
    this.sign.position.copy(c.root.position).add(new THREE.Vector3(0.3, 0, -0.18));
    this.sign.rotation.y = Math.atan2(g.camera.position.x - this.sign.position.x, g.camera.position.z - this.sign.position.z);
    this.sign.scale.setScalar(0.01);
    g.audio.sfx('pop');
    c.hop = 0;
    await g.tweens.to(0.6, (k) => {
      this.sign.scale.setScalar(0.01 + k * 0.99);
      c.hop = Math.sin(k * Math.PI) * 0.08;
    }, Ease.outBack);

    g.story.go(S.PROPOSAL_DIALOGUE);
    await g.ui.play(DIALOGUE.pets, {
      anchors: {
        zed: () => z.root.position.clone().add(new THREE.Vector3(0, 0.78, 0)),
        kooki: () => c.root.position.clone().add(new THREE.Vector3(0, 0.66, 0)),
      },
    });
    if (!this.alive()) return;
    g.story.go(S.PROPOSAL_RESPONSE);
    const answer = await g.ui.proposal(PROPOSAL.question, PROPOSAL.yes, PROPOSAL.talk);
    if (!this.alive()) return;
    g.save.data.proposalComplete = true;
    g.save.data.answer = answer;
    if (answer === 'yes') await this.yesEnding();
    else await this.talkEnding();
  }

  private async yesEnding(): Promise<void> {
    const g = this.game;
    g.story.go(S.EPILOGUE);
    g.save.data.gardenUnlocked = true;
    g.save.save();
    g.audio.setMusic('joy');
    g.audio.sfx('sparkle');
    // turn toward each other
    this.him.facing = Math.PI - 0.55;
    this.her.facing = Math.PI + 0.55;
    this.him.lookAtPoint(this.her.root.position.clone().setY(1.05));
    this.her.lookAtPoint(this.him.root.position.clone().setY(1.05));
    this.benchLight.color.set('#c7a6ff');
    this.zed.wag = 1;
    this.kooki.wag = 1;
    const p = new THREE.Vector3();
    this.sunflower.head.getWorldPosition(p);
    this.emitSparkles(p, 30, 1.0);
    const petalBurst = () => {
      for (let i = 0; i < 6; i++) {
        const o = new THREE.Vector3(BENCH.x + (Math.random() - 0.5) * 3, 2.6 + Math.random(), BENCH.z + (Math.random() - 0.5) * 2);
        this.petals.emit(o, new THREE.Vector3((Math.random() - 0.5) * 0.6, -0.2, (Math.random() - 0.5) * 0.6), 4);
      }
    };
    const iv = window.setInterval(petalBurst, 120);
    await g.tweens.to(2.4, (k) => {
      this.benchLight.intensity = 5 + k * 5;
      this.zed.hop = Math.abs(Math.sin(k * Math.PI * 4)) * 0.12;
      this.kooki.hop = Math.abs(Math.sin(k * Math.PI * 3 + 1)) * 0.08;
    }, Ease.linear);
    this.zed.hop = 0;
    this.kooki.hop = 0;
    await g.cam.shot(new THREE.Vector3(BENCH.x + 0.5, 1.75, BENCH.z - 2.9), new THREE.Vector3(BENCH.x + 0.4, 0.75, BENCH.z), 2.2);
    setTimeout(() => clearInterval(iv), 3000);
    if (!this.alive()) return clearInterval(iv);
    const choice = await g.ui.ending(PROPOSAL.yesTitle, PROPOSAL.yesMessage, [
      { id: 'garden', label: 'Visit the Memory Garden', primary: true },
      { id: 'replay', label: 'Play again' },
    ]);
    clearInterval(iv);
    if (!this.alive()) return;
    await g.ui.fade(1, 700);
    if (choice === 'garden') {
      g.story.go(S.MEMORY_GARDEN);
      g.save.data.checkpoint = 'garden';
      g.save.save();
      await g.switchTo('garden');
    } else {
      g.story.reset();
      await g.begin('start');
    }
  }

  private async talkEnding(): Promise<void> {
    const g = this.game;
    g.story.go(S.FREE_ROAM);
    g.save.save();
    this.zed.wag = 0.35;
    this.kooki.wag = 0.25;
    this.her.lookAtPoint(this.him.root.position.clone().setY(1.05));
    this.him.lookAtPoint(this.her.root.position.clone().setY(1.05));
    const choice = await g.ui.ending('', PROPOSAL.talkMessage, [
      { id: 'stay', label: 'Stay by the river', primary: true },
      { id: 'title', label: 'Back to the title screen' },
    ]);
    if (!this.alive()) return;
    if (choice === 'title') {
      await g.ui.fade(1, 600);
      await g.showTitle();
      return;
    }
    await g.ui.fade(1, 500);
    if (!this.alive()) return;
    this.letter.group.visible = false;
    this.sign.visible = false;
    this.her.holdTarget = this.her.hold = 0;
    this.stand(this.him, BENCH.x - 0.6, BENCH.z + 1.1, 0);
    this.stand(this.her, BENCH.x + 0.3, BENCH.z + 1.2, 0);
    this.holdFlower('R');
    this.her.reachLTarget = 0;
    this.her.reachRTarget = 0.4;
    this.zed.root.position.set(BENCH.x + 1.5, 0, BENCH.z + 0.3);
    this.kooki.root.position.set(BENCH.x + 1.9, 0, BENCH.z + 0.7);
    this.zed.facing = -Math.PI / 2;
    this.kooki.facing = -Math.PI / 2;
    this.zed.lookAtPoint(null);
    this.kooki.lookAtPoint(null);
    g.audio.duck(1, 1);
    g.audio.setMusic('market');
    g.cam.snap(this.him.root.position, 0.2, 0.34);
    await g.ui.fade(0, 600);
    this.setControl(true);
    this.updateObjective();
  }

  // =================================================================== update
  update(dt: number): void {
    super.update(dt);
    this.t += dt;
    const g = this.game;
    const rm = g.settings.reducedMotion;
    this.water.uniforms.uTime.value = this.t;
    (this.water.uniforms.uCam.value as THREE.Vector3).copy(g.camera.position);

    if (this.mode === 'title') {
      this.titleT += dt;
      const x = -12 + Math.sin(this.titleT * 0.045) * 14;
      g.cam.setManual(new THREE.Vector3(x, 2.6, -9.6), new THREE.Vector3(x + 5, 1.0, 3));
    }

    for (const v of this.vendors) {
      v.reachRTarget = 0.35 + Math.sin(this.t * 2 + v.root.position.x) * 0.2;
      v.update(dt, rm);
    }
    for (const e of this.extras) e.update(dt, rm);

    if (this.him) {
      if (this.follower.enabled && this.control) this.follower.update(dt, this.area);
      this.him.update(dt, rm);
      this.her.update(dt, rm);
      this.zed.update(dt, rm);
      this.kooki.update(dt, rm);
      if (g.story.is(S.LETTER_INTERACTION)) {
        const L = this.letter.group;
        L.position.set(this.letterHover.x, this.letterHover.y + Math.sin(this.t * 2.2) * 0.07, this.letterHover.z);
        L.rotation.set(-0.15, 0.5 + Math.sin(this.t * 1.3) * 0.35, Math.sin(this.t * 1.7) * 0.12);
        if (Math.random() < 0.25) this.sparkles.emit(L.position, new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.25, (Math.random() - 0.5) * 0.3), 0.9);
      }
      if (g.story.is(S.EPILOGUE) && Math.random() < 0.2) {
        const p = new THREE.Vector3();
        this.sunflower.head.getWorldPosition(p);
        this.sparkles.emit(p, new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.4, (Math.random() - 0.5) * 0.4), 1.2);
      }
    }

    const avoid = this.him ? [this.him.root.position, this.her.root.position] : [];
    this.crowd.update(dt, avoid, rm);

    if (dt > 0 && !g.settings.lowEffects) {
      for (const s of this.steamSources) {
        if (Math.random() < 0.35) {
          this.steam.emit(
            new THREE.Vector3(s.x + (Math.random() - 0.5) * 0.4, s.y, s.z + (Math.random() - 0.5) * 0.3),
            new THREE.Vector3((Math.random() - 0.5) * 0.1, 0.45 + Math.random() * 0.3, (Math.random() - 0.5) * 0.1),
            1.6,
          );
        }
      }
    }
    if (dt > 0) {
      const sp = new THREE.Vector3();
      for (const o of this.steamObjs) {
        if (Math.random() < (this.eating ? 0.3 : 0.15)) {
          o.getWorldPosition(sp);
          sp.y += 0.14;
          this.steam.emit(sp, new THREE.Vector3((Math.random() - 0.5) * 0.05, 0.3 + Math.random() * 0.2, (Math.random() - 0.5) * 0.05), 1.0);
        }
      }
    }
    if (this.eating && this.him) {
      this.him.reachRTarget = 0.45 + Math.max(0, Math.sin(this.t * 2.2)) * 0.35;
      this.her.reachRTarget = 0.45 + Math.max(0, Math.sin(this.t * 2.2 + 2.0)) * 0.35;
    }
    this.steam.update(dt);
    this.sparkles.update(dt);
    this.petals.update(dt);
  }

  /** Floor height under the bench (for external tools/tests). */
  static benchSeat(): number {
    return BENCH_SEAT_Y;
  }
}
