// Convert .glb models to self-contained glTF JSON (buffers embedded as base64)
// so hosts that refuse binary .glb files can still serve them as .json.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
export function glbToJson(dir) {
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.glb')) continue;
    const buf = readFileSync(join(dir, f));
    const jsonLen = buf.readUInt32LE(12);
    const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
    let off = 20 + jsonLen;
    const binLen = buf.readUInt32LE(off);
    const bin = buf.subarray(off + 8, off + 8 + binLen);
    json.buffers[0].uri = 'data:application/octet-stream;base64,' + bin.toString('base64');
    writeFileSync(join(dir, f.replace(/\.glb$/, '.gltf.json')), JSON.stringify(json));
  }
}
