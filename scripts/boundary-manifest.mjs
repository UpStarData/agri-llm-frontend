import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const directory = resolve('public/boundaries')
const manifestPath = resolve(directory, 'manifest.json')

const countVertices = (node) => {
  if (!Array.isArray(node)) return 0
  if (typeof node[0] === 'number' && typeof node[1] === 'number') return 1
  return node.reduce((sum, child) => sum + countVertices(child), 0)
}

/**
 * 只重算被改写的那个文件，其余条目原样保留：
 * 世界与中国分别由 import:world 和 import:boundaries 生成，不能互相覆盖。
 */
export async function updateManifest({ file, source, license, version }) {
  const raw = await readFile(resolve(directory, file), 'utf8')
  const data = JSON.parse(raw)
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const entry = {
    path: file,
    features: data.features.length,
    vertices: data.features.reduce(
      (sum, feature) => sum + countVertices(feature.geometry.coordinates),
      0,
    ),
    source,
    sha256: createHash('sha256').update(raw).digest('hex'),
    ...(license ? { license } : {}),
  }
  const files = [...manifest.files.filter((item) => item.path !== file), entry].sort((a, b) =>
    a.path.localeCompare(b.path),
  )
  await writeFile(
    manifestPath,
    `${JSON.stringify({ ...manifest, ...(version ? { version } : {}), files }, null, 2)}\n`,
  )
  return entry
}
