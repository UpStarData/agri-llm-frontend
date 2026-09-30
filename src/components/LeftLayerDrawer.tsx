import { Button, Checkbox } from "antd";
import { DoubleLeftOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import { useShallow } from "zustand/react/shallow";
import FactMenu from "./FactMenu";
import FilterBar from "@/components/FilterBar";
import AnalyticsPanel from "@/components/AnalyticsPanel";
import { useDashboardStore } from "@/store";
import type { StatsData } from "@/types";
import type { UseQueryResult } from "@tanstack/react-query";
import type { FactTaxonomy } from "@/api/fact";

const LeftLayerDrawer = ({ stats, taxonomyQuery }: {
  stats?: StatsData;
  taxonomyQuery: UseQueryResult<FactTaxonomy>;
}) => {
  const { mode, open, togglePanel, excluded, setExcluded } = useDashboardStore(
    useShallow((s) => ({
      mode: s.mode,
      open: s.drawerOpen[s.mode].left,
      togglePanel: s.togglePanel,
      excluded: s.excludedFilterIds.relation,
      setExcluded: s.setExcludedFilterIds,
    })),
  );
  return (
    <>
      {!open && (
        <Button
          className="panel-trigger panel-trigger-left"
          type="text"
          icon={<MenuUnfoldOutlined />}
          aria-label="展开数据概览"
          aria-expanded={false}
          aria-controls="layer-menu"
          onClick={() => togglePanel("left")}
        >
          左侧菜单
        </Button>
      )}
      <div
        hidden={!open}
        id="layer-menu"
        className="layer-drawer layer-drawer-left"
        role="region"
        aria-label="左侧菜单"
      >
        <div className="layer-drawer-header">
          <Button
            type="text"
            shape="circle"
            aria-label="收起数据概览"
            icon={<DoubleLeftOutlined />}
            onClick={() => togglePanel("left")}
          />
        </div>
        <div className="layer-drawer-content">
          {mode === "fact" ? (
            <FactMenu taxonomyQuery={taxonomyQuery} />
          ) : (
            <>
              <AnalyticsPanel data={stats} loading={false} mode={mode} />
              <FilterBar />
              <div className="menu-section">
                <div className="menu-section-title">关联对象</div>
                {[
                  { value: "kind:entity", label: "实体本体" },
                  { value: "kind:relation", label: "真实关系" },
                ].map(({ value, label }) => (
                  <Checkbox
                    key={value}
                    checked={!excluded.includes(value)}
                    onChange={(event) =>
                      setExcluded(
                        "relation",
                        event.target.checked
                          ? excluded.filter((id) => id !== value)
                          : [...excluded, value],
                      )
                    }
                  >
                    {label}
                  </Checkbox>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default LeftLayerDrawer;
