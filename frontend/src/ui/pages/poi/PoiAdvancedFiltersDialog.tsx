import {
  Accordion,
  Badge,
  Button,
  Checkbox,
  Drawer,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Text,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconAdjustmentsHorizontal } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import type {
  PoiAdvancedFilterGroup,
  PoiAdvancedFilterGroupKey,
  PoiAdvancedFilterOptionKey,
  PoiAdvancedFilterSettings,
} from '../../../features/pois/types'

type PoiAdvancedFiltersDialogProps = {
  isCompact: boolean
  groups: PoiAdvancedFilterGroup[]
  settings: PoiAdvancedFilterSettings
  selectedCount: number
  onGroupChange: (groupKey: PoiAdvancedFilterGroupKey, values: PoiAdvancedFilterOptionKey[]) => void
  onGroupSelectAll: (groupKey: PoiAdvancedFilterGroupKey) => void
  onGroupHideAll: (groupKey: PoiAdvancedFilterGroupKey) => void
  onSelectAll: () => void
  onHideAll: () => void
  onReset: () => void
  onApplyUsefulBikePreset: () => void
}

export default function PoiAdvancedFiltersDialog({
  isCompact,
  groups,
  settings,
  selectedCount,
  onGroupChange,
  onGroupSelectAll,
  onGroupHideAll,
  onSelectAll,
  onHideAll,
  onReset,
  onApplyUsefulBikePreset,
}: PoiAdvancedFiltersDialogProps) {
  const { t } = useTranslation()
  const [opened, { open, close }] = useDisclosure(false)

  const content = (
    <Stack gap="sm">
      <Group gap="xs" wrap="wrap">
        <Button size="xs" variant="light" onClick={onSelectAll}>
          {t('poiAdvancedFiltersSelectAll')}
        </Button>
        <Button size="xs" variant="light" color="gray" onClick={onHideAll}>
          {t('poiAdvancedFiltersHideAll')}
        </Button>
        <Button size="xs" variant="light" onClick={onReset}>
          {t('poiAdvancedFiltersReset')}
        </Button>
        <Button size="xs" variant="outline" onClick={onApplyUsefulBikePreset}>
          {t('poiAdvancedFiltersUsefulBikePreset')}
        </Button>
      </Group>

      <Accordion
        multiple
        defaultValue={groups.map((group) => group.key)}
        variant="separated"
        radius="sm"
      >
        {groups.map((group) => (
          <Accordion.Item key={group.key} value={group.key}>
            <Accordion.Control>
              <Group justify="space-between" gap="xs" wrap="nowrap">
                <Text size="sm" fw={600}>
                  {t(group.labelKey)}
                </Text>
                <Badge size="sm" variant="light" color="gray">
                  {settings[group.key].length}
                </Badge>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="xs">
                <Group gap="xs" wrap="wrap">
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    onClick={() => onGroupSelectAll(group.key)}
                  >
                    {t('poiAdvancedFiltersSelectAll')}
                  </Button>
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    color="gray"
                    onClick={() => onGroupHideAll(group.key)}
                  >
                    {t('poiAdvancedFiltersHideAll')}
                  </Button>
                </Group>
                <Checkbox.Group
                  value={settings[group.key]}
                  onChange={(values) =>
                    onGroupChange(group.key, values as PoiAdvancedFilterOptionKey[])
                  }
                >
                  <Stack gap={6}>
                    {group.options.map((option) => (
                      <Checkbox
                        key={option.key}
                        value={option.key}
                        label={t(option.labelKey)}
                        size="xs"
                      />
                    ))}
                  </Stack>
                </Checkbox.Group>
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>

      {isCompact && (
        <Button size="sm" variant="filled" onClick={close}>
          {t('poiAdvancedFiltersClose')}
        </Button>
      )}
    </Stack>
  )

  return (
    <>
      <Button
        size="xs"
        variant="light"
        onClick={open}
        leftSection={<IconAdjustmentsHorizontal size={14} />}
        rightSection={
          <Badge size="xs" variant="filled">
            {selectedCount}
          </Badge>
        }
        aria-label={`${t('poiAdvancedFiltersOpen')} - ${t('poiAdvancedFiltersActiveCount', {
          count: selectedCount,
        })}`}
      >
        {t('poiAdvancedFiltersOpen')}
      </Button>

      {isCompact ? (
        <Drawer
          opened={opened}
          onClose={close}
          title={t('poiAdvancedFiltersTitle')}
          position="bottom"
          size="85%"
        >
          <ScrollArea.Autosize mah="calc(85dvh - 5rem)" offsetScrollbars>
            {content}
          </ScrollArea.Autosize>
        </Drawer>
      ) : (
        <Modal opened={opened} onClose={close} title={t('poiAdvancedFiltersTitle')} size="lg">
          <ScrollArea.Autosize mah="70vh" offsetScrollbars>
            {content}
          </ScrollArea.Autosize>
        </Modal>
      )}
    </>
  )
}
