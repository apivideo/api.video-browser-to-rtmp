import { EventEmitter } from 'events';
import { io, Socket } from "socket.io-client";
import { ServerToClientEvents, ClientToServerEvents, ServerError } from "@api.video/browser-to-rtmp-common";

type BrowserToRtmpClientOptions = {
    rtmpUrl: string;
    host: string;
    port: number;
}

const DEFAULT_OPTIONS = {
    port: 3452
}

export class BrowserToRtmpClient extends EventEmitter {
    private socket: Socket<ServerToClientEvents, ClientToServerEvents>;
    private stream: MediaStream;
    private options: BrowserToRtmpClientOptions;
    private mediaRecorder?: MediaRecorder;

    constructor(stream: MediaStream, options: BrowserToRtmpClientOptions) {
        super();
        this.stream = stream;
        this.options = options;
        this.socket = io(`ws://${options.host}:${options.port}`, { reconnectionDelayMax: 10000 });
    }

    start() {
        const conf = {
            audioSampleRate: 48000,
            framerate: 25,
            rtmp: this.options.rtmpUrl,
            audioBitrate: 48000
        };


        this.mediaRecorder = new MediaRecorder(this.stream, {
            audioBitsPerSecond: conf.audioBitrate
        });

        this.socket.emit('start', conf, (res) => console.log(res));
        this.socket.on('error', (err) => this.onSocketError(err));
        this.mediaRecorder.ondataavailable = (data: BlobEvent) => this.onMediaRecorderDataAvailable(data);
        this.mediaRecorder.start(250);
    }

    private onSocketError(err: ServerError) {
        this.emit('error', err);
        if(this.mediaRecorder?.state !== "inactive") {
            this.mediaRecorder?.stop();
        }
    }

    private onMediaRecorderDataAvailable(data: BlobEvent) {
        this.socket.emit('binarystream', data.data, (err) => {
            if(err) {
                this.emit('error', err);
            }
        });
    }
}