import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { detergentLabel } from '../constants.js';

const LB_STEP  = 1;
const STALE_MS = 5 * 60 * 1000;

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

function timeAgo(isoString) {
  if (!isoString) return '';
  const diffSec = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (diffSec < 60)  return 'hace un momento';
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

export default function ApplyModal({ preset, onConfirm, onClose }) {
  const [lbs, setLbs]               = useState(null);
  const [weightInfo, setWeightInfo] = useState(null);
  const careItems = (preset.clothing_items ?? []).filter(i => i.care_instructions?.trim());
  const detergent = detergentLabel(preset.detergent_type);

  useEffect(() => {
    api.getLastScaleWeight().then(d => {
      if (d.available) {
        setWeightInfo({ lbs: d.weight_lbs, receivedAt: d.received_at });
        setLbs(Math.round(d.weight_lbs));
      }
    }).catch(() => {});

    const es = api.scaleStream();
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'weight') {
          const newLbs = data.weight_kg * 2.20462;
          setWeightInfo({ lbs: newLbs, receivedAt: new Date().toISOString() });
          setLbs(Math.round(newLbs));
        }
      } catch { /* ignore */ }
    };
    return () => es.close();
  }, []);  

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const isFresh = weightInfo && (now - new Date(weightInfo.receivedAt)) < STALE_MS;
  const kg      = lbs !== null ? lbs / 2.20462 : null;
  const ml      = kg  !== null ? calcDetergent(kg, preset) : null;
  const valid   = ml  !== null && ml > 0;

  const adjust = (delta) => setLbs(prev => {
    const next = Math.round((prev ?? 16) + delta);
    return Math.max(1, Math.min(66, next));
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!valid) return;
    onConfirm({ lbs: +lbs.toFixed(1), kg: +kg.toFixed(3), ml });
  };

  return (
    <div className="apply-screen" role="dialog" aria-modal="true">
      {/* ── Header ── */}
      <div className="apply-header">
        <button type="button" className="apply-back" onClick={onClose} aria-label="Volver">
          ←
        </button>
        <div className="apply-header-info">
          <span className="apply-header-name" style={{ color: preset.color }}>{preset.name}</span>
          {preset.subtitle && <span className="apply-header-sub">{preset.subtitle}</span>}
        </div>
        <div
          className="apply-header-dot"
          style={{ background: preset.color }}
        />
      </div>

      {/* ── Body ── */}
      <form onSubmit={handleSubmit} className="apply-body">

        {/* Weight source indicator */}
        <div className={`apply-weight-row ${weightInfo ? (isFresh ? 'weight-fresh' : 'weight-stale') : 'weight-none'}`}>
          <span className="weight-source-dot" />
          {weightInfo ? (
            <>
              <span className="weight-source-val">{weightInfo.lbs.toFixed(1)} lbs</span>
              <span className="weight-source-meta">
                {(weightInfo.lbs / 2.20462).toFixed(2)} kg · {timeAgo(weightInfo.receivedAt)}
                {!isFresh && <span className="weight-source-stale-note"> — desactualizado</span>}
              </span>
            </>
          ) : (
            <span className="weight-source-meta muted">Sin peso de báscula</span>
          )}
        </div>

        {/* Stepper */}
        <div className="weight-stepper">
          <button type="button" className="stepper-btn stepper-minus" onClick={() => adjust(-LB_STEP)} disabled={lbs !== null && lbs <= 1}>−</button>
          <div className="stepper-display">
            {lbs !== null
              ? <>
                  <span className="stepper-num">{lbs.toFixed(0)}</span>
                  <span className="stepper-unit">lbs</span>
                  <span className="stepper-lbs">{(lbs / 2.20462).toFixed(2)} kg</span>
                </>
              : <span className="stepper-placeholder">— lbs</span>
            }
          </div>
          <button type="button" className="stepper-btn stepper-plus" onClick={() => adjust(+LB_STEP)} disabled={lbs !== null && lbs >= 66}>+</button>
        </div>

        {/* Detergent result */}
        <div className="apply-det-row">
          <div className="apply-det-num">{valid ? ml : '—'}</div>
          <div className="apply-det-meta">
            <span className="apply-det-unit">ml</span>
            <span className="apply-det-label">{detergent.emoji} {detergent.label}</span>
          </div>
        </div>

        {/* Care warnings — compact chips */}
        {careItems.length > 0 && (
          <div className="apply-care-row">
            <span className="apply-care-icon">⚠️</span>
            <div className="apply-care-chips">
              {careItems.map(item => (
                <span key={item.id} className="apply-care-chip" title={item.care_instructions}>
                  {item.brand} {item.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <button type="submit" className="apply-cta" disabled={!valid}>
          Enviar a lavar
        </button>

      </form>
    </div>
  );
}
