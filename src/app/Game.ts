import * as THREE from 'three';
import { LETTER } from '../data/letter';
import { MEMORIES, type MemoryId } from '../data/memories';
import { RENDER } from '../data/settings';
import { S } from '../data/story';
import type { BaseScene } from '../scenes/BaseScene';
import { EsplanadeScene } from '../scenes/EsplanadeScene';
import { LRTScene } from '../scenes/LRTScene';
import { MemoryGardenScene } from '../scenes/MemoryGardenScene';
import { AudioManager } from '../systems/AudioManager';
import { Autopilot } from '../systems/Autopilot';
import { CameraController } from '../systems/CameraController';
import { InputManager } from '../systems/InputManager';
import { InteractionManager } from '../systems/InteractionManager';
import { SaveManager, type Settings } from '../systems/SaveManager';
import { Tweens } from '../systems/Tweens';
import { UI } from '../ui/UI';
import { GameState } from './GameState';
import { AssetManager } from './AssetManager';

export type SceneKind = 'title' | 'lrt' | 'esplanade' | 'garden';

export class Game {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  cam: CameraController;
  tweens = new Tweens();
  input: InputManager;
  interactions = new InteractionManager();
  audio = new AudioManager();
  save = new SaveManager();
  assets = new AssetManager();
  story = new GameState();
  ui = new UI();
  scene: BaseScene | null = null;
  paused = false;
  autopilot: Autopilot | null = null;
  devMode = new URLSearchParams(location.search).has('dev') || location.hash.startsWith('#autoplay') || location.hash === '#dev';
  private last = 0;
  private running = false;
  private raf = 0;
  private fpsAcc = 0;
  private fpsN = 0;
  private fps = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
    this.cam = new CameraController(this.camera, this.tweens);
    this.input = new InputManager(canvas, document.getElementById('joystick')!, document.getElementById('joy-knob')!);

    this.save.load();
    this.autopilot = Autopilot.fromHash(this);
    this.applySettings(this.save.data.settings);

    // input wiring
    this.input.onInteract = () => this.act();
    this.input.onAdvance = () => {
      if (this.ui.dialogueActive) this.ui.advance();
    };
    this.input.onJournal = () => this.toggleJournal();
    this.input.onEscape = () => {
      if (this.ui.isPanelOpen('journal')) this.toggleJournal();
      else if (this.story.state !== S.TITLE) this.toggleMenu();
    };
    this.ui.onAction = () => this.act();
    this.ui.onJournalToggle = () => this.toggleJournal();
    this.ui.onMenuToggle = () => this.toggleMenu();
    this.interactions.onChange = (it) => {
      const verb = it ? it.prompt : null;
      this.ui.prompt(verb);
    };
    this.ui.bindSettings(this.save.data.settings, (s) => {
      this.applySettings(s);
      this.save.save();
    });
    this.bindMenu();

