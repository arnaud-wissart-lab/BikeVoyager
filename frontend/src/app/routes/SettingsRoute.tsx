import {
  areProfileSettingsEqual,
  getProfilePresetSettings,
  profilePresetId,
  profilePresets,
  type ProfilePresetKey,
  type ProfileSettings,
} from '../../features/routing/domain'
import type { AppStore } from '../../state/appStore'
import ProfilesPage from '../../ui/pages/ProfilesPage'

type SettingsRouteProps = {
  contentSize: string
  isDesktop: boolean
  store: AppStore
}

const createCustomProfileId = () => {
  const uniquePart =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`

  return `custom:${uniquePart}`
}

export default function SettingsRoute({ contentSize, isDesktop, store }: SettingsRouteProps) {
  const applyProfile = (profileId: string, settings: ProfileSettings) => {
    store.setProfileCatalog((current) => ({
      ...current,
      activeProfileId: profileId,
    }))
    store.setProfileSettings(settings)
  }

  const savePreset = (presetKey: ProfilePresetKey, settings: ProfileSettings) => {
    const preset = profilePresets.find((candidate) => candidate.key === presetKey)
    if (!preset) {
      return
    }

    store.setProfileCatalog((current) => {
      const presetOverrides = { ...current.presetOverrides }
      if (areProfileSettingsEqual(settings, preset.settings)) {
        delete presetOverrides[presetKey]
      } else {
        presetOverrides[presetKey] = settings
      }

      return {
        ...current,
        activeProfileId: profilePresetId(presetKey),
        presetOverrides,
      }
    })
    store.setProfileSettings(settings)
  }

  const createCustomProfile = (name: string, settings: ProfileSettings) => {
    const id = createCustomProfileId()
    store.setProfileCatalog((current) => ({
      ...current,
      activeProfileId: id,
      customProfiles: [...current.customProfiles, { id, name, settings }],
    }))
    store.setProfileSettings(settings)
  }

  const updateCustomProfile = (profileId: string, name: string, settings: ProfileSettings) => {
    store.setProfileCatalog((current) => ({
      ...current,
      activeProfileId: profileId,
      customProfiles: current.customProfiles.map((profile) =>
        profile.id === profileId ? { ...profile, name, settings } : profile,
      ),
    }))
    store.setProfileSettings(settings)
  }

  const deleteCustomProfile = (profileId: string) => {
    const isActive = store.profileCatalog.activeProfileId === profileId
    const standardPreset = profilePresets[0]
    const standardSettings = getProfilePresetSettings(store.profileCatalog, standardPreset)

    store.setProfileCatalog((current) => ({
      ...current,
      activeProfileId: isActive ? profilePresetId(standardPreset.key) : current.activeProfileId,
      customProfiles: current.customProfiles.filter((profile) => profile.id !== profileId),
    }))
    if (isActive) {
      store.setProfileSettings(standardSettings)
    }
  }

  return (
    <ProfilesPage
      contentSize={contentSize}
      isDesktop={isDesktop}
      profileSettings={store.profileSettings}
      profileCatalog={store.profileCatalog}
      onProfileApply={applyProfile}
      onPresetSave={savePreset}
      onCustomProfileCreate={createCustomProfile}
      onCustomProfileUpdate={updateCustomProfile}
      onCustomProfileDelete={deleteCustomProfile}
    />
  )
}
