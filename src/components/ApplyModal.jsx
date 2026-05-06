import { useState, useEffect, useRef } from 'react';

const LBS_TO_KG = 0.453592;

// ── Detergent calculation logic ───────────────────────────────────────────────
// Base: ~65 ml for 5 kg (13 ml/kg). Adjusts for temp, cycle, EcoBubble.
function calcDetergent(kg, preset) {
  if (!kg || kg <= 0) return null;

  const BASE_ML_PER_KG = 13;
  let ml = kg * BASE_ML_PER_KG;

  if (preset.temp === 'cold') ml *= 1.05;
  if (preset.temp === 'hot' || preset.temp === 'extraHot') ml *= 0.9;

  const gentleCycles = ['delicates', 'wool', 'synthetics', 'quickWash'];
  if (gentleCycles.includes(preset.cycle)) ml *= 0.75;

  if (preset.eco) ml *= 0.85;

  return Math.round(ml);
}

function DetergentBar({ ml, max = 150 }) {
  const pct = Math.min(100, (ml / max) * 100);
  const color = pct < 40 ? '#2ecc71' : pct < 75 ? '#f1c40f' : '#e74c3c';
  return (
    <div className="det-bar-wrap">
      <div className="det-bar-track">
        <div className="det-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="det-bar-label" style={{ color }}>{ml} ml</span>
    </div>
  );
}

export default function ApplyModal({ preset, onConfirm, onClose }) {
  const [lbs, setLbs] = useState('');
  const careItems = (preset.clothing_items ?? []).filter(i => i.care_instructions?.trim());
  const inputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const kg   = lbs !== '' ? parseFloat(lbs) * LBS_TO_KG : null;
  const ml   = kg !== null ? calcDetergent(kg, preset) : null;
  const valid = ml !== null && ml > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!valid) return;
    onConfirm({ lbs: parseFloat(lbs), kg, ml });
  };

  const handleKey = (e) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()} onKeyDown={handleKey}>
      <div className="modal modal-sm" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h3>Aplicar — <span style={{ color: preset.color }}>{preset.name}</span></h3>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <p className="det-intro">
            Ingresa el peso de la carga para calcular la dosis de detergente.
          </p>

          <div className="field">
            <label>Peso de la ropa (lbs)</label>
            <div className="kg-input-row">
              <input
                ref={inputRef}
                type="number"
                value={lbs}
                onChange={e => setLbs(e.target.value)}
                min="1"
                max="28"
                step="0.5"
                placeholder="Ej. 10"
                className="kg-input"
              />
              <span className="kg-unit">lbs</span>
            </div>
            {kg !== null && (
              <span className="kg-conversion">{kg.toFixed(1)} kg</span>
            )}
            <div className="kg-quick">
              {[5, 7, 9, 11, 13, 15, 18].map(n => (
                <button key={n} type="button" className={`kg-chip ${parseFloat(lbs) === n ? 'kg-chip-active' : ''}`}
                  onClick={() => setLbs(String(n))}>{n} lbs</button>
              ))}
            </div>
          </div>

          {valid && (
            <div className="det-result">
              <div className="det-result-title">🧴 Dosis de detergente</div>
              <DetergentBar ml={ml} />
              <ul className="det-hints">
                {preset.eco && <li>🫧 EcoBubble activo — dosis reducida 15 %</li>}
                {['delicates','wool','synthetics','quickWash'].includes(preset.cycle) && (
                  <li>🌸 Ciclo delicado — dosis reducida 25 %</li>
                )}
                {(preset.temp === 'hot' || preset.temp === 'extraHot') && (
                  <li>🌡️ Agua caliente — mejor disolución, menos detergente</li>
                )}
              </ul>
            </div>
          )}

          {careItems.length > 0 && (
            <div className="care-instructions-block">
              <div className="care-instructions-title">⚠️ Instrucciones de cuidado</div>
              <ul className="care-instructions-list">
                {careItems.map(item => (
                  <li key={item.id}>
                    <span className="care-item-name">{item.brand} {item.name}</span>
                    <span className="care-item-note">{item.care_instructions}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="modal-footer">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!valid}
              style={{ '--apply-color': preset.color }}
            >
              Aplicar preset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
