import fs from 'fs'

const patterns = [/EXPO_PUBLIC_.*API_KEY/, /EXPO_PUBLIC_.*SECRET/, /EXPO_PUBLIC_.*PRIVATE/]

function check(file: string) {
  if (!fs.existsSync(file)) return
  const content = fs.readFileSync(file, 'utf-8')
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    for (const p of patterns) {
      if (p.test(lines[i])) {
        console.error(`Exposed secret in ${file}:${i + 1}`)
        console.error(lines[i])
        process.exit(1)
      }
    }
  }
}

check('.env')
check('.env.example')
console.log('No exposed secrets found')