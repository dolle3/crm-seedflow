import { execSync } from 'child_process'
import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distPath = join(__dirname, 'dist')
const PORT = process.env.PORT || 3000


const app = express()

app.use(express.static(distPath))

app.get('/{*splat}', (req, res) => {
  res.sendFile(join(distPath, 'index.html'))
})

if (typeof PhusionPassenger !== 'undefined') {
  app.listen('passenger')
} else {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Seedflow CRM running on port ${PORT}`)
  })
}
