import { useMemo } from 'react'
import type { TFunction } from 'i18next'
import {
  isCloudProviderConfigured,
  type ActiveCloudProvider,
  type CloudAuthState,
  type CloudProviderAvailability,
} from './cloudSync'
import type { CloudProvider } from '../data/dataPortability'

type UseCloudSliceParams = {
  cloudProvider: CloudProvider
  cloudProviderAvailability: CloudProviderAvailability
  cloudAuthState: CloudAuthState | null
  t: TFunction
}

export const useCloudSlice = ({
  cloudProvider,
  cloudProviderAvailability,
  cloudAuthState,
  t,
}: UseCloudSliceParams) => {
  const selectedCloudProvider: ActiveCloudProvider | null =
    cloudProvider === 'none' ? null : cloudProvider

  const selectedCloudConfigured = selectedCloudProvider
    ? isCloudProviderConfigured(selectedCloudProvider, cloudProviderAvailability)
    : false

  const hasAnyConfiguredCloudProvider =
    cloudProviderAvailability.onedrive || cloudProviderAvailability['google-drive']

  const cloudProviderControlData = useMemo(
    () =>
      [
        { label: t('cloudProviderNone'), value: 'none' },
        ...(cloudProviderAvailability.onedrive
          ? [{ label: 'OneDrive', value: 'onedrive' as const }]
          : []),
        ...(cloudProviderAvailability['google-drive']
          ? [{ label: 'Google Drive', value: 'google-drive' as const }]
          : []),
      ] satisfies Array<{ label: string; value: CloudProvider }>,
    [cloudProviderAvailability, t],
  )

  const connectedCloudMatchesSelection =
    selectedCloudProvider !== null && cloudAuthState?.provider === selectedCloudProvider

  const cloudAccountLabel = cloudAuthState
    ? (cloudAuthState.accountEmail ?? cloudAuthState.accountName ?? t('cloudAccountUnknown'))
    : null

  const toCloudProviderLabel = (provider: ActiveCloudProvider) =>
    provider === 'google-drive' ? 'Google Drive' : 'OneDrive'

  return {
    selectedCloudProvider,
    selectedCloudConfigured,
    hasAnyConfiguredCloudProvider,
    cloudProviderControlData,
    connectedCloudMatchesSelection,
    cloudAccountLabel,
    toCloudProviderLabel,
  }
}
