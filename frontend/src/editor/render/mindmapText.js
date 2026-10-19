// 思维导图主题文本的折行与自适应尺寸：布局和渲染共用同一套结果，避免文字和边框对不上。
const CJK_PATTERN = /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef\u3000-\u303f\u3040-\u30ff]/

const TOPIC_MIN_WIDTH = 110
const TOPIC_MAX_WIDTH = 208
const ROOT_MIN_WIDTH = 168
const ROOT_MAX_WIDTH = 268
const TOPIC_MIN_HEIGHT = 52
const LINE_HEIGHT_RATIO = 1.42
const HORIZONTAL_PADDING = 38
const VERTICAL_PADDING = 26

export function measureTopicText(text, fontSize) {
  let width = 0
  for (const char of String(text ?? '')) {
    width += CJK_PATTERN.test(char) ? fontSize : fontSize * 0.56
  }
  return width
}

export function wrapTopicText(text, maxWidth, fontSize) {
  const source = String(text ?? '')
  if (!source) {
    return ['']
  }

  const lines = []
  let line = ''
  let width = 0

  for (const char of source) {
    if (char === '\n') {
      lines.push(line)
      line = ''
      width = 0
      continue
    }
    const charWidth = CJK_PATTERN.test(char) ? fontSize : fontSize * 0.56
    if (line && width + charWidth > maxWidth) {
      lines.push(line)
      line = char
      width = charWidth
    } else {
      line += char
      width += charWidth
    }
  }

  lines.push(line)
  return lines
}

export function resolveTopicTextLayout(node = {}) {
  const style = node.style || {}
  const isRoot = !node.parentId && node.floating !== true
  const rawSize = Number(style.fontSize) || (isRoot ? 18 : 15)
  const fontSize = Math.max(11, Math.min(28, Math.round(rawSize)))
  const measureFactor = style.bold ? 1.04 : 1
  const minWidth = isRoot ? ROOT_MIN_WIDTH : TOPIC_MIN_WIDTH
  const maxWidth = isRoot ? ROOT_MAX_WIDTH : TOPIC_MAX_WIDTH

  const lines = wrapTopicText(node.text, maxWidth - HORIZONTAL_PADDING, fontSize * measureFactor)
  const lineHeight = Math.round(fontSize * LINE_HEIGHT_RATIO)
  const longestLine = Math.max(...lines.map(line => measureTopicText(line, fontSize * measureFactor)))

  return {
    lines,
    fontSize,
    lineHeight,
    width: Math.min(maxWidth, Math.max(minWidth, Math.ceil(longestLine) + HORIZONTAL_PADDING)),
    height: Math.max(TOPIC_MIN_HEIGHT, lines.length * lineHeight + VERTICAL_PADDING)
  }
}
