import { computed, shallowRef, watch } from 'vue'
import { createHistory } from '../commands/history'
import {
  createDocument,
  defaultTitleForMode,
  normalizeDocument,
  validateDocument
} from '../model/document'
import { createFlowchartDocument, createFlowchartEdge, createFlowchartNode } from '../modes/flowchart'
import {
  buildMindmapTree,
  collectHiddenNodeIds,
  createMindmapDocument,
  createMindmapNode,
  findRootNode,
  syncMindmapEdges
} from '../modes/mindmap'
import { createMarkdownDocument, parseMarkdownToBlocks } from '../modes/markdown'
import { createMindNoteDocument } from '../modes/mindNote'
import {
  createReorderLayerCommand,
  createToggleLayerLockCommand,
  createToggleLayerVisibilityCommand
} from '../commands/layerCommands'
import { exportSvgElementAsImage, triggerDownload } from '../exporters/imageExporter'
import { calculateP95, layoutMindmap } from '../render/mindmapLayout'
import { exportXMindDocument } from '../exporters/xmindExporter'
import {
  createMindNoteTextBlock,
  formatMindNoteBlock,
  updateMindNoteBlockText
} from '../render/textBlockLayer'

const DRAFT_KEY_PREFIX = 'diagram-editor:draft:'

export function useEditorState({ api, sessionState }) {
  const history = createHistory()
  const documentRef = shallowRef(createDocument())
  const loadId = shallowRef('')
  const activeNodeId = shallowRef(null)
  const saveState = shallowRef('未保存')
  const statusMessage = shallowRef('请先登录，然后创建或加载文档。')
  const errorMessage = shallowRef('')
  const isSaving = shallowRef(false)
  const currentDocumentLock = shallowRef(null)
  const activeTool = shallowRef('select')
  const performanceSamples = shallowRef([])
  const activeTextBlockId = shallowRef(null)
  const activeEdgeId = shallowRef(null)
  const isAutoSaving = shallowRef(false)
  const manualSaveFeedbackToken = shallowRef(0)

  let autosaveTimer = null

  watch(documentRef, documentValue => {
    persistDraft(documentValue)
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
      statusMessage.value = '已恢复本地草稿。'
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
  }

  function openDocumentSnapshot(snapshot) {
    if (!snapshot) {
      return
    }

    clearAutoSaveTimer()
    history.clear()
    documentRef.value = normalizeDocument(clone(snapshot))
    hydrateModeState(documentRef.value)
    activeNodeId.value = documentRef.value.content.nodes[0]?.id || null
    activeTextBlockId.value = documentRef.value.content.textBlocks[0]?.id || null
    activeEdgeId.value = null
    activeTool.value = 'select'
    errorMessage.value = ''
    statusMessage.value = '已切换到工作画布。'
  }

  function startNewDocument({ mode = 'flowchart', title } = {}) {
    clearAutoSaveTimer()
    unlockCurrentDocument()
    history.clear()

    if (mode === 'flowchart') {
      documentRef.value = normalizeDocument(createFlowchartDocument())
    } else if (mode === 'mindmap') {
      documentRef.value = normalizeDocument(createMindmapDocument())
    } else if (mode === 'mind-note') {
      documentRef.value = normalizeDocument(createMindNoteDocument())
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
    statusMessage.value = '已创建新文档，开始编辑后会自动保存本地草稿。'
    errorMessage.value = ''
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
      draft.content.nodes.push(createFlowchartNode(kind, nextIndex, position || {}))
    })
    activeNodeId.value = nodeId
    activeTextBlockId.value = null
  }

  function addMindmapBranch(parentId = null) {
    const nextIndex = documentRef.value.content.nodes.length + 1
    const nextNodeId = `topic-${nextIndex}`
    commitMutation('添加思维导图分支', draft => {
      const root = findRootNode(draft.content.nodes)
      const targetParentId = parentId || root?.id
      draft.content.nodes.push(createMindmapNode({
        id: nextNodeId,
        parentId: targetParentId,
        text: targetParentId === root?.id ? `一级分支 ${nextIndex - 1}` : `子分支 ${nextIndex - 1}`
      }))
    })
    activeNodeId.value = nextNodeId
    activeTextBlockId.value = null
  }

  function addMindmapChildBranch(parentId = activeNodeId.value) {
    addMindmapBranch(parentId)
  }

  function selectNode(nodeId) {
    activeNodeId.value = nodeId
    activeTextBlockId.value = null
    activeEdgeId.value = null
  }

  function selectTextBlock(blockId) {
    activeTextBlockId.value = blockId
    activeNodeId.value = documentRef.value.content.textBlocks.find(block => block.id === blockId)?.nodeId || activeNodeId.value
    activeEdgeId.value = null
  }

  function selectEdge(edgeId) {
    activeEdgeId.value = edgeId
    activeNodeId.value = null
    activeTextBlockId.value = null
  }

  function clearSelection() {
    activeNodeId.value = null
    activeTextBlockId.value = null
    activeEdgeId.value = null
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
      const selectedNodeId = activeNodeId.value || documentRef.value.content.nodes[0]?.id || null

      commitMutation('更新主题', draft => {
        draft.content.nodes = draft.content.nodes.map(node => ({
          ...node,
          style: {
            ...(node.style || {}),
            ...stylePatch
          }
        }))
      }, { captureMindmapPerformance: true })

      activeNodeId.value = selectedNodeId
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

  function addMindNoteTextBlock(nodeId = activeNodeId.value) {
    if ((documentRef.value.mode !== 'mindmap' && documentRef.value.mode !== 'mind-note') || !nodeId) {
      return
    }

    const nextIndex = documentRef.value.content.textBlocks.length + 1
    commitMutation('添加思维笔记文本块', draft => {
      draft.content.textBlocks.push(createMindNoteTextBlock({
        nodeId,
        index: nextIndex
      }))
    })
    activeTextBlockId.value = `note-${nextIndex}`
    activeNodeId.value = nodeId
    activeEdgeId.value = null
  }

  function updateMindNoteTextBlock(blockId, text) {
    commitMutation('更新思维笔记文本块', draft => {
      const block = draft.content.textBlocks.find(item => item.id === blockId)
      if (!block) {
        return
      }
      Object.assign(block, updateMindNoteBlockText(block, text))
    })
  }

  function moveMindNoteTextBlock(blockId, { deltaX = 0, deltaY = 0 } = {}) {
    if (!blockId || (!deltaX && !deltaY)) {
      return
    }

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

  function formatMindNoteTextBlock(format, blockId = activeTextBlockId.value) {
    if (!blockId) {
      return
    }

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
        statusMessage.value = '根节点不能删除。'
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
    statusMessage.value = tool === 'connect' ? '连接工具已启用，请依次点击起点和终点锚点。' : '已切回选择工具。'
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

  async function exportDocument(format, svgElement) {
    const validation = validateExport(format)
    if (!validation.valid) {
      errorMessage.value = validation.message
      return false
    }

    try {
      if (format === 'xmind') {
        const exportResult = await exportXMindDocument(snapshotVisibleDocument(), `${documentRef.value.title || 'diagram'}.xmind`)
        triggerDownload(exportResult.blob, exportResult.fileName)
        statusMessage.value = 'XMind 导出已准备完成。'
        return true
      }

      const exportResult = await exportSvgElementAsImage(svgElement, {
        format,
        fileName: `${documentRef.value.title || 'diagram'}.${format === 'jpeg' ? 'jpg' : format}`,
        widthCm: 10,
        heightCm: 10,
        dpi: 300
      })
      triggerDownload(exportResult.blob, exportResult.fileName)
      statusMessage.value = `${format.toUpperCase()} 导出已准备完成。`
      return true
    } catch (error) {
      errorMessage.value = error.message || '导出失败'
      return false
    }
  }

  async function saveDocument(options = {}) {
    const background = options.background === true
    if (!sessionState.currentUser.value) {
      errorMessage.value = '请先登录后再保存。'
      return false
    }

    if (background) {
      if (isAutoSaving.value || isSaving.value || saveState.value !== '本地草稿已更新') {
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
    } else {
      isSaving.value = true
    }
    errorMessage.value = ''

    try {
      const payload = clone(documentRef.value)
      const token = sessionState.currentUser.value.token
      const saved = payload.id
        ? await api.updateDocument(payload.id, payload, token)
        : await api.createDocument(payload, token)

      unlockCurrentDocument()
      documentRef.value = normalizeDocument(saved)
      hydrateModeState(documentRef.value)
      activeNodeId.value = documentRef.value.content.nodes[0]?.id || null
      activeTextBlockId.value = documentRef.value.content.textBlocks[0]?.id || null
      activeEdgeId.value = null
      lockDocument(documentRef.value.id)
      saveState.value = '已同步到服务器'
      if (!background) {
        manualSaveFeedbackToken.value += 1
        statusMessage.value = ''
      }
      persistDraft(documentRef.value)
      return true
    } catch (error) {
      saveState.value = '保存失败，已保留本地草稿'
      if (!background) {
        statusMessage.value = ''
      }
      errorMessage.value = error.message || '保存失败'
      persistDraft(documentRef.value)
      return false
    } finally {
      if (background) {
        isAutoSaving.value = false
      } else {
        isSaving.value = false
      }
    }
  }

  async function loadDocument(id = loadId.value) {
    if (!sessionState.currentUser.value) {
      errorMessage.value = '请先登录后再加载文档。'
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
        errorMessage.value = error.message || '加载失败'
        return true
      }

      errorMessage.value = error.message || '加载失败'
      return false
    }
  }

  function undo() {
    if (history.undo()) {
      touchDraftState()
    }
  }

  function redo() {
    if (history.redo()) {
      touchDraftState()
    }
  }

  function handleShortcut(event) {
    const key = event.key.toLowerCase()
    const editableTarget = isEditableTarget(event.target)

    if ((event.ctrlKey || event.metaKey) && key === 'z' && !event.shiftKey) {
      event.preventDefault()
      undo()
      return true
    }
    if ((event.ctrlKey || event.metaKey) && (key === 'y' || (key === 'z' && event.shiftKey))) {
      event.preventDefault()
      redo()
      return true
    }
    if ((event.ctrlKey || event.metaKey) && key === 's') {
      event.preventDefault()
      void saveDocument()
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
    if (key === 'tab' && isTreeMode(documentRef.value.mode)) {
      event.preventDefault()
      addMindmapChildBranch()
      return true
    }
    if (key === 'enter' && isTreeMode(documentRef.value.mode)) {
      event.preventDefault()
      addMindmapSiblingBranch(activeNodeId.value)
      return true
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
    targetDocument.content.nodes = layoutMindmap(targetDocument.content.nodes)
    syncMindmapEdges(targetDocument)
    if (capturePerformance && typeof performance !== 'undefined') {
      const elapsed = performance.now() - startedAt
      performanceSamples.value = [...performanceSamples.value.slice(-19), elapsed]
    }
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
    if (!userId || typeof window === 'undefined') {
      return
    }
    const payload = clone(documentValue)
    payload.content.meta.autosavedAt = new Date().toISOString()
    window.localStorage.setItem(`${DRAFT_KEY_PREFIX}${userId}`, JSON.stringify(payload))
  }

  function readDraft(userId) {
    if (!userId || typeof window === 'undefined') {
      return null
    }
    const raw = window.localStorage.getItem(`${DRAFT_KEY_PREFIX}${userId}`)
    if (!raw) {
      return null
    }
    try {
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

    if (!documentValue?.id || !sessionState.currentUser.value || saveState.value !== '本地草稿已更新') {
      return
    }

    autosaveTimer = window.setTimeout(() => {
      autosaveTimer = null
      void saveDocument({ background: true })
    }, 1500)
  }

  function validateExport(format) {
    if ((format === 'xmind') && !['mindmap', 'mind-note'].includes(documentRef.value.mode)) {
      return { valid: false, message: '只有思维导图和思维笔记支持导出 XMind。' }
    }

    if (documentRef.value.content.nodes.length > 200) {
      return { valid: false, message: '当前图表过大，请先精简内容或分块导出。' }
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
    isSaving,
    activeTool,
    activeTextBlockId,
    activeEdgeId,
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
    updateNodeText,
    updateNodeStyle,
    updateActiveNodeStyle,
    updateMarkdownSource,
    selectTextBlock,
    addMindNoteTextBlock,
    updateMindNoteTextBlock,
    moveMindNoteTextBlock,
    formatMindNoteTextBlock,
    updateEdgeLabel,
    updateEdgeStyle,
    updateActiveEdgeStyle,
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
