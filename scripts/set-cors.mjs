// Apply cors.json to the Firebase Storage bucket using a service account key.
// Run: node scripts/set-cors.mjs
import { Storage } from "@google-cloud/storage";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot  = resolve(__dirname, "..");

const sa   = JSON.parse(readFileSync(resolve(__dirname, "sa.json"), "utf8"));
const cors = JSON.parse(readFileSync(resolve(repoRoot, "cors.json"), "utf8"));

const BUCKET = "eldoria-web.appspot.com";

const storage = new Storage({
  projectId: sa.project_id,
  credentials: { client_email: sa.client_email, private_key: sa.private_key },
});

const bucket = storage.bucket(BUCKET);

console.log(`Applying CORS to gs://${BUCKET} …`);
await bucket.setCorsConfiguration(cors);

const [meta] = await bucket.getMetadata();
console.log("✓ Done. Current CORS config on the bucket:");
console.log(JSON.stringify(meta.cors, null, 2));
