import { defaultProfileSettings, speedRanges } from './constants'
import type { Mode, ProfileSettings } from './types'

export type ProfilePresetKey =
  | 'standard'
  | 'leisure'
  | 'balanced'
  | 'efficient'
  | 'sport'
  | 'ebikeEco'
  | 'ebikeComfort'
  | 'ebikePower'

export type ProfilePreset = {
  key: ProfilePresetKey
  labelKey: string
  descriptionKey: string
  settings: ProfileSettings
}

export type CustomProfile = {
  id: string
  name: string
  settings: ProfileSettings
}

export type ProfileCatalog = {
  activeProfileId: string | null
  presetOverrides: Partial<Record<ProfilePresetKey, ProfileSettings>>
  customProfiles: CustomProfile[]
}

export type ResolvedProfile =
  | {
      id: string
      kind: 'preset'
      preset: ProfilePreset
      settings: ProfileSettings
    }
  | {
      id: string
      kind: 'custom'
      profile: CustomProfile
      settings: ProfileSettings
    }

export const profilePresets: ProfilePreset[] = [
  {
    key: 'standard',
    labelKey: 'profilePresetStandard',
    descriptionKey: 'profilePresetStandardDescription',
    settings: defaultProfileSettings,
  },
  {
    key: 'leisure',
    labelKey: 'profilePresetLeisure',
    descriptionKey: 'profilePresetLeisureDescription',
    settings: {
      speeds: { walk: 4.5, bike: 12, ebike: 18 },
      ebikeAssist: 'low',
    },
  },
  {
    key: 'balanced',
    labelKey: 'profilePresetBalanced',
    descriptionKey: 'profilePresetBalancedDescription',
    settings: {
      speeds: { walk: 5, bike: 15, ebike: 22 },
      ebikeAssist: 'medium',
    },
  },
  {
    key: 'efficient',
    labelKey: 'profilePresetEfficient',
    descriptionKey: 'profilePresetEfficientDescription',
    settings: {
      speeds: { walk: 5.5, bike: 20, ebike: 25 },
      ebikeAssist: 'medium',
    },
  },
  {
    key: 'sport',
    labelKey: 'profilePresetSport',
    descriptionKey: 'profilePresetSportDescription',
    settings: {
      speeds: { walk: 6, bike: 25, ebike: 25 },
      ebikeAssist: 'low',
    },
  },
  {
    key: 'ebikeEco',
    labelKey: 'profilePresetEbikeEco',
    descriptionKey: 'profilePresetEbikeEcoDescription',
    settings: {
      speeds: { walk: 5, bike: 15, ebike: 20 },
      ebikeAssist: 'low',
    },
  },
  {
    key: 'ebikeComfort',
    labelKey: 'profilePresetEbikeComfort',
    descriptionKey: 'profilePresetEbikeComfortDescription',
    settings: {
      speeds: { walk: 5, bike: 15, ebike: 23 },
      ebikeAssist: 'medium',
    },
  },
  {
    key: 'ebikePower',
    labelKey: 'profilePresetEbikePower',
    descriptionKey: 'profilePresetEbikePowerDescription',
    settings: {
      speeds: { walk: 5, bike: 15, ebike: 25 },
      ebikeAssist: 'high',
    },
  },
]

export const defaultProfileCatalog: ProfileCatalog = {
  activeProfileId: 'preset:standard',
  presetOverrides: {},
  customProfiles: [],
}

export const profilePresetId = (key: ProfilePresetKey) => `preset:${key}`

export const areProfileSettingsEqual = (left: ProfileSettings, right: ProfileSettings): boolean =>
  left.ebikeAssist === right.ebikeAssist &&
  left.speeds.walk === right.speeds.walk &&
  left.speeds.bike === right.speeds.bike &&
  left.speeds.ebike === right.speeds.ebike

export const getProfilePresetSettings = (
  catalog: ProfileCatalog,
  preset: ProfilePreset,
): ProfileSettings => catalog.presetOverrides[preset.key] ?? preset.settings

export const resolveProfileById = (
  catalog: ProfileCatalog,
  profileId: string | null,
): ResolvedProfile | null => {
  if (!profileId) {
    return null
  }

  if (profileId.startsWith('preset:')) {
    const key = profileId.slice('preset:'.length) as ProfilePresetKey
    const preset = profilePresets.find((candidate) => candidate.key === key)
    return preset
      ? {
          id: profileId,
          kind: 'preset',
          preset,
          settings: getProfilePresetSettings(catalog, preset),
        }
      : null
  }

  const profile = catalog.customProfiles.find((candidate) => candidate.id === profileId)
  return profile
    ? {
        id: profile.id,
        kind: 'custom',
        profile,
        settings: profile.settings,
      }
    : null
}

export const findProfileMatchingSettings = (
  catalog: ProfileCatalog,
  settings: ProfileSettings,
): ResolvedProfile | null => {
  const activeProfile = resolveProfileById(catalog, catalog.activeProfileId)
  if (activeProfile && areProfileSettingsEqual(activeProfile.settings, settings)) {
    return activeProfile
  }

  for (const preset of profilePresets) {
    const presetSettings = getProfilePresetSettings(catalog, preset)
    if (areProfileSettingsEqual(presetSettings, settings)) {
      return {
        id: profilePresetId(preset.key),
        kind: 'preset',
        preset,
        settings: presetSettings,
      }
    }
  }

  const customProfile = catalog.customProfiles.find((profile) =>
    areProfileSettingsEqual(profile.settings, settings),
  )
  return customProfile
    ? {
        id: customProfile.id,
        kind: 'custom',
        profile: customProfile,
        settings: customProfile.settings,
      }
    : null
}

export const isProfileSettingsWithinSpeedRanges = (settings: ProfileSettings) =>
  (Object.entries(settings.speeds) as [Mode, number][]).every(([mode, speed]) => {
    const range = speedRanges[mode]
    return speed >= range.min && speed <= range.max
  })

export const isProfilePresetActive = (preset: ProfilePreset, settings: ProfileSettings): boolean =>
  areProfileSettingsEqual(preset.settings, settings)

export const getActiveProfilePresetKey = (settings: ProfileSettings): ProfilePresetKey | null =>
  profilePresets.find((preset) => isProfilePresetActive(preset, settings))?.key ?? null
