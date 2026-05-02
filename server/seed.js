/**
 * Seed script — run once to populate presets and clothing items
 * from guia_lavado.md.
 *
 *   node --env-file=.env server/seed.js
 */

import {
  updatePreset, getPreset, createPreset,
  createClothingItem, updateClothingItem, getClothingItem, listClothing,
  assignClothingToPreset,
} from './db.js';

// ── 1. PRESETS ────────────────────────────────────────────────

const PRESETS = [
  {
    id:           'p1',
    name:         'Columbia',
    subtitle:     'Delicado Frío',
    cycle:        'delicates',
    temp:         'cold',
    spin_rpm:     600,
    eco:          true,
    color:        '#e07b39',
    clothes:      'delicados',
    compat_colors: JSON.stringify(['blanco','negro','azul','verde','rojo','amarillo','rosa','gris','colores']),
    notes:        'Lavar sola, nunca mezclar. Sin suavizante.',
    dry_cycle:    'synthetics',
    dry_temp:     'low',
    dry_notes:    'Sintéticos Seco · Temp. Baja. Sacar en < 5 min al terminar.',
    sort_order:   0,
  },
  {
    id:           'p2',
    name:         'Oscuros',
    subtitle:     'Colores Oscuros 30°C',
    cycle:        'colors',
    temp:         'cold',
    spin_rpm:     1000,
    eco:          true,
    color:        '#2c3e50',
    clothes:      'oscuros',
    compat_colors: JSON.stringify(['negro','gris','azul']),
    notes:        'Happy Socks en bolsa de malla. Sin suavizante en Brooks Brothers. Secar medias solas.',
    dry_cycle:    'synthetics',
    dry_temp:     'medium_low',
    dry_notes:    'Sintéticos Seco · Media-baja (regla segura para mezclas). Si solo hay algodón puro → Algodón Seco Media. Brooks Brothers: colgar inmediato.',
    sort_order:   1,
  },
  {
    id:           'p3',
    name:         'Claros',
    subtitle:     'Neutros/Blancos 30°C',
    cycle:        'cottons',
    temp:         'cold',
    spin_rpm:     1000,
    eco:          true,
    color:        '#95a5a6',
    clothes:      'blancos',
    compat_colors: JSON.stringify(['blanco','gris']),
    notes:        'Happy Socks en bolsa de malla. Sin suavizante en Brooks Brothers. UNIQLO rayas: lavar con el grupo del color más oscuro. Blancos Arturo Calle: se puede añadir blanqueador sin cloro. Secar medias solas.',
    dry_cycle:    'synthetics',
    dry_temp:     'medium_low',
    dry_notes:    'Sintéticos Seco · Media-baja (protege spandex/lycra/poliéster). Happy Socks → Baja.',
    sort_order:   2,
  },
  {
    id:           'p4',
    name:         'Pasteles',
    subtitle:     'Camisas/Medios 40°C',
    cycle:        'cottons',
    temp:         'warm',
    spin_rpm:     1000,
    eco:          true,
    color:        '#c084d4',
    clothes:      'colores',
    compat_colors: JSON.stringify(['rosa','amarillo','azul']),
    notes:        'Sin suavizante en Brooks Brothers. Colgar inmediato al sacar del secador.',
    dry_cycle:    'cotton',
    dry_temp:     'medium',
    dry_notes:    'Algodón Seco · Media. Colgar inmediato para evitar arrugas (lycra/algodón arruga rápido en tambor parado).',
    sort_order:   3,
  },
];

console.log('→ Actualizando presets...');
for (const p of PRESETS) {
  if (getPreset(p.id)) {
    updatePreset(p.id, p);
    console.log(`  ✓ Actualizado: ${p.id} — ${p.name}`);
  } else {
    createPreset(p);
    console.log(`  + Creado: ${p.id} — ${p.name}`);
  }
}

// ── 2. CLOTHING ITEMS ─────────────────────────────────────────

