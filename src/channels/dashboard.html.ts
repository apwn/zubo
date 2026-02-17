// Unified dashboard + agent chat HTML — no build step
export const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Zubo</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%237c3aed'/><path d='M50 15C52 37 63 48 85 50C63 52 52 63 50 85C48 63 37 52 15 50C37 48 48 37 50 15Z' fill='white'/></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --bg: #060608;
    --bg-raised: #0e0e12;
    --bg-surface: #111116;
    --bg-hover: #18181f;
    --border: #1e1e26;
    --border-subtle: #18181f;
    --text: #f0f0f5;
    --text-secondary: #9595a8;
    --text-muted: #5f5f73;
    --text-faint: #52525b;
    --accent: #7c3aed;
    --accent-hover: #6d28d9;
    --accent-bg: rgba(124,58,237,0.08);
    --accent-border: rgba(124,58,237,0.2);
    --green: #10b981;
    --green-bg: rgba(16,185,129,0.1);
    --yellow: #f59e0b;
    --yellow-bg: rgba(245,158,11,0.1);
    --red: #ef4444;
    --fuchsia: #d946ef;
    --indigo: #6366f1;
    --gradient: linear-gradient(135deg, #7c3aed, #d946ef);
    --gradient-text: linear-gradient(135deg, #fbbf24 0%, #f97316 25%, #ec4899 50%, #a855f7 75%, #6366f1 100%);
    --radius: 10px;
    --radius-lg: 14px;
    --font: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --display: 'Bricolage Grotesque', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
    --shadow: 0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3);
    --shadow-lg: 0 4px 12px rgba(0,0,0,0.5);
    --shadow-glow: 0 0 80px rgba(124,58,237,0.15);
    --transition: 150ms cubic-bezier(0.4,0,0.2,1);
  }

  body { font-family: var(--font); background: var(--bg); color: var(--text); height: 100vh; display: flex; overflow: hidden; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }

  /* Display font for headings & titles */
  h1, h2, h3, h4,
  .settings-title,
  #topbar-title,
  .modal h2,
  .card .value,
  .qa-label { font-family: var(--display); }

  .gradient-text {
    background: var(--gradient-text);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* Sidebar */
  #sidebar {
    width: 220px; background: var(--bg-raised); border-right: 1px solid var(--border);
    display: flex; flex-direction: column; flex-shrink: 0;
  }
  .sidebar-logo {
    padding: 20px 20px 16px; display: flex; align-items: center; gap: 10px;
    border-bottom: 1px solid var(--border);
  }
  .sidebar-logo .logo-icon { display: none; }
  .sidebar-logo span { font-family: var(--display); font-weight: 700; font-size: 15px; color: var(--text); letter-spacing: -0.3px; }

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
  /* active bar handled in polish section below */

  .sidebar-divider { height: 1px; background: var(--border); margin: 8px 16px; }

  .sidebar-footer {
    padding: 12px 16px; border-top: 1px solid var(--border);
    font-size: 11px; color: var(--text-faint); display: flex; align-items: center; justify-content: space-between;
  }
  .sidebar-footer .footer-left { display: flex; align-items: center; gap: 6px; }
  .sidebar-footer .conn-badge {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 10px; padding: 2px 8px; border-radius: 10px;
    background: var(--green-bg); color: var(--green);
  }
  .sidebar-footer .docs-link {
    color: var(--text-faint); text-decoration: none; font-size: 11px;
    display: inline-flex; align-items: center; gap: 4px;
    transition: color var(--transition);
  }
  .sidebar-footer .docs-link:hover { color: var(--accent); }

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
  .panel.active { display: flex; flex-direction: column; height: 100%; animation: panelIn 200ms ease-out; }
  @keyframes panelIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

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
  .chat-empty-text { font-size: 14px; color: var(--text-muted); }

  .chat-welcome { animation: fadeIn 400ms ease-out; gap: 16px; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  .chat-welcome-icon {
    width: 56px; height: 56px; background: var(--gradient); border-radius: 16px;
    display: flex; align-items: center; justify-content: center;
    font-family: var(--display); font-weight: 800; font-size: 22px; color: #fff;
    box-shadow: 0 0 30px rgba(124,58,237,0.3), 0 0 60px rgba(124,58,237,0.1);
  }
  .chat-welcome h3 {
    font-family: var(--display); font-size: 22px; font-weight: 700; letter-spacing: -0.5px;
  }
  .suggestion-chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 4px; }
  .suggestion-chip {
    padding: 8px 16px; border-radius: 20px; border: 1px solid var(--border);
    background: var(--bg-surface); color: var(--text-secondary); font-size: 13px;
    font-family: var(--font); cursor: pointer; transition: all var(--transition);
  }
  .suggestion-chip:hover {
    border-color: var(--accent); color: var(--text); background: var(--accent-bg);
    box-shadow: 0 0 12px rgba(124,58,237,0.15);
  }

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
    display: none; position: absolute; inset: 0; background: rgba(124,58,237,0.08);
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
    padding: 18px 20px; transition: border-color var(--transition); overflow: hidden;
    border-top: 2px solid var(--accent-border);
  }
  .card:nth-child(2) { border-top-color: rgba(16,185,129,0.3); }
  .card:nth-child(3) { border-top-color: rgba(99,102,241,0.3); }
  .card:nth-child(4) { border-top-color: rgba(217,70,239,0.3); }
  .card:hover { border-color: rgba(124,58,237,0.25); box-shadow: 0 0 20px rgba(124,58,237,0.06); }
  .card .label {
    font-size: 11px; color: var(--text-faint); text-transform: uppercase;
    letter-spacing: 0.6px; font-weight: 600; margin-bottom: 8px;
  }
  .card .value { font-size: clamp(18px, 3vw, 22px); font-weight: 700; color: var(--text); letter-spacing: -0.5px; word-break: break-word; }
  .card .value.ok { color: var(--green); border-left: 3px solid var(--green); padding-left: 8px; }
  .card .value.warn { color: var(--yellow); border-left: 3px solid var(--yellow); padding-left: 8px; }

  /* Budget controls */
  .budget-bar { width: 100%; height: 8px; background: var(--bg-hover); border-radius: 4px; overflow: hidden; margin-top: 8px; }
  .budget-bar-fill { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
  .budget-bar-fill.ok { background: var(--green); }
  .budget-bar-fill.warn { background: var(--yellow); }
  .budget-bar-fill.danger { background: var(--red); }
  .budget-card-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
  .budget-card-value { font-family: var(--display); font-size: 28px; font-weight: 700; margin: 4px 0; }
  .budget-card-sub { font-size: 12px; color: var(--text-secondary); }

  /* Quick action cards */
  .quick-actions {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px; margin-top: 24px;
  }
  .quick-action {
    background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
    padding: 18px; cursor: pointer; transition: all var(--transition); text-align: center;
  }
  .quick-action:hover { border-color: var(--accent); background: var(--accent-bg); transform: translateY(-2px); box-shadow: 0 4px 16px rgba(124,58,237,0.1), 0 0 20px rgba(124,58,237,0.08); }
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
  .btn-purple { background: var(--fuchsia); color: white; }
  .btn-purple:hover { background: #c026d3; }

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
  .memory-item:hover { border-color: rgba(124,58,237,0.2); }
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
    text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600;
    border-bottom: 2px solid var(--border); background: var(--bg-surface);
    position: sticky; top: 0;
  }
  td { padding: 12px 16px; border-bottom: 1px solid var(--border-subtle); color: var(--text-secondary); }
  tbody tr:nth-child(odd) td { background: rgba(255,255,255,0.015); }
  tbody tr:hover td { background: var(--bg-hover); }

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
  .settings-section {
    max-width: 600px; margin-bottom: 24px; background: var(--bg-raised);
    border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 24px;
  }
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

  /* Perf grid */
  .perf-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .perf-card {
    background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
    padding: 18px 20px; transition: border-color var(--transition);
  }
  .perf-card:hover { border-color: rgba(124,58,237,0.25); }
  .perf-card .perf-label { font-size: 11px; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600; margin-bottom: 8px; }
  .perf-card .perf-value { font-family: var(--display); font-size: 22px; font-weight: 700; color: var(--text); letter-spacing: -0.5px; }

  .cost-bar-wrap { display: flex; align-items: center; gap: 8px; }
  .cost-bar { height: 8px; border-radius: 4px; background: var(--gradient); min-width: 2px; transition: width 300ms; }
  .cost-pct { font-size: 11px; color: var(--text-faint); white-space: nowrap; }

  /* Analytics CSS bar chart */
  .bar-chart { display: flex; align-items: flex-end; gap: 8px; height: 120px; padding: 0 8px; position: relative; }
  .bar-col { display: flex; flex-direction: column; align-items: center; flex: 1; max-width: 80px; gap: 4px; }
  .bar-col .bar { background: var(--gradient); border-radius: 4px 4px 0 0; width: 100%; min-height: 2px; transition: height 300ms, opacity var(--transition); opacity: 0.85; }
  .bar-col .bar:hover { opacity: 1; }
  .bar-col .bar-label { font-size: 10px; color: var(--text-faint); }
  .chart-y-label { position: absolute; top: -4px; left: 0; font-size: 10px; color: var(--text-faint); font-family: var(--mono); }

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
  .registry-item:hover { border-color: rgba(124,58,237,0.2); }
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
  ::-webkit-scrollbar-thumb { background: #2a2a35; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #3f3f4d; }

  /* Send button gradient */
  #chat-send { background: var(--gradient); }
  #chat-send:hover { filter: brightness(1.1); }

  /* Sidebar gradient border */
  #sidebar { border-right: none; position: relative; }
  #sidebar::after { content: ''; position: absolute; top: 0; right: 0; width: 1px; height: 100%; background: linear-gradient(to bottom, var(--border) 0%, rgba(124,58,237,0.3) 50%, var(--border) 100%); }

  /* Topbar gradient border */
  #topbar { border-bottom: none; position: relative; }
  #topbar::after { content: ''; position: absolute; bottom: 0; left: 0; width: 100%; height: 1px; background: linear-gradient(to right, var(--border) 0%, rgba(124,58,237,0.3) 50%, var(--border) 100%); }

  .topbar-breadcrumb { color: var(--text-faint); font-weight: 500; }

  /* Skeleton loading */
  .skeleton {
    background: linear-gradient(90deg, var(--bg-surface) 25%, var(--bg-hover) 50%, var(--bg-surface) 75%);
    background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 6px;
  }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  .skeleton-card { height: 80px; }
  .skeleton-row { height: 16px; margin-bottom: 10px; }

  /* ===== COMMAND PALETTE ===== */
  .cmd-palette-overlay {
    display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6);
    z-index: 300; align-items: flex-start; justify-content: center; padding-top: 20vh;
    backdrop-filter: blur(4px);
  }
  .cmd-palette-overlay.visible { display: flex; }
  .cmd-palette {
    background: var(--bg-raised); border: 1px solid var(--border); border-radius: var(--radius-lg);
    width: 400px; max-width: 90vw; box-shadow: var(--shadow-lg); overflow: hidden;
  }
  .cmd-palette input {
    width: 100%; padding: 16px 20px; background: transparent; border: none;
    border-bottom: 1px solid var(--border); color: var(--text); font-size: 15px;
    font-family: var(--font); outline: none;
  }
  .cmd-palette input::placeholder { color: var(--text-faint); }
  .cmd-result {
    padding: 10px 20px; cursor: pointer; font-size: 14px; color: var(--text-secondary);
    display: flex; align-items: center; gap: 10px; transition: background var(--transition);
  }
  .cmd-result:hover, .cmd-result.selected { background: var(--accent-bg); color: var(--text); }
  .cmd-result .cmd-shortcut { margin-left: auto; font-size: 11px; color: var(--text-faint); }

  /* ===== THREAD BAR ===== */
  .thread-bar {
    width: 220px; background: var(--bg-raised); border-right: 1px solid var(--border);
    display: flex; flex-direction: column; flex-shrink: 0; overflow: hidden;
  }
  .thread-bar-header {
    padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;
    border-bottom: 1px solid var(--border);
  }
  .thread-bar-header span { font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
  .thread-list { flex: 1; overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 2px; }
  .thread-item {
    padding: 10px 12px; border-radius: 8px; cursor: pointer; font-size: 13px;
    color: var(--text-secondary); transition: all var(--transition); position: relative;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .thread-item:hover { background: var(--bg-hover); color: var(--text); }
  .thread-item.active { background: var(--accent-bg); color: var(--accent); font-weight: 600; }
  .thread-item .thread-delete {
    display: none; position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
    background: none; border: none; color: var(--text-faint); cursor: pointer; font-size: 14px;
  }
  .thread-item:hover .thread-delete { display: block; }
  .new-thread-btn {
    padding: 6px 12px; font-size: 12px; background: var(--accent); color: white;
    border: none; border-radius: 6px; cursor: pointer; font-weight: 600;
  }
  .new-thread-btn:hover { background: var(--accent-hover); }

  /* ===== MOBILE RESPONSIVE ===== */
  @media (max-width: 768px) {
    #sidebar {
      position: fixed; left: -240px; top: 0; bottom: 0; z-index: 100;
      transition: left 200ms ease; width: 240px;
    }
    #sidebar.open { left: 0; }
    #sidebar::after { display: none; }
    .mobile-menu-btn {
      display: flex; width: 36px; height: 36px; align-items: center; justify-content: center;
      background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px;
      color: var(--text); font-size: 18px; cursor: pointer; flex-shrink: 0;
    }
    .mobile-overlay {
      display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 99;
    }
    .mobile-overlay.visible { display: block; }
    .cards { grid-template-columns: 1fr; }
    .perf-grid { grid-template-columns: 1fr; }
    .quick-actions { grid-template-columns: repeat(2, 1fr); }
    .panel-body { padding: 16px; }
    #topbar { padding: 12px 16px; }
    .chat-msg { max-width: 90%; }
    #chat-input-bar { padding: 12px 16px 16px; }
    .settings-section { max-width: 100%; }
    .thread-bar { display: none; }
  }
  @media (min-width: 769px) {
    .mobile-menu-btn { display: none; }
    .mobile-overlay { display: none !important; }
  }

  /* ===== RECIPE CARDS ===== */
  .recipe-card {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 20px;
    transition: all var(--transition);
  }
  .recipe-card:hover {
    border-color: var(--accent-border);
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }
  .recipe-card-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }
  .recipe-card-icon { font-size: 24px; }
  .recipe-card-title { font-family: var(--display); font-weight: 700; font-size: 15px; }
  .recipe-card-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 12px; }
  .recipe-card-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .recipe-card-schedule { font-size: 11px; color: var(--text-muted); }
  .recipe-card-requires { font-size: 10px; color: var(--yellow); }
  .recipe-card .btn { font-size: 12px; padding: 5px 14px; }
  .recipe-card .btn.installed { background: var(--green-bg); color: var(--green); border: 1px solid rgba(16,185,129,0.3); }

  /* ===== TAB BAR ===== */
  .tab-bar {
    display: flex; gap: 2px; padding: 0 0 16px; border-bottom: 1px solid var(--border);
    margin-bottom: 20px; overflow-x: auto; flex-shrink: 0; flex-wrap: wrap; row-gap: 6px;
  }
  .tab {
    padding: 8px 16px; font-size: 13px; font-weight: 500; color: var(--text-muted);
    background: transparent; border: none; border-radius: 8px; cursor: pointer;
    font-family: var(--font); transition: all var(--transition); white-space: nowrap;
  }
  .tab:hover { color: var(--text-secondary); background: var(--bg-hover); }
  .tab.active { color: var(--accent); background: var(--accent-bg); font-weight: 600; }
  .tab-content { display: none; animation: panelIn 200ms ease-out; }
  .tab-content.active { display: block; }

  /* ===== SVG NAV ICONS ===== */
  .nav-svg-icon {
    width: 18px; height: 18px; flex-shrink: 0; opacity: 0.6;
    transition: opacity var(--transition);
  }
  .nav-svg-icon svg { width: 18px; height: 18px; }
  #sidebar nav a:hover .nav-svg-icon { opacity: 0.85; }
  #sidebar nav a.active .nav-svg-icon { opacity: 1; }

  /* ===== ENHANCED EMPTY STATES ===== */
  .empty-state-card {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 60px 24px; text-align: center; gap: 12px;
  }
  .empty-state-card .empty-icon {
    width: 64px; height: 64px; color: var(--text-faint); opacity: 0.4; margin-bottom: 4px;
  }
  .empty-state-card .empty-icon svg { width: 64px; height: 64px; }
  .empty-state-card h4 {
    font-size: 15px; font-weight: 600; color: var(--text-secondary); margin: 0;
  }
  .empty-state-card p {
    font-size: 13px; color: var(--text-muted); max-width: 320px; line-height: 1.5; margin: 0;
  }
  .empty-state-card .btn { margin-top: 8px; }

  /* ===== CHAT WELCOME ENHANCED ===== */
  .chat-welcome-sparkle {
    width: 72px; height: 72px; animation: sparkleFloat 3s ease-in-out infinite;
  }
  .chat-welcome-sparkle svg { width: 72px; height: 72px; filter: drop-shadow(0 0 20px rgba(124,58,237,0.4)); }
  @keyframes sparkleFloat {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50% { transform: translateY(-6px) rotate(8deg); }
  }
  .chat-welcome-mesh {
    position: absolute; inset: 0; pointer-events: none; z-index: 0;
    background: radial-gradient(ellipse at 50% 40%, rgba(124,58,237,0.06) 0%, transparent 60%),
                radial-gradient(ellipse at 30% 60%, rgba(217,70,239,0.04) 0%, transparent 50%),
                radial-gradient(ellipse at 70% 30%, rgba(99,102,241,0.04) 0%, transparent 50%);
  }
  .chat-welcome { position: relative; z-index: 1; }
  .suggestion-chips-group { display: flex; flex-direction: column; gap: 6px; align-items: center; margin-top: 4px; }
  .chip-row { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }

  /* ===== POLISH ===== */
  /* Sidebar hover left border hint */
  #sidebar nav a::before {
    content: ''; position: absolute; left: 0; top: 6px; bottom: 6px;
    width: 3px; border-radius: 2px; background: var(--gradient);
    transform: scaleY(0); transition: transform var(--transition);
  }
  #sidebar nav a:hover::before { transform: scaleY(0.6); }
  #sidebar nav a.active::before { transform: scaleY(1); }

  /* Card subtle scale on hover */
  .card:hover { transform: scale(1.01); }
  .card { transition: border-color var(--transition), transform var(--transition), box-shadow var(--transition); }

  /* Chat input glow on focus */
  #chat-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(124,58,237,0.1), 0 0 16px rgba(124,58,237,0.08);
  }

  /* Toast slide from right */
  .toast {
    transform: translateX(40px); opacity: 0;
    transition: opacity 200ms, transform 200ms;
  }
  .toast.show { opacity: 1; transform: translateX(0); }

  /* Wider scrollbar */
  ::-webkit-scrollbar { width: 8px; }
  ::-webkit-scrollbar-thumb { border-radius: 4px; }

  /* Panel crossfade */
  .panel.active { animation: panelCrossfade 250ms ease-out; }
  @keyframes panelCrossfade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* Thread delete smooth */
  .thread-item { transition: all var(--transition), max-height 200ms ease, opacity 200ms ease; }

  /* Stat card (unified) */
  .stat-card {
    background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
    padding: 18px 20px; transition: all var(--transition);
  }
  .stat-card:hover { border-color: rgba(124,58,237,0.25); transform: scale(1.01); }
  .stat-label {
    font-size: 11px; color: var(--text-faint); text-transform: uppercase;
    letter-spacing: 0.6px; font-weight: 600; margin-bottom: 8px;
  }
  .stat-value {
    font-family: var(--display); font-size: 22px; font-weight: 700;
    color: var(--text); letter-spacing: -0.5px;
  }
  .stat-value.ok { color: var(--green); }

  /* OAuth integration row */
  .oauth-row {
    background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 16px; display: flex; align-items: center; justify-content: space-between;
  }
  .oauth-row-left { display: flex; align-items: center; gap: 12px; }
  .oauth-row-icon { font-size: 24px; }
  .oauth-row-name { font-weight: 600; font-size: 14px; }
  .oauth-row-desc { font-size: 12px; color: var(--text-secondary); }
  .oauth-row-right { display: flex; align-items: center; gap: 10px; }

  /* Secret row */
  .secret-row {
    display: flex; align-items: center; gap: 10px; padding: 10px 14px;
    background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px;
  }
  .secret-name {
    font-family: var(--mono); font-size: 13px; font-weight: 500;
    color: var(--text); min-width: 140px;
  }
  .secret-service { font-size: 11px; color: var(--text-muted); min-width: 80px; }
  .secret-value {
    font-family: var(--mono); font-size: 12px; color: var(--text-secondary);
    flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  /* Channel status row */
  .channel-row {
    display: flex; align-items: center; gap: 10px; padding: 8px 12px;
    background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px;
  }
  .channel-row-label { font-size: 13px; font-weight: 500; color: var(--text); flex: 1; }

  /* ===== CONVERSATION HISTORY ===== */
  .conv-layout { display: flex; height: 100%; gap: 0; }
  .conv-list-pane { width: 320px; border-right: 1px solid var(--border); display: flex; flex-direction: column; flex-shrink: 0; overflow: hidden; }
  .conv-list-header { padding: 14px 16px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 10px; }
  .conv-list-header .search-bar { margin-bottom: 0; }
  .conv-filter-row { display: flex; gap: 8px; align-items: center; }
  .conv-filter-row select { padding: 6px 10px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 12px; font-family: var(--font); }
  .conv-list-body { flex: 1; overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 2px; }
  .conv-item { padding: 12px 14px; border-radius: 8px; cursor: pointer; transition: all var(--transition); position: relative; }
  .conv-item:hover { background: var(--bg-hover); }
  .conv-item.active { background: var(--accent-bg); border-left: 3px solid var(--accent); }
  .conv-item-title { font-size: 13px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .conv-item-meta { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
  .conv-item-channel { font-size: 10px; padding: 2px 6px; border-radius: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
  .conv-item-channel.webchat { background: rgba(124,58,237,0.15); color: var(--accent); }
  .conv-item-channel.telegram { background: rgba(59,130,246,0.15); color: #3b82f6; }
  .conv-item-channel.discord { background: rgba(99,102,241,0.15); color: #6366f1; }
  .conv-item-channel.slack { background: rgba(16,185,129,0.15); color: var(--green); }
  .conv-item-channel.email { background: rgba(245,158,11,0.15); color: var(--yellow); }
  .conv-item-channel.whatsapp { background: rgba(34,197,94,0.15); color: #22c55e; }
  .conv-item-time { font-size: 11px; color: var(--text-faint); }
  .conv-item-count { font-size: 10px; color: var(--text-muted); margin-left: auto; }
  .conv-detail-pane { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
  .conv-detail-header { padding: 14px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
  .conv-detail-title { font-family: var(--display); font-weight: 700; font-size: 15px; }
  .conv-messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px; }
  .conv-msg { max-width: 75%; padding: 10px 14px; border-radius: var(--radius); font-size: 13px; line-height: 1.6; white-space: pre-wrap; }
  .conv-msg.user { align-self: flex-end; background: var(--accent); color: white; border-bottom-right-radius: 4px; }
  .conv-msg.assistant { align-self: flex-start; background: var(--bg-surface); border: 1px solid var(--border); border-bottom-left-radius: 4px; }
  .conv-msg-time { font-size: 10px; color: var(--text-faint); margin-top: 4px; }
  .conv-stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
  @media (max-width: 768px) {
    .conv-layout { flex-direction: column; }
    .conv-list-pane { width: 100%; max-height: 40vh; border-right: none; border-bottom: 1px solid var(--border); }
    .conv-stats-row { grid-template-columns: repeat(2, 1fr); }
  }

  /* ===== WEBHOOKS PANEL ===== */
  .webhook-card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 18px 20px; transition: all var(--transition); }
  .webhook-card:hover { border-color: rgba(124,58,237,0.25); }
  .webhook-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .webhook-card-name { font-family: var(--display); font-weight: 700; font-size: 15px; }
  .webhook-card-url { font-family: var(--mono); font-size: 11px; color: var(--text-muted); padding: 4px 8px; background: var(--bg); border-radius: 4px; cursor: pointer; display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .webhook-card-url:hover { color: var(--accent); }
  .webhook-card-stats { display: flex; gap: 16px; margin-top: 10px; font-size: 12px; color: var(--text-secondary); }
  .webhook-card-actions { display: flex; gap: 8px; margin-top: 12px; }
  .webhook-events-list { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
  .webhook-event-item { padding: 8px 12px; background: var(--bg); border-radius: 6px; font-size: 12px; display: flex; justify-content: space-between; align-items: center; }
  .webhook-event-payload { font-family: var(--mono); font-size: 11px; color: var(--text-muted); max-height: 100px; overflow-y: auto; white-space: pre-wrap; margin-top: 4px; padding: 8px; background: var(--bg); border-radius: 4px; }

  /* ===== VISUAL WORKFLOW BUILDER ===== */
  .vw-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
  .vw-card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 18px 20px; transition: all var(--transition); cursor: pointer; }
  .vw-card:hover { border-color: var(--accent-border); transform: translateY(-2px); box-shadow: var(--shadow-lg); }
  .vw-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
  .vw-card-name { font-family: var(--display); font-weight: 700; font-size: 14px; }
  .vw-trigger-badge { font-size: 10px; padding: 2px 8px; border-radius: 8px; font-weight: 600; text-transform: uppercase; }
  .vw-trigger-badge.cron { background: rgba(99,102,241,0.15); color: var(--indigo); }
  .vw-trigger-badge.webhook { background: rgba(245,158,11,0.15); color: var(--yellow); }
  .vw-trigger-badge.manual { background: rgba(124,58,237,0.15); color: var(--accent); }
  .vw-card-desc { font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; }
  .vw-card-meta { display: flex; gap: 12px; font-size: 11px; color: var(--text-muted); }
  .vw-builder-overlay { display: none; position: fixed; inset: 0; background: var(--bg); z-index: 250; flex-direction: column; }
  .vw-builder-overlay.visible { display: flex; }
  .vw-builder-topbar { padding: 12px 20px; background: var(--bg-raised); border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 16px; flex-shrink: 0; }
  .vw-builder-topbar input { padding: 8px 14px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: 14px; font-family: var(--display); font-weight: 600; outline: none; flex: 1; max-width: 300px; }
  .vw-builder-body { flex: 1; display: flex; overflow: hidden; }
  .vw-palette { width: 200px; background: var(--bg-raised); border-right: 1px solid var(--border); padding: 16px; overflow-y: auto; flex-shrink: 0; }
  .vw-palette-item { padding: 10px 12px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px; cursor: grab; font-size: 13px; color: var(--text-secondary); display: flex; align-items: center; gap: 8px; transition: all var(--transition); }
  .vw-palette-item:hover { border-color: var(--accent); color: var(--text); }
  .vw-palette-item .vw-block-icon { font-size: 16px; }
  .vw-canvas { flex: 1; overflow: auto; position: relative; background: var(--bg); background-image: radial-gradient(circle, var(--border) 1px, transparent 1px); background-size: 24px 24px; }
  .vw-canvas-inner { min-width: 100%; min-height: 100%; padding: 40px; position: relative; }
  .vw-block { position: relative; background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 14px 16px; min-width: 220px; margin-bottom: 16px; cursor: default; transition: border-color var(--transition); }
  .vw-block:hover { border-color: var(--accent-border); }
  .vw-block.selected { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(124,58,237,0.15); }
  .vw-block-type { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-faint); font-weight: 600; margin-bottom: 4px; }
  .vw-block-label { font-size: 13px; font-weight: 600; color: var(--text); }
  .vw-props-panel { width: 280px; background: var(--bg-raised); border-left: 1px solid var(--border); padding: 20px; overflow-y: auto; flex-shrink: 0; }
  .vw-props-title { font-family: var(--display); font-weight: 700; font-size: 14px; margin-bottom: 16px; }
  @media (max-width: 768px) {
    .vw-palette { display: none; }
    .vw-props-panel { width: 100%; position: absolute; bottom: 0; left: 0; right: 0; max-height: 40vh; border-left: none; border-top: 1px solid var(--border); }
  }

  /* ===== MCP MARKETPLACE ===== */
  .mcp-marketplace-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
  .mcp-server-card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 18px 20px; transition: all var(--transition); }
  .mcp-server-card:hover { border-color: var(--accent-border); transform: translateY(-1px); }
  .mcp-server-card-name { font-family: var(--display); font-weight: 700; font-size: 14px; margin-bottom: 4px; }
  .mcp-server-card-desc { font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .mcp-server-card-actions { display: flex; justify-content: space-between; align-items: center; }
  .mcp-installed-badge { font-size: 11px; color: var(--green); font-weight: 600; display: flex; align-items: center; gap: 4px; }

  /* ===== DIGEST SETTINGS ===== */
  .digest-preview-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 250; display: none; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
  .digest-preview-modal.visible { display: flex; }
  .digest-preview-content { background: white; border-radius: 12px; max-width: 700px; width: 90%; max-height: 80vh; overflow-y: auto; }
  .digest-preview-close { position: absolute; top: 16px; right: 16px; background: var(--bg-raised); border: 1px solid var(--border); border-radius: 8px; padding: 6px 12px; color: var(--text); cursor: pointer; z-index: 1; }
</style>
</head>
<body>

<div id="sidebar">
  <div class="sidebar-logo">
    <div class="logo-icon"></div>
    <span>Zubo</span>
  </div>
  <nav>
    <div class="sidebar-section">Agent</div>
    <a href="#agent" class="active" onclick="showPanel('agent')">
      <span class="nav-svg-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></span> Chat
    </a>
    <a href="#history" onclick="showPanel('history')">
      <span class="nav-svg-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span> History
    </a>
    <div class="sidebar-divider"></div>
    <div class="sidebar-section">Overview</div>
    <a href="#dashboard" onclick="showPanel('dashboard')">
      <span class="nav-svg-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></span> Dashboard
    </a>
    <a href="#memory" onclick="showPanel('memory')">
      <span class="nav-svg-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.5 2 6 4.5 6 7c0 1.5.5 2.8 1.4 3.8C6.5 12 6 13.5 6 15c0 3.5 2.5 7 6 7s6-3.5 6-7c0-1.5-.5-3-1.4-4.2C17.5 9.8 18 8.5 18 7c0-2.5-2.5-5-6-5z"/><path d="M9 10h6"/><path d="M9 14h6"/></svg></span> Knowledge
    </a>
    <a href="#skills" onclick="showPanel('skills')">
      <span class="nav-svg-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span> Skills
    </a>
    <a href="#workflows" onclick="showPanel('workflows')">
      <span class="nav-svg-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg></span> Workflows
    </a>
    <a href="#webhooks" onclick="showPanel('webhooks')">
      <span class="nav-svg-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 16.98h1.67c2.49 0 4.5-2.01 4.5-4.49 0-2.48-2.01-4.49-4.5-4.49h-.16C19.17 5.35 16.68 3 13.67 3 11.23 3 9.14 4.56 8.34 6.78c-.3-.05-.6-.08-.91-.08-2.76 0-5 2.24-5 5s2.24 5 5 5h1.48"/><polyline points="12 13 12 21"/><polyline points="9 18 12 21 15 18"/></svg></span> Webhooks
    </a>
    <a href="#mcp" onclick="showPanel('mcp')">
      <span class="nav-svg-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h4"/><path d="M14 12h4"/><circle cx="8" cy="12" r="1"/><circle cx="16" cy="12" r="1"/></svg></span> Extensions
    </a>
    <a href="#models" onclick="showPanel('models')">
      <span class="nav-svg-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></span> Models
    </a>
    <div class="sidebar-divider"></div>
    <div class="sidebar-section">Personal</div>
    <a href="#todos" onclick="showPanel('todos')">
      <span class="nav-svg-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></span> Todos
    </a>
    <a href="#notes" onclick="showPanel('notes')">
      <span class="nav-svg-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></span> Notes
    </a>
    <a href="#preferences" onclick="showPanel('preferences')">
      <span class="nav-svg-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span> Preferences
    </a>
    <a href="#topics" onclick="showPanel('topics')">
      <span class="nav-svg-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span> Topics
    </a>
    <a href="#followups" onclick="showPanel('followups')">
      <span class="nav-svg-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span> Follow-ups
    </a>
    <div class="sidebar-divider"></div>
    <div class="sidebar-section">Settings</div>
    <a href="#integrations" onclick="showPanel('integrations')">
      <span class="nav-svg-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v6m0 8v6"/><path d="M6 12H2"/><path d="M22 12h-4"/><circle cx="12" cy="12" r="4"/><path d="M12 8V2"/></svg></span> Integrations
    </a>
    <a href="#settings" onclick="showPanel('settings')">
      <span class="nav-svg-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg></span> Settings
    </a>
  </nav>
  <div class="sidebar-footer">
    <span class="footer-left"><span>Zubo</span><span class="conn-badge" id="sidebar-conn-badge"></span></span>
    <a href="https://zubo.bot/docs/" target="_blank" rel="noopener" class="docs-link"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>Docs</a>
  </div>
</div>

<div id="main">
  <div id="topbar">
    <button class="mobile-menu-btn" onclick="toggleMobileMenu()">&#9776;</button>
    <span id="topbar-title"><span class="topbar-breadcrumb">Dashboard &rsaquo; </span><span id="topbar-title-text">Agent</span></span>
    <span id="topbar-badge">Zubo</span>
  </div>
  <div id="content">

    <!-- AGENT CHAT PANEL -->
    <div id="panel-agent" class="panel active" style="position:relative;">
      <div style="display:flex;height:100%;">
        <div class="thread-bar" id="thread-bar">
          <div class="thread-bar-header">
            <span>Threads</span>
            <div style="display:flex;gap:6px;">
              <button class="new-thread-btn" onclick="createThread()">+ New</button>
              <button class="btn btn-ghost btn-sm" onclick="exportThread()" style="font-size:11px;" data-tooltip="Export as Markdown">Export</button>
            </div>
          </div>
          <div class="thread-list" id="thread-list"></div>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;position:relative;min-width:0;">
          <div class="drop-overlay" id="drop-overlay">Drop file to upload</div>
          <div id="chat-messages">
            <div class="chat-welcome-mesh"></div>
            <div class="chat-empty chat-welcome">
              <div class="chat-welcome-sparkle"><svg width="72" height="72" viewBox="0 0 100 100" fill="none"><path d="M50 8C52.5 35 65 47.5 92 50C65 52.5 52.5 65 50 92C47.5 65 35 52.5 8 50C35 47.5 47.5 35 50 8Z" fill="url(#sparkleGrad)" opacity="0.9"/><defs><linearGradient id="sparkleGrad" x1="8" y1="8" x2="92" y2="92"><stop offset="0%" stop-color="#7c3aed"/><stop offset="100%" stop-color="#d946ef"/></linearGradient></defs></svg></div>
              <h3 class="gradient-text" id="chat-greeting">What can I help you with?</h3>
              <div class="chat-empty-text">Ask me anything, or try a suggestion below</div>
              <div class="suggestion-chips-group">
                <div class="chip-row">
                  <button class="suggestion-chip" onclick="useSuggestion(this)">What can you do?</button>
                  <button class="suggestion-chip" onclick="useSuggestion(this)">Set a reminder for tomorrow</button>
                </div>
                <div class="chip-row">
                  <button class="suggestion-chip" onclick="useSuggestion(this)">Help me write an email</button>
                  <button class="suggestion-chip" onclick="useSuggestion(this)">Explain something to me</button>
                </div>
              </div>
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
      </div>
    </div>

    <!-- DASHBOARD PANEL (merged Status + Analytics) -->
    <div id="panel-dashboard" class="panel">
      <div class="panel-body">
        <div class="tab-bar" id="dashboard-tabs">
          <button class="tab active" onclick="switchTab('dashboard','overview')">Overview</button>
          <button class="tab" onclick="switchTab('dashboard','analytics')">Analytics</button>
          <button class="tab" onclick="switchTab('dashboard','performance')">Performance</button>
        </div>

        <!-- Overview Tab -->
        <div class="tab-content active" id="dashboard-tab-overview">
          <div class="cards" id="status-cards"></div>
          <div class="quick-actions" id="quick-actions">
            <div class="quick-action" onclick="showPanel('agent')">
              <div class="qa-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></div>
              <div class="qa-label">Chat</div>
              <div class="qa-desc">Start a conversation</div>
            </div>
            <div class="quick-action" onclick="showPanel('skills')">
              <div class="qa-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div>
              <div class="qa-label">Skills</div>
              <div class="qa-desc">View installed skills</div>
            </div>
            <div class="quick-action" onclick="showPanel('integrations')">
              <div class="qa-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v6m0 8v6"/><path d="M6 12H2"/><path d="M22 12h-4"/><circle cx="12" cy="12" r="4"/></svg></div>
              <div class="qa-label">Integrations</div>
              <div class="qa-desc">Connect services</div>
            </div>
            <div class="quick-action" onclick="showPanel('workflows')">
              <div class="qa-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg></div>
              <div class="qa-label">Workflows</div>
              <div class="qa-desc">Multi-agent pipelines</div>
            </div>
          </div>
        </div>

        <!-- Analytics Tab -->
        <div class="tab-content" id="dashboard-tab-analytics">
          <div class="cards" id="analytics-summary"></div>
          <div class="memory-section-title" style="margin-top:28px;">Token Usage (Last 7 Days)</div>
          <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;">
            <div class="bar-chart" id="usage-chart"></div>
          </div>
          <div class="memory-section-title" style="margin-top:28px;">Cost Breakdown by Model</div>
          <table id="cost-table">
            <thead><tr><th>Provider</th><th>Model</th><th>Tokens</th><th>Cost</th><th style="width:30%;">Share</th></tr></thead>
            <tbody id="cost-body"></tbody>
          </table>
          <div class="memory-section-title" style="margin-top:28px;">Top Models</div>
          <table id="top-models-table">
            <thead><tr><th>Model</th><th>Requests</th><th>Tokens</th><th>Cost</th><th>Avg Response</th></tr></thead>
            <tbody id="top-models-body"></tbody>
          </table>
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

        <!-- Performance Tab -->
        <div class="tab-content" id="dashboard-tab-performance">
          <div class="memory-section-title">System Health</div>
          <div class="perf-grid" id="perf-health"></div>
          <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-top:14px;">
            <div style="font-size:11px;color:var(--text-faint);margin-bottom:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">RSS Memory (7 Days)</div>
            <div class="bar-chart" id="rss-chart"></div>
          </div>
          <div class="memory-section-title" style="margin-top:28px;">Response Time Trend (7 Days)</div>
          <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;">
            <div class="bar-chart" id="response-chart"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- MEMORY PANEL -->
    <div id="panel-memory" class="panel">
      <div class="panel-body">
        <div style="margin-bottom:20px;">
          <p class="settings-desc" style="margin-bottom:0;">Everything Zubo remembers about you and your conversations. Edit the persistent memory file directly, or search through individual memory chunks below.</p>
        </div>
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

    <!-- SKILLS PANEL (with Browse/Registry tab) -->
    <div id="panel-skills" class="panel">
      <div class="panel-body">
        <div style="margin-bottom:16px;">
          <p class="settings-desc" style="margin-bottom:0;">Skills are custom capabilities you can add to Zubo. Browse the community registry to install new ones, or build your own in TypeScript.</p>
        </div>
        <div class="tab-bar" id="skills-tabs">
          <button class="tab active" onclick="switchTab('skills','installed')">Installed</button>
          <button class="tab" onclick="switchTab('skills','browse')">Browse Registry</button>
        </div>

        <div class="tab-content active" id="skills-tab-installed">
          <table>
            <thead><tr><th>Name</th><th>Description</th><th>Status</th></tr></thead>
            <tbody id="skills-body"></tbody>
          </table>
          <div id="skills-empty" class="empty-state-card" style="display:none;">
            <div class="empty-icon"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div>
            <h4>No skills installed yet</h4>
            <p>Browse the registry to add capabilities to your agent.</p>
            <button class="btn btn-primary" onclick="switchTab('skills','browse')">Browse Registry</button>
          </div>
        </div>

        <div class="tab-content" id="skills-tab-browse">
          <div class="search-bar">
            <input id="registry-search" type="text" placeholder="Search skills (e.g. email, calendar, weather...)">
            <button class="btn btn-primary" onclick="searchRegistry()">Search</button>
          </div>
          <div id="registry-results" style="display:flex;flex-direction:column;gap:10px;">
            <div class="empty-state-card">
              <div class="empty-icon"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
              <h4>Discover new skills</h4>
              <p>Search the registry to find and install capabilities.</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- HISTORY PANEL -->
    <div id="panel-history" class="panel">
      <div class="panel-body" style="padding:0;height:100%;">
        <div style="padding:16px 20px 0;">
          <div class="conv-stats-row" id="conv-stats-row"></div>
        </div>
        <div class="conv-layout" style="flex:1;min-height:0;">
          <div class="conv-list-pane">
            <div class="conv-list-header">
              <div class="search-bar" style="margin-bottom:0;">
                <input id="conv-search" type="text" placeholder="Search conversations..." onkeydown="if(event.key==='Enter')searchConversations()">
                <button class="btn btn-primary btn-sm" onclick="searchConversations()">Search</button>
              </div>
              <div class="conv-filter-row">
                <select id="conv-channel-filter" onchange="loadConversations()">
                  <option value="">All Channels</option>
                  <option value="webchat">Webchat</option>
                  <option value="telegram">Telegram</option>
                  <option value="discord">Discord</option>
                  <option value="slack">Slack</option>
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </div>
            </div>
            <div class="conv-list-body" id="conv-list"></div>
          </div>
          <div class="conv-detail-pane">
            <div class="conv-detail-header" id="conv-detail-header" style="display:none;">
              <span class="conv-detail-title" id="conv-detail-title"></span>
              <div style="display:flex;gap:8px;">
                <button class="btn btn-ghost btn-sm" onclick="exportConversation()">Export</button>
                <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteConversation()">Delete</button>
              </div>
            </div>
            <div class="conv-messages" id="conv-messages">
              <div class="empty-state-card">
                <div class="empty-icon"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                <h4>Select a conversation</h4>
                <p>Browse your conversation history across all channels.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- WORKFLOWS PANEL -->
    <div id="panel-workflows" class="panel">
      <div class="panel-body">
        <div style="margin-bottom:16px;">
          <p class="settings-desc" style="margin-bottom:0;">Automate multi-step tasks by chaining actions together. Use pre-built recipes, ask Zubo to create one in chat, or build visually with drag-and-drop.</p>
        </div>
        <div class="tab-bar" id="workflows-tabs">
          <button class="tab active" onclick="switchTab('workflows','recipes')">Recipes</button>
          <button class="tab" onclick="switchTab('workflows','custom')">Custom Workflows</button>
          <button class="tab" onclick="switchTab('workflows','visual')">Visual Builder</button>
        </div>

        <div class="tab-content active" id="workflows-tab-recipes">
          <div class="memory-section-title">
            <span>Workflow Recipes</span>
            <span class="badge" id="recipe-count"></span>
          </div>
          <p class="settings-desc" style="margin-bottom:16px;">Pre-built automations you can activate with one click.</p>
          <div id="recipes-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;"></div>
        </div>

        <div class="tab-content" id="workflows-tab-custom">
          <div class="editor-toolbar">
            <button class="btn btn-ghost" onclick="loadWorkflows()">Refresh</button>
            <span id="workflows-status" class="status-text"></span>
          </div>
          <div id="workflows-list" style="display:flex;flex-direction:column;gap:14px;"></div>
          <div id="workflows-empty" class="empty-state-card" style="display:none;">
            <div class="empty-icon"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg></div>
            <h4>No custom workflows yet</h4>
            <p>Ask Zubo to create a workflow in chat, or activate a recipe above.</p>
          </div>
        </div>

        <div class="tab-content" id="workflows-tab-visual">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div>
              <h3 style="font-family:var(--display);font-weight:700;margin-bottom:4px;">Visual Workflows</h3>
              <p class="settings-desc" style="margin-bottom:0;">Drag-and-drop workflow builder with triggers, conditions, and actions.</p>
            </div>
            <button class="btn btn-primary" onclick="openVisualBuilder()">+ New Workflow</button>
          </div>
          <div class="vw-list" id="vw-list"></div>
          <div id="vw-empty" class="empty-state-card" style="display:none;">
            <div class="empty-icon"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg></div>
            <h4>No visual workflows yet</h4>
            <p>Create automated workflows with a visual drag-and-drop builder.</p>
            <button class="btn btn-primary" onclick="openVisualBuilder()">Create Workflow</button>
          </div>
        </div>
      </div>
    </div>

    <!-- WEBHOOKS PANEL -->
    <div id="panel-webhooks" class="panel">
      <div class="panel-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <div>
            <h3 style="font-family:var(--display);font-weight:700;margin-bottom:4px;">Webhooks</h3>
            <p class="settings-desc" style="margin-bottom:0;">Receive events from external services and trigger your agent automatically.</p>
          </div>
          <button class="btn btn-primary" onclick="showCreateWebhookForm()">+ New Webhook</button>
        </div>

        <div id="webhook-create-form" style="display:none;margin-bottom:20px;">
          <div class="settings-section">
            <h3 class="settings-title">Create Webhook</h3>
            <div class="settings-grid">
              <div class="settings-field">
                <label class="settings-label" for="wh-name">Name</label>
                <input id="wh-name" type="text" class="settings-input" placeholder="e.g. github-push">
              </div>
              <div class="settings-field">
                <label class="settings-label" for="wh-desc">Description</label>
                <input id="wh-desc" type="text" class="settings-input" placeholder="e.g. Triggered on GitHub push events">
              </div>
              <div class="settings-field">
                <label class="settings-label" for="wh-secret">HMAC Secret (optional)</label>
                <input id="wh-secret" type="text" class="settings-input" placeholder="Leave empty for no signature verification">
              </div>
              <div class="settings-field">
                <label class="settings-label" for="wh-prompt">Prompt Template (optional)</label>
                <textarea id="wh-prompt" class="settings-input" rows="3" style="resize:vertical;font-family:var(--mono);font-size:12px;" placeholder="Analyze this webhook payload: {{payload}}"></textarea>
              </div>
            </div>
            <div style="margin-top:12px;display:flex;gap:10px;">
              <button class="btn btn-primary" onclick="createWebhook()">Create</button>
              <button class="btn btn-ghost" onclick="hideCreateWebhookForm()">Cancel</button>
            </div>
          </div>
        </div>

        <div id="webhooks-list" style="display:flex;flex-direction:column;gap:14px;"></div>
        <div id="webhooks-empty" class="empty-state-card" style="display:none;">
          <div class="empty-icon"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M18 16.98h1.67c2.49 0 4.5-2.01 4.5-4.49 0-2.48-2.01-4.49-4.5-4.49h-.16C19.17 5.35 16.68 3 13.67 3 11.23 3 9.14 4.56 8.34 6.78c-.3-.05-.6-.08-.91-.08-2.76 0-5 2.24-5 5s2.24 5 5 5h1.48"/><polyline points="12 13 12 21"/><polyline points="9 18 12 21 15 18"/></svg></div>
          <h4>No webhooks configured</h4>
          <p>Create a webhook to receive events from GitHub, Stripe, or any external service.</p>
          <button class="btn btn-primary" onclick="showCreateWebhookForm()">Create Webhook</button>
        </div>
      </div>
    </div>

    <!-- MCP MARKETPLACE PANEL -->
    <div id="panel-mcp" class="panel">
      <div class="panel-body">
        <div style="margin-bottom:16px;">
          <p class="settings-desc" style="margin-bottom:0;">Extensions use the <strong>MCP (Model Context Protocol)</strong> standard to give Zubo new tools — like accessing files, databases, GitHub, and more. Browse the marketplace or add your own.</p>
        </div>
        <div class="tab-bar" id="mcp-tabs">
          <button class="tab active" onclick="switchTab('mcp','installed')">Installed</button>
          <button class="tab" onclick="switchTab('mcp','marketplace')">Marketplace</button>
        </div>

        <div class="tab-content active" id="mcp-tab-installed">
          <div id="mcp-installed-list" style="display:flex;flex-direction:column;gap:12px;"></div>
          <div id="mcp-installed-empty" class="empty-state-card" style="display:none;">
            <div class="empty-icon"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h4"/><path d="M14 12h4"/></svg></div>
            <h4>No extensions installed</h4>
            <p>Browse the marketplace to add powerful extensions.</p>
            <button class="btn btn-primary" onclick="switchTab('mcp','marketplace')">Browse Marketplace</button>
          </div>
        </div>

        <div class="tab-content" id="mcp-tab-marketplace">
          <div class="search-bar">
            <input id="mcp-marketplace-search" type="text" placeholder="Search extensions (e.g. filesystem, github, database...)" onkeydown="if(event.key==='Enter')searchMcpMarketplace()">
            <button class="btn btn-primary" onclick="searchMcpMarketplace()">Search</button>
          </div>
          <div class="mcp-marketplace-grid" id="mcp-marketplace-results"></div>
          <div id="mcp-marketplace-empty" class="empty-state-card">
            <div class="empty-icon"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
            <h4>Discover Extensions</h4>
            <p>Search the marketplace to find and install extensions.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- MODELS PANEL (Ollama / Local Model Manager) -->
    <div id="panel-models" class="panel">
      <div class="panel-body">
        <div style="margin-bottom:16px;">
          <p class="settings-desc" style="margin-bottom:0;">Manage local AI models via <strong>Ollama</strong>. Install, update, and remove models running on your machine.</p>
        </div>

        <div id="ollama-status-bar" style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding:10px 14px;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);">
          <span class="status-dot" id="ollama-status-dot"></span>
          <span id="ollama-status-text" style="font-size:13px;color:var(--text-secondary);">Checking Ollama...</span>
          <span style="margin-left:auto;font-size:12px;color:var(--text-muted);" id="ollama-version"></span>
        </div>

        <div class="tab-bar" id="models-tabs">
          <button class="tab active" onclick="switchTab('models','installed')">Installed</button>
          <button class="tab" onclick="switchTab('models','available')">Pull New Model</button>
        </div>

        <div class="tab-content active" id="models-tab-installed">
          <div id="ollama-models-list" style="display:flex;flex-direction:column;gap:10px;"></div>
          <div id="ollama-models-empty" class="empty-state-card" style="display:none;">
            <div class="empty-icon"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div>
            <h4>No models installed</h4>
            <p>Pull a model from the "Pull New Model" tab to get started.</p>
            <button class="btn btn-primary" onclick="switchTab('models','available')">Pull a Model</button>
          </div>
        </div>

        <div class="tab-content" id="models-tab-available">
          <div style="margin-bottom:16px;">
            <div class="search-bar">
              <input id="ollama-pull-input" type="text" placeholder="Model name (e.g. llama3, mistral, codellama, qwen2.5-coder:32b)" style="flex:1;">
              <button class="btn btn-primary" onclick="pullOllamaModel()" id="ollama-pull-btn">Pull</button>
            </div>
          </div>
          <div id="ollama-pull-progress" style="display:none;padding:12px 16px;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span id="ollama-pull-status" style="font-size:13px;font-weight:500;">Pulling...</span>
              <span id="ollama-pull-pct" style="font-size:12px;color:var(--text-muted);"></span>
            </div>
            <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden;">
              <div id="ollama-pull-bar" style="height:100%;background:var(--accent);border-radius:3px;transition:width 200ms;width:0%;"></div>
            </div>
          </div>
          <div style="margin-top:12px;">
            <p class="settings-desc" style="margin-bottom:8px;"><strong>Popular models:</strong></p>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">
              <button class="btn btn-ghost btn-sm" onclick="document.getElementById('ollama-pull-input').value='llama3.3'">llama3.3</button>
              <button class="btn btn-ghost btn-sm" onclick="document.getElementById('ollama-pull-input').value='mistral'">mistral</button>
              <button class="btn btn-ghost btn-sm" onclick="document.getElementById('ollama-pull-input').value='qwen2.5-coder:32b'">qwen2.5-coder:32b</button>
              <button class="btn btn-ghost btn-sm" onclick="document.getElementById('ollama-pull-input').value='deepseek-r1:14b'">deepseek-r1:14b</button>
              <button class="btn btn-ghost btn-sm" onclick="document.getElementById('ollama-pull-input').value='codellama'">codellama</button>
              <button class="btn btn-ghost btn-sm" onclick="document.getElementById('ollama-pull-input').value='gemma2'">gemma2</button>
              <button class="btn btn-ghost btn-sm" onclick="document.getElementById('ollama-pull-input').value='phi3'">phi3</button>
              <button class="btn btn-ghost btn-sm" onclick="document.getElementById('ollama-pull-input').value='nomic-embed-text'">nomic-embed-text</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- INTEGRATIONS PANEL -->
    <div id="panel-integrations" class="panel">
      <div class="panel-body">
        <div style="margin-bottom:20px;">
          <h3 style="font-family:var(--display);font-weight:700;margin-bottom:4px;">OAuth Integrations</h3>
          <p class="settings-desc">Connect third-party services via OAuth. Zubo will securely store tokens and automatically refresh them.</p>
        </div>

        <div id="oauth-connections-list" style="display:flex;flex-direction:column;gap:12px;"></div>

        <div class="settings-section" style="margin-top:24px;">
          <h3 class="settings-title">Configure Provider</h3>
          <p class="settings-desc">Add OAuth credentials for a provider. You can get these from each provider's developer console.</p>
          <div class="settings-grid">
            <div class="settings-field">
              <label class="settings-label" for="oauth-provider-select">Provider</label>
              <select id="oauth-provider-select" class="settings-select" onchange="onOAuthProviderSelect()">
                <option value="">-- Select a provider --</option>
                <option value="google">Google (Calendar, Gmail, Drive, Docs, Sheets)</option>
                <option value="github">GitHub (Issues, PRs, Repos)</option>
                <option value="notion">Notion (Pages, Databases)</option>
                <option value="linear">Linear (Issues, Projects)</option>
                <option value="slack">Slack (Messages, Channels)</option>
              </select>
            </div>
            <div class="settings-field">
              <label class="settings-label" for="oauth-client-id">Client ID</label>
              <input id="oauth-client-id" type="text" class="settings-input" placeholder="e.g. 123456789.apps.googleusercontent.com">
            </div>
            <div class="settings-field">
              <label class="settings-label" for="oauth-client-secret">Client Secret</label>
              <input id="oauth-client-secret" type="password" class="settings-input" placeholder="Your client secret">
            </div>
          </div>
          <div style="margin-top: 16px; display: flex; gap: 10px; align-items: center;">
            <button class="btn btn-primary" onclick="saveOAuthConfig()">Save Credentials</button>
            <button class="btn btn-ghost" onclick="removeOAuthConfig()" id="oauth-remove-btn" style="display:none;color:var(--red);">Remove</button>
            <span id="oauth-config-status" class="status-text"></span>
          </div>
        </div>

        <div class="settings-section" style="margin-top:16px;">
          <details style="cursor:pointer;">
            <summary style="font-size:13px;font-weight:600;color:var(--text-secondary);user-select:none;">Where do I get OAuth credentials?</summary>
            <div style="margin-top:12px;">
              <p class="settings-desc" style="margin-bottom:8px;"><strong>Google:</strong> <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener" style="color:var(--accent);">Google Cloud Console</a> &rarr; Create OAuth 2.0 Client ID. Add <code>http://localhost:PORT/oauth/google/callback</code> as a redirect URI.</p>
              <p class="settings-desc" style="margin-bottom:8px;"><strong>GitHub:</strong> <a href="https://github.com/settings/developers" target="_blank" rel="noopener" style="color:var(--accent);">GitHub Developer Settings</a> &rarr; New OAuth App. Callback: <code>http://localhost:PORT/oauth/github/callback</code></p>
              <p class="settings-desc" style="margin-bottom:8px;"><strong>Notion:</strong> <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener" style="color:var(--accent);">Notion Integrations</a> &rarr; Create integration with OAuth.</p>
              <p class="settings-desc" style="margin-bottom:8px;"><strong>Linear:</strong> <a href="https://linear.app/settings/api" target="_blank" rel="noopener" style="color:var(--accent);">Linear API Settings</a> &rarr; Create OAuth application.</p>
              <p class="settings-desc"><strong>Slack:</strong> <a href="https://api.slack.com/apps" target="_blank" rel="noopener" style="color:var(--accent);">Slack API Apps</a> &rarr; Create App &rarr; OAuth &amp; Permissions.</p>
            </div>
          </details>
        </div>
      </div>
    </div>

    <!-- SETTINGS PANEL (unified with tabs) -->
    <div id="panel-settings" class="panel">
      <div class="panel-body">
        <div class="tab-bar" id="settings-tabs">
          <button class="tab active" onclick="switchTab('settings','general')">General</button>
          <button class="tab" onclick="switchTab('settings','providers')">Providers</button>
          <button class="tab" onclick="switchTab('settings','channels')">Channels</button>
          <button class="tab" onclick="switchTab('settings','mcp')">Extensions</button>
          <button class="tab" onclick="switchTab('settings','routing')">Cost Savings</button>
          <button class="tab" onclick="switchTab('settings','data')">Data</button>
          <button class="tab" onclick="switchTab('settings','secrets')">API Keys</button>
          <button class="tab" onclick="switchTab('settings','system')">Personality</button>
          <button class="tab" onclick="switchTab('settings','cron')">Scheduled Tasks</button>
          <button class="tab" onclick="switchTab('settings','logs')">Logs</button>
          <button class="tab" onclick="switchTab('settings','privacy')">Privacy</button>
          <button class="tab" onclick="switchTab('settings','budget')">Budget</button>
          <button class="tab" onclick="switchTab('settings','digests')">Email Digests</button>
        </div>

        <!-- General Tab -->
        <div class="tab-content active" id="settings-tab-general">
          <div class="settings-section">
            <h3 class="settings-title" data-tooltip="Choose which AI powers your agent">AI Model</h3>
            <p class="settings-desc">Choose which AI service and model your agent uses for conversations.</p>
            <div class="settings-grid">
              <div class="settings-field">
                <label class="settings-label" data-tooltip="AI service (e.g. Anthropic, OpenAI)" for="settings-provider">Provider</label>
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
            <h3 class="settings-title" data-tooltip="How often Zubo checks for tasks">Background Check Interval</h3>
            <p class="settings-desc">How often Zubo checks for reminders, scheduled tasks, and updates. Default: every 30 minutes.</p>
            <div class="settings-grid">
              <div class="settings-field">
                <label class="settings-label" data-tooltip="Minutes between checks" for="settings-heartbeat">Interval (minutes)</label>
                <input id="settings-heartbeat" type="number" class="settings-input" min="1" max="1440" step="1" placeholder="30">
              </div>
            </div>
            <div style="margin-top: 16px; display: flex; gap: 10px; align-items: center;">
              <button class="btn btn-primary" onclick="saveHeartbeat()">Save</button>
              <span id="heartbeat-status" class="status-text"></span>
            </div>
          </div>

          <div class="settings-section">
            <h3 class="settings-title">Memory in Replies</h3>
            <p class="settings-desc">Choose how much past context Zubo pulls into each reply.</p>
            <div class="settings-grid">
              <div class="settings-field">
                <label class="settings-label" for="memory-context-topk">Memories per reply</label>
                <input id="memory-context-topk" type="number" class="settings-input" min="1" max="10" step="1" placeholder="3">
              </div>
              <div class="settings-field">
                <label class="settings-label" for="memory-min-confidence">Minimum relevance (0-1)</label>
                <input id="memory-min-confidence" type="number" class="settings-input" min="0" max="1" step="0.05" placeholder="0">
              </div>
            </div>
            <div style="margin-top: 16px; display: flex; gap: 10px; align-items: center;">
              <button class="btn btn-primary" onclick="saveMemoryRetrievalSettings()">Save</button>
              <button class="btn btn-ghost" onclick="applyMemoryPreset('balanced')">Balanced</button>
              <button class="btn btn-ghost" onclick="applyMemoryPreset('strict')">Strict</button>
              <span id="memory-retrieval-status" class="status-text"></span>
            </div>
            <p class="settings-desc" style="margin-top:10px;margin-bottom:0;">Recommended for most users: <code>3-5</code> memories and <code>0.2-0.35</code> relevance.</p>
          </div>

          <div class="settings-section">
            <h3 class="settings-title">Action Safety</h3>
            <p class="settings-desc">Control which kinds of actions Zubo can run, and whether risky actions should start in preview mode.</p>
            <div class="settings-grid">
              <div class="settings-field">
                <label class="settings-label" for="tool-scopes-allowed">Allowed actions (comma-separated)</label>
                <input id="tool-scopes-allowed" type="text" class="settings-input" placeholder="memory,network_read,filesystem_read">
              </div>
              <div class="settings-field">
                <label class="settings-label" for="tool-scopes-dry-run">Preview mode by default</label>
                <select id="tool-scopes-dry-run" class="settings-select">
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
            </div>
            <div style="margin-top: 16px; display: flex; gap: 10px; align-items: center;">
              <button class="btn btn-primary" onclick="saveToolScopeSettings()">Save</button>
              <button class="btn btn-ghost" onclick="applyToolScopePreset('safe')">Safe</button>
              <button class="btn btn-ghost" onclick="applyToolScopePreset('balanced')">Balanced</button>
              <span id="tool-scopes-status" class="status-text"></span>
            </div>
            <p class="settings-desc" style="margin-top:10px;margin-bottom:0;">Leave blank to allow all actions. Use presets if you want safer defaults.</p>
          </div>

          <div class="settings-section">
            <h3 class="settings-title">Configuration</h3>
            <p class="settings-desc">Manage your full config by editing <code>~/.zubo/config.json</code> directly, or re-run <code>zubo setup</code>.</p>
          </div>
        </div>

        <!-- Providers Tab -->
        <div class="tab-content" id="settings-tab-providers">
          <div class="settings-section">
            <h3 class="settings-title">AI Providers</h3>
            <p class="settings-desc">Configure AI services. Set one as active for your agent to use.</p>
            <div id="providers-list" style="display:flex;flex-direction:column;gap:12px;"></div>
            <div style="margin-top:20px;">
              <button class="btn btn-primary" onclick="showAddProviderForm()">Add Provider</button>
            </div>
            <div id="provider-add-form" style="display:none;margin-top:16px;padding:16px;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);">
              <h4 style="margin-bottom:12px;font-family:var(--display);font-weight:600;">Add Provider</h4>
              <div class="settings-grid">
                <div class="settings-field">
                  <label class="settings-label" for="new-provider-name">Provider</label>
                  <select id="new-provider-name" class="settings-select" onchange="onNewProviderSelect()">
                    <option value="">-- Select a provider --</option>
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="openai">OpenAI (GPT)</option>
                    <option value="groq">Groq (fast, free tier)</option>
                    <option value="together">Together AI</option>
                    <option value="openrouter">OpenRouter (many models)</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="xai">xAI (Grok)</option>
                    <option value="ollama">Ollama (free, runs locally)</option>
                    <option value="lmstudio">LM Studio (free, runs locally)</option>
                    <option value="custom">Custom (advanced)</option>
                  </select>
                </div>
                <div class="settings-field">
                  <label class="settings-label" for="new-provider-key">API Key</label>
                  <input id="new-provider-key" type="password" class="settings-input" placeholder="sk-...">
                  <span id="provider-key-help" class="settings-hint" style="font-size:11px;color:var(--text-faint);margin-top:4px;display:none;"></span>
                </div>
                <div class="settings-field">
                  <label class="settings-label" for="new-provider-model">Model</label>
                  <input id="new-provider-model" type="text" class="settings-input" placeholder="e.g. claude-sonnet-4-5-20250929">
                </div>
                <div class="settings-field" id="new-provider-url-field" style="display:none;">
                  <label class="settings-label" for="new-provider-url">Base URL</label>
                  <input id="new-provider-url" type="text" class="settings-input" placeholder="https://...">
                </div>
              </div>
              <div style="margin-top:12px;display:flex;gap:10px;">
                <button class="btn btn-primary" onclick="saveNewProvider()">Save Provider</button>
                <button class="btn btn-ghost" onclick="hideAddProviderForm()">Cancel</button>
              </div>
            </div>
            <div class="settings-section" style="margin-top:24px;">
              <h3 class="settings-title">Failover Order</h3>
              <p class="settings-desc">When the active provider fails, Zubo will try these in order.</p>
              <div id="failover-list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;"></div>
              <button class="btn btn-ghost" onclick="saveFailover()">Save Failover Order</button>
              <span id="failover-status" class="status-text" style="margin-left:10px;"></span>
            </div>
          </div>
        </div>

        <!-- Channels Tab -->
        <div class="tab-content" id="settings-tab-channels">
          <div class="settings-section">
            <h3 class="settings-title" data-tooltip="Connected messaging channels">Channels
              <span id="channel-count-badge" class="conn-badge" style="font-size:10px;"></span>
            </h3>
            <p class="settings-desc">Configure and manage messaging channels. Toggle channels on/off with immediate effect.</p>
            <div id="channel-status-list" style="display:flex;flex-direction:column;gap:8px;"></div>
            <div id="channel-config-form" style="display:none;margin-top:16px;padding:16px;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);">
              <h4 id="channel-config-title" style="margin-bottom:12px;font-family:var(--display);font-weight:600;"></h4>
              <div id="channel-config-fields" class="settings-grid"></div>
              <div style="margin-top:12px;display:flex;gap:10px;">
                <button class="btn btn-primary" onclick="saveChannelConfig()">Save &amp; Apply</button>
                <button class="btn btn-ghost" onclick="hideChannelConfig()">Cancel</button>
                <span id="channel-config-status" class="status-text"></span>
              </div>
            </div>
          </div>
        </div>

        <!-- MCP Tab -->
        <div class="tab-content" id="settings-tab-mcp">
          <div class="settings-section">
            <h3 class="settings-title">Extensions</h3>
            <p class="settings-desc">Extensions give Zubo new abilities like accessing files, databases, and APIs. Install from the marketplace or add manually.</p>
            <div id="mcp-servers-list" style="display:flex;flex-direction:column;gap:12px;"></div>
            <div style="margin-top:20px;">
              <button class="btn btn-primary" onclick="showAddMcpForm()">Add Extension</button>
            </div>
            <div id="mcp-add-form" style="display:none;margin-top:16px;padding:16px;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);">
              <h4 style="margin-bottom:12px;font-family:var(--display);font-weight:600;">Add Extension</h4>
              <div class="settings-grid">
                <div class="settings-field">
                  <label class="settings-label" for="mcp-name">Name</label>
                  <input id="mcp-name" type="text" class="settings-input" placeholder="e.g. filesystem">
                </div>
                <div class="settings-field">
                  <label class="settings-label" for="mcp-command">Command</label>
                  <input id="mcp-command" type="text" class="settings-input" placeholder="e.g. npx or python">
                </div>
                <div class="settings-field">
                  <label class="settings-label" for="mcp-args">Arguments (comma-separated)</label>
                  <input id="mcp-args" type="text" class="settings-input" placeholder="e.g. -m, mcp_server, .">
                </div>
                <div class="settings-field">
                  <label class="settings-label" for="mcp-env">Environment (KEY=value, one per line)</label>
                  <textarea id="mcp-env" class="settings-input" rows="3" style="resize:vertical;font-family:var(--mono);font-size:12px;" placeholder="API_KEY=xxx\nDEBUG=1"></textarea>
                </div>
              </div>
              <div style="margin-top:12px;display:flex;gap:10px;">
                <button class="btn btn-primary" onclick="saveNewMcpServer()">Add &amp; Connect</button>
                <button class="btn btn-ghost" onclick="hideAddMcpForm()">Cancel</button>
                <span id="mcp-add-status" class="status-text"></span>
              </div>
            </div>
          </div>
        </div>

        <!-- Routing Tab -->
        <div class="tab-content" id="settings-tab-routing">
          <div class="settings-section">
            <h3 class="settings-title" data-tooltip="Use a cheaper AI for simple questions">Smart Cost Savings</h3>
            <p class="settings-desc">Use a cheaper, faster AI for simple questions and your main AI for complex ones. Saves money without sacrificing quality.</p>
            <div class="settings-grid">
              <div class="settings-field">
                <label class="settings-label" for="sr-enabled">Enabled</label>
                <select id="sr-enabled" class="settings-select">
                  <option value="false">Disabled</option>
                  <option value="true">Enabled</option>
                </select>
              </div>
              <div class="settings-field">
                <label class="settings-label" for="sr-fast-provider">Fast Provider</label>
                <select id="sr-fast-provider" class="settings-select"></select>
              </div>
              <div class="settings-field">
                <label class="settings-label" for="sr-fast-model">Fast Model</label>
                <input id="sr-fast-model" type="text" class="settings-input" placeholder="e.g. gpt-4.1-mini">
              </div>
            </div>
            <div style="margin-top: 16px; display: flex; gap: 10px; align-items: center;">
              <button class="btn btn-primary" onclick="saveSmartRouting()">Save</button>
              <span id="sr-status" class="status-text"></span>
            </div>
          </div>
        </div>

        <!-- Data Tab -->
        <div class="tab-content" id="settings-tab-data">
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
        </div>

        <!-- Secrets Tab -->
        <div class="tab-content" id="settings-tab-secrets">
          <div class="settings-section" style="max-width:700px;">
            <h3 class="settings-title">API Keys &amp; Credentials</h3>
            <p class="settings-desc">Manage API keys for integrations. Your keys are encrypted and stored securely on your device — Zubo never sends them anywhere.</p>
            <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
              <button class="btn btn-primary" onclick="showAddSecretForm()">Add Secret</button>
              <button class="btn btn-ghost" onclick="loadSecrets()">Refresh</button>
            </div>
            <div id="secret-add-form" style="display:none;margin-bottom:16px;padding:16px;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);">
              <div style="display:flex;flex-direction:column;gap:12px;">
                <div class="settings-field">
                  <label class="settings-label" for="secret-name-input">Name</label>
                  <input id="secret-name-input" type="text" class="settings-input" placeholder="e.g. github_token" pattern="[a-z0-9_]+" style="max-width:260px;">
                </div>
                <div class="settings-field">
                  <label class="settings-label" for="secret-value-input">Value</label>
                  <input id="secret-value-input" type="password" class="settings-input" placeholder="API key or token">
                </div>
                <div class="settings-field">
                  <label class="settings-label" for="secret-service-input">Service (optional)</label>
                  <input id="secret-service-input" type="text" class="settings-input" placeholder="e.g. github, openai" style="max-width:260px;">
                </div>
                <div style="display:flex;gap:10px;">
                  <button class="btn btn-primary" onclick="saveSecret()">Save</button>
                  <button class="btn btn-ghost" onclick="hideAddSecretForm()">Cancel</button>
                </div>
              </div>
            </div>
            <div id="secrets-list" style="display:flex;flex-direction:column;gap:6px;"></div>
            <p id="secrets-empty" class="empty-state" style="display:none;">No secrets stored. Add one to connect integrations.</p>
          </div>
        </div>

        <!-- System Prompt Tab -->
        <div class="tab-content" id="settings-tab-system">
          <p class="settings-desc" style="margin-bottom:12px;">Customize your agent&#39;s personality and instructions. This controls how Zubo thinks and responds. Be careful — incorrect changes may cause errors.</p>
          <div class="editor-wrap" style="min-height:calc(100vh - 220px);">
            <div class="editor-toolbar">
              <button class="btn btn-primary" onclick="saveSystem()">Save</button>
              <button class="btn btn-ghost" onclick="loadSystem()">Reload</button>
              <span id="system-status" class="status-text"></span>
            </div>
            <textarea class="editor" id="system-editor" spellcheck="false" style="min-height:60vh;"></textarea>
          </div>
        </div>

        <!-- Cron Tab -->
        <div class="tab-content" id="settings-tab-cron">
          <table>
            <thead><tr><th>Name</th><th>Schedule</th><th>Task</th><th>Enabled</th><th>Last Run</th></tr></thead>
            <tbody id="cron-body"></tbody>
          </table>
          <div id="cron-empty" class="empty-state-card" style="display:none;">
            <div class="empty-icon"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
            <h4>No scheduled tasks</h4>
            <p>Ask Zubo to set up recurring tasks in chat.</p>
          </div>
        </div>

        <!-- Logs Tab -->
        <div class="tab-content" id="settings-tab-logs" style="display:none;">
          <div class="editor-toolbar">
            <button class="btn btn-ghost" onclick="loadLogs()">Refresh</button>
            <span id="logs-status" class="status-text"></span>
          </div>
          <div class="log-view" id="log-content" style="min-height:400px;"></div>
        </div>

        <!-- Privacy Tab -->
        <div class="tab-content" id="settings-tab-privacy">
          <div style="margin-bottom:20px;">
            <h3 style="font-family:var(--display);font-weight:700;margin-bottom:4px;">Privacy &amp; Data</h3>
            <p class="settings-desc">See exactly what data Zubo stores and what has been sent to AI providers. You own your data.</p>
          </div>
          <div class="cards" id="privacy-summary-cards"></div>
          <div class="settings-section" style="margin-top:24px;">
            <h3 class="settings-title">Data Sent to AI Providers</h3>
            <p class="settings-desc">Every API call Zubo makes to LLM providers is logged here.</p>
            <div id="privacy-providers" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;"></div>
            <table id="api-log-table">
              <thead><tr><th>Time</th><th>Provider</th><th>Model</th><th>Tokens Sent</th><th>Tokens Received</th><th>Cost</th></tr></thead>
              <tbody id="api-log-body"></tbody>
            </table>
            <div style="margin-top:10px;display:flex;gap:10px;">
              <button class="btn btn-ghost" id="api-log-more" onclick="loadMoreApiLog()" style="display:none;">Load More</button>
            </div>
          </div>
          <div class="settings-section" style="margin-top:24px;">
            <h3 class="settings-title">Tool Executions</h3>
            <p class="settings-desc">Log of every tool/skill Zubo has executed on your behalf.</p>
            <table id="tool-log-table">
              <thead><tr><th>Time</th><th>Tool</th><th>Duration</th><th>Status</th></tr></thead>
              <tbody id="tool-log-body"></tbody>
            </table>
            <div style="margin-top:10px;display:flex;gap:10px;">
              <button class="btn btn-ghost" id="tool-log-more" onclick="loadMoreToolLog()" style="display:none;">Load More</button>
            </div>
          </div>
          <div class="settings-section" style="margin-top:24px;border-color:rgba(239,68,68,0.2);">
            <h3 class="settings-title" style="color:var(--red);">Data Controls</h3>
            <p class="settings-desc">Delete stored data. These actions cannot be undone.</p>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <button class="btn btn-ghost" onclick="wipeData('memories')" style="color:var(--yellow);">Delete All Memories</button>
              <button class="btn btn-ghost" onclick="wipeData('messages')" style="color:var(--yellow);">Delete All Messages</button>
              <button class="btn btn-ghost" onclick="wipeData('usage')" style="color:var(--yellow);">Delete Usage Data</button>
              <button class="btn btn-ghost" onclick="wipeData('all')" style="color:var(--red);border-color:rgba(239,68,68,0.3);">Delete Everything</button>
            </div>
            <span id="wipe-status" class="status-text" style="display:block;margin-top:10px;"></span>
          </div>
        </div>

        <!-- Budget Tab -->
        <div class="tab-content" id="settings-tab-budget">
          <div class="cards" id="budget-summary-cards"></div>
          <div class="settings-section" style="margin-top:24px;">
            <h3 class="settings-title">Budget Limits</h3>
            <p class="settings-desc">Set spending limits to control costs. Zubo will stop responding when limits are reached — you can raise them anytime. Typical usage: ~100 messages/day costs $0.50–$2.00 depending on your AI model.</p>
            <div class="settings-grid">
              <div class="settings-field">
                <label class="settings-label" for="budget-daily">Daily Limit (USD)</label>
                <input id="budget-daily" type="number" class="settings-input" min="0" step="0.01" placeholder="e.g. 5.00">
              </div>
              <div class="settings-field">
                <label class="settings-label" for="budget-monthly">Monthly Limit (USD)</label>
                <input id="budget-monthly" type="number" class="settings-input" min="0" step="0.01" placeholder="e.g. 50.00">
              </div>
              <div class="settings-field">
                <label class="settings-label" for="budget-alert">Alert Threshold</label>
                <select id="budget-alert" class="settings-select">
                  <option value="0.5">50%</option>
                  <option value="0.7">70%</option>
                  <option value="0.8" selected>80%</option>
                  <option value="0.9">90%</option>
                </select>
              </div>
            </div>
            <div style="margin-top: 16px; display: flex; gap: 10px; align-items: center;">
              <button class="btn btn-primary" onclick="saveBudget()">Save Limits</button>
              <button class="btn btn-ghost" onclick="clearBudget()">Remove Limits</button>
              <span id="budget-status" class="status-text"></span>
            </div>
          </div>
          <div class="memory-section-title" style="margin-top:28px;">Daily Spend (Last 7 Days)</div>
          <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;">
            <div class="bar-chart" id="budget-chart"></div>
          </div>
        </div>

        <!-- Email Digests Tab -->
        <div class="tab-content" id="settings-tab-digests">
          <div class="settings-section">
            <h3 class="settings-title">Email Digest</h3>
            <p class="settings-desc">Receive periodic email summaries of your agent's activity, conversations, and errors.</p>
            <div class="settings-grid">
              <div class="settings-field">
                <label class="settings-label" for="digest-enabled">Status</label>
                <select id="digest-enabled" class="settings-select">
                  <option value="0">Disabled</option>
                  <option value="1">Enabled</option>
                </select>
              </div>
              <div class="settings-field">
                <label class="settings-label" for="digest-frequency">Frequency</label>
                <select id="digest-frequency" class="settings-select">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <div class="settings-field">
                <label class="settings-label" for="digest-time">Send Time</label>
                <input id="digest-time" type="time" class="settings-input" value="09:00">
              </div>
              <div class="settings-field">
                <label class="settings-label" for="digest-email">Recipient Email</label>
                <input id="digest-email" type="email" class="settings-input" placeholder="you@example.com">
              </div>
            </div>
            <div style="margin-top:16px;">
              <p class="settings-label" style="margin-bottom:8px;">Include in digest:</p>
              <div style="display:flex;flex-direction:column;gap:8px;">
                <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-secondary);cursor:pointer;">
                  <input type="checkbox" id="digest-inc-conversations" checked> Conversations summary
                </label>
                <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-secondary);cursor:pointer;">
                  <input type="checkbox" id="digest-inc-tools" checked> Tool usage stats
                </label>
                <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-secondary);cursor:pointer;">
                  <input type="checkbox" id="digest-inc-errors" checked> Errors
                </label>
                <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-secondary);cursor:pointer;">
                  <input type="checkbox" id="digest-inc-scheduled" checked> Scheduled tasks
                </label>
              </div>
            </div>
            <div style="margin-top:16px;display:flex;gap:10px;align-items:center;">
              <button class="btn btn-primary" onclick="saveDigestConfig()">Save</button>
              <button class="btn btn-ghost" onclick="previewDigest()">Preview</button>
              <button class="btn btn-ghost" onclick="sendTestDigest()">Send Test</button>
              <span id="digest-status" class="status-text"></span>
            </div>
            <div id="digest-last-sent" style="margin-top:10px;font-size:12px;color:var(--text-faint);"></div>
          </div>
        </div>

      </div>
    </div>

    <!-- TODOS PANEL -->
    <div id="panel-todos" class="panel">
      <div class="panel-body">
        <p class="settings-desc" style="margin-bottom:16px;">Your tasks and to-dos. Add items, set priorities and due dates.</p>
        <div style="display:flex;gap:8px;margin-bottom:16px;align-items:center;flex-wrap:wrap;">
          <select id="todo-filter" class="settings-select" style="width:auto;" onchange="loadTodos()">
            <option value="pending">Active</option>
            <option value="done">Done</option>
            <option value="all">All</option>
          </select>
          <button class="btn btn-primary btn-sm" onclick="toggleTodoForm()">+ Add</button>
        </div>
        <div id="todo-add-form" style="display:none;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;margin-bottom:16px;">
          <input id="todo-title" type="text" placeholder="What needs to be done?" style="width:100%;margin-bottom:8px;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;">
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <select id="todo-priority" class="settings-select" style="width:auto;font-size:12px;">
              <option value="low">Low</option>
              <option value="medium" selected>Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <input id="todo-due" type="date" style="padding:6px 8px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;">
            <button class="btn btn-primary btn-sm" onclick="addTodo()">Save</button>
            <button class="btn btn-ghost btn-sm" onclick="toggleTodoForm()">Cancel</button>
          </div>
        </div>
        <div id="todos-list"></div>
      </div>
    </div>

    <!-- NOTES PANEL -->
    <div id="panel-notes" class="panel">
      <div class="panel-body">
        <p class="settings-desc" style="margin-bottom:16px;">Your saved notes. Search, pin, and organize information.</p>
        <div style="display:flex;gap:8px;margin-bottom:16px;align-items:center;flex-wrap:wrap;">
          <input id="notes-search" type="text" placeholder="Search notes..." style="flex:1;min-width:150px;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;" onkeydown="if(event.key==='Enter')loadNotes()">
          <button class="btn btn-ghost btn-sm" onclick="loadNotes()">Search</button>
          <button class="btn btn-primary btn-sm" onclick="toggleNoteForm()">+ Add</button>
        </div>
        <div id="note-add-form" style="display:none;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;margin-bottom:16px;">
          <input id="note-title" type="text" placeholder="Title" style="width:100%;margin-bottom:8px;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;">
          <textarea id="note-content" placeholder="Content..." rows="4" style="width:100%;margin-bottom:8px;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;resize:vertical;"></textarea>
          <input id="note-tags" type="text" placeholder="Tags (comma-separated)" style="width:100%;margin-bottom:8px;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;">
          <div style="display:flex;gap:8px;">
            <button class="btn btn-primary btn-sm" onclick="addNote()">Save</button>
            <button class="btn btn-ghost btn-sm" onclick="toggleNoteForm()">Cancel</button>
          </div>
        </div>
        <div id="notes-list"></div>
      </div>
    </div>

    <!-- PREFERENCES PANEL -->
    <div id="panel-preferences" class="panel">
      <div class="panel-body">
        <p class="settings-desc" style="margin-bottom:16px;">Your preferences. These are used by the agent to personalize responses.</p>
        <div style="display:flex;gap:8px;margin-bottom:16px;align-items:center;">
          <button class="btn btn-primary btn-sm" onclick="togglePrefForm()">+ Add</button>
        </div>
        <div id="pref-add-form" style="display:none;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;margin-bottom:16px;">
          <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
            <input id="pref-category" type="text" placeholder="Category (e.g. work)" style="flex:1;min-width:100px;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;" value="general">
            <input id="pref-key" type="text" placeholder="Key (e.g. language)" style="flex:1;min-width:100px;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;">
          </div>
          <input id="pref-value" type="text" placeholder="Value (e.g. TypeScript)" style="width:100%;margin-bottom:8px;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;">
          <div style="display:flex;gap:8px;">
            <button class="btn btn-primary btn-sm" onclick="addPref()">Save</button>
            <button class="btn btn-ghost btn-sm" onclick="togglePrefForm()">Cancel</button>
          </div>
        </div>
        <div id="prefs-list"></div>
      </div>
    </div>

    <!-- TOPICS PANEL -->
    <div id="panel-topics" class="panel">
      <div class="panel-body">
        <p class="settings-desc" style="margin-bottom:16px;">Conversation topics. Each topic keeps a separate thread of context.</p>
        <div style="display:flex;gap:8px;margin-bottom:16px;align-items:center;">
          <button class="btn btn-primary btn-sm" onclick="toggleTopicForm()">+ Add</button>
        </div>
        <div id="topic-add-form" style="display:none;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;margin-bottom:16px;">
          <input id="topic-name" type="text" placeholder="Topic name" style="width:100%;margin-bottom:8px;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;">
          <input id="topic-desc" type="text" placeholder="Description (optional)" style="width:100%;margin-bottom:8px;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;">
          <div style="display:flex;gap:8px;">
            <button class="btn btn-primary btn-sm" onclick="addTopic()">Save</button>
            <button class="btn btn-ghost btn-sm" onclick="toggleTopicForm()">Cancel</button>
          </div>
        </div>
        <div id="topics-list"></div>
      </div>
    </div>

    <!-- FOLLOW-UPS PANEL -->
    <div id="panel-followups" class="panel">
      <div class="panel-body">
        <p class="settings-desc" style="margin-bottom:16px;">Scheduled follow-ups. The agent will proactively remind you at the set time.</p>
        <div style="display:flex;gap:8px;margin-bottom:16px;align-items:center;">
          <button class="btn btn-primary btn-sm" onclick="toggleFollowupForm()">+ Add</button>
        </div>
        <div id="followup-add-form" style="display:none;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;margin-bottom:16px;">
          <input id="followup-context" type="text" placeholder="About what? (e.g. dentist appointment)" style="width:100%;margin-bottom:8px;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;">
          <input id="followup-message" type="text" placeholder="Reminder message" style="width:100%;margin-bottom:8px;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;">
          <input id="followup-at" type="datetime-local" style="width:100%;margin-bottom:8px;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;">
          <div style="display:flex;gap:8px;">
            <button class="btn btn-primary btn-sm" onclick="addFollowup()">Save</button>
            <button class="btn btn-ghost btn-sm" onclick="toggleFollowupForm()">Cancel</button>
          </div>
        </div>
        <div id="followups-list"></div>
      </div>
    </div>

  </div>
</div>

<!-- Visual Workflow Builder Overlay -->
<div class="vw-builder-overlay" id="vw-builder">
  <div class="vw-builder-topbar">
    <button class="btn btn-ghost" onclick="closeVisualBuilder()">&#8592; Back</button>
    <input type="text" id="vw-builder-name" placeholder="Workflow name...">
    <select id="vw-builder-trigger" class="settings-select" style="width:auto;" onchange="onVwTriggerChange()">
      <option value="manual">Manual Trigger</option>
      <option value="cron">Cron Schedule</option>
      <option value="webhook">Webhook</option>
    </select>
    <input type="text" id="vw-builder-schedule" class="settings-input" style="width:160px;display:none;" placeholder="*/5 * * * *">
    <select id="vw-builder-webhook" class="settings-select" style="width:auto;display:none;"></select>
    <div style="margin-left:auto;display:flex;gap:8px;">
      <button class="btn btn-primary" onclick="saveVisualWorkflow()">Save</button>
      <button class="btn btn-ghost" onclick="runVisualWorkflow()">Run Now</button>
    </div>
  </div>
  <div class="vw-builder-body">
    <div class="vw-palette">
      <div style="font-size:11px;color:var(--text-faint);text-transform:uppercase;letter-spacing:0.5px;font-weight:600;margin-bottom:10px;">Blocks</div>
      <div class="vw-palette-item" draggable="true" data-type="tool"><span class="vw-block-icon">&#9881;</span> Tool Call</div>
      <div class="vw-palette-item" draggable="true" data-type="agent"><span class="vw-block-icon">&#129302;</span> Agent Prompt</div>
      <div class="vw-palette-item" draggable="true" data-type="message"><span class="vw-block-icon">&#9993;</span> Send Message</div>
      <div class="vw-palette-item" draggable="true" data-type="condition"><span class="vw-block-icon">&#10067;</span> Condition</div>
      <div class="vw-palette-item" draggable="true" data-type="delay"><span class="vw-block-icon">&#9203;</span> Delay</div>
    </div>
    <div class="vw-canvas" id="vw-canvas">
      <div class="vw-canvas-inner" id="vw-canvas-inner">
        <div class="empty-state-card" id="vw-canvas-empty">
          <h4>Drag blocks here to build your workflow</h4>
          <p>Add steps from the palette on the left, then configure them in the panel on the right.</p>
        </div>
      </div>
    </div>
    <div class="vw-props-panel" id="vw-props">
      <div class="vw-props-title">Properties</div>
      <div id="vw-props-content">
        <p class="settings-desc">Select a block to edit its properties.</p>
      </div>
    </div>
  </div>
</div>

<!-- Digest Preview Modal -->
<div class="digest-preview-modal" id="digest-preview-modal">
  <div style="position:relative;">
    <button class="digest-preview-close" onclick="closeDigestPreview()">Close</button>
    <div class="digest-preview-content" id="digest-preview-content"></div>
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

<div class="cmd-palette-overlay" id="cmd-palette">
  <div class="cmd-palette">
    <input type="text" id="cmd-input" placeholder="Go to..." autocomplete="off">
    <div id="cmd-results"></div>
  </div>
</div>

<div class="toast" id="toast"></div>

<div class="mobile-overlay" id="mobile-overlay" onclick="closeMobileMenu()"></div>

<script>
// --- Panel routing ---
var panelNames = ['agent','history','dashboard','memory','skills','workflows','webhooks','mcp','models','todos','notes','preferences','topics','followups','integrations','settings'];
var panelTitles = { agent:'Chat', history:'History', dashboard:'Dashboard', memory:'Knowledge', skills:'Skills', workflows:'Workflows', webhooks:'Webhooks', mcp:'Extensions', models:'Models', todos:'Todos', notes:'Notes', preferences:'Preferences', topics:'Topics', followups:'Follow-ups', integrations:'Integrations', settings:'Settings' };

// Legacy panel name mapping (old names -> new names + tab)
var legacyPanelMap = {
  status: { panel: 'dashboard', tab: 'overview' },
  analytics: { panel: 'dashboard', tab: 'analytics' },
  system: { panel: 'settings', tab: 'system' },
  registry: { panel: 'skills', tab: 'browse' },
  cron: { panel: 'settings', tab: 'cron' },
  logs: { panel: 'settings', tab: 'logs' },
  privacy: { panel: 'settings', tab: 'privacy' },
  budget: { panel: 'settings', tab: 'budget' }
};

function showPanel(name) {
  // Handle legacy panel names
  if (legacyPanelMap[name]) {
    var mapped = legacyPanelMap[name];
    showPanel(mapped.panel);
    switchTab(mapped.panel, mapped.tab);
    return;
  }
  if (panelNames.indexOf(name) === -1) name = 'agent';
  document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('#sidebar nav a').forEach(function(a) { a.classList.remove('active'); });
  var panel = document.getElementById('panel-' + name);
  if (panel) panel.classList.add('active');
  var link = document.querySelector('#sidebar nav a[href="#' + name + '"]');
  if (link) link.classList.add('active');
  var titleText = document.getElementById('topbar-title-text');
  if (titleText) titleText.textContent = panelTitles[name] || name;
  window.location.hash = name;

  if (name === 'agent') { document.getElementById('chat-input').focus(); }
  if (name === 'dashboard') loadDashboard();
  if (name === 'memory') loadMemory();
  if (name === 'skills') loadSkills();
  if (name === 'workflows') loadWorkflows();
  if (name === 'history') loadHistory();
  if (name === 'integrations') loadIntegrations();
  if (name === 'webhooks') loadWebhooks();
  if (name === 'mcp') loadMcpPanel();
  if (name === 'models') loadModelsPanel();
  if (name === 'todos') loadTodos();
  if (name === 'notes') loadNotes();
  if (name === 'preferences') loadPrefs();
  if (name === 'topics') loadTopics();
  if (name === 'followups') loadFollowups();
  if (name === 'settings') loadSettingsPanel();
  closeMobileMenu();
}

// --- Tab Switching ---
function switchTab(panelId, tabName) {
  var tabBar = document.getElementById(panelId + '-tabs');
  if (!tabBar) return;
  tabBar.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
  var panel = document.getElementById('panel-' + panelId);
  if (!panel) return;
  panel.querySelectorAll('.tab-content').forEach(function(tc) { tc.classList.remove('active'); tc.style.display = 'none'; });
  var targetTab = document.getElementById(panelId + '-tab-' + tabName);
  if (targetTab) { targetTab.classList.add('active'); targetTab.style.display = 'block'; }
  // Highlight the matching tab button
  tabBar.querySelectorAll('.tab').forEach(function(t) {
    if (t.textContent.toLowerCase().replace(/\\s+/g, '') === tabName.replace(/\\s+/g, '') ||
        t.getAttribute('onclick').indexOf("'" + tabName + "'") !== -1) {
      t.classList.add('active');
    }
  });
  // Trigger data loading for specific tabs
  if (panelId === 'settings') {
    if (tabName === 'cron') loadCron();
    if (tabName === 'logs') loadLogs();
    if (tabName === 'privacy') loadPrivacy();
    if (tabName === 'budget') loadBudget();
    if (tabName === 'system') loadSystem();
    if (tabName === 'channels') loadChannelStatus();
    if (tabName === 'providers') loadProviders();
    if (tabName === 'mcp') loadMcpServers();
    if (tabName === 'routing') loadSmartRouting();
    if (tabName === 'secrets') loadSecrets();
    if (tabName === 'data') loadDbStats();
  }
  if (panelId === 'dashboard') {
    if (tabName === 'analytics') loadAnalytics();
    if (tabName === 'performance') loadPerformance();
  }
  if (panelId === 'skills' && tabName === 'browse') {
    var searchInput = document.getElementById('registry-search');
    if (searchInput) searchInput.focus();
  }
  if (panelId === 'workflows') {
    if (tabName === 'recipes') loadRecipes();
    if (tabName === 'custom') loadWorkflows();
    if (tabName === 'visual') loadVisualWorkflows();
  }
  if (panelId === 'mcp') {
    if (tabName === 'installed') loadMcpInstalled();
    if (tabName === 'marketplace') {
      var s = document.getElementById('mcp-marketplace-search');
      if (s) s.focus();
      var grid = document.getElementById('mcp-marketplace-results');
      if (grid && !grid.hasChildNodes()) searchMcpMarketplace();
    }
  }
  if (panelId === 'settings' && tabName === 'digests') loadDigestConfig();
}

// --- Unified Dashboard loader ---
function loadDashboard() {
  loadStatus();
  // Preload analytics data too if the analytics tab was active
  var analyticsTab = document.getElementById('dashboard-tab-analytics');
  if (analyticsTab && analyticsTab.classList.contains('active')) loadAnalytics();
  var perfTab = document.getElementById('dashboard-tab-performance');
  if (perfTab && perfTab.classList.contains('active')) loadPerformance();
}

function loadPerformance() {
  // System Health — perf snapshots
  api('/analytics/perf-snapshots').then(function(data) {
    var container = document.getElementById('perf-health');
    var chart = document.getElementById('rss-chart');
    if (!container || !chart) return;
    container.replaceChildren();
    chart.replaceChildren();
    var snaps = data.snapshots || [];
    if (!snaps.length) {
      var emptyCard = document.createElement('div');
      emptyCard.className = 'perf-card';
      var emptyLabel = document.createElement('div');
      emptyLabel.className = 'perf-label';
      emptyLabel.textContent = 'No Data';
      var emptyVal = document.createElement('div');
      emptyVal.className = 'perf-value';
      emptyVal.style.cssText = 'font-size:14px;color:var(--text-muted);';
      emptyVal.textContent = 'Performance data will appear after the first heartbeat.';
      emptyCard.appendChild(emptyLabel);
      emptyCard.appendChild(emptyVal);
      container.appendChild(emptyCard);
      chart.textContent = 'No data yet';
      return;
    }
    var latest = snaps[snaps.length - 1];
    var cardData = [
      { label: 'RSS Memory', value: (latest.rss_mb || 0).toFixed(1) + ' MB' },
      { label: 'Heap Memory', value: (latest.heap_mb || 0).toFixed(1) + ' MB' },
      { label: 'Database Size', value: (latest.db_size_mb || 0).toFixed(1) + ' MB' },
    ];
    cardData.forEach(function(c) {
      var card = document.createElement('div');
      card.className = 'perf-card';
      var lbl = document.createElement('div');
      lbl.className = 'perf-label';
      lbl.textContent = c.label;
      var val = document.createElement('div');
      val.className = 'perf-value';
      val.textContent = c.value;
      card.appendChild(lbl);
      card.appendChild(val);
      container.appendChild(card);
    });
    // RSS chart
    var maxRss = 1;
    snaps.forEach(function(s) { if ((s.rss_mb || 0) > maxRss) maxRss = s.rss_mb; });
    snaps.forEach(function(s) {
      var col = document.createElement('div');
      col.className = 'bar-col';
      var bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.height = Math.max(2, ((s.rss_mb || 0) / maxRss) * 100) + 'px';
      bar.setAttribute('data-tooltip', (s.rss_mb || 0).toFixed(1) + ' MB');
      var label = document.createElement('div');
      label.className = 'bar-label';
      label.textContent = (s.created_at || '').slice(5, 10);
      col.appendChild(bar);
      col.appendChild(label);
      chart.appendChild(col);
    });
  }).catch(function(err) { console.warn('Dashboard API request failed', err); });

  // Response time trend
  api('/analytics/response-time-trend').then(function(data) {
    var chart = document.getElementById('response-chart');
    if (!chart) return;
    chart.replaceChildren();
    var trend = data.trend || [];
    if (!trend.length) { chart.textContent = 'No data yet'; return; }
    var maxMs = 1;
    trend.forEach(function(t) { if ((t.avg_ms || 0) > maxMs) maxMs = t.avg_ms; });
    trend.forEach(function(t) {
      var col = document.createElement('div');
      col.className = 'bar-col';
      var bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.height = Math.max(2, ((t.avg_ms || 0) / maxMs) * 100) + 'px';
      bar.setAttribute('data-tooltip', Math.round(t.avg_ms || 0) + 'ms avg (' + Math.round(t.min_ms || 0) + '-' + Math.round(t.max_ms || 0) + 'ms)');
      var label = document.createElement('div');
      label.className = 'bar-label';
      label.textContent = (t.day || '').slice(5);
      col.appendChild(bar);
      col.appendChild(label);
      chart.appendChild(col);
    });
  }).catch(function(err) { console.warn('Dashboard API request failed', err); });
}

// --- Unified Settings loader ---
function loadSettingsPanel() {
  loadSettings();
}

// --- Time-aware greeting ---
function updateGreeting() {
  var el = document.getElementById('chat-greeting');
  if (!el) return;
  var hour = new Date().getHours();
  var greeting = hour < 12 ? 'Good morning' : (hour < 18 ? 'Good afternoon' : 'Good evening');
  el.textContent = greeting + ', what can I help you with?';
}
updateGreeting();

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

// --- HTML escaping (XSS prevention) ---
function esc(text) {
  var d = document.createElement('div');
  d.textContent = String(text);
  return d.innerHTML;
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

function useSuggestion(btn) {
  chatInput.value = btn.textContent;
  chatInput.focus();
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
    body: JSON.stringify({ message: text, threadId: activeThreadId || undefined }),
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
              } catch(e) { console.warn('Failed to parse SSE event', e); }
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
  var c = document.getElementById('status-cards');
  c.replaceChildren();
  for (var i = 0; i < 3; i++) { var sk = document.createElement('div'); sk.className = 'card skeleton skeleton-card'; c.appendChild(sk); }
  api('/status').then(function(data) {
    c.replaceChildren();
    Object.keys(data).forEach(function(label) {
      c.appendChild(makeCard(label, String(data[label])));
    });
  });
}

// --- ANALYTICS ---
function loadAnalytics() {
  // Summary cards — show skeletons while loading
  var summaryEl = document.getElementById('analytics-summary');
  summaryEl.replaceChildren();
  for (var i = 0; i < 4; i++) { var sk = document.createElement('div'); sk.className = 'card skeleton skeleton-card'; summaryEl.appendChild(sk); }
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
    var yLabel = document.createElement('div');
    yLabel.className = 'chart-y-label';
    yLabel.textContent = maxVal.toLocaleString();
    chart.appendChild(yLabel);
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

  // Cost breakdown
  api('/analytics/cost-breakdown').then(function(data) {
    var body = document.getElementById('cost-body');
    if (!body) return;
    body.replaceChildren();
    var rows = data.breakdown || [];
    if (!rows.length) {
      var emptyTr = document.createElement('tr');
      var emptyTd = document.createElement('td');
      emptyTd.setAttribute('colspan', '5');
      emptyTd.style.cssText = 'text-align:center;color:var(--text-faint);';
      emptyTd.textContent = 'No usage data yet';
      emptyTr.appendChild(emptyTd);
      body.appendChild(emptyTr);
      return;
    }
    var maxCost = 0.001;
    rows.forEach(function(r) { if ((r.total_cost || 0) > maxCost) maxCost = r.total_cost; });
    rows.forEach(function(r) {
      var tr = document.createElement('tr');
      var pct = Math.round(((r.total_cost || 0) / maxCost) * 100);
      // Provider cell
      var td1 = document.createElement('td');
      td1.textContent = r.provider || '?';
      tr.appendChild(td1);
      // Model cell
      var td2 = document.createElement('td');
      td2.textContent = r.model || '?';
      tr.appendChild(td2);
      // Tokens cell
      var td3 = document.createElement('td');
      td3.textContent = (r.total_tokens || 0).toLocaleString();
      tr.appendChild(td3);
      // Cost cell
      var td4 = document.createElement('td');
      td4.textContent = '$' + (r.total_cost || 0).toFixed(4);
      tr.appendChild(td4);
      // Share bar cell
      var td5 = document.createElement('td');
      var barWrap = document.createElement('div');
      barWrap.className = 'cost-bar-wrap';
      var barDiv = document.createElement('div');
      barDiv.className = 'cost-bar';
      barDiv.style.width = pct + '%';
      var pctSpan = document.createElement('span');
      pctSpan.className = 'cost-pct';
      pctSpan.textContent = (r.requests || 0) + ' req';
      barWrap.appendChild(barDiv);
      barWrap.appendChild(pctSpan);
      td5.appendChild(barWrap);
      tr.appendChild(td5);
      body.appendChild(tr);
    });
  }).catch(function(err) { console.warn('Dashboard API request failed', err); });

  // Top models
  api('/analytics/top-models').then(function(data) {
    var body = document.getElementById('top-models-body');
    if (!body) return;
    body.replaceChildren();
    var models = data.models || [];
    if (!models.length) {
      var emptyTr = document.createElement('tr');
      var emptyTd = document.createElement('td');
      emptyTd.setAttribute('colspan', '5');
      emptyTd.style.cssText = 'text-align:center;color:var(--text-faint);';
      emptyTd.textContent = 'No usage data yet';
      emptyTr.appendChild(emptyTd);
      body.appendChild(emptyTr);
      return;
    }
    models.forEach(function(m) {
      var tr = document.createElement('tr');
      var cells = [
        (m.provider || '') + '/' + (m.model || ''),
        String(m.requests || 0),
        (m.total_tokens || 0).toLocaleString(),
        '$' + (m.total_cost || 0).toFixed(4),
        Math.round(m.avg_response_ms || 0) + 'ms'
      ];
      cells.forEach(function(text) {
        var td = document.createElement('td');
        td.textContent = text;
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
  }).catch(function(err) { console.warn('Dashboard API request failed', err); });
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
    var sourceBits = [r.source || ''];
    if (r.matchType) sourceBits.push(String(r.matchType));
    if (typeof r.confidence === 'number') sourceBits.push('conf ' + Math.round(r.confidence * 100) + '%');
    src.textContent = sourceBits.filter(Boolean).join(' • ');
    var cnt = document.createElement('div');
    cnt.className = 'content';
    cnt.textContent = r.content;
    item.appendChild(src);
    if (r.reasons && r.reasons.length) {
      var why = document.createElement('div');
      why.className = 'source';
      why.style.marginTop = '6px';
      why.textContent = 'Reason: ' + r.reasons.join(', ');
      item.appendChild(why);
    }
    item.appendChild(cnt);
    container.appendChild(item);
  });
}

function loadRecentMemories() {
  api('/memory/recent').then(function(data) {
    renderMemoryItems(data.results, document.getElementById('memory-results'));
  }).catch(function(err) { console.warn('Dashboard API request failed', err); });
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

// --- RECIPES ---
function loadRecipes() {
  api('/recipes').then(function(data) {
    var grid = document.getElementById('recipes-grid');
    var count = document.getElementById('recipe-count');
    if (!grid || !data.recipes) return;

    count.textContent = data.recipes.length;

    grid.innerHTML = data.recipes.map(function(r) {
      var safeId = esc(r.id);
      var requiresHtml = r.requires && r.requires.length > 0
        ? '<div class="recipe-card-requires">Requires: ' + esc(r.requires.join(', ')) + '</div>'
        : '';
      var btnHtml = r.installed
        ? '<button class="btn installed" onclick="uninstallRecipe(&#39;' + safeId + '&#39;)">Installed \u2713</button>'
        : '<button class="btn btn-primary" onclick="installRecipe(&#39;' + safeId + '&#39;)">Activate</button>';

      return '<div class="recipe-card">' +
        '<div class="recipe-card-header">' +
        '<span class="recipe-card-icon">' + esc(r.icon) + '</span>' +
        '<span class="recipe-card-title">' + esc(r.name) + '</span>' +
        '</div>' +
        '<div class="recipe-card-desc">' + esc(r.description) + '</div>' +
        '<div class="recipe-card-meta">' +
        '<span class="recipe-card-schedule">' + esc(r.scheduleHuman) + '</span>' +
        requiresHtml +
        btnHtml +
        '</div></div>';
    }).join('');
  });
}

function installRecipe(id) {
  api('/recipes/install', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: id })
  }).then(function(r) {
    if (r.ok) {
      toast('Recipe activated: ' + (r.name || id));
      loadRecipes();
    } else {
      toast(r.error || 'Failed to install');
    }
  });
}

function uninstallRecipe(id) {
  api('/recipes/uninstall', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: id })
  }).then(function(r) {
    if (r.ok) {
      toast('Recipe deactivated');
      loadRecipes();
    } else {
      toast(r.error || 'Failed to uninstall');
    }
  });
}

