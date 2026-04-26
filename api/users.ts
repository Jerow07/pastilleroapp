import Redis from 'ioredis';

const redisUrl = process.env.pastilleroapp_REDIS_URL || process.env.REDIS_URL || process.env.KV_URL;
const redis = redisUrl ? new Redis(redisUrl) : null;

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'DELETE') {
    const { user } = req.query;
    if (!user) return res.status(400).json({ error: 'Falta el código de usuario' });
    if (user === 'admin-jeronimo') return res.status(403).json({ error: 'No se puede borrar al administrador' });

    try {
      if (!redis) return res.status(500).json({ error: 'Redis no configurado' });

      const normalizedUser = user.toString().toLowerCase();
      
      // Borrar de la lista global
      await redis.srem('pillapp:all_users', normalizedUser);
      // Borrar nombre
      await redis.hdel('pillapp:user_names', normalizedUser);
      // Borrar pastillas
      await redis.del(`pillapp:user:${normalizedUser}:pills`);
      // Borrar suscripciones
      await redis.del(`pillapp:user:${normalizedUser}:subscriptions`);

      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: 'Error al borrar usuario' });
    }
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  try {
    if (!redis) {
       return res.status(200).json([{ code: 'admin-jeronimo', name: 'Jeronimo (Local)' }]);
    }

    const codes = await redis.smembers('pillapp:all_users');
    const names = await redis.hgetall('pillapp:user_names');
    const usersInfo = codes.map(code => ({ code, name: names[code] || 'Anónimo' }));

    return res.status(200).json(usersInfo);
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
