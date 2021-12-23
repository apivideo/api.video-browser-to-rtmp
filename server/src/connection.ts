import {
  ClientToServerEvents, FfmpegConfig, InterServerEvents, ServerError, ServerToClientEvents, SocketData
} from './types';
import { triggerAsyncId } from "async_hooks";
import { EventEmitter } from 'events';
import { Socket } from 'socket.io';
import { Logger } from 'tslog';
import TypedEmitter from "typed-emitter";
import Ffmpeg, { FfmpegErrors, FfmpegEvents, FfmpegStatus } from './ffmpeg';

export type OnStartHook = (socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>, event: FfmpegConfig) => FfmpegConfig;

export type ConnectionEvents = FfmpegEvents;
export type ConnectionStatus = {
  uuid: string;
  remoteAddress: string;
  ffmpeg?: FfmpegStatus;
};

export default class Connection extends (EventEmitter as new () => TypedEmitter<ConnectionEvents>) {
  private socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  private ffmpeg?: Ffmpeg;
  private static count: number = 0;
  private logger: Logger;
  private uuid: string;
  private onStartHook?: OnStartHook;

  constructor(
    logger: Logger,
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    uuid: string,
    onStartHook?: (socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>, event: FfmpegConfig) => FfmpegConfig
  ) {
    super();
    this.socket = socket;
    this.logger = logger;
    this.uuid = uuid;
    this.onStartHook = onStartHook;

    this.socket.on('start', (event, callback) => this.onStart(event, callback));
    this.socket.on('stop', (callback) => this.onStop(callback));
    this.socket.on('error', (event) => this.onSocketError(event));
    this.socket.on('binarystream', (data, callback) => this.onBinaryStream(data, callback));
  }

  destroy() {
    this.logger.info('destroying ffmpeg instance');
    this.ffmpeg?.destroy();
  }

  getStatus(): ConnectionStatus {
    return {
      ffmpeg: this.ffmpeg?.getStatus(),
      uuid: this.uuid,
      remoteAddress: this.socket.handshake.address
    };
  }

  private onSocketError(error: Error) {
    this.logger.warn('socket error', error);
  }


  private onStop(callback?: () => void) {
    this.destroy();
    if (callback) callback();
  };

  private onStart(event: FfmpegConfig, callback?: () => void) {
    if (this.onStartHook) {
      try {
        event = this.onStartHook(this.socket, event);
      } catch (e: any) {
        this.onFfmpegError({
          message: e.message,
          name: "CANT_START_FFMPEG",
          fatal: true
        });
        return;
      }
    }

    if (!this.validateFfmpegConfig(event)) {
      return;
    }

    this.ffmpeg = new Ffmpeg(this.logger, event);
    this.logger.info('starting new ffmpeg instance');

    this.ffmpeg.on("destroyed", () => this.ffmpeg = undefined);
    this.ffmpeg.on('ffmpegOutput', (e) => this.emit('ffmpegOutput', e));
    this.ffmpeg.on('error', (e: ServerError) => this.onFfmpegError(e));
    this.ffmpeg.start();
    if (callback) callback();
  }

  private onFfmpegError(error: ServerError) {
    this.sendErrorToClient(error);
    this.logger.warn('ffmpeg error', error);
    if (error.fatal) {
      this.destroy();
    }
  }

  private sendErrorToClient(error: ServerError) {
    this.emit('error', error);
  }


  private validateFfmpegConfig(config: FfmpegConfig): boolean {
    const errors: string[] = [];

    ["framerate", "audioSampleRate", "rtmp"].forEach(p => {
      if (!(config as any)[p]) {
        errors.push(`${p}`);
      }
    });

    if (errors.length > 0) {
      this.sendErrorToClient({
        name: "INVALID_PARAMETERS",
        message: "Missing values: " + errors.join(", "),
        fatal: true
      });
    }
    return errors.length === 0;
  }

  private onBinaryStream(data: Buffer, callback: (error?: ServerError) => void) {
    if (!this.ffmpeg) {
      callback(FfmpegErrors.FFMPEG_NOT_RUNNING);
      this.emit("error", FfmpegErrors.FFMPEG_NOT_RUNNING);
      return;
    }

    this.ffmpeg?.sendData(data)
      .then(() => callback())
      .catch((err: ServerError) => {
        this.emit("error", err);
        callback(err);
      });
  }
}
