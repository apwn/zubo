// Unified dashboard + agent chat HTML — no build step
export const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Zubo</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --bg: #09090b;
    --bg-raised: #111113;
    --bg-surface: #18181b;
    --bg-hover: #1e1e22;
    --border: #27272a;
    --border-subtle: #1e1e22;
    --text: #fafafa;
    --text-secondary: #a1a1aa;
    --text-muted: #71717a;
    --text-faint: #52525b;
    --accent: #3b82f6;
    --accent-hover: #2563eb;
    --accent-bg: rgba(59,130,246,0.08);
    --accent-border: rgba(59,130,246,0.2);
    --green: #22c55e;
    --green-bg: rgba(34,197,94,0.1);
    --yellow: #eab308;
    --yellow-bg: rgba(234,179,8,0.1);
    --red: #ef4444;
    --purple: #8b5cf6;
    --purple-bg: rgba(139,92,246,0.08);
    --radius: 10px;
    --radius-lg: 14px;
    --font: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
    --mono: 'SF Mono', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
    --shadow: 0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3);
    --shadow-lg: 0 4px 12px rgba(0,0,0,0.5);
    --transition: 150ms cubic-bezier(0.4,0,0.2,1);
  }

  body { font-family: var(--font); background: var(--bg); color: var(--text); height: 100vh; display: flex; overflow: hidden; -webkit-font-smoothing: antialiased; }

  /* Sidebar */
  #sidebar {
    width: 220px; background: var(--bg-raised); border-right: 1px solid var(--border);
    display: flex; flex-direction: column; flex-shrink: 0;
  }
  .sidebar-logo {
    padding: 20px 20px 16px; display: flex; align-items: center; gap: 10px;
    border-bottom: 1px solid var(--border);
  }
  .sidebar-logo .logo-icon {
    width: 28px; height: 28px; background: var(--accent); border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 13px; color: #fff; letter-spacing: -0.5px;
  }
  .sidebar-logo span { font-weight: 700; font-size: 15px; color: var(--text); letter-spacing: -0.3px; }

  .sidebar-section {
    padding: 12px 10px 6px;
    font-size: 10px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.8px; color: var(--text-faint);
  }

  #sidebar nav { display: flex; flex-direction: column; gap: 2px; padding: 4px 8px; flex: 1; overflow-y: auto; }

  #sidebar nav a {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 12px; color: var(--text-secondary); text-decoration: none;
    font-size: 13px; font-weight: 500; border-radius: 8px;
    transition: all var(--transition); cursor: pointer; position: relative;
  }
  #sidebar nav a .nav-icon {
    width: 18px; height: 18px; display: flex; align-items: center; justify-content: center;
    font-size: 14px; opacity: 0.7; flex-shrink: 0;
  }
  #sidebar nav a .channel-dot {
    width: 6px; height: 6px; border-radius: 50%; margin-left: auto; flex-shrink: 0;
  }
  #sidebar nav a .channel-dot.connected { background: var(--green); box-shadow: 0 0 4px rgba(34,197,94,0.5); }
  #sidebar nav a .channel-dot.disconnected { background: var(--text-faint); }
  #sidebar nav a:hover { color: var(--text); background: var(--bg-hover); }
  #sidebar nav a.active {
    color: var(--accent); background: var(--accent-bg);
    font-weight: 600;
  }
  #sidebar nav a.active .nav-icon { opacity: 1; }

  .sidebar-divider { height: 1px; background: var(--border); margin: 8px 16px; }

  .sidebar-footer {
    padding: 12px 16px; border-top: 1px solid var(--border);
    font-size: 11px; color: var(--text-faint); display: flex; align-items: center; gap: 6px;
  }
  .sidebar-footer .conn-badge {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 10px; padding: 2px 8px; border-radius: 10px;
    background: var(--green-bg); color: var(--green);
  }

  /* Main area */
  #main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }

  #topbar {
    padding: 14px 24px; background: var(--bg-raised); border-bottom: 1px solid var(--border);
    display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;
  }
  #topbar-title { font-size: 15px; font-weight: 600; color: var(--text); letter-spacing: -0.2px; }
  #topbar-badge {
    font-size: 11px; color: var(--text-faint); background: var(--bg-surface);
    padding: 3px 10px; border-radius: 20px; border: 1px solid var(--border);
  }

  #content { flex: 1; overflow-y: auto; overflow-x: hidden; }

  /* Panels */
  .panel { display: none; }
  .panel.active { display: flex; flex-direction: column; height: 100%; }

  .panel-body { padding: 24px; flex: 1; overflow-y: auto; }

  /* ===== AGENT CHAT ===== */
  #panel-agent { display: none; }
  #panel-agent.active { display: flex; flex-direction: column; height: 100%; }

  #chat-messages {
    flex: 1; overflow-y: auto; padding: 20px 24px;
    display: flex; flex-direction: column; gap: 16px;
  }
  .chat-msg {
    max-width: 72%; padding: 12px 16px; border-radius: var(--radius-lg);
    font-size: 14px; line-height: 1.6; white-space: pre-wrap; word-wrap: break-word;
    animation: msgIn 200ms ease-out;
  }
  @keyframes msgIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

  .chat-msg.user {
    align-self: flex-end; background: var(--accent); color: white;
    border-bottom-right-radius: 4px;
  }
  .chat-msg.bot {
    align-self: flex-start; background: var(--bg-surface); border: 1px solid var(--border);
    border-bottom-left-radius: 4px; color: var(--text);
  }
  .chat-msg.bot.thinking { color: var(--text-muted); }
  .chat-msg.bot code {
    background: rgba(255,255,255,0.06); padding: 2px 5px; border-radius: 4px;
    font-family: var(--mono); font-size: 13px;
  }
  .chat-msg.bot pre { margin: 8px 0; }
  .chat-msg.bot pre code {
    display: block; background: var(--bg); padding: 12px; border-radius: 6px;
    overflow-x: auto; white-space: pre-wrap;
  }
  .chat-msg.bot strong { font-weight: 700; }
  .chat-msg.bot em { font-style: italic; }
  .chat-msg.bot.thinking::after {
    content: ''; display: inline-block; width: 4px; height: 14px;
    background: var(--text-muted); margin-left: 4px; vertical-align: middle;
    animation: blink 1s steps(1) infinite;
  }
  @keyframes blink { 50% { opacity: 0; } }

  .chat-empty {
    flex: 1; display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 12px; color: var(--text-faint);
  }
  .chat-empty-icon { font-size: 36px; opacity: 0.3; }
  .chat-empty-text { font-size: 14px; }

  #chat-input-bar {
    padding: 16px 24px 20px; background: var(--bg-raised); border-top: 1px solid var(--border);
    display: flex; gap: 10px; flex-shrink: 0; align-items: center;
  }
  .chat-attach-btn, .chat-mic-btn {
    width: 40px; height: 40px; border: 1px solid var(--border); background: var(--bg-surface);
    border-radius: var(--radius); color: var(--text-muted); font-size: 16px;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: all var(--transition); flex-shrink: 0;
  }
  .chat-attach-btn:hover, .chat-mic-btn:hover { color: var(--text); border-color: var(--accent); background: var(--accent-bg); }
  .chat-mic-btn.recording { color: var(--red); border-color: var(--red); background: rgba(239,68,68,0.1); animation: pulse 1.5s infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }

  #chat-input {
    flex: 1; padding: 12px 16px; background: var(--bg-surface); border: 1px solid var(--border);
    border-radius: var(--radius); color: var(--text); font-size: 14px; outline: none;
    font-family: var(--font); transition: border-color var(--transition);
  }
  #chat-input:focus { border-color: var(--accent); }
  #chat-input::placeholder { color: var(--text-faint); }
  #chat-send {
    padding: 12px 22px; background: var(--accent); color: white; border: none;
    border-radius: var(--radius); font-size: 14px; font-weight: 600; cursor: pointer;
    transition: background var(--transition); flex-shrink: 0;
  }
  #chat-send:hover { background: var(--accent-hover); }
  #chat-send:disabled { opacity: 0.4; cursor: default; }

  .file-pill {
    display: flex; align-items: center; gap: 6px; padding: 4px 10px;
    background: var(--accent-bg); border: 1px solid var(--accent-border);
    border-radius: 16px; font-size: 11px; color: var(--accent); font-weight: 500;
  }
  .file-pill .remove { cursor: pointer; opacity: 0.7; }
  .file-pill .remove:hover { opacity: 1; }

  .drop-overlay {
    display: none; position: absolute; inset: 0; background: rgba(59,130,246,0.08);
    border: 2px dashed var(--accent); border-radius: var(--radius-lg);
    z-index: 10; align-items: center; justify-content: center;
    font-size: 15px; color: var(--accent); font-weight: 600;
  }
  .drop-overlay.visible { display: flex; }

  /* ===== CARDS ===== */
  .cards {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 14px;
  }
  .card {
    background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
    padding: 18px 20px; transition: border-color var(--transition);
  }
  .card:hover { border-color: #3f3f46; }
  .card .label {
    font-size: 11px; color: var(--text-faint); text-transform: uppercase;
    letter-spacing: 0.6px; font-weight: 600; margin-bottom: 8px;
  }
  .card .value { font-size: 22px; font-weight: 700; color: var(--text); letter-spacing: -0.5px; }
  .card .value.ok { color: var(--green); }
  .card .value.warn { color: var(--yellow); }

  /* Quick action cards */
  .quick-actions {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px; margin-top: 24px;
  }
  .quick-action {
    background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
    padding: 18px; cursor: pointer; transition: all var(--transition); text-align: center;
  }
  .quick-action:hover { border-color: var(--accent); background: var(--accent-bg); transform: translateY(-1px); }
  .quick-action .qa-icon { font-size: 24px; margin-bottom: 8px; }
  .quick-action .qa-label { font-size: 13px; font-weight: 600; color: var(--text); }
  .quick-action .qa-desc { font-size: 11px; color: var(--text-muted); margin-top: 4px; }

  /* ===== EDITOR ===== */
  .editor-wrap { display: flex; flex-direction: column; height: 100%; }
  .editor-toolbar {
    padding: 0 0 16px; display: flex; gap: 10px; align-items: center; flex-shrink: 0;
  }
  textarea.editor {
    flex: 1; width: 100%; background: var(--bg-surface); border: 1px solid var(--border);
    border-radius: var(--radius); color: var(--text); font-family: var(--mono);
    font-size: 13px; padding: 16px; resize: none; outline: none; line-height: 1.7;
    transition: border-color var(--transition);
  }
  textarea.editor:focus { border-color: var(--accent); }

  /* ===== BUTTONS ===== */
  .btn {
    padding: 8px 16px; border: none; border-radius: 8px; font-size: 12px;
    cursor: pointer; font-weight: 600; transition: all var(--transition);
    font-family: var(--font);
  }
  .btn-primary { background: var(--accent); color: white; }
  .btn-primary:hover { background: var(--accent-hover); }
  .btn-ghost { background: transparent; color: var(--text-secondary); border: 1px solid var(--border); }
  .btn-ghost:hover { color: var(--text); border-color: #555; background: var(--bg-hover); }
  .btn-sm { padding: 5px 10px; font-size: 11px; }
  .btn-purple { background: var(--purple); color: white; }
  .btn-purple:hover { background: #7c3aed; }

  /* ===== STATUS LABEL ===== */
  .status-text { font-size: 12px; color: var(--text-faint); font-weight: 500; }

  /* ===== MEMORY ===== */
  .memory-section-title {
    font-size: 13px; font-weight: 600; color: var(--text-secondary);
    margin: 24px 0 14px; display: flex; align-items: center; gap: 8px;
  }
  .memory-section-title .badge {
    font-size: 10px; background: var(--bg-hover); color: var(--text-faint);
    padding: 2px 8px; border-radius: 10px; font-weight: 600;
  }

  .memory-list { display: flex; flex-direction: column; gap: 10px; }
  .memory-item {
    background: var(--bg-surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 14px 16px;
    transition: border-color var(--transition);
  }
  .memory-item:hover { border-color: #3f3f46; }
  .memory-item .source {
    font-size: 11px; color: var(--accent); font-weight: 600;
    margin-bottom: 6px; font-family: var(--mono);
  }
  .memory-item .content { font-size: 13px; line-height: 1.6; color: var(--text-secondary); white-space: pre-wrap; }

  /* ===== SEARCH ===== */
  .search-bar { display: flex; gap: 10px; margin-bottom: 16px; }
  .search-bar input {
    flex: 1; padding: 10px 14px; background: var(--bg-surface); border: 1px solid var(--border);
    border-radius: 8px; color: var(--text); font-size: 13px; outline: none;
    font-family: var(--font); transition: border-color var(--transition);
  }
  .search-bar input:focus { border-color: var(--accent); }
  .search-bar input::placeholder { color: var(--text-faint); }

  /* ===== LOGS ===== */
  .log-view {
    background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 16px; font-family: var(--mono); font-size: 12px; line-height: 1.7;
    white-space: pre-wrap; flex: 1; overflow-y: auto; color: var(--text-muted);
  }

  /* ===== TABLE ===== */
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th {
    text-align: left; padding: 10px 16px; color: var(--text-faint); font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;
    border-bottom: 1px solid var(--border); background: var(--bg-surface);
    position: sticky; top: 0;
  }
  td { padding: 12px 16px; border-bottom: 1px solid var(--border-subtle); color: var(--text-secondary); }
  tr:hover td { background: var(--bg-hover); }

  .status-dot {
    display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px;
  }
  .status-dot.ok { background: var(--green); box-shadow: 0 0 6px rgba(34,197,94,0.4); }
  .status-dot.error { background: var(--red); box-shadow: 0 0 6px rgba(239,68,68,0.4); }

  /* ===== EMPTY STATE ===== */
  .empty-state {
    color: var(--text-faint); padding: 40px 20px; text-align: center;
    font-size: 13px;
  }

  /* ===== TOAST ===== */
  .toast {
    position: fixed; bottom: 24px; right: 24px; background: var(--green);
    color: #000; padding: 12px 20px; border-radius: var(--radius); font-size: 13px;
    font-weight: 600; opacity: 0; transition: opacity 200ms, transform 200ms;
    pointer-events: none; transform: translateY(8px); box-shadow: var(--shadow-lg); z-index: 100;
  }
  .toast.show { opacity: 1; transform: translateY(0); }

  /* ===== TOOLTIP ===== */
  [data-tooltip] { position: relative; }
  [data-tooltip]:hover::after {
    content: attr(data-tooltip);
    position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%);
    background: var(--bg-surface); color: var(--text-secondary); border: 1px solid var(--border);
    padding: 4px 10px; border-radius: 6px; font-size: 11px; white-space: nowrap;
    z-index: 50; pointer-events: none; box-shadow: var(--shadow);
    animation: ttIn 100ms ease-out;
  }
  @keyframes ttIn { from { opacity: 0; transform: translateX(-50%) translateY(2px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

  /* ===== SETTINGS ENHANCED ===== */
  .settings-section { max-width: 600px; margin-bottom: 32px; }
  .settings-title { font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
  .settings-title .conn-dot { width: 8px; height: 8px; border-radius: 50%; }
  .settings-title .conn-dot.on { background: var(--green); box-shadow: 0 0 6px rgba(34,197,94,0.4); }
  .settings-title .conn-dot.off { background: var(--text-faint); }
  .settings-desc { font-size: 13px; color: var(--text-muted); line-height: 1.5; margin-bottom: 20px; }
  .settings-desc code {
    background: var(--bg-surface); padding: 2px 6px; border-radius: 4px;
    font-family: var(--mono); font-size: 12px; color: var(--text-secondary);
  }
  .settings-grid { display: flex; flex-direction: column; gap: 16px; }
  .settings-field { display: flex; flex-direction: column; gap: 6px; }
  .settings-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
  .settings-select, .settings-input {
    padding: 10px 14px; background: var(--bg-surface); border: 1px solid var(--border);
    border-radius: 8px; color: var(--text); font-size: 13px; outline: none;
    font-family: var(--font); transition: border-color var(--transition);
    width: 100%;
  }
  .settings-select:focus, .settings-input:focus { border-color: var(--accent); }
  .settings-select { cursor: pointer; appearance: auto; }
  .settings-input::placeholder { color: var(--text-faint); }

  /* Analytics CSS bar chart */
  .bar-chart { display: flex; align-items: flex-end; gap: 8px; height: 120px; padding: 0 8px; }
  .bar-col { display: flex; flex-direction: column; align-items: center; flex: 1; gap: 4px; }
  .bar-col .bar { background: var(--accent); border-radius: 4px 4px 0 0; width: 100%; min-height: 2px; transition: height 300ms; }
  .bar-col .bar-label { font-size: 10px; color: var(--text-faint); }

  /* Workflow DAG */
  .dag-container { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; min-height: 200px; }
  .dag-container svg text { fill: var(--text-secondary); font-size: 11px; font-family: var(--font); }
  .dag-container svg .dag-node { fill: var(--accent-bg); stroke: var(--accent); stroke-width: 1.5; rx: 8; }
  .dag-container svg .dag-edge { stroke: var(--border); stroke-width: 1.5; fill: none; marker-end: url(#arrowhead); }

  /* Registry items */
  .registry-item {
    background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 14px 16px; display: flex; justify-content: space-between; align-items: center;
    transition: border-color var(--transition);
  }
  .registry-item:hover { border-color: #3f3f46; }
  .registry-item .ri-name { font-weight: 600; font-size: 13px; color: var(--text); }
  .registry-item .ri-desc { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

  /* ===== ONBOARDING MODAL ===== */
  .modal-overlay {
    display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    z-index: 200; align-items: center; justify-content: center;
    backdrop-filter: blur(4px);
  }
  .modal-overlay.visible { display: flex; }
  .modal {
    background: var(--bg-raised); border: 1px solid var(--border); border-radius: 16px;
    padding: 40px; max-width: 480px; width: 90%; box-shadow: var(--shadow-lg);
    animation: modalIn 250ms ease-out;
  }
  @keyframes modalIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
  .modal h2 { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 8px; }
  .modal p { font-size: 14px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 20px; }
  .modal .steps { display: flex; gap: 6px; margin-bottom: 24px; }
  .modal .steps .step-dot {
    width: 8px; height: 8px; border-radius: 50%; background: var(--border);
    transition: background 200ms;
  }
  .modal .steps .step-dot.active { background: var(--accent); }
  .modal .steps .step-dot.done { background: var(--green); }
  .modal-actions { display: flex; gap: 10px; justify-content: flex-end; }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #555; }
</style>
</head>
<body>

<div id="sidebar">
  <div class="sidebar-logo">
    <div class="logo-icon">Z</div>
    <span>Zubo</span>
  </div>
  <nav>
    <div class="sidebar-section">Agent</div>
    <a href="#agent" class="active" onclick="showPanel('agent')">
      <span class="nav-icon">\u{1F4AC}</span> Chat
    </a>
    <div class="sidebar-divider"></div>
    <div class="sidebar-section">Dashboard</div>
    <a href="#status" onclick="showPanel('status')">
      <span class="nav-icon">\u{1F4CA}</span> Status
    </a>
    <a href="#analytics" onclick="showPanel('analytics')">
      <span class="nav-icon">\u{1F4C8}</span> Analytics
    </a>
    <a href="#system" onclick="showPanel('system')">
      <span class="nav-icon">\u{2699}\u{FE0F}</span> System Prompt
    </a>
    <a href="#memory" onclick="showPanel('memory')">
      <span class="nav-icon">\u{1F9E0}</span> Memory
    </a>
    <a href="#skills" onclick="showPanel('skills')">
      <span class="nav-icon">\u{26A1}</span> Skills
    </a>
    <a href="#registry" onclick="showPanel('registry')">
      <span class="nav-icon">\u{1F50D}</span> Registry
    </a>
    <a href="#workflows" onclick="showPanel('workflows')">
      <span class="nav-icon">\u{1F500}</span> Workflows
    </a>
    <a href="#cron" onclick="showPanel('cron')">
      <span class="nav-icon">\u{1F504}</span> Cron Jobs
    </a>
    <a href="#logs" onclick="showPanel('logs')">
      <span class="nav-icon">\u{1F4DD}</span> Logs
    </a>
    <div class="sidebar-divider"></div>
    <a href="#settings" onclick="showPanel('settings')">
      <span class="nav-icon">\u{2699}\u{FE0F}</span> Settings
    </a>
  </nav>
  <div class="sidebar-footer">
    <span>Zubo</span>
    <span class="conn-badge" id="sidebar-conn-badge"></span>
  </div>
</div>

<div id="main">
  <div id="topbar">
    <span id="topbar-title">Agent</span>
    <span id="topbar-badge">Zubo</span>
  </div>
  <div id="content">

    <!-- AGENT CHAT PANEL -->
    <div id="panel-agent" class="panel active" style="position:relative;">
      <div class="drop-overlay" id="drop-overlay">Drop file to upload</div>
      <div id="chat-messages">
        <div class="chat-empty">
          <div class="chat-empty-icon">\u{1F4AC}</div>
          <div class="chat-empty-text">Send a message to start chatting with Zubo</div>
        </div>
      </div>
      <div id="file-pill-bar" style="display:none; padding: 4px 24px 0;">
        <div class="file-pill" id="file-pill"><span id="file-pill-name"></span><span class="remove" onclick="clearAttachedFile()">\u{2715}</span></div>
      </div>
      <div id="chat-input-bar">
        <button class="chat-attach-btn" data-tooltip="Attach file" onclick="triggerFileUpload()">\u{1F4CE}</button>
        <button class="chat-mic-btn" id="mic-btn" data-tooltip="Voice input" onclick="toggleMic()">\u{1F3A4}</button>
        <input id="chat-input" type="text" placeholder="Message Zubo..." autocomplete="off">
        <button id="chat-send">Send</button>
      </div>
      <input type="file" id="file-input" style="display:none" accept=".pdf,.docx,.txt,.md,.csv,.json,.html">
    </div>

    <!-- STATUS PANEL -->
    <div id="panel-status" class="panel">
      <div class="panel-body">
        <div class="cards" id="status-cards"></div>
        <div class="quick-actions" id="quick-actions">
          <div class="quick-action" onclick="showPanel('agent')">
            <div class="qa-icon">\u{1F4AC}</div>
            <div class="qa-label">Chat</div>
            <div class="qa-desc">Start a conversation</div>
          </div>
          <div class="quick-action" onclick="showPanel('skills')">
            <div class="qa-icon">\u{26A1}</div>
            <div class="qa-label">Skills</div>
            <div class="qa-desc">View installed skills</div>
          </div>
          <div class="quick-action" onclick="showPanel('registry')">
            <div class="qa-icon">\u{1F50D}</div>
            <div class="qa-label">Registry</div>
            <div class="qa-desc">Browse skill registry</div>
          </div>
          <div class="quick-action" onclick="showPanel('cron')">
            <div class="qa-icon">\u{1F504}</div>
            <div class="qa-label">Cron Jobs</div>
            <div class="qa-desc">Schedule tasks</div>
          </div>
          <div class="quick-action" onclick="triggerFileUpload()">
            <div class="qa-icon">\u{1F4C4}</div>
            <div class="qa-label">Upload File</div>
            <div class="qa-desc">Add a document</div>
          </div>
          <div class="quick-action" onclick="showPanel('workflows')">
            <div class="qa-icon">\u{1F500}</div>
            <div class="qa-label">Workflows</div>
            <div class="qa-desc">Multi-agent pipelines</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ANALYTICS PANEL -->
    <div id="panel-analytics" class="panel">
      <div class="panel-body">
        <div class="cards" id="analytics-summary"></div>
        <div class="memory-section-title" style="margin-top:28px;">Token Usage (Last 7 Days)</div>
        <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;">
          <div class="bar-chart" id="usage-chart"></div>
        </div>
        <div class="memory-section-title" style="margin-top:28px;">
          <span>Tool Usage</span>
          <span class="badge" id="tool-count"></span>
        </div>
        <table id="tools-table">
          <thead><tr><th>Tool</th><th>Calls</th><th>Avg Time</th><th>Errors</th></tr></thead>
          <tbody id="tools-body"></tbody>
        </table>
        <div class="memory-section-title" style="margin-top:28px;">Sessions</div>
        <table id="sessions-table">
          <thead><tr><th>Session</th><th>Provider</th><th>Tokens</th><th>Cost</th><th>Last Used</th></tr></thead>
          <tbody id="sessions-body"></tbody>
        </table>
      </div>
    </div>

    <!-- SYSTEM PROMPT PANEL -->
    <div id="panel-system" class="panel">
      <div class="panel-body">
        <div class="editor-wrap">
          <div class="editor-toolbar">
            <button class="btn btn-primary" onclick="saveSystem()">Save</button>
            <button class="btn btn-ghost" onclick="loadSystem()">Reload</button>
            <span id="system-status" class="status-text"></span>
          </div>
          <textarea class="editor" id="system-editor" spellcheck="false"></textarea>
        </div>
      </div>
    </div>

    <!-- MEMORY PANEL -->
    <div id="panel-memory" class="panel">
      <div class="panel-body">
        <div class="editor-wrap">
          <div class="editor-toolbar">
            <button class="btn btn-primary" onclick="saveMemory()">Save MEMORY.md</button>
            <button class="btn btn-ghost" onclick="loadMemory()">Reload</button>
            <span id="memory-status" class="status-text"></span>
          </div>
          <textarea class="editor" id="memory-editor" spellcheck="false" style="height: 35vh; flex: none;"></textarea>
        </div>
        <div class="memory-section-title">
          <span>Memory Chunks</span>
          <span class="badge" id="memory-count"></span>
        </div>
        <div class="search-bar">
          <input id="memory-search" type="text" placeholder="Search memories...">
          <button class="btn btn-primary" onclick="searchMemories()">Search</button>
        </div>
        <div class="memory-list" id="memory-results"></div>
      </div>
    </div>

    <!-- SKILLS PANEL -->
    <div id="panel-skills" class="panel">
      <div class="panel-body">
        <table>
          <thead><tr><th>Name</th><th>Description</th><th>Status</th></tr></thead>
          <tbody id="skills-body"></tbody>
        </table>
        <p id="skills-empty" class="empty-state" style="display:none;">No skills installed. <a href="#registry" onclick="showPanel('registry')" style="color:var(--accent);">Browse the registry</a></p>
      </div>
    </div>

    <!-- REGISTRY PANEL -->
    <div id="panel-registry" class="panel">
      <div class="panel-body">
        <div class="search-bar">
          <input id="registry-search" type="text" placeholder="Search skills (e.g. email, calendar, weather...)">
          <button class="btn btn-primary" onclick="searchRegistry()">Search</button>
        </div>
        <div id="registry-results" style="display:flex;flex-direction:column;gap:10px;">
          <p class="empty-state">Search the skill registry to find and install new skills.</p>
        </div>
      </div>
    </div>

    <!-- WORKFLOWS PANEL -->
    <div id="panel-workflows" class="panel">
      <div class="panel-body">
        <div class="editor-toolbar">
          <button class="btn btn-ghost" onclick="loadWorkflows()">Refresh</button>
          <span id="workflows-status" class="status-text"></span>
        </div>
        <div id="workflows-list" style="display:flex;flex-direction:column;gap:14px;"></div>
        <p id="workflows-empty" class="empty-state" style="display:none;">No workflows defined. Ask Zubo to create a workflow in chat.</p>
      </div>
    </div>

    <!-- CRON PANEL -->
    <div id="panel-cron" class="panel">
      <div class="panel-body">
        <table>
          <thead><tr><th>Name</th><th>Schedule</th><th>Task</th><th>Enabled</th><th>Last Run</th></tr></thead>
          <tbody id="cron-body"></tbody>
        </table>
        <p id="cron-empty" class="empty-state" style="display:none;">No cron jobs configured.</p>
      </div>
    </div>

    <!-- LOGS PANEL -->
    <div id="panel-logs" class="panel">
      <div class="panel-body" style="display:flex; flex-direction:column; height:100%;">
        <div class="editor-toolbar">
          <button class="btn btn-ghost" onclick="loadLogs()">Refresh</button>
          <span id="logs-status" class="status-text"></span>
        </div>
        <div class="log-view" id="log-content"></div>
      </div>
    </div>

    <!-- SETTINGS PANEL -->
    <div id="panel-settings" class="panel">
      <div class="panel-body">
        <div class="settings-section">
          <h3 class="settings-title" data-tooltip="Select which AI model powers Zubo">LLM Provider</h3>
          <p class="settings-desc">Select which provider and model Zubo uses.</p>
          <div class="settings-grid">
            <div class="settings-field">
              <label class="settings-label" data-tooltip="Cloud AI service" for="settings-provider">Provider</label>
              <select id="settings-provider" class="settings-select" onchange="onProviderChange()"></select>
            </div>
            <div class="settings-field">
              <label class="settings-label" for="settings-model">Model</label>
              <input id="settings-model" type="text" class="settings-input" placeholder="e.g. claude-sonnet-4-5-20250929">
            </div>
          </div>
          <div style="margin-top: 16px; display: flex; gap: 10px; align-items: center;">
            <button class="btn btn-primary" onclick="saveModelConfig()">Save</button>
            <button class="btn btn-ghost" onclick="testLlm()">Test Connection</button>
            <span id="settings-status" class="status-text"></span>
          </div>
        </div>

        <div class="settings-section">
          <h3 class="settings-title" data-tooltip="Connected messaging channels">Channels
            <span id="channel-count-badge" class="conn-badge" style="font-size:10px;"></span>
          </h3>
          <p class="settings-desc">Status of connected messaging channels.</p>
          <div id="channel-status-list" style="display:flex;flex-direction:column;gap:8px;"></div>
        </div>

        <div class="settings-section">
          <h3 class="settings-title" data-tooltip="Background task frequency">Heartbeat Interval</h3>
          <p class="settings-desc">How often the background heartbeat runs. Default: 30 minutes.</p>
          <div class="settings-grid">
            <div class="settings-field">
              <label class="settings-label" data-tooltip="Minutes between heartbeats" for="settings-heartbeat">Interval (minutes)</label>
              <input id="settings-heartbeat" type="number" class="settings-input" min="1" max="1440" step="1" placeholder="30">
            </div>
          </div>
          <div style="margin-top: 16px; display: flex; gap: 10px; align-items: center;">
            <button class="btn btn-primary" onclick="saveHeartbeat()">Save</button>
            <span id="heartbeat-status" class="status-text"></span>
          </div>
        </div>

        <div class="settings-section">
          <h3 class="settings-title">Data</h3>
          <p class="settings-desc">Export, backup, or import your Zubo database.</p>
          <div id="db-stats" style="font-size:12px;color:var(--text-muted);margin-bottom:16px;"></div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="exportJson()">Export JSON</button>
            <button class="btn btn-ghost" onclick="backupDb()">Backup SQLite</button>
            <button class="btn btn-ghost" onclick="document.getElementById('import-file').click()">Import JSON</button>
            <input type="file" id="import-file" style="display:none" accept=".json" onchange="importJson(event)">
          </div>
          <span id="data-status" class="status-text" style="display:block;margin-top:10px;"></span>
        </div>

        <div class="settings-section">
          <h3 class="settings-title">Configuration</h3>
          <p class="settings-desc">Manage your full config by editing <code>~/.zubo/config.json</code> directly, or re-run <code>zubo setup</code>.</p>
        </div>
      </div>
    </div>

  </div>
</div>

<!-- Onboarding Modal -->
<div class="modal-overlay" id="onboarding-modal">
  <div class="modal">
    <div class="steps" id="onboarding-steps">
      <div class="step-dot active"></div>
      <div class="step-dot"></div>
      <div class="step-dot"></div>
      <div class="step-dot"></div>
    </div>
    <div id="onboarding-content">
      <h2>Welcome to Zubo</h2>
      <p>Your personal AI agent that remembers you, runs tasks, and connects to your favorite services. Let's get you set up.</p>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="skipOnboarding()">Skip</button>
      <button class="btn btn-primary" id="onboarding-next" onclick="nextOnboardingStep()">Get Started</button>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
// --- Panel routing ---
var panelNames = ['agent','status','analytics','system','memory','skills','registry','workflows','cron','logs','settings'];
var panelTitles = { agent:'Agent', status:'Status', analytics:'Analytics', system:'System Prompt', memory:'Memory', skills:'Skills', registry:'Skill Registry', workflows:'Workflows', cron:'Cron Jobs', logs:'Logs', settings:'Settings' };

function showPanel(name) {
  if (panelNames.indexOf(name) === -1) name = 'agent';
  document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('#sidebar nav a').forEach(function(a) { a.classList.remove('active'); });
  var panel = document.getElementById('panel-' + name);
  if (panel) panel.classList.add('active');
  var link = document.querySelector('#sidebar nav a[href="#' + name + '"]');
  if (link) link.classList.add('active');
  document.getElementById('topbar-title').textContent = panelTitles[name] || name;
  window.location.hash = name;

  if (name === 'agent') { document.getElementById('chat-input').focus(); }
  if (name === 'status') loadStatus();
  if (name === 'analytics') loadAnalytics();
  if (name === 'system') loadSystem();
  if (name === 'memory') loadMemory();
  if (name === 'skills') loadSkills();
  if (name === 'cron') loadCron();
  if (name === 'logs') loadLogs();
  if (name === 'settings') loadSettings();
  if (name === 'workflows') loadWorkflows();
}

function routeFromHash() {
  var hash = window.location.hash.replace('#', '') || 'agent';
  showPanel(hash);
}
window.addEventListener('hashchange', routeFromHash);

// --- Toast ---
function toast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function() { t.classList.remove('show'); }, 2200);
}

// --- API helper ---
function api(path, opts) {
  return fetch('/api/dashboard' + path, opts).then(function(r) { return r.json(); });
}

// --- AGENT CHAT ---
var chatMessages = document.getElementById('chat-messages');
var chatInput = document.getElementById('chat-input');
var chatSend = document.getElementById('chat-send');
var chatBusy = false;
var chatHistory = [];
var attachedFile = null;

function clearEmptyState() {
  var empty = chatMessages.querySelector('.chat-empty');
  if (empty) empty.remove();
}

function renderMd(text) {
  var tmp = document.createElement('div');
  tmp.textContent = text;
  var s = tmp.innerHTML;
  s = s.replace(/\\\`\\\`\\\`([\\s\\S]*?)\\\`\\\`\\\`/g, '<pre><code>$1</code></pre>');
  s = s.replace(/\\\`([^\\\`]+)\\\`/g, '<code>$1</code>');
  s = s.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
  s = s.replace(/\\*(.+?)\\*/g, '<em>$1</em>');
  s = s.replace(/\\n/g, '<br>');
  return s;
}

function addChatMsg(text, cls) {
  clearEmptyState();
  var d = document.createElement('div');
  d.className = 'chat-msg ' + cls;
  if (cls.indexOf('bot') !== -1 && cls.indexOf('thinking') === -1) {
    d.innerHTML = renderMd(text);
  } else {
    d.textContent = text;
  }
  chatMessages.appendChild(d);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return d;
}

function sendChatMessage() {
  var text = chatInput.value.trim();
  if (!text || chatBusy) return;
  chatBusy = true;
  chatSend.disabled = true;
  chatInput.value = '';

  // Upload file first if attached
  if (attachedFile) {
    var formData = new FormData();
    formData.append('file', attachedFile);
    var fname = attachedFile.name;
    clearAttachedFile();
    addChatMsg('[Uploading ' + fname + '...]', 'user');
    fetch('/api/upload', { method: 'POST', body: formData }).then(function(r) { return r.json(); }).then(function(data) {
      if (data.uploaded) {
        text = text + ' [Uploaded: ' + fname + ', ' + (data.chunks || 0) + ' chunks indexed]';
      }
      doStreamChat(text);
    }).catch(function() { doStreamChat(text); });
    return;
  }

  addChatMsg(text, 'user');
  chatHistory.push({ role: 'user', text: text });
  doStreamChat(text);
}

function doStreamChat(text) {
  clearEmptyState();
  var botMsg = document.createElement('div');
  botMsg.className = 'chat-msg bot thinking';
  botMsg.textContent = '';
  chatMessages.appendChild(botMsg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  var streamedText = '';

  fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text }),
  }).then(function(response) {
    if (!response.ok) throw new Error('Stream request failed');
    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';

    function processChunk() {
      return reader.read().then(function(result) {
        if (result.done) {
          botMsg.classList.remove('thinking');
          botMsg.innerHTML = renderMd(streamedText || 'No response.');
          chatHistory.push({ role: 'bot', text: streamedText });
          chatBusy = false;
          chatSend.disabled = false;
          chatInput.focus();
          return;
        }
        buffer += decoder.decode(result.value, { stream: true });
        var lines = buffer.split('\\n');
        buffer = lines.pop() || '';
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (line.startsWith('event: ')) {
            var evtType = line.slice(7);
            i++;
            if (i < lines.length && lines[i].trim().startsWith('data: ')) {
              try {
                var evtData = JSON.parse(lines[i].trim().slice(6));
                if (evtType === 'delta' && evtData.text) {
                  streamedText += evtData.text;
                  botMsg.textContent = streamedText;
                  chatMessages.scrollTop = chatMessages.scrollHeight;
                } else if (evtType === 'tool') {
                  if (evtData.status === 'start') {
                    botMsg.textContent = streamedText + '\\n[Using ' + evtData.name + '...]';
                  }
                } else if (evtType === 'done') {
                  streamedText = evtData.reply || streamedText;
                } else if (evtType === 'error') {
                  streamedText += '\\nError: ' + (evtData.error || 'Unknown error');
                }
              } catch(e) {}
            }
          }
        }
        return processChunk();
      });
    }
    return processChunk();
  }).catch(function(e) {
    botMsg.classList.remove('thinking');
    botMsg.textContent = 'Error: ' + e.message;
    chatBusy = false;
    chatSend.disabled = false;
    chatInput.focus();
  });
}

chatSend.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') sendChatMessage(); });

// --- File Upload ---
function triggerFileUpload() {
  document.getElementById('file-input').click();
}
document.getElementById('file-input').addEventListener('change', function(e) {
  var file = e.target.files[0];
  if (file) attachFile(file);
  e.target.value = '';
});
function attachFile(file) {
  attachedFile = file;
  document.getElementById('file-pill-name').textContent = file.name;
  document.getElementById('file-pill-bar').style.display = 'block';
}
function clearAttachedFile() {
  attachedFile = null;
  document.getElementById('file-pill-bar').style.display = 'none';
}

// Drag and drop
var chatPanel = document.getElementById('panel-agent');
var dropOverlay = document.getElementById('drop-overlay');
chatPanel.addEventListener('dragover', function(e) { e.preventDefault(); dropOverlay.classList.add('visible'); });
chatPanel.addEventListener('dragleave', function(e) { if (e.target === chatPanel || e.target === dropOverlay) dropOverlay.classList.remove('visible'); });
chatPanel.addEventListener('drop', function(e) {
  e.preventDefault();
  dropOverlay.classList.remove('visible');
  if (e.dataTransfer.files.length) attachFile(e.dataTransfer.files[0]);
});

// --- Voice Input ---
var micRecording = false;
var mediaRecorder = null;
function toggleMic() {
  if (micRecording) { stopMic(); return; }
  if (!navigator.mediaDevices) { toast('Microphone not available'); return; }
  navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
    micRecording = true;
    document.getElementById('mic-btn').classList.add('recording');
    var chunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = function(e) { chunks.push(e.data); };
    mediaRecorder.onstop = function() {
      stream.getTracks().forEach(function(t) { t.stop(); });
      var blob = new Blob(chunks, { type: 'audio/webm' });
      sendVoice(blob);
    };
    mediaRecorder.start();
  }).catch(function() { toast('Microphone access denied'); });
}
function stopMic() {
  micRecording = false;
  document.getElementById('mic-btn').classList.remove('recording');
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
}
function sendVoice(blob) {
  chatBusy = true;
  chatSend.disabled = true;
  addChatMsg('[Voice message]', 'user');
  var botMsg = addChatMsg('Transcribing...', 'bot thinking');
  var fd = new FormData();
  fd.append('audio', blob, 'recording.webm');
  fd.append('tts', 'false');
  fetch('/api/chat/voice', { method: 'POST', body: fd }).then(function(r) { return r.json(); }).then(function(data) {
    botMsg.classList.remove('thinking');
    if (data.error) { botMsg.textContent = 'Error: ' + data.error; }
    else {
      if (data.transcript) chatHistory.push({ role: 'user', text: data.transcript });
      botMsg.innerHTML = renderMd(data.reply || 'No response.');
      chatHistory.push({ role: 'bot', text: data.reply });
    }
    chatBusy = false;
    chatSend.disabled = false;
  }).catch(function(e) {
    botMsg.classList.remove('thinking');
    botMsg.textContent = 'Error: ' + e.message;
    chatBusy = false;
    chatSend.disabled = false;
  });
}

// --- STATUS ---
function makeCard(label, value) {
  var card = document.createElement('div');
  card.className = 'card';
  var lbl = document.createElement('div');
  lbl.className = 'label';
  lbl.textContent = label;
  var val = document.createElement('div');
  val.className = 'value';
  if (value === 'running') val.classList.add('ok');
  if (value === 'not running') val.classList.add('warn');
  val.textContent = value;
  card.appendChild(lbl);
  card.appendChild(val);
  return card;
}

function loadStatus() {
  api('/status').then(function(data) {
    var c = document.getElementById('status-cards');
    c.replaceChildren();
    Object.keys(data).forEach(function(label) {
      c.appendChild(makeCard(label, String(data[label])));
    });
  });
}

// --- ANALYTICS ---
function loadAnalytics() {
  // Summary cards
  api('/analytics/summary').then(function(data) {
    var c = document.getElementById('analytics-summary');
    c.replaceChildren();
    c.appendChild(makeCard('Total Tokens', (data.totalTokens || 0).toLocaleString()));
    c.appendChild(makeCard('Estimated Cost', '$' + (data.estimatedCostUsd || 0).toFixed(4)));
    c.appendChild(makeCard('Avg Response', (data.avgResponseTimeMs || 0) + 'ms'));
    c.appendChild(makeCard('Sessions', String(data.sessionCount || 0)));
  });

  // Usage chart
  api('/analytics/usage-over-time').then(function(data) {
    var chart = document.getElementById('usage-chart');
    chart.replaceChildren();
    var days = data.days || [];
    if (!days.length) { chart.textContent = 'No data yet'; return; }
    var maxVal = 1;
    days.forEach(function(d) { var t = (d.input || 0) + (d.output || 0); if (t > maxVal) maxVal = t; });
    days.forEach(function(d) {
      var total = (d.input || 0) + (d.output || 0);
      var col = document.createElement('div');
      col.className = 'bar-col';
      var bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.height = Math.max(2, (total / maxVal) * 100) + 'px';
      bar.setAttribute('data-tooltip', total.toLocaleString() + ' tokens');
      var label = document.createElement('div');
      label.className = 'bar-label';
      label.textContent = (d.day || '').slice(5);
      col.appendChild(bar);
      col.appendChild(label);
      chart.appendChild(col);
    });
  });

  // Tools table
  api('/analytics/tools').then(function(data) {
    var body = document.getElementById('tools-body');
    body.replaceChildren();
    var tools = data.tools || [];
    document.getElementById('tool-count').textContent = String(tools.length);
    tools.forEach(function(t) {
      var tr = document.createElement('tr');
      var cells = [t.tool_name, String(t.calls), Math.round(t.avg_ms || 0) + 'ms', String(t.errors || 0)];
      cells.forEach(function(text) {
        var td = document.createElement('td');
        td.textContent = text;
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
  });

  // Sessions table
  api('/analytics/sessions').then(function(data) {
    var body = document.getElementById('sessions-body');
    body.replaceChildren();
    (data.sessions || []).forEach(function(s) {
      var tr = document.createElement('tr');
      var cells = [
        (s.session_id || '').slice(0, 16) + '...',
        s.provider + '/' + s.model,
        ((s.input_tokens || 0) + (s.output_tokens || 0)).toLocaleString(),
        '$' + (s.cost || 0).toFixed(4),
        (s.last_used || '').replace('T', ' ').slice(0, 16)
      ];
      cells.forEach(function(text) {
        var td = document.createElement('td');
        td.textContent = text;
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
  });
}

// --- SYSTEM PROMPT ---
function loadSystem() {
  api('/system').then(function(data) {
    document.getElementById('system-editor').value = data.content || '';
    document.getElementById('system-status').textContent = 'Loaded';
  });
}
function saveSystem() {
  var content = document.getElementById('system-editor').value;
  api('/system', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({content: content}) }).then(function() {
    document.getElementById('system-status').textContent = 'Saved';
    toast('System prompt saved');
  });
}

// --- MEMORY ---
var memoryRecentLoaded = false;

function loadMemory() {
  api('/memory').then(function(data) {
    document.getElementById('memory-editor').value = data.content || '';
    document.getElementById('memory-status').textContent = 'Loaded';
  });
  if (!memoryRecentLoaded) {
    memoryRecentLoaded = true;
    loadRecentMemories();
  }
}
function saveMemory() {
  var content = document.getElementById('memory-editor').value;
  api('/memory', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({content: content}) }).then(function() {
    document.getElementById('memory-status').textContent = 'Saved';
    toast('Memory saved');
  });
}

function renderMemoryItems(results, container) {
  container.replaceChildren();
  if (!results || !results.length) {
    var p = document.createElement('p');
    p.className = 'empty-state';
    p.style.padding = '20px 0';
    p.textContent = 'No memories found.';
    container.appendChild(p);
    document.getElementById('memory-count').textContent = '0';
    return;
  }
  document.getElementById('memory-count').textContent = String(results.length);
  results.forEach(function(r) {
    var item = document.createElement('div');
    item.className = 'memory-item';
    var src = document.createElement('div');
    src.className = 'source';
    src.textContent = r.source || '';
    var cnt = document.createElement('div');
    cnt.className = 'content';
    cnt.textContent = r.content;
    item.appendChild(src);
    item.appendChild(cnt);
    container.appendChild(item);
  });
}

function loadRecentMemories() {
  api('/memory/recent').then(function(data) {
    renderMemoryItems(data.results, document.getElementById('memory-results'));
  }).catch(function() {});
}

function searchMemories() {
  var query = document.getElementById('memory-search').value.trim();
  if (!query) {
    memoryRecentLoaded = false;
    loadRecentMemories();
    return;
  }
  api('/memory/search?q=' + encodeURIComponent(query)).then(function(data) {
    renderMemoryItems(data.results, document.getElementById('memory-results'));
  });
}

document.getElementById('memory-search').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') searchMemories();
});

// --- SKILLS ---
function loadSkills() {
  api('/skills').then(function(data) {
    var body = document.getElementById('skills-body');
    var empty = document.getElementById('skills-empty');
    body.replaceChildren();
    if (!data.skills || !data.skills.length) { empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    data.skills.forEach(function(s) {
      var tr = document.createElement('tr');
      var nameCell = document.createElement('td');
      var nameStrong = document.createElement('strong');
      nameStrong.textContent = s.name;
      nameCell.appendChild(nameStrong);
      var descCell = document.createElement('td');
      descCell.textContent = s.description || '';
      var statusCell = document.createElement('td');
      var dot = document.createElement('span');
      dot.className = 'status-dot ' + (s.status === 'ok' ? 'ok' : 'error');
      statusCell.appendChild(dot);
      statusCell.appendChild(document.createTextNode(s.status));
      tr.appendChild(nameCell);
      tr.appendChild(descCell);
      tr.appendChild(statusCell);
      body.appendChild(tr);
    });
  });
}

// --- REGISTRY ---
function searchRegistry() {
  var q = document.getElementById('registry-search').value.trim();
  var container = document.getElementById('registry-results');
  container.replaceChildren();
  var loading = document.createElement('p');
  loading.className = 'empty-state';
  loading.textContent = 'Searching...';
  container.appendChild(loading);

  api('/registry/search?q=' + encodeURIComponent(q)).then(function(data) {
    container.replaceChildren();
    var results = data.results || [];
    if (!results.length) {
      var p = document.createElement('p');
      p.className = 'empty-state';
      p.textContent = q ? 'No skills found for "' + q + '".' : 'No skills available.';
      container.appendChild(p);
      return;
    }
    results.forEach(function(r) {
      var item = document.createElement('div');
      item.className = 'registry-item';
      var info = document.createElement('div');
      var name = document.createElement('div');
      name.className = 'ri-name';
      name.textContent = r.name;
      var desc = document.createElement('div');
      desc.className = 'ri-desc';
      desc.textContent = r.description || '';
      info.appendChild(name);
      info.appendChild(desc);
      var btn = document.createElement('button');
      btn.className = 'btn btn-sm btn-primary';
      btn.textContent = 'Install';
      btn.onclick = function() { installRegistrySkill(r.name, btn); };
      item.appendChild(info);
      item.appendChild(btn);
      container.appendChild(item);
    });
  }).catch(function(e) {
    container.replaceChildren();
    var p = document.createElement('p');
    p.className = 'empty-state';
    p.textContent = 'Error: ' + e.message;
    container.appendChild(p);
  });
}

document.getElementById('registry-search').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') searchRegistry();
});

function installRegistrySkill(name, btn) {
  btn.disabled = true;
  btn.textContent = 'Installing...';
  api('/registry/install', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ name: name })
  }).then(function(data) {
    if (data.ok) {
      btn.textContent = 'Installed';
      btn.className = 'btn btn-sm btn-ghost';
      toast(name + ' installed');
    } else {
      btn.textContent = 'Failed';
      btn.disabled = false;
    }
  }).catch(function() {
    btn.textContent = 'Error';
    btn.disabled = false;
  });
}

// --- WORKFLOWS ---
function loadWorkflows() {
  api('/workflows').then(function(data) {
    var container = document.getElementById('workflows-list');
    var empty = document.getElementById('workflows-empty');
    container.replaceChildren();
    var wfs = data.workflows || [];
    if (!wfs.length) { empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    wfs.forEach(function(w) {
      var card = document.createElement('div');
      card.className = 'card';
      var name = document.createElement('div');
      name.className = 'value';
      name.style.fontSize = '16px';
      name.textContent = w.name;
      var desc = document.createElement('div');
      desc.style.cssText = 'font-size:13px;color:var(--text-muted);margin-top:4px;';
      desc.textContent = w.description || '';
      var meta = document.createElement('div');
      meta.style.cssText = 'font-size:11px;color:var(--text-faint);margin-top:8px;';
      meta.textContent = (w.agents || []).length + ' agents, ' + (w.steps || 0) + ' steps';
      card.appendChild(name);
      card.appendChild(desc);
      card.appendChild(meta);
      container.appendChild(card);
    });
    document.getElementById('workflows-status').textContent = wfs.length + ' workflows';
  });
}

// --- CRON ---
function loadCron() {
  api('/cron').then(function(data) {
    var body = document.getElementById('cron-body');
    var empty = document.getElementById('cron-empty');
    body.replaceChildren();
    if (!data.jobs || !data.jobs.length) { empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    data.jobs.forEach(function(j) {
      var tr = document.createElement('tr');
      var cells = [j.name, j.schedule, j.task, j.enabled ? 'Yes' : 'No', j.last_run || 'Never'];
      cells.forEach(function(text) {
        var td = document.createElement('td');
        td.textContent = text;
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
  });
}

// --- LOGS ---
function loadLogs() {
  api('/logs').then(function(data) {
    document.getElementById('log-content').textContent = data.content || 'No logs.';
    document.getElementById('logs-status').textContent = 'Last 100 lines';
  });
}

// --- SETTINGS ---
var settingsProviders = [];

function loadSettings() {
  api('/config').then(function(data) {
    settingsProviders = data.providers || [];
    var sel = document.getElementById('settings-provider');
    sel.replaceChildren();
    settingsProviders.forEach(function(p) {
      var opt = document.createElement('option');
      opt.value = p.name;
      opt.textContent = p.name;
      if (p.name === data.activeProvider) opt.selected = true;
      sel.appendChild(opt);
    });
    document.getElementById('settings-model').value = data.model || '';
    document.getElementById('settings-status').textContent = '';
  });
  api('/settings/heartbeat').then(function(data) {
    document.getElementById('settings-heartbeat').value = data.minutes || 30;
    document.getElementById('heartbeat-status').textContent = '';
  });
  loadChannelStatus();
  loadDbStats();
}

function onProviderChange() {
  var sel = document.getElementById('settings-provider');
  var provider = sel.value;
  var match = settingsProviders.find(function(p) { return p.name === provider; });
  if (match) {
    document.getElementById('settings-model').value = match.model || '';
  }
}

function saveModelConfig() {
  var provider = document.getElementById('settings-provider').value;
  var model = document.getElementById('settings-model').value.trim();
  if (!provider) return;
  if (!model) {
    document.getElementById('settings-status').textContent = 'Model is required';
    return;
  }
  api('/config/model', {
    method: 'PUT',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ provider: provider, model: model })
  }).then(function(data) {
    if (data.ok) {
      document.getElementById('settings-status').textContent = 'Saved \u2014 restart Zubo to apply';
      toast('Model updated');
      loadSettings();
    } else {
      document.getElementById('settings-status').textContent = data.error || 'Error';
    }
  });
}

function testLlm() {
  document.getElementById('settings-status').textContent = 'Testing...';
  api('/test-llm', { method: 'POST' }).then(function(data) {
    if (data.ok) {
      document.getElementById('settings-status').textContent = 'Connected (' + data.model + ')';
      toast('LLM connection OK');
    } else {
      document.getElementById('settings-status').textContent = 'Failed: ' + (data.error || 'Unknown');
    }
  }).catch(function(e) {
    document.getElementById('settings-status').textContent = 'Error: ' + e.message;
  });
}

function saveHeartbeat() {
  var mins = parseInt(document.getElementById('settings-heartbeat').value, 10);
  if (!mins || mins < 1 || mins > 1440) {
    document.getElementById('heartbeat-status').textContent = 'Must be 1\u20131440 minutes';
    return;
  }
  api('/settings/heartbeat', {
    method: 'PUT',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ minutes: mins })
  }).then(function(data) {
    if (data.ok) {
      document.getElementById('heartbeat-status').textContent = 'Applied immediately';
      toast('Heartbeat updated to ' + data.minutes + ' min');
    } else {
      document.getElementById('heartbeat-status').textContent = data.error || 'Error';
    }
  });
}

// --- Channel Status ---
var channelLabels = { webchat: 'Web Chat', telegram: 'Telegram', discord: 'Discord', slack: 'Slack', whatsapp: 'WhatsApp', signal: 'Signal' };

function loadChannelStatus() {
  api('/channel-status').then(function(data) {
    var list = document.getElementById('channel-status-list');
    list.replaceChildren();
    var channels = data.channels || {};
    var connCount = 0;
    Object.keys(channels).forEach(function(name) {
      var ch = channels[name];
      if (ch.enabled) connCount++;
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;';
      var dot = document.createElement('span');
      dot.className = 'status-dot ' + (ch.enabled ? 'ok' : '');
      if (!ch.enabled) dot.style.background = 'var(--text-faint)';
      var label = document.createElement('span');
      label.style.cssText = 'font-size:13px;font-weight:500;color:var(--text);flex:1;';
      label.textContent = channelLabels[name] || name;
      var status = document.createElement('span');
      status.style.cssText = 'font-size:11px;color:' + (ch.enabled ? 'var(--green)' : 'var(--text-faint)') + ';';
      status.textContent = ch.enabled ? 'Connected' : (ch.configured ? 'Disabled' : 'Not configured');
      row.appendChild(dot);
      row.appendChild(label);
      row.appendChild(status);
      list.appendChild(row);
    });
    document.getElementById('channel-count-badge').textContent = connCount + ' active';
    document.getElementById('sidebar-conn-badge').textContent = connCount + ' channels';
  }).catch(function() {});
}

// --- DATA EXPORT/IMPORT ---
function loadDbStats() {
  api('/db-stats').then(function(data) {
    var el = document.getElementById('db-stats');
    var tables = data.tables || {};
    var totalRows = 0;
    Object.keys(tables).forEach(function(k) { totalRows += tables[k]; });
    var sizeMb = ((data.sizeBytes || 0) / 1024 / 1024).toFixed(2);
    el.textContent = 'DB size: ' + sizeMb + ' MB, ' + totalRows + ' total rows';
  }).catch(function() {});
}

function exportJson() {
  document.getElementById('data-status').textContent = 'Exporting...';
  fetch('/api/dashboard/export', { method: 'POST' }).then(function(r) {
    if (!r.ok) throw new Error('Export failed');
    return r.blob();
  }).then(function(blob) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'zubo-export.json';
    a.click();
    URL.revokeObjectURL(a.href);
    document.getElementById('data-status').textContent = 'Export downloaded';
    toast('Export complete');
  }).catch(function(e) {
    document.getElementById('data-status').textContent = 'Error: ' + e.message;
  });
}

function backupDb() {
  document.getElementById('data-status').textContent = 'Backing up...';
  api('/backup', { method: 'POST' }).then(function(data) {
    if (data.ok) {
      document.getElementById('data-status').textContent = 'Backup saved: ' + data.path;
      toast('SQLite backup created');
    } else {
      document.getElementById('data-status').textContent = 'Error: ' + (data.error || 'Unknown');
    }
  }).catch(function(e) {
    document.getElementById('data-status').textContent = 'Error: ' + e.message;
  });
}

function importJson(event) {
  var file = event.target.files[0];
  if (!file) return;
  event.target.value = '';
  document.getElementById('data-status').textContent = 'Importing...';
  var reader = new FileReader();
  reader.onload = function() {
    fetch('/api/dashboard/import', { method: 'POST', body: reader.result }).then(function(r) { return r.json(); }).then(function(data) {
      if (data.ok) {
        document.getElementById('data-status').textContent = 'Imported ' + data.imported + ' rows (' + data.skipped + ' skipped)';
        toast('Import complete');
        loadDbStats();
      } else {
        document.getElementById('data-status').textContent = 'Error: ' + (data.error || 'Unknown');
      }
    }).catch(function(e) {
      document.getElementById('data-status').textContent = 'Error: ' + e.message;
    });
  };
  reader.readAsText(file);
}

// --- ONBOARDING ---
var onboardingStep = 0;
var onboardingSteps = [
  { title: 'Welcome to Zubo', body: 'Your personal AI agent that remembers you, runs tasks, and connects to your favorite services. Let\\'s get you set up.', btn: 'Get Started' },
  { title: 'Set Your Agent\\'s Name', body: 'Give your Zubo agent a personality. Edit the system prompt to customize how it talks and what it knows about you.', btn: 'Next' },
  { title: 'Connect a Channel', body: 'Zubo works via web chat by default. You can also connect Telegram, Discord, Slack, WhatsApp, or Signal in Settings.', btn: 'Next' },
  { title: 'You\\'re All Set!', body: 'Start chatting with Zubo. It remembers your conversations, can learn new skills, and runs scheduled tasks for you.', btn: 'Start Chatting' },
];

function checkOnboarding() {
  api('/onboarding').then(function(data) {
    if (data.completed) return;
    onboardingStep = data.step || 0;
    showOnboardingStep();
    document.getElementById('onboarding-modal').classList.add('visible');
  }).catch(function() {});
}

function showOnboardingStep() {
  var step = onboardingSteps[onboardingStep];
  if (!step) return;
  var content = document.getElementById('onboarding-content');
  content.replaceChildren();
  var h = document.createElement('h2');
  h.textContent = step.title;
  var p = document.createElement('p');
  p.textContent = step.body;
  content.appendChild(h);
  content.appendChild(p);
  document.getElementById('onboarding-next').textContent = step.btn;
  // Update dots
  var dots = document.querySelectorAll('#onboarding-steps .step-dot');
  dots.forEach(function(d, i) {
    d.className = 'step-dot';
    if (i < onboardingStep) d.classList.add('done');
    if (i === onboardingStep) d.classList.add('active');
  });
}

function nextOnboardingStep() {
  onboardingStep++;
  if (onboardingStep >= onboardingSteps.length) {
    skipOnboarding();
    return;
  }
  showOnboardingStep();
  api('/onboarding', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ completed: false, step: onboardingStep }) });
}

function skipOnboarding() {
  document.getElementById('onboarding-modal').classList.remove('visible');
  api('/onboarding', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ completed: true, step: onboardingSteps.length }) });
}

// Auto-refresh channel status every 30s
setInterval(function() {
  if (document.getElementById('panel-settings').classList.contains('active')) loadChannelStatus();
}, 30000);

// Init
routeFromHash();
checkOnboarding();
</script>
</body>
</html>`;
