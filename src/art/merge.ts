import * as THREE from 'three';

/**
 * Merge every static mesh under `root` into one mesh per material.
 * Cuts draw calls dramatically for scenery (stalls, railings, the train).
 * Meshes with userData.dynamic (or inside such a group) are left alone.
 */
export function mergeStatic(root: THREE.Object3D): THREE.Group {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<THREE.Material, { pos: number[]; nor: number[]; uv: number[] }>();
  const remove: THREE.Object3D[] = [];
  const m = new THREE.Matrix4();
  const nm = new THREE.Matrix3();
  const v = new THREE.Vector3();

  const visit = (o: THREE.Object3D) => {
    if (o.userData.dynamic) return;
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && !(o as THREE.InstancedMesh).isInstancedMesh && !Array.isArray(mesh.material)) {
      const mat = mesh.material as THREE.Material;
      let geo = mesh.geometry as THREE.BufferGeometry;
      if (geo.index) geo = geo.toNonIndexed();
      const p = geo.getAttribute('position');
      const n = geo.getAttribute('normal');
      const u = geo.getAttribute('uv');
      if (p && n) {
        m.multiplyMatrices(inv, mesh.matrixWorld);
        nm.getNormalMatrix(m);
        let b = buckets.get(mat);
        if (!b) {
          b = { pos: [], nor: [], uv: [] };
          buckets.set(mat, b);
        }
        for (let i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i).applyMatrix4(m);
          b.pos.push(v.x, v.y, v.z);
          v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
          b.nor.push(v.x, v.y, v.z);
          if (u) b.uv.push(u.getX(i), u.getY(i));
          else b.uv.push(0, 0);
        }
        remove.push(mesh);
        if (geo !== mesh.geometry) geo.dispose();
      }
    }
    for (const c of o.children) visit(c);
  };
  for (const c of root.children) visit(c);

  for (const r of remove) {
    r.parent?.remove(r);
    (r as THREE.Mesh).geometry.dispose();
  }
  const out = new THREE.Group();
  out.name = 'merged-static';
  for (const [mat, b] of buckets) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, mat);
    out.add(mesh);
  }
  root.add(out);
  return out;
}
