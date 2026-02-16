import {
  Accordion,
  Container,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core'
import {
  IconDeviceFloppy,
  IconMapPinPlus,
  IconRoute,
} from '@tabler/icons-react'
import { useState, type ChangeEvent, type ComponentProps, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { ActiveCloudProvider, CloudAuthState } from '../../features/cloud/cloudSync'
import type { CloudProvider, SavedTripRecord } from '../../features/data/dataPortability'
import AddressBookPanel from './AddressBookPanel'
import BackupRestoreSection from './data/BackupRestoreSection'
import CloudSyncSection from './data/CloudSyncSection'
import DataPageHeader from './data/DataPageHeader'
import DeleteSavedTripModal from './data/DeleteSavedTripModal'
import SavedTripsSection from './data/SavedTripsSection'

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
        <DeleteSavedTripModal
          candidate={deleteTripCandidate}
          isFrench={isFrench}
          onClose={closeDeleteTripModal}
          onConfirm={confirmDeleteTrip}
        />
        <DataPageHeader />

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
              <SavedTripsSection
                isDesktop={isDesktop}
                isFrench={isFrench}
                savedTrips={savedTrips}
                formatDistance={formatDistance}
                onOpenSavedTrip={onOpenSavedTrip}
                onExportSavedTrip={onExportSavedTrip}
                onDeleteSavedTripRequest={setDeleteTripCandidate}
              />
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
                <BackupRestoreSection
                  isDesktop={isDesktop}
                  mobileActionButtonStyles={mobileActionButtonStyles}
                  onExportBackup={onExportBackup}
                  onImportData={onImportData}
                  importInputRef={importInputRef}
                  onImportFileChange={onImportFileChange}
                />
                <CloudSyncSection
                  isDesktop={isDesktop}
                  isFrench={isFrench}
                  mobileActionButtonStyles={mobileActionButtonStyles}
                  hasAnyConfiguredCloudProvider={hasAnyConfiguredCloudProvider}
                  cloudProvider={cloudProvider}
                  onCloudProviderChange={onCloudProviderChange}
                  cloudProviderControlData={cloudProviderControlData}
                  selectedCloudProvider={selectedCloudProvider}
                  selectedCloudConfigured={selectedCloudConfigured}
                  cloudAuthState={cloudAuthState}
                  toCloudProviderLabel={toCloudProviderLabel}
                  cloudAccountLabel={cloudAccountLabel}
                  cloudLastSyncAt={cloudLastSyncAt}
                  cloudBackupFileName={cloudBackupFileName}
                  connectedCloudMatchesSelection={connectedCloudMatchesSelection}
                  onCloudConnect={onCloudConnect}
                  onCloudDisconnect={onCloudDisconnect}
                  isCloudAuthLoading={isCloudAuthLoading}
                  isCloudSyncLoading={isCloudSyncLoading}
                  cloudAutoBackupEnabled={cloudAutoBackupEnabled}
                  onCloudAutoBackupEnabledChange={onCloudAutoBackupEnabledChange}
                  onCloudUploadBackup={onCloudUploadBackup}
                  cloudSyncMessage={cloudSyncMessage}
                  cloudSyncError={cloudSyncError}
                />
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </Stack>
    </Container>
  )
}

