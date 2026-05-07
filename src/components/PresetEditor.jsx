import { useState } from 'react';
import { CYCLES, TEMPS, SPINS, CLOTHES_TYPES, COLOR_SWATCHES, DRY_CYCLES, DRY_TEMPS, DETERGENT_TYPES, parseCompatColors, formatCompatColors } from '../constants.js';

const COLOR_PRESETS = ['#e74c3c','#e67e22','#f1c40f','#c9a84c','#2ecc71','#1abc9c','#3498db','#2471a3','#9b59b6','#95a5a6','#7f8c8d'];

export default function PresetEditor({ preset, onSave, onClose }) {
  const [form, setForm] = useState({
    name:      preset?.name      ?? '',
    subtitle:  preset?.subtitle  ?? '',
    cycle:     preset?.cycle     ?? 'normal',
    temp:      preset?.temp      ?? 'cold',
    spin_rpm:  preset?.spin_rpm  ?? 1000,
    eco:       preset?.eco       ?? true,
    color:     preset?.color     ?? '#4f8ef7',
    clothes:   preset?.clothes   ?? '',
    compat_colors: formatCompatColors(parseCompatColors(preset?.compat_colors)),
    notes:     preset?.notes     ?? '',
    dry_cycle: preset?.dry_cycle ?? '',
    dry_temp:  preset?.dry_temp  ?? '',
    dry_notes: preset?.dry_notes ?? '',
    detergent_type: preset?.detergent_type ?? 'regular',
    sort_order:preset?.sort_order ?? 99,
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'El nombre es obligatorio.';
    if (!form.cycle)       e.cycle = 'Selecciona un ciclo.';
    if (!form.temp)        e.temp  = 'Selecciona una temperatura.';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{preset ? 'Editar preset' : 'Nuevo preset'}</h3>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {/* Name */}
          <div className="field">
            <label>Nombre *</label>
            <input type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej. Deporte" />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>

          {/* Subtitle */}
          <div className="field">
            <label>Subtítulo</label>
            <input type="text" value={form.subtitle} onChange={e => set('subtitle', e.target.value)} placeholder="Ej. Ropa deportiva" />
          </div>

          {/* Cycle + Temp row */}
          <div className="field-row">
            <div className="field">
              <label>Ciclo *</label>
              <select value={form.cycle} onChange={e => set('cycle', e.target.value)}>
                {CYCLES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              {errors.cycle && <span className="field-error">{errors.cycle}</span>}
            </div>
            <div className="field">
              <label>Temperatura *</label>
              <select value={form.temp} onChange={e => set('temp', e.target.value)}>
                {TEMPS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {errors.temp && <span className="field-error">{errors.temp}</span>}
            </div>
          </div>

          {/* Spin + Eco row */}
          <div className="field-row">
            <div className="field">
              <label>Centrifugado</label>
              <select value={form.spin_rpm} onChange={e => set('spin_rpm', Number(e.target.value))}>
                {SPINS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="field field-center">
              <label>EcoBubble</label>
              <label className="toggle">
                <input type="checkbox" checked={form.eco} onChange={e => set('eco', e.target.checked)} />
                <span className="toggle-track"><span className="toggle-thumb" /></span>
                <span className="toggle-label">{form.eco ? 'On' : 'Off'}</span>
              </label>
            </div>
          </div>

          {/* Color */}
          <div className="field">
            <label>Color del badge</label>
            <div className="color-row">
              {COLOR_PRESETS.map(c => (
                <button
                  key={c} type="button"
                  className={`color-chip ${form.color === c ? 'color-chip-active' : ''}`}
                  style={{ background: c }}
                  onClick={() => set('color', c)}
                />
              ))}
              <input
                type="color"
                value={form.color}
                onChange={e => set('color', e.target.value)}
                className="color-custom"
                title="Color personalizado"
              />
            </div>
          </div>

          {/* Compatible colors */}
          <div className="field">
            <label>Colores compatibles</label>
            <div className="clothes-row">
              {COLOR_SWATCHES.map(sw => {
                const selected = parseCompatColors(form.compat_colors).includes(sw.value);
                const toggle = () => {
                  const cur = parseCompatColors(form.compat_colors);
                  const next = selected ? cur.filter(v => v !== sw.value) : [...cur, sw.value];
                  set('compat_colors', formatCompatColors(next));
                };
                return (
                  <button key={sw.value} type="button"
                    className={`color-swatch-chip ${selected ? 'color-swatch-active' : ''}`}
                    style={{ '--sw-hex': sw.hex, '--sw-border': sw.border }}
                    onClick={toggle} title={sw.label}
                  >
                    <span className="sw-dot" style={{
                      background: sw.hex, border: `2px solid ${sw.border}`
                    }} />
                    <span>{sw.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Clothes type */}
          <div className="field">
            <label>Tipo de ropa</label>
            <div className="clothes-row">
              {CLOTHES_TYPES.map(ct => (
                <button
                  key={ct.value} type="button"
                  className={`clothes-chip ${form.clothes === ct.value ? 'clothes-chip-active' : ''}`}
                  style={{ '--chip-color': ct.color }}
                  onClick={() => set('clothes', ct.value)}
                  title={ct.label}
                >
                  <span className="clothes-chip-emoji">{ct.emoji}</span>
                  <span className="clothes-chip-label">{ct.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="field">
            <label>Notas / observaciones</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={3}
              placeholder="Ej. Usar para ropa de deporte sintética, no mezclar con algodón…"
            />
          </div>

          {/* Detergent type */}
          <div className="field">
            <label>Tipo de detergente</label>
            <select value={form.detergent_type} onChange={e => set('detergent_type', e.target.value)}>
              {DETERGENT_TYPES.map(d => (
                <option key={d.value} value={d.value}>{d.emoji} {d.label}</option>
              ))}
            </select>
          </div>

          {/* Drying */}
          <div className="field-section-title">🌀 Instrucciones de secado</div>
          <div className="field-row">
            <div className="field">
              <label>Ciclo de secado</label>
              <select value={form.dry_cycle} onChange={e => set('dry_cycle', e.target.value)}>
                <option value="">— Sin especificar —</option>
                {DRY_CYCLES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Temperatura secado</label>
              <select value={form.dry_temp} onChange={e => set('dry_temp', e.target.value)}>
                <option value="">— Sin especificar —</option>
                {DRY_TEMPS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Notas de secado</label>
            <textarea
              value={form.dry_notes}
              onChange={e => set('dry_notes', e.target.value)}
              rows={2}
              placeholder="Ej. Sacar inmediatamente al terminar. Brooks Brothers colgar directo."
            />
          </div>

          {/* Sort order */}
          <div className="field" style={{ maxWidth: 120 }}>
            <label>Orden de visualización</label>
            <input
              type="number"
              value={form.sort_order}
              onChange={e => set('sort_order', Number(e.target.value))}
              min={0}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><span className="spinner" /> Guardando…</> : preset ? 'Guardar cambios' : 'Crear preset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
