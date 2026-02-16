import {
  Accordion,
  ActionIcon,
  Badge,
  Button,
  Container,
  Group,
  Modal,
  Paper,
  ScrollArea,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import {
  IconDeviceFloppy,
  IconDownload,
  IconMapPinPlus,
  IconPlugConnected,
  IconPlugConnectedX,
  IconRoute,
  IconShieldLock,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react'
import { useState, type ChangeEvent, type ComponentProps, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { ActiveCloudProvider, CloudAuthState } from '../cloudSync'
import type { CloudProvider, SavedTripRecord } from '../dataPortability'
import AddressBookPanel from './AddressBookPanel'

type DataPageProps = {
  contentSize: string
  isDesktop: boolean
  isFrench: boolean
  surfaceColor: string
  borderColor: string
  dataAccordionValue: string | null
  onDataAccordionChange: (value: string | null) => void
  savedTrips: SavedTripRecord[]
  onExportBackup: () => void
  onImportData: () => void
  importInputRef: RefObject<HTMLInputElement | null>
  onImportFileChange: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>
  formatDistance: (distanceMeters: number) => string
  onOpenSavedTrip: (trip: SavedTripRecord) => void
  onExportSavedTrip: (trip: SavedTripRecord) => void | Promise<void>
  onDeleteSavedTrip: (tripId: string) => void
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
  addressBookPanelProps: ComponentProps<typeof AddressBookPanel>
}

export default function DataPage({
  contentSize,
  isDesktop,
  isFrench,
  surfaceColor,
  borderColor,
  dataAccordionValue,
  onDataAccordionChange,
  savedTrips,
  onExportBackup,
  onImportData,
  importInputRef,
  onImportFileChange,
  formatDistance,
  onOpenSavedTrip,
  onExportSavedTrip,
  onDeleteSavedTrip,
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
  addressBookPanelProps,
}: DataPageProps) {
  const { t } = useTranslation()
  const [deleteTripCandidate, setDeleteTripCandidate] = useState<SavedTripRecord | null>(
    null,
  )
  const mobileActionButtonStyles = isDesktop
    ? undefined
    : ({
        root: {
          height: 'auto',
          paddingTop: '10px',
          paddingBottom: '10px',
        },
        label: {
          whiteSpace: 'normal',
          overflow: 'visible',
          textOverflow: 'clip',
          lineHeight: 1.2,
          textAlign: 'center',
        },
      } as const)
  const modalStyles = {
    content: {
      border: '1px solid var(--mantine-color-default-border)',
      boxShadow: 'var(--bikevoyager-panel-shadow)',
    },
    header: {
      padding: '12px 16px',
      borderBottom: '1px solid var(--mantine-color-default-border)',
    },
    body: {
      padding: '14px 16px 16px',
    },
  } as const
  const closeDeleteTripModal = () => {
    setDeleteTripCandidate(null)
  }
  const confirmDeleteTrip = () => {
    if (!deleteTripCandidate) {
      return
    }

    onDeleteSavedTrip(deleteTripCandidate.id)
    setDeleteTripCandidate(null)
  }

  return (
    <Container size={contentSize} py="lg">
      <Stack gap="xl">
        <Modal
          opened={deleteTripCandidate !== null}
          onClose={closeDeleteTripModal}
          title={
            <Group gap="xs" wrap="nowrap">
              <ThemeIcon variant="light" color="red" radius="xl" size="md">
                <IconTrash size={14} />
              </ThemeIcon>
              <Text size="sm" fw={600}>
                {t('dataSavedTripDeleteConfirmTitle')}
              </Text>
            </Group>
          }
          centered
          styles={modalStyles}
          size="sm"
        >
          <Stack gap="sm">
            <Text size="sm">
              {t('dataSavedTripDeleteConfirmBody', {
                name: deleteTripCandidate?.name ?? '',
              })}
            </Text>
            {deleteTripCandidate && (
              <Paper withBorder radius="md" p="xs">
                <Stack gap={2}>
                  <Text size="sm" fw={600} lineClamp={1}>
                    {deleteTripCandidate.name}
                  </Text>
                  <Text size="xs" c="dimmed" lineClamp={2}>
                    {new Date(deleteTripCandidate.savedAt).toLocaleString(
                      isFrench ? 'fr-FR' : 'en-US',
                    )}
                  </Text>
                </Stack>
              </Paper>
            )}
            <Group justify="flex-end" gap="xs">
              <Button variant="outline" onClick={closeDeleteTripModal}>
                {t('commonCancel')}
              </Button>
              <Button
                color="red"
                variant="filled"
                leftSection={<IconTrash size={14} />}
                onClick={confirmDeleteTrip}
              >
                {t('dataSavedTripDeleteConfirmAction')}
              </Button>
            </Group>
          </Stack>
        </Modal>
        <Stack gap={4}>
          <Title order={2}>{t('dataPageTitle')}</Title>
          <Text size="sm" c="dimmed">
            {t('dataPageSubtitle')}
          </Text>
        </Stack>

        <Accordion
          value={dataAccordionValue}
          onChange={onDataAccordionChange}
          variant="separated"
          radius="md"
          chevronPosition="right"
          styles={{
            item: {
              backgroundColor: surfaceColor,
              border: `1px solid ${borderColor}`,
              borderRadius: 'var(--mantine-radius-md)',
              boxShadow: 'var(--bikevoyager-panel-shadow)',
              overflow: 'hidden',
            },
            control: {
              backgroundColor: surfaceColor,
              '&:hover': {
                backgroundColor: surfaceColor,
              },
            },
            panel: {
              backgroundColor: surfaceColor,
            },
          }}
        >
          <Accordion.Item value="address-book">
            <Accordion.Control
              icon={
                <ThemeIcon variant="light" color="cyan" radius="xl" size="md">
                  <IconMapPinPlus size={16} />
                </ThemeIcon>
              }
            >
              <Stack gap={0}>
                <Text fw={600}>{t('addressBookTitle')}</Text>
                <Text size="xs" c="dimmed">
                  {t('addressBookBody')}
                </Text>
              </Stack>
            </Accordion.Control>
            <Accordion.Panel>
              <AddressBookPanel {...addressBookPanelProps} />
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="saved-trips">
            <Accordion.Control
              icon={
                <ThemeIcon variant="light" color="orange" radius="xl" size="md">
                  <IconRoute size={16} />
                </ThemeIcon>
              }
            >
              <Stack gap={0}>
                <Text fw={600}>{t('dataSavedTripsTitle')}</Text>
                <Text size="xs" c="dimmed">
                  {t('dataSavedTripsSubtitle')}
                </Text>
              </Stack>
            </Accordion.Control>
            <Accordion.Panel>
              {savedTrips.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {t('dataSavedTripsEmpty')}
                </Text>
              ) : (
                <ScrollArea.Autosize mah={isDesktop ? 320 : 260} offsetScrollbars>
                  <Stack gap={8}>
                    {savedTrips.map((trip) => (
                      <Paper key={trip.id} withBorder radius="md" p="sm">
                        <Stack gap={6}>
                          <Group justify="space-between" align="center" wrap="nowrap">
                            <Text size="sm" fw={600} lineClamp={1}>
                              {trip.name}
                            </Text>
                            <Badge variant="outline">
                              {trip.tripType === 'loop' ? t('typeLoop') : t('typeOneWay')}
                            </Badge>
                          </Group>
                          <Text size="xs" c="dimmed">
                            {new Date(trip.savedAt).toLocaleString(
                              isFrench ? 'fr-FR' : 'en-US',
                            )}{' '}
                            • {formatDistance(trip.trip.distance_m)}
                          </Text>
                          <Group gap="xs" wrap="nowrap">
                            <Button
                              size="xs"
                              variant="default"
                              onClick={() => onOpenSavedTrip(trip)}
                            >
                              {t('dataSavedTripOpen')}
                            </Button>
                            <Button
                              size="xs"
                              variant="light"
                              onClick={() => {
                                void onExportSavedTrip(trip)
                              }}
                            >
                              {t('dataSavedTripExport')}
                            </Button>
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color="red"
                              onClick={() => setDeleteTripCandidate(trip)}
                              aria-label={t('dataSavedTripDelete')}
                              title={t('dataSavedTripDelete')}
                            >
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Group>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                </ScrollArea.Autosize>
              )}
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="backup-cloud" id="data-cloud-panel">
            <Accordion.Control
              icon={
                <ThemeIcon variant="light" color="blue" radius="xl" size="md">
                  <IconDeviceFloppy size={16} />
                </ThemeIcon>
              }
            >
              <Stack gap={0}>
                <Text fw={600}>{t('dataHubTitle')}</Text>
                <Text size="xs" c="dimmed">
                  {t('dataHubCloudSubtitle')}
                </Text>
              </Stack>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="lg">
                <Paper withBorder radius="md" p={isDesktop ? 'md' : 'lg'}>
                  <Stack gap={isDesktop ? 'sm' : 'md'}>
                    <Group justify="space-between" align="center">
                      <Group gap="xs">
                        <ThemeIcon variant="light" color="blue" radius="xl" size="md">
                          <IconDeviceFloppy size={16} />
                        </ThemeIcon>
                        <Text fw={600}>{t('dataBackupsTitle')}</Text>
                      </Group>
                    </Group>
                    <Text size="sm" c="dimmed">
                      {t('dataHubBody')}
                    </Text>
                    <Group grow={isDesktop} wrap="wrap">
                      <Button
                        variant="default"
                        leftSection={<IconDownload size={16} />}
                        onClick={onExportBackup}
                        fullWidth={!isDesktop}
                        styles={mobileActionButtonStyles}
                      >
                        {t('dataExportBackup')}
                      </Button>
                      <Button
                        variant="outline"
                        leftSection={<IconUpload size={16} />}
                        onClick={onImportData}
                        fullWidth={!isDesktop}
                        styles={mobileActionButtonStyles}
                      >
                        {t('dataImport')}
                      </Button>
                    </Group>
                    <input
                      ref={importInputRef}
                      type="file"
                      accept="application/json,.json"
                      onChange={(event) => {
                        void onImportFileChange(event)
                      }}
                      style={{ display: 'none' }}
                    />
                  </Stack>
                </Paper>

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
                              value: new Date(cloudLastSyncAt).toLocaleString(
                                isFrench ? 'fr-FR' : 'en-US',
                              ),
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
                              onChange={(event) =>
                                onCloudAutoBackupEnabledChange(event.currentTarget.checked)
                              }
                              label={t('cloudAutoBackupToggle')}
                              description={t('cloudAutoBackupToggleHint')}
                            />
                            <Group grow={isDesktop} wrap="wrap">
                              <Button
                                variant="default"
                                leftSection={<IconPlugConnected size={16} />}
                                onClick={onCloudConnect}
                                disabled={isCloudAuthLoading}
                                loading={isCloudAuthLoading}
                                fullWidth={!isDesktop}
                                styles={mobileActionButtonStyles}
                              >
                                {connectedCloudMatchesSelection
                                  ? t('cloudReconnect')
                                  : t('cloudConnect')}
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
                              {connectedCloudMatchesSelection &&
                                !cloudAutoBackupEnabled && (
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
                            </Group>
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
                    <Stack gap={2}>
                      <Text size="xs" fw={600}>
                        {t('cloudSecurityTitle')}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {t('cloudSecurityItem1')}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {t('cloudSecurityItem2')}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {t('cloudSecurityItem3')}
                      </Text>
                    </Stack>
                  </Stack>
                </Paper>
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>

        </Accordion>
      </Stack>
    </Container>
  )
}
