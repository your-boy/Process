import { expect, test } from '@playwright/test'
import {
  CREATE_LABELS,
  cleanupDocument,
  collectConsoleErrors,
  createDocument,
  login,
  nodeBox,
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

test.describe('输入覆盖 · 认证与会话', () => {
  test('登录表单：键盘输入、校验、密码显隐、主题/语言、退出', async ({ page }) => {
    const errors = collectConsoleErrors(page)
    await page.goto('/')
    await expect(page.locator('#username')).toBeVisible()
    // 视觉标题已移除，但保留无障碍标题
    await expect(page.getByRole('heading', { name: '登录' })).toHaveCount(1)

    // 空用户名：点击提交
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await expect(page.locator('.login-form .error')).toContainText('请输入用户名')

    // 只有用户名：键盘 Enter 提交
    const username = page.locator('#username')
    await username.click()
    await page.keyboard.type('demo')
    await page.keyboard.press('Enter')
    await expect(page.locator('.login-form .error')).toContainText('请输入密码')

    // Tab 从用户名进入密码
    await username.click()
    await page.keyboard.press('Tab')
    await expect(page.locator('#password')).toBeFocused()

    // 密码显隐按钮（真实鼠标点击）
    await page.keyboard.type('wrong-pass')
    const reveal = page.getByTestId('toggle-login-password')
    await reveal.click()
    await expect(page.locator('#password')).toHaveAttribute('type', 'text')
    await reveal.click()
    await expect(page.locator('#password')).toHaveAttribute('type', 'password')

    // 错误密码
    await page.keyboard.press('Enter')
    await expect(page.locator('.login-form .error')).toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(1200)

    // 正确密码：勾选记住密码后键盘登录
    await page.getByTestId('remember-password').check()
    await page.locator('#password').click()
    await page.keyboard.press('Control+a')
    await page.keyboard.type('demo123')
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('workspace-create-button')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.user-chip')).toContainText('Local Demo User')

    // 主题切换：真实鼠标
    const themeButton = page.locator('.topbar-actions .icon-button')
    const beforeTheme = await page.evaluate(() => document.documentElement.dataset.theme)
    await themeButton.click()
    await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.theme)).not.toBe(beforeTheme)
    await themeButton.click()

    // 语言切换：真实鼠标
    await page.getByTestId('locale-toggle').click()
    await expect(page.getByTestId('workspace-create-button')).toContainText('New')
    await page.getByTestId('locale-toggle').click()
    await expect(page.getByTestId('workspace-create-button')).toContainText('新建')

    // 退出登录：记住密码已生效，用户名/密码自动回填
    await page.getByRole('button', { name: '退出登录' }).click()
    await expect(page.locator('#username')).toBeVisible()
    await expect(page.locator('#username')).toHaveValue('demo')
    await expect(page.locator('#password')).toHaveValue('demo123')
    await expect(page.getByTestId('remember-password')).toBeChecked()
    await page.waitForTimeout(1100)

    // 清除后重新键盘登录
    await page.locator('#username').click()
    await page.keyboard.press('Control+a')
    await page.keyboard.type('demo')
    await page.locator('#password').click()
    await page.keyboard.press('Control+a')
    await page.keyboard.type('demo123')
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('workspace-create-button')).toBeVisible({ timeout: 20_000 })

    expect(errors).toEqual([])
  })

  test('忘记密码：键盘填写、校验、显隐、返回登录', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: '忘记密码', exact: true }).click()
    await expect(page.locator('#recovery-username')).toBeVisible()

    const username = page.locator('#recovery-username')
    await username.click()
    await page.keyboard.type('demo')
    await page.keyboard.press('Tab')
    await page.keyboard.type('WRONG-CODE')
    await page.keyboard.press('Tab')
    await page.keyboard.type('short')
    await page.keyboard.press('Tab')
    await page.keyboard.type('short')
    await page.keyboard.press('Enter')
    await expect(page.locator('.login-form .error')).toContainText('至少需要 8 位')

    // 恢复码与两个新密码框的显隐按钮均可用
    await page.getByTestId('toggle-recovery-code').click()
    await page.getByTestId('toggle-recovery-password').click()
    await page.getByTestId('toggle-recovery-confirm').click()
    await expect(page.locator('#recovery-code')).toHaveAttribute('type', 'text')
    await expect(page.locator('#recovery-password')).toHaveAttribute('type', 'text')
    await expect(page.locator('#recovery-confirm')).toHaveAttribute('type', 'text')

    // 两个新密码不一致
    await page.locator('#recovery-password').click()
    await page.keyboard.press('Control+a')
    await page.keyboard.type('demo12345')
    await page.locator('#recovery-confirm').click()
    await page.keyboard.press('Control+a')
    await page.keyboard.type('demo54321')
    await page.keyboard.press('Enter')
    await expect(page.locator('.login-form .error')).toContainText('不一致')

    await page.getByRole('button', { name: '返回登录' }).click()
    await expect(page.locator('#username')).toBeVisible()
    await expect(page.locator('#username')).toHaveValue('demo')
  })

  test('修改密码面板：显隐按钮、校验、折叠', async ({ page }) => {
    await login(page)
    await page.getByRole('button', { name: '修改密码' }).click()
    const panel = page.locator('.security-panel')
    await expect(panel).toBeVisible()
    await expectInlineField(panel.locator('label[for="current-password"]'), page.locator('#current-password'))
    await expectInlineField(panel.locator('label[for="new-password"]'), page.locator('#new-password'))
    await expectInlineField(panel.locator('label[for="confirm-password"]'), page.locator('#confirm-password'))

    // 三次显隐按钮
    await page.getByTestId('toggle-current-password').click()
    await expect(page.locator('#current-password')).toHaveAttribute('type', 'text')
    await page.getByTestId('toggle-new-password').click()
    await expect(page.locator('#new-password')).toHaveAttribute('type', 'text')
    await page.getByTestId('toggle-confirm-password').click()
    await expect(page.locator('#confirm-password')).toHaveAttribute('type', 'text')

    // 空当前密码
    await panel.getByRole('button', { name: '更新密码' }).click()
    await expect(panel.locator('.error-text')).toContainText('请输入当前密码')

    // 新密码过短
    await page.locator('#current-password').click()
    await page.keyboard.type('demo123')
    await page.locator('#new-password').click()
    await page.keyboard.type('short')
    await panel.getByRole('button', { name: '更新密码' }).click()
    await expect(panel.locator('.error-text')).toContainText('至少需要 8 位')

    // 不一致
    await page.locator('#new-password').click()
    await page.keyboard.press('Control+a')
    await page.keyboard.type('demo12345')
    await page.locator('#confirm-password').click()
    await page.keyboard.type('demo54321')
    await panel.getByRole('button', { name: '更新密码' }).click()
    await expect(panel.locator('.error-text')).toContainText('不一致')

    // 折叠并确认表单清空
    await panel.getByRole('button', { name: '收起面板' }).click()
    await expect(panel).toHaveCount(0)
    await page.getByRole('button', { name: '修改密码' }).click()
    await expect(page.locator('#current-password')).toHaveValue('')
    await expect(page.locator('#new-password')).toHaveValue('')
    await expect(page.locator('#confirm-password')).toHaveValue('')
  })
})

