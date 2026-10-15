import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { updateManifest } from './boundary-manifest.mjs'

// 中国省级边界来自高德 DataV（adcode 与省份下拉、CN-XX 接口映射绑定），
// 只转换结构，不声称原型坐标已通过测绘精度校验。
// 世界边界改由 `npm run import:world` 从 Natural Earth 1:50m 生成，
// 这里不再写 world.geojson，避免 110m 的旧数据覆盖新底图。
const source = resolve(process.argv[2] || '../agri-llm-demo/data')
const chinaRaw = await readFile(resolve(source, 'china.geo.json'), 'utf8')
const china = JSON.parse(chinaRaw)
china.features = china.features.map((feature) => ({
  ...feature,
  properties: { ...feature.properties, regionId: String(feature.properties.adcode) },
}))
await mkdir(resolve('public/boundaries'), { recursive: true })
await writeFile(resolve('public/boundaries/china.geojson'), JSON.stringify(china))
const entry = await updateManifest({
  file: 'china.geojson',
  source: 'agri-llm-demo/data/china.geo.json（高德 DataV 省级边界）',
})
console.log(`Imported ${entry.features} China features with ${entry.vertices} vertices`)
