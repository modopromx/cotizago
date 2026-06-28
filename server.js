const express = require('express')
const path = require('path')
const app = express()

const PORT = process.env.PORT || 3000
const DIST = path.join(__dirname, 'dist')

// Servir archivos estáticos del build de Vite
app.use(express.static(DIST))

// SPA routing: cualquier ruta que no sea un archivo → index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(DIST, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`CotizaGo corriendo en puerto ${PORT}`)
})
