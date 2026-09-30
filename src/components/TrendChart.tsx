import { useEffect, useRef } from "react";
import { init, use as registerCharts } from "echarts/core";
import { LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { StatsData } from "@/types";

registerCharts([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

interface IProps {
  data: StatsData["trend"];
}

const TrendChart = ({ data }: IProps) => {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const chart = init(element);
    chart.setOption({
      animation: false,
      grid: { left: 36, right: 10, top: 15, bottom: 25 },
      tooltip: { trigger: "axis" },
      xAxis: {
        type: "category",
        data: data.map((row) => row.date),
        axisLabel: { color: "#90aaac" },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        axisLabel: { color: "#90aaac" },
        splitLine: { lineStyle: { color: "#29454a" } },
      },
      series: [
        {
          type: "line",
          data: data.map((row) => row.count),
          showSymbol: false,
          lineStyle: { color: "#66d2c0", width: 2 },
        },
      ],
    });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(element);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [data]);
  return (
    <div
      ref={container}
      className="trend-chart"
      role="img"
      aria-label="真实事实时间分布折线图"
    />
  );
}

export default TrendChart
