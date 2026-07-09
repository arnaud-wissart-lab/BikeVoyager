import type { ChangeEvent } from 'react'
import type { TFunction } from 'i18next'
import type { AppStore } from '../../state/appStore'
import { downloadBlob } from '../routing/domain'
import {
  buildTripExport,
  createSavedTripRecord,
  duplicateSavedTrip,
  updateSavedTripMetadata,
  upsertSavedTrip,
  type SavedTripMetadataInput,
  type SavedTripRecord,
} from './dataPortability'
import type { ImportedDataApplyMode, ImportedDataApplyResult } from './types'
import type { RouteKey } from '../routing/domain'

const buildDateStamp = () => new Date().toISOString().slice(0, 10)
const serializeJsonContent = (payload: unknown) => `${JSON.stringify(payload, null, 2)}\n`

type DataRouteActionsStoreSlice = Pick<
  AppStore,
  | 'routeResult'
  | 'mode'
  | 'targetDistanceKm'
  | 'importInputRef'
  | 'setSavedTrips'
  | 'setRouteResult'
  | 'setHasResult'
  | 'setIsDirty'
  | 'setDetourPoints'
  | 'setRouteAlternativeIndex'
  | 'setLoopAlternativeIndex'
  | 'setPendingAlternativeRoute'
  | 'setRouteComparison'
  | 'setIsAlternativeComparisonOpen'
  | 'setRouteErrorKey'
  | 'setRouteErrorMessage'
  | 'setMode'
  | 'setTripType'
  | 'setOnewayStartPlace'
  | 'setLoopStartPlace'
  | 'setEndPlace'
  | 'setTargetDistanceKm'
  | 'setLoopStartValue'
  | 'setOnewayStartValue'
  | 'setEndValue'
>

type CreateDataRouteActionsParams = {
  store: DataRouteActionsStoreSlice
  t: TFunction
  startLabel: string
  endLabel: string
  mapHeaderTitle: string
  onNavigate: (next: RouteKey, force?: boolean) => void
  buildBackupPayload: () => unknown
  importPayload: (
    payload: unknown,
    options?: { mode?: ImportedDataApplyMode },
  ) => Promise<ImportedDataApplyResult>
  showSuccessToast: (message: string, options?: { title?: string; durationMs?: number }) => void
  showErrorToast: (message: string, options?: { title?: string; durationMs?: number }) => void
}

