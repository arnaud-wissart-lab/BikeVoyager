import type { CloudAuthState } from './cloudSync'
import type { ParsedImportedData } from '../data/dataPortability'

export type PendingCloudRestore = {
  imported: ParsedImportedData
  authState: CloudAuthState
  modifiedAt: string | null
}

export type ImportedApplyMode = 'replace' | 'merge'
