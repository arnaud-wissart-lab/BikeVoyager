import type { ParsedImportedData } from './dataPortability'

export type ImportedDataApplyMode = 'replace' | 'merge'

export type ImportedDataApplyResult = ParsedImportedData['kind']
