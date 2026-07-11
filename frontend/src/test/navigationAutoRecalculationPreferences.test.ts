import {
  appPreferencesStorageKey,
  buildBackupExport,
  buildPreferencesExport,
  defaultAppPreferences,
  loadAppPreferences,
  normalizeAppPreferences,
  parseImportedBikeVoyagerData,
} from '../features/data/dataPortability'
import { applyParsedImportedData } from '../features/data/controller/importExport'

const preferences = {
  profileSettings: {
    speeds: { walk: 5, bike: 16, ebike: 24 },
    ebikeAssist: 'medium' as const,
  },
  appPreferences: {
    ...defaultAppPreferences,
    automaticNavigationRecalculationEnabled: true,
  },
  language: 'fr' as const,
  themeMode: 'auto' as const,
}

afterEach(() => localStorage.clear())

describe('préférence de recalcul automatique', () => {
  it('est désactivée par défaut et normalise les anciens payloads ou valeurs invalides', () => {
    expect(defaultAppPreferences.automaticNavigationRecalculationEnabled).toBe(false)
    expect(normalizeAppPreferences({}).automaticNavigationRecalculationEnabled).toBe(false)
    expect(
      normalizeAppPreferences({ automaticNavigationRecalculationEnabled: 'oui' as never })
        .automaticNavigationRecalculationEnabled,
    ).toBe(false)
    expect(
      normalizeAppPreferences({ automaticNavigationRecalculationEnabled: true })
        .automaticNavigationRecalculationEnabled,
    ).toBe(true)
  })

  it('recharge la valeur activée depuis le stockage local', () => {
    localStorage.setItem(appPreferencesStorageKey, JSON.stringify(preferences.appPreferences))

    expect(loadAppPreferences().automaticNavigationRecalculationEnabled).toBe(true)
  })

  it('conserve la valeur dans un export de préférences sans changer de version', () => {
    const exported = buildPreferencesExport(preferences)
    const imported = parseImportedBikeVoyagerData(exported)

    expect(exported.version).toBe(1)
    expect(imported?.kind).toBe('preferences')
    expect(
      imported?.kind === 'preferences' &&
        imported.preferences.appPreferences.automaticNavigationRecalculationEnabled,
    ).toBe(true)
  })

  it('conserve la valeur dans une sauvegarde complète', () => {
    const exported = buildBackupExport({
      preferences,
      plannerDraft: {
        mode: null,
        tripType: null,
        onewayStartValue: '',
        onewayStartPlace: null,
        loopStartValue: '',
        loopStartPlace: null,
        endValue: '',
        endPlace: null,
        targetDistanceKm: '',
      },
      currentRoute: null,
      savedTrips: [],
      addressBook: [],
    })
    const imported = parseImportedBikeVoyagerData(exported)

    expect(exported.version).toBe(1)
    expect(imported?.kind).toBe('backup')
    expect(
      imported?.kind === 'backup' &&
        imported.preferences.appPreferences.automaticNavigationRecalculationEnabled,
    ).toBe(true)
  })

  it('applique la préférence lors d’une restauration de préférences ou cloud', () => {
    const imported = parseImportedBikeVoyagerData(buildPreferencesExport(preferences))
    expect(imported?.kind).toBe('preferences')
    if (!imported) {
      throw new Error('Les préférences de test doivent être importables.')
    }

    const setAutomaticNavigationRecalculationEnabled = vi.fn()
    const store = {
      setProfileSettings: vi.fn(),
      setAutomaticNavigationRecalculationEnabled,
      setVoiceGuidanceEnabled: vi.fn(),
      setPoiAlertEnabled: vi.fn(),
      setPoiAlertDistanceMeters: vi.fn(),
      setPoiAlertCategories: vi.fn(),
      setPoiCategories: vi.fn(),
      setPoiAdvancedFilterSettings: vi.fn(),
      setPoiCorridorMeters: vi.fn(),
      setCloudProvider: vi.fn(),
      setCloudAutoBackupEnabled: vi.fn(),
    }

    applyParsedImportedData({
      store: store as never,
      setThemeMode: vi.fn(),
      imported,
      hasPlannerDraftContent: false,
    })

    expect(setAutomaticNavigationRecalculationEnabled).toHaveBeenCalledWith(true)
  })
})
