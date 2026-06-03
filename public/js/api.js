import { HttpClient } from './services/HttpClient.js';
import { StorageService } from './services/StorageService.js';
import { UmsParser } from './services/UmsParser.js';
import { UmsService } from './services/UmsService.js';
import { getToken } from './auth.js';

// --- Detect Environment ---
// True when running natively inside the Android web container (APK)
const isCapacitor = !!window.Capacitor?.Plugins?.CapacitorHttp;

// --- Instantiation & Dependency Injection (for Capacitor Mode) ---
const httpClient = new HttpClient();
const storageService = new StorageService();
const umsParser = new UmsParser();
const getCulture = () => localStorage.getItem('ums_culture') || 'ar';
const umsService = new UmsService(httpClient, storageService, umsParser, getCulture);

// --- Helpers for Browser Fallback ---
const getBrowserHeaders = () => ({
    'Authorization': `Bearer ${getToken()}`,
    'Content-Type': 'application/json',
    'X-Culture': getCulture()
});

const createFetchLikeResponse = (status, success, data, error = null, updatedAt = null) => {
    return {
        status,
        json: async () => ({
            success,
            data,
            error,
            updatedAt: updatedAt || new Date().toISOString()
        })
    };
};

/**
 * Authenticates user credentials.
 */
export const loginAPI = async (username, password) => {
    if (isCapacitor) {
        try {
            return await umsService.login(username, password);
        } catch (error) {
            console.error('API Login Error:', error);
            return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة، أو نظام UMS غير متاح.' };
        }
    } else {
        // Desktop binary (.exe/.elf) fallback
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        return response.json();
    }
};

/**
 * Fetches student academic years.
 */
export const fetchAcademicYears = async () => {
    if (isCapacitor) {
        try {
            return await umsService.getAcademicYears();
        } catch (error) {
            console.error('API Fetch Academic Years Error:', error);
            return { success: false, error: error.message || 'فشل في جلب الأعوام الأكاديمية.' };
        }
    } else {
        // Desktop binary (.exe/.elf) fallback
        const response = await fetch('/api/academic-years', { headers: getBrowserHeaders() });
        return response.json();
    }
};

/**
 * Fetches year-work grades.
 */
export const fetchYearWorkGrades = async (yearId, force = false) => {
    if (isCapacitor) {
        try {
            const result = await umsService.getYearWorkGrades(yearId, force);
            return createFetchLikeResponse(200, true, result.data, null, result.updatedAt);
        } catch (error) {
            console.error('API Fetch Year Work Grades Error:', error);
            const isAuthError = error.message.includes('credentials not found') || error.message.includes('again');
            return createFetchLikeResponse(
                isAuthError ? 401 : 500,
                false,
                null,
                error.message || 'فشل في جلب درجات أعمال السنة.'
            );
        }
    } else {
        // Desktop binary (.exe/.elf) fallback
        let url = `/api/grades/year-work${yearId ? `?yearId=${yearId}` : ''}`;
        if (force) {
            url += yearId ? '&force=true' : '?force=true';
        }
        return await fetch(url, { headers: getBrowserHeaders() });
    }
};

/**
 * Fetches GPA history.
 */
export const fetchGPA = async (force = false) => {
    if (isCapacitor) {
        try {
            const result = await umsService.getGPA(force);
            return createFetchLikeResponse(200, true, result.data, null, result.updatedAt);
        } catch (error) {
            console.error('API Fetch GPA Error:', error);
            const isAuthError = error.message.includes('credentials not found') || error.message.includes('again');
            return createFetchLikeResponse(
                isAuthError ? 401 : 500,
                false,
                null,
                error.message || 'فشل في جلب السجل الأكاديمي.'
            );
        }
    } else {
        // Desktop binary (.exe/.elf) fallback
        const url = `/api/grades/gpa${force ? '?force=true' : ''}`;
        return await fetch(url, { headers: getBrowserHeaders() });
    }
};
