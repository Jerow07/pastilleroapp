import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    server: {
      port: 3000,
      host: true
    },
    plugins: [
      tailwindcss(),
      react(),
      {
        name: 'api-middleware',
        configureServer(server) {
          // Lazy-load Redis only in dev server (never during build)
        let redis: any = null;
        async function getRedis() {
          if (!redis) {
            const { default: Redis } = await import('ioredis');
            const redisUrl = env.pastilleroapp_REDIS_URL || env.REDIS_URL || '';
            if (!redisUrl) {
              console.warn('⚠️ No Redis URL found in .env files');
            }
            redis = new Redis(redisUrl);
          }
          return redis;
        }

        server.middlewares.use(async (req, res, next) => {
          const url = req.url || '';
          
          if (url.startsWith('/api/pills') || url.startsWith('/api/users')) {
            const parsedUrl = new URL(url, `http://${req.headers.host}`);
            const redis = await getRedis();
            
            try {
              if (req.method === 'GET') {
                if (parsedUrl.pathname === '/api/users') {
                  const codes = await redis.smembers('pillapp:all_users');
                  const names = await redis.hgetall('pillapp:user_names');
                  const usersInfo = codes.map((code: string) => ({ code, name: names[code] || 'Anónimo' }));
                  res.setHeader('Content-Type', 'application/json');
                  return res.end(JSON.stringify(usersInfo));
                }

                const user = parsedUrl.searchParams.get('user')?.trim().toLowerCase();
                const data = await redis.get(`pillapp:user:${user}:pills`);
                console.log(`[GET] User: ${user}, Pills found: ${data ? 'Yes' : 'No'}`);
                res.setHeader('Content-Type', 'application/json');
                return res.end(data || '[]');
              }

              if (req.method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', async () => {
                  try {
                    const payload = JSON.parse(body);
                    const user = payload.user?.trim().toLowerCase();
                    const { pills, name } = payload;
                    
                    console.log(`[POST] User: ${user}, Syncing pills: ${pills ? pills.length : 'No'}`);
                    
                    await redis.sadd('pillapp:all_users', user);
                    if (name) await redis.hset('pillapp:user_names', user, name);
                    if (pills) await redis.set(`pillapp:user:${user}:pills`, JSON.stringify(pills));
                    
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: true }));
                  } catch (e) {
                    console.error('POST Parse Error:', e);
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: 'Post error' }));
                  }
                });
                return;
              }
            } catch (error) {
              console.error('Vite Middleware Error:', error);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'API Error' }));
              return;
            }
          }
          
          if (url.startsWith('/api/subscribe')) {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
              try {
                const { user, subscription } = JSON.parse(body);
                if (!user || !subscription) {
                  res.statusCode = 400;
                  return res.end(JSON.stringify({ error: 'Missing user or subscription' }));
                }
                const redis = await getRedis();
                const key = `pillapp:user:${user.toLowerCase()}:subscriptions`;
                const rawData = await redis.get(key);
                const subs = rawData ? JSON.parse(rawData) : [];
                if (!subs.find((s: any) => s.endpoint === subscription.endpoint)) {
                  subs.push(subscription);
                  await redis.set(key, JSON.stringify(subs));
                }
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true }));
              } catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Subscribe error' }));
              }
            });
            return;
          }

          if (url.startsWith('/api/test-push')) {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
              try {
                const { user } = JSON.parse(body);
                const redis = await getRedis();
                const subKey = `pillapp:user:${user?.toLowerCase()}:subscriptions`;
                const rawSubs = await redis.get(subKey);
                if (!rawSubs) {
                  res.statusCode = 404;
                  return res.end(JSON.stringify({ error: 'No subscriptions found for this user' }));
                }
                const subs = JSON.parse(rawSubs);
                const { default: webpush } = await import('web-push');
                webpush.setVapidDetails(
                  'mailto:jeronimo@example.com',
                  env.VAPID_PUBLIC_KEY || "BNmvP2Pkwh_HsZOVNyh0JSH2oBZAWjODRgauJ-yum6IMbZudPhnOiUZKQcMYr8LuecRC92-ZZb-F-p8LC6p98G4",
                  env.VAPID_PRIVATE_KEY || "AbgQ_mz1bE1tg9HLvocXnyAdAp7v6ocNn1LP5O7FpRI"
                );
                let sent = 0;
                for (const sub of subs) {
                  try {
                    await webpush.sendNotification(sub, JSON.stringify({
                      title: '🧪 Prueba de Notificación',
                      body: '¡Excelente! Tu celular está correctamente vinculado.',
                      icon: '/pwa-192x192.png',
                      badge: '/favicon.png',
                      data: { url: '/' }
                    }));
                    sent++;
                  } catch (pushErr) {
                    console.error('Error sending push to endpoint:', sub.endpoint, pushErr);
                  }
                }
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, sent }));
              } catch (e) {
                console.error('Test Push Error:', e);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Test push error' }));
              }
            });
            return;
          }

          next();
        });
      }
    },
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
        type: 'module'
      },
      manifest: {
        name: 'Pastillero Virtual',
        short_name: 'Pastillero',
        description: 'Recordatorio simple de pastillas',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ]
  }
})
