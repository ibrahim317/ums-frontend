export const getToken = () => localStorage.getItem('ums_token');
export const setToken = (token) => localStorage.setItem('ums_token', token);
export const removeToken = () => localStorage.removeItem('ums_token');
export const isAuthenticated = () => !!getToken();
