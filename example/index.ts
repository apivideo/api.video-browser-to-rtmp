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


const sioServer = http.createServer();
const aa = new BrowserToRtmpServer(sioServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    }
});

setInterval(() => console.log(aa.getConnections()), 2000);

sioServer.listen(1234);
