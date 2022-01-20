import {
  ClientToServerEvents, InterServerEvents, ServerError, ServerToClientEvents, SocketData
} from './types';
import { randomUUID } from 'crypto';
import EventEmitter from 'events';
import { Server as HttpServer } from 'http';
import { Server, ServerOptions, Socket } from 'socket.io';
import { Logger } from 'tslog';
import TypedEmitter from "typed-emitter";
import Connection, { ConnectionEvents, ConnectionStatus, OnStartHook } from './connection';
import merge from 'ts-deepmerge';

type BrowserToRtmpServerOptions = {
  serverLogs?: {
    minLevel?: 'silly' | 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  }
  clientLogs?: {
    sendErrorDetails?: boolean,
    sendFfmpegOutput?: boolean,
  }
  maxFfmpegInstances?: number;
  rtmpUrlRegexp?: RegExp;
  socketio?: Partial<ServerOptions>,
  hooks?: {
    start?: OnStartHook
  }
};

const DEFAULT_OPTIONS: BrowserToRtmpServerOptions = {
  serverLogs: {
    minLevel: 'info'
  },
  clientLogs: {
    sendErrorDetails: false,
    sendFfmpegOutput: false
  }
}

type BrowserToRtmpServerEvents = {
  error: (connectionId: string, error: ServerError) => void;
  destroyed: (connectionId: string) => void;
  ffmpegOutput: (connectionId: string, message: string) => void;
  connection: (status: ConnectionStatus) => void;
};


class BrowserToRtmpServer extends (EventEmitter as new () => TypedEmitter<BrowserToRtmpServerEvents>) {
  private io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  private connections: Map<string, Connection> = new Map();
  private logger: Logger;
  private opts: BrowserToRtmpServerOptions;

  constructor(server: HttpServer, opts?: BrowserToRtmpServerOptions) {
    super();

    this.opts = merge(DEFAULT_OPTIONS, opts || {}) as BrowserToRtmpServerOptions;

    this.logger = new Logger({
      minLevel: this.opts.serverLogs?.minLevel || 'info',
    });
    this.io = new Server(server, this.opts.socketio);

    this.io.on('connection', (socket) => this.onConnection(socket));
  }

  getConnections(): ConnectionStatus[] {
    return [...this.connections.values()].map(a => a.getStatus());
  }

  getConnection(id: string): ConnectionStatus | undefined {
    return this.connections.get(id)?.getStatus();
  }

  private countFfmpegInstances(): number {
    return [...this.connections.values()].filter(c => !!c.getStatus().ffmpeg).length;
  }

  private onConnection(socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) {
    const connectionId = randomUUID();
    const connection = new Connection(this.logger, socket, connectionId, (s, event) => {
      if (typeof this.opts.maxFfmpegInstances !== "undefined" && this.countFfmpegInstances() >= this.opts.maxFfmpegInstances) {
        throw new Error("Max ffmpeg instances reached");
      }

      if (this.opts?.hooks?.start) {
        event = this.opts.hooks.start(s, event);
      }

      if (event.rtmp && this.opts.rtmpUrlRegexp && !this.opts.rtmpUrlRegexp?.test(event.rtmp)) {
        throw new Error("The RTMP url doesn't match the rtmpUrlRegexp");
      }

      return event;
    });

    this.connections.set(connectionId, connection);

    this.emit('connection', connection.getStatus());

    connection.on('error', (e) => {
      if (!this.opts.clientLogs?.sendErrorDetails) {
        socket.emit('error', {
          ...e,
          details: undefined,
          message: ""
        });
      }
      else {
        socket.emit('error', e);
      }
      this.emit('error', connectionId, e);
    });
    connection.on('ffmpegOutput', (e) => {
      if (this.opts.clientLogs?.sendFfmpegOutput) {
        socket.emit('ffmpegOutput', e);
      }
      this.emit('ffmpegOutput', connectionId, e);
    });
    connection.on('destroyed', () => {
      this.emit('destroyed', connectionId);
    });

    socket.on('disconnect', () => {
      connection.destroy();
      this.connections.delete(connectionId);
    });
  }
}

export = BrowserToRtmpServer;