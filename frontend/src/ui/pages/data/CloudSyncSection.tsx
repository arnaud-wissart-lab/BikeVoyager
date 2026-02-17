import {
  Button,
  Group,
  Paper,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  ThemeIcon,
  type ButtonProps,
} from '@mantine/core'
import {
  IconDeviceFloppy,
  IconPlugConnected,
  IconPlugConnectedX,
  IconShieldLock,
} from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import type { ActiveCloudProvider, CloudAuthState } from '../../../features/cloud/cloudSync'
import type { CloudProvider } from '../../../features/data/dataPortability'
import DataActionsBar from './DataActionsBar'
import EncryptionSection from './EncryptionSection'

type CloudSyncSectionProps = {
  isDesktop: boolean
  isFrench: boolean
  mobileActionButtonStyles: ButtonProps['styles']
  hasAnyConfiguredCloudProvider: boolean
  cloudProvider: CloudProvider
  onCloudProviderChange: (value: string) => void
  cloudProviderControlData: Array<{ label: string; value: CloudProvider }>
  selectedCloudProvider: ActiveCloudProvider | null
  selectedCloudConfigured: boolean
  cloudAuthState: CloudAuthState | null
  toCloudProviderLabel: (provider: ActiveCloudProvider) => string
  cloudAccountLabel: string | null
  cloudLastSyncAt: string | null
  cloudBackupFileName: string
  connectedCloudMatchesSelection: boolean
  onCloudConnect: () => void
  onCloudDisconnect: () => void
  isCloudAuthLoading: boolean
  isCloudSyncLoading: boolean
  cloudAutoBackupEnabled: boolean
  onCloudAutoBackupEnabledChange: (value: boolean) => void
  onCloudUploadBackup: () => void
  cloudSyncMessage: string | null
  cloudSyncError: string | null
}

