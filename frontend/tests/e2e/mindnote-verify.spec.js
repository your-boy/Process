import { test, expect } from '@playwright/test'
import JSZip from 'jszip'
import fs from 'node:fs/promises'

test.setTimeout(90_000)

async function login(page) {
  await page.goto('/')
  if (await page.locator('input[placeholder="输入用户名"]').count()) {
    await page.locator('input[placeholder="输入用户名"]').fill('demo')
    await page.locator('input[placeholder="输入密码"]').fill('demo123')
    await page.getByRole('button', { name: '登录', exact: true }).click()
  }
  await expect(page.getByTestId('workspace-create-button')).toBeVisible()
}

async function createByAria(page, ariaLabel) {
  await page.getByTestId('workspace-create-button').click()
  await page.locator(`button[aria-label="${ariaLabel}"]`).click()
  await expect(page.locator('.editor-shell')).toBeVisible()
  await page.waitForTimeout(500)
}

async function currentState(page) {
  return page.evaluate(() => {
    const s = document.querySelector('#app').__vue_app__._instance.setupState.editorState
    return {
      mode: s.document.value.mode,
      id: s.document.value.id,
      title: s.document.value.title,
      activePage: s.document.value.content.activePageId,
      pages: (s.document.value.content.pages || []).map(p => ({ id: p.id, name: p.name, blocks: (p.textBlocks || []).length })),
      blocks: (s.document.value.content.textBlocks || []).map(b => ({
        id: b.id,
        text: b.text,
        html: b.html,
        parentId: b.parentId || null,
        width: b.width,
        height: b.height,
        offsetX: b.offsetX || 0,
        offsetY: b.offsetY || 0,
        order: b.order
      })),
      nodes: (s.document.value.content.nodes || []).map(n => ({
        id: n.id,
        text: n.text,
        note: n.note,
        labels: n.labels || [],
        markers: n.markers || [],
        priority: n.priority,
        progress: n.progress,
        image: n.image || '',
        link: n.link || '',
        tooltip: n.tooltip || '',
        style: n.style || {},
        taskStart: n.taskStart,
        taskDue: n.taskDue,
        assignee: n.assignee,
        attachments: n.attachments || []
      })),
      edges: (s.document.value.content.edges || []).map(edge => ({
        id: edge.id,
        kind: edge.kind || 'flow',
        fromNodeId: edge.fromNodeId,
        toNodeId: edge.toNodeId,
        label: edge.label,
        waypoints: edge.style?.waypoints || []
      })),
      layers: (s.document.value.content.layers || []).map(layer => ({ id: layer.id, name: layer.name, order: layer.order })),
      activeBlock: s.activeTextBlockId.value,
      activeNode: s.activeNodeId.value,
      saveState: s.saveState.value
    }
  })
}

async function deleteCurrent(page) {
  const key = await page.evaluate(() => document.querySelector('#app').__vue_app__._instance.setupState.activeDocumentKey)
  if (!key) return
  await page.getByTestId('topbar-back').click().catch(() => {})
  await page.waitForTimeout(250)
  await page.evaluate(async (targetKey) => {
    const app = document.querySelector('#app').__vue_app__._instance.setupState
    await app.deleteDocument(targetKey)
  }, key)
}

async function openCanvasMenu(page) {
  const canvas = await page.locator('.diagram-canvas').boundingBox()
  await page.mouse.click(canvas.x + canvas.width * 0.8, canvas.y + canvas.height * 0.8, { button: 'right' })
  await expect(page.getByTestId('context-menu')).toBeVisible()
}

async function openExport(page, testId) {
  if (await page.locator('.markdown-workspace').isVisible().catch(() => false)) {
    if (!(await page.locator('.markdown-editor-shell').isVisible().catch(() => false))) {
      await page.getByTestId('markdown-view-edit').click()
      await page.waitForTimeout(150)
    }
    const box = await page.locator('.markdown-editor-shell').boundingBox()
    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.3, { button: 'right' })
    await page.getByTestId('ctx-md-export').click()
  } else {
    const canvas = await page.locator('.diagram-canvas').boundingBox()
    await page.mouse.click(canvas.x + canvas.width * 0.8, canvas.y + canvas.height * 0.8, { button: 'right' })
    await page.getByTestId('ctx-canvas-export').click()
  }
  await expect(page.getByTestId('context-submenu')).toBeVisible()
  return page.getByTestId(testId.replace('export-', 'ctx-export-'))
}

