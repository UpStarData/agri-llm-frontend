import { mergeChinaBoundaries } from "../utils/map";
import { request } from "./request";
import type { Boundaries } from "../types";

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
  return scope === "world" ? mergeChinaBoundaries(data) : data;
};
