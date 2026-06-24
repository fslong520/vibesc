/**
 * VibeSc 积木编辑器 —— scratch-blocks 集成
 *
 * 将 scratch-blocks 注入到工作区，连接 VM 实现双向同步：
 *   VM ──workspaceUpdate──→ scratch-blocks（加载积木）
 *   scratch-blocks ──changeEvent──→ VM.blockListener（保存积木）
 */

import { inject, clearWorkspaceAndLoadFromXml } from 'scratch-blocks';
import { getVM } from './scratch-engine.js';

let workspace = null;
let vm = null;

// ── 工具箱 XML（全分类 Scratch 积木） ──
// 颜色按 Scratch 官方规范
const TOOLBOX_XML = `<xml>
  <category name="运动" colour="#4C97FF" secondaryColour="#3373CC">
    <block type="motion_movesteps"><value name="STEPS"><shadow type="math_number"><field name="NUM">10</field></shadow></value></block>
    <block type="motion_turnright"><value name="DEGREES"><shadow type="math_number"><field name="NUM">15</field></shadow></value></block>
    <block type="motion_turnleft"><value name="DEGREES"><shadow type="math_number"><field name="NUM">15</field></shadow></value></block>
    <block type="motion_gotoxy"><value name="X"><shadow type="math_number"><field name="NUM">0</field></shadow></value><value name="Y"><shadow type="math_number"><field name="NUM">0</field></shadow></value></block>
    <block type="motion_goto"><value name="TO"><shadow type="motion_goto_menu"></shadow></value></block>
    <block type="motion_pointindirection"><value name="DIRECTION"><shadow type="math_number"><field name="NUM">90</field></shadow></value></block>
    <block type="motion_glidesecstoxy"><value name="SECS"><shadow type="math_number"><field name="NUM">1</field></shadow></value><value name="X"><shadow type="math_number"><field name="NUM">0</field></shadow></value><value name="Y"><shadow type="math_number"><field name="NUM">0</field></shadow></value></block>
    <block type="motion_changexby"><value name="DX"><shadow type="math_number"><field name="NUM">10</field></shadow></value></block>
    <block type="motion_setx"><value name="X"><shadow type="math_number"><field name="NUM">0</field></shadow></value></block>
    <block type="motion_changeyby"><value name="DY"><shadow type="math_number"><field name="NUM">10</field></shadow></value></block>
    <block type="motion_sety"><value name="Y"><shadow type="math_number"><field name="NUM">0</field></shadow></value></block>
    <block type="motion_ifonedgebounce"/>
    <block type="motion_setrotationstyle"/>
    <block type="motion_xposition"/>
    <block type="motion_yposition"/>
    <block type="motion_direction"/>
  </category>
  <category name="外观" colour="#9966FF" secondaryColour="#774DCB">
    <block type="looks_say"><value name="MESSAGE"><shadow type="text"><field name="TEXT">你好！</field></shadow></value></block>
    <block type="looks_sayforsecs"><value name="MESSAGE"><shadow type="text"><field name="TEXT">你好！</field></shadow></value><value name="SECS"><shadow type="math_number"><field name="NUM">2</field></shadow></value></block>
    <block type="looks_think"><value name="MESSAGE"><shadow type="text"><field name="TEXT">嗯...</field></shadow></value></block>
    <block type="looks_thinkforsecs"><value name="MESSAGE"><shadow type="text"><field name="TEXT">嗯...</field></shadow></value><value name="SECS"><shadow type="math_number"><field name="NUM">2</field></shadow></value></block>
    <block type="looks_show"/>
    <block type="looks_hide"/>
    <block type="looks_switchcostumeto"><value name="COSTUME"><shadow type="costume"></shadow></value></block>
    <block type="looks_nextcostume"/>
    <block type="looks_switchbackdropto"><value name="BACKDROP"><shadow type="backdrop"></shadow></value></block>
    <block type="looks_nextbackdrop"/>
    <block type="looks_changesizeby"><value name="CHANGE"><shadow type="math_number"><field name="NUM">10</field></shadow></value></block>
    <block type="looks_setsizeto"><value name="SIZE"><shadow type="math_number"><field name="NUM">100</field></shadow></value></block>
    <block type="looks_changeeffectby"><value name="EFFECT"><shadow type="looks_effect_menu"></shadow></value><value name="CHANGE"><shadow type="math_number"><field name="NUM">25</field></shadow></value></block>
    <block type="looks_seteffectto"><value name="EFFECT"><shadow type="looks_effect_menu"></shadow></value><value name="VALUE"><shadow type="math_number"><field name="NUM">0</field></shadow></value></block>
    <block type="looks_cleargraphiceffects"/>
    <block type="looks_gotofrontback"><value name="FRONT_BACK"><shadow type="looks_gotofrontback_menu"></shadow></value></block>
    <block type="looks_goforwardbackwardlayers"><value name="FORWARD_BACKWARD"><shadow type="looks_goforwardbackwardlayers_menu"></shadow></value><value name="NUM"><shadow type="math_number"><field name="NUM">1</field></shadow></value></block>
    <block type="looks_costumenumbername"><value name="NUMBER_NAME"><shadow type="looks_costumenumbername_menu"></shadow></value></block>
    <block type="looks_backdropnumbername"><value name="NUMBER_NAME"><shadow type="looks_backdropnumbername_menu"></shadow></value></block>
    <block type="looks_size"/>
  </category>
  <category name="声音" colour="#CF63CF" secondaryColour="#A63FA6">
    <block type="sound_play"><value name="SOUND_MENU"><shadow type="sound_sounds_menu"></shadow></value></block>
    <block type="sound_playuntildone"><value name="SOUND_MENU"><shadow type="sound_sounds_menu"></shadow></value></block>
    <block type="sound_stopallsounds"/>
    <block type="sound_changeeffectby"><value name="EFFECT"><shadow type="sound_effect_menu"></shadow></value><value name="VALUE"><shadow type="math_number"><field name="NUM">10</field></shadow></value></block>
    <block type="sound_seteffectto"><value name="EFFECT"><shadow type="sound_effect_menu"></shadow></value><value name="VALUE"><shadow type="math_number"><field name="NUM">100</field></shadow></value></block>
    <block type="sound_cleareffects"/>
    <block type="sound_changevolumeby"><value name="VOLUME"><shadow type="math_number"><field name="NUM">-10</field></shadow></value></block>
    <block type="sound_setvolumeto"><value name="VOLUME"><shadow type="math_number"><field name="NUM">100</field></shadow></value></block>
    <block type="sound_volume"/>
  </category>
  <category name="事件" colour="#FFBF00" secondaryColour="#CC9900">
    <block type="event_whenflagclicked"/>
    <block type="event_whenkeypressed"><value name="KEY_OPTION"><shadow type="event_key_options"></shadow></value></block>
    <block type="event_whenthispriteclicked"/>
    <block type="event_whenbroadcastreceived"><value name="CHOICE"><shadow type="event_broadcast_menu"></shadow></value></block>
    <block type="event_broadcast"><value name="BROADCAST_OPTION"><shadow type="event_broadcast_menu"></shadow></value></block>
    <block type="event_broadcastandwait"><value name="BROADCAST_OPTION"><shadow type="event_broadcast_menu"></shadow></value></block>
    <block type="event_whenbackdropswitchesto"><value name="BACKDROP"><shadow type="backdrop"></shadow></value></block>
    <block type="event_whengreaterthan"><value name="WHENGREATERTHANMENU"><shadow type="event_greaterthan_menu"></shadow></value><value name="VALUE"><shadow type="math_number"><field name="NUM">10</field></shadow></value></block>
  </category>
  <category name="控制" colour="#FFAB19" secondaryColour="#CF8B17">
    <block type="control_wait"><value name="DURATION"><shadow type="math_positive_number"><field name="NUM">1</field></shadow></value></block>
    <block type="control_repeat"><value name="TIMES"><shadow type="math_positive_number"><field name="NUM">10</field></shadow></value></block>
    <block type="control_forever"/>
    <block type="control_if"><value name="CONDITION"><shadow type="logic_boolean"></shadow></value></block>
    <block type="control_if_else"><value name="CONDITION"><shadow type="logic_boolean"></shadow></value></block>
    <block type="control_waituntil"><value name="CONDITION"><shadow type="logic_boolean"></shadow></value></block>
    <block type="control_repeatuntil"><value name="CONDITION"><shadow type="logic_boolean"></shadow></value><value name="TIMES"><shadow type="math_positive_number"><field name="NUM">10</field></shadow></value></block>
    <block type="control_while"><value name="CONDITION"><shadow type="logic_boolean"></shadow></value></block>
    <block type="control_stop"><value name="STOP_OPTION"><shadow type="control_stop_menu"></shadow></value></block>
    <block type="control_createcloneof"><value name="CLONE_OPTION"><shadow type="control_create_clone_menu"></shadow></value></block>
    <block type="control_deletethisclone"/>
  </category>
  <category name="侦测" colour="#5CB1D6" secondaryColour="#2E8EB8">
    <block type="sensing_touchingobject"><value name="TOUCHINGOBJECTMENU"><shadow type="sensing_touchingobjectmenu"></shadow></value></block>
    <block type="sensing_touchingcolor"><value name="COLOR"><shadow type="colour_picker"></shadow></value></block>
    <block type="sensing_coloristouchingcolor"><value name="COLOR"><shadow type="colour_picker"></shadow></value><value name="COLOR2"><shadow type="colour_picker"></shadow></value></block>
    <block type="sensing_distanceto"><value name="DISTANCETOMENU"><shadow type="sensing_distancetomenu"></shadow></value></block>
    <block type="sensing_askandwait"><value name="QUESTION"><shadow type="text"><field name="TEXT">你叫什么名字？</field></shadow></value></block>
    <block type="sensing_answer"/>
    <block type="sensing_keypressed"><value name="KEY_OPTION"><shadow type="sensing_keyoptions"></shadow></value></block>
    <block type="sensing_mousedown"/>
    <block type="sensing_mousex"/>
    <block type="sensing_mousey"/>
    <block type="sensing_setdragmode"><value name="DRAG_MODE"><shadow type="sensing_setdragmode_menu"></shadow></value></block>
    <block type="sensing_loudness"/>
    <block type="sensing_timer"/>
    <block type="sensing_resettimer"/>
    <block type="sensing_of"><value name="OBJECT"><shadow type="sensing_of_object_menu"></shadow></value></block>
    <block type="sensing_current"><value name="CURRENTMENU"><shadow type="sensing_currentmenu"></shadow></value></block>
    <block type="sensing_daysoftweek"/>
    <block type="sensing_username"/>
  </category>
  <category name="运算" colour="#59C059" secondaryColour="#389438">
    <block type="operator_add"><value name="NUM1"><shadow type="math_number"><field name="NUM">1</field></shadow></value><value name="NUM2"><shadow type="math_number"><field name="NUM">1</field></shadow></value></block>
    <block type="operator_subtract"><value name="NUM1"><shadow type="math_number"><field name="NUM">1</field></shadow></value><value name="NUM2"><shadow type="math_number"><field name="NUM">1</field></shadow></value></block>
    <block type="operator_multiply"><value name="NUM1"><shadow type="math_number"><field name="NUM">1</field></shadow></value><value name="NUM2"><shadow type="math_number"><field name="NUM">1</field></shadow></value></block>
    <block type="operator_divide"><value name="NUM1"><shadow type="math_number"><field name="NUM">1</field></shadow></value><value name="NUM2"><shadow type="math_number"><field name="NUM">1</field></shadow></value></block>
    <block type="operator_random"><value name="FROM"><shadow type="math_number"><field name="NUM">1</field></shadow></value><value name="TO"><shadow type="math_number"><field name="NUM">10</field></shadow></value></block>
    <block type="operator_gt"><value name="OPERAND1"><shadow type="math_number"><field name="NUM">1</field></shadow></value><value name="OPERAND2"><shadow type="math_number"><field name="NUM">1</field></shadow></value></block>
    <block type="operator_lt"><value name="OPERAND1"><shadow type="math_number"><field name="NUM">1</field></shadow></value><value name="OPERAND2"><shadow type="math_number"><field name="NUM">1</field></shadow></value></block>
    <block type="operator_equals"><value name="OPERAND1"><shadow type="math_number"><field name="NUM">1</field></shadow></value><value name="OPERAND2"><shadow type="math_number"><field name="NUM">1</field></shadow></value></block>
    <block type="operator_and"><value name="OPERAND1"><shadow type="logic_boolean"></shadow></value><value name="OPERAND2"><shadow type="logic_boolean"></shadow></value></block>
    <block type="operator_or"><value name="OPERAND1"><shadow type="logic_boolean"></shadow></value><value name="OPERAND2"><shadow type="logic_boolean"></shadow></value></block>
    <block type="operator_not"><value name="OPERAND"><shadow type="logic_boolean"></shadow></value></block>
    <block type="operator_join"><value name="STRING1"><shadow type="text"><field name="TEXT">apple</field></shadow></value><value name="STRING2"><shadow type="text"><field name="TEXT">banana</field></shadow></value></block>
    <block type="operator_letter_of"><value name="LETTER"><shadow type="math_number"><field name="NUM">1</field></shadow></value><value name="STRING"><shadow type="text"><field name="TEXT">apple</field></shadow></value></block>
    <block type="operator_length"><value name="STRING"><shadow type="text"><field name="TEXT">apple</field></shadow></value></block>
    <block type="operator_contains"><value name="STRING1"><shadow type="text"><field name="TEXT">apple</field></shadow></value><value name="STRING2"><shadow type="text"><field name="TEXT">a</field></shadow></value></block>
    <block type="operator_mod"><value name="NUM1"><shadow type="math_number"><field name="NUM">1</field></shadow></value><value name="NUM2"><shadow type="math_number"><field name="NUM">1</field></shadow></value></block>
    <block type="operator_round"><value name="NUM"><shadow type="math_number"><field name="NUM">1</field></shadow></value></block>
    <block type="operator_mathop"><value name="OPERATOR"><shadow type="operator_mathop_menu"></shadow></value><value name="NUM"><shadow type="math_number"><field name="NUM">1</field></shadow></value></block>
  </category>
  <category name="变量" colour="#FF8C1A" secondaryColour="#DB6E00" custom="VARIABLE"/>
</xml>`;

