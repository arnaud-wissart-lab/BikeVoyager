import { hasPlannerDraftData } from '../importDataUtils'
import type { AddressBookEntry, SavedTripRecord } from '../dataPortability'
import type { PlannerDraft, TripResult } from '../../routing/domain'

export const hasPlannerDraftSnapshotData = (draft: PlannerDraft) => hasPlannerDraftData(draft)

type LocalBackupDataParams = {
  hasPlannerDraftContent: boolean
  routeResult: TripResult | null
  savedTrips: SavedTripRecord[]
  addressBook: AddressBookEntry[]
}

export const hasAnyLocalBackupData = ({
  hasPlannerDraftContent,
  routeResult,
  savedTrips,
  addressBook,
}: LocalBackupDataParams) =>
  hasPlannerDraftContent || routeResult !== null || savedTrips.length > 0 || addressBook.length > 0

export const shouldImportPlannerDraft = (
  currentHasPlannerDraftContent: boolean,
  importedDraft: PlannerDraft,
) => !currentHasPlannerDraftContent && hasPlannerDraftData(importedDraft)
