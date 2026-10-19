import { expect, test } from '@playwright/test'
import fs from 'node:fs/promises'
import {
  canvasBox,
  canvasPoint,
  cleanupDocument,
  collectConsoleErrors,
  createDocument,
  dragMouse,
  elementBox,
  login,
  nodeBox,
  pointOnSvgPath,
  readState
} from './support/input-helpers.js'

test.afterEach(async ({ page }) => {
  await cleanupDocument(page)
})

async function addRect(page, fx = 0.3, fy = 0.3) {
  const button = page.locator('.palette-panel button').filter({ hasText: '矩形' }).first()
  await button.scrollIntoViewIfNeeded()
  const box = await button.boundingBox()
  const target = await canvasPoint(page, fx, fy)
  await dragMouse(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, target, { steps: 16, settle: 300 })
  const state = await readState(page)
  return state.nodes.at(-1)
}

async function downloadFromMenu(page, testId) {
  const point = await canvasPoint(page, 0.8, 0.8)
  await page.mouse.click(point.x, point.y, { button: 'right' })
  await page.getByTestId('ctx-canvas-export').click()
  await expect(page.getByTestId('context-submenu')).toBeVisible()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId(testId.replace('export-', 'ctx-export-')).click()
  ])
  return download
}

test.describe('输入覆盖 · 编辑器外壳与属性面板', () => {
  test('编辑器顶部：返回图标、动作组、右键插入/快捷键、保存、历史面板', async ({ page }) => {
    await login(page)
    await createDocument(page, 'flowchart')

    // 返回按钮在顶层；编辑器内的模式下拉、问号、文件动作按钮均已移除
    await expect(page.locator('.title-input')).toHaveCount(0)
    await expect(page.locator('.mode-select')).toHaveCount(0)
    await expect(page.getByTestId('shortcuts-button')).toHaveCount(0)
    await expect(page.getByTestId('topbar-back')).toBeVisible()
    await expect(page.getByTestId('brand-home')).toBeVisible()
    await expect(page.getByTestId('brand-home')).toHaveClass(/brand-clickable/)
    await expect(page.getByTestId('revision-open')).not.toBeVisible()
    await expect(page.getByTestId('export-menu')).not.toBeVisible()
    await expect(page.getByTestId('import-menu')).not.toBeVisible()
    await expect(page.getByTestId('save-document')).not.toBeVisible()

    const blank = await canvasPoint(page, 0.9, 0.9)
    // 保存 / 历史通过右键菜单完成
    await page.mouse.click(blank.x, blank.y, { button: 'right' })
    await page.getByTestId('ctx-canvas-save').click()
    await expect.poll(async () => (await readState(page)).saveState, { timeout: 10_000 }).toContain('已同步')

    await page.mouse.click(blank.x, blank.y, { button: 'right' })
    await page.getByTestId('ctx-canvas-history').click()
    await expect(page.getByTestId('revision-panel')).toBeVisible()
    await page.getByTestId('revision-close').click()
    await expect(page.getByTestId('revision-panel')).toHaveCount(0)

    // 右键“插入样式”区域可插入矩形；文件操作也可在右键菜单完成
    const beforeInsert = (await readState(page)).nodes.length
    await page.mouse.click(blank.x, blank.y, { button: 'right' })
    await expect(page.getByTestId('ctx-canvas-save')).toBeVisible()
    await expect(page.getByTestId('ctx-canvas-history')).toBeVisible()
    await expect(page.getByTestId('ctx-canvas-export')).toBeVisible()
    await expect(page.getByTestId('ctx-canvas-import')).toBeVisible()
    await expect(page.getByTestId('ctx-canvas-insert-process')).toBeVisible()
    await page.getByTestId('ctx-canvas-export').click()
    await expect(page.getByTestId('context-submenu')).toBeVisible()
    await expect(page.getByTestId('ctx-export-png')).toBeVisible()
    // Esc 关闭导出子菜单
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('context-submenu')).toHaveCount(0)

    await page.mouse.click(blank.x, blank.y, { button: 'right' })
    await page.getByTestId('ctx-canvas-insert-process').click()
    await expect.poll(async () => (await readState(page)).nodes.length).toBe(beforeInsert + 1)

    // 右键菜单里的“快捷键选项”打开快捷键面板
    await page.mouse.click(blank.x, blank.y, { button: 'right' })
    await page.getByTestId('ctx-canvas-shortcuts').click()
    await expect(page.getByTestId('shortcuts-close')).toBeVisible()
    await page.getByTestId('shortcuts-close').click()
    await expect(page.getByTestId('shortcuts-close')).toHaveCount(0)

    // 顶层返回按钮回文件列表
    await page.getByTestId('topbar-back').click()
    await expect(page.getByTestId('workspace-create-button')).toBeVisible()
  })

  test('流程图属性面板：X/Y/宽/高/旋转/文本/链接/提示/图片、锁定、对齐、分布', async ({ page }) => {
    await login(page)
    await createDocument(page, 'flowchart')
    const a = await addRect(page, 0.22, 0.3)
    await page.waitForTimeout(250)
    // 第二个节点用键盘 N 创建，避免图形库滚动后被吸顶工具栏遮住
    const addPoint = await canvasPoint(page, 0.72, 0.55)
    await page.mouse.click(addPoint.x, addPoint.y)
    await page.keyboard.press('n')
    await expect.poll(async () => (await readState(page)).nodes.length).toBe(2)
    const b = (await readState(page)).nodes.at(-1)
    const aBox = await nodeBox(page, a.id)
    await page.mouse.click(aBox.x + aBox.width / 2, aBox.y + aBox.height / 2)
    await expect(page.getByTestId('property-panel')).toBeVisible()

    const field = label => page.locator('.property-panel .property-grid label').filter({ hasText: label }).locator('input').first()
    const xInput = field('X')
    await xInput.click()
    await page.keyboard.press('Control+a')
    await page.keyboard.type('300')
    await page.keyboard.press('Tab')
    await expect.poll(async () => Math.round((await readState(page)).nodes.find(node => node.id === a.id).x)).toBe(300)

    const yInput = field('Y')
    await yInput.click()
    await page.keyboard.press('Control+a')
    await page.keyboard.type('260')
    await yInput.press('Tab')
    await expect.poll(async () => Math.round((await readState(page)).nodes.find(node => node.id === a.id).y)).toBe(260)

    const rotation = page.getByTestId('rotation-input')
    await rotation.click()
    await page.keyboard.press('Control+a')
    await page.keyboard.type('15')
    await rotation.press('Tab')
    await expect.poll(async () => (await readState(page)).nodes.find(node => node.id === a.id).rotation).toBe(15)

    // 自定义尺寸后可一键恢复该图形类型的默认宽高
    const widthInput = field('宽')
    await widthInput.click()
    await page.keyboard.press('Control+a')
    await page.keyboard.type('260')
    await widthInput.press('Tab')
    const heightInput = field('高')
    await heightInput.click()
    await page.keyboard.press('Control+a')
    await page.keyboard.type('128')
    await heightInput.press('Tab')
    await expect.poll(async () => {
      const node = (await readState(page)).nodes.find(item => item.id === a.id)
      return [Math.round(node.width), Math.round(node.height)]
    }).toEqual([260, 128])
    await page.getByTestId('inspector-reset-node-size').click()
    await expect.poll(async () => {
      const node = (await readState(page)).nodes.find(item => item.id === a.id)
      return [Math.round(node.width), Math.round(node.height)]
    }).toEqual([Math.round(a.width), Math.round(a.height)])

    const textInput = page.getByTestId('node-text-input')
    await textInput.click()
    await page.keyboard.press('Control+a')
    await page.keyboard.type('属性面板改名')
    await page.keyboard.press('Enter')
    await expect.poll(async () => (await readState(page)).nodes.find(node => node.id === a.id).text).toBe('属性面板改名')

    // 链接 / 提示 / 图片
    await page.getByTestId('node-link-input').fill('https://example.com/property')
    await page.getByTestId('node-link-input').press('Tab')
    await page.getByTestId('node-tooltip-input').fill('属性提示')
    await page.getByTestId('node-tooltip-input').press('Tab')
    await page.getByTestId('node-image-input').fill('https://example.com/p.png')
    await page.getByTestId('node-image-input').press('Tab')
    await expect.poll(async () => {
      const node = (await readState(page)).nodes.find(item => item.id === a.id)
      return [node.link, node.tooltip, node.image]
    }).toEqual(['https://example.com/property', '属性提示', 'https://example.com/p.png'])

    // 锁定/解锁按钮（属性抽屉）
    await page.getByTestId('inspector-node-lock').click()
    await expect.poll(async () => (await readState(page)).nodes.find(node => node.id === a.id).locked).toBe(true)
    await page.getByTestId('inspector-node-lock').click()
    await expect.poll(async () => (await readState(page)).nodes.find(node => node.id === a.id).locked).toBe(false)

    // 颜色预设（属性抽屉；不再额外占一整行工具栏）
    const presetBefore = (await readState(page)).nodes.find(node => node.id === a.id).style.accent
    const presets = page.locator('[data-testid^="inspector-node-preset-"]')
    await expect(presets).toHaveCount(5)
    await presets.nth(1).click()
    await expect.poll(async () => (await readState(page)).nodes.find(node => node.id === a.id).style.accent).not.toBe(presetBefore)

    // 多选后对齐/分布（先点画布空白，确保 Ctrl+A 不落在输入框里）
    const blank = await canvasPoint(page, 0.9, 0.9)
    await page.mouse.click(blank.x, blank.y)
    await page.keyboard.press('Control+a')
    await page.waitForTimeout(150)
    const alignToolbar = page.locator('.selection-toolbar-shell .align-toolbar')
    await alignToolbar.getByRole('button', { name: '左', exact: true }).click()
    await page.waitForTimeout(250)
    const aligned = (await readState(page)).nodes
    expect(Math.round(aligned[0].x)).toBe(Math.round(aligned[1].x))
    await alignToolbar.getByRole('button', { name: '水平', exact: true }).click()
    await page.waitForTimeout(250)
    expect((await readState(page)).nodes.length).toBe(2)
  })

  test('画布右键菜单：新建、全选、粘贴、适应、网格、清除参考线', async ({ page }) => {
    await login(page)
    await createDocument(page, 'flowchart')
    const a = await addRect(page, 0.3, 0.3)
    const blank = await canvasPoint(page, 0.75, 0.75)

    // 右键文件菜单：打印与 PDF 导出是两个独立入口
    await page.mouse.click(blank.x, blank.y, { button: 'right' })
    await expect(page.getByTestId('ctx-canvas-print')).toHaveText('打印')
    await page.getByTestId('ctx-canvas-export').click()
    await expect(page.getByTestId('ctx-export-pdf')).toHaveText('PDF')
    await page.keyboard.press('Escape')

    // 打印入口打开独立打印预览，顶部两个按钮分别为“打印 / PDF”
    await page.mouse.click(blank.x, blank.y, { button: 'right' })
    const [printPopup] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByTestId('ctx-canvas-print').click()
    ])
    await printPopup.waitForLoadState('domcontentloaded')
    const printActions = printPopup.locator('.toolbar-actions button')
    await expect(printActions).toHaveCount(2)
    await expect(printActions.nth(0)).toHaveText('打印')
    await expect(printActions.nth(1)).toHaveText('PDF')
    await printPopup.close()

    // 新建节点
    await page.mouse.click(blank.x, blank.y, { button: 'right' })
    await expect(page.getByTestId('ctx-canvas-new')).toBeVisible()
    await page.getByTestId('ctx-canvas-new').click()
    await expect.poll(async () => (await readState(page)).nodes.length).toBe(2)

    // 全选
    await page.mouse.click(blank.x, blank.y, { button: 'right' })
    await page.getByTestId('ctx-canvas-select-all').click()
    await page.waitForTimeout(200)
    expect(await page.locator('.node-shape.selected').count()).toBe(2)

    // 复制 + 粘贴
    await page.keyboard.press('Control+c')
    await page.mouse.click(blank.x, blank.y, { button: 'right' })
    await page.getByTestId('ctx-canvas-paste').click()
    await expect.poll(async () => (await readState(page)).nodes.length).toBe(4)

    // 网格开关
    const gridBefore = (await readState(page)).showGrid
    await page.mouse.click(blank.x, blank.y, { button: 'right' })
    await page.getByTestId('ctx-canvas-grid').click()
    await expect.poll(async () => (await readState(page)).showGrid).toBe(!gridBefore)

    // 参考线：拖出后通过右键菜单清除
    const ruler = await elementBox(page, '.ruler-h')
    await dragMouse(
      page,
      { x: ruler.x + 200, y: ruler.y + ruler.height / 2 },
      { x: ruler.x + 260, y: ruler.y + 240 },
      { steps: 10 }
    )
    await expect.poll(async () => (await readState(page)).guides.length).toBe(1)
    await page.mouse.click(blank.x, blank.y, { button: 'right' })
    await page.getByTestId('ctx-canvas-clear-guides').click()
    await expect.poll(async () => (await readState(page)).guides.length).toBe(0)

    // 适应按钮重置视口
    await page.mouse.click(blank.x, blank.y, { button: 'right' })
    await page.getByTestId('ctx-canvas-fit').click()
    await expect.poll(async () => (await readState(page)).viewport).toEqual({ x: 0, y: 0, zoom: 1 })
  })

  test('导入导出：导出 drawio/XMind/Markdown 后再导入', async ({ page }) => {
    await login(page)

    // 流程图 drawio 往返
    await createDocument(page, 'flowchart')
    await addRect(page, 0.35, 0.35)
    const drawio = await downloadFromMenu(page, 'export-drawio')
    expect(drawio.suggestedFilename()).toMatch(/\.drawio$/i)
    const drawioPath = await drawio.path()
    expect((await fs.stat(drawioPath)).size).toBeGreaterThan(100)
    await page.setInputFiles('input[accept=".drawio,.xml"]', drawioPath)
    await page.waitForTimeout(800)
    expect((await readState(page)).nodes.length).toBeGreaterThan(0)

    // 思维导图 XMind 往返
    await page.getByTestId('topbar-back').click()
    await createDocument(page, 'mindmap')
    const rootBox = await elementBox(page, '[data-testid^="node-shape-"]')
    await page.mouse.dblclick(rootBox.x + rootBox.width / 2, rootBox.y + rootBox.height / 2)
    await page.keyboard.press('Tab')
    await page.keyboard.type('导入导出分支')
    await page.mouse.click(rootBox.x + 6, rootBox.y + rootBox.height / 2)
    await page.waitForTimeout(300)
    const xmind = await downloadFromMenu(page, 'export-xmind')
    expect(xmind.suggestedFilename()).toMatch(/\.xmind$/i)
    const xmindPath = await xmind.path()
    expect((await fs.stat(xmindPath)).size).toBeGreaterThan(500)
    await page.setInputFiles('[data-testid="mindmap-import-input"]', xmindPath)
    await page.waitForTimeout(900)
    expect((await readState(page)).nodes.length).toBeGreaterThan(0)

    // 思维导图 Markdown 大纲往返
    const markdown = await downloadFromMenu(page, 'export-markdown')
    expect(markdown.suggestedFilename()).toMatch(/\.md$/i)
    await page.setInputFiles('[data-testid="mindmap-import-input"]', await markdown.path())
    await page.waitForTimeout(900)
    expect((await readState(page)).nodes.length).toBeGreaterThan(0)
  })
})

