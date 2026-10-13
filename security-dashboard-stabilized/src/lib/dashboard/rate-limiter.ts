export interface RateLimiterProvider {
  isRateLimited(key: string, limit: number, windowMs: number): Promise<boolean>;
}

export class MemoryRateLimiterProvider implements RateLimiterProvider {
  private cache = new Map<string, { count: number; resetTime: number }>();

  async isRateLimited(key: string, limit: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    const data = this.cache.get(key);

    if (!data || now > data.resetTime) {
      this.cache.set(key, { count: 1, resetTime: now + windowMs });
      return false;
    }

    if (data.count >= limit) {
      return true;
    }

    data.count++;
    return false;
  }
}

export class RedisRateLimiterProvider implements RateLimiterProvider {
  private redis: any = null;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        const Redis = require("ioredis");
        this.redis = new Redis(redisUrl);
      } catch (e) {
        console.warn("Failed to load ioredis, using Memory fallback inside Redis Provider:", e);
      }
    }
  }

  async isRateLimited(key: string, limit: number, windowMs: number): Promise<boolean> {
    if (!this.redis) {
      // Fallback
      if (!globalThis.fallbackLimiter) {
        globalThis.fallbackLimiter = new MemoryRateLimiterProvider();
      }
      return globalThis.fallbackLimiter.isRateLimited(key, limit, windowMs);
    }

    try {
      const current = await this.redis.incr(key);
      if (current === 1) {
        await this.redis.pexpire(key, windowMs);
      }
      return current > limit;
    } catch (error) {
      console.error("Redis rate limiting error, fallback to allowing:", error);
      return false;
    }
  }
}

declare global {
  var fallbackLimiter: MemoryRateLimiterProvider | undefined;
  var globalLimiter: RateLimiterProvider | undefined;
}

// Central Factory
export function getRateLimiter(): RateLimiterProvider {
  if (globalThis.globalLimiter) {
    return globalThis.globalLimiter;
  }

  const useRedis = process.env.REDIS_URL && process.env.NODE_ENV === "production";
  const limiter = useRedis ? new RedisRateLimiterProvider() : new MemoryRateLimiterProvider();
  
  if (process.env.NODE_ENV !== "production") {
    globalThis.globalLimiter = limiter;
  }

  return limiter;
}
