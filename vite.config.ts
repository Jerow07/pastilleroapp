import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import Redis from 'ioredis'

// Configuración única de Redis para desarrollo
const redisUrl = "redis://default:6SNoQEYX9Fp4HhZ9shmBJkGpuXKIs9NN@redis-17812.crce278.sa-east-1-2.ec2.cloud.redislabs.com:17812";
const redis = new Redis(redisUrl);

export default defineConfig({
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
        server.middlewares.use(async (req, res, next) => {
          const url = req.url || '';
          
          if (url.startsWith('/api/pills') || url.startsWith('/api/users')) {
            const parsedUrl = new URL(url, `http://${req.headers.host}`);
            
            try {
              if (req.method === 'GET') {
                if (parsedUrl.pathname === '/api/users') {
                  const codes = await redis.smembers('pillapp:all_users');
                  const names = await redis.hgetall('pillapp:user_names');
                  const usersInfo = codes.map(code => ({ code, name: names[code] || 'Anónimo' }));
                  res.setHeader('Content-Type', 'application/json');
                  return res.end(JSON.stringify(usersInfo));
                }

                const user = parsedUrl.searchParams.get('user');
                const data = await redis.get(`pillapp:user:${user}:pills`);
                res.setHeader('Content-Type', 'application/json');
                return res.end(data || '[]');
              }

              if (req.method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', async () => {
                  try {
                    const { user, pills, name } = JSON.parse(body);
                    await redis.sadd('pillapp:all_users', user);
                    if (name) await redis.hset('pillapp:user_names', user, name);
                    if (pills) await redis.set(`pillapp:user:${user}:pills`, JSON.stringify(pills));
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: true }));
                  } catch (e) {
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
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ success: true }));
          }

          next();
        });
      }
    },
    VitePWA({
      registerType: 'autoUpdate',
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
})