// --- WORKFLOWS ---
function loadWorkflows() {
  // Load recipes only if the recipes tab is visible
  var recipesTab = document.getElementById('workflows-tab-recipes');
  if (recipesTab && recipesTab.classList.contains('active')) loadRecipes();
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
function cronToHuman(expr) {
  var p = expr.split(' ');
  if (p.length < 5) return expr;
  var min = p[0], hour = p[1], dom = p[2], mon = p[3], dow = p[4];
  var days = { '0':'Sun','1':'Mon','2':'Tue','3':'Wed','4':'Thu','5':'Fri','6':'Sat' };
  var time = '';
  if (hour !== '*' && min !== '*') {
    var h = parseInt(hour, 10); var m = parseInt(min, 10);
    if (isNaN(h) || isNaN(m)) return expr;
    var ampm = h >= 12 ? 'pm' : 'am';
    h = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    time = h + (m > 0 ? ':' + String(m).padStart(2, '0') : '') + ampm;
  }
  if (dow === '1-5' && dom === '*') return time ? 'Weekdays at ' + time : 'Every weekday';
  if (dow === '0,6' && dom === '*') return time ? 'Weekends at ' + time : 'Every weekend';
  if (dow !== '*' && dom === '*') {
    var dayNames = dow.split(',').map(function(d) { return days[d] || d; }).join(', ');
    return time ? dayNames + ' at ' + time : 'Every ' + dayNames;
  }
  if (dow === '*' && dom === '*' && mon === '*') {
    if (min.startsWith('*/')) return 'Every ' + min.slice(2) + ' min';
    if (hour.startsWith('*/')) return 'Every ' + hour.slice(2) + ' hrs';
    if (hour === '*') return 'Every minute';
    return time ? 'Daily at ' + time : 'Daily';
  }
  if (dom !== '*' && mon === '*') return time ? 'Monthly on ' + dom + ' at ' + time : 'Monthly on day ' + dom;
  return expr;
}

function loadCron() {
  api('/cron').then(function(data) {
    var body = document.getElementById('cron-body');
    var empty = document.getElementById('cron-empty');
    body.replaceChildren();
    if (!data.jobs || !data.jobs.length) { empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    data.jobs.forEach(function(j) {
      var tr = document.createElement('tr');
      var scheduleTd = document.createElement('td');
      var humanLabel = document.createTextNode(cronToHuman(j.schedule));
      var rawSpan = document.createElement('span');
      rawSpan.style.cssText = 'font-size:10px;color:var(--text-muted);';
      rawSpan.textContent = j.schedule;
      scheduleTd.appendChild(humanLabel);
      scheduleTd.appendChild(document.createElement('br'));
      scheduleTd.appendChild(rawSpan);
      var cells = [j.name, null, j.task, j.enabled ? 'Yes' : 'No', j.last_run || 'Never'];
      cells.forEach(function(text, i) {
        if (i === 1) { tr.appendChild(scheduleTd); return; }
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

// --- BUDGET ---
function loadBudget() {
  api('/budget').then(function(data) {
    var cards = document.getElementById('budget-summary-cards');
    if (!cards) return;

    var dailyPct = data.daily_limit_usd ? Math.min(data.today_spend_usd / data.daily_limit_usd, 1) : 0;
    var monthPct = data.monthly_limit_usd ? Math.min(data.month_spend_usd / data.monthly_limit_usd, 1) : 0;

    function barClass(pct, hasLimit) {
      if (!hasLimit) return 'ok';
      if (pct >= 1) return 'danger';
      if (pct >= (data.alert_threshold || 0.8)) return 'warn';
      return 'ok';
    }

    cards.innerHTML = '<div class="card">' +
      '<div class="budget-card-label">Today\\'s Spend</div>' +
      '<div class="budget-card-value">$' + data.today_spend_usd.toFixed(2) + '</div>' +
      '<div class="budget-card-sub">' + (data.daily_limit_usd ? 'Limit: $' + data.daily_limit_usd.toFixed(2) : 'No daily limit') + '</div>' +
      (data.daily_limit_usd ? '<div class="budget-bar"><div class="budget-bar-fill ' + barClass(dailyPct, true) + '" style="width:' + Math.max(0, Math.min(100, dailyPct * 100)) + '%"></div></div>' : '') +
    '</div>' +
    '<div class="card">' +
      '<div class="budget-card-label">This Month</div>' +
      '<div class="budget-card-value">$' + data.month_spend_usd.toFixed(2) + '</div>' +
      '<div class="budget-card-sub">' + (data.monthly_limit_usd ? 'Limit: $' + data.monthly_limit_usd.toFixed(2) : 'No monthly limit') + '</div>' +
      (data.monthly_limit_usd ? '<div class="budget-bar"><div class="budget-bar-fill ' + barClass(monthPct, true) + '" style="width:' + Math.max(0, Math.min(100, monthPct * 100)) + '%"></div></div>' : '') +
    '</div>' +
    '<div class="card">' +
      '<div class="budget-card-label">Status</div>' +
      '<div class="budget-card-value" style="font-size:20px;">' + (data.paused ? '<span style="color:var(--red);">Paused</span>' : '<span style="color:var(--green);">Active</span>') + '</div>' +
      '<div class="budget-card-sub">' + (data.paused ? 'Budget limit reached' : 'Within budget') + '</div>' +
    '</div>';

    // Fill in form values
    if (data.daily_limit_usd) document.getElementById('budget-daily').value = data.daily_limit_usd;
    if (data.monthly_limit_usd) document.getElementById('budget-monthly').value = data.monthly_limit_usd;
    if (data.alert_threshold) document.getElementById('budget-alert').value = String(data.alert_threshold);

    // Render chart
    var chart = document.getElementById('budget-chart');
    if (chart && data.daily_breakdown && data.daily_breakdown.length > 0) {
      var maxCost = Math.max.apply(null, data.daily_breakdown.map(function(d) { return d.cost; }));
      if (maxCost === 0) maxCost = 1;
      chart.innerHTML = data.daily_breakdown.map(function(d) {
        var pct = (d.cost / maxCost) * 100;
        var dayLabel = d.day.slice(5); // MM-DD
        return '<div class="bar-col"><div class="bar" style="height:' + Math.max(pct, 2) + '%;background:var(--gradient);border-radius:4px 4px 0 0;max-width:60px;" data-tooltip="$' + d.cost.toFixed(4) + '"></div><div class="bar-label">' + dayLabel + '</div></div>';
      }).join('');
    } else if (chart) {
      chart.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:20px;">No spending data yet</div>';
    }
  });
}

function saveBudget() {
  var daily = parseFloat(document.getElementById('budget-daily').value) || null;
  var monthly = parseFloat(document.getElementById('budget-monthly').value) || null;
  var threshold = parseFloat(document.getElementById('budget-alert').value) || 0.8;

  api('/budget', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ daily_limit_usd: daily, monthly_limit_usd: monthly, alert_threshold: threshold })
  }).then(function(r) {
    var s = document.getElementById('budget-status');
    if (r.ok) {
      s.textContent = 'Budget saved';
      s.style.color = 'var(--green)';
      loadBudget();
      toast('Budget limits saved');
    } else {
      s.textContent = r.error || 'Failed';
      s.style.color = 'var(--red)';
    }
    setTimeout(function() { s.textContent = ''; }, 3000);
  });
}

function clearBudget() {
  api('/budget', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ daily_limit_usd: null, monthly_limit_usd: null })
  }).then(function(r) {
    document.getElementById('budget-daily').value = '';
    document.getElementById('budget-monthly').value = '';
    loadBudget();
    toast('Budget limits removed');
  });
}

// --- PRIVACY ---
var apiLogOffset = 0;
var toolLogOffset = 0;

// --- Integrations (OAuth) ---
var providerLabels = {
  google: { name: 'Google', icon: '\u{1F310}', desc: 'Calendar, Gmail, Drive, Docs, Sheets' },
  github: { name: 'GitHub', icon: '\u{1F4BB}', desc: 'Issues, PRs, Repos' },
  notion: { name: 'Notion', icon: '\u{1F4D3}', desc: 'Pages, Databases, Search' },
  linear: { name: 'Linear', icon: '\u{1F4CB}', desc: 'Issues, Projects' },
  slack: { name: 'Slack', icon: '\u{1F4AC}', desc: 'Messages, Channels' }
};

function loadIntegrations() {
  fetch('/api/dashboard/oauth/status')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var container = document.getElementById('oauth-connections-list');
      if (!container) return;
      // Clear existing content safely
      while (container.firstChild) container.removeChild(container.firstChild);

      var supported = data.supported || [];
      var connMap = {};
      (data.connections || []).forEach(function(c) { connMap[c.provider] = c; });

      if (!supported.length) {
        var emptyMsg = document.createElement('div');
        emptyMsg.style.cssText = 'text-align:center;color:var(--text-muted);padding:40px;';
        emptyMsg.textContent = 'No OAuth providers available. Add provider credentials to your config to get started.';
        container.appendChild(emptyMsg);
        return;
      }

      supported.forEach(function(provider) {
        var conn = connMap[provider] || { connected: false, configured: false, token_valid: false };
        var label = providerLabels[provider] || { name: provider, icon: '\u{1F517}', desc: '' };
        var statusColor = conn.connected ? (conn.token_valid ? 'var(--green)' : 'var(--yellow)') : 'var(--text-faint)';
        var statusText = conn.connected ? (conn.token_valid ? 'Connected' : 'Token Expired') : (conn.configured ? 'Not Connected' : 'Not Configured');
        var statusBg = conn.connected ? (conn.token_valid ? 'var(--green-bg)' : 'var(--yellow-bg)') : 'transparent';

        var row = document.createElement('div');
        row.style.cssText = 'background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;display:flex;align-items:center;justify-content:space-between;';

        var leftDiv = document.createElement('div');
        leftDiv.style.cssText = 'display:flex;align-items:center;gap:12px;';

        var iconSpan = document.createElement('span');
        iconSpan.style.fontSize = '24px';
        iconSpan.textContent = label.icon;
        leftDiv.appendChild(iconSpan);

        var infoDiv = document.createElement('div');
        var nameDiv = document.createElement('div');
        nameDiv.style.cssText = 'font-weight:600;font-size:14px;';
        nameDiv.textContent = label.name;
        infoDiv.appendChild(nameDiv);
        var descDiv = document.createElement('div');
        descDiv.style.cssText = 'font-size:12px;color:var(--text-secondary);';
        descDiv.textContent = label.desc;
        infoDiv.appendChild(descDiv);
        leftDiv.appendChild(infoDiv);
        row.appendChild(leftDiv);

        var rightDiv = document.createElement('div');
        rightDiv.style.cssText = 'display:flex;align-items:center;gap:10px;';

        var badge = document.createElement('span');
        badge.style.cssText = 'font-size:11px;padding:3px 8px;border-radius:20px;background:' + statusBg + ';color:' + statusColor + ';border:1px solid ' + statusColor + '30;';
        badge.textContent = statusText;
        rightDiv.appendChild(badge);

        if (conn.connected) {
          var disconnectBtn = document.createElement('button');
          disconnectBtn.className = 'btn btn-ghost';
          disconnectBtn.style.cssText = 'font-size:12px;padding:4px 12px;color:var(--red);';
          disconnectBtn.textContent = 'Disconnect';
          disconnectBtn.setAttribute('data-provider', provider);
          disconnectBtn.addEventListener('click', function() { disconnectOAuth(this.getAttribute('data-provider')); });
          rightDiv.appendChild(disconnectBtn);
        } else if (conn.configured) {
          var connectBtn = document.createElement('button');
          connectBtn.className = 'btn btn-primary';
          connectBtn.style.cssText = 'font-size:12px;padding:4px 12px;';
          connectBtn.textContent = 'Connect';
          connectBtn.setAttribute('data-provider', provider);
          connectBtn.addEventListener('click', function() { connectOAuth(this.getAttribute('data-provider')); });
          rightDiv.appendChild(connectBtn);
        } else {
          var hint = document.createElement('span');
          hint.style.cssText = 'font-size:11px;color:var(--text-muted);';
          hint.textContent = 'Add credentials to config';
          rightDiv.appendChild(hint);
        }

        row.appendChild(rightDiv);
        container.appendChild(row);
      });
    })
    .catch(function(err) {
      var container = document.getElementById('oauth-connections-list');
      if (container) {
        while (container.firstChild) container.removeChild(container.firstChild);
        var errDiv = document.createElement('div');
        errDiv.style.color = 'var(--red)';
        errDiv.textContent = 'Failed to load integrations: ' + err.message;
        container.appendChild(errDiv);
      }
    });
}

function connectOAuth(provider) {
  var popup = window.open('/oauth/' + provider + '/authorize', '_blank', 'width=600,height=700');
  if (!popup || popup.closed) {
    alert('Popup was blocked. Please allow popups for this site and try again.');
    return;
  }
  // Poll for connection status after a delay
  setTimeout(function() { loadIntegrations(); }, 5000);
  setTimeout(function() { loadIntegrations(); }, 10000);
  setTimeout(function() { loadIntegrations(); }, 20000);
}

function disconnectOAuth(provider) {
  if (!confirm('Disconnect ' + (providerLabels[provider] ? providerLabels[provider].name : provider) + '? This will revoke the stored OAuth tokens.')) return;
  fetch('/api/dashboard/oauth/' + provider, { method: 'DELETE' })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.ok) {
        toast(provider + ' disconnected');
      } else {
        toast('Failed to disconnect: ' + (data.error || 'Unknown error'));
      }
      loadIntegrations();
    })
    .catch(function(err) { toast('Error: ' + err.message); });
}

