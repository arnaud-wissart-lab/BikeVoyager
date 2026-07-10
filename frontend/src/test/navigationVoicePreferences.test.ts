import {
  appPreferencesStorageKey,
  buildBackupExport,
  buildPreferencesExport,
  defaultAppPreferences,
  loadAppPreferences,
  normalizeAppPreferences,
  parseImportedBikeVoyagerData,
} from '../features/data/dataPortability'

const preferences = {
  profileSettings: {
    speeds: { walk: 5, bike: 16, ebike: 24 },
    ebikeAssist: 'medium' as const,
  },
  appPreferences: { ...defaultAppPreferences, voiceGuidanceEnabled: true },
  language: 'fr' as const,
  themeMode: 'auto' as const,
}

afterEach(() => localStorage.clear())

describe('préférence de guidage vocal', () => {
  it('est désactivée par défaut et normalise les anciennes valeurs', () => {
    expect(defaultAppPreferences.voiceGuidanceEnabled).toBe(false)
    expect(normalizeAppPreferences({}).voiceGuidanceEnabled).toBe(false)
    expect(
      normalizeAppPreferences({ voiceGuidanceEnabled: 'oui' as never }).voiceGuidanceEnabled,
    ).toBe(false)
    expect(normalizeAppPreferences({ voiceGuidanceEnabled: true }).voiceGuidanceEnabled).toBe(true)
  })

  it('recharge la valeur activée depuis le stockage existant', () => {
    localStorage.setItem(appPreferencesStorageKey, JSON.stringify(preferences.appPreferences))

    expect(loadAppPreferences().voiceGuidanceEnabled).toBe(true)
  })

  it('conserve la valeur dans un export de préférences sans changer de version', () => {
    const exported = buildPreferencesExport(preferences)
    const imported = parseImportedBikeVoyagerData(exported)

    expect(exported.version).toBe(1)
    expect(imported?.kind).toBe('preferences')
    expect(
      imported?.kind === 'preferences' && imported.preferences.appPreferences.voiceGuidanceEnabled,
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
      imported?.kind === 'backup' && imported.preferences.appPreferences.voiceGuidanceEnabled,
    ).toBe(true)
  })
})
