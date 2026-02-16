import { Button, type ButtonProps } from '@mantine/core'
import { IconDownload } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

type ExportSectionProps = {
  isDesktop: boolean
  mobileActionButtonStyles: ButtonProps['styles']
  onExportBackup: () => void
}

export default function ExportSection({
  isDesktop,
  mobileActionButtonStyles,
  onExportBackup,
}: ExportSectionProps) {
  const { t } = useTranslation()

  return (
    <Button
      variant="default"
      leftSection={<IconDownload size={16} />}
      onClick={onExportBackup}
      fullWidth={!isDesktop}
      styles={mobileActionButtonStyles}
    >
      {t('dataExportBackup')}
    </Button>
  )
}
