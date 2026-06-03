/**
 * StorageService handles persistence for user credentials, tokens, and caches.
 */
export class StorageService {
    constructor(storage = localStorage) {
        this.storage = storage;
    }

    getItem(key) {
        return this.storage.getItem(key);
    }

    setItem(key, value) {
        this.storage.setItem(key, value);
    }

    removeItem(key) {
        this.storage.removeItem(key);
    }

    setJson(key, obj) {
        this.setItem(key, JSON.stringify(obj));
    }

    getJson(key) {
        const item = this.getItem(key);
        if (!item) return null;
        try {
            return JSON.parse(item);
        } catch (e) {
            console.error(`Failed to parse json key: ${key}`, e);
            return null;
        }
    }

    getCache(key, ttlMs) {
        const cached = this.getJson(key);
        if (!cached) return null;
        
        const diff = Date.now() - new Date(cached.updatedAt).getTime();
        if (diff < ttlMs) {
            return {
                data: cached.data,
                updatedAt: cached.updatedAt
            };
        }
        return null;
    }

    setCache(key, data) {
        this.setJson(key, {
            data,
            updatedAt: new Date().toISOString()
        });
    }

    clearUserSession() {
        this.removeItem('ums_token');
        this.removeItem('ums_credentials');
        
        // Remove all cache items
        for (let i = this.storage.length - 1; i >= 0; i--) {
            const key = this.storage.key(i);
            if (key && key.startsWith('cache_')) {
                this.removeItem(key);
            }
        }
    }
}
