import { Button, Checkbox, Collapse, Empty, Spin, Switch } from "antd";
import { useQuery } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";
import type { UseQueryResult } from "@tanstack/react-query";
import { useDashboardStore } from "@/store";
import { getFactCount } from "@/api/fact";
import type { FactTaxonomy, FactTaxonomyGroup, GeoPointKind } from "@/api/fact";
import VarietySelect from "@/pages/Dashboard/component/VarietySelect";
import MapControlSettings from "./MapControlSettings";
import FilterBar from "@/components/FilterBar";

const overlays: { label: string; kind: GeoPointKind }[] = [
  { label: "农作物主要产区", kind: "region" },
  { label: "港口", kind: "port" },
  { label: "机场", kind: "airport" },
  { label: "农贸市场", kind: "market" },
  { label: "地缘风险区", kind: "risk" },
];

const FactMenu = ({
  taxonomyQuery,
}: {
  taxonomyQuery: UseQueryResult<FactTaxonomy>;
}) => {
  const { data: count, isPending: countPending } = useQuery({
    queryKey: ["fact", "count"],
    queryFn: async () => (await getFactCount()).data,
    staleTime: 30_000,
    meta: { notifyOnError: true },
  });
  const {
    data: taxonomy,
    isPending: taxonomyPending,
    isSuccess: taxonomySuccess,
  } = taxonomyQuery;
  const { excluded, level, geoKinds, setGeoKinds, setExcluded } =
    useDashboardStore(
      useShallow((s) => ({
        excluded: s.excludedFilterIds.fact,
        level: s.level,
        geoKinds: s.factGeoKinds,
        setGeoKinds: s.setFactGeoKinds,
        setExcluded: s.setExcludedFilterIds,
      })),
    );
  const changeCategory = (key: string) =>
    setExcluded(
      "fact",
      excluded.includes(key)
        ? excluded.filter((id) => id !== key)
        : [...excluded, key],
    );
  const changeGroup = (group: FactTaxonomyGroup, checked: boolean) => {
    const next = new Set(excluded);
    for (const category of group.categories) {
      for (const type of category.types) {
        if (checked) next.delete(type.key);
        else next.add(type.key);
      }
    }
    setExcluded("fact", [...next]);
  };
  const reverseSelection = () => {
    const next = new Set(excluded);
    for (const group of taxonomy?.groups ?? []) {
      for (const category of group.categories) {
        for (const type of category.types) {
          if (next.has(type.key)) next.delete(type.key);
          else next.add(type.key);
        }
      }
    }
    setExcluded("fact", [...next]);
  };

  return (
    <>
      <div className="menu-section">
        <div className="menu-section-title">数据概览</div>
        {countPending ? (
          <Spin size="small" />
        ) : (
          <div className="overview-metrics">
            <div className="overview-metric">
              <span className="overview-count">{count?.total ?? "-"}</span>
              <span>当前事实</span>
            </div>
            <div className="overview-metric">
              <span className="overview-count">{count?.todayAdded ?? "-"}</span>
              <span>今日新增</span>
            </div>
          </div>
        )}
      </div>
      <div className="menu-section">
        <div className="drawer-filter-header">
          <div className="menu-section-title">图层数据分类筛选</div>
          <div className="drawer-filter-actions">
            <Button
              type="link"
              size="small"
              disabled={!taxonomy?.groups.length}
              onClick={() => setExcluded("fact", [])}
            >
              全选
            </Button>
            <Button
              type="link"
              size="small"
              onClick={reverseSelection}
              disabled={!taxonomy?.groups.length}
            >
              反选
            </Button>
          </div>
        </div>
        {taxonomyPending && <Spin size="small" />}
        {taxonomySuccess && taxonomy.groups.length === 0 && (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无分类" />
        )}
        {taxonomySuccess && (
          <Collapse
            ghost
            size="small"
            defaultActiveKey={
              taxonomy.groups[0] ? [taxonomy.groups[0].key] : []
            }
            items={taxonomy.groups.map((section, sectionIndex) => {
              const allSelected = section.categories.every(({ types }) =>
                types.every(({ key }) => !excluded.includes(key)),
              );
              const someSelected = section.categories.some(({ types }) =>
                types.some(({ key }) => !excluded.includes(key)),
              );
              return {
                key: section.key,
                label: (
                  <span
                    className={`filter-section-title filter-section-${["blue", "green", "cyan", "coral"][sectionIndex % 4]}`}
                  >
                    {section.name}
                  </span>
                ),
                extra: (
                  <Checkbox
                    aria-label={`选择${section.name}`}
                    checked={allSelected}
                    indeterminate={someSelected && !allSelected}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) =>
                      changeGroup(section, event.target.checked)
                    }
                  />
                ),
                children: (
                  <div className="filter-section">
                    {section.categories.map((group) => (
                      <div className="drawer-filter-group" key={group.name}>
                        <span className="filter-group-name">{group.name}</span>
                        <div className="drawer-filter-options">
                          {group.types.map(({ key, name, emoji }) => (
                            <Button
                              key={key}
                              size="small"
                              icon={
                                <span role="img" aria-hidden="true">
                                  {emoji}
                                </span>
                              }
                              className={`filter-chip${excluded.includes(key) ? " is-off" : ""}`}
                              aria-pressed={!excluded.includes(key)}
                              title={name}
                              onClick={() => changeCategory(key)}
                            >
                              {name}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ),
              };
            })}
          />
        )}
      </div>
      <div className="menu-section">
        <div className="menu-section-title">品种选择</div>
        <VarietySelect />
      </div>
      <FilterBar />
      <div className="menu-section">
        <div className="menu-section-title">叠加数据图层</div>
        <div className="overlay-options">
          {overlays.map(({ label, kind }) => {
            const unavailable =
              (label === "地缘风险区" && level !== "world") ||
              (label === "港口" && level === "province");
            return (
              <div className="drawer-control-header" key={label}>
                <span>{label}</span>
                <Switch
                  size="small"
                  aria-label={label}
                  disabled={unavailable}
                  checked={!unavailable && geoKinds.includes(kind)}
                  onChange={(checked) =>
                    setGeoKinds(
                      checked
                        ? [...geoKinds, kind]
                        : geoKinds.filter((value) => value !== kind),
                    )
                  }
                />
              </div>
            );
          })}
        </div>
      </div>
      <MapControlSettings />
    </>
  );
};

export default FactMenu;
