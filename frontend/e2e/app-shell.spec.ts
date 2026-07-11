import { expect, test } from '@playwright/test'
import { mockApi } from './support/mockApi'

test.beforeEach(async ({ page }) => {
  await mockApi(page)
})

test('footer mobile sans debordement horizontal', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Ce scenario cible uniquement la version mobile.')

  await page.goto('/')

  const footer = page.locator('footer')
  await expect(footer).toBeVisible()

  const labels = [
    /^Planifier$|^Plan$/i,
    /^Carte$|^Map$/i,
    /^Profils$|^Profiles$/i,
    /^Donn[ée]es$|^Data$/i,
    /^Aide$|^Help$/i,
  ] as const
  for (const labelPattern of labels) {
    await expect(footer.getByRole('button', { name: labelPattern })).toBeVisible()
  }

  const overflow = await footer.evaluate((node) => ({
    scrollWidth: node.scrollWidth,
    clientWidth: node.clientWidth,
  }))
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1)

  const footerBox = await footer.boundingBox()
  expect(footerBox).not.toBeNull()
  if (!footerBox) {
    return
  }

  for (const labelPattern of labels) {
    const box = await footer.getByRole('button', { name: labelPattern }).boundingBox()
    expect(box).not.toBeNull()
    if (!box) {
      continue
    }

    expect(box.x).toBeGreaterThanOrEqual(footerBox.x - 0.5)
    expect(box.x + box.width).toBeLessThanOrEqual(footerBox.x + footerBox.width + 0.5)
  }
})

test('aide affiche le statut cloud utile sans backend/fallback', async ({ page }) => {
  await page.goto('/#/aide')

  await expect(page.getByText(/^Plateforme$|^Platform$/i)).toBeVisible()
  await expect(
    page.getByText(/Cache distribu[ée] op[ée]rationnel|Distributed cache healthy/i),
  ).toBeVisible()
  await expect(page.getByText(/Heure serveur \(UTC\)|Server time \(UTC\)/i)).toBeVisible()

  await expect(page.getByText('Backend cache')).toHaveCount(0)
  await expect(page.getByText('Cache backend')).toHaveCount(0)
  await expect(page.getByText(/^Fallback$/)).toHaveCount(0)
})

test('parcours utilisateur complet planifier vers carte', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Le parcours complet est validé sur desktop.')

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

test('navigation répétée entre Planifier et Carte sans trajet', async ({ page }) => {
  const pageErrors: string[] = []
  const consoleErrors: string[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error.stack ?? error.message)
  })
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })
  await page.addInitScript(() => {
    localStorage.removeItem('bv_last_route')
  })

  await page.goto('/#/planifier')

  for (let cycle = 0; cycle < 5; cycle += 1) {
    await page
      .getByText(/^Carte$|^Map$/i)
      .first()
      .click()
    await expect(page).toHaveURL(/#\/carte$/)
    await expect(page.getByTestId('cesium-route-map')).toBeVisible()

    await page
      .getByText(/^Planifier$|^Plan$/i)
      .first()
      .click()
    await expect(page).toHaveURL(/#\/planifier$/)
    await expect(page.getByText(/^BikeVoyager$/).first()).toBeVisible()
    await expect(page.getByText(/Planifier un parcours|Plan a route/i)).toBeVisible()
  }

  expect(pageErrors).toEqual([])
  expect(consoleErrors.filter((message) => /scene|cesium|destroy/i.test(message))).toEqual([])
})
