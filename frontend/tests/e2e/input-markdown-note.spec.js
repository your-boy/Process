import { expect, test } from '@playwright/test'
import {
  cleanupDocument,
  collectConsoleErrors,
  createDocument,
  dragMouse,
  elementBox,
  login,
  readState
} from './support/input-helpers.js'

test.afterEach(async ({ page }) => {
  await cleanupDocument(page)
})

async function markdownState(page) {
  return page.evaluate(() => ({
    html: document.querySelector('#markdown-editor .ProseMirror')?.innerHTML || '',
    text: document.querySelector('#markdown-editor .ProseMirror')?.innerText || '',
    source: document.querySelector('[data-testid="markdown-source"]')?.value || '',
    preview: document.querySelector('[data-testid="markdown-preview"]')?.innerHTML || '',
    stateSource: document.querySelector('#app').__vue_app__._instance.setupState.editorState.document.value.content.sourceText
  }))
}

async function resetEditor(page, text) {
  const editor = page.locator('#markdown-editor .ProseMirror')
  await editor.click()
  await page.keyboard.press('Control+a')
  await page.keyboard.press('Delete')
  await page.keyboard.type(text)
  await page.waitForTimeout(200)
  return editor
}

async function clickToolbar(page, name) {
  await page.locator('.markdown-toolbar button').filter({ hasText: name }).first().click()
  await page.waitForTimeout(200)
}

