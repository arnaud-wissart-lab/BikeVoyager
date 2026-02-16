import { Button, type ButtonProps } from '@mantine/core'
import { IconUpload } from '@tabler/icons-react'
import type { ChangeEvent, RefObject } from 'react'
import { useTranslation } from 'react-i18next'

type ImportSectionProps = {
  isDesktop: boolean
  mobileActionButtonStyles: ButtonProps['styles']
  onImportData: () => void
  importInputRef: RefObject<HTMLInputElement | null>
  onImportFileChange: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>
}

export default function ImportSection({
  isDesktop,
  mobileActionButtonStyles,
  onImportData,
  importInputRef,
  onImportFileChange,
}: ImportSectionProps) {
  const { t } = useTranslation()

  return (
    <>
      <Button
        variant="outline"
        leftSection={<IconUpload size={16} />}
        onClick={onImportData}
        fullWidth={!isDesktop}
        styles={mobileActionButtonStyles}
      >
        {t('dataImport')}
      </Button>
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        onChange={(event) => {
          void onImportFileChange(event)
        }}
        style={{ display: 'none' }}
      />
    </>
  )
}
