import { EventEmitter } from 'events';
import { io, Socket } from "socket.io-client";
import TypedEmitter from "typed-emitter";
import { ServerToClientEvents, ClientToServerEvents, ServerError, FfmpegConfig } from "./types"

type BrowserToRtmpClientOptions = {
    host: string;
    port?: number;
} & FfmpegConfig;

const DEFAULT_OPTIONS = {
    port: 8086,
    audioBitsPerSecond: 128000,
    videoBitsPerSecond: 2500000,
    framerate: 25
}

export type BrowserToRtmpClientEvents = {
    error: (error: ServerError) => void;
    destroyed: () => void;
    ffmpegOutput: (message: string) => void;
}

export class BrowserToRtmpClient extends (EventEmitter as new () => TypedEmitter<BrowserToRtmpClientEvents>) {
    private socket: Socket<ServerToClientEvents, ClientToServerEvents>;
    private stream: MediaStream;
    private options: BrowserToRtmpClientOptions;
    private mediaRecorder?: MediaRecorder;

    constructor(stream: MediaStream, options: BrowserToRtmpClientOptions) {
        super();
        this.stream = stream;
        this.options = {
            ...DEFAULT_OPTIONS,
            ...options
        };
        if (!this.options.audioSampleRate) {
            this.options.audioSampleRate = Math.round(this.options.audioBitsPerSecond! / 4)
        }
        if (!options.host) {
            throw new Error("Missing required 'host' value");
        }
        this.socket = io(`ws://${options.host}:${options.port}`, { reconnectionDelayMax: 10000 });

        this.socket.on('error', (err: ServerError) => this.onRemoteError(err));
        this.socket.on('ffmpegOutput', (msg: string) => this.emit('ffmpegOutput', msg));
    }

    start(): Promise<void> {
        return new Promise((resolve, reject) => {
            if(this.mediaRecorder) {
                if(this.mediaRecorder.state === "inactive") {
                    this.mediaRecorder!.start();
                } else if(this.mediaRecorder.state === "paused") {
                    this.mediaRecorder!.resume();
                }
                resolve();
                return;
            }

            this.mediaRecorder = new MediaRecorder(this.stream, {
                audioBitsPerSecond: this.options.audioBitsPerSecond,
                videoBitsPerSecond: this.options.videoBitsPerSecond
            });

            this.socket.emit('start', this.options, () => {
                resolve();
                this.mediaRecorder!.ondataavailable = (data: BlobEvent) => this.onMediaRecorderDataAvailable(data);
                this.mediaRecorder!.start(250);
            });
        });
    }

    pause() {
        if(this.mediaRecorder) {
            this.mediaRecorder.pause();
        }
    }

    stop(): Promise<void> {
        return new Promise((resolve, reject) => {
            if(this.mediaRecorder) {
                if(this.mediaRecorder.state === "inactive") {
                    resolve();
                    return;
                }
                this.mediaRecorder.onstop = () => {
                    this.socket.emit('stop', () => {
                        this.mediaRecorder = undefined;
                        resolve();
                    });
                };
                this.mediaRecorder.stop();
            }
        });
    }

    private onRemoteError(err: ServerError) {
        this.emit('error', err);
        if (err.fatal && this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
            this.mediaRecorder.onstop = () => this.mediaRecorder = undefined;
            this.mediaRecorder.stop();
        }
    }

    private onMediaRecorderDataAvailable(data: BlobEvent) {
        this.socket.emit('binarystream', data.data, (err?: ServerError) => {
            if (err) {
                this.onRemoteError(err);
            }
        });
    }
}