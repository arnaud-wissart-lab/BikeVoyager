import type { TFunction } from 'i18next'
import type { CloudProvider } from '../data/dataPortability'
import type { CloudAuthState, CloudProviderAvailability } from './cloudSync'
import { useCloudSlice } from './useCloudSlice'

type UseCloudFeatureSliceParams = {
  cloudProvider: CloudProvider
  cloudProviderAvailability: CloudProviderAvailability
  cloudAuthState: CloudAuthState | null
  t: TFunction
}

export const useCloudFeatureSlice = (params: UseCloudFeatureSliceParams) => useCloudSlice(params)