const CLOTHING = [
  // Columbia ─────────────────────────────────────────────────
  {
    id:         'cloth_columbia',
    brand:      'Columbia',
    name:       'Chaqueta/Rompevientos',
    item_type:  'chaqueta',
    colors:     JSON.stringify(['colores']),
    fabric:     '100% Tactel Nylon (shell) · 100% Poliéster (forro)',
    care_temp:  'cold',
    care_cycle: 'delicates',
    preset_id:  'p1',
    notes:      'Siempre sola (P1). Sin suavizante. 600 rpm máx. Secado sintéticos baja.',
  },
  // Arturo Calle ─────────────────────────────────────────────
  {
    id:         'cloth_ac_oscuros',
    brand:      'Arturo Calle',
    name:       'Camisas/Camisetas Oscuras (negro · marino · café · carbón)',
    item_type:  'camisa',
    colors:     JSON.stringify(['negro','gris','azul']),
    fabric:     '100% Algodón',
    care_temp:  'cold',
    care_cycle: 'colors',
    preset_id:  'p2',
    notes:      'Secar a la sombra cuando sea posible. Secado: Algodón Media.',
  },
  {
    id:         'cloth_ac_claros',
    brand:      'Arturo Calle',
    name:       'Camisas/Camisetas Claras (blanco · beige · kaki · crema · gris claro)',
    item_type:  'camisa',
    colors:     JSON.stringify(['blanco','gris']),
    fabric:     '100% Algodón',
    care_temp:  'cold',
    care_cycle: 'cottons',
    preset_id:  'p3',
    notes:      'Se puede añadir blanqueador sin cloro en blancos.',
  },
  {
    id:         'cloth_ac_pasteles',
    brand:      'Arturo Calle',
    name:       'Camisas/Camisetas Pasteles (rosa · celeste · menta · amarillo)',
    item_type:  'camisa',
    colors:     JSON.stringify(['rosa','amarillo']),
    fabric:     '100% Algodón',
    care_temp:  'warm',
    care_cycle: 'cottons',
    preset_id:  'p4',
    notes:      '',
  },
  // GAP ──────────────────────────────────────────────────────
  {
    id:         'cloth_gap_oscuros',
    brand:      'GAP',
    name:       'Chinos Oscuros (negro · azul oscuro · carbón)',
    item_type:  'pantalon',
    colors:     JSON.stringify(['negro','azul','gris']),
    fabric:     '98% Algodón / 2% Spandex',
    care_temp:  'cold',
    care_cycle: 'colors',
    preset_id:  'p2',
    notes:      '⚠️ Bajar spin a 800 rpm. Secado Sintéticos Media-baja (spandex no tolera calor).',
  },
  {
    id:         'cloth_gap_claros',
    brand:      'GAP',
    name:       'Chinos Claros (beige · kaki · stone)',
    item_type:  'pantalon',
    colors:     JSON.stringify(['blanco','gris']),
    fabric:     '98% Algodón / 2% Spandex',
    care_temp:  'cold',
    care_cycle: 'cottons',
    preset_id:  'p3',
    notes:      '⚠️ Bajar spin a 800 rpm. Secado Sintéticos Media-baja (spandex no tolera calor).',
  },
  // UNIQLO ───────────────────────────────────────────────────
  {
    id:         'cloth_uniqlo_oscuros',
    brand:      'UNIQLO',
    name:       'Camisas Oscuras',
    item_type:  'camisa',
    colors:     JSON.stringify(['negro','azul','gris']),
    fabric:     '53% Poliéster / 47% Algodón',
    care_temp:  'cold',
    care_cycle: 'colors',
    preset_id:  'p2',
    notes:      'Secado Sintéticos Media-baja.',
  },
  {
    id:         'cloth_uniqlo_claros',
    brand:      'UNIQLO',
    name:       'Camisas Claras / Rayas',
    item_type:  'camisa',
    colors:     JSON.stringify(['blanco','gris','azul']),
    fabric:     '53% Poliéster / 47% Algodón',
    care_temp:  'cold',
    care_cycle: 'cottons',
    preset_id:  'p3',
    notes:      'Rayas multicolor: lavar con el grupo del color más oscuro presente en la prenda.',
  },
  // Brooks Brothers ──────────────────────────────────────────
  {
    id:         'cloth_bb_oscuros',
    brand:      'Brooks Brothers',
    name:       'Polos/Camisas Oscuros (marino · burdeos · verde)',
    item_type:  'polo',
    colors:     JSON.stringify(['negro','azul']),
    fabric:     '95% Algodón / 5% Lycra',
    care_temp:  'cold',
    care_cycle: 'colors',
    preset_id:  'p2',
    notes:      '🚫 Sin suavizante. Colgar inmediato al sacar del secador.',
  },
  {
    id:         'cloth_bb_blancos',
    brand:      'Brooks Brothers',
    name:       'Polos/Camisas Blancos/Crema',
    item_type:  'polo',
    colors:     JSON.stringify(['blanco']),
    fabric:     '95% Algodón / 5% Lycra',
    care_temp:  'cold',
    care_cycle: 'cottons',
    preset_id:  'p3',
    notes:      '🚫 Sin suavizante.',
  },
  {
    id:         'cloth_bb_pasteles',
    brand:      'Brooks Brothers',
    name:       'Polos/Camisas Pasteles (rosa · celeste · menta)',
    item_type:  'polo',
    colors:     JSON.stringify(['rosa']),
    fabric:     '95% Algodón / 5% Lycra',
    care_temp:  'warm',
    care_cycle: 'cottons',
    preset_id:  'p4',
    notes:      '🚫 Sin suavizante. Colgar inmediato para evitar arrugas.',
  },
  // Happy Socks ──────────────────────────────────────────────
  {
    id:         'cloth_hs_oscuros',
    brand:      'Happy Socks',
    name:       'Medias Oscuras / Estampados Oscuros',
    item_type:  'medias',
    colors:     JSON.stringify(['negro','gris','azul']),
    fabric:     '~78% Algodón / ~20% Poliamida / ~2% Elastano',
    care_temp:  'cold',
    care_cycle: 'colors',
    preset_id:  'p2',
    notes:      '🧺 Siempre en bolsa de malla. Secado Sintéticos Baja.',
  },
  {
    id:         'cloth_hs_claros',
    brand:      'Happy Socks',
    name:       'Medias Claras / Pasteles',
    item_type:  'medias',
    colors:     JSON.stringify(['blanco','rosa','amarillo']),
    fabric:     '~78% Algodón / ~20% Poliamida / ~2% Elastano',
    care_temp:  'cold',
    care_cycle: 'cottons',
    preset_id:  'p3',
    notes:      '🧺 Siempre en bolsa de malla. Secado Sintéticos Baja.',
  },
  // Polo Piqué ───────────────────────────────────────────────
  {
    id:         'cloth_polo_pique',
    brand:      'Polo Piqué',
    name:       'Polo Piqué Azul (marca TBD)',
    item_type:  'polo',
    colors:     JSON.stringify(['azul']),
    fabric:     '100% Algodón (aprox.)',
    care_temp:  'warm',
    care_cycle: 'cottons',
    preset_id:  'p4',
    notes:      'Marca por confirmar — actualizar perfil cuando se identifique.',
  },
];

console.log('\n→ Creando prendas...');
const existing = listClothing().map(c => c.id);

for (const c of CLOTHING) {
  if (existing.includes(c.id)) {
    updateClothingItem(c.id, { item_type: c.item_type });
    console.log(`  ~ Actualizado: ${c.id} — item_type=${c.item_type}`);
  } else {
    createClothingItem(c);
    console.log(`  + Creado: ${c.id} — ${c.brand} · ${c.name}`);
  }
}

console.log('\n✅ Seed completo.');
