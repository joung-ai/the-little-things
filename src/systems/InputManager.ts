/**
 * Keyboard + touch joystick + drag-to-look input.
 * Movement is a 2D vector (x = right, y = forward) in camera space.
 */
export class InputManager {
  move = { x: 0, y: 0 };
  look = { dx: 0, dy: 0 };
  enabled = true;
  isTouch = false;

  onInteract: () => void = () => {};
  onJournal: () => void = () => {};
  onEscape: () => void = () => {};
  onAdvance: () => void = () => {};

  private keys = new Set<string>();
  private joy = { active: false, id: -1, cx: 0, cy: 0, x: 0, y: 0 };
  private drag = { active: false, id: -1, x: 0, y: 0 };

  constructor(
    private canvas: HTMLCanvasElement,
    private joyBase: HTMLElement,
    private joyKnob: HTMLElement,
  ) {
    window.addEventListener('keydown', (e) => this.keyDown(e));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    const markTouch = () => {
      if (!this.isTouch) {
        this.isTouch = true;
        document.body.classList.add('touch');
      }
    };
    if (matchMedia('(pointer: coarse)').matches) markTouch();
    window.addEventListener('touchstart', markTouch, { passive: true });

    // Joystick
    joyBase.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      markTouch();
      const r = joyBase.getBoundingClientRect();
      this.joy = { active: true, id: e.pointerId, cx: r.left + r.width / 2, cy: r.top + r.height / 2, x: 0, y: 0 };
      joyBase.setPointerCapture(e.pointerId);
      this.updateJoy(e.clientX, e.clientY);
    });
    joyBase.addEventListener('pointermove', (e) => {
      if (this.joy.active && e.pointerId === this.joy.id) this.updateJoy(e.clientX, e.clientY);
    });
    const endJoy = (e: PointerEvent) => {
      if (e.pointerId !== this.joy.id) return;
      this.joy.active = false;
      this.joy.x = this.joy.y = 0;
      this.joyKnob.style.transform = 'translate(-50%, -50%)';
    };
    joyBase.addEventListener('pointerup', endJoy);
    joyBase.addEventListener('pointercancel', endJoy);

    // Drag to look (mouse or touch on the canvas)
    canvas.addEventListener('pointerdown', (e) => {
      if (this.drag.active) return;
      this.drag = { active: true, id: e.pointerId, x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.drag.active || e.pointerId !== this.drag.id) return;
      this.look.dx += e.clientX - this.drag.x;
      this.look.dy += e.clientY - this.drag.y;
      this.drag.x = e.clientX;
      this.drag.y = e.clientY;
    });
    const endDrag = (e: PointerEvent) => {
      if (e.pointerId === this.drag.id) this.drag.active = false;
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
  }

  private updateJoy(px: number, py: number): void {
    const max = 46;
    let dx = px - this.joy.cx;
    let dy = py - this.joy.cy;
    const len = Math.hypot(dx, dy);
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    this.joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    this.joy.x = dx / max;
    this.joy.y = -dy / max;
  }

  private keyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) return;
    if (e.repeat) {
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) return;
    }
    this.keys.add(e.code);
    switch (e.code) {
      case 'KeyE':
        if (!e.repeat) this.onInteract();
        break;
      case 'Space':
      case 'Enter':
        if (!e.repeat && !(target && target.tagName === 'BUTTON')) {
          this.onAdvance();
          e.preventDefault();
        }
        break;
      case 'KeyJ':
        if (!e.repeat) this.onJournal();
        break;
      case 'Escape':
        if (!e.repeat) this.onEscape();
        break;
    }
    if (e.code.startsWith('Arrow')) e.preventDefault();
  }

  /** Called once per frame. */
  poll(): void {
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.joy.active) {
      x += this.joy.x;
      y += this.joy.y;
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    if (!this.enabled) {
      x = 0;
      y = 0;
    }
    this.move.x = x;
    this.move.y = y;
  }

  consumeLook(): { dx: number; dy: number } {
    const l = { dx: this.look.dx, dy: this.look.dy };
    this.look.dx = 0;
    this.look.dy = 0;
    return l;
  }

  clear(): void {
    this.keys.clear();
    this.joy.active = false;
    this.joy.x = this.joy.y = 0;
    this.joyKnob.style.transform = 'translate(-50%, -50%)';
  }
}
