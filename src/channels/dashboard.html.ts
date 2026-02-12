// Dashboard HTML served inline — no build step
export const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Orba Dashboard</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #e0e0e0; height: 100vh; display: flex; }

  /* Sidebar */
  #sidebar { width: 200px; background: #111; border-right: 1px solid #222; display: flex; flex-direction: column; flex-shrink: 0; }
  #sidebar .logo { padding: 16px; font-weight: 700; font-size: 16px; color: #fff; border-bottom: 1px solid #222; }
  #sidebar a { display: block; padding: 10px 16px; color: #888; text-decoration: none; font-size: 13px; border-left: 3px solid transparent; }
  #sidebar a:hover { color: #e0e0e0; background: #1a1a1a; }
  #sidebar a.active { color: #2563eb; border-left-color: #2563eb; background: #0d1b3e; }

  /* Main */
  #main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  #topbar { padding: 12px 20px; background: #111; border-bottom: 1px solid #222; font-size: 14px; font-weight: 600; color: #888; display: flex; justify-content: space-between; align-items: center; }
  #content { flex: 1; overflow-y: auto; padding: 20px; }

  /* Panels */
  .panel { display: none; }
  .panel.active { display: block; }

  /* Editor */
  .editor-wrap { display: flex; flex-direction: column; height: calc(100vh - 100px); }
  .editor-toolbar { padding: 8px 0; display: flex; gap: 8px; align-items: center; }
  textarea.editor { flex: 1; width: 100%; background: #141414; border: 1px solid #333; border-radius: 8px; color: #e0e0e0; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 13px; padding: 12px; resize: none; outline: none; line-height: 1.6; }
  textarea.editor:focus { border-color: #2563eb; }

  /* Buttons */
  .btn { padding: 6px 14px; border: none; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 500; }
  .btn-primary { background: #2563eb; color: white; }
  .btn-primary:hover { background: #1d4ed8; }
  .btn-ghost { background: transparent; color: #888; border: 1px solid #333; }
  .btn-ghost:hover { color: #e0e0e0; border-color: #555; }

  /* Status cards */
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px; }
  .card { background: #141414; border: 1px solid #222; border-radius: 8px; padding: 14px; }
  .card .label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .card .value { font-size: 18px; font-weight: 600; color: #e0e0e0; }
  .card .value.ok { color: #22c55e; }
  .card .value.warn { color: #f59e0b; }

  /* Memory list */
  .memory-list { display: flex; flex-direction: column; gap: 8px; }
  .memory-item { background: #141414; border: 1px solid #222; border-radius: 8px; padding: 12px; }
  .memory-item .source { font-size: 11px; color: #666; margin-bottom: 4px; }
  .memory-item .content { font-size: 13px; line-height: 1.5; white-space: pre-wrap; }

  /* Logs */
  .log-view { background: #0d0d0d; border: 1px solid #222; border-radius: 8px; padding: 12px; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; line-height: 1.6; white-space: pre-wrap; max-height: calc(100vh - 160px); overflow-y: auto; color: #999; }

  /* Cron table */
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 8px 12px; color: #666; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #222; }
  td { padding: 8px 12px; border-bottom: 1px solid #1a1a1a; }

  /* Toast */
  .toast { position: fixed; bottom: 20px; right: 20px; background: #22c55e; color: #000; padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; opacity: 0; transition: opacity 0.3s; pointer-events: none; }
  .toast.show { opacity: 1; }

  /* Search */
  .search-bar { display: flex; gap: 8px; margin-bottom: 16px; }
  .search-bar input { flex: 1; padding: 8px 12px; background: #141414; border: 1px solid #333; border-radius: 6px; color: #e0e0e0; font-size: 13px; outline: none; }
  .search-bar input:focus { border-color: #2563eb; }
</style>
</head>
<body>

<div id="sidebar">
  <div class="logo">Orba</div>
  <a href="#status" class="active" onclick="showPanel('status')">Status</a>
  <a href="#system" onclick="showPanel('system')">System Prompt</a>
  <a href="#memory" onclick="showPanel('memory')">Memory</a>
  <a href="#skills" onclick="showPanel('skills')">Skills</a>
  <a href="#cron" onclick="showPanel('cron')">Cron Jobs</a>
  <a href="#logs" onclick="showPanel('logs')">Logs</a>
  <a href="/" style="margin-top: auto; border-top: 1px solid #222; padding-top: 12px;">&#8592; Chat</a>
</div>

<div id="main">
  <div id="topbar">
    <span id="topbar-title">Status</span>
    <span style="font-size: 12px; color: #444;">Dashboard</span>
  </div>
  <div id="content">

    <!-- STATUS PANEL -->
    <div id="panel-status" class="panel active">
      <div class="cards" id="status-cards"></div>
    </div>

    <!-- SYSTEM PROMPT PANEL -->
    <div id="panel-system" class="panel">
      <div class="editor-wrap">
        <div class="editor-toolbar">
          <button class="btn btn-primary" onclick="saveSystem()">Save</button>
          <button class="btn btn-ghost" onclick="loadSystem()">Reload</button>
          <span id="system-status" style="font-size:12px; color:#666;"></span>
        </div>
        <textarea class="editor" id="system-editor" spellcheck="false"></textarea>
      </div>
    </div>

    <!-- MEMORY PANEL -->
    <div id="panel-memory" class="panel">
      <div class="editor-wrap">
        <div class="editor-toolbar">
          <button class="btn btn-primary" onclick="saveMemory()">Save MEMORY.md</button>
          <button class="btn btn-ghost" onclick="loadMemory()">Reload</button>
          <span id="memory-status" style="font-size:12px; color:#666;"></span>
        </div>
        <textarea class="editor" id="memory-editor" spellcheck="false" style="height: 40vh;"></textarea>
      </div>
      <h3 style="margin: 20px 0 12px; font-size: 14px; color: #888;">Memory Chunks</h3>
      <div class="search-bar">
        <input id="memory-search" type="text" placeholder="Search memories...">
        <button class="btn btn-primary" onclick="searchMemories()">Search</button>
      </div>
      <div class="memory-list" id="memory-results"></div>
    </div>

    <!-- SKILLS PANEL -->
    <div id="panel-skills" class="panel">
      <table>
        <thead><tr><th>Name</th><th>Description</th><th>Status</th></tr></thead>
        <tbody id="skills-body"></tbody>
      </table>
      <p id="skills-empty" style="color:#555; padding:20px; text-align:center; display:none;">No skills installed.</p>
    </div>

    <!-- CRON PANEL -->
    <div id="panel-cron" class="panel">
      <table>
        <thead><tr><th>Name</th><th>Schedule</th><th>Task</th><th>Enabled</th><th>Last Run</th></tr></thead>
        <tbody id="cron-body"></tbody>
      </table>
      <p id="cron-empty" style="color:#555; padding:20px; text-align:center; display:none;">No cron jobs configured.</p>
    </div>

    <!-- LOGS PANEL -->
    <div id="panel-logs" class="panel">
      <div class="editor-toolbar">
        <button class="btn btn-ghost" onclick="loadLogs()">Refresh</button>
        <span id="logs-status" style="font-size:12px; color:#666;"></span>
      </div>
      <div class="log-view" id="log-content"></div>
    </div>

  </div>
</div>

<div class="toast" id="toast"></div>

<script>
function showPanel(name) {
  document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('#sidebar a').forEach(function(a) { a.classList.remove('active'); });
  var panel = document.getElementById('panel-' + name);
  if (panel) panel.classList.add('active');
  var link = document.querySelector('#sidebar a[href="#' + name + '"]');
  if (link) link.classList.add('active');
  document.getElementById('topbar-title').textContent = name.charAt(0).toUpperCase() + name.slice(1);
  if (name === 'status') loadStatus();
  if (name === 'system') loadSystem();
  if (name === 'memory') loadMemory();
  if (name === 'skills') loadSkills();
  if (name === 'cron') loadCron();
  if (name === 'logs') loadLogs();
}

function toast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function() { t.classList.remove('show'); }, 2000);
}

function api(path, opts) {
  return fetch('/api/dashboard' + path, opts).then(function(r) { return r.json(); });
}

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

function loadMemory() {
  api('/memory').then(function(data) {
    document.getElementById('memory-editor').value = data.content || '';
    document.getElementById('memory-status').textContent = 'Loaded';
  });
}
function saveMemory() {
  var content = document.getElementById('memory-editor').value;
  api('/memory', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({content: content}) }).then(function() {
    document.getElementById('memory-status').textContent = 'Saved';
    toast('Memory saved');
  });
}
function searchMemories() {
  var query = document.getElementById('memory-search').value.trim();
  if (!query) return;
  api('/memory/search?q=' + encodeURIComponent(query)).then(function(data) {
    var el = document.getElementById('memory-results');
    el.replaceChildren();
    if (!data.results || !data.results.length) {
      var p = document.createElement('p');
      p.style.color = '#555';
      p.textContent = 'No results.';
      el.appendChild(p);
      return;
    }
    data.results.forEach(function(r) {
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
      el.appendChild(item);
    });
  });
}

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
      nameCell.textContent = s.name;
      nameCell.style.fontWeight = '600';
      var descCell = document.createElement('td');
      descCell.textContent = s.description || '';
      var statusCell = document.createElement('td');
      statusCell.textContent = s.status;
      statusCell.style.color = s.status === 'ok' ? '#22c55e' : '#f59e0b';
      tr.appendChild(nameCell);
      tr.appendChild(descCell);
      tr.appendChild(statusCell);
      body.appendChild(tr);
    });
  });
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

function loadLogs() {
  api('/logs').then(function(data) {
    document.getElementById('log-content').textContent = data.content || 'No logs.';
    document.getElementById('logs-status').textContent = 'Last 100 lines';
  });
}

loadStatus();
</script>
</body>
</html>`;
