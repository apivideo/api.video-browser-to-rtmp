import { FfmpegConfig, ServerError } from './types';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { Logger } from 'tslog';
import TypedEmitter from "typed-emitter"

export const FfmpegErrors: { [name: string]: ServerError } = {
  FFMPEG_NOT_FOUND: { name: 'FFMPEG_NOT_FOUND', message: 'ffmpeg executable not found', fatal: true },
  FFMPEG_UNEXPECTED_END: { name: 'FFMPEG_UNEXPECTED_END', message: 'ffmpeg a ended unexpectedly', fatal: true},
  FFMPEG_NOT_RUNNING: { name: 'FFMPEG_NOT_RUNNING', message: 'ffmpeg is not running yet', fatal: false },
  RTMP_CONNECTION_FAILED: {
    name: 'RTMP_CONNECTION_FAILED',
    message: 'connection to RTMP server failed',
    fatal: true
  },
};

export type FfmpegEvents = {
  error: (error: ServerError) => void;
  destroyed: () => void;
  ffmpegOutput: (message: string) => void;
}

export type FfmpegStatus = {
  status: string;
  framesSent: number;
  lastFrameSentTime?: number;
  pid?: number;
  options: FfmpegConfig;
}

export default class Ffmpeg extends (EventEmitter as new () => TypedEmitter<FfmpegEvents>) {
  private options: FfmpegConfig;
  private logger: Logger;
  private process?: ChildProcessWithoutNullStreams;
  private status: 'RUNNING' | 'ENDED' | 'ENDING' | 'CREATED' = 'CREATED';
  private framesSent: number = 0;
  private lastFrameSentTime?: number;
  private lastOutput: string = "";

  constructor(logger: Logger, options: FfmpegConfig) {
    super();
    this.logger = logger;
    this.options = options;
  }

  start() {
    this.process = spawn('ffmpeg', this.createOptions());

    this.process.stderr.on('data', (data) => this.onProcessOutput(data));
    this.process.stdout.on('data', (data) => this.onProcessOutput(data));

    this.process.stdin.on('error', (error) => this.onProcessStdinError(error));

    this.process.on('error', (err: Error) => this.onProcessError(err));
    this.process.on('exit', (_) => {
      if(this.status !== "ENDING") {
        this.emit('error', {
          ...FfmpegErrors.FFMPEG_UNEXPECTED_END,
          details: `Last output: ${this.lastOutput}`
        });
      }
      this.emit("destroyed");
      this.status = 'ENDED';
    });

    this.status = 'RUNNING';
  }

  destroy() {
    this.status = 'ENDING';
    this.process?.kill("SIGKILL");
  }

  getStatus(): FfmpegStatus {
    return {
      status: this.status,
      framesSent: this.framesSent,
      lastFrameSentTime: this.lastFrameSentTime,
      pid: this.process?.pid,
      options: {
        ...this.options
      }
    };
  }

  private emitError(error: ServerError) {
    this.emit('error', error);
  }

  private onProcessOutput(data: any) {
    const message = Buffer.from(data).toString('utf8');

    this.lastOutput = message;
    this.logger.trace(message);

    let match: RegExpMatchArray | null;
    if (message.match(/(.*): Connection refused[\n]?/g)) {
      this.emitError({ ...FfmpegErrors.RTMP_CONNECTION_FAILED, details: message });
      // tslint:disable-next-line: no-conditional-assignment
    } else if ((match = message.match(/frame=[\s]+([\d]+)[\s]+.*/))) {
      this.framesSent = parseInt(match[1], 10);
      this.lastFrameSentTime = new Date().getTime();
      this.emit('ffmpegOutput', message);
    } else {
      this.emit('ffmpegOutput', message);
    }
  }

  private onProcessStdinError(err: Error) {
    if ((err as any).code === 'EPIPE' && this.status === "ENDING") {
      return;
    }
    this.emitError({
      ...err,
      name: "FFMPEG_ERROR",
      fatal: true
    });
  }

  private onProcessError(err: Error) {
    if ((err as any).code === 'EPIPE' && this.status === "ENDING") {
      return;
    }
    this.status = 'ENDED';
    if ((err as any).code === 'ENOENT') {
      this.emitError(FfmpegErrors.FFMPEG_NOT_FOUND);
    }
    this.emitError({
      ...err,
      name: "FFMPEG_ERROR",
      fatal: true
    });
  }

  sendData(data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.status !== 'RUNNING') {
        reject(FfmpegErrors.FFMPEG_NOT_RUNNING);
      }
      this.process?.stdin.write(data, (err) => {
        if(err) {
          if ((err as any).code === 'EPIPE' && this.status === "ENDING") {
            return;
          }
          reject({
            name: "FFMPEG_WRITE_ERROR",
            message: err.message
          });
        } else {
          resolve();
        }
      });
    });
  }

  private getAudioEncoding(audioSampleRate: number): string {
    switch (audioSampleRate) {
      case 11025:
        return '11k';
      case 22050:
        return '22k';
      case 44100:
        return '44k';
      default:
        return '44k';
    }
  }

  private createOptions(): string[] {
    const audioEncoding = this.getAudioEncoding(this.options.audioSampleRate!);
    const keyintMin = String(Math.min(25, this.options.framerate!));

    const options = [
      '-i',
      '-',
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-tune',
      'zerolatency',
      '-r',
      String(this.options.framerate),
      '-g',
      String(this.options.framerate! * 2),
      '-keyint_min',
      keyintMin,
      '-crf',
      '25',
      '-pix_fmt',
      'yuv420p',
      '-sc_threshold',
      '0',
      '-profile:v',
      'main',
      '-level',
      '3.1',
      '-c:a',
      'aac',
      '-b:a',
      audioEncoding,
      '-ar',
      String(this.options.audioSampleRate),
      '-f',
      'flv',
      this.options.rtmp!,
    ];

    return options;
  }
}