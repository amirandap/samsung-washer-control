import express from 'express';
import cors    from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  listPresets, getPreset, createPreset, updatePreset, deletePreset,
  getConfig, setConfig, recordHistory, getHistory,
  listClothing, listClothingByPreset, getClothingItem,
  createClothingItem, updateClothingItem, deleteClothingItem, assignClothingToPreset,
  listUnassignedClothing,
} from './db.js';
import {
  discoverWasherDevice, getDeviceStatus, getRemoteControlStatus,
  discoverSpinLevels, applyPreset,
} from './smartthings.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ?? 3001;
const app  = express();

app.use(cors());
app.use(express.json());

// ── Serve built React app in production ────────────────────────
app.use(express.static(join(__dirname, '..', 'dist')));

// ── Bootstrap: persist env token into DB if not already stored ─
if (process.env.SMARTTHINGS_TOKEN && !getConfig('token')) {
  setConfig('token', process.env.SMARTTHINGS_TOKEN);
  console.log('[washer-api] token from env persisted to DB');
}

// ════════════════════════════════════════════════════
//  CONFIG
// ════════════════════════════════════════════════════
app.get('/api/config', (_req, res) => {
  res.json({
    token:    getConfig('token')    ?? '',
    deviceId: getConfig('deviceId') ?? '',
    label:    getConfig('label')    ?? '',
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
  const token    = getConfig('token');
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
  const token    = getConfig('token');
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
  res.json(listPresets());
});

app.get('/api/presets/:id', (req, res) => {
  const preset = getPreset(req.params.id);
  if (!preset) return res.status(404).json({ error: 'Preset not found' });
  res.json(preset);
});

app.post('/api/presets', (req, res) => {
  const { name, subtitle, cycle, temp, spin_rpm, eco, color, clothes, compat_colors, notes } = req.body ?? {};
  if (!name || !cycle || !temp) {
    return res.status(400).json({ error: 'name, cycle and temp are required' });
  }
  const preset = createPreset({ name, subtitle, cycle, temp, spin_rpm, eco, color, clothes, compat_colors, notes });
  res.status(201).json(preset);
});

app.put('/api/presets/:id', (req, res) => {
  const updated = updatePreset(req.params.id, req.body ?? {});
  if (!updated) return res.status(404).json({ error: 'Preset not found' });
  res.json(updated);
});

app.delete('/api/presets/:id', (req, res) => {
  const deleted = deletePreset(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Preset not found' });
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════
//  CLOTHING ITEMS
// ════════════════════════════════════════════════════
app.get('/api/clothing', (_req, res) => {
  res.json(listClothing());
});

app.get('/api/clothing/unassigned', (_req, res) => {
  res.json(listUnassignedClothing());
});

app.get('/api/clothing/:id', (req, res) => {
  const item = getClothingItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

app.post('/api/clothing', (req, res) => {
  const item = createClothingItem(req.body ?? {});
  res.status(201).json(item);
});

app.put('/api/clothing/:id', (req, res) => {
  const updated = updateClothingItem(req.params.id, req.body ?? {});
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json(updated);
});

app.delete('/api/clothing/:id', (req, res) => {
  const ok = deleteClothingItem(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

app.post('/api/clothing/:id/assign/:presetId', (req, res) => {
  const { id, presetId } = req.params;
  if (!getClothingItem(id))   return res.status(404).json({ error: 'Clothing item not found' });
  if (!getPreset(presetId))   return res.status(404).json({ error: 'Preset not found' });
  assignClothingToPreset(id, presetId);
  res.json({ ok: true });
});

app.get('/api/presets/:id/clothing', (req, res) => {
  res.json(listClothingByPreset(req.params.id));
});

// ════════════════════════════════════════════════════
//  APPLY PRESET
// ════════════════════════════════════════════════════
app.post('/api/presets/:id/apply', async (req, res) => {
  const token    = getConfig('token');
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
  res.json(getHistory());
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
