# The Little Things: Our Story

A short low-poly 3D browser game (Three.js + TypeScript + Vite) about Zena and Joung.

1. **One afternoon on the LRT** (a cutscene). Joung stands by the doors in his National University uniform, with his Tamtam keychain hanging from it. Zena, in a black shirt and pants, types a question on her phone and shows him the screen. He gives her the Tamtam to keep.
2. **The Pasig River Esplanade, around 7:00 PM.** You play as Joung. Buy two cups of tteokbokki at the stall, then eat them together beside the river. Give her the sunflower: a yellow sunflower with baby's breath in purple wrapping.
3. **By the river.** They sit together, and a letter floats in. Once she has read it, Zed and Kooki come out with the question.

Playtime is about 5–10 minutes. It runs on iPhone Safari, Android Chrome and desktop browsers, and can be installed as an app (PWA).

---

## 1. Before you share it: make it yours

Everything personal lives in `src/data/`. You never need to touch game code.

| File | What to change |
|---|---|
| `src/data/letter.ts` | **Write your real letter here.** Then set `isPlaceholder: false`, which removes the reminder on the title screen. |
| `src/data/settings.ts` | Names on the speaker tags (Zena, Joung, Zed, Kooki), the model file list (`MODELS`), the Tamtam charm colours, and fallback colours used only if a model file fails to load. |
| `src/data/dialogue.ts` | Every narrated line, **what Zena typed on her phone** (`PHONE_NOTE`), the proposal question, both answer buttons and both ending messages. |
| `src/data/memories.ts` | Memory-journal titles and descriptions. |

Still placeholders: **Joung's NU uniform** and the **Tamtam keychain design** (waiting on reference photos), the **exact words** Zena typed (the game says "Where did you get your Tamtam keychain?"), the **colour of Joung's sweatpants** (heather grey), and the letter.

---

## 2. Run it

Requires Node.js 18+.

```bash
npm install
npm run dev          # local dev server (prints a LAN URL you can open on your phone)
npm run build        # type-check + production build into dist/
npm run preview      # serve the production build locally
```

Single-file build (all code inline, Three.js from the jsDelivr CDN):

```bash
npm run build:standalone   # → dist-standalone/index.html
```

### Controls

| | Phone / tablet | Laptop |
|---|---|---|
| Move | Left joystick | W A S D or arrow keys |
| Look around | Drag on the screen | Drag with the mouse |
| Interact / next line | Round purple button (or tap the dialogue) | E (Space / Enter also advances dialogue) |
| Memory journal | Book icon, top right | J |
| Menu / settings | ☰ icon | Esc |

The menu has sound (music / ambience / effects sliders), reduce motion, battery saver (fewer effects, lower resolution), restart and Memory Garden.

### Demo mode

Open the game with `#autoplay` at the end of the URL (or `#autoplay-talk` to pick the other answer). It plays the whole story by itself. This is useful for checking a new phone or a new deployment. It writes to that browser's save like a normal playthrough.

---

## 3. Deploy (HTTPS)

`npm run build` produces a static `dist/` folder, which any static host can serve. All of these provide HTTPS automatically:

- **Netlify**: drag the `dist/` folder onto app.netlify.com/drop, or connect the repo with build command `npm run build` and publish directory `dist`.
- **Vercel**: `npx vercel`, then accept the Vite defaults (output `dist`).
- **GitHub Pages**: push the repo, then add a Pages workflow that runs `npm ci && npm run build` and uploads `dist/`. `vite.config.ts` already uses relative paths (`base: './'`), so it works from a sub-path.
- **Cloudflare Pages**: build command `npm run build`, output `dist`.

The service worker only registers on HTTPS. After one complete online visit, the app shell and the assets that loaded are cached for reopening offline. Full offline play has **not** been verified on a real phone, so test it before relying on it.

To install it: on iPhone, use Safari → Share → *Add to Home Screen*. On Android Chrome, use ⋮ → *Install app*.

---

## 4. Project layout

```
src/
  main.ts                 boot, WebGL check, service-worker registration
  app/Game.ts             renderer, loop, scene switching, menus, flow
  app/GameState.ts        explicit story state machine (refuses illegal transitions)
  data/                   ← all editable content (see section 1)
    story.ts              the states and the allowed transitions between them
  scenes/
    LRTScene.ts           Chapter One: carriage, doors, passengers, keychain hand-off
    EsplanadeScene.ts     night market, river, crowd, tteokbokki, sunflower, bench → letter → pets → proposal
    MemoryGardenScene.ts  epilogue: five keepsakes on pedestals
  characters/
    CharacterFactory.ts   configurable low-poly humans + procedural animation (walk, sit, reach, hold, look)
    PetController.ts      Zed (dog) and Kooki (cat), procedural walk / tail / look / hop
    PlayerController.ts   movement, collision, the girl following during the date
  systems/                input (keys + joystick + drag), camera, interactions, tweens,
                          procedural Web Audio, saving, demo autopilot
  art/                    materials, canvas textures, props, crowd (instanced), sky, water shader
  ui/UI.ts                dialogue, speech bubbles, letter, proposal, journal, menu
  styles/main.css
public/                   manifest, service worker, icons
scripts/
  playtest.py             automated end-to-end playthrough (Playwright)
  build-standalone.mjs    single-file build
```

Story order is enforced by `data/story.ts`. For example, `LETTER_READING → LETTER_CLOSING → PETS_REVEAL` is the only route to the pets, so Zed and Kooki cannot appear while the letter is open. The bench only unlocks after both the tteokbokki and sunflower memories.

---

## 5. The 3D models (Blender)

The characters and key props were modelled in Blender 5.2 from the reference photos and exported as GLB files to `public/assets/models/`:

