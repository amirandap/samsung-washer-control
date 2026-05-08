import { parseCompatColors } from '../constants.js';

const MAX_VISIBLE = 4;

export default function PresetCard({ preset, isApplying, onApply, onEdit, onDelete }) {
  const clothing  = preset.clothing_items ?? [];
  const names     = clothing.map(i => [i.brand, i.name].filter(Boolean).join(' ')).filter(Boolean);
  const visible   = names.slice(0, MAX_VISIBLE);
  const overflow  = names.length - MAX_VISIBLE;

  return (
    <div
      className={`preset-card ${isApplying ? 'preset-sending' : ''}`}
      style={{ '--preset-color': preset.color }}
    >
      <div className="preset-accent" />

      <div className="preset-header">
        <span className="preset-badge-dot" style={{ background: preset.color }} />
        <div className="preset-name-group">
          <div className="preset-name">{preset.name}</div>
          {preset.subtitle && <div className="preset-sub">{preset.subtitle}</div>}
        </div>
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

      {names.length > 0 ? (
        <div className="preset-clothes-list">
          {visible.map((n, i) => (
            <span key={i} className="preset-clothes-name">{n}</span>
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

