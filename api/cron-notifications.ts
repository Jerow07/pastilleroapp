import { Redis } from 'ioredis';
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
    // 1. Obtener la hora y fecha actual en Argentina (GMT-3)
    const now = new Date();
    const dateStr = formatInTimeZone(now, 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
    const dayOfWeek = parseInt(formatInTimeZone(now, 'America/Argentina/Buenos_Aires', 'i')) % 7;
    
    // Generamos una lista de los últimos 5 minutos para ser resilientes a retrasos del cron
    const checkMinutes = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(now.getTime() - i * 60000);
      checkMinutes.push(formatInTimeZone(d, 'America/Argentina/Buenos_Aires', 'HH:mm'));
    }
    
    // 2. Obtener todos los usuarios
    const users = await redis.smembers('pillapp:all_users');
    let notificationsSent = 0;

    for (const user of users) {
      const pillsKey = `pillapp:user:${user}:pills`;
      const rawPills = await redis.get(pillsKey);
      if (!rawPills) continue;

      const pills = JSON.parse(rawPills);
      
      for (const p of pills) {
        // Verificar si toca hoy y no está borrada
        const isScheduledToday = !p.frequency || p.frequency === 'daily' || (p.frequency === 'specific_days' && p.selectedDays?.includes(dayOfWeek));
        if (!isScheduledToday || p.deleted) continue;

        const times = p.times && p.times.length > 0 ? p.times : [p.time];
        const dueTime = times.find((t: string) => checkMinutes.includes(t));

        if (dueTime) {
          const lockKey = `pillapp:notified:${user}:${p.id}:${dateStr}:${dueTime}`;
          const alreadyNotified = await redis.get(lockKey);
          
          if (!alreadyNotified) {
            const subKey = `pillapp:user:${user}:subscriptions`;
            const rawSubs = await redis.get(subKey);
            if (!rawSubs) continue;

            const subs = JSON.parse(rawSubs);
            const payload = JSON.stringify({
              title: `⏰ ¡Hora de tu ${p.name}!`,
              body: `Te toca tomar ${p.dose || 'tu dosis'}. ¡No te olvides!`,
              icon: '/pwa-192x192.png'
            });

            for (const sub of subs) {
              try {
                await webpush.sendNotification(sub, payload);
                notificationsSent++;
              } catch (err: any) {
                // Silently handle expired subs
              }
            }
            await redis.set(lockKey, 'true', 'EX', 600); 
          }
        }
      }
    }

    return res.status(200).json({ 
      success: true, 
      notificationsSent,
      window: checkMinutes
    });
  } catch (error: any) {
    console.error('[Cron Error]:', error);
    return res.status(500).json({ error: 'Error interno' });
  }
}
