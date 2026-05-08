import { parseCompatColors, COLOR_SWATCHES } from '../constants.js';

const MAX_VISIBLE = 4;

const colorHex = Object.fromEntries(COLOR_SWATCHES.map(c => [c.value, c.hex]));

function ColorDots({ raw }) {
  const colors = parseCompatColors(raw).slice(0, 5);
  if (!colors.length) return null;
  return (
    <span className="item-color-dots">
      {colors.map(c => (
        <span
          key={c}
          className="item-color-dot"
          style={{ background: colorHex[c] ?? c, border: c === 'blanco' ? '1px solid #ccc' : 'none' }}
          title={c}
        />
      ))}
    </span>
  );
}

export default function PresetCard({ preset, isApplying, onApply, onEdit, onDelete }) {
  const clothing = preset.clothing_items ?? [];
  const visible  = clothing.slice(0, MAX_VISIBLE);
  const overflow = clothing.length - MAX_VISIBLE;

  return (
    <div
      className={`preset-card ${isApplying ? 'preset-sending' : ''}`}
      style={{ '--preset-color': preset.color }}
    >
      <div className="preset-accent" />

      <div className="preset-header">
        <span className="preset-badge-dot" style={{ background: preset.color }} />
        <div className="preset-name">{preset.name}</div>
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

      {clothing.length > 0 ? (
        <div className="preset-clothes-list">
          {visible.map((item, i) => (
            <div key={item.id ?? i} className="preset-clothes-row">
              <span className="preset-clothes-brand">{item.brand || item.name}</span>
              {item.item_type && <span className="preset-clothes-type">{item.item_type}</span>}
              <ColorDots raw={item.colors} />
            </div>
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

