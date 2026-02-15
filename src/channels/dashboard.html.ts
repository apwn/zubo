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
    margin-bottom: 20px; overflow-x: auto; flex-shrink: 0;
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
    <div class="sidebar-divider"></div>
    <div class="sidebar-section">Overview</div>
    <a href="#dashboard" onclick="showPanel('dashboard')">
      <span class="nav-svg-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></span> Dashboard
    </a>
    <a href="#memory" onclick="showPanel('memory')">
      <span class="nav-svg-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.5 2 6 4.5 6 7c0 1.5.5 2.8 1.4 3.8C6.5 12 6 13.5 6 15c0 3.5 2.5 7 6 7s6-3.5 6-7c0-1.5-.5-3-1.4-4.2C17.5 9.8 18 8.5 18 7c0-2.5-2.5-5-6-5z"/><path d="M9 10h6"/><path d="M9 14h6"/></svg></span> Memory
    </a>
    <a href="#skills" onclick="showPanel('skills')">
      <span class="nav-svg-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span> Skills
    </a>
    <a href="#workflows" onclick="showPanel('workflows')">
      <span class="nav-svg-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg></span> Workflows
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
                  <button class="suggestion-chip" onclick="useSuggestion(this)">Check my schedule</button>
                </div>
                <div class="chip-row">
                  <button class="suggestion-chip" onclick="useSuggestion(this)">Summarize recent emails</button>
                  <button class="suggestion-chip" onclick="useSuggestion(this)">Set a reminder</button>
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

    <!-- WORKFLOWS PANEL -->
    <div id="panel-workflows" class="panel">
      <div class="panel-body">
        <div class="memory-section-title">
          <span>Workflow Recipes</span>
          <span class="badge" id="recipe-count"></span>
        </div>
        <p class="settings-desc" style="margin-bottom:16px;">Pre-built automations you can activate with one click.</p>
        <div id="recipes-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;margin-bottom:32px;"></div>

        <div class="memory-section-title" style="margin-top:28px;">
          <span>Custom Workflows</span>
        </div>
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
          <button class="tab" onclick="switchTab('settings','mcp')">MCP</button>
          <button class="tab" onclick="switchTab('settings','routing')">Routing</button>
          <button class="tab" onclick="switchTab('settings','data')">Data</button>
          <button class="tab" onclick="switchTab('settings','secrets')">Secrets</button>
          <button class="tab" onclick="switchTab('settings','system')">System Prompt</button>
          <button class="tab" onclick="switchTab('settings','cron')">Cron</button>
          <button class="tab" onclick="switchTab('settings','logs')">Logs</button>
          <button class="tab" onclick="switchTab('settings','privacy')">Privacy</button>
          <button class="tab" onclick="switchTab('settings','budget')">Budget</button>
        </div>

        <!-- General Tab -->
        <div class="tab-content active" id="settings-tab-general">
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
            <h3 class="settings-title">Configuration</h3>
            <p class="settings-desc">Manage your full config by editing <code>~/.zubo/config.json</code> directly, or re-run <code>zubo setup</code>.</p>
          </div>
        </div>

        <!-- Providers Tab -->
        <div class="tab-content" id="settings-tab-providers">
          <div class="settings-section">
            <h3 class="settings-title">LLM Providers</h3>
            <p class="settings-desc">Configure AI model providers. Set one as active for immediate use.</p>
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
                    <option value="">-- Select --</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="openai">OpenAI</option>
                    <option value="groq">Groq</option>
                    <option value="together">Together</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="xai">xAI (Grok)</option>
                    <option value="ollama">Ollama (local)</option>
                    <option value="lmstudio">LM Studio (local)</option>
                    <option value="custom">Custom (OpenAI-compat)</option>
                  </select>
                </div>
                <div class="settings-field">
                  <label class="settings-label" for="new-provider-key">API Key</label>
                  <input id="new-provider-key" type="password" class="settings-input" placeholder="sk-...">
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
            <h3 class="settings-title">MCP Servers</h3>
            <p class="settings-desc">Model Context Protocol servers extend Zubo with additional tools. Changes apply immediately.</p>
            <div id="mcp-servers-list" style="display:flex;flex-direction:column;gap:12px;"></div>
            <div style="margin-top:20px;">
              <button class="btn btn-primary" onclick="showAddMcpForm()">Add MCP Server</button>
            </div>
            <div id="mcp-add-form" style="display:none;margin-top:16px;padding:16px;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius);">
              <h4 style="margin-bottom:12px;font-family:var(--display);font-weight:600;">Add MCP Server</h4>
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
            <h3 class="settings-title" data-tooltip="Route simple queries to a cheaper/faster model">Smart Routing</h3>
            <p class="settings-desc">Automatically route simple queries to a fast, cheap model and complex ones to your primary model. Saves cost without sacrificing quality.</p>
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
            <h3 class="settings-title">Secrets &amp; API Keys</h3>
            <p class="settings-desc">Manage API keys and credentials for integrations. Values are stored encrypted in your local database and never sent to external services by Zubo.</p>
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
            <p class="settings-desc">Set spending limits to control costs. The agent will pause when limits are reached.</p>
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
var panelNames = ['agent','dashboard','memory','skills','workflows','integrations','settings'];
var panelTitles = { agent:'Chat', dashboard:'Dashboard', memory:'Memory', skills:'Skills', workflows:'Workflows', integrations:'Integrations', settings:'Settings' };

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
  if (name === 'integrations') loadIntegrations();
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
    // Focus search
    var searchInput = document.getElementById('registry-search');
    if (searchInput) searchInput.focus();
  }
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
  loadRecipes();
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
    if (sidebarBadge) sidebarBadge.textContent = connCount + ' channels';
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
  if (name === 'ollama' || name === 'lmstudio') {
    keyInput.placeholder = 'Optional for local providers';
  } else {
    keyInput.placeholder = 'sk-...';
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
      empty.textContent = 'No MCP servers configured. Add one to extend Zubo with new tools.';
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
  if (!confirm('Remove MCP server "' + name + '"? This will disconnect it.')) return;
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
    { title: 'System Prompt', action: function() { showPanel('settings'); switchTab('settings','system'); } },
    { title: 'Cron Jobs', action: function() { showPanel('settings'); switchTab('settings','cron'); } },
    { title: 'Logs', action: function() { showPanel('settings'); switchTab('settings','logs'); } },
    { title: 'Privacy & Data', action: function() { showPanel('settings'); switchTab('settings','privacy'); } },
    { title: 'Budget', action: function() { showPanel('settings'); switchTab('settings','budget'); } },
    { title: 'Secrets', action: function() { showPanel('settings'); switchTab('settings','secrets'); } },
    { title: 'Channels', action: function() { showPanel('settings'); switchTab('settings','channels'); } },
    { title: 'Providers', action: function() { showPanel('settings'); switchTab('settings','providers'); } },
    { title: 'MCP Servers', action: function() { showPanel('settings'); switchTab('settings','mcp'); } },
    { title: 'Smart Routing', action: function() { showPanel('settings'); switchTab('settings','routing'); } },
    { title: 'Browse Registry', action: function() { showPanel('skills'); switchTab('skills','browse'); } },
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
  api('/threads/' + id + '/messages').then(function(data) {
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
  api('/threads/' + id, { method: 'DELETE' }).then(function() {
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
  var rows = [['What can you do?','Check my schedule'],['Summarize recent emails','Set a reminder']];
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

// Init
routeFromHash();
checkOnboarding();
loadThreads();
</script>
</body>
</html>`;
