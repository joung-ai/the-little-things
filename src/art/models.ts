import * as THREE from 'three';
import type { AssetManager } from '../app/AssetManager';
import { node } from '../app/AssetManager';
import { Character } from '../characters/CharacterFactory';
import { Pet } from '../characters/PetController';
import { GIRL, KOOKI, PROTAGONIST, ZED } from '../data/settings';
import { mat, temp } from './materials';
import { makeBowl, makeSunflower } from './props';
import { canvasTex, roundRect } from './textures';

export type Outfit = 'lrt' | 'date';

/** Zena, built from the Blender model for the given outfit. */
export function makeZena(a: AssetManager, outfit: Outfit): Character {
  const look = outfit === 'lrt' ? { ...GIRL, top: '#18171c', bottom: '#141318', bottomType: 'pants' as const } : { ...GIRL, top: '#c41f2e', bottom: '#1d1f27', bottomType: 'pants' as const };
  return new Character(look).applyModel(a.get(outfit === 'lrt' ? 'zenaLrt' : 'zenaDate'));
}

/** Joung (the player), built from the Blender model for the given outfit. */
export function makeJoung(a: AssetManager, outfit: Outfit): Character {
  return new Character(PROTAGONIST, { bag: true }).applyModel(a.get(outfit === 'lrt' ? 'joungLrt' : 'joungDate'));
}

export function makeZed(a: AssetManager): Pet {
  return new Pet('dog', ZED).applyModel(a.get('zed'));
}

export function makeKooki(a: AssetManager): Pet {
  return new Pet('cat', KOOKI).applyModel(a.get('kooki'));
}

/** The sunflower bouquet (yellow sunflower, baby's breath, lavender wrap). */
export function makeBouquet(a: AssetManager): { group: THREE.Group; head: THREE.Object3D } {
  const m = a.get('bouquet');
  if (m) {
    const g = new THREE.Group();
    g.add(m);
    g.scale.setScalar(1.05);
    const head = node(m, 'SunflowerHead') || m;
    g.traverse((o) => (o.userData.dynamic = true));
    return { group: g, head };
  }
  const f = makeSunflower();
  f.group.scale.setScalar(1.4);
  return f;
}

/** A cup of tteokbokki from the stall. */
export function makeTteokCup(a: AssetManager): THREE.Group {
  const g = new THREE.Group();
  const m = a.get('tteokCup');
  if (m) g.add(m);
  else {
    const b = makeBowl(true);
    b.scale.setScalar(0.7);
    g.add(b);
  }
  g.traverse((o) => (o.userData.dynamic = true));
  return g;
}

/** Draw the phone screen: a notes-style screen with what she typed. */
export function phoneScreenTexture(text: string, typed: number): THREE.CanvasTexture {
  return canvasTex(256, 512, (g, w, h) => drawPhoneScreen(g, w, h, text, typed));
}

export function drawPhoneScreen(g: CanvasRenderingContext2D, w: number, h: number, text: string, typed: number): void {
  g.fillStyle = '#fbfaf6';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#f2b33d';
  g.font = '600 22px "Nunito", system-ui, sans-serif';
  g.textAlign = 'left';
  g.fillText('‹ Notes', 16, 40);
  g.fillStyle = '#e8e4da';
  g.fillRect(0, 60, w, 2);
  g.fillStyle = '#1d1b22';
  g.font = '700 30px "Nunito", system-ui, sans-serif';
  const shown = text.slice(0, Math.max(0, Math.floor(typed)));
  const words = shown.split(' ');
  let line = '';
  let y = 110;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (g.measureText(test).width > w - 36 && line) {
      g.fillText(line, 18, y);
      line = word;
      y += 40;
    } else line = test;
  }
  g.fillText(line, 18, y);
  // caret
  if (typed < text.length + 0.5) {
    const x = 18 + g.measureText(line).width + 3;
    g.fillStyle = '#f2b33d';
    g.fillRect(x, y - 26, 3, 32);
  }
  // keyboard hint at the bottom
  g.fillStyle = '#d9d5cc';
  roundRect(g, 10, h - 150, w - 20, 140, 14);
  g.fill();
  g.fillStyle = '#fbfaf6';
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) {
    roundRect(g, 18 + c * 29, h - 140 + r * 40, 24, 32, 5);
    g.fill();
  }
}

/** Her phone. The screen mesh gets a live canvas texture. */
export function makePhone(a: AssetManager): { group: THREE.Group; setScreen: (text: string, typed: number) => void } {
  const g = new THREE.Group();
  const m = a.get('phone');
  let screen: THREE.Mesh | null = null;
  if (m) {
    g.add(m);
    screen = node(m, 'PhoneScreen') as THREE.Mesh | null;
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.15, 0.009), mat('#2b2833'));
    g.add(body);
    screen = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.136), new THREE.MeshBasicMaterial());
    screen.position.z = 0.0052;
    g.add(screen);
  }
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  // glTF UVs have their origin at the top-left
  tex.flipY = !m;
  if (screen) {
    screen.material = temp(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  }
  const setScreen = (text: string, typed: number) => {
    drawPhoneScreen(ctx, 256, 512, text, typed);
    tex.needsUpdate = true;
  };
  setScreen('', 0);
  g.traverse((o) => (o.userData.dynamic = true));
  return { group: g, setScreen };
}
