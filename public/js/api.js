import { getToken } from './auth.js';

const getHeaders = () => ({
    'Authorization': `Bearer ${getToken()}`,
    'Content-Type': 'application/json'
});

export const loginAPI = async (username, password) => {
    const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    return response.json();
};

export const fetchAcademicYears = async () => {
    const response = await fetch('/api/academic-years', { headers: getHeaders() });
    return response.json();
};

export const fetchYearWorkGrades = async (yearId, force = false) => {
    let url = `/api/grades/year-work${yearId ? `?yearId=${yearId}` : ''}`;
    if (force) {
        url += yearId ? '&force=true' : '?force=true';
    }
    const response = await fetch(url, { headers: getHeaders() });
    return response;
};

export const fetchGPA = async (force = false) => {
    const url = `/api/grades/gpa${force ? '?force=true' : ''}`;
    const response = await fetch(url, { headers: getHeaders() });
    return response;
};
