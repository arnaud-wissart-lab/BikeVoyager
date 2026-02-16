import { useCloudController } from '../../features/cloud/useCloudController'
import { useDataController } from '../../features/data/useDataController'
import { useMapController } from '../../features/map/useMapController'
import type { AppStore } from '../../state/appStore'
import DataPage from '../../ui/pages/DataPage'

type DataRouteProps = {
  contentSize: string
  isDesktop: boolean
  isFrench: boolean
  surfaceColor: string
  borderColor: string
  store: AppStore
  mapController: ReturnType<typeof useMapController>
  dataController: ReturnType<typeof useDataController>
  cloudController: ReturnType<typeof useCloudController>
}

export default function DataRoute({
  contentSize,
  isDesktop,
  isFrench,
  surfaceColor,
  borderColor,
  store,
  mapController,
  dataController,
  cloudController,
}: DataRouteProps) {
  return (
    <DataPage
      contentSize={contentSize}
      isDesktop={isDesktop}
      isFrench={isFrench}
      surfaceColor={surfaceColor}
      borderColor={borderColor}
      dataAccordionValue={store.dataAccordionValue}
      onDataAccordionChange={store.setDataAccordionValue}
      savedTrips={store.savedTrips}
      onExportBackup={() => {
        void dataController.handleExportBackup()
      }}
      onImportData={dataController.handleImportData}
      importInputRef={store.importInputRef}
      onImportFileChange={dataController.handleImportFileChange}
      formatDistance={(distanceMeters: number) => mapController.formatDistance(distanceMeters)}
      onOpenSavedTrip={dataController.handleOpenSavedTrip}
      onExportSavedTrip={dataController.handleExportSavedTrip}
      onDeleteSavedTrip={dataController.handleDeleteSavedTrip}
      hasAnyConfiguredCloudProvider={cloudController.hasAnyConfiguredCloudProvider}
      cloudProvider={store.cloudProvider}
      onCloudProviderChange={cloudController.handleCloudProviderChange}
      cloudProviderControlData={cloudController.cloudProviderControlData}
      selectedCloudProvider={cloudController.selectedCloudProvider}
      selectedCloudConfigured={cloudController.selectedCloudConfigured}
      cloudAuthState={store.cloudAuthState}
      toCloudProviderLabel={cloudController.toCloudProviderLabel}
      cloudAccountLabel={cloudController.cloudAccountLabel}
      cloudLastSyncAt={store.cloudLastSyncAt}
      cloudBackupFileName={cloudController.cloudBackupFileName}
      connectedCloudMatchesSelection={cloudController.connectedCloudMatchesSelection}
      onCloudConnect={() => {
        void cloudController.handleCloudConnect()
      }}
      onCloudDisconnect={() => {
        void cloudController.handleCloudDisconnect()
      }}
      isCloudAuthLoading={store.isCloudAuthLoading}
      isCloudSyncLoading={store.isCloudSyncLoading}
      cloudAutoBackupEnabled={store.cloudAutoBackupEnabled}
      onCloudAutoBackupEnabledChange={cloudController.handleCloudAutoBackupEnabledChange}
      onCloudUploadBackup={() => {
        void cloudController.handleCloudUploadBackup()
      }}
      cloudSyncMessage={store.cloudSyncMessage}
      cloudSyncError={store.cloudSyncError}
      addressBookPanelProps={{
        isDesktop,
        entries: store.addressBook,
        visibleEntries: dataController.visibleAddressBookEntries,
        visibleCount: dataController.visibleAddressBookCount,
        filterTag: store.addressBookFilterTag,
        filterAllValue: dataController.addressBookFilterAll,
        filterOptions: dataController.addressBookTagOptions,
        nameValue: store.addressBookNameValue,
        placeValue: store.addressBookPlaceValue,
        tagsValue: store.addressBookTagsValue,
        canSave: dataController.canSaveAddressBookEntry,
        formatTagLabel: dataController.formatAddressTagLabel,
        onNameChange: store.setAddressBookNameValue,
        onPlaceValueChange: store.setAddressBookPlaceValue,
        onPlaceSelect: store.setAddressBookPlaceCandidate,
        onTagsChange: store.setAddressBookTagsValue,
        onSave: dataController.handleSaveAddressBookEntry,
        onFilterChange: dataController.setAddressBookFilterTag,
        onDelete: dataController.handleDeleteAddressBookEntry,
        onAddTag: dataController.handleAddAddressBookTag,
        onDeleteTag: dataController.handleDeleteAddressBookTag,
      }}
    />
  )
}
