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

export const isProfileSettingsWithinSpeedRanges = (settings: ProfileSettings) =>
  (Object.entries(settings.speeds) as [Mode, number][]).every(([mode, speed]) => {
    const range = speedRanges[mode]
    return speed >= range.min && speed <= range.max
  })

export const isProfilePresetActive = (preset: ProfilePreset, settings: ProfileSettings): boolean =>
  preset.settings.ebikeAssist === settings.ebikeAssist &&
  preset.settings.speeds.walk === settings.speeds.walk &&
  preset.settings.speeds.bike === settings.speeds.bike &&
  preset.settings.speeds.ebike === settings.speeds.ebike

export const getActiveProfilePresetKey = (settings: ProfileSettings): ProfilePresetKey | null =>
  profilePresets.find((preset) => isProfilePresetActive(preset, settings))?.key ?? null