test.describe('输入覆盖 · Markdown', () => {
  test('键盘输入、行内格式、标题/列表/引用/代码块/表格/分隔线', async ({ page }) => {
    const errors = collectConsoleErrors(page)
    await login(page)
    await createDocument(page, 'markdown')
    const editor = page.locator('#markdown-editor .ProseMirror')
    await expect(editor).toBeVisible()

    await resetEditor(page, 'Markdown键盘输入')
    await page.keyboard.press('Control+a')
    await clickToolbar(page, '粗体')
    await expect.poll(async () => (await markdownState(page)).html).toContain('<strong>')
    await page.keyboard.press('Control+a')
    await clickToolbar(page, '斜体')
    await expect.poll(async () => (await markdownState(page)).html).toContain('<em>')
    await page.keyboard.press('Control+a')
    await clickToolbar(page, '下划线')
    await expect.poll(async () => (await markdownState(page)).html).toContain('<u>')
    await page.keyboard.press('Control+a')
    await clickToolbar(page, '删除线')
    await expect.poll(async () => (await markdownState(page)).html).toContain('<s>')
    await page.keyboard.press('Control+a')
    await clickToolbar(page, '行内代码')
    await expect.poll(async () => (await markdownState(page)).html).toContain('<code>')

    // 编辑框右键菜单：文字样式可直接应用
    await resetEditor(page, '右键菜单文字')
    await page.keyboard.press('Control+a')
    const contextParagraph = page.locator('#markdown-editor .ProseMirror p').first()
    const contextBox = await contextParagraph.boundingBox()
    await page.mouse.click(contextBox.x + Math.min(contextBox.width - 2, 20), contextBox.y + contextBox.height / 2, { button: 'right' })
    await expect(page.getByTestId('markdown-context-menu')).toBeVisible()
    await expect(page.getByTestId('ctx-md-export')).toBeVisible()
    await page.getByTestId('ctx-md-underline').click()
    await expect.poll(async () => (await markdownState(page)).html).toContain('<u>')

    // 标题 1/2/3
    for (const [name, tag] of [['标题1', 'h1'], ['标题2', 'h2'], ['标题3', 'h3']]) {
      await resetEditor(page, `标题${tag}`)
      await page.keyboard.press('Control+a')
      await clickToolbar(page, name)
      await expect.poll(async () => (await markdownState(page)).html).toContain(`<${tag}>`)
    }

    // 无序 / 有序 / 任务列表
    for (const [name, needle] of [['列表', '<ul'], ['有序列表', '<ol'], ['任务列表', 'data-type="taskList"']]) {
      await resetEditor(page, '列表项')
      await clickToolbar(page, name)
      await expect.poll(async () => (await markdownState(page)).html).toContain(needle)
    }

    // 引用 / 代码块
    await resetEditor(page, '引用内容')
    await clickToolbar(page, '引用')
    await expect.poll(async () => (await markdownState(page)).html).toContain('<blockquote>')
    await resetEditor(page, '代码块内容')
    await clickToolbar(page, '代码块')
    await expect.poll(async () => (await markdownState(page)).html).toContain('<pre')

    // 表格：先选行列数，再插入；表格内继续增减行列/删除
    await resetEditor(page, '表格')
    await page.getByTestId('markdown-table-toggle').click()
    await expect(page.getByTestId('markdown-table-popover')).toBeVisible()
    const rowLabelBox = await page.getByTestId('markdown-table-rows').locator('..').boundingBox()
    expect(rowLabelBox.height).toBeLessThan(30)
    await page.getByTestId('markdown-table-rows').fill('2')
    await page.getByTestId('markdown-table-cols').fill('2')
    await page.getByTestId('markdown-table-insert').click()
    await expect.poll(async () => (await markdownState(page)).html).toContain('<table')
    let tableHtml = (await markdownState(page)).html
    expect((tableHtml.match(/<tr/g) || []).length).toBe(2)
    expect((tableHtml.match(/<th/g) || []).length).toBe(2)
    const tableBox = await page.locator('#markdown-editor .ProseMirror table').boundingBox()
    expect(tableBox.width).toBeLessThanOrEqual(561)

    // 拖动列边界调整列宽
    const firstHeader = page.locator('#markdown-editor .ProseMirror th').first()
    const headerBefore = await firstHeader.boundingBox()
    await page.mouse.move(headerBefore.x + headerBefore.width - 2, headerBefore.y + headerBefore.height / 2)
    await expect(page.locator('.column-resize-handle').first()).toBeVisible()
    await page.mouse.down()
    await page.mouse.move(headerBefore.x + headerBefore.width + 55, headerBefore.y + headerBefore.height / 2, { steps: 12 })
    await page.mouse.up()
    await page.waitForTimeout(250)
    const headerAfter = await firstHeader.boundingBox()
    expect(headerAfter.width).toBeGreaterThan(headerBefore.width + 30)

    // 最右侧外边框也可拖动，直接改变整张表宽度
    const tableBeforeOuter = await page.locator('#markdown-editor .ProseMirror table').boundingBox()
    const lastHeader = page.locator('#markdown-editor .ProseMirror th').last()
    const lastBox = await lastHeader.boundingBox()
    await page.mouse.move(lastBox.x + lastBox.width - 2, lastBox.y + lastBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(lastBox.x + lastBox.width + 65, lastBox.y + lastBox.height / 2, { steps: 12 })
    await page.mouse.up()
    await page.waitForTimeout(250)
    const tableAfterOuter = await page.locator('#markdown-editor .ProseMirror table').boundingBox()
    expect(tableAfterOuter.width).toBeGreaterThan(tableBeforeOuter.width + 30)

    // 整体宽度 / 行高 / 对齐 / 上移下移
    if (!(await page.getByTestId('markdown-table-popover').isVisible().catch(() => false))) {
      await page.getByTestId('markdown-table-toggle').click()
    }
    await expect(page.getByTestId('markdown-table-popover')).toBeVisible()
    await page.getByTestId('markdown-table-row-height').fill('48')
    await page.getByTestId('markdown-table-row-height').press('Tab')
    await expect.poll(async () => Math.round((await page.locator('#markdown-editor .ProseMirror tr').first().boundingBox()).height)).toBeGreaterThanOrEqual(40)
    await page.getByTestId('markdown-table-align-center').click()
    const centered = await page.locator('#markdown-editor .ProseMirror table').evaluate(element => ({
      marginLeft: getComputedStyle(element).marginLeft,
      marginRight: getComputedStyle(element).marginRight
    }))
    expect(centered.marginLeft).not.toBe('0px')
    expect(centered.marginRight).not.toBe('0px')

    const blockOrder = () => page.evaluate(() => [...document.querySelector('#markdown-editor .ProseMirror').children].map(element => (
      element.querySelector?.('table') ? 'TABLE' : element.tagName
    )))
    const beforeMove = await blockOrder()
    await page.getByTestId('markdown-table-move-up').click()
    await expect.poll(async () => (await blockOrder()).indexOf('TABLE')).toBe(0)
    await page.getByTestId('markdown-table-move-down').click()
    await expect.poll(blockOrder).toEqual(beforeMove)

    // 工具栏上的快捷上下移动按钮可直接重排表格块
    if (await page.getByTestId('markdown-table-popover').isVisible().catch(() => false)) {
      await page.getByTestId('markdown-table-toggle').click()
    }
    const beforeQuickMove = await blockOrder()
    await page.getByTestId('markdown-table-quick-up').click()
    await expect.poll(async () => (await blockOrder()).indexOf('TABLE')).toBe(0)
    await page.getByTestId('markdown-table-quick-down').click()
    await expect.poll(blockOrder).toEqual(beforeQuickMove)

    if (!(await page.getByTestId('markdown-table-popover').isVisible().catch(() => false))) {
      await page.getByTestId('markdown-table-toggle').click()
    }
    await expect(page.getByTestId('markdown-table-popover')).toBeVisible()
    await page.getByTestId('markdown-table-add-row').click()
    await page.getByTestId('markdown-table-add-col').click()
    await expect.poll(async () => {
      const html = (await markdownState(page)).html
      const firstRow = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/)?.[1] || ''
      return [(html.match(/<tr/g) || []).length, (firstRow.match(/<(?:th|td)/g) || []).length]
    }).toEqual([3, 3])
    await page.getByTestId('markdown-table-remove-row').click()
    await page.getByTestId('markdown-table-remove-col').click()
    await expect.poll(async () => {
      const html = (await markdownState(page)).html
      const firstRow = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/)?.[1] || ''
      return [(html.match(/<tr/g) || []).length, (firstRow.match(/<(?:th|td)/g) || []).length]
    }).toEqual([2, 2])
    await page.getByTestId('markdown-table-delete').click()
    await expect.poll(async () => (await markdownState(page)).html).not.toContain('<table')

    // 分隔线
    await resetEditor(page, '分隔线')
    await clickToolbar(page, '分隔线')
    await expect.poll(async () => (await markdownState(page)).html).toContain('<hr')

    // 链接：链接输入框默认隐藏，点击“链接”后才出现
    await resetEditor(page, '链接文字')
    await page.keyboard.press('Control+a')
    await expect(page.getByTestId('markdown-link-input')).toHaveCount(0)
    await page.getByTestId('markdown-link-toggle').click()
    await expect(page.getByTestId('markdown-link-input')).toBeVisible()
    await page.getByTestId('markdown-link-input').fill('https://example.com')
    await page.getByTestId('markdown-link-input').press('Enter')
    await expect.poll(async () => (await markdownState(page)).html).toContain('href="https://example.com')
    await expect(page.getByTestId('markdown-link-input')).toHaveCount(0)

    expect(errors).toEqual([])
  })

  test('Markdown 编辑/源码切换、双向同步、撤销重做、保存、导出', async ({ page }) => {
    await login(page)
    await createDocument(page, 'markdown')

    // 可视化编辑本身就是预览，不再有单独预览面板
    await expect(page.getByTestId('markdown-preview-toggle')).toHaveCount(0)

    await page.getByTestId('markdown-view-source').click()
    await expect(page.getByTestId('markdown-view-source')).toHaveAttribute('aria-selected', 'true')
    const source = page.getByTestId('markdown-source')
    await expect(source).toBeVisible()
    await expect(source).toBeFocused()
    await page.keyboard.press('Control+a')
    await page.keyboard.type('# 标题\n\n- 项目一\n- 项目二\n\n**粗体**')
    await page.waitForTimeout(250)
    let current = await markdownState(page)
    // 源码输入后可视化编辑器立即同步；这就是用户看到的实时预览
    expect(current.html).toContain('<strong>粗体</strong>')
    expect(current.html).toContain('<h1>标题</h1>')

    // 源码框原生 Ctrl+Z / Ctrl+Y
    await source.click()
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(250)
    const afterUndo = await markdownState(page)
    expect(afterUndo.source).not.toBe(current.source)
    await page.keyboard.press('Control+y')
    await page.waitForTimeout(250)
    expect((await markdownState(page)).source).toBe(current.source)

    // 切回可视化编辑，内容仍在
    await page.getByTestId('markdown-view-edit').click()
    await expect(page.getByTestId('markdown-view-edit')).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('#markdown-editor .ProseMirror')).toBeVisible()
    await expect(page.locator('#markdown-editor .ProseMirror')).toContainText('标题')

    // Ctrl+S 保存
    await page.keyboard.press('Control+s')
    await expect.poll(async () => (await readState(page)).saveState, { timeout: 10_000 }).toContain('已同步')

    // 导出：右键编辑框 → 导出 → PNG
    const editorBox = await page.locator('.markdown-editor-shell').boundingBox()
    await page.mouse.click(editorBox.x + editorBox.width * 0.6, editorBox.y + editorBox.height * 0.3, { button: 'right' })
    await expect(page.getByTestId('markdown-context-menu')).toBeVisible()
    await page.getByTestId('ctx-md-export').click()
    await expect(page.getByTestId('context-submenu')).toBeVisible()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('ctx-export-png').click()
    ])
    expect(download.suggestedFilename()).toMatch(/\.png$/i)
  })
})

