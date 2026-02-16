// Setup wizard HTML template — local-only, served on 127.0.0.1 during `zubo setup`
// All innerHTML usage is with hardcoded strings and user's own form input (no external/untrusted data)
export const SETUP_WIZARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Zubo Setup</title>
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
    --accent: #7c3aed;
    --accent-hover: #6d28d9;
    --accent-bg: rgba(124,58,237,0.08);
    --accent-border: rgba(124,58,237,0.2);
    --green: #10b981;
    --green-bg: rgba(16,185,129,0.1);
    --red: #ef4444;
    --red-bg: rgba(239,68,68,0.1);
    --yellow: #f59e0b;
    --fuchsia: #d946ef;
    --gradient: linear-gradient(135deg, #7c3aed, #d946ef);
    --radius: 10px;
    --radius-lg: 14px;
    --font: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --display: 'Bricolage Grotesque', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
  }

  body {
    font-family: var(--font);
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 40px 20px;
    -webkit-font-smoothing: antialiased;
  }

  .wizard {
    width: 100%;
    max-width: 720px;
  }

  /* Header */
  .header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 32px;
  }
  .header svg { width: 28px; height: 28px; flex-shrink: 0; }
  .header h1 {
    font-family: var(--display);
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.3px;
  }

  /* Stepper */
  .stepper {
    display: flex;
    gap: 4px;
    margin-bottom: 32px;
    padding: 6px;
    background: var(--bg-raised);
    border-radius: var(--radius);
    border: 1px solid var(--border);
  }
  .stepper-item {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
    transition: all 300ms ease;
    cursor: default;
  }
  .stepper-item.active {
    background: var(--bg-surface);
    color: var(--text);
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  }
  .stepper-item.done { color: var(--green); }
  .stepper-dot {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    flex-shrink: 0;
    transition: all 300ms ease;
  }
  .stepper-item.active .stepper-dot {
    border-color: var(--accent);
    background: var(--accent);
    color: white;
  }
  .stepper-item.done .stepper-dot {
    border-color: var(--green);
    background: var(--green);
    color: white;
  }

  /* Step panel */
  .step-panel {
    background: var(--bg-raised);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 32px;
    min-height: 340px;
    position: relative;
  }
  .step-content {
    transition: opacity 300ms ease, transform 300ms ease;
  }
  .step-content.entering {
    opacity: 0;
    transform: translateY(12px);
  }
  .step-title {
    font-family: var(--display);
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 6px;
  }
  .step-desc {
    font-size: 13px;
    color: var(--text-secondary);
    margin-bottom: 24px;
  }

  /* Navigation */
  .nav-bar {
    display: flex;
    justify-content: space-between;
    margin-top: 24px;
  }
  .btn {
    font-family: var(--font);
    font-size: 13px;
    font-weight: 600;
    padding: 10px 24px;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--bg-surface);
    color: var(--text);
    cursor: pointer;
    transition: all 200ms ease;
  }
  .btn:hover { background: var(--bg-hover); }
  .btn-primary {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }
  .btn-primary:hover { background: var(--accent-hover); }
  .btn-primary:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .btn-ghost {
    background: transparent;
    border-color: transparent;
    color: var(--text-secondary);
  }
  .btn-ghost:hover { color: var(--text); background: var(--bg-hover); }

  /* Provider grid */
  .provider-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 20px;
  }
  .provider-card {
    padding: 14px;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    transition: all 200ms ease;
    text-align: center;
    font-size: 13px;
    font-weight: 500;
  }
  .provider-card:hover {
    border-color: var(--accent-border);
    background: var(--accent-bg);
  }
  .provider-card.selected {
    border-color: var(--accent);
    background: var(--accent-bg);
    box-shadow: 0 0 0 1px var(--accent);
  }
  .provider-card .provider-icon {
    font-size: 22px;
    margin-bottom: 6px;
  }

  /* Provider form */
  .provider-form {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px;
    margin-top: 16px;
    animation: slideDown 200ms ease;
  }
  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .form-group { margin-bottom: 14px; }
  .form-group:last-child { margin-bottom: 0; }
  .form-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .form-input {
    width: 100%;
    padding: 10px 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-family: var(--mono);
    font-size: 13px;
    outline: none;
    transition: border-color 200ms ease;
  }
  .form-input:focus { border-color: var(--accent); }
  .form-input::placeholder { color: var(--text-muted); }
  textarea.form-input { resize: vertical; min-height: 80px; font-family: var(--font); }

  .form-hint {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 4px;
  }

  /* Test connection button + status */
  .test-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 14px;
  }
  .test-status {
    font-size: 13px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .test-status.success { color: var(--green); }
  .test-status.error { color: var(--red); }
  .test-status .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Local model list */
  .model-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }
  .model-tag {
    padding: 5px 10px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 12px;
    font-family: var(--mono);
    cursor: pointer;
    transition: all 200ms ease;
  }
  .model-tag:hover, .model-tag.selected {
    border-color: var(--accent);
    background: var(--accent-bg);
  }

  /* Fallback toggle */
  .toggle-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 16px;
    padding: 12px;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }
  .toggle-row label { font-size: 13px; cursor: pointer; }
  .toggle-switch {
    position: relative;
    width: 36px;
    height: 20px;
    flex-shrink: 0;
  }
  .toggle-switch input { display: none; }
  .toggle-slider {
    position: absolute;
    inset: 0;
    background: var(--border);
    border-radius: 10px;
    cursor: pointer;
    transition: background 200ms ease;
  }
  .toggle-slider::after {
    content: '';
    position: absolute;
    left: 2px;
    top: 2px;
    width: 16px;
    height: 16px;
    background: var(--text);
    border-radius: 50%;
    transition: transform 200ms ease;
  }
  .toggle-switch input:checked + .toggle-slider { background: var(--accent); }
  .toggle-switch input:checked + .toggle-slider::after { transform: translateX(16px); }

  /* Channel cards */
  .channel-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    margin-bottom: 16px;
  }
  .channel-card {
    padding: 14px 16px;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    transition: all 200ms ease;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .channel-card:hover {
    border-color: var(--accent-border);
  }
  .channel-card.selected {
    border-color: var(--accent);
    background: var(--accent-bg);
  }
  .channel-card.locked {
    opacity: 0.6;
    cursor: default;
  }
  .channel-card .ch-icon { font-size: 18px; }
  .channel-card .ch-name { font-size: 13px; font-weight: 500; }
  .channel-card .ch-badge {
    margin-left: auto;
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 4px;
    background: var(--green-bg);
    color: var(--green);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Channel config forms */
  .channel-config {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
    margin-top: 8px;
    animation: slideDown 200ms ease;
  }
  .channel-config h4 {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 12px;
  }

  /* Smart routing */
  .routing-card {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px;
  }
  .routing-card p {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.6;
    margin-bottom: 16px;
  }
  .routing-option {
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: 8px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: all 200ms ease;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .routing-option:hover { border-color: var(--accent-border); }
  .routing-option.selected {
    border-color: var(--accent);
    background: var(--accent-bg);
  }
  .routing-option .ro-label { font-size: 13px; font-weight: 500; }
  .routing-option .ro-desc { font-size: 12px; color: var(--text-secondary); }
  .routing-radio {
    width: 16px;
    height: 16px;
    border: 2px solid var(--border);
    border-radius: 50%;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .routing-option.selected .routing-radio {
    border-color: var(--accent);
  }
  .routing-option.selected .routing-radio::after {
    content: '';
    width: 8px;
    height: 8px;
    background: var(--accent);
    border-radius: 50%;
  }

  /* Completion screen */
  .completion {
    text-align: center;
    padding: 24px 0;
  }
  .completion .checkmark {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--green-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 20px;
    font-size: 28px;
    animation: popIn 400ms ease;
  }
  @keyframes popIn {
    0% { transform: scale(0); }
    70% { transform: scale(1.1); }
    100% { transform: scale(1); }
  }
  .completion h2 {
    font-family: var(--display);
    font-size: 22px;
    font-weight: 700;
    margin-bottom: 8px;
  }
  .completion .sub { color: var(--text-secondary); font-size: 14px; margin-bottom: 24px; }

  .summary-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 8px 16px;
    text-align: left;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px;
    margin-bottom: 24px;
    font-size: 13px;
  }
  .summary-grid .label {
    color: var(--text-secondary);
    font-weight: 500;
  }
  .summary-grid .value {
    font-family: var(--mono);
    font-size: 12px;
  }

  .next-steps {
    text-align: left;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px;
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.8;
  }
  .next-steps code {
    font-family: var(--mono);
    font-size: 12px;
    background: var(--bg);
    padding: 2px 6px;
    border-radius: 4px;
    color: var(--text);
  }

  .loading-overlay {
    position: absolute;
    inset: 0;
    background: rgba(6,6,8,0.85);
    border-radius: var(--radius-lg);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    z-index: 10;
  }
  .loading-overlay .spinner-lg {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  .loading-overlay span { font-size: 14px; color: var(--text-secondary); }

  /* Detect status badges */
  .detect-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    margin-bottom: 10px;
  }
  .detect-badge.found { background: var(--green-bg); color: var(--green); }
  .detect-badge.not-found { background: var(--red-bg); color: var(--red); }

  @media (max-width: 600px) {
    .provider-grid { grid-template-columns: repeat(2, 1fr); }
    .channel-grid { grid-template-columns: 1fr; }
    .stepper-item span { display: none; }
  }
</style>
</head>
<body>
<div class="wizard">
  <div class="header">
    <svg viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="#7c3aed"/><path d="M50 15C52 37 63 48 85 50C63 52 52 63 50 85C48 63 37 52 15 50C37 48 48 37 50 15Z" fill="white"/></svg>
    <h1>Zubo Setup</h1>
  </div>

  <div class="stepper" id="stepper">
    <div class="stepper-item active" data-step="1"><div class="stepper-dot">1</div><span>AI Provider</span></div>
    <div class="stepper-item" data-step="2"><div class="stepper-dot">2</div><span>Channels</span></div>
    <div class="stepper-item" data-step="3"><div class="stepper-dot">3</div><span>Personalize</span></div>
    <div class="stepper-item" data-step="4"><div class="stepper-dot">4</div><span>Cost Savings</span></div>
  </div>

  <div class="step-panel" id="stepPanel">
    <div class="step-content" id="stepContent"></div>
  </div>

  <div class="nav-bar" id="navBar">
    <button class="btn btn-ghost" id="backBtn" onclick="prevStep()">Back</button>
    <button class="btn btn-primary" id="nextBtn" onclick="nextStep()">Next</button>
  </div>
</div>

<script>
// All data here is hardcoded — no external/untrusted input flows into DOM rendering.
const PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic', icon: '\\u{1F9E0}', keyPrefix: 'sk-ant-', defaultModel: 'claude-sonnet-4-5-20250929', keyLabel: 'API Key', keyPlaceholder: 'sk-ant-...' },
  { id: 'openai', name: 'OpenAI', icon: '\\u{1F916}', keyPrefix: 'sk-', defaultModel: 'gpt-4.1', keyLabel: 'API Key', keyPlaceholder: 'sk-...' },
  { id: 'ollama', name: 'Ollama', icon: '\\u{1F999}', local: true, type: 'ollama', defaultModel: 'llama3.3' },
  { id: 'groq', name: 'Groq', icon: '\\u{26A1}', keyPrefix: 'gsk_', defaultModel: 'llama-3.3-70b-versatile', keyLabel: 'API Key', keyPlaceholder: 'gsk_...' },
  { id: 'together', name: 'Together', icon: '\\u{1F91D}', defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', keyLabel: 'API Key', keyPlaceholder: 'API key', baseUrl: 'https://api.together.xyz/v1' },
  { id: 'openrouter', name: 'OpenRouter', icon: '\\u{1F500}', defaultModel: 'anthropic/claude-sonnet-4-5', keyLabel: 'API Key', keyPlaceholder: 'API key', baseUrl: 'https://openrouter.ai/api/v1' },
  { id: 'deepseek', name: 'DeepSeek', icon: '\\u{1F50D}', defaultModel: 'deepseek-chat', keyLabel: 'API Key', keyPlaceholder: 'API key', baseUrl: 'https://api.deepseek.com/v1' },
  { id: 'xai', name: 'xAI (Grok)', icon: '\\u{2716}', defaultModel: 'grok-4.1-fast', keyLabel: 'API Key', keyPlaceholder: 'API key', baseUrl: 'https://api.x.ai/v1' },
  { id: 'minimax', name: 'MiniMax', icon: '\\u{303D}', defaultModel: 'MiniMax-M2.5', keyLabel: 'API Key', keyPlaceholder: 'API key' },
  { id: 'fireworks', name: 'Fireworks', icon: '\\u{1F386}', defaultModel: 'accounts/fireworks/models/llama-v3p3-70b-instruct', keyLabel: 'API Key', keyPlaceholder: 'API key', baseUrl: 'https://api.fireworks.ai/inference/v1' },
  { id: 'cerebras', name: 'Cerebras', icon: '\\u{1F9EA}', defaultModel: 'llama-3.3-70b', keyLabel: 'API Key', keyPlaceholder: 'API key', baseUrl: 'https://api.cerebras.ai/v1' },
  { id: 'lmstudio', name: 'LM Studio', icon: '\\u{1F5A5}', local: true, type: 'lmstudio', defaultModel: 'default' },
  { id: 'claude-code', name: 'Claude Code', icon: '\\u{1F4BB}', cli: true, cliTool: 'claude' },
  { id: 'codex', name: 'Codex', icon: '\\u{1F4DD}', cli: true, cliTool: 'codex' },
  { id: 'custom', name: 'Custom', icon: '\\u{1F527}', custom: true, defaultModel: 'default' },
];

const CHANNELS = [
  { id: 'telegram', name: 'Telegram', icon: '\\u{2708}', fields: [{key:'botToken',label:'Bot Token',placeholder:'123456:ABC-DEF...',hint:'Get from @BotFather on Telegram'}] },
  { id: 'discord', name: 'Discord', icon: '\\u{1F3AE}', fields: [{key:'botToken',label:'Bot Token',placeholder:'Bot token',hint:'discord.com/developers \\u{2192} Bot \\u{2192} Copy Token'}] },
  { id: 'slack', name: 'Slack', icon: '\\u{1F4AC}', fields: [{key:'botToken',label:'Bot Token (xoxb-)',placeholder:'xoxb-...',hint:''},{key:'appToken',label:'App Token (xapp-)',placeholder:'xapp-...',hint:'api.slack.com/apps \\u{2192} Socket Mode'}] },
  { id: 'whatsapp', name: 'WhatsApp', icon: '\\u{1F4F1}', fields: [], hint: 'QR code scan required on first start.' },
  { id: 'signal', name: 'Signal', icon: '\\u{1F512}', fields: [{key:'phoneNumber',label:'Phone Number',placeholder:'+1234567890',hint:'signal-cli must be installed and registered'}] },
  { id: 'email', name: 'Email', icon: '\\u{2709}', fields: [
    {key:'imap.host',label:'IMAP Host',placeholder:'imap.gmail.com',hint:''},
    {key:'imap.user',label:'IMAP User',placeholder:'you@gmail.com',hint:''},
    {key:'imap.password',label:'IMAP Password',placeholder:'App password',hint:'For Gmail use myaccount.google.com/apppasswords'},
    {key:'smtp.host',label:'SMTP Host',placeholder:'smtp.gmail.com',hint:''},
    {key:'smtp.user',label:'SMTP User',placeholder:'you@gmail.com',hint:''},
    {key:'smtp.password',label:'SMTP Password',placeholder:'App password',hint:''},
  ]},
];

// ── State ──
const state = {
  providers: {},
  activeProvider: '',
  failover: [],
  channels: { webchat: { enabled: true, port: 0 } },
  agentName: 'Zubo',
  personality: '',
  smartRouting: { enabled: false },
  showFallback: false,
  fallbackProvider: '',
  routingChoice: 'skip',
};
let currentStep = 1;
let completing = false;

// ── Helpers ──
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function setHTML(el, html) {
  // All HTML here is built from hardcoded constants above — safe for local-only wizard
  if (typeof el === 'string') el = document.getElementById(el);
  if (el) el.innerHTML = html;
}

// ── Step rendering ──
function renderStep() {
  const el = document.getElementById('stepContent');
  el.classList.add('entering');
  setTimeout(function() {
    switch (currentStep) {
      case 1: renderProvider(); break;
      case 2: renderChannels(); break;
      case 3: renderAgent(); break;
      case 4: renderRouting(); break;
      case 5: renderComplete(); break;
    }
    requestAnimationFrame(function() { el.classList.remove('entering'); });
  }, 150);
  updateStepper();
  updateNav();
}

function updateStepper() {
  document.querySelectorAll('.stepper-item').forEach(function(el) {
    var s = +el.dataset.step;
    el.className = 'stepper-item' + (s === currentStep && currentStep <= 4 ? ' active' : '') + (s < currentStep ? ' done' : '');
    el.querySelector('.stepper-dot').textContent = s < currentStep ? '\\u{2713}' : s;
  });
}

function updateNav() {
  var back = document.getElementById('backBtn');
  var next = document.getElementById('nextBtn');
  var nav = document.getElementById('navBar');
  if (currentStep === 5) { nav.style.display = 'none'; return; }
  nav.style.display = 'flex';
  back.style.visibility = currentStep === 1 ? 'hidden' : 'visible';
  next.textContent = currentStep === 4 ? 'Complete Setup' : 'Next';
  next.disabled = !canProceed();
}

function canProceed() {
  if (currentStep === 1) return !!state.activeProvider;
  return true;
}

function nextStep() {
  if (!canProceed()) return;
  if (currentStep === 1) collectProviderData();
  if (currentStep === 2) collectChannelData();
  if (currentStep === 3) collectAgentData();
  if (currentStep === 4) { collectRoutingData(); completeSetup(); return; }
  currentStep++;
  renderStep();
}

function prevStep() {
  if (currentStep <= 1) return;
  currentStep--;
  renderStep();
}

// ── Step 1: Provider ──
function renderProvider() {
  var html = '<h3 class="step-title">AI Provider</h3>';
  html += '<p class="step-desc">Choose the AI service that powers your agent.</p>';
  html += '<div class="provider-grid">';
  PROVIDERS.forEach(function(p) {
    html += '<div class="provider-card' + (state.activeProvider === p.id ? ' selected' : '') + '" data-pid="' + p.id + '">';
    html += '<div class="provider-icon">' + p.icon + '</div>';
    html += '<div>' + esc(p.name) + '</div></div>';
  });
  html += '</div>';
  html += '<div id="providerForm"></div>';
  html += '<div class="toggle-row"><label class="toggle-switch"><input type="checkbox" id="fallbackToggle"' + (state.showFallback ? ' checked' : '') + '><span class="toggle-slider"></span></label><label for="fallbackToggle">Add a fallback provider</label></div>';
  html += '<div id="fallbackSection"></div>';
  setHTML('stepContent', html);

  // Attach click handlers
  document.querySelectorAll('.provider-card[data-pid]').forEach(function(card) {
    card.addEventListener('click', function() { selectProvider(card.dataset.pid); });
  });
  document.getElementById('fallbackToggle').addEventListener('change', toggleFallback);

  if (state.activeProvider) showProviderForm(state.activeProvider, 'providerForm', false);
  if (state.showFallback) showFallbackSection();
}

function selectProvider(id) {
  state.activeProvider = id;
  document.querySelectorAll('.provider-card').forEach(function(c) { c.classList.remove('selected'); });
  var sel = document.querySelector('.provider-card[data-pid="' + id + '"]');
  if (sel) sel.classList.add('selected');
  showProviderForm(id, 'providerForm', false);
  updateNav();
}

function showProviderForm(id, containerId, isFallback) {
  var p = PROVIDERS.find(function(x) { return x.id === id; });
  if (!p) return;
  var prefix = isFallback ? 'fb_' : '';
  var container = document.getElementById(containerId);
  var html = '<div class="provider-form">';

  if (p.local) {
    html += '<div id="' + prefix + 'detectStatus"></div>';
    html += '<div class="form-group"><label class="form-label">Model</label>';
    html += '<input class="form-input" id="' + prefix + 'model" placeholder="' + esc(p.defaultModel) + '" value="' + esc(getProviderVal(id, 'model', isFallback)) + '"></div>';
    html += '<div id="' + prefix + 'modelList"></div>';
    html += '<div class="test-row"><button class="btn" id="' + prefix + 'detectBtn">Detect</button><span class="test-status" id="' + prefix + 'testStatus"></span></div>';
    html += '</div>';
    setHTML(container, html);
    document.getElementById(prefix + 'detectBtn').addEventListener('click', function() { detectLocal(p.type, prefix); });
    detectLocal(p.type, prefix);
    return;
  }

  if (p.cli) {
    html += '<div id="' + prefix + 'detectStatus"></div>';
    html += '</div>';
    setHTML(container, html);
    detectCli(p.cliTool, prefix);
    return;
  }

  if (p.custom) {
    html += '<div class="form-group"><label class="form-label">Provider Name</label>';
    html += '<input class="form-input" id="' + prefix + 'customName" placeholder="my-provider" value="' + esc(getProviderVal('custom', 'customName', isFallback)) + '"></div>';
    html += '<div class="form-group"><label class="form-label">Base URL</label>';
    html += '<input class="form-input" id="' + prefix + 'baseUrl" placeholder="https://api.example.com/v1" value="' + esc(getProviderVal('custom', 'baseUrl', isFallback)) + '"></div>';
  }

  html += '<div class="form-group"><label class="form-label">' + esc(p.keyLabel || 'API Key') + '</label>';
  html += '<input class="form-input" id="' + prefix + 'apiKey" type="password" placeholder="' + esc(p.keyPlaceholder || 'API key') + '" value="' + esc(getProviderVal(id, 'apiKey', isFallback)) + '"></div>';
  html += '<div class="form-group"><label class="form-label">Model</label>';
  html += '<input class="form-input" id="' + prefix + 'model" placeholder="' + esc(p.defaultModel) + '" value="' + esc(getProviderVal(id, 'model', isFallback)) + '"></div>';
  html += '<div class="test-row"><button class="btn" id="' + prefix + 'testBtn">Test Connection</button><span class="test-status" id="' + prefix + 'testStatus"></span></div>';
  html += '</div>';
  setHTML(container, html);
  document.getElementById(prefix + 'testBtn').addEventListener('click', function() { testConnection(prefix, id); });
}

function getProviderVal(id, key, isFallback) {
  var cfg = isFallback ? state.providers[state.fallbackProvider] : state.providers[id];
  if (!cfg) return '';
  return cfg[key] || '';
}

function toggleFallback() {
  state.showFallback = document.getElementById('fallbackToggle').checked;
  if (state.showFallback) showFallbackSection();
  else setHTML('fallbackSection', '');
}

function showFallbackSection() {
  var sec = document.getElementById('fallbackSection');
  var html = '<div style="margin-top:12px"><p class="step-desc">Choose a fallback provider:</p>';
  html += '<div class="provider-grid">';
  PROVIDERS.filter(function(p) { return p.id !== state.activeProvider; }).forEach(function(p) {
    html += '<div class="provider-card' + (state.fallbackProvider === p.id ? ' selected' : '') + '" data-fbid="' + p.id + '">';
    html += '<div class="provider-icon">' + p.icon + '</div>';
    html += '<div>' + esc(p.name) + '</div></div>';
  });
  html += '</div><div id="fallbackForm"></div></div>';
  setHTML(sec, html);

  document.querySelectorAll('.provider-card[data-fbid]').forEach(function(card) {
    card.addEventListener('click', function() { selectFallback(card.dataset.fbid); });
  });
  if (state.fallbackProvider) showProviderForm(state.fallbackProvider, 'fallbackForm', true);
}

function selectFallback(id) {
  state.fallbackProvider = id;
  showFallbackSection();
}

async function testConnection(prefix, providerId) {
  var statusEl = document.getElementById(prefix + 'testStatus');
  statusEl.className = 'test-status';
  setHTML(statusEl, '<div class="spinner"></div> Testing...');
  var p = PROVIDERS.find(function(x) { return x.id === providerId; });
  var apiKey = document.getElementById(prefix + 'apiKey')?.value;
  var model = document.getElementById(prefix + 'model')?.value || p.defaultModel;
  var baseUrl = document.getElementById(prefix + 'baseUrl')?.value || p.baseUrl;
  var config = { apiKey: apiKey, model: model };
  if (baseUrl) config.baseUrl = baseUrl;
  var name = providerId;
  if (providerId === 'custom') {
    name = document.getElementById(prefix + 'customName')?.value || 'custom';
  }
  try {
    var res = await fetch('/api/validate-provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, config: config }),
    });
    var data = await res.json();
    if (data.ok) {
      statusEl.className = 'test-status success';
      statusEl.textContent = '\\u{2713} Connected';
    } else {
      statusEl.className = 'test-status error';
      statusEl.textContent = '\\u{2717} ' + (data.error || 'Failed');
    }
  } catch (e) {
    statusEl.className = 'test-status error';
    statusEl.textContent = '\\u{2717} Network error';
  }
}

async function detectLocal(type, prefix) {
  var statusEl = document.getElementById(prefix + 'detectStatus');
  setHTML(statusEl, '<div class="detect-badge" style="color:var(--text-secondary);background:var(--bg-surface)"><div class="spinner" style="width:12px;height:12px;border-width:2px"></div> Detecting...</div>');
  try {
    var res = await fetch('/api/detect-local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: type }),
    });
    var data = await res.json();
    if (data.running) {
      statusEl.textContent = '';
      var badge = document.createElement('div');
      badge.className = 'detect-badge found';
      badge.textContent = '\\u{2713} Running (' + data.models.length + ' model' + (data.models.length !== 1 ? 's' : '') + ')';
      statusEl.appendChild(badge);

      if (data.models.length) {
        var listEl = document.getElementById(prefix + 'modelList');
        var lbl = document.createElement('label');
        lbl.className = 'form-label';
        lbl.style.marginBottom = '6px';
        lbl.textContent = 'Available Models';
        listEl.textContent = '';
        listEl.appendChild(lbl);
        var listDiv = document.createElement('div');
        listDiv.className = 'model-list';
        data.models.slice(0, 12).forEach(function(m) {
          var tag = document.createElement('span');
          tag.className = 'model-tag';
          tag.textContent = m;
          tag.dataset.model = m;
          tag.addEventListener('click', function() { pickModel(prefix, tag); });
          listDiv.appendChild(tag);
        });
        listEl.appendChild(listDiv);
      }
    } else {
      var label = type === 'ollama' ? 'Ollama' : 'LM Studio';
      var hint = type === 'ollama' ? 'Run ollama serve or open the Ollama app' : 'Open LM Studio and start the local server';
      statusEl.textContent = '';
      var b = document.createElement('div');
      b.className = 'detect-badge not-found';
      b.textContent = '\\u{2717} ' + label + ' not detected';
      statusEl.appendChild(b);
      var p2 = document.createElement('p');
      p2.className = 'form-hint';
      p2.textContent = hint;
      statusEl.appendChild(p2);
    }
  } catch (e) {
    statusEl.textContent = '';
    var fb = document.createElement('div');
    fb.className = 'detect-badge not-found';
    fb.textContent = '\\u{2717} Detection failed';
    statusEl.appendChild(fb);
  }
}

async function detectCli(tool, prefix) {
  var statusEl = document.getElementById(prefix + 'detectStatus');
  setHTML(statusEl, '<div class="detect-badge" style="color:var(--text-secondary);background:var(--bg-surface)"><div class="spinner" style="width:12px;height:12px;border-width:2px"></div> Checking...</div>');
  try {
    var res = await fetch('/api/detect-cli', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: tool }),
    });
    var data = await res.json();
    statusEl.textContent = '';
    if (data.installed) {
      var badge = document.createElement('div');
      badge.className = 'detect-badge found';
      badge.textContent = '\\u{2713} ' + tool + ' CLI found';
      statusEl.appendChild(badge);
    } else {
      var cmd = tool === 'claude' ? 'npm install -g @anthropic-ai/claude-code' : 'npm install -g @openai/codex';
      var b = document.createElement('div');
      b.className = 'detect-badge not-found';
      b.textContent = '\\u{2717} ' + tool + ' not found';
      statusEl.appendChild(b);
      var p = document.createElement('p');
      p.className = 'form-hint';
      p.textContent = 'Install with: ' + cmd;
      statusEl.appendChild(p);
    }
  } catch (e) {
    statusEl.textContent = '';
    var fb = document.createElement('div');
    fb.className = 'detect-badge not-found';
    fb.textContent = '\\u{2717} Detection failed';
    statusEl.appendChild(fb);
  }
}

