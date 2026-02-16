import { Stack } from '@mantine/core'
import type { ComponentProps } from 'react'
import type { PlaceCandidate } from '../../components/PlaceSearchInput'
import type { AddressBookEntry } from '../../features/data/dataPortability'
import type { DetourPoint, PoiCategory, PoiItem } from '../../features/routing/domain'
import DeliveryPlannerPanel from './DeliveryPlannerPanel'
import PoiDetourManagerPanel from './poi/PoiDetourManagerPanel'
import PoiFiltersSection from './poi/PoiFiltersSection'
import PoiResultsList from './poi/PoiResultsList'
import type { PoiCategoryOption, PoiCorridorRange } from './poi/types'

type PoiPanelProps = {
  isCompact: boolean
  poiCategoryOptions: PoiCategoryOption[]
  poiCategories: PoiCategory[]
  onPoiCategoryChange: (values: string[]) => void
  poiCorridorMeters: number
  onPoiCorridorMetersChange: (value: number) => void
  hasPoiCategories: boolean
  isPoiLoading: boolean
  onPoiRefresh: () => void

  isCustomDetourPanelOpen: boolean
  onToggleCustomDetourPanel: () => void
  detourPoints: DetourPoint[]

  customDetourValue: string
  onCustomDetourValueChange: (value: string) => void
  customDetourPlace: PlaceCandidate | null
  onCustomDetourPlaceSelect: (place: PlaceCandidate | null) => void
  onAddCustomDetourFromAddress: () => Promise<void>

  customDetourLat: number | ''
  customDetourLon: number | ''
  onCustomDetourLatChange: (value: string | number) => void
  onCustomDetourLonChange: (value: string | number) => void
  onAddCustomDetourFromCoordinates: () => Promise<void>
  onRemoveDetourPoint: (detourId: string) => Promise<void>
  addressBookEntries: AddressBookEntry[]
  selectedDeliveryStartId: string | null
  selectedDeliveryStopIds: string[]
  onSelectDeliveryStart: (entryId: string) => void
  onToggleDeliveryStop: (entryId: string) => void
  onAddAddressBookDetour: (entryId: string) => Promise<void>
  deliveryPlannerPanelProps: ComponentProps<typeof DeliveryPlannerPanel>

  isRouteLoading: boolean
  poiError: boolean
  poiErrorMessage: string | null
  poiItems: PoiItem[]
  selectedPoiId: string | null
  poiDetourIds: Set<string>
  poiCategoryLabels: Record<PoiCategory, string>

  onPoiSelect: (poiId: string) => void
  onAddPoiWaypoint: (poi: PoiItem) => Promise<void>
  getPoiDisplayName: (poi: PoiItem) => string
  formatPoiKind: (kind: string | null | undefined) => string | null
  formatDistance: (distanceMeters: number | null) => string

  borderColor: string
  selectedBorderColor: string
  activeBorderColor: string

  poiCorridorRange: PoiCorridorRange
}

export default function PoiPanel({
  isCompact,
  poiCategoryOptions,
  poiCategories,
  onPoiCategoryChange,
  poiCorridorMeters,
  onPoiCorridorMetersChange,
  hasPoiCategories,
  isPoiLoading,
  onPoiRefresh,
  isCustomDetourPanelOpen,
  onToggleCustomDetourPanel,
  detourPoints,
  customDetourValue,
  onCustomDetourValueChange,
  customDetourPlace,
  onCustomDetourPlaceSelect,
  onAddCustomDetourFromAddress,
  customDetourLat,
  customDetourLon,
  onCustomDetourLatChange,
  onCustomDetourLonChange,
  onAddCustomDetourFromCoordinates,
  onRemoveDetourPoint,
  addressBookEntries,
  selectedDeliveryStartId,
  selectedDeliveryStopIds,
  onSelectDeliveryStart,
  onToggleDeliveryStop,
  onAddAddressBookDetour,
  deliveryPlannerPanelProps,
  isRouteLoading,
  poiError,
  poiErrorMessage,
  poiItems,
  selectedPoiId,
  poiDetourIds,
  poiCategoryLabels,
  onPoiSelect,
  onAddPoiWaypoint,
  getPoiDisplayName,
  formatPoiKind,
  formatDistance,
  borderColor,
  selectedBorderColor,
  activeBorderColor,
  poiCorridorRange,
}: PoiPanelProps) {
  const addressBookDetourIds = new Set(
    detourPoints
      .filter((detour) => detour.id.startsWith('address-book:'))
      .map((detour) => detour.id.slice('address-book:'.length)),
  )

  return (
    <Stack gap="sm">
      <PoiFiltersSection
        poiCategoryOptions={poiCategoryOptions}
        poiCategories={poiCategories}
        onPoiCategoryChange={onPoiCategoryChange}
        poiCorridorMeters={poiCorridorMeters}
        onPoiCorridorMetersChange={onPoiCorridorMetersChange}
        hasPoiCategories={hasPoiCategories}
        isPoiLoading={isPoiLoading}
        onPoiRefresh={onPoiRefresh}
        poiCorridorRange={poiCorridorRange}
      />

      <PoiDetourManagerPanel
        isCompact={isCompact}
        isOpen={isCustomDetourPanelOpen}
        onToggle={onToggleCustomDetourPanel}
        detourPoints={detourPoints}
        customDetourValue={customDetourValue}
        onCustomDetourValueChange={onCustomDetourValueChange}
        customDetourPlace={customDetourPlace}
        onCustomDetourPlaceSelect={onCustomDetourPlaceSelect}
        onAddCustomDetourFromAddress={onAddCustomDetourFromAddress}
        customDetourLat={customDetourLat}
        customDetourLon={customDetourLon}
        onCustomDetourLatChange={onCustomDetourLatChange}
        onCustomDetourLonChange={onCustomDetourLonChange}
        onAddCustomDetourFromCoordinates={onAddCustomDetourFromCoordinates}
        onRemoveDetourPoint={onRemoveDetourPoint}
        addressBookEntries={addressBookEntries}
        addressBookDetourIds={addressBookDetourIds}
        selectedDeliveryStartId={selectedDeliveryStartId}
        selectedDeliveryStopIds={selectedDeliveryStopIds}
        onSelectDeliveryStart={onSelectDeliveryStart}
        onToggleDeliveryStop={onToggleDeliveryStop}
        onAddAddressBookDetour={onAddAddressBookDetour}
        deliveryPlannerPanelProps={deliveryPlannerPanelProps}
        isRouteLoading={isRouteLoading}
      />

      <PoiResultsList
        isCompact={isCompact}
        isPoiLoading={isPoiLoading}
        poiError={poiError}
        poiErrorMessage={poiErrorMessage}
        poiItems={poiItems}
        hasPoiCategories={hasPoiCategories}
        selectedPoiId={selectedPoiId}
        poiDetourIds={poiDetourIds}
        poiCategoryLabels={poiCategoryLabels}
        onPoiSelect={onPoiSelect}
        onAddPoiWaypoint={onAddPoiWaypoint}
        getPoiDisplayName={getPoiDisplayName}
        formatPoiKind={formatPoiKind}
        formatDistance={formatDistance}
        isRouteLoading={isRouteLoading}
        borderColor={borderColor}
        selectedBorderColor={selectedBorderColor}
        activeBorderColor={activeBorderColor}
      />
    </Stack>
  )
}
