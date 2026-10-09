import { beforeEach, describe, expect, it, vi } from "vitest";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../src/api/request", () => ({
  request,
  ApiError: class ApiError extends Error {},
}));

import {
  getRelation,
  getRelationGraph,
  getRelationGraphPoints,
} from "../src/api/relation";
import { relationDetailForView, relationGraphForView } from "../src/hooks/useRelationQueries";

const response = {
  code: 0,
  message: "OK",
  data: {
    nodes: [
      {
        entityId: "e:1",
        canonicalName: "湖南基地",
        categoryL2: "production_base",
        displayGroup: "production_base",
        geoPoint: [112, 28],
        viewLevels: ["china", "hunan"],
      },
      {
        entityId: "e:2",
        canonicalName: "无坐标本体",
        categoryL2: "company",
        displayGroup: "company",
        geoPoint: null,
        viewLevels: [],
      },
    ],
    edges: [
      {
        relationId: "r:1",
        typeKey: "supplies",
        colorDomain: "production_supply",
        directed: true,
        sourceEntityId: "e:1",
        targetEntityId: "e:2",
        displayLevels: ["china"],
        supportFactCount: 5,
        involvedVarieties: ["e:cmd:rice"],
      },
    ],
    total: 2,
    returned: 2,
    truncated: false,
  },
};

describe("图谱接口契约", () => {
  beforeEach(() => {
    request.mockReset();
    request.mockResolvedValue(response);
  });

  it("/graph 映射全量节点和关系字段", async () => {
    const result = await getRelationGraph({ commodityIds: ["e:cmd:rice"] });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/graph",
        method: "POST",
        data: { commodityIds: ["e:cmd:rice"] },
      }),
    );
    expect(result.data).toBe(response.data);
    const graph = relationGraphForView(result);
    expect(graph.entities[1].position).toBeNull();
    expect(graph.relations[0]).toEqual(
      expect.objectContaining({
        id: "r:1",
        sourceId: "e:1",
        targetId: "e:2",
        displayLevels: ["china"],
        supportFactCount: 5,
        colorDomain: "production_supply",
        directed: true,
        involved_varieties: ["e:cmd:rice"],
      }),
    );
  });

  it("/graph/points 在 JSON 请求体中传视角", async () => {
    const result = await getRelationGraphPoints({ view: "hunan" });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/graph/points",
        method: "POST",
        data: { view: "hunan" },
      }),
    );
    expect(relationGraphForView(result).entities[0].viewLevels).toEqual(["china", "hunan"]);
  });

  it("统一信封返回业务错误时拒绝数据", async () => {
    request.mockResolvedValue({ code: 51, message: "无效筛选", data: null });
    await expect(getRelationGraph({})).resolves.toMatchObject({ code: 51 });
    expect(() => relationGraphForView({ code: 51, message: "无效筛选", data: null! })).toThrow("无效筛选");
  });
});

describe("关系详情接口映射", () => {
  const detail = {
    relationId: "r:1",
    overview: {
      source: {
        entityId: "e:1",
        canonicalName: "产区",
        categoryL2: "production_base",
      },
      target: { entityId: "e:2", canonicalName: "市场", categoryL2: "market" },
      typeKey: "transports_to",
    },
    supportFacts: [{ factId: "f1", title: "运输事实", basis: "来源说明" }],
    formation: { firstWrittenAt: "2026-09-21", lastUpdatedAt: "2026-10-09" },
    typeFields: [{ label: "数量", value: "100 吨" }],
  };
  it("将 overview/supportFacts/formation 映射到详情展示字段", async () => {
    request.mockResolvedValue({ code: 0, data: detail });
    const result = await getRelation("r:1");
    expect(result.data).toBe(detail);
    expect(relationDetailForView(result.data)).toMatchObject({
      id: "r:1",
      sourceId: "e:1",
      targetId: "e:2",
      type: "transports_to",
      source: { name: "产区" },
      target: { name: "市场" },
      factIds: ["f1"],
      evidence: [{ factId: "f1", title: "运输事实", excerpt: "来源说明" }],
      createdAt: "2026-09-21",
      updatedAt: "2026-10-09",
      attributes: { 数量: "100 吨" },
    });
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({ url: "/relations/r%3A1" }),
    );
  });
  it("没有支撑事实和形成过程时仍能打开详情", async () => {
    request.mockResolvedValue({
      data: { ...detail, supportFacts: null, formation: null },
    });
    expect(relationDetailForView((await getRelation("r:1")).data)).toMatchObject({
      factIds: [],
      evidence: [],
    });
  });
});
