import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { request } from "../src/api/request";
import { commoditiesQueryOptions } from "../src/hooks/useCommodities";

vi.mock("../src/api/request", () => ({ request: vi.fn() }));

describe("品种主数据缓存", () => {
  it("页面内复用同一个查询结果，不重复请求品种接口", async () => {
    const items = [{ id: "e:cmd:durian", name: "榴莲" }];
    vi.mocked(request).mockResolvedValue({ data: { items } });
    const client = new QueryClient();

    expect(await client.fetchQuery(commoditiesQueryOptions)).toEqual(items);
    expect(await client.fetchQuery(commoditiesQueryOptions)).toEqual(items);
    expect(request).toHaveBeenCalledTimes(1);

    client.clear();
  });
});