async function expectDownload(page, testId, expectedExt, minSize = 1) {
  const item = await openExport(page, testId)
  const [download] = await Promise.all([page.waitForEvent('download'), item.click()])
  const path = await download.path()
  const stat = await fs.stat(path)
  expect(stat.size).toBeGreaterThanOrEqual(minSize)
  expect(download.suggestedFilename()).toMatch(expectedExt)
  return { path, size: stat.size, name: download.suggestedFilename() }
}

function expectHighResolutionPdf(bytes) {
  const text = Buffer.from(bytes).toString('latin1')
  expect(text).not.toContain('/DCTDecode')
  expect(text).toContain('/Filter /FlateDecode')
  const imageWidths = [...text.matchAll(/\/Width\s+(\d+)/g)].map(match => Number(match[1]))
  expect(Math.max(...imageWidths)).toBeGreaterThanOrEqual(3000)
}

test('思维笔记 · 富文本工具栏逐项可用', async ({ page }) => {
  await login(page)
  await createByAria(page, '新建思维笔记')
  const editor = page.locator('.mind-note-editor-prosemirror').first()
  expect(await page.locator('.mind-note-editor-toolbar button').count()).toBeGreaterThanOrEqual(13)

  const resetType = async (text = '测试内容') => {
    await editor.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.press('Delete')
    await page.keyboard.type(text)
    await page.keyboard.press('Control+A')
  }
  const cases = [
    ['加粗', 0, '<strong>'],
    ['斜体', 1, '<em>'],
    ['下划线', 2, '<u>'],
    ['删除线', 3, '<s>'],
    ['行内代码', 4, '<code>'],
    ['无序列表', 5, '<ul'],
    ['有序列表', 6, '<ol'],
    ['任务列表', 7, 'data-type="taskList"'],
    ['引用', 8, '<blockquote'],
    ['代码块', 9, '<pre'],
    ['表格', 10, '<table']
  ]
  for (const [name, index, needle] of cases) {
    await resetType()
    await page.locator('.mind-note-editor-toolbar button').nth(index).click()
    await page.waitForTimeout(200)
    const html = (await currentState(page)).blocks[0].html
    expect(html, name).toContain(needle)
  }

  await resetType('链接文字')
  page.once('dialog', dialog => dialog.accept('https://example.com'))
  await page.locator('.mind-note-editor-toolbar button').nth(11).click()
  await page.waitForTimeout(300)
  expect((await currentState(page)).blocks[0].html).toContain('href="https://example.com"')

  await resetType('清除测试')
  await page.locator('.mind-note-editor-toolbar button').nth(0).click()
  await page.locator('.mind-note-editor-toolbar button').nth(1).click()
  await page.waitForTimeout(150)
  await editor.click()
  await page.keyboard.press('Control+A')
  await page.locator('.mind-note-editor-toolbar button').nth(12).click()
  await page.waitForTimeout(200)
  expect((await currentState(page)).blocks[0].html).not.toMatch(/<(strong|em|u|s|code)>/)

  await deleteCurrent(page)
})

