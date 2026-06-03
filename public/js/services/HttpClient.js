/**
 * HttpClient handles HTTP communications, dynamically switching between
 * Capacitor's native HTTP plugin (for CORS bypass and cookie persistence on mobile)
 * and the standard fetch API (for browser environments).
 */
export class HttpClient {
    constructor() {
        this.capacitorHttp = window.Capacitor?.Plugins?.CapacitorHttp;
    }

    /**
     * Executes an HTTP request.
     * @param {Object} options 
     * @returns {Promise<Object>} Standardized response object
     */
    async request(options) {
        if (this.capacitorHttp) {
            return this._executeNative(options);
        } else {
            return this._executeBrowser(options);
        }
    }

    async _executeNative(options) {
        const res = await this.capacitorHttp.request({
            url: options.url,
            method: options.method || 'GET',
            headers: options.headers || {},
            data: options.data,
            params: options.params,
            disableRedirects: options.disableRedirects || false
        });

        return {
            status: res.status,
            headers: res.headers,
            data: res.data,
            json: async () => typeof res.data === 'string' ? JSON.parse(res.data) : res.data,
            text: async () => typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
        };
    }

    async _executeBrowser(options) {
        console.warn('CapacitorHttp not detected. Falling back to standard fetch.');
        
        const fetchOptions = {
            method: options.method || 'GET',
            headers: options.headers || {}
        };
        
        if (options.data) {
            fetchOptions.body = typeof options.data === 'string' 
                ? options.data 
                : new URLSearchParams(options.data).toString();
        }
        
        if (options.disableRedirects) {
            fetchOptions.redirect = 'manual';
        }
        
        const res = await fetch(options.url, fetchOptions);
        
        const resHeaders = {};
        res.headers.forEach((value, key) => {
            resHeaders[key] = value;
        });
        
        return {
            status: res.status,
            headers: resHeaders,
            data: null,
            json: async () => res.json(),
            text: async () => res.text()
        };
    }

    // --- Static Cookie Utility Methods ---

    static getHeaderValue(headers, name) {
        if (!headers) return null;
        const lowerName = name.toLowerCase();
        for (const key of Object.keys(headers)) {
            if (key.toLowerCase() === lowerName) {
                return headers[key];
            }
        }
        return null;
    }

    static extractCookies(setCookieHeader) {
        if (!setCookieHeader) return '';
        
        let cookieStrings = [];
        if (Array.isArray(setCookieHeader)) {
            cookieStrings = setCookieHeader;
        } else if (typeof setCookieHeader === 'string') {
            const lines = setCookieHeader.split('\n');
            for (const line of lines) {
                cookieStrings.push(...line.split(','));
            }
        }
        
        const cookies = [];
        for (let part of cookieStrings) {
            part = part.trim();
            if (!part) continue;
            const mainPart = part.split(';')[0].trim();
            if (mainPart && mainPart.includes('=')) {
                const key = mainPart.split('=')[0].trim().toLowerCase();
                if (['path', 'domain', 'expires', 'secure', 'httponly', 'samesite'].includes(key)) {
                    continue;
                }
                if (!cookies.some(c => c.toLowerCase().startsWith(key + '='))) {
                    cookies.push(mainPart);
                }
            }
        }
        return cookies.join('; ');
    }

    static mergeCookies(oldCookies, newCookies) {
        if (!oldCookies) return newCookies || '';
        if (!newCookies) return oldCookies || '';
        
        const cookieMap = new Map();
        const parseIntoMap = (cookieStr) => {
            const parts = cookieStr.split(';');
            for (let part of parts) {
                part = part.trim();
                if (!part) continue;
                const eqIndex = part.indexOf('=');
                if (eqIndex > 0) {
                    const key = part.slice(0, eqIndex).trim();
                    const val = part.slice(eqIndex + 1).trim();
                    cookieMap.set(key, val);
                }
            }
        };
        
        parseIntoMap(oldCookies);
        parseIntoMap(newCookies);
        
        const merged = [];
        for (const [key, val] of cookieMap.entries()) {
            merged.push(`${key}=${val}`);
        }
        return merged.join('; ');
    }
}
