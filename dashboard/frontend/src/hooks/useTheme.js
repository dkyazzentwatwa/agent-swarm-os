import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_THEME_ID,
  getThemeIndexById,
  THEME_OPTIONS,
} from "@/theme/themes";
import { storage } from "@/lib/storage";

function getInitialThemeIndex() {
  if (typeof window === "undefined") {
    return getThemeIndexById(DEFAULT_THEME_ID);
  }

  const savedThemeId = storage.get("theme", DEFAULT_THEME_ID);
  return getThemeIndexById(savedThemeId);
}

export function useTheme() {
  const [themeIndex, setThemeIndex] = useState(getInitialThemeIndex);

  const activeTheme = useMemo(() => THEME_OPTIONS[themeIndex], [themeIndex]);

  useEffect(() => {
    if (!activeTheme) return;
    document.documentElement.setAttribute("data-theme", activeTheme.id);
    storage.set("theme", activeTheme.id);
  }, [activeTheme]);

  const cycleTheme = () => {
    setThemeIndex((currentIndex) => (currentIndex + 1) % THEME_OPTIONS.length);
  };

  const setTheme = (themeId) => {
    setThemeIndex(getThemeIndexById(themeId));
  };

  return {
    activeTheme,
    themeIndex,
    setTheme,
    cycleTheme,
    themes: THEME_OPTIONS,
  };
}
