import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { EventEmitter } from 'stream';
import { Logger } from 'tslog';
import { FfmpegConfig } from '@api.video/browser-to-rtmp-common';

const errors = {
  FFMPEG_NOT_FOUND: { code: 'ENOENT', message: 'ffmpeg executable not found' },
  RTMP_CONNECTION_FAILED: {
    code: 'RTMP_CONNECTION_FAILED',
    message: 'connection to RTMP server failed',
  },
};

export default class Ffmpeg extends EventEmitter {
  private options: FfmpegConfig;
  private logger: Logger;
  private process?: ChildProcessWithoutNullStreams;
  private status: 'RUNNING' | 'ENDED' | 'CREATED' = 'CREATED';
  private framesSent: number = 0;
  private lastFrameSentTime?: number;

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
    this.process.on('exit', (_) => (this.status = 'ENDED'));

    this.status = 'RUNNING';
  }

  destroy() {
    this.process?.kill();
    this.status = 'ENDED';
  }

  getStatus() {
    return {
      status: this.status,
      framesSent: this.framesSent,
      lastFrameSentTime: this.lastFrameSentTime,
      pid: this.process?.pid,
    };
  }

  private onProcessOutput(data: any) {
    const message = Buffer.from(data).toString('utf8');

    this.logger.trace(message);

    let match: RegExpMatchArray | null;
    if (message.match(/(.*): Connection refused[\n]?/g)) {
      this.emit('fatal-error', { ...errors.RTMP_CONNECTION_FAILED, details: message });
    // tslint:disable-next-line: no-conditional-assignment
    } else if ((match = message.match(/frame=[\s]+([\d]+)[\s]+.*/))) {
      this.framesSent = parseInt(match[1], 10);
      this.lastFrameSentTime = new Date().getTime();
    } else {
      this.emit('process-error', message);
    }
  }

  private onProcessStdinError(err: Error) {
    this.emit('fatal-error', err);
  }

  private onProcessError(err: Error) {
    this.status = 'ENDED';
    if ((err as any).code === 'ENOENT') {
      this.emit('fatal-error', errors.FFMPEG_NOT_FOUND);
    }
    this.emit('fatal-error', err);
  }

  sendData(data: Buffer) {
    if (this.status !== 'RUNNING') {
      return;
    }
    this.process?.stdin.write(data);
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
    const audioEncoding = this.getAudioEncoding(this.options.audioSampleRate);
    const keyintMin = String(Math.min(25, this.options.framerate));

    return [
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
      String(this.options.framerate * 2),
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
      this.options.rtmp,
    ];
  }
}
