import WebSocket from 'ws'
import Model from '../../src/client/Model'
import WebSocketChannel from '../../src/server/WebSocketChannel'

let index = 1
let source = 'client'
let url = 'ws://localhost:3000'

function createClient () {
  let ws = new WebSocket(url)
  let channel = new WebSocketChannel(ws)
  let model = new Model(channel, source + index)
  index++

  return new Promise((resolve, reject) => {
    channel.once('open', () => {
      resolve(model)
    })
  })
}

export default createClient
