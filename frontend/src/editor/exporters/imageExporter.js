const MIME_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg'
}

export function cmToPixels(lengthCm, dpi = 300) {
  return Math.ceil((Number(lengthCm) / 2.54) * dpi)
}

export function resolveImageExportOptions({
  widthCm = 10,
  heightCm = 10,
  dpi = 300,
  format = 'png',
  width: explicitWidth,
  height: explicitHeight
} = {}) {
  const width = Number(explicitWidth)
  const height = Number(explicitHeight)
  return {
    width: width > 0 ? Math.ceil(width) : cmToPixels(widthCm, dpi),
    height: height > 0 ? Math.ceil(height) : cmToPixels(heightCm, dpi),
    pixelDensity: dpi,
    mimeType: MIME_TYPES[format] || MIME_TYPES.png,
    format
  }
}

export async function exportSvgElementAsImage(element, options = {}) {
  if (!element) {
    throw new Error('缺少可导出的 SVG 画布')
  }

  const exportOptions = resolveImageExportOptions(options)
  await inlineSvgImages(element)
  const source = serializeExportSource(element, exportOptions)
  const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' })
  const objectUrl = URL.createObjectURL(svgBlob)

  try {
    const image = await loadImage(objectUrl)
    const canvas = document.createElement('canvas')
    canvas.width = exportOptions.width
    canvas.height = exportOptions.height
    const context = canvas.getContext('2d')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    let blob
    try {
      blob = await canvasToBlob(canvas, exportOptions.mimeType)
    } catch (error) {
      if (error?.name === 'SecurityError') {
        throw new Error('导出图片失败：画布中包含跨域图片或外部资源，浏览器禁止写入。请把节点图片改为上传的本地图片后重试。')
      }
      throw error
    }
    return {
      blob,
      width: exportOptions.width,
      height: exportOptions.height,
      pixelDensity: exportOptions.pixelDensity,
      fileName: options.fileName || `diagram.${exportOptions.format === 'jpeg' ? 'jpg' : exportOptions.format}`
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

const HTML_FONT_STACK = 'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
const HTML_CODE_STACK = 'Consolas, Monaco, "SFMono-Regular", monospace'

const HTML_BLOCK_SPECS = {
  h1: { fontSize: 34, lineHeight: 44, weight: 700, marginTop: 20, marginBottom: 14 },
  h2: { fontSize: 28, lineHeight: 37, weight: 700, marginTop: 18, marginBottom: 12 },
  h3: { fontSize: 23, lineHeight: 31, weight: 700, marginTop: 16, marginBottom: 10 },
  h4: { fontSize: 19, lineHeight: 27, weight: 600, marginTop: 14, marginBottom: 8 },
  h5: { fontSize: 17, lineHeight: 25, weight: 600, marginTop: 12, marginBottom: 8 },
  h6: { fontSize: 16, lineHeight: 24, weight: 600, marginTop: 10, marginBottom: 6 },
  p: { fontSize: 16, lineHeight: 26, weight: 400, marginTop: 0, marginBottom: 12 },
  li: { fontSize: 16, lineHeight: 26, weight: 400, marginTop: 0, marginBottom: 5 },
  pre: { fontSize: 13.5, lineHeight: 21, weight: 400, marginTop: 6, marginBottom: 14, mono: true, background: '#f4f4f5' },
  blockquote: { fontSize: 16, lineHeight: 26, weight: 400, marginTop: 6, marginBottom: 12, italic: true, quote: true },
  'table-row': { fontSize: 13.5, lineHeight: 23, weight: 400, marginTop: 0, marginBottom: 2, mono: true },
  image: { fontSize: 12, lineHeight: 16, weight: 400, marginTop: 6, marginBottom: 12 },
  hr: { fontSize: 1, lineHeight: 1, weight: 400, marginTop: 14, marginBottom: 14 }
}

// Markdown 预览是 HTML，不能直接塞进 <img>；这里直接用 Canvas 2D 画一份带标题层级、
// 列表、引用、代码块和表格的图片，避免之前的“白底纯文本”导出。
export async function exportHtmlElementAsImage(element, options = {}) {
  if (!element) {
    throw new Error('缺少可导出的内容')
  }

  const exportOptions = resolveImageExportOptions(options)
  const canvas = document.createElement('canvas')
  canvas.width = exportOptions.width
  canvas.height = exportOptions.height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('导出图片初始化失败')
  }

  const logicalWidth = Math.max(1, Number(options.logicalWidth) || Number(element.clientWidth) || exportOptions.width)
  const logicalHeight = Math.max(1, Number(options.logicalHeight) || Number(element.clientHeight) || exportOptions.height)
  const scaleX = exportOptions.width / logicalWidth
  const scaleY = exportOptions.height / logicalHeight

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  const blocks = collectHtmlBlocks(element)
  const imageMap = await preloadHtmlImages(blocks)
  context.save()
  context.scale(scaleX, scaleY)
  drawHtmlElement(context, element, logicalWidth, logicalHeight, { blocks, imageMap })
  context.restore()

  const blob = await canvasToBlob(canvas, exportOptions.mimeType)
  return {
    blob,
    width: exportOptions.width,
    height: exportOptions.height,
    pixelDensity: exportOptions.pixelDensity,
    fileName: options.fileName || `document.${exportOptions.format === 'jpeg' ? 'jpg' : exportOptions.format}`
  }
}

function drawHtmlElement(context, element, width, height, options = {}) {
  const margin = Number.isFinite(Number(options.margin))
    ? Math.max(0, Number(options.margin))
    : Math.round(Math.min(56, width * 0.05))
  const blocks = options.blocks || collectHtmlBlocks(element)
  const imageMap = options.imageMap || new Map()
  if (!blocks.length) {
    drawPlainText(context, element, width, height, margin)
    return
  }

  const availableWidth = width - margin * 2
  const availableHeight = height - margin * 2
  let layout = buildHtmlLayout(context, blocks, availableWidth, 1)
  const totalHeight = layout.reduce((sum, item) => sum + item.height, 0)
  const scale = totalHeight > availableHeight
    ? Math.max(0.55, availableHeight / Math.max(1, totalHeight))
    : 1
  if (scale < 1) {
    layout = buildHtmlLayout(context, blocks, availableWidth, scale)
  }

  let y = margin
  layout.forEach(item => {
    const { block, spec, lines, indent } = item
    y += spec.marginTop
    const x = margin + indent

    if (block.tag === 'hr') {
      context.fillStyle = '#e4e4e7'
      context.fillRect(margin, y, availableWidth, Math.max(1, spec.lineHeight))
      y += Math.max(1, spec.lineHeight) + spec.marginBottom
      return
    }

    if (block.tag === 'image') {
      const imageWidth = item.imageWidth || 0
      const imageHeight = item.imageHeight || 0
      const image = imageMap.get(block.src)
      if (image) {
        context.drawImage(image, x, y, imageWidth, imageHeight)
      } else {
        drawImagePlaceholder(context, block, x, y, imageWidth, imageHeight)
      }
      y += imageHeight + spec.marginBottom
      return
    }

    const textHeight = Math.max(1, lines.length) * spec.lineHeight
    if (spec.background) {
      context.fillStyle = spec.background
      context.fillRect(x, y - 6 * scale, availableWidth - indent, textHeight + 12 * scale)
    }
    if (spec.quote) {
      context.fillStyle = '#d4d4d8'
      context.fillRect(x, y, Math.max(2, 3 * scale), textHeight)
    }
    if (block.tag === 'table-row' && block.header) {
      context.fillStyle = '#f4f4f5'
      context.fillRect(x, y - 4 * scale, availableWidth - indent, textHeight + 8 * scale)
    }

    context.fillStyle = block.tag === 'pre' || block.tag === 'table-row' ? '#3f3f46' : '#27272a'
    context.font = htmlFont(spec)
    context.textBaseline = 'top'
    const textX = x + (spec.background ? 12 * scale : 0) + (spec.quote ? 14 * scale : 0)
    lines.forEach((line, index) => {
      const lineY = y + index * spec.lineHeight
      if (Array.isArray(line)) {
        drawRichLine(context, line, textX, lineY, spec)
      } else if (line) {
        context.fillText(line, textX, lineY)
      }
    })
    y += textHeight + spec.marginBottom
  })
}

export async function renderHtmlElementToDataUrl(element, options = {}) {
  if (!element) {
    throw new Error('缺少可渲染的内容')
  }
  const width = Math.max(1, Number(options.width) || 320)
  const height = Math.max(1, Number(options.height) || 200)
  const scale = Math.max(1, Number(options.scale) || 2)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('导出图片初始化失败')
  }

  context.scale(scale, scale)
  const blocks = collectHtmlBlocks(element)
  const imageMap = await preloadHtmlImages(blocks)
  drawHtmlElement(context, element, width, height, {
    blocks,
    imageMap,
    margin: options.margin ?? 12
  })
  return canvas.toDataURL('image/png')
}

export function collectHtmlBlocks(root) {
  const blocks = []

  function pushBlock(tag, node, depth = 0, ordered = false, index = 0, header = false) {
    const text = getElementText(node)
    if (!text) {
      return
    }
    const runs = tag === 'pre'
      ? [{ text, style: { code: true, blockCode: true } }]
      : trimInlineRuns(collectInlineRuns(node))
    const checkbox = tag === 'li' ? node.querySelector?.('input[type="checkbox"]') : null
    let checked = null
    if (tag === 'li' && node.getAttribute?.('data-type') === 'taskItem') {
      const dataChecked = node.getAttribute('data-checked')
      checked = dataChecked === 'true' || dataChecked === 'false'
        ? dataChecked === 'true'
        : (checkbox ? Boolean(checkbox.checked || checkbox.hasAttribute('checked')) : null)
    } else if (checkbox) {
      checked = Boolean(checkbox.checked || checkbox.hasAttribute('checked'))
    }
    blocks.push({ tag, text, runs, depth, ordered, index, header, checked })
  }

  function pushImageBlock(image, depth = 0) {
    const src = image.currentSrc || image.src || image.getAttribute?.('src') || ''
    if (!src) {
      return
    }
    blocks.push({
      tag: 'image',
      text: image.getAttribute?.('alt') || '',
      alt: image.getAttribute?.('alt') || '',
      src,
      depth,
      width: Number(image.naturalWidth) || Number(image.getAttribute?.('width')) || 0,
      height: Number(image.naturalHeight) || Number(image.getAttribute?.('height')) || 0
    })
  }

  function pushBlockWithImages(tag, node, depth = 0, ordered = false, index = 0, header = false) {
    pushBlock(tag, node, depth, ordered, index, header)
    ;[...node.querySelectorAll('img')].forEach(image => pushImageBlock(image, depth))
  }

  function walk(node, context) {
    if (!node || node.nodeType !== 1) {
      return
    }
    const tag = node.tagName.toLowerCase()
    if (tag === 'img') {
      pushImageBlock(node, context.depth)
      return
    }
    if (/^h[1-6]$/.test(tag)) {
      pushBlockWithImages(tag, node, context.depth)
      return
    }
    if (tag === 'p') {
      pushBlockWithImages('p', node, context.depth)
      return
    }
    if (tag === 'pre') {
      pushBlock('pre', node, context.depth)
      return
    }
    if (tag === 'blockquote') {
      pushBlockWithImages('blockquote', node, context.depth)
      return
    }
    if (tag === 'hr') {
      blocks.push({ tag: 'hr', text: '', depth: context.depth })
      return
    }
    if (tag === 'table') {
      node.querySelectorAll('tr').forEach(row => {
        const header = row.parentElement?.tagName.toLowerCase() === 'thead'
        const cells = [...row.children].map(cell => getElementText(cell)).filter(Boolean)
        if (cells.length) {
          blocks.push({ tag: 'table-row', text: cells.join('   |   '), depth: context.depth, header })
        }
      })
      return
    }
    if (tag === 'ul' || tag === 'ol') {
      const ordered = tag === 'ol'
      ;[...node.children].forEach((child, index) => {
        if (child.tagName.toLowerCase() !== 'li') {
          walk(child, context)
          return
        }
        const clone = child.cloneNode(true)
        clone.querySelectorAll('ul, ol').forEach(list => list.remove())
        pushBlockWithImages('li', clone, context.depth, ordered, index + 1)
        ;[...child.children].forEach(grandChild => {
          const grandTag = grandChild.tagName.toLowerCase()
          if (grandTag === 'ul' || grandTag === 'ol') {
            walk(grandChild, { depth: context.depth + 1 })
          }
        })
      })
      return
    }

    ;[...node.children].forEach(child => walk(child, context))
  }

  walk(root, { depth: 0 })
  return blocks
}

function collectInlineRuns(node, style = {}, runs = []) {
  if (!node) {
    return runs
  }
  if (node.nodeType === 3) {
    const text = String(node.nodeValue || '').replace(/\u00a0/g, ' ')
    if (text) {
      pushInlineRun(runs, text, style)
    }
    return runs
  }
  if (node.nodeType !== 1) {
    return runs
  }

  const tag = node.tagName.toLowerCase()
  if (tag === 'br') {
    pushInlineRun(runs, '\n', style)
    return runs
  }
  if (tag === 'img') {
    return runs
  }

  const nextStyle = { ...style }
  if (tag === 'strong' || tag === 'b') {
    nextStyle.bold = true
  } else if (tag === 'em' || tag === 'i') {
    nextStyle.italic = true
  } else if (tag === 'u') {
    nextStyle.underline = true
  } else if (tag === 's' || tag === 'del' || tag === 'strike') {
    nextStyle.strike = true
  } else if (tag === 'code') {
    nextStyle.code = true
  } else if (tag === 'a') {
    nextStyle.link = true
  }

  ;[...node.childNodes].forEach(child => collectInlineRuns(child, nextStyle, runs))
  return runs
}

function pushInlineRun(runs, text, style) {
  if (!text) {
    return
  }
  const last = runs[runs.length - 1]
  if (last && sameInlineStyle(last.style, style)) {
    last.text += text
    return
  }
  runs.push({ text, style: { ...style } })
}

function sameInlineStyle(left = {}, right = {}) {
  return Boolean(left.bold) === Boolean(right.bold) &&
    Boolean(left.italic) === Boolean(right.italic) &&
    Boolean(left.underline) === Boolean(right.underline) &&
    Boolean(left.strike) === Boolean(right.strike) &&
    Boolean(left.code) === Boolean(right.code) &&
    Boolean(left.link) === Boolean(right.link) &&
    Boolean(left.blockCode) === Boolean(right.blockCode)
}

function trimInlineRuns(runs) {
  const cloned = runs.map(run => ({ ...run, text: String(run.text || '') }))
  const firstText = cloned.find(run => run.text)
  if (firstText) {
    firstText.text = firstText.text.replace(/^\s+/, '')
  }
  const lastText = [...cloned].reverse().find(run => run.text)
  if (lastText) {
    lastText.text = lastText.text.replace(/\s+$/, '')
  }
  return cloned.filter(run => run.text)
}

function buildHtmlLayout(context, blocks, maxWidth, scale) {
  return blocks.map(block => {
    const baseSpec = HTML_BLOCK_SPECS[block.tag] || HTML_BLOCK_SPECS.p
    const spec = scaleHtmlSpec(baseSpec, scale)
    const indent = block.depth * 22 * scale
    if (block.tag === 'hr') {
      return { block, spec, lines: [''], indent, height: spec.lineHeight + spec.marginTop + spec.marginBottom }
    }
    if (block.tag === 'image') {
      const maxImageWidth = Math.max(80, maxWidth - indent)
      const naturalWidth = Number(block.width) || 320
      const naturalHeight = Number(block.height) || Math.round(naturalWidth * 0.6)
      const ratio = naturalHeight / Math.max(1, naturalWidth)
      let imageWidth = Math.min(maxImageWidth, naturalWidth)
      let imageHeight = imageWidth * ratio
      const maxImageHeight = maxWidth * 0.75
      if (imageHeight > maxImageHeight) {
        imageHeight = maxImageHeight
        imageWidth = imageHeight / Math.max(0.01, ratio)
      }
      return {
        block,
        spec,
        lines: [],
        indent,
        imageWidth,
        imageHeight,
        height: spec.marginTop + imageHeight + spec.marginBottom
      }
    }

    const bullet = block.tag === 'li'
      ? (block.checked === true
          ? '☑ '
          : (block.checked === false ? '☐ ' : (block.ordered ? `${block.index}. ` : '• ')))
      : ''
    const horizontalPadding = (spec.background ? 24 : 0) + (spec.quote ? 16 : 0)
    const lineWidth = Math.max(40, maxWidth - indent - horizontalPadding * scale)
    context.font = htmlFont(spec)
    let lines = []

    if (block.tag === 'pre' || block.tag === 'table-row') {
      const paragraphs = String(block.text || '').split(/\r?\n/)
      paragraphs.forEach(paragraph => {
        if (!paragraph) {
          lines.push('')
          return
        }
        wrapCanvasText(context, paragraph, lineWidth).forEach(line => lines.push(line))
      })
    } else {
      const sourceRuns = block.runs?.length ? block.runs : [{ text: block.text || '', style: {} }]
      const runs = bullet ? [{ text: bullet, style: {} }, ...sourceRuns] : sourceRuns
      lines = wrapRichRuns(context, runs, lineWidth, spec)
    }

    const textHeight = Math.max(1, lines.length) * spec.lineHeight
    return {
      block,
      spec,
      lines,
      indent,
      height: spec.marginTop + textHeight + spec.marginBottom
    }
  })
}

function scaleHtmlSpec(spec, scale) {
  return {
    ...spec,
    fontSize: Math.max(9, spec.fontSize * scale),
    lineHeight: Math.max(12, spec.lineHeight * scale),
    marginTop: spec.marginTop * scale,
    marginBottom: spec.marginBottom * scale
  }
}

function htmlFont(spec) {
  return `${spec.italic ? 'italic ' : ''}${spec.weight} ${spec.fontSize.toFixed(1)}px ${spec.mono ? HTML_CODE_STACK : HTML_FONT_STACK}`
}

function wrapCanvasText(context, text, maxWidth) {
  const lines = []
  let line = ''
  for (const char of String(text || '')) {
    const next = line + char
    if (line && context.measureText(next).width > maxWidth) {
      lines.push(line)
      line = char
    } else {
      line = next
    }
  }
  if (line) {
    lines.push(line)
  }
  return lines.length ? lines : ['']
}

function wrapRichRuns(context, runs, maxWidth, spec) {
  const lines = []
  let current = []
  let currentWidth = 0

  function flush() {
    lines.push(current)
    current = []
    currentWidth = 0
  }

  runs.forEach(run => {
    const style = run.style || {}
    context.font = inlineFont(style, spec)
    for (const char of String(run.text || '')) {
      if (char === '\n') {
        flush()
        continue
      }
      const width = context.measureText(char).width
      if (current.length && currentWidth + width > maxWidth) {
        flush()
      }
      appendRichSegment(current, char, style)
      currentWidth += width
    }
  })

  if (current.length || !lines.length) {
    lines.push(current)
  }
  return lines
}

function appendRichSegment(line, text, style) {
  const last = line[line.length - 1]
  if (last && sameInlineStyle(last.style, style)) {
    last.text += text
    return
  }
  line.push({ text, style: { ...style } })
}

function drawRichLine(context, line, x, y, spec) {
  let cursor = x
  line.forEach(segment => {
    const style = segment.style || {}
    const text = segment.text || ''
    if (!text) {
      return
    }
    context.font = inlineFont(style, spec)
    const width = context.measureText(text).width

    if (style.code && !style.blockCode) {
      context.fillStyle = '#f1f5f9'
      context.fillRect(cursor - 1, y - 2, width + 2, spec.lineHeight - 2)
    }
    context.fillStyle = style.link ? '#0369a1' : (style.code ? '#3f3f46' : '#27272a')
    context.fillText(text, cursor, y)

    if (style.underline || style.link) {
      context.fillStyle = style.link ? '#0369a1' : '#27272a'
      context.fillRect(cursor, y + spec.fontSize + 2, width, 1)
    }
    if (style.strike) {
      context.fillStyle = '#27272a'
      context.fillRect(cursor, y + spec.fontSize * 0.55, width, 1)
    }
    cursor += width
  })
}

function inlineFont(style = {}, spec) {
  const weight = style.bold ? 700 : spec.weight
  const italic = style.italic || spec.italic ? 'italic ' : ''
  const family = style.code || spec.mono ? HTML_CODE_STACK : HTML_FONT_STACK
  return `${italic}${weight} ${spec.fontSize.toFixed(1)}px ${family}`
}

function drawPlainText(context, element, width, height, margin) {
  const lines = String(element.innerText || element.textContent || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
  if (!lines.length) {
    return
  }
  const spec = HTML_BLOCK_SPECS.p
  context.fillStyle = '#27272a'
  context.font = htmlFont(spec)
  context.textBaseline = 'top'
  let y = margin
  lines.forEach(line => {
    wrapCanvasText(context, line, width - margin * 2).forEach(part => {
      if (y + spec.lineHeight > height - margin) {
        return
      }
      context.fillText(part, margin, y)
      y += spec.lineHeight
    })
  })
}

function getElementText(node) {
  const text = typeof node.innerText === 'string' && node.innerText
    ? node.innerText
    : (node.textContent || '')
  return String(text)
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

export function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = sanitizeFileName(fileName)
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  // 立即 revoke 在部分浏览器会中断下载，等下载任务启动后再释放
  window.setTimeout(() => {
    anchor.remove()
    URL.revokeObjectURL(url)
  }, 1000)
}

export function sanitizeFileName(fileName, fallback = 'diagram') {
  const cleaned = String(fileName ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
  return cleaned || fallback
}

async function inlineSvgImages(element) {
  if (typeof SVGElement === 'undefined' || !(element instanceof SVGElement)) {
    return
  }
  const images = [...element.querySelectorAll('image')]
  if (!images.length) {
    return
  }

  let failed = 0
  await Promise.all(images.map(async image => {
    const href = image.getAttribute('href') || image.getAttribute('xlink:href') || ''
    if (!href || /^(data:|blob:)/i.test(href)) {
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    try {
      const response = await fetch(href, { signal: controller.signal })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const dataUrl = await blobToDataUrl(await response.blob())
      image.setAttribute('href', dataUrl)
      image.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', dataUrl)
    } catch {
      failed += 1
    } finally {
      clearTimeout(timer)
    }
  }))

  if (failed > 0) {
    throw new Error(`导出图片失败：有 ${failed} 张节点图片无法读取（可能是外链未开启 CORS），请改用上传的本地图片后重试。`)
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('读取图片失败'))
    reader.readAsDataURL(blob)
  })
}

async function preloadHtmlImages(blocks) {
  const sources = [...new Set(blocks.filter(block => block.tag === 'image').map(block => block.src))]
  const imageMap = new Map()
  await Promise.all(sources.map(async src => {
    const image = await loadExportImage(src)
    if (image) {
      imageMap.set(src, image)
    }
  }))
  return imageMap
}

function loadExportImage(src) {
  return new Promise(resolve => {
    const image = new Image()
    if (!/^(data:|blob:)/i.test(src)) {
      image.crossOrigin = 'anonymous'
    }
    let settled = false
    const done = value => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      resolve(value)
    }
    const timer = setTimeout(() => done(null), 8000)
    image.onload = () => done(image)
    image.onerror = () => done(null)
    image.src = src
  })
}

function drawImagePlaceholder(context, block, x, y, width, height) {
  context.fillStyle = '#f4f4f5'
  context.fillRect(x, y, width, height)
  context.strokeStyle = '#d4d4d8'
  context.lineWidth = 1
  context.strokeRect(x + 0.5, y + 0.5, Math.max(0, width - 1), Math.max(0, height - 1))
  context.fillStyle = '#71717a'
  context.font = `13px ${HTML_FONT_STACK}`
  context.textBaseline = 'top'
  context.fillText(block.alt || '图片无法加载', x + 10, y + 10)
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('导出图片生成失败'))
    image.src = url
  })
}

