import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { redisService } from '../services/redis';
import { leaderboardService } from '../services/leaderboard';
import { logger } from '../config/logger';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  role?: string;
}

export class SocketHandler {
  private io: SocketIOServer;
  private connectedUsers: Map<string, Set<string>> = new Map();

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    this.setupRedisSubscriptions();
  }

  private setupMiddleware() {
    this.io.use((socket: any, next) => {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        socket.userId = decoded.userId;
        socket.role = decoded.role;
        next();
      } catch (err) {
        next(new Error('Authentication error: Invalid token'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      logger.info(`User ${socket.userId} connected with socket ${socket.id}`);


      socket.on('join_auction', async (auctionId: string) => {
        try {
          await socket.join(`auction_${auctionId}`);
          

          if (!this.connectedUsers.has(auctionId)) {
            this.connectedUsers.set(auctionId, new Set());
          }
          this.connectedUsers.get(auctionId)!.add(socket.id);


          const leaderboard = await leaderboardService.getLeaderboard(auctionId);
          socket.emit('leaderboard_update', {
            auctionId,
            leaderboard: {
              top5: leaderboard.slice(0, 5),
              all: leaderboard,
              total: leaderboard.length
            }
          });


          const userCount = this.connectedUsers.get(auctionId)?.size || 0;
          this.io.to(`auction_${auctionId}`).emit('user_count_update', {
            auctionId,
            activeUsers: userCount
          });

          logger.info(`User ${socket.userId} joined auction ${auctionId}`);
        } catch (error) {
          logger.error('Error joining auction:', error);
          socket.emit('error', { message: 'Failed to join auction' });
        }
      });


      socket.on('leave_auction', (auctionId: string) => {
        socket.leave(`auction_${auctionId}`);
        

        if (this.connectedUsers.has(auctionId)) {
          this.connectedUsers.get(auctionId)!.delete(socket.id);
          

          const userCount = this.connectedUsers.get(auctionId)?.size || 0;
          this.io.to(`auction_${auctionId}`).emit('user_count_update', {
            auctionId,
            activeUsers: userCount
          });
        }

        logger.info(`User ${socket.userId} left auction ${auctionId}`);
      });


      socket.on('get_live_data', async (auctionId: string) => {
        try {
          const leaderboard = await leaderboardService.getLeaderboard(auctionId);
          const userCount = this.connectedUsers.get(auctionId)?.size || 0;
          
          socket.emit('live_data_update', {
            auctionId,
            leaderboard: {
              top5: leaderboard.slice(0, 5),
              all: leaderboard,
              total: leaderboard.length
            },
            activeUsers: userCount,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          logger.error('Error getting live data:', error);
          socket.emit('error', { message: 'Failed to get live data' });
        }
      });


      socket.on('disconnect', () => {
        for (const [auctionId, socketIds] of this.connectedUsers.entries()) {
          if (socketIds.has(socket.id)) {
            socketIds.delete(socket.id);
            

            const userCount = socketIds.size;
            this.io.to(`auction_${auctionId}`).emit('user_count_update', {
              auctionId,
              activeUsers: userCount
            });
          }
        }
        
        logger.info(`User ${socket.userId} disconnected`);
      });


      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
      });
    });
  }

  private setupRedisSubscriptions() {
    redisService.subscribe('auction_*', (message) => {
      this.handleRedisMessage(message);
    });
  }

  private async handleRedisMessage(message: any) {
    try {
      const { type, data } = message;

      switch (type) {
        case 'NEW_BID':
          await this.handleNewBid(data);
          break;
        
        case 'AUCTION_EXTENDED':
          await this.handleAuctionExtended(data);
          break;
        
        case 'AUCTION_ENDED':
          await this.handleAuctionEnded(data);
          break;
        
        case 'LEADERBOARD_UPDATE':
          await this.handleLeaderboardUpdate(data);
          break;
          
        default:
          logger.warn(`Unknown message type: ${type}`);
      }
    } catch (error) {
      logger.error('Error handling Redis message:', error);
    }
  }

  private async handleNewBid(data: any) {
    const { bid, leaderboard } = data;
    const auctionId = bid.auctionId;

    this.io.to(`auction_${auctionId}`).emit('new_bid', {
      bid,
      leaderboard: {
        top5: leaderboard.slice(0, 5),
        all: leaderboard,
        total: leaderboard.length
      },
      timestamp: new Date().toISOString()
    });

    this.io.to(`auction_${auctionId}`).emit('leaderboard_update', {
      auctionId,
      leaderboard: {
        top5: leaderboard.slice(0, 5),
        all: leaderboard,
        total: leaderboard.length
      }
    });
  }

  private async handleAuctionExtended(data: any) {
    const { auctionId, newEndTime, extensionCount } = data;

    this.io.to(`auction_${auctionId}`).emit('auction_extended', {
      auctionId,
      newEndTime,
      extensionCount,
      message: `Auction extended by 5 minutes due to top 5 ranking changes!`,
      timestamp: new Date().toISOString()
    });
  }

  private async handleAuctionEnded(data: any) {
    const { auctionId, winner, finalLeaderboard } = data;

    this.io.to(`auction_${auctionId}`).emit('auction_ended', {
      auctionId,
      winner,
      finalLeaderboard,
      message: 'Auction has ended!',
      timestamp: new Date().toISOString()
    });

    this.connectedUsers.delete(auctionId);
  }

  private async handleLeaderboardUpdate(data: any) {
    const { auctionId, leaderboard } = data;

    this.io.to(`auction_${auctionId}`).emit('leaderboard_update', {
      auctionId,
      leaderboard: {
        top5: leaderboard.slice(0, 5),
        all: leaderboard,
        total: leaderboard.length
      },
      timestamp: new Date().toISOString()
    });
  }

  public async broadcastToAuction(auctionId: string, event: string, data: any) {
    this.io.to(`auction_${auctionId}`).emit(event, data);
  }

  public getConnectedUsersCount(auctionId: string): number {
    return this.connectedUsers.get(auctionId)?.size || 0;
  }

  public getIO(): SocketIOServer {
    return this.io;
  }
}

export let socketHandler: SocketHandler;