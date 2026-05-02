# Copilot Instructions — washer-app

## Proyecto
Control remoto de lavadora Samsung WD11FG6B34BB vía SmartThings API.  
Stack: **React 18 + Vite** (frontend) / **Express + better-sqlite3** (backend) / **MCP Server** (Claude Desktop integration).

---

## Regla principal: cuando se agrega una feature nueva

Cada vez que se agregue una funcionalidad nueva que involucre datos (nueva tabla, nuevos campos, nuevas operaciones), se deben actualizar **tres capas** en orden:

### 1. `server/db.js` — Base de datos
- Agregar la tabla o campos con `ALTER TABLE` en el bloque de migraciones.
- Agregar las queries preparadas en el objeto `*Queries` correspondiente.
- Exportar las funciones helper (`listX`, `createX`, `updateX`, `deleteX`).

### 2. `server/mcp.js` — MCP Server (Claude Desktop)
- Importar las nuevas funciones de `db.js`.
- Agregar un `server.tool(...)` por cada operación nueva (create, update, delete, list, etc.).
- Cada tool debe tener: nombre en `snake_case`, descripción clara en inglés, schema Zod completo con `.describe()` en cada campo.
- **No dejar campos de la DB sin exponer** — si existe en la DB, debe estar en el tool.
- Verificar que `create_preset` y `update_preset` incluyan todos los campos del schema de `presets`.
- Verificar que `add_clothing_item` y `update_clothing_item` incluyan todos los campos de `clothing_items`.

### 3. `server/index.js` — REST API (frontend)
- Agregar los endpoints Express que correspondan (`GET /api/x`, `POST /api/x`, `PUT /api/x/:id`, `DELETE /api/x/:id`).
- Mantener consistencia de rutas con las que ya consume `src/api.js`.

---

## Despliegue a producción

```bash
# 1. Build del frontend
npm run build          # genera dist/

# 2. Iniciar servidor en producción
npm run preview        # node --env-file=.env server/index.js
# El servidor sirve el build de React en / y la API en /api/*
```

**Variables de entorno requeridas (`.env`):**
```
SMARTTHINGS_TOKEN=<token>
PORT=3001              # opcional, default 3001
```

**MCP en producción** — actualizar `~/.claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "washer-control": {
      "command": "node",
      "args": ["/ruta/absoluta/washer-app/server/mcp.js"],
      "env": { "SMARTTHINGS_TOKEN": "<token>" }
    }
  }
}
```
Después de actualizar el config, **reiniciar Claude Desktop** para que recargue los tools del MCP.

---

## Checklist al agregar features con Claude Desktop (MCP)

Cuando se agrega un feature nuevo, ejecutar este checklist para que Claude tenga acceso actualizado:

1. **`server/db.js`** — ¿Están las nuevas queries y funciones exportadas?
2. **`server/mcp.js`** — ¿Están los nuevos `server.tool(...)` con todos los campos?
3. **`server/index.js`** — ¿Están los nuevos endpoints REST?
4. **Reiniciar el MCP** en Claude Desktop (Settings → Developer → Reload MCP servers) o reiniciar la app.
5. Verificar en Claude Desktop que los nuevos tools aparecen listados con `/mcp` o preguntando "¿qué tools tienes?".

---

## Estructura del proyecto

```
server/
  db.js          — SQLite schema, queries, funciones exportadas
  index.js       — Express REST API
  mcp.js         — MCP server (tools para Claude Desktop)
  smartthings.js — Cliente SmartThings API
  seed.js        — Script de seed de presets
src/
  api.js         — Cliente fetch del frontend → /api/*
  App.jsx        — Root component
  components/    — UI components (PresetGrid, PresetCard, etc.)
data/
  washer.db      — SQLite database (generada automáticamente)
```

## Tablas en la DB

| Tabla | Propósito |
|-------|-----------|
| `presets` | Ciclos de lavado guardados. Campos: id, name, subtitle, cycle, temp, spin_rpm, eco, color, clothes, compat_colors, notes, dry_cycle, dry_temp, dry_notes, sort_order |
| `clothing_items` | Prendas del guardarropa. Campos: id, brand, name, item_type, colors, fabric, care_temp, care_cycle, preset_id, notes |
| `config` | Token SmartThings y deviceId |
| `preset_history` | Log de presets aplicados |

## Ciclos y valores SmartThings válidos

**Ciclos:** `delicates`, `colors`, `normal`, `cottons`, `quickWash`, `rinse`, `spin`, `bedding`, `duvet`, `wool`, `synthetics`, `shirts`, `dark`  
**Temperatura:** `cold` (30°C), `warm` (40°C), `hot` (60°C), `extraHot` (90°C)  
**Spin RPM → SpinLevel:** 600→`rinseHold`, 800→`medium`, 1000→`high`, 1200→`extraHigh`
