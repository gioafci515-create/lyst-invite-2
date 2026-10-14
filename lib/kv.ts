import { promises as fs } from "fs";
import path from "path";
import { Redis } from "@upstash/redis";

/**
 * One tiny key-value interface for everything the site stores.
 *  - Production (Vercel): Upstash Redis, via the integration's env vars.
 *  - Local development without Redis: a JSON file in ./data.
 * Hash and set operations are atomic on Redis, so concurrent serverless instances can't lose writes.
 */
export interface KV {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  /** set only if the key doesn't exist yet */
  setnx(key: string, value: unknown): Promise<boolean>;
  del(key: string): Promise<void>;
  hget<T>(key: string, field: string): Promise<T | null>;
  hgetall<T>(key: string): Promise<Record<string, T>>;
  hset(key: string, field: string, value: unknown): Promise<void>;
  /** true if the field was newly created */
  hsetnx(key: string, field: string, value: unknown): Promise<boolean>;
  hdel(key: string, field: string): Promise<void>;
  /** true if the member was newly added */
  sadd(key: string, member: string): Promise<boolean>;
  smembers(key: string): Promise<string[]>;
}

/* ---------------- Redis ---------------- */

class RedisKV implements KV {
  constructor(private r: Redis) {}
  async get<T>(key: string) {
    return (await this.r.get<T>(key)) ?? null;
  }
  async set(key: string, value: unknown) {
    await this.r.set(key, value);
  }
  async setnx(key: string, value: unknown) {
    return (await this.r.set(key, value, { nx: true })) === "OK";
  }
  async del(key: string) {
    await this.r.del(key);
  }
  async hget<T>(key: string, field: string) {
    return (await this.r.hget<T>(key, field)) ?? null;
  }
  async hgetall<T>(key: string) {
    return ((await this.r.hgetall<Record<string, T>>(key)) ?? {}) as Record<string, T>;
  }
  async hset(key: string, field: string, value: unknown) {
    await this.r.hset(key, { [field]: value });
  }
  async hsetnx(key: string, field: string, value: unknown) {
    return (await this.r.hsetnx(key, field, value)) === 1;
  }
  async hdel(key: string, field: string) {
    await this.r.hdel(key, field);
  }
  async sadd(key: string, member: string) {
    return (await this.r.sadd(key, member)) === 1;
  }
  async smembers(key: string) {
    return ((await this.r.smembers(key)) ?? []).map(String);
  }
}

/* ---------------- local JSON file ---------------- */

const FILE = path.join(process.cwd(), "data", "kv.json");

class FileKV implements KV {
  private queue: Promise<unknown> = Promise.resolve();
  private locked<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => {});
    return run;
  }
  private async read(): Promise<Record<string, unknown>> {
    try {
      return JSON.parse(await fs.readFile(FILE, "utf8"));
    } catch {
      return {};
    }
  }
  private async write(db: Record<string, unknown>) {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(db, null, 2));
  }
  /** read-modify-write under the lock */
  private tx<T>(fn: (db: Record<string, unknown>) => T | Promise<T>, save = true): Promise<T> {
    return this.locked(async () => {
      const db = await this.read();
      const out = await fn(db);
      if (save) await this.write(db);
      return out;
    });
  }
  get<T>(key: string) {
    return this.tx((db) => (db[key] as T) ?? null, false);
  }
  set(key: string, value: unknown) {
    return this.tx((db) => void (db[key] = value));
  }
  setnx(key: string, value: unknown) {
    return this.tx((db) => {
      if (key in db) return false;
      db[key] = value;
      return true;
    });
  }
  del(key: string) {
    return this.tx((db) => void delete db[key]);
  }
  hget<T>(key: string, field: string) {
    return this.tx((db) => ((db[key] as Record<string, T> | undefined)?.[field] as T) ?? null, false);
  }
  hgetall<T>(key: string) {
    return this.tx((db) => ({ ...((db[key] as Record<string, T>) ?? {}) }), false);
  }
  hset(key: string, field: string, value: unknown) {
    return this.tx((db) => {
      const h = (db[key] as Record<string, unknown>) ?? {};
      h[field] = value;
      db[key] = h;
    });
  }
  hsetnx(key: string, field: string, value: unknown) {
    return this.tx((db) => {
      const h = (db[key] as Record<string, unknown>) ?? {};
      if (field in h) return false;
      h[field] = value;
      db[key] = h;
      return true;
    });
  }
  hdel(key: string, field: string) {
    return this.tx((db) => {
      const h = db[key] as Record<string, unknown> | undefined;
      if (h) delete h[field];
    });
  }
  sadd(key: string, member: string) {
    return this.tx((db) => {
      const s = (db[key] as string[]) ?? [];
      if (s.includes(member)) return false;
      s.push(member);
      db[key] = s;
      return true;
    });
  }
  smembers(key: string) {
    return this.tx((db) => [...((db[key] as string[]) ?? [])], false);
  }
}

/* ---------------- selection ---------------- */

function redisFromEnv(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

let instance: KV | null = null;

/** The storage backend. Throws a clear error if deployed without a database. */
export function getKV(): KV {
  if (instance) return instance;
  const redis = redisFromEnv();
  if (redis) return (instance = new RedisKV(redis));
  if (process.env.VERCEL) {
    throw new Error("Database not configured: connect an Upstash Redis store to this Vercel project.");
  }
  return (instance = new FileKV());
}

export const usingRedis = () => !!redisFromEnv();
