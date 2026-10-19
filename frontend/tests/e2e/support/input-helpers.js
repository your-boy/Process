import { expect } from '@playwright/test'

export const CREATE_LABELS = {
  flowchart: '新建绘图',
  mindmap: '新建思维导图',
  markdown: '新建 Markdown',
  'mind-note': '新建思维笔记'
}

export async function readState(page) {
  return page.evaluate(() => {
    const app = document.querySelector('#app').__vue_app__._instance.setupState
    const s = app.editorState
    const d = s.document.value
    const content = d.content || {}
    return {
      key: app.activeDocumentKey,
      view: app.workspaceView,
      mode: d.mode,
      id: d.id,
      sequenceNo: d.sequenceNo,
      title: d.title,
      activePageId: content.activePageId,
      pages: (content.pages || []).map(page => ({
        id: page.id,
        name: page.name,
        width: page.page?.width,
        height: page.page?.height
      })),
      nodes: (content.nodes || []).map(node => ({
        id: node.id,
        text: node.text,
        parentId: node.parentId || null,
        x: Number(node.x),
        y: Number(node.y),
        width: Number(node.width),
        height: Number(node.height),
        kind: node.kind,
        layerId: node.layerId,
        locked: Boolean(node.locked),
        groupId: node.groupId || null,
        rotation: Number(node.rotation) || 0,
        collapsed: Boolean(node.collapsed),
        floating: Boolean(node.floating),
        style: node.style || {},
        labels: node.labels || [],
        markers: node.markers || [],
        note: node.note || '',
        progress: node.progress,
        priority: node.priority,
        link: node.link || '',
        tooltip: node.tooltip || '',
        image: node.image || '',
        taskStart: node.taskStart || '',
        taskDue: node.taskDue || '',
        assignee: node.assignee || '',
        attachments: node.attachments || []
      })),
      edges: (content.edges || []).map(edge => ({
        id: edge.id,
        fromNodeId: edge.fromNodeId,
        toNodeId: edge.toNodeId,
        fromAnchor: edge.fromAnchor,
        toAnchor: edge.toAnchor,
        label: edge.label || '',
        kind: edge.kind || 'flow',
        waypoints: edge.style?.waypoints || [],
        route: edge.style?.route || '',
        marker: edge.style?.marker || '',
        stroke: edge.style?.stroke || '',
        accent: edge.style?.accent || ''
      })),
      boundaries: content.boundaries || [],
      summaries: content.summaries || [],
      textBlocks: (content.textBlocks || []).map(block => ({
        id: block.id,
        nodeId: block.nodeId,
        parentId: block.parentId || null,
        html: block.html,
        text: block.text,
        width: block.width,
        height: block.height,
        offsetX: block.offsetX || 0,
        offsetY: block.offsetY || 0,
        order: block.order
      })),
      layers: content.layers || [],
      guides: content.guides || [],
      showGrid: content.showGrid,
      sourceText: content.sourceText || '',
      viewport: { ...(content.viewport || { x: 0, y: 0, zoom: 1 }) },
      layout: content.layout || {},
      activeNodeId: s.activeNodeId.value,
      activeEdgeId: s.activeEdgeId.value,
      activeTextBlockId: s.activeTextBlockId.value,
      activeSummaryId: s.activeSummaryId.value,
      saveState: s.saveState.value
    }
  })
}

export async function login(page, { username = 'demo', password = 'demo123' } = {}) {
  await page.goto('/')
  const usernameInput = page.locator('#username')
  if (await usernameInput.count()) {
    await usernameInput.click()
    await page.keyboard.type(username)
    await page.keyboard.press('Tab')
    await page.keyboard.type(password)
    await page.keyboard.press('Enter')
  }
  await expect(page.getByTestId('workspace-create-button')).toBeVisible({ timeout: 20_000 })
}

export async function createDocument(page, mode = 'flowchart') {
  await page.getByTestId('workspace-create-button').click()
  await expect(page.getByTestId('create-document-dialog')).toBeVisible()
  await page.getByRole('button', { name: CREATE_LABELS[mode], exact: true }).click()
  await expect(page.locator('.editor-shell')).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(500)
  return readState(page)
}

export async function cleanupDocument(page) {
  try {
    const key = await page.evaluate(() => document.querySelector('#app').__vue_app__._instance.setupState.activeDocumentKey)
    if (key) {
      await page.evaluate(async targetKey => {
        const app = document.querySelector('#app').__vue_app__._instance.setupState
        await app.deleteDocument(targetKey)
      }, key)
    }
  } catch {
    // cleanup must never hide the real test failure
  }
}

export async function canvasBox(page) {
  const box = await page.locator('.diagram-canvas').boundingBox()
  if (!box) throw new Error('canvas is not visible')
  return box
}

export async function canvasPoint(page, fx, fy) {
  const box = await canvasBox(page)
  return { x: box.x + box.width * fx, y: box.y + box.height * fy }
}

