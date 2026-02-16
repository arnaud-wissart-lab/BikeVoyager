import { useRoutingController } from '../../features/routing/useRoutingController'
import type { AppStore } from '../../state/appStore'
import ProfilesPage from '../../ui/pages/ProfilesPage'

type SettingsRouteProps = {
  contentSize: string
  isDesktop: boolean
  store: AppStore
  routingController: ReturnType<typeof useRoutingController>
}

export default function SettingsRoute({
  contentSize,
  isDesktop,
  store,
  routingController,
}: SettingsRouteProps) {
  return (
    <ProfilesPage
      contentSize={contentSize}
      isDesktop={isDesktop}
      profileSettings={store.profileSettings}
      onSpeedChange={routingController.handleSpeedChange}
      onAssistChange={(value) =>
        store.setProfileSettings((current) => ({
          ...current,
          ebikeAssist: value,
        }))
      }
      onReset={routingController.handleResetProfiles}
    />
  )
}