test.describe('输入覆盖 · 各模块工作区自适应', () => {
  test('1280×720 下画布吃满剩余高度，节点/文本块在视口内且页面不溢出', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await login(page)

    const modes = ['flowchart', 'mindmap', 'mind-note', 'markdown']
    for (const mode of modes) {
      await createDocument(page, mode)
      if (mode === 'flowchart') {
        await addRect(page, 0.3, 0.3)
      }
      await page.waitForTimeout(250)
      const metrics = await page.evaluate(() => {
        const rect = selector => {
          const element = document.querySelector(selector)
          if (!element) return null
          const box = element.getBoundingClientRect()
          return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width, height: box.height }
        }
        return {
          viewport: { width: window.innerWidth, height: window.innerHeight },
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
          canvas: rect('.diagram-canvas'),
          node: rect('[data-testid^="node-shape-"]'),
          noteBlock: rect('.mind-note-block'),
          markdownEditor: rect('.markdown-editor-shell')
        }
      })
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewport.width + 1)
      expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.viewport.height + 1)
      if (mode === 'markdown') {
        expect(metrics.markdownEditor.height).toBeGreaterThan(300)
        expect(metrics.markdownEditor.bottom).toBeLessThanOrEqual(metrics.viewport.height + 1)
      } else {
        expect(metrics.canvas.height).toBeGreaterThan(300)
        expect(metrics.canvas.bottom).toBeLessThanOrEqual(metrics.viewport.height + 1)
        const target = mode === 'mind-note' ? metrics.noteBlock : metrics.node
        expect(target).not.toBeNull()
        expect(target.top).toBeGreaterThanOrEqual(0)
        expect(target.bottom).toBeLessThanOrEqual(metrics.viewport.height + 1)
      }

      await cleanupDocument(page)
      await page.goto('/')
      await expect(page.getByTestId('workspace-create-button')).toBeVisible({ timeout: 20_000 })
    }
  })

  test('画布铺满可视区：放大窗口后画布同步扩展，页面内容等比缩放且完整可见', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await login(page)
    const state = await createDocument(page, 'mindmap')
    const root = state.nodes[0]
    const smallCanvas = await canvasBox(page)
    const smallNode = await nodeBox(page, root.id)

    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.waitForTimeout(400)
    const largeCanvas = await canvasBox(page)
    const largeNode = await nodeBox(page, root.id)
    const metrics = await page.evaluate(() => {
      const surface = document.querySelector('[data-testid="canvas-surface"]').getBoundingClientRect()
      const canvas = document.querySelector('.diagram-canvas').getBoundingClientRect()
      return {
        viewport: { width: innerWidth, height: innerHeight },
        surface: { top: surface.top, bottom: surface.bottom, left: surface.left, right: surface.right },
        canvas: { top: canvas.top, bottom: canvas.bottom, left: canvas.left, right: canvas.right },
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight
      }
    })

    expect(largeCanvas.width).toBeGreaterThan(smallCanvas.width + 300)
    expect(largeCanvas.height).toBeGreaterThan(smallCanvas.height + 200)
    expect(largeCanvas.width).toBeGreaterThan(metrics.viewport.width * 0.65)
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewport.width + 1)
    expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.viewport.height + 1)
    expect(metrics.surface.left).toBeGreaterThanOrEqual(metrics.canvas.left - 1)
    expect(metrics.surface.right).toBeLessThanOrEqual(metrics.canvas.right + 1)
    expect(metrics.surface.top).toBeGreaterThanOrEqual(metrics.canvas.top - 1)
    expect(metrics.surface.bottom).toBeLessThanOrEqual(metrics.canvas.bottom + 1)
    expect(largeNode.x).toBeGreaterThanOrEqual(metrics.canvas.left - 1)
    expect(largeNode.x + largeNode.width).toBeLessThanOrEqual(metrics.canvas.right + 1)
    expect(largeNode.y).toBeGreaterThanOrEqual(metrics.canvas.top - 1)
    expect(largeNode.y + largeNode.height).toBeLessThanOrEqual(metrics.canvas.bottom + 1)
    expect(Math.abs(largeNode.width / smallNode.width - largeCanvas.width / smallCanvas.width)).toBeLessThan(0.15)
  })
})
