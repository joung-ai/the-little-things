import * as THREE from 'three';

type Draw = (g: CanvasRenderingContext2D, w: number, h: number) => void;

export function canvasTex(w: number, h: number, draw: Draw, shared = false): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 2;
  if (shared) t.userData.shared = true;
  return t;
}

const sharedCache = new Map<string, THREE.Texture>();
function shared(key: string, make: () => THREE.Texture): THREE.Texture {
  let t = sharedCache.get(key);
  if (!t) {
    t = make();
    t.userData.shared = true;
    sharedCache.set(key, t);
  }
  return t;
}

/** Soft radial glow used for halos, sparkles and particles. */
export function haloTexture(): THREE.Texture {
  return shared('halo', () =>
    canvasTex(128, 128, (g, w, h) => {
      const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.18, 'rgba(255,255,255,0.75)');
      grd.addColorStop(0.45, 'rgba(255,255,255,0.18)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
    }, true),
  );
}

export function petalTexture(): THREE.Texture {
  return shared('petal', () =>
    canvasTex(64, 64, (g) => {
      g.fillStyle = '#fff';
      g.beginPath();
      g.ellipse(32, 32, 14, 26, 0.5, 0, Math.PI * 2);
      g.fill();
    }, true),
  );
}

export function signTexture(text: string, opts: { bg: string; fg: string; sub?: string; w?: number; h?: number; font?: string; border?: string }): THREE.CanvasTexture {
  const w = opts.w ?? 512;
  const h = opts.h ?? 160;
  return canvasTex(w, h, (g) => {
    g.fillStyle = opts.bg;
    roundRect(g, 0, 0, w, h, 26);
    g.fill();
    if (opts.border) {
      g.strokeStyle = opts.border;
      g.lineWidth = 10;
      roundRect(g, 8, 8, w - 16, h - 16, 20);
      g.stroke();
    }
    g.fillStyle = opts.fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const size = opts.sub ? h * 0.42 : h * 0.55;
    g.font = `700 ${size}px ${opts.font || '"Fredoka", "Trebuchet MS", sans-serif'}`;
    g.fillText(text, w / 2, opts.sub ? h * 0.4 : h * 0.52, w - 40);
    if (opts.sub) {
      g.font = `600 ${h * 0.2}px "Fredoka", "Trebuchet MS", sans-serif`;
      g.globalAlpha = 0.85;
      g.fillText(opts.sub, w / 2, h * 0.78, w - 40);
    }
  });
}

export function stripeTexture(a: string, b: string, stripes = 8): THREE.CanvasTexture {
  return canvasTex(256, 64, (g, w, h) => {
    const sw = w / stripes;
    for (let i = 0; i < stripes; i++) {
      g.fillStyle = i % 2 ? b : a;
      g.fillRect(i * sw, 0, sw, h);
    }
  });
}

/** Night city seen through the LRT windows; scrolls horizontally. */
export function cityScrollTexture(): THREE.CanvasTexture {
  const t = canvasTex(1024, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#0c1534');
    grd.addColorStop(0.7, '#1d2a5c');
    grd.addColorStop(1, '#2c2a55');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    let x = 0;
    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    while (x < w) {
      const bw = 40 + rnd() * 90;
      const bh = 60 + rnd() * 150;
      g.fillStyle = rnd() < 0.5 ? '#121a3d' : '#182250';
      g.fillRect(x, h - bh, bw - 4, bh);
      for (let yy = h - bh + 10; yy < h - 8; yy += 14) {
        for (let xx = x + 6; xx < x + bw - 12; xx += 12) {
          if (rnd() < 0.42) {
            g.fillStyle = rnd() < 0.8 ? 'rgba(255,205,120,0.9)' : 'rgba(190,170,255,0.9)';
            g.fillRect(xx, yy, 5, 7);
          }
        }
      }
      x += bw;
    }
    // passing street lights
    for (let i = 0; i < 9; i++) {
      const lx = rnd() * w;
      const r = g.createRadialGradient(lx, h * 0.55, 0, lx, h * 0.55, 30);
      r.addColorStop(0, 'rgba(255,200,120,0.9)');
      r.addColorStop(1, 'rgba(255,200,120,0)');
      g.fillStyle = r;
      g.fillRect(lx - 30, h * 0.55 - 30, 60, 60);
    }
  });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export function buildingTexture(seed: number, tint: string): THREE.CanvasTexture {
  let s = seed * 9301 + 49297;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = tint;
    g.fillRect(0, 0, w, h);
    for (let y = 8; y < h - 6; y += 16) {
      for (let x = 8; x < w - 8; x += 14) {
        const r = rnd();
        if (r < 0.38) g.fillStyle = 'rgba(255,207,130,0.95)';
        else if (r < 0.45) g.fillStyle = 'rgba(180,160,255,0.9)';
        else g.fillStyle = 'rgba(30,38,80,0.9)';
        g.fillRect(x, y, 7, 9);
      }
    }
  });
}

