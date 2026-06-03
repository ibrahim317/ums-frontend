import { HttpClient } from './HttpClient.js';

/**
 * UmsService acts as the core application service, coordinating data flow
 * between the HTTP layer, the Storage/Cache layer, and the HTML Parser layer.
 */
export class UmsService {
    /**
     * @param {HttpClient} httpClient 
     * @param {StorageService} storageService 
     * @param {UmsParser} umsParser 
     */
    constructor(httpClient, storageService, umsParser) {
        this.http = httpClient;
        this.storage = storageService;
        this.parser = umsParser;
        this.activeCookies = null;
        this.activeCookiesTime = null;
    }

    /**
     * Authenticates with UMS, obtaining and caching cookies.
     * @param {string} username 
     * @param {string} password 
     * @returns {Promise<Object>} Success flag and token
     */
    async login(username, password) {
        const loginUrl = 'https://ums.asu.edu.eg/App/Login_Form';
        
        // 1. Initial GET to fetch CSRF Verification Token
        const getResponse = await this.http.request({
            url: loginUrl,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            }
        });

        const getResponseText = await getResponse.text();
        const initialCookies = HttpClient.extractCookies(HttpClient.getHeaderValue(getResponse.headers, 'set-cookie'));
        
        const requestVerificationToken = this.parser.parseRequestVerificationToken(getResponseText);
        if (!requestVerificationToken) {
            throw new Error('Failed to extract verification token from UMS login page.');
        }

        // 2. POST request to complete login (disableRedirects to read the redirect response cookies)
        const params = new URLSearchParams();
        params.append('__RequestVerificationToken', requestVerificationToken);
        params.append('DomainName', '@cis.asu.edu.eg');
        params.append('DomainName', '');
        params.append('LoginName', username);
        params.append('password', password);
        params.append('RememberMe', 'false');

