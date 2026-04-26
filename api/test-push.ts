import Redis from 'ioredis';
import webpush from 'web-push';

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || "BNmvP2Pkwh_HsZOVNyh0JSH2oBZAWjODRgauJ-yum6IMbZudPhnOiUZKQcMYr8LuecRC92-ZZb-F-p8LC6p98G4";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "AbgQ_mz1bE1tg9HLvocXnyAdAp7v6ocNn1LP5O7FpRI";

webpush.setVapidDetails(
  'mailto:jeronimo@example.com',
  VAPID_PUBLIC,
  VAPID_PRIVATE
);

const redisUrl = process.env.pastilleroapp_REDIS_URL || process.env.REDIS_URL || process.env.KV_URL;
const redis = redisUrl ? new Redis(redisUrl) : null;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { user } = req.body;
  if (!user) return res.status(400).json({ error: 'Falta usuario' });

  if (!redis) return res.status(500).json({ error: 'Redis no configurado' });

  try {
    const subKey = `pillapp:user:${user}:subscriptions`;
    const rawSubs = await redis.get(subKey);
    
    if (!rawSubs) {
      return res.status(404).json({ error: 'No se encontraron suscripciones para este dispositivo' });
    }

    const subs = JSON.parse(rawSubs);
    let sent = 0;

    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub, JSON.stringify({
          title: '🧪 Prueba de Notificación',
          body: '¡Excelente! Tu celular está correctamente vinculado para recibir avisos del servidor.',
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          data: { url: '/' }
        }));
        sent++;
      } catch (err) {
        console.error('Error sending test push:', err);
      }
    }

    return res.status(200).json({ success: true, notificationsSent: sent });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno' });
  }
}