| File | What it is |
|---|---|
| `zena_lrt.glb` | Zena on the LRT: long dark hair with curtain bangs, rimless glasses, red lips, black shirt and pants |
| `zena_date.glb` | Zena at the Esplanade: red off-shoulder top, black jeans |
| `joung_lrt.glb` | Joung on the LRT: wavy fluffy black hair, browline glasses, NU uniform (**placeholder** until the photo) |
| `joung_date.glb` | Joung at the Esplanade: dark blue boxy polo, sweatpants |
| `zed.glb` | Zed, a long-haired chihuahua: tan head and ears, white muzzle, chest and plume tail |
| `kooki.glb` | Kooki: white body, fawn patch on the back, grey tabby head and ears, blue eyes |
| `bouquet.glb` | One yellow sunflower with baby's breath, lilac wrapping and a lavender satin bow |
| `phone.glb` | Zena's phone (the game draws the Notes screen onto it live) |
| `tteok_cup.glb` | A paper cup of tteokbokki with picks |

**The rig.** Each character is a hierarchy of empties (`Hips`, `Torso`, `ArmL`, `ArmR`, `LegL`, `LegR`, `Head`) at the same pivot points as the game's animation rig. The game moves the meshes onto its own pivots (`applyModel` in `CharacterFactory.ts` and `PetController.ts`). Walking, sitting, reaching and looking keep working with no skinning or animation data. Pets use `Body`, `Head`, `Leg0`–`Leg3` and `Tail` (Kooki's tail is `TailSeg0`–`TailSeg3`).

**The source.** `little-things-models.blend` (in your `Pics/little-things-models` folder) holds the Python build scripts as text blocks: `tlt_lib`, `tlt_human`, `tlt_zena`, `tlt_joung`, `tlt_pets` and `tlt_props`. Edit a colour or shape there, run the scripts, and re-export. Or edit the models by hand in Blender, keeping the empty names and positions.

**Editing the models yourself.**
1. Change anything in Blender: move, sculpt, recolour. Keep the empties (`Hips`, `Torso`, `Head`, `ArmL`… or `Body`, `Leg0`…, `Tail`) and keep each part parented under the right one.
2. In the **Scripting** tab, open the text `tlt_export_all` and press **Run Script**. It re-exports all nine models from the scene as it is now into `Pics/little-things-models/`. It doesn't rebuild anything, so your edits are kept. (Don't run the `tlt_lib` / `tlt_zena` … builder scripts: they regenerate the models from code and would wipe hand edits.)
3. Copy the new `.glb` files into `public/assets/models/`, then `npm run build` (or `npm run build:standalone`).
4. Save your `.blend` (Ctrl+S) so the edits aren't lost.

**Changing a colour** (for example the uniform): in Blender, click the part and open the **Material** tab (red sphere icon). Change **Base Color** under Principled BSDF. Every part using that material changes together. The uniform materials are `joung_uniform_top` (the shirt, now blue), `joung_uniform_trim` (collar and sleeve bands, now white), `joung_uniform_gold` (badge centre) and `joung_slacks` (trousers). Then export as in step 2.

**Hosting.** Some hosts refuse `.glb` files. `npm run build:standalone` therefore also writes each model as a self-contained `.gltf.json`, which the game rebuilds in memory. If a model fails to load, that character falls back to the built-in procedural look.

Audio is fully procedural (Web Audio), so there are no sound files.

## 6. Test report

**A. Automated headless playthroughs** (`scripts/playtest.py`, Chromium + SwiftShader software WebGL). These drive the real game with keyboard and click input and fail on any console error or softlock.

| Run | Path | Result |
|---|---|---|
| Desktop 1024×576, keyboard | Afternoon LRT cutscene → phone question → Tamtam hand-off → Esplanade → **buy tteokbokki** → **eat it beside the river** → sunflower → bench → letter → Zed & Kooki → **Yes** → Memory Garden → journal (5/5) → keepsake → Restart | ✅ pass, 0 console errors |
| Desktop 1024×576, keyboard | same through the proposal → **Can we talk?** → free roam → sit again | ✅ pass, 0 console errors |

Assertions checked on every run:
- The keychain memory unlocks in the cutscene.
- The final bench stays locked until the tteokbokki has been bought *and eaten* and the sunflower given.
- Zed and Kooki stay hidden during letter arrival and while reading.
- The letter never closes by itself, and catching it twice can't run the scene twice.
- Save data persists.
- No console errors.

**B. Real browser on a real GPU** (the Claude desktop app's built-in browser). The published game ran start to finish in `#autoplay` mode with all nine Blender models loaded, at 72–144 fps (vsync-capped).

**Not tested:** a physical phone, Firefox, PWA install, offline play, and `npm run build` itself (see Known limitations).

## 7. Known limitations / unfinished

- **Personal details are placeholders** (section 1), including the letter text.
- **Joung's NU uniform and the Tamtam charm are placeholders** until reference photos are added.
- Rigging is procedural: limbs swing and bend at the shoulder and hip, with no elbows or knees. Hand-offs are staged with reaches and smooth object moves.
- The Esplanade layout is a stylized, compact interpretation, not a reproduction of the real place.
- Crowd NPCs follow fixed walking lanes and step aside for the couple. They have no real pathfinding.
- Saves are per-browser (`localStorage`) and do not sync between devices. The chosen answer is only stored if "Remember my answer on this device" is turned on in the menu.
- In this build environment, `npm install` was blocked, so `npm run build` (Vite) itself has not been run. The code was type-checked with `tsc` and bundled with esbuild, which produced the tested builds. Run `npm install && npm run build` once on your machine before deploying.
