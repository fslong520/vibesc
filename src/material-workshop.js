/**
 * VibeSc 素材工坊
 *
 * 在当前角色造型上做基本图像编辑：旋转、翻转、裁剪。
 * 编辑完成后将结果写回 VM。
 */

import { getVM } from './gui-bootstrap.jsx';

let vm = null;
let wsCanvas = null;
let wsCtx = null;

// 当前编辑状态
let currentTarget = null;
let currentCostumeIndex = 0;
let originalImage = null;   // ImageData（未修改的原始副本）
let workingCanvas = null;   // 离屏 canvas，操纵中的图像

// 裁剪状态
let isCropping = false;
let cropStart = null;
let cropEnd = null;
let cropRect = null;

// ── 获取当前角色的造型图像 ──
function loadCurrentCostume() {
  vm = getVM();
  if (!vm || !vm.editingTarget) return false;

  currentTarget = vm.editingTarget;
  const costumes = currentTarget.getCostumes();
  if (!costumes || costumes.length === 0) return false;

  // 取当前造型
  currentCostumeIndex = currentTarget.currentCostume;
  const costume = costumes[currentCostumeIndex];
  const asset = costume && costume.asset;
  if (!asset) return false;

  // 解码为 ImageData
  const url = asset.encodeDataURI();
  const img = new Image();
  img.crossOrigin = 'anonymous';

  return new Promise((resolve) => {
    img.onload = () => {
      workingCanvas = document.createElement('canvas');
      workingCanvas.width = img.width;
      workingCanvas.height = img.height;
      const ctx = workingCanvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      // 保存原件
      originalImage = ctx.getImageData(0, 0, img.width, img.height);

      // 渲染到工坊画布
      renderWorkspace();
      resolve(true);
    };
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

// ── 渲染工坊画布 ──
function renderWorkspace() {
  if (!wsCtx || !workingCanvas) return;

  // 清空
  wsCanvas.width = workingCanvas.width;
  wsCanvas.height = workingCanvas.height;
  wsCtx.clearRect(0, 0, wsCanvas.width, wsCanvas.height);
  wsCtx.drawImage(workingCanvas, 0, 0);

  // 裁剪框
  if (cropRect) {
    wsCtx.strokeStyle = '#4caf50';
    wsCtx.lineWidth = 2;
    wsCtx.setLineDash([6, 3]);
    wsCtx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
    wsCtx.setLineDash([]);

    // 半透明遮罩
    wsCtx.fillStyle = 'rgba(0,0,0,0.3)';
    wsCtx.fillRect(0, 0, wsCanvas.width, cropRect.y);
    wsCtx.fillRect(0, cropRect.y + cropRect.h, wsCanvas.width, wsCanvas.height - cropRect.y - cropRect.h);
    wsCtx.fillRect(0, cropRect.y, cropRect.x, cropRect.h);
    wsCtx.fillRect(cropRect.x + cropRect.w, cropRect.y, wsCanvas.width - cropRect.x - cropRect.w, cropRect.h);
  }
}

// ── 旋转 ──
function rotate(degrees) {
  if (!workingCanvas) return;

  const w = workingCanvas.width;
  const h = workingCanvas.height;
  const newCanvas = document.createElement('canvas');
  newCanvas.width = h;
  newCanvas.height = w;
  const ctx = newCanvas.getContext('2d');
  ctx.translate(h / 2, w / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(workingCanvas, -w / 2, -h / 2);
  workingCanvas = newCanvas;
  cropRect = null;
  renderWorkspace();
}

// ── 翻转 ──
function flip(horizontal) {
  if (!workingCanvas) return;

  const newCanvas = document.createElement('canvas');
  newCanvas.width = workingCanvas.width;
  newCanvas.height = workingCanvas.height;
  const ctx = newCanvas.getContext('2d');
  ctx.translate(horizontal ? workingCanvas.width : 0, horizontal ? 0 : workingCanvas.height);
  ctx.scale(horizontal ? -1 : 1, horizontal ? 1 : -1);
  ctx.drawImage(workingCanvas, 0, 0);
  workingCanvas = newCanvas;
  cropRect = null;
  renderWorkspace();
}

// ── 开始裁剪（鼠标按下） ──
function startCrop(x, y) {
  isCropping = true;
  cropStart = { x, y };
  cropEnd = null;
  cropRect = null;
}

// ── 裁剪拖动 ──
function updateCrop(x, y) {
  if (!isCropping || !cropStart) return;
  cropEnd = { x, y };

  const x1 = Math.max(0, Math.min(cropStart.x, cropEnd.x));
  const y1 = Math.max(0, Math.min(cropStart.y, cropEnd.y));
  const x2 = Math.min(wsCanvas.width, Math.max(cropStart.x, cropEnd.x));
  const y2 = Math.min(wsCanvas.height, Math.max(cropStart.y, cropEnd.y));

  cropRect = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  renderWorkspace();
}

// ── 结束裁剪（鼠标松开） ──
function endCrop() {
  isCropping = false;
}

// ── 执行裁剪 ──
function applyCrop() {
  if (!cropRect || !workingCanvas) return;
  const { x, y, w, h } = cropRect;
  if (w < 2 || h < 2) {
    cropRect = null;
    renderWorkspace();
    return;
  }

  const newCanvas = document.createElement('canvas');
  newCanvas.width = w;
  newCanvas.height = h;
  const ctx = newCanvas.getContext('2d');
  ctx.drawImage(workingCanvas, x, y, w, h, 0, 0, w, h);
  workingCanvas = newCanvas;
  cropRect = null;
  renderWorkspace();
}

// ── 取消裁剪 ──
function cancelCrop() {
  cropRect = null;
  isCropping = false;
  renderWorkspace();
}

// ── 放弃全部更改 ──
function discardChanges() {
  if (!originalImage || !workingCanvas) return;

  const canvas = document.createElement('canvas');
  canvas.width = originalImage.width;
  canvas.height = originalImage.height;
  const ctx = canvas.getContext('2d');
  ctx.putImageData(originalImage, 0, 0);
  workingCanvas = canvas;
  cropRect = null;
  renderWorkspace();
}

// ── 应用更改到 VM ──
async function applyChanges() {
  if (!workingCanvas || !vm || !currentTarget) return;

  vm.stopAll();

  // 将 canvas 转为 Blob
  const blob = await new Promise(resolve =>
    workingCanvas.toBlob(resolve, 'image/png')
  );
  if (!blob) throw new Error('转换图像失败');

  // 构造新造型数据
  const costume = currentTarget.getCostumes()[currentCostumeIndex];
  const newName = costume ? costume.name : '造型';
  const md5 = `${Date.now()}.png`;

  // 导入到 VM（addCostume 会复制并设为当前造型）
  await vm.addCostume(
    md5,
    {
      name: newName,
      bitmapResolution: 1,
      dataFormat: 'png',
      rotationCenterX: Math.floor(workingCanvas.width / 2),
      rotationCenterY: Math.floor(workingCanvas.height / 2),
    },
    blob
  );

  // 新造型已追加到末尾，设为当前造型
  const costumes = currentTarget.getCostumes();
  vm.editingTarget.setCostume(costumes.length - 1);

  // 更新原件
  const newAsset = costumes[costumes.length - 1].asset;
  if (newAsset) {
    const url = newAsset.encodeDataURI();
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve) => {
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        originalImage = c.getContext('2d').getImageData(0, 0, img.width, img.height);
        resolve();
      };
      img.src = url;
    });
  }

  // 删除旧造型
  // 注意：addCostume 加了新造型后，旧的还在，需要清理
  // 但为了安全，我们保留旧造型（用户可手动删除）
  // 这里不自动删除，防止误操作
}

// ── 鼠标/触摸事件绑定 ──
function bindEvents() {
  if (!wsCanvas) return;

  function getPos(e) {
    const rect = wsCanvas.getBoundingClientRect();
    const scaleX = wsCanvas.width / rect.width;
    const scaleY = wsCanvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  wsCanvas.addEventListener('mousedown', (e) => {
    const p = getPos(e);
    startCrop(p.x, p.y);
  });

  wsCanvas.addEventListener('mousemove', (e) => {
    const p = getPos(e);
    updateCrop(p.x, p.y);
  });

  wsCanvas.addEventListener('mouseup', endCrop);
  wsCanvas.addEventListener('mouseleave', endCrop);

  // 触摸支持
  wsCanvas.addEventListener('touchstart', (e) => {
    const p = getPos(e);
    startCrop(p.x, p.y);
  });
  wsCanvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const p = getPos(e);
    updateCrop(p.x, p.y);
  });
  wsCanvas.addEventListener('touchend', endCrop);
}

// ── 初始化工坊 ──
export function initMaterialWorkshop(canvasId) {
  wsCanvas = document.getElementById(canvasId);
  if (!wsCanvas) {
    console.error('[Workshop] 找不到画布:', canvasId);
    return;
  }
  wsCtx = wsCanvas.getContext('2d');
  bindEvents();

  // 加载当前角色
  loadCurrentCostume();
}

// ── 刷新（角色切换时调用） ──
export function refreshWorkshop() {
  cropRect = null;
  isCropping = false;
  loadCurrentCostume();
}

// ── 工具导出供 UI 绑定 ──
export const workshopTools = {
  rotateLeft: () => rotate(-90),
  rotateRight: () => rotate(90),
  flipH: () => flip(true),
  flipV: () => flip(false),
  applyCrop,
  cancelCrop,
  discardChanges,
  applyChanges,
};
