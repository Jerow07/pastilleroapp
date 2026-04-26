import Redis from 'ioredis';
import fs from 'fs';
import path from 'path';
import webpush from 'web-push';

// Configurar VAPID
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || "BNmvP2Pkwh_HsZOVNyh0JSH2oBZAWjODRgauJ-yum6IMbZudPhnOiUZKQcMYr8LuecRC92-ZZb-F-p8LC6p98G4";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "AbgQ_mz1bE1tg9HLvocXnyAdAp7v6ocNn1LP5O7FpRI";

webpush.setVapidDetails(
  'mailto:example@yourdomain.com',
  VAPID_PUBLIC,
  VAPID_PRIVATE
);

// Buscar variable de Redis genérica o la específica que inyectó Vercel
const redisUrl = process.env.pastilleroapp_REDIS_URL || process.env.REDIS_URL || process.env.KV_URL;

// Inicializamos ioredis si existe la URL
const redis = redisUrl ? new Redis(redisUrl) : null;

// Archivo local de base de datos para desarrollo
const LOCAL_DB_PATH = path.join(process.cwd(), '.local-db.json');

function getLocalData() {
  if (!fs.existsSync(LOCAL_DB_PATH)) return {};
  try {
    const data = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return {};
  }
}

function saveLocalData(data: any) {
  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2));
}

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
      const { user } = req.query;
      
      if (!user) {
        return res.status(400).json({ error: 'Falta el parámetro user' });
      }

      const data = await redis!.get(`pillapp:user:${user}:pills`);
      return res.status(200).json(JSON.parse(data || '[]'));
    }

    if (req.method === 'POST') {
      const { user, pills, name } = req.body;

      if (!user) {
        return res.status(400).json({ error: 'Se requiere user' });
      }

      const key = `pillapp:user:${user}:pills`;

      if (!redis) {
        const db = getLocalData();
        if (pills) db[key] = pills;
        if (name) db[`name:${user}`] = name;
        saveLocalData(db);
        return res.status(200).json({ success: true, simulated: true });
      }

      const isNewUser = await redis.sismember('pillapp:all_users', user) === 0;
      await redis.sadd('pillapp:all_users', user);
      if (name) await redis.hset('pillapp:user_names', user, name);
      if (pills) await redis.set(key, JSON.stringify(pills));

      // Notificar al Admin si entra un nuevo usuario
      if (isNewUser && user !== 'admin-jeronimo') {
        const adminSubKey = `pillapp:user:admin-jeronimo:subscriptions`;
        const rawAdminSubs = await redis.get(adminSubKey);
        if (rawAdminSubs) {
          const adminSubs = JSON.parse(rawAdminSubs);
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
      const lowStockPills = pills.filter(p => p.stockEnabled && p.totalStock !== undefined && p.totalStock <= (p.quantityPerDose || 1) * 3);
      
      if (lowStockPills.length > 0) {
        const subKey = `pillapp:user:${user}:subscriptions`;
        const rawSubs = await redis.get(subKey);
        if (rawSubs) {
          const subs = JSON.parse(rawSubs);
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
