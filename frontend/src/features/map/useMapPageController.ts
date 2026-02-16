import { useCallback, useMemo, useState } from 'react'
import type { MapCommand, MapViewMode, PoiItem } from '../routing/domain'

type UseMapPageControllerParams = {
  initialMapViewMode: MapViewMode
  isDesktop: boolean
  visiblePoiItems: PoiItem[]
  poiItems: PoiItem[]
  activePoiAlertId: string | null
}

type UseMapPageControllerResult = {
  mapViewMode: MapViewMode
  setMapViewMode: (value: MapViewMode) => void
  mapCommand: MapCommand | null
  mapCommandSeq: number
  triggerMapCommand: (command: MapCommand) => void
  isSummaryPanelExpanded: boolean
  toggleSummaryPanel: () => void
  isPoiPanelExpanded: boolean
  togglePoiPanel: () => void
  isMobileMapPanelExpanded: boolean
  setIsMobileMapPanelExpanded: (value: boolean) => void
  toggleMobileMapPanel: () => void
  selectedPoiId: string | null
  setSelectedPoiId: (value: string | null) => void
  isPoiModalOpen: boolean
  setIsPoiModalOpen: (value: boolean) => void
  isMobilePoiDetailsExpanded: boolean
  setIsMobilePoiDetailsExpanded: (value: boolean) => void
  toggleMobilePoiDetails: () => void
  selectedPoi: PoiItem | null
  activePoiAlert: PoiItem | null
  handlePoiSelect: (poiId: string) => void
}

export default function useMapPageController({
  initialMapViewMode,
  isDesktop,
  visiblePoiItems,
  poiItems,
  activePoiAlertId,
}: UseMapPageControllerParams): UseMapPageControllerResult {
  const [mapViewModeState, setMapViewModeState] = useState<MapViewMode>(
    initialMapViewMode,
  )
  const [mapCommand, setMapCommand] = useState<MapCommand | null>(null)
  const [mapCommandSeq, setMapCommandSeq] = useState(0)
  const [isSummaryPanelExpanded, setIsSummaryPanelExpanded] = useState(true)
  const [isPoiPanelExpanded, setIsPoiPanelExpanded] = useState(false)
  const [isMobileMapPanelExpanded, setIsMobileMapPanelExpandedState] =
    useState(false)
  const [selectedPoiId, setSelectedPoiIdState] = useState<string | null>(null)
  const [isPoiModalOpen, setIsPoiModalOpenState] = useState(false)
  const [isMobilePoiDetailsExpanded, setIsMobilePoiDetailsExpandedState] =
    useState(true)

  const selectedPoi = useMemo(
    () => visiblePoiItems.find((poi) => poi.id === selectedPoiId) ?? null,
    [selectedPoiId, visiblePoiItems],
  )

  const activePoiAlert = useMemo(
    () => poiItems.find((poi) => poi.id === activePoiAlertId) ?? null,
    [activePoiAlertId, poiItems],
  )

  const triggerMapCommand = useCallback((command: MapCommand) => {
    setMapCommand(command)
    setMapCommandSeq((current) => current + 1)
  }, [])

  const toggleSummaryPanel = useCallback(() => {
    setIsSummaryPanelExpanded((current) => !current)
  }, [])

  const togglePoiPanel = useCallback(() => {
    setIsPoiPanelExpanded((current) => {
      const nextExpanded = !current
      if (nextExpanded && !isDesktop) {
        setIsMobilePoiDetailsExpandedState(false)
      }
      return nextExpanded
    })
  }, [isDesktop])

  const toggleMobileMapPanel = useCallback(() => {
    if (isDesktop) {
      return
    }

    setIsMobileMapPanelExpandedState((current) => {
      const nextExpanded = !current
      if (nextExpanded) {
        setIsMobilePoiDetailsExpandedState(false)
      }
      return nextExpanded
    })
  }, [isDesktop])

  const toggleMobilePoiDetails = useCallback(() => {
    if (isDesktop) {
      return
    }

    setIsMobilePoiDetailsExpandedState((current) => {
      const nextExpanded = !current
      if (nextExpanded) {
        setIsMobileMapPanelExpandedState(false)
      }
      return nextExpanded
    })
  }, [isDesktop])

  const handlePoiSelect = useCallback(
    (poiId: string) => {
      setSelectedPoiIdState(poiId)
      setIsPoiModalOpenState(true)
      setIsMobilePoiDetailsExpandedState(true)
      if (!isDesktop) {
        setIsMobileMapPanelExpandedState(false)
      }
    },
    [isDesktop],
  )

  return {
    mapViewMode: mapViewModeState,
    setMapViewMode: setMapViewModeState,
    mapCommand,
    mapCommandSeq,
    triggerMapCommand,
    isSummaryPanelExpanded,
    toggleSummaryPanel,
    isPoiPanelExpanded,
    togglePoiPanel,
    isMobileMapPanelExpanded,
    setIsMobileMapPanelExpanded: setIsMobileMapPanelExpandedState,
    toggleMobileMapPanel,
    selectedPoiId,
    setSelectedPoiId: setSelectedPoiIdState,
    isPoiModalOpen,
    setIsPoiModalOpen: setIsPoiModalOpenState,
    isMobilePoiDetailsExpanded,
    setIsMobilePoiDetailsExpanded: setIsMobilePoiDetailsExpandedState,
    toggleMobilePoiDetails,
    selectedPoi,
    activePoiAlert,
    handlePoiSelect,
  }
}