function pickModel(prefix, el) {
  document.getElementById(prefix + 'model').value = el.dataset.model;
  el.closest('.model-list').querySelectorAll('.model-tag').forEach(function(t) { t.classList.remove('selected'); });
  el.classList.add('selected');
}

function collectProviderData() {
  var p = PROVIDERS.find(function(x) { return x.id === state.activeProvider; });
  if (!p) return;

  if (p.cli) {
    var model = 'default';
    state.providers[p.id] = { model: model };
  } else if (p.local) {
    var m = document.getElementById('model')?.value || p.defaultModel;
    var baseUrl = p.type === 'ollama' ? 'http://localhost:11434/v1' : 'http://localhost:1234/v1';
    var apiKey = p.type === 'ollama' ? 'ollama' : 'lm-studio';
    state.providers[p.id] = { baseUrl: baseUrl, apiKey: apiKey, model: m };
  } else if (p.custom) {
    var name = document.getElementById('customName')?.value || 'custom';
    var bu = document.getElementById('baseUrl')?.value;
    var ak = document.getElementById('apiKey')?.value;
    var md = document.getElementById('model')?.value || 'default';
    state.providers[name] = { baseUrl: bu, apiKey: ak, model: md };
    state.activeProvider = name;
  } else {
    var ak2 = document.getElementById('apiKey')?.value;
    var md2 = document.getElementById('model')?.value || p.defaultModel;
    var cfg = { apiKey: ak2, model: md2 };
    if (p.baseUrl) cfg.baseUrl = p.baseUrl;
    state.providers[p.id] = cfg;
  }

  // Fallback
  state.failover = [];
  if (state.showFallback && state.fallbackProvider) {
    var fb = PROVIDERS.find(function(x) { return x.id === state.fallbackProvider; });
    if (fb) {
      if (fb.cli) {
        var fbm = 'default';
        state.providers[fb.id] = { model: fbm };
      } else if (fb.local) {
        var fbModel = document.getElementById('fb_model')?.value || fb.defaultModel;
        var fbBase = fb.type === 'ollama' ? 'http://localhost:11434/v1' : 'http://localhost:1234/v1';
        var fbKey = fb.type === 'ollama' ? 'ollama' : 'lm-studio';
        state.providers[fb.id] = { baseUrl: fbBase, apiKey: fbKey, model: fbModel };
      } else if (fb.custom) {
        var fbName = document.getElementById('fb_customName')?.value || 'custom-fb';
        var fbBu = document.getElementById('fb_baseUrl')?.value;
        var fbAk = document.getElementById('fb_apiKey')?.value;
        var fbMd = document.getElementById('fb_model')?.value || 'default';
        state.providers[fbName] = { baseUrl: fbBu, apiKey: fbAk, model: fbMd };
        state.fallbackProvider = fbName;
      } else {
        var fbAk2 = document.getElementById('fb_apiKey')?.value;
        var fbMd2 = document.getElementById('fb_model')?.value || fb.defaultModel;
        var fbCfg = { apiKey: fbAk2, model: fbMd2 };
        if (fb.baseUrl) fbCfg.baseUrl = fb.baseUrl;
        state.providers[fb.id] = fbCfg;
      }
      state.failover = [state.fallbackProvider];
    }
  }
}

