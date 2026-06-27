// ── VibeSc 技能引擎 ──
// 管理技能注册、路由、加载

var skillsRegistry = [];
var activeSkillId = 'block-writer';

// 内联技能定义（避免 fetch JSON 在构建后路径失效）
var SKILL_DEFS = [
  {
    id: 'block-writer',
    name: '写积木',
    description: '为角色生成 Scratch 积木脚本',
    trigger_keywords: ['走', '说', '移动', '重复', '如果', '让', '当', '点击', '等待', '转向', '跳', '旋转', '消失', '显示'],
    prompt: [
      '你是 VibeSc 的积木生成助手。',
      '你必须原样返回完整 project.json，只修改 targets[序号].blocks 字典。targets 数组不能省略。',
      '输出 \`\`\`blocks 代码块。',
      '',
      '积木输入: [1,[4,"N"]]=数字 [1,[5,"T"]]=文本 [2,"id"]=遮蔽  SUBSTACK=[2,"子栈第一块ID"]',
      '字段: ["值", "id"]  影子积木: shadow=true',
      '',
      '可用积木:',
      'motion_movesteps(STEPS) motion_turnright(DEGREES) motion_gotoxy(X,Y)',
      'motion_changexby(DX) motion_changeyby(DY) motion_pointindirection(DIRECTION)',
      'looks_say(MESSAGE) looks_sayforsecs(MESSAGE,SECS) looks_show looks_hide',
      'control_wait(DURATION) control_repeat(TIMES,SUBSTACK) control_forever(SUBSTACK)',
      'control_if(CONDITION,SUBSTACK) control_stop',
      'event_whenflagclicked event_whenbroadcastreceived'
    ].join('\n')
  },
  {
    id: 'image-gen',
    name: '生成图片',
    description: '为角色生成造型、背景图片',
    trigger_keywords: ['画', '生成', '造型', '背景', '图片', '素材', '插图', '颜色', '样子'],
    prompt: [
      '你是 VibeSc 的图片生成助手。根据用户需求输出图片参数。',
      '输出 \`\`\`image 代码块：',
      '{"prompt":"英文图片描述","size":"512x512","count":1}',
      '先写一句中文说明，再输出 \`\`\`image。'
    ].join('\n')
  },
  {
    id: 'code-checker',
    name: '查代码',
    description: '检查当前积木脚本的逻辑问题',
    trigger_keywords: ['检查', '问题', '错误', '为什么', '看看', '分析', 'bug', '哪里不对'],
    prompt: [
      '你是 VibeSc 的代码检查助手。分析当前角色的 Scratch 积木脚本。',
      '检查：1)死代码 2)变量未使用 3)冲突逻辑 4)类型不匹配 5)forever无wait',
      '输出 \`\`\`check 代码块：',
      '{"issues":[{"severity":"error/warning/suggestion","message":"问题","suggestion":"建议"}]}',
      '先写一句说明，再输出 \`\`\`check。'
    ].join('\n')
  }
];

export function loadSkills() {
  skillsRegistry = SKILL_DEFS;
  console.log('[VibeSc] 已加载 ' + skillsRegistry.length + ' 个技能');
  return Promise.resolve(skillsRegistry);
}

export function getActiveSkill() {
  for (var i = 0; i < skillsRegistry.length; i++) {
    if (skillsRegistry[i].id === activeSkillId) return skillsRegistry[i];
  }
  return skillsRegistry[0] || null;
}

export function setActiveSkill(id) {
  for (var i = 0; i < skillsRegistry.length; i++) {
    if (skillsRegistry[i].id === id) {
      activeSkillId = id;
      return true;
    }
  }
  return false;
}

export function getAllSkills() {
  return skillsRegistry;
}

// 根据关键词匹配最佳技能
export function matchSkill(text) {
  var best = null;
  var bestScore = 0;
  for (var i = 0; i < skillsRegistry.length; i++) {
    var skill = skillsRegistry[i];
    var score = 0;
    for (var k = 0; k < skill.trigger_keywords.length; k++) {
      if (text.indexOf(skill.trigger_keywords[k]) !== -1) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = skill;
    }
  }
  return best;
}
