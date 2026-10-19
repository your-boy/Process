import { computed, onBeforeUnmount, shallowRef, watch } from 'vue'
import { t } from '../../i18n'
import { createHistory } from '../commands/history'
import {
  applyPageDataToContent,
  clonePageData,
  createDocument,
  createEmptyPage,
  defaultTitleForMode,
  getPageById,
  nextPageId,
  normalizeDocument,
  validateDocument
} from '../model/document'
import { createFlowchartDocument, createFlowchartEdge, createFlowchartNode } from '../modes/flowchart'
import {
  buildMindmapTree,
  collectHiddenNodeIds,
  collectSubtreeIds,
  createMindmapDocument,
  createMindmapNode,
  findRootNode,
  syncMindmapEdges
} from '../modes/mindmap'
import {
  MINDMAP_STYLE_PRESETS,
  MINDMAP_THEMES,
  normalizeAssignee,
  normalizeAttachments,
  normalizeIsoDate,
  normalizeLabels,
  normalizeMarkers,
  normalizeMindmapLayout,
  normalizeNote,
  normalizePriority,
  normalizeProgress
} from '../model/mindmapMeta'
import { createMarkdownDocument, parseMarkdownToBlocks } from '../modes/markdown'
import { createMindNoteDocument } from '../modes/mindNote'
import { createMindmapTemplateDocument, isMindmapTemplate } from '../modes/mindmapTemplates'
import { createMindNoteTemplateDocument, isMindNoteTemplate } from '../modes/mindNoteTemplates'
import { createApprovalTemplateDocument } from '../modes/templateApproval'
import { createFlowTemplateDocument } from '../modes/templateFlowchart'
import { createLaneTemplateDocument } from '../modes/templateLane'
import { createOrgTemplateDocument } from '../modes/templateOrg'
import { createTimelineTemplateDocument } from '../modes/templateTimeline'
import { exportDrawioDocument, importDrawioDocument } from '../services/drawioCodec'
import {
  createReorderLayerCommand,
  createToggleLayerLockCommand,
  createToggleLayerVisibilityCommand
} from '../commands/layerCommands'
import { exportHtmlElementAsImage, exportSvgElementAsImage, triggerDownload } from '../exporters/imageExporter'
import { buildOpmlText, buildOutlineText } from '../exporters/outlineExporter'
import { calculateP95, layoutMindmap } from '../render/mindmapLayout'
import {
  createMindNoteTextBlock,
  formatMindNoteBlock,
  updateMindNoteBlockHtml,
  updateMindNoteBlockText
} from '../render/textBlockLayer'
import { indentNoteBlock, outdentNoteBlock } from '../render/noteBlockOps'

const DRAFT_KEY_PREFIX = 'diagram-editor:draft:'

// 后台自动保存的节奏：编辑后 1.5s 触发；失败后按 3s → 6s → 12s → 24s → 30s 退避重试，
// 只在“真的连不上后端”时生效，且不弹错误提示（避免每改一下就弹一次红条）。
const AUTO_SAVE_DELAY_MS = 1500
const AUTO_SAVE_RETRY_BASE_MS = 3000
const AUTO_SAVE_RETRY_MAX_MS = 30000
const AUTO_SAVE_ELIGIBLE_STATES = new Set(['本地草稿已更新', '保存失败，已保留本地草稿'])

