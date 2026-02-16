import type { MutableRefObject } from 'react'
import type { TFunction } from 'i18next'
import type { ActiveCloudProvider, CloudAuthState } from '../cloudSync'
import { CloudBackupNotFoundError, restoreBackupFromCloud, syncBackupToCloud } from '../api'
import type { ParsedImportedData } from '../../data/dataPortability'
import type { ImportedDataApplyResult } from '../../data/types'
import type { ImportedApplyMode, PendingCloudRestore } from '../types'
import { translateCloudError } from './errors'

type CloudSyncFeedbackSetters = {
  setCloudSyncMessage: (value: string | null) => void
  setCloudSyncError: (value: string | null) => void
}

type CloudSyncLoadingSetter = (value: boolean) => void

export const restoreCloudBackupAfterConnect = async (params: {
  authState: CloudAuthState
  cloudBackupFileName: string
  hasLocalBackupData: boolean
  parseImportedPayload: (payload: unknown) => ParsedImportedData
  applyParsedImportedData: (
    imported: ParsedImportedData,
    options?: { mode?: ImportedApplyMode },
  ) => ImportedDataApplyResult
  wouldCloudBackupMergeChangeLocal: (
    imported: Extract<ParsedImportedData, { kind: 'backup' }>,
  ) => boolean
  cloudRestoreSuccessMessageByKind: (kind: ParsedImportedData['kind']) => string
  cloudLastAutoSyncPayloadRef: MutableRefObject<string | null>
  t: TFunction
  setCloudAuthState: (value: CloudAuthState) => void
  setCloudProvider: (value: ActiveCloudProvider) => void
  setCloudLastSyncAt: (value: string | null) => void
  setPendingCloudRestore: (value: PendingCloudRestore | null) => void
  setIsCloudSyncLoading: CloudSyncLoadingSetter
  setters: CloudSyncFeedbackSetters
}) => {
  params.setIsCloudSyncLoading(true)
  params.setters.setCloudSyncMessage(null)
  params.setters.setCloudSyncError(null)

  try {
    const response = await restoreBackupFromCloud({
      authState: params.authState,
      fileName: params.cloudBackupFileName,
    })
    params.setCloudAuthState(response.authState)
    params.setCloudLastSyncAt(response.modifiedAt)

    let parsedPayload: unknown
    try {
      parsedPayload = JSON.parse(response.content) as unknown
    } catch {
      throw new Error(params.t('dataImportInvalid'))
    }

    const imported = params.parseImportedPayload(parsedPayload)
    if (imported.kind === 'backup' && params.hasLocalBackupData) {
      if (params.wouldCloudBackupMergeChangeLocal(imported)) {
        params.setPendingCloudRestore({
          imported,
          authState: response.authState,
          modifiedAt: response.modifiedAt,
        })
        params.setters.setCloudSyncMessage(params.t('cloudRestoreDecisionPrompt'))
      } else {
        params.setters.setCloudSyncError(null)
        params.setters.setCloudSyncMessage(params.t('cloudRestoreAlreadyUpToDate'))
      }
      return
    }

    const importedKind = params.applyParsedImportedData(imported, { mode: 'replace' })
    params.setCloudProvider(response.authState.provider)
    params.cloudLastAutoSyncPayloadRef.current = null
    params.setters.setCloudSyncError(null)
    params.setters.setCloudSyncMessage(
      params.cloudRestoreSuccessMessageByKind(importedKind),
    )
  } catch (error) {
    if (error instanceof CloudBackupNotFoundError) {
      params.setters.setCloudSyncError(null)
      params.setters.setCloudSyncMessage(params.t('cloudRestoreNotFound'))
      return
    }

    params.setters.setCloudSyncMessage(null)
    params.setters.setCloudSyncError(
      translateCloudError({
        t: params.t,
        key: 'cloudRestoreError',
        error,
      }),
    )
  } finally {
    params.setIsCloudSyncLoading(false)
  }
}

export const uploadCloudBackup = async (params: {
  authState: CloudAuthState
  cloudBackupFileName: string
  cloudBackupPayloadContent: string
  cloudLastAutoSyncPayloadRef: MutableRefObject<string | null>
  t: TFunction
  setCloudAuthState: (value: CloudAuthState) => void
  setCloudLastSyncAt: (value: string | null) => void
  setIsCloudSyncLoading: CloudSyncLoadingSetter
  setters: CloudSyncFeedbackSetters
}) => {
  params.setIsCloudSyncLoading(true)
  params.setters.setCloudSyncMessage(null)
  params.setters.setCloudSyncError(null)

  try {
    const response = await syncBackupToCloud({
      authState: params.authState,
      fileName: params.cloudBackupFileName,
      content: params.cloudBackupPayloadContent,
    })
    params.setCloudAuthState(response.authState)
    params.setCloudLastSyncAt(response.modifiedAt)
    params.cloudLastAutoSyncPayloadRef.current = params.cloudBackupPayloadContent
    params.setters.setCloudSyncError(null)
    params.setters.setCloudSyncMessage(params.t('cloudUploadSuccess'))
  } catch (error) {
    params.setters.setCloudSyncMessage(null)
    params.setters.setCloudSyncError(
      translateCloudError({
        t: params.t,
        key: 'cloudUploadError',
        error,
      }),
    )
  } finally {
    params.setIsCloudSyncLoading(false)
  }
}

