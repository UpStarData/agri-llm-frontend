import { Skeleton } from "antd";
import type { Mode, StatsData } from "@/types";
import { formatDate } from "@/utils/date";

interface Props {
  data?: StatsData;
  loading: boolean;
  mode: Mode;
}

const AnalyticsPanel = ({ data, loading, mode }: Props) => {
  const count = mode === "fact" ? data?.factCount : data?.entityCount;
  return <div className="overview-summary">
    {loading ? <Skeleton active title paragraph={{ rows: 2 }} /> : <>
      <span className="overview-count">{count ?? "-"}</span>
      <span className="overview-count-label">{mode === "fact" ? "事实条数" : "实体本体"}</span>
      <div className="overview-note">{data
        ? mode === "fact"
          ? `关联 ${data.entityCount ?? "-"} 个实体 · ${data.relationCount ?? "-"} 条关系`
          : `真实关系 ${data.relationCount ?? "-"} 条 · 支撑事实 ${data.factCount ?? "-"} 条`
        : "-"}</div>
      <div className="overview-note">更新时间 {formatDate(data?.updatedAt)}</div>
    </>}
  </div>;
};

export default AnalyticsPanel;
