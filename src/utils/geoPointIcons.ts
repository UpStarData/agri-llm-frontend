import type { GeoPointKind } from "@/api/fact";
import type { ColorTheme } from "../types";
// ?url&no-inline：图标必须保持独立文件，deck.gl 按 .svg 后缀识别并读取 SVG 源码；
// 不加 no-inline 时 Vite 会把 4KB 以下的资源内联成 data URI。
import airportDark from "@/assets/geo-points/airport-dark.svg?url&no-inline";
import airportLight from "@/assets/geo-points/airport-light.svg?url&no-inline";
import marketDark from "@/assets/geo-points/market-dark.svg?url&no-inline";
import marketLight from "@/assets/geo-points/market-light.svg?url&no-inline";
import portDark from "@/assets/geo-points/port-dark.svg?url&no-inline";
import portLight from "@/assets/geo-points/port-light.svg?url&no-inline";
import regionDark from "@/assets/geo-points/region-dark.svg?url&no-inline";
import regionLight from "@/assets/geo-points/region-light.svg?url&no-inline";
import riskDark from "@/assets/geo-points/risk-dark.svg?url&no-inline";
import riskLight from "@/assets/geo-points/risk-light.svg?url&no-inline";

/**
 * 叠加图层点位图标：48×48 画布上的实心剪影，白色描边 + 与主题对齐的填充色。
 * 图源为 src/assets/geo-points 下的独立 SVG，可直接替换或重绘。
 */
export const GEO_POINT_ICON_SIZE = 48;

export interface GeoPointIcon {
  id: string;
  url: string;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
}

const ICON_URLS: Record<ColorTheme, Record<GeoPointKind, string>> = {
  light: {
    region: regionLight,
    port: portLight,
    airport: airportLight,
    market: marketLight,
    risk: riskLight,
  },
  dark: {
    region: regionDark,
    port: portDark,
    airport: airportDark,
    market: marketDark,
    risk: riskDark,
  },
};

/** 图标对象必须按主题/类型长期复用：IconLayer 自动打包时靠引用与 url 判断是否需要重新加载。 */
const ICON_CACHE = new Map<string, GeoPointIcon>();

export function geoPointIcon(kind: GeoPointKind, theme: ColorTheme): GeoPointIcon {
  const key = `${kind}-${theme}`;
  const cached = ICON_CACHE.get(key);
  if (cached) return cached;
  const icon: GeoPointIcon = {
    id: `geo-point-${key}`,
    url: ICON_URLS[theme][kind],
    width: GEO_POINT_ICON_SIZE,
    height: GEO_POINT_ICON_SIZE,
    anchorX: GEO_POINT_ICON_SIZE / 2,
    anchorY: GEO_POINT_ICON_SIZE / 2,
  };
  ICON_CACHE.set(key, icon);
  return icon;
}
