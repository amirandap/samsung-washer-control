/**
 * SmartThings Washer — MCP Server
 *
 * Run standalone:  node server/mcp.js
 *
 * Claude Desktop config (~/.claude/claude_desktop_config.json):
 * {
 *   "mcpServers": {
 *     "washer-control": {
 *       "command": "node",
 *       "args": ["/absolute/path/to/washer-app/server/mcp.js"]
 *     }
 *   }
 * }
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  listPresets, getPreset, createPreset, updatePreset, deletePreset, reorderPresets,
  getConfig, setConfig, getHistory, recordHistory,
  listClothing, listClothingByPreset, getClothingItem,
  createClothingItem, updateClothingItem, deleteClothingItem,
  assignClothingToPreset, listUnassignedClothing,
} from './db.js';
import {
  discoverWasherDevice, getDeviceStatus, getRemoteControlStatus,
  discoverSpinLevels, applyPreset as stApplyPreset,
} from './smartthings.js';

const server = new McpServer({
  name:    'washer-control',
  version: '1.0.0',
});

// ── Helper ─────────────────────────────────────────
function text(content) {
  return { content: [{ type: 'text', text: typeof content === 'string' ? content : JSON.stringify(content, null, 2) }] };
}

function requireCreds() {
  const token    = getConfig('token');
  const deviceId = getConfig('deviceId');
  if (!token || !deviceId) throw new Error('No token or deviceId configured. Use set_config first.');
  return { token, deviceId };
}

// ════════════════════════════════════════════════════
//  PRESET TOOLS
// ════════════════════════════════════════════════════
server.tool(
  'list_presets',
  'List all saved wash presets from the database',
  {},
  async () => text(listPresets())
);

server.tool(
  'get_preset',
  'Get details of a specific preset by ID',
  { id: z.string().describe('Preset ID') },
  async ({ id }) => {
    const p = getPreset(id);
    if (!p) return text(`Preset "${id}" not found.`);
    return text(p);
  }
);

server.tool(
  'create_preset',
  'Create a new wash preset and save it to the database',
  {
    name:      z.string().describe('Display name, e.g. "Deporte"'),
    subtitle:  z.string().optional().describe('Short description, e.g. "Ropa deportiva"'),
    cycle:     z.enum(['delicates','colors','normal','cottons','quickWash','rinse','spin','bedding','duvet','wool','synthetics','shirts','dark']).describe('Wash cycle key'),
    temp:      z.enum(['cold','warm','hot','extraHot']).describe('Temperature: cold=30°C, warm=40°C, hot=60°C, extraHot=90°C'),
    spin_rpm:  z.number().int().describe('Spin speed in RPM (600, 800, 1000, 1200)'),
    eco:       z.boolean().optional().default(true).describe('Enable EcoBubble'),
    color:     z.string().optional().describe('Badge hex color, e.g. "#9b59b6"'),
    notes:      z.string().optional().describe('Private notes or optimization rationale'),
    sort_order: z.number().int().optional().describe('Display order (lower = first)'),
    clothes:    z.string().optional().describe('Free-text clothes description for this preset'),
    compat_colors: z.string().optional().describe('JSON array of compatible color names, e.g. \'["negro","azul"]\''),
    dry_cycle:  z.string().optional().describe('Dryer cycle key, e.g. "normal", "delicates"'),
    dry_temp:   z.string().optional().describe('Dryer temperature, e.g. "low", "medium"'),
    dry_notes:  z.string().optional().describe('Notes about drying this preset'),
  },
  async (data) => {
    const preset = createPreset(data);
    return text({ created: preset });
  }
);

server.tool(
  'update_preset',
  'Update one or more fields of an existing preset',
  {
    id:        z.string().describe('Preset ID to update'),
    name:      z.string().optional(),
    subtitle:  z.string().optional(),
    cycle:     z.string().optional(),
    temp:      z.string().optional(),
    spin_rpm:  z.number().int().optional(),
    eco:       z.boolean().optional(),
    color:      z.string().optional(),
    notes:      z.string().optional(),
    sort_order: z.number().int().optional(),
    clothes:    z.string().optional().describe('Free-text clothes description'),
    compat_colors: z.string().optional().describe('JSON array of compatible colors'),
    dry_cycle:  z.string().optional(),
    dry_temp:   z.string().optional(),
    dry_notes:  z.string().optional(),
  },
  async ({ id, ...fields }) => {
    const updated = updatePreset(id, fields);
    if (!updated) return text(`Preset "${id}" not found.`);
    return text({ updated });
  }
);

server.tool(
  'delete_preset',
  'Delete a preset from the database',
  { id: z.string().describe('Preset ID to delete') },
  async ({ id }) => {
    const ok = deletePreset(id);
    return text(ok ? `Preset "${id}" deleted.` : `Preset "${id}" not found.`);
  }
);

// ════════════════════════════════════════════════════
//  CONFIG TOOLS
// ════════════════════════════════════════════════════
server.tool(
  'get_config',
  'Get the current SmartThings token and deviceId (token is partially masked)',
  {},
  async () => {
    const token    = getConfig('token')    ?? '';
    const deviceId = getConfig('deviceId') ?? '';
    const label    = getConfig('label')    ?? '';
    const masked   = token ? `${token.slice(0, 6)}…${token.slice(-4)}` : '(not set)';
    return text({ token: masked, deviceId, label });
  }
);

server.tool(
  'set_config',
  'Save the SmartThings token and/or deviceId',
  {
    token:    z.string().optional().describe('SmartThings Personal Access Token'),
    deviceId: z.string().optional().describe('SmartThings Device ID'),
    label:    z.string().optional().describe('Human-readable device label'),
  },
  async (data) => {
    if (data.token)    setConfig('token',    data.token);
    if (data.deviceId) setConfig('deviceId', data.deviceId);
    if (data.label)    setConfig('label',    data.label);
    return text('Config saved.');
  }
);

server.tool(
  'discover_device',
  'Auto-discover the washer device from the SmartThings account',
  { token: z.string().optional().describe('Token (uses stored one if omitted)') },
  async ({ token: inputToken }) => {
    const token = inputToken ?? getConfig('token');
    if (!token) return text('No token available. Use set_config first.');
    const device = await discoverWasherDevice(token);
    if (!device) return text('No washer device found in this SmartThings account.');
    setConfig('token',    token);
    setConfig('deviceId', device.deviceId);
    setConfig('label',    device.label);
    return text({ discovered: device });
  }
);

// ════════════════════════════════════════════════════
//  DEVICE TOOLS
// ════════════════════════════════════════════════════
server.tool(
  'get_washer_status',
  'Get the current real-time status of the washer from SmartThings',
  {},
  async () => {
    const { token, deviceId } = requireCreds();
    const status = await getDeviceStatus(token, deviceId);
    const main   = status?.components?.main ?? {};

    // Parse into a readable summary
    const state      = main['washerOperatingState']?.washerJobState?.value  ?? main['washerOperatingState']?.machineState?.value ?? 'unknown';
    const cycle      = main['custom.washerWashCourse']?.washerWashCourse?.value ?? 'unknown';
    const temp       = main['custom.washerWashTemperature']?.washerWashTemperature?.value ?? 'unknown';
    const spin       = main['custom.washerSpinLevel']?.washerSpinLevel?.value ?? 'unknown';
    const remote     = main['remoteControlStatus']?.remoteControlEnabled?.value ?? null;
    const completion = main['washerOperatingState']?.completionTime?.value ?? null;

    return text({ state, cycle, temp, spin, remoteEnabled: remote, completionTime: completion, raw: main });
  }
);

server.tool(
  'get_spin_levels',
  'Discover the supported spin level values for this specific washer firmware',
  {},
  async () => {
    const { token, deviceId } = requireCreds();
    const levels = await discoverSpinLevels(token, deviceId);
    return text({ supportedSpinLevels: levels ?? 'Could not determine — use standard values: rinseHold, low, medium, high, extraHigh' });
  }
);

// ════════════════════════════════════════════════════
//  APPLY PRESET
// ════════════════════════════════════════════════════
server.tool(
  'apply_preset',
  'Send a preset\'s wash settings to the washer. User must press Start physically.',
  { id: z.string().describe('Preset ID to apply') },
  async ({ id }) => {
    const { token, deviceId } = requireCreds();
    const preset = getPreset(id);
    if (!preset) return text(`Preset "${id}" not found.`);

    const remoteEnabled = await getRemoteControlStatus(token, deviceId);
    if (!remoteEnabled) {
      return text('⚠️ Smart Control is not enabled on the washer. Ask the user to activate it in the SmartThings app or on the machine panel, then try again.');
    }

    const spinLevels = await discoverSpinLevels(token, deviceId).catch(() => null);
    const result     = await stApplyPreset(token, deviceId, preset, spinLevels);

    recordHistory(preset.id, preset.name);
    return text(`✅ Preset "${preset.name}" applied (cycle=${preset.cycle}, temp=${preset.temp}, spin=${result.spinCmd}). User must press START on the washer.`);
  }
);

// ════════════════════════════════════════════════════
//  HISTORY & ANALYTICS
// ════════════════════════════════════════════════════
server.tool(
  'get_history',
  'Get the last 50 preset applications with timestamps',
  {},
  async () => text(getHistory())
);

server.tool(
  'list_known_cycles',
  'List all known SmartThings wash cycles for this washer model',
  {},
  async () => text({
    cycles: [
      { value: 'delicates',  label: 'Delicados',   tempRange: 'cold–warm',  recommended: 'Ropa delicada, lana fina' },
      { value: 'colors',     label: 'Colores',      tempRange: 'cold–warm',  recommended: 'Ropa de color oscuro' },
      { value: 'normal',     label: 'Normal',       tempRange: 'cold–hot',   recommended: 'Ropa de uso diario' },
      { value: 'cottons',    label: 'Algodones',    tempRange: 'cold–extraHot', recommended: 'Ropa de algodón, camisas' },
      { value: 'quickWash',  label: 'Rápido',       tempRange: 'cold–warm',  recommended: 'Piezas poco sucias, 15–30 min' },
      { value: 'bedding',    label: 'Ropa de cama', tempRange: 'warm–hot',   recommended: 'Sábanas, fundas' },
      { value: 'duvet',      label: 'Edredón',      tempRange: 'cold–warm',  recommended: 'Edredones y almohadas' },
      { value: 'wool',       label: 'Lana',         tempRange: 'cold',       recommended: 'Lana, cashmere' },
      { value: 'synthetics', label: 'Sintéticos',   tempRange: 'cold–warm',  recommended: 'Poliéster, nylon, lycra' },
      { value: 'shirts',     label: 'Camisas',      tempRange: 'warm',       recommended: 'Camisas de vestir' },
      { value: 'dark',       label: 'Oscuros',      tempRange: 'cold',       recommended: 'Ropa negra, oscura' },
      { value: 'rinse',      label: 'Enjuague',     tempRange: 'cold',       recommended: 'Solo enjuague' },
      { value: 'spin',       label: 'Centrifugado', tempRange: 'N/A',        recommended: 'Solo centrifugar' },
    ],
    temps: [
      { value: 'cold',     celsius: 30 },
      { value: 'warm',     celsius: 40 },
      { value: 'hot',      celsius: 60 },
      { value: 'extraHot', celsius: 90 },
    ],
    spinLevels: [
      { value: 'rinseHold', approxRpm: 600  },
      { value: 'medium',    approxRpm: 800  },
      { value: 'high',      approxRpm: 1000 },
      { value: 'extraHigh', approxRpm: 1200 },
    ],
  })
);

// ════════════════════════════════════════════════════
//  CLOTHING ITEMS
// ════════════════════════════════════════════════════
server.tool(
  'list_clothing',
  'List all clothing items in the wardrobe database. Optionally filter by preset.',
  { preset_id: z.string().optional().describe('Filter by preset ID') },
  async ({ preset_id }) => {
    const items = preset_id ? listClothingByPreset(preset_id) : listClothing();
    return text(items);
  }
);

server.tool(
  'add_clothing_item',
  'Add a clothing item to the wardrobe database after scanning its care label. Use this when the user shows you a garment label.',
  {
    brand:      z.string().describe('Brand name, e.g. "Zara", "Nike", "H&M"'),
    name:       z.string().describe('Item description, e.g. "Camiseta negra manga larga"'),
    item_type:  z.string().optional().describe('Type of garment, e.g. "camiseta", "pantalón", "calcetines"'),
    colors:     z.array(z.string()).describe('Color(s) of the garment, e.g. ["negro", "gris"]'),
    fabric:     z.string().describe('Fabric composition from label, e.g. "100% algodón", "60% poliéster 40% algodón"'),
    care_temp:  z.string().optional().describe('Max wash temperature from label, e.g. "30", "40", "60"'),
    care_cycle: z.string().optional().describe('Recommended wash cycle, e.g. "delicates", "normal", "synthetics"'),
    preset_id:  z.string().optional().describe('Preset ID to assign immediately (if known)'),
    notes:      z.string().optional().describe('Extra notes, e.g. "no centrifugar", "lavar del revés"'),
  },
  async (data) => {
    const item = createClothingItem({
      ...data,
      colors: JSON.stringify(data.colors ?? []),
    });
    // Suggest compatible preset if not assigned
    if (!item.preset_id) {
      const presets = listPresets();
      const suggestions = presets.filter(p =>
        (data.care_cycle && p.cycle.toLowerCase().includes(data.care_cycle.toLowerCase())) ||
        (!data.care_cycle && data.fabric?.toLowerCase().includes('delica'))
      ).slice(0, 2);
      return text({ created: item, suggestedPresets: suggestions.map(p => ({ id: p.id, name: p.name, cycle: p.cycle })) });
    }
    return text({ created: item });
  }
);

server.tool(
  'update_clothing_item',
  'Update an existing clothing item in the database',
  {
    id:         z.string().describe('Clothing item ID'),
    brand:      z.string().optional(),
    name:       z.string().optional(),
    item_type:  z.string().optional().describe('Type of garment, e.g. "camiseta", "pantalón"'),
    colors:     z.array(z.string()).optional(),
    fabric:     z.string().optional(),
    care_temp:  z.string().optional(),
    care_cycle: z.string().optional(),
    preset_id:  z.string().nullable().optional(),
    notes:      z.string().optional(),
  },
  async ({ id, colors, ...rest }) => {
    const data = { ...rest };
    if (colors !== undefined) data.colors = JSON.stringify(colors);
    const updated = updateClothingItem(id, data);
    if (!updated) return text(`Clothing item "${id}" not found.`);
    return text({ updated });
  }
);

server.tool(
  'delete_clothing_item',
  'Remove a clothing item from the database',
  { id: z.string().describe('Clothing item ID') },
  async ({ id }) => {
    const ok = deleteClothingItem(id);
    return text(ok ? `Clothing item "${id}" deleted.` : `Not found.`);
  }
);

server.tool(
  'assign_clothing_to_preset',
  'Assign a clothing item to a wash preset. Use this to say "this garment should be washed with preset X".',
  {
    clothing_id: z.string().describe('Clothing item ID'),
    preset_id:   z.string().describe('Preset ID to assign to'),
  },
  async ({ clothing_id, preset_id }) => {
    const item   = getClothingItem(clothing_id);
    const preset = getPreset(preset_id);
    if (!item)   return text(`Clothing item "${clothing_id}" not found.`);
    if (!preset) return text(`Preset "${preset_id}" not found.`);
    assignClothingToPreset(clothing_id, preset_id);
    return text(`✅ "${item.brand} ${item.name}" assigned to preset "${preset.name}".`);
  }
);

server.tool(
  'suggest_preset_for_clothing',
  'Analyze a clothing item and suggest the best matching preset based on fabric and care instructions.',
  { clothing_id: z.string().describe('Clothing item ID to analyze') },
  async ({ clothing_id }) => {
    const item = getClothingItem(clothing_id);
    if (!item) return text(`Clothing item "${clothing_id}" not found.`);
    const presets = listPresets();
    const fabric  = item.fabric.toLowerCase();
    const cycle   = item.care_cycle;
    const temp    = item.care_temp;

    const scored = presets.map(p => {
      let score = 0;
      if (cycle && p.cycle === cycle)                                   score += 3;
      if (cycle && p.cycle.includes(cycle))                             score += 1;
      if (temp === 'cold'  && p.temp === 'cold')                        score += 2;
      if (temp === '30'    && p.temp === 'cold')                        score += 2;
      if (temp === '40'    && p.temp === 'warm')                        score += 2;
      if (fabric.includes('lana') || fabric.includes('wool'))  score += p.cycle === 'wool'      ? 3 : 0;
      if (fabric.includes('seda') || fabric.includes('silk'))  score += p.cycle === 'delicates' ? 3 : 0;
      if (fabric.includes('sintét') || fabric.includes('polyester')) score += p.cycle === 'synthetics' ? 3 : 0;
      if (fabric.includes('algodón') || fabric.includes('cotton'))   score += p.cycle === 'cottons'    ? 2 : 0;
      return { ...p, score };
    }).filter(p => p.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);

    return text({
      item: { id: item.id, brand: item.brand, name: item.name, fabric: item.fabric, care_cycle: item.care_cycle, care_temp: item.care_temp },
      suggestions: scored.map(({ score, ...p }) => ({ id: p.id, name: p.name, cycle: p.cycle, temp: p.temp, score })),
    });
  }
);

server.tool(
  'list_unassigned_clothing',
  'List clothing items that have not been assigned to any preset yet',
  {},
  async () => text(listUnassignedClothing())
);

server.tool(
  'reorder_presets',
  'Update the display order of presets. Pass an array of {id, sort_order} objects.',
  {
    items: z.array(
      z.object({
        id:         z.string().describe('Preset ID'),
        sort_order: z.number().int().describe('New sort position (0 = first)'),
      })
    ).describe('List of presets with their new sort positions'),
  },
  async ({ items }) => {
    reorderPresets(items);
    return text(`Reordered ${items.length} preset(s).`);
  }
);

// ════════════════════════════════════════════════════
//  START
// ════════════════════════════════════════════════════
// ════════════════════════════════════════════════════
//  START — stdio (default) or HTTP (MCP_HTTP=1)
// ════════════════════════════════════════════════════
if (process.env.MCP_HTTP === '1') {
  const { StreamableHTTPServerTransport } = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
  const express = (await import('express')).default;
  const app = express();
  app.use(express.json());

  const PORT = process.env.MCP_PORT || 3002;

  app.all('/mcp', async (req, res) => {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.listen(PORT, process.env.MCP_HOST || '127.0.0.1', () =>
    console.log(`MCP HTTP server listening on http://${process.env.MCP_HOST || '127.0.0.1'}:${PORT}/mcp`)
  );
} else {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
