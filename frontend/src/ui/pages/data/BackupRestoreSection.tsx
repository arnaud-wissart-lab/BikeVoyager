import { Group, Paper, Stack, Text, ThemeIcon, type ButtonProps } from '@mantine/core'
import { IconDeviceFloppy } from '@tabler/icons-react'
import type { ChangeEvent, RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import DataActionsBar from './DataActionsBar'
import ExportSection from './ExportSection'
import ImportSection from './ImportSection'

type BackupRestoreSectionProps = {
  isDesktop: boolean
  mobileActionButtonStyles: ButtonProps['styles']
  onExportBackup: () => void
  onImportData: () => void
  importInputRef: RefObject<HTMLInputElement | null>
  onImportFileChange: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>
}

export default function BackupRestoreSection({
  isDesktop,
  mobileActionButtonStyles,
  onExportBackup,
  onImportData,
  importInputRef,
  onImportFileChange,
}: BackupRestoreSectionProps) {
  const { t } = useTranslation()

  return (
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
        <DataActionsBar isDesktop={isDesktop}>
          <ExportSection
            isDesktop={isDesktop}
            mobileActionButtonStyles={mobileActionButtonStyles}
            onExportBackup={onExportBackup}
          />
          <ImportSection
            isDesktop={isDesktop}
            mobileActionButtonStyles={mobileActionButtonStyles}
            onImportData={onImportData}
            importInputRef={importInputRef}
            onImportFileChange={onImportFileChange}
          />
        </DataActionsBar>
      </Stack>
    </Paper>
  )
}
