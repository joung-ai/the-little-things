import type { Settings } from './SaveManager';

export type Ambience = 'none' | 'train' | 'market' | 'garden';
export type Music = 'none' | 'title' | 'market' | 'tender' | 'joy' | 'garden';
export type Sfx = 'chime' | 'pop' | 'paper' | 'step' | 'sparkle' | 'door' | 'ding' | 'whoosh' | 'select';

/**
 * Fully procedural audio (Web Audio API): no audio files are required, so the
 * game stays light and works offline. Four channels: music, ambience, sfx,
 * cutscene. Starts only after a user gesture (browser autoplay rules).
 */
export class AudioManager {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private chMusic!: GainNode;
  private chAmb!: GainNode;
  private chSfx!: GainNode;
  private chCut!: GainNode;
  private duckGain!: GainNode;
  private noise!: AudioBuffer;
  private ambNodes: AudioNode[] = [];
  private ambTimers: number[] = [];
  private musicKind: Music = 'none';
  private musicTimer = 0;
  private musicStep = 0;
  private nextNoteTime = 0;
  private musicBus!: GainNode;
  private settings: Settings | null = null;

  unlock(settings: Settings): void {
    this.settings = settings;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch {
        return;
      }
      const c = this.ctx;
      this.master = c.createGain();
      this.master.connect(c.destination);
      this.chMusic = c.createGain();
      this.chAmb = c.createGain();
      this.chSfx = c.createGain();
      this.chCut = c.createGain();
      this.duckGain = c.createGain();
      this.chAmb.connect(this.duckGain);
      this.duckGain.connect(this.master);
      this.chMusic.connect(this.master);
      this.chSfx.connect(this.master);
      this.chCut.connect(this.master);
      this.musicBus = c.createGain();
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2600;
      this.musicBus.connect(lp);
      lp.connect(this.chMusic);
      // 2 s of white noise, looped by sources
      const len = c.sampleRate * 2;
      this.noise = c.createBuffer(1, len, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    this.applySettings(settings);
  }

  applySettings(s: Settings): void {
    this.settings = s;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : 0.9, t, 0.05);
    this.chMusic.gain.setTargetAtTime(s.music * 0.55, t, 0.05);
    this.chAmb.gain.setTargetAtTime(s.ambience * 0.8, t, 0.05);
    this.chSfx.gain.setTargetAtTime(s.sfx * 0.7, t, 0.05);
    this.chCut.gain.setTargetAtTime(s.sfx * 0.7, t, 0.05);
  }

  suspend(): void {
    this.ctx?.suspend().catch(() => {});
  }
  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  /** Lower the world ambience (0..1 = target level) instead of silencing it. */
  duck(level: number, time = 1.5): void {
    if (!this.ctx) return;
    this.duckGain.gain.setTargetAtTime(level, this.ctx.currentTime, time / 3);
  }

  // ---------- helpers
  private noiseSrc(): AudioBufferSourceNode {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.loopStart = Math.random();
    return s;
  }

