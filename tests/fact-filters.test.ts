import { describe, expect, it } from "vitest";
import { commodityNameById, provinceApiCode } from "../src/utils/factFilters";
describe("事实区域与品种筛选", () => {
  it("将省份行政编码转为事实接口使用的区域编码", () => {
    expect(provinceApiCode("430000")).toBe("CN-HN");
    expect(provinceApiCode("410000")).toBe("CN-HA");
  });

  it("按字典展示品种名称，未知 ID 保留原值", () => {
    expect(commodityNameById("e:cmd:durian", [{ id: "e:cmd:durian", name: "榴莲" }])).toBe("榴莲");
    expect(commodityNameById("e:cmd:other", [])).toBe("e:cmd:other");
  });

});
