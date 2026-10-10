import { ECOLOGY_THEME as eco } from "../utils/ecologyTheme";
import { theme } from "antd";
import type { ThemeConfig } from "antd";
import type { ColorTheme } from "../types";

export const getAntdTheme = (colorTheme: ColorTheme): ThemeConfig => ({
  algorithm: colorTheme === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm,
  token: {
    colorPrimary: colorTheme === "dark" ? "#087fff" : eco.hub,
    colorBgBase: colorTheme === "dark" ? "#07142d" : eco.page,
    colorBgContainer: colorTheme === "dark" ? "#102447" : eco.panel,
    colorText: colorTheme === "dark" ? "#e7f0ef" : eco.text,
    colorTextSecondary: colorTheme === "dark" ? "#9bb6d2" : eco.muted,
    colorBorder: colorTheme === "dark" ? "#28476a" : eco.border,
    ...(colorTheme === "light" ? { colorSuccess: eco.production, colorWarning: eco.priorityRoute, colorError: eco.anomaly, colorInfo: eco.hub, colorBgLayout: eco.page, colorBgElevated: eco.panel, colorFillAlter: eco.card, colorBorderSecondary: eco.border, colorTextHeading: eco.text, colorLink: eco.hub, controlOutline: eco.selectedSurface } : {}),
    borderRadius: 7,
    fontSize: 13,
    fontFamily: "'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif",
  },
  components: {
    Card: { headerFontSize: 13 },
    Drawer: { colorBgElevated: colorTheme === "dark" ? "#102447" : "#ffffff" },
  },
});
