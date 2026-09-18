import type { ImageMetadata } from "astro";
import content from "../data/content.json";

import heroNurse from "../assets/images/hero-nurse.jpg";
import heroNurseCutout from "../assets/images/hero-nurse-cutout.png";
import operatingRoomTeam from "../assets/images/operating-room-team.jpg";
import factoryBhatkal from "../assets/images/factory-bhatkal.jpg";
import factoryBhatkalCutout from "../assets/images/factory-bhatkal-cutout.png";
import mdPortrait from "../assets/images/md-sharath-kumar-shetty.jpg";
import gownModel from "../assets/images/surgical-gown-model.jpg";
import gownModelCutout from "../assets/images/surgical-gown-model-cutout.png";
import faceShields from "../assets/images/surgical-team-face-shields.jpg";
import faceShieldsCutout from "../assets/images/surgical-team-face-shields-cutout.png";
import dhrithiEmblem from "../assets/images/dhrithi-emblem.png";

export type ImageKey = keyof typeof content.images;

export const photos = {
  "hero-nurse": heroNurse,
  "operating-room-team": operatingRoomTeam,
  "factory-bhatkal": factoryBhatkal,
  "md-sharath-kumar-shetty": mdPortrait,
  "surgical-gown-model": gownModel,
  "surgical-team-face-shields": faceShields,
  "dhrithi-emblem": dhrithiEmblem,
} satisfies Record<ImageKey, ImageMetadata>;

export const cutouts = {
  "hero-nurse": heroNurseCutout,
  "factory-bhatkal": factoryBhatkalCutout,
  "surgical-gown-model": gownModelCutout,
  "surgical-team-face-shields": faceShieldsCutout,
} satisfies Partial<Record<ImageKey, ImageMetadata>>;

/** Alt text always comes from content.json; decorative images resolve to "". */
export function altFor(key: ImageKey): string {
  return content.images[key].alt;
}
