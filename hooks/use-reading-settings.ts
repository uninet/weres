"use client";

import { useState, useCallback } from "react";
import type { ReadingSettings } from "@/types/reader";

const defaultSettings: ReadingSettings = {
  fontSize: "medium",
  fontFamily: "serif",
  lineHeight: "relaxed",
  contentWidth: "medium",
  isDarkMode: false,
};

export function useReadingSettings() {
  const [settings, setSettings] = useState<ReadingSettings>(defaultSettings);

  const setFontSize = useCallback((fontSize: string) => {
    setSettings((prev) => ({ ...prev, fontSize }));
  }, []);

  const setFontFamily = useCallback((fontFamily: string) => {
    setSettings((prev) => ({ ...prev, fontFamily }));
  }, []);

  const setLineHeight = useCallback((lineHeight: string) => {
    setSettings((prev) => ({ ...prev, lineHeight }));
  }, []);

  const setContentWidth = useCallback((contentWidth: string) => {
    setSettings((prev) => ({ ...prev, contentWidth }));
  }, []);

  const toggleDarkMode = useCallback(() => {
    setSettings((prev) => ({ ...prev, isDarkMode: !prev.isDarkMode }));
  }, []);

  const setDarkMode = useCallback((isDarkMode: boolean) => {
    setSettings((prev) => ({ ...prev, isDarkMode }));
  }, []);

  return {
    settings,
    setFontSize,
    setFontFamily,
    setLineHeight,
    setContentWidth,
    toggleDarkMode,
    setDarkMode,
  };
}
