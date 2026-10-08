import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, type Plugin } from 'vitest/config'
import { handleApiRequest } from './mock/handler.ts'

// Serves the same handler that Vercel runs from /api, so `npm run dev`
// needs no extra server and behaves exactly like production.
function mockApi(): Plugin {
  const middleware = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.startsWith('/api/')) return next()
    const controller = new AbortController()
    res.on('close', () => controller.abort())
    const response = await handleApiRequest(
      new Request(new URL(req.url, 'http://localhost'), { method: req.method, signal: controller.signal }),
    )
    if (res.destroyed) return
    res.statusCode = response.status
    response.headers.forEach((value, key) => res.setHeader(key, value))
    res.end(await response.text())
  }
  return {
    name: 'mock-api',
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  }
}

export default defineConfig({
  plugins: [react(), mockApi()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'mock/**/*.test.ts', 'shared/**/*.test.ts'],
  },
})
