import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MODELS, type ModelKey } from '../data/settings';

/**
 * Loads the Blender-made GLB models listed in data/settings.ts (MODELS).
 * Every model is optional: if one fails to load, the game falls back to the
 * procedural low-poly version of that character or prop.
 */
export class AssetManager {
  private scenes = new Map<ModelKey, THREE.Object3D>();
  failed: ModelKey[] = [];

  async loadAll(onProgress: (done: number, total: number) => void): Promise<void> {
    const loader = new GLTFLoader();
    const keys = Object.keys(MODELS) as ModelKey[];
    let done = 0;
    onProgress(0, keys.length);
    await Promise.all(
      keys.map(async (key) => {
        try {
          const gltf = __MODEL_EXT__ === '.glb' ? await loader.loadAsync(MODELS[key]) : await loadEmbeddedJson(loader, MODELS[key].replace(/\.glb$/, __MODEL_EXT__));
          const root = gltf.scene as THREE.Object3D;
          root.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.isMesh) {
              m.frustumCulled = true;
              m.geometry.userData.shared = true;
              const mats = Array.isArray(m.material) ? m.material : [m.material];
              for (const mat of mats) {
                const sm = mat as THREE.MeshStandardMaterial;
                sm.userData.shared = true;
                if (sm.transparent) sm.depthWrite = false;
              }
            }
          });
          this.scenes.set(key, root);
        } catch (err) {
          console.warn(`[assets] ${MODELS[key]} could not be loaded, using the built-in model`, err);
          this.failed.push(key);
        }
        done++;
        onProgress(done, keys.length);
      }),
    );
  }

  has(key: ModelKey): boolean {
    return this.scenes.has(key);
  }

  /** A fresh copy of a model (geometry and materials are shared). */
  get(key: ModelKey): THREE.Object3D | null {
    const s = this.scenes.get(key);
    return s ? s.clone(true) : null;
  }
}

/**
 * Load a glTF JSON whose buffer is embedded as base64, rebuilding the binary
 * GLB in memory (some hosts refuse .glb files and block data: URL fetches).
 */
async function loadEmbeddedJson(loader: GLTFLoader, url: string): Promise<{ scene: THREE.Object3D }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const json = await res.json();
  const uri: string = json.buffers?.[0]?.uri || '';
  const b64 = uri.slice(uri.indexOf(',') + 1);
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  delete json.buffers[0].uri;
  json.buffers[0].byteLength = bin.byteLength;
  const enc = new TextEncoder().encode(JSON.stringify(json));
  const jsonLen = Math.ceil(enc.byteLength / 4) * 4;
  const binLen = Math.ceil(bin.byteLength / 4) * 4;
  const total = 12 + 8 + jsonLen + 8 + binLen;
  const out = new ArrayBuffer(total);
  const dv = new DataView(out);
  const u8 = new Uint8Array(out);
  dv.setUint32(0, 0x46546c67, true); // 'glTF'
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonLen, true);
  dv.setUint32(16, 0x4e4f534a, true); // 'JSON'
  u8.fill(0x20, 20, 20 + jsonLen);
  u8.set(enc, 20);
  dv.setUint32(20 + jsonLen, binLen, true);
  dv.setUint32(24 + jsonLen, 0x004e4942, true); // 'BIN\0'
  u8.set(bin, 28 + jsonLen);
  return new Promise((resolve, reject) => loader.parse(out, '', resolve, reject));
}

/** Find a node by exact name inside a loaded model. */
export function node(root: THREE.Object3D, name: string): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (!found && sameName(o.name, name)) found = o;
  });
  return found;
}

/** "Torso", "Torso.002" (Blender) and "Torso002" (three.js strips the dot) all match. */
function sameName(actual: string, wanted: string): boolean {
  if (actual === wanted) return true;
  if (!actual.startsWith(wanted)) return false;
  return /^\.?\d{3}$/.test(actual.slice(wanted.length));
}

/**
 * Move the mesh children of `from` into `to`, keeping their local transforms
 * (used to graft Blender parts onto the game's animation pivots).
 */
export function graft(from: THREE.Object3D | null, to: THREE.Object3D): number {
  if (!from) return 0;
  const moved: THREE.Mesh[] = [];
  for (const c of from.children.slice()) {
    if ((c as THREE.Mesh).isMesh) moved.push(c as THREE.Mesh);
    else if (c.children.length && !isPivotName(c.name)) to.add(c);
  }
  // merge the many small parts into one mesh per material (fewer draw calls)
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const m of moved) {
    m.updateMatrix();
    const g = m.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    g.applyMatrix4(m.matrix);
    const mat = m.material as THREE.Material;
    const list = byMat.get(mat) || [];
    list.push(g.index ? g : g);
    byMat.set(mat, list);
  }
  let n = 0;
  for (const [mat, geos] of byMat) {
    const indexed = geos.every((g) => g.index);
    const ready = indexed ? geos : geos.map((g) => (g.index ? g.toNonIndexed() : g));
    const merged = ready.length === 1 ? ready[0] : mergeGeometries(ready, false);
    if (!merged) {
      for (const m of moved) if (m.material === mat) to.add(m);
      continue;
    }
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, mat);
    mesh.name = (from.name || 'part') + '_merged';
    to.add(mesh);
    n++;
  }
  return n;
}

const PIVOTS = new Set(['Hips', 'Torso', 'Head', 'ArmL', 'ArmR', 'LegL', 'LegR', 'Body', 'Tail', 'Leg0', 'Leg1', 'Leg2', 'Leg3', 'SunflowerHead']);
function isPivotName(n: string): boolean {
  const base = n.replace(/\.?\d{3}$/, '');
  return PIVOTS.has(n) || PIVOTS.has(base) || n.startsWith('TailSeg');
}
