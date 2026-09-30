import { theme } from "antd";
import type { ThemeConfig } from "antd";
import type { ColorTheme } from "../types";

export const getAntdTheme = (colorTheme: ColorTheme): ThemeConfig => ({
  algorithm: colorTheme === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm,
  token: {
    colorPrimary: "#67d5c3",
    colorBgBase: colorTheme === "dark" ? "#071f25" : "#f3f8f7",
    colorBgContainer: colorTheme === "dark" ? "#102b30" : "#ffffff",
    colorText: colorTheme === "dark" ? "#e7f0ef" : "#16383b",
    colorTextSecondary: colorTheme === "dark" ? "#89a7a9" : "#648184",
    colorBorder: colorTheme === "dark" ? "#2b474b" : "#c9dddb",
    borderRadius: 7,
    fontSize: 13,
    fontFamily: "'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif",
  },
  components: {
    Card: { headerFontSize: 13 },
    Drawer: { colorBgElevated: colorTheme === "dark" ? "#10282d" : "#ffffff" },
  },
});