// ── Step 2: Channels ──
function renderChannels() {
  var html = '<h3 class="step-title">Channels</h3>';
  html += '<p class="step-desc">Choose how people can talk to your agent.</p>';
  html += '<div class="channel-grid">';
  html += '<div class="channel-card locked"><span class="ch-icon">\\u{1F310}</span><span class="ch-name">WebChat</span><span class="ch-badge">Always on</span></div>';
  CHANNELS.forEach(function(ch) {
    var sel = !!state.channels[ch.id]?.enabled;
    html += '<div class="channel-card' + (sel ? ' selected' : '') + '" data-chid="' + ch.id + '">';
    html += '<span class="ch-icon">' + ch.icon + '</span><span class="ch-name">' + esc(ch.name) + '</span>';
    if (sel) html += '<span class="ch-badge">On</span>';
    html += '</div>';
  });
  html += '</div>';
  html += '<div id="channelConfigs"></div>';
  setHTML('stepContent', html);

  document.querySelectorAll('.channel-card[data-chid]').forEach(function(card) {
    card.addEventListener('click', function() { toggleChannel(card.dataset.chid); });
  });
  renderChannelConfigs();
}

function toggleChannel(id) {
  if (state.channels[id]?.enabled) {
    delete state.channels[id];
  } else {
    state.channels[id] = { enabled: true };
  }
  renderChannels();
}

