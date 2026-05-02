// ── Cycle labels ─────────────────────────────────────────────────────────────
// Covers both the stored preset values AND the raw SmartThings API values
export const CYCLE_LABELS = {
  // stored values
  delicates:   'Delicados',
  colors:      'Colores',
  normal:      'Normal',
  cottons:     'Algodones / Camisas',
  quickWash:   'Rápido',
  bedding:     'Ropa de cama',
  duvet:       'Edredón',
  wool:        'Lana',
  synthetics:  'Sintéticos',
  dark:        'Oscuros',
  rinse:       'Enjuague',
  spin:        'Centrifugado',
  // Samsung API raw values
  normalCourse:        'Normal',
  cottonCourse:        'Algodones / Camisas',
  colorCourse:         'Colores',
  delicateCourse:      'Delicados',
  delicatesCourse:     'Delicados',
  bedSheetsCourse:     'Ropa de cama',
  duvets:              'Edredón',
  woolCourse:          'Lana',
  syntheticsCourse:    'Sintéticos',
  darkCourse:          'Oscuros',
  rinseCourse:         'Enjuague',
  spinCourse:          'Centrifugado',
  quickWashCourse:     'Rápido',
  intensiveWash:       'Lavado intensivo',
  hygieneSteam:        'Higiene con vapor',
  rinseHoldCourse:     'Enjuague + Pausa',
  sportsCourse:        'Deporte',
  outerWear:           'Ropa exterior',
};

// ── Temperature labels ────────────────────────────────────────────────────────
export const TEMP_LABELS = {
  cold:     '30 °C — Frío',
  warm:     '40 °C — Tibio',
  hot:      '60 °C — Caliente',
  extraHot: '90 °C — Muy caliente',
};

export const TEMP_SHORT = {
  cold:     '30 °C',
  warm:     '40 °C',
  hot:      '60 °C',
  extraHot: '90 °C',
};

// ── Spin labels ───────────────────────────────────────────────────────────────
export const SPIN_LABELS = {
  no:        'Sin centri.',
  rinseHold: '~600 rpm',
  low:       '~600 rpm',
  medium:    '800 rpm',
  high:      '1000 rpm',
  extraHigh: '1200 rpm',
  // stored numeric
  600:       '600 rpm',
  800:       '800 rpm',
  1000:      '1000 rpm',
  1200:      '1200 rpm',
};

// ── Clothes types ─────────────────────────────────────────────────────────────
export const CLOTHES_TYPES = [
  { value: '',          label: '—',                emoji: '🧺', color: '#95a5a6' },
  { value: 'blancos',   label: 'Blancos',           emoji: '🤍', color: '#ecf0f1' },
  { value: 'colores',   label: 'Colores',           emoji: '🌈', color: '#e74c3c' },
  { value: 'oscuros',   label: 'Oscuros / Negros',  emoji: '🖤', color: '#2c3e50' },
  { value: 'delicados', label: 'Delicados',         emoji: '🌸', color: '#f1c0e8' },
  { value: 'deporte',   label: 'Deporte',           emoji: '👟', color: '#2ecc71' },
  { value: 'cama',      label: 'Ropa de cama',      emoji: '🛏️', color: '#9b59b6' },
  { value: 'exterior',  label: 'Ropa exterior',     emoji: '🧥', color: '#3498db' },
  { value: 'toallas',   label: 'Toallas',           emoji: '🪣', color: '#1abc9c' },
];

// ── Compatible clothing colors (multi-select) ──────────────────────────────
export const COLOR_SWATCHES = [
  { value: 'blanco',   label: 'Blanco',    hex: '#ffffff', border: '#ccc'    },
  { value: 'gris',     label: 'Gris',      hex: '#adb5bd', border: '#adb5bd' },
  { value: 'negro',    label: 'Negro',     hex: '#212529', border: '#555'    },
  { value: 'azul',     label: 'Azul',      hex: '#3498db', border: '#3498db' },
  { value: 'verde',    label: 'Verde',     hex: '#2ecc71', border: '#2ecc71' },
  { value: 'rojo',     label: 'Rojo',      hex: '#e74c3c', border: '#e74c3c' },
  { value: 'amarillo', label: 'Amarillo',  hex: '#f1c40f', border: '#d4ac0d' },
  { value: 'rosa',     label: 'Rosa',      hex: '#f0a0c0', border: '#e879a0' },
  { value: 'colores',  label: 'Multicolor',hex: 'linear-gradient(135deg,#e74c3c,#f1c40f,#2ecc71,#3498db)', border: '#aaa' },
];

