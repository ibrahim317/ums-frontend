const axios = require('axios');
const cheerio = require('cheerio');
const FormData = require('form-data');

// Helper function to extract cookies
const extractCookies = (setCookieHeader) => {
    if (!setCookieHeader) return '';
    return setCookieHeader.map(cookie => cookie.split(';')[0]).join('; ');
};

/**
 * Logs into UMS and returns the session cookies.
 * @param {string} username 
 * @param {string} password 
 * @returns {Promise<string>} The session cookies
 */
const loginToUMS = async (username, password) => {
    const loginUrl = 'https://ums.asu.edu.eg/App/Login_Form';
    
    // 1. Initial GET request to obtain CSRF token and initial cookies
    const getResponse = await axios.get(loginUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
    });

    const initialCookies = extractCookies(getResponse.headers['set-cookie']);
    const $get = cheerio.load(getResponse.data);
    const requestVerificationToken = $get('input[name="__RequestVerificationToken"]').val();

    if (!requestVerificationToken) {
        throw new Error('Failed to extract __RequestVerificationToken');
    }

    // 2. POST request to login
    const formData = new FormData();
    formData.append('__RequestVerificationToken', requestVerificationToken);
    formData.append('DomainName', '@cis.asu.edu.eg'); // Could be parameterised if needed
    formData.append('DomainName', '');
    formData.append('LoginName', username);
    formData.append('password', password);
    formData.append('RememberMe', 'false');

    const postResponse = await axios.post(loginUrl, formData, {
        headers: {
            ...formData.getHeaders(),
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Origin': 'https://ums.asu.edu.eg',
            'Referer': loginUrl,
            'Cookie': initialCookies
        },
        maxRedirects: 0, // We want to capture the redirect to get the new cookies
        validateStatus: function (status) {
            return status >= 200 && status < 303; // Resolve for 302
        }
    });

    if (postResponse.status !== 302) {
        throw new Error('Invalid credentials');
    }

    let authCookies = initialCookies;
    if (postResponse.headers['set-cookie']) {
        authCookies = extractCookies(postResponse.headers['set-cookie']);
    }

    return `${initialCookies}; ${authCookies}`;
};

module.exports = {
    loginToUMS
};
