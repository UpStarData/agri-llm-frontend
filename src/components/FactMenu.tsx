import { Button, Checkbox, Collapse, Empty, Spin } from "antd";
import { useQuery } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";
import type { UseQueryResult } from "@tanstack/react-query";
import { useDashboardStore } from "@/store";
import { getFactCount } from "@/api/fact";
import type { FactTaxonomy, FactTaxonomyGroup, GeoPointKind } from "@/api/fact";
import VarietySelect from "@/pages/Dashboard/component/VarietySelect";
import FilterBar from "@/components/FilterBar";
import { geoPointIcon } from "@/utils/geoPointIcons";
import { GEO_POINT_KINDS, geoPointKindAvailable } from "@/utils/geoPointKinds";

const overlayLabels: Record<GeoPointKind, string> = {
  region: "农作物主要产区",
  port: "港口",
  airport: "机场",
  market: "农贸市场",
  risk: "地缘风险区",
};

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
  const {
    excluded,
    countryId,
    provinceId,
    geoKinds,
    setGeoKinds,
    setExcluded,
    colorTheme,
  } = useDashboardStore(
    useShallow((s) => ({
      excluded: s.excludedFilterIds.fact,
      countryId: s.factFilters.countryId,
      provinceId: s.factFilters.provinceId,
      geoKinds: s.factGeoKinds,
      setGeoKinds: s.setFactGeoKinds,
      setExcluded: s.setExcludedFilterIds,
      colorTheme: s.colorTheme,
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
        if (checked) next.delete(type.id);
        else next.add(type.id);
      }
    }
    setExcluded("fact", [...next]);
  };
  const reverseSelection = () => {
    const next = new Set(excluded);
    for (const group of taxonomy?.groups ?? []) {
      for (const category of group.categories) {
        for (const type of category.types) {
          if (next.has(type.id)) next.delete(type.id);
          else next.add(type.id);
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
          <div className="menu-section-title">事实分类筛选</div>
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
              taxonomy.groups[0] ? [taxonomy.groups[0].id] : []
            }
            items={taxonomy.groups.map((section, sectionIndex) => {
              const allSelected = section.categories.every(({ types }) =>
                types.every(({ id }) => !excluded.includes(id)),
              );
              const someSelected = section.categories.some(({ types }) =>
                types.some(({ id }) => !excluded.includes(id)),
              );
              return {
                key: section.id,
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
                          {group.types.map(({ id, name, emoji }) => (
                            <Button
                              key={id}
                              size="small"
                              icon={
                                <span role="img" aria-hidden="true">
                                  {emoji}
                                </span>
                              }
                              className={`filter-chip${excluded.includes(id) ? " is-off" : ""}`}
                              aria-pressed={!excluded.includes(id)}
                              title={name}
                              onClick={() => changeCategory(id)}
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
          {GEO_POINT_KINDS.map((kind) => {
            const unavailable = !geoPointKindAvailable(
              kind,
              countryId,
              provinceId,
            );
            const label = overlayLabels[kind];
            return (
              <div className="drawer-control-header" key={kind}>
                <span className={`overlay-label${unavailable ? " is-off" : ""}`}>
                  <img
                    className="overlay-icon"
                    src={geoPointIcon(kind, colorTheme).url}
                    alt=""
                    width={18}
                    height={18}
                  />
                  {label}
                </span>
                <Checkbox
                  aria-label={label}
                  disabled={unavailable}
                  checked={!unavailable && geoKinds.includes(kind)}
                  onChange={(event) =>
                    setGeoKinds(
                      event.target.checked
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
    </>
  );
};

export default FactMenu;
