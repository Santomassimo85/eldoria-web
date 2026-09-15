// Copia l'APK firmato appena costruito in public/app/, da dove Vercel lo serve
// (https://eldoria-web-delta.vercel.app/app/crit-happens.apk). Vedi docs/android/README.md.
import { copyFileSync, mkdirSync, statSync } from "node:fs";
const src = "android/app/build/outputs/apk/release/app-release.apk";
const dst = "public/app/crit-happens.apk";
mkdirSync("public/app", { recursive: true });
copyFileSync(src, dst);
console.log(`APK copiato in ${dst} (${(statSync(dst).size / 1048576).toFixed(1)} MB)`);
