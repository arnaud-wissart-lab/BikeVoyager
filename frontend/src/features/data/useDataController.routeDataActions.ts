import type { ChangeEvent } from 'react'
import type { TFunction } from 'i18next'
import type { AppStore } from '../../state/appStore'
import { downloadBlob } from '../routing/domain'
import {
  buildTripExport,
  createSavedTripRecord,
  upsertSavedTrip,
  type SavedTripRecord,
} from './dataPortability'
import type { ImportedDataApplyMode, ImportedDataApplyResult } from './types'

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
  mapHeaderTitle: string
  buildBackupPayload: () => unknown
  importPayload: (
    payload: unknown,
    options?: { mode?: ImportedDataApplyMode },
  ) => Promise<ImportedDataApplyResult>
  showSuccessToast: (
    message: string,
    options?: { title?: string; durationMs?: number },
  ) => void
  showErrorToast: (
    message: string,
    options?: { title?: string; durationMs?: number },
  ) => void
}

export const createDataRouteActions = ({
  store,
  t,
  startLabel,
  mapHeaderTitle,
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

  const handleSaveCurrentLoop = () => {
    if (!routeResult || routeResult.kind !== 'loop') {
      showErrorToast(t('dataLoopSaveUnavailable'), { title: t('dataSaveLoop') })
      return
    }

    const savedTrip = createSavedTripRecord({
      trip: routeResult,
      mode,
      startLabel: startLabel || null,
      endLabel: null,
      targetDistanceKm,
      name: mapHeaderTitle || t('dataSavedLoopDefaultName'),
    })
    setSavedTrips((current) => upsertSavedTrip(current, savedTrip))
    showSuccessToast(t('dataLoopSavedSuccess'), { title: t('dataSaveLoop') })
  }

  const handleOpenSavedTrip = (trip: SavedTripRecord) => {
    setRouteResult(trip.trip)
    setHasResult(true)
    setIsDirty(false)
    setDetourPoints([])
    setRouteAlternativeIndex(0)
    setLoopAlternativeIndex(0)
    setRouteErrorKey(null)
    setRouteErrorMessage(null)
    setMode(trip.mode)
    setTripType(trip.tripType)
    setOnewayStartPlace(null)
    setLoopStartPlace(null)
    setEndPlace(null)
    setTargetDistanceKm(
      typeof trip.targetDistanceKm === 'number' ? trip.targetDistanceKm : '',
    )
    if (trip.tripType === 'loop') {
      setLoopStartValue(trip.startLabel ?? '')
      setOnewayStartValue('')
      setEndValue('')
    } else {
      setOnewayStartValue(trip.startLabel ?? '')
      setEndValue(trip.endLabel ?? '')
      setLoopStartValue('')
    }
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
        error instanceof Error && error.message.trim()
          ? error.message
          : t('dataImportInvalid'),
      )
    }
  }

  return {
    handleSaveCurrentLoop,
    handleOpenSavedTrip,
    handleDeleteSavedTrip,
    handleExportSavedTrip,
    handleExportBackup,
    handleImportData,
    handleImportFileChange,
  }
}
