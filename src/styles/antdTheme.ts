import { theme } from "antd";
import type { ThemeConfig } from "antd";
import type { ColorTheme } from "../types";

export const getAntdTheme = (colorTheme: ColorTheme): ThemeConfig => ({
  algorithm: colorTheme === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm,
  token: {
    colorPrimary: colorTheme === "dark" ? "#087fff" : "#67d5c3",
    colorBgBase: colorTheme === "dark" ? "#07142d" : "#f3f8f7",
    colorBgContainer: colorTheme === "dark" ? "#102447" : "#ffffff",
    colorText: colorTheme === "dark" ? "#e7f0ef" : "#16383b",
    colorTextSecondary: colorTheme === "dark" ? "#9bb6d2" : "#648184",
    colorBorder: colorTheme === "dark" ? "#28476a" : "#c9dddb",
    borderRadius: 7,
    fontSize: 13,
    fontFamily: "'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif",
  },
  components: {
    Card: { headerFontSize: 13 },
    Drawer: { colorBgElevated: colorTheme === "dark" ? "#102447" : "#ffffff" },
  },
});
