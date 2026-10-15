import { getAntdTheme } from "../src/styles/antdTheme";
import { describe, expect, it } from "vitest";

// 左侧筛选面板里「全选/反选」用链接色，勾选框和开关用主色，
// 三者不统一时会显出两种蓝，这里锁住这个约束。
describe("Ant Design 主题主色", () => {
  it.each(["light", "dark"] as const)(
    "%s 主题下链接色、信息色与主色一致",
    (colorTheme) => {
      const { token } = getAntdTheme(colorTheme);
      expect(token?.colorLink).toBe(token?.colorPrimary);
      expect(token?.colorInfo).toBe(token?.colorPrimary);
    },
  );
});