export async function dragPaletteToCanvas(page, label, fx, fy) {
  await closeInspector(page)
  const button = page.locator('.palette-panel button').filter({ hasText: label }).first()
  await page.evaluate(() => window.scrollTo(0, 0))
  await button.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest' }))
  await page.waitForTimeout(150)

  let box = await button.boundingBox()
  if (!box) throw new Error(`palette item ${label} has no box`)

  // 吸顶工具栏可能盖住刚滚入视口的图形库按钮，必要时把页面再往下推一点
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const hit = await page.evaluate(({ x, y, text }) => {
      const el = document.elementFromPoint(x, y)
      const target = el?.closest?.('button')
      const toolbarBottom = document.querySelector('.editor-toolbar')?.getBoundingClientRect().bottom || 0
      return { ok: Boolean(target && target.textContent.includes(text)), toolbarBottom }
    }, { x: box.x + box.width / 2, y: box.y + box.height / 2, text: label })
    if (hit.ok) break
    const delta = Math.ceil(hit.toolbarBottom + 24 - box.y)
    await page.evaluate(dy => window.scrollBy(0, dy), delta)
    await page.waitForTimeout(120)
    box = await button.boundingBox()
    if (!box) throw new Error(`palette item ${label} lost after scrolling`)
  }

  const target = await canvasPoint(page, fx, fy)
  await dragMouse(page, center(box), target, { steps: 18, settle: 350 })
}

export async function elementBox(page, selector, { timeout = 10_000 } = {}) {
  const locator = page.locator(selector).first()
  await locator.waitFor({ state: 'visible', timeout })
  const box = await locator.boundingBox()
  if (!box) throw new Error(`no bounding box for ${selector}`)
  return box
}

export async function closeInspector(page) {
  const close = page.getByTestId('inspector-close')
  if (await close.isVisible().catch(() => false)) {
    await close.click()
    await page.waitForTimeout(200)
  }
}

export async function openCanvasContextMenu(page) {
  const point = await canvasPoint(page, 0.8, 0.8)
  await page.mouse.click(point.x, point.y, { button: 'right' })
  await expect(page.getByTestId('context-menu')).toBeVisible()
  return point
}

export async function openMarkdownContextMenu(page) {
  const box = await elementBox(page, '.markdown-editor-shell')
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.3, { button: 'right' })
  await expect(page.getByTestId('markdown-context-menu')).toBeVisible()
}

export async function openContextExportMenu(page) {
  if (await page.locator('.markdown-editor-shell').isVisible().catch(() => false)) {
    await openMarkdownContextMenu(page)
    await page.getByTestId('ctx-md-export').click()
  } else {
    await openCanvasContextMenu(page)
    await page.getByTestId('ctx-canvas-export').click()
  }
  await expect(page.getByTestId('context-submenu')).toBeVisible()
  return page.getByTestId('context-submenu')
}

export function center(box) {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

export async function clickAt(page, point, options = {}) {
  if (options.modifiers?.length) {
    for (const key of options.modifiers) await page.keyboard.down(key)
  }
  await page.mouse.click(point.x, point.y, {
    button: options.button || 'left',
    clickCount: options.clickCount || 1,
    delay: options.delay || 0
  })
  if (options.modifiers?.length) {
    for (const key of [...options.modifiers].reverse()) await page.keyboard.up(key)
  }
  if (options.wait) await page.waitForTimeout(options.wait)
}

export async function dragMouse(page, from, to, { steps = 14, button = 'left', settle = 250, modifier = null } = {}) {
  if (modifier) await page.keyboard.down(modifier)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down({ button })
  await page.mouse.move(to.x, to.y, { steps })
  await page.mouse.up({ button })
  if (modifier) await page.keyboard.up(modifier)
  if (settle) await page.waitForTimeout(settle)
}

export async function nodeBox(page, nodeId) {
  return elementBox(page, `[data-testid="node-shape-${nodeId}"]`)
}

export async function nodeCenter(page, nodeId) {
  return center(await nodeBox(page, nodeId))
}

export async function clickNode(page, nodeId, options = {}) {
  await clickAt(page, await nodeCenter(page, nodeId), { wait: 180, ...options })
}

export async function selectAll(page) {
  await page.keyboard.press('Control+a')
  await page.waitForTimeout(150)
}

/** Return the screen point at `ratio` along an SVG path (0..1). */
export async function pointOnSvgPath(page, selector, ratio = 0.5) {
  return page.evaluate(({ selector: sel, ratio: r }) => {
    const path = document.querySelector(sel)
    if (!path) throw new Error(`missing path ${sel}`)
    const length = path.getTotalLength()
    const point = path.getPointAtLength(length * r)
    const matrix = path.getScreenCTM()
    return {
      x: point.x * matrix.a + point.y * matrix.c + matrix.e,
      y: point.x * matrix.b + point.y * matrix.d + matrix.f
    }
  }, { selector, ratio })
}

export async function dragNode(page, nodeId, dx, dy) {
  const start = await nodeCenter(page, nodeId)
  await dragMouse(page, start, { x: start.x + dx, y: start.y + dy })
}

export async function pressKeys(page, keys) {
  for (const key of keys) {
    await page.keyboard.press(key)
    await page.waitForTimeout(70)
  }
}

export async function expectNoConsoleErrors(page, errors) {
  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([])
}

export function collectConsoleErrors(page) {
  const errors = []
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`))
  return errors
}
