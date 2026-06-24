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

// 从 Tauri IPC 获取 API Key
async function loadApiKey() {
  if (apiKey) return apiKey;
  try {
    if (window.__TAURI_INTERNALS__) {
      const { invoke } = window.__TAURI_INTERNALS__;
      apiKey = await invoke('get_agnes_key');
    } else {
      apiKey = import.meta.env.VITE_AGNES_API_KEY || null;
    }
  } catch {
    apiKey = null;
  }
  return apiKey;
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
const SYSTEM_PROMPT = `你是 VibeSc（智搭）的 AI 编程助手，面向 6-14 岁儿童。

你的任务是：
1. 理解用户用自然语言描述的游戏或动画创意
2. 将其转化为 Scratch 积木代码方案
3. 用儿童能理解的中文解释方案

积木分类：
- 🟢 事件：当 ⚑ 被点击、当收到消息、当角色被点击
- 🔵 运动：移动、转向、滑行、碰到边缘反弹
- 🟣 外观：说、思考、切换造型、切换背景、大小、隐藏/显示
- 🟡 声音：播放声音、停止声音、音量
- 🟠 控制：等待、重复、如果…那么、重复直到、广播消息
- 🔵 侦测：碰到、询问、计时器
- 🟢 运算：加减乘除、随机数、大于小于、与或非
- ⚪ 变量：建立变量、设定、改变、显示

回复格式：
1. 先用一句简单的话总结用户的创意
2. 列出需要的积木（用 emoji + 积木名称）
3. 说明积木的摆放顺序
4. 如果用户没说明触发方式，默认用"当 ⚑ 被点击"

语言要求：用 6 岁小孩能懂的中文，语气友好鼓励，多用 emoji。`;

// ── 自然语言 → 积木方案 ──
export async function nlToBlocks(userPrompt, history = []) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: userPrompt },
  ];

  return chat(messages, { temperature: 0.5, maxTokens: 1500 });
}
