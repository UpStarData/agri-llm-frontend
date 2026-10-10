import { theme } from "antd";
import type { ThemeConfig } from "antd";
import type { ColorTheme } from "../types";

export const getAntdTheme = (colorTheme: ColorTheme): ThemeConfig => ({
  algorithm: colorTheme === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm,
  token: {
    colorPrimary: colorTheme === "dark" ? "#087fff" : "#67d5c3",
    colorBgBase: colorTheme === "dark" ? "#07142d" : "#edf2f2",
    colorBgContainer: colorTheme === "dark" ? "#102447" : "#fcfcf7",
    colorText: colorTheme === "dark" ? "#e7f0ef" : "#36565c",
    colorTextSecondary: colorTheme === "dark" ? "#9bb6d2" : "#536c6f",
    colorBorder: colorTheme === "dark" ? "#28476a" : "#dbe6e8",
    borderRadius: 7,
    fontSize: 13,
    fontFamily: "'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif",
  },
  components: {
    Card: { headerFontSize: 13 },
    Drawer: { colorBgElevated: colorTheme === "dark" ? "#102447" : "#ffffff" },
  },
});
