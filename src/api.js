// All fetch calls go to the Express backend at /api/*
// In dev, Vite proxies /api → http://localhost:3001
// In production, BASE_URL is e.g. /lavadora/ so API calls go to /lavadora/api/*

const API_BASE = `${import.meta.env.BASE_URL}api`.replace(/\/+/g, '/');

const req = async (method, path, body) => {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? `HTTP ${res.status}`), { status: res.status, data });
  return data;
};

export const api = {
  // Config
  getConfig:       ()           => req('GET',    '/config'),
  saveConfig:      (body)       => req('POST',   '/config', body),
  discover:        (body)       => req('POST',   '/discover', body),

  // Status
  getStatus:       ()           => req('GET',    '/status'),
  getRemote:       ()           => req('GET',    '/remote-status'),

  // Presets
  listPresets:     ()           => req('GET',    '/presets'),
  listPresetsWithClothing: ()  => req('GET',    '/presets-with-clothing'),
  getPreset:       (id)         => req('GET',    `/presets/${id}`),
  createPreset:    (body)       => req('POST',   '/presets', body),
  updatePreset:    (id, body)   => req('PUT',    `/presets/${id}`, body),
  deletePreset:    (id)         => req('DELETE', `/presets/${id}`),
  applyPreset:     (id)         => req('POST',   `/presets/${id}/apply`),

  // History
  getHistory:      ()           => req('GET',    '/history'),

  // Clothing
  listClothing:          ()             => req('GET',    '/clothing'),
  getClothing:           (id)           => req('GET',    `/clothing/${id}`),
  createClothing:        (body)         => req('POST',   '/clothing', body),
  updateClothing:        (id, body)     => req('PUT',    `/clothing/${id}`, body),
  deleteClothing:        (id)           => req('DELETE', `/clothing/${id}`),
  assignClothing:        (id, presetId) => req('POST',   `/clothing/${id}/assign/${presetId}`),
  listPresetClothing:    (presetId)     => req('GET',    `/presets/${presetId}/clothing`),

  // Scale (BLE)
  getScaleConfig:        ()             => req('GET',    '/scale/config'),
  saveScaleConfig:       (body)         => req('POST',   '/scale/config', body),
  /** Returns an EventSource. Usage: const es = api.scaleStream(); es.onmessage = ... */
  scaleStream:           ()             => new EventSource(`${API_BASE}/scale/stream`),

  // OAuth
  getOAuthStatus:        ()             => req('GET',    '/oauth/status'),
  setupOAuth:            (body)         => req('POST',   '/oauth/setup', body),
  refreshOAuth:          ()             => req('POST',   '/oauth/refresh'),
  disconnectOAuth:       ()             => req('DELETE', '/oauth/disconnect'),
  /** Navigates the browser to the OAuth authorize page (returns the URL, caller does window.location.href) */
  oauthAuthorizeUrl:     ()             => `${API_BASE}/oauth/authorize?returnTo=${encodeURIComponent(window.location.origin + window.location.pathname)}`,
};
