import { Select } from "antd";
import { useShallow } from "zustand/react/shallow";
import { useDashboardStore } from "@/store";
import { varietyCommodityIds } from "@/utils/factFilters";
interface IProps {
  multiple?: boolean;
}
const options = Object.keys(varietyCommodityIds).map((value) => ({
  value,
  label: value,
}));
const VarietySelect = ({ multiple = false }: IProps) => {
  const { varieties, setFilters } = useDashboardStore(
    useShallow((s) => ({
      varieties: s.factFilters.varieties,
      setFilters: s.setFactFilters,
    })),
  );
  return (
    <Select<string | string[]>
      mode={multiple ? "multiple" : undefined}
      allowClear
      aria-label="品种筛选"
      placeholder={
        !multiple && varieties.length > 1 ? "请选择一个品种" : "全部品种"
      }
      options={options}
      value={
        multiple ? varieties : varieties.length === 1 ? varieties[0] : undefined
      }
      onChange={(value) =>
        setFilters({
          varieties: Array.isArray(value) ? value : value ? [value] : [],
        })
      }
    />
  );
};
export default VarietySelect;