export default function CloudSyncSection({
  isDesktop,
  isFrench,
  mobileActionButtonStyles,
  hasAnyConfiguredCloudProvider,
  cloudProvider,
  onCloudProviderChange,
  cloudProviderControlData,
  selectedCloudProvider,
  selectedCloudConfigured,
  cloudAuthState,
  toCloudProviderLabel,
  cloudAccountLabel,
  cloudLastSyncAt,
  cloudBackupFileName,
  connectedCloudMatchesSelection,
  onCloudConnect,
  onCloudDisconnect,
  isCloudAuthLoading,
  isCloudSyncLoading,
  cloudAutoBackupEnabled,
  onCloudAutoBackupEnabledChange,
  onCloudUploadBackup,
  cloudSyncMessage,
  cloudSyncError,
}: CloudSyncSectionProps) {
  const { t } = useTranslation()

  return (
    <Paper withBorder radius="md" p={isDesktop ? 'md' : 'lg'}>
      <Stack gap={isDesktop ? 'sm' : 'md'}>
        <Group gap="xs">
          <ThemeIcon variant="light" color="teal" radius="xl" size="md">
            <IconShieldLock size={16} />
          </ThemeIcon>
          <Text fw={600}>{t('cloudSyncTitle')}</Text>
        </Group>
        <Text size="sm" c="dimmed">
          {t('cloudSyncBody')}
        </Text>
        {hasAnyConfiguredCloudProvider ? (
          <>
            <SegmentedControl
              fullWidth
              radius="xl"
              value={cloudProvider}
              onChange={onCloudProviderChange}
              data={cloudProviderControlData}
            />
            {!selectedCloudProvider && (
              <Text size="xs" c="dimmed">
                {t('cloudSelectProvider')}
              </Text>
            )}
            {selectedCloudProvider && !selectedCloudConfigured && (
              <Text size="xs" c="orange.6">
                {t('cloudProviderMissingClientId')}
              </Text>
            )}
            {selectedCloudProvider &&
              cloudAuthState &&
              cloudAuthState.provider !== selectedCloudProvider && (
                <Text size="xs" c="orange.6">
                  {t('cloudConnectedToOtherProvider', {
                    provider: toCloudProviderLabel(cloudAuthState.provider),
                  })}
                </Text>
              )}
            {cloudAuthState && (
              <Text size="xs" c="dimmed">
                {t('cloudConnectedAs', {
                  provider: toCloudProviderLabel(cloudAuthState.provider),
                  account: cloudAccountLabel ?? t('cloudAccountUnknown'),
                })}
              </Text>
            )}
            {cloudLastSyncAt && (
              <Text size="xs" c="dimmed">
                {t('cloudLastSyncAt', {
                  value: new Date(cloudLastSyncAt).toLocaleString(isFrench ? 'fr-FR' : 'en-US'),
                })}
              </Text>
            )}
            {selectedCloudProvider && selectedCloudConfigured && (
              <>
                <Text size="xs" c="dimmed">
                  {t('cloudBackupFileLabel', { fileName: cloudBackupFileName })}
                </Text>
                <Switch
                  checked={cloudAutoBackupEnabled}
                  onChange={(event) => onCloudAutoBackupEnabledChange(event.currentTarget.checked)}
                  label={t('cloudAutoBackupToggle')}
                  description={t('cloudAutoBackupToggleHint')}
                />
                <DataActionsBar isDesktop={isDesktop}>
                  <Button
                    variant="default"
                    leftSection={<IconPlugConnected size={16} />}
                    onClick={onCloudConnect}
                    disabled={isCloudAuthLoading}
                    loading={isCloudAuthLoading}
                    fullWidth={!isDesktop}
                    styles={mobileActionButtonStyles}
                  >
                    {connectedCloudMatchesSelection ? t('cloudReconnect') : t('cloudConnect')}
                  </Button>
                  {cloudAuthState && (
                    <Button
                      variant="outline"
                      leftSection={<IconPlugConnectedX size={16} />}
                      onClick={onCloudDisconnect}
                      disabled={isCloudAuthLoading}
                      loading={isCloudAuthLoading && !isCloudSyncLoading}
                      fullWidth={!isDesktop}
                      styles={mobileActionButtonStyles}
                    >
                      {t('cloudDisconnect')}
                    </Button>
                  )}
                  {connectedCloudMatchesSelection && !cloudAutoBackupEnabled && (
                    <Button
                      variant="light"
                      leftSection={<IconDeviceFloppy size={16} />}
                      onClick={onCloudUploadBackup}
                      loading={isCloudSyncLoading}
                      disabled={isCloudSyncLoading}
                      fullWidth={!isDesktop}
                      styles={mobileActionButtonStyles}
                    >
                      {t('cloudSaveBackup')}
                    </Button>
                  )}
                </DataActionsBar>
              </>
            )}
          </>
        ) : (
          <>
            <Text size="sm" c="dimmed">
              {t('cloudUnavailable')}
            </Text>
            <Text size="xs" c="dimmed">
              {t('cloudUnavailableAdminHint')}
            </Text>
            <Button
              variant="default"
              leftSection={<IconPlugConnected size={16} />}
              disabled
              fullWidth={!isDesktop}
              styles={mobileActionButtonStyles}
            >
              {t('cloudConnect')}
            </Button>
            {cloudAuthState && (
              <Button
                variant="outline"
                leftSection={<IconPlugConnectedX size={16} />}
                onClick={onCloudDisconnect}
                disabled={isCloudAuthLoading}
                loading={isCloudAuthLoading && !isCloudSyncLoading}
              >
                {t('cloudDisconnect')}
              </Button>
            )}
          </>
        )}
        {cloudSyncMessage && (
          <Text size="xs" c="teal.7">
            {cloudSyncMessage}
          </Text>
        )}
        {cloudSyncError && (
          <Text size="xs" c="red.6">
            {cloudSyncError}
          </Text>
        )}
        <EncryptionSection />
      </Stack>
    </Paper>
  )
}
