import type { TFunction } from 'i18next'
import type { AppStore } from '../../../state/appStore'
import type { ParsedImportedData } from '../../data/dataPortability'
import type { ImportedDataApplyResult } from '../../data/types'
import type { RouteKey } from '../../routing/domain'
import type { ImportedApplyMode } from '../types'

export type UseCloudControllerParams = {
  store: AppStore
  route: RouteKey
  t: TFunction
  isDesktop: boolean
  cloudBackupPayloadContent: string
  parseImportedPayload: (payload: unknown) => ParsedImportedData
  applyParsedImportedData: (
    imported: ParsedImportedData,
    options?: { mode?: ImportedApplyMode },
  ) => ImportedDataApplyResult
  wouldCloudBackupMergeChangeLocal: (
    imported: Extract<ParsedImportedData, { kind: 'backup' }>,
  ) => boolean
  cloudRestoreSuccessMessageByKind: (kind: ParsedImportedData['kind']) => string
  hasLocalBackupData: boolean
}