  private filter(type: BiquadFilterType, freq: number, q = 0.7): BiquadFilterNode {
    const f = this.ctx!.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  private lfo(target: AudioParam, rate: number, depth: number): OscillatorNode {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.frequency.value = rate;
    const g = c.createGain();
    g.gain.value = depth;
    o.connect(g);
    g.connect(target);
    o.start();
    return o;
  }

  // ---------- ambience
  setAmbience(kind: Ambience): void {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    for (const n of this.ambNodes) {
      try {
        if (n instanceof GainNode) {
          n.gain.setTargetAtTime(0, t, 0.4);
        }
      } catch {
        /* */
      }
    }
    const old = this.ambNodes;
    setTimeout(() => {
      for (const n of old) {
        try {
          (n as AudioScheduledSourceNode).stop?.();
        } catch {
          /* */
        }
        try {
          n.disconnect();
        } catch {
          /* */
        }
      }
    }, 2500);
    this.ambNodes = [];
    for (const id of this.ambTimers) clearInterval(id);
    this.ambTimers = [];
    this.duckGain.gain.setTargetAtTime(1, t, 0.3);
    if (kind === 'none') return;

    const bed = (freq: number, type: BiquadFilterType, gain: number, q = 0.7, lfoRate = 0, lfoDepth = 0) => {
      const src = this.noiseSrc();
      const f = this.filter(type, freq, q);
      const g = c.createGain();
      g.gain.value = 0;
      g.gain.setTargetAtTime(gain, t, 0.8);
      src.connect(f);
      f.connect(g);
      g.connect(this.chAmb);
      src.start();
      this.ambNodes.push(src, f, g);
      if (lfoRate) this.ambNodes.push(this.lfo(g.gain, lfoRate, lfoDepth));
      return g;
    };

    if (kind === 'train') {
      bed(140, 'lowpass', 0.55);
      bed(420, 'bandpass', 0.09, 0.6, 0.31, 0.04);
      // wheel clacks
      const clack = () => {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        for (const off of [0, 0.16]) this.thump(now + off, 0.22);
      };
      this.ambTimers.push(window.setInterval(clack, 1150));
    } else if (kind === 'market') {
      bed(520, 'bandpass', 0.22, 0.9, 0.23, 0.08); // crowd murmur
      bed(1250, 'bandpass', 0.07, 1.2, 0.37, 0.03);
      bed(260, 'lowpass', 0.12, 0.7, 0.11, 0.05); // river
      bed(5200, 'highpass', 0.012, 0.7, 0.7, 0.008); // sizzle
      const chatter = () => {
        if (!this.ctx || Math.random() < 0.4) return;
        this.voiceBlip();
      };
      this.ambTimers.push(window.setInterval(chatter, 700));
    } else if (kind === 'garden') {
      bed(300, 'lowpass', 0.08, 0.7, 0.09, 0.04);
      const cricket = () => {
        if (!this.ctx || Math.random() < 0.35) return;
        this.cricket();
      };
      this.ambTimers.push(window.setInterval(cricket, 900));
    }
  }

  private thump(at: number, vol: number): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(80, at);
    o.frequency.exponentialRampToValueAtTime(42, at + 0.12);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
    o.connect(g);
    g.connect(this.chAmb);
    o.start(at);
    o.stop(at + 0.2);
  }

