import { mountGUI, greenFlag, stopAll, loadProject, saveProject, getVM } from './gui-bootstrap.jsx';
import { hasApiKey, nlToBlocks, setApiKeyFromUI, getApiKey, parseBlocksFromResponse, applyBlockPatch, generateImage } from './agnes-engine.js';
import { initMaterialWorkshop, refreshWorkshop, workshopTools } from './material-workshop.js';
import { initPluginEngine } from './plugin-engine.js';
import { loadSkills, getActiveSkill, setActiveSkill, getAllSkills, matchSkill } from './skills/skill-engine.js';

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

// ── 全局错误显示（调试用） ──
window.__vibescErrors = [];
window.addEventListener('error', e => window.__vibescErrors.push(e.message));
window.addEventListener('unhandledrejection', e => window.__vibescErrors.push(e.reason?.message || String(e.reason)));
const origConsoleError = console.error;
console.error = function(...args) {
  window.__vibescErrors.push(args.join(' '));
  origConsoleError.apply(console, args);
};

// ── 初始化 scratch-gui ──
async function boot() {
  // 加载技能模块
  await loadSkills();
  renderSkillSwitcher();

  var vmReady = false;

  try {
    const guiMount = document.getElementById('scratch-gui-mount');
    if (!guiMount) throw new Error('scratch-gui-mount not found');
    await mountGUI(guiMount);
    console.log('[VibeSc] scratch-gui 就绪');
    vmReady = true;
  } catch (err) {
    console.error('[VibeSc] scratch-gui 启动失败:', err);
  }

  // 素材工坊
  initMaterialWorkshop('ws-canvas');
  if (vmReady) {
    const vmInst = getVM();
    if (vmInst) {
      vmInst.on('TARGETS_UPDATE', () => {
        setTimeout(refreshWorkshop, 100);
      });
    }
  }

  // 插件引擎
  initPluginEngine();
}

function renderSkillSwitcher() {
  var container = document.getElementById('skill-switcher');
  if (!container) return;
  var skills = getAllSkills();
  var html = '<select id="skill-select" style="padding:4px 8px;border:1px solid #ddd;border-radius:6px;font-size:13px;">';
  for (var i = 0; i < skills.length; i++) {
    var sel = skills[i].id === 'block-writer' ? ' selected' : '';
    html += '<option value="' + skills[i].id + '"' + sel + '>' + skills[i].name + '</option>';
  }
  html += '</select>';
  container.innerHTML = html;
  document.getElementById('skill-select').addEventListener('change', function(e) {
    setActiveSkill(e.target.value);
    var skill = getActiveSkill();
    chatInput.placeholder = skill ? skill.description : '输入你的想法...';
    appendMessage('bot', '已切换到「' + skill.name + '」技能');
  });
}

// 延迟收集错误供调试
setTimeout(() => {
  if (window.__vibescErrors && window.__vibescErrors.length > 0) {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#f44336;color:#fff;padding:8px;font-size:12px;z-index:9999;white-space:pre-wrap;';
    div.textContent = 'Errors:\n' + window.__vibescErrors.join('\n');
    document.body.prepend(div);
  }
}, 3000);

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
if (btnFoldPanel) btnFoldPanel.addEventListener('click', () => {
  isCollapsed = !isCollapsed;
  bottomPanel.classList.toggle('collapsed', isCollapsed);
  btnFoldPanel.textContent = isCollapsed ? '▲' : '▼';
});

