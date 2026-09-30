import { describe, expect, it } from "vitest";
import { matchesFactFilters, provinceApiCode, varietyCommodityIds } from "../src/utils/factFilters";
import type { ApiFact } from "../src/api/fact";

const fact: ApiFact = {
  factId: "f-1",
  title: "湖南猫山王榴莲行情",
  summary: "湖南猫山王榴莲行情摘要",
  commodityIds: ["e:cmd:musang-king"],
  geo: { regionPath: [
    { code: "GLOBAL", name: "全球" },
    { code: "CHN", name: "中国" },
    { code: "CN-HN", name: "湖南省" },
  ] },
};

describe("事实区域与品种筛选", () => {
  it("将省份行政编码转为事实接口使用的区域编码", () => {
    expect(provinceApiCode("430000")).toBe("CN-HN");
    expect(provinceApiCode("410000")).toBe("CN-HA");
  });

  it("国家、省份继续按区域筛选，品种改由接口筛选", () => {
    expect(matchesFactFilters(fact, "", "")).toBe(true);
    expect(matchesFactFilters(fact, "CN", "430000")).toBe(true);
    expect(matchesFactFilters(fact, "CN", "440000")).toBe(false);
    expect(varietyCommodityIds["榴莲"]).toBe("e:cmd:durian");
  });

});
