const MIME_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg'
}

export function cmToPixels(lengthCm, dpi = 300) {
  return Math.ceil((Number(lengthCm) / 2.54) * dpi)
}

export function resolveImageExportOptions({ widthCm = 10, heightCm = 10, dpi = 300, format = 'png' } = {}) {
  return {
    width: cmToPixels(widthCm, dpi),
    height: cmToPixels(heightCm, dpi),
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

    const blob = await canvasToBlob(canvas, exportOptions.mimeType)
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

export function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
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
    return serializer.serializeToString(element)
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