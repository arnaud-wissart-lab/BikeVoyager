import { expect, test } from '@playwright/test'
import { mockApi } from './support/mockApi'

test.beforeEach(async ({ page }) => {
  await mockApi(page)
})

test('data export: déclenche un téléchargement et un feedback utilisateur', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Ce scenario est validé en desktop pour limiter la variabilité UI.')

  await page.goto('/#/donnees')

  await page.getByRole('button', { name: /Sauvegardes et cloud|Backups and cloud/i }).click()

  const exportButton = page.getByRole('button', { name: /Sauvegarder|Export full backup/i })
  await expect(exportButton).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await exportButton.click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toMatch(/^bikevoyager-backup-\d{4}-\d{2}-\d{2}\.json$/)
  await expect(page.getByText(/Sauvegarde complète exportée\.|Full backup exported\./i)).toBeVisible()
})