export function useEditorState({ api, sessionState }) {
  const history = createHistory()
  const documentRef = shallowRef(createDocument())
  const loadId = shallowRef('')
  const activeNodeId = shallowRef(null)
  const saveState = shallowRef('未保存')
  const statusMessage = shallowRef('请先登录，然后创建或加载文档。')
  const errorMessage = shallowRef('')
  // errorMessage 内容不变时 watch 不会触发，导致「连点两次保存」只弹一次提示；
  // 用递增的 token 保证每次主动报错都能反馈到 UI。
  const errorToken = shallowRef(0)
  const isSaving = shallowRef(false)
  const currentDocumentLock = shallowRef(null)
  const activeTool = shallowRef('select')
  const performanceSamples = shallowRef([])
  const activeTextBlockId = shallowRef(null)
  const activeEdgeId = shallowRef(null)
  const activeSummaryId = shallowRef(null)
  let pendingMindNoteEdit = null
  const isAutoSaving = shallowRef(false)
  const manualSaveFeedbackToken = shallowRef(0)
  // idle / syncing / offline：用于在工具栏展示「未同步，重试中」，替代后台保存报错弹窗
  const syncState = shallowRef('idle')

  let autosaveTimer = null
  let autosaveRetryDelay = 0
  let draftPersistTimer = null
  let pendingDraft = null

  const flushPendingDraft = () => {
    if (!pendingDraft) {
      return
    }
    if (draftPersistTimer) {
      window.clearTimeout(draftPersistTimer)
      draftPersistTimer = null
    }
    const snapshot = pendingDraft
    pendingDraft = null
    persistDraft(snapshot)
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', flushPendingDraft)
    window.addEventListener('online', handleBrowserOnline)
  }

  function handleBrowserOnline() {
    retryAutoSaveNow()
  }

  onBeforeUnmount(() => {
    clearAutoSaveTimer()
    commitPendingMindNoteEdit()
    flushPendingDraft()
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', flushPendingDraft)
      window.removeEventListener('online', handleBrowserOnline)
    }
  })

  watch(documentRef, documentValue => {
    pendingDraft = documentValue
    if (draftPersistTimer) {
      window.clearTimeout(draftPersistTimer)
    }
    draftPersistTimer = window.setTimeout(() => {
      draftPersistTimer = null
      const snapshot = pendingDraft
      pendingDraft = null
      persistDraft(snapshot)
    }, 250)
    scheduleAutoSave(documentValue)
  }, { deep: true })

  function bootstrapForUser(user) {
    if (!user) {
      return
    }

    const draft = readDraft(user.userId)
    if (draft) {
      documentRef.value = normalizeDocument(draft)
      hydrateModeState(documentRef.value)
      activeNodeId.value = documentRef.value.content.nodes[0]?.id || null
      activeTextBlockId.value = documentRef.value.content.textBlocks[0]?.id || null
      activeEdgeId.value = null
      statusMessage.value = t('editor.draftRestored')
      lockDocument(documentRef.value.id)
      return
    }

    startNewDocument({ mode: 'flowchart' })
  }

  function resetForLogout() {
    clearAutoSaveTimer()
    unlockCurrentDocument()
    history.clear()
    documentRef.value = createDocument()
    activeNodeId.value = null
    loadId.value = ''
    saveState.value = '未保存'
    statusMessage.value = '请先登录，然后创建或加载文档。'
    errorMessage.value = ''
    activeTool.value = 'select'
    performanceSamples.value = []
    activeTextBlockId.value = null
    activeEdgeId.value = null
    syncState.value = 'idle'
    autosaveRetryDelay = 0
  }

  function openDocumentSnapshot(snapshot) {
    if (!snapshot) {
      return
    }

    clearAutoSaveTimer()
    history.clear()
    pendingMindNoteEdit = null
    documentRef.value = normalizeDocument(clone(snapshot))
    hydrateModeState(documentRef.value)
    activeNodeId.value = documentRef.value.content.nodes[0]?.id || null
    activeTextBlockId.value = documentRef.value.content.textBlocks[0]?.id || null
    activeEdgeId.value = null
    activeTool.value = 'select'
    errorMessage.value = ''
    statusMessage.value = t('editor.canvasReady')
  }

  function startNewDocument({ mode = 'flowchart', title } = {}) {
    clearAutoSaveTimer()
    unlockCurrentDocument()
    history.clear()
    pendingMindNoteEdit = null

    if (mode === 'flowchart') {
      documentRef.value = normalizeDocument(createFlowchartDocument())
    } else if (mode === 'mindmap') {
      documentRef.value = normalizeDocument(createMindmapDocument())
    } else if (mode === 'mind-note') {
      documentRef.value = normalizeDocument(createMindNoteDocument())
    } else if (mode === 'template-flow') {
      documentRef.value = normalizeDocument(createFlowTemplateDocument())
    } else if (mode === 'template-approval') {
      documentRef.value = normalizeDocument(createApprovalTemplateDocument())
    } else if (mode === 'template-lane') {
      documentRef.value = normalizeDocument(createLaneTemplateDocument())
    } else if (mode === 'template-org') {
      documentRef.value = normalizeDocument(createOrgTemplateDocument())
    } else if (mode === 'template-timeline') {
      documentRef.value = normalizeDocument(createTimelineTemplateDocument())
    } else if (isMindmapTemplate(mode)) {
      documentRef.value = normalizeDocument(createMindmapTemplateDocument(mode))
    } else if (isMindNoteTemplate(mode)) {
      documentRef.value = normalizeDocument(createMindNoteTemplateDocument(mode))
    } else if (mode === 'markdown') {
      documentRef.value = normalizeDocument(createMarkdownDocument())
    } else {
      documentRef.value = normalizeDocument(createDocument({
        mode,
        title: title || defaultTitleForMode(mode)
      }))
    }

    if (title) {
      documentRef.value.title = title
    }
    hydrateModeState(documentRef.value)
    activeNodeId.value = documentRef.value.content.nodes[0]?.id || null
    activeTextBlockId.value = documentRef.value.content.textBlocks[0]?.id || null
    activeTool.value = 'select'
    saveState.value = '仅保存在本地草稿'
    statusMessage.value = t('editor.newReady')
    errorMessage.value = ''
    syncState.value = 'idle'
    autosaveRetryDelay = 0
  }

  function updateTitle(title) {
    commitMutation('更新标题', draft => {
      draft.title = title
    })
  }

  function setMode(mode) {
    commitMutation('切换模式', draft => {
      draft.mode = mode
      if (!draft.title || draft.title.startsWith('未命名')) {
        draft.title = defaultTitleForMode(mode)
      }
      if (mode === 'mindmap') {
        draft.content = createMindmapDocument().content
      } else if (mode === 'mind-note') {
        draft.content = createMindNoteDocument().content
      } else if (mode === 'markdown') {
        draft.content = createMarkdownDocument().content
      }
    })
  }

  function addNode(kind = 'process', position = null) {
    if (isTreeMode(documentRef.value.mode)) {
      addMindmapBranch(activeNodeId.value)
      return
    }

    const nextIndex = documentRef.value.content.nodes.length
    const nodeId = `node-${nextIndex}`
    commitMutation('添加节点', draft => {
      const node = createFlowchartNode(kind, nextIndex, position || {})
      const labelKey = {
        process: 'editor.shapeProcess',
        roundrect: 'editor.shapeRoundrect',
        ellipse: 'editor.shapeEllipse',
        triangle: 'editor.shapeTriangle',
        decision: 'editor.shapeDecision',
        terminator: 'editor.shapeTerminator',
        hexagon: 'editor.shapeHexagon',
        parallelogram: 'editor.shapeParallelogram',
        document: 'editor.shapeDocument',
        cylinder: 'editor.shapeCylinder',
        cloud: 'editor.shapeCloud',
        note: 'editor.shapeNote',
        container: 'editor.shapeContainer',
        swimlane: 'editor.shapeSwimlane',
        umlclass: 'editor.shapeUmlclass',
        card: 'editor.shapeCard',
        delay: 'editor.shapeDelay',
        arrow: 'editor.shapeArrow',
        cross: 'editor.shapeCross',
        actor: 'editor.shapeActor'
      }[kind]
      if (labelKey) {
        node.text = `${t(labelKey)} ${nextIndex + 1}`
      }
      draft.content.nodes.push(node)
    })
    activeNodeId.value = nodeId
    activeTextBlockId.value = null
  }

  function addMindmapBranch(parentId = null) {
    const nextIndex = documentRef.value.content.nodes.length + 1
    const nextNodeId = `topic-${nextIndex}`
    commitMutation('添加思维导图分支', draft => {
      const root = findRootNode(draft.content.nodes)
      const parentNode = draft.content.nodes.find(node => node.id === parentId)
      const targetParentId = parentId || root?.id
      const isFloatingParent = parentNode?.floating === true

      draft.content.nodes.push(createMindmapNode({
        id: nextNodeId,
        parentId: targetParentId,
        text: targetParentId === root?.id ? `一级分支 ${nextIndex - 1}` : `子分支 ${nextIndex - 1}`,
        // 浮动主题的子节点不参与树布局，必须自带坐标，否则会「创建成功但看不见」
        ...(isFloatingParent
          ? {
            floating: true,
            x: Number(parentNode.x || 0) + Number(parentNode.width || 160) + 40,
            y: Number(parentNode.y || 0) + 20
          }
          : {})
      }))

      // 父链上如果有折叠节点，展开它，保证新节点立刻可见
      let cursor = parentNode
      while (cursor) {
        if (cursor.collapsed) {
          cursor.collapsed = false
        }
        cursor = cursor.parentId
          ? draft.content.nodes.find(node => node.id === cursor.parentId)
          : null
      }
    })
    activeNodeId.value = nextNodeId
    activeTextBlockId.value = null
  }

  function addMindmapChildBranch(parentId = activeNodeId.value) {
    addMindmapBranch(parentId)
  }

  function selectNode(nodeId) {
    commitPendingMindNoteEdit()
    activeNodeId.value = nodeId
    activeTextBlockId.value = null
    activeEdgeId.value = null
    activeSummaryId.value = null
  }

  function selectTextBlock(blockId) {
    if (blockId === activeTextBlockId.value) {
      return
    }
    commitPendingMindNoteEdit()
    activeTextBlockId.value = blockId
    activeNodeId.value = documentRef.value.content.textBlocks.find(block => block.id === blockId)?.nodeId || activeNodeId.value
    activeEdgeId.value = null
    activeSummaryId.value = null
  }

  function selectEdge(edgeId) {
    commitPendingMindNoteEdit()
    activeEdgeId.value = edgeId
    activeNodeId.value = null
    activeTextBlockId.value = null
    activeSummaryId.value = null
  }

  function clearSelection() {
    commitPendingMindNoteEdit()
    activeNodeId.value = null
    activeTextBlockId.value = null
    activeEdgeId.value = null
    activeSummaryId.value = null
  }

  let resizeSnapshot = null

  function exportDrawio() {
    try {
      commitPendingMindNoteEdit()
      const content = exportDrawioDocument(documentRef.value)
      const fileName = `${documentRef.value.title || 'diagram'}.drawio`
      const blob = new Blob([content], { type: 'application/xml' })
      triggerDownload(blob, fileName)
      statusMessage.value = t('editor.drawioExported')
      return true
    } catch (error) {
      errorMessage.value = String(error?.message || error)
      return false
    }
  }

  function importDrawio(xmlText) {
    try {
      const parsed = importDrawioDocument(xmlText)
      const sourcePages = parsed.pages?.length ? parsed.pages : [{
        id: 'page-1',
        name: t('editor.pageDefault', { n: 1 }),
        ...parsed
      }]
      const totalImportedNodes = sourcePages.reduce((sum, page) => sum + (page.nodes?.length || 0), 0)
      if (sourcePages.length > 100 || totalImportedNodes > 20000) {
        throw new Error(t('editor.importTooManyShapes'))
      }
      const importedPages = sourcePages.map((page, index) => ({
        id: page.id || `page-${index + 1}`,
        name: page.name || t('editor.pageDefault', { n: index + 1 }),
        viewport: { x: 0, y: 0, zoom: 1 },
        page: page.page,
        layers: page.layers,
        nodes: page.nodes,
        edges: page.edges,
        textBlocks: page.textBlocks || [],
        guides: [],
        showGrid: page.showGrid !== false,
        sourceText: ''
      }))

      commitMutation('导入 .drawio', draft => {
        draft.mode = sourcePages[0]?.mode || 'flowchart'
        draft.content.pages = importedPages
        draft.content.activePageId = importedPages[0].id
        applyPageDataToContent(draft.content, importedPages[0])
      })

      activeNodeId.value = importedPages[0].nodes[0]?.id || null
      activeEdgeId.value = null
      activeTextBlockId.value = null
      statusMessage.value = t('editor.imported', {
        pages: importedPages.length,
        nodes: importedPages.reduce((sum, page) => sum + page.nodes.length, 0),
        edges: importedPages.reduce((sum, page) => sum + page.edges.length, 0),
        layers: importedPages[0].layers.length
      })
      return {
        ok: true,
        pages: importedPages.length,
        nodes: importedPages[0].nodes.length,
        edges: importedPages[0].edges.length,
        layers: importedPages[0].layers.length,
        page: importedPages[0].page
      }
    } catch (error) {
      errorMessage.value = String(error?.message || error)
      return { ok: false, message: String(error?.message || error) }
    }
  }

  function getContainerChildren(containerId) {
    return documentRef.value.content.nodes
      .filter(node => node.containerId === containerId)
      .map(node => node.id)
  }

  function setNodeContainer(nodeId, containerId) {
    if (!nodeId) {
      return
    }

    commitMutation('调整容器归属', draft => {
      const node = draft.content.nodes.find(item => item.id === nodeId)
      if (!node) {
        return
      }
      if (containerId) {
        node.containerId = containerId
      } else {
        delete node.containerId
      }
    })
  }

  function updateNodeRect(nodeId, patch) {
    if (!nodeId || !patch) {
      return
    }

    commitMutation('修改节点属性', draft => {
      const node = draft.content.nodes.find(item => item.id === nodeId)
      if (!node) {
        return
      }
      ;['x', 'y', 'width', 'height'].forEach(key => {
        const value = Number(patch[key])
        if (Number.isFinite(value)) {
          node[key] = key === 'width' || key === 'height' ? Math.max(40, value) : value
        }
      })
      if (patch.rotation !== undefined) {
        const rotation = Number(patch.rotation)
        if (Number.isFinite(rotation)) {
          node.rotation = ((rotation % 360) + 360) % 360
        }
      }
      if (typeof patch.text === 'string') {
        node.text = patch.text
      }
    })
  }

  function updateNodeMetadata(nodeId, patch = {}) {
    if (!nodeId || !patch || typeof patch !== 'object') {
      return false
    }
    if (patch.image !== undefined && String(patch.image || '').length > 3_000_000) {
      errorMessage.value = t('node.imageSizeError')
      return false
    }

    commitMutation('修改节点附加信息', draft => {
      const node = draft.content.nodes.find(item => item.id === nodeId)
      if (!node) {
        return
      }
      if (patch.image !== undefined) {
        node.image = String(patch.image || '')
      }
      if (patch.link !== undefined) {
        node.link = String(patch.link || '').trim().slice(0, 2048)
      }
      if (patch.tooltip !== undefined) {
        node.tooltip = String(patch.tooltip || '').trim().slice(0, 500)
      }
    })
    return true
  }

  function addPage(name = '') {
    const mode = documentRef.value.mode
    const pages = documentRef.value.content.pages || []
    const pageId = nextPageId(new Set(pages.map(page => page.id)))
    const pageNumber = pages.length + 1
    const page = createEmptyPage({
      id: pageId,
      name: String(name || '').trim() || t('editor.pageDefault', { n: pageNumber }),
      mode
    })

    commitMutation('新增页面', draft => {
      const active = getPageById(draft.content, draft.content.activePageId)
      if (active) {
        Object.assign(active, clonePageData(draft.content))
      }
      draft.content.pages = [...(draft.content.pages || []), page]
      draft.content.activePageId = page.id
      applyPageDataToContent(draft.content, page)
    })

    activeNodeId.value = null
    activeEdgeId.value = null
    activeTextBlockId.value = null
    return page.id
  }

  function selectPage(pageId) {
    if (!pageId || pageId === documentRef.value.content.activePageId) {
      return false
    }
    const target = getPageById(documentRef.value.content, pageId)
    if (!target) {
      return false
    }

    commitMutation('切换页面', draft => {
      const active = getPageById(draft.content, draft.content.activePageId)
      if (active) {
        Object.assign(active, clonePageData(draft.content))
      }
      draft.content.activePageId = pageId
      applyPageDataToContent(draft.content, target)
    })

    activeNodeId.value = documentRef.value.content.nodes[0]?.id || null
    activeEdgeId.value = null
    activeTextBlockId.value = null
    nextTickPageRefresh()
    return true
  }

  function renamePage(pageId, name) {
    const nextName = String(name || '').trim()
    if (!pageId || !nextName) {
      return false
    }
    commitMutation('重命名页面', draft => {
      const page = getPageById(draft.content, pageId)
      if (page) {
        page.name = nextName
      }
    })
    return true
  }

  function deletePage(pageId) {
    const pages = documentRef.value.content.pages || []
    if (!pageId || pages.length <= 1) {
      return false
    }
    const index = pages.findIndex(page => page.id === pageId)
    if (index === -1) {
      return false
    }
    const nextPage = pages[index + 1] || pages[index - 1]
    const wasActive = documentRef.value.content.activePageId === pageId

    commitMutation('删除页面', draft => {
      const active = getPageById(draft.content, draft.content.activePageId)
      if (active) {
        Object.assign(active, clonePageData(draft.content))
      }
      draft.content.pages = draft.content.pages.filter(page => page.id !== pageId)
      if (draft.content.activePageId === pageId) {
        draft.content.activePageId = nextPage.id
        applyPageDataToContent(draft.content, nextPage)
      }
    })

    if (wasActive) {
      activeNodeId.value = documentRef.value.content.nodes[0]?.id || null
      activeEdgeId.value = null
      activeTextBlockId.value = null
      nextTickPageRefresh()
    }
    return true
  }

  function nextTickPageRefresh() {
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'))
      })
    }
  }

  function setGuides(guides) {
    const normalized = (Array.isArray(guides) ? guides : [])
      .filter(guide => guide && (guide.axis === 'vertical' || guide.axis === 'horizontal'))
      .map(guide => ({ axis: guide.axis, pos: Math.round(Number(guide.pos) || 0) }))

    commitMutation('调整参考线', draft => {
      draft.content.guides = normalized
    })
  }

  function setGridVisible(visible) {
    commitMutation(visible ? '显示网格' : '隐藏网格', draft => {
      draft.content.showGrid = Boolean(visible)
    })
  }

  function setPageSize(width, height) {
    const nextWidth = Math.max(320, Math.round(Number(width) || 0))
    const nextHeight = Math.max(240, Math.round(Number(height) || 0))

    commitMutation('调整画布尺寸', draft => {
      draft.content.page = {
        width: nextWidth,
        height: nextHeight
      }
    })
  }

  let nodeClipboard = null

  function copyNodes(nodeIds = []) {
    const ids = new Set((nodeIds || []).filter(Boolean))
    if (!ids.size) {
      return 0
    }

    const nodes = documentRef.value.content.nodes.filter(node => ids.has(node.id))
    if (!nodes.length) {
      return 0
    }

    const edges = documentRef.value.content.edges.filter(edge => ids.has(edge.fromNodeId) && ids.has(edge.toNodeId))
    nodeClipboard = {
      nodes: clone(nodes),
      edges: clone(edges)
    }
    return nodes.length
  }

  function pasteNodes({ offsetX = 24, offsetY = 24 } = {}) {
    if (!nodeClipboard || !nodeClipboard.nodes.length) {
      return []
    }

    const stamp = Date.now().toString(36)
    const idMap = new Map()
    const nextNodes = nodeClipboard.nodes.map((node, index) => {
      const newId = `node-${stamp}-${index}`
      idMap.set(node.id, newId)
      return {
        ...clone(node),
        id: newId,
        x: node.x + offsetX,
        y: node.y + offsetY,
        containerId: undefined
      }
    })

    const nextEdges = nodeClipboard.edges.map((edge, index) => ({
      ...clone(edge),
      id: `edge-${stamp}-${index}`,
      fromNodeId: idMap.get(edge.fromNodeId),
      toNodeId: idMap.get(edge.toNodeId)
    }))

    commitMutation('\u7c98\u8d34\u8282\u70b9', draft => {
      draft.content.nodes.push(...nextNodes)
      draft.content.edges.push(...nextEdges)
    })

    return nextNodes.map(node => node.id)
  }

  function removeNodes(nodeIds = []) {
    const selectedIds = new Set((nodeIds || []).filter(Boolean))
    if (!selectedIds.size) {
      return 0
    }

    // 思维导图里删除主题会连带删除整棵子树（与 XMind 一致）
    const ids = new Set(selectedIds)
    if (isTreeMode(documentRef.value.mode)) {
      const allNodes = documentRef.value.content.nodes
      selectedIds.forEach(nodeId => {
        collectSubtreeIds(allNodes, nodeId).forEach(id => ids.add(id))
      })
    }

    commitMutation('\u5220\u9664\u8282\u70b9', draft => {
      draft.content.nodes = draft.content.nodes.filter(node => !ids.has(node.id))
      draft.content.edges = draft.content.edges.filter(edge => !ids.has(edge.fromNodeId) && !ids.has(edge.toNodeId))
      draft.content.nodes.forEach(node => {
        if (ids.has(node.containerId)) {
          delete node.containerId
        }
      })
    })

    return ids.size
  }

  function groupNodes(nodeIds = []) {
    const ids = new Set((nodeIds || []).filter(Boolean))
    if (ids.size < 2) {
      return null
    }

    const groupId = `group-${Date.now().toString(36)}`
    commitMutation('组合图形', draft => {
      draft.content.nodes.forEach(node => {
        if (ids.has(node.id)) {
          node.groupId = groupId
        }
      })
    })
    return groupId
  }

  function ungroupNodes(nodeIds = []) {
    const ids = new Set((nodeIds || []).filter(Boolean))
    if (!ids.size) {
      return 0
    }

    let cleared = 0
    commitMutation('解散组合', draft => {
      draft.content.nodes.forEach(node => {
        if (ids.has(node.id) && node.groupId) {
          delete node.groupId
          cleared += 1
        }
      })
    })
    return cleared
  }

  // 同层内的前后顺序 = content.nodes 的数组顺序，用于「置于顶层 / 置于底层」
  function setNodesZOrder(nodeIds = [], toFront = true) {
    const ids = new Set((nodeIds || []).filter(Boolean))
    if (!ids.size) {
      return 0
    }

    const nodes = documentRef.value.content.nodes
    if (!nodes.some(node => ids.has(node.id))) {
      return 0
    }

    let moved = 0
    commitMutation(toFront ? '置于顶层' : '置于底层', draft => {
      const picking = draft.content.nodes.filter(node => ids.has(node.id))
      const rest = draft.content.nodes.filter(node => !ids.has(node.id))
      moved = picking.length
      draft.content.nodes = toFront ? [...rest, ...picking] : [...picking, ...rest]
    })
    return moved
  }

  function setNodeLocked(nodeId, locked) {
    if (!nodeId) {
      return
    }

    commitMutation(locked ? '锁定节点' : '解锁节点', draft => {
      const node = draft.content.nodes.find(item => item.id === nodeId)
      if (node) {
        node.locked = Boolean(locked)
      }
    })
  }

  function setNodePositions(entries = []) {
    if (!Array.isArray(entries) || !entries.length) {
      return
    }

    commitMutation('对齐节点', draft => {
      entries.forEach(entry => {
        const node = draft.content.nodes.find(item => item.id === entry.id)
        if (node) {
          node.x = entry.x
          node.y = entry.y
        }
      })
    })
  }

  function beginNodeResize(nodeId) {
    const node = documentRef.value.content.nodes.find(item => item.id === nodeId)
    if (!node) {
      return
    }
    resizeSnapshot = {
      nodeId,
      before: clone(documentRef.value),
      rect: { x: node.x, y: node.y, width: node.width, height: node.height },
      rotation: Number(node.rotation) || 0
    }
  }

  function previewNodeResize(rect) {
    const snapshot = resizeSnapshot
    if (!snapshot || !rect) {
      return
    }

    const node = documentRef.value.content.nodes.find(item => item.id === snapshot.nodeId)
    if (!node) {
      return
    }

    node.x = rect.x
    node.y = rect.y
    node.width = rect.width
    node.height = rect.height
    if (rect.rotation !== undefined) {
      const rotation = Number(rect.rotation)
      if (Number.isFinite(rotation)) {
        node.rotation = ((rotation % 360) + 360) % 360
      }
    }
    snapshot.rect = { ...rect }
    // shallowRef: reassign to notify the view without cloning the whole document
    documentRef.value = { ...documentRef.value }
  }

  function endNodeResize() {
    const snapshot = resizeSnapshot
    resizeSnapshot = null
    if (!snapshot) {
      return
    }

    const beforeNode = snapshot.before.content.nodes.find(item => item.id === snapshot.nodeId)
    const afterNode = documentRef.value.content.nodes.find(item => item.id === snapshot.nodeId)
    if (!beforeNode || !afterNode) {
      return
    }

    const unchanged = ['x', 'y', 'width', 'height', 'rotation'].every(key => Math.abs((beforeNode[key] || 0) - (afterNode[key] || 0)) < 0.5)
    if (unchanged) {
      documentRef.value = normalizeDocument(clone(snapshot.before))
      return
    }

    const after = normalizeDocument(clone(documentRef.value))
    history.commit({
      label: '调整节点尺寸',
      undo: () => {
        documentRef.value = normalizeDocument(clone(snapshot.before))
      },
      redo: () => {
        documentRef.value = normalizeDocument(clone(after))
      }
    }, { apply: false })
    touchDraftState()
  }

  function moveNode(nodeId, position) {
    if (isTreeMode(documentRef.value.mode)) {
      commitMutation('移动分支', draft => {
        const node = draft.content.nodes.find(item => item.id === nodeId)

        if (!node) {
          return
        }

        const deltaX = position.x - (position.initialX ?? node.x)
        const deltaY = position.y - (position.initialY ?? node.y)
        node.offsetX = (node.offsetX || 0) + deltaX
        node.offsetY = (node.offsetY || 0) + deltaY
      })
      activeNodeId.value = nodeId
      activeTextBlockId.value = null
      activeEdgeId.value = null
      return
    }

    commitMutation('移动节点', draft => {
      const node = draft.content.nodes.find(item => item.id === nodeId)

      if (!node) {
        return
      }

      node.x = position.x
      node.y = position.y
    })
  }

  function moveNodes(nodeIds, { deltaX = 0, deltaY = 0 } = {}) {
    const uniqueNodeIds = [...new Set((nodeIds || []).filter(Boolean))]
    if (!uniqueNodeIds.length || (!deltaX && !deltaY)) {
      return
    }

    commitMutation(uniqueNodeIds.length > 1 ? '移动多个节点' : (isTreeMode(documentRef.value.mode) ? '移动分支' : '移动节点'), draft => {
      const movingNodeIds = new Set(uniqueNodeIds)
      draft.content.nodes.forEach(node => {
        if (!movingNodeIds.has(node.id)) {
          return
        }

        if (isTreeMode(documentRef.value.mode)) {
          node.offsetX = (node.offsetX || 0) + deltaX
          node.offsetY = (node.offsetY || 0) + deltaY
          return
        }

        node.x += deltaX
        node.y += deltaY
      })
    }, { captureMindmapPerformance: isTreeMode(documentRef.value.mode) })

    activeNodeId.value = uniqueNodeIds[0]
    activeTextBlockId.value = null
    activeEdgeId.value = null
  }

  function addMindmapSiblingBranch(nodeId = activeNodeId.value) {
    const selectedNode = documentRef.value.content.nodes.find(node => node.id === nodeId)
    if (!selectedNode) {
      addMindmapBranch(activeNodeId.value)
      return
    }

    addMindmapBranch(selectedNode.parentId || selectedNode.id)
  }

  function updateNodeText(nodeId, text) {
    commitMutation('更新节点文本', draft => {
      const node = draft.content.nodes.find(item => item.id === nodeId)
      if (!node) {
        return
      }
      node.text = text.trim() || node.text
    })
  }

  function updateNodeStyle(nodeId, stylePatch) {
    if (!nodeId || !stylePatch || typeof stylePatch !== 'object') {
      return
    }

    commitMutation('更新节点样式', draft => {
      const node = draft.content.nodes.find(item => item.id === nodeId)
      if (!node) {
        return
      }

      node.style = {
        ...(node.style || {}),
        ...stylePatch
      }
    })

    activeNodeId.value = nodeId
    activeTextBlockId.value = null
    activeEdgeId.value = null
  }

  function updateActiveNodeStyle(stylePatch) {
    if (!stylePatch || typeof stylePatch !== 'object') {
      return
    }

    if (isTreeMode(documentRef.value.mode)) {
      // 选中主题时只改它自己；未选中时按「整张导图换风格」处理
      if (activeNodeId.value) {
        updateNodeStyle(activeNodeId.value, stylePatch)
        return
      }

      commitMutation('更新主题', draft => {
        draft.content.nodes = draft.content.nodes.map(node => ({
          ...node,
          style: {
            ...(node.style || {}),
            ...stylePatch
          }
        }))
      }, { captureMindmapPerformance: true })

      activeTextBlockId.value = null
      activeEdgeId.value = null
      return
    }

    updateNodeStyle(activeNodeId.value, stylePatch)
  }

  function updateMarkdownSource(sourceText) {
    commitMutation('更新 Markdown 源文本', draft => {
      draft.content.sourceText = sourceText
      draft.content.textBlocks = parseMarkdownToBlocks(sourceText)
    })
  }

  function nextMindNoteBlockOrder() {
    return (documentRef.value.content.textBlocks || [])
      .reduce((max, block) => Math.max(max, Number(block.order) || 0), 0) + 1
  }

  function addMindNoteTextBlock(nodeId = activeNodeId.value) {
    if ((documentRef.value.mode !== 'mindmap' && documentRef.value.mode !== 'mind-note') || !nodeId) {
      return
    }

    commitPendingMindNoteEdit()
    const block = createMindNoteTextBlock({
      nodeId,
      order: nextMindNoteBlockOrder(),
      html: '<p></p>',
      text: ''
    })
    commitMutation('添加思维笔记文本块', draft => {
      draft.content.textBlocks.push(block)
    })
    activeTextBlockId.value = block.id
    activeNodeId.value = nodeId
    activeEdgeId.value = null
  }

  function syncActivePageTextBlock(blockId, html, text) {
    const content = documentRef.value.content
    const activePage = (content.pages || []).find(page => page.id === content.activePageId)
    const pageBlock = activePage?.textBlocks?.find(block => block.id === blockId)
    if (pageBlock) {
      pageBlock.html = html
      pageBlock.text = text
      pageBlock.format = 'rich'
    }
  }

  function beginMindNoteBlockEdit(blockId) {
    if (!blockId) {
      return
    }
    if (pendingMindNoteEdit?.blockId === blockId) {
      return
    }
    commitPendingMindNoteEdit()
    pendingMindNoteEdit = {
      blockId,
      before: clone(documentRef.value)
    }
  }

  // 编辑器输入时只做轻量更新，不进入历史栈；失焦时合并成一条撤销记录。
  function applyMindNoteBlockContent(blockId, payload = {}) {
    if (!blockId || typeof payload.html !== 'string') {
      return
    }
    const current = documentRef.value
    const block = current.content.textBlocks.find(item => item.id === blockId)
    if (!block) {
      return
    }
    if (!pendingMindNoteEdit || pendingMindNoteEdit.blockId !== blockId) {
      pendingMindNoteEdit = {
        blockId,
        before: clone(current)
      }
    }

    const next = updateMindNoteBlockHtml(block, payload.html, payload.text)
    block.html = next.html
    block.text = next.text
    block.format = 'rich'
    syncActivePageTextBlock(blockId, next.html, next.text)
    current.content.meta.revision = (current.content.meta?.revision || 0) + 1
    documentRef.value = {
      ...current,
      content: {
        ...current.content
      }
    }
    touchDraftState()
  }

  function commitMindNoteBlockEdit(blockId) {
    if (!pendingMindNoteEdit) {
      return
    }
    if (blockId && pendingMindNoteEdit.blockId !== blockId) {
      return
    }

    const pending = pendingMindNoteEdit
    pendingMindNoteEdit = null
    const beforeBlock = pending.before.content.textBlocks.find(block => block.id === pending.blockId)
    const afterBlock = documentRef.value.content.textBlocks.find(block => block.id === pending.blockId)
    if (!beforeBlock || !afterBlock) {
      return
    }
    if (String(beforeBlock.html || '') === String(afterBlock.html || '') &&
        String(beforeBlock.text || '') === String(afterBlock.text || '')) {
      return
    }

    const before = pending.before
    const after = clone(documentRef.value)
    history.commit({
      label: '编辑思维笔记',
      undo: () => {
        documentRef.value = normalizeDocument(clone(before))
      },
      redo: () => {
        documentRef.value = normalizeDocument(clone(after))
      }
    }, { apply: false })
  }

  function commitPendingMindNoteEdit() {
    if (pendingMindNoteEdit) {
      commitMindNoteBlockEdit(pendingMindNoteEdit.blockId)
    }
  }

  function removeMindNoteTextBlock(blockId) {
    if (!blockId) {
      return
    }
    commitPendingMindNoteEdit()
    commitMutation('删除思维笔记文本块', draft => {
      draft.content.textBlocks = draft.content.textBlocks.filter(block => block.id !== blockId)
    })
    if (activeTextBlockId.value === blockId) {
      activeTextBlockId.value = documentRef.value.content.textBlocks[0]?.id || null
    }
  }

  // 块嵌套：Tab 缩进为上一个兄弟块的子块，Shift+Tab 升到祖父级
  function indentMindNoteTextBlock(blockId = activeTextBlockId.value) {
    if (!blockId) {
      return false
    }
    commitPendingMindNoteEdit()
    let changed = false
    commitMutation('缩进文本块', draft => {
      const next = indentNoteBlock(draft.content.textBlocks, blockId)
      if (next) {
        draft.content.textBlocks = next
        changed = true
      }
    })
    return changed
  }

  function outdentMindNoteTextBlock(blockId = activeTextBlockId.value) {
    if (!blockId) {
      return false
    }
    commitPendingMindNoteEdit()
    let changed = false
    commitMutation('取消缩进文本块', draft => {
      const next = outdentNoteBlock(draft.content.textBlocks, blockId)
      if (next) {
        draft.content.textBlocks = next
        changed = true
      }
    })
    return changed
  }

  // 兼容旧调用：整段文本更新仍然可用，但新 UI 走 applyMindNoteBlockContent。
  function updateMindNoteTextBlock(blockId, text) {
    const block = documentRef.value.content.textBlocks.find(item => item.id === blockId)
    if (!block) {
      return
    }
    beginMindNoteBlockEdit(blockId)
    const next = updateMindNoteBlockText(block, text)
    applyMindNoteBlockContent(blockId, { html: next.html, text: next.text })
    commitMindNoteBlockEdit(blockId)
  }

  function moveMindNoteTextBlock(blockId, { deltaX = 0, deltaY = 0 } = {}) {
    if (!blockId || (!deltaX && !deltaY)) {
      return
    }

    commitPendingMindNoteEdit()
    commitMutation('移动思维笔记文本块', draft => {
      const block = draft.content.textBlocks.find(item => item.id === blockId)
      if (!block) {
        return
      }

      block.offsetX = (Number.isFinite(block.offsetX) ? block.offsetX : 0) + deltaX
      block.offsetY = (Number.isFinite(block.offsetY) ? block.offsetY : 0) + deltaY
    })

    activeTextBlockId.value = blockId
    activeNodeId.value = documentRef.value.content.textBlocks.find(block => block.id === blockId)?.nodeId || activeNodeId.value
    activeEdgeId.value = null
  }

  function resizeMindNoteTextBlock(blockId, { width, height, resetHeight = false } = {}) {
    if (!blockId) {
      return
    }
    commitPendingMindNoteEdit()
    const nextWidth = Number(width)
    const nextHeight = Number(height)
    commitMutation('调整思维笔记文本块大小', draft => {
      const block = draft.content.textBlocks.find(item => item.id === blockId)
      if (!block) {
        return
      }
      if (Number.isFinite(nextWidth)) {
        block.width = Math.max(180, Math.min(720, Math.round(nextWidth)))
      }
      if (resetHeight) {
        block.height = null
      } else if (Number.isFinite(nextHeight)) {
        block.height = Math.max(80, Math.min(900, Math.round(nextHeight)))
      }
    })
    activeTextBlockId.value = blockId
  }

  function formatMindNoteTextBlock(format, blockId = activeTextBlockId.value) {
    if (!blockId) {
      return
    }

    commitPendingMindNoteEdit()
    commitMutation('格式化思维笔记文本块', draft => {
      const block = draft.content.textBlocks.find(item => item.id === blockId)
      if (!block) {
        return
      }
      Object.assign(block, formatMindNoteBlock(block, format))
    })
  }

  function updateEdgeLabel(edgeId, label) {
    commitMutation('更新连线名称', draft => {
      const edge = draft.content.edges.find(item => item.id === edgeId)
      if (!edge) {
        return
      }
      edge.label = String(label || '').trim()
    })
  }

  function updateEdgeStyle(edgeId, stylePatch) {
    if (!edgeId || !stylePatch || typeof stylePatch !== 'object') {
      return
    }

    commitMutation('更新连线样式', draft => {
      const edge = draft.content.edges.find(item => item.id === edgeId)
      if (!edge) {
        return
      }
      edge.style = {
        ...(edge.style || {}),
        ...stylePatch
      }
    })
    activeEdgeId.value = edgeId
    activeNodeId.value = null
    activeTextBlockId.value = null
  }

  function updateActiveEdgeStyle(stylePatch) {
    updateEdgeStyle(activeEdgeId.value, stylePatch)
  }

  function updateEdgeConnection(edgeId, patch) {
    if (!edgeId || !patch || typeof patch !== 'object') {
      return
    }

    commitMutation('调整连线端点', draft => {
      const edge = draft.content.edges.find(item => item.id === edgeId)
      if (!edge) {
        return
      }
      if (patch.fromNodeId) {
        edge.fromNodeId = patch.fromNodeId
      }
      if (patch.toNodeId) {
        edge.toNodeId = patch.toNodeId
      }
      if (patch.fromAnchor) {
        edge.fromAnchor = patch.fromAnchor
      }
      if (patch.toAnchor) {
        edge.toAnchor = patch.toAnchor
      }
    })
  }

  function removeSelection() {
    if (activeEdgeId.value) {
      const edgeId = activeEdgeId.value
      commitMutation('删除连线', draft => {
        draft.content.edges = draft.content.edges.filter(edge => edge.id !== edgeId)
      })
      activeEdgeId.value = null
      return true
    }

    if (activeTextBlockId.value) {
      const blockId = activeTextBlockId.value
      commitMutation('删除思维笔记文本块', draft => {
        draft.content.textBlocks = draft.content.textBlocks.filter(block => block.id !== blockId)
      })
      activeTextBlockId.value = documentRef.value.content.textBlocks.at(-1)?.id || null
      activeEdgeId.value = null
      return true
    }

    if (!activeNodeId.value) {
      return false
    }

    if (isTreeMode(documentRef.value.mode)) {
      const nodeId = activeNodeId.value
      const root = findRootNode(documentRef.value.content.nodes)
      if (nodeId === root?.id) {
        statusMessage.value = t('editor.rootDelete')
        return false
      }

      commitMutation('删除分支', draft => {
        const removableIds = collectBranchIds(draft.content.nodes, nodeId)
        draft.content.nodes = draft.content.nodes.filter(node => !removableIds.has(node.id))
        draft.content.textBlocks = draft.content.textBlocks.filter(block => !removableIds.has(block.nodeId))
      })
      activeNodeId.value = root?.id || documentRef.value.content.nodes[0]?.id || null
      activeTextBlockId.value = null
      activeEdgeId.value = null
      return true
    }

    const nodeId = activeNodeId.value
    commitMutation('删除节点', draft => {
      draft.content.nodes = draft.content.nodes.filter(node => node.id !== nodeId)
      draft.content.edges = draft.content.edges.filter(edge => edge.fromNodeId !== nodeId && edge.toNodeId !== nodeId)
      // 删容器不删子节点，只解除归属
      draft.content.nodes.forEach(node => {
        if (node.containerId === nodeId) {
          delete node.containerId
        }
      })
    })
    activeNodeId.value = documentRef.value.content.nodes.at(-1)?.id || null
    activeTextBlockId.value = null
    activeEdgeId.value = null
    return true
  }

  function addEdge(connection) {
    if (isTreeMode(documentRef.value.mode)) {
      return
    }

    commitMutation('创建连线', draft => {
      const duplicated = draft.content.edges.some(edge => (
        edge.fromNodeId === connection.fromNodeId &&
        edge.toNodeId === connection.toNodeId &&
        edge.fromAnchor === connection.fromAnchor &&
        edge.toAnchor === connection.toAnchor
      ))
      if (duplicated || connection.fromNodeId === connection.toNodeId) {
        return
      }
      draft.content.edges.push(createFlowchartEdge({
        ...connection,
        index: draft.content.edges.length
      }))
    })
    activeEdgeId.value = `edge-${documentRef.value.content.edges.length - 1}`
    activeTextBlockId.value = null
  }

  function toggleCollapse(nodeId = activeNodeId.value) {
    if (!isTreeMode(documentRef.value.mode) || !nodeId) {
      return
    }

    commitMutation('切换折叠状态', draft => {
      const node = draft.content.nodes.find(item => item.id === nodeId)
      if (!node || !node.parentId) {
        return
      }
      node.collapsed = !node.collapsed
    }, { captureMindmapPerformance: true })
  }

  function setActiveTool(tool) {
    activeTool.value = tool
    statusMessage.value = tool === 'connect' ? t('editor.connectTool') : t('editor.selectTool')
  }

  /* ---------- 思维导图节点附加信息 ---------- */

  function updateActiveNode(label, updater) {
    const nodeId = activeNodeId.value
    if (!nodeId) {
      return false
    }

    commitMutation(label, draft => {
      const node = draft.content.nodes.find(item => item.id === nodeId)
      if (node) {
        updater(node, draft)
      }
    }, { captureMindmapPerformance: true })
    return true
  }

  function toggleNodeMarker(markerId) {
    return updateActiveNode('切换节点图标', node => {
      const markers = normalizeMarkers(node.markers)
      node.markers = markers.includes(markerId)
        ? markers.filter(item => item !== markerId)
        : normalizeMarkers([...markers, markerId])
    })
  }

  // 批量打标：多选时对选中的全部主题统一添加/移除同一个图标。
  // 只要有一个还没打上，就整体按「添加」处理；全都有则整体移除。
  function toggleNodeMarkers(nodeIds = [], markerId) {
    const ids = new Set((nodeIds || []).filter(Boolean))
    if (!ids.size || !markerId) {
      return 0
    }

    const targets = documentRef.value.content.nodes.filter(node => ids.has(node.id))
    if (!targets.length) {
      return 0
    }

    const shouldAdd = !targets.every(node => normalizeMarkers(node.markers).includes(markerId))
    commitMutation('切换节点图标', draft => {
      draft.content.nodes.forEach(node => {
        if (!ids.has(node.id)) {
          return
        }
        const markers = normalizeMarkers(node.markers)
        node.markers = shouldAdd
          ? normalizeMarkers([...markers, markerId])
          : markers.filter(item => item !== markerId)
      })
    }, { captureMindmapPerformance: true })

    activeNodeId.value = targets[0].id
    return targets.length
  }

  function setNodePriority(priority) {
    return updateActiveNode('设置节点优先级', node => {
      node.priority = normalizePriority(priority)
    })
  }

  function setNodeProgress(progress) {
    return updateActiveNode('设置节点进度', node => {
      node.progress = normalizeProgress(progress)
    })
  }

  function setNodeNote(note) {
    return updateActiveNode('编辑节点备注', node => {
      node.note = normalizeNote(note)
    })
  }

  function addNodeLabel(label) {
    const value = String(label || '').trim()
    if (!value) {
      return false
    }
    return updateActiveNode('添加节点标签', node => {
      node.labels = normalizeLabels([...(node.labels || []), value])
    })
  }

  function removeNodeLabel(label) {
    return updateActiveNode('移除节点标签', node => {
      node.labels = normalizeLabels(node.labels).filter(item => item !== label)
    })
  }

  function setNodeTask(patch = {}) {
    return updateActiveNode('更新任务信息', node => {
      if (patch.start !== undefined) {
        node.taskStart = normalizeIsoDate(patch.start)
      }
      if (patch.due !== undefined) {
        node.taskDue = normalizeIsoDate(patch.due)
      }
      if (patch.assignee !== undefined) {
        node.assignee = normalizeAssignee(patch.assignee)
      }
    })
  }

  function addNodeAttachment(name, url) {
    const cleanUrl = String(url || '').trim()
    if (!/^(https?:\/\/|data:)/i.test(cleanUrl)) {
      return false
    }

    return updateActiveNode('添加附件', node => {
      node.attachments = normalizeAttachments([
        ...(node.attachments || []),
        {
          id: `att-${Date.now().toString(36)}`,
          name: String(name || '').trim() || '附件',
          url: cleanUrl
        }
      ])
    })
  }

  function removeNodeAttachment(attachmentId) {
    return updateActiveNode('移除附件', node => {
      node.attachments = normalizeAttachments(node.attachments).filter(item => item.id !== attachmentId)
    })
  }

  // 大纲拖拽：把 dragId 挂到 targetId 下（自动防止拖成自己的子孙）
  function moveTopicToNode(dragId, targetId) {
    if (!isTreeMode(documentRef.value.mode) || !dragId || !targetId || dragId === targetId) {
      return false
    }
    const nodes = documentRef.value.content.nodes
    const dragNode = nodes.find(node => node.id === dragId)
    if (!dragNode?.parentId) {
      return false
    }
    if (collectSubtreeIds(nodes, dragId).includes(targetId)) {
      return false
    }

    commitMutation('拖动调整层级', draft => {
      const node = draft.content.nodes.find(item => item.id === dragId)
      if (node) {
        node.parentId = targetId
      }
    }, { captureMindmapPerformance: true })
    return true
  }

  // 按节点 id 更新备注（演示模式里直接改当前页的备注）
  function setNodeNoteById(nodeId, note) {
    if (!nodeId) {
      return false
    }
    commitMutation('编辑节点备注', draft => {
      const node = draft.content.nodes.find(item => item.id === nodeId)
      if (node) {
        node.note = normalizeNote(note)
      }
    }, { captureMindmapPerformance: true })
    return true
  }

  // 大纲排序/层级调整：上移、下移、降级、升级
  function moveOutlineTopic(nodeId = activeNodeId.value, action) {
    if (!isTreeMode(documentRef.value.mode) || !nodeId) {
      return false
    }
    if (action === 'indent') {
      return demoteTopic(nodeId)
    }
    if (action === 'outdent') {
      return promoteTopic(nodeId)
    }
    if (action !== 'up' && action !== 'down') {
      return false
    }

    const nodes = documentRef.value.content.nodes
    const node = nodes.find(item => item.id === nodeId)
    if (!node?.parentId) {
      return false
    }

    const siblings = nodes.filter(item => item.parentId === node.parentId)
    const index = siblings.findIndex(item => item.id === nodeId)
    const targetIndex = action === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= siblings.length) {
      return false
    }
    const swapId = siblings[targetIndex].id

    commitMutation(action === 'up' ? '上移主题' : '下移主题', draft => {
      const list = draft.content.nodes
      const currentIndex = list.findIndex(item => item.id === nodeId)
      const swapIndex = list.findIndex(item => item.id === swapId)
      if (currentIndex < 0 || swapIndex < 0) {
        return
      }
      const current = list[currentIndex]
      list[currentIndex] = list[swapIndex]
      list[swapIndex] = current
    }, { captureMindmapPerformance: true })
    return true
  }

  function importedRelationshipEdges(relationships = []) {
    return relationships.map((relationship, index) => ({
      id: `relation-import-${index + 1}`,
      kind: 'relationship',
      fromNodeId: relationship.fromNodeId,
      toNodeId: relationship.toNodeId,
      fromAnchor: 'right',
      toAnchor: 'left',
      layerId: 'layer-edges',
      label: relationship.label || '',
      style: { route: 'curve', stroke: 'dashed', marker: 'arrow' }
    }))
  }

  function importedBoundaries(boundaries = []) {
    return boundaries.map((boundary, index) => ({
      id: boundary.id || `boundary-import-${index + 1}`,
      nodeId: boundary.nodeId,
      accent: 'rose'
    }))
  }

  // 用导入的大纲整体替换当前文档内容（Markdown / OPML / XMind）
  function replaceWithImportedOutline(nodes, title = '', relationships = [], boundaries = []) {
    if (!Array.isArray(nodes) || !nodes.length) {
      return false
    }

    commitMutation('导入大纲', draft => {
      draft.mode = 'mindmap'
      if (title) {
        draft.title = title
      }
      draft.content.nodes = nodes
      draft.content.edges = importedRelationshipEdges(relationships)
      draft.content.boundaries = importedBoundaries(boundaries)
      draft.content.summaries = []
      draft.content.textBlocks = []
      draft.content.guides = []
      draft.content.layout = normalizeMindmapLayout({})
    }, { captureMindmapPerformance: true })

    activeNodeId.value = documentRef.value.content.nodes[0]?.id || null
    activeTextBlockId.value = null
    activeEdgeId.value = null
    activeSummaryId.value = null
    return true
  }

  function replaceWithImportedOutlinePages(pageResults, title = '') {
    const sourcePages = (pageResults || []).filter(page => Array.isArray(page?.nodes) && page.nodes.length)
    if (!sourcePages.length) {
      return false
    }

    const baseLayers = createMindmapDocument().content.layers.map(layer => ({ ...layer }))
    const pages = sourcePages.map((result, index) => {
      const page = createEmptyPage({
        id: `page-${index + 1}`,
        name: result.sheetTitle || `页面 ${index + 1}`,
        mode: 'mindmap'
      })
      page.layers = baseLayers.map(layer => ({ ...layer }))
      page.nodes = result.nodes
      page.edges = importedRelationshipEdges(result.relationships)
      page.boundaries = importedBoundaries(result.boundaries)
      page.summaries = []
      page.textBlocks = []
      page.guides = []
      return page
    })

    commitMutation('导入 XMind 多页', draft => {
      draft.mode = 'mindmap'
      if (title) {
        draft.title = title
      }
      draft.content.pages = pages
      draft.content.activePageId = pages[0].id
      applyPageDataToContent(draft.content, pages[0])
      draft.content.layout = normalizeMindmapLayout({})
    }, { captureMindmapPerformance: true })

    activeNodeId.value = documentRef.value.content.nodes[0]?.id || null
    activeTextBlockId.value = null
    activeEdgeId.value = null
    activeSummaryId.value = null
    return true
  }

  async function importMindmapFile(file) {
    const fileName = String(file?.name || '').toLowerCase()
    if (!file) {
      return false
    }

    try {
      if (fileName.endsWith('.xmind')) {
        const [{ default: JSZip }, { xmindToPages, xmindXmlToPages }] = await Promise.all([
          import('jszip'),
          import('../services/outlineImport')
        ])
        const zip = await JSZip.loadAsync(await file.arrayBuffer())
        const xmlEntry = zip.file('content.xml') || zip.file(/content\.xml$/)[0]
        const jsonEntry = zip.file('content.json') || zip.file(/content\.json$/)[0]

        // 优先解析 XMind 8 的 content.xml（信息更全）；解析不出内容时退回 content.json
        if (xmlEntry) {
          try {
            const pages = xmindXmlToPages(await xmlEntry.async('string'))
            if (pages.length > 1) {
              return replaceWithImportedOutlinePages(pages, pages[0].title)
            }
            if (pages[0]?.nodes?.length > 1) {
              const { nodes, title, relationships, boundaries } = pages[0]
              return replaceWithImportedOutline(nodes, title, relationships, boundaries)
            }
          } catch (error) {
            // 继续尝试 content.json
          }
        }

        if (!jsonEntry) {
          throw new Error(t('editor.importXmindLegacy'))
        }
        const content = JSON.parse(await jsonEntry.async('string'))
        const pages = xmindToPages(content)
        if (pages.length > 1) {
          return replaceWithImportedOutlinePages(pages, pages[0].title)
        }
        const { nodes, title } = pages[0] || { nodes: [], title: '' }
        return replaceWithImportedOutline(nodes, title)
      }

      const text = await file.text()
      if (fileName.endsWith('.opml') || fileName.endsWith('.xml')) {
        const { opmlToNodes } = await import('../services/outlineImport')
        const { nodes, title } = opmlToNodes(text)
        return replaceWithImportedOutline(nodes, title)
      }

      const { markdownToNodes } = await import('../services/outlineImport')
      const { nodes, title } = markdownToNodes(text)
      return replaceWithImportedOutline(nodes, title)
    } catch (error) {
      errorMessage.value = error?.message || t('editor.importFailed')
      return false
    }
  }

  function applyMindmapTheme(themeId) {
    if (!isTreeMode(documentRef.value.mode)) {
      return
    }

    commitMutation('切换导图主题', draft => {
      draft.content.layout = normalizeMindmapLayout({ ...draft.content.layout, theme: themeId })
      assignMindmapAccents(draft.content)
    }, { captureMindmapPerformance: true })
  }

  // 布局/连线/编号等外观开关：彩虹分支或换主题时重算配色
  function setMindmapOption(patch = {}) {
    if (!isTreeMode(documentRef.value.mode)) {
      return
    }

    commitMutation('调整导图外观', draft => {
      draft.content.layout = normalizeMindmapLayout({ ...draft.content.layout, ...patch })
      if (patch.theme !== undefined || patch.rainbow !== undefined) {
        assignMindmapAccents(draft.content)
      }
    }, { captureMindmapPerformance: true })
  }

  // 样式预设：按层级套用形状 / 字号 / 字重 / 强调
  function applyMindmapStylePreset(presetId) {
    if (!isTreeMode(documentRef.value.mode)) {
      return
    }
    const preset = MINDMAP_STYLE_PRESETS.find(item => item.id === presetId)
    if (!preset) {
      return
    }

    commitMutation('应用样式预设', draft => {
      const depths = buildDepthMap(draft.content.nodes)
      draft.content.nodes.forEach(node => {
        const depth = depths.get(node.id) ?? 0
        const patch = depth === 0 ? preset.root : (depth === 1 ? preset.branch : preset.deep)
        if (patch) {
          node.style = { ...node.style, ...patch }
        }
      })
    }, { captureMindmapPerformance: true })
  }

  // 按层级（或彩虹分支）分配主题色：根节点最高层级配色，一级分支各取一色
  function assignMindmapAccents(content) {
    const layout = normalizeMindmapLayout(content.layout)
    const theme = MINDMAP_THEMES.find(item => item.id === layout.theme) || MINDMAP_THEMES[0]
    const palette = theme.depths
    const depths = buildDepthMap(content.nodes)
    const rootId = content.nodes.find(node => !node.parentId && node.floating !== true)?.id || null
    const accentById = new Map()
    let branchIndex = 0

    content.nodes.forEach(node => {
      const depth = depths.get(node.id) ?? 0
      if (depth === 0) {
        accentById.set(node.id, palette[0])
        return
      }
      if (!layout.rainbow) {
        accentById.set(node.id, palette[Math.min(depth, palette.length - 1)])
        return
      }
      if (node.parentId === rootId) {
        accentById.set(node.id, palette[(branchIndex + 1) % palette.length])
        branchIndex += 1
        return
      }
      accentById.set(node.id, accentById.get(node.parentId) || palette[1 % palette.length])
    })

    content.nodes.forEach(node => {
      const depth = depths.get(node.id) ?? 0
      node.style = {
        ...node.style,
        accent: accentById.get(node.id) || palette[0],
        elevation: depth === 0 ? theme.rootElevation : 'soft'
      }
    })
  }

  function setAllCollapsed(collapsed) {
    if (!isTreeMode(documentRef.value.mode)) {
      return
    }

    commitMutation(collapsed ? '折叠全部分支' : '展开全部分支', draft => {
      draft.content.nodes.forEach(node => {
        if (node.floating === true) {
          return
        }
        node.collapsed = Boolean(collapsed)
      })
    }, { captureMindmapPerformance: true })
  }

  function addFloatingTopic(text = '') {
    if (!isTreeMode(documentRef.value.mode)) {
      return null
    }

    const nodeId = `topic-${Date.now().toString(36)}`
    const index = documentRef.value.content.nodes.length + 1
    commitMutation('添加浮动主题', draft => {
      const node = createMindmapNode({
        id: nodeId,
        text: text || `浮动主题 ${index}`,
        x: 420,
        y: 520
      })
      delete node.parentId
      node.floating = true
      draft.content.nodes.push(node)
    })

    activeNodeId.value = nodeId
    activeTextBlockId.value = null
    activeEdgeId.value = null
    activeSummaryId.value = null
    return nodeId
  }

  // 大纲操作：Tab 降级到上一个同级主题下，Shift+Tab 提升到祖父下
  function demoteTopic(nodeId = activeNodeId.value) {
    if (!isTreeMode(documentRef.value.mode) || !nodeId) {
      return false
    }

    const nodes = documentRef.value.content.nodes
    const node = nodes.find(item => item.id === nodeId)
    if (!node?.parentId) {
      return false
    }

    const siblings = nodes.filter(item => item.parentId === node.parentId)
    const index = siblings.findIndex(item => item.id === nodeId)
    const previousSibling = index > 0 ? siblings[index - 1] : null
    if (!previousSibling) {
      return false
    }

    commitMutation('降级主题', draft => {
      const target = draft.content.nodes.find(item => item.id === nodeId)
      if (target) {
        target.parentId = previousSibling.id
      }
    }, { captureMindmapPerformance: true })
    return true
  }

  function promoteTopic(nodeId = activeNodeId.value) {
    if (!isTreeMode(documentRef.value.mode) || !nodeId) {
      return false
    }

    const nodes = documentRef.value.content.nodes
    const node = nodes.find(item => item.id === nodeId)
    const parent = nodes.find(item => item.id === node.parentId)
    if (!node?.parentId || !parent?.parentId) {
      return false
    }

    commitMutation('提升主题', draft => {
      const target = draft.content.nodes.find(item => item.id === nodeId)
      if (target) {
        target.parentId = parent.parentId
      }
    }, { captureMindmapPerformance: true })
    return true
  }

  // Ctrl+Enter：给当前主题插入一个父主题，原主题挂到新父主题下
  function insertParentTopic(nodeId = activeNodeId.value) {
    if (!isTreeMode(documentRef.value.mode) || !nodeId) {
      return null
    }

    const nodes = documentRef.value.content.nodes
    const node = nodes.find(item => item.id === nodeId)
    if (!node) {
      return null
    }

    const parentId = node.parentId || null
    const newId = `topic-${Date.now().toString(36)}`
    commitMutation('插入父主题', draft => {
      const target = draft.content.nodes.find(item => item.id === nodeId)
      if (!target) {
        return
      }
      const index = draft.content.nodes.indexOf(target)
      const parentNode = createMindmapNode({
        id: newId,
        parentId: parentId || undefined,
        text: '新主题'
      })
      draft.content.nodes.splice(index, 0, parentNode)
      target.parentId = newId
    }, { captureMindmapPerformance: true })

    activeNodeId.value = newId
    return newId
  }

  function setMindmapLayout(direction) {
    if (!isTreeMode(documentRef.value.mode)) {
      return
    }

    commitMutation('切换导图布局', draft => {
      draft.content.layout = normalizeMindmapLayout({ ...draft.content.layout, direction })
    }, { captureMindmapPerformance: true })
  }

  function addRelationship(fromNodeId, toNodeId) {
    if (!isTreeMode(documentRef.value.mode) || !fromNodeId || !toNodeId || fromNodeId === toNodeId) {
      return null
    }

    const edgeId = `relation-${Date.now().toString(36)}`
    commitMutation('添加关系线', draft => {
      const duplicated = (draft.content.edges || []).some(edge => (
        edge.kind === 'relationship'
        && edge.fromNodeId === fromNodeId
        && edge.toNodeId === toNodeId
      ))
      if (duplicated) {
        return
      }
      draft.content.edges.push({
        id: edgeId,
        kind: 'relationship',
        fromNodeId,
        toNodeId,
        fromAnchor: 'right',
        toAnchor: 'left',
        layerId: 'layer-edges',
        label: '',
        style: { route: 'curve', stroke: 'dashed', marker: 'arrow' }
      })
    }, { captureMindmapPerformance: true })
    return edgeId
  }

  function removeRelationship(edgeId) {
    if (!edgeId || !isTreeMode(documentRef.value.mode)) {
      return
    }

    commitMutation('删除关系线', draft => {
      draft.content.edges = draft.content.edges.filter(edge => (
        !(edge.id === edgeId && edge.kind === 'relationship')
      ))
    }, { captureMindmapPerformance: true })
    if (activeEdgeId.value === edgeId) {
      activeEdgeId.value = null
    }
  }

  function addBoundary(nodeId = activeNodeId.value) {
    if (!isTreeMode(documentRef.value.mode) || !nodeId) {
      return null
    }

    const boundaryId = `boundary-${Date.now().toString(36)}`
    commitMutation('添加边界', draft => {
      if (!Array.isArray(draft.content.boundaries)) {
        draft.content.boundaries = []
      }
      if (draft.content.boundaries.some(boundary => boundary.nodeId === nodeId)) {
        return
      }
      draft.content.boundaries.push({ id: boundaryId, nodeId, accent: 'rose' })
    }, { captureMindmapPerformance: true })
    return boundaryId
  }

  function removeBoundary(nodeId = activeNodeId.value) {
    if (!isTreeMode(documentRef.value.mode) || !nodeId) {
      return
    }

    commitMutation('移除边界', draft => {
      draft.content.boundaries = (draft.content.boundaries || []).filter(boundary => boundary.nodeId !== nodeId)
    }, { captureMindmapPerformance: true })
  }

  function setBoundaryAccent(accent, nodeId = activeNodeId.value) {
    if (!isTreeMode(documentRef.value.mode) || !nodeId) {
      return false
    }
    commitMutation('设置边界颜色', draft => {
      const boundary = (draft.content.boundaries || []).find(item => item.nodeId === nodeId)
      if (boundary) {
        boundary.accent = String(accent || 'rose')
      }
    }, { captureMindmapPerformance: true })
    return true
  }

  function setSummaryAccent(accent, summaryId = activeSummaryId.value) {
    if (!isTreeMode(documentRef.value.mode) || !summaryId) {
      return false
    }
    commitMutation('设置概要颜色', draft => {
      const summary = (draft.content.summaries || []).find(item => item.id === summaryId)
      if (summary) {
        summary.accent = String(accent || 'amber')
      }
    }, { captureMindmapPerformance: true })
    return true
  }

  function addSummary(nodeIds = [], text = '') {
    if (!isTreeMode(documentRef.value.mode)) {
      return null
    }

    const ids = [...new Set((nodeIds || []).filter(Boolean))]
    if (!ids.length) {
      return null
    }

    const summaryId = `summary-${Date.now().toString(36)}`
    commitMutation('添加概要', draft => {
      if (!Array.isArray(draft.content.summaries)) {
        draft.content.summaries = []
      }
      draft.content.summaries.push({
        id: summaryId,
        nodeIds: ids,
        text: String(text || ''),
        accent: 'amber'
      })
    }, { captureMindmapPerformance: true })
    activeSummaryId.value = summaryId
    activeNodeId.value = null
    activeTextBlockId.value = null
    activeEdgeId.value = null
    return summaryId
  }

  function updateSummaryText(summaryId, text) {
    if (!summaryId) {
      return
    }

    commitMutation('编辑概要', draft => {
      const summary = (draft.content.summaries || []).find(item => item.id === summaryId)
      if (summary) {
        summary.text = String(text || '').slice(0, 120)
      }
    }, { captureMindmapPerformance: true })
  }

  function removeSummary(summaryId = activeSummaryId.value) {
    if (!summaryId) {
      return
    }

    commitMutation('删除概要', draft => {
      draft.content.summaries = (draft.content.summaries || []).filter(item => item.id !== summaryId)
    }, { captureMindmapPerformance: true })
    if (activeSummaryId.value === summaryId) {
      activeSummaryId.value = null
    }
  }

  function selectSummary(summaryId) {
    activeSummaryId.value = summaryId
    activeNodeId.value = null
    activeTextBlockId.value = null
    activeEdgeId.value = null
  }

  function toggleLayerVisibility(layerId) {
    applyDocumentCommand('切换图层显隐', draft => createToggleLayerVisibilityCommand(draft, layerId))
  }

  function toggleLayerLock(layerId) {
    applyDocumentCommand('切换图层锁定', draft => createToggleLayerLockCommand(draft, layerId))
  }

  function reorderLayer(layerId, direction) {
    applyDocumentCommand('调整图层顺序', draft => createReorderLayerCommand(draft, layerId, direction))
  }

  function setViewport(viewport) {
    commitMutation('调整视口', draft => {
      draft.content.viewport = {
        ...draft.content.viewport,
        ...viewport,
        zoom: clampZoom(viewport.zoom ?? draft.content.viewport.zoom)
      }
    })
  }

  function panBy(deltaX, deltaY) {
    setViewport({
      x: documentRef.value.content.viewport.x + deltaX,
      y: documentRef.value.content.viewport.y + deltaY
    })
  }

  function zoomBy(step) {
    setViewport({
      zoom: clampZoom(documentRef.value.content.viewport.zoom + step)
    })
  }

  function createExportSvgClone(svgElement) {
    const clone = svgElement.cloneNode(true)
    const INTERACTIVE = [
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
    INTERACTIVE.forEach(selector => {
      clone.querySelectorAll(selector).forEach(element => element.remove())
    })
    clone.querySelectorAll('[data-testid]').forEach(element => {
      element.removeAttribute('data-testid')
    })
    return clone
  }

  // 导出图片按实际 SVG viewBox 比例输出，避免被拉成正方形（内容裁剪后比例可能变化）
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
    // PDF 页面仍使用画布的逻辑像素尺寸；内部图片按约 300–400 DPI 栅格化，
    // 再以 PNG 无损写入，避免低分辨率 JPEG 被放大后文字和连线发虚。
    const scale = Math.min(4, 4096 / maxEdge)
    return {
      pageWidth,
      pageHeight,
      pixelWidth: Math.max(1, Math.round(pageWidth * scale)),
      pixelHeight: Math.max(1, Math.round(pageHeight * scale)),
      pixelRatio: scale
    }
  }

  async function exportPdf(svgElement, options = {}) {
    commitPendingMindNoteEdit()
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
    commitPendingMindNoteEdit()
    if (!svgElement || typeof window === 'undefined') {
      errorMessage.value = t('editor.pdfUnavailable')
      return false
    }
    const exportTitle = options.title || documentRef.value.title || 'diagram'

    const page = documentRef.value.content.page || { width: 1200, height: 720 }
    const clone = createExportSvgClone(svgElement)

    const markup = new XMLSerializer().serializeToString(clone)
    const popup = window.open('', '_blank')
    if (!popup) {
      errorMessage.value = t('editor.pdfBlocked')
      return false
    }

    // Markdown 模式传入的是 HTML 预览；把页面上的样式一起带进打印窗口，否则标题/表格/列表全部丢失样式。
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
    commitPendingMindNoteEdit()
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

  async function saveDocument(options = {}) {
    const background = options.background === true
    if (!sessionState.currentUser.value) {
      errorMessage.value = t('editor.saveLogin')
      return false
    }

    commitPendingMindNoteEdit()
    if (background) {
      if (isAutoSaving.value || isSaving.value || !AUTO_SAVE_ELIGIBLE_STATES.has(saveState.value)) {
        return false
      }
    } else if (isSaving.value || isAutoSaving.value) {
      return false
    }

    const validation = validateDocument(documentRef.value)
    if (!validation.valid) {
      errorMessage.value = validation.errors.join('；')
      return false
    }

    if (background) {
      isAutoSaving.value = true
      syncState.value = 'syncing'
    } else {
      isSaving.value = true
    }
    errorMessage.value = ''
    const selectionBeforeSave = {
      nodeId: activeNodeId.value,
      edgeId: activeEdgeId.value,
      textBlockId: activeTextBlockId.value
    }
    const revisionBeforeSave = documentRef.value.content.meta.revision
    let needsFollowUpSave = false

    try {
      const payload = clone(documentRef.value)
      const token = sessionState.currentUser.value.token
      let saved

      if (payload.id) {
        try {
          saved = await api.updateDocument(payload.id, payload, token)
        } catch (error) {
          // 本地草稿可能来自已被服务器删除的文档；不要把用户卡在 404 报错上。
          if (error?.status !== 404) {
            throw error
          }
          saved = await api.createDocument({ ...payload, id: null }, token)
        }
      } else {
        saved = await api.createDocument(payload, token)
      }

      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
        throw new Error(t('editor.saveFailed'))
      }
      unlockCurrentDocument()
      const changedDuringSave = documentRef.value.content.meta.revision !== revisionBeforeSave
      if (changedDuringSave) {
        const current = clone(documentRef.value)
        current.id = current.id || saved.id
        current.sequenceNo = current.sequenceNo || saved.sequenceNo
        current.createdAt = current.createdAt || saved.createdAt
        current.updatedAt = saved.updatedAt
        documentRef.value = normalizeDocument(current)
        needsFollowUpSave = true
      } else {
        documentRef.value = normalizeDocument(saved)
        hydrateModeState(documentRef.value)
      }

      const savedNodeIds = new Set(documentRef.value.content.nodes.map(node => node.id))
      const savedEdgeIds = new Set(documentRef.value.content.edges.map(edge => edge.id))
      const savedTextBlockIds = new Set(documentRef.value.content.textBlocks.map(block => block.id))
      activeNodeId.value = savedNodeIds.has(selectionBeforeSave.nodeId)
        ? selectionBeforeSave.nodeId
        : (documentRef.value.content.nodes[0]?.id || null)
      activeTextBlockId.value = savedTextBlockIds.has(selectionBeforeSave.textBlockId)
        ? selectionBeforeSave.textBlockId
        : (documentRef.value.content.textBlocks[0]?.id || null)
      activeEdgeId.value = savedEdgeIds.has(selectionBeforeSave.edgeId) ? selectionBeforeSave.edgeId : null
      lockDocument(documentRef.value.id)
      saveState.value = changedDuringSave ? '本地草稿已更新' : '已同步到服务器'
      syncState.value = 'idle'
      autosaveRetryDelay = 0
      if (!background && !changedDuringSave) {
        manualSaveFeedbackToken.value += 1
        statusMessage.value = ''
      }
      persistDraft(documentRef.value)
      return true
    } catch (error) {
      saveState.value = '保存失败，已保留本地草稿'
      syncState.value = 'offline'
      if (!background) {
        statusMessage.value = ''
        // 只有用户主动点「保存」失败才弹提示；后台自动保存失败改为静默重试，
        // 否则后端一抖，每改一下画布就会弹一次红条。
        errorMessage.value = error.message || t('editor.saveFailed')
        errorToken.value += 1
      }
      persistDraft(documentRef.value)
      if (background) {
        scheduleAutoSaveRetry()
      }
      return false
    } finally {
      if (background) {
        isAutoSaving.value = false
      } else {
        isSaving.value = false
      }
      if (needsFollowUpSave) {
        scheduleAutoSave(documentRef.value)
      }
    }
  }

  async function loadDocument(id = loadId.value) {
    if (!sessionState.currentUser.value) {
      errorMessage.value = t('editor.loadLogin')
      return false
    }

    const normalizedId = String(id || '').trim()
    if (!normalizedId) {
      errorMessage.value = '请输入文档 ID。'
      return false
    }

    if (sessionState.isDocumentOccupied(normalizedId) && String(currentDocumentLock.value || '') !== normalizedId) {
      errorMessage.value = '该文档已在当前浏览器会话中打开，请返回现有编辑页。'
      return false
    }

    try {
      clearAutoSaveTimer()
      const remote = await api.getDocument(normalizedId, sessionState.currentUser.value.token)
      unlockCurrentDocument()
      history.clear()
      documentRef.value = normalizeDocument(remote)
      hydrateModeState(documentRef.value)
      loadId.value = String(remote.id || normalizedId)
      activeNodeId.value = documentRef.value.content.nodes[0]?.id || null
      activeTextBlockId.value = documentRef.value.content.textBlocks[0]?.id || null
      lockDocument(documentRef.value.id)
      saveState.value = '已从服务器加载'
      statusMessage.value = '文档已从服务器加载。'
      errorMessage.value = ''
      persistDraft(documentRef.value)
      return true
    } catch (error) {
      const draft = readDraft(sessionState.currentUser.value.userId)
      if (draft && String(draft.id || '') === normalizedId) {
        documentRef.value = normalizeDocument(draft)
        hydrateModeState(documentRef.value)
        activeNodeId.value = documentRef.value.content.nodes[0]?.id || null
        activeTextBlockId.value = documentRef.value.content.textBlocks[0]?.id || null
        activeEdgeId.value = null
        lockDocument(documentRef.value.id)
        saveState.value = '已恢复本地草稿'
        statusMessage.value = '服务器加载失败，已恢复同 ID 本地草稿。'
        errorMessage.value = error.message || t('editor.loadFailed')
        return true
      }

      errorMessage.value = error.message || t('editor.loadFailed')
      return false
    }
  }

  function undo() {
    commitPendingMindNoteEdit()
    if (history.undo()) {
      touchDraftState()
    }
  }

  function redo() {
    commitPendingMindNoteEdit()
    if (history.redo()) {
      touchDraftState()
    }
  }

  function handleShortcut(event) {
    const key = event.key.toLowerCase()
    const editableTarget = isEditableTarget(event.target)

    if ((event.ctrlKey || event.metaKey) && key === 's') {
      event.preventDefault()
      void saveDocument()
      return true
    }
    if (!editableTarget && (event.ctrlKey || event.metaKey) && key === 'z' && !event.shiftKey) {
      event.preventDefault()
      undo()
      return true
    }
    if (!editableTarget && (event.ctrlKey || event.metaKey) && (key === 'y' || (key === 'z' && event.shiftKey))) {
      event.preventDefault()
      redo()
      return true
    }
    if (editableTarget) {
      return false
    }
    if (key === 'delete' || key === 'backspace') {
      event.preventDefault()
      return removeSelection()
    }
    if (key === 'n') {
      event.preventDefault()
      if (isTreeMode(documentRef.value.mode)) {
        addMindmapSiblingBranch(activeNodeId.value)
      } else if (documentRef.value.mode === 'flowchart') {
        addNode('process')
      }
      return true
    }
    if (key === 'd' && documentRef.value.mode === 'flowchart' && event.shiftKey) {
      event.preventDefault()
      addNode('decision')
      return true
    }
    if (isTreeMode(documentRef.value.mode)) {
      if (key === 'tab' && event.shiftKey) {
        event.preventDefault()
        promoteTopic()
        return true
      }
      if (key === 'tab') {
        event.preventDefault()
        addMindmapChildBranch()
        return true
      }
      if (key === 'enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        insertParentTopic()
        return true
      }
      if (key === 'enter') {
        event.preventDefault()
        addMindmapSiblingBranch(activeNodeId.value)
        return true
      }
    }
    if (key === 'm' && documentRef.value.mode === 'mindmap') {
      event.preventDefault()
      addMindNoteTextBlock()
      return true
    }
    if (key === '+' || key === '=') {
      event.preventDefault()
      zoomBy(0.1)
      return true
    }
    if (key === '-' || key === '_') {
      event.preventDefault()
      zoomBy(-0.1)
      return true
    }
    if (key === 'arrowleft') {
      event.preventDefault()
      panBy(-40, 0)
      return true
    }
    if (key === 'arrowright') {
      event.preventDefault()
      panBy(40, 0)
      return true
    }
    if (key === 'arrowup') {
      event.preventDefault()
      panBy(0, -40)
      return true
    }
    if (key === 'arrowdown') {
      event.preventDefault()
      panBy(0, 40)
      return true
    }
    return false
  }

  function commitMutation(label, updater, options = {}) {
    commitPendingMindNoteEdit()
    const before = clone(documentRef.value)
    const workingCopy = clone(documentRef.value)
    updater(workingCopy)
    hydrateModeState(workingCopy, options.captureMindmapPerformance === true)
    workingCopy.content.meta.revision = (workingCopy.content.meta.revision || 0) + 1
    const after = normalizeDocument(workingCopy)

    documentRef.value = after
    history.commit({
      label,
      undo: () => {
        documentRef.value = normalizeDocument(clone(before))
      },
      redo: () => {
        documentRef.value = normalizeDocument(clone(after))
      }
    }, { apply: false })

    touchDraftState()
  }

  function touchDraftState(message = '') {
    saveState.value = '本地草稿已更新'
    statusMessage.value = message
    errorMessage.value = ''
  }

  function applyDocumentCommand(label, createCommand) {
    commitPendingMindNoteEdit()
    const draft = clone(documentRef.value)
    const command = createCommand(draft)
    command.redo()
    hydrateModeState(draft)
    const after = normalizeDocument(draft)
    const before = clone(documentRef.value)
    documentRef.value = after
    history.commit({
      label,
      undo: () => {
        documentRef.value = normalizeDocument(clone(before))
      },
      redo: () => {
        documentRef.value = normalizeDocument(clone(after))
      }
    }, { apply: false })
    touchDraftState()
  }

  function hydrateModeState(targetDocument, captureMindmapPerformance = false) {
    if (!isTreeMode(targetDocument.mode)) {
      return
    }
    syncMindmapState(targetDocument, captureMindmapPerformance)
  }

  function syncMindmapState(targetDocument, capturePerformance = false) {
    const startedAt = capturePerformance && typeof performance !== 'undefined' ? performance.now() : 0
    targetDocument.content.nodes = layoutMindmap(targetDocument.content.nodes, targetDocument.content.layout, {
      width: targetDocument.content.page?.width || 1200,
      height: targetDocument.content.page?.height || 720
    })
    syncMindmapEdges(targetDocument)
    pruneMindmapExtras(targetDocument)
    if (capturePerformance && typeof performance !== 'undefined') {
      const elapsed = performance.now() - startedAt
      performanceSamples.value = [...performanceSamples.value.slice(-19), elapsed]
    }
  }

  // 删除节点后，清掉指向已不存在节点的边界 / 概要 / 关系线
  function pruneMindmapExtras(targetDocument) {
    const content = targetDocument.content
    const nodeIds = new Set((content.nodes || []).map(node => node.id))

    content.boundaries = (content.boundaries || []).filter(boundary => nodeIds.has(boundary.nodeId))

    content.summaries = (content.summaries || [])
      .map(summary => ({
        ...summary,
        nodeIds: (summary.nodeIds || []).filter(nodeId => nodeIds.has(nodeId))
      }))
      .filter(summary => summary.nodeIds.length > 0)

    content.edges = (content.edges || []).filter(edge => (
      edge.kind !== 'relationship'
      || (nodeIds.has(edge.fromNodeId) && nodeIds.has(edge.toNodeId))
    ))
  }

  function lockDocument(documentId) {
    if (!documentId) {
      currentDocumentLock.value = null
      return
    }
    currentDocumentLock.value = String(documentId)
    sessionState.acquireDocument(documentId)
  }

  function unlockCurrentDocument() {
    if (currentDocumentLock.value) {
      sessionState.releaseDocument(currentDocumentLock.value)
      currentDocumentLock.value = null
    }
  }

  function persistDraft(documentValue) {
    const userId = sessionState.currentUser.value?.userId
    if (!userId || !documentValue || typeof window === 'undefined') {
      return
    }
    try {
      const payload = clone(documentValue)
      payload.content.meta.autosavedAt = new Date().toISOString()
      window.localStorage.setItem(`${DRAFT_KEY_PREFIX}${userId}`, JSON.stringify(payload))
    } catch (error) {
      saveState.value = t('editor.draftStorageFull')
    }
  }

  function readDraft(userId) {
    if (!userId || typeof window === 'undefined') {
      return null
    }
    try {
      const raw = window.localStorage.getItem(`${DRAFT_KEY_PREFIX}${userId}`)
      if (!raw) {
        return null
      }
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  function clearAutoSaveTimer() {
    if (!autosaveTimer) {
      return
    }

    window.clearTimeout(autosaveTimer)
    autosaveTimer = null
  }

  function scheduleAutoSave(documentValue) {
    clearAutoSaveTimer()

    if (!documentValue || !sessionState.currentUser.value || !AUTO_SAVE_ELIGIBLE_STATES.has(saveState.value)) {
      return
    }

    autosaveTimer = window.setTimeout(() => {
      autosaveTimer = null
      void saveDocument({ background: true })
    }, AUTO_SAVE_DELAY_MS)
  }

  // 后台保存失败后的退避重试：3s → 6s → 12s → 24s → 30s 封顶
  function scheduleAutoSaveRetry() {
    if (!sessionState.currentUser.value) {
      return
    }

    clearAutoSaveTimer()
    autosaveRetryDelay = autosaveRetryDelay
      ? Math.min(autosaveRetryDelay * 2, AUTO_SAVE_RETRY_MAX_MS)
      : AUTO_SAVE_RETRY_BASE_MS

    autosaveTimer = window.setTimeout(() => {
      autosaveTimer = null
      void saveDocument({ background: true })
    }, autosaveRetryDelay)
  }

  // 浏览器恢复联网（或用户切回页面）时立刻补一次同步，不必等退避到点
  function retryAutoSaveNow() {
    if (syncState.value !== 'offline' || !sessionState.currentUser.value) {
      return
    }
    clearAutoSaveTimer()
    autosaveRetryDelay = 0
    void saveDocument({ background: true })
  }

  // ── 历史版本 ────────────────────────────────────────────────
  async function listRevisions() {
    const id = documentRef.value.id
    if (!id || !sessionState.currentUser.value) {
      return []
    }
    try {
      return await api.listRevisions(id, sessionState.currentUser.value.token)
    } catch (error) {
      errorMessage.value = error.message || '获取历史版本失败'
      errorToken.value += 1
      return []
    }
  }

  async function restoreRevision(revisionId) {
    const id = documentRef.value.id
    if (!id || !revisionId || !sessionState.currentUser.value) {
      return false
    }
    try {
      commitPendingMindNoteEdit()
      const saved = await api.restoreRevision(id, revisionId, sessionState.currentUser.value.token)
      documentRef.value = normalizeDocument(saved)
      hydrateModeState(documentRef.value)
      history.clear()
      saveState.value = '已从服务器加载'
      syncState.value = 'idle'
      autosaveRetryDelay = 0
      activeNodeId.value = documentRef.value.content.nodes[0]?.id || null
      activeTextBlockId.value = documentRef.value.content.textBlocks[0]?.id || null
      activeEdgeId.value = null
      persistDraft(documentRef.value)
      return true
    } catch (error) {
      errorMessage.value = error.message || '恢复历史版本失败'
      errorToken.value += 1
      return false
    }
  }

  function validateExport(format) {
    if ((format === 'xmind') && !['mindmap', 'mind-note'].includes(documentRef.value.mode)) {
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
        nodes: clone(documentRef.value.content.nodes).filter(node => visibleLayers.has(node.layerId) && !hiddenIds.has(node.id)),
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

  return {
    document: computed(() => documentRef.value),
    loadId,
    activeNodeId,
    saveState,
    statusMessage,
    errorMessage,
    errorToken,
    isSaving,
    syncState,
    retryAutoSaveNow,
    activeTool,
    activeTextBlockId,
    activeEdgeId,
    activeSummaryId,
    manualSaveFeedbackToken,
    performanceSummary: computed(() => ({
      hiddenNodeIds: isTreeMode(documentRef.value.mode) ? collectHiddenNodeIds(documentRef.value.content.nodes) : [],
      p95: calculateP95(performanceSamples.value)
    })),
    canUndo: computed(() => history.canUndo),
    canRedo: computed(() => history.canRedo),
    bootstrapForUser,
    resetForLogout,
    openDocumentSnapshot,
    startNewDocument,
    updateTitle,
    setMode,
    addNode,
    addMindmapBranch,
    addMindmapChildBranch,
    addMindmapSiblingBranch,
    selectNode,
    selectEdge,
    clearSelection,
    moveNode,
    moveNodes,
    setNodePositions,
    setNodeLocked,
    setNodesZOrder,
    groupNodes,
    ungroupNodes,
    copyNodes,
    pasteNodes,
    removeNodes,
    setPageSize,
    setGuides,
    setGridVisible,
    addPage,
    selectPage,
    renamePage,
    deletePage,
    getContainerChildren,
    setNodeContainer,
    updateNodeRect,
    updateNodeMetadata,
    exportDrawio,
    exportPdf,
    printDocument,
    importDrawio,
    beginNodeResize,
    previewNodeResize,
    endNodeResize,
    updateNodeText,
    updateNodeStyle,
    updateActiveNodeStyle,
    toggleNodeMarker,
    toggleNodeMarkers,
    setNodePriority,
    setNodeProgress,
    setNodeNote,
    addNodeLabel,
    removeNodeLabel,
    setNodeTask,
    addNodeAttachment,
    removeNodeAttachment,
    replaceWithImportedOutline,
    importMindmapFile,
    applyMindmapTheme,
    setMindmapLayout,
    setMindmapOption,
    applyMindmapStylePreset,
    setAllCollapsed,
    addFloatingTopic,
    moveOutlineTopic,
    moveTopicToNode,
    setNodeNoteById,
    demoteTopic,
    promoteTopic,
    insertParentTopic,
    addRelationship,
    removeRelationship,
    addBoundary,
    removeBoundary,
    addSummary,
    setBoundaryAccent,
    setSummaryAccent,
    updateSummaryText,
    removeSummary,
    selectSummary,
    updateMarkdownSource,
    selectTextBlock,
    addMindNoteTextBlock,
    beginMindNoteBlockEdit,
    applyMindNoteBlockContent,
    commitMindNoteBlockEdit,
    commitPendingMindNoteEdit,
    removeMindNoteTextBlock,
    indentMindNoteTextBlock,
    outdentMindNoteTextBlock,
    updateMindNoteTextBlock,
    moveMindNoteTextBlock,
    resizeMindNoteTextBlock,
    formatMindNoteTextBlock,
    updateEdgeLabel,
    updateEdgeStyle,
    updateActiveEdgeStyle,
    updateEdgeConnection,
    removeSelection,
    addEdge,
    toggleCollapse,
    setActiveTool,
    toggleLayerVisibility,
    toggleLayerLock,
    reorderLayer,
    setViewport,
    panBy,
    zoomBy,
    exportDocument,
    saveDocument,
    loadDocument,
    listRevisions,
    restoreRevision,
    undo,
    redo,
    handleShortcut
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function clampZoom(value) {
  return Math.max(0.2, Math.min(2.5, Number(value) || 1))
}

function isTreeMode(mode) {
  return mode === 'mindmap' || mode === 'mind-note'
}

// 计算每个节点在树里的层级（中心主题 = 0），用于按层级套用主题配色
function buildDepthMap(nodes = []) {
  const childrenMap = new Map()
  nodes.forEach(node => {
    if (!node.parentId) {
      return
    }
    const children = childrenMap.get(node.parentId) || []
    children.push(node.id)
    childrenMap.set(node.parentId, children)
  })

  const depths = new Map()
  const roots = nodes.filter(node => !node.parentId)
  const queue = roots.map(node => ({ id: node.id, depth: 0 }))

  while (queue.length) {
    const { id, depth } = queue.shift()
    if (depths.has(id)) {
      continue
    }
    depths.set(id, depth)
    ;(childrenMap.get(id) || []).forEach(childId => queue.push({ id: childId, depth: depth + 1 }))
  }

  return depths
}

function collectBranchIds(nodes, rootId) {
  const tree = buildMindmapTree(nodes)
  const ids = new Set([rootId])
  const queue = [rootId]

  while (queue.length) {
    const currentId = queue.shift()
    const children = tree.get(currentId) || []
    children.forEach(childId => {
      ids.add(childId)
      queue.push(childId)
    })
  }

  return ids
}

function isEditableTarget(target) {
  return Boolean(
    target &&
    typeof target.closest === 'function' &&
    target.closest('input, textarea, select, [contenteditable="true"]')
  )
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Failed to read PDF image'))
    reader.readAsDataURL(blob)
  })
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
