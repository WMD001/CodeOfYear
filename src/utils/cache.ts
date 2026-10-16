/**
 * 轻量缓存：内存 Map + sessionStorage（带时间戳）。
 * 用于减少重复请求，缓存必须携带有效时间信息，不得将过期缓存伪装为实时数据。
 */

interface CacheEntry<T> {
  value: T
  /** 存入时间（epoch ms） */
  storedAt: number
  /** 有效期（ms） */
  ttl: number
}

const MEMORY = new Map<string, CacheEntry<unknown>>()

const STORAGE_KEY_PREFIX = 'gyr-cache:'

/**
 * 读取缓存。过期则删除并返回 null。
 * 仅当数据年龄 < ttl 时视为有效。
 */
export function cacheGet<T>(key: string): T | null {
  const mem = MEMORY.get(key)
  if (mem) {
    if (Date.now() - mem.storedAt < mem.ttl) return mem.value as T
    MEMORY.delete(key)
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_PREFIX + key)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry<T>
    if (Date.now() - entry.storedAt >= entry.ttl) {
      sessionStorage.removeItem(STORAGE_KEY_PREFIX + key)
      return null
    }
    MEMORY.set(key, entry as CacheEntry<unknown>)
    return entry.value
  } catch {
    return null
  }
}

/** 写入缓存（内存 + sessionStorage） */
export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  const entry: CacheEntry<T> = { value, storedAt: Date.now(), ttl: ttlMs }
  MEMORY.set(key, entry as CacheEntry<unknown>)
  try {
    sessionStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(entry))
  } catch {
    // sessionStorage 满或不可用时不阻塞主流程
  }
}

/** 删除缓存项 */
export function cacheDelete(key: string): void {
  MEMORY.delete(key)
  try {
    sessionStorage.removeItem(STORAGE_KEY_PREFIX + key)
  } catch {
    /* noop */
  }
}

/** 清理全部缓存（如登出/清除 Token 时） */
export function cacheClear(): void {
  MEMORY.clear()
  try {
    const keys: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (k && k.startsWith(STORAGE_KEY_PREFIX)) keys.push(k)
    }
    keys.forEach((k) => sessionStorage.removeItem(k))
  } catch {
    /* noop */
  }
}

/** 默认缓存时长：用户资料 10 分钟、贡献日历 10 分钟、仓库语言 30 分钟 */
export const CACHE_TTL = {
  PROFILE: 10 * 60 * 1000,
  REPOS: 10 * 60 * 1000,
  LANGUAGES: 30 * 60 * 1000,
  CALENDAR: 10 * 60 * 1000,
  COMMITS: 10 * 60 * 1000,
  PULLS: 10 * 60 * 1000,
  ISSUES: 10 * 60 * 1000,
  GISTS: 30 * 60 * 1000,
} as const
