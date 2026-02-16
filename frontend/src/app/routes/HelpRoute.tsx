import type { MantineTheme } from '@mantine/core'
import { useRoutingController } from '../../features/routing/useRoutingController'
import type { AppStore } from '../../state/appStore'
import HelpPage from '../../ui/pages/HelpPage'

type HelpRouteProps = {
  contentSize: string
  isDesktop: boolean
  isDarkTheme: boolean
  isFrench: boolean
  theme: MantineTheme
  store: AppStore
  routingController: ReturnType<typeof useRoutingController>
}

export default function HelpRoute({
  contentSize,
  isDesktop,
  isDarkTheme,
  isFrench,
  theme,
  store,
  routingController,
}: HelpRouteProps) {
  return (
    <HelpPage
      contentSize={contentSize}
      isDesktop={isDesktop}
      isDarkTheme={isDarkTheme}
      isFrench={isFrench}
      theme={theme}
      valhallaStatus={store.valhallaStatus}
      isValhallaStatusLoading={store.isValhallaStatusLoading}
      valhallaStatusError={store.valhallaStatusError}
      valhallaUpdateAvailable={routingController.valhallaUpdateAvailable}
      isValhallaBuildRunning={routingController.isValhallaBuildRunning}
      cloudDiagnostics={store.cloudDiagnostics}
      isCloudDiagnosticsLoading={store.isCloudDiagnosticsLoading}
      cloudDiagnosticsError={store.cloudDiagnosticsError}
      feedbackSubject={store.feedbackSubject}
      feedbackContactEmail={store.feedbackContactEmail}
      feedbackMessage={store.feedbackMessage}
      isFeedbackSubmitting={store.isFeedbackSubmitting}
      canSubmitFeedback={routingController.canSubmitFeedback}
      feedbackSubmitMessage={store.feedbackSubmitMessage}
      feedbackSubmitError={store.feedbackSubmitError}
      onFeedbackSubjectChange={store.setFeedbackSubject}
      onFeedbackContactEmailChange={store.setFeedbackContactEmail}
      onFeedbackMessageChange={store.setFeedbackMessage}
      onSubmitFeedback={() => {
        void routingController.handleSubmitDeveloperFeedback()
      }}
    />
  )
}
