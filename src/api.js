// All fetch calls go to the Express backend at /api/*
// In dev, Vite proxies /api → http://localhost:3001

const req = async (method, path, body) => {
  const res = await fetch(`/api${path}`, {
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
};
