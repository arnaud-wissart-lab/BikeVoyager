import type { AppPreferences } from '../features/data/dataPortability'
import type { PlannerDraft } from '../features/routing/domain'
import { useDataSlice } from './store.dataSlice'
import { useMapSlice } from './store.mapSlice'
import { useUiSlice } from './store.uiSlice'

export type { RouteErrorKey } from './store.types'

type UseAppStoreParams = {
  initialPlannerDraft: PlannerDraft
  initialAppPreferences: AppPreferences
}

export const useAppStore = ({
  initialPlannerDraft,
  initialAppPreferences,
}: UseAppStoreParams) => {
  const mapSlice = useMapSlice({
    initialPlannerDraft,
    initialAppPreferences,
  })
  const dataSlice = useDataSlice({ initialAppPreferences })
  const uiSlice = useUiSlice()

  return {
    ...mapSlice,
    ...dataSlice,
    ...uiSlice,
  }
}

export type AppStore = ReturnType<typeof useAppStore>
