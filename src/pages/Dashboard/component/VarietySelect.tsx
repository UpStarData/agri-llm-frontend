import { Select } from "antd";
import { useShallow } from "zustand/react/shallow";
import { useDashboardStore } from "@/store";
import { useCommodities } from "@/hooks";

const VarietySelect = () => {
  const commodities = useCommodities();
  const { varieties, setFilters } = useDashboardStore(
    useShallow((s) => ({
      varieties: s.factFilters.varieties,
      setFilters: s.setFactFilters,
    })),
  );
  return (
    <Select<string[]>
      mode="multiple"
      allowClear
      aria-label="品种筛选"
      loading={commodities.isPending}
      disabled={commodities.isPending || commodities.isError}
      notFoundContent={commodities.isError ? "品种加载失败" : "暂无品种"}
      placeholder="全部品种"
      options={(commodities.data ?? []).map(({ id, name }) => ({ value: id, label: name }))}
      value={varieties}
      onChange={(value) => setFilters({ varieties: value })}
    />
  );
};
export default VarietySelect;
