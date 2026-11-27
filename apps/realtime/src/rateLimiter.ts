interface Bucket {
  tokens: number;
  lastRefill: number;
}

export class SocketRateLimiter {
  private buckets = new Map<string, Bucket>();

  consume(
    key: string,
    maxTokens: number,
    refillPerSecond: number,
  ): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: maxTokens, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    const elapsedSec = Math.max(0, (now - bucket.lastRefill) / 1000);
    bucket.tokens = Math.min(maxTokens, bucket.tokens + elapsedSec * refillPerSecond);
    bucket.lastRefill = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }
    return false;
  }

  clearPrefix(prefix: string): void {
    for (const k of this.buckets.keys()) {
      if (k.startsWith(prefix)) this.buckets.delete(k);
    }
  }
}
