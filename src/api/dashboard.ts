import { request } from "./request";
import type {
  Boundaries,
  MapData,
  MapQueryContext,
  QueryContext,
  StatsData,
} from "../types";

export const getBoundaries = async (
  scope: "world" | "china",
): Promise<Boundaries> => {
  const data = await request<Boundaries>({
    url: `boundaries/${scope}.geojson`,
    method: "GET",
    baseURL: import.meta.env.BASE_URL,
    errorPresentation: "local",
  });
  if (data.type !== "FeatureCollection" || !Array.isArray(data.features))
    throw new Error("边界文件格式不正确");
  return data;
};

export const queryMap = (data: MapQueryContext) =>
  request<MapData>({ url: "/map/query", method: "POST", data });

export const queryStats = (data: QueryContext) =>
  request<StatsData>({ url: "/stats/query", method: "POST", data });
