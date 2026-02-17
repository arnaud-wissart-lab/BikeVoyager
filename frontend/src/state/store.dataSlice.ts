import { useRef, useState } from 'react'
import {
  defaultCloudProviderAvailabilityState,
  type CloudAuthState,
  type CloudDiagnostics,
} from '../features/cloud/cloudSync'
import type {
  ImportedApplyMode,
  PendingCloudRestore,
} from '../features/cloud/types'
import { addressBookFilterAll } from '../features/data/addressBookUtils'
import {
  loadAddressBook,
  loadSavedTrips,
  type AddressBookEntry,
  type AppPreferences,
  type SavedTripRecord,
} from '../features/data/dataPortability'
import type { Mode, PlaceCandidate } from '../features/routing/domain'

type UseDataSliceParams = {
  initialAppPreferences: AppPreferences
}

export const useDataSlice = ({ initialAppPreferences }: UseDataSliceParams) => {
  const [savedTrips, setSavedTrips] = useState<SavedTripRecord[]>(() =>
    loadSavedTrips(),
  )
  const [addressBook, setAddressBook] = useState<AddressBookEntry[]>(() =>
    loadAddressBook(),
  )
  const [dataAccordionValue, setDataAccordionValue] = useState<string | null>(
    'address-book',
  )
  const [addressBookNameValue, setAddressBookNameValue] = useState('')
  const [addressBookPlaceValue, setAddressBookPlaceValue] = useState('')
  const [addressBookTagsValue, setAddressBookTagsValue] = useState('')
  const [addressBookFilterTag, setAddressBookFilterTag] =
    useState(addressBookFilterAll)
  const [addressBookPlaceCandidate, setAddressBookPlaceCandidate] =
    useState<PlaceCandidate | null>(null)
  const [deliveryStartAddressId, setDeliveryStartAddressId] = useState<
    string | null
  >(null)
  const [deliveryStopAddressIds, setDeliveryStopAddressIds] = useState<
    string[]
  >([])
  const [deliveryReturnToStart, setDeliveryReturnToStart] = useState(true)
  const [deliveryOptimizeStops, setDeliveryOptimizeStops] = useState(true)
  const [deliveryDraggedStopId, setDeliveryDraggedStopId] = useState<
    string | null
  >(null)
  const [deliveryMode, setDeliveryMode] = useState<Mode>('bike')
  const [cloudAuthState, setCloudAuthState] = useState<CloudAuthState | null>(
    null,
  )
  const [cloudProviderAvailability, setCloudProviderAvailability] = useState(
    () => ({ ...defaultCloudProviderAvailabilityState }),
  )
  const [isCloudAuthLoading, setIsCloudAuthLoading] = useState(false)
  const [isCloudSyncLoading, setIsCloudSyncLoading] = useState(false)
  const [cloudSyncMessage, setCloudSyncMessage] = useState<string | null>(null)
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null)
  const [cloudLastSyncAt, setCloudLastSyncAt] = useState<string | null>(null)
  const [pendingCloudRestore, setPendingCloudRestore] =
    useState<PendingCloudRestore | null>(null)
  const [pendingCloudMergeSyncAuthState, setPendingCloudMergeSyncAuthState] =
    useState<CloudAuthState | null>(null)
  const [pendingCloudRestoreMode, setPendingCloudRestoreMode] =
    useState<ImportedApplyMode | null>(null)
  const [shouldRevealCloudPanel, setShouldRevealCloudPanel] = useState(false)
  const [cloudDiagnostics, setCloudDiagnostics] =
    useState<CloudDiagnostics | null>(null)
  const [isCloudDiagnosticsLoading, setIsCloudDiagnosticsLoading] =
    useState(false)
  const [cloudDiagnosticsError, setCloudDiagnosticsError] = useState<
    string | null
  >(null)
  const [cloudProvider, setCloudProvider] = useState(
    () => initialAppPreferences.cloudProvider,
  )
  const [cloudAutoBackupEnabled, setCloudAutoBackupEnabled] = useState(
    () => initialAppPreferences.cloudAutoBackupEnabled,
  )

  const importInputRef = useRef<HTMLInputElement | null>(null)
  const cloudOAuthCallbackHandledRef = useRef(false)
  const cloudAutoSyncTimerRef = useRef<number | null>(null)
  const cloudLastAutoSyncPayloadRef = useRef<string | null>(null)

  return {
    savedTrips,
    setSavedTrips,
    addressBook,
    setAddressBook,
    dataAccordionValue,
    setDataAccordionValue,
    addressBookNameValue,
    setAddressBookNameValue,
    addressBookPlaceValue,
    setAddressBookPlaceValue,
    addressBookTagsValue,
    setAddressBookTagsValue,
    addressBookFilterTag,
    setAddressBookFilterTag,
    addressBookPlaceCandidate,
    setAddressBookPlaceCandidate,
    deliveryStartAddressId,
    setDeliveryStartAddressId,
    deliveryStopAddressIds,
    setDeliveryStopAddressIds,
    deliveryReturnToStart,
    setDeliveryReturnToStart,
    deliveryOptimizeStops,
    setDeliveryOptimizeStops,
    deliveryDraggedStopId,
    setDeliveryDraggedStopId,
    deliveryMode,
    setDeliveryMode,
    cloudAuthState,
    setCloudAuthState,
    cloudProviderAvailability,
    setCloudProviderAvailability,
    isCloudAuthLoading,
    setIsCloudAuthLoading,
    isCloudSyncLoading,
    setIsCloudSyncLoading,
    cloudSyncMessage,
    setCloudSyncMessage,
    cloudSyncError,
    setCloudSyncError,
    cloudLastSyncAt,
    setCloudLastSyncAt,
    pendingCloudRestore,
    setPendingCloudRestore,
    pendingCloudMergeSyncAuthState,
    setPendingCloudMergeSyncAuthState,
    pendingCloudRestoreMode,
    setPendingCloudRestoreMode,
    shouldRevealCloudPanel,
    setShouldRevealCloudPanel,
    cloudDiagnostics,
    setCloudDiagnostics,
    isCloudDiagnosticsLoading,
    setIsCloudDiagnosticsLoading,
    cloudDiagnosticsError,
    setCloudDiagnosticsError,
    cloudProvider,
    setCloudProvider,
    cloudAutoBackupEnabled,
    setCloudAutoBackupEnabled,
    importInputRef,
    cloudOAuthCallbackHandledRef,
    cloudAutoSyncTimerRef,
    cloudLastAutoSyncPayloadRef,
  }
}
