import {
  getActiveProfilePresetKey,
  isProfilePresetActive,
  isProfileSettingsWithinSpeedRanges,
  profilePresets,
  type ProfileSettings,
} from '../features/routing/domain'

describe('profilePresets', () => {
  it('respecte les plages de vitesse disponibles', () => {
    expect(profilePresets).toHaveLength(7)

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
})
