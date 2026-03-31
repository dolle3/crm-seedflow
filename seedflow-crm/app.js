import { execSync } from 'child_process'
import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distPath = join(__dirname, '/')
const PORT = process.env.PORT || 3000


const app = express()

app.use(express.static(distPath))

app.get('/{*splat}', (req, res) => {
  res.sendFile(join(distPath, 'index.html'))
})

app.listen('passenger')
