import PresetCard from './PresetCard.jsx';

export default function PresetGrid({ presets, applying, onApply, onEdit, onDelete, onNew }) {
  return (
    <section className="presets-section">
      <div className="presets-header">
        <h2 className="section-title">Presets de lavado</h2>
      </div>
      {presets.length === 0 ? (
        <div className="empty-state">
          <p>No hay presets guardados.</p>
          <button className="btn btn-primary" onClick={onNew}>Crear el primero</button>
        </div>
      ) : (
        <div className="presets-grid">
          {presets.map(p => (
            <PresetCard
              key={p.id}
              preset={p}
              isApplying={applying === p.id}
              onApply={onApply}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}
