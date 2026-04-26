import Redis from 'ioredis';
import fs from 'fs';
import path from 'path';

const redisUrl = process.env.pastilleroapp_REDIS_URL || process.env.REDIS_URL || process.env.KV_URL;
const redis = redisUrl ? new Redis(redisUrl) : null;

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
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method === 'POST') {
      const { user, subscription } = req.body;

      if (!user || !subscription) {
        return res.status(400).json({ error: 'Se requiere user y subscription' });
      }

      const key = `pillapp:user:${user}:subscriptions`;

      if (!redis) {
        const db = getLocalData();
        const subs = db[key] || [];
        // Evitar duplicados
        if (!subs.find((s: any) => s.endpoint === subscription.endpoint)) {
          subs.push(subscription);
        }
        db[key] = subs;
        saveLocalData(db);
        return res.status(200).json({ success: true, simulated: true });
      }

      const rawData = await redis.get(key);
      const subs = rawData ? JSON.parse(rawData) : [];
      
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