test('思维笔记 · 双栏、嵌套、增删、缩放、搜索、撤销', async ({ page }) => {
  await login(page)
  await createByAria(page, '新建思维笔记')

  await page.getByTestId('note-view-toggle').click()
  await expect(page.getByTestId('note-dual-pane')).toBeVisible()
  expect(await page.locator('[data-testid^="note-outline-"]').count()).toBeGreaterThan(0)

  const beforeAdd = await currentState(page)
  await page.getByTestId('note-add-block').click()
  await page.waitForTimeout(300)
  const afterAdd = await currentState(page)
  expect(afterAdd.blocks.length).toBe(beforeAdd.blocks.length + 1)

  const target = afterAdd.blocks[afterAdd.blocks.length - 1]
  await page.locator(`[data-testid="note-block-card-${target.id}"]`).getByTitle('缩进（设为上一个块的子块）').click()
  await page.waitForTimeout(250)
  let moved = (await currentState(page)).blocks.find(block => block.id === target.id)
  expect(moved.parentId).toBeTruthy()
  await page.locator(`[data-testid="note-block-card-${target.id}"]`).getByTitle('取消缩进').click()
  await page.waitForTimeout(250)
  moved = (await currentState(page)).blocks.find(block => block.id === target.id)
  expect(moved.parentId).toBeFalsy()

  await page.locator(`[data-testid="note-block-card-${target.id}"] .danger`).click()
  await page.waitForTimeout(250)
  expect((await currentState(page)).blocks.some(block => block.id === target.id)).toBe(false)

  await page.getByTestId('note-view-toggle').click()
  await page.waitForTimeout(300)
  const block = page.locator('.mind-note-block').first()
  await block.scrollIntoViewIfNeeded()
  await block.click({ position: { x: 20, y: 20 } })
  await page.waitForTimeout(250)
  const handle = page.locator('.mind-note-block-resize').first()
  await handle.scrollIntoViewIfNeeded()
  const box = await handle.boundingBox()
  const beforeResize = (await currentState(page)).blocks[0]
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 30, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(350)
  const afterResize = (await currentState(page)).blocks[0]
  expect(afterResize.width).toBeGreaterThan(beforeResize.width)
  expect(afterResize.height).toBeGreaterThan(80)

  const editor = page.locator('.mind-note-editor-prosemirror').first()
  await editor.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Delete')
  await page.keyboard.type('独特搜索词验证')
  await page.waitForTimeout(200)
  const search = page.locator('.mindmap-search-input').first()
  await search.fill('独特搜索词')
  await page.waitForTimeout(400)
  await expect(page.getByTestId('mindmap-search-count')).toHaveText('1')
  await search.fill('')

  const svg = page.locator('.diagram-canvas')
  const zoomBefore = await page.getByTestId('zoom-indicator').textContent()
  await svg.evaluate(el => {
    el.dispatchEvent(new WheelEvent('wheel', {
      deltaY: -120,
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    }))
  })
  await expect.poll(async () => page.getByTestId('zoom-indicator').textContent()).not.toBe(zoomBefore)
  const zoomAfter = await page.getByTestId('zoom-indicator').textContent()
  expect(zoomAfter).not.toBe(zoomBefore)
  await expect(page.locator('.mind-note-block').first()).toHaveCSS('transform', /matrix|scale/)

  const readHtml = () => page.evaluate(() => document.querySelector('#app').__vue_app__._instance.setupState.editorState.document.value.content.textBlocks[0].html)
  const beforeUndo = await readHtml()
  await editor.click()
  await page.keyboard.press('Control+End')
  await page.keyboard.type('ABC')
  await page.waitForTimeout(150)
  await page.locator('.canvas-hud').click({ position: { x: 5, y: 5 } }).catch(() => {})
  await page.waitForTimeout(300)
  expect(await readHtml()).toContain('ABC')
  await page.keyboard.press('Control+Z')
  await page.waitForTimeout(400)
  const afterUndo = await readHtml()
  expect(afterUndo).not.toContain('ABC')
  expect(afterUndo).toBe(beforeUndo)

  await deleteCurrent(page)
})

