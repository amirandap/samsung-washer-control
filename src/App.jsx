import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api.js';
import SetupPanel      from './components/SetupPanel.jsx';
import StatusCard      from './components/StatusCard.jsx';
import PresetGrid      from './components/PresetGrid.jsx';
import PresetEditor    from './components/PresetEditor.jsx';
import ApplyModal      from './components/ApplyModal.jsx';
import WashDoneModal   from './components/WashDoneModal.jsx';
import Toast           from './components/Toast.jsx';

export default function App() {
  // ── Config state ─────────────────────────────────
  const [configured, setConfigured] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [authMode, setAuthMode] = useState('pat'); // 'oauth' | 'pat'

  // ── Status state ─────────────────────────────────
  const [status, setStatus]   = useState(null);
  const [statusErr, setStatusErr] = useState(null);
  const [nextRefresh, setNextRefresh] = useState(30);

  // ── Presets state ─────────────────────────────────
  const [presets,   setPresets]   = useState([]); // each preset has .clothing_items[]
  const [applying,  setApplying]  = useState(null); // preset id being applied

  // ── Editor state ──────────────────────────────────
  const [editorOpen,   setEditorOpen]   = useState(false);
  const [editingPreset, setEditingPreset] = useState(null); // null = create

  // ── Toast ─────────────────────────────────────────
  const [toast, setToast] = useState(null); // { msg, type }

  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type, key: Date.now() });
  }, []);

  // ── Init: load everything before showing the app ─────────────
  useEffect(() => {
    // Clean oauth URL params from a successful redirect
    const params = new URLSearchParams(window.location.search);
    if (params.has('oauth') && params.get('oauth') !== 'error') {
      const url = new URL(window.location.href);
      url.searchParams.delete('oauth');
      url.searchParams.delete('reason');
      window.history.replaceState({}, '', url.toString());
    }

    async function init() {
      try {
        const cfg = await api.getConfig();

        // OAuth configured but no active token → redirect silently, no flash
        if (cfg.oauthConfigured && !cfg.oauthConnected) {
          window.location.href = api.oauthAuthorizeUrl();
          return;
        }

        setAuthMode(cfg.authMode ?? 'pat');

        if (!cfg.token || !cfg.deviceId) {
          setConfigLoading(false);
          return;
        }

        // Load presets+clothing+status in parallel — single SQL JOIN, no N+1
        const [presetsData, statusData] = await Promise.all([
          api.listPresetsWithClothing(),
          api.getStatus().catch(err => {
            // 401 = token invalid; re-auth if OAuth, otherwise show setup
            if (err.status === 401) throw err;
            // Non-auth error: show app but with status error
            setStatusErr(err.message);
            return null;
          }),
        ]);

        setPresets(presetsData);
        if (statusData) setStatus(statusData);
        setConfigured(true);
      } catch (err) {
        if (err.status === 401) {
          // Token invalid — try to re-auth via OAuth silently
          try {
            const cfg = await api.getConfig();
            if (cfg.oauthConfigured) {
              window.location.href = api.oauthAuthorizeUrl();
              return;
            }
          } catch (_) { /* fall through to setup */ }
        }
        // Not configured or unrecoverable → show setup
      } finally {
        setConfigLoading(false);
      }
    }
    init();
  }, []);  

  // ── Reload presets (used after create/edit/delete) ────────────
  const loadPresets = useCallback(() => {
    api.listPresetsWithClothing().then(setPresets).catch(console.error);
  }, []);

  // ── Status polling ─────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.getStatus();
      setStatus(data);
      setStatusErr(null);
    } catch (err) {
      setStatusErr(err.message);
      if (err.status === 401) {
        // Silently re-auth if OAuth, otherwise drop to setup
        api.getConfig().then(cfg => {
          if (cfg.oauthConfigured) window.location.href = api.oauthAuthorizeUrl();
          else setConfigured(false);
        }).catch(() => setConfigured(false));
      }
    }
    setNextRefresh(30);
  }, []);

  const refreshRef = useRef(null);
  const countdownRef = useRef(null);

  useEffect(() => {
    if (!configured) {
      clearInterval(refreshRef.current);
      clearInterval(countdownRef.current);
      return;
    }
    // Status already loaded during init — just start polling
    refreshRef.current   = setInterval(fetchStatus, 30000);
    countdownRef.current = setInterval(() => setNextRefresh(n => Math.max(0, n - 1)), 1000);
    return () => {
      clearInterval(refreshRef.current);
      clearInterval(countdownRef.current);
    };
  }, [configured, fetchStatus]);

  // ── Wash-done modal ────────────────────────────────
  const [washDone, setWashDone] = useState(null);   // { presetId, presetName }
  const lastWasherState = useRef(null);
  const lastAppliedPreset = useRef(null); // { id, name } of the last confirmed preset

  // Detect running → finished transition
  useEffect(() => {
    if (!status) return;
    const main = status?.components?.main ?? {};
    const state = main['washerOperatingState']?.washerJobState?.value
      ?? main['washerOperatingState']?.machineState?.value ?? 'unknown';
    const s = state.toLowerCase();
    const isRunning = s.includes('run') || s.includes('wash') || s.includes('spin') || s.includes('rinse');
    const isFinished = s.includes('end') || s.includes('finish') || s.includes('stop');
    const prev = lastWasherState.current;
    lastWasherState.current = s;
    if (prev && !prev.includes('unknown') && isFinished) {
      const wasRunning = prev.includes('run') || prev.includes('wash') || prev.includes('spin') || prev.includes('rinse');
      if (wasRunning && lastAppliedPreset.current) {
        setWashDone(lastAppliedPreset.current);
      }
    }
    void isRunning; // suppress unused warning
  }, [status]);

  // ── Apply preset ──────────────────────────────────
  const [applyTarget, setApplyTarget] = useState(null); // preset pending confirmation

  const handleApply = useCallback((preset) => {
    setApplyTarget(preset);
  }, []);

  const confirmApply = useCallback(async ({ lbs, kg, ml }) => {
    const preset = applyTarget;
    setApplyTarget(null);
    setApplying(preset.id);
    lastAppliedPreset.current = { presetId: preset.id, presetName: preset.name };
    try {
      await api.applyPreset(preset.id);
      showToast(`✅ "${preset.name}" enviado — usa ${ml} ml de detergente (${lbs} lbs). Presiona START.`, 'success');
      setTimeout(fetchStatus, 1500);
    } catch (err) {
      if (err.data?.error === 'REMOTE_DISABLED') {
        showToast('⚠️ Activa Smart Control en la lavadora primero.', 'warn');
      } else if (err.status === 401) {
        showToast('🔑 Token inválido.', 'error');
      } else {
        showToast(`Error: ${err.message}`, 'error');
      }
    } finally {
      setApplying(null);
    }
  }, [applyTarget, fetchStatus, showToast]);

  // ── Editor ────────────────────────────────────────
  const openCreate = () => { setEditingPreset(null); setEditorOpen(true); };
  const openEdit   = (p) => { setEditingPreset(p);   setEditorOpen(true); };

  const handleEditorSave = useCallback(async (data) => {
    try {
      if (editingPreset) {
        await api.updatePreset(editingPreset.id, data);
        showToast('Preset actualizado.', 'success');
      } else {
        await api.createPreset(data);
        showToast('Preset creado.', 'success');
      }
      setEditorOpen(false);
      loadPresets();
    } catch (err) {
      showToast(`Error guardando: ${err.message}`, 'error');
    }
  }, [editingPreset, loadPresets, showToast]);

  const handleDelete = useCallback(async (preset) => {
    if (!confirm(`¿Eliminar el preset "${preset.name}"?`)) return;
    try {
      await api.deletePreset(preset.id);
      showToast(`Preset "${preset.name}" eliminado.`, 'info');
      loadPresets();
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  }, [loadPresets, showToast]);

  // ── Render ────────────────────────────────────────
  if (configLoading) {
    return <div className="loading-screen"><span className="spinner-lg" /></div>;
  }

  if (!configured) {
    return (
      <>
        <SetupPanel
          onConnected={() => { setConfigured(true); }}
          showToast={showToast}
        />
        <Toast toast={toast} />
      </>
    );
  }

  return (
    <>
      <div className="app-layout">
        <header className="app-header">
          <div className="header-left">
            <span className="header-icon">🫧</span>
            <h1>Washer Control</h1>
          </div>
          <div className="header-right">
            <StatusCard
              status={status}
              error={statusErr}
              nextRefresh={nextRefresh}
              onRefresh={fetchStatus}
            />
            <button className="btn btn-primary btn-sm" onClick={openCreate}>+ Nuevo</button>
            <button className="btn btn-ghost btn-sm" onClick={async () => {
              if (authMode === 'oauth') {
                await api.disconnectOAuth().catch(() => {});
              }
              setConfigured(false);
            }}>
              {authMode === 'oauth' ? 'Desconectar' : 'Cambiar token'}
            </button>
          </div>
        </header>

        <PresetGrid
          presets={presets}
          applying={applying}
          onApply={handleApply}
          onEdit={openEdit}
          onDelete={handleDelete}
          onNew={openCreate}
        />
      </div>

      {editorOpen && (
        <PresetEditor
          preset={editingPreset}
          onSave={handleEditorSave}
          onClose={() => setEditorOpen(false)}
        />
      )}

      {applyTarget && (
        <ApplyModal
          preset={applyTarget}
          onConfirm={confirmApply}
          onClose={() => setApplyTarget(null)}
        />
      )}

      {washDone && (
        <WashDoneModal
          presetId={washDone.presetId}
          presetName={washDone.presetName}
          clothing={(presets.find(p => p.id === washDone.presetId)?.clothing_items) ?? []}
          onClose={() => setWashDone(null)}
        />
      )}

      <Toast toast={toast} />
    </>
  );
}