// 底部面板拖拽调整大小
var dragHandle = document.createElement('div');
dragHandle.style.cssText = 'height:4px;cursor:ns-resize;background:transparent;flex-shrink:0;';
dragHandle.addEventListener('mouseover', function(){this.style.background='#ddd'});
dragHandle.addEventListener('mouseout', function(){this.style.background='transparent'});
bottomPanel.parentNode.insertBefore(dragHandle, bottomPanel);
var startY, startH;
dragHandle.addEventListener('mousedown', function(e) {
  startY = e.clientY; startH = bottomPanel.offsetHeight;
  bottomPanel.classList.remove('collapsed');
  function onMove(ev) { var h = startH - (ev.clientY - startY); if (h < 60) h = 60; if (h > window.innerHeight*0.7) h = window.innerHeight*0.7; bottomPanel.style.height = h + 'px'; window.dispatchEvent(new Event('resize')); }
  function onUp() { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
});

// ── 菜单项（文件/编辑/教程）──
// ── 菜单下拉（简单可靠：全局唯一 dropdown，点击外部关闭）──
var menuDropdown = document.createElement('div');
menuDropdown.className = 'menu-dropdown';
menuDropdown.style.display = 'none';
document.getElementById('menu-bar').appendChild(menuDropdown);

function hideMenu() { menuDropdown.style.display = 'none'; menuDropdown.innerHTML = ''; }
function showMenu(items) {
  menuDropdown.innerHTML = items;
  menuDropdown.style.display = 'block';
}

document.querySelectorAll('.menu-item[data-menu]').forEach(function (item) {
  item.addEventListener('click', function () {
    if (menuDropdown.style.display === 'block') { hideMenu(); return; }
    var menu = this.dataset.menu;
    if (menu === 'file') showMenu(
      '<div class="menu-dropdown-item" data-action="new-project">新建项目</div>' +
      '<div class="menu-dropdown-item" data-action="open">打开项目</div>' +
      '<div class="menu-dropdown-item" data-action="save">保存项目</div>'
    );
    else if (menu === 'edit') showMenu(
      '<div class="menu-dropdown-item" data-action="undo">撤销</div>' +
      '<div class="menu-dropdown-item" data-action="redo">恢复</div>'
    );
    else if (menu === 'tutorials') showMenu(
      '<div class="menu-dropdown-item">教程功能即将推出</div>'
    );
    else if (menu === 'settings') showSettingsDialog();
  });
});

menuDropdown.addEventListener('click', function (e) {
  var item = e.target.closest('.menu-dropdown-item');
  if (!item || !item.dataset.action) return;
  hideMenu();
  var action = item.dataset.action;
  if (action === 'new-project') {
    fetch('/default-project.sb3').then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
      loadProject(buf).then(function () { projectName.textContent = '未命名项目'; });
    }).catch(function () {});
  } else if (action === 'open') {
    if (fileInput) fileInput.click();
  } else if (action === 'save') {
    if (btnSave) btnSave.click();
  } else if (action === 'undo') {
    var v = getVM();
    if (v && v.undo) v.undo();
  } else if (action === 'redo') {
    var v = getVM();
    if (v && v.redo) v.redo();
  }
});

document.addEventListener('click', function (e) {
  if (menuDropdown.style.display === 'block' && !e.target.closest('.menu-item[data-menu]') && !e.target.closest('.menu-dropdown')) {
    hideMenu();
  }
});

// ── 设置对话框 ──
function showSettingsDialog() {
  hideMenu();
  var existing = document.getElementById('settings-dialog-overlay');
  if (existing) { existing.remove(); return; }

  var overlay = document.createElement('div');
  overlay.id = 'settings-dialog-overlay';
  overlay.innerHTML =
    '<div class="settings-dialog">' +
      '<div class="settings-dialog-title">设置</div>' +
      '<div class="settings-dialog-body">' +
        '<label>AGNES_API_KEY</label>' +
        '<input type="password" id="settings-api-key" placeholder="输入你的 Agnes AI API 密钥" />' +
        '<p class="settings-hint">密钥仅存储在浏览器 localStorage 中，不会上传。</p>' +
      '</div>' +
      '<div class="settings-dialog-footer">' +
        '<button class="menu-btn" id="settings-btn-cancel">取消</button>' +
        '<button class="menu-btn menu-btn-primary" id="settings-btn-save">保存</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  // 回显已有密钥
  getApiKey().then(function (key) {
    if (key) document.getElementById('settings-api-key').value = key;
  });

  document.getElementById('settings-btn-cancel').addEventListener('click', function () { overlay.remove(); });
  document.getElementById('settings-btn-save').addEventListener('click', function () {
    var key = document.getElementById('settings-api-key').value.trim();
    if (key) {
      setApiKeyFromUI(key);
      overlay.remove();
      console.log('[VibeSc] API 密钥已设置');
    } else {
      alert('请输入 API 密钥');
    }
  });
  overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
}

