import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AppTheme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextType {
  theme: AppTheme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "flowbot-theme";

const isValidTheme = (value: string | null): value is AppTheme =>
  value === "light" || value === "dark" || value === "system";

const getSystemTheme = (): ResolvedTheme => {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const getInitialTheme = (): AppTheme => {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isValidTheme(stored) ? stored : "system";
};

const resolveTheme = (theme: AppTheme): ResolvedTheme =>
  theme === "system" ? getSystemTheme() : theme;

const applyTheme = (resolvedTheme: ResolvedTheme, theme: AppTheme) => {
  const root = document.documentElement;
  root.dataset.appTheme = theme;
  root.dataset.resolvedTheme = resolvedTheme;
  root.classList.toggle("theme-dark", resolvedTheme === "dark");
  root.classList.toggle("dark", resolvedTheme === "dark");
  root.style.colorScheme = resolvedTheme;
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const initialTheme = getInitialTheme();
  const [theme, setTheme] = useState<AppTheme>(initialTheme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(resolveTheme(initialTheme));

  useEffect(() => {
    if (theme !== "system") {
      setResolvedTheme(theme);
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const syncFromSystem = () => setResolvedTheme(mediaQuery.matches ? "dark" : "light");
    syncFromSystem();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncFromSystem);
      return () => mediaQuery.removeEventListener("change", syncFromSystem);
    }
    mediaQuery.addListener(syncFromSystem);
    return () => mediaQuery.removeListener(syncFromSystem);
  }, [theme]);

  useEffect(() => {
    applyTheme(resolvedTheme, theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [resolvedTheme, theme]);

  const value = useMemo<ThemeContextType>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme: () =>
        setTheme((current) => {
          if (current === "dark") return "light";
          if (current === "light") return "dark";
          return resolvedTheme === "dark" ? "light" : "dark";
        }),
    }),
    [resolvedTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
