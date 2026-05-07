/**
 * SmartThings OAuth 2.0 helpers
 *
 * SmartThings changed PAT policy in Dec 2024: PATs expire after 24 hours.
 * The permanent solution is an OAuth Integration (API_ONLY app type) which
 * provides a refresh_token that lets you obtain new access_tokens automatically.
 *
 * Setup steps (one-time, by developer):
 *   1. Install SmartThings CLI:  npm install -g @smartthings/cli
 *   2. Run:  smartthings apps:create
 *      - Select "API Access" (API_ONLY) type
 *      - Scopes: r:devices:*  x:devices:*
 *      - Redirect URI: http://<your-server>/lavadora/api/oauth/callback
 *   3. Copy the client_id and client_secret shown
 *   4. Enter them in the app's Setup panel → OAuth tab
 */

import { randomBytes } from 'crypto';
import { getConfig, setConfig } from './db.js';

const ST_AUTH_URL  = 'https://api.smartthings.com/oauth/authorize';
const ST_TOKEN_URL = 'https://api.smartthings.com/oauth/token';

// ── In-memory CSRF state store ────────────────────────────────
const pendingStates = new Map(); // state → { expiresAt, redirectUri, returnTo }

// Purge expired entries to prevent unbounded growth
function pruneExpiredStates() {
  const now = Date.now();
  for (const [key, entry] of pendingStates) {
    if (now > entry.expiresAt) pendingStates.delete(key);
  }
}

function generateState() {
  return randomBytes(16).toString('hex');
}

export function createOAuthState(redirectUri, returnTo) {
  pruneExpiredStates();
  const state = generateState();
  pendingStates.set(state, {
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 min window
    redirectUri,
    returnTo,
  });
  return state;
}

export function consumeOAuthState(state) {
  const entry = pendingStates.get(state);
  if (!entry) return null;
  pendingStates.delete(state);
  if (Date.now() > entry.expiresAt) return null;
  return entry;
}

// ── Token helpers ─────────────────────────────────────────────

export function buildAuthUrl(clientId, redirectUri, state) {
  const params = new URLSearchParams({
    client_id:     clientId,
    scope:         'r:devices:* x:devices:*',
    response_type: 'code',
    redirect_uri:  redirectUri,
    state,
  });
  return `${ST_AUTH_URL}?${params}`;
}

export async function exchangeCode({ code, clientId, clientSecret, redirectUri }) {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(ST_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization:  `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type:   'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw Object.assign(new Error(`Code exchange failed: ${text}`), { status: res.status });
  }
  return res.json();
}

export async function refreshOAuthToken() {
  const clientId     = getConfig('oauth_client_id');
  const clientSecret = getConfig('oauth_client_secret');
  const refreshToken = getConfig('oauth_refresh_token');
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('OAuth not configured or no refresh token available');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(ST_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization:  `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw Object.assign(new Error(`Token refresh failed: ${text}`), { status: res.status });
  }
  const data = await res.json();
  storeTokens(data);
  return data.access_token;
}

export function storeTokens(data) {
  const expiresInMs = (data.expires_in ?? 86400) * 1000;
  const expiresAt   = Date.now() + expiresInMs;
  setConfig('oauth_access_token',    data.access_token);
  setConfig('oauth_token_expires_at', String(expiresAt));
  if (data.refresh_token) setConfig('oauth_refresh_token', data.refresh_token);
}

/**
 * Returns the currently stored token (OAuth access token or PAT).
 * No expiry checks — refresh happens reactively on 401 via callWithRefresh.
 */
export function getValidToken() {
  return getConfig('oauth_access_token') || getConfig('token') || null;
}

/**
 * Calls fn(token) against SmartThings. If SmartThings returns 401,
 * refreshes the OAuth token once and retries. Throws on second failure.
 */
export async function callWithRefresh(fn) {
  const token = getValidToken();
  try {
    return await fn(token);
  } catch (err) {
    if (err.status !== 401 || !getConfig('oauth_client_id')) throw err;
    console.log('[oauth] 401 from SmartThings — refreshing token and retrying…');
    const newToken = await refreshOAuthToken(); // throws if no refresh token
    return fn(newToken);
  }
}
