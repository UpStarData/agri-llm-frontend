import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GEO_POINT_ICON_SIZE, geoPointIcon } from "../src/utils/geoPointIcons";
import type { GeoPointKind } from "../src/api/fact";
import type { ColorTheme } from "../src/types";

const KINDS: GeoPointKind[] = ["region", "port", "airport", "market", "risk"];
const THEMES: ColorTheme[] = ["light", "dark"];

const sourceOf = (kind: GeoPointKind, theme: ColorTheme) =>
  readFileSync(`src/assets/geo-points/${kind}-${theme}.svg`, "utf8");

/** 只取几何属性，用来确认同一类型的亮/暗两版图形完全一致，差异仅在配色。 */
const geometryOf = (svg: string) =>
  [...svg.matchAll(/\s(?:d|cx|cy|r|rx|ry|x|y|width|height)="[^"]*"/g)].map((match) => match[0]);

const fillsOf = (svg: string) => [...svg.matchAll(/<g fill="([^"]+)"/g)].map((match) => match[1]);

describe("叠加图层点位图标", () => {
  it("每个类型与主题都指向 assets 下同名的 SVG 文件，而不是内联的 data URI", () => {
    const urls = new Set<string>();
    for (const theme of THEMES)
      for (const kind of KINDS) {
        const icon = geoPointIcon(kind, theme);
        // deck.gl 的 SVG 识别依赖 .svg 后缀（可带查询串或 hash），内联后会被当成普通位图。
        expect(icon.url).toMatch(new RegExp(`${kind}-${theme}\\.svg([?#].*)?$`));
        urls.add(icon.url);
      }
    expect(urls.size).toBe(KINDS.length * THEMES.length);
  });

  it.each(THEMES)("%s 主题的图标画布为 48×48 并按中心锚定", (theme) => {
    for (const kind of KINDS) {
      expect(geoPointIcon(kind, theme)).toMatchObject({
        width: GEO_POINT_ICON_SIZE,
        height: GEO_POINT_ICON_SIZE,
        anchorX: GEO_POINT_ICON_SIZE / 2,
        anchorY: GEO_POINT_ICON_SIZE / 2,
      });
      const svg = sourceOf(kind, theme);
      expect(svg).toContain(`viewBox="0 0 48 48"`);
      expect(svg).toContain(`width="48" height="48"`);
    }
  });

  it("每个 SVG 都有白色描边层与主题色填充层", () => {
    for (const theme of THEMES)
      for (const kind of KINDS) {
        const [halo, ink] = fillsOf(sourceOf(kind, theme));
        expect(halo).toBe("#fff");
        expect(ink).toMatch(/^#[0-9A-F]{6}$/i);
        expect(ink).not.toBe("#fff");
        expect(sourceOf(kind, theme)).toContain('stroke="#fff"');
      }
  });

  it("同一类型的亮/暗两版只有配色不同，几何保持一致", () => {
    for (const kind of KINDS) {
      const light = sourceOf(kind, "light");
      const dark = sourceOf(kind, "dark");
      expect(geometryOf(dark)).toEqual(geometryOf(light));
      expect(geometryOf(light).length).toBeGreaterThan(2);
      expect(fillsOf(light)).not.toEqual(fillsOf(dark));
    }
  });

  it("同一类型同一主题复用同一个对象，避免 IconLayer 自动打包反复重载", () => {
    for (const kind of KINDS) {
      expect(geoPointIcon(kind, "dark")).toBe(geoPointIcon(kind, "dark"));
    }
  });
});
