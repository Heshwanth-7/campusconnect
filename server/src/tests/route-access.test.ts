import request from 'supertest';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { app } from '../app.ts';
import { requireAuth } from '../middleware/require-auth.ts';

// Express exposes the mounted router stack, including routes registered by loops.
type Method = 'get' | 'post' | 'patch' | 'delete' | 'put' | 'head' | 'options';
type Layer = {
  rawPath: string;
  handle: { stack?: Layer[] };
  route?: { methods: Partial<Record<Method, boolean>>; stack: { handle: unknown }[] };
};
const publicRoutes = new Set([
  'GET /api/health',
  ...['register', 'verify-email', 'resend-verification', 'login', 'forgot-password', 'reset-password',
    'logout', 'refresh'].map(action => 'POST /api/auth/' + action),
]);
function collect(stack: Layer[], base = '', inherited: string[] = []) {
  const routes: { method: Method; path: string; guarded: boolean }[] = [];
  const guards = [...inherited];
  for (const layer of stack) {
    if (typeof layer.rawPath !== 'string') throw new Error('Review non-literal route in the access inventory.');
    const path = (base + layer.rawPath).replace(/\/$/, '') || '/';
    if (layer.handle === requireAuth) guards.push(path);
    if (layer.rawPath !== '/' && !layer.route && !layer.handle.stack && layer.handle !== requireAuth) {
      throw new Error('Review path-mounted middleware in the access inventory: ' + path);
    }
    if (layer.handle.stack) routes.push(...collect(layer.handle.stack, path === '/' ? '' : path, guards));
    if (layer.route) {
      const guarded = guards.some(prefix => prefix === '/' || path === prefix || path.startsWith(prefix + '/'))
        || layer.route.stack[0]?.handle === requireAuth;
      for (const method of Object.keys(layer.route.methods) as Method[]) routes.push({ method, path, guarded });
    }
  }
  return routes;
}
const routes = collect(app.router.stack as unknown as Layer[]);
const origin = 'http://localhost:5173';
beforeAll(() => { vi.stubEnv('CLIENT_URL', origin); });
afterAll(() => vi.unstubAllEnvs());

test('the public allow-list exactly matches routes outside the access guard', () => {
  expect(new Set(routes.filter(r => !r.guarded).map(r => r.method.toUpperCase() + ' ' + r.path))).toEqual(publicRoutes);
});

test.each(routes)('$method $path declares its access policy', async ({ method, path, guarded }) => {
  if (publicRoutes.has(method.toUpperCase() + ' ' + path)) return;
  expect(guarded).toBe(true);
  const url = path.replace(/:\w+/g, '00000000-0000-4000-8000-000000000001');
  await request(app)[method](url).set('Origin', origin).expect(401);
});
