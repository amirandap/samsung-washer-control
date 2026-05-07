import { useState, useEffect, useRef } from 'react';
import { api } from '../api.js';

const KG_STEP  = 0.5;

// ── Detergent calculation logic ───────────────────────────────────────────────
function calcDetergent(kg, preset) {
  if (!kg || kg <= 0) return null;
  const BASE_ML_PER_KG = 13;
  let ml = kg * BASE_ML_PER_KG;
  if (preset.temp === 'cold') ml *= 1.05;
  if (preset.temp === 'hot' || preset.temp === 'extraHot') ml *= 0.9;
  if (['delicates', 'wool', 'synthetics', 'quickWash'].includes(preset.cycle)) ml *= 0.75;
  if (preset.eco) ml *= 0.85;
  return Math.round(ml);
}

function DetergentBar({ ml, max = 150 }) {
  const pct   = Math.min(100, (ml / max) * 100);
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

// ── Scale live-view widget ────────────────────────────────────────────────────
function ScaleLive({ onWeight }) {
  const [status, setStatus]   = useState('connecting'); // idle | connecting | live | settled | error
  const [liveKg, setLiveKg]   = useState(null);
  const esRef = useRef(null);

  useEffect(() => {
    const es = api.scaleStream();
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'status') {
          if (data.scanning) setStatus(s => s === 'settled' ? s : 'connecting');
        } else if (data.type === 'reading') {
          setLiveKg(data.weight_kg);
          setStatus('live');
        } else if (data.type === 'weight') {
          setLiveKg(data.weight_kg);
          setStatus('settled');
          onWeight(data.weight_kg);
        }
      } catch { /* ignore parse errors */ }
    };
    es.onerror = () => setStatus('error');

    return () => { es.close(); esRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const statusLabel = {
    idle:       'Esperando báscula…',
    connecting: 'Conectando…',
    live:       'Pesando…',
    settled:    'Peso capturado ✓',
    error:      'Error de conexión BLE',
  }[status];

  const dotColor = {
    idle:       'var(--muted)',
    connecting: 'var(--warn)',
    live:       'var(--accent)',
    settled:    'var(--success)',
    error:      'var(--danger)',
  }[status];

  return (
    <div className="scale-live">
      <div className="scale-live-header">
        <span className="scale-live-dot" style={{ background: dotColor }} />
        <span className="scale-live-status">{statusLabel}</span>
      </div>
      <div className={`scale-live-weight ${status === 'live' ? 'scale-live-pulse' : ''}`}>
        {liveKg !== null
          ? <><span className="scale-live-num">{liveKg.toFixed(2)}</span><span className="scale-live-unit"> kg</span></>
          : <span className="scale-live-placeholder">— — kg</span>
        }
      </div>
      {liveKg !== null && (
        <span className="scale-live-lbs">{(liveKg * 2.20462).toFixed(1)} lbs · Pon la ropa en la báscula</span>
      )}
      {liveKg === null && (
        <span className="scale-live-hint">Pon la ropa en la báscula</span>
      )}
    </div>
  );
}

export default function ApplyModal({ preset, onConfirm, onClose }) {
  // kg is the canonical unit internally; display in kg with +/- 0.5 kg steps
  const [kg, setKg]       = useState(null);
  const [useScale, setUseScale] = useState(true);
  const careItems = (preset.clothing_items ?? []).filter(i => i.care_instructions?.trim());

  const ml    = kg !== null ? calcDetergent(kg, preset) : null;
  const valid = ml !== null && ml > 0;

  const adjust = (delta) => setKg(prev => {
    const next = Math.round(((prev ?? 0) + delta) * 10) / 10;
    return Math.max(0.5, Math.min(30, next));
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!valid) return;
    onConfirm({ lbs: +(kg * 2.20462).toFixed(1), kg, ml });
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-sm" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h3>Aplicar — <span style={{ color: preset.color }}>{preset.name}</span></h3>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">

          {/* ── Mode toggle ── */}
          <div className="weight-mode-tabs">
            <button type="button" className={`weight-tab ${useScale ? 'weight-tab-active' : ''}`}
              onClick={() => setUseScale(true)}>⚖️ Báscula BLE</button>
            <button type="button" className={`weight-tab ${!useScale ? 'weight-tab-active' : ''}`}
              onClick={() => setUseScale(false)}>✏️ Manual</button>
          </div>

          {/* ── Scale live view ── */}
          {useScale && (
            <ScaleLive onWeight={(w) => setKg(Math.round(w * 10) / 10)} />
          )}

          {/* ── Weight stepper (always visible) ── */}
          <div className="weight-stepper">
            <button type="button" className="stepper-btn stepper-minus"
              onClick={() => adjust(-KG_STEP)} disabled={kg !== null && kg <= 0.5}>−</button>
            <div className="stepper-display">
              {kg !== null
                ? <><span className="stepper-num">{kg.toFixed(1)}</span><span className="stepper-unit">kg</span></>
                : <span className="stepper-placeholder">— kg</span>
              }
              {kg !== null && (
                <span className="stepper-lbs">{(kg * 2.20462).toFixed(1)} lbs</span>
              )}
            </div>
            <button type="button" className="stepper-btn stepper-plus"
              onClick={() => adjust(+KG_STEP)}>+</button>
          </div>

          {/* ── Detergent result ── */}
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

          {/* ── Care instructions ── */}
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
