/**
 * Builds a single self-contained HTML file (all game code + CSS inline,
 * Three.js loaded from the jsDelivr CDN). Useful for quick sharing on any
 * static host. The normal `npm run build` (Vite) bundles Three.js locally
 * and adds the PWA files instead.
 *
 *   node scripts/build-standalone.mjs
 *   → dist-standalone/index.html      complete page
 *   → dist-standalone/embed.html      body-only fragment (for hosts that wrap pages)
 *   → dist-standalone/assets/models/  the Blender models (keep next to the html)
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, cpSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { glbToJson } from './glb-to-json.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const THREE_VERSION = '0.170.0';
const THREE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;

let esbuild;
try {
  esbuild = await import('esbuild');
} catch {
  if (!process.env.ESBUILD_PATH) throw new Error('esbuild not found: run npm install (or set ESBUILD_PATH)');
  esbuild = await import(pathToFileURL(process.env.ESBUILD_PATH).href);
}
esbuild = esbuild.default ?? esbuild;

const out = resolve(root, 'dist-standalone');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const threeCdn = {
  name: 'three-cdn',
  setup(build) {
    build.onResolve({ filter: /^three$/ }, () => ({ path: THREE_URL, external: true }));
    // GLTFLoader etc. are bundled in; they import 'three', which maps to the CDN above
    build.onResolve({ filter: /^three\/addons\// }, (a) => {
      const rel = a.path.slice('three/addons/'.length);
      const fromNpm = resolve(root, 'node_modules/three/examples/jsm', rel);
      return { path: existsSync(fromNpm) ? fromNpm : resolve(root, 'vendor/three-addons', rel) };
    });
  },
};

const result = await esbuild.build({
  entryPoints: [resolve(root, 'src/main.ts')],
  bundle: true,
  format: 'esm',
  target: 'es2020',
  minify: true,
  write: false,
  outdir: out,
  define: { __STANDALONE__: 'true', __MODEL_EXT__: '".gltf.json"' },
  plugins: [threeCdn],
  logLevel: 'warning',
});

let js = '';
let css = '';
for (const f of result.outputFiles) {
  if (f.path.endsWith('.js')) js = f.text;
  if (f.path.endsWith('.css')) css = f.text;
}
js = js.replace(/<\/script/gi, '<\\/script');

const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const body = html.slice(html.indexOf('<!--APP-->') + 10, html.indexOf('<!--/APP-->')).trim();
const fonts = html.match(/<link rel="stylesheet" href="https:\/\/fonts[^>]+>/)[0];

const full = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
<title>The Little Things</title>
<meta name="theme-color" content="#0b1430" />
${fonts}
<style>${css}</style>
</head>
<body>
${body}
<script type="module">${js}</script>
</body>
</html>
`;
writeFileSync(resolve(out, 'index.html'), full);
// the Blender models are loaded at runtime from assets/models/
cpSync(resolve(root, 'public/assets'), resolve(out, 'assets'), { recursive: true });
glbToJson(resolve(out, 'assets/models'));

const embed = `<title>The Little Things</title>
<meta name="claude:viewport-fit-sides" content="cover">
${fonts}
<style>${css}</style>
${body}
<script type="module">${js}</script>
`;
writeFileSync(resolve(out, 'embed.html'), embed);
console.log(`standalone build: ${(full.length / 1024).toFixed(1)} KB (three.js ${THREE_VERSION} from jsDelivr)`);
