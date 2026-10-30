import './styles/main.css';
import { Game } from './app/Game';

declare const __STANDALONE__: boolean;

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

async function boot(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  if (!webglAvailable()) {
    document.getElementById('loading-text')!.textContent = 'This device or browser can’t show 3D graphics (WebGL is unavailable).';
    const e = document.getElementById('error-text')!;
    e.hidden = false;
    e.textContent = 'Try the latest Chrome or Safari, or turn on hardware acceleration in your browser settings.';
    return;
  }
  // make sure the rounded UI fonts are ready for canvas-drawn signs
  try {
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    /* ignore */
  }
  const game = new Game(canvas);
  (window as unknown as { __tlt: Game }).__tlt = game;
  await game.assets.loadAll((done, total) => {
    const t = document.getElementById('loading-text');
    if (t) t.textContent = done < total ? `Bringing everyone together… ${done}/${total}` : 'Lighting up the night market…';
  });
  await game.showTitle();
  document.body.classList.add('ready');
}

boot().catch((err) => {
  console.error(err);
  const t = document.getElementById('loading-text');
  if (t) t.textContent = 'Something went wrong while loading.';
  const e = document.getElementById('error-text');
  if (e) {
    e.hidden = false;
    e.textContent = String(err && err.message ? err.message : err);
  }
});

// PWA: register the service worker in normal (non-standalone) builds on HTTPS
if (!__STANDALONE__ && 'serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