        const postResponse = await this.http.request({
            url: loginUrl,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Origin': 'https://ums.asu.edu.eg',
                'Referer': loginUrl,
                'Cookie': initialCookies
            },
            data: params.toString(),
            disableRedirects: true
        });

        if (postResponse.status !== 302 && postResponse.status !== 301) {
            throw new Error('Invalid credentials or UMS system is down.');
        }

        const postCookies = HttpClient.extractCookies(HttpClient.getHeaderValue(postResponse.headers, 'set-cookie'));
        const combinedCookies = HttpClient.mergeCookies(initialCookies, postCookies);

        // Store credentials & token locally
        this.storage.setJson('ums_credentials', { username, password });
        this.storage.setItem('ums_token', 'local_session');
        
        // Cache session cookies in memory
        this.activeCookies = combinedCookies;
        this.activeCookiesTime = Date.now();

        return { success: true, token: 'local_session' };
    }

    /**
     * Resolves valid cached cookies or performs a re-login to fetch fresh cookies.
     * @returns {Promise<string>} Valid cookies string
     */
    async getValidCookies() {
        if (this.activeCookies && this.activeCookiesTime && (Date.now() - this.activeCookiesTime < 15 * 60 * 1000)) {
            return this.activeCookies;
        }

        const creds = this.storage.getJson('ums_credentials');
        if (!creds) {
            throw new Error('User credentials not found. Please log in again.');
        }

        // Silent re-login
        const cookies = await this._loginForCookies(creds.username, creds.password);
        this.activeCookies = cookies;
        this.activeCookiesTime = Date.now();
        return cookies;
    }

    /**
     * Helper to retrieve cookies without mutating general auth storage state.
     */
    async _loginForCookies(username, password) {
        const loginUrl = 'https://ums.asu.edu.eg/App/Login_Form';
        
        const getResponse = await this.http.request({
            url: loginUrl,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            }
        });

        const getResponseText = await getResponse.text();
        const initialCookies = HttpClient.extractCookies(HttpClient.getHeaderValue(getResponse.headers, 'set-cookie'));
        const token = this.parser.parseRequestVerificationToken(getResponseText);

        if (!token) throw new Error('Verification token missing during silent login.');

        const params = new URLSearchParams();
        params.append('__RequestVerificationToken', token);
        params.append('DomainName', '@cis.asu.edu.eg');
        params.append('DomainName', '');
        params.append('LoginName', username);
        params.append('password', password);
        params.append('RememberMe', 'false');

        const postResponse = await this.http.request({
            url: loginUrl,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Origin': 'https://ums.asu.edu.eg',
                'Referer': loginUrl,
                'Cookie': initialCookies
            },
            data: params.toString(),
            disableRedirects: true
        });

        if (postResponse.status !== 302 && postResponse.status !== 301) {
            throw new Error('Verification failed. Credentials might have changed.');
        }

        const postCookies = HttpClient.extractCookies(HttpClient.getHeaderValue(postResponse.headers, 'set-cookie'));
        return HttpClient.mergeCookies(initialCookies, postCookies);
    }

    /**
     * Fetches academic years.
     * Cache TTL: 24 hours.
     */
    async getAcademicYears() {
        const cacheKey = 'cache_academic_years';
        const cached = this.storage.getCache(cacheKey, 24 * 60 * 60 * 1000);
        if (cached) {
            return { success: true, data: cached.data, cached: true };
        }

        const cookies = await this.getValidCookies();
        const response = await this.http.request({
            url: 'https://ums.asu.edu.eg/StudentGrades/GetAllStudentAcademicYears',
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Referer': 'https://ums.asu.edu.eg/YearWorkGradesForStudent',
                'Cookie': cookies,
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        const data = await response.json();
        this.storage.setCache(cacheKey, data);
        return { success: true, data, cached: false };
    }

    /**
     * Fetches year-work grades.
     * Cache TTL: 5 minutes.
     */
    async getYearWorkGrades(yearId, force = false) {
        const cacheKey = `cache_yearwork_${yearId || 'default'}`;
        if (!force) {
            const cached = this.storage.getCache(cacheKey, 5 * 60 * 1000);
            if (cached) {
                return { success: true, data: cached.data, cached: true, updatedAt: cached.updatedAt };
            }
        }

        const cookies = await this.getValidCookies();
        let url = 'https://ums.asu.edu.eg/YearWorkGradesForStudent/StudentYearWorkGrades';
        let response;

        if (yearId) {
            response = await this.http.request({
                url,
                method: 'POST',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': 'https://ums.asu.edu.eg/YearWorkGradesForStudent',
                    'Cookie': cookies
                },
                data: `AcademicYearId=${yearId}`
            });
        } else {
            url = 'https://ums.asu.edu.eg/YearWorkGradesForStudent';
            response = await this.http.request({
                url,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Referer': 'https://ums.asu.edu.eg/UserInformation/MyAccount',
                    'Cookie': cookies
                }
            });
        }

        const htmlText = await response.text();
        const parsed = this.parser.parseYearWorkGrades(htmlText);
        this.storage.setCache(cacheKey, parsed);
        
        return { success: true, data: parsed, cached: false, updatedAt: new Date().toISOString() };
    }

    /**
     * Fetches GPA history.
     * Cache TTL: 6 months.
     */
    async getGPA(force = false) {
        const cacheKey = 'cache_gpa';
        if (!force) {
            const cached = this.storage.getCache(cacheKey, 6 * 30 * 24 * 60 * 60 * 1000);
            if (cached) {
                return { success: true, data: cached.data, cached: true, updatedAt: cached.updatedAt };
            }
        }

        const cookies = await this.getValidCookies();
        const response = await this.http.request({
            url: 'https://ums.asu.edu.eg/StudentGrades',
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Referer': 'https://ums.asu.edu.eg/YearWorkGradesForStudent/StudentYearWorkGrades',
                'Cookie': cookies
            }
        });

        const htmlText = await response.text();
        const parsed = this.parser.parseGPA(htmlText);
        this.storage.setCache(cacheKey, parsed);

        return { success: true, data: parsed, cached: false, updatedAt: new Date().toISOString() };
    }
}