function canvasToBlob(canvas, mimeType) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('导出图片写入失败'))
        return
      }
      resolve(blob)
    }, mimeType, 0.95)
  })
}

function serializeExportSource(element, exportOptions) {
  const serializer = new XMLSerializer()
  if (element instanceof SVGElement) {
    const clone = element.cloneNode(true)
    const viewBox = clone.getAttribute('viewBox')
    const viewWidth = Number(clone.getAttribute('width')) || Number(element.viewBox?.baseVal?.width) || exportOptions.width
    const viewHeight = Number(clone.getAttribute('height')) || Number(element.viewBox?.baseVal?.height) || exportOptions.height
    if (!viewBox) {
      clone.setAttribute('viewBox', `0 0 ${viewWidth} ${viewHeight}`)
    }
    clone.setAttribute('width', String(exportOptions.width))
    clone.setAttribute('height', String(exportOptions.height))
    clone.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    return serializer.serializeToString(clone)
  }

  const lines = String(element.innerText || '')
    .split(/\r?\n/)
    .filter(line => line.trim().length > 0)

  const escapedLines = lines.map(line => escapeXml(line))
  const textMarkup = escapedLines.map((line, index) => (
    `<text x="40" y="${70 + index * 36}" font-size="24" font-family="Segoe UI, sans-serif" fill="#0f172a">${line}</text>`
  )).join('')

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${exportOptions.width}" height="${exportOptions.height}">`,
    '<rect width="100%" height="100%" fill="#ffffff" />',
    textMarkup,
    '</svg>'
  ].join('')
}

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}