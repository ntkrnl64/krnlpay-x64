import {
  Button,
  FluentProvider,
  Tooltip,
  webDarkTheme,
  webLightTheme,
  type Theme,
} from "@fluentui/react-components";
import { WeatherMoonRegular, WeatherSunnyRegular } from "@fluentui/react-icons";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const STORAGE_KEY = "krnlpay-theme";

type Choice = "light" | "dark" | "system";

type ThemeMode = {
  dark: boolean;
  toggle: () => void;
};

const ThemeModeContext = createContext<ThemeMode | null>(null);

function readChoice(): Choice {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeRoot({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<Choice>(readChoice);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  const dark = choice === "system" ? systemDark : choice === "dark";
  const theme: Theme = dark ? webDarkTheme : webLightTheme;

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const background = theme.colorNeutralBackground2;
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    document.documentElement.style.backgroundColor = background;
    document.body.style.backgroundColor = background;
  }, [dark, theme]);

  const value = useMemo<ThemeMode>(
    () => ({
      dark,
      toggle() {
        const next = dark ? "light" : "dark";
        localStorage.setItem(STORAGE_KEY, next);
        setChoice(next);
      },
    }),
    [dark],
  );

  return (
    <ThemeModeContext.Provider value={value}>
      <FluentProvider theme={theme} style={{ minHeight: "100vh", backgroundColor: theme.colorNeutralBackground2 }}>
        {children}
      </FluentProvider>
    </ThemeModeContext.Provider>
  );
}

export function ThemeToggle() {
  const mode = useContext(ThemeModeContext);
  if (!mode) {
    return null;
  }
  const label = mode.dark ? "切换到浅色模式" : "切换到深色模式";
  return (
    <Tooltip content={label} relationship="label">
      <Button
        appearance="subtle"
        icon={mode.dark ? <WeatherSunnyRegular /> : <WeatherMoonRegular />}
        onClick={mode.toggle}
      />
    </Tooltip>
  );
}
