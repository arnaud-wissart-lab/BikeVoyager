import { createTheme } from '@mantine/core'

export const theme = createTheme({
  fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '0.975rem',
    lg: '1.1rem',
    xl: '1.3rem',
  },
  lineHeights: {
    xs: '1.35',
    sm: '1.45',
    md: '1.5',
    lg: '1.55',
    xl: '1.6',
  },
  headings: {
    fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
    fontWeight: '600',
    sizes: {
      h1: { fontSize: '2rem', lineHeight: '1.2', fontWeight: '600' },
      h2: { fontSize: '1.6rem', lineHeight: '1.25', fontWeight: '600' },
      h3: { fontSize: '1.35rem', lineHeight: '1.3', fontWeight: '600' },
      h4: { fontSize: '1.15rem', lineHeight: '1.35', fontWeight: '600' },
      h5: { fontSize: '1rem', lineHeight: '1.4', fontWeight: '600' },
      h6: { fontSize: '0.9rem', lineHeight: '1.4', fontWeight: '600' },
    },
  },
  primaryColor: 'blue',
  primaryShade: { light: 6, dark: 4 },
  defaultRadius: 'md',
  shadows: {
    sm: 'var(--bikevoyager-panel-shadow)',
  },
  colors: {
    gray: [
      '#f7f8fa',
      '#eef1f4',
      '#d8dde3',
      '#c1c8d0',
      '#aab4bd',
      '#939fad',
      '#7a8898',
      '#606d7f',
      '#485364',
      '#303a49',
    ],
    blue: [
      '#f2f6ff',
      '#e3ecff',
      '#c9d9ff',
      '#aac2ff',
      '#8aa9f2',
      '#6f8fe0',
      '#5976c7',
      '#435da7',
      '#334684',
      '#24325f',
    ],
    green: [
      '#f2f7f4',
      '#e4efe9',
      '#c8ddd1',
      '#aac9b7',
      '#8db59e',
      '#719f84',
      '#588468',
      '#40694f',
      '#2c4b36',
      '#1a2f22',
    ],
  },
  components: {
    ActionIcon: {
      defaultProps: {
        radius: 'md',
        color: 'blue',
      },
    },
    Badge: {
      defaultProps: {
        radius: 'sm',
      },
    },
    Button: {
      defaultProps: {
        radius: 'md',
        size: 'sm',
      },
    },
    Checkbox: {
      defaultProps: {
        size: 'sm',
      },
    },
    NumberInput: {
      defaultProps: {
        size: 'sm',
      },
    },
    PasswordInput: {
      defaultProps: {
        size: 'sm',
      },
    },
    Paper: {
      defaultProps: {
        radius: 'md',
        shadow: 'sm',
      },
    },
    SegmentedControl: {
      defaultProps: {
        radius: 'xl',
        size: 'sm',
      },
    },
    Slider: {
      defaultProps: {
        size: 'sm',
      },
    },
    TextInput: {
      defaultProps: {
        size: 'sm',
      },
    },
  },
})
