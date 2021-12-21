export interface FfmpegConfig {
  framerate: number;
  audioSampleRate: number;
  audioBitrate?: number;
  rtmp: string;
}

export interface ConnectionError {
  message: string;
}

export interface ServerError {
  code: string;
  message: string;
  details?: string;
}

export interface ServerToClientEvents {
  error: (error: ServerError) => void;
}

export interface ClientToServerEvents {
  start: (config: FfmpegConfig, callback: (error?: ConnectionError) => void) => void;
  binarystream: (data: any, callback: (error?: ConnectionError) => void) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  name: string;
  age: number;
}