import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import fs from 'node:fs'
import path from 'node:path'

// Reads public/firebase-messaging-sw.template.js (committed, with placeholders)
// and writes public/firebase-messaging-sw.js (gitignored) with values from .env.local
// substituted in. The service worker is a static file so it can't import env vars.
function injectMessagingSwConfig(env) {
  const swTemplate = path.resolve('public/firebase-messaging-sw.template.js')
  const swDest     = path.resolve('public/firebase-messaging-sw.js')
  return {
    name: 'inject-messaging-sw-config',
    buildStart() {
      if (!fs.existsSync(swTemplate)) return
      let content = fs.readFileSync(swTemplate, 'utf8')
      const map = {
        __FIREBASE_API_KEY__:            env.VITE_FIREBASE_API_KEY,
        __FIREBASE_AUTH_DOMAIN__:        env.VITE_FIREBASE_AUTH_DOMAIN,
        __FIREBASE_PROJECT_ID__:         env.VITE_FIREBASE_PROJECT_ID,
        __FIREBASE_STORAGE_BUCKET__:     env.VITE_FIREBASE_STORAGE_BUCKET,
        __FIREBASE_MESSAGING_SENDER_ID__: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        __FIREBASE_APP_ID__:             env.VITE_FIREBASE_APP_ID,
      }
      for (const [k, v] of Object.entries(map)) {
        if (v) content = content.split(k).join(v)
      }
      fs.writeFileSync(swDest, content)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), injectMessagingSwConfig(env)],
  }
})
