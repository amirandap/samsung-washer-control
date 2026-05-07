import { useState } from 'react';
import { cycleLabel, tempLabel, spinLabel } from '../constants.js';

function parseStatus(data) {
  const main = data?.components?.main ?? {};
  // jobState (camelCase): wash | rinse | spin | finish | none | weightSensing | wrinklePrevent | drying | cooling | airWash | delayWash | ...
  // machineState: run | stop | pause
  const jobState     = main['washerOperatingState']?.washerJobState?.value ?? 'unknown';
  const machineState = main['washerOperatingState']?.machineState?.value   ?? 'unknown';
  // Use jobState when meaningful (not none/unknown), otherwise fall back to machineState
  const state = (jobState !== 'none' && jobState !== 'unknown') ? jobState : machineState;
  // Remaining time from Samsung extension (minutes)
  const remainingMin = main['samsungce.washerOperatingState']?.remainingTime?.value ?? null;
  const progressPct  = main['samsungce.washerOperatingState']?.progress?.value      ?? null;
  // Cycle: cycleType = allInOne / washingOnly / dryingOnly
  const cycle      = main['samsungce.washerCycle']?.cycleType?.value
    ?? main['custom.washerWashCourse']?.washerWashCourse?.value;
  // Temperature: arrives as numeric string "40" (Celsius) or named "cold"
  const temp       = main['custom.washerWaterTemperature']?.washerWaterTemperature?.value
    ?? main['custom.washerWashTemperature']?.washerWashTemperature?.value;
  // Spin: arrives as numeric string "1400" (RPM)
  const spin       = main['custom.washerSpinLevel']?.washerSpinLevel?.value;
  // remoteControlEnabled arrives as string "true"/"false"
  const remoteRaw  = main['remoteControlStatus']?.remoteControlEnabled?.value;
  const remoteEnabled = remoteRaw === true || remoteRaw === 'true';
  const completionTime = main['washerOperatingState']?.completionTime?.value ?? null;
  // EcoBubble = washerBubbleSoak on this model
  const eco        = main['samsungce.washerBubbleSoak']?.status?.value
    ?? main['samsungce.ecoBubble']?.ecoBubble?.value ?? null;
  return { state, jobState, machineState, remainingMin, progressPct, cycle, temp, spin, remoteEnabled, completionTime, eco };
}

function timeLeft(completionTime) {
  if (!completionTime) return null;
  const diff = new Date(completionTime) - new Date();
  if (diff <= 0) return 'Terminado';
  const totalSec = Math.floor(diff / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function stateBadgeProps(state) {
  // machineState: run | stop | pause
  // washerJobState: wash | rinse | spin | drying | cooling | airWash | weightSensing | finish | wrinklePrevent | none
  const ACTIVE_STATES  = ['run', 'wash', 'rinse', 'spin', 'drying', 'cooling',
                          'airWash', 'weightSensing', 'delayWash', 'pre_wash', 'prewash'];
  const DONE_STATES    = ['finish', 'wrinklePrevent', 'stop'];
  const s = state ?? 'unknown';
  if (ACTIVE_STATES.includes(s))
    return { cls: 'badge-running', label: 'En marcha', dot: 'dot dot-pulse' };
  if (s === 'pause')
    return { cls: 'badge-paused', label: 'Pausado', dot: 'dot dot-grey' };
  if (DONE_STATES.includes(s))
    return { cls: 'badge-end', label: 'Terminado', dot: 'dot dot-grey' };
  if (s === 'unknown')
    return { cls: 'badge-idle', label: 'Cargando…', dot: 'dot dot-grey' };
  return { cls: 'badge-idle', label: 'Reposo', dot: 'dot dot-grey' };
}

export default function StatusCard({ status, error, nextRefresh, onRefresh }) {
  const [open, setOpen] = useState(false);
  const parsed = status ? parseStatus(status) : null;
  // Prefer remainingMin from Samsung extension (live countdown), fallback to completionTime ISO
  const tl     = parsed
    ? (parsed.remainingMin != null
        ? (parsed.remainingMin <= 0 ? 'Terminado' : `${parsed.remainingMin}m`)
        : timeLeft(parsed.completionTime))
    : null;
  const { cls, label, dot } = stateBadgeProps(parsed?.state);
  const isRunning = cls === 'badge-running';

  return (
    <>
      {/* Compact trigger — just the badge + time if running */}
      <button
        className={`status-badge ${cls} status-badge-btn`}
        onClick={() => setOpen(true)}
        title="Ver estado detallado"
      >
        <span className={dot} />
        {isRunning && tl ? tl : label}
      </button>

      {/* Detail modal */}
      {open && (
        <div className="status-modal-overlay" onClick={() => setOpen(false)}>
          <div className="status-modal" onClick={e => e.stopPropagation()}>
            <div className="status-modal-header">
              <span className={`status-badge ${cls}`}><span className={dot} />{label}</span>
              <div className="status-actions">
                <span className="refresh-info">
                  {error
                    ? <span className="text-danger">{error}</span>
                    : `actualiza en ${nextRefresh}s`}
                </span>
                <button
                  className="btn btn-ghost btn-xs icon-btn"
                  onClick={() => { onRefresh(); }}
                  title="Actualizar ahora"
                >↻</button>
                <button className="btn btn-ghost btn-xs icon-btn" onClick={() => setOpen(false)} title="Cerrar">✕</button>
              </div>
            </div>

            <div className="status-grid">
              <div className="stat-item">
                <div className="stat-label">Ciclo</div>
                <div className="stat-value">{cycleLabel(parsed?.cycle)}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Temperatura</div>
                <div className="stat-value">{tempLabel(parsed?.temp)}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Centrifugado</div>
                <div className="stat-value">{spinLabel(parsed?.spin)}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Tiempo restante</div>
                <div className="stat-value">{tl ?? '—'}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Smart Control</div>
                <div className="stat-value">
                  {parsed?.remoteEnabled
                    ? <span className="text-success">✔ Sí</span>
                    : <span className="text-danger">✘ No</span>}
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-label">EcoBubble</div>
                <div className="stat-value">
                  {parsed?.eco === true  || parsed?.eco === 'on'  ? '✔ On' :
                   parsed?.eco === false || parsed?.eco === 'off' ? '✘ Off' : '—'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