// ── 舞台控制（带 null 保护） ──
if (btnStart) btnStart.addEventListener('click', greenFlag);
if (btnStop) btnStop.addEventListener('click', stopAll);

// ── 打开 .sb3 文件 ──
if (btnOpen) btnOpen.addEventListener('click', () => fileInput.click());

if (fileInput) fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  await loadSb3File(file);
  fileInput.value = '';
});

// ── 拖拽导入 .sb3 ──
const editorArea = document.getElementById('editor-area');

if (editorArea) {
  editorArea.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
    editorArea.classList.add('drag-over');
  });

  editorArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  editorArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editorArea.contains(e.relatedTarget)) {
      editorArea.classList.remove('drag-over');
    }
  });

  editorArea.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    editorArea.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const sb3 = Array.from(files).find(f => f.name.endsWith('.sb3'));
      if (sb3) await loadSb3File(sb3);
    }
  });
} else {
  console.warn('[VibeSc] editor-area element not found');
}

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
if (btnSave) btnSave.addEventListener('click', async () => {
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

if (btnSend) btnSend.addEventListener('click', sendMessage);
if (chatInput) chatInput.addEventListener('keydown', (e) => {
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

    console.log('[VibeSc] 发送请求:', text);

    const response = await nlToBlocks(text, chatHistory.slice(0, -1), getVM(), null);
    var vmInst = getVM();
    var displayText = response;

    // 检测 AI 回复中的标记，自动路由
    if (response.indexOf('```blocks') !== -1) {
      // 积木注入
      var patch = parseBlocksFromResponse(response);
      displayText = response.replace(/```blocks[\s\S]*?```/, '').trim() || '(积木已生成)';
      if (patch && vmInst) {
        try {
          var ok = await applyBlockPatch(vmInst, patch);
          displayText += ok ? '\n\n✅ 积木已更新！' : '\n\n❌ 项目更新失败';
        } catch (e) {
          displayText += '\n\n❌ 更新异常: ' + e.message;
        }
      }
    } else if (response.indexOf('```image') !== -1) {
      // 图片生成
      var imgMatch = response.match(/```image\s*\n([\s\S]*?)```/);
      if (imgMatch) {
        try {
          var imgData = JSON.parse(imgMatch[1].trim());
          var images = await generateImage(imgData.prompt || imgData.description || 'prompt', { size: imgData.size || '512x512', n: imgData.count || 1 });
          displayText = (response.replace(/```image[\s\S]*?```/, '').trim() || '') + '\n\n🎨 图片已生成：\n';
          if (images && images.length > 0) {
            for (var ii = 0; ii < images.length; ii++) {
              displayText += '![](' + images[ii].url + ')\n';
            }
          }
        } catch (e) {
          displayText += '\n\n❌ 图片生成失败: ' + e.message;
        }
      }
    } else if (response.indexOf('```check') !== -1) {
      // 代码检查
      var checkMatch = response.match(/```check\s*\n([\s\S]*?)```/);
      if (checkMatch) {
        try {
          var checkData = JSON.parse(checkMatch[1].trim());
          displayText = (response.replace(/```check[\s\S]*?```/, '').trim() || '') + '\n\n🔍 检查结果：\n';
          if (checkData.issues && checkData.issues.length > 0) {
            for (var ci = 0; ci < checkData.issues.length; ci++) {
              var iss = checkData.issues[ci];
              var icon = iss.severity === 'error' ? '🔴' : iss.severity === 'warning' ? '🟡' : '💡';
              displayText += icon + ' ' + iss.message + '\n';
              if (iss.suggestion) displayText += '  建议: ' + iss.suggestion + '\n';
            }
          } else {
            displayText += '✅ 没有发现问题';
          }
        } catch (e) {
          displayText += '\n\n❌ 检查结果解析失败';
        }
      }
    }

    chatHistory.push({ role: 'assistant', content: response });
    updateMessage(loadingId, displayText);
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