export function parseCompatColors(raw) {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export function formatCompatColors(arr) {
  return JSON.stringify(arr ?? []);
}
export const CYCLES = [
  { value: 'delicates',  label: CYCLE_LABELS.delicates  },
  { value: 'colors',     label: CYCLE_LABELS.colors     },
  { value: 'normal',     label: CYCLE_LABELS.normal     },
  { value: 'cottons',    label: CYCLE_LABELS.cottons     },
  { value: 'quickWash',  label: CYCLE_LABELS.quickWash  },
  { value: 'bedding',    label: CYCLE_LABELS.bedding    },
  { value: 'duvet',      label: CYCLE_LABELS.duvet      },
  { value: 'wool',       label: CYCLE_LABELS.wool       },
  { value: 'synthetics', label: CYCLE_LABELS.synthetics },
  { value: 'dark',       label: CYCLE_LABELS.dark       },
  { value: 'rinse',      label: CYCLE_LABELS.rinse      },
  { value: 'spin',       label: CYCLE_LABELS.spin       },
];

export const TEMPS = [
  { value: 'cold',     label: TEMP_LABELS.cold     },
  { value: 'warm',     label: TEMP_LABELS.warm     },
  { value: 'hot',      label: TEMP_LABELS.hot      },
  { value: 'extraHot', label: TEMP_LABELS.extraHot },
];

export const SPINS = [
  { value: 600,  label: '600 rpm — Delicado' },
  { value: 800,  label: '800 rpm — Medio'    },
  { value: 1000, label: '1000 rpm — Alto'    },
  { value: 1200, label: '1200 rpm — Máximo'  },
];

export function cycleLabel(raw) {
  if (!raw) return '—';
  return CYCLE_LABELS[raw] ?? (raw.charAt(0).toUpperCase() + raw.slice(1));
}

export function tempLabel(raw, short = false) {
  if (!raw) return '—';
  const map = short ? TEMP_SHORT : TEMP_LABELS;
  return map[raw] ?? (raw.charAt(0).toUpperCase() + raw.slice(1));
}

export function spinLabel(raw) {
  if (raw == null) return '—';
  return SPIN_LABELS[raw] ?? SPIN_LABELS[String(raw)] ?? `${raw} rpm`;
}

export function clothesType(value) {
  return CLOTHES_TYPES.find(c => c.value === value) ?? CLOTHES_TYPES[0];
}

// ── Drying labels ──────────────────────────────────────────────
export const DRY_CYCLE_LABELS = {
  synthetics: 'Sintéticos Seco',
  cotton:     'Algodón Seco',
  delicates:  'Delicados Seco',
  wool:       'Lana Seco',
};

export const DRY_TEMP_LABELS = {
  low:        '🌡️ Baja',
  medium_low: '🌡️ Media-baja',
  medium:     '🌡️ Media',
  high:       '🌡️ Alta',
};

export const DRY_CYCLES = [
  { value: 'synthetics', label: 'Sintéticos Seco' },
  { value: 'cotton',     label: 'Algodón Seco'    },
  { value: 'delicates',  label: 'Delicados Seco'  },
  { value: 'wool',       label: 'Lana Seco'       },
];

export const DRY_TEMPS = [
  { value: 'low',        label: 'Baja'       },
  { value: 'medium_low', label: 'Media-baja' },
  { value: 'medium',     label: 'Media'      },
  { value: 'high',       label: 'Alta'       },
];

export function dryLabel(cycle, temp) {
  const c = DRY_CYCLE_LABELS[cycle] ?? cycle ?? '';
  const t = DRY_TEMP_LABELS[temp]   ?? temp  ?? '';
  if (!c && !t) return '—';
  return `${c}${t ? ' · ' + t : ''}`;
}
