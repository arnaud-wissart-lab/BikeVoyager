import { expect, test } from '@playwright/test'
import { mockApi } from './support/mockApi'

test.beforeEach(async ({ page }) => {
  await mockApi(page)
})

test('routing: calcul one-way affiche un résultat exploitable', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Ce scenario est validé en desktop pour limiter la variabilité UI.')

  await page.goto('/#/planifier')

  await page
    .getByText(/^Vélo$|^Bike$/)
    .first()
    .click()
  await page
    .getByText(/^Aller simple$|^One-way$/)
    .first()
    .click()

  const startInput = page.locator('[data-testid="plan-start-input"]:not([disabled])')
  await startInput.fill('Paris')
  await page.getByTestId('plan-start-option-0').click()

  const endInput = page.locator('[data-testid="plan-end-input"]:not([disabled])')
  await endInput.fill('Lyon')
  await page.getByTestId('plan-end-option-0').click()

  await page.getByRole('button', { name: /Calculer|Calculate/i }).click()

  await expect(page).toHaveURL(/#\/carte$/)
  await expect(page.getByTestId('nav-setup-open')).toBeVisible()
  await expect(page.getByText('Paris')).toBeVisible()
  await expect(page.getByText('Lyon')).toBeVisible()
})