test.describe('输入覆盖 · 工作区与新建弹窗', () => {
  test('新建弹窗：标题栏拖动、遮罩关闭、模式卡片点击', async ({ page }) => {
    const errors = collectConsoleErrors(page)
    await page.setViewportSize({ width: 1600, height: 1100 })
    await login(page)
    const trigger = page.getByTestId('workspace-create-button')
    await trigger.click()
    const dialog = page.locator('[role="dialog"]').filter({ hasText: '新建' })
    await expect(dialog).toBeVisible()

    const header = dialog.locator('.workspace-dialog-header')
    const before = await dialog.boundingBox()
    const hb = await header.boundingBox()
    // 真实鼠标拖动标题栏
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
    await page.mouse.down()
    await page.mouse.move(hb.x + hb.width / 2 + 80, hb.y + hb.height / 2 + 50, { steps: 12 })
    await page.mouse.up()
    await page.waitForTimeout(200)
    const after = await dialog.boundingBox()
    expect(Math.round(after.x - before.x)).toBeGreaterThan(40)
    // 弹窗高度接近视口时纵向会被夹紧，这里只要求坐标是有限值且仍在视口内
    expect(Number.isFinite(after.y)).toBe(true)
    expect(after.y).toBeGreaterThanOrEqual(0)

    // 点击遮罩关闭
    await page.mouse.click(20, 20)
    await expect(dialog).toHaveCount(0)

    // 重新打开并点击空白绘图卡片
    await trigger.click()
    await page.getByRole('button', { name: '新建绘图', exact: true }).click()
    await expect(page.locator('.editor-shell')).toBeVisible()
    const state = await readState(page)
    expect(state.mode).toBe('flowchart')

    await cleanupDocument(page)
    expect(errors).toEqual([])
  })

  test('文件卡片：菜单重命名键盘提交/Esc、更多操作、删除', async ({ page }) => {
    await login(page)
    await createDocument(page, 'flowchart')
    const original = (await readState(page)).title
    const uniqueTitle = `键盘重命名-${Date.now()}`
    await page.getByTestId('topbar-back').click()
    await expect(page.getByTestId('workspace-create-button')).toBeVisible()

    const card = page.locator('.workspace-card').first()
    await expect(card).toBeVisible()
    await card.getByRole('button', { name: '更多操作' }).click()
    await page.getByRole('button', { name: '重命名', exact: true }).click()
    const renameInput = page.locator('.rename-dialog input')
    await expect(renameInput).toBeFocused()
    await expectInlineField(page.locator('.workspace-rename-field span'), renameInput)
    await page.keyboard.press('Control+a')
    await page.keyboard.type(uniqueTitle)
    await page.keyboard.press('Enter')
    await expect(page.locator('.workspace-card').filter({ hasText: uniqueTitle })).toHaveCount(1)

    // 再次重命名后按 Esc 应取消
    const renamedCard = page.locator('.workspace-card').filter({ hasText: uniqueTitle }).first()
    await renamedCard.getByRole('button', { name: '更多操作' }).click()
    await page.getByRole('button', { name: '重命名', exact: true }).click()
    await page.keyboard.type('不应保存')
    await page.keyboard.press('Escape')
    await expect(page.locator('.rename-dialog')).toHaveCount(0)
    await expect(page.locator('.workspace-card').filter({ hasText: uniqueTitle })).toHaveCount(1)

    // 删除卡片
    const finalCard = page.locator('.workspace-card').filter({ hasText: uniqueTitle }).first()
    await finalCard.getByRole('button', { name: '更多操作' }).click()
    await page.getByRole('button', { name: '删除', exact: true }).click()
    await expect(page.locator('.workspace-card').filter({ hasText: uniqueTitle })).toHaveCount(0)
  })

  test('多页文档卡片：缩略图可切换页面且不会误打开文档', async ({ page }) => {
    await login(page)
    await createDocument(page, 'mindmap')
    const key = await page.evaluate(() => document.querySelector('#app').__vue_app__._instance.setupState.activeDocumentKey)
    await page.getByTestId('page-add').click()
    await expect.poll(async () => (await readState(page)).pages.length).toBe(2)
    await page.getByTestId('topbar-back').click()

    const card = page.getByTestId(`workspace-card-${key}`)
    await expect(card).toBeVisible()
    const switcher = card.locator('.workspace-card-page-switcher')
    await expect(switcher).toBeVisible()
    await expect(switcher.locator('button')).toHaveCount(4)
    await expect(card.locator('.workspace-card-empty')).toHaveCount(0)
    await expect(card.locator('.workspace-diagram-preview')).toHaveCount(0)

    await switcher.getByRole('button', { name: '1', exact: true }).click()
    await expect(card.locator('.workspace-diagram-preview')).toBeVisible()
    await expect(switcher.getByRole('button', { name: '1', exact: true })).toHaveClass(/active/)
    await expect(page.locator('.editor-shell')).toHaveCount(0)

    await switcher.getByTestId('workspace-preview-next').click()
    await expect(switcher.getByRole('button', { name: '2', exact: true })).toHaveClass(/active/)
    await expect(card.locator('.workspace-diagram-preview')).toHaveCount(0)
    await expect(page.locator('.editor-shell')).toHaveCount(0)
  })

  test('工作区批量选择：Ctrl+左键框选卡片并批量删除', async ({ page }) => {
    await login(page)
    await createDocument(page, 'flowchart')
    const firstKey = await page.evaluate(() => document.querySelector('#app').__vue_app__._instance.setupState.activeDocumentKey)
    await page.getByTestId('topbar-back').click()
    await createDocument(page, 'mindmap')
    const secondKey = await page.evaluate(() => document.querySelector('#app').__vue_app__._instance.setupState.activeDocumentKey)
    await page.getByTestId('topbar-back').click()

    const firstCard = page.getByTestId(`workspace-card-${firstKey}`)
    const secondCard = page.getByTestId(`workspace-card-${secondKey}`)
    await expect(firstCard).toBeVisible()
    await expect(secondCard).toBeVisible()
    await expect(page.getByTestId('workspace-batch-delete')).toBeVisible()
    await expect(page.getByTestId('workspace-batch-delete')).toBeDisabled()
    const firstBox = await firstCard.boundingBox()
    const secondBox = await secondCard.boundingBox()
    const start = { x: Math.min(firstBox.x, secondBox.x) + 3, y: Math.min(firstBox.y, secondBox.y) + 3 }
    const end = { x: Math.max(firstBox.x + firstBox.width, secondBox.x + secondBox.width) - 3, y: Math.max(firstBox.y + firstBox.height, secondBox.y + secondBox.height) - 3 }

    await page.keyboard.down('Control')
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(end.x, end.y, { steps: 12 })
    await expect(page.getByTestId('workspace-card-marquee')).toBeVisible()
    await page.mouse.up()
    await page.keyboard.up('Control')

    await expect(page.locator('.workspace-card.selected')).toHaveCount(2)
    await expect(page.getByTestId('workspace-card-selected-check')).toHaveCount(2)
    await expect(page.getByTestId('workspace-batch-bar')).toContainText('已选 2 项')
    await expect(page.getByTestId('workspace-batch-delete')).toBeEnabled()

    await firstCard.getByTestId('workspace-card-selected-check').click()
    await expect(firstCard).not.toHaveClass(/selected/)
    await expect(secondCard).toHaveClass(/selected/)
    await expect(page.getByTestId('workspace-batch-bar')).toContainText('已选 1 项')
    await expect(page.getByTestId('workspace-card-selected-check')).toHaveCount(1)

    await firstCard.locator('.workspace-card-main').click({ modifiers: ['Control'] })
    await expect(page.locator('.workspace-card.selected')).toHaveCount(2)

    await page.getByTestId('workspace-batch-delete').click()
    await expect.poll(async () => page.getByTestId(`workspace-card-${firstKey}`).count()).toBe(0)
    await expect.poll(async () => page.getByTestId(`workspace-card-${secondKey}`).count()).toBe(0)
    await expect(page.getByTestId('workspace-batch-bar')).toContainText('已选 0 项')
    await expect(page.getByTestId('workspace-batch-delete')).toBeDisabled()
  })

  test('空白文档不显示额外提示，列表摘要使用短横线', async ({ page }) => {
    await login(page)
    const document = await createDocument(page, 'flowchart')
    await expect(page.getByTestId('canvas-empty-status')).toHaveText('空白')
    await page.getByTestId('topbar-back').click()

    const card = page.getByTestId(`workspace-card-${document.key}`)
    await expect(card.locator('.workspace-card-empty')).toHaveCount(0)
    await expect(card.locator('.workspace-diagram-preview, .workspace-markdown-preview')).toHaveCount(0)
    await expect(card).not.toContainText('空白')

    await page.getByTestId('workspace-view-list').click()
    const row = page.getByTestId(`workspace-card-${document.key}`).locator('.workspace-list-row')
    await expect(row.locator('.workspace-list-summary')).toHaveText('—')
  })

  test('工作区卡片和列表显示数据库持久化序号', async ({ page }) => {
    await login(page)
    const document = await createDocument(page, 'flowchart')
    await page.keyboard.press('Control+s')
    await expect.poll(async () => (await readState(page)).sequenceNo).toBeGreaterThan(0)
    const sequenceNo = (await readState(page)).sequenceNo
    const displaySequence = `#${String(sequenceNo).padStart(3, '0')}`
    await page.getByTestId('topbar-back').click()

    const card = page.getByTestId(`workspace-card-${document.key}`)
    await expect(card.getByTestId('workspace-card-sequence')).toHaveText(displaySequence)

    await page.getByTestId('workspace-view-list').click()
    await expect(page.getByTestId(`workspace-card-${document.key}`).getByTestId('workspace-list-sequence')).toHaveText(displaySequence)
    await page.getByTestId('workspace-sort-sequence').click()
    await expect(page.getByTestId('workspace-sort-sequence')).toHaveAttribute('aria-sort', 'ascending')
  })

  test('工作区缩略图显示思维导图文本块', async ({ page }) => {
    await login(page)
    const document = await createDocument(page, 'mindmap')
    const root = document.nodes[0]
    const rootBox = await nodeBox(page, root.id)
    await page.mouse.click(rootBox.x + rootBox.width / 2, rootBox.y + rootBox.height / 2)
    await page.keyboard.press('m')
    await page.waitForTimeout(300)
    const block = (await readState(page)).textBlocks[0]
    const blockEditor = page.locator('.mind-note-editor-prosemirror').last()
    await blockEditor.click()
    await page.keyboard.type('缩略图文本块')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(250)

    await page.getByTestId('topbar-back').click()
    const card = page.getByTestId(`workspace-card-${document.key}`)
    await expect(card).toBeVisible()
    await expect(card.locator('.workspace-preview-text-block')).toHaveCount(1)
    await expect(card.locator('.workspace-preview-text-block')).toContainText('缩略图文本块')
    expect(block.id).toBeTruthy()
  })

  test('工作区按文档类型筛选，卡片和列表同步生效', async ({ page }) => {
    await login(page)
    await createDocument(page, 'markdown')
    await page.getByTestId('topbar-back').click()
    await createDocument(page, 'flowchart')
    await page.getByTestId('topbar-back').click()

    const filter = page.getByTestId('workspace-mode-filter')
    await filter.selectOption('markdown')
    await expect(page.locator('.workspace-card.mode-markdown').first()).toBeVisible()
    await expect(page.locator('.workspace-card.mode-flowchart')).toHaveCount(0)
    await expect(page.locator('.workspace-card:not(.mode-markdown)')).toHaveCount(0)

    await page.getByTestId('workspace-view-list').click()
    await expect(page.locator('.workspace-list-mode').first()).toHaveText('Markdown')
    await expect(page.locator('.workspace-card.mode-flowchart')).toHaveCount(0)

    await page.getByTestId('workspace-search-reset').click()
    await expect(filter).toHaveValue('all')
    await expect.poll(async () => page.locator('.workspace-card.mode-flowchart').count()).toBeGreaterThan(0)
    await expect.poll(async () => page.locator('.workspace-card.mode-markdown').count()).toBeGreaterThan(0)
  })

  test('列表表头支持各列升序 / 降序排序', async ({ page }) => {
    await login(page)
    await page.getByTestId('workspace-view-list').click()
    const header = page.getByTestId('workspace-list-header')
    await expect(header).toBeVisible()

    const pageValues = async () => (await page.locator('.workspace-list-pages').allTextContents())
      .map(value => Number((value.match(/\d+/) || ['0'])[0]))
    const titleValues = async () => page.locator('.workspace-list-title').allTextContents()

    await page.getByTestId('workspace-sort-pages').click()
    await expect(page.getByTestId('workspace-sort-pages')).toHaveAttribute('aria-sort', 'ascending')
    const ascendingPages = await pageValues()
    expect(ascendingPages).toEqual([...ascendingPages].sort((a, b) => a - b))

    await page.getByTestId('workspace-sort-pages').click()
    await expect(page.getByTestId('workspace-sort-pages')).toHaveAttribute('aria-sort', 'descending')
    const descendingPages = await pageValues()
    expect(descendingPages).toEqual([...descendingPages].sort((a, b) => b - a))

    await page.getByTestId('workspace-sort-title').click()
    await expect(page.getByTestId('workspace-sort-title')).toHaveAttribute('aria-sort', 'ascending')
    const ascTitles = await titleValues()
    const expectedAscTitles = await page.evaluate(values => [...values].sort((left, right) => (
      left.localeCompare(right, 'zh-CN', { numeric: true, sensitivity: 'base' })
    )), ascTitles)
    expect(ascTitles).toEqual(expectedAscTitles)

    await page.getByTestId('workspace-sort-sequence').click()
    await expect(page.getByTestId('workspace-sort-sequence')).toHaveAttribute('aria-sort', 'ascending')
    const sequenceValues = (await page.locator('.workspace-list-sequence').allTextContents())
      .map(value => Number(value.replace('#', '')))
      .filter(Number.isFinite)
    expect(sequenceValues).toEqual([...sequenceValues].sort((a, b) => a - b))

    for (const key of ['mode', 'summary']) {
      await page.getByTestId(`workspace-sort-${key}`).click()
      await expect(page.getByTestId(`workspace-sort-${key}`)).toHaveAttribute('aria-sort', 'ascending')
      await page.getByTestId(`workspace-sort-${key}`).click()
      await expect(page.getByTestId(`workspace-sort-${key}`)).toHaveAttribute('aria-sort', 'descending')
    }
  })

  test('工作区卡片/列表视图可切换', async ({ page }) => {
    await login(page)
    await expect(page.getByTestId('workspace-view-grid')).toHaveClass(/active/)
    await expect(page.locator('.workspace-card-preview').first()).toBeVisible()
    await page.getByTestId('workspace-view-list').click()
    await expect(page.locator('.workspace-gallery')).toHaveClass(/layout-list/)
    await expect(page.locator('.workspace-list-row').first()).toBeVisible()
    await expect(page.locator('.workspace-card-preview')).toHaveCount(0)
    await page.getByTestId('workspace-view-grid').click()
    await expect(page.locator('.workspace-gallery')).toHaveClass(/layout-grid/)
    await expect(page.locator('.workspace-card-preview').first()).toBeVisible()
  })

  test('工作区分页按视口高度自动适配，卡片和列表均可翻页', async ({ page }) => {
    await login(page)
    const createdKeys = []
    for (const mode of ['flowchart', 'mindmap', 'markdown', 'mind-note', 'flowchart']) {
      const document = await createDocument(page, mode)
      createdKeys.push(document.key)
      await page.getByTestId('topbar-back').click()
    }

    await page.setViewportSize({ width: 1600, height: 300 })
    const gallery = page.locator('.workspace-gallery')
    await expect.poll(async () => Number(await gallery.getAttribute('data-page-size'))).toBeLessThanOrEqual(4)
    const compactGridPageSize = Number(await gallery.getAttribute('data-page-size'))
    expect(compactGridPageSize).toBeGreaterThan(0)
    await expect(page.getByTestId(`workspace-card-${createdKeys.at(-1)}`)).toBeVisible()

    const pagination = page.getByTestId('workspace-pagination')
    await expect(pagination).toBeVisible()
    expect(Number(await pagination.getAttribute('data-total-pages'))).toBeGreaterThan(1)
    expect(await page.locator('.workspace-card').count()).toBeLessThanOrEqual(compactGridPageSize)
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true)

    await page.getByTestId('workspace-page-next').click()
    await expect(pagination).toHaveAttribute('data-current-page', '2')
    expect(await page.locator('.workspace-card').count()).toBeLessThanOrEqual(compactGridPageSize)
    await page.getByTestId('workspace-page-prev').click()
    await expect(pagination).toHaveAttribute('data-current-page', '1')

    await page.getByTestId('workspace-view-list').click()
    await expect.poll(async () => Number(await gallery.getAttribute('data-page-size'))).toBeGreaterThan(0)
    const compactListPageSize = Number(await gallery.getAttribute('data-page-size'))
    expect(compactListPageSize).toBeGreaterThan(0)
    expect(compactListPageSize).not.toBe(compactGridPageSize)
    await expect(pagination).toBeVisible()

    await page.setViewportSize({ width: 1280, height: 720 })
    await page.getByTestId('workspace-view-grid').click()
    await expect.poll(async () => Number(await gallery.getAttribute('data-page-size'))).toBeGreaterThan(compactGridPageSize)
  })

  test('工作区持久化使用轻量 localStorage 与 IndexedDB 缓存', async ({ page }) => {
    await login(page)
    await createDocument(page, 'flowchart')
    await page.getByTestId('topbar-back').click()
    await expect.poll(async () => page.evaluate(() => (
      localStorage.getItem('diagram-editor:workspace-meta:demo-user') || ''
    ).length)).toBeGreaterThan(0)

    const storage = await page.evaluate(async () => {
      const meta = localStorage.getItem('diagram-editor:workspace-meta:demo-user') || ''
      const legacy = localStorage.getItem('diagram-editor:workspace:demo-user')
      const cached = await new Promise((resolve, reject) => {
        const request = indexedDB.open('keyval-store')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          if (!db.objectStoreNames.contains('keyval')) {
            resolve(null)
            return
          }
          const tx = db.transaction('keyval', 'readonly')
          const get = tx.objectStore('keyval').get('diagram-editor:workspace-cache:demo-user')
          get.onsuccess = () => resolve(get.result || null)
          get.onerror = () => reject(get.error)
        }
      })
      return {
        metaSize: meta.length,
        legacyExists: legacy !== null,
        hasMeta: Boolean(meta),
        cacheDocuments: cached?.openDocuments?.length || 0
      }
    })

    expect(storage.hasMeta).toBe(true)
    expect(storage.metaSize).toBeLessThan(4096)
    expect(storage.legacyExists).toBe(false)
    expect(storage.cacheDocuments).toBeGreaterThan(0)
  })

  test('未保存草稿参与分页且刷新后仍保留', async ({ page }) => {
    await login(page)
    await page.getByTestId('workspace-create-button').click()
    await page.getByRole('button', { name: CREATE_LABELS.flowchart, exact: true }).click()
    await expect(page.locator('.editor-shell')).toBeVisible({ timeout: 20_000 })
    const draftKey = await page.evaluate(() => document.querySelector('#app').__vue_app__._instance.setupState.activeDocumentKey)
    expect(await page.evaluate(() => document.querySelector('#app').__vue_app__._instance.setupState.editorState.document.value.id)).toBeNull()
    await page.getByTestId('topbar-back').click()

    const card = page.getByTestId(`workspace-card-${draftKey}`)
    await expect(card).toBeVisible()
    await page.setViewportSize({ width: 1600, height: 320 })
    const gallery = page.locator('.workspace-gallery')
    const pagination = page.getByTestId('workspace-pagination')
    await expect.poll(async () => Number(await gallery.getAttribute('data-page-size'))).toBeGreaterThan(0)
    const pageSize = Number(await gallery.getAttribute('data-page-size'))
    expect(await page.locator('.workspace-card').count()).toBeLessThanOrEqual(pageSize)
    await expect(card).toBeVisible()

    if (Number(await pagination.getAttribute('data-total-pages')) > 1) {
      await page.getByTestId('workspace-page-next').click()
      await expect(pagination).toHaveAttribute('data-current-page', '2')
      await expect(card).toHaveCount(0)
      expect(await page.locator('.workspace-card').count()).toBeLessThanOrEqual(pageSize)
      await page.getByTestId('workspace-page-prev').click()
      await expect(card).toBeVisible()
    }

    await page.waitForTimeout(600)
    await page.reload()
    await expect(page.getByTestId('workspace-create-button')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId(`workspace-card-${draftKey}`)).toBeVisible()
  })

  test('工作区分页支持手动每页数量并持久化', async ({ page }) => {
    await login(page)
    const select = page.getByTestId('workspace-page-size')
    const gallery = page.locator('.workspace-gallery')
    const pagination = page.getByTestId('workspace-pagination')
    const autoGridPageSize = Number(await gallery.getAttribute('data-page-size'))
    expect(autoGridPageSize).toBeGreaterThan(0)
    await expect(select).toHaveValue(String(autoGridPageSize))
    const optionValues = await select.locator('option').evaluateAll(options => options.map(option => option.value))
    expect(optionValues).toEqual(expect.arrayContaining(['10', '20', '40', '60', '100']))

    await page.getByTestId('workspace-view-list').click()
    await expect(gallery).toHaveClass(/layout-list/)
    const autoListPageSize = Number(await gallery.getAttribute('data-page-size'))
    await expect(select).toHaveValue(String(autoListPageSize))

    await select.selectOption('10')
    await expect(select).toHaveValue('10')
    await expect(gallery).toHaveAttribute('data-page-size', '10')
    await expect(pagination).toHaveAttribute('data-current-page', '1')

    await page.getByTestId('workspace-view-list').click()
    await expect(select).toHaveValue('10')
    await expect(gallery).toHaveAttribute('data-page-size', '10')

    await select.selectOption('100')
    await expect(select).toHaveValue('100')
    await expect.poll(async () => gallery.evaluate(element => getComputedStyle(element).overflowY)).toBe('auto')
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true)

    await page.reload()
    await expect(page.getByTestId('workspace-create-button')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('workspace-page-size')).toHaveValue('100')

    await page.evaluate(() => localStorage.removeItem('diagram-editor:workspace-page-size'))
    await page.reload()
    await expect(page.getByTestId('workspace-create-button')).toBeVisible({ timeout: 20_000 })
    const restoredAutoSize = Number(await page.locator('.workspace-gallery').getAttribute('data-page-size'))
    await expect(page.getByTestId('workspace-page-size')).toHaveValue(String(restoredAutoSize))
  })

  test('工作区搜索：查询、重置、无结果状态', async ({ page }) => {
    await login(page)
    await createDocument(page, 'markdown')
    const key = await page.evaluate(() => document.querySelector('#app').__vue_app__._instance.setupState.activeDocumentKey)
    const unique = `唯一检索词-${Date.now()}`
    const editor = page.locator('#markdown-editor .ProseMirror')
    await editor.click()
    await page.keyboard.press('Control+a')
    await page.keyboard.press('Delete')
    await page.keyboard.type('第一行')
    await page.keyboard.press('Enter')
    await page.keyboard.type('第二行')
    await page.keyboard.press('Enter')
    await page.keyboard.type(unique)
    await page.keyboard.press('Control+s')
    await expect.poll(async () => (await readState(page)).id).toBeTruthy()
    await expect.poll(async () => (await readState(page)).saveState, { timeout: 10_000 }).toContain('已同步')
    await page.getByTestId('topbar-back').click()

    const search = page.getByTestId('workspace-search')
    await expect(search).toHaveAttribute('placeholder', '搜索文档标题 / 内容')
    await expect(page.getByTestId('workspace-search-submit')).toHaveText('查询')
    await expect(page.getByTestId('workspace-search-reset')).toHaveText('重置')
    await search.fill(unique)
    await page.getByTestId('workspace-search-submit').click()
    await expect(page.getByTestId(`workspace-card-${key}`)).toBeVisible()
    await expect(page.locator('.workspace-card')).toHaveCount(1)
    await page.getByTestId('workspace-search-reset').click()
    await expect(search).toHaveValue('')
    await expect.poll(async () => page.locator('.workspace-card').count()).toBeGreaterThan(1)

    await search.fill(`不存在-${Date.now()}`)
    await page.getByTestId('workspace-search-submit').click()
    await expect(page.getByTestId('workspace-search-empty')).toBeVisible()
    await page.getByTestId('workspace-search-reset').click()
    await expect(page.getByTestId(`workspace-card-${key}`)).toBeVisible()
  })

  test('文件卡片右键：出现与省略号一致的打开/重命名/删除菜单', async ({ page }) => {
    await login(page)
    await createDocument(page, 'flowchart')
    const key = await page.evaluate(() => document.querySelector('#app').__vue_app__._instance.setupState.activeDocumentKey)
    await page.getByTestId('topbar-back').click()
    const card = page.getByTestId(`workspace-card-${key}`)
    await expect(card).toBeVisible()
    await card.scrollIntoViewIfNeeded()
    const box = await card.boundingBox()
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' })
    const menu = page.getByTestId('workspace-card-context-menu')
    await expect(menu).toBeVisible()
    await expect(page.getByTestId('workspace-context-open')).toBeVisible()
    await expect(page.getByTestId('workspace-context-rename')).toBeVisible()
    await expect(page.getByTestId('workspace-context-delete')).toBeVisible()
    const menuBox = await menu.boundingBox()
    expect(menuBox.x).toBeGreaterThanOrEqual(0)
    expect(menuBox.y).toBeGreaterThanOrEqual(0)
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
    expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(await page.evaluate(() => innerHeight));

    await page.getByTestId('workspace-context-rename').click()
    await expect(page.locator('.rename-dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.rename-dialog')).toHaveCount(0)

    await card.scrollIntoViewIfNeeded()
    const secondBox = await card.boundingBox()
    await page.mouse.click(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2, { button: 'right' })
    await page.getByTestId('workspace-context-open').click()
    await expect(page.locator('.editor-shell')).toBeVisible({ timeout: 20_000 })
  })
})
