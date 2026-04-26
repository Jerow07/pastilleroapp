import { Redis } from 'ioredis';

const redisUrl = process.env.pastilleroapp_REDIS_URL || process.env.REDIS_URL || process.env.KV_URL;
const redis = redisUrl ? new Redis(redisUrl) : null;

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method === 'POST') {
      const { user, subscription } = req.body;
      const normalizedUser = user?.toString().trim().toLowerCase();

      if (!normalizedUser || !subscription) {
        return res.status(400).json({ error: 'Se requiere user y subscription' });
      }

      const key = `pillapp:user:${normalizedUser}:subscriptions`;

      if (!redis) {
        return res.status(500).json({ error: 'Redis no configurado' });
      }

      const rawData = await redis.get(key);
      const subs: any[] = rawData ? JSON.parse(rawData) : [];
      
      if (!subs.find((s: any) => s.endpoint === subscription.endpoint)) {
        subs.push(subscription);
        await redis.set(key, JSON.stringify(subs));
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    console.error('Subscribe API Error:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
