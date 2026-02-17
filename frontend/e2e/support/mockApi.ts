import type { Page } from '@playwright/test'
import { apiPaths } from '../../src/features/routing/apiPaths'

export const mockApi = async (page: Page) => {
  await page.route('**/api/v1/**', async (route) => {
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

    const candidates = query.includes('paris')
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
