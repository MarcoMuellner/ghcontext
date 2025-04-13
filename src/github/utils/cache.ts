import NodeCache from "node-cache";

/**
 * Default time-to-live for cache entries in seconds
 * @constant {number}
 */
export const DEFAULT_CACHE_TTL = parseInt(process.env.CACHE_TTL || "300", 10); // 5 minutes by default

/**
 * Singleton cache instance for GitHub API responses
 * @type {NodeCache}
 */
export const cache = new NodeCache({
  stdTTL: DEFAULT_CACHE_TTL,
  checkperiod: 120, // Check for expired keys every 2 minutes
  useClones: false, // Don't clone objects on get/set for better performance
});

/**
 * Checks if a value exists in the cache for the given key
 * @param {string} key - The cache key to check
 * @returns {boolean} True if the key exists in cache, false otherwise
 */
export function exists(key: string): boolean {
  return cache.has(key);
}

/**
 * Retrieves a value from the cache
 * @template T - The type of the cached value
 * @param {string} key - The cache key to retrieve
 * @returns {T | undefined} The cached value or undefined if not found
 */
export function get<T>(key: string): T | undefined {
  return cache.get<T>(key);
}

/**
 * Stores a value in the cache
 * @template T - The type of the value to cache
 * @param {string} key - The cache key
 * @param {T} value - The value to store
 * @param {number} [ttl] - Optional custom TTL in seconds
 * @returns {boolean} True if stored successfully
 */
export function set<T>(key: string, value: T, ttl?: number): boolean {
  return cache.set(key, value, ttl ?? DEFAULT_CACHE_TTL);
}

/**
 * Removes a value from the cache
 * @param {string} key - The cache key to remove
 * @returns {number} Number of items deleted (0 or 1)
 */
export function del(key: string): number {
  return cache.del(key);
}

/**
 * Clears the entire cache
 * @returns {void}
 */
export function clear(): void {
  cache.flushAll();
}

/**
 * Gets cache statistics
 * @returns {NodeCache.Stats} Cache statistics
 */
export function getStats(): NodeCache.Stats {
  return cache.getStats();
}
