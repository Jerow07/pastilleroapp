import { Redis } from '@upstash/redis';
import webpush from 'web-push';

// Configurar VAPID
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || "BNmvP2Pkwh_HsZOVNyh0JSH2oBZAWjODRgauJ-yum6IMbZudPhnOiUZKQcMYr8LuecRC92-ZZb-F-p8LC6p98G4";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "AbgQ_mz1bE1tg9HLvocXnyAdAp7v6ocNn1LP5O7FpRI";

webpush.setVapidDetails(
  'mailto:example@yourdomain.com',
  VAPID_PUBLIC,
  VAPID_PRIVATE
);

// Inicializamos Redis (Upstash/Vercel KV)
const redis = (process.env.pastilleroapp_REDIS_URL || process.env.KV_REST_API_URL) 
  ? new Redis({
      url: process.env.pastilleroapp_REDIS_URL || process.env.KV_REST_API_URL || '',
      token: process.env.pastilleroapp_REDIS_TOKEN || process.env.KV_REST_API_TOKEN || '',
    })
  : null;

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method === 'GET') {
      const user = req.query.user?.toString().trim().toLowerCase();
      
      if (!user) {
        return res.status(400).json({ error: 'Falta el parámetro user' });
      }

      if (!redis) {
        return res.status(500).json({ error: 'Redis no configurado' });
      }

      const data = await redis.get(`pillapp:user:${user}:pills`);
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const user = req.body.user?.toString().trim().toLowerCase();
      const { pills, name } = req.body;

      if (!user) {
        return res.status(400).json({ error: 'Se requiere user' });
      }

      const key = `pillapp:user:${user}:pills`;

      if (!redis) {
        return res.status(500).json({ error: 'Redis no configurado' });
      }

      const isNewUser = await redis.sismember('pillapp:all_users', user) === 0;
      await redis.sadd('pillapp:all_users', user);
      if (name) await redis.hset('pillapp:user_names', { [user]: name });
      if (pills) await redis.set(key, pills);

      // Notificar al Admin si entra un nuevo usuario
      if (isNewUser && user !== 'admin-jeronimo') {
        const adminSubKey = `pillapp:user:admin-jeronimo:subscriptions`;
        const rawAdminSubs = await redis.get(adminSubKey);
        if (rawAdminSubs) {
          const adminSubs = (rawAdminSubs as any);
          for (const sub of adminSubs) {
            try {
              await webpush.sendNotification(sub, JSON.stringify({
                title: '🚀 ¡Nuevo Usuario!',
                body: `${name || 'Alguien'} se ha unido con el código: ${user}`,
                icon: '/pwa-192x192.png'
              }));
            } catch (e) {}
          }
        }
      }

      // Trigger Push Notifications si hay stock bajo
      const lowStockPills = (pills || []).filter((p: any) => p.stockEnabled && p.totalStock !== undefined && p.totalStock <= (p.quantityPerDose || 1) * 3);
      
      if (lowStockPills.length > 0) {
        const subKey = `pillapp:user:${user}:subscriptions`;
        const rawSubs = await redis.get(subKey);
        if (rawSubs) {
          const subs = (rawSubs as any);
          for (const sub of subs) {
            try {
              await webpush.sendNotification(sub, JSON.stringify({
                title: '¡Stock bajo!',
                body: `Te queda poco de: ${lowStockPills.map(p => p.name).join(', ')}`,
                icon: '/pwa-192x192.png'
              }));
            } catch (err) {
              console.error('Error sending push to sub:', err);
            }
          }
        }
      }

      return res.status(200).json({ success: true, pills });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
