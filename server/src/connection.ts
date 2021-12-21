import { Socket } from 'socket.io';
import { Logger } from 'tslog';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  ConnectionError,
  FfmpegConfig,
} from "@api.video/browser-to-rtmp-common";
import Ffmpeg from './ffmpeg';

export default class Connection {
  private socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  private ffmpeg?: Ffmpeg;
  private static count: number = 0;
  private logger: Logger;
  private uuid: string;

  constructor(
    logger: Logger,
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    uuid: string,
  ) {
    this.socket = socket;
    this.logger = logger;
    this.uuid = uuid;

    this.socket.on('start', (event, callback) => this.onStart(event, callback));
    this.socket.on('error', (event) => this.onSocketError(event));
    this.socket.on('binarystream', (data, callback) => this.onBinaryStream(data, callback));
  }

  destroy() {
    this.logger.info('destroying ffmpeg instance');
    this.ffmpeg?.destroy();
    this.ffmpeg = undefined;
  }

  getStatus() {
    return {
      ffmpeg: this.ffmpeg?.getStatus(),
      uuid: this.uuid,
      remoteAddress: this.socket.handshake.address
    };
  }

  private onSocketError(error: Error) {
    this.logger.warn('socket error', error);
  }

  private onStart(event: FfmpegConfig, callback: (error?: ConnectionError) => void) {
    this.ffmpeg = new Ffmpeg(this.logger, event);
    this.logger.info('starting new ffmpeg instance');
    this.ffmpeg.addListener('process_error', (e) => console.log(e));
    this.ffmpeg.addListener('fatal-error', (e) => {
      this.destroy();
      this.socket.emit('error', e);
      this.logger.warn('ffmpeg error', e);
    });
    this.ffmpeg.start();
    callback();
  }

  private onBinaryStream(data: Buffer, callback: (error?: ConnectionError) => void) {
    if (!this.ffmpeg) {
      callback({ message: 'not started here' }); // TODO
      return;
    }
    try {
      this.ffmpeg?.sendData(data);
    } catch (e) {
      callback({ message: (e as Error).message });
    }
    callback();
  }
}