test('思维笔记 · 多页、保存、历史、任务与附件', async ({ page }) => {
  await login(page)
  await createByAria(page, '新建思维笔记')

  await page.locator('[data-testid^="node-label-"]').first().click({ force: true })
  await page.waitForTimeout(250)
  await page.getByTestId('mindmap-task-start').fill('2026-10-20')
  await page.getByTestId('mindmap-task-due').fill('2026-10-25')
  await page.getByTestId('mindmap-assignee').fill('验证负责人')
  await page.getByTestId('mindmap-assignee').press('Tab')
  await page.waitForTimeout(300)
  const stateAfterTask = await currentState(page)
  const node = stateAfterTask.nodes.find(item => item.id === stateAfterTask.activeNode)
  expect(node.taskStart).toBe('2026-10-20')
  expect(node.taskDue).toBe('2026-10-25')
  expect(node.assignee).toBe('验证负责人')

  await page.getByTestId('mindmap-attachment-name').fill('验证附件')
  await page.getByTestId('mindmap-attachment-url').fill('https://example.com/verify.txt')
  await page.getByTestId('mindmap-add-attachment').click()
  await page.waitForTimeout(300)
  let withAttachment = (await currentState(page)).nodes.find(item => item.attachments.some(a => a.name === '验证附件'))
  expect(withAttachment).toBeTruthy()
  const attachment = withAttachment.attachments.find(a => a.name === '验证附件')
  await page.getByTestId(`mindmap-remove-attachment-${attachment.id}`).click()
  await page.waitForTimeout(250)
  withAttachment = (await currentState(page)).nodes.find(item => item.attachments.some(a => a.name === '验证附件'))
  expect(withAttachment).toBeFalsy()

  const pagesBefore = (await currentState(page)).pages.length
  await page.getByTestId('page-add').click()
  await page.waitForTimeout(350)
  const added = await currentState(page)
  expect(added.pages.length).toBe(pagesBefore + 1)
  await page.locator('[role="tab"]').first().click()
  await page.waitForTimeout(300)

  await openCanvasMenu(page)
  await page.getByTestId('ctx-canvas-save').click()
  await expect.poll(async () => (await currentState(page)).saveState, { timeout: 8000 }).toContain('已同步')
  const saved = await currentState(page)
  expect(saved.id).toBeTruthy()

  await openCanvasMenu(page)
  await page.getByTestId('ctx-canvas-history').click()
  await expect(page.getByTestId('revision-panel')).toBeVisible()
  await expect.poll(
    async () => page.locator('[data-testid^="revision-item-"]').count(),
    { timeout: 8000 }
  ).toBeGreaterThan(0)
  page.once('dialog', dialog => dialog.accept())
  await page.locator('[data-testid^="revision-item-"]').first().getByRole('button').click()
  await expect(page.getByTestId('revision-panel')).toHaveCount(0, { timeout: 8000 })

  await deleteCurrent(page)
})

test('思维笔记 · 全格式导出与内容校验', async ({ page }) => {
  await login(page)
  await createByAria(page, '新建思维笔记')

  const editor = page.locator('.mind-note-editor-prosemirror').first()
  await editor.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Delete')
  await page.keyboard.type('导出富文本标题')
  await page.keyboard.press('Control+A')
  await page.locator('.mind-note-editor-toolbar button').nth(0).click()
  await page.waitForTimeout(200)

  await page.getByTestId('note-view-toggle').click()
  await page.getByTestId('note-add-block').click()
  await page.waitForTimeout(250)
  const blocks = (await currentState(page)).blocks
  const second = blocks[blocks.length - 1]
  const secondEditor = page.locator(`[data-testid="note-block-card-${second.id}"] .mind-note-editor-prosemirror`).first()
  await secondEditor.click()
  await page.keyboard.type('子级备注')
  await page.waitForTimeout(200)
  await page.locator(`[data-testid="note-block-card-${second.id}"]`).getByTitle('缩进（设为上一个块的子块）').click()
  await page.waitForTimeout(250)
  await page.getByTestId('note-view-toggle').click()
  await page.waitForTimeout(250)

  await page.getByTestId('page-add').click()
  await page.waitForTimeout(300)
  await page.locator('[role="tab"]').first().click()
  await page.waitForTimeout(250)

  await openCanvasMenu(page)
  await expect(page.getByTestId('ctx-canvas-export')).toBeVisible()
  await page.keyboard.press('Escape')

  const png = await expectDownload(page, 'export-png', /\.png$/, 1000)
  expect(png.size).toBeGreaterThan(1000)
  expect(png.name).toContain('页面 1')
  await expectDownload(page, 'export-jpg', /\.jpg$/, 1000)
  await expectDownload(page, 'export-svg', /\.svg$/, 1000)
  const md = await expectDownload(page, 'export-markdown', /\.md$/)
  const opml = await expectDownload(page, 'export-opml', /\.opml$/)
  expect(await fs.readFile(md.path, 'utf8')).toContain('📝')
  expect(await fs.readFile(opml.path, 'utf8')).toContain('_note=')

  const xmind = await expectDownload(page, 'export-xmind', /\.xmind$/, 1000)
  const zip = await JSZip.loadAsync(await fs.readFile(xmind.path))
  const sheets = JSON.parse(await zip.file('content.json').async('string'))
  expect(sheets.length).toBe(2)
  const notes = sheets[0].rootTopic.notes.plain.content
  expect(notes).toContain('导出富文本标题')
  expect(notes).toContain('  子级备注')

  const drawio = await expectDownload(page, 'export-drawio', /\.drawio$/, 100)
  expect(await fs.readFile(drawio.path, 'utf8')).toContain('processHtml=')

  const pdf = await expectDownload(page, 'export-pdf', /\.pdf$/i, 1000)
  const pdfHeader = await fs.readFile(pdf.path)
  expect(pdfHeader.subarray(0, 5).toString()).toBe('%PDF-')
  expectHighResolutionPdf(pdfHeader)

  await deleteCurrent(page)
})

