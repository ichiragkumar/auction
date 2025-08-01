import { User } from '../models/User';
import { redisService } from './redis';
import { logger } from '../config/logger';
import mongoose from 'mongoose';
import { Leaderboard } from '../models/Leaderboard';

export class LeaderboardService {
  async updateLeaderboard(auctionId: string, bidderId: string, bidAmount: number): Promise<any[]> {
    try {

      const bidder = await User.findById(bidderId);
      if (!bidder) throw new Error('Bidder not found');


      const existingEntry = await Leaderboard.findOne({ 
        auctionId: new mongoose.Types.ObjectId(auctionId), 
        bidderId: new mongoose.Types.ObjectId(bidderId) 
      });

      if (existingEntry) {
        if (bidAmount > existingEntry.highestBid) {
          existingEntry.highestBid = bidAmount;
          existingEntry.lastBidTime = new Date();
          existingEntry.totalBids += 1;
          await existingEntry.save();
        }
      } else {
        await Leaderboard.create({
          auctionId: new mongoose.Types.ObjectId(auctionId),
          bidderId: new mongoose.Types.ObjectId(bidderId),
          bidderName: bidder.name,
          highestBid: bidAmount,
          rank: 1,
          lastBidTime: new Date(),
          totalBids: 1
        });
      }

      const leaderboard = await this.calculateRanks(auctionId);
      
      await redisService.setLeaderboard(auctionId, leaderboard);
      
      return leaderboard;
    } catch (error) {
      logger.error('Error updating leaderboard:', error);
      throw error;
    }
  }

  async calculateRanks(auctionId: string): Promise<any[]> {
    try {
      const entries = await Leaderboard.find({ 
        auctionId: new mongoose.Types.ObjectId(auctionId) 
      })
      .sort({ 
        highestBid: -1, 
        lastBidTime: 1 
      });

      const updatedEntries = [];
      for (let i = 0; i < entries.length; i++) {
        entries[i].rank = i + 1;
        await entries[i].save();
        updatedEntries.push({
          bidderId: entries[i].bidderId,
          bidderName: entries[i].bidderName,
          highestBid: entries[i].highestBid,
          rank: entries[i].rank,
          lastBidTime: entries[i].lastBidTime,
          totalBids: entries[i].totalBids
        });
      }

      return updatedEntries;
    } catch (error) {
      logger.error('Error calculating ranks:', error);
      throw error;
    }
  }

  async getLeaderboard(auctionId: string, limit?: number): Promise<any[]> {
    try {
      const cachedLeaderboard = await redisService.getLeaderboard(auctionId);
      if (cachedLeaderboard) {
        return limit ? cachedLeaderboard.slice(0, limit) : cachedLeaderboard;
      }

      const entries = await Leaderboard.find({ 
        auctionId: new mongoose.Types.ObjectId(auctionId) 
      })
      .sort({ rank: 1 })
      .limit(limit || 0);

      const leaderboard = entries.map(entry => ({
        bidderId: entry.bidderId,
        bidderName: entry.bidderName,
        highestBid: entry.highestBid,
        rank: entry.rank,
        lastBidTime: entry.lastBidTime,
        totalBids: entry.totalBids
      }));

      await redisService.setLeaderboard(auctionId, leaderboard);
      
      return leaderboard;
    } catch (error) {
      logger.error('Error getting leaderboard:', error);
      return [];
    }
  }

  async getTopRanks(auctionId: string, count: number = 5): Promise<string[]> {
    try {
      const leaderboard = await this.getLeaderboard(auctionId, count);
      return leaderboard.map(entry => entry.bidderId.toString());
    } catch (error) {
      logger.error('Error getting top ranks:', error);
      return [];
    }
  }

  async hasTopRanksChanged(auctionId: string): Promise<boolean> {
    try {
      const currentTopRanks = await this.getTopRanks(auctionId, 5);
      const previousTopRanks = await redisService.getTopRanksSnapshot(auctionId);
      
      if (!previousTopRanks) {
        await redisService.setTopRanksSnapshot(auctionId, currentTopRanks);
        return false;
      }

      const hasChanged = JSON.stringify(currentTopRanks) !== JSON.stringify(previousTopRanks);
      
      if (hasChanged) {
        await redisService.setTopRanksSnapshot(auctionId, currentTopRanks);
      }
      
      return hasChanged;
    } catch (error) {
      logger.error('Error checking top ranks change:', error);
      return false;
    }
  }
}

export const leaderboardService = new LeaderboardService();