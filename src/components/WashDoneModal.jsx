import { useState, useEffect } from 'react';
import { api } from '../api.js';

export default function WashDoneModal({ presetId, presetName, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!presetId) { setLoading(false); return; }
    api.listPresetClothing(presetId)
      .then(data => setItems(data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [presetId]);

  const careItems = items.filter(i => i.care_instructions?.trim());
  const otherItems = items.filter(i => !i.care_instructions?.trim());

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="wash-done-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="wash-done-header">
          <div className="wash-done-icon">✅</div>
          <div>
            <h2 className="wash-done-title">¡Lavado terminado!</h2>
            {presetName && (
              <p className="wash-done-preset">{presetName}</p>
            )}
          </div>
          <button className="btn btn-ghost btn-xs icon-btn wash-done-close" onClick={onClose}>✕</button>
        </div>

        {loading && (
          <div className="wash-done-loading"><span className="spinner-sm" /></div>
        )}

        {!loading && careItems.length > 0 && (
          <div className="wash-done-warnings">
            <p className="wash-done-warnings-title">⚠️ Instrucciones especiales de cuidado</p>
            <div className="wash-done-care-list">
              {careItems.map(item => (
                <div key={item.id} className="wash-done-care-item">
                  <div className="wash-done-care-item-name">
                    {item.brand ? `${item.brand} — ` : ''}{item.name}
                    {item.item_type && <span className="wash-done-care-tag">{item.item_type}</span>}
                  </div>
                  <ul className="wash-done-care-instructions">
                    {item.care_instructions.split('\n').filter(Boolean).map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && otherItems.length > 0 && (
          <div className="wash-done-other">
            <p className="wash-done-other-title">Ropa sin instrucciones especiales</p>
            <div className="wash-done-other-list">
              {otherItems.map(item => (
                <span key={item.id} className="wash-done-chip">
                  {item.brand ? `${item.brand} ` : ''}{item.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {!loading && items.length === 0 && (
          <p className="wash-done-empty">Saca la ropa y revísala antes de secar.</p>
        )}

        <div className="wash-done-footer">
          <button className="btn btn-primary" onClick={onClose}>Entendido</button>
        </div>
      </div>
    </div>
  );
}
