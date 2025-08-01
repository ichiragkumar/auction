import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';

import { config } from './config';
import { RedisService, redisService } from './services/redis';
import { SocketHandler, socketHandler } from './socket/socketHandler';
import { auctionScheduler } from './services/scheduler';
import { apiRoutes } from './routes';
import { logger } from './config/logger';
import { connectDatabase } from './config/database';
import mongoose from 'mongoose';

class AuctionServer {
  private app: express.Application;
  private server: any;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(helmet({
      contentSecurityPolicy: false, 
      crossOriginEmbedderPolicy: false
    }));


    this.app.use(cors({
      origin: config.frontendUrl,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));


    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, 
      max: 100, 
      message: {
        error: 'Too many requests from this IP, please try again later'
      }
    });
    this.app.use(limiter);


    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));


    this.app.use(express.static(path.join(__dirname, '../public')));


    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path} - ${req.ip}`);
      next();
    });
  }

  private setupRoutes() {
    this.app.use('/api', apiRoutes);


    this.app.get('/auction/:id', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/auction.html'));
    });

    this.app.get('/admin', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/admin.html'));
    });


    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    });


    this.app.use('*', (req, res) => {
      res.status(404).json({ error: 'Route not found' });
    });


    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error:', err);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  public async start() {
    try {
      await connectDatabase();
      await redisService.connect();



      this.server.listen(config.port, () => {
        logger.info(`🚀 Auction server running on port ${config.port}`);
        logger.info(`📱 Frontend URL: ${config.frontendUrl}`);
        logger.info(`🌍 Environment: ${config.nodeEnv}`);
      });


      process.on('SIGTERM', this.gracefulShutdown.bind(this));
      process.on('SIGINT', this.gracefulShutdown.bind(this));

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private async gracefulShutdown(signal: string) {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    
    this.server.close(async () => {
      logger.info('HTTP server closed');
      
      try {
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    });


    setTimeout(() => {
      logger.error('Force closing server');
      process.exit(1);
    }, 30000);
  }
}

const server = new AuctionServer();
server.start();
