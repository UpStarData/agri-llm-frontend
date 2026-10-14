import { GeoJsonLayer } from "@deck.gl/layers";
import type { FeatureCollection, Polygon } from "geojson";
import type { ColorTheme } from "@/types";
import { ECOLOGY_THEME as eco, rgb } from "./ecologyTheme";

// 经纬网格避免单个覆盖全球的多边形跨日期线、极点产生错误三角剖分。
const surface: FeatureCollection<Polygon> = {
  type: "FeatureCollection",
  features: Array.from({ length: 18 * 36 }, (_, index) => {
    const lng = (index % 36) * 10 - 180;
    const lat = Math.floor(index / 36) * 10 - 90;
    return {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [[[lng, lat], [lng + 10, lat], [lng + 10, lat + 10], [lng, lat + 10], [lng, lat]]],
      },
    };
  }),
};

/** 海洋参与深度测试，遮挡球体背面的节点、关系和流光。 */
export function createGlobeSurface(theme: ColorTheme) {
  return new GeoJsonLayer({
    id: "globe-ocean-surface",
    data: surface,
    pickable: false,
    filled: true,
    stroked: false,
    getFillColor: theme === "light" ? [...rgb(eco.ocean), 255] : [27, 41, 64, 255],
    parameters: { depthWriteEnabled: true, depthCompare: "less-equal", cullMode: "none" },
  });
}
