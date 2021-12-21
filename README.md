[![badge](https://img.shields.io/twitter/follow/api_video?style=social)](https://twitter.com/intent/follow?screen_name=api_video) &nbsp; [![badge](https://img.shields.io/github/stars/apivideo/api.video-browser-to-rtmp?style=social)](https://github.com/apivideo/api.video-browser-to-rtmp) &nbsp; [![badge](https://img.shields.io/discourse/topics?server=https%3A%2F%2Fcommunity.api.video)](https://community.api.video)
![](https://github.com/apivideo/API_OAS_file/blob/master/apivideo_banner.png)
<h1 align="center">api.video browser to RTMP</h1>

**@api.video/browser-to-rtmp-server** ![npm](https://img.shields.io/npm/v/@api.video/@api.video/browser-to-rtmp-server) ![ts](https://badgen.net/badge/-/TypeScript/blue?icon=typescript&label)

**@api.video/browser-to-rtmp-client** ![npm](https://img.shields.io/npm/v/@api.video/@api.video/browser-to-rtmp-client) ![ts](https://badgen.net/badge/-/TypeScript/blue?icon=typescript&label)


[api.video](https://api.video) is the video infrastructure for product builders. Lightning fast video APIs for integrating, scaling, and managing on-demand & low latency live streaming features in your app.


# Table of contents
- [Table of contents](#table-of-contents)
- [Project description](#project-description)
- [Getting started](#getting-started)
  - [Server-side part](#server-side-part)
  - [Client-side part](#client-side-part)
- [Documentation](#documentation)
  - [How it works](#how-it-works)
  - [The server part](#the-server-part)
    - [Instanciation](#instanciation)
    - [Options](#options)
    - [Security notes](#security-notes)
  - [The client part](#the-client-part)
    - [Instanciation](#instanciation-1)
    - [Options](#options-1)
  
# Project description

This project aims to make easy streaming a video from your browser to a RTMP server. Any MediaSource can be used (webcam, screencast, …). 

The project is composed of three npm workspaces:
- [server](https://github.com/apivideo/api.video-browser-to-rtmp/tree/main/src/server) (npm package: **@api.video/browser-to-rtmp-server**): typescript package to include in a nodejs application that uses ffmpeg in order to stream to a RTMP server
- [client](https://github.com/apivideo/api.video-browser-to-rtmp/tree/main/src/client) (npm package: **@api.video/browser-to-rtmp-client**): JS library to include in a website that will stream a MediaSource to the server using socket.io
- [example](https://github.com/apivideo/api.video-browser-to-rtmp/tree/main/src/example): a very simple sample app to demonstrate how to use the server & the client


# Getting started

## Server-side part

First make sure that `ffmpeg`is properly installed on your server. 

Then add the dependancy to your nodejs project: 
```
npm install --save @api.video/browser-to-rtmp-server
```

You can finally instanciate the server:

```typescript
import http from 'http';
import BrowserToRtmpServer from '@api.video/browser-to-rtmp-server';

// ...


const server = http.createServer();
const browserToRtmpClient = new BrowserToRtmpServer(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    }
});
server.listen(1234);

```

## Client-side part

```html
<html>
    <head>
        ...
        <script src="https://unpkg.com/@api.video/browser-to-rtmp-client" defer></script>
    </head>
    <body>
        <script>
            navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true
            }).then((stream) => {
                const client = new BrowserToRtmpClient(stream, {
                    host: "localhost", 
                    rtmpUrl: "rtmp://0.0.0.0:1935/s/abcd", // RTMP endpoint
                    port: 1234
                });

                client.start();
            });
        </script>
    </body>
</html>
```


# Documentation

## How it works

## The server part

### Instanciation

TODO

### Options 

TODO

### Security notes

TODO

## The client part


### Instanciation

TODO

### Options 

TODO