function renderChannelConfigs() {
  var container = document.getElementById('channelConfigs');
  var html = '';
  CHANNELS.forEach(function(ch) {
    if (!state.channels[ch.id]?.enabled) return;
    if (ch.fields.length === 0 && ch.hint) {
      html += '<div class="channel-config"><h4>' + ch.icon + ' ' + esc(ch.name) + '</h4><p class="form-hint">' + esc(ch.hint) + '</p></div>';
      return;
    }
    if (ch.fields.length === 0) return;
    html += '<div class="channel-config"><h4>' + ch.icon + ' ' + esc(ch.name) + '</h4>';
    ch.fields.forEach(function(f) {
      var val = getChannelVal(ch.id, f.key);
      html += '<div class="form-group"><label class="form-label">' + esc(f.label) + '</label>';
      html += '<input class="form-input" data-channel="' + ch.id + '" data-field="' + f.key + '" placeholder="' + esc(f.placeholder) + '" value="' + esc(val) + '">';
      if (f.hint) html += '<p class="form-hint">' + esc(f.hint) + '</p>';
      html += '</div>';
    });
    html += '</div>';
  });
  setHTML(container, html);
}

function getChannelVal(chId, key) {
  var ch = state.channels[chId];
  if (!ch) return '';
  var parts = key.split('.');
  var val = ch;
  for (var i = 0; i < parts.length; i++) { val = val?.[parts[i]]; }
  return val || '';
}

