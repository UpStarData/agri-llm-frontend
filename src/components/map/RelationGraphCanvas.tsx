import { useEffect, useRef } from "react";
import { Empty } from "antd";
import { init, use as registerCharts } from "echarts/core";
import { GraphChart } from "echarts/charts";
import { TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useDashboardStore } from "@/store";
import { relationColor, relationTypeInfo } from "@/utils/relationFilters";
import type { Entity, Relation } from "@/types";
import type { RelationTypeCatalog } from "@/api/relation";

registerCharts([GraphChart, TooltipComponent, CanvasRenderer]);

interface IProps {
  entities: Entity[];
  relations: Relation[];
  relationTypes?: RelationTypeCatalog;
  zoom: number;
}

const RelationGraphCanvas = ({
  entities,
  relations,
  relationTypes,
  zoom,
}: IProps) => {
  const container = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof init> | null>(null);
  const zoomRef = useRef(zoom);
  const select = useDashboardStore((s) => s.select);
  const theme = useDashboardStore((s) => s.colorTheme);
  useEffect(() => {
    if (!container.current || !entities.length) return;
    const chart = init(container.current);
    chartRef.current = chart;
    const ids = new Set(entities.map((entity) => entity.id));
    chart.setOption({
      backgroundColor: "transparent",
      animationDuration: 350,
      tooltip: {
        formatter: (params: { data?: { name?: string } }) =>
          params.data?.name ?? "",
      },
      series: [
        {
          type: "graph",
          layout: "force",
          roam: true,
          zoom: zoomRef.current,
          draggable: true,
          force: { repulsion: 230, edgeLength: [90, 210], gravity: 0.08 },
          label: {
            show: true,
            position: "bottom",
            color: theme === "dark" ? "#d7eeeb" : "#24484d",
            fontSize: 12,
          },
          emphasis: { focus: "adjacency" },
          data: entities.map((entity) => ({
            id: entity.id,
            name: entity.name,
            symbolSize: 16,
            itemStyle: { color: "#efb966" },
          })),
          links: relations
            .filter(
              (relation) =>
                ids.has(relation.sourceId) && ids.has(relation.targetId),
            )
            .map((relation) => ({
              id: relation.id,
              name:
                relationTypeInfo(relation.type, relationTypes)?.name ??
                relation.type,
              source: relation.sourceId,
              target: relation.targetId,
              lineStyle: {
                color: `rgb(${relationColor(relation.type, relationTypes, relation.colorDomain).join(",")})`,
                width:
                  (relation.supportFactCount ?? relation.factIds.length) >= 5
                    ? 3
                    : (relation.supportFactCount ?? relation.factIds.length) >=
                        2
                      ? 2
                      : 1,
                curveness: 0.22,
              },
              symbol:
                (relation.directed ??
                  relationTypeInfo(relation.type, relationTypes)?.directed) ===
                false
                  ? ["none", "none"]
                  : ["none", "arrow"],
              symbolSize: [0, 8],
            })),
        },
      ],
    });
    chart.on("click", (params) => {
      const data = params.data as { id?: string } | undefined;
      if (!data?.id) return;
      if (params.dataType === "node") select({ kind: "entity", id: data.id });
      if (params.dataType === "edge") select({ kind: "relation", id: data.id });
    });
    chart.getZr().on("click", (event) => {
      if (!event.target) select(null);
    });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      chartRef.current = null;
      chart.dispose();
    };
  }, [entities, relations, relationTypes, theme, select]);
  useEffect(() => {
    zoomRef.current = zoom;
    chartRef.current?.setOption({ series: [{ zoom }] });
  }, [zoom]);
  return (
    <div className="relation-graph-canvas" aria-label="关联图谱">
      {entities.length ? (
        <div ref={container} className="relation-graph-chart" />
      ) : (
        <Empty description="暂无关联图谱数据" />
      )}
    </div>
  );
};

export default RelationGraphCanvas;
