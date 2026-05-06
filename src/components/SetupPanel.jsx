import { useState, useEffect } from 'react';
import { api } from '../api.js';

// ── OAuth Setup tab ────────────────────────────────────────────
function OAuthTab({ showToast }) {
  const [clientId,     setClientId]     = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [loading,      setLoading]      = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [error,        setError]        = useState('');

  const handleAuthorize = async () => {
    setError('');
    if (!clientId.trim() || !clientSecret.trim()) {
      setError('Completa Client ID y Client Secret.');
      return;
    }
    setLoading(true);
    try {
      await api.setupOAuth({ client_id: clientId.trim(), client_secret: clientSecret.trim() });
      // Navigate the browser to the OAuth authorize flow
      window.location.href = api.oauthAuthorizeUrl();
    } catch (err) {
      setError(err.message ?? 'Error guardando credenciales.');
      setLoading(false);
    }
  };

  return (
    <div className="oauth-tab">
      <p className="setup-desc">
        Conecta con OAuth para obtener tokens que se renuevan automáticamente.
        Necesitas crear una app en{' '}
        <a href="https://developer.smartthings.com/" target="_blank" rel="noreferrer">
          SmartThings Developer Portal
        </a>.
      </p>

      <details className="setup-instructions">
        <summary>¿Cómo crear la app? (clic para expandir)</summary>
        <ol>
          <li>Instala el CLI: <code>npm install -g @smartthings/cli</code></li>
          <li>Ejecuta: <code>smartthings apps:create</code></li>
          <li>Selecciona <strong>API Access</strong> (API_ONLY)</li>
          <li>Scopes: <code>r:devices:*</code> y <code>x:devices:*</code></li>
          <li>Redirect URI: <code>{window.location.origin + window.location.pathname}api/oauth/callback</code></li>
          <li>Copia el <strong>Client ID</strong> y <strong>Client Secret</strong></li>
        </ol>
      </details>

      <label>Client ID</label>
      <input
        type="text"
        value={clientId}
        onChange={e => setClientId(e.target.value)}
        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        autoComplete="off"
        spellCheck={false}
      />

      <label>Client Secret</label>
      <input
        type="password"
        value={clientSecret}
        onChange={e => setClientSecret(e.target.value)}
        placeholder="Tu client secret…"
        autoComplete="off"
        spellCheck={false}
      />

      {error && <div className="inline-error">{error}</div>}

      <button
        className="btn btn-primary w-full"
        onClick={handleAuthorize}
        disabled={loading}
      >
        {loading
          ? <><span className="spinner" /> Redirigiendo…</>
          : '🔐 Autorizar con SmartThings'}
      </button>
    </div>
  );
}

// ── PAT (manual) tab ───────────────────────────────────────────
function PATTab({ onConnected }) {
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
        await api.saveConfig({ token: token.trim(), deviceId: deviceId.trim() });
      } else {
        await api.discover({ token: token.trim() });
      }
      onConnected();
    } catch (err) {
      if (err.status === 401) setError('Token inválido. Verifica e intenta de nuevo.');
      else if (err.status === 404) setError('No se encontró una lavadora. Ingresa el Device ID manualmente.');
      else setError(err.message ?? 'Error desconocido.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pat-tab">
      <div className="pat-warning">
        ⚠️ Los Personal Access Tokens <strong>caducan en 24 horas</strong> (cambio de SmartThings, Dic 2024).
        Usa OAuth para una conexión permanente.
      </div>

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
  );
}

// ── Main SetupPanel ────────────────────────────────────────────
export default function SetupPanel({ onConnected, showToast }) {
  const [tab,            setTab]            = useState('oauth'); // 'oauth' | 'pat'
  const [oauthStatus,    setOauthStatus]    = useState(null);   // null = loading
  const [oauthError,     setOauthError]     = useState('');

  // Check URL for oauth=error/success and fetch oauth status on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthParam = params.get('oauth');
    if (oauthParam === 'error') {
      const reason = params.get('reason') ?? 'unknown';
      setOauthError(`Error de autorización: ${reason}`);
      setTab('oauth');
    }

    api.getOAuthStatus()
      .then(s => setOauthStatus(s))
      .catch(() => setOauthStatus({ configured: false, connected: false }));
  }, []);

  const handleReconnect = () => {
    window.location.href = api.oauthAuthorizeUrl();
  };

  const handleDisconnect = async () => {
    try {
      await api.disconnectOAuth();
      setOauthStatus(s => ({ ...s, connected: false }));
    } catch (e) {
      showToast('Error al desconectar', 'error');
    }
  };

  // OAuth was configured but session expired/revoked — show reconnect screen
  if (oauthStatus?.configured && !oauthStatus?.connected) {
    return (
      <div className="setup-wrap">
        <div className="setup-panel">
          <div className="setup-icon">🔒</div>
          <h2>Reconectar SmartThings</h2>
          <p>Tu sesión OAuth expiró o fue revocada. Reconecta para continuar.</p>

          {oauthError && <div className="inline-error">{oauthError}</div>}

          <button className="btn btn-primary w-full" onClick={handleReconnect}>
            🔐 Reconectar con SmartThings
          </button>

          <button
            className="btn btn-secondary w-full"
            style={{ marginTop: '0.5rem' }}
            onClick={() => setOauthStatus(s => ({ ...s, configured: false }))}
          >
            Cambiar credenciales
          </button>
        </div>
      </div>
    );
  }

  // Default: full setup form
  return (
    <div className="setup-wrap">
      <div className="setup-panel">
        <div className="setup-icon">🫧</div>
        <h2>SmartThings Washer</h2>

        {oauthError && <div className="inline-error" style={{ marginBottom: '1rem' }}>{oauthError}</div>}

        <div className="setup-tabs">
          <button
            className={`setup-tab ${tab === 'oauth' ? 'active' : ''}`}
            onClick={() => setTab('oauth')}
          >
            OAuth <span className="tab-badge">Permanente</span>
          </button>
          <button
            className={`setup-tab ${tab === 'pat' ? 'active' : ''}`}
            onClick={() => setTab('pat')}
          >
            Token Manual <span className="tab-badge tab-badge--warn">24 h</span>
          </button>
        </div>

        {tab === 'oauth'
          ? <OAuthTab showToast={showToast} />
          : <PATTab onConnected={onConnected} />
        }
      </div>
    </div>
  );
}

