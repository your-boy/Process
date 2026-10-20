import { expect, test } from '@playwright/test'
import {
  canvasBox,
  cleanupDocument,
  closeInspector,
  collectConsoleErrors,
  createDocument,
  dragMouse,
  elementBox,
  login,
  nodeBox,
  nodeCenter,
  pointOnSvgPath,
  readState
} from './support/input-helpers.js'

async function expectInlineField(labelLocator, inputLocator) {
  const labelBox = await labelLocator.boundingBox()
  const inputBox = await inputLocator.boundingBox()
  expect(labelBox).toBeTruthy()
  expect(inputBox).toBeTruthy()
  expect(inputBox.x).toBeGreaterThan(labelBox.x + labelBox.width)
  expect(Math.abs((labelBox.y + labelBox.height / 2) - (inputBox.y + inputBox.height / 2))).toBeLessThanOrEqual(4)
}

test.afterEach(async ({ page }) => {
  await cleanupDocument(page)
})

async function commitOverlayBySelectingActiveNode(page) {
  const state = await readState(page)
  const activeNodeId = state.activeNodeId
  const canvas = await canvasBox(page)
  // 点击画布空白提交并结束编辑，再点回节点恢复选中
  await page.mouse.click(canvas.x + 8, canvas.y + canvas.height - 8)
  await page.waitForTimeout(250)
  const box = await nodeBox(page, activeNodeId)
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(250)
}

async function createMindmapWithTree(page) {
  await createDocument(page, 'mindmap')
  const rootBox = await elementBox(page, '[data-testid^="node-shape-"]')
  await page.mouse.dblclick(rootBox.x + rootBox.width / 2, rootBox.y + rootBox.height / 2)
  const overlay = page.getByTestId('text-overlay-input')
  await expect(overlay).toBeVisible()
  await page.waitForTimeout(180)
  await page.keyboard.press('Control+a')
  await page.keyboard.type('中心主题')
  await page.keyboard.press('Tab')
  await expect(overlay).toBeVisible()
  await page.waitForTimeout(180)
  await page.keyboard.type('分支A')
  await page.keyboard.press('Enter')
  await expect(overlay).toBeVisible()
  await page.waitForTimeout(180)
  await page.keyboard.type('分支B')
  await commitOverlayBySelectingActiveNode(page)
  await expect.poll(async () => (await readState(page)).nodes.length).toBe(3)
  await page.waitForTimeout(250)
  return readState(page)
}

function findNode(state, text) {
  return state.nodes.find(node => node.text === text)
}

