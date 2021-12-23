export interface FfmpegConfig {
    framerate?: number;
    audioSampleRate?: number;
    rtmp?: string;
    audioBitsPerSecond?: number;
    videoBitsPerSecond?: number;
}
export interface ServerError {
    name: string;
    message: string;
    details?: string;
    fatal?: boolean;
}
export interface ServerToClientEvents {
    error: (error: ServerError) => void;
    ffmpegOutput: (message: string) => void;
}
export interface ClientToServerEvents {
    stop: (callback: (error?: ServerError) => void) => void;
    start: (config: FfmpegConfig, callback: (error?: ServerError) => void) => void;
    binarystream: (data: any, callback: (error?: ServerError) => void) => void;
}
export interface InterServerEvents {
    ping: () => void;
}
export interface SocketData {
    name: string;
    age: number;
}
