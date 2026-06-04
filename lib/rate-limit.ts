import { createClient, type RedisClientType } from 'redis';

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

let redisClient: RedisClientType | null = null;
let redisReady: Promise<void> | null = null;
const fallbackStore = new Map<string, { count: number; resetAt: number }>();

export async function getRedisClient() {
  const redisUrl = process.env.REDIS_URL || process.env.KV_URL || process.env.UPSTASH_REDIS_URL;

  if (!redisUrl) {
    return null;
  }

  if (!redisClient) {
    redisClient = createClient({ url: redisUrl });
    redisClient.on('error', (error) => {
      console.error('Redis error:', error);
    });
  }

  if (!redisReady) {
    redisReady = redisClient.connect().then(() => undefined);
  }

  try {
    await redisReady;
    return redisClient;
  } catch (error) {
    console.warn('[RateLimit] Redis unavailable, using in-memory fallback:', error);
    redisReady = null;
    redisClient = null;
    return null;
  }
}

export async function checkRateLimit({ key, limit, windowMs }: RateLimitOptions): Promise<RateLimitResult> {
  const client = await getRedisClient();
  const now = Date.now();

  if (client) {
    const redisKey = `rate:${key}`;
    const count = await client.incr(redisKey);
    if (count === 1) {
      await client.pExpire(redisKey, windowMs);
    }

    const ttl = await client.pTTL(redisKey);
    const remaining = Math.max(0, limit - count);

    return {
      allowed: count <= limit,
      remaining,
      resetAt: ttl > 0 ? now + ttl : now + windowMs,
    };
  }

  const current = fallbackStore.get(key);
  if (!current || now > current.resetAt) {
    const resetAt = now + windowMs;
    fallbackStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  current.count += 1;
  fallbackStore.set(key, current);

  return {
    allowed: current.count <= limit,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
  };
}

export function getClientRateLimitKey(scope: string, request: Request | { headers: Headers }) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = forwardedFor?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown';

  return `${scope}:${ip}`;
}