test('思维笔记 · 模板与节点属性', async ({ page }) => {
  await login(page)
  await createByAria(page, '新建会议纪要笔记')
  const meeting = await currentState(page)
  expect(meeting.mode).toBe('mind-note')
  expect(meeting.title).toContain('会议纪要')
  expect(meeting.blocks.length).toBeGreaterThan(3)
  await page.getByTestId('note-view-toggle').click()
  await expect(page.getByTestId('note-dual-pane')).toBeVisible()
  await deleteCurrent(page)

  await createByAria(page, '新建复盘笔记')
  const retro = await currentState(page)
  expect(retro.title).toContain('项目复盘')
  expect(retro.blocks.map(block => block.html).join('')).toMatch(/taskList|根因|流程/)
  await deleteCurrent(page)
})

test('导出后再导入：drawio / XMind / Markdown 往返', async ({ page }) => {
  await login(page)

  await createByAria(page, '新建思维笔记')
  const editor = page.locator('.mind-note-editor-prosemirror').first()
  await editor.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Delete')
  await page.keyboard.type('导入往返备注')
  await page.waitForTimeout(200)
  const drawio = await expectDownload(page, 'export-drawio', /\.drawio$/, 100)
  await page.setInputFiles('input[accept=".drawio,.xml"]', drawio.path)
  await page.waitForTimeout(800)
  const importedNote = await currentState(page)
  expect(importedNote.mode).toBe('mind-note')
  expect(importedNote.blocks.some(block => block.text.includes('导入往返备注'))).toBe(true)
  await deleteCurrent(page)

  await createByAria(page, '新建思维导图')
  const xmind = await expectDownload(page, 'export-xmind', /\.xmind$/, 1000)
  await page.setInputFiles('[data-testid="mindmap-import-input"]', xmind.path)
  await page.waitForTimeout(900)
  const importedMap = await currentState(page)
  expect(importedMap.mode).toBe('mindmap')
  expect(importedMap.nodes.length).toBeGreaterThan(0)
  await deleteCurrent(page)

  await createByAria(page, '新建思维导图')
  const outline = await expectDownload(page, 'export-markdown', /\.md$/)
  await page.setInputFiles('[data-testid="mindmap-import-input"]', outline.path)
  await page.waitForTimeout(900)
  const importedOutline = await currentState(page)
  expect(importedOutline.mode).toBe('mindmap')
  expect(importedOutline.nodes.length).toBeGreaterThan(0)
  await deleteCurrent(page)
})

test('思维笔记 · 文本块拖拽、页面重命名/删除', async ({ page }) => {
  await login(page)
  await createByAria(page, '新建思维笔记')

  const block = page.locator('.mind-note-block').first()
  await page.waitForTimeout(600)
  await block.click({ position: { x: 20, y: 20 } })
  await page.waitForTimeout(250)
  const handle = block.locator('.mind-note-block-handle')
  await handle.scrollIntoViewIfNeeded()
  await handle.hover()
  const before = (await currentState(page)).blocks[0]
  const box = await handle.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 45, box.y + box.height / 2 + 25, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(350)
  const moved = (await currentState(page)).blocks[0]
  expect(moved.offsetX ?? 0).not.toBe(before.offsetX ?? 0)
  expect(moved.offsetY ?? 0).not.toBe(before.offsetY ?? 0)

  await page.getByTestId('page-add').click()
  await page.waitForTimeout(300)
  const pages = (await currentState(page)).pages
  const secondPage = pages[1]
  const secondTab = page.getByTestId(`page-tab-${secondPage.id}`)
  await secondTab.dblclick()
  const renameInput = page.locator('.page-rename-input').first()
  await renameInput.fill('验证页面')
  await renameInput.press('Enter')
  await page.waitForTimeout(300)
  expect((await currentState(page)).pages.find(item => item.id === secondPage.id).name).toBe('验证页面')
  await secondTab.locator('.page-tab-remove').click()
  await page.waitForTimeout(300)
  expect((await currentState(page)).pages.length).toBe(1)

  await deleteCurrent(page)
})

