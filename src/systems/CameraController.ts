import * as THREE from 'three';
import { Ease, Tweens } from './Tweens';

export interface CamBounds {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

/**
 * Third-person follow camera with drag-to-rotate, bounds clamping and
 * scripted cinematic shots that blend smoothly in and out.
 */
export class CameraController {
  yaw = 0;
  pitch = 0.36;
  distance = 4.4;
  minPitch = 0.08;
  maxPitch = 0.95;
  height = 1.05;
  mode: 'follow' | 'shot' = 'follow';
  bounds: CamBounds | null = null;
  sway = 0;
  reducedMotion = false;

  private focus = new THREE.Vector3();
  private lookAt = new THREE.Vector3();
  private desired = new THREE.Vector3();
  private time = 0;
  private first = true;

  constructor(public camera: THREE.PerspectiveCamera, private tweens: Tweens) {}

  /** Snap immediately behind a point (used on scene enter). */
  snap(pos: THREE.Vector3, yaw: number, pitch = this.pitch): void {
    this.yaw = yaw;
    this.pitch = pitch;
    this.mode = 'follow';
    this.focus.copy(pos).add(new THREE.Vector3(0, this.height, 0));
    this.computeDesired(this.focus);
    this.camera.position.copy(this.desired);
    this.lookAt.copy(this.focus);
    this.camera.lookAt(this.lookAt);
    this.first = false;
  }

  private computeDesired(focus: THREE.Vector3): void {
    const cp = Math.cos(this.pitch);
    this.desired.set(
      focus.x + Math.sin(this.yaw) * cp * this.distance,
      focus.y + Math.sin(this.pitch) * this.distance,
      focus.z + Math.cos(this.yaw) * cp * this.distance,
    );
    if (this.bounds) {
      this.desired.clamp(this.bounds.min, this.bounds.max);
    }
  }

  update(dt: number, followPos: THREE.Vector3 | null, look: { dx: number; dy: number }): void {
    this.time += dt;
    if (this.mode === 'follow' && followPos) {
      this.yaw -= look.dx * 0.0065;
      this.pitch = THREE.MathUtils.clamp(this.pitch + look.dy * 0.004, this.minPitch, this.maxPitch);
      const target = new THREE.Vector3(followPos.x, followPos.y + this.height, followPos.z);
      if (this.first) {
        this.focus.copy(target);
        this.first = false;
      }
      const k = 1 - Math.exp(-dt * 10);
      this.focus.lerp(target, k);
      this.computeDesired(this.focus);
      const kc = 1 - Math.exp(-dt * 7);
      this.camera.position.lerp(this.desired, kc);
      this.lookAt.lerp(this.focus, 1 - Math.exp(-dt * 12));
    }
    this.camera.lookAt(this.lookAt);
    if (this.sway > 0 && !this.reducedMotion) {
      const s = this.sway;
      this.camera.rotateZ(Math.sin(this.time * 1.7) * 0.004 * s);
      this.camera.position.y += Math.sin(this.time * 9.3) * 0.0016 * s;
    }
  }

  /** Blend to a fixed cinematic shot. */
  async shot(pos: THREE.Vector3, look: THREE.Vector3, dur = 1.6): Promise<void> {
    this.mode = 'shot';
    const p0 = this.camera.position.clone();
    const l0 = this.lookAt.clone();
    if (dur <= 0 || this.reducedMotion) {
      this.camera.position.copy(pos);
      this.lookAt.copy(look);
      return;
    }
    await this.tweens.to(
      dur,
      (k) => {
        this.camera.position.lerpVectors(p0, pos, k);
        this.lookAt.lerpVectors(l0, look, k);
      },
      Ease.inOut,
    );
  }

  /** Directly place the camera (title-screen fly-over). */
  setManual(pos: THREE.Vector3, look: THREE.Vector3): void {
    this.mode = 'shot';
    this.camera.position.copy(pos);
    this.lookAt.copy(look);
  }

  /** Return to follow mode, keeping the current viewing direction. */
  release(followPos: THREE.Vector3): void {
    const dx = this.camera.position.x - followPos.x;
    const dz = this.camera.position.z - followPos.z;
    this.yaw = Math.atan2(dx, dz);
    this.focus.set(followPos.x, followPos.y + this.height, followPos.z);
    this.mode = 'follow';
  }

  /** Movement basis in world space for a camera-relative input vector. */
  moveVector(input: { x: number; y: number }, out: THREE.Vector3): THREE.Vector3 {
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const rx = -fz;
    const rz = fx;
    out.set(fx * input.y + rx * input.x, 0, fz * input.y + rz * input.x);
    return out;
  }
}
