/**
 * CUSTOMIZATION FILE — appearance, names and colours.
 *
 * Everything marked PLACEHOLDER is a stand-in because the real details
 * (her look, clothing, Zed's breed/colours, Kooki's colours, the Tamtam
 * charm's design) were not provided. Change the values here; no game code
 * needs to be touched.
 */

export type HairStyle = 'fluffy' | 'long' | 'bob' | 'ponytail' | 'bun';

export interface HumanLook {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  top: string;
  bottom: string;
  bottomType: 'pants' | 'skirt';
  shoes: string;
  /** cheek blush colour */
  blush: string;
}

export interface PetLook {
  fur: string;
  accent: string; // belly / muzzle / paws
  eyes: string;
  collar: string;
  /** overall scale, 1 = default */
  size: number;
}

export const NAMES = {
  /** Shown as the speaker tag for the protagonist. */
  protagonist: 'Joung',
  /** Shown as the speaker tag for the girl. */
  girl: 'Zena',
  dog: 'Zed',
  cat: 'Kooki',
};

/** Canon: the protagonist has fluffy black hair. Clothing is a PLACEHOLDER. */
export const PROTAGONIST: HumanLook = {
  skin: '#e9b98f',
  hair: '#17161d',
  hairStyle: 'fluffy',
  top: '#3f5d8f', // PLACEHOLDER
  bottom: '#2a2c3d', // PLACEHOLDER
  bottomType: 'pants',
  shoes: '#f1eee8',
  blush: '#f29a9a',
};

/** PLACEHOLDER — her real hairstyle, skin tone and clothing were not specified. */
export const GIRL: HumanLook = {
  skin: '#f0c6a2',
  hair: '#3a2723',
  hairStyle: 'long', // 'long' | 'bob' | 'ponytail' | 'bun'
  top: '#f2a7c3',
  bottom: '#f6efe4',
  bottomType: 'skirt',
  shoes: '#fbf4ea',
  blush: '#f58fa4',
};

/** PLACEHOLDER — Zed's breed, colours and markings were not specified. */
export const ZED: PetLook = {
  fur: '#c98f55',
  accent: '#f6e7d2',
  eyes: '#1b1410',
  collar: '#8b5cf6',
  size: 1,
};

/** PLACEHOLDER — Kooki's colours and markings were not specified. */
export const KOOKI: PetLook = {
  fur: '#8d8a96',
  accent: '#f3f0ec',
  eyes: '#9bd26a',
  collar: '#f2b84b',
  size: 1,
};

export const KEYCHAIN = {
  charm: '#ffd36e',
  accent: '#ff9fb8',
  ring: '#c9ccd6',
};

export const SUNFLOWER = {
  petals: '#8a4fff',
  petalGlow: '#5b2bd1',
  center: '#f4c04e',
  seeds: '#5a3a1e',
  wrap: '#d9b98c',
  ribbon: '#b48cff',
};

/**
 * Blender-made models (public/assets/models). Built from the reference photos
 * of Zena, Joung, Kooki and Zed. If a file is missing the game falls back to
 * the procedural look configured above.
 */
export const MODELS = {
  zenaLrt: 'assets/models/zena_lrt.glb',
  zenaDate: 'assets/models/zena_date.glb',
  joungLrt: 'assets/models/joung_lrt.glb',
  joungDate: 'assets/models/joung_date.glb',
  zed: 'assets/models/zed.glb',
  kooki: 'assets/models/kooki.glb',
  bouquet: 'assets/models/bouquet.glb',
  phone: 'assets/models/phone.glb',
  tteokCup: 'assets/models/tteok_cup.glb',
};
export type ModelKey = keyof typeof MODELS;

/** Rendering defaults; the player can change some of these in the menu. */
export const RENDER = {
  maxPixelRatioDesktop: 1.75,
  maxPixelRatioMobile: 1.5,
  crowdCount: 46,
  crowdCountLow: 22,
};
