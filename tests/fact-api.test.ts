import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CardTypes,
  getCommodities,
  getFactCount,
  getFactDetail,
  getFactPoints,
  getFactTaxonomy,
  getFacts,
  getGeoPoints,
} from "../src/api/fact";
import { request } from "../src/api/request";
import { getFactView } from "../src/utils/factView";

vi.mock("../src/api/request", () => ({ request: vi.fn() }));

describe("事实层接口参数", () => {
  beforeEach(() => vi.mocked(request).mockClear());

  it("区域视角在事实列表和地图星点请求中使用相同的 view", async () => {
    for (const [countryId, provinceId, view] of [
      ["", "", "global"],
      ["CN", "", "china"],
      ["CN", "430000", "hunan"],
      ["CN", "440000", "china"],
    ] as const) {
      const params = { view: getFactView(countryId, provinceId) };
      expect(params.view).toBe(view);
      await getFacts(params);
      expect(request).toHaveBeenLastCalledWith(expect.objectContaining({
        url: "/facts", method: "POST", data: expect.objectContaining({ view }),
      }));
      getFactPoints(params);
      expect(request).toHaveBeenLastCalledWith(expect.objectContaining({
        url: "/facts/points", method: "POST", data: expect.objectContaining({ view }),
      }));
    }
  });

  it("叠加类型以逗号分隔，不选择时省略 kinds", () => {
    getGeoPoints({ view: "china", kinds: ["region", "port", "market"] });
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({
      method: "GET",
      params: { view: "china", kinds: "region,port,market" },
    }));

    getGeoPoints({ view: "global" });
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({
      params: { view: "global" },
    }));
  });

  it("事实列表用 POST body，卡片类型沿用逗号分隔格式", async () => {
    await getFacts({ Page: 2, PageSize: 20, CardTypes: [CardTypes.Market, CardTypes.News] });
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({
      method: "POST",
      data: { page: 2, pageSize: 20, cardTypes: "market,news" },
    }));

    await getFacts();
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({
      data: {},
    }));

    await getFacts({ CardTypes: CardTypes.Video });
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({
      url: "/facts",
      data: { cardTypes: "video" },
    }));
  });

  it("多选品种和完整分类路径通过 body 发送，均为字符串数组", async () => {
    const leafKeys = ["nature|天气|高温", "supply|生产主体|基地投产"];
    const commodityId = ["e:cmd:durian", "e:cmd:cherry"];
    await getFacts({ CommodityId: commodityId, LeafKeys: leafKeys });
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({
      method: "POST",
      data: { commodityId, leafKeys },
    }));
    getFactPoints({ CommodityId: commodityId, LeafKeys: leafKeys });
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({
      url: "/facts/points",
      method: "POST",
      data: { commodityId, leafKeys },
    }));
  });

  it("游标与页码互斥，冲突时不发请求", async () => {
    await expect(getFacts({ After: "2026-09-29T00:00:00Z", Page: 1 }))
      .rejects.toThrow("After 与 Page 不能同时使用");
    expect(request).not.toHaveBeenCalled();
  });

  it("字典、计数、星点与详情使用各自地址且不传取消信号", () => {
    getCommodities();
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({
      url: "/commodities", method: "GET",
    }));
    getFactTaxonomy();
    expect(vi.mocked(request).mock.lastCall?.[0]).not.toHaveProperty("signal");
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({
      url: "/dictionaries/fact-taxonomy", method: "GET",
    }));
    getFactCount();
    expect(vi.mocked(request).mock.lastCall?.[0]).not.toHaveProperty("signal");
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({
      url: "/facts/count", method: "GET",
    }));
    getFactPoints({ Province: "湖南" });
    expect(vi.mocked(request).mock.lastCall?.[0]).not.toHaveProperty("signal");
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({
      url: "/facts/points", method: "POST", data: { province: "湖南" },
    }));
    getFactDetail("a/b");
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({
      url: "/facts/a%2Fb",
    }));
  });
});
