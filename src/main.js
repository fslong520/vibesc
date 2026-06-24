import { initEngine, greenFlag, stopAll, loadProject, saveProject, getVM } from './scratch-engine.js';
import { hasApiKey, nlToBlocks } from './agnes-engine.js';
import { initBlockEditor, getWorkspace } from './block-editor.js';
import { initMaterialWorkshop, refreshWorkshop, workshopTools } from './material-workshop.js';
import { initPluginEngine } from './plugin-engine.js';

// ── DOM refs ──
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const btnSend = document.getElementById('btn-send');
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const btnOpen = document.getElementById('btn-open');
const btnSave = document.getElementById('btn-save');
const fileInput = document.getElementById('file-input');
const projectName = document.getElementById('project-name');
const btnFoldPanel = document.getElementById('btn-fold-panel');
const bottomPanel = document.getElementById('bottom-panel');

// ── 积木编辑器 SVG resize（布局变化时调用） ──
function resizeWorkspace() {
  const ws = getWorkspace();
  if (ws) {
    try { ws.resize(); } catch (_) {}
  }
}

// ── 初始化引擎 + 积木编辑器 ──
async function boot() {
  try {
    await initEngine('stage-canvas');
    console.log('[VibeSc] 引擎就绪');

    // VM 就绪后初始化积木编辑器
    initBlockEditor('workspace');
    console.log('[VibeSc] 积木编辑器就绪');

    // 素材工坊
    initMaterialWorkshop('ws-canvas');
    const vmInst = getVM();
    if (vmInst) {
      vmInst.on('TARGETS_UPDATE', () => {
        setTimeout(refreshWorkshop, 100);
      });
    }

    // 插件引擎
    initPluginEngine();

    // 布局变化时 resize 工作区
    window.addEventListener('resize', resizeWorkspace);
  } catch (err) {
    console.error('[VibeSc] 启动失败:', err);
  }
}
boot();

// ── 素材工坊工具按钮绑定 ──
document.querySelectorAll('[data-tool]').forEach(btn => {
  btn.addEventListener('click', () => {
    const tool = btn.dataset.tool;
    switch (tool) {
      case 'rotate-left': workshopTools.rotateLeft(); break;
      case 'rotate-right': workshopTools.rotateRight(); break;
      case 'flip-h': workshopTools.flipH(); break;
      case 'flip-v': workshopTools.flipV(); break;
      case 'apply-crop': workshopTools.applyCrop(); break;
      case 'cancel-crop': workshopTools.cancelCrop(); break;
      case 'discard': workshopTools.discardChanges(); break;
      case 'apply': workshopTools.applyChanges().catch(err => alert('应用失败: ' + err.message)); break;
    }
  });
});

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

// ── 舞台控制 ──
btnStart.addEventListener('click', greenFlag);
btnStop.addEventListener('click', stopAll);

// ── 打开 .sb3 文件 ──
btnOpen.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  await loadSb3File(file);
  fileInput.value = '';
});

// ── 拖拽导入 .sb3 ──
const stageArea = document.getElementById('stage-area');

stageArea.addEventListener('dragenter', (e) => {
  e.preventDefault();
  e.stopPropagation();
  stageArea.classList.add('drag-over');
});

stageArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
});

stageArea.addEventListener('dragleave', (e) => {
  e.preventDefault();
  e.stopPropagation();
  // 仅在离开 stage-area 时移除
  if (!stageArea.contains(e.relatedTarget)) {
    stageArea.classList.remove('drag-over');
  }
});

stageArea.addEventListener('drop', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  stageArea.classList.remove('drag-over');
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    const sb3 = Array.from(files).find(f => f.name.endsWith('.sb3'));
    if (sb3) await loadSb3File(sb3);
  }
});

async function loadSb3File(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    await loadProject(arrayBuffer);
    const name = file.name.replace(/\.sb3$/i, '');
    projectName.textContent = name;
  } catch (err) {
    alert('导入失败: ' + err.message);
  }
}

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

// ── Tauri IPC ──
if (window.__TAURI_INTERNALS__) {
  const { invoke } = window.__TAURI_INTERNALS__;
  invoke('get_plugins_dir').then(path => {
    console.log('插件目录:', path);
  }).catch(() => {});
}
