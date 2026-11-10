import { defineConfig } from 'vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { checkout, gitCommit } from './scripts/lib/checkout.ts'

const here = checkout()

const config = defineConfig({
  // GitHub Pages serves the game from /doener-rush/; the router basepath follows this
  base: process.env.BASE_PATH ?? '/',
  resolve: { tsconfigPaths: true },
  // one port per checkout; fail loudly instead of drifting to another port a tool won't find
  server: { port: here.port, strictPort: true },
  // lets `pnpm game doctor` prove the running server serves this checkout
  define: {
    __BUILD_INFO__: JSON.stringify({ root: here.root, commit: gitCommit(here.root), startedAt: new Date().toISOString() }),
  },
  plugins: [tailwindcss(), tanstackStart({ spa: { enabled: true } }), viteReact()],
})

export default config
