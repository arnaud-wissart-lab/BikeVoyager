import {
  createAddressBookEntry,
  createSavedTripRecord,
  duplicateSavedTrip,
  normalizeAppPreferences,
  normalizeSavedTrips,
  parseImportedBikeVoyagerData,
  updateSavedTripMetadata,
  upsertAddressBookEntry,
} from '../features/data/dataPortability'
import {
  filterSavedTripsForLibrary,
  sortSavedTripsForLibrary,
} from '../features/data/savedTripsLibrary'
import type { TripResult } from '../features/routing/domain'

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
  elevation_profile: [],
}

describe('dataPortability', () => {
  it('normalise les preferences applicatives', () => {
    const normalized = normalizeAppPreferences({
      mapViewMode: '4d' as never,
      poiAlertDistanceMeters: 9000,
      poiAlertCategories: ['invalide' as never],
      poiCategories: ['monuments'],
      poiAdvancedFilterSettings: {
        services: ['drinking_water', 'invalide'],
      } as never,
      poiCorridorMeters: 50,
      cloudProvider: 'google-drive',
    })

    expect(normalized.mapViewMode).toBe('3d')
    expect(normalized.poiAlertDistanceMeters).toBe(2000)
    expect(normalized.poiAlertCategories).toEqual(['paysages'])
    expect(normalized.poiCategories).toEqual(['monuments'])
    expect(normalized.poiAdvancedFilterSettings.services).toEqual(['drinking_water'])
    expect(normalized.poiAdvancedFilterSettings.commerces).toContain('bakery')
    expect(normalized.poiCorridorMeters).toBe(200)
    expect(normalized.cloudProvider).toBe('google-drive')
  })

  it('importe une sauvegarde complete', () => {
    const imported = parseImportedBikeVoyagerData({
      format: 'bikevoyager-backup',
      version: 1,
      preferences: {
        profileSettings: {
          speeds: { walk: 5, bike: 16, ebike: 24 },
          ebikeAssist: 'medium',
        },
        appPreferences: {
          mapViewMode: '2d',
          navigationMode: 'simulation',
          navigationCameraMode: 'panoramic_3d',
          poiAlertEnabled: true,
          poiAlertDistanceMeters: 300,
          poiAlertCategories: ['monuments'],
          poiCategories: ['services'],
          poiCorridorMeters: 700,
          cloudProvider: 'onedrive',
        },
        language: 'en',
        themeMode: 'dark',
      },
      plannerDraft: {
        mode: 'bike',
        tripType: 'loop',
        onewayStartValue: '',
        onewayStartPlace: null,
        loopStartValue: 'Paris',
        loopStartPlace: null,
        endValue: '',
        endPlace: null,
        targetDistanceKm: 40,
      },
      currentRoute: sampleRoute,
      savedTrips: [
        createSavedTripRecord({
          trip: sampleRoute,
          mode: 'bike',
          startLabel: 'Paris',
          endLabel: 'Lyon',
          targetDistanceKm: '',
          name: 'Paris Lyon',
        }),
      ],
      addressBook: [
        {
          id: 'addr-1',
          name: 'Maison',
          label: '12 Rue de la Paix, Paris',
          lat: 48.8687,
          lon: 2.3319,
          tags: ['home', 'work'],
          savedAt: '2026-02-13T10:00:00.000Z',
          updatedAt: '2026-02-13T10:00:00.000Z',
        },
      ],
    })

    expect(imported?.kind).toBe('backup')
    if (!imported || imported.kind !== 'backup') {
      return
    }

    expect(imported.preferences.language).toBe('en')
    expect(imported.preferences.themeMode).toBe('dark')
    expect(imported.currentRoute?.kind).toBe('route')
    expect(imported.savedTrips).toHaveLength(1)
    expect(imported.plannerDraft.mode).toBe('bike')
    expect(imported.addressBook).toHaveLength(1)
    expect(imported.addressBook[0].name).toBe('Maison')
    expect(imported.addressBook[0].tags).toEqual(['home', 'work'])
  })

  it('fusionne les doublons d adresses sur nom + coordonnees et conserve les tags', () => {
    const base = createAddressBookEntry({
      name: 'Client A',
      place: {
        label: '10 Rue Victor Hugo, Lyon',
        lat: 45.764,
        lon: 4.8357,
        score: 1,
        source: 'test',
      },
      tags: ['client'],
    })

    const duplicate = createAddressBookEntry({
      name: 'Client A',
      place: {
        label: '10 Rue Victor Hugo, Lyon',
        lat: 45.764000001,
        lon: 4.835700001,
        score: 1,
        source: 'test',
      },
      tags: ['work', 'Client'],
    })

    const merged = upsertAddressBookEntry([base], duplicate)

    expect(merged).toHaveLength(1)
    expect(merged[0].id).toBe(base.id)
    expect(merged[0].name).toBe('Client A')
    expect(merged[0].tags).toEqual(['client', 'work'])
  })

  it('importe un trajet partage', () => {
    const trip = createSavedTripRecord({
      trip: sampleRoute,
      mode: 'bike',
      startLabel: 'Paris',
      endLabel: 'Lyon',
      targetDistanceKm: '',
      name: 'Paris Lyon',
    })

    const imported = parseImportedBikeVoyagerData({
      format: 'bikevoyager-trip',
      version: 1,
      trip,
    })

    expect(imported?.kind).toBe('trip')
    if (!imported || imported.kind !== 'trip') {
      return
    }

    expect(imported.trip.name).toBe('Paris Lyon')
    expect(imported.trip.trip.kind).toBe('route')
  })

  it('cree un trajet sauvegarde avec notes tags et favori', () => {
    const trip = createSavedTripRecord({
      trip: sampleRoute,
      mode: 'bike',
      startLabel: 'Paris',
      endLabel: 'Lyon',
      targetDistanceKm: '',
      name: 'Paris Lyon',
      notes: 'À refaire au printemps',
      tags: ['Vacances', '  vacances ', 'Train'],
      favorite: true,
    })

    expect(trip.notes).toBe('À refaire au printemps')
    expect(trip.tags).toEqual(['vacances', 'train'])
    expect(trip.favorite).toBe(true)
    expect(trip.updatedAt).toBe(trip.savedAt)
  })

  it('normalise les anciens trajets sans metadonnees', () => {
    const [trip] = normalizeSavedTrips([
      {
        id: 'legacy',
        name: 'Ancien trajet',
        savedAt: '2026-02-01T10:00:00.000Z',
        tripType: 'oneway',
        mode: 'bike',
        startLabel: 'Paris',
        endLabel: 'Lyon',
        targetDistanceKm: null,
        trip: sampleRoute,
      },
    ])

    expect(trip.notes).toBeUndefined()
    expect(trip.tags).toEqual([])
    expect(trip.favorite).toBe(false)
    expect(trip.updatedAt).toBe('2026-02-01T10:00:00.000Z')
  })

  it('nettoie les tags invalides et tronque les notes trop longues', () => {
    const [trip] = normalizeSavedTrips([
      {
        id: 'dirty',
        name: 'Trajet',
        savedAt: '2026-02-01T10:00:00.000Z',
        trip: sampleRoute,
        notes: 'x'.repeat(1200),
        tags: [' Café ', '', 42, 'CAFÉ', 'tag-de-plus-de-trente-deux-caracteres'],
        favorite: 'yes',
      },
    ])

    expect(trip.notes).toHaveLength(1000)
    expect(trip.tags).toEqual(['café', 'tag-de-plus-de-trente-deux-carac'])
    expect(trip.favorite).toBe(false)
  })

  it('trie le carnet par favori puis date recente', () => {
    const trips = normalizeSavedTrips([
      {
        id: 'recent',
        name: 'Récent',
        savedAt: '2026-02-03T10:00:00.000Z',
        updatedAt: '2026-02-03T10:00:00.000Z',
        trip: sampleRoute,
      },
      {
        id: 'favorite',
        name: 'Favori',
        savedAt: '2026-02-01T10:00:00.000Z',
        updatedAt: '2026-02-01T10:00:00.000Z',
        trip: sampleRoute,
        favorite: true,
      },
    ])

    expect(sortSavedTripsForLibrary(trips).map((trip) => trip.id)).toEqual(['favorite', 'recent'])
  })

  it('filtre le carnet par nom note tag type et favori', () => {
    const route = createSavedTripRecord({
      trip: sampleRoute,
      mode: 'bike',
      startLabel: 'Paris',
      endLabel: 'Lyon',
      targetDistanceKm: '',
      name: 'Via Saône',
      notes: 'Pause café',
      tags: ['weekend'],
      favorite: true,
    })
    const loop = createSavedTripRecord({
      trip: { ...sampleRoute, kind: 'loop', overlapScore: 'faible', segmentsCount: 3 },
      mode: 'walk',
      startLabel: 'Annecy',
      endLabel: null,
      targetDistanceKm: 10,
      name: 'Boucle lac',
      tags: ['famille'],
    })

    expect(filterSavedTripsForLibrary([route, loop], { query: 'saône', filter: 'all' })).toEqual([
      route,
    ])
    expect(filterSavedTripsForLibrary([route, loop], { query: 'week', filter: 'all' })).toEqual([
      route,
    ])
    expect(filterSavedTripsForLibrary([route, loop], { query: '', filter: 'favorites' })).toEqual([
      route,
    ])
    expect(filterSavedTripsForLibrary([route, loop], { query: '', filter: 'loops' })).toEqual([
      loop,
    ])
    expect(filterSavedTripsForLibrary([route, loop], { query: '', filter: 'routes' })).toEqual([
      route,
    ])
  })

  it('met a jour les metadonnees et duplique un trajet', () => {
    const trip = createSavedTripRecord({
      trip: sampleRoute,
      mode: 'bike',
      startLabel: 'Paris',
      endLabel: 'Lyon',
      targetDistanceKm: '',
      name: 'Paris Lyon',
    })

    const updated = updateSavedTripMetadata([trip], trip.id, {
      name: 'Paris Dijon',
      notes: 'Variante calme',
      tags: ['calme'],
      favorite: true,
    })
    expect(updated[0]).toMatchObject({
      id: trip.id,
      name: 'Paris Dijon',
      notes: 'Variante calme',
      tags: ['calme'],
      favorite: true,
    })

    const duplicated = duplicateSavedTrip(updated, updated[0], 'Paris Dijon (copie)')
    expect(duplicated).toHaveLength(2)
    expect(duplicated[0].id).not.toBe(trip.id)
    expect(duplicated[0].name).toBe('Paris Dijon (copie)')
  })
})
