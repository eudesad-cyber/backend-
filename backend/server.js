import express from 'express'
import cors from 'cors'
import banco from './banco.js'
 
const app = express()
const PORTA = 3000
 
// Configurações do servidor
app.use(cors()) 
app.use(express.json()) // ensina o servidor a entender dados em formato JSON
 const pessoa = banco
    .prepare('SELECT * FROM usuarios WHERE usuario = ?')
    .get(usuario)
 
  if (!pessoa || !bcrypt.compareSync(senha, pessoa.senha)) {
    return res.status(401).json({ erro: 'Usuário ou senha incorretos.' })
  }
app.listen(PORTA, () => {
  console.log(`Servidor rodando em http://localhost:${PORTA}`)
})