function collectChannelData() {
  document.querySelectorAll('.channel-config input[data-channel]').forEach(function(input) {
    var chId = input.dataset.channel;
    var field = input.dataset.field;
    var val = input.value;
    if (!state.channels[chId]) state.channels[chId] = { enabled: true };
    var parts = field.split('.');
    if (parts.length === 2) {
      if (!state.channels[chId][parts[0]]) state.channels[chId][parts[0]] = {};
      state.channels[chId][parts[0]][parts[1]] = val;
    } else {
      state.channels[chId][field] = val;
    }
  });

  // Add defaults
  CHANNELS.forEach(function(ch) {
    if (!state.channels[ch.id]?.enabled) return;
    if (ch.id === 'telegram' && !state.channels.telegram.allowedUsers) state.channels.telegram.allowedUsers = [];
    if (ch.id === 'discord' && !state.channels.discord.allowedUsers) state.channels.discord.allowedUsers = [];
    if (ch.id === 'slack' && !state.channels.slack.allowedUsers) state.channels.slack.allowedUsers = [];
    if (ch.id === 'whatsapp' && !state.channels.whatsapp.allowedNumbers) state.channels.whatsapp.allowedNumbers = [];
    if (ch.id === 'signal' && !state.channels.signal.allowedNumbers) state.channels.signal.allowedNumbers = [];
    if (ch.id === 'email') {
      var e = state.channels.email;
      if (e.imap && !e.imap.port) e.imap.port = 993;
      if (e.imap && e.imap.tls === undefined) e.imap.tls = true;
      if (e.smtp && !e.smtp.port) e.smtp.port = 587;
      if (e.smtp && e.smtp.tls === undefined) e.smtp.tls = true;
      if (!e.allowedSenders) e.allowedSenders = [];
    }
  });
}

