import React from 'react';
import ReactDOM from 'react-dom';
import * as ScratchGUI from 'scratch-gui';

// scratch-gui bundle exports (namespace import to avoid CJS interop stripping named exports):
// - default: the connected GUI component (needs <Provider>)
// - AppStateHOC: the wrapper that creates Redux store + <Provider>
var GUI = ScratchGUI.default;
var AppStateHOC = ScratchGUI.AppStateHOC;

// AppStateHOC(e, o) where e=component, o=if true uses minimal store.
// Pass false for full store with scratchGui reducer.
var ScratchApp = AppStateHOC(GUI, false);

// ── Custom storage init: CDN blocked, try alt mirrors or fallback ──
function customStorageInit(storage) {
  var altHosts = [
    'https://cdn.assets.scratch.mit.edu/',
    'https://scratch-cdn.s3.amazonaws.com/'
  ];
  altHosts.forEach(function (host) {
    storage.addWebStore(
      [storage.AssetType.Project, storage.AssetType.Sound, storage.AssetType.ImageVector],
      function (asset) {
        var type = asset.assetType.runtimeFormat === 'wav'
          ? storage.AssetType.Sound
          : storage.AssetType.ImageVector;
        return host + 'internalapi/asset/' + asset.assetId + '.' + type.runtimeFormat + '/get/';
      }
    );
  });
}

var vmInstance = null;
var scratchAppRef = null;

// ── Mount GUI ──
export function mountGUI(container) {
  if (!container) throw new Error('mountGUI: container required');

  ReactDOM.render(
    React.createElement(ScratchApp, {
      isFullScreen: false,
      isPlayerOnly: false,
      onStorageInit: customStorageInit,
      ref: function (inst) { scratchAppRef = inst; }
    }),
    container
  );

  // 监听容器大小变化，通知 scratch-gui 重新布局
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(function() {
      // scratch-gui 依赖 window resize 事件重新计算布局
      window.dispatchEvent(new Event('resize'));
    });
    ro.observe(container);
  }

  // Poll for VM to be initialized (GUI creates it internally via Redux)
  return new Promise(function (resolve) {
    var attempts = 0;
    function poll() {
      var store = scratchAppRef && scratchAppRef.store;
      if (store) {
        var vm = store.getState().scratchGui && store.getState().scratchGui.vm;
        if (vm && typeof vm.greenFlag === 'function') {
          vmInstance = vm;
          // Load default project from local file instead of CDN
          fetch('/default-project.sb3').then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
            vm.loadProject(buf).then(function () { vm.start(); });
          }).catch(function () {});
          resolve(vm);
          return;
        }
      }
      if (++attempts > 60) {
        console.warn('[VibeSc] VM not found after 6s');
        resolve(null);
        return;
      }
      setTimeout(poll, 100);
    }
    poll();
  });
}

// ── Public API ──
export function getVM() { return vmInstance; }

export async function loadProject(buffer) {
  var vm = vmInstance;
  if (!vm) throw new Error('VM not ready');
  vm.stopAll();
  await vm.loadProject(buffer);
  vm.start();
}

export async function saveProject() {
  if (!vmInstance) throw new Error('VM not ready');
  return vmInstance.saveProjectSb3();
}

export function greenFlag() {
  if (vmInstance) vmInstance.greenFlag();
}

export function stopAll() {
  if (vmInstance) vmInstance.stopAll();
}
