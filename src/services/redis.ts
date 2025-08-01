import { createClient } from 'redis';
import { logger } from '../config/logger';

export class RedisService {
  private client;
  private pubClient;
  private subClient;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    this.pubClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    this.subClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
  }

  async connect() {
    try {
      await Promise.all([
        this.client.connect(),
        this.pubClient.connect(),
        this.subClient.connect()
      ]);
      logger.info('Redis connected successfully');
    } catch (error) {
      logger.error('Redis connection failed:', error);
      throw error;
    }
  }

  async publish(channel: string, message: any) {
    try {
      await this.pubClient.publish(channel, JSON.stringify(message));
    } catch (error) {
      logger.error('Redis publish error:', error);
    }
  }

  async subscribe(channel: string, callback: (message: any) => void) {
    try {
      await this.subClient.subscribe(channel, (message) => {
        try {
          const parsedMessage = JSON.parse(message);
          callback(parsedMessage);
        } catch (error) {
          logger.error('Error parsing Redis message:', error);
        }
      });
    } catch (error) {
      logger.error('Redis subscribe error:', error);
    }
  }

  async setLeaderboard(auctionId: string, leaderboard: any[]) {
    try {
      await this.client.setEx(
        `leaderboard:${auctionId}`, 
        300,
        JSON.stringify(leaderboard)
      );
    } catch (error) {
      logger.error('Error setting leaderboard in Redis:', error);
    }
  }

  async getLeaderboard(auctionId: string): Promise<any[] | null> {
    try {
      const data = await this.client.get(`leaderboard:${auctionId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Error getting leaderboard from Redis:', error);
      return null;
    }
  }

  async setTopRanksSnapshot(auctionId: string, topRanks: string[]) {
    try {
      await this.client.setEx(
        `top_ranks:${auctionId}`,
        180,
        JSON.stringify(topRanks)
      );
    } catch (error) {
      logger.error('Error setting top ranks snapshot:', error);
    }
  }

  async getTopRanksSnapshot(auctionId: string): Promise<string[] | null> {
    try {
      const data = await this.client.get(`top_ranks:${auctionId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Error getting top ranks snapshot:', error);
      return null;
    }
  }
}

export const redisService = new RedisService();