import http from 'http';
import BrowserToRtmpServer from '@api.video/browser-to-rtmp-server';
import express from 'express';

const app = express()
const port = 3000

app.use(express.static('public'));
app.use('/static', express.static('../client/dist'));


app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})


const server = http.createServer();
const browserToRtmpServer = new BrowserToRtmpServer(server, {
  clientLogs: {
    sendFfmpegOutput: false,
    sendErrorDetails: true
  },
  rtmpUrlRegexp: /.*/,
  maxFfmpegInstances: 1,
  socketio: {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true
    },
  },
  hooks: {
    start: (socket, config) => {
      // for instance, do wathever you want retrieving the current request auth token: 
      // const token = socket.handshake.auth.token;
      // ...
      // const rtmpEndpoint = ... // generate the RTMP endpoint url according to your need:
      return {
        ...config,
        //rtmp: rtmpEndpoint
      }
    }
  }
});

browserToRtmpServer.on("ffmpegOutput", (uuid, e) => console.log(`${uuid} => ${JSON.stringify(e)}`));
browserToRtmpServer.on("error", (uuid, e) => console.log(`${uuid} => ${JSON.stringify(e)}`));
browserToRtmpServer.on("connection", (c) => console.log("New connection", c));


setInterval(() => console.log(browserToRtmpServer.getConnections()), 5000);

server.listen(1234);