export const createDataRouteActions = ({
  store,
  t,
  startLabel,
  endLabel,
  mapHeaderTitle,
  onNavigate,
  buildBackupPayload,
  importPayload,
  showSuccessToast,
  showErrorToast,
}: CreateDataRouteActionsParams) => {
  const {
    routeResult,
    mode,
    targetDistanceKm,
    importInputRef,
    setSavedTrips,
    setRouteResult,
    setHasResult,
    setIsDirty,
    setDetourPoints,
    setRouteAlternativeIndex,
    setLoopAlternativeIndex,
    setPendingAlternativeRoute,
    setRouteComparison,
    setIsAlternativeComparisonOpen,
    setRouteErrorKey,
    setRouteErrorMessage,
    setMode,
    setTripType,
    setOnewayStartPlace,
    setLoopStartPlace,
    setEndPlace,
    setTargetDistanceKm,
    setLoopStartValue,
    setOnewayStartValue,
    setEndValue,
  } = store

  const downloadJsonFile = (payload: unknown, fileName: string) => {
    const content = serializeJsonContent(payload)
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
    downloadBlob(blob, fileName)
  }

  const exportPayloadAsJsonFile = async (params: {
    payload: unknown
    fileNamePrefix: string
    successMessage: string
  }) => {
    const fileName = `${params.fileNamePrefix}-${buildDateStamp()}.json`
    downloadJsonFile(params.payload, fileName)
    showSuccessToast(params.successMessage)
  }

  const handleSaveCurrentTrip = (metadata: SavedTripMetadataInput) => {
    if (!routeResult) {
      showErrorToast(t('dataSavedTripSaveUnavailable'), { title: t('dataSaveTrip') })
      return
    }

    const savedTrip = createSavedTripRecord({
      trip: routeResult,
      mode,
      startLabel: startLabel || null,
      endLabel: routeResult.kind === 'loop' ? null : endLabel || null,
      targetDistanceKm,
      name: metadata.name || mapHeaderTitle || t('dataSavedTripDefaultName'),
      notes: metadata.notes,
      tags: metadata.tags,
      favorite: metadata.favorite,
    })
    setSavedTrips((current) => upsertSavedTrip(current, savedTrip))
    showSuccessToast(t('dataSavedTripSaved'), { title: t('dataSaveTrip') })
  }

  const handleOpenSavedTrip = (trip: SavedTripRecord) => {
    setRouteResult(trip.trip)
    setHasResult(true)
    setIsDirty(false)
    setDetourPoints([])
    setRouteAlternativeIndex(0)
    setLoopAlternativeIndex(0)
    setPendingAlternativeRoute(null)
    setRouteComparison(null)
    setIsAlternativeComparisonOpen(false)
    setRouteErrorKey(null)
    setRouteErrorMessage(null)
    setMode(trip.mode)
    setTripType(trip.tripType)
    setOnewayStartPlace(null)
    setLoopStartPlace(null)
    setEndPlace(null)
    setTargetDistanceKm(typeof trip.targetDistanceKm === 'number' ? trip.targetDistanceKm : '')
    if (trip.tripType === 'loop') {
      setLoopStartValue(trip.startLabel ?? '')
      setOnewayStartValue('')
      setEndValue('')
    } else {
      setOnewayStartValue(trip.startLabel ?? '')
      setEndValue(trip.endLabel ?? '')
      setLoopStartValue('')
    }
    onNavigate('carte')
    showSuccessToast(t('dataSavedTripOpened'))
  }

  const handleDeleteSavedTrip = (tripId: string) => {
    setSavedTrips((current) => current.filter((trip) => trip.id !== tripId))
    showSuccessToast(t('dataSavedTripDeleted'))
  }

  const handleExportSavedTrip = async (trip: SavedTripRecord) => {
    await exportPayloadAsJsonFile({
      payload: buildTripExport(trip),
      fileNamePrefix: 'bikevoyager-trip',
      successMessage: t('dataSavedTripExported'),
    })
  }

  const handleUpdateSavedTrip = (tripId: string, metadata: SavedTripMetadataInput) => {
    setSavedTrips((current) => updateSavedTripMetadata(current, tripId, metadata))
    showSuccessToast(t('dataSavedTripUpdated'))
  }

  const handleDuplicateSavedTrip = (trip: SavedTripRecord) => {
    setSavedTrips((current) =>
      duplicateSavedTrip(current, trip, t('dataSavedTripCopyName', { name: trip.name })),
    )
    showSuccessToast(t('dataSavedTripDuplicated'))
  }

  const handleExportBackup = async () => {
    await exportPayloadAsJsonFile({
      payload: buildBackupPayload(),
      fileNamePrefix: 'bikevoyager-backup',
      successMessage: t('dataExportBackupSuccess'),
    })
  }

  const handleImportData = () => {
    importInputRef.current?.click()
  }

  const handleImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    if (!file) {
      return
    }

    const maxImportSizeBytes = 5 * 1024 * 1024
    if (file.size > maxImportSizeBytes) {
      showErrorToast(t('dataImportTooLarge'))
      return
    }

    let parsedPayload: unknown
    try {
      parsedPayload = JSON.parse(await file.text()) as unknown
    } catch {
      showErrorToast(t('dataImportInvalid'))
      return
    }

    try {
      const importedKind = await importPayload(parsedPayload)
      showSuccessToast(
        importedKind === 'preferences'
          ? t('dataImportPreferencesSuccess')
          : importedKind === 'trip'
            ? t('dataImportTripSuccess')
            : t('dataImportBackupSuccess'),
      )
    } catch (error) {
      showErrorToast(
        error instanceof Error && error.message.trim() ? error.message : t('dataImportInvalid'),
      )
    }
  }

  return {
    handleSaveCurrentTrip,
    handleOpenSavedTrip,
    handleDeleteSavedTrip,
    handleExportSavedTrip,
    handleUpdateSavedTrip,
    handleDuplicateSavedTrip,
    handleExportBackup,
    handleImportData,
    handleImportFileChange,
  }
}
