import * as THREE from 'three';
import type { DialogueLine, Speaker } from '../data/dialogue';
import { LETTER } from '../data/letter';
import { MEMORIES, type Memory, type MemoryId } from '../data/memories';
import { NAMES } from '../data/settings';
import type { Settings } from '../systems/SaveManager';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface DialogueOpts {
  onCue?: (cue: string) => Promise<void> | void;
  /** speakers listed here talk through a speech bubble anchored in 3D */
  anchors?: Partial<Record<Speaker, () => THREE.Vector3>>;
}

interface Bubble {
  el: HTMLElement;
  anchor: () => THREE.Vector3;
}

export class UI {
  dialogueActive = false;
  reducedMotion = false;
  isTouch = false;
  private advanceResolve: (() => void) | null = null;
  private typing: { full: string; el: HTMLElement; timer: number } | null = null;
  private bubbles: Bubble[] = [];
  private v = new THREE.Vector3();

  onJournalToggle: () => void = () => {};
  onMenuToggle: () => void = () => {};
  onAction: () => void = () => {};

  constructor() {
    $('btn-journal').addEventListener('click', () => this.onJournalToggle());
    $('btn-menu').addEventListener('click', () => this.onMenuToggle());
    $('btn-action').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.dialogueActive) this.advance();
      else this.onAction();
    });
    $('prompt').addEventListener('click', () => this.onAction());
    $('dialogue').addEventListener('click', () => this.advance());
    $('tap-catcher').addEventListener('click', () => this.advance());
    $('rotate-close').addEventListener('click', () => {
      $('rotate-hint').hidden = true;
      this.rotateDismissed = true;
    });
    for (const el of document.querySelectorAll<HTMLElement>('[data-close]')) {
      el.addEventListener('click', () => {
        const ov = el.closest('.overlay') as HTMLElement | null;
        if (ov?.id === 'journal') this.onJournalToggle();
        else if (ov?.id === 'menu') this.onMenuToggle();
        else if (ov) ov.hidden = true;
      });
    }
  }

  rotateDismissed = false;

  // ---------------------------------------------------------------- screens
  loading(show: boolean, text?: string): void {
    $('loading').hidden = !show;
    if (text) $('loading-text').textContent = text;
  }

  error(msg: string): void {
    $('loading').hidden = false;
    $('loading-text').textContent = 'Something went wrong';
    const e = $('error-text');
    e.hidden = false;
    e.textContent = msg;
  }

  showTitle(opts: { canContinue: boolean; garden: boolean; placeholder: boolean }): void {
    $('title').hidden = false;
    $('hud').hidden = true;
    $('btn-continue').hidden = !opts.canContinue;
    $('btn-garden').hidden = !opts.garden;
    $('placeholder-note').hidden = !opts.placeholder;
    $('btn-start').textContent = opts.canContinue ? 'Start over' : 'Begin';
  }

  hideTitle(): void {
    $('title').hidden = true;
  }

  hud(show: boolean): void {
    $('hud').hidden = !show;
  }

  controls(show: boolean): void {
    document.body.classList.toggle('no-controls', !show);
  }

  objective(text: string | null): void {
    const el = $('objective');
    el.hidden = !text;
    if (text) $('objective-text').textContent = text;
  }

  prompt(text: string | null): void {
    const p = $('prompt');
    const a = $('btn-action');
    if (!text) {
      p.hidden = true;
      a.hidden = true;
      a.classList.remove('ready');
      return;
    }
    $('prompt-text').textContent = text;
    $('action-label').textContent = text;
    p.hidden = false;
    a.hidden = false;
    a.classList.add('ready');
  }

  rotateHint(show: boolean): void {
    $('rotate-hint').hidden = !show || this.rotateDismissed;
  }

  // ---------------------------------------------------------------- fades & cards
  async fade(to: number, ms = 700): Promise<void> {
    const f = $('fade');
    f.style.transitionDuration = `${ms}ms`;
    f.style.opacity = String(to);
    f.style.pointerEvents = to > 0.5 ? 'auto' : 'none';
    await sleep(ms + 30);
  }

  async chapter(eyebrow: string, title: string, holdMs = 2200): Promise<void> {
    const c = $('chapter');
    $('chapter-eyebrow').textContent = eyebrow;
    $('chapter-title').textContent = title;
    c.hidden = false;
    c.classList.remove('show');
    void c.offsetWidth;
    c.classList.add('show');
    await sleep(holdMs);
    c.classList.remove('show');
    await sleep(600);
    c.hidden = true;
  }

  toast(memory: Memory): void {
    const t = $('toast');
    $('toast-title').textContent = memory.title;
    t.hidden = false;
    t.classList.remove('show');
    void t.offsetWidth;
    t.classList.add('show');
    clearTimeout((t as unknown as { _h: number })._h);
    (t as unknown as { _h: number })._h = window.setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => (t.hidden = true), 500);
    }, 3200);
  }

  // ---------------------------------------------------------------- dialogue
  advance(): void {
    if (this.typing) {
      clearInterval(this.typing.timer);
      this.typing.el.textContent = this.typing.full;
      this.typing = null;
      return;
    }
    const r = this.advanceResolve;
    this.advanceResolve = null;
    r?.();
  }

  private waitAdvance(): Promise<void> {
    return new Promise((r) => (this.advanceResolve = r));
  }

  private type(el: HTMLElement, text: string): void {
    if (this.typing) clearInterval(this.typing.timer);
    if (this.reducedMotion) {
      el.textContent = text;
      this.typing = null;
      return;
    }
    el.textContent = '';
    let i = 0;
    const timer = window.setInterval(() => {
      i += 2;
      el.textContent = text.slice(0, i);
      if (i >= text.length) {
        clearInterval(timer);
        this.typing = null;
      }
    }, 34);
    this.typing = { full: text, el, timer };
  }

  speakerName(s: Speaker): string {
    switch (s) {
      case 'him':
        return NAMES.protagonist;
      case 'her':
        return NAMES.girl;
      case 'zed':
        return NAMES.dog;
      case 'kooki':
        return NAMES.cat;
      default:
        return '';
    }
  }

  async play(lines: DialogueLine[], opts: DialogueOpts = {}): Promise<void> {
    this.dialogueActive = true;
    $('tap-catcher').hidden = false;
    document.body.classList.add('in-dialogue');
    for (const line of lines) {
      const anchor = opts.anchors?.[line.speaker];
      if (anchor) {
        const b = this.addBubble(line.speaker, anchor);
        $('dialogue').hidden = true;
        this.type(b.querySelector('p')!, line.text);
        await this.waitAdvance();
        this.removeBubbles();
      } else {
        const box = $('dialogue');
        box.hidden = false;
        box.dataset.speaker = line.speaker;
        const name = this.speakerName(line.speaker);
        const sp = $('dlg-speaker');
        sp.hidden = !name;
        sp.textContent = name;
        this.type($('dlg-text'), line.text);
        await this.waitAdvance();
      }
      if (line.cue && opts.onCue) {
        $('dialogue').hidden = true;
        await opts.onCue(line.cue);
      }
    }
    $('dialogue').hidden = true;
    $('tap-catcher').hidden = true;
    document.body.classList.remove('in-dialogue');
    this.dialogueActive = false;
  }

  private addBubble(speaker: Speaker, anchor: () => THREE.Vector3): HTMLElement {
    const el = document.createElement('div');
    el.className = `bubble bubble-${speaker}`;
    el.innerHTML = `<span class="bubble-name"></span><p></p><span class="bubble-next">tap ▾</span>`;
    el.querySelector('.bubble-name')!.textContent = this.speakerName(speaker);
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.advance();
    });
    $('bubbles').appendChild(el);
    this.bubbles.push({ el, anchor });
    return el;
  }

  private removeBubbles(): void {
    for (const b of this.bubbles) b.el.remove();
    this.bubbles = [];
  }

  /** Called every frame to keep speech bubbles attached to their speakers. */
  updateBubbles(camera: THREE.Camera): void {
    if (!this.bubbles.length) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (const b of this.bubbles) {
      this.v.copy(b.anchor()).project(camera);
      const bw = b.el.offsetWidth;
      const bh = b.el.offsetHeight;
      let x = (this.v.x * 0.5 + 0.5) * w - bw / 2;
      let y = (-this.v.y * 0.5 + 0.5) * h - bh - 14;
      x = THREE.MathUtils.clamp(x, 12, w - bw - 12);
      y = THREE.MathUtils.clamp(y, 64, h - bh - 12);
      b.el.style.transform = `translate(${x}px, ${y}px)`;
    }
  }

  // ---------------------------------------------------------------- letter
  openLetter(): Promise<void> {
    const body = $('letter-body');
    body.innerHTML = '';
    const add = (tag: string, cls: string, text: string) => {
      const el = document.createElement(tag);
      el.className = cls;
      el.textContent = text;
      body.appendChild(el);
    };
    add('p', 'letter-greeting', LETTER.greeting);
    for (const p of LETTER.paragraphs) add('p', 'letter-p', p);
    add('p', 'letter-closing', LETTER.closing);
    add('p', 'letter-sign', LETTER.signature);
    const ov = $('letter');
    ov.hidden = false;
    ov.classList.remove('show');
    void ov.offsetWidth;
    ov.classList.add('show');
    body.scrollTop = 0;
    $('btn-letter-done').focus({ preventScroll: true });
    return new Promise((resolve) => {
      const btn = $('btn-letter-done');
      const done = () => {
        btn.removeEventListener('click', done);
        ov.classList.remove('show');
        setTimeout(() => {
          ov.hidden = true;
          resolve();
        }, 450);
      };
      btn.addEventListener('click', done);
    });
  }

  /** Show what Zena typed, letter by letter, on a big readable phone. */
  showPhone(text: string, hint: string): Promise<void> {
    const ov = $('phone');
    const out = $('phone-text');
    $('phone-hint').textContent = hint;
    out.textContent = '';
    ov.hidden = false;
    ov.classList.remove('show');
    void ov.offsetWidth;
    ov.classList.add('show');
    let i = 0;
    const step = () => {
      i++;
      out.textContent = text.slice(0, i);
      if (i < text.length) timer = window.setTimeout(step, this.reducedMotion ? 0 : 55);
    };
    let timer = window.setTimeout(step, 350);
    return new Promise((resolve) => {
      const btn = $('btn-phone-done');
      const done = () => {
        btn.removeEventListener('click', done);
        clearTimeout(timer);
        ov.classList.remove('show');
        setTimeout(() => {
          ov.hidden = true;
          resolve();
        }, 350);
      };
      btn.addEventListener('click', done);
    });
  }

  get letterOpen(): boolean {
    return !$('letter').hidden;
  }

  // ---------------------------------------------------------------- proposal
  proposal(q: string, yes: string, talk: string): Promise<'yes' | 'talk'> {
    $('proposal-q').textContent = q;
    $('btn-yes').textContent = yes;
    $('btn-talk').textContent = talk;
    const ov = $('proposal');
    ov.hidden = false;
    ov.classList.remove('show');
    void ov.offsetWidth;
    ov.classList.add('show');
    return new Promise((resolve) => {
      const pick = (a: 'yes' | 'talk') => () => {
        $('btn-yes').onclick = null;
        $('btn-talk').onclick = null;
        ov.classList.remove('show');
        setTimeout(() => (ov.hidden = true), 400);
        resolve(a);
      };
      $('btn-yes').onclick = pick('yes');
      $('btn-talk').onclick = pick('talk');
    });
  }

  ending(mark: string, text: string, buttons: { label: string; primary?: boolean; id: string }[]): Promise<string> {
    $('ending-mark').textContent = mark;
    $('ending-mark').hidden = !mark;
    $('ending-text').textContent = text;
    const row = $('ending-buttons');
    row.innerHTML = '';
    const ov = $('ending');
    ov.hidden = false;
    ov.classList.remove('show');
    void ov.offsetWidth;
    ov.classList.add('show');
    return new Promise((resolve) => {
      for (const b of buttons) {
        const el = document.createElement('button');
        el.className = `btn${b.primary ? ' primary' : ''}`;
        el.textContent = b.label;
        el.id = `end-${b.id}`;
        el.addEventListener('click', () => {
          ov.classList.remove('show');
          setTimeout(() => (ov.hidden = true), 400);
          resolve(b.id);
        });
        row.appendChild(el);
      }
    });
  }

  // ---------------------------------------------------------------- journal
  renderJournal(unlocked: MemoryId[]): void {
    const list = $('journal-list');
    list.innerHTML = '';
    MEMORIES.forEach((m) => {
      const li = document.createElement('li');
      const open = unlocked.includes(m.id);
      li.className = open ? 'memory' : 'memory locked';
      li.innerHTML = `<p class="mem-chapter"></p><h3></h3><p class="mem-desc"></p><span class="chip"></span>`;
      li.querySelector('.mem-chapter')!.textContent = open ? m.chapter : 'Not found yet';
      li.querySelector('h3')!.textContent = open ? m.title : '· · ·';
      li.querySelector('.mem-desc')!.textContent = open ? m.description : 'Keep exploring to find this memory.';
      li.querySelector('.chip')!.textContent = open ? m.object : '?';
      list.appendChild(li);
    });
    $('journal-count').textContent = `${unlocked.length} of ${MEMORIES.length} found`;
  }

  setPanel(id: 'journal' | 'menu', open: boolean): void {
    const el = $(id);
    el.hidden = !open;
    if (open) {
      el.classList.remove('show');
      void el.offsetWidth;
      el.classList.add('show');
    }
  }

  isPanelOpen(id: 'journal' | 'menu'): boolean {
    return !$(id).hidden;
  }

  memoryCard(m: Memory): Promise<void> {
    $('mc-chapter').textContent = m.chapter;
    $('mc-title').textContent = m.title;
    $('mc-desc').textContent = m.description;
    const ov = $('memory-card');
    ov.hidden = false;
    ov.classList.remove('show');
    void ov.offsetWidth;
    ov.classList.add('show');
    return new Promise((resolve) => {
      const btn = $('mc-close');
      const done = () => {
        btn.removeEventListener('click', done);
        ov.hidden = true;
        resolve();
      };
      btn.addEventListener('click', done);
    });
  }

  // ---------------------------------------------------------------- settings
  bindSettings(s: Settings, onChange: (s: Settings) => void): void {
    const bindCheck = (id: string, key: 'muted' | 'reducedMotion' | 'lowEffects' | 'rememberAnswer') => {
      const el = $<HTMLInputElement>(id);
      el.checked = key === 'muted' ? !s.muted : s[key];
      el.onchange = () => {
        if (key === 'muted') s.muted = !el.checked;
        else s[key] = el.checked;
        onChange(s);
      };
    };
    const bindRange = (id: string, key: 'music' | 'ambience' | 'sfx') => {
      const el = $<HTMLInputElement>(id);
      el.value = String(Math.round(s[key] * 100));
      el.oninput = () => {
        s[key] = Number(el.value) / 100;
        onChange(s);
      };
    };
    bindCheck('set-sound', 'muted');
    bindRange('set-music', 'music');
    bindRange('set-ambience', 'ambience');
    bindRange('set-sfx', 'sfx');
    bindCheck('set-motion', 'reducedMotion');
    bindCheck('set-low', 'lowEffects');
    bindCheck('set-remember', 'rememberAnswer');
  }

  dev(text: string): void {
    const d = $('dev');
    d.hidden = false;
    d.textContent = text;
  }
}
