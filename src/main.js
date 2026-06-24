// === 底部面板切换 ===
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

// === 底部面板折叠 ===
const btnFold = document.getElementById('btn-fold-panel');
const bottomPanel = document.getElementById('bottom-panel');
let isCollapsed = false;

btnFold.addEventListener('click', () => {
  isCollapsed = !isCollapsed;
  bottomPanel.classList.toggle('collapsed', isCollapsed);
  btnFold.textContent = isCollapsed ? '▲' : '▼';
});

// === 脚本标签切换 ===
const scriptTabs = document.querySelectorAll('.script-tab');
scriptTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    scriptTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
  });
});

// === 发送按钮 ===
const btnSend = document.getElementById('btn-send');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');

btnSend.addEventListener('click', async () => {
  const text = chatInput.value.trim();
  if (!text) return;

  // 添加用户消息
  appendMessage('user', text);
  chatInput.value = '';
  btnSend.disabled = true;

  // 添加"正在思考..."占位
  const loadingId = appendMessage('bot', '正在思考...⏳');

  try {
    // 调用 Agnes AI
    const response = await generateBlocks(text);
    // 替换占位
    updateMessage(loadingId, response);
  } catch (err) {
    updateMessage(loadingId, `出错了：${err.message}`);
  } finally {
    btnSend.disabled = false;
  }
});

// 回车发送（Shift+Enter 换行）
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    btnSend.click();
  }
});

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

// === Agnes AI 集成 (占位) ===
async function generateBlocks(prompt) {
  // TODO: 接入真实 Agnes API
  // 暂时返回模拟回复
  return `好的！你想"${prompt}"，我建议用以下积木来实现：\n\n1. 🟢 事件 → 「当 ⚑ 被点击」\n2. 🔵 运动 → 「移动 10 步」\n3. 🟣 外观 → 「说 Hello! 2 秒」\n\n点击"应用"自动添加到工作区。`;
}

// === 角色列表 ===
function initSpriteList() {
  const list = document.getElementById('sprite-list');
  const sprites = [
    { name: '小猫', emoji: '🐱' },
  ];
  sprites.forEach(s => {
    const div = document.createElement('div');
    div.className = 'sprite-item active';
    div.textContent = s.emoji;
    div.title = s.name;
    list.appendChild(div);
  });
}
initSpriteList();

// === 积木分类 ===
function initBlockCategories() {
  const container = document.getElementById('block-categories');
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

// === Tauri IPC 测试 ===
if (window.__TAURI_INTERNALS__) {
  const { invoke } = window.__TAURI_INTERNALS__;
  // 获取插件目录
  invoke('get_plugins_dir').then(path => {
    console.log('插件目录:', path);
  }).catch(() => {});
}
