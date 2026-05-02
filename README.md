# Washer App

A local web app and MCP server for controlling a **Samsung WD11FG6B34BB** washer-dryer via the [SmartThings REST API](https://developer.smartthings.com/). Manage wash presets, track your wardrobe, and even operate the machine from an AI assistant like Claude.

---

## Features

- **Preset management** — create, edit, and apply named wash presets (cycle, temperature, spin RPM, EcoBubble, dry cycle)
- **Wardrobe tracker** — catalogue garments by brand, item type, and color; each item is linked to the right preset
- **Live device status** — real-time machine state, remaining time, and remote-control availability
- **Apply modal** — enter load weight in lbs to get an auto-calculated detergent dose
- **Wash history** — log of every applied preset
- **MCP server** — control the washer and manage the wardrobe from any [Model Context Protocol](https://modelcontextprotocol.io/) client (Claude Desktop, etc.)

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite 5 |
| Backend | Express (Node 20+, ESM) |
| Database | SQLite via `better-sqlite3` |
| Device API | Samsung SmartThings REST API |
| AI integration | Model Context Protocol SDK |

---

## Prerequisites

- **Node.js 20+** (uses `--env-file` flag)
- A **SmartThings Personal Access Token** with `r:devices:*` and `x:devices:*` scopes  
  → Generate one at <https://account.smartthings.com/tokens>

---

## Setup

```bash
# 1. Clone and install
git clone https://github.com/YOUR_USER/washer-app.git
cd washer-app
npm install

# 2. Configure credentials
cp .env.example .env
# Edit .env and paste your SmartThings Personal Access Token

# 3. (Optional) Seed sample presets and wardrobe items
node --env-file=.env server/seed.js

# 4. Start development server
npm run dev
```

Open <http://localhost:5173>. On first run the app auto-discovers your washer via the SmartThings API.

---

## MCP Server

Expose washer control as MCP tools for AI assistants:

```bash
npm run mcp
```

### Claude Desktop config (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "washer": {
      "command": "node",
      "args": ["--env-file=.env", "/absolute/path/to/washer-app/server/mcp.js"]
    }
  }
}
```

### Available MCP tools

| Tool | Description |
|------|-------------|
| `get_status` | Current washer state and remaining time |
| `list_presets` | All saved presets |
| `get_preset` | Single preset details |
| `create_preset` / `update_preset` / `delete_preset` | Preset CRUD |
| `apply_preset` | Send a preset to the washer |
| `get_history` | Recent wash history |
| `list_clothing` | Full wardrobe inventory |
| `add_clothing_item` | Add a garment (brand, type, colors, fabric, care instructions) |
| `update_clothing_item` | Update garment details |
| `assign_clothing_to_preset` | Link a garment to a preset |
| `suggest_preset_for_clothing` | Get recommended preset for a garment |
| `list_known_cycles` | Available wash cycles and temperatures |

---

## Project Structure

```
server/
  index.js        Express API server (port 3001)
  mcp.js          MCP stdio server
  db.js           SQLite schema, queries, and migrations
  smartthings.js  SmartThings API client
  seed.js         Sample presets and wardrobe items
src/
  main.jsx        React entry point
  App.jsx         Root component
  api.js          Frontend API client
  constants.js    Cycle/temp labels, color swatches, item types
  components/
    PresetCard.jsx
    PresetEditor.jsx
    PresetGrid.jsx
    ApplyModal.jsx
    StatusCard.jsx
    SetupPanel.jsx
    Toast.jsx
data/             Runtime SQLite database (git-ignored)
```

---

## Security

- Your SmartThings token lives **only** in `.env` (git-ignored) and the local SQLite database (`data/` — also git-ignored).
- The device ID is discovered at runtime and stored in the local DB; it is never hardcoded.
- Never commit `.env`. Use `.env.example` as a safe template.

---

## License

MIT


## Device Reference

Samsung WD11FG6B34BB — 11 kg front-load washer-dryer, 1400 rpm, EcoBubble™, AI Control, SmartThings integration. See [washer-model.md](washer-model.md) for full specs.

## License

MIT