export function paverTexture(): THREE.CanvasTexture {
  const t = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#4b465a';
    g.fillRect(0, 0, w, h);
    const n = 8;
    const sz = w / n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const off = y % 2 ? sz / 2 : 0;
        const v = 70 + ((x * 31 + y * 17) % 13);
        g.fillStyle = `rgb(${v},${v - 6},${v + 14})`;
        g.fillRect(x * sz + off + 2, y * sz + 2, sz - 4, sz - 4);
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function heartSignTexture(): THREE.CanvasTexture {
  return canvasTex(256, 192, (g, w, h) => {
    g.fillStyle = '#fbf1dc';
    roundRect(g, 0, 0, w, h, 24);
    g.fill();
    g.strokeStyle = '#b48cff';
    g.lineWidth = 8;
    roundRect(g, 8, 8, w - 16, h - 16, 18);
    g.stroke();
    // heart
    g.fillStyle = '#8b5cf6';
    const cx = w * 0.38;
    const cy = h * 0.5;
    const s = 46;
    g.beginPath();
    g.moveTo(cx, cy + s * 0.9);
    g.bezierCurveTo(cx - s * 1.6, cy - s * 0.1, cx - s * 0.7, cy - s * 1.25, cx, cy - s * 0.45);
    g.bezierCurveTo(cx + s * 0.7, cy - s * 1.25, cx + s * 1.6, cy - s * 0.1, cx, cy + s * 0.9);
    g.fill();
    g.fillStyle = '#3b2f4a';
    g.font = '700 110px "Fredoka", "Trebuchet MS", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('?', w * 0.74, h * 0.54);
  });
}

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Afternoon Manila seen through the LRT windows; scrolls horizontally. */
export function cityDayTexture(): THREE.CanvasTexture {
  const t = canvasTex(1024, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#8ec5ef');
    grd.addColorStop(0.55, '#cfe6f6');
    grd.addColorStop(1, '#f3e6cf');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    let seed = 21;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    // soft clouds
    g.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 9; i++) {
      const cx = rnd() * w;
      const cy = 20 + rnd() * 60;
      for (let k = 0; k < 4; k++) {
        g.beginPath();
        g.ellipse(cx + k * 22, cy + (k % 2) * 6, 30, 12, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    // far buildings
    let x = 0;
    while (x < w) {
      const bw = 30 + rnd() * 60;
      const bh = 70 + rnd() * 110;
      g.fillStyle = ['#b9c3cf', '#c9cdd3', '#aeb8c4', '#d4cfc6'][Math.floor(rnd() * 4)];
      g.fillRect(x, h - bh - 30, bw - 3, bh);
      g.fillStyle = 'rgba(120,150,180,0.55)';
      for (let yy = h - bh - 22; yy < h - 40; yy += 12) {
        for (let xx = x + 5; xx < x + bw - 10; xx += 10) if (rnd() < 0.6) g.fillRect(xx, yy, 5, 6);
      }
      x += bw;
    }
    // near rooftops, signs, trees and wires
    x = 0;
    while (x < w) {
      const bw = 50 + rnd() * 90;
      const bh = 40 + rnd() * 60;
      g.fillStyle = ['#e7d8c0', '#d9c5a6', '#c7d1c4', '#efe3d0', '#d6b9a0'][Math.floor(rnd() * 5)];
      g.fillRect(x, h - bh, bw - 4, bh);
      if (rnd() < 0.5) {
        g.fillStyle = ['#e2574c', '#3f7fbf', '#f2b33d', '#4fa36b'][Math.floor(rnd() * 4)];
        g.fillRect(x + 6, h - bh + 6, Math.min(bw - 16, 40), 10);
      }
      if (rnd() < 0.45) {
        g.fillStyle = '#5f9a5a';
        g.beginPath();
        g.arc(x + bw * 0.6, h - 12, 18 + rnd() * 10, 0, Math.PI * 2);
        g.fill();
      }
      x += bw;
    }
    g.strokeStyle = 'rgba(60,60,70,0.5)';
    g.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(0, 60 + i * 12);
      g.quadraticCurveTo(w / 2, 90 + i * 12, w, 60 + i * 12);
      g.stroke();
    }
  });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** Warm window-shaped light patches cast on the carriage floor. */
export function sunPatchTexture(): THREE.CanvasTexture {
  const t = canvasTex(512, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) {
      const x0 = i * 128 + 14;
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, 'rgba(255,214,150,0.0)');
      grd.addColorStop(0.3, 'rgba(255,214,150,0.55)');
      grd.addColorStop(1, 'rgba(255,214,150,0.25)');
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(x0, 0);
      g.lineTo(x0 + 92, 0);
      g.lineTo(x0 + 110, h);
      g.lineTo(x0 + 18, h);
      g.closePath();
      g.fill();
    }
  });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}
