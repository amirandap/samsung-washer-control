import { useState, useEffect, useRef } from 'react';
import { api } from '../api.js';

const LB_STEP  = 1;

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
  const [status, setStatus]         = useState('connecting');
  const [liveLbs, setLiveLbs]       = useState(null);
  const [hwStable, setHwStable]     = useState(true);   // false = below scale's min threshold
  const [scaleSource, setScaleSource] = useState('auto'); // auto | ble | ha | esphome
  const esRef = useRef(null);

  useEffect(() => {
    const es = api.scaleStream();
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'config') {
          setScaleSource(data.source);
          // For webhook sources, flip from 'connecting' to 'idle' immediately
          if (data.source !== 'ble' && data.source !== 'auto') {
            setStatus(s => s === 'settled' ? s : 'idle');
          }
        } else if (data.type === 'status') {
          if (data.scanning) setStatus(s => s === 'settled' ? s : 'connecting');
        } else if (data.type === 'reading') {
          setLiveLbs(data.weight_kg * 2.20462);
          setStatus('live');
        } else if (data.type === 'weight') {
          const lbs = data.weight_kg * 2.20462;
          setLiveLbs(lbs);
          setHwStable(data.stable !== false);
          setStatus('settled');
          onWeight(lbs);
        }
      } catch { /* ignore parse errors */ }
    };
    // Only flag error for BLE sources; webhook sources tolerate SSE reconnects
    es.onerror = () => {
      setStatus(s => {
        if (s === 'settled') return s;
        return (scaleSource === 'ble') ? 'error' : 'idle';
      });
    };

    return () => { es.close(); esRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isWebhook = scaleSource === 'ha' || scaleSource === 'esphome';
  const sourceLabel = { ha: 'Home Assistant', esphome: 'ESPHome', ble: 'BLE', auto: 'BLE' }[scaleSource] ?? 'báscula';

  const statusLabel = isWebhook
    ? {
        idle:     `Esperando ${sourceLabel}…`,
        settled:  'Peso recibido ✓',
        live:     'Recibiendo peso…',
        error:    `Sin respuesta de ${sourceLabel}`,
        connecting: `Esperando ${sourceLabel}…`,
      }[status]
    : {
        idle:       'Esperando báscula…',
        connecting: 'Conectando BLE…',
        live:       'Pesando…',
        settled:    'Peso capturado ✓',
        error:      'Error de conexión BLE',
      }[status];

  const dotColor = {
    idle:       'var(--muted)',
    connecting: 'var(--warn)',
    live:       'var(--accent)',
    settled:    hwStable ? 'var(--success)' : 'var(--warn)',
    error:      'var(--danger)',
  }[status];

  return (
    <div className="scale-live">
      <div className="scale-live-header">
        <span className="scale-live-dot" style={{ background: dotColor }} />
        <span className="scale-live-status">{statusLabel}</span>
        {scaleSource !== 'auto' && (
          <span className="scale-live-source-badge">{sourceLabel}</span>
        )}
      </div>
      {status === 'settled' && !hwStable && (
        <div className="scale-live-approx-note">
          Peso estimado por consistencia (por debajo del mínimo de la báscula)
        </div>
      )}
      <div className={`scale-live-weight ${status === 'live' ? 'scale-live-pulse' : ''}`}>
        {liveLbs !== null
          ? <><span className="scale-live-num">{liveLbs.toFixed(1)}</span><span className="scale-live-unit"> lbs</span></>
          : <span className="scale-live-placeholder">— — lbs</span>
        }
      </div>
      {liveLbs !== null && (
        <span className="scale-live-lbs">{(liveLbs / 2.20462).toFixed(2)} kg · Pon la ropa en la báscula</span>
      )}
      {liveLbs === null && (
        <span className="scale-live-hint">Pon la ropa en la báscula</span>
      )}
    </div>
  );
}

export default function ApplyModal({ preset, onConfirm, onClose }) {
  // lbs is the display unit; kg is derived for detergent calculation
  const [lbs, setLbs]       = useState(null);
  const [useScale, setUseScale] = useState(true);
  const careItems = (preset.clothing_items ?? []).filter(i => i.care_instructions?.trim());

  const kg    = lbs !== null ? lbs / 2.20462 : null;
  const ml    = kg  !== null ? calcDetergent(kg, preset) : null;
  const valid = ml  !== null && ml > 0;

  const adjust = (delta) => setLbs(prev => {
    const next = Math.round((prev ?? 0) + delta);
    return Math.max(1, Math.min(66, next));
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!valid) return;
    onConfirm({ lbs: +lbs.toFixed(1), kg: +kg.toFixed(3), ml });
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
              onClick={() => setUseScale(true)}>⚖️ Báscula</button>
            <button type="button" className={`weight-tab ${!useScale ? 'weight-tab-active' : ''}`}
              onClick={() => setUseScale(false)}>✏️ Manual</button>
          </div>

          {/* ── Scale live view ── */}
          {useScale && (
            <ScaleLive onWeight={(w) => setLbs(Math.round(w))} />
          )}

          {/* ── Weight stepper (always visible) ── */}
          <div className="weight-stepper">
            <button type="button" className="stepper-btn stepper-minus"
              onClick={() => adjust(-LB_STEP)} disabled={lbs !== null && lbs <= 1}>−</button>
            <div className="stepper-display">
              {lbs !== null
                ? <><span className="stepper-num">{lbs.toFixed(0)}</span><span className="stepper-unit">lbs</span></>
                : <span className="stepper-placeholder">— lbs</span>
              }
              {lbs !== null && (
                <span className="stepper-lbs">{(lbs / 2.20462).toFixed(2)} kg</span>
              )}
            </div>
            <button type="button" className="stepper-btn stepper-plus"
              onClick={() => adjust(+LB_STEP)}>+</button>
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