test.describe('输入覆盖 · 思维笔记', () => {
  async function noteBlockHtml(page) {
    return page.evaluate(() => document.querySelector('#app').__vue_app__._instance.setupState.editorState.document.value.content.textBlocks[0]?.html || '')
  }

  test('富文本键盘快捷键、工具栏点击、双栏视图、加块/缩进/删除', async ({ page }) => {
    const errors = collectConsoleErrors(page)
    await login(page)
    await createDocument(page, 'mind-note')
    const editor = page.locator('.mind-note-editor-prosemirror').first()
    await expect(editor).toBeVisible()
    await editor.click()
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Delete')
    await page.keyboard.type('快捷键文本')
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Control+b')
    await page.waitForTimeout(250)
    expect(await noteBlockHtml(page)).toContain('<strong>')
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Control+i')
    await page.waitForTimeout(250)
    expect(await noteBlockHtml(page)).toContain('<em>')
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Control+u')
    await page.waitForTimeout(250)
    expect(await noteBlockHtml(page)).toContain('<u>')

    // 工具栏粗体按钮：再次点击应取消（因为 Ctrl+B 已是激活态），再点一次恢复
    await page.keyboard.press('Control+a')
    await page.locator('.mind-note-editor-toolbar button').nth(0).click()
    await page.waitForTimeout(200)
    expect(await noteBlockHtml(page)).not.toContain('<strong>')
    await page.keyboard.press('Control+a')
    await page.locator('.mind-note-editor-toolbar button').nth(0).click()
    await page.waitForTimeout(200)
    const html = await noteBlockHtml(page)
    expect(html).toContain('<strong>')

    // 双栏视图
    await page.getByTestId('note-view-toggle').click()
    await expect(page.getByTestId('note-dual-pane')).toBeVisible()
    const before = await readState(page)
    await page.getByTestId('note-add-block').click()
    await expect.poll(async () => (await readState(page)).textBlocks.length).toBe(before.textBlocks.length + 1)
    const stateAfterAdd = await readState(page)
    const target = stateAfterAdd.textBlocks.at(-1)
    const card = page.locator(`[data-testid="note-block-card-${target.id}"]`)
    await card.getByTitle('缩进（设为上一个块的子块）').click()
    await page.waitForTimeout(250)
    expect((await readState(page)).textBlocks.find(block => block.id === target.id).parentId).toBeTruthy()
    await card.getByTitle('取消缩进').click()
    await page.waitForTimeout(250)
    expect((await readState(page)).textBlocks.find(block => block.id === target.id).parentId).toBeFalsy()
    await card.locator('.danger').click()
    await expect.poll(async () => (await readState(page)).textBlocks.some(block => block.id === target.id)).toBe(false)

    expect(errors).toEqual([])
  })

  test('笔记画布：文本块拖动/缩放、Ctrl+F 搜索、Ctrl+滚轮缩放、Ctrl+S 保存、页面标签', async ({ page }) => {
    await login(page)
    let state = await createDocument(page, 'mind-note')
    const block = state.textBlocks[0]
    const activeEditor = page.locator('.mind-note-editor-prosemirror').first()
    await activeEditor.click()
    await page.keyboard.type('搜索要点')
    await page.waitForTimeout(200)
    const blockEl = page.locator(`[data-testid="mind-note-block-${block.id}"]`)
    await blockEl.scrollIntoViewIfNeeded()
    await blockEl.click({ position: { x: 20, y: 20 } })
    await page.waitForTimeout(250)
    const handle = await elementBox(page, `[data-testid="mind-note-handle-${block.id}"]`)
    const beforeDrag = state.textBlocks[0]
    await dragMouse(
      page,
      { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 },
      { x: handle.x + handle.width / 2 - 40, y: handle.y + handle.height / 2 - 40 },
      { steps: 10 }
    )
    const afterDrag = (await readState(page)).textBlocks.find(item => item.id === block.id)
    expect(Math.abs(afterDrag.offsetX - beforeDrag.offsetX) + Math.abs(afterDrag.offsetY - beforeDrag.offsetY)).toBeGreaterThan(5)

    const resize = page.locator('.mind-note-block-resize')
    await resize.scrollIntoViewIfNeeded()
    await page.waitForTimeout(120)
    const resizeHandle = await elementBox(page, '.mind-note-block-resize')
    const beforeResize = afterDrag
    await dragMouse(
      page,
      { x: resizeHandle.x + resizeHandle.width / 2, y: resizeHandle.y + resizeHandle.height / 2 },
      { x: resizeHandle.x + resizeHandle.width / 2 + 50, y: resizeHandle.y + resizeHandle.height / 2 + 25 },
      { steps: 10, settle: 450 }
    )
    const afterResize = (await readState(page)).textBlocks.find(item => item.id === block.id)
    expect(afterResize.width).toBeGreaterThan(beforeResize.width)

    // Ctrl+F 搜索
    await page.keyboard.press('Control+f')
    const search = page.locator('.mindmap-search-input').first()
    await expect(search).toBeFocused()
    await page.keyboard.type('搜索要点')
    await page.waitForTimeout(400)
    await expect(page.getByTestId('mindmap-search-count')).not.toHaveText('0')

    // Ctrl+滚轮缩放（先点空白处让搜索框失焦）
    const svg = page.locator('.diagram-canvas')
    const beforeZoom = (await readState(page)).viewport.zoom
    const box = await svg.boundingBox()
    const zoomPoint = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.9 }
    await page.mouse.click(zoomPoint.x, zoomPoint.y)
    await page.waitForTimeout(150)
    await page.mouse.move(zoomPoint.x, zoomPoint.y)
    await page.keyboard.down('Control')
    await page.mouse.wheel(0, -120)
    await page.keyboard.up('Control')
    await expect.poll(async () => (await readState(page)).viewport.zoom).toBeGreaterThan(beforeZoom)

    // Ctrl+S 保存
    await page.locator('.canvas-hud').click({ position: { x: 4, y: 4 } }).catch(() => {})
    await page.keyboard.press('Control+s')
    await expect.poll(async () => (await readState(page)).saveState, { timeout: 10_000 }).toContain('已同步')

    // 页面标签：新建、双击重命名、Enter、切换、删除
    state = await readState(page)
    const firstPageId = state.pages[0].id
    await page.getByTestId('page-add').click()
    await expect.poll(async () => (await readState(page)).pages.length).toBe(2)
    state = await readState(page)
    const secondPageId = state.pages[1].id
    const secondTab = page.locator(`[data-testid="page-tab-${secondPageId}"]`)
    await secondTab.dblclick()
    const renameInput = secondTab.locator('input')
    await expect(renameInput).toBeFocused()
    await page.keyboard.press('Control+a')
    await page.keyboard.type('键盘页面')
    await page.keyboard.press('Enter')
    await expect(page.locator(`[data-testid="page-tab-${secondPageId}"]`)).toContainText('键盘页面')
    await page.locator(`[data-testid="page-tab-${firstPageId}"]`).click()
    await expect(page.locator(`[data-testid="page-tab-${firstPageId}"]`)).toHaveAttribute('aria-selected', 'true')
    // 键盘 Enter 切换页面
    await page.locator(`[data-testid="page-tab-${secondPageId}"]`).focus()
    await page.keyboard.press('Enter')
    await expect(page.locator(`[data-testid="page-tab-${secondPageId}"]`)).toHaveAttribute('aria-selected', 'true')
    await page.locator(`[data-testid="page-tab-${secondPageId}"]`).getByRole('button', { name: '删除页面' }).click()
    await expect.poll(async () => (await readState(page)).pages.length).toBe(1)
  })

  test('文本块属性抽屉：短标签不换行，抽屉无横向溢出', async ({ page }) => {
    await login(page)
    const state = await createDocument(page, 'mind-note')
    expect(state.textBlocks[0].text).toBe('')
    const block = page.locator('.mind-note-block').first()
    await expect(block.locator('.mind-note-block-handle')).not.toContainText('拖动文本块')
    await block.click({ position: { x: 10, y: 10 } })
    const body = page.getByTestId('inspector-body')
    await expect(body).toBeVisible()
    const indent = body.getByRole('button', { name: /缩进$/ }).first()
    await expect(indent).toBeVisible()
    const indentBox = await indent.boundingBox()
    expect(indentBox.height).toBeLessThanOrEqual(34)
    const metrics = await body.evaluate(element => {
      const buttons = [...element.querySelectorAll('button')].filter(button => {
        const rect = button.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      })
      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clippedButtons: buttons
          .filter(button => button.scrollWidth > button.clientWidth + 1 || button.scrollHeight > button.clientHeight + 1)
          .map(button => button.textContent.trim())
      }
    })
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1)
    expect(metrics.clippedButtons).toEqual([])
  })

  test('笔记画布：未进入编辑的文本块可直接按住块体拖动', async ({ page }) => {
    await login(page)
    const state = await createDocument(page, 'mind-note')
    const firstBlock = state.textBlocks[0]
    const canvas = await page.locator('.diagram-canvas').boundingBox()
    await page.mouse.click(canvas.x + canvas.width * 0.82, canvas.y + canvas.height * 0.86, { button: 'right' })
    await page.getByTestId('ctx-canvas-insert-text').click()
    await expect.poll(async () => (await readState(page)).textBlocks.length).toBe(2)
    await expect(page.getByTestId(`mind-note-preview-${firstBlock.id}`)).toBeVisible()

    const preview = await elementBox(page, `[data-testid="mind-note-preview-${firstBlock.id}"]`)
    const before = (await readState(page)).textBlocks.find(block => block.id === firstBlock.id)
    await dragMouse(
      page,
      { x: preview.x + preview.width / 2, y: preview.y + preview.height / 2 },
      { x: preview.x + preview.width / 2 + 65, y: preview.y + preview.height / 2 + 35 },
      { steps: 12 }
    )
    const after = (await readState(page)).textBlocks.find(block => block.id === firstBlock.id)
    expect(Math.abs(after.offsetX - before.offsetX) + Math.abs(after.offsetY - before.offsetY)).toBeGreaterThan(8)
  })
})
