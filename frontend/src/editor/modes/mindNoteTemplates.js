// 思维笔记内置模板：主题结构 + 每个主题下预置的富文本笔记块
import { createDocument } from '../model/document'
import { createMindNoteTextBlock } from '../render/textBlockLayer'
import { syncMindmapEdges } from './mindmap'

const BRANCH_ACCENTS = ['teal', 'violet', 'amber', 'blue']

const TEMPLATES = {
  'template-note-meeting': {
    title: '会议纪要',
    root: '会议纪要',
    branches: [
      ['会议信息', [['时间 / 地点'], ['参会人']]],
      ['议题', [['议题一'], ['议题二']]],
      ['结论', [['已达成共识'], ['待定事项']]],
      ['行动项', [['负责人 · 截止时间']]]
    ],
    // topicText -> 该主题下预置的笔记块
    notes: {
      '会议信息': [
        { html: '<h3>基础信息</h3><p>时间：2026-10-18 10:00</p><p>地点：3F 会议室</p><p>参会人：产品、设计、研发、测试</p>' },
        { html: '<h3>会前准备</h3><ul><li>预读材料已发出</li><li>上次行动项已回收</li></ul>' }
      ],
      '议题': [
        { html: '<h3>议题一</h3><p>背景 / 目标 / 期望产出</p>', order: 0 },
        { html: '<h3>议题二</h3><p>背景 / 目标 / 期望产出</p>', order: 1 }
      ],
      '结论': [
        { html: '<p>已达成共识：</p><ul><li>结论一</li><li>结论二</li></ul><p>待定事项：</p><ul><li>待确认项</li></ul>' }
      ],
      '行动项': [
        { html: '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>负责人 · 完成时间</p></div></li></ul>' }
      ]
    }
  },
  'template-note-retro': {
    title: '项目复盘',
    root: '迭代复盘',
    branches: [
      ['做得好', [['值得保持的做法']]],
      ['待改进', [['出现的问题']]],
      ['根因分析', [['流程'], ['协作'], ['技术']]],
      ['下一步行动', [['立即执行'], ['长期改进']]]
    ],
    notes: {
      '做得好': [
        { html: '<ul><li>需求澄清比上个迭代更充分</li><li>上线前完成了回归清单</li></ul>' }
      ],
      '待改进': [
        { html: '<ul><li>联调阶段发现接口约定不一致</li><li>测试环境数据不完整</li></ul>' }
      ],
      '根因分析': [
        { html: '<p><strong>流程</strong>：缺少接口评审环节</p><p><strong>协作</strong>：前后端信息同步滞后</p><p><strong>技术</strong>：测试环境与生产差异较大</p>' }
      ],
      '下一步行动': [
        { html: '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>补充接口评审模板</p></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>把测试数据纳入 CI</p></div></li></ul>' }
      ]
    }
  }
}

export const MIND_NOTE_TEMPLATE_IDS = Object.keys(TEMPLATES)

function buildNodes(rootText, branches) {
  const nodes = []
  let counter = 0
  const nextId = () => `tpl-${(counter += 1)}`

  const rootId = nextId()
  nodes.push({
    id: rootId,
    text: rootText,
    style: { accent: 'blue', elevation: 'glow' }
  })

  const walk = (parentId, items, depth) => {
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
  return { nodes, rootId }
}

export function createMindNoteTemplateDocument(templateId) {
  const template = TEMPLATES[templateId]
  if (!template) {
    return null
  }

  const document = createDocument({ mode: 'mind-note', title: template.title })
  const { nodes } = buildNodes(template.root, template.branches)
  document.content.nodes = nodes
  syncMindmapEdges(document)

  const blocks = []
  let blockIndex = 0
  const nodeByText = new Map(nodes.map(node => [node.text, node]))

  Object.entries(template.notes || {}).forEach(([topicText, entries]) => {
    const node = nodeByText.get(topicText)
    if (!node) {
      return
    }
    entries.forEach((entry, index) => {
      blockIndex += 1
      blocks.push(createMindNoteTextBlock({
        nodeId: node.id,
        order: Number.isFinite(entry.order) ? entry.order : index,
        html: entry.html,
        text: stripTags(entry.html)
      }))
    })
  })

  document.content.textBlocks = blocks
  return document
}

export function isMindNoteTemplate(templateId) {
  return Object.prototype.hasOwnProperty.call(TEMPLATES, templateId)
}

function stripTags(html = '') {
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h[1-6]|li|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
}
