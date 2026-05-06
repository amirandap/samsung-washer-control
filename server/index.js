import express from 'express';
import cors    from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  listPresets, getPreset, createPreset, updatePreset, deletePreset,
  getConfig, setConfig, recordHistory, getHistory,
  listClothing, listClothingByPreset, getClothingItem,
  createClothingItem, updateClothingItem, deleteClothingItem, assignClothingToPreset,
  listUnassignedClothing, listPresetsWithClothing,
} from './db.js';
import {
  discoverWasherDevice, getDeviceStatus, getRemoteControlStatus,
  discoverSpinLevels, applyPreset,
} from './smartthings.js';
import { scaleManager } from './scale.js';
import {
  buildAuthUrl, createOAuthState, consumeOAuthState,
  exchangeCode, storeTokens, refreshOAuthToken, getValidToken,
} from './oauth.js';

const APP_BASE = (process.env.VITE_BASE_PATH || '').replace(/\/$/, ''); // e.g. '/lavadora'

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ?? 3001;
const app  = express();

app.use(cors());
app.use(express.json());

// ── Serve built React app in production ────────────────────────
app.use(express.static(join(__dirname, '..', 'dist')));

// ── Bootstrap: persist env token into DB if not already stored ─
if (process.env.SMARTTHINGS_TOKEN && !getConfig('token') && !getConfig('oauth_access_token')) {
  setConfig('token', process.env.SMARTTHINGS_TOKEN);
  console.log('[washer-api] token from env persisted to DB');
}

// ════════════════════════════════════════════════════
//  CONFIG
// ════════════════════════════════════════════════════
app.get('/api/config', (_req, res) => {
  const oauthClientId    = getConfig('oauth_client_id');
  const oauthAccessToken = getConfig('oauth_access_token');
  const expiresAtStr     = getConfig('oauth_token_expires_at');
  const expiresAt        = expiresAtStr ? Number(expiresAtStr) : null;
  res.json({
    token:           oauthAccessToken || getConfig('token') || '',
    deviceId:        getConfig('deviceId') ?? '',
    label:           getConfig('label')    ?? '',
    authMode:        oauthClientId ? 'oauth' : 'pat',
    oauthConfigured: !!(oauthClientId && getConfig('oauth_client_secret')),
    oauthConnected:  !!oauthAccessToken,
    oauthExpiresAt:  expiresAt,
  });
});

