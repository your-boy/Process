import { collectHiddenNodeIds } from '../modes/mindmap'
import { exportHtmlElementAsImage, exportSvgElementAsImage, triggerDownload } from '../exporters/imageExporter'
import { buildOpmlText, buildOutlineText } from '../exporters/outlineExporter'
import { t } from '../../i18n'

function clone(value) {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value)
    } catch {
      // Vue proxies can contain non-cloneable handles.
    }
  }
  return JSON.parse(JSON.stringify(value))
}

function isTreeMode(mode) {
  return ['mindmap', 'mind-note'].includes(mode)
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function useDocumentExport({
  documentRef,
  statusMessage,
  errorMessage,
  commitPendingEdit
}) {
  function createExportSvgClone(svgElement) {
    const cloneNode = svgElement.cloneNode(true)
    const interactive = [
      '.selection-marquee',
      '.guide-layer',
      '.align-guides',
      '.resize-handles',
      '.edge-handles',
      '.connect-preview',
      '.edge-drag-preview',
      '.node-anchor-hints',
      '.node-header-hit',
      '.link-preview-layer'
    ]
    interactive.forEach(selector => {
      cloneNode.querySelectorAll(selector).forEach(element => element.remove())
    })
    cloneNode.querySelectorAll('[data-testid]').forEach(element => {
      element.removeAttribute('data-testid')
    })
    return cloneNode
  }

  function resolveExportSizeCm(svgElement) {
    const page = documentRef.value.content.page || { width: 1200, height: 720 }
    const viewBox = svgElement?.viewBox?.baseVal
    const ratio = viewBox && viewBox.width > 0 && viewBox.height > 0
      ? viewBox.height / viewBox.width
      : Number(page.height) / Math.max(1, Number(page.width))
    const widthCm = 10
    return { widthCm, heightCm: Math.max(2, Math.round(widthCm * Math.max(0.2, ratio) * 100) / 100) }
  }

  function resolvePdfRasterPlan(page = {}) {
    const pageWidth = Math.max(1, Number(page.width) || 1200)
    const pageHeight = Math.max(1, Number(page.height) || 720)
    const maxEdge = Math.max(pageWidth, pageHeight)
    const scale = Math.min(4, 4096 / maxEdge)
    return {
      pageWidth,
      pageHeight,
      pixelWidth: Math.max(1, Math.round(pageWidth * scale)),
      pixelHeight: Math.max(1, Math.round(pageHeight * scale)),
      pixelRatio: scale
    }
  }

  function validateExport(format) {
    if (format === 'xmind' && !isTreeMode(documentRef.value.mode)) {
      return { valid: false, message: t('editor.xmindOnly') }
    }
    if (documentRef.value.content.nodes.length > 200 && ['png', 'jpg', 'jpeg', 'xmind'].includes(format)) {
      return { valid: false, message: t('editor.tooLarge') }
    }
    return { valid: true }
  }

  function snapshotVisibleDocument() {
    const hiddenIds = new Set(isTreeMode(documentRef.value.mode)
      ? collectHiddenNodeIds(documentRef.value.content.nodes)
      : [])
    const visibleLayers = new Set(documentRef.value.content.layers
      .filter(layer => layer.visible !== false)
      .map(layer => layer.id))

    return {
      ...clone(documentRef.value),
      content: {
        ...clone(documentRef.value.content),
        nodes: clone(documentRef.value.content.nodes)
          .filter(node => visibleLayers.has(node.layerId) && !hiddenIds.has(node.id)),
        edges: clone(documentRef.value.content.edges).filter(edge => (
          visibleLayers.has(edge.layerId) &&
          !hiddenIds.has(edge.fromNodeId) &&
          !hiddenIds.has(edge.toNodeId)
        )),
        textBlocks: clone(documentRef.value.content.textBlocks).filter(block => (
          visibleLayers.has(block.layerId) &&
          !hiddenIds.has(block.nodeId)
        ))
      }
    }
  }

  async function exportPdf(svgElement, options = {}) {
    commitPendingEdit?.()
    if (!svgElement || typeof window === 'undefined') {
      errorMessage.value = t('editor.pdfUnavailable')
      return false
    }
    const exportTitle = options.title || documentRef.value.title || 'diagram'
    const page = documentRef.value.content.page || { width: 1200, height: 720 }
    try {
      const isSvgTarget = typeof SVGElement !== 'undefined' && svgElement instanceof SVGElement
      const exporter = isSvgTarget ? exportSvgElementAsImage : exportHtmlElementAsImage
      const raster = resolvePdfRasterPlan(page)
      const imageResult = await exporter(svgElement, {
        format: 'png',
        fileName: `${exportTitle}.png`,
        width: raster.pixelWidth,
        height: raster.pixelHeight,
        logicalWidth: raster.pageWidth,
        logicalHeight: raster.pageHeight,
        dpi: Math.round(96 * raster.pixelRatio)
      })
      const dataUrl = await blobToDataUrl(imageResult.blob)
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({
        orientation: raster.pageWidth >= raster.pageHeight ? 'landscape' : 'portrait',
        unit: 'px',
        format: [raster.pageWidth, raster.pageHeight],
        hotfixes: ['px_scaling']
      })
      pdf.setProperties({ title: exportTitle, creator: 'Process' })
      pdf.addImage(dataUrl, 'PNG', 0, 0, raster.pageWidth, raster.pageHeight, undefined, 'FAST')
      triggerDownload(pdf.output('blob'), `${exportTitle}.pdf`)
      statusMessage.value = t('editor.exportReady', { format: 'PDF' })
      return true
    } catch (error) {
      errorMessage.value = error.message || t('editor.exportFailed')
      return false
    }
  }

  function printDocument(svgElement, options = {}) {
    commitPendingEdit?.()
    if (!svgElement || typeof window === 'undefined') {
      errorMessage.value = t('editor.pdfUnavailable')
      return false
    }
    const exportTitle = options.title || documentRef.value.title || 'diagram'
    const page = documentRef.value.content.page || { width: 1200, height: 720 }
    const cloneNode = createExportSvgClone(svgElement)
    const markup = new XMLSerializer().serializeToString(cloneNode)
    const popup = window.open('', '_blank')
    if (!popup) {
      errorMessage.value = t('editor.pdfBlocked')
      return false
    }

    const appStyles = typeof document === 'undefined'
      ? ''
      : [...document.querySelectorAll('style')].map(style => style.textContent || '').join('\n')

    popup.document.write([
      '<!doctype html><html><head><meta charset="utf-8">',
      `<title>${escapeHtml(exportTitle)}</title>`,
      '<style>',
      appStyles,
      '@page { size: ' + page.width + 'px ' + page.height + 'px; margin: 0; }',
      'html, body { margin: 0; padding: 0; background: #fff; }',
      'body { font-family: system-ui, sans-serif; }',
      '.toolbar { display: flex; gap: 8px; align-items: center; padding: 10px 14px; border-bottom: 1px solid #e4e4e7; }',
      '.toolbar-actions { display: flex; gap: 8px; align-items: center; }',
      '.toolbar button { height: 30px; padding: 0 12px; border: 1px solid #18181b; border-radius: 6px; background: #18181b; color: #fafafa; font-size: 13px; cursor: pointer; }',
      '.toolbar span { color: #71717a; font-size: 12px; }',
      `svg { width: ${page.width}px; height: ${page.height}px; display: block; }`,
      '@media print { .toolbar { display: none; } }',
      '</style></head><body>',
      '<div class="toolbar">',
      '<div class="toolbar-actions">',
      '<button id="do-print" type="button">打印</button>',
      '<button id="do-export-pdf" type="button">PDF</button>',
      '</div>',
      `<span>${escapeHtml(exportTitle)} · ${page.width} × ${page.height} px</span>`,
      '</div>',
      markup,
      '</body></html>'
    ].join(''))
    popup.document.close()
    popup.__exportCurrentPdf = async () => {
      const exported = await exportPdf(svgElement, { title: exportTitle })
      if (exported) {
        popup.close()
      }
    }
    popup.document.getElementById('do-print')?.addEventListener('click', () => popup.print())
    popup.document.getElementById('do-export-pdf')?.addEventListener('click', () => {
      void popup.__exportCurrentPdf?.()
    })
    popup.opener = null
    popup.focus()
    statusMessage.value = t('editor.pdfOpened')
    if (options.autoPrint) {
      popup.setTimeout(() => popup.print(), 120)
    }
    return true
  }

  async function exportDocument(format, svgElement, options = {}) {
    commitPendingEdit?.()
    const validation = validateExport(format)
    if (!validation.valid) {
      errorMessage.value = validation.message
      return false
    }
    const baseName = options.baseName || documentRef.value.title || 'diagram'

    try {
      if (format === 'xmind') {
        const { exportXMindDocument } = await import('../exporters/xmindExporter')
        const exportResult = await exportXMindDocument(snapshotVisibleDocument(), `${documentRef.value.title || 'diagram'}.xmind`)
        triggerDownload(exportResult.blob, exportResult.fileName)
        statusMessage.value = t('editor.xmindReady')
        return true
      }

      if (format === 'svg') {
        const markup = new XMLSerializer().serializeToString(createExportSvgClone(svgElement))
        triggerDownload(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }), `${baseName}.svg`)
        statusMessage.value = t('editor.exportReady', { format: 'SVG' })
        return true
      }

      if (format === 'markdown') {
        triggerDownload(
          new Blob([buildOutlineText(documentRef.value)], { type: 'text/markdown;charset=utf-8' }),
          `${baseName}.md`
        )
        statusMessage.value = t('editor.exportReady', { format: 'Markdown' })
        return true
      }

      if (format === 'opml') {
        triggerDownload(
          new Blob([buildOpmlText(documentRef.value)], { type: 'text/x-opml;charset=utf-8' }),
          `${baseName}.opml`
        )
        statusMessage.value = t('editor.exportReady', { format: 'OPML' })
        return true
      }

      const isSvgTarget = typeof SVGElement !== 'undefined' && svgElement instanceof SVGElement
      const exporter = isSvgTarget ? exportSvgElementAsImage : exportHtmlElementAsImage
      const exportResult = await exporter(svgElement, {
        format,
        fileName: `${baseName}.${format === 'jpeg' ? 'jpg' : format}`,
        ...resolveExportSizeCm(svgElement),
        dpi: 300
      })
      triggerDownload(exportResult.blob, exportResult.fileName)
      statusMessage.value = t('editor.exportReady', { format: format.toUpperCase() })
      return true
    } catch (error) {
      errorMessage.value = error.message || t('editor.exportFailed')
      return false
    }
  }

  return {
    exportPdf,
    printDocument,
    exportDocument
  }
}
