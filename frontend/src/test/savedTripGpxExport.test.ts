import { exportSavedTripAsGpxAction } from '../features/data/useDataController.routeDataActions'
import type { SavedTripRecord } from '../features/data/dataPortability'
import type { TripResult } from '../features/routing/domain'
import type { TFunction } from 'i18next'

const sampleRoute: TripResult = {
  kind: 'route',
  geometry: {
    type: 'LineString',
    coordinates: [
      [2.35, 48.85],
      [2.36, 48.86],
    ],
  },
  distance_m: 1200,
  duration_s_engine: 420,
  eta_s: 480,
  turn_by_turn: [],
  elevation_profile: [
    { distance_m: 0, elevation_m: 100 },
    { distance_m: 1200, elevation_m: 110 },
  ],
}

const createSavedTrip = (trip: TripResult = sampleRoute): SavedTripRecord => ({
  id: 'trip-1',
  name: 'Paris Lyon été',
  savedAt: '2026-07-08T10:00:00.000Z',
  updatedAt: '2026-07-08T10:00:00.000Z',
  tripType: 'oneway',
  mode: 'bike',
  startLabel: 'Paris',
  endLabel: 'Lyon',
  targetDistanceKm: null,
  trip,
  tags: [],
  favorite: false,
})

const createGpxResponse = (status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    headers: new Headers(),
    blob: async () => new Blob(['<gpx />'], { type: 'application/gpx+xml' }),
  }) as Response

const t = ((key: string) => {
  const messages: Record<string, string> = {
    exportGpxDefaultName: 'BikeVoyager',
    dataSavedTripGpxExportSuccess: 'Export GPX réussi',
    dataSavedTripGpxExportFailed: 'Échec de l’export GPX',
  }
  return messages[key] ?? key
}) as TFunction

describe('savedTripGpxExport', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('exporte le contenu trip.trip d’un trajet sauvegardé', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-09T12:00:00.000Z'))
    const exportRouteAsGpx = vi.fn(async () => createGpxResponse())
    const downloadBlob = vi.fn()
    const showSuccessToast = vi.fn()
    const showErrorToast = vi.fn()
    const trip = createSavedTrip()

    await exportSavedTripAsGpxAction({
      trip,
      t,
      showSuccessToast,
      showErrorToast,
      exportRouteAsGpx,
      parseContentDispositionFileName: () => null,
      downloadBlob,
    })

    expect(exportRouteAsGpx).toHaveBeenCalledWith({
      geometry: trip.trip.geometry,
      elevation_profile: trip.trip.elevation_profile,
      name: trip.name,
    })
    expect(downloadBlob).toHaveBeenCalledWith(
      expect.any(Blob),
      'bikevoyager-paris-lyon-ete-2026-07-09.gpx',
    )
    expect(showSuccessToast).toHaveBeenCalledWith('Export GPX réussi')
    expect(showErrorToast).not.toHaveBeenCalled()
  })

  it('remonte proprement une erreur quand l’export GPX échoue', async () => {
    const exportRouteAsGpx = vi.fn(async () => createGpxResponse(500))
    const downloadBlob = vi.fn()
    const showSuccessToast = vi.fn()
    const showErrorToast = vi.fn()

    await exportSavedTripAsGpxAction({
      trip: createSavedTrip(),
      t,
      showSuccessToast,
      showErrorToast,
      exportRouteAsGpx,
      parseContentDispositionFileName: () => null,
      downloadBlob,
    })

    expect(downloadBlob).not.toHaveBeenCalled()
    expect(showSuccessToast).not.toHaveBeenCalled()
    expect(showErrorToast).toHaveBeenCalledWith('Échec de l’export GPX')
  })

  it('remonte proprement une erreur quand le trajet sauvegardé est absent', async () => {
    const exportRouteAsGpx = vi.fn(async () => createGpxResponse())
    const showErrorToast = vi.fn()

    await exportSavedTripAsGpxAction({
      trip: null,
      t,
      showSuccessToast: vi.fn(),
      showErrorToast,
      exportRouteAsGpx,
      parseContentDispositionFileName: () => null,
      downloadBlob: vi.fn(),
    })

    expect(exportRouteAsGpx).not.toHaveBeenCalled()
    expect(showErrorToast).toHaveBeenCalledWith('Échec de l’export GPX')
  })
})
