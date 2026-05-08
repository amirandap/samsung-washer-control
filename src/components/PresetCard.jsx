import { parseCompatColors, COLOR_SWATCHES } from '../constants.js';

const colorHex = Object.fromEntries(COLOR_SWATCHES.map(c => [c.value, c.hex]));
const MAX_BRANDS = 5;
const ICON_SZ = 23;

// ── Clothing type SVG icons ───────────────────────────────────────────────────
const ShirtIcon = () => (
  <svg width={ICON_SZ} height={ICON_SZ} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.5 7l-3-3a5.1 5.1 0 01-11 0L3.5 7l3 2V20h11V9l3-2z"/>
  </svg>
);
const JacketIcon = () => (
  <svg width={ICON_SZ} height={ICON_SZ} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 7l-3-3-2 2c-1 1-2 1.5-3 1.5S10 7 9 6L7 4 4 7l3 2V20h10V9l3-2z"/>
    <line x1="12" y1="9" x2="12" y2="20"/>
  </svg>
);
const PantsIcon = () => (
  <svg width={ICON_SZ} height={ICON_SZ} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3h12v8l-3.5 10H13l-1.5-7L10 21H7.5L4 11V3z"/>
  </svg>
);
const SocksIcon = () => (
  <svg width={ICON_SZ} height={ICON_SZ} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3v9H5v4a3 3 0 003 3h6a3 3 0 003-3v-4h-3V3H8z"/>
    <line x1="8" y1="7" x2="14" y2="7"/>
  </svg>
);
const TowelIcon = () => (
  <svg width={ICON_SZ} height={ICON_SZ} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="5" width="16" height="14" rx="2"/>
    <line x1="4" y1="10" x2="20" y2="10"/>
    <line x1="4" y1="15" x2="20" y2="15"/>
  </svg>
);
const BedIcon = () => (
  <svg width={ICON_SZ} height={ICON_SZ} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 7v13M22 7v13M2 17h20M4 12V8h7v4M13 12V8h7v4"/>
  </svg>
);
const HangerIcon = () => (
  <svg width={ICON_SZ} height={ICON_SZ} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 4a2 2 0 00-1 3.73L3 19h18L13 7.73A2 2 0 0012 4z"/>
  </svg>
);

function ClothingTypeIcon({ type }) {
  if (!type) return <HangerIcon />;
  const t = type.toLowerCase();
  if (/chaqueta|jacket|abrigo|saco|blazer|hoodie|polar|rompeviento/.test(t)) return <JacketIcon />;
  if (/camis|polo|shirt|blusa|camiseta|top/.test(t)) return <ShirtIcon />;
  if (/pantal|jean|short|bermuda|chino|legging/.test(t)) return <PantsIcon />;
  if (/media|sock|calcetin/.test(t)) return <SocksIcon />;
  if (/toalla|towel|paño/.test(t)) return <TowelIcon />;
  if (/saban|cama|bed|edred|almohada|colcha|duvet/.test(t)) return <BedIcon />;
  return <HangerIcon />;
}

// ── Card ─────────────────────────────────────────────────────────────────────
export default function PresetCard({ preset, isApplying, onApply }) {
  const clothing = preset.clothing_items ?? [];

  // Group by brand → { logo, types: Set }
  const brandMap = new Map();
  for (const item of clothing) {
    const key = item.brand || item.name || '?';
    if (!brandMap.has(key)) brandMap.set(key, { logo: null, types: new Set() });
    const entry = brandMap.get(key);
    if (!entry.logo && item.logo_url) entry.logo = item.logo_url;
    if (item.item_type?.trim()) entry.types.add(item.item_type.trim());
  }
  const allBrands = [...brandMap.entries()];
  const visible   = allBrands.slice(0, MAX_BRANDS);
  const overflow  = allBrands.length - MAX_BRANDS;

  const allColors = [...new Set(
    clothing.flatMap(i => parseCompatColors(i.colors))
  )].slice(0, 6);

  return (
    <div
      className={`preset-card ${isApplying ? 'preset-sending' : ''}`}
      style={{ '--preset-color': preset.color }}
    >
      <div className="preset-accent" />

      <div className="preset-header">
        <div className="preset-name">{preset.name}</div>
        {allColors.length > 0 && (
          <div className="item-color-dots">
            {allColors.map(c => (
              <span
                key={c}
                className="item-color-dot"
                style={{ background: colorHex[c] ?? c, border: c === 'blanco' ? '1px solid #ccc' : 'none' }}
                title={c}
              />
            ))}
          </div>
        )}
      </div>

      {allBrands.length > 0 ? (
        <div className="preset-clothes-list">
          {visible.map(([brand, { logo, types }]) => (
            <div key={brand} className="preset-brand-row">
              {logo
                ? <img className="brand-logo" src={logo} alt="" loading="lazy" />
                : <div className="brand-logo-placeholder">{brand[0]?.toUpperCase()}</div>
              }
              <span className="preset-clothes-brand">{brand}</span>
              {types.size > 0 && (
                <div className="brand-type-icons">
                  {[...types].slice(0, 3).map(t => <ClothingTypeIcon key={t} type={t} />)}
                </div>
              )}
            </div>
          ))}
          {overflow > 0 && <span className="preset-clothes-more">+{overflow} más</span>}
        </div>
      ) : (
        <div className="preset-clothes-empty">Sin prendas asignadas</div>
      )}

      <button
        className="btn btn-apply"
        disabled={isApplying}
        onClick={() => onApply(preset)}
        style={{ '--apply-color': preset.color }}
      >
        {isApplying ? <><span className="spinner" /> Enviando…</> : 'Lavar'}
      </button>
    </div>
  );
}

