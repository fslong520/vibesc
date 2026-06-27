/**
 * VibeSc 插件引擎
 *
 * 扫描插件目录 → 解析 .zhplugin 清单 → Worker 沙箱加载。
 */

import { getVM } from './gui-bootstrap.jsx';

// ── 插件数据结构 ──
let plugins = [];
let loadedPlugins = new Map(); // pluginId → { worker, api }

// ── 扫描插件目录（Tauri IPC 获取路径 + 模拟扫描） ──
export async function scanPlugins() {
  const listEl = document.getElementById('plugin-list');
  if (!listEl) return;

  // 尝试通过 Tauri 获取插件目录
  let pluginsDir = '';
  if (window.__TAURI_INTERNALS__) {
    try {
      const { invoke } = window.__TAURI_INTERNALS__;
      pluginsDir = await invoke('get_plugins_dir');
    } catch (_) {}
  }

  // 开发阶段使用内置示例插件
  plugins = getBuiltinPlugins();

  renderPluginList(listEl, pluginsDir);
}

// ── 内置示例插件（无真实文件时展示） ──
function getBuiltinPlugins() {
  return [
    {
      id: 'example-counter',
      name: '计数器',
      version: '0.1.0',
      author: 'VibeSc',
      description: '在舞台上添加一个可点击的计数器',
      builtin: true,
    },
    {
      id: 'example-pen-ext',
      name: '画笔扩展',
      version: '0.1.0',
      author: 'VibeSc',
      description: '扩展画笔功能，支持渐变色和图案填充',
      builtin: true,
    },
  ];
}

// ── 渲染插件列表 ──
function renderPluginList(container, pluginsDir) {
  const isLoaded = (id) => loadedPlugins.has(id);

  container.innerHTML = `
    <div class="plugin-dir-info">
      插件目录：<code>${pluginsDir || '~/.scratchmind/plugins/'}</code>
    </div>
    ${plugins.length === 0
      ? '<p class="text-muted">暂无插件。将 .zhplugin 文件放入插件目录即可。</p>'
      : `<div class="plugin-cards">
          ${plugins.map(p => `
            <div class="plugin-card ${isLoaded(p.id) ? 'loaded' : ''}">
              <div class="plugin-card-header">
                <span class="plugin-name">${p.name}</span>
                <span class="plugin-version">v${p.version}</span>
                ${p.builtin ? '<span class="plugin-badge">内置</span>' : ''}
              </div>
              <div class="plugin-author">${p.author}</div>
              <div class="plugin-desc">${p.description}</div>
              <div class="plugin-actions">
                ${isLoaded(p.id)
                  ? `<button class="plugin-btn plugin-btn-unload" data-plugin-id="${p.id}">卸载</button>`
                  : `<button class="plugin-btn plugin-btn-load" data-plugin-id="${p.id}">加载</button>`
                }
                <span class="plugin-status ${isLoaded(p.id) ? 'status-active' : ''}">
                  ${isLoaded(p.id) ? '● 运行中' : '○ 未加载'}
                </span>
              </div>
            </div>
          `).join('')}
        </div>`
    }
  `;

  // 绑定加载/卸载按钮
  container.querySelectorAll('.plugin-btn-load').forEach(btn => {
    btn.addEventListener('click', () => loadPlugin(btn.dataset.pluginId));
  });
  container.querySelectorAll('.plugin-btn-unload').forEach(btn => {
    btn.addEventListener('click', () => unloadPlugin(btn.dataset.pluginId));
  });
}

// ── 加载插件 ──
export async function loadPlugin(pluginId) {
  if (loadedPlugins.has(pluginId)) return;

  const plugin = plugins.find(p => p.id === pluginId);
  if (!plugin) return;

  try {
    // Worker 沙箱
    const workerCode = `
      self.onmessage = async function(e) {
        const { type, payload } = e.data;
        switch (type) {
          case 'INIT':
            self.postMessage({ type: 'INIT_OK', payload: { id: '${pluginId}' } });
            break;
          case 'EXEC':
            // 插件逻辑运行于此
            self.postMessage({ type: 'EXEC_DONE', payload: { result: '${plugin.name} 已运行' } });
            break;
          case 'DISABLE':
            self.postMessage({ type: 'DISABLE_OK' });
            break;
        }
      };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));

    // 插件 API（通过 postMessage 暴露）
    const api = {
      vm: () => {
        // 小心循环引用——只暴露必要的
        try {
          return getVM();
        } catch (_) {
          return null;
        }
      },
      log: (...args) => console.log(`[Plugin:${plugin.name}]`, ...args),
      notify: (msg) => {
        // 简单通知
        console.log(`[Plugin:${plugin.name}] 通知:`, msg);
      },
    };

    loadedPlugins.set(pluginId, { worker, api });

    worker.postMessage({ type: 'INIT' });
    worker.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'INIT_OK') {
        console.log(`[Plugins] ${plugin.name} 已加载`);
      } else if (type === 'EXEC_DONE') {
        console.log(`[Plugins] ${plugin.name} 执行结果:`, payload.result);
      }
    };

    // 重绘列表
    scanPlugins();
  } catch (err) {
    console.error(`[Plugins] 加载 ${plugin.name} 失败:`, err);
  }
}

// ── 卸载插件 ──
export async function unloadPlugin(pluginId) {
  const entry = loadedPlugins.get(pluginId);
  if (!entry) return;

  try {
    entry.worker.postMessage({ type: 'DISABLE' });
    entry.worker.terminate();
  } catch (_) {}

  loadedPlugins.delete(pluginId);
  scanPlugins();
}

// ── 初始化插件引擎 ──
export function initPluginEngine() {
  scanPlugins();

  // 打开插件目录按钮（仅复制路径到剪贴板）
  const btnOpen = document.getElementById('btn-open-plugin-folder');
  if (btnOpen) {
    btnOpen.addEventListener('click', async () => {
      try {
        let dir = '~/.scratchmind/plugins/';
        if (window.__TAURI_INTERNALS__) {
          const { invoke } = window.__TAURI_INTERNALS__;
          dir = await invoke('get_plugins_dir');
        }
        await navigator.clipboard.writeText(dir);
        alert(`插件目录路径已复制到剪贴板：\n${dir}`);
      } catch (err) {
        alert('无法获取插件目录: ' + err.message);
      }
    });
  }
}
