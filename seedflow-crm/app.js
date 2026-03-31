import { createServer } from 'vite'

const PORT = process.env.PORT || 3000

const server = await createServer({
  server: {
    port: PORT,
    host: '0.0.0.0',
  },
})

await server.listen()
console.log(`Seedflow CRM running on port ${PORT}`)
