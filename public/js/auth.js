import { StorageService } from './services/StorageService.js';

const storage = new StorageService();

export const getToken = () => storage.getItem('ums_token');
export const setToken = (token) => storage.setItem('ums_token', token);
export const removeToken = () => storage.clearUserSession();
export const isAuthenticated = () => !!getToken();
