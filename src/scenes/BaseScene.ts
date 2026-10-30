import * as THREE from 'three';
import type { Game } from '../app/Game';
import { disposeTree } from '../art/materials';
import type { Character } from '../characters/CharacterFactory';
import { PlayerController, type WalkArea } from '../characters/PlayerController';
import type { CamBounds } from '../systems/CameraController';

export abstract class BaseScene {
  scene = new THREE.Scene();
  area: WalkArea = { bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 }, colliders: [] };
  camBounds: CamBounds | null = null;
  player: Character | null = null;
  controller: PlayerController | null = null;
  /** true when the player may walk */
  control = false;
  camDistance = 4.4;
  private wasControl = false;
  protected gen: number;

  constructor(public game: Game) {
    this.gen = game.tweens.generation;
  }

  abstract build(): void;
  abstract start(): Promise<void> | void;

  /** Returns false if this scene was replaced (stop running cutscene code). */
  protected alive(): boolean {
    return this.game.scene === this && this.game.tweens.generation === this.gen;
  }

  setPlayer(ch: Character): void {
    this.player = ch;
    this.controller = new PlayerController(ch);
  }

  update(dt: number): void {
    if (this.player && this.controller) {
      if (this.control) this.controller.update(dt, this.game.input, this.game.cam, this.area, true);
      else if (this.wasControl) this.controller.stop();
    }
    this.wasControl = this.control;
  }

  dispose(): void {
    disposeTree(this.scene);
    this.scene.clear();
  }
}