    const checkHash = () => {
      if (!this.autopilot) {
        this.autopilot = Autopilot.fromHash(this);
        if (this.autopilot) this.devMode = true;
      }
    };
    window.addEventListener('hashchange', checkHash);
    setInterval(checkHash, 1000);
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stopLoop();
        this.audio.suspend();
      } else {
        this.audio.resume();
        this.startLoop();
      }
    });
    this.resize();
  }

  applySettings(s: Settings): void {
    this.audio.applySettings(s);
    this.cam.reducedMotion = s.reducedMotion;
    this.ui.reducedMotion = s.reducedMotion;
    document.body.classList.toggle('reduced-motion', s.reducedMotion);
    const mobile = matchMedia('(pointer: coarse)').matches;
    const cap = s.lowEffects ? 1 : mobile ? RENDER.maxPixelRatioMobile : RENDER.maxPixelRatioDesktop;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    this.resize();
  }

  get settings(): Settings {
    return this.save.data.settings;
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const portrait = h > w;
    this.camera.fov = portrait ? 68 : 52;
    this.cam.distance = (this.scene?.camDistance ?? 4.4) * (portrait ? 1.22 : 1);
    this.camera.updateProjectionMatrix();
    this.updateRotateHint();
  }

  updateRotateHint(): void {
    const portrait = window.innerHeight > window.innerWidth;
    const playing = this.story.state !== S.TITLE;
    this.ui.rotateHint(this.input.isTouch && portrait && playing);
  }

  // ------------------------------------------------------------- loop
  startLoop(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(tick);
      const dt = Math.min(0.066, (now - this.last) / 1000);
      this.last = now;
      this.frame(dt);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stopLoop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private frame(dt: number): void {
    const s = this.scene;
    if (!s) return;
    const step = this.paused ? 0 : dt;
    this.input.poll();
    this.input.enabled = s.control && !this.ui.dialogueActive && !this.paused;
    this.tweens.update(step);
    if (this.autopilot && !this.paused) this.autopilot.update(dt);
    s.update(step);
    const look = this.paused || this.ui.dialogueActive && this.cam.mode !== 'follow' ? { dx: 0, dy: 0 } : this.input.consumeLook();
    this.cam.update(step, s.player ? s.player.root.position : null, look);
    this.interactions.locked = this.ui.dialogueActive || this.paused || this.ui.letterOpen;
    this.interactions.update(step, s.player ? s.player.root.position : null);
    this.renderer.render(s.scene, this.camera);
    this.ui.updateBubbles(this.camera);
    if (this.devMode) {
      this.fpsAcc += dt;
      this.fpsN++;
      if (this.fpsAcc > 0.5) {
        this.fps = this.fpsN / this.fpsAcc;
        this.fpsAcc = 0;
        this.fpsN = 0;
        const info = this.renderer.info.render;
        this.ui.dev(`${this.fps.toFixed(0)} fps · ${info.calls} calls · ${(info.triangles / 1000).toFixed(1)}k tris · ${this.story.state}`);
      }
    }
  }

  // ------------------------------------------------------------- scenes
  async switchTo(kind: SceneKind): Promise<void> {
    this.tweens.clear();
    this.interactions.clear();
    this.input.clear();
    if (this.scene) this.scene.dispose();
    this.scene = null;
    this.cam.bounds = null;
    this.cam.sway = 0;
    let next: BaseScene;
    if (kind === 'lrt') next = new LRTScene(this);
    else if (kind === 'garden') next = new MemoryGardenScene(this);
    else next = new EsplanadeScene(this, kind === 'title' ? 'title' : 'play');
    next.build();
    this.scene = next;
    this.cam.bounds = next.camBounds;
    this.resize();
    this.startLoop();
    await next.start();
  }

  // ------------------------------------------------------------- flow
  async showTitle(): Promise<void> {
    if (this.story.state !== S.TITLE) this.story.reset();
    this.ui.hud(false);
    await this.switchTo('title');
    const d = this.save.data;
    this.ui.showTitle({
      canContinue: d.checkpoint === 'esplanade',
      garden: d.gardenUnlocked,
      placeholder: LETTER.isPlaceholder,
    });
    this.ui.loading(false);
    this.updateRotateHint();
    await this.ui.fade(0, 900);
  }

  async begin(from: 'start' | 'continue' | 'garden'): Promise<void> {
    this.audio.unlock(this.settings);
    this.audio.sfx('select');
    await this.ui.fade(1, 600);
    this.ui.hideTitle();
    if (from === 'start') {
      this.save.restartStory();
      this.story.go(S.LRT_INTRO);
      this.save.data.checkpoint = 'lrt';
      this.save.save();
      await this.switchTo('lrt');
    } else if (from === 'continue') {
      this.story.go(S.ESPLANADE_EXPLORATION);
      await this.switchTo('esplanade');
    } else {
      this.story.go(S.MEMORY_GARDEN);
      await this.switchTo('garden');
    }
    this.updateRotateHint();
  }

  unlockMemory(id: MemoryId): void {
    if (this.save.unlock(id)) {
      const m = MEMORIES.find((x) => x.id === id)!;
      this.ui.toast(m);
      this.audio.sfx('pop');
    }
  }

  act(): void {
    if (this.paused) return;
    if (this.ui.dialogueActive) {
      this.ui.advance();
      return;
    }
    if (this.interactions.trigger()) this.audio.sfx('chime');
  }

  toggleJournal(): void {
    if (this.story.state === S.TITLE) return;
    if (this.ui.isPanelOpen('menu')) this.ui.setPanel('menu', false);
    const open = !this.ui.isPanelOpen('journal');
    if (open) this.ui.renderJournal(this.save.data.memories);
    this.ui.setPanel('journal', open);
    this.paused = open;
    this.audio.sfx('select');
  }

  toggleMenu(): void {
    if (this.ui.isPanelOpen('journal')) this.ui.setPanel('journal', false);
    const open = !this.ui.isPanelOpen('menu');
    this.ui.setPanel('menu', open);
    this.paused = open;
    const restart = document.getElementById('btn-restart')!;
    restart.textContent = 'Restart story';
    restart.dataset.confirm = '';
    document.getElementById('btn-menu-garden')!.hidden = !this.save.data.gardenUnlocked;
  }

  private bindMenu(): void {
    document.getElementById('btn-resume')!.addEventListener('click', () => this.toggleMenu());
    const restart = document.getElementById('btn-restart')!;
    restart.addEventListener('click', async () => {
      if (!restart.dataset.confirm) {
        restart.dataset.confirm = '1';
        restart.textContent = 'Tap again to restart';
        return;
      }
      this.toggleMenu();
      await this.ui.fade(1, 500);
      this.story.reset();
      await this.begin('start');
    });
    document.getElementById('btn-title')!.addEventListener('click', async () => {
      this.toggleMenu();
      await this.ui.fade(1, 500);
      await this.showTitle();
    });
    document.getElementById('btn-menu-garden')!.addEventListener('click', async () => {
      this.toggleMenu();
      await this.ui.fade(1, 500);
      this.story.reset();
      await this.begin('garden');
    });
    document.getElementById('btn-start')!.addEventListener('click', () => this.begin('start'));
    document.getElementById('btn-continue')!.addEventListener('click', () => this.begin('continue'));
    document.getElementById('btn-garden')!.addEventListener('click', () => this.begin('garden'));
  }
}
