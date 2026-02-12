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

  #sidebar nav { display: flex; flex-direction: column; gap: 2px; padding: 4px 8px; flex: 1; }

  #sidebar nav a {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 12px; color: var(--text-secondary); text-decoration: none;
    font-size: 13px; font-weight: 500; border-radius: 8px;
    transition: all var(--transition); cursor: pointer;
  }
  #sidebar nav a .nav-icon {
    width: 18px; height: 18px; display: flex; align-items: center; justify-content: center;
    font-size: 14px; opacity: 0.7; flex-shrink: 0;
  }
  #sidebar nav a:hover { color: var(--text); background: var(--bg-hover); }
  #sidebar nav a.active {
    color: var(--accent); background: var(--accent-bg);
    font-weight: 600;
  }
  #sidebar nav a.active .nav-icon { opacity: 1; }

  .sidebar-divider { height: 1px; background: var(--border); margin: 8px 16px; }

  .sidebar-footer {
    padding: 12px 16px; border-top: 1px solid var(--border);
    font-size: 11px; color: var(--text-faint);
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
    display: flex; gap: 10px; flex-shrink: 0;
  }
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
    transition: background var(--transition);
  }
  #chat-send:hover { background: var(--accent-hover); }
  #chat-send:disabled { opacity: 0.4; cursor: default; }

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
    pointer-events: none; transform: translateY(8px); box-shadow: var(--shadow-lg);
  }
  .toast.show { opacity: 1; transform: translateY(0); }

  /* ===== SETTINGS ===== */
  .settings-section { max-width: 560px; }
  .settings-title { font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 6px; }
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
    <a href="#system" onclick="showPanel('system')">
      <span class="nav-icon">\u{2699}\u{FE0F}</span> System Prompt
    </a>
    <a href="#memory" onclick="showPanel('memory')">
      <span class="nav-icon">\u{1F9E0}</span> Memory
    </a>
    <a href="#skills" onclick="showPanel('skills')">
      <span class="nav-icon">\u{26A1}</span> Skills
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
  <div class="sidebar-footer">Zubo Agent</div>
</div>

<div id="main">
  <div id="topbar">
    <span id="topbar-title">Agent</span>
    <span id="topbar-badge">Zubo</span>
  </div>
  <div id="content">

    <!-- AGENT CHAT PANEL -->
    <div id="panel-agent" class="panel active">
      <div id="chat-messages">
        <div class="chat-empty">
          <div class="chat-empty-icon">\u{1F4AC}</div>
          <div class="chat-empty-text">Send a message to start chatting with Zubo</div>
        </div>
      </div>
      <div id="chat-input-bar">
        <input id="chat-input" type="text" placeholder="Message Zubo..." autocomplete="off">
        <button id="chat-send">Send</button>
      </div>
    </div>

    <!-- STATUS PANEL -->
    <div id="panel-status" class="panel">
      <div class="panel-body">
        <div class="cards" id="status-cards"></div>
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
        <p id="skills-empty" class="empty-state" style="display:none;">No skills installed.</p>
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
          <h3 class="settings-title">LLM Provider</h3>
          <p class="settings-desc">Select which provider and model Zubo uses. Changes are saved to config and take effect on restart.</p>
          <div class="settings-grid">
            <div class="settings-field">
              <label class="settings-label" for="settings-provider">Provider</label>
              <select id="settings-provider" class="settings-select" onchange="onProviderChange()"></select>
            </div>
            <div class="settings-field">
              <label class="settings-label" for="settings-model">Model</label>
              <input id="settings-model" type="text" class="settings-input" placeholder="e.g. claude-sonnet-4-5-20250929">
            </div>
          </div>
          <div style="margin-top: 16px; display: flex; gap: 10px; align-items: center;">
            <button class="btn btn-primary" onclick="saveModelConfig()">Save</button>
            <span id="settings-status" class="status-text"></span>
          </div>
        </div>
        <div class="settings-section" style="margin-top: 32px;">
          <h3 class="settings-title">Configuration</h3>
          <p class="settings-desc">Manage your full config by editing <code>~/.zubo/config.json</code> directly, or re-run <code>zubo setup</code> to add new providers.</p>
        </div>
      </div>
    </div>

  </div>
</div>

<div class="toast" id="toast"></div>

<script>
// --- Panel routing ---
var panelNames = ['agent','status','system','memory','skills','cron','logs','settings'];
var panelTitles = { agent:'Agent', status:'Status', system:'System Prompt', memory:'Memory', skills:'Skills', cron:'Cron Jobs', logs:'Logs', settings:'Settings' };

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
  if (name === 'system') loadSystem();
  if (name === 'memory') loadMemory();
  if (name === 'skills') loadSkills();
  if (name === 'cron') loadCron();
  if (name === 'logs') loadLogs();
  if (name === 'settings') loadSettings();
}

// Handle hash on load + back/forward
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

function clearEmptyState() {
  var empty = chatMessages.querySelector('.chat-empty');
  if (empty) empty.remove();
}

// Safe markdown renderer: escapes HTML first via textContent, then applies
// controlled substitutions. No raw user/bot HTML can pass through unescaped.
function renderMd(text) {
  var tmp = document.createElement('div');
  tmp.textContent = text;
  var s = tmp.innerHTML;
  s = s.replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>');
  s = s.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
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
  addChatMsg(text, 'user');
  chatHistory.push({ role: 'user', text: text });
  var thinking = addChatMsg('Thinking...', 'bot thinking');
  fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text }),
  }).then(function(r) { return r.json(); }).then(function(data) {
    thinking.remove();
    var reply = data.reply || 'No response.';
    addChatMsg(reply, 'bot');
    chatHistory.push({ role: 'bot', text: reply });
  }).catch(function(e) {
    thinking.remove();
    addChatMsg('Error: ' + e.message, 'bot');
  }).finally(function() {
    chatBusy = false;
    chatSend.disabled = false;
    chatInput.focus();
  });
}

chatSend.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') sendChatMessage(); });

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

// Allow Enter to search
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
      document.getElementById('settings-status').textContent = 'Saved — restart Zubo to apply';
      toast('Model updated');
      loadSettings();
    } else {
      document.getElementById('settings-status').textContent = data.error || 'Error';
    }
  });
}

// Init: route from hash
routeFromHash();
</script>
</body>
</html>`;
