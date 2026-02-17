import type { PlannerDraft, ProfileSettings } from '../../routing/domain'
import type {
  AppPreferences,
  ExportedPreferences,
  SupportedLanguage,
  ThemeModePreference,
} from '../dataPortability'

type BuildExportedPreferencesParams = {
  profileSettings: ProfileSettings
  appPreferences: AppPreferences
  language: 'fr' | 'en'
  themeMode: 'light' | 'dark' | 'auto'
}

export const buildExportedPreferences = ({
  profileSettings,
  appPreferences,
  language,
  themeMode,
}: BuildExportedPreferencesParams) =>
  ({
    profileSettings,
    appPreferences,
    language: (language === 'en' ? 'en' : 'fr') as SupportedLanguage,
    themeMode: themeMode as ThemeModePreference,
  }) satisfies ExportedPreferences

type PlannerDraftSnapshotParams = Pick<
  PlannerDraft,
  | 'mode'
  | 'tripType'
  | 'onewayStartValue'
  | 'onewayStartPlace'
  | 'loopStartValue'
  | 'loopStartPlace'
  | 'endValue'
  | 'endPlace'
  | 'targetDistanceKm'
>

export const buildPlannerDraftSnapshot = (params: PlannerDraftSnapshotParams) =>
  ({
    mode: params.mode,
    tripType: params.tripType,
    onewayStartValue: params.onewayStartValue,
    onewayStartPlace: params.onewayStartPlace,
    loopStartValue: params.loopStartValue,
    loopStartPlace: params.loopStartPlace,
    endValue: params.endValue,
    endPlace: params.endPlace,
    targetDistanceKm: params.targetDistanceKm,
  }) satisfies PlannerDraft
