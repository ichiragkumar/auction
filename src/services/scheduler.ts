import cron from 'cron';
import { User } from '../models/User';
import { leaderboardService } from './leaderboard';
import { emailService } from './email';
import { redisService } from './redis';
import { logger } from '../config/logger';
import { Auction } from '../models/Auction';
import { Bid } from '../models/Bid';

export class AuctionScheduler {
  private jobs: Map<string, cron.CronJob> = new Map();

  constructor() {
    this.startPeriodicChecks();
  }

  private startPeriodicChecks() {
    const endingAuctionsJob = new cron.CronJob('0 * * * * *', async () => {
      await this.checkEndingAuctions();
    });

    const extensionCheckJob = new cron.CronJob('*/30 * * * * *', async () => {
      await this.checkForExtensions();
    });

    endingAuctionsJob.start();
    extensionCheckJob.start();

    logger.info('Auction scheduler started');
  }

  private async checkEndingAuctions() {
    try {
      const now = new Date();
      const endingAuctions = await Auction.find({
        status: { $in: ['active', 'extended'] },
        endTime: { $lte: now }
      });

      for (const auction of endingAuctions) {
        await this.endAuction(auction.id.toString());
      }
    } catch (error) {
      logger.error('Error checking ending auctions:', error);
    }
  }

  private async checkForExtensions() {
    try {
      const now = new Date();
      const threeMinutesFromNow = new Date(now.getTime() + 3 * 60 * 1000);

      const soonEndingAuctions = await Auction.find({
        status: { $in: ['active', 'extended'] },
        endTime: { $gte: now, $lte: threeMinutesFromNow }
      });

      for (const auction of soonEndingAuctions) {
        await this.checkAuctionExtension(auction.id.toString());
      }
    } catch (error) {
      logger.error('Error checking for extensions:', error);
    }
  }

  private async checkAuctionExtension(auctionId: string) {
    try {
      const hasTopRanksChanged = await leaderboardService.hasTopRanksChanged(auctionId);

      if (hasTopRanksChanged) {
        const auction = await Auction.findById(auctionId);
        if (!auction) return;

        auction.endTime = new Date(auction.endTime.getTime() + 5 * 60 * 1000);
        auction.status = 'extended';
        auction.extensionCount += 1;
        auction.lastExtendedAt = new Date();
        await auction.save();

        await redisService.publish(`auction_${auctionId}`, {
          type: 'AUCTION_EXTENDED',
          data: {
            auctionId,
            newEndTime: auction.endTime,
            extensionCount: auction.extensionCount
          }
        });

        logger.info(`Auction ${auctionId} extended due to top 5 ranking changes`);
      }
    } catch (error) {
      logger.error(`Error checking extension for auction ${auctionId}:`, error);
    }
  }

  public async endAuction(auctionId: string) {
    try {
      const auction = await Auction.findById(auctionId).populate('createdBy', 'name email');
      if (!auction) return;

      const winningBid = await Bid.findOne({ auctionId }).sort({ amount: -1 }).populate('bidderId', 'name email');

      auction.status = 'completed';
      if (winningBid) {
        auction.winner = winningBid.bidderId._id;
        auction.winningBid = winningBid.amount;
      }
      await auction.save();

      const finalLeaderboard = await leaderboardService.getLeaderboard(auctionId);
      await this.sendAuctionEndNotifications(auction, winningBid, finalLeaderboard);

      await redisService.publish(`auction_${auctionId}`, {
        type: 'AUCTION_ENDED',
        data: {
          auctionId,
          winner: winningBid
            ? {
                id: winningBid.bidderId._id,
                name: (winningBid.bidderId as any).name,
                winningBid: winningBid.amount
              }
            : null,
          finalLeaderboard
        }
      });

      logger.info(`Auction ${auctionId} ended successfully`);
    } catch (error) {
      logger.error(`Error ending auction ${auctionId}:`, error);
    }
  }

  private async sendAuctionEndNotifications(
    auction: any,
    winningBid: any,
    leaderboard: any[]
  ) {
    try {
      const merchantEmail = auction.createdBy.email;
      const auctionDetails = {
        _id: auction._id,
        productName: auction.productName,
        reservePrice: auction.reservePrice,
        winningBid: winningBid?.amount || 0,
        winner: winningBid
          ? {
              name: winningBid.bidderId.name,
              email: winningBid.bidderId.email
            }
          : null,
        totalParticipants: leaderboard.length
      };

      await emailService.sendMerchantNotification(merchantEmail, auctionDetails);

      const subscribers = await User.find({
        _id: { $in: auction.subscribers }
      });

      const notificationPromises = subscribers.map(subscriber => {
        const isWinner =
          winningBid &&
          subscriber.id.toString() === winningBid.bidderId._id.toString();

        return emailService.sendAuctionEndNotification(
          subscriber.email,
          auctionDetails,
          isWinner
        );
      });

      await Promise.all(notificationPromises);
      logger.info(`Sent auction end notifications for auction ${auction._id}`);
    } catch (error) {
      logger.error('Error sending auction end notifications:', error);
    }
  }

  public scheduleAuctionEnd(auctionId: string, endTime: Date) {
    const jobName = `end_auction_${auctionId}`;

    if (this.jobs.has(jobName)) {
      this.jobs.get(jobName)!.stop();
      this.jobs.delete(jobName);
    }

    const job = new cron.CronJob(endTime, async () => {
      await this.endAuction(auctionId);
      this.jobs.delete(jobName);
    });

    this.jobs.set(jobName, job);
    job.start();

    logger.info(`Scheduled auction ${auctionId} to end at ${endTime}`);
  }

  public cancelAuctionSchedule(auctionId: string) {
    const jobName = `end_auction_${auctionId}`;
    if (this.jobs.has(jobName)) {
      this.jobs.get(jobName)!.stop();
      this.jobs.delete(jobName);
      logger.info(`Cancelled schedule for auction ${auctionId}`);
    }
  }
}

export const auctionScheduler = new AuctionScheduler();