test('思维笔记 · 节点样式、标记、优先级、进度、标签、备注、筛选', async ({ page }) => {
  await login(page)
  await createByAria(page, '新建思维笔记')
  await page.locator('.mind-note-block').first().click({ position: { x: 12, y: 12 } })
  await page.waitForTimeout(250)
  await page.locator('[data-testid^="node-label-"]').first().click({ force: true })
  await page.waitForTimeout(250)

  await page.getByTestId('mindmap-shape-rounded').click()
  await page.getByTestId('mindmap-bold').click()
  await page.getByTestId('mindmap-italic').click()
  await page.getByTestId('mindmap-font-size').selectOption('18')
  await page.getByTestId('mindmap-font-size').dispatchEvent('change')
  await page.getByTestId('mindmap-text-color-blue').click()
  await page.getByTestId('mindmap-marker-star').click()
  await page.getByTestId('mindmap-priority-3').click()
  await page.getByTestId('mindmap-progress').selectOption('50')
  await page.waitForTimeout(300)

  const labelInput = page.getByTestId('mindmap-label-input')
  await labelInput.fill('验证标签')
  await labelInput.press('Enter')
  const note = page.getByTestId('mindmap-note')
  await note.fill('验证备注内容')
  await note.press('Tab')
  await page.getByTestId('mindmap-task-start').fill('2026-10-20')
  await page.getByTestId('mindmap-task-start').press('Tab')
  await page.waitForTimeout(400)

  const state = await currentState(page)
  const node = state.nodes.find(item => item.id === state.activeNode)
  expect(node).toMatchObject({
    priority: 3,
    progress: 50,
    assignee: node.assignee,
    taskStart: '2026-10-20'
  })
  expect(node.markers).toContain('star')
  expect(node.labels).toContain('验证标签')
  expect(node.note).toBe('验证备注内容')
  expect(node.style?.shape).toBe('rounded')
  expect(node.style?.bold).toBe(true)
  expect(node.style?.italic).toBe(true)
  expect(Number(node.style?.fontSize)).toBe(18)
  expect(node.style?.textColor).toBeTruthy()

  const filter = page.getByTestId('mindmap-filter')
  await filter.selectOption('task')
  await page.waitForTimeout(350)
  expect(await page.locator('[data-testid^="node-shape-"]').count()).toBeGreaterThan(0)
  await filter.selectOption('label')
  await page.waitForTimeout(350)
  expect(await page.locator('[data-testid^="node-shape-"]').count()).toBeGreaterThan(0)
  await filter.selectOption('')

  await page.locator('.mindmap-search-input').first().fill('#验证标签')
  await page.waitForTimeout(400)
  await expect(page.getByTestId('mindmap-search-count')).toHaveText('1')
  await page.locator('.mindmap-search-input').first().fill('')

  await deleteCurrent(page)
})

