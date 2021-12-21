import Connection from './connection';
import { Server, ServerOptions, Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@api.video/browser-to-rtmp-common';
import { Server as HttpServer } from 'http';
import { Logger } from 'tslog';
import EventEmitter from 'events';
import { randomUUID } from 'crypto';

type BrowserToRtmpServerOptions = Partial<ServerOptions> & {
  logMinLevel?: 'silly' | 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
};

declare interface BrowserToRtmpServer {
  on(event: 'connection', tt: string): this;
  on(event: string, listener: () => void): this;
}

class BrowserToRtmpServer extends EventEmitter {
  private io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  private connections: Map<string, Connection> = new Map();
  private logger: Logger;

  constructor(server: HttpServer, opts?: BrowserToRtmpServerOptions) {
    super();

    this.logger = new Logger({
      minLevel: opts?.logMinLevel || 'silly',
    });
    this.io = new Server(server, opts);

    this.io.on('connection', (socket) => this.onConnection(socket));
  }

  getConnections() {
      return [...this.connections.values()].map(a => a.getStatus());
  }

  private onConnection(socket: Socket) {
    const connectionId = randomUUID();
    const connection = new Connection(this.logger, socket, connectionId);
    this.connections.set(connectionId, connection);
    this.emit('connection', 'aa');
    socket.on('disconnect', () => {
      connection.destroy();
      this.connections.delete(connectionId);
    });
  }
}

export = BrowserToRtmpServer;
