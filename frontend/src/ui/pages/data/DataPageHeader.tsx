import { Stack, Text, Title } from '@mantine/core'
import { useTranslation } from 'react-i18next'

export default function DataPageHeader() {
  const { t } = useTranslation()

  return (
    <Stack gap={4}>
      <Title order={2}>{t('dataPageTitle')}</Title>
      <Text size="sm" c="dimmed">
        {t('dataPageSubtitle')}
      </Text>
    </Stack>
  )
}
