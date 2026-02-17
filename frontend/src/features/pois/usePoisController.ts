import { useEffect, useMemo } from 'react'
import type { TFunction } from 'i18next'
import { fetchPoisAroundRoute } from './api'
import type { AppStore } from '../../state/appStore'
import type { RouteKey } from '../routing/domain'
import type { PoiCategoryOption } from './types'

type UsePoisControllerParams = {
  store: AppStore
  route: RouteKey
  language: string
  t: TFunction
  onResetPoiSelectionUi: () => void
}

export const usePoisController = ({
  store,
  route,
  language,
  t,
  onResetPoiSelectionUi,
}: UsePoisControllerParams) => {
  const {
    routeResult,
    poiCategories,
    poiItems,
    poiAlertEnabled,
    poiAlertCategories,
    poiCorridorMeters,
    poiRefreshKey,
    isNavigationActive,
    activePoiAlertId,
    setPoiCategories,
    setPoiAlertCategories,
    setPoiItems,
    setPoiError,
    setPoiErrorMessage,
    setHasPoiFetchCompleted,
    setDetourPoints,
    setIsCustomDetourPanelOpen,
    setPoiRefreshKey,
    setIsPoiLoading,
    setActivePoiAlertId,
  } = store

  const hasRoute = Boolean(routeResult)
  const poiEnabled = hasRoute

  const poiCategoryOptions = useMemo<PoiCategoryOption[]>(
    () => [
      { value: 'monuments', label: t('poiCategoryMonuments') },
      { value: 'paysages', label: t('poiCategoryLandscapes') },
      { value: 'commerces', label: t('poiCategoryShops') },
      { value: 'services', label: t('poiCategoryServices') },
    ],
    [t],
  )

  const poiCategoryLabels = useMemo(
    () => ({
      monuments: t('poiCategoryMonuments'),
      paysages: t('poiCategoryLandscapes'),
      commerces: t('poiCategoryShops'),
      services: t('poiCategoryServices'),
    }),
    [t],
  )

  const handlePoiCategoryChange = (values: string[]) => {
    setPoiCategories(values as typeof poiCategories)
  }

  const handlePoiAlertCategoryChange = (values: string[]) => {
    setPoiAlertCategories(values as typeof poiAlertCategories)
  }

  const handlePoiRefresh = () => {
    setPoiItems([])
    onResetPoiSelectionUi()
    setPoiRefreshKey((current) => current + 1)
  }

  useEffect(() => {
    if (poiEnabled) {
      return
    }

    setPoiItems([])
    setPoiError(false)
    setPoiErrorMessage(null)
    setHasPoiFetchCompleted(false)
    onResetPoiSelectionUi()
    setDetourPoints([])
    setIsCustomDetourPanelOpen(false)
  }, [
    onResetPoiSelectionUi,
    poiEnabled,
    setDetourPoints,
    setHasPoiFetchCompleted,
    setIsCustomDetourPanelOpen,
    setPoiError,
    setPoiErrorMessage,
    setPoiItems,
  ])

  useEffect(() => {
    const shouldLoadPois = poiEnabled && route === 'carte'
    if (!shouldLoadPois) {
      return
    }

    const shouldLoadVisiblePois = poiCategories.length > 0
    const shouldLoadAlertPois =
      isNavigationActive && poiAlertEnabled && poiAlertCategories.length > 0

    const requestedCategories = Array.from(
      new Set([
        ...(shouldLoadVisiblePois ? poiCategories : []),
        ...(shouldLoadAlertPois ? poiAlertCategories : []),
      ]),
    )

    if (requestedCategories.length === 0) {
      setPoiItems([])
      setPoiError(false)
      setPoiErrorMessage(null)
      setHasPoiFetchCompleted(false)
      return
    }

    const controller = new AbortController()

    const loadPois = async () => {
      setPoiItems([])
      onResetPoiSelectionUi()
      setIsPoiLoading(true)
      setPoiError(false)
      setPoiErrorMessage(null)
      setHasPoiFetchCompleted(false)

      try {
        const geometry = routeResult?.geometry
        if (!geometry || geometry.coordinates.length < 2) {
          setPoiItems([])
          setHasPoiFetchCompleted(true)
          return
        }

        const result = await fetchPoisAroundRoute({
          geometry,
          categories: requestedCategories,
          distance: poiCorridorMeters,
          language,
          signal: controller.signal,
        })

        if (!result.ok) {
          setPoiErrorMessage(result.message)
          setPoiError(true)
          return
        }

        setPoiItems(result.data)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        setPoiErrorMessage(null)
        setPoiError(true)
      } finally {
        if (!controller.signal.aborted) {
          setHasPoiFetchCompleted(true)
        }

        setIsPoiLoading(false)
      }
    }

    void loadPois()

    return () => {
      controller.abort()
    }
  }, [
    isNavigationActive,
    language,
    onResetPoiSelectionUi,
    poiAlertCategories,
    poiAlertEnabled,
    poiCategories,
    poiCorridorMeters,
    poiEnabled,
    poiRefreshKey,
    route,
    routeResult?.geometry,
    setHasPoiFetchCompleted,
    setIsPoiLoading,
    setPoiError,
    setPoiErrorMessage,
    setPoiItems,
  ])

  useEffect(() => {
    if (!activePoiAlertId) {
      return
    }

    if (poiItems.some((poi) => poi.id === activePoiAlertId)) {
      return
    }

    setActivePoiAlertId(null)
  }, [activePoiAlertId, poiItems, setActivePoiAlertId])

  return {
    poiEnabled,
    poiCategoryOptions,
    poiCategoryLabels,
    handlePoiCategoryChange,
    handlePoiAlertCategoryChange,
    handlePoiRefresh,
  }
}
