import { Redis } from 'ioredis';
import { formatInTimeZone } from 'date-fns-tz';

const redisUrl = "redis://default:6SNoQEYX9Fp4HhZ9shmBJkGpuXKIs9NN@redis-17812.crce278.sa-east-1-2.ec2.cloud.redislabs.com:17812";
const redis = new Redis(redisUrl);

async function debug() {
  const user = 'admin-jeronimo';
  const nowArg = formatInTimeZone(new Date(), 'America/Argentina/Buenos_Aires', 'HH:mm');
  console.log('Current Time (Arg):', nowArg);

  const allUsers = await redis.smembers('pillapp:all_users');
  console.log('All Users:', allUsers);

  const pills = await redis.get(`pillapp:user:${user}:pills`);
  console.log('Pills for admin:', pills);

  const subs = await redis.get(`pillapp:user:${user}:subscriptions`);
  console.log('Subscriptions for admin:', subs);

  process.exit(0);
}

debug();
