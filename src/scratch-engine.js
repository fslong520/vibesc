/**
 * VibeSc Scratch 引擎集成
 * 
 * 整合 scratch-vm, scratch-render, scratch-storage
 * 提供舞台渲染 + 项目加载/保存 + 积木运行
 */

import VirtualMachine from 'scratch-vm';
import Renderer from 'scratch-render';
import Storage from 'scratch-storage';

// ── 单例 ──
let vm = null;
let renderer = null;
let storage = null;
let isRunning = false;

// ── 存储助手：加载内置素材（猫/背景） ──
function buildStorage() {
  const storage = new Storage();
  
  // 默认使用 Scratch 官方 CDN
  storage.addWebStore(
    [Storage.AssetType.Project, Storage.AssetType.Sound, Storage.AssetType.Costume],
    (asset) => {
      const assetType = asset.assetType.runtimeFormat === 'wav' ?
        Storage.AssetType.Sound :
        Storage.AssetType.ImageVector;
      const uri = `https://cdn.assets.scratch.mit.edu/internalapi/asset/${asset.assetId}.${assetType.runtimeFormat}/get/`;
      return uri;
    }
  );
  
  return storage;
}

// ── 初始化引擎 ──
export async function initEngine(canvasId) {
  if (vm) return vm;

  const canvas = document.getElementById(canvasId);
  if (!canvas) throw new Error(`找不到 canvas: #${canvasId}`);

  // 1. 创建 VM
  vm = new VirtualMachine();
  
  // 2. 创建 Renderer，绑定 canvas
  renderer = new Renderer(canvas);
  vm.attachRenderer(renderer);
  
  // 3. 创建 Storage
  storage = buildStorage();
  vm.attachStorage(storage);
  
  // 4. 音频 —— 使用 Web Audio
  const AudioEngine = (await import('scratch-audio')).default;
  const audioEngine = new AudioEngine();
  vm.attachAudioEngine(audioEngine);
  
  // 5. 加载默认空项目
  await loadEmptyProject();
  
  // 6. 事件监听
  vm.on('PROJECT_LOADED', () => {
    console.log('[VibeSc] 项目加载完成');
  });
  
  vm.on('TARGETS_UPDATE', () => {
    updateSpriteList();
  });

  // 强制首次渲染
  renderer.draw();
  
  return vm;
}

// ── 加载空项目 ──
async function loadEmptyProject() {
  // 获取 Scratch 3 默认空项目（只有一个猫咪角色）
  const response = await fetch('https://cdn.assets.scratch.mit.edu/internalapi/asset/01ae3f8a4e37d22b832c47a825cf4026.svg/get/');
  const svg = await response.text();
  
  // 构建最简单的项目 JSON
  const projectJson = {
    targets: [{
      isStage: true,
      name: '舞台',
      variables: {},
      lists: {},
      broadcasts: {},
      blocks: {},
      comments: {},
      currentCostume: 0,
      costumes: [{
        assetId: 'stage-backdrop',
        name: '背景1',
        bitmapResolution: 1,
        dataFormat: 'svg',
        md5ext: 'stage-backdrop.svg',
        rotationCenterX: 240,
        rotationCenterY: 180
      }],
      sounds: [],
      volume: 100,
      layerOrder: 0,
      tempo: 60,
      videoTransparency: 50,
      videoState: 'off',
      textToSpeechLanguage: null
    }, {
      isStage: false,
      name: '小猫',
      variables: {},
      lists: {},
      broadcasts: {},
      blocks: {},
      comments: {},
      currentCostume: 0,
      costumes: [{
        assetId: 'costume1',
        name: '造型1',
        bitmapResolution: 1,
        dataFormat: 'svg',
        md5ext: 'costume1.svg',
        rotationCenterX: 47,
        rotationCenterY: 55
      }],
      sounds: [],
      volume: 100,
      layerOrder: 1,
      visible: true,
      x: 0,
      y: 0,
      size: 100,
      direction: 90,
      draggable: false,
      rotationStyle: 'all around'
    }],
    monitors: {},
    extensions: [],
    meta: {
      semver: '3.0.0',
      vm: '0.2.0',
      agent: 'VibeSc 0.1.0'
    }
  };

  const projectData = new TextEncoder().encode(JSON.stringify(projectJson)).buffer;
  await vm.loadProject(projectData);
  vm.start();
}

// ── 加载 .sb3 文件 ──
export async function loadProject(arrayBuffer) {
  if (!vm) throw new Error('引擎未初始化');
  vm.stopAll();
  await vm.loadProject(arrayBuffer);
  vm.start();
}

// ── 导出为 .sb3 ──
export async function saveProject() {
  if (!vm) throw new Error('引擎未初始化');
  const data = await vm.saveProjectSb3();
  return data;
}

// ── 绿旗 / 停止 ──
export function greenFlag() {
  if (!vm) return;
  vm.greenFlag();
  isRunning = true;
}

export function stopAll() {
  if (!vm) return;
  vm.stopAll();
  isRunning = false;
}

export function toggleRunning() {
  if (isRunning) stopAll();
  else greenFlag();
}

// ── 角色列表更新 ──
function updateSpriteList() {
  if (!vm) return;
  const targets = vm.runtime.targets;
  const listEl = document.getElementById('sprite-list');
  if (!listEl) return;
  
  // 保留选中的角色（简单实现）
  listEl.innerHTML = '';
  targets.forEach(target => {
    if (target.isStage) return; // 舞台不显示在角色列表
    
    const div = document.createElement('div');
    div.className = 'sprite-item';
    div.title = target.getName();
    
    // 获取角色缩略图
    const costume = target.getCostumes()[target.currentCostume];
    if (costume && costume.asset) {
      const url = costume.asset.encodeDataURI();
      div.innerHTML = `<img src="${url}" alt="${target.getName()}" style="width:40px;height:40px;object-fit:contain" />`;
    } else {
      div.textContent = '🐱';
    }
    
    div.addEventListener('click', () => {
      listEl.querySelectorAll('.sprite-item').forEach(s => s.classList.remove('active'));
      div.classList.add('active');
    });
    
    listEl.appendChild(div);
  });
}

// ── 获取 VM 实例（供其他模块使用） ──
export function getVM() {
  return vm;
}

// ── 销毁引擎 ──
export function destroyEngine() {
  if (vm) {
    vm.stopAll();
    vm = null;
  }
  renderer = null;
  storage = null;
}
