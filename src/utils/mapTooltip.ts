import { ECOLOGY_THEME as eco } from "./ecologyTheme";
import type { ColorTheme } from "@/types";
import type { PickingInfo } from "@deck.gl/core";
import type { FactPoint } from "@/api/fact";
import { formatDate } from "./date";
const regionNames = new Intl.DisplayNames(["zh-CN"], { type: "region" });

export function getMapTooltip(info: PickingInfo, colorTheme: ColorTheme = "dark") {
  const { object, layer } = info;
  if (!object || !layer) return null;
  let text: string | undefined;
  if (layer.id === "real-facts") {
    const point = object as FactPoint;
    text = `${point.title || point.factId}\n时间：${formatDate(point.occurredAt)}`;
  } else if (
    layer.id.startsWith("world-boundaries") ||
    layer.id.startsWith("china-boundaries")
  ) {
    const { name, regionId } = object.properties ?? {};
    const translated =
      layer.id.startsWith("world-boundaries") &&
      /^[A-Z]{2}$/.test(regionId ?? "")
        ? regionNames.of(regionId)
        : undefined;
    text = translated && translated !== regionId ? translated : name;
  } else {
    text = object.name || object.type;
  }
  return text
    ? {
        text,
        style: {
          zIndex: "6",
          marginLeft: "12px",
          marginTop: "12px",
          maxWidth: "280px",
          whiteSpace: "pre-line",
          border: "1px solid rgba(129, 194, 196, 0.4)",
          borderRadius: "4px",
          backgroundColor: "rgba(15, 28, 34, 0.94)",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3)",
          color: "#f0f8f8",
          ...(colorTheme === "light" ? { border: `1px solid ${eco.border}`, backgroundColor: eco.panel, color: eco.text, boxShadow: eco.shadow } : {}),
          fontSize: "12px",
          lineHeight: "1.5",
        },
      }
    : null;
}