function loadPrivacy() {
  apiLogOffset = 0;
  toolLogOffset = 0;

  api('/privacy/summary').then(function(data) {
    var cards = document.getElementById('privacy-summary-cards');
    if (!cards) return;

    cards.innerHTML =
      '<div class="card"><div class="label">Memories Stored</div><div class="value">' + (data.memoryCount || 0) + '</div></div>' +
      '<div class="card"><div class="label">Messages</div><div class="value">' + (data.messageCount || 0) + '</div></div>' +
      '<div class="card"><div class="label">API Calls Made</div><div class="value">' + (data.apiCallCount || 0) + '</div></div>' +
      '<div class="card"><div class="label">Tokens Sent to Providers</div><div class="value">' + formatNum(data.totalTokensSent || 0) + '</div></div>' +
      '<div class="card"><div class="label">Tool Executions</div><div class="value">' + (data.toolCallCount || 0) + '</div></div>' +
      '<div class="card"><div class="label">Stored Secrets</div><div class="value">' + (data.secretCount || 0) + '</div></div>';

    // Provider breakdown
    var providers = document.getElementById('privacy-providers');
    if (providers && data.providerBreakdown) {
      providers.innerHTML = data.providerBreakdown.map(function(p) {
        return '<div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);padding:10px 16px;font-size:12px;">' +
          '<div style="font-weight:600;color:var(--text);">' + esc(p.provider) + '</div>' +
          '<div style="color:var(--text-muted);">' + parseInt(p.calls || 0) + ' calls &middot; ' + formatNum(p.tokens_sent || 0) + ' tokens sent</div>' +
        '</div>';
      }).join('');
    }
  });

  loadApiLog();
  loadToolLog();
}

function formatNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function loadApiLog() {
  api('/privacy/api-log?limit=20&offset=' + apiLogOffset).then(function(data) {
    var body = document.getElementById('api-log-body');
    var more = document.getElementById('api-log-more');
    if (!body) return;

    if (apiLogOffset === 0) body.innerHTML = '';

    body.innerHTML += data.rows.map(function(r) {
      var time = r.created_at ? new Date(r.created_at + 'Z').toLocaleString() : '\u2014';
      return '<tr>' +
        '<td>' + esc(time) + '</td>' +
        '<td>' + esc(r.provider || '\u2014') + '</td>' +
        '<td style="font-size:11px;">' + esc(r.model || '\u2014') + '</td>' +
        '<td>' + parseInt(r.input_tokens || 0) + '</td>' +
        '<td>' + parseInt(r.output_tokens || 0) + '</td>' +
        '<td>' + (r.cost_usd ? '$' + parseFloat(r.cost_usd).toFixed(4) : '\u2014') + '</td>' +
      '</tr>';
    }).join('');

    if (more) more.style.display = (apiLogOffset + 20 < data.total) ? '' : 'none';
  });
}

function loadMoreApiLog() {
  apiLogOffset += 20;
  loadApiLog();
}

function loadToolLog() {
  api('/privacy/tool-log?limit=20&offset=' + toolLogOffset).then(function(data) {
    var body = document.getElementById('tool-log-body');
    var more = document.getElementById('tool-log-more');
    if (!body) return;

    if (toolLogOffset === 0) body.innerHTML = '';

    body.innerHTML += data.rows.map(function(r) {
      var time = r.created_at ? new Date(r.created_at + 'Z').toLocaleString() : '\u2014';
      var status = r.success ? '<span style="color:var(--green);">OK</span>' : '<span style="color:var(--red);">Error</span>';
      return '<tr>' +
        '<td>' + esc(time) + '</td>' +
        '<td>' + esc(r.tool_name || '\u2014') + '</td>' +
        '<td>' + (r.duration_ms ? parseInt(r.duration_ms) + 'ms' : '\u2014') + '</td>' +
        '<td>' + status + '</td>' +
      '</tr>';
    }).join('');

    if (more) more.style.display = (toolLogOffset + 20 < data.total) ? '' : 'none';
  });
}

