import type { MantineTheme } from '@mantine/core'
import { useDataController } from '../../features/data/useDataController'
import { useRoutingController } from '../../features/routing/useRoutingController'
import type { AppStore } from '../../state/appStore'
import PlannerPage from '../../ui/pages/PlannerPage'

type PlannerRouteProps = {
  contentSize: string
  isDesktop: boolean
  isDarkTheme: boolean
  theme: MantineTheme
  store: AppStore
  routingController: ReturnType<typeof useRoutingController>
  dataController: ReturnType<typeof useDataController>
}

export default function PlannerRoute({
  contentSize,
  isDesktop,
  isDarkTheme,
  theme,
  store,
  routingController,
  dataController,
}: PlannerRouteProps) {
  return (
    <PlannerPage
      contentSize={contentSize}
      isDesktop={isDesktop}
      isDarkTheme={isDarkTheme}
      theme={theme}
      mode={store.mode}
      tripType={store.tripType}
      showLocationInputs={routingController.showLocationInputs}
      panelStackStyle={routingController.panelStackStyle}
      getPanelStyle={routingController.getPanelStyle}
      onModeChange={routingController.handleModeChange}
      onTypeChange={routingController.handleTypeChange}
      onewayStartValue={store.onewayStartValue}
      onOnewayStartValueChange={routingController.handleOnewayStartValueChange}
      onOnewayStartPlaceSelect={routingController.handleOnewayStartPlaceSelect}
      canQuickSaveOnewayStart={dataController.canQuickSaveOnewayStart}
      onSaveQuickOnewayStart={() => dataController.handleSaveQuickAddress(store.onewayStartPlace)}
      endValue={store.endValue}
      onEndValueChange={routingController.handleEndValueChange}
      onEndPlaceSelect={routingController.handleEndPlaceSelect}
      canQuickSaveOnewayEnd={dataController.canQuickSaveOnewayEnd}
      onSaveQuickOnewayEnd={() => dataController.handleSaveQuickAddress(store.endPlace)}
      loopStartValue={store.loopStartValue}
      onLoopStartValueChange={routingController.handleLoopStartValueChange}
      onLoopStartPlaceSelect={routingController.handleLoopStartPlaceSelect}
      canQuickSaveLoopStart={dataController.canQuickSaveLoopStart}
      onSaveQuickLoopStart={() => dataController.handleSaveQuickAddress(store.loopStartPlace)}
      targetDistanceKm={store.targetDistanceKm}
      onTargetDistanceChange={routingController.handleTargetDistanceChange}
      helperHasMissing={routingController.helperHasMissing}
      helperItems={routingController.helperItems}
      helperReadyLabel={routingController.helperReadyLabel}
      isFormReady={routingController.isFormReady}
      isRouteLoading={store.isRouteLoading}
      onCalculate={() => {
        void routingController.handleCalculate()
      }}
      ctaLabel={routingController.ctaLabel}
      routeErrorMessage={routingController.routeErrorDisplayMessage}
    />
  )
}
