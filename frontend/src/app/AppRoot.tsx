import { useComputedColorScheme, useMantineColorScheme, useMantineTheme } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconDatabase, IconHelpCircle, IconMap2, IconRoute, IconUser } from '@tabler/icons-react'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useCloudController } from '../features/cloud/useCloudController'
import { useDataController } from '../features/data/useDataController'
import { loadAppPreferences } from '../features/data/dataPortability'
import { useMapController } from '../features/map/useMapController'
import { usePoisController } from '../features/pois/usePoisController'
import { type RouteKey } from '../features/routing/domain'
import { loadPlannerDraft } from '../features/routing/domain'
import useHashRoute from '../features/routing/useHashRoute'
import { useRoutingController } from '../features/routing/useRoutingController'
import { useAppStore } from '../state/appStore'
import ShellLayout, { type ShellNavItem } from '../ui/shell/ShellLayout'
import ShellModals from '../ui/shell/ShellModals'
import AppPages from './AppPages'
import { useAppDetourHandlers } from './useAppDetourHandlers'

export default function AppRoot() {
  const { t, i18n } = useTranslation()
  const theme = useMantineTheme()
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const computedColorScheme = useComputedColorScheme('light')
  const isDesktop = useMediaQuery('(min-width: 60em)')

  const initialPlannerDraft = useMemo(() => loadPlannerDraft(), [])
  const initialAppPreferences = useMemo(() => loadAppPreferences(), [])
  const [route, navigate] = useHashRoute('planifier')
  const store = useAppStore({
    initialPlannerDraft,
    initialAppPreferences,
  })

  const language = i18n.language.startsWith('en') ? 'en' : 'fr'
  const isFrench = language === 'fr'
  const themeMode = colorScheme
  const isDarkTheme = computedColorScheme === 'dark'
  const nextThemeMode = themeMode === 'auto' ? 'light' : themeMode === 'light' ? 'dark' : 'auto'
  const mobileThemeModeLabel =
    themeMode === 'auto' ? t('themeAuto') : themeMode === 'light' ? t('themeLight') : t('themeDark')
  const mobileThemeActionLabel = `${t('settingsThemeLabel')}: ${mobileThemeModeLabel}`

  const handleNavigate = (next: RouteKey, force = false) => {
    if (store.isNavigationActive) {
      store.setIsNavigationActive(false)
    }
    if (store.isNavigationSetupOpen) {
      store.setIsNavigationSetupOpen(false)
    }
    void force
    navigate(next)
  }

  const mapController = useMapController({
    store,
    route,
    isDesktop,
    t,
    isFrench,
    initialMapViewMode: initialAppPreferences.mapViewMode,
  })
  const routingController = useRoutingController({
    store,
    route,
    t,
    map: {
      mapTripType: mapController.mapTripType,
      mapStartCoordinate: mapController.mapStartCoordinate,
      mapEndCoordinate: mapController.mapEndCoordinate,
      startLabel: mapController.startLabel,
      endLabel: mapController.endLabel,
      mapHeaderTitle: mapController.mapHeaderTitle,
    },
    onNavigate: handleNavigate,
  })

  const footerHeight = isDesktop ? 0 : 72
  const showShellHeader = !store.isNavigationActive || (!isDesktop && route === 'carte')
  const showShellFooter = !store.isNavigationActive
  const showMobileCompactHeader = !isDesktop && showShellHeader
  const showDesktopMapHeader = isDesktop && route === 'carte' && mapController.hasRoute
  const headerHeight = isDesktop ? 72 : 56
  const chromeHeaderHeight = showShellHeader ? headerHeight : 0
  const chromeFooterHeight = showShellFooter ? footerHeight : 0
  const contentSize = isDesktop ? '84rem' : 'xl'
  const surfaceColor = isDarkTheme ? theme.colors.gray[9] : theme.white
  const borderColor = theme.colors.gray[isDarkTheme ? 8 : 3]
  const shellChromeBackground = isDarkTheme ? 'rgba(14, 17, 24, 0.84)' : 'rgba(255, 255, 255, 0.86)'
  const shellChromeFilter = 'saturate(1.15) blur(12px)'
  const shellMainBackground = isDarkTheme
    ? 'radial-gradient(1200px 520px at -15% -10%, rgba(35,87,153,0.34) 0%, rgba(13,19,30,0) 55%), radial-gradient(900px 420px at 110% -5%, rgba(29,120,89,0.22) 0%, rgba(12,18,28,0) 55%), linear-gradient(180deg, rgba(12,15,21,1) 0%, rgba(10,14,20,1) 100%)'
    : 'radial-gradient(1200px 520px at -15% -10%, rgba(120,186,255,0.3) 0%, rgba(244,248,255,0) 55%), radial-gradient(900px 420px at 110% -5%, rgba(125,217,186,0.26) 0%, rgba(245,250,248,0) 55%), linear-gradient(180deg, rgba(247,250,255,1) 0%, rgba(244,247,252,1) 100%)'
  const viewportHeightUnit = isDesktop ? '100vh' : '100dvh'
  const availableViewportHeight = `calc(${viewportHeightUnit} - ${chromeHeaderHeight + chromeFooterHeight}px)`

  const toastPosition = isDesktop ? 'top-right' : 'top-center'
  const toastTopOffsetPx = showShellHeader ? headerHeight + 10 : 10
  const toastStyle = useMemo(
    () =>
      ({
        marginTop: `${toastTopOffsetPx}px`,
        maxWidth: isDesktop ? 'min(420px, calc(100vw - 40px))' : 'calc(100vw - 24px)',
      }) as const,
    [isDesktop, toastTopOffsetPx],
  )
  const showSuccessToast = (message: string, options?: { title?: string; durationMs?: number }) => {
    notifications.show({
      color: 'teal',
      position: toastPosition,
      autoClose: options?.durationMs ?? 2600,
      style: toastStyle,
      title: options?.title,
      message,
    })
  }
  const showErrorToast = (message: string, options?: { title?: string; durationMs?: number }) => {
    notifications.show({
      color: 'red',
      position: toastPosition,
      autoClose: options?.durationMs ?? 5000,
      style: toastStyle,
      title: options?.title,
      message,
    })
  }

  const dataController = useDataController({
    store,
    t,
    language,
    themeMode,
    setThemeMode: setColorScheme,
    mapViewMode: mapController.mapViewMode,
    mapHeaderTitle: mapController.mapHeaderTitle,
    startLabel: mapController.startLabel,
    showSuccessToast,
    showErrorToast,
    requestRoute: routingController.requestRoute,
  })
  const cloudController = useCloudController({
    store,
    route,
    t,
    isDesktop,
    cloudBackupPayloadContent: dataController.cloudBackupPayloadContent,
    parseImportedPayload: dataController.parseImportedPayload,
    applyParsedImportedData: dataController.applyParsedImportedData,
    wouldCloudBackupMergeChangeLocal: dataController.wouldCloudBackupMergeChangeLocal,
    cloudRestoreSuccessMessageByKind: dataController.cloudRestoreSuccessMessageByKind,
    hasLocalBackupData: dataController.hasLocalBackupData,
  })
  const poisController = usePoisController({
    store,
    route,
    language: i18n.language,
    t,
    onResetPoiSelectionUi: mapController.resetPoiSelectionUi,
  })
  const detourHandlers = useAppDetourHandlers({
    store,
    mapController,
    routingController,
    dataController,
  })

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const root = document.documentElement
    const previousRootBackground = root.style.background
    const previousBodyBackground = document.body.style.background
    root.style.background = shellMainBackground
    document.body.style.background = shellMainBackground

    return () => {
      root.style.background = previousRootBackground
      document.body.style.background = previousBodyBackground
    }
  }, [shellMainBackground])

  const navItems: ShellNavItem[] = [
    { key: 'planifier', label: t('navPlanifier'), icon: IconRoute, disabled: false },
    { key: 'carte', label: t('navCarte'), icon: IconMap2, disabled: false },
    { key: 'profils', label: t('navProfils'), icon: IconUser, disabled: false },
    { key: 'donnees', label: t('navDonnees'), icon: IconDatabase, disabled: false },
    { key: 'aide', label: t('navAide'), icon: IconHelpCircle, disabled: false },
  ]

  const mainContent = (
    <AppPages
      route={route}
      t={t}
      theme={theme}
      isDesktop={isDesktop}
      isDarkTheme={isDarkTheme}
      isFrench={isFrench}
      contentSize={contentSize}
      surfaceColor={surfaceColor}
      borderColor={borderColor}
      availableViewportHeight={availableViewportHeight}
      chromeFooterHeight={chromeFooterHeight}
      store={store}
      mapController={mapController}
      routingController={routingController}
      dataController={dataController}
      cloudController={cloudController}
      poisController={poisController}
      detourHandlers={detourHandlers}
    />
  )

  return (
    <>
      <ShellLayout
        isDesktop={isDesktop}
        route={route}
        navItems={navItems}
        onNavigate={handleNavigate}
        showShellHeader={showShellHeader}
        showShellFooter={showShellFooter}
        showMobileCompactHeader={showMobileCompactHeader}
        showDesktopMapHeader={showDesktopMapHeader}
        headerHeight={headerHeight}
        footerHeight={footerHeight}
        viewportHeightUnit={viewportHeightUnit}
        availableViewportHeight={availableViewportHeight}
        contentSize={contentSize}
        borderColor={borderColor}
        shellChromeBackground={shellChromeBackground}
        shellChromeFilter={shellChromeFilter}
        shellMainBackground={shellMainBackground}
        isMapRoute={route === 'carte'}
        mobileHeaderTitle={mapController.mobileHeaderTitle}
        mapHeaderTitle={mapController.mapHeaderTitle}
        appNameLabel={t('appName')}
        appTaglineLabel={t('tagline')}
        language={language}
        onLanguageChange={(value) => {
          void i18n.changeLanguage(value)
        }}
        mapViewMode={mapController.mapViewMode}
        onMapViewModeChange={mapController.setMapViewMode}
        mapViewLabel={t('mapViewLabel')}
        mapView2dLabel={t('mapView2d')}
        mapView3dLabel={t('mapView3d')}
        themeMode={themeMode}
        onThemeModeChange={setColorScheme}
        isDarkTheme={isDarkTheme}
        nextThemeMode={nextThemeMode}
        mobileThemeActionLabel={mobileThemeActionLabel}
        settingsLanguageLabel={t('settingsLanguageLabel')}
        themeAutoLabel={t('themeAuto')}
        themeLightLabel={t('themeLight')}
        themeDarkLabel={t('themeDark')}
        mainContent={mainContent}
        surfaceGrayDisabled={theme.colors.gray[4]}
        surfaceGrayDefault={theme.colors.gray[6]}
        activeRouteColor={theme.colors.blue[6]}
      />

      <ShellModals
        pendingCloudRestoreModifiedAt={cloudController.pendingCloudRestore?.modifiedAt ?? null}
        isOpen={cloudController.pendingCloudRestore !== null}
        isFrench={isFrench}
        onCancelPendingCloudRestore={cloudController.handleCancelPendingCloudRestore}
        onApplyPendingCloudRestore={cloudController.applyPendingCloudRestore}
      />
    </>
  )
}
