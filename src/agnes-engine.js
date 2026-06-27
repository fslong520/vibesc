/**
 * Agnes AI 引擎
 *
 * API Base: https://apihub.agnes-ai.com/v1
 * Chat: agnes-2.0-flash
 * Image: agnes-image-2.0-flash
 * Video: agnes-video-v2.0
 */

const API_BASE = 'https://apihub.agnes-ai.com/v1';
const CHAT_MODEL = 'agnes-2.0-flash';
const IMAGE_MODEL = 'agnes-image-2.0-flash';
const VIDEO_MODEL = 'agnes-video-v2.0';

let apiKey = null;
var LS_KEY = 'vibesc_agnes_api_key';

// 从 localStorage / Tauri IPC / Vite env 获取 API Key（优先级依次）
async function loadApiKey() {
  if (apiKey) return apiKey;
  // 1. localStorage（UI 设置存储）
  try { apiKey = localStorage.getItem(LS_KEY); } catch (_) {}
  if (apiKey) return apiKey;
  try {
    // 2. Tauri IPC
    if (window.__TAURI_INTERNALS__) {
      const { invoke } = window.__TAURI_INTERNALS__;
      apiKey = await invoke('get_agnes_key');
    } else {
      // 3. Vite 环境变量
      apiKey = import.meta.env.VITE_AGNES_API_KEY || null;
    }
  } catch {
    apiKey = null;
  }
  return apiKey;
}

// UI 设置 API Key（存入 localStorage）
export function setApiKeyFromUI(key) {
  apiKey = key;
  try { localStorage.setItem(LS_KEY, key); } catch (_) {}
}

export async function getApiKey() {
  if (!apiKey) await loadApiKey();
  return apiKey;
}

export async function hasApiKey() {
  const key = await getApiKey();
  return !!key;
}