// ── Step 3: Agent ──
function renderAgent() {
  var html = '<h3 class="step-title">Personalization</h3>';
  html += '<p class="step-desc">Give your agent a name and personality.</p>';
  html += '<div class="form-group"><label class="form-label">Agent Name</label>';
  html += '<input class="form-input" id="agentName" placeholder="Zubo" value="' + esc(state.agentName) + '"></div>';
  html += '<div class="form-group"><label class="form-label">Personality <span style="color:var(--text-muted)">(optional)</span></label>';
  html += '<textarea class="form-input" id="personality" placeholder="Describe your agent&#39;s personality in a sentence or two...">' + esc(state.personality) + '</textarea>';
  html += '<p class="form-hint">Leave blank for a sensible default.</p></div>';
  setHTML('stepContent', html);
}

function collectAgentData() {
  state.agentName = document.getElementById('agentName')?.value || 'Zubo';
  state.personality = document.getElementById('personality')?.value || '';
}

// ── Step 4: Smart Routing ──
function renderRouting() {
  var html = '<h3 class="step-title">Smart Cost Savings</h3>';
  html += '<div class="routing-card">';
  html += '<p>Use a cheaper, faster AI for simple questions (greetings, one-liners) and your main AI for complex tasks. This can save 50-80% on costs.</p>';

  var hasSecondProvider = state.failover.length > 0;

  if (hasSecondProvider) {
    html += buildRoutingOption('fallback', 'Use fallback provider', 'Route simple queries to ' + esc(state.failover[0]));
  }

  html += buildRoutingOption('groq', 'Add Groq (free & fast)', 'Great for simple queries');

  if (state.routingChoice === 'groq') {
    html += '<div class="provider-form" style="margin:8px 0 8px 34px"><div class="form-group"><label class="form-label">Groq API Key</label>';
    html += '<input class="form-input" id="groqKey" placeholder="gsk_..." value="' + esc(state.providers.groq?.apiKey || '') + '"></div></div>';
  }

  html += buildRoutingOption('smaller', 'Use a smaller model', 'Same provider, lighter model');

  if (state.routingChoice === 'smaller') {
    html += '<div class="provider-form" style="margin:8px 0 8px 34px"><div class="form-group"><label class="form-label">Fast Model Name</label>';
    html += '<input class="form-input" id="fastModel" placeholder="e.g. claude-haiku-4-5-20251001" value=""></div></div>';
  }

  html += buildRoutingOption('skip', 'Skip for now', 'You can enable this later');
  html += '</div>';
  setHTML('stepContent', html);

  // Attach click handlers
  document.querySelectorAll('.routing-option[data-rid]').forEach(function(opt) {
    opt.addEventListener('click', function() { selectRouting(opt.dataset.rid); });
  });

  // Pre-select fallback if available and no explicit choice yet
  if (hasSecondProvider && state.routingChoice === 'skip') {
    state.routingChoice = 'fallback';
    renderRouting();
  }
}

