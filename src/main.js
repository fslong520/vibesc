import { initEngine, greenFlag, stopAll, saveProject } from './scratch-engine.js';
import { hasApiKey, nlToBlocks } from './agnes-engine.js';

// ── DOM refs ──
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const btnSend = document.getElementById('btn-send');
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const btnSave = document.getElementById('btn-save');
const projectName = document.getElementById('project-name');
const btnFoldPanel = document.getElementById('btn-fold-panel');
const bottomPanel = document.getElementById('bottom-panel');

// ── 初始化引擎 ──
async function boot() {
  try {
    await initEngine('stage-canvas');
    console.log('[VibeSc] 引擎就绪');
  } catch (err) {
    console.error('[VibeSc] 引擎启动失败:', err);
  }
}
boot();

// ── 底部面板标签切换 ──
const bottomTabs = document.querySelectorAll('.bottom-tab');
const panelContents = document.querySelectorAll('.panel-content');

bottomTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    bottomTabs.forEach(t => t.classList.remove('active'));
    panelContents.forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const panel = document.getElementById(`panel-${tab.dataset.panel}`);
    if (panel) panel.classList.add('active');
  });
});

// ── 底部面板折叠 ──
let isCollapsed = false;
btnFoldPanel.addEventListener('click', () => {
  isCollapsed = !isCollapsed;
  bottomPanel.classList.toggle('collapsed', isCollapsed);
  btnFoldPanel.textContent = isCollapsed ? '▲' : '▼';
});

// ── 脚本标签切换 ──
const scriptTabs = document.querySelectorAll('.script-tab');
scriptTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    scriptTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
  });
});

// ── 舞台控制 ──
btnStart.addEventListener('click', greenFlag);
btnStop.addEventListener('click', stopAll);

// ── 保存项目 ──
btnSave.addEventListener('click', async () => {
  try {
    const data = await saveProject();
    const blob = new Blob([data], { type: 'application/x.scratch.sb3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.textContent || '未命名项目'}.sb3`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('保存失败: ' + err.message);
  }
});

// ── 发送 AI 消息 ──
let chatHistory = [];

btnSend.addEventListener('click', sendMessage);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  chatHistory.push({ role: 'user', content: text });
  appendMessage('user', text);
  chatInput.value = '';
  btnSend.disabled = true;

  const loadingId = appendMessage('bot', '正在思考...⏳');

  try {
    const keyAvailable = await hasApiKey();
    if (!keyAvailable) {
      updateMessage(loadingId, `⚠️ AGNES_API_KEY 未设置。

请设置环境变量后再试：
\`\`\`bash
export AGNES_API_KEY=你的密钥
\`\`\`

不过目前你可以用以下命令先体验积木效果：
1. 点击舞台上的 ▶ 按钮
2. 看小猫在舞台上的默认动画`);
      chatHistory.pop();
      return;
    }

    const response = await nlToBlocks(text, chatHistory.slice(0, -1));
    chatHistory.push({ role: 'assistant', content: response });
    updateMessage(loadingId, response);
  } catch (err) {
    updateMessage(loadingId, `出错了：${err.message}`);
    chatHistory.pop();
  } finally {
    btnSend.disabled = false;
  }
}

function appendMessage(role, text) {
  const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const div = document.createElement('div');
  div.className = `chat-message ${role}`;
  div.id = id;
  div.innerHTML = `
    <div class="message-avatar">${role === 'user' ? '🧒' : '🤖'}</div>
    <div class="message-content">${text}</div>
  `;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return id;
}

function updateMessage(id, text) {
  const el = document.getElementById(id);
  if (el) {
    el.querySelector('.message-content').textContent = text;
  }
}

// ── 积木分类 ──
function initBlockCategories() {
  const container = document.getElementById('block-categories');
  if (!container) return;
  const categories = ['运动', '外观', '声音', '事件', '控制', '侦测', '运算', '变量', '硬件'];
  categories.forEach(cat => {
    const span = document.createElement('span');
    span.className = 'block-cat';
    if (cat === '运动') span.classList.add('active');
    span.textContent = cat;
    container.appendChild(span);
    span.addEventListener('click', () => {
      container.querySelectorAll('.block-cat').forEach(c => c.classList.remove('active'));
      span.classList.add('active');
    });
  });
}
initBlockCategories();

// ── Tauri IPC ──
if (window.__TAURI_INTERNALS__) {
  const { invoke } = window.__TAURI_INTERNALS__;
  invoke('get_plugins_dir').then(path => {
    console.log('插件目录:', path);
  }).catch(() => {});
}
