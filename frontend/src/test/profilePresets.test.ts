import {
  defaultProfileCatalog,
  findProfileMatchingSettings,
  getActiveProfilePresetKey,
  isProfilePresetActive,
  isProfileSettingsWithinSpeedRanges,
  profilePresets,
  normalizeProfileCatalog,
  type ProfileSettings,
} from '../features/routing/domain'

describe('profilePresets', () => {
  it('respecte les plages de vitesse disponibles', () => {
    expect(profilePresets).toHaveLength(8)

    for (const preset of profilePresets) {
      expect(isProfileSettingsWithinSpeedRanges(preset.settings)).toBe(true)
    }
  })

  it('produit des ProfileSettings valides', () => {
    for (const preset of profilePresets) {
      expect(preset.settings).toMatchObject({
        speeds: {
          walk: expect.any(Number),
          bike: expect.any(Number),
          ebike: expect.any(Number),
        },
      })
      expect(['low', 'medium', 'high']).toContain(preset.settings.ebikeAssist)
    }
  })

  it('détecte le préréglage actif lorsque les valeurs correspondent', () => {
    const efficient = profilePresets.find((preset) => preset.key === 'efficient')

    expect(efficient).toBeDefined()
    expect(efficient ? isProfilePresetActive(efficient, efficient.settings) : false).toBe(true)
    expect(getActiveProfilePresetKey(efficient?.settings as ProfileSettings)).toBe('efficient')
  })

  it('associe les valeurs par défaut au profil Standard', () => {
    const standard = profilePresets.find((preset) => preset.key === 'standard')

    expect(standard).toBeDefined()
    expect(getActiveProfilePresetKey(standard?.settings as ProfileSettings)).toBe('standard')
  })

  it('ne détecte aucun préréglage actif après une modification manuelle', () => {
    const efficient = profilePresets.find((preset) => preset.key === 'efficient')
    expect(efficient).toBeDefined()

    const customized: ProfileSettings = {
      ...(efficient?.settings as ProfileSettings),
      speeds: {
        ...(efficient?.settings.speeds as ProfileSettings['speeds']),
        bike: 21,
      },
    }

    expect(getActiveProfilePresetKey(customized)).toBeNull()
  })

  it('retrouve un profil intégré modifié et un profil personnel', () => {
    const modifiedStandard: ProfileSettings = {
      speeds: { walk: 5, bike: 17, ebike: 24 },
      ebikeAssist: 'medium',
    }
    const customSettings: ProfileSettings = {
      speeds: { walk: 4.5, bike: 18, ebike: 23 },
      ebikeAssist: 'high',
    }
    const catalog = normalizeProfileCatalog(
      {
        activeProfileId: 'custom:velotaf',
        presetOverrides: { standard: modifiedStandard },
        customProfiles: [{ id: 'custom:velotaf', name: 'Vélotaf', settings: customSettings }],
      },
      customSettings,
    )

    expect(findProfileMatchingSettings(catalog, customSettings)).toMatchObject({
      id: 'custom:velotaf',
      kind: 'custom',
    })
    expect(findProfileMatchingSettings(catalog, modifiedStandard)).toMatchObject({
      id: 'preset:standard',
      kind: 'preset',
    })
  })

  it('déduit le profil Standard pour les anciennes préférences sans catalogue', () => {
    const catalog = normalizeProfileCatalog(undefined, profilePresets[0].settings)

    expect(catalog).toEqual(defaultProfileCatalog)
  })
})
