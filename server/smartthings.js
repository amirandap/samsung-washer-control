// SmartThings API wrapper — used by both the Express server and MCP server
export const ST_API = 'https://api.smartthings.com/v1';

const SPIN_RPM_HINTS = {
  600:  ['rinseHold', 'low', 'no'],
  800:  ['medium'],
  1000: ['high'],
  1200: ['extraHigh'],
};

export async function stFetch(token, path, opts = {}) {
  const res = await fetch(`${ST_API}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(opts.headers ?? {}),
    },
  });

  if (res.status === 401) throw Object.assign(new Error('UNAUTHORIZED'), { status: 401 });
  if (res.status === 403) throw Object.assign(new Error('FORBIDDEN'),    { status: 403 });
  if (res.status === 422) throw Object.assign(new Error('UNPROCESSABLE'),{ status: 422 });
  if (res.status >= 500)  throw Object.assign(new Error('SERVER_ERROR'), { status: res.status });
  if (!res.ok)            throw Object.assign(new Error(`HTTP_${res.status}`), { status: res.status });

  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

export async function discoverWasherDevice(token) {
  try {
    const data = await stFetch(token, '/devices?capability=custom.washerWashCourse');
    if (data.items?.length > 0) {
      const d = data.items[0];
      return { deviceId: d.deviceId, label: d.label || d.name || d.deviceId };
    }
  } catch (_) { /* fall through */ }

  const all  = await stFetch(token, '/devices');
  const washer = (all.items ?? []).find(d => {
    const cats = (d.components ?? []).flatMap(c => c.categories ?? []).map(c => (c.name ?? '').toLowerCase());
    const name = (d.label ?? d.name ?? '').toLowerCase();
    return cats.some(c => c.includes('wash') || c.includes('dryer'))
      || name.includes('wash') || name.includes('dryer') || name.includes('laund');
  });
  if (washer) return { deviceId: washer.deviceId, label: washer.label || washer.name || washer.deviceId };
  return null;
}

export async function getDeviceStatus(token, deviceId) {
  return stFetch(token, `/devices/${deviceId}/status`);
}

export async function getRemoteControlStatus(token, deviceId) {
  const data = await stFetch(
    token,
    `/devices/${deviceId}/components/main/capabilities/remoteControlStatus/status`
  );
  return data?.remoteControlEnabled?.value === true;
}

export async function discoverSpinLevels(token, deviceId) {
  try {
    const capDef = await stFetch(
      token,
      `/devices/${deviceId}/components/main/capabilities/custom.washerSpinLevel`
    );
    const args = capDef?.commands?.setWasherSpinLevel?.arguments ?? [];
    const enumVals = args[0]?.schema?.enum ?? args[0]?.schema?.properties?.value?.enum ?? null;
    if (enumVals?.length) return enumVals;
  } catch (_) { /* fall through */ }
  return null;
}

export function resolveSpinCommand(spinRpm, knownLevels) {
  const hints = SPIN_RPM_HINTS[spinRpm] ?? ['high'];
  if (knownLevels?.length) {
    for (const h of hints) {
      if (knownLevels.includes(h)) return h;
    }
    if (spinRpm <= 600)  return knownLevels[0];
    if (spinRpm >= 1200) return knownLevels[knownLevels.length - 1];
    return knownLevels[Math.floor(knownLevels.length / 2)];
  }
  return hints[0];
}

export async function sendCommand(token, deviceId, capability, command, args) {
  return stFetch(token, `/devices/${deviceId}/commands`, {
    method: 'POST',
    body: JSON.stringify({
      commands: [{ component: 'main', capability, command, arguments: args }],
    }),
  });
}

export async function applyPreset(token, deviceId, preset, spinLevels = null) {
  const spinCmd = resolveSpinCommand(preset.spin_rpm, spinLevels);
  await sendCommand(token, deviceId, 'custom.washerWashCourse',       'setWasherWashCourse',       [preset.cycle]);
  await sendCommand(token, deviceId, 'custom.washerWashTemperature',  'setWasherWashTemperature',  [preset.temp]);
  await sendCommand(token, deviceId, 'custom.washerSpinLevel',        'setWasherSpinLevel',        [spinCmd]);
  return { spinCmd };
}
