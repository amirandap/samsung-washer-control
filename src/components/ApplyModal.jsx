import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { detergentLabel } from '../constants.js';

const LB_STEP  = 1;
const STALE_MS = 5 * 60 * 1000; // 5 minutes

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
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-sm" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h3>⚙️ <span style={{ color: preset.color }}>{preset.name}</span></h3>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">

          <div className={`weight-source-row ${weightInfo ? (isFresh ? 'weight-fresh' : 'weight-stale') : 'weight-none'}`}>
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
              <span className="weight-source-meta">Sin peso registrado</span>
            )}
          </div>

          <div className="weight-stepper">
            <button type="button" className="stepper-btn stepper-minus" onClick={() => adjust(-LB_STEP)}>−</button>
            <div className="stepper-display">
              {lbs !== null
                ? <><span className="stepper-num">{lbs.toFixed(0)}</span><span className="stepper-unit">lbs</span></>
                : <span className="stepper-placeholder">— lbs</span>
              }
              {lbs !== null && <span className="stepper-lbs">{(lbs / 2.20462).toFixed(2)} kg</span>}
            </div>
            <button type="button" className="stepper-btn stepper-plus" onClick={() => adjust(+LB_STEP)}>+</button>
          </div>

          {valid && (
            <div className="det-result">
              <div className="det-ml-display">
                <span className="det-ml-num">{ml}</span>
                <span className="det-ml-unit">ml</span>
              </div>
              <div className="det-ml-label">{detergent.emoji} {detergent.label}</div>
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
            <button type="submit" className="btn btn-primary w-full" disabled={!valid}>
              Enviar a lavar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
