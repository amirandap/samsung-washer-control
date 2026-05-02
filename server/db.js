import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = join(__dirname, '..', 'data');
mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(join(DATA_DIR, 'washer.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS presets (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    subtitle   TEXT DEFAULT '',
    cycle      TEXT NOT NULL,
    temp       TEXT NOT NULL,
    spin_rpm   INTEGER NOT NULL DEFAULT 1000,
    eco        INTEGER NOT NULL DEFAULT 1,
    color      TEXT NOT NULL DEFAULT '#4f8ef7',
    clothes    TEXT NOT NULL DEFAULT '',
    notes      TEXT DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS preset_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    preset_id  TEXT NOT NULL,
    preset_name TEXT NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ── Migrations ───────────────────────────────────────────────
try { db.exec(`ALTER TABLE presets ADD COLUMN clothes TEXT NOT NULL DEFAULT ''`); } catch (_) { /* already exists */ }
try { db.exec(`ALTER TABLE presets ADD COLUMN compat_colors TEXT NOT NULL DEFAULT '[]'`); } catch (_) { /* already exists */ }
try { db.exec(`ALTER TABLE presets ADD COLUMN dry_cycle TEXT NOT NULL DEFAULT ''`); } catch (_) { /* already exists */ }
try { db.exec(`ALTER TABLE presets ADD COLUMN dry_temp TEXT NOT NULL DEFAULT ''`); } catch (_) { /* already exists */ }
try { db.exec(`ALTER TABLE presets ADD COLUMN dry_notes TEXT NOT NULL DEFAULT ''`); } catch (_) { /* already exists */ }

try { db.exec(`ALTER TABLE clothing_items ADD COLUMN item_type TEXT NOT NULL DEFAULT ''`); } catch (_) { /* already exists */ }
db.exec(`
  CREATE TABLE IF NOT EXISTS clothing_items (
    id         TEXT PRIMARY KEY,
    brand      TEXT NOT NULL DEFAULT '',
    name       TEXT NOT NULL DEFAULT '',
    colors     TEXT NOT NULL DEFAULT '[]',
    fabric     TEXT NOT NULL DEFAULT '',
    care_temp  TEXT NOT NULL DEFAULT '',
    care_cycle TEXT NOT NULL DEFAULT '',
    preset_id  TEXT DEFAULT NULL,
    notes      TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ── Seed default presets if table is empty ─────────────────────
const count = db.prepare('SELECT COUNT(*) as n FROM presets').get();
if (count.n === 0) {
  const insert = db.prepare(`
    INSERT INTO presets (id, name, subtitle, cycle, temp, spin_rpm, eco, color, sort_order)
    VALUES (@id, @name, @subtitle, @cycle, @temp, @spin_rpm, @eco, @color, @sort_order)
  `);
  const seed = db.transaction(() => {
    insert.run({ id: 'p1', name: 'Columbia', subtitle: 'Delicado',       cycle: 'delicates', temp: 'cold', spin_rpm: 600,  eco: 1, color: '#e74c3c', sort_order: 0 });
    insert.run({ id: 'p2', name: 'Oscuros',  subtitle: 'Colores',        cycle: 'colors',    temp: 'cold', spin_rpm: 1000, eco: 1, color: '#2471a3', sort_order: 1 });
    insert.run({ id: 'p3', name: 'Claros',   subtitle: 'Normal',         cycle: 'normal',    temp: 'cold', spin_rpm: 1000, eco: 1, color: '#95a5a6', sort_order: 2 });
    insert.run({ id: 'p4', name: 'Pasteles', subtitle: 'Camisas / Tibio',cycle: 'cottons',   temp: 'warm', spin_rpm: 1000, eco: 1, color: '#c9a84c', sort_order: 3 });
  });
  seed();
}

// ── Preset queries ─────────────────────────────────────────────
export const presetQueries = {
  list: db.prepare('SELECT * FROM presets ORDER BY sort_order, created_at'),

  get: db.prepare('SELECT * FROM presets WHERE id = ?'),

  create: db.prepare(`
    INSERT INTO presets (id, name, subtitle, cycle, temp, spin_rpm, eco, color, clothes, compat_colors, notes, dry_cycle, dry_temp, dry_notes, sort_order)
    VALUES (@id, @name, @subtitle, @cycle, @temp, @spin_rpm, @eco, @color, @clothes, @compat_colors, @notes, @dry_cycle, @dry_temp, @dry_notes, @sort_order)
  `),

  update: db.prepare(`
    UPDATE presets
    SET name = @name, subtitle = @subtitle, cycle = @cycle, temp = @temp,
        spin_rpm = @spin_rpm, eco = @eco, color = @color, clothes = @clothes,
        compat_colors = @compat_colors, notes = @notes,
        dry_cycle = @dry_cycle, dry_temp = @dry_temp, dry_notes = @dry_notes,
        sort_order = @sort_order, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `),

  delete: db.prepare('DELETE FROM presets WHERE id = ?'),

  reorder: db.prepare('UPDATE presets SET sort_order = @sort_order WHERE id = @id'),
};

// ── Config queries ─────────────────────────────────────────────
export const configQueries = {
  get: db.prepare('SELECT value FROM config WHERE key = ?'),
  set: db.prepare('INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'),
  getAll: db.prepare('SELECT key, value FROM config'),
};

// ── History queries ────────────────────────────────────────────
export const historyQueries = {
  add:  db.prepare('INSERT INTO preset_history (preset_id, preset_name) VALUES (?, ?)'),
  list: db.prepare('SELECT * FROM preset_history ORDER BY applied_at DESC LIMIT 50'),
};

// ── Helpers ────────────────────────────────────────────────────
export function getConfig(key) {
  const row = configQueries.get.get(key);
  if (row) return row.value;
  if (key === 'token' && process.env.SMARTTHINGS_TOKEN) return process.env.SMARTTHINGS_TOKEN;
  return null;
}

export function setConfig(key, value) {
  configQueries.set.run(key, value);
}

export function listPresets() {
  return presetQueries.list.all().map(row => ({ ...row, eco: row.eco === 1 }));
}

export function getPreset(id) {
  const row = presetQueries.get.get(id);
  return row ? { ...row, eco: row.eco === 1 } : null;
}

export function createPreset(data) {
  const id = data.id || `preset_${Date.now()}`;
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM presets').get();
  presetQueries.create.run({
    id,
    name:       data.name,
    subtitle:   data.subtitle   ?? '',
    cycle:      data.cycle,
    temp:       data.temp,
    spin_rpm:   data.spin_rpm   ?? 1000,
    eco:        data.eco        ?? true ? 1 : 0,
    color:      data.color      ?? '#4f8ef7',
    clothes:       data.clothes    ?? '',
    compat_colors: data.compat_colors ?? '[]',
    notes:         data.notes      ?? '',
    dry_cycle:     data.dry_cycle  ?? '',
    dry_temp:      data.dry_temp   ?? '',
    dry_notes:     data.dry_notes  ?? '',
    sort_order: data.sort_order ?? (maxOrder.m !== null ? maxOrder.m + 1 : 0),
  });
  return getPreset(id);
}

export function updatePreset(id, data) {
  const existing = getPreset(id);
  if (!existing) return null;
  presetQueries.update.run({
    id,
    name:       data.name       ?? existing.name,
    subtitle:   data.subtitle   ?? existing.subtitle,
    cycle:      data.cycle      ?? existing.cycle,
    temp:       data.temp       ?? existing.temp,
    spin_rpm:   data.spin_rpm   ?? existing.spin_rpm,
    eco:        (data.eco       ?? existing.eco) ? 1 : 0,
    color:      data.color      ?? existing.color,
    clothes:       data.clothes      !== undefined ? data.clothes : (existing.clothes ?? ''),
    compat_colors: data.compat_colors !== undefined ? data.compat_colors : (existing.compat_colors ?? '[]'),
    notes:         data.notes        ?? existing.notes,
    dry_cycle:     data.dry_cycle    !== undefined ? data.dry_cycle : (existing.dry_cycle ?? ''),
    dry_temp:      data.dry_temp     !== undefined ? data.dry_temp  : (existing.dry_temp  ?? ''),
    dry_notes:     data.dry_notes    !== undefined ? data.dry_notes : (existing.dry_notes ?? ''),
    sort_order: data.sort_order ?? existing.sort_order,
  });
  return getPreset(id);
}

export function deletePreset(id) {
  const existing = getPreset(id);
  if (!existing) return false;
  presetQueries.delete.run(id);
  return true;
}

export function reorderPresets(items) {
  const reorder = db.transaction(() => {
    for (const { id, sort_order } of items) {
      presetQueries.reorder.run({ id, sort_order });
    }
  });
  reorder();
}

export function recordHistory(presetId, presetName) {
  historyQueries.add.run(presetId, presetName);
}

export function getHistory() {
  return historyQueries.list.all();
}

// ── Clothing item queries ──────────────────────────────────────
const clothingQueries = {
  list:          db.prepare('SELECT * FROM clothing_items ORDER BY brand, name'),
  listByPreset:  db.prepare('SELECT * FROM clothing_items WHERE preset_id = ? ORDER BY brand, name'),
  get:           db.prepare('SELECT * FROM clothing_items WHERE id = ?'),
  create:        db.prepare(`
    INSERT INTO clothing_items (id, brand, name, item_type, colors, fabric, care_temp, care_cycle, preset_id, notes)
    VALUES (@id, @brand, @name, @item_type, @colors, @fabric, @care_temp, @care_cycle, @preset_id, @notes)
  `),
  update:        db.prepare(`
    UPDATE clothing_items
    SET brand = @brand, name = @name, item_type = @item_type, colors = @colors, fabric = @fabric,
        care_temp = @care_temp, care_cycle = @care_cycle, preset_id = @preset_id, notes = @notes
    WHERE id = @id
  `),
  delete:        db.prepare('DELETE FROM clothing_items WHERE id = ?'),
  assignPreset:  db.prepare('UPDATE clothing_items SET preset_id = @preset_id WHERE id = @id'),
  unassigned:    db.prepare('SELECT * FROM clothing_items WHERE preset_id IS NULL ORDER BY brand, name'),
};

export function listClothing() {
  return clothingQueries.list.all();
}

export function listClothingByPreset(presetId) {
  return clothingQueries.listByPreset.all(presetId);
}

export function getClothingItem(id) {
  return clothingQueries.get.get(id) ?? null;
}

export function createClothingItem(data) {
  const id = data.id || `cloth_${Date.now()}`;
  clothingQueries.create.run({
    id,
    brand:      data.brand      ?? '',
    name:       data.name       ?? '',
    item_type:  data.item_type  ?? '',
    colors:     data.colors     ?? '[]',
    fabric:     data.fabric     ?? '',
    care_temp:  data.care_temp  ?? '',
    care_cycle: data.care_cycle ?? '',
    preset_id:  data.preset_id  ?? null,
    notes:      data.notes      ?? '',
  });
  return getClothingItem(id);
}

export function updateClothingItem(id, data) {
  const existing = getClothingItem(id);
  if (!existing) return null;
  clothingQueries.update.run({
    id,
    brand:      data.brand      ?? existing.brand,
    name:       data.name       ?? existing.name,
    item_type:  data.item_type  !== undefined ? data.item_type : existing.item_type,
    colors:     data.colors     !== undefined ? data.colors : existing.colors,
    fabric:     data.fabric     ?? existing.fabric,
    care_temp:  data.care_temp  ?? existing.care_temp,
    care_cycle: data.care_cycle ?? existing.care_cycle,
    preset_id:  data.preset_id  !== undefined ? data.preset_id : existing.preset_id,
    notes:      data.notes      ?? existing.notes,
  });
  return getClothingItem(id);
}

export function deleteClothingItem(id) {
  const existing = getClothingItem(id);
  if (!existing) return false;
  clothingQueries.delete.run(id);
  return true;
}

export function assignClothingToPreset(clothingId, presetId) {
  clothingQueries.assignPreset.run({ preset_id: presetId, id: clothingId });
}

export function listUnassignedClothing() {
  return clothingQueries.unassigned.all();
}

export default db;