test('思维笔记 · 链接/提示/图片、边界/概要、关系线', async ({ page }) => {
  await login(page)
  await createByAria(page, '新建思维笔记')
  const rootId = (await currentState(page)).nodes[0].id
  await page.evaluate((nodeId) => {
    document.querySelector('#app').__vue_app__._instance.setupState.editorState.selectNode(nodeId)
  }, rootId)
  await page.waitForTimeout(250)

  await page.getByTestId('node-link-input').fill('https://example.com/link')
  await page.getByTestId('node-link-input').dispatchEvent('change')
  await page.getByTestId('node-tooltip-input').fill('验证提示')
  await page.getByTestId('node-tooltip-input').dispatchEvent('change')
  await page.getByTestId('node-image-input').fill('https://example.com/image.png')
  await page.getByTestId('node-image-input').dispatchEvent('change')
  await page.waitForTimeout(300)
  const stateAfterNode = await currentState(page)
  const node = stateAfterNode.nodes.find(item => item.id === stateAfterNode.activeNode)
  expect(node.link).toBe('https://example.com/link')
  expect(node.tooltip).toBe('验证提示')
  expect(node.image).toBe('https://example.com/image.png')

  await page.getByTestId('mindmap-add-boundary').click()
  await page.waitForTimeout(300)
  expect(await page.locator('[data-testid^="boundary-"]').count()).toBeGreaterThan(0)
  await page.getByTestId('mindmap-remove-boundary').click()

  await page.getByTestId('mindmap-add-summary').click()
  await page.waitForTimeout(300)
  await expect(page.getByTestId('mindmap-summary-panel')).toBeVisible()
  await page.getByTestId('mindmap-summary-text').fill('概要验证')
  await page.getByTestId('mindmap-summary-text').press('Tab')
  await page.getByTestId('mindmap-remove-summary').click()
  await page.waitForTimeout(250)

  await page.evaluate(() => {
    const s = document.querySelector('#app').__vue_app__._instance.setupState.editorState
    s.addMindmapChildBranch()
  })
  await page.waitForTimeout(350)
  const labels = page.locator('[data-testid^="node-label-"]')
  await labels.first().click({ force: true })
  await page.waitForTimeout(200)
  await page.getByTestId('mindmap-add-relation').click()
  await labels.last().click({ force: true })
  await page.waitForTimeout(350)
  const relations = (await currentState(page)).edges.filter(edge => edge.kind === 'relationship')
  expect(relations.length).toBeGreaterThan(0)

  await deleteCurrent(page)
})

test('思维导图 / 流程图 / Markdown 导出与 drawio 往返', async ({ page }) => {
  await login(page)

  await createByAria(page, '新建思维导图')
  await expectDownload(page, 'export-xmind', /\.xmind$/)
  await expectDownload(page, 'export-svg', /\.svg$/)
  await expectDownload(page, 'export-markdown', /\.md$/)
  await expectDownload(page, 'export-opml', /\.opml$/)
  const mindmapDrawio = await expectDownload(page, 'export-drawio', /\.drawio$/)
  expect(await fs.readFile(mindmapDrawio.path, 'utf8')).toContain('<mxfile')
  await deleteCurrent(page)

  await createByAria(page, '新建绘图')
  await page.keyboard.press('n')
  await page.waitForTimeout(300)
  expect((await currentState(page)).nodes.length).toBeGreaterThan(0)
  await expectDownload(page, 'export-png', /\.png$/)
  await expectDownload(page, 'export-jpg', /\.jpg$/)
  await expectDownload(page, 'export-svg', /\.svg$/)
  const flowchartDrawio = await expectDownload(page, 'export-drawio', /\.drawio$/)
  expect(await fs.readFile(flowchartDrawio.path, 'utf8')).toContain('mxGraphModel')
  await page.setInputFiles('input[accept=".drawio,.xml"]', flowchartDrawio.path)
  await page.waitForTimeout(800)
  const importedFlowchart = await currentState(page)
  expect(importedFlowchart.mode).toBe('flowchart')
  expect(importedFlowchart.nodes.length).toBeGreaterThan(0)

  const flowchartPdf = await expectDownload(page, 'export-pdf', /\.pdf$/i, 1000)
  const flowchartPdfBytes = await fs.readFile(flowchartPdf.path)
  expect(flowchartPdfBytes.subarray(0, 5).toString()).toBe('%PDF-')
  expectHighResolutionPdf(flowchartPdfBytes)
  await deleteCurrent(page)

  await createByAria(page, '新建 Markdown')
  await page.getByTestId('markdown-view-source').click()
  const markdown = page.locator('.markdown-source').first()
  await markdown.fill('# 验证标题\n\n- 列表项\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n')
  await page.waitForTimeout(500)
  await expectDownload(page, 'export-png', /\.png$/)
  await expectDownload(page, 'export-jpg', /\.jpg$/)
  const markdownPdf = await expectDownload(page, 'export-pdf', /\.pdf$/i, 1000)
  const markdownPdfBytes = await fs.readFile(markdownPdf.path)
  expect(markdownPdfBytes.subarray(0, 5).toString()).toBe('%PDF-')
  expectHighResolutionPdf(markdownPdfBytes)
  await deleteCurrent(page)
})