function loadMoreToolLog() {
  toolLogOffset += 20;
  loadToolLog();
}

function wipeData(type) {
  var msg = {
    memories: 'Delete ALL stored memories? This cannot be undone.',
    messages: 'Delete ALL conversation messages? This cannot be undone.',
    usage: 'Delete ALL API usage logs and tool metrics? This cannot be undone.',
    all: 'DELETE EVERYTHING? All memories, messages, usage data, and secrets will be permanently removed. This cannot be undone.'
  };

  if (!confirm(msg[type] || 'Are you sure?')) return;

  var confirmToken = type === 'all' ? 'DELETE_ALL' : 'DELETE';
  var endpoint = '/privacy/wipe-' + type;
  api(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: confirmToken }) }).then(function(r) {
    var s = document.getElementById('wipe-status');
    if (r.ok) {
      s.textContent = r.message || 'Data deleted';
      s.style.color = 'var(--green)';
      loadPrivacy();
      toast('Data deleted successfully');
    } else {
      s.textContent = r.error || 'Failed';
      s.style.color = 'var(--red)';
    }
    setTimeout(function() { s.textContent = ''; }, 3000);
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
  loadSecrets();
  loadSmartRouting();
  loadMemoryRetrievalSettings();
  loadToolScopeSettings();
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

function loadMemoryRetrievalSettings() {
  api('/settings/memory-retrieval').then(function(data) {
    document.getElementById('memory-context-topk').value = data.contextTopK || 3;
    document.getElementById('memory-min-confidence').value = data.minConfidence || 0;
    document.getElementById('memory-retrieval-status').textContent = '';
  });
}

function saveMemoryRetrievalSettings() {
  var contextTopK = parseInt(document.getElementById('memory-context-topk').value, 10);
  var minConfidence = parseFloat(document.getElementById('memory-min-confidence').value);
  if (isNaN(contextTopK) || contextTopK < 1 || contextTopK > 10) {
    document.getElementById('memory-retrieval-status').textContent = 'Top-K must be 1-10';
    return;
  }
  if (isNaN(minConfidence) || minConfidence < 0 || minConfidence > 1) {
    document.getElementById('memory-retrieval-status').textContent = 'Confidence must be 0-1';
    return;
  }
  api('/settings/memory-retrieval', {
    method: 'PUT',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ contextTopK: contextTopK, minConfidence: minConfidence })
  }).then(function(data) {
    if (data.ok) {
      document.getElementById('memory-retrieval-status').textContent = 'Saved';
      toast('Memory retrieval settings updated');
    } else {
      document.getElementById('memory-retrieval-status').textContent = data.error || 'Error';
    }
  });
}

function applyMemoryPreset(kind) {
  if (kind === 'strict') {
    document.getElementById('memory-context-topk').value = 2;
    document.getElementById('memory-min-confidence').value = 0.35;
  } else {
    document.getElementById('memory-context-topk').value = 4;
    document.getElementById('memory-min-confidence').value = 0.2;
  }
  document.getElementById('memory-retrieval-status').textContent = 'Preset applied';
}

function loadToolScopeSettings() {
  api('/settings/tool-scopes').then(function(data) {
    document.getElementById('tool-scopes-allowed').value = (data.allowed || []).join(',');
    document.getElementById('tool-scopes-dry-run').value = data.dryRunByDefault ? 'true' : 'false';
    document.getElementById('tool-scopes-status').textContent = '';
  });
}

function saveToolScopeSettings() {
  var allowed = document.getElementById('tool-scopes-allowed').value
    .split(',')
    .map(function(x) { return x.trim(); })
    .filter(Boolean);
  var dryRunByDefault = document.getElementById('tool-scopes-dry-run').value === 'true';
  api('/settings/tool-scopes', {
    method: 'PUT',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ allowed: allowed, dryRunByDefault: dryRunByDefault })
  }).then(function(data) {
    if (data.ok) {
      document.getElementById('tool-scopes-status').textContent = 'Saved';
      toast('Tool safety settings updated');
    } else {
      document.getElementById('tool-scopes-status').textContent = data.error || 'Error';
    }
  });
}

function applyToolScopePreset(kind) {
  if (kind === 'safe') {
    document.getElementById('tool-scopes-allowed').value = 'memory,network_read,filesystem_read,config,scheduling';
    document.getElementById('tool-scopes-dry-run').value = 'true';
  } else {
    document.getElementById('tool-scopes-allowed').value = 'memory,network_read,filesystem_read,filesystem_write,config,scheduling,delegation';
    document.getElementById('tool-scopes-dry-run').value = 'true';
  }
  document.getElementById('tool-scopes-status').textContent = 'Preset applied';
}

// --- Smart Routing ---
function loadSmartRouting() {
  api('/smart-routing').then(function(data) {
    document.getElementById('sr-enabled').value = data.enabled ? 'true' : 'false';
    var fpSel = document.getElementById('sr-fast-provider');
    fpSel.replaceChildren();
    var emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = '-- Select --';
    fpSel.appendChild(emptyOpt);
    settingsProviders.forEach(function(p) {
      var opt = document.createElement('option');
      opt.value = p.name;
      opt.textContent = p.name;
      if (p.name === data.fastProvider) opt.selected = true;
      fpSel.appendChild(opt);
    });
    document.getElementById('sr-fast-model').value = data.fastModel || '';
    document.getElementById('sr-status').textContent = '';
  });
}

function saveSmartRouting() {
  var enabled = document.getElementById('sr-enabled').value === 'true';
  var fastProvider = document.getElementById('sr-fast-provider').value;
  var fastModel = document.getElementById('sr-fast-model').value.trim();
  if (enabled && !fastProvider) {
    document.getElementById('sr-status').textContent = 'Select a fast provider';
    return;
  }
  api('/smart-routing', {
    method: 'PUT',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ enabled: enabled, fastProvider: fastProvider, fastModel: fastModel })
  }).then(function(data) {
    if (data.ok) {
      document.getElementById('sr-status').textContent = 'Saved \u2014 restart Zubo to apply';
      toast('Smart routing ' + (enabled ? 'enabled' : 'disabled'));
    } else {
      document.getElementById('sr-status').textContent = data.error || 'Error';
    }
  });
}

// --- Channel Status (interactive) ---
var channelLabels = { webchat: 'Web Chat', telegram: 'Telegram', discord: 'Discord', slack: 'Slack', whatsapp: 'WhatsApp', signal: 'Signal', email: 'Email' };
var channelIcons = { telegram: '\u{2708}\u{FE0F}', discord: '\u{1F3AE}', slack: '\u{1F4AC}', whatsapp: '\u{1F4F1}', signal: '\u{1F510}', email: '\u{2709}\u{FE0F}' };
var editingChannel = '';

var channelFieldDefs = {
  telegram: [
    { key: 'botToken', label: 'Bot Token', type: 'password' },
    { key: 'allowedUsers', label: 'Allowed User IDs (comma-separated)', type: 'text' }
  ],
  discord: [
    { key: 'botToken', label: 'Bot Token', type: 'password' },
    { key: 'allowedUsers', label: 'Allowed Users (comma-separated)', type: 'text' }
  ],
  slack: [
    { key: 'botToken', label: 'Bot Token', type: 'password' },
    { key: 'appToken', label: 'App Token', type: 'password' },
    { key: 'allowedUsers', label: 'Allowed Users (comma-separated)', type: 'text' }
  ],
  whatsapp: [
    { key: 'authDir', label: 'Auth Directory', type: 'text' },
    { key: 'allowedNumbers', label: 'Allowed Numbers (comma-separated)', type: 'text' }
  ],
  signal: [
    { key: 'phoneNumber', label: 'Phone Number', type: 'text' },
    { key: 'signalCliPath', label: 'signal-cli Path', type: 'text' },
    { key: 'allowedNumbers', label: 'Allowed Numbers (comma-separated)', type: 'text' }
  ],
  email: [
    { key: 'imap.host', label: 'IMAP Host', type: 'text' },
    { key: 'imap.port', label: 'IMAP Port', type: 'number' },
    { key: 'imap.user', label: 'IMAP User', type: 'text' },
    { key: 'imap.password', label: 'IMAP Password', type: 'password' },
    { key: 'smtp.host', label: 'SMTP Host', type: 'text' },
    { key: 'smtp.port', label: 'SMTP Port', type: 'number' },
    { key: 'smtp.user', label: 'SMTP User', type: 'text' },
    { key: 'smtp.password', label: 'SMTP Password', type: 'password' },
    { key: 'pollIntervalSeconds', label: 'Poll Interval (seconds)', type: 'number' },
    { key: 'fromName', label: 'From Name', type: 'text' },
    { key: 'allowedSenders', label: 'Allowed Senders (comma-separated)', type: 'text' }
  ]
};

function loadChannelStatus() {
  api('/channels/config').then(function(data) {
    var list = document.getElementById('channel-status-list');
    list.replaceChildren();
    var channels = data.channels || {};
    var connCount = 0;
    var names = ['telegram','discord','slack','whatsapp','signal','email'];
    names.forEach(function(name) {
      var ch = channels[name];
      if (!ch) return;
      if (ch.running) connCount++;

      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px 14px;background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;';

      var icon = document.createElement('span');
      icon.style.cssText = 'font-size:18px;width:28px;text-align:center;';
      icon.textContent = channelIcons[name] || '\u{1F517}';
      row.appendChild(icon);

      var dot = document.createElement('span');
      dot.className = 'status-dot ' + (ch.running ? 'ok' : '');
      if (!ch.running) dot.style.background = 'var(--text-faint)';
      row.appendChild(dot);

      var label = document.createElement('span');
      label.style.cssText = 'font-size:13px;font-weight:500;color:var(--text);flex:1;';
      label.textContent = channelLabels[name] || name;
      row.appendChild(label);

      var status = document.createElement('span');
      status.style.cssText = 'font-size:11px;color:' + (ch.running ? 'var(--green)' : 'var(--text-faint)') + ';margin-right:8px;';
      status.textContent = ch.running ? 'Running' : (ch.configured ? 'Stopped' : 'Not configured');
      row.appendChild(status);

      // Toggle button
      var toggleBtn = document.createElement('button');
      toggleBtn.className = 'btn ' + (ch.enabled ? 'btn-ghost' : 'btn-primary');
      toggleBtn.style.cssText = 'font-size:11px;padding:4px 12px;';
      toggleBtn.textContent = ch.enabled ? 'Disable' : 'Enable';
      toggleBtn.setAttribute('data-channel', name);
      toggleBtn.setAttribute('data-enabled', ch.enabled ? 'true' : 'false');
      toggleBtn.addEventListener('click', function() {
        var chName = this.getAttribute('data-channel');
        var wasEnabled = this.getAttribute('data-enabled') === 'true';
        toggleChannel(chName, !wasEnabled);
      });
      row.appendChild(toggleBtn);

      // Configure button
      var configBtn = document.createElement('button');
      configBtn.className = 'btn btn-ghost';
      configBtn.style.cssText = 'font-size:11px;padding:4px 12px;';
      configBtn.textContent = 'Configure';
      configBtn.setAttribute('data-channel', name);
      configBtn.addEventListener('click', function() {
        showChannelConfig(this.getAttribute('data-channel'), channels[this.getAttribute('data-channel')]);
      });
      row.appendChild(configBtn);

      list.appendChild(row);
    });
    var badge = document.getElementById('channel-count-badge');
    if (badge) badge.textContent = connCount + ' active';
    var sidebarBadge = document.getElementById('sidebar-conn-badge');
    if (sidebarBadge) sidebarBadge.textContent = connCount + (connCount === 1 ? ' channel' : ' channels');
  }).catch(function(err) { console.warn('Channel config load failed', err); });
}

function toggleChannel(name, enabled) {
  api('/channels/' + name + '/toggle', {
    method: 'PUT',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ enabled: enabled })
  }).then(function(data) {
    if (data.ok) {
      toast(channelLabels[name] + ' ' + (enabled ? 'enabled' : 'disabled'));
      loadChannelStatus();
    } else {
      toast('Error: ' + (data.error || 'Unknown'));
    }
  }).catch(function(e) { toast('Error: ' + e.message); });
}

function getNestedValue(obj, path) {
  return path.split('.').reduce(function(o, k) { return o && o[k]; }, obj);
}

function showChannelConfig(name, channelData) {
  editingChannel = name;
  var form = document.getElementById('channel-config-form');
  var title = document.getElementById('channel-config-title');
  var fields = document.getElementById('channel-config-fields');
  title.textContent = 'Configure ' + (channelLabels[name] || name);
  fields.replaceChildren();
  document.getElementById('channel-config-status').textContent = '';

  var defs = channelFieldDefs[name] || [];
  defs.forEach(function(def) {
    var div = document.createElement('div');
    div.className = 'settings-field';
    var lbl = document.createElement('label');
    lbl.className = 'settings-label';
    lbl.textContent = def.label;
    div.appendChild(lbl);

    var val = getNestedValue(channelData.config, def.key);
    if (Array.isArray(val)) val = val.join(', ');

    var inp = document.createElement('input');
    inp.className = 'settings-input';
    inp.type = def.type || 'text';
    inp.id = 'ch-field-' + def.key.replace(/\\./g, '-');
    inp.value = val || '';
    inp.placeholder = def.label;
    div.appendChild(inp);
    fields.appendChild(div);
  });

  form.style.display = '';
}

function hideChannelConfig() {
  document.getElementById('channel-config-form').style.display = 'none';
  editingChannel = '';
}

function saveChannelConfig() {
  if (!editingChannel) return;
  var defs = channelFieldDefs[editingChannel] || [];
  var body = { enabled: true };

  defs.forEach(function(def) {
    var inp = document.getElementById('ch-field-' + def.key.replace(/\\./g, '-'));
    if (!inp) return;
    var val = inp.value.trim();

    // Handle nested keys like 'imap.host'
    var parts = def.key.split('.');
    if (parts.length === 2) {
      if (!body[parts[0]]) body[parts[0]] = {};
      if (def.type === 'number') {
        body[parts[0]][parts[1]] = parseInt(val, 10) || 0;
      } else {
        body[parts[0]][parts[1]] = val;
      }
    } else {
      // Handle comma-separated arrays
      if (def.key === 'allowedUsers' || def.key === 'allowedNumbers' || def.key === 'allowedSenders') {
        body[def.key] = val ? val.split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [];
        // Telegram allowedUsers are numbers
        if (editingChannel === 'telegram' && def.key === 'allowedUsers') {
          body[def.key] = body[def.key].map(function(s) { return parseInt(s, 10); }).filter(function(n) { return !isNaN(n); });
        }
      } else if (def.type === 'number') {
        body[def.key] = parseInt(val, 10) || 0;
      } else {
        body[def.key] = val;
      }
    }
  });

  document.getElementById('channel-config-status').textContent = 'Saving...';
  api('/channels/' + editingChannel + '/config', {
    method: 'PUT',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body)
  }).then(function(data) {
    if (data.ok) {
      toast(channelLabels[editingChannel] + ' saved');
      document.getElementById('channel-config-status').textContent = 'Saved';
      hideChannelConfig();
      loadChannelStatus();
    } else {
      document.getElementById('channel-config-status').textContent = data.error || 'Error';
    }
  }).catch(function(e) {
    document.getElementById('channel-config-status').textContent = 'Error: ' + e.message;
  });
}

// --- Providers ---
function loadProviders() {
  api('/providers').then(function(data) {
    var list = document.getElementById('providers-list');
    list.replaceChildren();
    var providers = data.providers || [];
    var active = data.activeProvider || '';

    if (!providers.length) {
      var empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No providers configured. Add one to get started.';
      list.appendChild(empty);
    }

    providers.forEach(function(p) {
      var card = document.createElement('div');
      card.style.cssText = 'display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);' + (p.name === active ? 'border-color:var(--accent);' : '');

      var info = document.createElement('div');
      info.style.cssText = 'flex:1;';

      var nameRow = document.createElement('div');
      nameRow.style.cssText = 'font-weight:600;font-size:14px;display:flex;align-items:center;gap:8px;';
      nameRow.textContent = p.name;
      if (p.name === active) {
        var activeBadge = document.createElement('span');
        activeBadge.style.cssText = 'font-size:10px;padding:2px 8px;border-radius:10px;background:var(--accent-bg);color:var(--accent);font-weight:600;';
        activeBadge.textContent = 'Active';
        nameRow.appendChild(activeBadge);
      }
      info.appendChild(nameRow);

      var modelRow = document.createElement('div');
      modelRow.style.cssText = 'font-size:12px;color:var(--text-secondary);margin-top:2px;';
      modelRow.textContent = p.model + (p.apiKey ? ' \\u00B7 ' + p.apiKey : '');
      info.appendChild(modelRow);

      card.appendChild(info);

      // Set Active button
      if (p.name !== active) {
        var setActiveBtn = document.createElement('button');
        setActiveBtn.className = 'btn btn-primary';
        setActiveBtn.style.cssText = 'font-size:11px;padding:4px 12px;';
        setActiveBtn.textContent = 'Set Active';
        setActiveBtn.setAttribute('data-provider', p.name);
        setActiveBtn.addEventListener('click', function() { setActiveProvider(this.getAttribute('data-provider')); });
        card.appendChild(setActiveBtn);
      }

      // Delete button
      var delBtn = document.createElement('button');
      delBtn.className = 'btn btn-ghost';
      delBtn.style.cssText = 'font-size:11px;padding:4px 12px;color:var(--red);';
      delBtn.textContent = 'Delete';
      delBtn.setAttribute('data-provider', p.name);
      delBtn.addEventListener('click', function() { deleteProvider(this.getAttribute('data-provider')); });
      card.appendChild(delBtn);

      list.appendChild(card);
    });

    // Failover
    var failoverList = document.getElementById('failover-list');
    failoverList.replaceChildren();
    var failover = data.failover || [];
    if (failover.length) {
      failover.forEach(function(f, i) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--bg-hover);border-radius:6px;font-size:12px;';
        row.textContent = (i + 1) + '. ' + f;
        failoverList.appendChild(row);
      });
    } else {
      var noFail = document.createElement('div');
      noFail.style.cssText = 'font-size:12px;color:var(--text-muted);';
      noFail.textContent = 'No failover providers configured.';
      failoverList.appendChild(noFail);
    }
  }).catch(function(err) { console.warn('Providers load failed', err); });
}

function setActiveProvider(name) {
  api('/providers/active', {
    method: 'PUT',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ provider: name })
  }).then(function(data) {
    if (data.ok) {
      toast('Active provider set to ' + name + ' (hot-reloaded)');
      loadProviders();
      loadSettings();
    } else {
      toast('Error: ' + (data.error || 'Unknown'));
    }
  }).catch(function(e) { toast('Error: ' + e.message); });
}

function deleteProvider(name) {
  if (!confirm('Delete provider "' + name + '"?')) return;
  api('/providers/' + encodeURIComponent(name), { method: 'DELETE' }).then(function(data) {
    if (data.ok) {
      toast('Provider deleted');
      loadProviders();
      loadSettings();
    } else {
      toast('Error: ' + (data.error || 'Unknown'));
    }
  }).catch(function(e) { toast('Error: ' + e.message); });
}

var defaultModels = {
  anthropic: 'claude-sonnet-4-5-20250929',
  openai: 'gpt-4o',
  groq: 'mixtral-8x7b-32768',
  together: 'meta-llama/Llama-3-70b-chat-hf',
  openrouter: 'anthropic/claude-sonnet-4-5',
  deepseek: 'deepseek-chat',
  xai: 'grok-2',
  ollama: 'llama3',
  lmstudio: 'local-model'
};

function showAddProviderForm() {
  document.getElementById('provider-add-form').style.display = '';
  document.getElementById('new-provider-name').value = '';
  document.getElementById('new-provider-key').value = '';
  document.getElementById('new-provider-model').value = '';
  document.getElementById('new-provider-url').value = '';
  document.getElementById('new-provider-url-field').style.display = 'none';
}

function hideAddProviderForm() {
  document.getElementById('provider-add-form').style.display = 'none';
}

