import Redis from 'ioredis';
import webpush from 'web-push';
import { formatInTimeZone } from 'date-fns-tz';

// Configurar VAPID
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
  // Solo permitir GET (para el cron)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Protección simple (opcional: Vercel Cron Header)
  // const authHeader = req.headers['authorization'];
  // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) { ... }

  if (!redis) {
    return res.status(500).json({ error: 'Redis no configurado' });
  }

  try {
    // 1. Obtener la hora actual en Argentina (GMT-3)
    const nowArg = formatInTimeZone(new Date(), 'America/Argentina/Buenos_Aires', 'HH:mm');
    const dayOfWeek = parseInt(formatInTimeZone(new Date(), 'America/Argentina/Buenos_Aires', 'i')) % 7; // 0=Dom, 1=Lun...
    
    console.log(`[Cron] Iniciando proceso de notificaciones para las ${nowArg} (Día: ${dayOfWeek})`);

    // 2. Obtener todos los usuarios
    const users = await redis.smembers('pillapp:all_users');
    let notificationsSent = 0;

    for (const user of users) {
      const pillsKey = `pillapp:user:${user}:pills`;
      const rawPills = await redis.get(pillsKey);
      if (!rawPills) continue;

      const pills = JSON.parse(rawPills);
      const pillsToNotify = pills.filter((p: any) => {
        // Verificar si toca hoy
        const isScheduledToday = !p.frequency || p.frequency === 'daily' || (p.frequency === 'specific_days' && p.selectedDays?.includes(dayOfWeek));
        if (!isScheduledToday || p.deleted) return false;

        // Verificar si coincide algún horario
        const times = p.times && p.times.length > 0 ? p.times : [p.time];
        return times.includes(nowArg);
      });

      if (pillsToNotify.length > 0) {
        // Buscar suscripciones
        const subKey = `pillapp:user:${user}:subscriptions`;
        const rawSubs = await redis.get(subKey);
        if (!rawSubs) continue;

        const subs = JSON.parse(rawSubs);
        for (const pill of pillsToNotify) {
          const payload = JSON.stringify({
            title: `⏰ ¡Hora de tu ${pill.name}!`,
            body: `Te toca tomar ${pill.dose}. ¡No te olvides!`,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            data: { url: '/' }
          });

          for (const sub of subs) {
            try {
              await webpush.sendNotification(sub, payload);
              notificationsSent++;
            } catch (err: any) {
              if (err.statusCode === 410 || err.statusCode === 404) {
                // Suscripción expirada, removerla en el futuro
              }
            }
          }
        }
      }
    }

    return res.status(200).json({ 
      success: true, 
      time: nowArg, 
      usersProcessed: users.length,
      notificationsSent 
    });
  } catch (error) {
    console.error('[Cron Error]:', error);
    return res.status(500).json({ error: 'Error interno' });
  }
}
