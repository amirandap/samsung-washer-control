import { useState } from 'react';
import { api } from '../api.js';

export default function SetupPanel({ onConnected, showToast }) {
  const [token,    setToken]    = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleConnect = async () => {
    setError('');
    if (!token.trim()) { setError('El token no puede estar vacío.'); return; }
    setLoading(true);
    try {
      if (deviceId.trim()) {
        // Manual device ID — just save config
        await api.saveConfig({ token: token.trim(), deviceId: deviceId.trim() });
      } else {
        // Auto-discover
        await api.discover({ token: token.trim() });
      }
      onConnected();
    } catch (err) {
      if (err.status === 401) setError('Token inválido. Verifica e intenta de nuevo.');
      else if (err.status === 404) setError('No se encontró una lavadora en tu cuenta. Ingresa el Device ID manualmente.');
      else setError(err.message ?? 'Error desconocido.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setup-wrap">
      <div className="setup-panel">
        <div className="setup-icon">🫧</div>
        <h2>SmartThings Washer</h2>
        <p>Ingresa tu Personal Access Token para conectarte al dispositivo.</p>

        <label>Personal Access Token</label>
        <input
          type="password"
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder="Pega aquí tu token…"
          onKeyDown={e => e.key === 'Enter' && handleConnect()}
          autoComplete="off"
          spellCheck={false}
        />

        <label>Device ID <span className="muted">(opcional — se auto-detecta)</span></label>
        <input
          type="text"
          value={deviceId}
          onChange={e => setDeviceId(e.target.value)}
          placeholder="Dejar vacío para auto-detectar"
          autoComplete="off"
          spellCheck={false}
        />

        {error && <div className="inline-error">{error}</div>}

        <button
          className="btn btn-primary w-full"
          onClick={handleConnect}
          disabled={loading}
        >
          {loading ? <><span className="spinner" /> Conectando…</> : 'Conectar'}
        </button>

        <p className="setup-hint">
          Crea tu token en{' '}
          <a href="https://account.smartthings.com/tokens" target="_blank" rel="noreferrer">
            account.smartthings.com/tokens
          </a>
        </p>
      </div>
    </div>
  );
}