function onNewProviderSelect() {
  var name = document.getElementById('new-provider-name').value;
  document.getElementById('new-provider-model').value = defaultModels[name] || '';
  var showUrl = (name === 'custom' || name === 'ollama' || name === 'lmstudio');
  document.getElementById('new-provider-url-field').style.display = showUrl ? '' : 'none';
  // Local providers don't need API key
  var keyInput = document.getElementById('new-provider-key');
  var helpEl = document.getElementById('provider-key-help');
  if (name === 'ollama' || name === 'lmstudio') {
    keyInput.placeholder = 'Not needed for local models';
    helpEl.style.display = 'none';
  } else {
    keyInput.placeholder = 'sk-...';
    // Show where to get the API key
    var keyLinks = {
      anthropic: 'console.anthropic.com/settings/keys',
      openai: 'platform.openai.com/api-keys',
      groq: 'console.groq.com/keys',
      together: 'api.together.xyz/settings/api-keys',
      openrouter: 'openrouter.ai/keys',
      deepseek: 'platform.deepseek.com/api_keys',
      xai: 'console.x.ai'
    };
    if (keyLinks[name]) {
      helpEl.textContent = 'Get your key at ' + keyLinks[name];
      helpEl.style.display = 'block';
    } else {
      helpEl.style.display = 'none';
    }
  }
}

function saveNewProvider() {
  var name = document.getElementById('new-provider-name').value;
  var apiKey = document.getElementById('new-provider-key').value.trim();
  var model = document.getElementById('new-provider-model').value.trim();
  var baseUrl = document.getElementById('new-provider-url').value.trim();
  if (!name || !model) { toast('Provider and model are required'); return; }
  if (name === 'custom' && !name) { toast('Custom provider requires a name'); return; }

  var providerKey = name === 'custom' ? prompt('Enter a name for this provider:') : name;
  if (!providerKey) return;

  var body = { model: model };
  if (apiKey) body.apiKey = apiKey;
  if (baseUrl) body.baseUrl = baseUrl;

  api('/providers/' + encodeURIComponent(providerKey), {
    method: 'PUT',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body)
  }).then(function(data) {
    if (data.ok) {
      toast('Provider "' + providerKey + '" added');
      hideAddProviderForm();
      loadProviders();
      loadSettings();
    } else {
      toast('Error: ' + (data.error || 'Unknown'));
    }
  }).catch(function(e) { toast('Error: ' + e.message); });
}

function saveFailover() {
  // Collect failover from provider list (all non-active providers in order)
  api('/providers').then(function(data) {
    var active = data.activeProvider || '';
    var others = (data.providers || []).filter(function(p) { return p.name !== active; }).map(function(p) { return p.name; });
    return api('/providers/failover', {
      method: 'PUT',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ failover: others })
    });
  }).then(function(data) {
    if (data.ok) {
      toast('Failover order saved');
      document.getElementById('failover-status').textContent = 'Saved';
      loadProviders();
    }
  }).catch(function(e) { toast('Error: ' + e.message); });
}

// --- MCP Servers ---
function loadMcpServers() {
  api('/mcp/servers').then(function(data) {
    var list = document.getElementById('mcp-servers-list');
    list.replaceChildren();
    var servers = data.servers || [];

    if (!servers.length) {
      var empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No extensions configured. Add one to extend Zubo with new tools.';
      list.appendChild(empty);
      return;
    }

    servers.forEach(function(s) {
      var card = document.createElement('div');
      card.style.cssText = 'display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);';

      var dot = document.createElement('span');
      dot.className = 'status-dot ' + (s.connected ? 'ok' : 'error');
      card.appendChild(dot);

      var info = document.createElement('div');
      info.style.cssText = 'flex:1;';

      var nameRow = document.createElement('div');
      nameRow.style.cssText = 'font-weight:600;font-size:14px;';
      nameRow.textContent = s.name;
      info.appendChild(nameRow);

      var detailRow = document.createElement('div');
      detailRow.style.cssText = 'font-size:12px;color:var(--text-secondary);margin-top:2px;';
      detailRow.textContent = s.command + (s.args.length ? ' ' + s.args.join(' ') : '') + ' \\u00B7 ' + s.tools + ' tools';
      info.appendChild(detailRow);

      card.appendChild(info);

      // Restart button
      var restartBtn = document.createElement('button');
      restartBtn.className = 'btn btn-ghost';
      restartBtn.style.cssText = 'font-size:11px;padding:4px 12px;';
      restartBtn.textContent = 'Restart';
      restartBtn.setAttribute('data-server', s.name);
      restartBtn.addEventListener('click', function() { restartMcpServer(this.getAttribute('data-server')); });
      card.appendChild(restartBtn);

      // Remove button
      var removeBtn = document.createElement('button');
      removeBtn.className = 'btn btn-ghost';
      removeBtn.style.cssText = 'font-size:11px;padding:4px 12px;color:var(--red);';
      removeBtn.textContent = 'Remove';
      removeBtn.setAttribute('data-server', s.name);
      removeBtn.addEventListener('click', function() { removeMcpServer(this.getAttribute('data-server')); });
      card.appendChild(removeBtn);

      list.appendChild(card);
    });
  }).catch(function(err) { console.warn('MCP servers load failed', err); });
}

function restartMcpServer(name) {
  toast('Restarting ' + name + '...');
  api('/mcp/servers/' + encodeURIComponent(name) + '/restart', { method: 'POST' }).then(function(data) {
    if (data.ok) {
      toast(name + ' restarted');
      loadMcpServers();
    } else {
      toast('Error: ' + (data.error || 'Unknown'));
    }
  }).catch(function(e) { toast('Error: ' + e.message); });
}

function removeMcpServer(name) {
  if (!confirm('Remove extension "' + name + '"? This will disconnect it.')) return;
  api('/mcp/servers/' + encodeURIComponent(name), { method: 'DELETE' }).then(function(data) {
    if (data.ok) {
      toast(name + ' removed');
      loadMcpServers();
    } else {
      toast('Error: ' + (data.error || 'Unknown'));
    }
  }).catch(function(e) { toast('Error: ' + e.message); });
}

function showAddMcpForm() {
  document.getElementById('mcp-add-form').style.display = '';
  document.getElementById('mcp-name').value = '';
  document.getElementById('mcp-command').value = '';
  document.getElementById('mcp-args').value = '';
  document.getElementById('mcp-env').value = '';
  document.getElementById('mcp-add-status').textContent = '';
}

function hideAddMcpForm() {
  document.getElementById('mcp-add-form').style.display = 'none';
}

function saveNewMcpServer() {
  var name = document.getElementById('mcp-name').value.trim();
  var command = document.getElementById('mcp-command').value.trim();
  var argsStr = document.getElementById('mcp-args').value.trim();
  var envStr = document.getElementById('mcp-env').value.trim();

  if (!name || !command) { toast('Name and command are required'); return; }

  var args = argsStr ? argsStr.split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [];
  var env = {};
  if (envStr) {
    envStr.split('\\n').forEach(function(line) {
      var eq = line.indexOf('=');
      if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    });
  }

  document.getElementById('mcp-add-status').textContent = 'Connecting...';
  api('/mcp/servers', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ name: name, command: command, args: args, env: env })
  }).then(function(data) {
    if (data.ok) {
      toast(name + ' added' + (data.connected ? ' and connected' : ''));
      if (data.error) document.getElementById('mcp-add-status').textContent = 'Warning: ' + data.error;
      else hideAddMcpForm();
      loadMcpServers();
    } else {
      document.getElementById('mcp-add-status').textContent = 'Error: ' + (data.error || 'Unknown');
    }
  }).catch(function(e) {
    document.getElementById('mcp-add-status').textContent = 'Error: ' + e.message;
  });
}

// --- OAuth Config Functions ---
function onOAuthProviderSelect() {
  var provider = document.getElementById('oauth-provider-select').value;
  var clientIdInput = document.getElementById('oauth-client-id');
  var clientSecretInput = document.getElementById('oauth-client-secret');
  var removeBtn = document.getElementById('oauth-remove-btn');
  var statusEl = document.getElementById('oauth-config-status');

  clientIdInput.value = '';
  clientSecretInput.value = '';
  statusEl.textContent = '';
  removeBtn.style.display = 'none';

  if (!provider) return;

  // Try to load existing config for this provider
  statusEl.textContent = 'Loading...';
  api('/oauth/status').then(function(data) {
    var connections = data.connections || [];
    var conn = connections.find(function(c) { return c.provider === provider; });
    if (conn && conn.configured) {
      clientIdInput.placeholder = 'Configured (hidden)';
      clientSecretInput.placeholder = 'Configured (hidden)';
      removeBtn.style.display = '';
      statusEl.textContent = 'Credentials saved. Update to replace.';
    } else {
      statusEl.textContent = '';
    }
  }).catch(function() { statusEl.textContent = ''; });
}

function saveOAuthConfig() {
  var provider = document.getElementById('oauth-provider-select').value;
  if (!provider) { toast('Select a provider first'); return; }
  var clientId = document.getElementById('oauth-client-id').value.trim();
  var clientSecret = document.getElementById('oauth-client-secret').value.trim();
  if (!clientId || !clientSecret) { toast('Client ID and secret are required'); return; }

  var statusEl = document.getElementById('oauth-config-status');
  statusEl.textContent = 'Saving...';

  api('/oauth/' + provider + '/config', {
    method: 'PUT',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ clientId: clientId, clientSecret: clientSecret })
  }).then(function(data) {
    if (data.ok) {
      toast(provider + ' credentials saved');
      statusEl.textContent = 'Saved';
      loadIntegrations();
    } else {
      statusEl.textContent = 'Error: ' + (data.error || 'Unknown');
    }
  }).catch(function(e) { statusEl.textContent = 'Error: ' + e.message; });
}

function removeOAuthConfig() {
  var provider = document.getElementById('oauth-provider-select').value;
  if (!provider) return;
  if (!confirm('Remove ' + provider + ' OAuth credentials?')) return;

  api('/oauth/' + provider + '/config', { method: 'DELETE' }).then(function(data) {
    if (data.ok) {
      toast(provider + ' credentials removed');
      document.getElementById('oauth-client-id').value = '';
      document.getElementById('oauth-client-secret').value = '';
      document.getElementById('oauth-remove-btn').style.display = 'none';
      document.getElementById('oauth-config-status').textContent = 'Removed';
      loadIntegrations();
    }
  }).catch(function(e) { toast('Error: ' + e.message); });
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
  }).catch(function(err) { console.warn('Dashboard API request failed', err); });
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

// --- SECRETS ---
function loadSecrets() {
  api('/secrets').then(function(data) {
    var list = document.getElementById('secrets-list');
    var empty = document.getElementById('secrets-empty');
    list.replaceChildren();
    var secrets = data.secrets || [];
    if (secrets.length === 0) {
      empty.style.display = '';
      return;
    }
    empty.style.display = 'none';
    secrets.forEach(function(s) {
      var isConfig = s.source === 'config';
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;';

      var nameEl = document.createElement('span');
      nameEl.style.cssText = 'font-family:var(--mono);font-size:13px;font-weight:500;color:var(--text);min-width:140px;';
      nameEl.textContent = s.name;

      var serviceEl = document.createElement('span');
      serviceEl.style.cssText = 'font-size:11px;color:var(--text-muted);min-width:80px;';
      if (isConfig) {
        var badge = document.createElement('span');
        badge.style.cssText = 'display:inline-block;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:600;background:rgba(124,58,237,0.15);color:var(--accent);';
        badge.textContent = 'config.json';
        serviceEl.textContent = '';
        serviceEl.appendChild(badge);
      } else {
        serviceEl.textContent = s.service || '';
      }

      var valueEl = document.createElement('span');
      valueEl.style.cssText = 'font-family:var(--mono);font-size:12px;color:var(--text-secondary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      valueEl.textContent = '\\u2022\\u2022\\u2022\\u2022\\u2022\\u2022\\u2022\\u2022';
      valueEl.dataset.secretName = s.name;
      valueEl.dataset.revealed = 'false';

      var revealBtn = document.createElement('button');
      revealBtn.className = 'btn btn-ghost';
      revealBtn.style.cssText = 'font-size:11px;padding:4px 10px;';
      revealBtn.textContent = 'Reveal';
      revealBtn.onclick = function() {
        if (valueEl.dataset.revealed === 'true') {
          valueEl.textContent = '\\u2022\\u2022\\u2022\\u2022\\u2022\\u2022\\u2022\\u2022';
          valueEl.dataset.revealed = 'false';
          revealBtn.textContent = 'Reveal';
          return;
        }
        revealBtn.textContent = 'Loading...';
        api('/secrets/' + encodeURIComponent(s.name)).then(function(d) {
          if (d.value !== undefined) {
            valueEl.textContent = d.value;
            valueEl.dataset.revealed = 'true';
            revealBtn.textContent = 'Hide';
          } else {
            revealBtn.textContent = 'Error';
          }
        }).catch(function() { revealBtn.textContent = 'Error'; });
      };

      row.appendChild(nameEl);
      row.appendChild(serviceEl);
      row.appendChild(valueEl);
      row.appendChild(revealBtn);

      if (!isConfig) {
        var editBtn = document.createElement('button');
        editBtn.className = 'btn btn-ghost';
        editBtn.style.cssText = 'font-size:11px;padding:4px 10px;';
        editBtn.textContent = 'Edit';
        editBtn.onclick = function() { editSecret(s.name, s.service); };

        var delBtn = document.createElement('button');
        delBtn.className = 'btn btn-ghost';
        delBtn.style.cssText = 'font-size:11px;padding:4px 10px;color:var(--red);';
        delBtn.textContent = 'Delete';
        delBtn.onclick = function() { deleteSecretUI(s.name); };

        row.appendChild(editBtn);
        row.appendChild(delBtn);
      }

      list.appendChild(row);
    });
  }).catch(function(err) { console.warn('Dashboard API request failed', err); });
}

function showAddSecretForm() {
  document.getElementById('secret-add-form').style.display = '';
  document.getElementById('secret-name-input').value = '';
  document.getElementById('secret-value-input').value = '';
  document.getElementById('secret-service-input').value = '';
  document.getElementById('secret-name-input').disabled = false;
  document.getElementById('secret-name-input').focus();
}

function hideAddSecretForm() {
  document.getElementById('secret-add-form').style.display = 'none';
}

function editSecret(name, service) {
  document.getElementById('secret-add-form').style.display = '';
  document.getElementById('secret-name-input').value = name;
  document.getElementById('secret-name-input').disabled = true;
  document.getElementById('secret-value-input').value = '';
  document.getElementById('secret-value-input').placeholder = 'Enter new value';
  document.getElementById('secret-service-input').value = service || '';
  document.getElementById('secret-value-input').focus();
}

function saveSecret() {
  var name = document.getElementById('secret-name-input').value.trim();
  var value = document.getElementById('secret-value-input').value;
  var service = document.getElementById('secret-service-input').value.trim();
  if (!name || !/^[a-z0-9_]+$/.test(name)) { toast('Name must be lowercase with underscores only'); return; }
  if (!value) { toast('Value is required'); return; }
  api('/secrets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name, value: value, service: service || undefined })
  }).then(function(data) {
    if (data.ok) {
      toast('Secret saved');
      hideAddSecretForm();
      loadSecrets();
    } else {
      toast(data.error || 'Error saving secret');
    }
  }).catch(function(e) { toast('Error: ' + e.message); });
}

function deleteSecretUI(name) {
  if (!confirm('Delete secret "' + name + '"? This cannot be undone.')) return;
  fetch('/api/dashboard/secrets/' + encodeURIComponent(name), { method: 'DELETE' })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.deleted) {
        toast('Secret deleted');
        loadSecrets();
      } else {
        toast('Secret not found');
      }
    }).catch(function(e) { toast('Error: ' + e.message); });
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
  }).catch(function(err) { console.warn('Dashboard API request failed', err); });
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

// --- MOBILE MENU ---
function toggleMobileMenu() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('mobile-overlay').classList.toggle('visible');
}
function closeMobileMenu() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('mobile-overlay').classList.remove('visible');
}

// --- COMMAND PALETTE ---
// Bind cmd-input listener once (not on every toggle)
(function() {
  var input = document.getElementById('cmd-input');
  if (input) input.addEventListener('input', function() { renderCmdResults(input.value); });
})();

function toggleCommandPalette() {
  var pal = document.getElementById('cmd-palette');
  if (pal.classList.contains('visible')) { closeCommandPalette(); return; }
  pal.classList.add('visible');
  var input = document.getElementById('cmd-input');
  input.value = '';
  input.focus();
  renderCmdResults('');
}

function closeCommandPalette() {
  document.getElementById('cmd-palette').classList.remove('visible');
}

function renderCmdResults(query) {
  var container = document.getElementById('cmd-results');
  container.replaceChildren();
  // Main panels + sub-tab shortcuts
  var items = panelNames.map(function(name) {
    return { name: name, title: panelTitles[name] || name, action: function() { showPanel(name); } };
  });
  // Add sub-tab items for quick access
  var subTabs = [
    { title: 'Analytics', action: function() { showPanel('dashboard'); switchTab('dashboard','analytics'); } },
    { title: 'Performance', action: function() { showPanel('dashboard'); switchTab('dashboard','performance'); } },
    { title: 'Personality', action: function() { showPanel('settings'); switchTab('settings','system'); } },
    { title: 'Scheduled Tasks', action: function() { showPanel('settings'); switchTab('settings','cron'); } },
    { title: 'Logs', action: function() { showPanel('settings'); switchTab('settings','logs'); } },
    { title: 'Privacy & Data', action: function() { showPanel('settings'); switchTab('settings','privacy'); } },
    { title: 'Budget', action: function() { showPanel('settings'); switchTab('settings','budget'); } },
    { title: 'API Keys', action: function() { showPanel('settings'); switchTab('settings','secrets'); } },
    { title: 'Channels', action: function() { showPanel('settings'); switchTab('settings','channels'); } },
    { title: 'Providers', action: function() { showPanel('settings'); switchTab('settings','providers'); } },
    { title: 'Extensions', action: function() { showPanel('settings'); switchTab('settings','mcp'); } },
    { title: 'Cost Savings', action: function() { showPanel('settings'); switchTab('settings','routing'); } },
    { title: 'Browse Registry', action: function() { showPanel('skills'); switchTab('skills','browse'); } },
    { title: 'Visual Builder', action: function() { showPanel('workflows'); switchTab('workflows','visual'); } },
    { title: 'Extensions Marketplace', action: function() { showPanel('mcp'); switchTab('mcp','marketplace'); } },
    { title: 'Models', action: function() { showPanel('models'); } },
    { title: 'Pull Model', action: function() { showPanel('models'); switchTab('models','available'); } },
    { title: 'Email Digests', action: function() { showPanel('settings'); switchTab('settings','digests'); } },
  ];
  subTabs.forEach(function(st) { items.push({ name: st.title.toLowerCase(), title: st.title, action: st.action }); });

  if (query) {
    items = items.filter(function(item) {
      return item.title.toLowerCase().includes(query.toLowerCase());
    });
  }
  items.forEach(function(item) {
    var div = document.createElement('div');
    div.className = 'cmd-result';
    div.textContent = item.title;
    div.onclick = function() { item.action(); closeCommandPalette(); };
    container.appendChild(div);
  });
}

// --- KEYBOARD SHORTCUTS ---
document.addEventListener('keydown', function(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    toggleCommandPalette();
  }
  if (e.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) {
    e.preventDefault();
    showPanel('agent');
    document.getElementById('chat-input').focus();
  }
  if (e.key === 'Escape') {
    closeCommandPalette();
  }
});

// --- CONVERSATION THREADS ---
var activeThreadId = null;

function loadThreads() {
  api('/threads').then(function(data) {
    var list = document.getElementById('thread-list');
    list.replaceChildren();
    var threads = data.threads || [];
    threads.forEach(function(t) {
      var item = document.createElement('div');
      item.className = 'thread-item' + (t.id === activeThreadId ? ' active' : '');
      item.textContent = t.title;
      item.onclick = function() { switchThread(t.id, t.title); };
      var del = document.createElement('button');
      del.className = 'thread-delete';
      del.textContent = '\\u00d7';
      del.onclick = function(e) { e.stopPropagation(); deleteThread(t.id); };
      item.appendChild(del);
      list.appendChild(item);
    });
  });
}

function createThread() {
  api('/threads', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({}) }).then(function(data) {
    activeThreadId = data.id;
    loadThreads();
    clearChatMessages();
    toast('New conversation started');
  });
}

function switchThread(id, title) {
  activeThreadId = id;
  loadThreads();
  api('/threads/' + encodeURIComponent(id) + '/messages').then(function(data) {
    var msgs = data.messages || [];
    clearChatMessages();
    if (msgs.length === 0) return;
    msgs.forEach(function(m) {
      var text = Array.isArray(m.content)
        ? m.content.filter(function(b) { return b.type === 'text'; }).map(function(b) { return b.text; }).join('\\n')
        : String(m.content || '');
      if (text) addChatMsg(text, m.role === 'user' ? 'user' : 'bot');
    });
  });
}

function deleteThread(id) {
  api('/threads/' + encodeURIComponent(id), { method: 'DELETE' }).then(function() {
    if (activeThreadId === id) {
      activeThreadId = null;
      clearChatMessages();
    }
    loadThreads();
    toast('Conversation deleted');
  });
}

function createSparkleSvg(gradId) {
  var ns = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '72');
  svg.setAttribute('height', '72');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('fill', 'none');
  var defs = document.createElementNS(ns, 'defs');
  var grad = document.createElementNS(ns, 'linearGradient');
  grad.setAttribute('id', gradId);
  grad.setAttribute('x1', '8'); grad.setAttribute('y1', '8');
  grad.setAttribute('x2', '92'); grad.setAttribute('y2', '92');
  var stop1 = document.createElementNS(ns, 'stop');
  stop1.setAttribute('offset', '0%'); stop1.setAttribute('stop-color', '#7c3aed');
  var stop2 = document.createElementNS(ns, 'stop');
  stop2.setAttribute('offset', '100%'); stop2.setAttribute('stop-color', '#d946ef');
  grad.appendChild(stop1); grad.appendChild(stop2);
  defs.appendChild(grad); svg.appendChild(defs);
  var path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M50 8C52.5 35 65 47.5 92 50C65 52.5 52.5 65 50 92C47.5 65 35 52.5 8 50C35 47.5 47.5 35 50 8Z');
  path.setAttribute('fill', 'url(#' + gradId + ')');
  path.setAttribute('opacity', '0.9');
  svg.appendChild(path);
  return svg;
}

function clearChatMessages() {
  var container = document.getElementById('chat-messages');
  container.replaceChildren();
  // Rebuild the mesh background
  var mesh = document.createElement('div');
  mesh.className = 'chat-welcome-mesh';
  container.appendChild(mesh);
  // Rebuild the welcome state
  var welcome = document.createElement('div');
  welcome.className = 'chat-empty chat-welcome';
  var sparkle = document.createElement('div');
  sparkle.className = 'chat-welcome-sparkle';
  sparkle.appendChild(createSparkleSvg('sparkleGrad2'));
  var heading = document.createElement('h3');
  heading.className = 'gradient-text';
  heading.id = 'chat-greeting';
  var subtext = document.createElement('div');
  subtext.className = 'chat-empty-text';
  subtext.textContent = 'Ask me anything, or try a suggestion below';
  var chipsGroup = document.createElement('div');
  chipsGroup.className = 'suggestion-chips-group';
  var rows = [['What can you do?','Set a reminder for tomorrow'],['Help me write an email','Explain something to me']];
  rows.forEach(function(rowLabels) {
    var row = document.createElement('div');
    row.className = 'chip-row';
    rowLabels.forEach(function(label) {
      var chip = document.createElement('button');
      chip.className = 'suggestion-chip';
      chip.textContent = label;
      chip.onclick = function() { useSuggestion(chip); };
      row.appendChild(chip);
    });
    chipsGroup.appendChild(row);
  });
  welcome.appendChild(sparkle);
  welcome.appendChild(heading);
  welcome.appendChild(subtext);
  welcome.appendChild(chipsGroup);
  container.appendChild(welcome);
  updateGreeting();
}

// --- EXPORT THREAD ---
function exportThread() {
  var id = activeThreadId;
  if (!id) { toast('No conversation to export'); return; }
  fetch('/api/dashboard/threads/' + id + '/export').then(function(r) {
    if (!r.ok) throw new Error('Export failed');
    return r.blob();
  }).then(function(blob) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'conversation.md';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Conversation exported');
  }).catch(function(e) { toast('Export failed: ' + e.message); });
}

// Auto-refresh status every 30s (when settings panel visible tabs are active)
setInterval(function() {
  if (document.getElementById('panel-settings').classList.contains('active')) {
    var channelsTab = document.getElementById('settings-tab-channels');
    if (channelsTab && channelsTab.classList.contains('active')) loadChannelStatus();
    var mcpTab = document.getElementById('settings-tab-mcp');
    if (mcpTab && mcpTab.classList.contains('active')) loadMcpServers();
  }
}, 30000);

// ============================================================
// CONVERSATION HISTORY
// ============================================================
var activeConvId = null;

function loadHistory() {
  loadConversationStats();
  loadConversations();
}

function loadConversationStats() {
  api('/conversations/stats').then(function(data) {
    var row = document.getElementById('conv-stats-row');
    if (!row) return;
    row.replaceChildren();
    var stats = [
      { label: 'Conversations', value: data.totalConversations || 0 },
      { label: 'Messages', value: data.totalMessages || 0 },
      { label: 'Channels', value: (data.messagesByChannel || []).length },
      { label: 'Recent (24h)', value: (data.recentActivity || []).reduce(function(s, r) { return s + (r.count || 0); }, 0) },
    ];
    stats.forEach(function(s) {
      var card = document.createElement('div');
      card.className = 'stat-card';
      var lbl = document.createElement('div');
      lbl.className = 'stat-label';
      lbl.textContent = s.label;
      var val = document.createElement('div');
      val.className = 'stat-value';
      val.textContent = s.value;
      card.appendChild(lbl);
      card.appendChild(val);
      row.appendChild(card);
    });
  }).catch(function() {});
}

function loadConversations() {
  var channel = document.getElementById('conv-channel-filter').value;
  var url = '/conversations?limit=50' + (channel ? '&channel=' + channel : '');
  api(url).then(function(data) {
    var list = document.getElementById('conv-list');
    list.replaceChildren();
    var convs = data.conversations || [];
    if (!convs.length) {
      var msg = document.createElement('div');
      msg.className = 'empty-state';
      msg.style.padding = '40px 16px';
      msg.textContent = 'No conversations found.';
      list.appendChild(msg);
      return;
    }
    convs.forEach(function(c) {
      var item = document.createElement('div');
      item.className = 'conv-item' + (c.id === activeConvId ? ' active' : '');
      var title = document.createElement('div');
      title.className = 'conv-item-title';
      title.textContent = c.title || c.id;
      item.appendChild(title);
      var meta = document.createElement('div');
      meta.className = 'conv-item-meta';
      var ch = c.channel || 'webchat';
      var chBadge = document.createElement('span');
      chBadge.className = 'conv-item-channel ' + ch;
      chBadge.textContent = ch;
      meta.appendChild(chBadge);
      var time = document.createElement('span');
      time.className = 'conv-item-time';
      time.textContent = timeAgo(c.updated_at || c.created_at);
      meta.appendChild(time);
      var count = document.createElement('span');
      count.className = 'conv-item-count';
      count.textContent = (c.message_count || 0) + ' msgs';
      meta.appendChild(count);
      item.appendChild(meta);
      item.onclick = function() { openConversation(c.id, c.title || c.id); };
      list.appendChild(item);
    });
  }).catch(function() {});
}

function openConversation(id, title) {
  activeConvId = id;
  document.querySelectorAll('.conv-item').forEach(function(i) { i.classList.remove('active'); });
  var header = document.getElementById('conv-detail-header');
  header.style.display = 'flex';
  document.getElementById('conv-detail-title').textContent = title;
  var msgs = document.getElementById('conv-messages');
  msgs.replaceChildren();
  var loading = document.createElement('div');
  loading.className = 'empty-state';
  loading.textContent = 'Loading...';
  msgs.appendChild(loading);
  // Re-highlight in list
  document.querySelectorAll('.conv-item').forEach(function(item) {
    var t = item.querySelector('.conv-item-title');
    if (t && t.textContent === title) item.classList.add('active');
  });
  api('/conversations/' + encodeURIComponent(id) + '/messages?limit=100').then(function(data) {
    msgs.replaceChildren();
    var messages = data.messages || [];
    if (!messages.length) {
      var e = document.createElement('div');
      e.className = 'empty-state';
      e.textContent = 'No messages in this conversation.';
      msgs.appendChild(e);
      return;
    }
    messages.forEach(function(m) {
      var div = document.createElement('div');
      div.className = 'conv-msg ' + (m.role === 'user' ? 'user' : 'assistant');
      div.textContent = m.content;
      var tm = document.createElement('div');
      tm.className = 'conv-msg-time';
      tm.textContent = m.timestamp ? new Date(m.timestamp).toLocaleString() : '';
      div.appendChild(tm);
      msgs.appendChild(div);
    });
    msgs.scrollTop = msgs.scrollHeight;
  }).catch(function() {
    msgs.replaceChildren();
    var e = document.createElement('div');
    e.className = 'empty-state';
    e.textContent = 'Failed to load messages.';
    msgs.appendChild(e);
  });
}

