import { COLOR_SWATCHES, parseCompatColors } from '../constants.js';

export default function PresetCard({ preset, clothing = [], isApplying, onApply, onEdit, onDelete }) {
  const compatColors = parseCompatColors(preset.compat_colors);
  const brands    = [...new Set(clothing.map(i => i.brand).filter(Boolean))];
  const itemTypes = [...new Set(clothing.map(i => i.item_type).filter(Boolean))];

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

      <div className="preset-quick-info">
        <div className="quick-info-row">
          <span className="qi-label">Marcas</span>
          <span className="qi-value">
            {brands.length > 0
              ? brands.join(', ')
              : <span className="qi-empty">—</span>}
          </span>
        </div>

        <div className="quick-info-row">
          <span className="qi-label">Colores</span>
          <span className="qi-value qi-colors">
            {compatColors.length > 0
              ? compatColors.map(v => {
                  const sw = COLOR_SWATCHES.find(s => s.value === v);
                  if (!sw) return null;
                  return (
                    <span key={v} className="compat-dot-wrap" title={sw.label}>
                      <span className="compat-dot" style={{ background: sw.hex, border: `2px solid ${sw.border}` }} />
                      <span className="compat-dot-label">{sw.label}</span>
                    </span>
                  );
                })
              : <span className="qi-empty">—</span>}
          </span>
        </div>

        <div className="quick-info-row">
          <span className="qi-label">Tipo</span>
          <span className="qi-value">
            {itemTypes.length > 0
              ? itemTypes.join(', ')
              : <span className="qi-empty">—</span>}
          </span>
        </div>
      </div>

      {preset.notes && <div className="preset-notes">{preset.notes}</div>}

      <button
        className="btn btn-apply"
        disabled={isApplying}
        onClick={() => onApply(preset)}
        style={{ '--apply-color': preset.color }}
      >
        {isApplying
          ? <><span className="spinner" /> Enviando…</>
          : 'Aplicar preset'}
      </button>
    </div>
  );
}
