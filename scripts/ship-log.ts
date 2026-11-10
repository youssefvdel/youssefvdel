/**
 * Refresh the "recently pushed" line in the profile README from the GitHub API.
 * Runs in CI (daily) or locally: bun run scripts/ship-log.ts
 */
import { readFile, writeFile } from 'node:fs/promises'

const USER = 'youssefvdel'
const README = new URL('../README.md', import.meta.url)
const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN

const res = await fetch(`https://api.github.com/users/${USER}/repos?per_page=100&sort=pushed`, {
  headers: {
    accept: 'application/vnd.github+json',
    'user-agent': `${USER}-profile-readme`,
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  },
})
if (!res.ok) {
  console.error(`github api ${res.status}`)
  process.exit(1)
}

type Repo = {
  name: string
  html_url: string
  fork: boolean
  archived: boolean
  pushed_at: string
}

const repos = (await res.json()) as Repo[]
const recent = repos
  .filter((repo) => !repo.fork && !repo.archived)
  .slice(0, 5)
  .map((repo) => {
    const date = new Date(repo.pushed_at).toISOString().slice(0, 10)
    return `[${repo.name}](${repo.html_url}) <sub>${date}</sub>`
  })

const block = `<!-- ship:begin -->\n${recent.join(' · ')}\n<!-- ship:end -->`
const readme = await readFile(README, 'utf8')
if (!readme.includes('<!-- ship:begin -->')) {
  console.error('ship markers missing from README')
  process.exit(1)
}
const next = readme.replace(/<!-- ship:begin -->[\s\S]*?<!-- ship:end -->/, block)
await writeFile(README, next)
console.log(recent.length ? `ship log: ${recent.length} repos` : 'ship log: nothing to show')
