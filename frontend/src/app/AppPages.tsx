import type { MantineTheme } from '@mantine/core'
import type { TFunction } from 'i18next'
import { useCloudController } from '../features/cloud/useCloudController'
import { useDataController } from '../features/data/useDataController'
import { useMapController } from '../features/map/useMapController'
import { usePoisController } from '../features/pois/usePoisController'
import { type RouteKey } from '../features/routing/domain'
import { useRoutingController } from '../features/routing/useRoutingController'
import type { AppStore } from '../state/appStore'
import DataRoute from './routes/DataRoute'
import HelpRoute from './routes/HelpRoute'
import MapRoute from './routes/MapRoute'
import PlannerRoute from './routes/PlannerRoute'
import SettingsRoute from './routes/SettingsRoute'
import { useAppDetourHandlers } from './useAppDetourHandlers'

type AppPagesProps = {
  route: RouteKey
  t: TFunction
  theme: MantineTheme
  isDesktop: boolean
  isDarkTheme: boolean
  isFrench: boolean
  contentSize: string
  surfaceColor: string
  borderColor: string
  availableViewportHeight: string
  chromeFooterHeight: number
  store: AppStore
  mapController: ReturnType<typeof useMapController>
  routingController: ReturnType<typeof useRoutingController>
  dataController: ReturnType<typeof useDataController>
  cloudController: ReturnType<typeof useCloudController>
  poisController: ReturnType<typeof usePoisController>
  detourHandlers: ReturnType<typeof useAppDetourHandlers>
}

export default function AppPages({
  route,
  t,
  theme,
  isDesktop,
  isDarkTheme,
  isFrench,
  contentSize,
  surfaceColor,
  borderColor,
  availableViewportHeight,
  chromeFooterHeight,
  store,
  mapController,
  routingController,
  dataController,
  cloudController,
  poisController,
  detourHandlers,
}: AppPagesProps) {
  if (route === 'carte') {
    return (
      <MapRoute
        t={t}
        theme={theme}
        isDesktop={isDesktop}
        isDarkTheme={isDarkTheme}
        surfaceColor={surfaceColor}
        borderColor={borderColor}
        availableViewportHeight={availableViewportHeight}
        chromeFooterHeight={chromeFooterHeight}
        store={store}
        mapController={mapController}
        routingController={routingController}
        dataController={dataController}
        poisController={poisController}
        detourHandlers={detourHandlers}
      />
    )
  }

  if (route === 'profils') {
    return (
      <SettingsRoute
        contentSize={contentSize}
        isDesktop={isDesktop}
        store={store}
        routingController={routingController}
      />
    )
  }

  if (route === 'donnees') {
    return (
      <DataRoute
        contentSize={contentSize}
        isDesktop={isDesktop}
        isFrench={isFrench}
        surfaceColor={surfaceColor}
        borderColor={borderColor}
        store={store}
        mapController={mapController}
        dataController={dataController}
        cloudController={cloudController}
      />
    )
  }

  if (route === 'aide') {
    return (
      <HelpRoute
        contentSize={contentSize}
        isDesktop={isDesktop}
        isDarkTheme={isDarkTheme}
        isFrench={isFrench}
        theme={theme}
        store={store}
        routingController={routingController}
      />
    )
  }

  return (
    <PlannerRoute
      contentSize={contentSize}
      isDesktop={isDesktop}
      isDarkTheme={isDarkTheme}
      theme={theme}
      store={store}
      routingController={routingController}
      dataController={dataController}
    />
  )
}
