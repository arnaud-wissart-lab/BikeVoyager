import { Box, Collapse, Group, Paper, Text, UnstyledButton } from '@mantine/core'
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react'
import type { ReactNode } from 'react'

type MapCollapsibleSectionProps = {
  title: string
  expanded: boolean
  onToggle: () => void
  content: ReactNode
  isCompact: boolean
  ariaLabel: string
  backgroundColor: string
  indicator?: ReactNode
  transitionDuration?: number
  transitionTimingFunction?: string
}

export default function MapCollapsibleSection({
  title,
  expanded,
  onToggle,
  content,
  isCompact,
  ariaLabel,
  backgroundColor,
  indicator = null,
  transitionDuration = 220,
  transitionTimingFunction = 'ease-in-out',
}: MapCollapsibleSectionProps) {
  return (
    <Paper
      withBorder
      shadow="sm"
      radius="md"
      p={isCompact ? 'xs' : 'sm'}
      style={{ backgroundColor }}
    >
      <UnstyledButton
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={ariaLabel}
        style={{ width: '100%' }}
      >
        <Group justify="space-between" align="center" wrap="nowrap">
          <Text size={isCompact ? 'sm' : 'md'} fw={600} lineClamp={1}>
            {title}
          </Text>
          <Group gap={6} align="center" wrap="nowrap">
            {indicator}
            {expanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
          </Group>
        </Group>
      </UnstyledButton>
      <Collapse
        in={expanded}
        transitionDuration={transitionDuration}
        transitionTimingFunction={transitionTimingFunction}
      >
        <Box pt={isCompact ? 6 : 8}>{content}</Box>
      </Collapse>
    </Paper>
  )
}