function searchConversations() {
  var q = document.getElementById('conv-search').value.trim();
  if (!q) { loadConversations(); return; }
  api('/conversations/search?q=' + encodeURIComponent(q) + '&limit=30').then(function(data) {
    var list = document.getElementById('conv-list');
    list.replaceChildren();
    var results = data.results || [];
    if (!results.length) {
      var e = document.createElement('div');
      e.className = 'empty-state';
      e.style.padding = '40px 16px';
      e.textContent = 'No results for "' + q + '"';
      list.appendChild(e);
      return;
    }
    results.forEach(function(r) {
      var item = document.createElement('div');
      item.className = 'conv-item';
      var title = document.createElement('div');
      title.className = 'conv-item-title';
      title.textContent = (r.content || '').substring(0, 80);
      item.appendChild(title);
      var meta = document.createElement('div');
      meta.className = 'conv-item-meta';
      var roleBadge = document.createElement('span');
      roleBadge.className = 'conv-item-channel';
      roleBadge.textContent = r.role || '';
      meta.appendChild(roleBadge);
      var tid = document.createElement('span');
      tid.className = 'conv-item-time';
      tid.textContent = r.thread_id || '';
      meta.appendChild(tid);
      item.appendChild(meta);
      item.onclick = function() { openConversation(r.thread_id, r.thread_id); };
      list.appendChild(item);
    });
  }).catch(function() {});
}

function exportConversation() {
  if (!activeConvId) { toast('Select a conversation first'); return; }
  api('/conversations/' + encodeURIComponent(activeConvId) + '/messages?limit=999').then(function(data) {
    var msgs = data.messages || [];
    var md = '# Conversation: ' + activeConvId + '\\n\\n';
    msgs.forEach(function(m) {
      md += '**' + m.role + '** (' + (m.timestamp || '') + ')\\n' + m.content + '\\n\\n---\\n\\n';
    });
    var blob = new Blob([md], { type: 'text/markdown' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'conversation-' + activeConvId.replace(/[^a-z0-9]/gi, '_') + '.md';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Conversation exported');
  });
}

function deleteConversation() {
  if (!activeConvId) return;
  if (!confirm('Delete this conversation?')) return;
  api('/threads/' + encodeURIComponent(activeConvId), { method: 'DELETE' }).then(function() {
    activeConvId = null;
    document.getElementById('conv-detail-header').style.display = 'none';
    var msgs = document.getElementById('conv-messages');
    msgs.replaceChildren();
    var e = document.createElement('div');
    e.className = 'empty-state-card';
    var h = document.createElement('h4');
    h.textContent = 'Select a conversation';
    e.appendChild(h);
    msgs.appendChild(e);
    loadConversations();
    toast('Conversation deleted');
  }).catch(function() { toast('Failed to delete'); });
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  var d = new Date(dateStr);
  var now = Date.now();
  var diff = Math.floor((now - d.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  return d.toLocaleDateString();
}

function escHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================
// WEBHOOKS
// ============================================================
function loadWebhooks() {
  api('/webhooks').then(function(data) {
    var list = document.getElementById('webhooks-list');
    var empty = document.getElementById('webhooks-empty');
    list.replaceChildren();
    var webhooks = data.webhooks || [];
    empty.style.display = webhooks.length ? 'none' : 'flex';
    webhooks.forEach(function(wh) {
      var card = document.createElement('div');
      card.className = 'webhook-card';
      var whUrl = window.location.origin + '/api/webhook/' + wh.id;
      // Header
      var hdr = document.createElement('div');
      hdr.className = 'webhook-card-header';
      var nameSpan = document.createElement('span');
      nameSpan.className = 'webhook-card-name';
      var dot = document.createElement('span');
      dot.className = 'status-dot ' + (wh.active ? 'ok' : 'error');
      nameSpan.appendChild(dot);
      nameSpan.appendChild(document.createTextNode(wh.name));
      hdr.appendChild(nameSpan);
      card.appendChild(hdr);
      // Description
      if (wh.description) {
        var desc = document.createElement('div');
        desc.style.cssText = 'font-size:12px;color:var(--text-secondary);margin-bottom:6px;';
        desc.textContent = wh.description;
        card.appendChild(desc);
      }
      // URL
      var urlEl = document.createElement('div');
      urlEl.className = 'webhook-card-url';
      urlEl.textContent = whUrl;
      urlEl.setAttribute('data-tooltip', 'Click to copy');
      urlEl.onclick = function() { copyToClipboard(whUrl); };
      card.appendChild(urlEl);
      // Localhost warning
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        var warn = document.createElement('div');
        warn.style.cssText = 'font-size:11px;color:var(--yellow,#f5a623);margin-top:4px;padding:6px 8px;background:rgba(245,166,35,0.08);border-radius:4px;line-height:1.4;';
        warn.textContent = 'This URL uses localhost and won\\'t be reachable by external services. Use a tunnel (ngrok, cloudflared) or deploy to a public server to receive webhooks.';
        card.appendChild(warn);
      }
      // Stats
      var stats = document.createElement('div');
      stats.className = 'webhook-card-stats';
      var trig = document.createElement('span');
      trig.textContent = 'Triggered: ' + (wh.trigger_count || 0) + ' times';
      stats.appendChild(trig);
      if (wh.last_triggered_at) {
        var last = document.createElement('span');
        last.textContent = 'Last: ' + timeAgo(wh.last_triggered_at);
        stats.appendChild(last);
      }
      card.appendChild(stats);
      // Actions
      var actions = document.createElement('div');
      actions.className = 'webhook-card-actions';
      var testBtn = document.createElement('button');
      testBtn.className = 'btn btn-ghost btn-sm';
      testBtn.textContent = 'Test';
      testBtn.onclick = function() { testWebhook(wh.id); };
      actions.appendChild(testBtn);
      var eventsBtn = document.createElement('button');
      eventsBtn.className = 'btn btn-ghost btn-sm';
      eventsBtn.textContent = 'Events';
      eventsBtn.onclick = function() { toggleWebhookEvents(wh.id); };
      actions.appendChild(eventsBtn);
      var delBtn = document.createElement('button');
      delBtn.className = 'btn btn-ghost btn-sm';
      delBtn.style.color = 'var(--red)';
      delBtn.textContent = 'Delete';
      delBtn.onclick = function() { deleteWebhook(wh.id); };
      actions.appendChild(delBtn);
      card.appendChild(actions);
      // Events container
      var evContainer = document.createElement('div');
      evContainer.className = 'webhook-events-list';
      evContainer.id = 'wh-events-' + wh.id;
      evContainer.style.display = 'none';
      card.appendChild(evContainer);
      list.appendChild(card);
    });
  }).catch(function() {});
}

function showCreateWebhookForm() { document.getElementById('webhook-create-form').style.display = 'block'; }
function hideCreateWebhookForm() { document.getElementById('webhook-create-form').style.display = 'none'; }

function createWebhook() {
  var body = {
    name: document.getElementById('wh-name').value.trim(),
    description: document.getElementById('wh-desc').value.trim(),
    secret: document.getElementById('wh-secret').value.trim() || undefined,
    prompt_template: document.getElementById('wh-prompt').value.trim() || undefined,
  };
  if (!body.name) { toast('Name is required'); return; }
  api('/webhooks', {
    method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)
  }).then(function() {
    hideCreateWebhookForm();
    document.getElementById('wh-name').value = '';
    document.getElementById('wh-desc').value = '';
    document.getElementById('wh-secret').value = '';
    document.getElementById('wh-prompt').value = '';
    loadWebhooks();
    toast('Webhook created');
  }).catch(function(e) { toast('Failed: ' + e.message); });
}

function deleteWebhook(id) {
  if (!confirm('Delete this webhook?')) return;
  api('/webhooks/' + id, { method: 'DELETE' }).then(function() {
    loadWebhooks();
    toast('Webhook deleted');
  });
}

function testWebhook(id) {
  api('/webhooks/' + id + '/test', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ test: true }) })
    .then(function() { toast('Test payload sent'); })
    .catch(function() { toast('Test failed'); });
}

function toggleWebhookEvents(id) {
  var container = document.getElementById('wh-events-' + id);
  if (container.style.display !== 'none') { container.style.display = 'none'; return; }
  container.style.display = 'block';
  container.replaceChildren();
  var loadMsg = document.createElement('div');
  loadMsg.className = 'empty-state';
  loadMsg.style.padding = '10px';
  loadMsg.textContent = 'Loading...';
  container.appendChild(loadMsg);
  api('/webhooks/' + id + '/events?limit=10').then(function(data) {
    container.replaceChildren();
    var events = data.events || [];
    if (!events.length) {
      var e = document.createElement('div');
      e.className = 'empty-state';
      e.style.cssText = 'padding:10px;font-size:12px;';
      e.textContent = 'No events yet';
      container.appendChild(e);
      return;
    }
    events.forEach(function(ev) {
      var item = document.createElement('div');
      item.className = 'webhook-event-item';
      var timeSpan = document.createElement('span');
      timeSpan.textContent = timeAgo(ev.created_at);
      item.appendChild(timeSpan);
      var statusDot = document.createElement('span');
      statusDot.className = 'status-dot ' + (ev.processed ? 'ok' : 'error');
      item.appendChild(statusDot);
      var payload = document.createElement('div');
      payload.className = 'webhook-event-payload';
      try { payload.textContent = JSON.stringify(JSON.parse(ev.payload), null, 2); } catch(e2) { payload.textContent = ev.payload; }
      payload.style.display = 'none';
      item.style.cursor = 'pointer';
      item.onclick = function() { payload.style.display = payload.style.display === 'none' ? 'block' : 'none'; };
      container.appendChild(item);
      container.appendChild(payload);
    });
  });
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(function() { toast('Copied to clipboard'); });
}

// ============================================================
// MCP MARKETPLACE
// ============================================================
function loadMcpPanel() {
  loadMcpInstalled();
}

function loadMcpInstalled() {
  api('/mcp/servers').then(function(data) {
    var list = document.getElementById('mcp-installed-list');
    var empty = document.getElementById('mcp-installed-empty');
    list.replaceChildren();
    var servers = data.servers || [];
    empty.style.display = servers.length ? 'none' : 'flex';
    servers.forEach(function(s) {
      var card = document.createElement('div');
      card.className = 'mcp-server-card';
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';
      var info = document.createElement('div');
      var nameDiv = document.createElement('div');
      nameDiv.className = 'mcp-server-card-name';
      var dot = document.createElement('span');
      dot.className = 'status-dot ' + (s.status === 'connected' ? 'ok' : 'error');
      nameDiv.appendChild(dot);
      nameDiv.appendChild(document.createTextNode(s.name));
      info.appendChild(nameDiv);
      var toolsDiv = document.createElement('div');
      toolsDiv.style.cssText = 'font-size:12px;color:var(--text-muted);';
      toolsDiv.textContent = (s.tools || 0) + ' tools';
      info.appendChild(toolsDiv);
      row.appendChild(info);
      var btns = document.createElement('div');
      btns.style.cssText = 'display:flex;gap:8px;';
      var restartBtn = document.createElement('button');
      restartBtn.className = 'btn btn-ghost btn-sm';
      restartBtn.textContent = 'Restart';
      restartBtn.onclick = (function(name) { return function() { restartMcpServer(name); }; })(s.name);
      btns.appendChild(restartBtn);
      var uninstallBtn = document.createElement('button');
      uninstallBtn.className = 'btn btn-ghost btn-sm';
      uninstallBtn.style.color = 'var(--red)';
      uninstallBtn.textContent = 'Uninstall';
      uninstallBtn.onclick = (function(name) { return function() { uninstallMcpServer(name); }; })(s.name);
      btns.appendChild(uninstallBtn);
      row.appendChild(btns);
      card.appendChild(row);
      list.appendChild(card);
    });
  }).catch(function() {});
}

function searchMcpMarketplace() {
  var q = document.getElementById('mcp-marketplace-search').value.trim();
  var url = '/mcp/marketplace' + (q ? '?q=' + encodeURIComponent(q) : '');
  var grid = document.getElementById('mcp-marketplace-results');
  var empty = document.getElementById('mcp-marketplace-empty');
  grid.replaceChildren();
  api(url).then(function(data) {
    var servers = data.servers || [];
    empty.style.display = servers.length ? 'none' : 'flex';
    servers.forEach(function(s) {
      var card = document.createElement('div');
      card.className = 'mcp-server-card';
      var name = document.createElement('div');
      name.className = 'mcp-server-card-name';
      name.textContent = s.name;
      card.appendChild(name);
      var desc = document.createElement('div');
      desc.className = 'mcp-server-card-desc';
      desc.textContent = s.description || '';
      card.appendChild(desc);
      var acts = document.createElement('div');
      acts.className = 'mcp-server-card-actions';
      var repoUrl = typeof s.repository === 'string' ? s.repository : (s.repository && s.repository.url ? s.repository.url : '');
      if (repoUrl) {
        var link = document.createElement('a');
        link.href = repoUrl;
        link.target = '_blank';
        link.style.cssText = 'font-size:12px;color:var(--text-muted);';
        link.textContent = 'View Repo';
        acts.appendChild(link);
      } else {
        acts.appendChild(document.createElement('span'));
      }
      var installBtn = document.createElement('button');
      installBtn.className = 'btn btn-primary btn-sm';
      installBtn.textContent = 'Install';
      installBtn.onclick = (function(serverName, btn) {
        return function() { installMcpServer(serverName, btn); };
      })(s.name, installBtn);
      acts.appendChild(installBtn);
      card.appendChild(acts);
      grid.appendChild(card);
    });
  }).catch(function() { empty.style.display = 'flex'; });
}

function installMcpServer(name, btn) {
  btn.disabled = true;
  btn.textContent = 'Installing...';
  api('/mcp/marketplace/' + encodeURIComponent(name) + '/install', { method: 'POST' })
    .then(function(data) {
      btn.textContent = 'Installed';
      btn.className = 'btn btn-ghost btn-sm';
      btn.style.color = 'var(--green)';
      toast('Installed ' + name + ' (' + (data.tools || 0) + ' tools)');
      loadMcpInstalled();
    })
    .catch(function(e) {
      btn.disabled = false;
      btn.textContent = 'Install';
      toast('Install failed: ' + (e.message || 'Unknown error'));
    });
}

function uninstallMcpServer(name) {
  if (!confirm('Uninstall ' + name + '?')) return;
  api('/mcp/servers/' + encodeURIComponent(name) + '/uninstall', { method: 'POST' })
    .then(function() { loadMcpInstalled(); toast(name + ' uninstalled'); })
    .catch(function() { toast('Uninstall failed'); });
}

function restartMcpServer(name) {
  api('/mcp/servers/' + encodeURIComponent(name) + '/restart', { method: 'POST' })
    .then(function() { toast(name + ' restarting...'); setTimeout(loadMcpInstalled, 2000); })
    .catch(function() { toast('Restart failed'); });
}

// ============================================================
// VISUAL WORKFLOWS
// ============================================================
var vwBlocks = [];
var vwSelectedBlock = null;
var vwEditingId = null;

function loadVisualWorkflows() {
  api('/visual-workflows').then(function(data) {
    var list = document.getElementById('vw-list');
    var empty = document.getElementById('vw-empty');
    list.replaceChildren();
    var wfs = data.workflows || [];
    empty.style.display = wfs.length ? 'none' : 'flex';
    wfs.forEach(function(wf) {
      var card = document.createElement('div');
      card.className = 'vw-card';
      // Header
      var hdr = document.createElement('div');
      hdr.className = 'vw-card-header';
      var n = document.createElement('span');
      n.className = 'vw-card-name';
      n.textContent = wf.name;
      hdr.appendChild(n);
      var badge = document.createElement('span');
      badge.className = 'vw-trigger-badge ' + wf.trigger_type;
      badge.textContent = wf.trigger_type;
      hdr.appendChild(badge);
      card.appendChild(hdr);
      // Description
      if (wf.description) {
        var d = document.createElement('div');
        d.className = 'vw-card-desc';
        d.textContent = wf.description;
        card.appendChild(d);
      }
      // Meta
      var meta = document.createElement('div');
      meta.className = 'vw-card-meta';
      var runs = document.createElement('span');
      runs.textContent = 'Runs: ' + (wf.run_count || 0);
      meta.appendChild(runs);
      if (wf.last_run_at) {
        var lr = document.createElement('span');
        lr.textContent = 'Last: ' + timeAgo(wf.last_run_at);
        meta.appendChild(lr);
      }
      var st = document.createElement('span');
      st.textContent = wf.enabled ? '\\u2705 Active' : '\\u274c Disabled';
      meta.appendChild(st);
      card.appendChild(meta);
      // Actions
      var acts = document.createElement('div');
      acts.style.cssText = 'margin-top:10px;display:flex;gap:8px;';
      var editBtn = document.createElement('button');
      editBtn.className = 'btn btn-ghost btn-sm';
      editBtn.textContent = 'Edit';
      editBtn.onclick = function(e) { e.stopPropagation(); editVisualWorkflow(wf.id); };
      acts.appendChild(editBtn);
      var runBtn = document.createElement('button');
      runBtn.className = 'btn btn-ghost btn-sm';
      runBtn.textContent = 'Run';
      runBtn.onclick = function(e) { e.stopPropagation(); runVisualWorkflowById(wf.id); };
      acts.appendChild(runBtn);
      var togBtn = document.createElement('button');
      togBtn.className = 'btn btn-ghost btn-sm';
      togBtn.textContent = wf.enabled ? 'Disable' : 'Enable';
      togBtn.onclick = function(e) { e.stopPropagation(); toggleVisualWorkflow(wf.id, wf.enabled ? 0 : 1); };
      acts.appendChild(togBtn);
      var delBtn = document.createElement('button');
      delBtn.className = 'btn btn-ghost btn-sm';
      delBtn.style.color = 'var(--red)';
      delBtn.textContent = 'Delete';
      delBtn.onclick = function(e) { e.stopPropagation(); deleteVisualWorkflow(wf.id); };
      acts.appendChild(delBtn);
      card.appendChild(acts);
      list.appendChild(card);
    });
  }).catch(function() {});
}

function openVisualBuilder(id) {
  vwBlocks = [];
  vwSelectedBlock = null;
  vwEditingId = id || null;
  document.getElementById('vw-builder-name').value = '';
  document.getElementById('vw-builder-trigger').value = 'manual';
  document.getElementById('vw-builder-schedule').style.display = 'none';
  document.getElementById('vw-builder-webhook').style.display = 'none';
  var canvasInner = document.getElementById('vw-canvas-inner');
  canvasInner.replaceChildren();
  var emptyEl = document.createElement('div');
  emptyEl.className = 'empty-state-card';
  emptyEl.id = 'vw-canvas-empty';
  var h = document.createElement('h4');
  h.textContent = 'Drag blocks here to build your workflow';
  var p = document.createElement('p');
  p.textContent = 'Add steps from the palette on the left.';
  emptyEl.appendChild(h);
  emptyEl.appendChild(p);
  canvasInner.appendChild(emptyEl);
  var propsContent = document.getElementById('vw-props-content');
  propsContent.replaceChildren();
  var propsMsg = document.createElement('p');
  propsMsg.className = 'settings-desc';
  propsMsg.textContent = 'Select a block to edit its properties.';
  propsContent.appendChild(propsMsg);

  if (id) {
    api('/visual-workflows/' + id).then(function(data) {
      var wf = data.workflow || data;
      document.getElementById('vw-builder-name').value = wf.name || '';
      document.getElementById('vw-builder-trigger').value = wf.trigger_type || 'manual';
      onVwTriggerChange();
      try {
        var tc = JSON.parse(wf.trigger_config || '{}');
        if (tc.schedule) document.getElementById('vw-builder-schedule').value = tc.schedule;
      } catch(e) {}
      try {
        var steps = JSON.parse(wf.steps || '[]');
        steps.forEach(function(s) { addVwBlock(s.type, s); });
      } catch(e) {}
    });
  }

  document.getElementById('vw-builder').classList.add('visible');
}

function closeVisualBuilder() {
  document.getElementById('vw-builder').classList.remove('visible');
  loadVisualWorkflows();
}

function onVwTriggerChange() {
  var v = document.getElementById('vw-builder-trigger').value;
  document.getElementById('vw-builder-schedule').style.display = v === 'cron' ? 'inline-block' : 'none';
  document.getElementById('vw-builder-webhook').style.display = v === 'webhook' ? 'inline-block' : 'none';
}

function editVisualWorkflow(id) { openVisualBuilder(id); }

function runVisualWorkflowById(id) {
  api('/visual-workflows/' + id + '/run', { method: 'POST' })
    .then(function(data) { toast(data.success ? 'Workflow completed' : 'Workflow failed: ' + (data.error || '')); })
    .catch(function() { toast('Run failed'); });
}

function toggleVisualWorkflow(id, enabled) {
  api('/visual-workflows/' + id + '/toggle', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ enabled: enabled }) })
    .then(function() { loadVisualWorkflows(); toast(enabled ? 'Enabled' : 'Disabled'); });
}

function deleteVisualWorkflow(id) {
  if (!confirm('Delete this workflow?')) return;
  api('/visual-workflows/' + id, { method: 'DELETE' }).then(function() { loadVisualWorkflows(); toast('Deleted'); });
}

var vwBlockCounter = 0;

function addVwBlock(type, existingStep) {
  var canvas = document.getElementById('vw-canvas-inner');
  var empty = document.getElementById('vw-canvas-empty');
  if (empty) empty.style.display = 'none';

  var id = existingStep ? existingStep.id : 'step_' + (++vwBlockCounter);
  var config = existingStep ? existingStep.config : {};
  var labels = { tool: 'Tool Call', agent: 'Agent Prompt', message: 'Send Message', condition: 'Condition', delay: 'Delay' };

  var block = document.createElement('div');
  block.className = 'vw-block';
  block.dataset.id = id;
  block.dataset.type = type;
  var typeLabel = document.createElement('div');
  typeLabel.className = 'vw-block-type';
  typeLabel.textContent = labels[type] || type;
  block.appendChild(typeLabel);
  var blockLabel = document.createElement('div');
  blockLabel.className = 'vw-block-label';
  blockLabel.id = 'vw-label-' + id;
  blockLabel.textContent = config.toolName || config.prompt || config.text || config.expression || (config.seconds ? config.seconds + 's' : '') || 'Configure...';
  block.appendChild(blockLabel);
  var removeBtn = document.createElement('button');
  removeBtn.style.cssText = 'position:absolute;top:6px;right:8px;background:none;border:none;color:var(--text-faint);cursor:pointer;font-size:14px;';
  removeBtn.textContent = '\\u00d7';
  removeBtn.onclick = (function(blockId) { return function() { removeVwBlock(blockId); }; })(id);
  block.appendChild(removeBtn);
  block.onclick = function(e) { if (e.target.tagName !== 'BUTTON') selectVwBlock(id); };
  canvas.appendChild(block);

  vwBlocks.push({ id: id, type: type, config: config, next: null });
  if (vwBlocks.length > 1) {
    vwBlocks[vwBlocks.length - 2].next = id;
  }
}

function removeVwBlock(id) {
  vwBlocks = vwBlocks.filter(function(b) { return b.id !== id; });
  var el = document.querySelector('.vw-block[data-id="'+id+'"]');
  if (el) el.remove();
  if (vwSelectedBlock === id) {
    vwSelectedBlock = null;
    var propsContent = document.getElementById('vw-props-content');
    propsContent.replaceChildren();
    var p = document.createElement('p');
    p.className = 'settings-desc';
    p.textContent = 'Select a block to edit its properties.';
    propsContent.appendChild(p);
  }
  if (!vwBlocks.length) {
    var empty = document.getElementById('vw-canvas-empty');
    if (empty) empty.style.display = 'flex';
  }
  for (var i = 0; i < vwBlocks.length; i++) {
    vwBlocks[i].next = (i < vwBlocks.length - 1) ? vwBlocks[i + 1].id : null;
  }
}

function selectVwBlock(id) {
  vwSelectedBlock = id;
  document.querySelectorAll('.vw-block').forEach(function(b) { b.classList.remove('selected'); });
  var el = document.querySelector('.vw-block[data-id="'+id+'"]');
  if (el) el.classList.add('selected');
  var block = vwBlocks.find(function(b) { return b.id === id; });
  if (!block) return;

  var props = document.getElementById('vw-props-content');
  props.replaceChildren();
  var grid = document.createElement('div');
  grid.className = 'settings-grid';

  function makeField(label, inputEl) {
    var f = document.createElement('div');
    f.className = 'settings-field';
    var l = document.createElement('label');
    l.className = 'settings-label';
    l.textContent = label;
    f.appendChild(l);
    f.appendChild(inputEl);
    return f;
  }

  if (block.type === 'tool') {
    var inp1 = document.createElement('input');
    inp1.className = 'settings-input';
    inp1.value = block.config.toolName || '';
    inp1.onchange = function() { updateVwProp('toolName', inp1.value); };
    grid.appendChild(makeField('Tool Name', inp1));
    var ta1 = document.createElement('textarea');
    ta1.className = 'settings-input';
    ta1.rows = 3;
    ta1.style.cssText = 'font-family:var(--mono);font-size:12px;';
    ta1.value = JSON.stringify(block.config.input || {});
    ta1.onchange = function() { updateVwPropJson('input', ta1.value); };
    grid.appendChild(makeField('Input (JSON)', ta1));
  } else if (block.type === 'agent') {
    var ta2 = document.createElement('textarea');
    ta2.className = 'settings-input';
    ta2.rows = 4;
    ta2.value = block.config.prompt || '';
    ta2.onchange = function() { updateVwProp('prompt', ta2.value); };
    grid.appendChild(makeField('Prompt', ta2));
  } else if (block.type === 'message') {
    var ta3 = document.createElement('textarea');
    ta3.className = 'settings-input';
    ta3.rows = 3;
    ta3.value = block.config.text || '';
    ta3.onchange = function() { updateVwProp('text', ta3.value); };
    grid.appendChild(makeField('Message Text', ta3));
  } else if (block.type === 'condition') {
    var inp2 = document.createElement('input');
    inp2.className = 'settings-input';
    inp2.value = block.config.sourceStepId || '';
    inp2.onchange = function() { updateVwProp('sourceStepId', inp2.value); };
    grid.appendChild(makeField('Source Step ID', inp2));
    var inp3 = document.createElement('input');
    inp3.className = 'settings-input';
    inp3.value = block.config.expression || '';
    inp3.placeholder = 'contains:X, equals:X, or truthy';
    inp3.onchange = function() { updateVwProp('expression', inp3.value); };
    grid.appendChild(makeField('Expression', inp3));
  } else if (block.type === 'delay') {
    var inp4 = document.createElement('input');
    inp4.className = 'settings-input';
    inp4.type = 'number';
    inp4.min = '1';
    inp4.max = '300';
    inp4.value = block.config.seconds || 5;
    inp4.onchange = function() { updateVwProp('seconds', Number(inp4.value)); };
    grid.appendChild(makeField('Seconds', inp4));
  }
  props.appendChild(grid);
}

function updateVwProp(key, value) {
  var block = vwBlocks.find(function(b) { return b.id === vwSelectedBlock; });
  if (block) {
    block.config[key] = value;
    var label = document.getElementById('vw-label-' + block.id);
    if (label) label.textContent = String(value || 'Configure...');
  }
}

function updateVwPropJson(key, value) {
  try {
    var block = vwBlocks.find(function(b) { return b.id === vwSelectedBlock; });
    if (block) block.config[key] = JSON.parse(value);
  } catch(e) { toast('Invalid JSON'); }
}

function saveVisualWorkflow() {
  var name = document.getElementById('vw-builder-name').value.trim();
  if (!name) { toast('Workflow name is required'); return; }
  var trigger_type = document.getElementById('vw-builder-trigger').value;
  var trigger_config = {};
  if (trigger_type === 'cron') trigger_config.schedule = document.getElementById('vw-builder-schedule').value;
  if (trigger_type === 'webhook') trigger_config.webhookId = document.getElementById('vw-builder-webhook').value;

  var body = {
    name: name,
    trigger_type: trigger_type,
    trigger_config: JSON.stringify(trigger_config),
    steps: JSON.stringify(vwBlocks.map(function(b) { return { id: b.id, type: b.type, config: b.config, next: b.next }; })),
    canvas_data: JSON.stringify({ blocks: vwBlocks }),
  };

  var url = vwEditingId ? '/visual-workflows/' + vwEditingId : '/visual-workflows';
  var method = vwEditingId ? 'PUT' : 'POST';
  api(url, { method: method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) })
    .then(function() { toast('Workflow saved'); closeVisualBuilder(); })
    .catch(function(e) { toast('Save failed: ' + (e.message || '')); });
}

