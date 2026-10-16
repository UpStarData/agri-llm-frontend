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

/**
 * 图标文件缓存。deck.gl 用 loaders.gl 按 URL 取图标，本地资源同样会走一次 fetch：
 * 新增一种叠加类型、切换 2D/3D 重建 DeckGL 时都要重新打包图标，不缓存就会重复下载同一个文件。
 * 注意 fetch 只能挂在 loadOptions 顶层，loaders.gl 只在这一层读取它；
 * 解析器仍按原始 .svg 地址识别 SVG，所以这里只换数据来源，不改 url。
 */
const ICON_SOURCES = new Map<string, Promise<ArrayBuffer>>();

const loadIconSource = (url: string) => {
  const cached = ICON_SOURCES.get(url);
  if (cached) return cached;
  const pending = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`图标加载失败（${response.status}）`);
      return response.arrayBuffer();
    })
    .catch((error: unknown) => {
      // 失败不留缓存，下一次打包还有重新加载的机会。
      ICON_SOURCES.delete(url);
      throw error;
    });
  ICON_SOURCES.set(url, pending);
  return pending;
};

/** 供 IconLayer 的 loadOptions 使用：同一地址整场会话只下载一次。 */
export const cachedSvgFetch: typeof fetch = async (input) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  const response = new Response(await loadIconSource(url), {
    headers: { "Content-Type": "image/svg+xml" },
  });
  // loaders.gl 只看 Response.url 的后缀决定是否按 SVG 源码解码（见 getBlobOrSVGDataUrl），
  // 构造出来的响应 url 为空，会被当成没有类型的位图、图标直接不显示，这里补回原始地址。
  Object.defineProperty(response, "url", { value: url });
  return response;
};
