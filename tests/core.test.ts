import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import dayjs from 'dayjs'
import { WebMercatorViewport } from '@deck.gl/core'
import { createRelationLayers as buildRelationLayers, prepareRelationPaths, createRelationFlowLayer } from "../src/utils/relationLayers"
import { createMapLayers, createInfluenceLayers } from '../src/utils/mapLayers'
import { useDashboardStore } from '../src/store'
import { dateRangeToUtc } from '../src/utils/date'
import { FLAT_WORLD_BOUNDS, flattenWorldBoundaries, flattenWorldPosition, getFlatLongitudeLimits, getRegionView, getWheelZoomStep, getWorldZoom, isWorldOverviewZoom, MAP_ZOOM_STEP } from '../src/utils/map'
import type { Boundaries, MapData } from '../src/types'

function createRelationLayers(options: Omit<Parameters<typeof buildRelationLayers>[0], "paths"> & { phase: number }) {
  const layers = buildRelationLayers({ ...options, paths: prepareRelationPaths(options.entities, options.relations, options.isGlobe, options.flatWorld) });
  return [...layers, createRelationFlowLayer(layers, options.phase)];
}

describe('业务数据与地图交互边界', () => {
  beforeEach(() => useDashboardStore.setState(useDashboardStore.getInitialState(), true))
  it('默认全球与近一月，区域筛选同步地图视角并清理旧详情', () => {
    const initial = useDashboardStore.getState()
    expect(initial.factFilters.countryId).toBe('')
    expect(initial.factFilters.provinceId).toBe('')
    expect(initial.level).toBe('world')
    expect(initial.regionId).toBeUndefined()
    expect(dayjs(initial.dateRange[1]).diff(dayjs(initial.dateRange[0]), 'day')).toBe(29)
    initial.setFactRegion('CN', '430000')
    expect(useDashboardStore.getState()).toMatchObject({ level: 'province', regionId: '430000' })
    useDashboardStore.getState().select({ kind: 'fact', id: 'f-1' })
    useDashboardStore.getState().setFactRegion('CN')
    expect(useDashboardStore.getState().factFilters).toMatchObject({ countryId: 'CN', provinceId: '' })
    expect(useDashboardStore.getState()).toMatchObject({ level: 'country', regionId: 'CN' })
    expect(useDashboardStore.getState().detailsOpen).toBe(false)
    useDashboardStore.getState().setFactRegion('')
    expect(useDashboardStore.getState()).toMatchObject({ level: 'world', regionId: undefined })
  })
  it('视频按钮状态默认关闭，切换后只启用视频筛选', () => {
    const store = useDashboardStore.getState()
    expect(store.factFilters.videoOnly).toBe(false)
    store.setFactFilters({ videoOnly: true })
    expect(useDashboardStore.getState().factFilters.videoOnly).toBe(true)
    store.setFactFilters({ videoOnly: false })
    expect(useDashboardStore.getState().factFilters.videoOnly).toBe(false)
  })
  it('事实/关联模式分别保留区域和详情，切回事实恢复原状态', () => {
    const store = useDashboardStore.getState()
    store.setRegion('province', '430000')
    store.select({ kind: 'fact', id: 'f-1' })
    const before = useDashboardStore.getState()
    store.setMode('relation')
    expect(useDashboardStore.getState()).toMatchObject({ level: 'world', regionId: undefined, selection: null, detailsOpen: false })
    store.setRegion('country', 'CN')
    store.select({ kind: 'entity', id: 'e-1' })
    store.setMode('fact')
    expect(useDashboardStore.getState()).toMatchObject({ level: 'province', regionId: '430000', selection: before.selection, detailsOpen: true })
    expect(useDashboardStore.getState().dateRange).toEqual(before.dateRange)
    store.setMode('relation')
    expect(useDashboardStore.getState()).toMatchObject({ level: 'country', regionId: 'CN', selection: { kind: 'entity', id: 'e-1' } })
  })
  it('空间或时间筛选变化清理过期详情', () => {
    useDashboardStore.getState().select({ kind: 'fact', id: 'f-1' })
    useDashboardStore.getState().setRegion('country')
    expect(useDashboardStore.getState().selection).toBeNull()
    expect(useDashboardStore.getState().detailsOpen).toBe(false)
  })
  it('左右抽屉按图层分别记忆展开状态', () => {
    const store = useDashboardStore.getState()
    store.setDrawerOpen('fact', 'left', false)
    store.setMode('relation')
    expect(useDashboardStore.getState().drawerOpen.relation.left).toBe(true)
    store.setDrawerOpen('relation', 'right', false)
    expect(useDashboardStore.getState().drawerOpen.fact.right).toBe(true)

  })
  it('筛选状态按模式独立保存，并清理已打开的旧详情', () => {
    const store = useDashboardStore.getState()
    store.select({ kind: 'fact', id: 'f-1' })
    store.setExcludedFilterIds('fact', ['tag:高温'])
    expect(useDashboardStore.getState().excludedFilterIds.fact).toEqual(['tag:高温'])
    expect(useDashboardStore.getState().excludedFilterIds.relation).toEqual([])
    expect(useDashboardStore.getState().selection).toBeNull()
    expect(useDashboardStore.getState().detailsOpen).toBe(false)
  })
  it('港口、事实源和影响力仅绘制接口返回的数据', () => {
    const data: MapData = { datasetVersion: 'test', facts: [], entities: [], relations: [], truncated: false,
      overlays: {
        ports: [{ id: 'p-1', name: '测试港口', position: [112, 28] }],
        factSources: [{ id: 's-1', name: '测试来源', position: [113, 29] }],
        influence: [{ id: 'i-1', name: '测试影响', position: [114, 30] }],
      },
    }
    const layers = createMapLayers({ mode: 'fact', colorTheme: 'dark', level: 'world', data,
      overlayVisibility: { ports: true, factSources: true, influence: true },
      select() {}, selectProvince() {} })
    expect(layers.find((layer) => layer.id === 'overlay-ports')?.props.data).toBe(data.overlays?.ports)
    expect(layers.find((layer) => layer.id === 'overlay-fact-sources')?.props.data).toBe(data.overlays?.factSources)
    const rings = createInfluenceLayers([], 0.5, false)
    expect(rings).toHaveLength(7)
    expect(rings[0].props.pickable).toBe(false)
    expect(rings[0].props.data).toEqual([])
  })
  it('没有文字叠加数据时不创建字体纹理图层', () => {
    const layers = createMapLayers({ mode: 'fact', colorTheme: 'dark', level: 'world',
      select() {}, selectProvince() {} })
    expect(layers.some((layer) => layer.id === 'overlay-port-labels' || layer.id === 'overlay-source-labels')).toBe(false)
  })
  it('无坐标实体不伪造位置，其关系不强行上图；数据本体仍保留', () => {
    const data: MapData = { datasetVersion: 'test', facts: [], truncated: false,
      entities: [{ id: 'a', name: 'a', type: 'test', position: [112, 28], factIds: [] },
        { id: 'b', name: 'b', type: 'test', position: null, factIds: [] }],
      relations: [{ id: 'ab', sourceId: 'a', targetId: 'b', type: 'test', factIds: [] }],
    }
    const layers = createRelationLayers({ entities: data.entities, relations: data.relations, flatWorld: false, isGlobe: false, longitude: 105, latitude: 35, phase: 0.5, highlightedEntityId: null, select() {} })
    expect(layers.find((l) => l.id === 'real-relations')?.props.data).toEqual([])
    expect(data.entities).toHaveLength(2)
    expect(data.relations).toHaveLength(1)
  })
  it('日期筛选统一为上海时区的 UTC 半开区间', () => {
    expect(dateRangeToUtc('2026-09-01', '2026-09-01')).toEqual({
      field: 'eventTime', from: '2026-08-31T16:00:00.000Z', to: '2026-09-01T16:00:00.000Z',
    })
  })
  it('边界规范化后支持世界、中国和湖南视角', () => {
    const world = JSON.parse(readFileSync('public/boundaries/world.geojson', 'utf8')) as Boundaries
    const china = JSON.parse(readFileSync('public/boundaries/china.geojson', 'utf8')) as Boundaries
    expect(world.type).toBe('FeatureCollection')
    expect(world.features.length).toBeGreaterThan(100)
    expect(china.features.some((f) => f.properties.regionId === '430000')).toBe(true)
    const camera = getRegionView('province', '430000', china, 1440, 900)
    expect(camera.longitude).toBeGreaterThan(108)
    expect(camera.longitude).toBeLessThan(115)
    expect(camera.zoom).toBeGreaterThan(getRegionView('country', undefined, china, 1440, 900).zoom)
  })
  it('平面世界视角在宽屏和矮屏中按比例适配宽高', () => {
    for (const [width, height] of [[1440, 900], [1920, 680], [900, 700]]) {
      const view = getRegionView('world', undefined, undefined, width, height)
      expect(view.longitude).toBeCloseTo(105)
      const viewport = new WebMercatorViewport({ width, height, ...view })
      const topLeft = viewport.project(flattenWorldPosition([FLAT_WORLD_BOUNDS[0][0], FLAT_WORLD_BOUNDS[1][1]]))
      const bottomRight = viewport.project(flattenWorldPosition([FLAT_WORLD_BOUNDS[1][0], FLAT_WORLD_BOUNDS[0][1]]))
      expect(topLeft[0]).toBeGreaterThanOrEqual(31)
      expect(topLeft[1]).toBeGreaterThanOrEqual(31)
      expect(bottomRight[0]).toBeLessThanOrEqual(width - 31)
      expect(bottomRight[1]).toBeLessThanOrEqual(height - 31)
      expect(view.minZoom).toBe(getWorldZoom(width, height))
      const limits = getFlatLongitudeLimits(width, view.zoom)
      expect(limits.min).toBeCloseTo(-limits.max)
    }
  })
  it('全球视角点击各国边界时定位对应国家', () => {
    const selected: string[] = []
    const layers = createMapLayers({ mode: 'fact', colorTheme: 'dark', level: 'world',
      select() {}, selectCountry: (id) => selected.push(id), selectProvince() {} })
    const worldLayer = layers.find((layer) => layer.id === 'world-boundaries')!
    worldLayer.onClick({ object: { properties: { regionId: 'US' } } } as never, {} as never)
    worldLayer.onClick({ object: { properties: { regionId: 'CN' } } } as never, {} as never)
    expect(selected).toEqual(['US', 'CN'])
  })
  it('全球平面图保留原始纬度与边界比例', () => {
    const world = JSON.parse(readFileSync('public/boundaries/world.geojson', 'utf8')) as Boundaries
    const flat = flattenWorldBoundaries(world)
    expect(flat.features[0].geometry.coordinates).toEqual(world.features[0].geometry.coordinates)
    expect(flat.features.some((feature) => feature.properties.name === 'Antarctica')).toBe(false)
    expect(world.features.some((feature) => feature.properties.name === 'Antarctica')).toBe(true)
    expect(world.features[0].geometry).toEqual(JSON.parse(readFileSync('public/boundaries/world.geojson', 'utf8')).features[0].geometry)
    expect(flattenWorldPosition([0, 80])).toEqual([0, 80])
    expect(flattenWorldPosition([0, 0])).toEqual([0, 0])
  })
  it('滚轮单格与按钮使用相同步长', () => {
    expect(getWheelZoomStep(100)).toBeCloseTo(MAP_ZOOM_STEP)
    expect(getWheelZoomStep(-100)).toBeCloseTo(-MAP_ZOOM_STEP)
  })
  it('中国和省区缩到全景时切换全球视角', () => {
    const overview = getWorldZoom(1440, 900)
    expect(isWorldOverviewZoom('country', overview, 1440, 900)).toBe(true)
    expect(isWorldOverviewZoom('province', overview, 1440, 900)).toBe(true)
    expect(isWorldOverviewZoom('country', overview + 0.1, 1440, 900)).toBe(false)
    expect(isWorldOverviewZoom('world', overview, 1440, 900)).toBe(false)
  })
})
