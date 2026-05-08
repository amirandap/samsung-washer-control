import { parseCompatColors, COLOR_SWATCHES } from '../constants.js';

const MAX_VISIBLE = 5;
const colorHex = Object.fromEntries(COLOR_SWATCHES.map(c => [c.value, c.hex]));

export default function PresetCard({ preset, isApplying, onApply, onEdit, onDelete }) {
  const clothing = preset.clothing_items ?? [];

  // Unique brands
  const brands  = [...new Set(clothing.map(i => i.brand).filter(Boolean))];
  const visible = brands.slice(0, MAX_VISIBLE);
  const overflow = brands.length - MAX_VISIBLE;

  // Aggregate unique colors from all items
  const allColors = [...new Set(
    clothing.flatMap(i => parseCompatColors(i.colors))
  )].slice(0, 6);

  return (
    <div
      className={`preset-card ${isApplying ? 'preset-sending' : ''}`}
      style={{ '--preset-color': preset.color }}
    >
      <div className="preset-accent" />

      {/* Name row */}
      <div className="preset-header">
        <span className="preset-badge-dot" style={{ background: preset.color }} />
        <div className="preset-name">{preset.name}</div>
      </div>

      {/* Colors + edit/delete row */}
      <div className="preset-meta-row">
        {allColors.length > 0 && (
          <span className="item-color-dots">
            {allColors.map(c => (
              <span
                key={c}
                className="item-color-dot"
                style={{ background: colorHex[c] ?? c, border: c === 'blanco' ? '1px solid #ccc' : 'none' }}
                title={c}
              />
            ))}
          </span>
        )}
        <div className="preset-actions">
          <button
            className="btn btn-icon"
            title="Editar"
            onClick={e => { e.stopPropagation(); onEdit(preset); }}
          >✏️</button>
          <button
            className="btn btn-icon btn-danger-icon"
            title="Eliminar"
            onClick={e => { e.stopPropagation(); onDelete(preset); }}
          >🗑️</button>
        </div>
      </div>

      {brands.length > 0 ? (
        <div className="preset-clothes-list">
          {visible.map((brand, i) => (
            <span key={i} className="preset-clothes-brand">{brand}</span>
          ))}
          {overflow > 0 && (
            <span className="preset-clothes-more">+{overflow} más</span>
          )}
        </div>
      ) : (
        <div className="preset-clothes-empty">Sin prendas asignadas</div>
      )}

      <button
        className="btn btn-apply"
        disabled={isApplying}
        onClick={() => onApply(preset)}
        style={{ '--apply-color': preset.color }}
      >
        {isApplying ? <><span className="spinner" /> Enviando…</> : 'Lavar'}
      </button>
    </div>
  );
}

