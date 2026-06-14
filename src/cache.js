'use strict';
/**
 * Minimal in-memory TTL cache. Sufficient for a single-instance Node panel
 * (license snapshot + short-lived tokens). Swap for Redis if you scale out.
 */
class TTLCache {
  constructor() {
    this.store = new Map();
  }

  set(key, value, ttlSeconds) {
    this.store.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expires < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  del(key) {
    this.store.delete(key);
  }
}

module.exports = { cache: new TTLCache() };