function buildRoutingOption(id, label, desc) {
  var selected = state.routingChoice === id;
  return '<div class="routing-option' + (selected ? ' selected' : '') + '" data-rid="' + id + '">' +
    '<div class="routing-radio"></div><div><div class="ro-label">' + esc(label) + '</div><div class="ro-desc">' + esc(desc) + '</div></div></div>';
}

function selectRouting(id) {
  state.routingChoice = id;
  renderRouting();
}

function collectRoutingData() {
  if (state.routingChoice === 'fallback') {
    state.smartRouting = { enabled: true, fastProvider: state.failover[0] };
  } else if (state.routingChoice === 'groq') {
    var key = document.getElementById('groqKey')?.value;
    if (key) {
      state.providers.groq = { apiKey: key, model: 'llama-3.3-70b-versatile' };
      state.smartRouting = { enabled: true, fastProvider: 'groq' };
    } else {
      state.smartRouting = { enabled: false };
    }
  } else if (state.routingChoice === 'smaller') {
    var model = document.getElementById('fastModel')?.value;
    if (model) {
      state.smartRouting = { enabled: true, fastProvider: state.activeProvider, fastModel: model };
    } else {
      state.smartRouting = { enabled: false };
    }
  } else {
    state.smartRouting = { enabled: false };
  }
}