// ── 处理 VM 发来的 workspaceUpdate 事件 ──
function onWorkspaceUpdate({ xml }) {
  if (!workspace) return;
  try {
    const dom = new DOMParser().parseFromString(xml, 'text/xml');
    clearWorkspaceAndLoadFromXml(dom, workspace);
  } catch (err) {
    console.error('[BlockEditor] workspaceUpdate 解析失败:', err);
  }
}

// ── 初始化积木编辑器 ──
export function initBlockEditor(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('[BlockEditor] 找不到容器:', containerId);
    return null;
  }

  try {
    workspace = inject(container, {
      toolbox: TOOLBOX_XML,
      media: '/scratch-blocks-media/',
      zoom: {
        controls: true,
        wheel: true,
        startScale: 0.65,
        maxScale: 3,
        minScale: 0.3,
        scaleSpeed: 1.02,
      },
      trashcan: true,
      scrollbars: true,
      comments: true,
      collapse: true,
      sounds: false,
    });

    // 连接 VM
    vm = getVM();
    if (vm) {
      // 积木变化 → 通知 VM
      workspace.addChangeListener(vm.blockListener);
      // VM 切换目标/加载项目 → 更新工作区
      vm.on('workspaceUpdate', onWorkspaceUpdate);
      // 若 VM 已在运行，手动触发一次 workspaceUpdate
      if (vm.editingTarget) {
        vm.emitWorkspaceUpdate();
      }
    }

    console.log('[BlockEditor] 初始化完成');
    return workspace;
  } catch (err) {
    console.error('[BlockEditor] 初始化失败:', err);
    return null;
  }
}

// ── 获取工作区实例 ──
export function getWorkspace() {
  return workspace;
}
