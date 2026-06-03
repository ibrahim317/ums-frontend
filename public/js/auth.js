import { StorageService } from './services/StorageService.js';

const storage = new StorageService();

export const getToken = () => storage.getItem('ums_token');
export const setToken = (token) => storage.setItem('ums_token', token);
export const removeToken = () => storage.clearUserSession();
export const isAuthenticated = () => !!getToken();

export const getSavedAccounts = () => {
    const accounts = storage.getJson('ums_saved_accounts');
    return Array.isArray(accounts) ? accounts : [];
};

export const saveAccount = (username, password) => {
    let accounts = getSavedAccounts();
    accounts = accounts.filter(acc => acc.username !== username);
    accounts.push({ username, password });
    storage.setJson('ums_saved_accounts', accounts);
};

export const removeAccount = (username) => {
    let accounts = getSavedAccounts();
    accounts = accounts.filter(acc => acc.username !== username);
    storage.setJson('ums_saved_accounts', accounts);
};
