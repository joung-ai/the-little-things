import * as THREE from 'three';
import { temp } from './materials';
import { haloTexture } from './textures';

/** Gradient night sky dome with stars and a moon. */
export function makeSky(opts: { top?: string; horizon?: string; low?: string } = {}): THREE.Group {
  const g = new THREE.Group();
  const uniforms = {
    uTop: { value: new THREE.Color(opts.top || '#0a1233') },
    uHorizon: { value: new THREE.Color(opts.horizon || '#3d3b78') },
    uLow: { value: new THREE.Color(opts.low || '#141a3a') },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(220, 24, 12),
    temp(
      new THREE.ShaderMaterial({
        uniforms,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uLow; varying vec3 vP;
          void main(){
            float y = vP.y;
            vec3 c = y > 0.0 ? mix(uHorizon, uTop, pow(clamp(y,0.0,1.0), 0.55)) : mix(uHorizon, uLow, clamp(-y*6.0,0.0,1.0));
            gl_FragColor = vec4(c, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }),
    ),
  );
  sky.renderOrder = -10;
  g.add(sky);

  // stars
  const n = 380;
  const pos = new Float32Array(n * 3);
  let s = 11;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let i = 0; i < n; i++) {
    const th = rnd() * Math.PI * 2;
    const y = 0.12 + rnd() * 0.88;
    const r = Math.sqrt(1 - y * y);
    pos.set([Math.cos(th) * r * 200, y * 200, Math.sin(th) * r * 200], i * 3);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(
    sg,
    temp(new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, color: '#dfe6ff', map: haloTexture(), transparent: true, depthWrite: false, fog: false, opacity: 0.9 })),
  );
  g.add(stars);

  // moon
  const moon = new THREE.Mesh(new THREE.CircleGeometry(5.5, 20), temp(new THREE.MeshBasicMaterial({ color: '#f4ecd0', fog: false })));
  moon.position.set(70, 62, -165);
  moon.lookAt(0, 0, 0);
  g.add(moon);
  const halo = new THREE.Sprite(temp(new THREE.SpriteMaterial({ map: haloTexture(), color: '#a9a6ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55, fog: false })));
  halo.position.copy(moon.position);
  halo.scale.setScalar(48);
  g.add(halo);
  g.userData.dynamic = true;
  g.traverse((o) => (o.userData.dynamic = true));
  return g;
}

/** River surface: dark blue with animated ripples and light reflections. */
export function makeWater(width: number, depth: number, z0: number, y: number): { mesh: THREE.Mesh; uniforms: Record<string, THREE.IUniform> } {
  const uniforms = {
    uTime: { value: 0 },
    uNear: { value: new THREE.Color('#183463') },
    uDeep: { value: new THREE.Color('#0a1836') },
    uWarm: { value: new THREE.Color('#ffbf6b') },
    uLav: { value: new THREE.Color('#b69bff') },
    uFog: { value: new THREE.Color('#141c40') },
    uCam: { value: new THREE.Vector3() },
    uShore: { value: z0 },
  };
  const geo = new THREE.PlaneGeometry(width, depth, 1, 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y, z0 - depth / 2);
  const m = temp(
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float uTime; uniform vec3 uNear; uniform vec3 uDeep; uniform vec3 uWarm; uniform vec3 uLav; uniform vec3 uFog; uniform vec3 uCam; uniform float uShore;
        varying vec3 vW;
        float hash(float n){ return fract(sin(n)*43758.5453); }
        void main(){
          float off = uShore - vW.z;
          vec3 col = mix(uNear, uDeep, clamp(off/45.0, 0.0, 1.0));
          float rip = sin(vW.x*1.7 + uTime*1.3 + sin(vW.z*2.3 + uTime)) * 0.5 + 0.5;
          rip *= sin(vW.z*3.1 - uTime*1.1 + vW.x*0.4) * 0.5 + 0.5;
          float lx = mod(vW.x + 3.0, 6.0) - 3.0;
          float streak = exp(-lx*lx*5.0) * (1.0 - smoothstep(0.5, 22.0, off)) * (0.25 + 0.75*rip);
          col += uWarm * streak * 0.5;
          float cell = floor(vW.x / 2.6);
          float cx = fract(vW.x / 2.6) - 0.5;
          float on = step(0.42, hash(cell));
          vec3 cc = mix(uWarm, uLav, step(0.68, hash(cell + 7.0)));
          float farS = on * exp(-cx*cx*28.0) * smoothstep(22.0, 50.0, off) * (1.0 - smoothstep(52.0, 60.0, off)) * (0.25 + 0.75*rip);
          col += cc * farS * 0.32;
          col += vec3(0.04, 0.06, 0.11) * rip * 0.6;
          float d = length(vW - uCam);
          col = mix(col, uFog, smoothstep(35.0, 150.0, d));
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  const mesh = new THREE.Mesh(geo, m);
  mesh.userData.dynamic = true;
  return { mesh, uniforms };
}

export function scaleUV(geo: THREE.BufferGeometry, sx: number, sy: number): THREE.BufferGeometry {
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
  uv.needsUpdate = true;
  return geo;
}
