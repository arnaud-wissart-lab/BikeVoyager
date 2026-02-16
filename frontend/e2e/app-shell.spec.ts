import { expect, test, type Page } from '@playwright/test'
import { apiPaths } from '../src/features/app/apiPaths'

const mockApi = async (page: Page) => {
  await page.route('**/api/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    })
  })

  await page.route(`**${apiPaths.cloudProviders}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        providers: { onedrive: true, googleDrive: true },
      }),
    })
  })

  await page.route(`**${apiPaths.cloudSession}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        connected: false,
        authState: null,
      }),
    })
  })

  await page.route(`**${apiPaths.cloudStatus}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        providers: { onedrive: true, googleDrive: true },
        session: { connected: false, authState: null },
        cache: {
          distributedCacheType: 'Redis',
          healthy: true,
          message: 'Redis reachable',
          fallback: 'memory',
        },
        serverTimeUtc: '2026-02-15T10:30:00Z',
      }),
    })
  })

  await page.route(`**${apiPaths.valhallaStatus}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ready: true,
        reason: null,
        marker_exists: true,
        service_reachable: true,
        service_error: null,
        message: 'ready',
        build: {
          state: 'idle',
          phase: 'ready',
          progress_pct: 100,
          message: 'ready',
          updated_at: '2026-02-15T10:00:00Z',
        },
        update: {
          state: 'idle',
          update_available: false,
          reason: null,
          message: 'up-to-date',
          checked_at: '2026-02-15T09:00:00Z',
          next_check_at: '2026-02-15T12:00:00Z',
          marker_exists: true,
          remote: {
            available: true,
            error: null,
          },
        },
      }),
    })
  })

  await page.route(`**${apiPaths.placesSearch}**`, async (route) => {
    const url = new URL(route.request().url())
    const query = (url.searchParams.get('q') ?? '').toLowerCase()

    const candidates =
      query.includes('paris')
        ? [
            {
              label: 'Paris',
              lat: 48.8566,
              lon: 2.3522,
              score: 0.9,
              source: 'test',
            },
          ]
        : query.includes('lyon')
          ? [
              {
                label: 'Lyon',
                lat: 45.764,
                lon: 4.8357,
                score: 0.9,
                source: 'test',
              },
            ]
          : []

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(candidates),
    })
  })

  await page.route(`**${apiPaths.route}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        geometry: {
          type: 'LineString',
          coordinates: [
            [2.3522, 48.8566],
            [4.8357, 45.764],
          ],
        },
        distance_m: 465000,
        duration_s_engine: 10000,
        eta_s: 10000,
        turn_by_turn: [],
        elevation_profile: [],
      }),
    })
  })

  await page.route(`**${apiPaths.poiAroundRoute}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })
}

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
    const box = await footer
      .getByRole('button', { name: labelPattern })
      .boundingBox()
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

  await page.getByText(/^Vélo$|^Bike$/).first().click()
  await page.getByText(/^Aller simple$|^One-way$/).first().click()

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