function runVisualWorkflow() {
  if (!vwEditingId) { toast('Save the workflow first'); return; }
  runVisualWorkflowById(vwEditingId);
}

// Drag and drop for palette items
document.querySelectorAll('.vw-palette-item').forEach(function(item) {
  item.addEventListener('dragstart', function(e) {
    e.dataTransfer.setData('text/plain', item.dataset.type);
  });
});
(function() {
  var canvas = document.getElementById('vw-canvas');
  if (!canvas) return;
  canvas.addEventListener('dragover', function(e) { e.preventDefault(); });
  canvas.addEventListener('drop', function(e) {
    e.preventDefault();
    var type = e.dataTransfer.getData('text/plain');
    if (type) addVwBlock(type);
  });
})();

// ============================================================
// EMAIL DIGESTS
// ============================================================
function loadDigestConfig() {
  api('/digests/config').then(function(data) {
    var c = data.config || data;
    document.getElementById('digest-enabled').value = c.enabled ? '1' : '0';
    document.getElementById('digest-frequency').value = c.frequency || 'daily';
    document.getElementById('digest-time').value = c.send_time || '09:00';
    document.getElementById('digest-email').value = c.email_to || '';
    document.getElementById('digest-inc-conversations').checked = c.include_conversations !== 0;
    document.getElementById('digest-inc-tools').checked = c.include_tool_usage !== 0;
    document.getElementById('digest-inc-errors').checked = c.include_errors !== 0;
    document.getElementById('digest-inc-scheduled').checked = c.include_scheduled_tasks !== 0;
    var lastSent = document.getElementById('digest-last-sent');
    lastSent.textContent = c.last_sent_at ? 'Last sent: ' + new Date(c.last_sent_at).toLocaleString() : '';
  }).catch(function() {});
}

function saveDigestConfig() {
  var body = {
    enabled: Number(document.getElementById('digest-enabled').value),
    frequency: document.getElementById('digest-frequency').value,
    send_time: document.getElementById('digest-time').value,
    email_to: document.getElementById('digest-email').value.trim(),
    include_conversations: document.getElementById('digest-inc-conversations').checked ? 1 : 0,
    include_tool_usage: document.getElementById('digest-inc-tools').checked ? 1 : 0,
    include_errors: document.getElementById('digest-inc-errors').checked ? 1 : 0,
    include_scheduled_tasks: document.getElementById('digest-inc-scheduled').checked ? 1 : 0,
  };
  api('/digests/config', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) })
    .then(function() { document.getElementById('digest-status').textContent = 'Saved'; toast('Digest config saved'); })
    .catch(function(e) { document.getElementById('digest-status').textContent = 'Error: ' + e.message; });
}

function previewDigest() {
  fetch('/api/dashboard/digests/preview').then(function(r) { return r.json(); }).then(function(data) {
    var modal = document.getElementById('digest-preview-modal');
    var content = document.getElementById('digest-preview-content');
    // Use srcdoc-based iframe to safely render HTML
    var iframe = document.createElement('iframe');
    iframe.srcdoc = data.html || '<p>No preview available</p>';
    iframe.style.cssText = 'width:100%;height:70vh;border:none;border-radius:12px;';
    content.replaceChildren();
    content.appendChild(iframe);
    modal.classList.add('visible');
  }).catch(function(e) { toast('Preview failed: ' + e.message); });
}

function closeDigestPreview() {
  document.getElementById('digest-preview-modal').classList.remove('visible');
}

function sendTestDigest() {
  api('/digests/send', { method: 'POST' })
    .then(function() { toast('Test digest sent'); loadDigestConfig(); })
    .catch(function(e) { toast('Send failed: ' + (e.message || '')); });
}

// ── MODELS (Ollama) ──

function loadModelsPanel() {
  // Check Ollama status
  api('/ollama/status').then(function(data) {
    var dot = document.getElementById('ollama-status-dot');
    var text = document.getElementById('ollama-status-text');
    var ver = document.getElementById('ollama-version');
    if (data.running) {
      dot.className = 'status-dot ok';
      text.textContent = 'Ollama is running';
      ver.textContent = data.version || '';
      loadOllamaModels();
    } else {
      dot.className = 'status-dot error';
      text.textContent = 'Ollama is not running. Start it with: ollama serve';
      ver.textContent = '';
      document.getElementById('ollama-models-list').replaceChildren();
      document.getElementById('ollama-models-empty').style.display = 'flex';
    }
  }).catch(function() {
    var dot = document.getElementById('ollama-status-dot');
    var text = document.getElementById('ollama-status-text');
    dot.className = 'status-dot error';
    text.textContent = 'Cannot reach Ollama. Make sure it is installed and running.';
  });
}

function loadOllamaModels() {
  api('/ollama/models').then(function(data) {
    var list = document.getElementById('ollama-models-list');
    var empty = document.getElementById('ollama-models-empty');
    list.replaceChildren();
    var models = data.models || [];
    empty.style.display = models.length ? 'none' : 'flex';
    models.forEach(function(m) {
      var card = document.createElement('div');
      card.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);';
      var info = document.createElement('div');
      var nameEl = document.createElement('div');
      nameEl.style.cssText = 'font-weight:600;font-size:14px;color:var(--text);';
      nameEl.textContent = m.name;
      info.appendChild(nameEl);
      var meta = document.createElement('div');
      meta.style.cssText = 'font-size:12px;color:var(--text-muted);margin-top:2px;display:flex;gap:12px;';
      var sizeStr = m.size ? (m.size / 1e9).toFixed(1) + ' GB' : '';
      var familyStr = m.family || '';
      var paramStr = m.parameter_size || '';
      var quantStr = m.quantization || '';
      var parts = [paramStr, quantStr, familyStr, sizeStr].filter(Boolean);
      meta.textContent = parts.join(' · ');
      info.appendChild(meta);
      card.appendChild(info);
      var btns = document.createElement('div');
      btns.style.cssText = 'display:flex;gap:8px;align-items:center;';
      var useBtn = document.createElement('button');
      useBtn.className = 'btn btn-ghost btn-sm';
      useBtn.textContent = 'Use';
      useBtn.title = 'Set as active model';
      useBtn.onclick = (function(name) { return function() { useOllamaModel(name); }; })(m.name);
      btns.appendChild(useBtn);
      var delBtn = document.createElement('button');
      delBtn.className = 'btn btn-ghost btn-sm';
      delBtn.style.color = 'var(--red)';
      delBtn.textContent = 'Delete';
      delBtn.onclick = (function(name) { return function() { deleteOllamaModel(name); }; })(m.name);
      btns.appendChild(delBtn);
      card.appendChild(btns);
      list.appendChild(card);
    });
  }).catch(function() {
    toast('Failed to load models');
  });
}

function pullOllamaModel() {
  var input = document.getElementById('ollama-pull-input');
  var name = input.value.trim();
  if (!name) { toast('Enter a model name'); return; }
  var btn = document.getElementById('ollama-pull-btn');
  btn.disabled = true;
  btn.textContent = 'Pulling...';
  var progress = document.getElementById('ollama-pull-progress');
  progress.style.display = 'block';
  document.getElementById('ollama-pull-status').textContent = 'Starting pull for ' + name + '...';
  document.getElementById('ollama-pull-pct').textContent = '';
  document.getElementById('ollama-pull-bar').style.width = '0%';

  // Use SSE-like polling since we proxy through our API
  api('/ollama/pull', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name }) })
    .then(function(data) {
      btn.disabled = false;
      btn.textContent = 'Pull';
      if (data.ok) {
        document.getElementById('ollama-pull-status').textContent = 'Done! ' + name + ' is ready.';
        document.getElementById('ollama-pull-bar').style.width = '100%';
        toast(name + ' pulled successfully');
        input.value = '';
        loadOllamaModels();
        setTimeout(function() { progress.style.display = 'none'; }, 3000);
      } else {
        document.getElementById('ollama-pull-status').textContent = 'Error: ' + (data.error || 'Pull failed');
        document.getElementById('ollama-pull-bar').style.width = '0%';
        toast('Pull failed: ' + (data.error || ''));
      }
    })
    .catch(function(e) {
      btn.disabled = false;
      btn.textContent = 'Pull';
      document.getElementById('ollama-pull-status').textContent = 'Error: ' + (e.message || 'Pull failed');
      toast('Pull failed');
    });
}

function deleteOllamaModel(name) {
  if (!confirm('Delete model "' + name + '"? This cannot be undone.')) return;
  api('/ollama/delete', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name }) })
    .then(function(data) {
      if (data.ok) {
        toast(name + ' deleted');
        loadOllamaModels();
      } else {
        toast('Delete failed: ' + (data.error || ''));
      }
    })
    .catch(function(e) { toast('Delete failed'); });
}

function useOllamaModel(name) {
  api('/config/model', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'ollama', model: name }) })
    .then(function(data) {
      if (data.ok) {
        toast('Switched to ollama/' + name);
      } else {
        toast('Failed: ' + (data.error || ''));
      }
    })
    .catch(function(e) { toast('Failed to switch model'); });
}

// ── TODOS ──

function toggleTodoForm() {
  var f = document.getElementById('todo-add-form');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
  if (f.style.display === 'block') document.getElementById('todo-title').focus();
}

function loadTodos() {
  var filter = document.getElementById('todo-filter').value;
  api('/todos?filter=' + filter).then(function(data) { renderTodos(data.todos || []); }).catch(function(e) { toast('Failed to load todos'); });
}

function addTodo() {
  var title = document.getElementById('todo-title').value.trim();
  if (!title) return;
  var body = { title: title, priority: document.getElementById('todo-priority').value, due_date: document.getElementById('todo-due').value || null };
  api('/todos', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
    .then(function() { document.getElementById('todo-title').value=''; toggleTodoForm(); loadTodos(); toast('Todo added'); })
    .catch(function(e) { toast('Failed to add todo'); });
}

function completeTodo(id) {
  api('/todos/' + id, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status:'done'}) })
    .then(function() { loadTodos(); }).catch(function(e) { toast('Failed to update todo'); loadTodos(); });
}

function uncompleteTodo(id) {
  api('/todos/' + id, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status:'pending'}) })
    .then(function() { loadTodos(); }).catch(function(e) { toast('Failed to update todo'); loadTodos(); });
}

function deleteTodo(id) {
  api('/todos/' + id, { method:'DELETE' }).then(function() { loadTodos(); toast('Todo removed'); }).catch(function(e) { toast('Failed to delete todo'); });
}

function renderTodos(todos) {
  var c = document.getElementById('todos-list');
  c.replaceChildren();
  if (!todos.length) { c.textContent = ''; var p = document.createElement('div'); p.className='empty-state-card'; p.style.textAlign='center'; var t=document.createElement('p'); t.style.cssText='color:var(--text-muted);margin-bottom:4px;'; t.textContent='No todos yet'; p.appendChild(t); var h=document.createElement('p'); h.style.cssText='color:var(--text-faint);font-size:12px;'; h.textContent='Click + Add above, or ask Zubo in chat to create one.'; p.appendChild(h); c.appendChild(p); return; }
  todos.forEach(function(t) {
    var item = document.createElement('div');
    item.className = 'memory-item';
    item.style.display = 'flex';
    item.style.alignItems = 'flex-start';
    item.style.gap = '12px';
    var isDone = t.status === 'done';

    var check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = isDone;
    check.style.cssText = 'margin-top:3px;cursor:pointer;accent-color:var(--accent);';
    check.onchange = function() { check.checked ? completeTodo(t.id) : uncompleteTodo(t.id); };

    var body = document.createElement('div');
    body.style.flex = '1';
    var titleEl = document.createElement('div');
    titleEl.style.cssText = isDone ? 'text-decoration:line-through;color:var(--text-muted);' : 'color:var(--text);';
    titleEl.textContent = t.title;
    body.appendChild(titleEl);

    var meta = document.createElement('div');
    meta.style.cssText = 'font-size:11px;color:var(--text-faint);margin-top:4px;display:flex;gap:8px;flex-wrap:wrap;';
    var prBg = { urgent:'rgba(239,68,68,0.15)', high:'rgba(245,158,11,0.15)', medium:'rgba(139,92,246,0.15)', low:'rgba(100,116,139,0.1)' };
    var prFg = { urgent:'#ef4444', high:'#f59e0b', medium:'#8b5cf6', low:'var(--text-faint)' };
    var prSpan = document.createElement('span');
    prSpan.style.cssText = 'color:' + (prFg[t.priority]||'var(--text-faint)') + ';background:' + (prBg[t.priority]||'transparent') + ';padding:1px 8px;border-radius:10px;font-size:10px;font-weight:500;';
    prSpan.textContent = t.priority;
    meta.appendChild(prSpan);
    if (t.due_date) { var ds = document.createElement('span'); ds.style.cssText = 'display:inline-flex;align-items:center;gap:3px;'; ds.textContent = '\u{1F4C5} ' + t.due_date; meta.appendChild(ds); }
    if (t.tags && t.tags !== '[]') {
      try { var tags = JSON.parse(t.tags); if (tags.length) { var ts = document.createElement('span'); ts.textContent = tags.join(', '); meta.appendChild(ts); } } catch(e){}
    }
    body.appendChild(meta);

    var del = document.createElement('button');
    del.className = 'btn btn-ghost btn-sm';
    del.textContent = 'Delete';
    del.style.cssText = 'font-size:11px;padding:2px 8px;color:var(--text-faint);';
    del.onclick = function() { deleteTodo(t.id); };

    item.appendChild(check);
    item.appendChild(body);
    item.appendChild(del);
    c.appendChild(item);
  });
}

// ── NOTES ──

function toggleNoteForm() {
  var f = document.getElementById('note-add-form');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
  if (f.style.display === 'block') document.getElementById('note-title').focus();
}

function loadNotes() {
  var q = document.getElementById('notes-search').value.trim();
  var url = '/notes' + (q ? '?q=' + encodeURIComponent(q) : '');
  api(url).then(function(data) { renderNotes(data.notes || []); }).catch(function(e) { toast('Failed to load notes'); });
}

function addNote() {
  var title = document.getElementById('note-title').value.trim();
  var content = document.getElementById('note-content').value.trim();
  if (!title || !content) return;
  var body = { title: title, content: content, tags: document.getElementById('note-tags').value };
  api('/notes', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
    .then(function() {
      document.getElementById('note-title').value='';
      document.getElementById('note-content').value='';
      document.getElementById('note-tags').value='';
      toggleNoteForm(); loadNotes(); toast('Note saved');
    }).catch(function(e) { toast('Failed to save note'); });
}

function togglePin(id, pinned) {
  api('/notes/' + id, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({pinned:!pinned}) })
    .then(function() { loadNotes(); }).catch(function(e) { toast('Failed to update note'); });
}

function deleteNote(id) {
  api('/notes/' + id, { method:'DELETE' }).then(function() { loadNotes(); toast('Note deleted'); }).catch(function(e) { toast('Failed to delete note'); });
}

function renderNotes(notes) {
  var c = document.getElementById('notes-list');
  c.replaceChildren();
  if (!notes.length) { var p = document.createElement('div'); p.className='empty-state-card'; p.style.textAlign='center'; var t=document.createElement('p'); t.style.cssText='color:var(--text-muted);margin-bottom:4px;'; t.textContent='No notes yet'; p.appendChild(t); var h=document.createElement('p'); h.style.cssText='color:var(--text-faint);font-size:12px;'; h.textContent='Save notes here or tell Zubo to remember something in chat.'; p.appendChild(h); c.appendChild(p); return; }
  notes.forEach(function(n) {
    var item = document.createElement('div');
    item.className = 'memory-item';

    var header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:8px;';
    var titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-weight:500;color:var(--text);';
    titleEl.textContent = (n.pinned ? '\u{1F4CC} ' : '') + n.title;
    header.appendChild(titleEl);

    var actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:4px;flex-shrink:0;';
    var pinBtn = document.createElement('button');
    pinBtn.className = 'btn btn-ghost btn-sm';
    pinBtn.style.cssText = 'font-size:11px;padding:2px 8px;color:var(--text-faint);';
    pinBtn.textContent = n.pinned ? 'Unpin' : 'Pin';
    pinBtn.onclick = function() { togglePin(n.id, n.pinned); };
    var delBtn = document.createElement('button');
    delBtn.className = 'btn btn-ghost btn-sm';
    delBtn.style.cssText = 'font-size:11px;padding:2px 8px;color:var(--text-faint);';
    delBtn.textContent = 'Delete';
    delBtn.onclick = function() { deleteNote(n.id); };
    actions.appendChild(pinBtn);
    actions.appendChild(delBtn);
    header.appendChild(actions);
    item.appendChild(header);

    var content = document.createElement('div');
    content.style.cssText = 'font-size:13px;color:var(--text-secondary);margin-top:8px;white-space:pre-wrap;max-height:120px;overflow:hidden;';
    content.textContent = n.content;
    item.appendChild(content);

    var meta = document.createElement('div');
    meta.style.cssText = 'font-size:11px;color:var(--text-faint);margin-top:8px;';
    var parts = [n.updated_at ? n.updated_at.split('T')[0] : ''];
    if (n.tags && n.tags !== '[]') { try { var tags = JSON.parse(n.tags); if (tags.length) parts.push(tags.join(', ')); } catch(e){} }
    meta.textContent = parts.filter(Boolean).join(' \u00B7 ');
    item.appendChild(meta);
    c.appendChild(item);
  });
}

// ── PREFERENCES ──

function togglePrefForm() {
  var f = document.getElementById('pref-add-form');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
  if (f.style.display === 'block') document.getElementById('pref-key').focus();
}

function loadPrefs() {
  api('/preferences').then(function(data) { renderPrefs(data.preferences || []); }).catch(function(e) { toast('Failed to load preferences'); });
}

function addPref() {
  var key = document.getElementById('pref-key').value.trim();
  var value = document.getElementById('pref-value').value.trim();
  if (!key || !value) return;
  var body = { category: document.getElementById('pref-category').value.trim() || 'general', key: key, value: value };
  api('/preferences', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
    .then(function() {
      document.getElementById('pref-key').value='';
      document.getElementById('pref-value').value='';
      togglePrefForm(); loadPrefs(); toast('Preference saved');
    }).catch(function(e) { toast('Failed to save preference'); });
}

function deletePref(id) {
  api('/preferences/' + id, { method:'DELETE' }).then(function() { loadPrefs(); toast('Preference removed'); }).catch(function(e) { toast('Failed to delete preference'); });
}

function renderPrefs(prefs) {
  var c = document.getElementById('prefs-list');
  c.replaceChildren();
  if (!prefs.length) { var p = document.createElement('div'); p.className='empty-state-card'; p.style.textAlign='center'; var t=document.createElement('p'); t.style.cssText='color:var(--text-muted);margin-bottom:4px;'; t.textContent='No preferences yet'; p.appendChild(t); var h=document.createElement('p'); h.style.cssText='color:var(--text-faint);font-size:12px;'; h.textContent='Tell Zubo your preferences in chat, e.g. "I prefer TypeScript" or add them here.'; p.appendChild(h); c.appendChild(p); return; }

  // Group by category
  var groups = {};
  prefs.forEach(function(p) {
    if (!groups[p.category]) groups[p.category] = [];
    groups[p.category].push(p);
  });

  Object.keys(groups).sort().forEach(function(cat) {
    var section = document.createElement('div');
    section.style.cssText = 'margin-bottom:16px;';
    var heading = document.createElement('div');
    heading.style.cssText = 'font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;';
    heading.textContent = cat;
    section.appendChild(heading);

    groups[cat].forEach(function(p) {
      var item = document.createElement('div');
      item.className = 'memory-item';
      item.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;';
      var left = document.createElement('span');
      var keySpan = document.createElement('span'); keySpan.style.color='var(--text)'; keySpan.textContent = p.key;
      var eqSpan = document.createElement('span'); eqSpan.style.cssText='color:var(--text-faint);margin:0 6px'; eqSpan.textContent = '=';
      var valSpan = document.createElement('span'); valSpan.style.color='var(--accent)'; valSpan.textContent = p.value;
      left.appendChild(keySpan); left.appendChild(eqSpan); left.appendChild(valSpan);
      if (p.source === 'inferred') { var src = document.createElement('span'); src.style.cssText='font-size:10px;color:var(--text-faint);margin-left:8px'; src.textContent='(inferred)'; left.appendChild(src); }
      var del = document.createElement('button');
      del.className = 'btn btn-ghost btn-sm';
      del.style.cssText = 'font-size:11px;padding:2px 8px;color:var(--text-faint);';
      del.textContent = 'Delete';
      del.onclick = function() { deletePref(p.id); };
      item.appendChild(left);
      item.appendChild(del);
      section.appendChild(item);
    });
    c.appendChild(section);
  });
}

// ── TOPICS ──

function toggleTopicForm() {
  var f = document.getElementById('topic-add-form');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
  if (f.style.display === 'block') document.getElementById('topic-name').focus();
}

function loadTopics() {
  api('/topics').then(function(data) { renderTopics(data.topics || []); }).catch(function(e) { toast('Failed to load topics'); });
}

function addTopic() {
  var name = document.getElementById('topic-name').value.trim();
  if (!name) return;
  var body = { name: name, description: document.getElementById('topic-desc').value.trim() || null };
  api('/topics', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
    .then(function() {
      document.getElementById('topic-name').value='';
      document.getElementById('topic-desc').value='';
      toggleTopicForm(); loadTopics(); toast('Topic created');
    }).catch(function(e) { toast('Failed to create topic'); });
}

function toggleTopicStatus(id, currentStatus) {
  var newStatus = currentStatus === 'active' ? 'archived' : 'active';
  api('/topics/' + id, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status:newStatus}) })
    .then(function() { loadTopics(); }).catch(function(e) { toast('Failed to update topic'); });
}

function deleteTopic(id) {
  api('/topics/' + id, { method:'DELETE' }).then(function() { loadTopics(); toast('Topic deleted'); }).catch(function(e) { toast('Failed to delete topic'); });
}

function renderTopics(topics) {
  var c = document.getElementById('topics-list');
  c.replaceChildren();
  if (!topics.length) { var p = document.createElement('div'); p.className='empty-state-card'; p.style.textAlign='center'; var t=document.createElement('p'); t.style.cssText='color:var(--text-muted);margin-bottom:4px;'; t.textContent='No topics yet'; p.appendChild(t); var h=document.createElement('p'); h.style.cssText='color:var(--text-faint);font-size:12px;'; h.textContent='Topics organize conversations into threads. Create one to keep context separate.'; p.appendChild(h); c.appendChild(p); return; }
  topics.forEach(function(t) {
    var item = document.createElement('div');
    item.className = 'memory-item';
    item.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:8px;';

    var left = document.createElement('div');
    left.style.flex = '1';
    var nameEl = document.createElement('div');
    nameEl.style.cssText = 'color:var(--text);font-weight:500;';
    var dot = document.createElement('span');
    dot.style.cssText = 'display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:6px;background:' + (t.status === 'active' ? 'var(--green)' : 'var(--text-faint)');
    nameEl.appendChild(dot);
    nameEl.appendChild(document.createTextNode(t.name));
    left.appendChild(nameEl);
    if (t.description) {
      var desc = document.createElement('div');
      desc.style.cssText = 'font-size:12px;color:var(--text-muted);margin-top:4px;';
      desc.textContent = t.description;
      left.appendChild(desc);
    }
    var meta = document.createElement('div');
    meta.style.cssText = 'font-size:11px;color:var(--text-faint);margin-top:4px;';
    meta.textContent = 'Last active: ' + (t.last_message_at ? t.last_message_at.split('T')[0] : 'never');
    left.appendChild(meta);

    var actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:4px;flex-shrink:0;';
    var archBtn = document.createElement('button');
    archBtn.className = 'btn btn-ghost btn-sm';
    archBtn.style.cssText = 'font-size:11px;padding:2px 8px;color:var(--text-faint);';
    archBtn.textContent = t.status === 'active' ? 'Archive' : 'Activate';
    archBtn.onclick = function() { toggleTopicStatus(t.id, t.status); };
    var delBtn = document.createElement('button');
    delBtn.className = 'btn btn-ghost btn-sm';
    delBtn.style.cssText = 'font-size:11px;padding:2px 8px;color:var(--text-faint);';
    delBtn.textContent = 'Delete';
    delBtn.onclick = function() { deleteTopic(t.id); };
    actions.appendChild(archBtn);
    actions.appendChild(delBtn);

    item.appendChild(left);
    item.appendChild(actions);
    c.appendChild(item);
  });
}

// ── FOLLOW-UPS ──

function toggleFollowupForm() {
  var f = document.getElementById('followup-add-form');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
  if (f.style.display === 'block') document.getElementById('followup-context').focus();
}

function loadFollowups() {
  api('/followups').then(function(data) { renderFollowups(data.followups || []); }).catch(function(e) { toast('Failed to load follow-ups'); });
}

function addFollowup() {
  var context = document.getElementById('followup-context').value.trim();
  var message = document.getElementById('followup-message').value.trim();
  var at = document.getElementById('followup-at').value;
  if (!context || !message || !at) return;
  var body = { context: context, message: message, follow_up_at: new Date(at).toISOString() };
  api('/followups', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
    .then(function() {
      document.getElementById('followup-context').value='';
      document.getElementById('followup-message').value='';
      document.getElementById('followup-at').value='';
      toggleFollowupForm(); loadFollowups(); toast('Follow-up scheduled');
    }).catch(function(e) { toast('Failed to schedule follow-up'); });
}

function cancelFollowup(id) {
  api('/followups/' + id, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status:'cancelled'}) })
    .then(function() { loadFollowups(); toast('Follow-up cancelled'); }).catch(function(e) { toast('Failed to cancel follow-up'); });
}

function deleteFollowup(id) {
  api('/followups/' + id, { method:'DELETE' }).then(function() { loadFollowups(); toast('Follow-up removed'); }).catch(function(e) { toast('Failed to delete follow-up'); });
}

function renderFollowups(followups) {
  var c = document.getElementById('followups-list');
  c.replaceChildren();
  if (!followups.length) { var p = document.createElement('div'); p.className='empty-state-card'; p.style.textAlign='center'; var t=document.createElement('p'); t.style.cssText='color:var(--text-muted);margin-bottom:4px;'; t.textContent='No follow-ups scheduled'; p.appendChild(t); var h=document.createElement('p'); h.style.cssText='color:var(--text-faint);font-size:12px;'; h.textContent='Zubo will proactively remind you when a follow-up is due.'; p.appendChild(h); c.appendChild(p); return; }
  followups.forEach(function(f) {
    var item = document.createElement('div');
    item.className = 'memory-item';
    item.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:8px;';

    var left = document.createElement('div');
    left.style.flex = '1';
    var contextEl = document.createElement('div');
    contextEl.style.cssText = 'color:var(--text);font-weight:500;';
    contextEl.textContent = f.context;
    left.appendChild(contextEl);
    var msgEl = document.createElement('div');
    msgEl.style.cssText = 'font-size:13px;color:var(--text-secondary);margin-top:4px;';
    msgEl.textContent = f.message;
    left.appendChild(msgEl);

    var meta = document.createElement('div');
    meta.style.cssText = 'font-size:11px;color:var(--text-faint);margin-top:4px;display:flex;gap:8px;';
    var statusColors = { pending:'var(--yellow)', sent:'var(--green)', cancelled:'var(--text-faint)' };
    var statusSpan = document.createElement('span');
    statusSpan.style.color = statusColors[f.status] || 'var(--text-faint)';
    statusSpan.textContent = f.status;
    meta.appendChild(statusSpan);
    if (f.follow_up_at) { var whenSpan = document.createElement('span'); whenSpan.textContent = new Date(f.follow_up_at).toLocaleString(); meta.appendChild(whenSpan); }
    left.appendChild(meta);

    var actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:4px;flex-shrink:0;';
    if (f.status === 'pending') {
      var cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-ghost btn-sm';
      cancelBtn.style.cssText = 'font-size:11px;padding:2px 8px;color:var(--text-faint);';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.onclick = function() { cancelFollowup(f.id); };
      actions.appendChild(cancelBtn);
    }
    var delBtn = document.createElement('button');
    delBtn.className = 'btn btn-ghost btn-sm';
    delBtn.style.cssText = 'font-size:11px;padding:2px 8px;color:var(--text-faint);';
    delBtn.textContent = 'Delete';
    delBtn.onclick = function() { deleteFollowup(f.id); };
    actions.appendChild(delBtn);

    item.appendChild(left);
    item.appendChild(actions);
    c.appendChild(item);
  });
}

// Init
routeFromHash();
checkOnboarding();
loadThreads();
</script>
</body>
</html>`;
