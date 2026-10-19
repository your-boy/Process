import { expect, test } from '@playwright/test'

test('login shell loads and locale can be switched', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '登录' })).toHaveCount(1)
  await expect(page.getByRole('textbox', { name: '用户名' })).toBeVisible()

  await page.getByTestId('locale-toggle').click()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Forgot password' })).toBeVisible()
})