  private voiceBlip(): void {
    const c = this.ctx!;
    const at = c.currentTime + Math.random() * 0.3;
    const src = this.noiseSrc();
    const f = this.filter('bandpass', 380 + Math.random() * 600, 4);
    const g = c.createGain();
    const dur = 0.25 + Math.random() * 0.4;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.05, at + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.chAmb);
    src.start(at);
    src.stop(at + dur + 0.05);
  }

  private cricket(): void {
    const c = this.ctx!;
    const at = c.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = c.createOscillator();
      o.frequency.value = 4300 + Math.random() * 200;
      const g = c.createGain();
      const s = at + i * 0.07;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.012, s + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.05);
      o.connect(g);
      g.connect(this.chAmb);
      o.start(s);
      o.stop(s + 0.06);
    }
  }

  // ---------- sfx
  sfx(name: Sfx): void {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const tone = (freq: number, at: number, dur: number, vol: number, type: OscillatorType = 'sine', dest: AudioNode = this.chSfx) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(vol, at + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g);
      g.connect(dest);
      o.start(at);
      o.stop(at + dur + 0.05);
    };
    const burst = (freq: number, type: BiquadFilterType, at: number, dur: number, vol: number, q = 1) => {
      const src = this.noiseSrc();
      const f = this.filter(type, freq, q);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      src.connect(f);
      f.connect(g);
      g.connect(this.chSfx);
      src.start(at);
      src.stop(at + dur + 0.05);
    };
    switch (name) {
      case 'chime':
        tone(880, t, 0.5, 0.18);
        tone(1318.5, t + 0.08, 0.6, 0.12);
        break;
      case 'select':
        tone(660, t, 0.18, 0.12, 'triangle');
        break;
      case 'pop':
        tone(523.25, t, 0.25, 0.16, 'triangle');
        tone(783.99, t + 0.09, 0.3, 0.14, 'triangle');
        tone(1046.5, t + 0.18, 0.5, 0.12, 'triangle');
        break;
      case 'paper':
        burst(3000, 'bandpass', t, 0.18, 0.18, 0.8);
        burst(2200, 'bandpass', t + 0.12, 0.22, 0.12, 0.8);
        break;
      case 'step':
        burst(900, 'lowpass', t, 0.07, 0.2);
        break;
      case 'sparkle':
        for (let i = 0; i < 5; i++) tone(1400 + i * 260 + Math.random() * 80, t + i * 0.06, 0.35, 0.05);
        break;
      case 'door':
        burst(500, 'bandpass', t, 0.9, 0.12, 0.6);
        tone(180, t, 0.25, 0.06, 'square');
        break;
      case 'ding':
        tone(659.25, t, 1.0, 0.16);
        tone(523.25, t + 0.45, 1.2, 0.16);
        break;
      case 'whoosh':
        burst(800, 'bandpass', t, 0.8, 0.1, 0.5);
        break;
    }
  }

  // ---------- music (gentle generative pads + plucks)
  setMusic(kind: Music): void {
    if (!this.ctx) {
      this.musicKind = kind;
      return;
    }
    if (kind === this.musicKind && this.musicTimer) return;
    this.musicKind = kind;
    clearInterval(this.musicTimer);
    this.musicTimer = 0;
    const t = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setTargetAtTime(0, t, 0.5);
    if (kind === 'none') return;
    setTimeout(() => {
      if (!this.ctx || this.musicKind !== kind) return;
      this.musicBus.gain.setTargetAtTime(1, this.ctx.currentTime, 0.8);
      this.musicStep = 0;
      this.nextNoteTime = this.ctx.currentTime + 0.1;
      this.musicTimer = window.setInterval(() => this.scheduleMusic(), 100);
    }, 900);
  }

  private scheduleMusic(): void {
    if (!this.ctx) return;
    const c = this.ctx;
    const kind = this.musicKind;
    const bpm = kind === 'joy' ? 96 : kind === 'market' ? 84 : 70;
    const beat = 60 / bpm / 2; // eighth notes
    // I–vi–IV–V style progression in F major (semitones from A4=440)
    const progressions: Record<string, number[][]> = {
      title: [[-4, 0, 3], [-7, -4, 0], [-11, -7, -4], [-9, -5, -2]],
      market: [[-4, 0, 3], [-2, 1, 5], [-11, -7, -4], [-9, -5, -2]],
      tender: [[-4, 0, 3], [-7, -4, 0], [-11, -7, -4], [-9, -5, -2]],
      joy: [[-4, 0, 3], [-9, -5, -2], [-7, -4, 0], [-11, -7, -4]],
      garden: [[-11, -7, -4], [-4, 0, 3], [-7, -4, 0], [-9, -5, -2]],
    };
    const prog = progressions[kind] || progressions.title;
    const pent = [0, 2, 3, 7, 10, 12, 15];
    while (this.nextNoteTime < c.currentTime + 0.4) {
      const step = this.musicStep;
      const at = this.nextNoteTime;
      const bar = Math.floor(step / 8) % prog.length;
      const chord = prog[bar];
      if (step % 8 === 0) {
        for (const n of chord) this.pad(440 * Math.pow(2, (n - 12) / 12), at, beat * 8.2);
      }
      const density = kind === 'tender' ? 0.25 : kind === 'joy' ? 0.75 : 0.45;
      if (step % 2 === 0 || Math.random() < density * 0.4) {
        if (Math.random() < density + 0.2) {
          const root = chord[0];
          const n = root + pent[Math.floor(Math.random() * pent.length)] + 12;
          this.pluck(440 * Math.pow(2, n / 12), at, kind === 'tender' ? 0.05 : 0.07);
        }
      }
      this.musicStep++;
      this.nextNoteTime += beat;
    }
  }

  private pad(freq: number, at: number, dur: number): void {
    const c = this.ctx!;
    for (const det of [-4, 4]) {
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq;
      o.detune.value = det;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(0.035, at + dur * 0.3);
      g.gain.linearRampToValueAtTime(0.0001, at + dur);
      o.connect(g);
      g.connect(this.musicBus);
      o.start(at);
      o.stop(at + dur + 0.1);
    }
  }

  private pluck(freq: number, at: number, vol: number): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const o2 = c.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = freq * 2;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 1.1);
    const g2 = c.createGain();
    g2.gain.value = 0.25;
    o.connect(g);
    o2.connect(g2);
    g2.connect(g);
    g.connect(this.musicBus);
    o.start(at);
    o2.start(at);
    o.stop(at + 1.2);
    o2.stop(at + 1.2);
  }
}
