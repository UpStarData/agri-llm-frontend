import { ECOLOGY_THEME as eco } from "../utils/ecologyTheme";
import { theme } from "antd";
import type { ThemeConfig } from "antd";
import type { ColorTheme } from "../types";

export const getAntdTheme = (colorTheme: ColorTheme): ThemeConfig => {
  const primary = colorTheme === "dark" ? "#087fff" : eco.hub;
  return {
    algorithm:
      colorTheme === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: primary,
      // 链接与信息色默认不跟随主色（暗色下分别是 #1677ff），这里统一到主色，
      // 让筛选面板里的链接按钮和勾选框、开关同色。
      colorInfo: primary,
      colorLink: primary,
      colorBgBase: colorTheme === "dark" ? "#07142d" : eco.page,
      colorBgContainer: colorTheme === "dark" ? "#102447" : eco.panel,
      colorText: colorTheme === "dark" ? "#e7f0ef" : eco.text,
      colorTextSecondary: colorTheme === "dark" ? "#9bb6d2" : eco.muted,
      colorBorder: colorTheme === "dark" ? "#28476a" : eco.border,
      ...(colorTheme === "light"
        ? {
            colorSuccess: eco.production,
            colorWarning: eco.priorityRoute,
            colorError: eco.anomaly,
            colorBgLayout: eco.page,
            colorBgElevated: eco.panel,
            colorFillAlter: eco.card,
            colorBorderSecondary: eco.border,
            colorTextHeading: eco.text,
            controlOutline: eco.selectedSurface,
          }
        : {}),
      borderRadius: 7,
      fontSize: 13,
      fontFamily: "'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif",
    },
    components: {
      Card: { headerFontSize: 13 },
      Drawer: {
        colorBgElevated: colorTheme === "dark" ? "#102447" : "#ffffff",
      },
    },
  };
};
