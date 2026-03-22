import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export const THEMES = ['orcta', 'monochrome', 'civic'] as const

export type AppTheme = (typeof THEMES)[number]

type ThemeOption = {
  id: AppTheme
  label: string
  description: string
  swatches: [string, string, string]
}

const STORAGE_KEY = 'waybill-theme'

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'orcta',
    label: 'Orcta',
    description: 'Paper warm neutrals with navy accents.',
    swatches: ['#1d3557', '#f8f4ec', '#d8ccb8'],
  },
  {
    id: 'monochrome',
    label: 'Monochrome',
    description: 'Neutral grays for a stricter document look.',
    swatches: ['#20242b', '#f6f6f3', '#cbcbc6'],
  },
  {
    id: 'civic',
    label: 'Civic Blue',
    description: 'Cool blue-gray surfaces with a formal ops tone.',
    swatches: ['#21486b', '#f4f7fa', '#cfd9e6'],
  },
]

type ThemeContextValue = {
  theme: AppTheme
  options: ThemeOption[]
  setTheme: (theme: AppTheme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStoredTheme(): AppTheme {
  if (typeof window === 'undefined') {
    return 'orcta'
  }

  const stored = window.localStorage.getItem(STORAGE_KEY)
  return THEMES.includes(stored as AppTheme) ? (stored as AppTheme) : 'orcta'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<AppTheme>(readStoredTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      options: THEME_OPTIONS,
      setTheme,
    }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider.')
  }

  return context
}