test.describe('输入覆盖 · 思维导图', () => {
  test('键盘：双击编辑、Tab 子主题、Enter 同级、Shift+Tab 提升、Ctrl+Enter 父主题、删除分支', async ({ page }) => {
    const errors = collectConsoleErrors(page)
    await login(page)
    await createDocument(page, 'mindmap')

    const rootBox = await elementBox(page, '[data-testid^="node-shape-"]')
    await page.mouse.dblclick(rootBox.x + rootBox.width / 2, rootBox.y + rootBox.height / 2)
    await expect(page.getByTestId('text-overlay-input')).toBeVisible()
    await expect(page.getByTestId('text-overlay-input')).toBeFocused()
    await page.keyboard.press('Control+a')
    await page.keyboard.type('项目中心')
    await page.keyboard.press('Tab')
    await page.keyboard.type('分支一')
    await page.keyboard.press('Enter')
    await page.keyboard.type('分支二')
    await commitOverlayBySelectingActiveNode(page)
    await page.waitForTimeout(200)

    let state = await readState(page)
    expect(state.nodes).toHaveLength(3)
    const root = state.nodes.find(node => !node.parentId)
    const branch1 = findNode(state, '分支一')
    const branch2 = findNode(state, '分支二')
    expect(root.text).toBe('项目中心')
    expect(branch1.parentId).toBe(root.id)
    expect(branch2.parentId).toBe(root.id)

    // 给分支一添加孙主题，再 Shift+Tab 提升
    const b1Box = await nodeBox(page, branch1.id)
    await page.mouse.dblclick(b1Box.x + b1Box.width / 2, b1Box.y + b1Box.height / 2)
    await page.keyboard.press('Tab')
    await page.keyboard.type('孙主题')
    await commitOverlayBySelectingActiveNode(page)
    await page.waitForTimeout(200)
    state = await readState(page)
    const grand = findNode(state, '孙主题')
    expect(grand.parentId).toBe(branch1.id)

    await page.keyboard.press('Shift+Tab')
    await page.waitForTimeout(300)
    state = await readState(page)
    expect(findNode(state, '孙主题').parentId).toBe(root.id)

    // Ctrl+Enter 插入父主题
    await page.keyboard.press('Control+Enter')
    await page.waitForTimeout(300)
    state = await readState(page)
    const inserted = state.nodes.find(node => node.text === '新主题')
    expect(inserted).toBeTruthy()
    expect(findNode(state, '孙主题').parentId).toBe(inserted.id)

    // Delete 删除插入的父主题及其子树
    const beforeDelete = state.nodes.length
    await page.keyboard.press('Delete')
    await expect.poll(async () => (await readState(page)).nodes.length).toBe(beforeDelete - 2)

    // 根主题不能删除
    state = await readState(page)
    const rootId = state.nodes.find(node => !node.parentId).id
    const rootBoxNow = await nodeBox(page, rootId)
    await page.mouse.click(rootBoxNow.x + rootBoxNow.width / 2, rootBoxNow.y + rootBoxNow.height / 2)
    await page.keyboard.press('Delete')
    await page.waitForTimeout(300)
    state = await readState(page)
    expect(state.nodes.some(node => node.id === rootId)).toBe(true)
    expect(errors).toEqual([])
  })

  test('节点文字浮层：长文本完整换行，编辑时仍可直接拖动节点', async ({ page }) => {
    await login(page)
    await createDocument(page, 'mindmap')
    const rootBox = await elementBox(page, '[data-testid^="node-shape-"]')
    await page.mouse.dblclick(rootBox.x + rootBox.width / 2, rootBox.y + rootBox.height / 2)
    const input = page.getByTestId('text-overlay-input')
    await expect(input).toBeVisible()
    await page.keyboard.press('Control+a')
    const longText = '项目中心主题文字完整显示验证，长文本编辑时按住节点仍然可以直接拖动'
    await page.keyboard.type(longText)
    await expect.poll(async () => (await input.boundingBox())?.width || 0).toBeGreaterThan(180)
    const box = await input.boundingBox()
    const metrics = await input.evaluate(element => ({
      clientWidth: element.clientWidth,
      clientHeight: element.clientHeight,
      scrollWidth: element.scrollWidth,
      scrollHeight: element.scrollHeight,
      value: element.value
    }))
    expect(box.width).toBeGreaterThan(180)
    expect(box.height).toBeGreaterThan(30)
    expect(metrics.value).toBe(longText)
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1)
    expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight + 1)

    const before = (await readState(page)).nodes[0]
    await dragMouse(
      page,
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
      { x: box.x + box.width / 2 + 90, y: box.y + box.height / 2 + 45 },
      { steps: 12 }
    )
    await expect(input).toHaveCount(0)
    const after = (await readState(page)).nodes.find(node => node.id === before.id)
    expect(after.text).toBe(longText)
    expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBeGreaterThan(10)
  })

  test('单节点快捷样式只出现在右侧属性抽屉，不再占顶部整行', async ({ page }) => {
    await login(page)
    const state = await createDocument(page, 'mindmap')
    const root = state.nodes[0]
    const canvasBefore = await canvasBox(page)
    const box = await nodeBox(page, root.id)
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await page.waitForTimeout(250)

    await expect(page.locator('.selection-toolbar-shell')).toHaveCount(0)
    const actions = page.getByTestId('inspector-node-actions')
    await expect(actions).toBeVisible()
    await expect(page.getByTestId('inspector-node-lock')).toBeVisible()
    await expect(page.locator('[data-testid^="inspector-node-preset-"]')).toHaveCount(5)
    const canvasAfter = await canvasBox(page)
    expect(Math.abs(canvasAfter.y - canvasBefore.y)).toBeLessThanOrEqual(1)

    await page.getByTestId('inspector-node-preset-blue-glow').click()
    await expect.poll(async () => {
      const node = (await readState(page)).nodes.find(item => item.id === root.id)
      return node.style.accent
    }).toBe('blue')
  })

  test('鼠标：节点拖动、双击/连点折叠、浮动主题、布局主题、全部折叠/展开', async ({ page }) => {
    await login(page)
    let state = await createMindmapWithTree(page)
    const root = state.nodes.find(node => !node.parentId)
    const branchA = findNode(state, '分支A')
    const branchB = findNode(state, '分支B')

    // 拖动分支节点
    const beforeDrag = state.nodes.find(node => node.id === branchA.id)
    const box = await nodeBox(page, branchA.id)
    await dragMouse(
      page,
      { x: box.x + 10, y: box.y + box.height / 2 },
      { x: box.x + 80, y: box.y + box.height / 2 + 60 },
      { steps: 12 }
    )
    const afterState = await readState(page)
    const afterDrag = afterState.nodes.find(node => node.id === branchA.id)
    expect(Math.abs(afterDrag.x - beforeDrag.x) + Math.abs(afterDrag.y - beforeDrag.y)).toBeGreaterThan(10)
    // 拖动一个主题只移动它自己；通过边相连的父/兄弟主题不跟着位移。
    for (const untouchedId of state.nodes.filter(node => node.id !== branchA.id).map(node => node.id)) {
      const before = state.nodes.find(node => node.id === untouchedId)
      const after = afterState.nodes.find(node => node.id === untouchedId)
      expect(Math.abs(after.x - before.x)).toBeLessThan(1)
      expect(Math.abs(after.y - before.y)).toBeLessThan(1)
    }
    expect(afterState.edges).toHaveLength(state.edges.length)

    // 给分支A添加子主题，用于折叠测试
    const aBox = await nodeBox(page, branchA.id)
    await page.mouse.dblclick(aBox.x + aBox.width / 2, aBox.y + aBox.height / 2)
    await page.keyboard.press('Tab')
    await page.keyboard.type('折叠子项')
    await commitOverlayBySelectingActiveNode(page)
    await page.waitForTimeout(200)
    state = await readState(page)
    const child = findNode(state, '折叠子项')

    // 拖动叶子子主题时，只移动子主题自身；父分支和通过连线相连的节点保持原位。
    const parentBeforeChildDrag = state.nodes.find(node => node.id === branchA.id)
    const childBox = await nodeBox(page, child.id)
    await dragMouse(
      page,
      { x: childBox.x + childBox.width / 2, y: childBox.y + childBox.height / 2 },
      { x: childBox.x + childBox.width / 2 + 45, y: childBox.y + childBox.height / 2 + 25 },
      { steps: 12 }
    )
    state = await readState(page)
    const childAfterDrag = state.nodes.find(node => node.id === child.id)
    const parentAfterChildDrag = state.nodes.find(node => node.id === branchA.id)
    expect(Math.abs(childAfterDrag.x - child.x) + Math.abs(childAfterDrag.y - child.y)).toBeGreaterThan(8)
    expect(Math.abs(parentAfterChildDrag.x - parentBeforeChildDrag.x)).toBeLessThan(1)
    expect(Math.abs(parentAfterChildDrag.y - parentBeforeChildDrag.y)).toBeLessThan(1)

    // 连点两次（约 400ms）折叠
    const collapseBox = await nodeBox(page, branchA.id)
    const cx = collapseBox.x + collapseBox.width / 2
    const cy = collapseBox.y + collapseBox.height / 2
    await page.mouse.click(cx, cy)
    await page.waitForTimeout(420)
    await page.mouse.click(cx, cy)
    await page.waitForTimeout(350)
    state = await readState(page)
    expect(state.nodes.find(node => node.id === branchA.id).collapsed).toBe(true)
    await expect(page.locator(`[data-testid="node-shape-${child.id}"]`)).toHaveCount(0)

    await page.waitForTimeout(1000)
    const collapsedBox = await nodeBox(page, branchA.id)
    const ecx = collapsedBox.x + collapsedBox.width / 2
    const ecy = collapsedBox.y + collapsedBox.height / 2
    await page.mouse.click(ecx, ecy)
    await page.waitForTimeout(420)
    await page.mouse.click(ecx, ecy)
    await page.waitForTimeout(350)
    await expect(page.locator(`[data-testid="node-shape-${child.id}"]`)).toHaveCount(1)

    // 浮动主题
    await page.getByTestId('mindmap-add-floating').click()
    await page.waitForTimeout(300)
    state = await readState(page)
    expect(state.nodes.some(node => node.floating)).toBe(true)

    // 属性抽屉覆盖右侧面板，先关闭抽屉再操作布局/主题面板
    await closeInspector(page)

    // 布局、主题、分支样式、彩虹、编号
    await page.getByTestId('mindmap-layout-left').click()
    await expect.poll(async () => (await readState(page)).layout.direction).toBe('left')
    await page.getByTestId('mindmap-theme-ocean').click()
    await expect.poll(async () => (await readState(page)).layout.theme).toBe('ocean')
    const branchStyleButton = page.locator('[data-testid^="mindmap-branch-"]').first()
    const branchStyleId = (await branchStyleButton.getAttribute('data-testid')).replace('mindmap-branch-', '')
    await branchStyleButton.click()
    await expect.poll(async () => (await readState(page)).layout.branchStyle).toBe(branchStyleId)
    await page.getByTestId('mindmap-rainbow').click()
    await expect.poll(async () => Boolean((await readState(page)).layout.rainbow)).toBe(true)
    await page.getByTestId('mindmap-numbering').click()
    await expect.poll(async () => Boolean((await readState(page)).layout.numbering)).toBe(true)

    // 全部折叠/展开
    await page.getByTestId('mindmap-collapse-all').click()
    await page.waitForTimeout(300)
    state = await readState(page)
    expect(state.nodes.filter(node => !node.floating).every(node => node.collapsed || !node.parentId)).toBe(true)
    await page.getByTestId('mindmap-expand-all').click()
    await page.waitForTimeout(300)
    state = await readState(page)
    expect(state.nodes.every(node => !node.collapsed)).toBe(true)
  })

  test('搜索栏靠左：可按标签命中，重置按钮恢复全部节点', async ({ page }) => {
    await login(page)
    const state = await createMindmapWithTree(page)
    const branch = findNode(state, '分支A')
    const box = await nodeBox(page, branch.id)
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await page.getByTestId('mindmap-label-input').fill('标签检索')
    await page.getByTestId('mindmap-label-input').press('Enter')
    await expect.poll(async () => (await readState(page)).nodes.find(item => item.id === branch.id).labels).toContain('标签检索')

    const search = page.getByTestId('mindmap-search')
    const searchBox = await search.boundingBox()
    expect(searchBox.x).toBeLessThan(400)
    await search.click()
    await page.keyboard.type('标签检索')
    await expect(page.getByTestId('mindmap-search-count')).toHaveText('1')
    await expect(page.locator('.node-shape.search-hit')).toHaveCount(1)
    await page.getByTestId('mindmap-filter').selectOption('label')
    await expect(page.getByTestId('mindmap-search-count')).toHaveText('1')

    await page.getByTestId('mindmap-search-reset').click()
    await expect(search).toHaveValue('')
    await expect(page.getByTestId('mindmap-filter')).toHaveValue('')
    await expect(page.getByTestId('mindmap-search-count')).toHaveCount(0)
    await expect(page.locator('.node-shape')).toHaveCount(3)
  })

  test('属性面板：形状/字号/颜色/标记/优先级/进度/备注/标签/任务/附件/链接', async ({ page }) => {
    await login(page)
    let state = await createMindmapWithTree(page)
    const branch = findNode(state, '分支A')
    const box = await nodeBox(page, branch.id)
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(page.getByTestId('mindmap-node-panel')).toBeVisible()

    await page.getByTestId('mindmap-shape-underline').click()
    await page.getByTestId('mindmap-bold').click()
    await page.getByTestId('mindmap-italic').click()
    await page.locator('[data-testid="mindmap-font-size"]').selectOption('20')
    await page.getByTestId('mindmap-text-color-rose').click()
    await page.waitForTimeout(250)
    state = await readState(page)
    let node = state.nodes.find(item => item.id === branch.id)
    expect(node.style.shape).toBe('underline')
    expect(node.style.bold).toBe(true)
    expect(node.style.italic).toBe(true)
    expect(node.style.fontSize).toBe(20)
    expect(node.style.textColor).toBeTruthy()

    // 标记
    const markerButtons = page.locator('[data-testid^="mindmap-marker-"]')
    const markerCount = await markerButtons.count()
    expect(markerCount).toBeGreaterThan(0)
    const markerId = (await markerButtons.first().getAttribute('data-testid')).replace('mindmap-marker-', '')
    await markerButtons.first().click()
    await page.waitForTimeout(250)
    state = await readState(page)
    expect(state.nodes.find(item => item.id === branch.id).markers).toContain(markerId)
    await page.locator(`[data-testid="node-badge-${branch.id}-${markerId}"]`).click()
    await page.waitForTimeout(250)
    expect((await readState(page)).nodes.find(item => item.id === branch.id).markers).not.toContain(markerId)

    // 优先级 / 进度
    const priorityButton = page.getByTestId('mindmap-priority-2')
    await priorityButton.scrollIntoViewIfNeeded()
    await priorityButton.click()
    await page.locator('[data-testid="mindmap-progress"]').selectOption('75')
    await page.waitForTimeout(250)
    state = await readState(page)
    node = state.nodes.find(item => item.id === branch.id)
    expect(node.priority).toBe(2)
    expect(Number(node.progress)).toBe(75)

    // 备注：键盘输入并切走提交
    const note = page.getByTestId('mindmap-note')
    await note.click()
    await page.keyboard.type('键盘输入的备注')
    await page.keyboard.press('Tab')
    await expect.poll(async () => (await readState(page)).nodes.find(item => item.id === branch.id).note).toContain('键盘输入的备注')

    // 标签：Enter 提交，点击移除
    const labelInput = page.getByTestId('mindmap-label-input')
    await labelInput.click()
    await page.keyboard.type('键盘标签')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(250)
    state = await readState(page)
    expect(state.nodes.find(item => item.id === branch.id).labels).toContain('键盘标签')
    await page.getByTestId('mindmap-label-键盘标签').click()
    await page.waitForTimeout(250)
    expect((await readState(page)).nodes.find(item => item.id === branch.id).labels).not.toContain('键盘标签')

    // 任务日期 / 负责人：标签与输入框左右并排
    const start = page.getByTestId('mindmap-task-start')
    const due = page.getByTestId('mindmap-task-due')
    await expectInlineField(page.locator('.mindmap-field').filter({ hasText: '开始' }).locator('span'), start)
    await expectInlineField(page.locator('.mindmap-field').filter({ hasText: '截止' }).locator('span'), due)
    await start.fill('2026-11-01')
    await start.press('Tab')
    await due.fill('2026-11-10')
    await due.press('Tab')
    const assignee = page.getByTestId('mindmap-assignee')
    await assignee.click()
    await page.keyboard.type('键盘负责人')
    await page.keyboard.press('Tab')
    await expect.poll(async () => (await readState(page)).nodes.find(item => item.id === branch.id).assignee).toBe('键盘负责人')

    // 附件：键盘填写后点击添加
    await page.getByTestId('mindmap-attachment-name').fill('键盘附件')
    await page.getByTestId('mindmap-attachment-url').fill('https://example.com/input.txt')
    await page.getByTestId('mindmap-add-attachment').click()
    await page.waitForTimeout(300)
    state = await readState(page)
    node = state.nodes.find(item => item.id === branch.id)
    expect(node.attachments.some(item => item.name === '键盘附件')).toBe(true)
    const attachment = node.attachments.find(item => item.name === '键盘附件')
    await page.getByTestId(`mindmap-remove-attachment-${attachment.id}`).click()
    await expect.poll(async () => (await readState(page)).nodes.find(item => item.id === branch.id).attachments.length).toBe(0)

    // 链接 / 提示 / 图片
    await page.getByTestId('node-link-input').fill('https://example.com/node')
    await page.getByTestId('node-link-input').press('Tab')
    await page.getByTestId('node-tooltip-input').fill('键盘提示')
    await page.getByTestId('node-tooltip-input').press('Tab')
    await page.getByTestId('node-image-input').fill('https://example.com/a.png')
    await page.getByTestId('node-image-input').press('Tab')
    await expect.poll(async () => {
      const item = (await readState(page)).nodes.find(node => node.id === branch.id)
      return [item.link, item.tooltip, item.image]
    }).toEqual(['https://example.com/node', '键盘提示', 'https://example.com/a.png'])
  })

  test('边界/概要/关系线、演示键盘、聚焦、搜索、文本块', async ({ page }) => {
    await login(page)
    let state = await createMindmapWithTree(page)
    const root = state.nodes.find(node => !node.parentId)
    const branchA = findNode(state, '分支A')
    const branchB = findNode(state, '分支B')

    // 边界
    const aBox = await nodeBox(page, branchA.id)
    await page.mouse.click(aBox.x + aBox.width / 2, aBox.y + aBox.height / 2)
    await page.getByTestId('mindmap-add-boundary').click()
    await page.waitForTimeout(300)
    state = await readState(page)
    expect(state.boundaries.some(item => item.nodeId === branchA.id)).toBe(true)
    await page.getByTestId('mindmap-remove-boundary').click()
    await expect.poll(async () => (await readState(page)).boundaries.length).toBe(0)

    // 关系线：点“添加关系”后点击目标节点
    await page.getByTestId('mindmap-add-relation').click()
    const bBox = await nodeBox(page, branchB.id)
    await page.mouse.click(bBox.x + bBox.width / 2, bBox.y + bBox.height / 2)
    await page.waitForTimeout(350)
    state = await readState(page)
    expect(state.edges.some(edge => edge.kind === 'relationship')).toBe(true)
    const relation = state.edges.find(edge => edge.kind === 'relationship')
    // 关系线创建后选中目标节点，关系面板不显示；点击关系线再删除
    const relationPoint = await pointOnSvgPath(page, `[data-testid="edge-path-${relation.id}"]`, 0.5)
    await page.mouse.click(relationPoint.x, relationPoint.y)
    await page.waitForTimeout(250)
    await page.getByTestId('mindmap-remove-relation').click()
    await expect.poll(async () => (await readState(page)).edges.some(edge => edge.id === relation.id)).toBe(false)

    // 概要：多选两个分支后添加
    const boxA = await nodeBox(page, branchA.id)
    const boxB = await nodeBox(page, branchB.id)
    await page.mouse.click(boxA.x + boxA.width / 2, boxA.y + boxA.height / 2)
    await page.keyboard.down('Shift')
    await page.mouse.click(boxB.x + boxB.width / 2, boxB.y + boxB.height / 2)
    await page.keyboard.up('Shift')
    await page.waitForTimeout(250)
    await page.getByTestId('mindmap-add-summary').click()
    await page.waitForTimeout(300)
    state = await readState(page)
    expect(state.summaries.length).toBe(1)
    const summaryInput = page.getByTestId('mindmap-summary-text')
    await expect(summaryInput).toBeVisible()
    await summaryInput.click()
    await page.keyboard.type('概要文字')
    await page.keyboard.press('Tab')
    await expect.poll(async () => (await readState(page)).summaries[0].text).toContain('概要文字')
    await page.getByTestId('mindmap-remove-summary').click()
    await expect.poll(async () => (await readState(page)).summaries.length).toBe(0)

    // 聚焦
    await page.getByTestId('mindmap-focus').click()
    await expect(page.getByTestId('focus-exit')).toBeVisible()
    // 抽屉可能先吃掉一次 Esc，再按一次退出聚焦
    await page.keyboard.press('Escape')
    if (await page.getByTestId('focus-exit').count()) {
      await page.keyboard.press('Escape')
    }
    await expect(page.getByTestId('focus-exit')).toHaveCount(0)

    // 演示：重新选中节点以打开属性抽屉，再进入演示
    const presentNodeBox = await nodeBox(page, branchA.id)
    await page.mouse.click(presentNodeBox.x + presentNodeBox.width / 2, presentNodeBox.y + presentNodeBox.height / 2)
    await page.waitForTimeout(300)
    const presentButton = page.getByTestId('mindmap-present')
    await presentButton.scrollIntoViewIfNeeded()
    await presentButton.click()
    await expect(page.getByTestId('presentation-overlay')).toBeVisible()
    const slideCounter = page.locator('.presentation-progress').first()
    const first = await slideCounter.textContent()
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(250)
    expect(await slideCounter.textContent()).not.toBe(first)
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(250)
    expect(await slideCounter.textContent()).toBe(first)
    // 底部按钮翻页
    await page.getByTestId('presentation-next').click()
    await page.waitForTimeout(250)
    expect(await slideCounter.textContent()).not.toBe(first)
    await page.getByTestId('presentation-prev').click()
    await page.waitForTimeout(250)
    expect(await slideCounter.textContent()).toBe(first)
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('presentation-overlay')).toHaveCount(0)

    // Ctrl+F 聚焦搜索框，输入过滤；随后点击节点并插入文本块
    await page.keyboard.press('Control+f')
    const search = page.locator('.mindmap-search-input').first()
    await expect(search).toBeFocused()
    await page.keyboard.type('分支A')
    await page.waitForTimeout(400)
    await expect(page.getByTestId('mindmap-search-count')).not.toHaveText('0')
    const rootBox = await nodeBox(page, root.id)
    await page.mouse.click(rootBox.x + rootBox.width / 2, rootBox.y + rootBox.height / 2)
    await page.waitForTimeout(200)
    await page.keyboard.press('m')
    await page.waitForTimeout(300)
    state = await readState(page)
    expect(state.textBlocks.length).toBe(1)
    const block = state.textBlocks[0]
    const handle = await elementBox(page, `[data-testid="mind-note-handle-${block.id}"]`)
    const beforeBlock = state.textBlocks[0]
    await dragMouse(
      page,
      { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 },
      { x: handle.x + handle.width / 2 + 40, y: handle.y + handle.height / 2 - 30 },
      { steps: 10 }
    )
    const movedBlock = (await readState(page)).textBlocks.find(item => item.id === block.id)
    expect(Math.abs(movedBlock.offsetX - beforeBlock.offsetX) + Math.abs(movedBlock.offsetY - beforeBlock.offsetY)).toBeGreaterThan(5)

    const resizeLocator = page.locator('.mind-note-block-resize')
    await resizeLocator.scrollIntoViewIfNeeded()
    await page.waitForTimeout(150)
    const resizeHandle = await elementBox(page, '.mind-note-block-resize')
    const beforeResize = movedBlock
    await dragMouse(
      page,
      { x: resizeHandle.x + resizeHandle.width / 2, y: resizeHandle.y + resizeHandle.height / 2 },
      { x: resizeHandle.x + resizeHandle.width / 2 + 40, y: resizeHandle.y + resizeHandle.height / 2 + 25 },
      { steps: 10, settle: 500 }
    )
    const afterResize = (await readState(page)).textBlocks.find(item => item.id === block.id)
    expect(afterResize.width).toBeGreaterThan(beforeResize.width)
    await page.locator(`[data-testid="mind-note-block-${block.id}"] .mind-note-block-remove`).click()
    await expect.poll(async () => (await readState(page)).textBlocks.length).toBe(0)
  })
})