app.post('/api/config', (req, res) => {
  const { token, deviceId, label } = req.body ?? {};
  if (token    !== undefined) setConfig('token',    token);
  if (deviceId !== undefined) setConfig('deviceId', deviceId);
  if (label    !== undefined) setConfig('label',    label);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════
//  OAUTH
// ════════════════════════════════════════════════════

// Save OAuth app credentials (client_id + client_secret)
app.post('/api/oauth/setup', (req, res) => {
  const { client_id, client_secret } = req.body ?? {};
  if (!client_id || !client_secret) {
    return res.status(400).json({ error: 'client_id and client_secret are required' });
  }
  setConfig('oauth_client_id',     client_id.trim());
  setConfig('oauth_client_secret', client_secret.trim());
  res.json({ ok: true });
});

// Returns OAuth connection status
app.get('/api/oauth/status', (_req, res) => {
  const oauthClientId    = getConfig('oauth_client_id');
  const oauthAccessToken = getConfig('oauth_access_token');
  const expiresAtStr     = getConfig('oauth_token_expires_at');
  const expiresAt        = expiresAtStr ? Number(expiresAtStr) : null;
  res.json({
    configured: !!oauthClientId,
    connected:  !!oauthAccessToken,
    expires_at: expiresAt,
    expired:    expiresAt ? Date.now() > expiresAt : false,
  });
});

// Initiate OAuth flow — redirects browser to SmartThings auth page
app.get('/api/oauth/authorize', (req, res) => {
  const clientId = getConfig('oauth_client_id');
  if (!clientId) return res.status(400).send('OAuth not configured.');

  // Use explicit env var so it matches exactly what was registered in SmartThings.
  // Fallback to dynamic construction (requires correct x-forwarded headers in nginx).
  const redirectUri = process.env.OAUTH_REDIRECT_URI || (() => {
    const proto = (req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim() || req.protocol;
    const host  = req.headers['x-forwarded-host'] || req.get('host');
    return `${proto}://${host}${APP_BASE}/api/oauth/callback`;
  })();

  const returnTo = req.query.returnTo || redirectUri.replace('/api/oauth/callback', '/');
  const state    = createOAuthState(redirectUri, returnTo);
  const authUrl  = buildAuthUrl(clientId, redirectUri, state);
  res.redirect(authUrl);
});

// OAuth callback — exchanges code for tokens, saves, redirects to frontend
app.get('/api/oauth/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const base = APP_BASE || '/';

  if (error) {
    console.error('[oauth] provider error:', error);
    return res.redirect(`${base}?oauth=error&reason=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return res.redirect(`${base}?oauth=error&reason=missing_code`);
  }

  const entry = consumeOAuthState(state);
  if (!entry) {
    return res.status(400).send('OAuth state inválido o expirado. Por favor intenta de nuevo.');
  }

  const clientId     = getConfig('oauth_client_id');
  const clientSecret = getConfig('oauth_client_secret');
  try {
    const tokenData = await exchangeCode({
      code,
      clientId,
      clientSecret,
      redirectUri: entry.redirectUri,
    });
    storeTokens(tokenData);
    console.log('[oauth] tokens stored successfully');

    // Auto-discover device if not already configured
    if (!getConfig('deviceId')) {
      try {
        const device = await discoverWasherDevice(tokenData.access_token);
        if (device) {
          setConfig('deviceId', device.deviceId);
          setConfig('label',    device.label);
          console.log(`[oauth] device discovered: ${device.label} (${device.deviceId})`);
        }
      } catch (e) {
        console.warn('[oauth] auto-discover failed:', e.message);
      }
    }

    const returnTo = entry.returnTo.replace(/\?.*$/, '');
    res.redirect(`${returnTo}?oauth=success`);
  } catch (err) {
    console.error('[oauth] code exchange failed:', err.message);
    res.redirect(`${base}?oauth=error&reason=${encodeURIComponent(err.message)}`);
  }
});

// Manually refresh OAuth token
app.post('/api/oauth/refresh', async (_req, res) => {
  try {
    await refreshOAuthToken();
    res.json({ ok: true, expires_at: Number(getConfig('oauth_token_expires_at')) });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

// Disconnect OAuth (clears tokens, keeps credentials)
app.delete('/api/oauth/disconnect', (_req, res) => {
  setConfig('oauth_access_token',    '');
  setConfig('oauth_refresh_token',   '');
  setConfig('oauth_token_expires_at', '');
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════
//  DEVICE DISCOVERY
// ════════════════════════════════════════════════════
app.post('/api/discover', async (req, res) => {
  const token = req.body?.token ?? getConfig('token');
  if (!token) return res.status(400).json({ error: 'No token provided' });
  try {
    const device = await discoverWasherDevice(token);
    if (!device) return res.status(404).json({ error: 'No washer device found' });
    setConfig('token',    token);
    setConfig('deviceId', device.deviceId);
    setConfig('label',    device.label);
    res.json(device);
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════
//  DEVICE STATUS
// ════════════════════════════════════════════════════
app.get('/api/status', async (_req, res) => {
  const token    = await getValidToken();
  const deviceId = getConfig('deviceId');
  if (!token || !deviceId) return res.status(400).json({ error: 'Not configured' });
  try {
    const status = await getDeviceStatus(token, deviceId);
    res.json(status);
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

app.get('/api/remote-status', async (_req, res) => {
  const token    = await getValidToken();
  const deviceId = getConfig('deviceId');
  if (!token || !deviceId) return res.status(400).json({ error: 'Not configured' });
  try {
    const enabled = await getRemoteControlStatus(token, deviceId);
    res.json({ enabled });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════
//  PRESETS CRUD
// ════════════════════════════════════════════════════
app.get('/api/presets', (_req, res) => {
  try { res.json(listPresets()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Returns presets with clothing_items[] embedded — single SQL JOIN, no N+1
app.get('/api/presets-with-clothing', (_req, res) => {
  try { res.json(listPresetsWithClothing()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/presets/:id', (req, res) => {
  try {
    const preset = getPreset(req.params.id);
    if (!preset) return res.status(404).json({ error: 'Preset not found' });
    res.json(preset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/presets', (req, res) => {
  const { name, subtitle, cycle, temp, spin_rpm, eco, color, clothes, compat_colors, notes } = req.body ?? {};
  if (!name || !cycle || !temp) {
    return res.status(400).json({ error: 'name, cycle and temp are required' });
  }
  try {
    const preset = createPreset({ name, subtitle, cycle, temp, spin_rpm, eco, color, clothes, compat_colors, notes });
    res.status(201).json(preset);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/presets/:id', (req, res) => {
  try {
    const updated = updatePreset(req.params.id, req.body ?? {});
    if (!updated) return res.status(404).json({ error: 'Preset not found' });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/presets/:id', (req, res) => {
  try {
    const deleted = deletePreset(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Preset not found' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════
//  CLOTHING ITEMS
// ════════════════════════════════════════════════════
app.get('/api/clothing', (_req, res) => {
  try { res.json(listClothing()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/clothing/unassigned', (_req, res) => {
  try { res.json(listUnassignedClothing()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/clothing/:id', (req, res) => {
  try {
    const item = getClothingItem(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/clothing', (req, res) => {
  try {
    const item = createClothingItem(req.body ?? {});
    res.status(201).json(item);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/clothing/:id', (req, res) => {
  try {
    const updated = updateClothingItem(req.params.id, req.body ?? {});
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/clothing/:id', (req, res) => {
  try {
    const ok = deleteClothingItem(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/clothing/:id/assign/:presetId', (req, res) => {
  try {
    const { id, presetId } = req.params;
    if (!getClothingItem(id))   return res.status(404).json({ error: 'Clothing item not found' });
    if (!getPreset(presetId))   return res.status(404).json({ error: 'Preset not found' });
    assignClothingToPreset(id, presetId);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/presets/:id/clothing', (req, res) => {
  try { res.json(listClothingByPreset(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════
//  APPLY PRESET
// ════════════════════════════════════════════════════
app.post('/api/presets/:id/apply', async (req, res) => {
  const token    = await getValidToken();
  const deviceId = getConfig('deviceId');
  if (!token || !deviceId) return res.status(400).json({ error: 'Not configured' });

  const preset = getPreset(req.params.id);
  if (!preset) return res.status(404).json({ error: 'Preset not found' });

  try {
    const remoteEnabled = await getRemoteControlStatus(token, deviceId);
    if (!remoteEnabled) {
      return res.status(403).json({ error: 'REMOTE_DISABLED' });
    }

    const spinLevels = await discoverSpinLevels(token, deviceId).catch(() => null);
    const result     = await applyPreset(token, deviceId, preset, spinLevels);

    recordHistory(preset.id, preset.name);
    res.json({ ok: true, spinCmd: result.spinCmd });
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════
//  HISTORY
// ════════════════════════════════════════════════════
app.get('/api/history', (_req, res) => {
  try { res.json(getHistory()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════
//  SCALE (BLE)
// ════════════════════════════════════════════════════

// GET /api/scale/config — read saved BT address
app.get('/api/scale/config', (_req, res) => {
  res.json({ address: getConfig('scaleAddress') ?? '' });
});

// POST /api/scale/config — save BT address
app.post('/api/scale/config', (req, res) => {
  const { address } = req.body ?? {};
  if (address !== undefined) setConfig('scaleAddress', address);
  res.json({ ok: true });
});

// GET /api/scale/stream — SSE stream of weight events
// Events:
//   data: {type:'status', scanning, source}
//   data: {type:'reading', weight_kg, detergent_ml, load_level, source}  ← live, each stable notification
//   data: {type:'weight',  weight_kg, detergent_ml, load_level, source}  ← settled final reading
app.get('/api/scale/stream', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  const send = (type, payload) => {
    res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
  };

  // Send current status immediately
  send('status', { scanning: scaleManager.scanning, source: scaleManager.source });
  if (scaleManager.lastWeight !== null) {
    const kg = scaleManager.lastWeight;
    send('reading', { weight_kg: kg, stable: true, source: scaleManager.source });
  }

  // Wire up listeners
  const onReading = (d) => send('reading', d);
  const onWeight  = (d) => send('weight',  d);
  const onStatus  = (d) => send('status',  d);

  scaleManager.on('reading', onReading);
  scaleManager.on('weight',  onWeight);
  scaleManager.on('status',  onStatus);

  // Start scanning if not already running
  const address = getConfig('scaleAddress') || undefined;
  scaleManager.start(address);

  // Keepalive: prevents nginx and proxies from closing idle SSE connections
  const keepaliveInterval = setInterval(() => {
    res.write(':keepalive\n\n');
  }, 30000);

  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(keepaliveInterval);
    scaleManager.removeListener('reading', onReading);
    scaleManager.removeListener('weight',  onWeight);
    scaleManager.removeListener('status',  onStatus);
    // Stop scanning only when no more SSE clients are connected
    if (scaleManager.listenerCount('reading') === 0) {
      scaleManager.stop();
    }
  });
});

// ── SPA fallback ───────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, '..', 'dist', 'index.html'));
});

app.listen(PORT, async () => {
  console.log(`[washer-api] listening on http://localhost:${PORT}`);

  // Auto-discover device if token is available but deviceId is not saved yet
  const token    = getConfig('token');
  const deviceId = getConfig('deviceId');
  if (token && !deviceId) {
    console.log('[washer-api] token found, auto-discovering device…');
    try {
      const device = await discoverWasherDevice(token);
      if (device) {
        setConfig('deviceId', device.deviceId);
        setConfig('label',    device.label);
        console.log(`[washer-api] device saved: ${device.label} (${device.deviceId})`);
      } else {
        console.warn('[washer-api] no washer device found during auto-discover');
      }
    } catch (err) {
      console.error('[washer-api] auto-discover failed:', err.message);
    }
  }
});
