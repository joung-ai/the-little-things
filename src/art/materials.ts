import * as THREE from 'three';

/**
 * Shared low-poly materials. Flat shading gives the faceted, handcrafted
 * look; materials are cached by colour so scenes share them.
 */
const cache = new Map<string, THREE.Material>();

export function mat(color: string, opts: { emissive?: string; ei?: number; rough?: number; side?: THREE.Side; flat?: boolean } = {}): THREE.MeshStandardMaterial {
  const key = `s|${color}|${opts.emissive || ''}|${opts.ei ?? 0}|${opts.rough ?? 0.85}|${opts.side ?? 0}|${opts.flat ?? true}`;
  let m = cache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: opts.rough ?? 0.85,
      metalness: 0,
      flatShading: opts.flat ?? true,
      side: opts.side ?? THREE.FrontSide,
    });
    if (opts.emissive) {
      m.emissive = new THREE.Color(opts.emissive);
      m.emissiveIntensity = opts.ei ?? 1;
    }
    cache.set(key, m);
  }
  return m;
}

/** Unlit glowing material (bulbs, signs, windows). */
export function glow(color: string, opacity = 1): THREE.MeshBasicMaterial {
  const key = `b|${color}|${opacity}`;
  let m = cache.get(key) as THREE.MeshBasicMaterial | undefined;
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: opacity < 1, opacity, fog: true });
    cache.set(key, m);
  }
  return m;
}

/** A material owned by one scene (e.g. with a canvas texture); disposed with it. */
export function temp<T extends THREE.Material>(m: T): T {
  (m as THREE.Material).userData.temp = true;
  return m;
}

export const PALETTE = {
  night: '#0b1430',
  sky: '#14244f',
  horizon: '#3a3f7a',
  river: '#0d2448',
  amber: '#ffc36b',
  gold: '#ffd98a',
  purple: '#8b5cf6',
  lavender: '#c4b0ff',
  cream: '#fbf1dc',
  wood: '#8a5a3c',
  woodDark: '#5e3b27',
  metal: '#3a3f52',
  pave: '#4a4559',
  paveLight: '#5c566b',
  grass: '#24493f',
  leaf: '#2f5d4a',
  leafDark: '#234536',
};

/** Dispose geometries and scene-owned materials/textures under a root. */
export function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry && !mesh.geometry.userData.shared) mesh.geometry.dispose();
    const mats = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
    for (const m of mats) {
      if (m.userData.temp) {
        const mm = m as THREE.MeshBasicMaterial;
        if (mm.map && !mm.map.userData.shared) mm.map.dispose();
        m.dispose();
      }
    }
  });
}
