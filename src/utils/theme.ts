import type { ColorTheme } from "@/types";

export const THEME_STORAGE_KEY = "agrilink.colorTheme";
export const readTheme = (): ColorTheme => {
  try {
    return globalThis.localStorage?.getItem(THEME_STORAGE_KEY) === "light"
      ? "light"
      : "dark";
  } catch {
    return "dark";
  }
};
export const saveTheme = (theme: ColorTheme) => {
  try {
    globalThis.localStorage?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // 存储不可用时仍允许当前会话切换主题。
  }
};
