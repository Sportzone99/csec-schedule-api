const axios = require('axios');

// NLL API Configuration - M2M (Machine-to-Machine) Authentication
const AUTH_DOMAIN = 'https://championdata.au.auth0.com';
const AUTH_TOKEN_URL = `${AUTH_DOMAIN}/oauth/token`;
const API_AUDIENCE = 'https://api.nll.championdata.io/';
const NLL_API_BASE_URL = 'https://api.nll.championdata.io';

// M2M Client Credentials - should be in environment variables
const CLIENT_ID = process.env.NLL_CLIENT_ID || 'rkMUPT1xOqO5tYR44xW4b2Ibtw7tli05';
const CLIENT_SECRET = process.env.NLL_CLIENT_SECRET || 'nn3U2-MeJ28Xi-AbA8kO8Bn_GteFh83WSDznku7Nm1_vaxlDJcblnCjeQaq8tKO_';

// NLL API Configuration
const LEAGUE_ID = 1; // NLL
const LEVEL_ID = 1;
const SEASON_ID = 225; // 2025-26 season

// Simple in-memory token cache (for Lambda execution context reuse)
let tokenCache = null;

/**
 * Get access token using M2M client credentials flow
 * Uses in-memory cache for Lambda (tokens last 24 hours)
 */
async function getAccessToken() {
  // Check if we have a cached token that's still valid
  if (tokenCache) {
    const expiresAt = new Date(tokenCache.expires_at);
    const now = new Date();
    
    // If token expires in more than 5 minutes, use cached token
    if (expiresAt > new Date(now.getTime() + 5 * 60 * 1000)) {
      return tokenCache.access_token;
    }
  }

  try {
    const response = await axios.post(AUTH_TOKEN_URL, {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      audience: API_AUDIENCE,
      grant_type: 'client_credentials'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const { access_token, expires_in } = response.data;
    
    // Cache the token with expiration time
    const expiresAt = new Date(Date.now() + (expires_in * 1000));
    tokenCache = {
      access_token,
      expires_at: expiresAt.toISOString(),
      expires_in
    };
    
    return access_token;
    
  } catch (error) {
    console.error('Failed to get NLL access token:', error.message);
    throw error;
  }
}

/**
 * Fetch NLL schedule data
 */
async function fetchNLLSchedule() {
  try {
    const accessToken = await getAccessToken();
    const endpoint = `/v1/leagues/${LEAGUE_ID}/levels/${LEVEL_ID}/seasons/${SEASON_ID}/schedule`;
    
    const response = await axios.get(`${NLL_API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching NLL schedule:', error.message);
    throw error;
  }
}

module.exports = {
  getAccessToken,
  fetchNLLSchedule
};

