// 思维导图内置模板：一键生成常见的业务/学习结构
import { createDocument } from '../model/document'
import { syncMindmapEdges } from './mindmap'

const BRANCH_ACCENTS = ['teal', 'violet', 'amber', 'blue']

const TEMPLATES = {
  'template-mind-project': {
    title: '项目启动会',
    root: '项目启动',
    branches: [
      ['目标', [['业务目标'], ['成功衡量标准']]],
      ['范围', [['包含内容'], ['不包含内容']]],
      ['里程碑', [['立项'], ['方案评审'], ['灰度发布'], ['正式上线']]],
      ['团队与分工', [['产品'], ['设计'], ['研发'], ['测试']]],
      ['风险与依赖', [['已知风险'], ['外部依赖']]]
    ]
  },
  'template-mind-meeting': {
    title: '会议纪要',
    root: '会议纪要',
    branches: [
      ['会议信息', [['时间 / 地点'], ['参会人'], ['主持人']]],
      ['议题', [['议题一'], ['议题二']]],
      ['结论', [['已达成共识'], ['待定事项']]],
      ['行动项', [['负责人 · 截止时间'], ['跟进人 · 截止时间']]],
      ['下次会议', [['时间'], ['预读材料']]]
    ]
  },
  'template-mind-reading': {
    title: '读书笔记',
    root: '读书笔记',
    branches: [
      ['书籍信息', [['书名 / 作者'], ['阅读时间']]],
      ['核心观点', [['观点一'], ['观点二'], ['观点三']]],
      ['金句摘录', [['原文摘录']]],
      ['我的思考', [['认同的地方'], ['存疑的地方']]],
      ['行动清单', [['准备尝试'], ['进一步阅读']]]
    ]
  },
  'template-mind-swot': {
    title: 'SWOT 分析',
    root: 'SWOT 分析',
    branches: [
      ['优势 Strengths', [['资源'], ['能力']]],
      ['劣势 Weaknesses', [['短板'], ['制约']]],
      ['机会 Opportunities', [['市场变化'], ['政策 / 技术']]],
      ['威胁 Threats', [['竞争'], ['不确定性']]],
      ['策略组合', [['SO 增长'], ['WO 扭转'], ['ST 防御'], ['WT 规避']]]
    ]
  },
  'template-mind-competitor': {
    title: '竞品分析',
    root: '竞品分析',
    branches: [
      ['竞品清单', [['直接竞品'], ['间接竞品']]],
      ['功能对比', [['核心功能'], ['差异化功能']]],
      ['价格策略', [['定价模式'], ['优惠方式']]],
      ['用户口碑', [['好评点'], ['差评点']]],
      ['机会点', [['可切入场景'], ['风险提示']]]
    ]
  },
  'template-mind-weekly': {
    title: '周报',
    root: '本周周报',
    branches: [
      ['本周进展', [['完成事项'], ['进行中']]],
      ['数据表现', [['核心指标'], ['环比变化']]],
      ['问题与风险', [['阻塞问题'], ['需要协调']]],
      ['下周计划', [['重点目标'], ['预期产出']]],
      ['需要的支持', [['资源'], ['决策']]]
    ]
  },
  'template-mind-prd': {
    title: '产品需求',
    root: '产品需求',
    branches: [
      ['背景与目标', [['业务背景'], ['目标与指标']]],
      ['用户与场景', [['目标用户'], ['典型场景']]],
      ['功能范围', [['本期包含'], ['本期不做']]],
      ['交互与规则', [['主流程'], ['异常与边界']]],
      ['验收与埋点', [['验收标准'], ['数据埋点']]],
      ['排期', [['里程碑'], ['依赖方']]]
    ]
  },
  'template-mind-retro': {
    title: '项目复盘',
    root: '项目复盘',
    branches: [
      ['做得好', [['值得保持的做法']]],
      ['待改进', [['出现的问题']]],
      ['根因分析', [['流程'], ['协作'], ['技术']]],
      ['下一步行动', [['立即执行'], ['长期改进']]],
      ['经验沉淀', [['可复用的方法'], ['需要更新的文档']]]
    ]
  }
}

export const MINDMAP_TEMPLATE_IDS = Object.keys(TEMPLATES)

function buildTemplateNodes(rootText, branches) {
  const nodes = []
  let counter = 0
  const nextId = () => `tpl-${(counter += 1)}`

  const rootId = nextId()
  nodes.push({
    id: rootId,
    text: rootText,
    style: { accent: 'blue', elevation: 'glow' }
  })

  function walk(parentId, items, depth) {
    items.forEach(([text, children = []]) => {
      const id = nextId()
      nodes.push({
        id,
        parentId,
        text,
        style: {
          accent: BRANCH_ACCENTS[(depth - 1) % BRANCH_ACCENTS.length],
          elevation: 'soft'
        }
      })
      if (children.length) {
        walk(id, children, depth + 1)
      }
    })
  }

  walk(rootId, branches, 1)
  return nodes
}

export function createMindmapTemplateDocument(templateId) {
  const template = TEMPLATES[templateId]
  if (!template) {
    return null
  }

  const document = createDocument({ mode: 'mindmap', title: template.title })
  document.content.nodes = buildTemplateNodes(template.root, template.branches)
  syncMindmapEdges(document)
  return document
}

export function isMindmapTemplate(templateId) {
  return Object.prototype.hasOwnProperty.call(TEMPLATES, templateId)
}
