import { expect, test } from '@playwright/test'
import {
  canvasBox,
  canvasPoint,
  cleanupDocument,
  closeInspector,
  collectConsoleErrors,
  createDocument,
  dragMouse,
  dragNode,
  dragPaletteToCanvas,
  elementBox,
  login,
  nodeBox,
  nodeCenter,
  pointOnSvgPath,
  readState
} from './support/input-helpers.js'

test.afterEach(async ({ page }) => {
  await cleanupDocument(page)
})

async function addNode(page, label, fx, fy) {
  const before = (await readState(page)).nodes.length
  await dragPaletteToCanvas(page, label, fx, fy)
  await expect.poll(async () => (await readState(page)).nodes.length).toBe(before + 1)
  return (await readState(page)).nodes.at(-1)
}

async function selectNode(page, nodeId) {
  const box = await nodeBox(page, nodeId)
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(180)
}

async function shiftClickNode(page, nodeId) {
  const box = await nodeBox(page, nodeId)
  await page.keyboard.down('Shift')
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.keyboard.up('Shift')
  await page.waitForTimeout(180)
}

test.describe('输入覆盖 · 流程图画布', () => {
  test('拖入图形、节点拖动、Shift 多选、框选、组合/取消组合', async ({ page }) => {
    const errors = collectConsoleErrors(page)
    await login(page)
    await createDocument(page, 'flowchart')

    await expect(page.locator('.canvas-empty')).toHaveCount(0)
    const emptyStatus = page.getByTestId('canvas-empty-status')
    await expect(emptyStatus).toHaveText('空白')
    const emptyStatusStyle = await emptyStatus.evaluate(element => {
      const style = getComputedStyle(element)
      return { position: style.position, width: style.width, height: style.height }
    })
    expect(emptyStatusStyle).toEqual({ position: 'absolute', width: '1px', height: '1px' })

    // 图形库搜索框：键盘过滤
    const search = page.locator('.palette-search').first()
    await expect(search).toBeVisible()
    const totalPalette = await page.locator('.palette-panel button').count()
    await search.click()
    await page.keyboard.type('菱形')
    await page.waitForTimeout(300)
    const filteredPalette = await page.locator('.palette-panel button').count()
    expect(filteredPalette).toBeLessThan(totalPalette)
    await search.click()
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Delete')
    await page.waitForTimeout(250)

    const a = await addNode(page, '矩形', 0.22, 0.32)
    const b = await addNode(page, '菱形', 0.68, 0.32)
    expect(a.id).not.toBe(b.id)

    // 拖拽节点：真实按下-移动-松开
    const beforeDrag = (await readState(page)).nodes.find(node => node.id === a.id)
    await dragNode(page, a.id, 55, 40)
    const afterDrag = (await readState(page)).nodes.find(node => node.id === a.id)
    expect(afterDrag.x).toBeGreaterThan(beforeDrag.x + 30)
    expect(afterDrag.y).toBeGreaterThan(beforeDrag.y + 20)

    // Shift 点选第二个节点
    await selectNode(page, a.id)
    await shiftClickNode(page, b.id)
    expect(await page.locator('.node-shape.selected').count()).toBe(2)

    // 多选后拖拽其中一个，另一个应一起移动
    const beforeMulti = await readState(page)
    const aBefore = beforeMulti.nodes.find(node => node.id === a.id)
    const bBefore = beforeMulti.nodes.find(node => node.id === b.id)
    await dragNode(page, b.id, 40, 0)
    const afterMulti = await readState(page)
    const aAfter = afterMulti.nodes.find(node => node.id === a.id)
    const bAfter = afterMulti.nodes.find(node => node.id === b.id)
    expect(Math.round(aAfter.x - aBefore.x)).toBe(Math.round(bAfter.x - bBefore.x))

    // 空白处开始框选，覆盖两个节点
    const start = await canvasPoint(page, 0.02, 0.9)
    const end = await canvasPoint(page, 0.95, 0.08)
    await dragMouse(page, start, end, { steps: 18, modifier: 'Shift' })
    expect(await page.locator('.node-shape.selected').count()).toBe(2)

    // 工具栏组合/取消组合
    await page.getByTestId('group-nodes').click()
    await page.waitForTimeout(250)
    let state = await readState(page)
    const groupIds = state.nodes.map(node => node.groupId)
    expect(groupIds[0]).toBeTruthy()
    expect(groupIds[0]).toBe(groupIds[1])

    await page.getByTestId('ungroup-nodes').click()
    await page.waitForTimeout(250)
    state = await readState(page)
    expect(state.nodes.every(node => !node.groupId)).toBe(true)

    expect(errors).toEqual([])
  })

  test('节点文字浮层：长文本完整换行，编辑时仍可直接拖动节点', async ({ page }) => {
    await login(page)
    await createDocument(page, 'flowchart')
    const node = await addNode(page, '矩形', 0.35, 0.35)
    const box = await nodeBox(page, node.id)
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2)
    const input = page.getByTestId('text-overlay-input')
    await expect(input).toBeVisible()
    await page.keyboard.press('Control+a')
    const longText = '流程节点文字完整显示验证，长文本编辑时按住节点仍然可以直接拖动'
    await page.keyboard.type(longText)
    await page.waitForTimeout(300)
    const overlay = await input.boundingBox()
    const metrics = await input.evaluate(element => ({
      clientWidth: element.clientWidth,
      clientHeight: element.clientHeight,
      scrollWidth: element.scrollWidth,
      scrollHeight: element.scrollHeight,
      value: element.value
    }))
    expect(overlay.width).toBeGreaterThan(180)
    expect(metrics.value).toBe(longText)
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1)
    expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight + 1)

    const before = (await readState(page)).nodes.find(item => item.id === node.id)
    await dragMouse(
      page,
      { x: overlay.x + overlay.width / 2, y: overlay.y + overlay.height / 2 },
      { x: overlay.x + overlay.width / 2 + 75, y: overlay.y + overlay.height / 2 + 45 },
      { steps: 12 }
    )
    await expect(input).toHaveCount(0)
    const after = (await readState(page)).nodes.find(item => item.id === node.id)
    expect(after.text).toBe(longText)
    expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBeGreaterThan(10)
  })

  test('缩放手柄：四方向拖拽改变位置与尺寸', async ({ page }) => {
    await login(page)
    await createDocument(page, 'flowchart')
    const node = await addNode(page, '矩形', 0.35, 0.35)
    await selectNode(page, node.id)

    const resize = async (dir, dx, dy) => {
      const handle = await elementBox(page, `.resize-handle.dir-${dir}`)
      const from = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 }
      await dragMouse(page, from, { x: from.x + dx, y: from.y + dy }, { steps: 10 })
    }

    const s0 = (await readState(page)).nodes.find(item => item.id === node.id)
    await resize('se', 45, 30)
    const s1 = (await readState(page)).nodes.find(item => item.id === node.id)
    expect(s1.width).toBeGreaterThan(s0.width + 20)
    expect(s1.height).toBeGreaterThan(s0.height + 15)

    await resize('nw', -25, -18)
    const s2 = (await readState(page)).nodes.find(item => item.id === node.id)
    expect(s2.x).toBeLessThan(s1.x)
    expect(s2.y).toBeLessThan(s1.y)
    expect(s2.width).toBeGreaterThan(s1.width)
    expect(s2.height).toBeGreaterThan(s1.height)

    await resize('e', 25, 0)
    const s3 = (await readState(page)).nodes.find(item => item.id === node.id)
    expect(s3.width).toBeGreaterThan(s2.width + 10)

    await resize('s', 0, 25)
    const s4 = (await readState(page)).nodes.find(item => item.id === node.id)
    expect(s4.height).toBeGreaterThan(s3.height + 10)

    // 旋转手柄：按住拖动旋转节点
    const rotationHandle = await elementBox(page, '[data-testid="rotation-handle"]')
    const centerPoint = await nodeCenter(page, node.id)
    await dragMouse(
      page,
      { x: rotationHandle.x + rotationHandle.width / 2, y: rotationHandle.y + rotationHandle.height / 2 },
      { x: centerPoint.x + 100, y: centerPoint.y },
      { steps: 14, settle: 350 }
    )
    const rotated = (await readState(page)).nodes.find(item => item.id === node.id)
    expect(Math.abs(rotated.rotation)).toBeGreaterThan(20)
  })

  test('连接点拖线、连线选择/标签/路由/折点/删除', async ({ page }) => {
    const errors = collectConsoleErrors(page)
    await login(page)
    await createDocument(page, 'flowchart')
    const a = await addNode(page, '矩形', 0.20, 0.35)
    const b = await addNode(page, '矩形', 0.72, 0.35)

    // 选中源节点后，四个连接点应显示且可拖拽
    await selectNode(page, a.id)
    const anchors = page.locator('.node-anchor-dot')
    await expect(anchors).toHaveCount(4)
    // 右侧连接点（节点外偏移，避免和缩放手柄重叠）
    const anchorBox = await anchors.nth(1).boundingBox()
    const target = await nodeCenter(page, b.id)
    await dragMouse(
      page,
      { x: anchorBox.x + anchorBox.width / 2, y: anchorBox.y + anchorBox.height / 2 },
      target,
      { steps: 20, settle: 400 }
    )

    let state = await readState(page)
    expect(state.edges).toHaveLength(1)
    const edge = state.edges[0]
    expect(edge.fromNodeId).toBe(a.id)
    expect(edge.toNodeId).toBe(b.id)

    // 点击连线选中（避开中点折点手柄）
    const edgePoint = await pointOnSvgPath(page, `[data-testid="edge-path-${edge.id}"]`, 0.28)
    await page.mouse.click(edgePoint.x, edgePoint.y)
    await page.waitForTimeout(250)
    expect((await readState(page)).activeEdgeId).toBe(edge.id)

    // 右键菜单：改为直线
    await page.mouse.click(edgePoint.x, edgePoint.y, { button: 'right' })
    await page.waitForTimeout(200)
    await expect(page.getByTestId('context-menu')).toBeVisible()
    await page.getByTestId('ctx-route-straight').click()
    await page.waitForTimeout(250)
    state = await readState(page)
    expect(state.edges[0].route).toBe('straight')

    // 直线中点的折点手柄拖拽
    const straightPoint = await pointOnSvgPath(page, `[data-testid="edge-path-${edge.id}"]`, 0.28)
    await page.mouse.click(straightPoint.x, straightPoint.y)
    await page.waitForTimeout(250)
    expect((await readState(page)).activeEdgeId).toBe(edge.id)
    const waypointsBefore = (await readState(page)).edges[0].waypoints.length
    const handleSelector = (await page.locator('.edge-handle.midpoint').count())
      ? '.edge-handle.midpoint'
      : '.edge-handle.vertex'
    const midpoint = await elementBox(page, handleSelector)
    const from = { x: midpoint.x + midpoint.width / 2, y: midpoint.y + midpoint.height / 2 }
    await dragMouse(page, from, { x: from.x + 30, y: from.y + 70 }, { steps: 12 })
    state = await readState(page)
    expect(state.edges[0].waypoints.length).toBeGreaterThanOrEqual(Math.max(1, waypointsBefore))

    // 双击连线加标签（避开折点手柄）
    const labelPoint = await pointOnSvgPath(page, `[data-testid="edge-path-${edge.id}"]`, 0.36)
    await page.mouse.dblclick(labelPoint.x, labelPoint.y)
    await expect(page.getByTestId('edge-label-input')).toBeVisible()
    await page.keyboard.type('键盘分支')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(250)
    expect((await readState(page)).edges[0].label).toBe('键盘分支')

    // 右键删除连线之前：工具栏路由/线型/箭头/颜色逐项点击
    const stylePoint = await pointOnSvgPath(page, `[data-testid="edge-path-${edge.id}"]`, 0.2)
    await page.mouse.click(stylePoint.x, stylePoint.y)
    await page.waitForTimeout(250)
    await page.getByRole('button', { name: '曲线', exact: true }).click()
    await expect.poll(async () => (await readState(page)).edges[0].route).toBe('curve')
    await page.getByRole('button', { name: '虚线', exact: true }).click()
    await expect.poll(async () => (await readState(page)).edges[0].stroke).toBe('dashed')
    await page.getByRole('button', { name: '点线', exact: true }).click()
    await expect.poll(async () => (await readState(page)).edges[0].stroke).toBe('dotted')
    await page.getByRole('button', { name: '实线', exact: true }).click()
    await expect.poll(async () => (await readState(page)).edges[0].stroke).toBe('solid')
    await page.getByRole('button', { name: '双箭头', exact: true }).click()
    await expect.poll(async () => (await readState(page)).edges[0].marker).toBe('double-arrow')
    await page.getByRole('button', { name: '无线头', exact: true }).click()
    await expect.poll(async () => (await readState(page)).edges[0].marker).toBe('none')
    await page.getByTestId('edge-marker-dot').click()
    await expect.poll(async () => (await readState(page)).edges[0].marker).toBe('dot')
    await page.getByTestId('edge-marker-diamond').click()
    await expect.poll(async () => (await readState(page)).edges[0].marker).toBe('diamond')
    await page.getByTestId('edge-marker-square').click()
    await expect.poll(async () => (await readState(page)).edges[0].marker).toBe('square')
    await page.getByTestId('edge-color-teal').click()
    await expect.poll(async () => (await readState(page)).edges[0].accent).toBeTruthy()

    // 右键删除连线
    const deletePoint = await pointOnSvgPath(page, `[data-testid="edge-path-${edge.id}"]`, 0.2)
    await page.mouse.click(deletePoint.x, deletePoint.y, { button: 'right' })
    await page.waitForTimeout(200)
    await page.getByTestId('ctx-delete-edge').click()
    await expect.poll(async () => (await readState(page)).edges.length).toBe(0)
    expect(errors).toEqual([])
  })

  test('点击连接点后再点目标节点即可连线，Esc/空白可取消', async ({ page }) => {
    await login(page)
    await createDocument(page, 'flowchart')
    const a = await addNode(page, '矩形', 0.20, 0.35)
    const b = await addNode(page, '矩形', 0.72, 0.35)
    await selectNode(page, a.id)

    const useAnchor = async index => {
      const anchor = await page.locator('.node-anchor-dot').nth(index).boundingBox()
      await page.mouse.click(anchor.x + anchor.width / 2, anchor.y + anchor.height / 2)
      await page.waitForTimeout(200)
    }

    await useAnchor(1)
    await expect(page.locator('.connect-preview')).toBeVisible()
    let target = await nodeCenter(page, b.id)
    await page.mouse.click(target.x, target.y)
    await expect.poll(async () => (await readState(page)).edges.length).toBe(1)
    let edge = (await readState(page)).edges[0]
    expect(edge.fromNodeId).toBe(a.id)
    expect(edge.toNodeId).toBe(b.id)
    expect(edge.fromAnchor).toBeTruthy()
    expect(edge.toAnchor).toBeTruthy()

    // Esc 取消待连接状态，不会误连到下一次点击的节点
    await selectNode(page, a.id)
    await useAnchor(0)
    await page.keyboard.press('Escape')
    await expect(page.locator('.connect-preview')).toHaveCount(0)
    target = await nodeCenter(page, b.id)
    await page.mouse.click(target.x, target.y)
    await expect.poll(async () => (await readState(page)).edges.length).toBe(1)

    // 点空白取消待连接状态
    await selectNode(page, a.id)
    await useAnchor(2)
    const blank = await canvasPoint(page, 0.9, 0.9)
    await page.mouse.click(blank.x, blank.y)
    await expect(page.locator('.connect-preview')).toHaveCount(0)
    target = await nodeCenter(page, b.id)
    await page.mouse.click(target.x, target.y)
    await expect.poll(async () => (await readState(page)).edges.length).toBe(1)
  })

  test('连线属性：点击连线显示标签、起终点、样式，并可直接修改和删除', async ({ page }) => {
    await login(page)
    await createDocument(page, 'flowchart')
    const a = await addNode(page, '矩形', 0.20, 0.35)
    const b = await addNode(page, '矩形', 0.72, 0.35)
    await selectNode(page, a.id)
    const anchorBox = await page.locator('.node-anchor-dot').nth(1).boundingBox()
    const target = await nodeCenter(page, b.id)
    await dragMouse(
      page,
      { x: anchorBox.x + anchorBox.width / 2, y: anchorBox.y + anchorBox.height / 2 },
      target,
      { steps: 20, settle: 400 }
    )
    const edge = (await readState(page)).edges[0]
    expect(edge).toBeTruthy()
    const point = await pointOnSvgPath(page, `[data-testid="edge-path-${edge.id}"]`, 0.28)
    await page.mouse.click(point.x, point.y)
    await page.waitForTimeout(250)

    const panel = page.getByTestId('edge-property-panel')
    await expect(panel).toBeVisible()
    await expect(page.getByTestId('inspector-title')).toHaveText('连线属性')
    const labelInput = page.getByTestId('edge-property-label-input')
    await expect(labelInput).toBeVisible()
    await expect(page.getByTestId('edge-endpoints')).toContainText(a.text)
    await expect(page.getByTestId('edge-endpoints')).toContainText(b.text)

    await labelInput.click()
    await page.keyboard.type('流程标签')
    await page.keyboard.press('Tab')
    await expect.poll(async () => (await readState(page)).edges[0].label).toBe('流程标签')

    await page.getByTestId('edge-route-straight').click()
    await expect.poll(async () => (await readState(page)).edges[0].route).toBe('straight')
    await page.getByTestId('edge-stroke-dotted').click()
    await expect.poll(async () => (await readState(page)).edges[0].stroke).toBe('dotted')
    await page.getByTestId('edge-remove').click()
    await expect.poll(async () => (await readState(page)).edges.length).toBe(0)
    await expect(panel).toHaveCount(0)
  })

  test('节点右键菜单：复制/粘贴/副本/剪切/锁定/层级/删除', async ({ page }) => {
    await login(page)
    await createDocument(page, 'flowchart')
    const a = await addNode(page, '矩形', 0.3, 0.3)
    const b = await addNode(page, '矩形', 0.6, 0.3)
    await selectNode(page, a.id)

    const openMenu = async (nodeId, offsetX = 0) => {
      const box = await nodeBox(page, nodeId)
      await page.mouse.click(box.x + 8 + offsetX, box.y + box.height / 2, { button: 'right' })
      await page.waitForTimeout(200)
      await expect(page.getByTestId('context-menu')).toBeVisible()
    }

    // 复制 -> 画布右键粘贴
    await openMenu(a.id)
    await page.getByTestId('ctx-copy').click()
    const canvas = await canvasPoint(page, 0.45, 0.7)
    await page.mouse.click(canvas.x, canvas.y, { button: 'right' })
    await expect(page.getByTestId('ctx-canvas-paste')).toBeVisible()
    await page.getByTestId('ctx-canvas-paste').click()
    await expect.poll(async () => (await readState(page)).nodes.length).toBe(3)

    // 副本
    await openMenu(a.id)
    await page.getByTestId('ctx-duplicate').click()
    await expect.poll(async () => (await readState(page)).nodes.length).toBe(4)

    // 剪切
    await openMenu(a.id)
    await page.getByTestId('ctx-cut').click()
    await expect.poll(async () => (await readState(page)).nodes.some(node => node.id === a.id)).toBe(false)

    // 锁定后拖拽不移动
    await selectNode(page, b.id)
    const lockedBefore = (await readState(page)).nodes.find(node => node.id === b.id)
    await openMenu(b.id)
    await page.getByTestId('ctx-lock').click()
    await page.waitForTimeout(250)
    await dragNode(page, b.id, 50, 30)
    const lockedAfter = (await readState(page)).nodes.find(node => node.id === b.id)
    expect(lockedAfter.locked).toBe(true)
    expect(Math.round(lockedAfter.x)).toBe(Math.round(lockedBefore.x))
    expect(Math.round(lockedAfter.y)).toBe(Math.round(lockedBefore.y))

    // 解锁并置顶/置底（数组顺序变化）
    await openMenu(b.id)
    await page.getByTestId('ctx-lock').click()
    await page.waitForTimeout(200)
    const orderBefore = (await readState(page)).nodes.map(node => node.id)
    await openMenu(b.id)
    await page.getByTestId('ctx-front').click()
    await page.waitForTimeout(200)
    const orderFront = (await readState(page)).nodes.map(node => node.id)
    expect(orderFront.at(-1)).toBe(b.id)
    expect(orderFront).not.toEqual(orderBefore)
    await openMenu(b.id)
    await page.getByTestId('ctx-back').click()
    await page.waitForTimeout(200)
    expect((await readState(page)).nodes.map(node => node.id)[0]).toBe(b.id)

    // 右键删除
    await openMenu(b.id)
    await page.getByTestId('ctx-delete').click()
    await expect.poll(async () => (await readState(page)).nodes.some(node => node.id === b.id)).toBe(false)
  })

  test('键盘：N/Shift+D/删除/撤销重做/全选/复制粘贴剪切/组合/平移缩放/F2/Esc/?', async ({ page }) => {
    await login(page)
    await createDocument(page, 'flowchart')
    const canvas = await canvasPoint(page, 0.1, 0.8)
    await page.mouse.click(canvas.x, canvas.y)
    await page.waitForTimeout(150)

    // N 新建流程节点，Shift+D 新建判定节点
    await page.keyboard.press('n')
    await expect.poll(async () => (await readState(page)).nodes.length).toBe(1)
    await page.keyboard.press('Shift+d')
    await expect.poll(async () => (await readState(page)).nodes.length).toBe(2)

    // 多选删除（回归：必须删除整个多选集）
    await page.keyboard.press('Control+a')
    await page.waitForTimeout(150)
    expect(await page.locator('.node-shape.selected').count()).toBe(2)
    await page.keyboard.press('Delete')
    await expect.poll(async () => (await readState(page)).nodes.length).toBe(0)

    // 撤销 / 重做
    await page.keyboard.press('Control+z')
    await expect.poll(async () => (await readState(page)).nodes.length).toBe(2)
    await page.keyboard.press('Control+y')
    await expect.poll(async () => (await readState(page)).nodes.length).toBe(0)
    await page.keyboard.press('Control+z')
    await expect.poll(async () => (await readState(page)).nodes.length).toBe(2)

    // 复制粘贴 / 副本 / 剪切
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Control+c')
    await page.keyboard.press('Control+v')
    await expect.poll(async () => (await readState(page)).nodes.length).toBe(4)
    await page.keyboard.press('Control+d')
    await expect.poll(async () => (await readState(page)).nodes.length).toBe(6)
    await page.keyboard.press('Control+x')
    await expect.poll(async () => (await readState(page)).nodes.length).toBe(4)

    // 组合 / 取消组合
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Control+g')
    await page.waitForTimeout(250)
    let state = await readState(page)
    expect(state.nodes.every(node => node.groupId)).toBe(true)
    await page.keyboard.press('Control+Shift+g')
    await page.waitForTimeout(250)
    state = await readState(page)
    expect(state.nodes.every(node => !node.groupId)).toBe(true)

    // 方向键平移、加减号缩放
    const viewport0 = (await readState(page)).viewport
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowDown')
    const viewport1 = (await readState(page)).viewport
    expect(Math.round(viewport1.x - viewport0.x)).toBe(40)
    expect(Math.round(viewport1.y - viewport0.y)).toBe(40)
    await page.keyboard.press('+')
    const zoom1 = (await readState(page)).viewport.zoom
    expect(zoom1).toBeGreaterThan(viewport1.zoom)
    await page.keyboard.press('-')
    expect((await readState(page)).viewport.zoom).toBeLessThan(zoom1 + 0.001)

    // F2 / Enter 打开节点文字浮层：Enter 提交，Esc 取消
    await page.keyboard.press('Control+a')
    await page.waitForTimeout(150)
    const targetId = (await readState(page)).activeNodeId
    await page.keyboard.press('F2')
    await expect(page.getByTestId('text-overlay-input')).toBeVisible()
    await page.keyboard.type('F2键盘改名')
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('text-overlay-input')).toHaveCount(0)
    expect((await readState(page)).nodes.find(node => node.id === targetId).text).toBe('F2键盘改名')

    await page.keyboard.press('F2')
    await expect(page.getByTestId('text-overlay-input')).toBeVisible()
    await page.keyboard.type('不应保存')
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('text-overlay-input')).toHaveCount(0)
    expect((await readState(page)).nodes.find(node => node.id === targetId).text).toBe('F2键盘改名')

    // ? 打开快捷键面板，Esc 关闭
    await page.keyboard.press('?')
    await expect(page.locator('.shortcuts-panel, [data-testid="shortcuts-close"]')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-testid="shortcuts-close"]')).toHaveCount(0)
  })

  test('画布：空白拖动、滚轮平移、Ctrl+滚轮缩放、Space/中键拖动、网格、尺寸、参考线', async ({ page }) => {
    await login(page)
    await createDocument(page, 'flowchart')
    const node = await addNode(page, '矩形', 0.3, 0.3)

    const canvas = await canvasBox(page)
    const center = { x: canvas.x + canvas.width / 2, y: canvas.y + canvas.height / 2 }

    // 空白处直接左键拖动 = 平移画布
    const panStart = await canvasPoint(page, 0.85, 0.85)
    const vp0 = (await readState(page)).viewport
    await dragMouse(page, panStart, { x: panStart.x - 60, y: panStart.y - 40 }, { steps: 12 })
    const vp1 = (await readState(page)).viewport
    expect(Math.abs(vp1.x - vp0.x) + Math.abs(vp1.y - vp0.y)).toBeGreaterThan(20)

    // 普通滚轮平移
    const v0 = (await readState(page)).viewport
    await page.mouse.move(center.x, center.y)
    await page.mouse.wheel(0, 120)
    await page.waitForTimeout(200)
    const v1 = (await readState(page)).viewport
    expect(v1.y).toBeLessThan(v0.y)

    // Ctrl+滚轮缩放
    await page.keyboard.down('Control')
    await page.mouse.wheel(0, -120)
    await page.keyboard.up('Control')
    await page.waitForTimeout(200)
    const v2 = (await readState(page)).viewport
    expect(v2.zoom).toBeGreaterThan(v1.zoom)

    // Space + 左键拖动
    await page.mouse.move(center.x, center.y)
    await page.keyboard.down(' ')
    await page.mouse.down()
    await page.mouse.move(center.x + 70, center.y + 40, { steps: 12 })
    await page.mouse.up()
    await page.keyboard.up(' ')
    await page.waitForTimeout(200)
    const v3 = (await readState(page)).viewport
    expect(v3.x).toBeGreaterThan(v2.x + 40)

    // 中键拖动
    await page.mouse.move(center.x, center.y)
    await page.mouse.down({ button: 'middle' })
    await page.mouse.move(center.x - 50, center.y - 30, { steps: 10 })
    await page.mouse.up({ button: 'middle' })
    await page.waitForTimeout(200)
    const v4 = (await readState(page)).viewport
    expect(v4.x).toBeLessThan(v3.x - 20)

    // 网格开关（复选框）
    // 展开“画布”折叠面板后再操作网格与尺寸
    const canvasPanel = page.getByTestId('canvas-panel-collapse')
    if (!(await canvasPanel.getAttribute('open'))) {
      await canvasPanel.locator('summary').click()
      await page.waitForTimeout(150)
    }
    const grid = page.getByTestId('grid-toggle')
    await closeInspector(page)
    await grid.evaluate(el => el.scrollIntoView({ block: 'center' }))
    await page.waitForTimeout(150)
    const gridBefore = await grid.isChecked()
    await grid.click()
    await expect(grid).toBeChecked({ checked: !gridBefore })

    // 画布尺寸输入框（键盘输入 + Tab 提交）
    const widthInput = page.locator('.page-panel label').filter({ hasText: '宽' }).locator('input').first()
    await widthInput.click()
    await page.keyboard.press('Control+a')
    await page.keyboard.type('900')
    await page.keyboard.press('Tab')
    await expect.poll(async () => {
      const state = await readState(page)
      return state.pages.find(pageItem => pageItem.id === state.activePageId)?.width
    }).toBe(900)

    // 预设尺寸按钮
    await page.getByRole('button', { name: 'A4 竖' }).click()
    await expect.poll(async () => {
      const state = await readState(page)
      return state.pages.find(pageItem => pageItem.id === state.activePageId)?.height
    }).toBe(1123)

    // 从水平标尺拖出参考线（先回到页面顶部，避免标尺被吸顶工具栏盖住）
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(120)
    const ruler = await elementBox(page, '.ruler-h')
    await dragMouse(
      page,
      { x: ruler.x + 200, y: ruler.y + ruler.height / 2 },
      { x: ruler.x + 300, y: canvas.y + 220 },
      { steps: 12 }
    )
    await expect.poll(async () => (await readState(page)).guides.length).toBe(1)
    const guide = await page.locator('.guide-hit').first().boundingBox()
    // 拖动参考线
    await dragMouse(
      page,
      { x: guide.x + 100, y: guide.y + guide.height / 2 },
      { x: guide.x + 100, y: guide.y + guide.height / 2 + 60 },
      { steps: 10 }
    )
    await expect.poll(async () => (await readState(page)).guides[0].pos).toBeGreaterThan(200)
    // 双击删除参考线
    const guide2 = await page.locator('.guide-hit').first().boundingBox()
    await page.mouse.dblclick(guide2.x + guide2.width / 2, guide2.y + guide2.height / 2)
    await expect.poll(async () => (await readState(page)).guides.length).toBe(0)
  })
})