// ── Step 5: Completion ──
async function completeSetup() {
  if (completing) return;
  completing = true;
  currentStep = 5;
  updateStepper();
  updateNav();

  // Show loading
  var panel = document.getElementById('stepPanel');
  panel.textContent = '';
  var overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  var spinner = document.createElement('div');
  spinner.className = 'spinner-lg';
  var msg = document.createElement('span');
  msg.textContent = 'Saving configuration...';
  overlay.appendChild(spinner);
  overlay.appendChild(msg);
  panel.appendChild(overlay);

  // Build payload
  var anthropicApiKey = state.activeProvider === 'anthropic' ? state.providers.anthropic?.apiKey : undefined;
  var telegramBotToken = state.channels.telegram?.botToken;

  var payload = {
    providers: state.providers,
    activeProvider: state.activeProvider,
    failover: state.failover,
    anthropicApiKey: anthropicApiKey,
    telegramBotToken: telegramBotToken,
    channels: state.channels,
    smartRouting: state.smartRouting,
    agentName: state.agentName,
    personality: state.personality,
  };

  try {
    var res = await fetch('/api/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Setup failed');
    renderComplete();
  } catch (e) {
    panel.textContent = '';
    var content = document.createElement('div');
    content.className = 'step-content';
    var title = document.createElement('h3');
    title.className = 'step-title';
    title.style.color = 'var(--red)';
    title.textContent = 'Setup Failed';
    var desc = document.createElement('p');
    desc.className = 'step-desc';
    desc.textContent = e.message;
    var retry = document.createElement('button');
    retry.className = 'btn btn-primary';
    retry.textContent = 'Try Again';
    retry.addEventListener('click', function() { currentStep = 4; completing = false; renderStep(); });
    content.appendChild(title);
    content.appendChild(desc);
    content.appendChild(retry);
    panel.appendChild(content);
  }
}

function renderComplete() {
  var panel = document.getElementById('stepPanel');
  var providerModel = state.providers[state.activeProvider]?.model || state.activeProvider;
  var channelNames = Object.keys(state.channels).filter(function(c) { return state.channels[c]?.enabled !== false; });

  // Build completion screen using DOM methods
  panel.textContent = '';
  var wrap = document.createElement('div');
  wrap.className = 'step-content';
  var comp = document.createElement('div');
  comp.className = 'completion';

  var checkmark = document.createElement('div');
  checkmark.className = 'checkmark';
  checkmark.textContent = '\\u{2713}';
  comp.appendChild(checkmark);

  var h2 = document.createElement('h2');
  h2.textContent = 'Setup Complete!';
  comp.appendChild(h2);

  var sub = document.createElement('p');
  sub.className = 'sub';
  sub.textContent = 'Your agent is ready to go.';
  comp.appendChild(sub);

  // Summary grid
  var grid = document.createElement('div');
  grid.className = 'summary-grid';
  function addRow(label, value) {
    var l = document.createElement('span');
    l.className = 'label';
    l.textContent = label;
    var v = document.createElement('span');
    v.className = 'value';
    v.textContent = value;
    grid.appendChild(l);
    grid.appendChild(v);
  }
  addRow('Agent', state.agentName);
  addRow('Provider', state.activeProvider + ' (' + providerModel + ')');
  if (state.failover.length) addRow('Fallback', state.failover.join(', '));
  if (state.smartRouting.enabled) addRow('Routing', 'Smart (fast \\u{2192} ' + (state.smartRouting.fastProvider || '') + ')');
  addRow('Channels', channelNames.join(', '));
  comp.appendChild(grid);

  // Next steps
  var ns = document.createElement('div');
  ns.className = 'next-steps';
  var b = document.createElement('strong');
  b.textContent = 'Next steps:';
  ns.appendChild(b);
  ns.appendChild(document.createElement('br'));
  ns.appendChild(document.createTextNode('1. Start your agent: '));
  var c1 = document.createElement('code');
  c1.textContent = 'zubo start';
  ns.appendChild(c1);
  ns.appendChild(document.createElement('br'));
  ns.appendChild(document.createTextNode('2. The dashboard opens automatically in your browser'));
  ns.appendChild(document.createElement('br'));
  ns.appendChild(document.createTextNode('3. Tell ' + state.agentName + ' to connect integrations'));
  ns.appendChild(document.createElement('br'));
  ns.appendChild(document.createElement('br'));
  var close = document.createElement('span');
  close.style.color = 'var(--text-muted)';
  close.textContent = 'You can close this tab now.';
  ns.appendChild(close);
  comp.appendChild(ns);

  wrap.appendChild(comp);
  panel.appendChild(wrap);
}

// ── Init ──
renderStep();
</script>
</body>
</html>`;
