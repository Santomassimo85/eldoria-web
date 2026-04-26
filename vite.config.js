import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import fs from 'node:fs'
import path from 'node:path'

// Injects Firebase config from .env.local into firebase-messaging-sw.js
// at dev/build time so the service worker (a static file) can use it.
function injectMessagingSwConfig(env) {
  const swSrc = path.resolve('public/firebase-messaging-sw.js')
  return {
    name: 'inject-messaging-sw-config',
    buildStart() {
      if (!fs.existsSync(swSrc)) return
      let content = fs.readFileSync(swSrc, 'utf8')
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
      fs.writeFileSync(swSrc, content)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), injectMessagingSwConfig(env)],
  }
})