// ── Chat 对话 ──
export async function chat(messages, options = {}) {
  const key = await getApiKey();
  if (!key) throw new Error('AGNES_API_KEY 未设置');

  const { temperature = 0.7, maxTokens = 2048, stream = false } = options;

  const body = {
    model: CHAT_MODEL,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream,
  };

  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Agnes Chat API 错误 (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

// ── 生成图片 ──
export async function generateImage(prompt, options = {}) {
  const key = await getApiKey();
  if (!key) throw new Error('AGNES_API_KEY 未设置');

  const { size = '512x512', n = 1 } = options;

  const body = {
    model: IMAGE_MODEL,
    prompt,
    n,
    size,
  };

  const res = await fetch(`${API_BASE}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Agnes Image API 错误 (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.data; // [{url, b64_json}]
}

// ── 生成视频 ──
export async function generateVideo(prompt, options = {}) {
  const key = await getApiKey();
  if (!key) throw new Error('AGNES_API_KEY 未设置');

  const { duration = 5 } = options;

  const body = {
    model: VIDEO_MODEL,
    prompt,
    duration,
  };

  const res = await fetch(`${API_BASE}/video/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Agnes Video API 错误 (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.data;
}

// ── NL→积木生成 Prompt ──
const SYSTEM_PROMPT = `你是 VibeSc 的 AI 助手。根据用户需求输出对应的代码块。

## 格式 A：写积木
\`\`\`blocks
{"blocks":{"b1":{"id":"b1","opcode":"event_whenflagclicked","topLevel":true,"next":"b2"},"b2":{"id":"b2","opcode":"motion_movesteps","topLevel":false,"parent":"b1","inputs":{"STEPS":[1,[4,"10"]]}}},"scripts":["b1"]}
\`\`\`

积木字段：id, opcode, topLevel, next, parent, shadow(可选), inputs, fields, mutation, x, y
输入: [1,[4,"N"]]=数字 [1,[5,"T"]]=文本 [2,"id"]=遮蔽  SUBSTACK=[2,"子栈第一块ID"]
影子积木: shadow=true, fields={"NUM":{"name":"NUM","value":10}}

可选积木:
motion_movesteps(STEPS) motion_gotoxy(X,Y) motion_changexby(DX) motion_changeyby(DY) motion_pointindirection(DIRECTION) motion_turnright(DEGREES) motion_turnleft(DEGREES)
looks_say(MESSAGE) looks_show looks_hide looks_nextcostume looks_changesizeby(CHANGE) looks_setsizeto(SIZE)
control_wait(DURATION) control_repeat(TIMES,SUBSTACK) control_forever(SUBSTACK) control_if(CONDITION,SUBSTACK) control_stop
event_whenflagclicked event_whenbroadcastreceived

## 格式 B：生成图片
\`\`\`image
{"prompt":"英文描述","size":"512x512","count":1}
\`\`\``;

// ── 自然语言 → 积木方案 ──
export async function nlToBlocks(userPrompt, history = [], vm = null, skillPrompt = null) {
  var projectContext = '';
  if (vm && vm.runtime) {
    var projectData = buildProjectJson(vm);
    if (projectData) {
      projectContext = '\n\n## 当前项目完整 JSON\n\n\`\`\`json\n' +
        JSON.stringify(projectData, null, 2) +
        '\n\`\`\`\n\n请分析上述项目数据。';
    }
  }

  // 使用技能 prompt（如果有）或默认 SYSTEM_PROMPT
  var systemContent = skillPrompt || SYSTEM_PROMPT;
  // 无论哪种技能，都附加项目上下文说明
  systemContent += '\n\n注意：用户消息末尾附带了当前项目完整 JSON 供参考。';

  const messages = [
    { role: 'system', content: systemContent },
    ...history,
  ];
  var fullPrompt = userPrompt + (projectContext || '');
  messages.push({ role: 'user', content: fullPrompt });
  return chat(messages, { temperature: 0.5, maxTokens: 8000 });
}

// ── 解析 AI 返回中的 JSON 积木数据并注入 VM ──

// 从 VM runtime 构建 project.json 对象
function buildProjectJson(vm) {
  try {
    var runtime = vm.runtime;
    var targets = runtime.targets || [];
    var monitors = runtime.monitors || [];
    var extensions = [];
    // 收集已使用的扩展
    targets.forEach(function(t) {
      if (t.blocks && t.blocks._blocks) {
        Object.keys(t.blocks._blocks).forEach(function(id) {
          var b = t.blocks._blocks[id];
          if (b && b.opcode && b.opcode.indexOf('_') > 0) {
            var ext = b.opcode.split('_')[0];
            if (['event','control','motion','looks','sound','sensing','operator','data','procedures'].indexOf(ext) === -1) {
              if (extensions.indexOf(ext) === -1) extensions.push(ext);
            }
          }
        });
      }
    });
    // 序列化每个 target 的 blocks
    var serializedTargets = targets.map(function(t) {
      var target = {
        isStage: !!t.isStage,
        name: t.sprite ? t.sprite.name : (t.isStage ? 'Stage' : ''),
        variables: serializeVariables(t.variables),
        lists: {},
        broadcasts: t.isStage ? serializeBroadcasts(runtime) : {},
        blocks: t.blocks._blocks || {},
        comments: {},
        currentCostume: t.currentCostume || 0,
        costumes: serializeCostumes(t.sprite),
        sounds: serializeSounds(t.sprite),
        volume: t.volume || 100,
        layerOrder: t.layerOrder || 0,
        tempo: t.tempo || 60,
        videoTransparency: 0,
        videoState: 'off',
        textToSpeechLanguage: null
      };
      if (!t.isStage) {
        target.visible = t.visible !== false;
        target.x = t.x || 0;
        target.y = t.y || 0;
        target.size = t.size || 100;
        target.direction = t.direction || 90;
        target.draggable = !!t.draggable;
        target.rotationStyle = t.rotationStyle || 'all around';
      }
      return target;
    });
    return {
      targets: serializedTargets,
      monitors: monitors,
      extensions: extensions,
      meta: { semver: '3.0.0', vm: '0.2.0' },
      projectVersion: 3
    };
  } catch (e) {
    console.warn('[VibeSc] buildProjectJson failed:', e);
    return null;
  }
}

function serializeVariables(vars) {
  var result = {};
  if (vars) {
    Object.keys(vars).forEach(function(id) {
      var v = vars[id];
      if (v && v.name && v.value !== undefined) {
        result[id] = [v.name, String(v.value)];
      }
    });
  }
  return result;
}

function serializeBroadcasts(runtime) {
  var result = {};
  try {
    var stage = runtime.getTargetForStage();
    if (stage && stage.variables) {
      Object.keys(stage.variables).forEach(function(id) {
        var v = stage.variables[id];
        if (v && v.type === 'broadcast_msg' && v.name) {
          result['broadcastMsgId-' + v.name] = v.name;
        }
      });
    }
  } catch(e) {}
  return result;
}

function serializeCostumes(sprite) {
  if (!sprite || !sprite.costumes) return [];
  return sprite.costumes.map(function(c) {
    return {
      assetId: c.assetId || c.md5 || '',
      name: c.name || '',
      bitmapResolution: c.bitmapResolution || 1,
      md5ext: c.md5ext || c.md5 || '',
      dataFormat: c.dataFormat || 'svg',
      rotationCenterX: c.rotationCenterX || 0,
      rotationCenterY: c.rotationCenterY || 0
    };
  });
}

function serializeSounds(sprite) {
  if (!sprite || !sprite.sounds) return [];
  return sprite.sounds.map(function(s) {
    return {
      assetId: s.assetId || s.md5 || '',
      name: s.name || '',
      dataFormat: s.dataFormat || 'wav',
      rate: s.rate || 22050,
      sampleCount: s.sampleCount || 0,
      md5ext: s.md5ext || s.md5 || ''
    };
  });
}

export function parseBlocksFromResponse(text) {
  var start = text.indexOf('\x60\x60\x60blocks');
  if (start === -1) start = text.indexOf('\x60\x60\x60json');
  if (start === -1) return null;
  start = text.indexOf('\n', start);
  if (start === -1) return null;
  start += 1;
  var end = text.indexOf('\x60\x60\x60', start);
  if (end === -1) return null;
  var jsonStr = text.substring(start, end).trim();
  try {
    var data = JSON.parse(jsonStr);
    if (data && data.blocks) {
      console.log('[VibeSc] 解析到 blocks, count=' + Object.keys(data.blocks).length);
      return data;
    }
    return null;
  } catch (e) {
    console.warn('[VibeSc] JSON 解析失败:', e.message);
    return null;
  }
}


export function applyBlockPatch(vm, patch) {
  if (!vm || !patch || !patch.blocks) return false;
  try {
    var target = vm.editingTarget;
    if (!target || !target.blocks) return false;
    var blks = target.blocks;
    var allIds = Object.keys(blks._blocks);
    allIds.forEach(function(id) { delete blks._blocks[id]; });
    blks._scripts.length = 0;
    blks.resetCache();

    Object.keys(patch.blocks).forEach(function(id) {
      var b = patch.blocks[id];
      if (!b || !b.opcode) return;
      // 补齐缺失字段 + 修正矛盾
      if (!b.fields) b.fields = {};
      if (!b.inputs) b.inputs = {};
      if (b.shadow === undefined) b.shadow = false;
      if (b.topLevel === undefined) b.topLevel = false;
      if (!b.mutation) b.mutation = null;
      if (!b.x) b.x = 0;
      if (!b.y) b.y = 0;
      // topLevel 的积木不能有 parent
      if (b.topLevel) { b.parent = null; }
      // shadow 积木不能在 next 链上
      if (b.shadow) { b.next = null; }
      // parent 不能指向自己
      if (b.parent === id) { b.parent = null; }
      try { blks.createBlock(b); }
      catch (e) { /* skip bad blocks */ }
    });

    blks.resetCache();
    vm.emitWorkspaceUpdate();
    return true;
  } catch (e) {
    console.warn('[VibeSc] applyBlockPatch错误:', e.message);
    return false;
  }
}
