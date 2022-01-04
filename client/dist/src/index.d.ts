import { ManagerOptions, SocketOptions } from "socket.io-client";
import TypedEmitter from "typed-emitter";
import { ServerError, FfmpegConfig } from "./types";
declare type BrowserToRtmpClientOptions = {
    host: string;
    port?: number;
    socketio?: Partial<ManagerOptions & SocketOptions>;
} & FfmpegConfig;
export declare type BrowserToRtmpClientEvents = {
    error: (error: ServerError) => void;
    destroyed: () => void;
    ffmpegOutput: (message: string) => void;
};
declare const BrowserToRtmpClient_base: new () => TypedEmitter<BrowserToRtmpClientEvents>;
export declare class BrowserToRtmpClient extends BrowserToRtmpClient_base {
    private socket;
    private stream;
    private options;
    private mediaRecorder?;
    constructor(stream: MediaStream, options: BrowserToRtmpClientOptions);
    start(): Promise<void>;
    pause(): void;
    stop(): Promise<void>;
    private onRemoteError;
    private onMediaRecorderDataAvailable;
}
export {};
