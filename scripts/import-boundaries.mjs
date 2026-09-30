import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// 可复现的原型边界迁移。只转换结构，不声称原型坐标已通过测绘精度校验。
const source = resolve(process.argv[2] || '../agri-llm-demo/data')
const target = resolve('public/boundaries')
const worldRaw = await readFile(resolve(source, 'world110.geo.json'), 'utf8')
const chinaRaw = await readFile(resolve(source, 'china.geo.json'), 'utf8')
const world = { type: 'FeatureCollection', features: JSON.parse(worldRaw).map((item) => ({
  type: 'Feature', properties: { name: item.n, regionId: item.iso },
  geometry: { type: typeof item.c[0][0][0] === 'number' ? 'Polygon' : 'MultiPolygon', coordinates: item.c },
})) }
const china = JSON.parse(chinaRaw)
china.features = china.features.map((feature) => ({ ...feature, properties: {
  ...feature.properties, regionId: String(feature.properties.adcode),
} }))
await mkdir(target, { recursive: true })
for (const [name, data] of [['world', world], ['china', china]]) {
  await writeFile(resolve(target, `${name}.geojson`), JSON.stringify(data))
}
await writeFile(resolve(target, 'manifest.json'), JSON.stringify({
  version: 'prototype-v0.8.1', source: 'agri-llm-demo/data',
  status: 'preview-only',
  coordinateNote: '按经度/纬度读取；原型坐标基准、许可和边界完整性需在正式上线前核实。',
  regionLevel: '中国文件只含省级边界；省区视角为聚焦省级面，不含市县边界。',
  files: [
    { path: 'world.geojson', features: world.features.length, sourceSha256: createHash('sha256').update(worldRaw).digest('hex') },
    { path: 'china.geojson', features: china.features.length, sourceSha256: createHash('sha256').update(chinaRaw).digest('hex') },
  ],
}, null, 2) + '\n')
console.log(`Imported ${world.features.length} world features and ${china.features.length} China features`)
