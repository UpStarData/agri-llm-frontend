import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { updateManifest } from './boundary-manifest.mjs'

// Natural Earth 1:50m admin_0_countries：可复现的世界底图来源。
// GitHub 直连在部分网络不可达，按顺序回退到可用镜像。
const MIRRORS = [
  'https://fastly.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_50m_admin_0_countries.geojson',
  'https://gcore.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_50m_admin_0_countries.geojson',
  'https://ghproxy.net/https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson',
]
const VERSION = 'prototype-v0.9.0'

const download = async () => {
  for (const url of MIRRORS) {
    try {
      const response = await fetch(url, { redirect: 'follow' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      console.log(`已下载 ${url}`)
      return { url, source: await response.json() }
    } catch (error) {
      console.warn(`镜像不可用，换下一个：${url}（${error.message}）`)
    }
  }
  throw new Error('所有镜像都不可用，请检查网络后重试')
}

const boundsOf = (coordinates) => {
  const bounds = [Infinity, Infinity, -Infinity, -Infinity]
  const walk = (node) => {
    if (!Array.isArray(node)) return
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      bounds[0] = Math.min(bounds[0], node[0])
      bounds[1] = Math.min(bounds[1], node[1])
      bounds[2] = Math.max(bounds[2], node[0])
      bounds[3] = Math.max(bounds[3], node[1])
      return
    }
    for (const child of node) walk(child)
  }
  walk(coordinates)
  return bounds
}

/** regionId 沿用 ISO 两位码：接口契约与 getRegionFactView 都按 "CN" 判断。 */
const regionIdOf = ({ ISO_A2, ISO_A2_EH, ADM0_A3 }) => {
  for (const code of [ISO_A2, ISO_A2_EH])
    if (code && code !== '-99' && !code.includes('-')) return code
  return ADM0_A3
}

const { url, source } = await download()
const features = source.features.map((feature) => ({
  name: feature.properties.NAME,
  regionId: regionIdOf(feature.properties),
  fallbackRegionId: feature.properties.ADM0_A3,
  geometry: feature.geometry,
  area: (() => {
    const [west, south, east, north] = boundsOf(feature.geometry.coordinates)
    return (east - west) * (north - south)
  })(),
}))

// 同一 regionId 出现多次时（澳洲外岛、台湾归入 CN 之外的领地等），
// 外接矩形最大的保留 ISO 码，其余退回 ADM0_A3：
// 否则 getRegionView 的 find() 会挑到一块小岛，点击澳大利亚就聚焦到一个小岛。
const groups = new Map()
for (const feature of features) {
  const list = groups.get(feature.regionId) ?? []
  list.push(feature)
  groups.set(feature.regionId, list)
}
for (const list of groups.values()) {
  if (list.length < 2) continue
  list.sort((a, b) => b.area - a.area)
  for (const feature of list.slice(1)) feature.regionId = feature.fallbackRegionId
}

const output = {
  type: 'FeatureCollection',
  features: features.map(({ name, regionId, geometry }) => ({
    type: 'Feature',
    properties: { name, regionId },
    geometry,
  })),
}
const target = resolve('public/boundaries/world.geojson')
await mkdir(resolve('public/boundaries'), { recursive: true })
await writeFile(target, JSON.stringify(output))
const entry = await updateManifest({
  file: 'world.geojson',
  source: url,
  license: 'Natural Earth, public domain',
  version: VERSION,
})
console.log(`已写入 ${entry.features} 个要素、${entry.vertices} 个顶点（属性只保留 name / regionId）`)