export const applyCloudPendingRestore = (params: {
  pendingCloudRestore: PendingCloudRestore | null
  modeToApply: ImportedApplyMode
  applyParsedImportedData: (
    imported: ParsedImportedData,
    options?: { mode?: ImportedApplyMode },
  ) => ImportedDataApplyResult
  cloudRestoreSuccessMessageByKind: (kind: ParsedImportedData['kind']) => string
  cloudLastAutoSyncPayloadRef: MutableRefObject<string | null>
  t: TFunction
  setCloudAuthState: (value: CloudAuthState) => void
  setCloudProvider: (value: ActiveCloudProvider) => void
  setCloudLastSyncAt: (value: string | null) => void
  setPendingCloudMergeSyncAuthState: (value: CloudAuthState | null) => void
  setPendingCloudRestore: (value: PendingCloudRestore | null) => void
  setters: CloudSyncFeedbackSetters
}) => {
  if (!params.pendingCloudRestore) {
    return
  }

  const importedKind = params.applyParsedImportedData(params.pendingCloudRestore.imported, {
    mode: params.modeToApply,
  })
  params.setCloudAuthState(params.pendingCloudRestore.authState)
  params.setCloudProvider(params.pendingCloudRestore.authState.provider)
  params.setCloudLastSyncAt(params.pendingCloudRestore.modifiedAt)
  params.cloudLastAutoSyncPayloadRef.current = null
  params.setPendingCloudMergeSyncAuthState(
    params.modeToApply === 'merge' ? params.pendingCloudRestore.authState : null,
  )
  params.setPendingCloudRestore(null)
  params.setters.setCloudSyncError(null)
  params.setters.setCloudSyncMessage(
    params.modeToApply === 'merge'
      ? params.t('cloudRestoreBackupMerged')
      : params.cloudRestoreSuccessMessageByKind(importedKind),
  )
}

export const cancelCloudPendingRestore = (params: {
  t: TFunction
  setPendingCloudRestore: (value: PendingCloudRestore | null) => void
  setters: CloudSyncFeedbackSetters
}) => {
  params.setPendingCloudRestore(null)
  params.setters.setCloudSyncError(null)
  params.setters.setCloudSyncMessage(params.t('cloudRestoreKeepLocal'))
}

export const syncCloudBackupAfterMerge = async (params: {
  authState: CloudAuthState
  cloudBackupFileName: string
  cloudBackupPayloadContent: string
  cloudLastAutoSyncPayloadRef: MutableRefObject<string | null>
  t: TFunction
  setCloudAuthState: (value: CloudAuthState) => void
  setCloudProvider: (value: ActiveCloudProvider) => void
  setCloudLastSyncAt: (value: string | null) => void
  setPendingCloudMergeSyncAuthState: (value: CloudAuthState | null) => void
  setIsCloudSyncLoading: CloudSyncLoadingSetter
  setters: CloudSyncFeedbackSetters
}) => {
  params.setIsCloudSyncLoading(true)
  params.setters.setCloudSyncError(null)

  try {
    const response = await syncBackupToCloud({
      authState: params.authState,
      fileName: params.cloudBackupFileName,
      content: params.cloudBackupPayloadContent,
    })
    params.setCloudAuthState(response.authState)
    params.setCloudProvider(response.authState.provider)
    params.setCloudLastSyncAt(response.modifiedAt)
    params.cloudLastAutoSyncPayloadRef.current = params.cloudBackupPayloadContent
    params.setters.setCloudSyncMessage(params.t('cloudRestoreBackupMergedSynced'))
  } catch (error) {
    params.setters.setCloudSyncMessage(null)
    params.setters.setCloudSyncError(
      translateCloudError({
        t: params.t,
        key: 'cloudUploadError',
        error,
      }),
    )
  } finally {
    params.setIsCloudSyncLoading(false)
    params.setPendingCloudMergeSyncAuthState(null)
  }
}

export const syncCloudAutoBackup = async (params: {
  authState: CloudAuthState
  cloudBackupFileName: string
  cloudBackupPayloadContent: string
  cloudLastAutoSyncPayloadRef: MutableRefObject<string | null>
  t: TFunction
  setCloudAuthState: (value: CloudAuthState) => void
  setCloudLastSyncAt: (value: string | null) => void
  setIsCloudSyncLoading: CloudSyncLoadingSetter
  setters: CloudSyncFeedbackSetters
}) => {
  params.setIsCloudSyncLoading(true)
  params.setters.setCloudSyncError(null)

  try {
    const response = await syncBackupToCloud({
      authState: params.authState,
      fileName: params.cloudBackupFileName,
      content: params.cloudBackupPayloadContent,
    })
    params.setCloudAuthState(response.authState)
    params.setCloudLastSyncAt(response.modifiedAt)
    params.cloudLastAutoSyncPayloadRef.current = params.cloudBackupPayloadContent
    params.setters.setCloudSyncMessage(params.t('cloudAutoBackupSynced'))
  } catch (error) {
    params.setters.setCloudSyncMessage(null)
    params.setters.setCloudSyncError(
      translateCloudError({
        t: params.t,
        key: 'cloudUploadError',
        error,
      }),
    )
  } finally {
    params.setIsCloudSyncLoading(false)
  }
}
