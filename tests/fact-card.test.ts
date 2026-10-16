import { describe, expect, it } from "vitest";
import { factCard } from "../src/utils/factCard";
import type { ApiFact } from "../src/api/fact";

const commodities = [
  { id: "v1", name: "山竹", status: "active" },
  { id: "v2", name: "大豆", status: "active" },
];

const fact = (overrides: Partial<ApiFact> = {}): ApiFact => ({
  factId: "f1",
  title: "海关总署更新输华山竹注册果园名单",
  summary: "新增获批注册果园与包装厂名单生效。",
  occurredAt: "2026-10-13T03:47:45Z",
  commodityIds: ["v1", "v2"],
  evidenceCount: 2,
  ...overrides,
});

describe("事实卡片字段", () => {
  it("共同字段按发生时间 / 地理范围 / 涉及品种横向拼接", () => {
    const card = factCard(
      fact({
        geo: {
          regionPath: [
            { name: "全球" },
            { name: "中国" },
            { name: "越南" },
          ],
        },
      }),
      commodities,
    );
    expect(card.commonFields).toBe("2026-10-13 11:47 / 全球 › 中国 › 越南 / 山竹、大豆");
  });

  it("缺失的时间、地理范围、品种不占位，也不留多余分隔符", () => {
    expect(factCard(fact({ occurredAt: undefined, commodityIds: [] })).commonFields).toBe("");
    expect(factCard(fact({ geo: {} }), commodities).commonFields).toBe(
      "2026-10-13 11:47 / 山竹、大豆",
    );
  });

  it("核心摘要取 typeFields 的非空值，最多 3 条，标签去掉首尾空白", () => {
    const card = factCard(fact({
      typeFields: [
        { label: " 批发均价 ", value: "42 元/公斤" },
        { label: "环比", value: "" },
        { label: "产地", value: null },
        { label: "口径", value: 0 },
        { label: "区间", value: "月度" },
        { label: "第四条", value: "不展示" },
      ],
    }));
    expect(card.coreFields).toEqual([
      { label: "批发均价", value: "42 元/公斤" },
      { label: "口径", value: 0 },
      { label: "区间", value: "月度" },
    ]);
  });

  it("没有 typeFields 时核心摘要为空，不影响其他字段", () => {
    const card = factCard(fact({ categoryName: "检疫政策", keyMetrics: "完税成本：3920 元/吨" }));
    expect(card.coreFields).toEqual([]);
    expect(card.categoryName).toBe("检疫政策");
    expect(card.summary).toBe("新增获批注册果园与包装厂名单生效。");
    expect(card.evidenceCount).toBe(2);
  });
});
