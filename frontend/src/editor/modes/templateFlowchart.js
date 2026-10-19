import { createDocument, createNode, normalizeEdgeStyle } from '../model/document'

// 示例模板：登录流程（最典型的通用流程图范例）
// 7 个节点、7 条连线：开始 → 输入 → 校验 → 判断 →(是) 进入工作台 → 结束
//                                           └→(否) 提示错误 ──回环──> 重新输入
// 覆盖终止符、平行四边形（输入）、矩形（处理）、菱形（判断）、文档（输出）
// 五种基础流程图图形，以及条件分支标签与回环连线的完整效果。
export function createFlowTemplateDocument() {
  const document = createDocument({
    mode: 'flowchart',
    title: '示例：登录流程'
  })

  const node = (id, kind, x, y, width, height, text, accent) => createNode({
    id,
    kind,
    x,
    y,
    width,
    height,
    text,
    layerId: 'layer-nodes',
    style: { accent, theme: 'aurora', elevation: 'soft' }
  })

  // 主干统一居中在 x = 505，自上而下排列
  document.content.nodes = [
    node('flow-start', 'terminator', 430, 48, 150, 64, '开始', 'emerald'),
    node('flow-input', 'parallelogram', 418, 152, 174, 66, '输入账号与密码', 'violet'),
    node('flow-verify', 'process', 421, 256, 168, 64, '校验账号密码', 'slate'),
    node('flow-decide', 'decision', 417, 356, 176, 100, '校验通过？', 'amber'),
    node('flow-enter', 'process', 421, 494, 168, 64, '进入工作台', 'teal'),
    node('flow-end', 'terminator', 430, 596, 150, 64, '结束', 'emerald'),
    node('flow-warn', 'document', 760, 367, 176, 78, '提示错误信息', 'rose')
  ]

  const edge = (id, from, to, fromAnchor, toAnchor, label = '') => ({
    id,
    fromNodeId: from,
    toNodeId: to,
    fromAnchor,
    toAnchor,
    layerId: 'layer-edges',
    label,
    style: normalizeEdgeStyle({ route: 'orthogonal', stroke: 'solid', marker: 'arrow' })
  })

  document.content.edges = [
    edge('flow-e1', 'flow-start', 'flow-input', 'bottom', 'top'),
    edge('flow-e2', 'flow-input', 'flow-verify', 'bottom', 'top'),
    edge('flow-e3', 'flow-verify', 'flow-decide', 'bottom', 'top'),
    edge('flow-e4', 'flow-decide', 'flow-enter', 'bottom', 'top', '是'),
    edge('flow-e5', 'flow-enter', 'flow-end', 'bottom', 'top'),
    edge('flow-e6', 'flow-decide', 'flow-warn', 'right', 'left', '否'),
    edge('flow-e7', 'flow-warn', 'flow-input', 'top', 'right', '重新输入')
  ]

  return document
}
