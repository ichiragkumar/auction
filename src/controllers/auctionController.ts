import { Request, Response } from 'express';
import { Auction } from '../models/Auction';
import { User } from '../models/User';
import { emailService } from '../services/email';
import { logger } from '../config/logger';
import { Bid } from '../models/Bid';
import { Leaderboard } from '../models/Leaderboard';
import { Types } from 'mongoose';


interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

export class AuctionController {
  async createAuction(req: AuthRequest, res: Response) {
    try {
      const { productName, reservePrice, durationHours = 24 } = req.body;
      
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can create auctions' });
      }

      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);

      const auction = await Auction.create({
        productName,
        reservePrice,
        createdBy: req.user.userId,
        startTime,
        endTime,
        status: 'pending'
      });


      const allUsers = await User.find({ role: 'user', isActive: true }).limit(10000);
      const userEmails = allUsers.map(user => user.email);
      

      auction.subscribers = allUsers.map((user:any) => user._id);
      await auction.save();


      if (userEmails.length > 0) {
        await emailService.sendAuctionInvitation(userEmails, auction);
      }


      auction.status = 'active';
      await auction.save();

      res.status(201).json({
        success: true,
        auction: {
          id: auction._id,
          productName: auction.productName,
          reservePrice: auction.reservePrice,
          startTime: auction.startTime,
          endTime: auction.endTime,
          status: auction.status,
          subscribersCount: auction.subscribers.length
        }
      });
    } catch (error) {
      logger.error('Create auction error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getAuctions(req: AuthRequest, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      let query: any = {};
      
      if (req.user?.role === 'admin') {
        query.createdBy = req.user.userId;
      } else {
        query.status = { $in: ['active', 'extended'] };
      }

      const auctions = await Auction.find(query)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Auction.countDocuments(query);

      res.json({
        success: true,
        auctions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Get auctions error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }


async getAuction(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const auction = await Auction.findById(id)
      .populate('createdBy', 'name email')
      .populate('subscribers', 'name email');

    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }


    const bids = await Bid.find({ auctionId: id })
      .sort({ timestamp: -1 })
      .limit(10)
      .populate('bidderId', 'name email');


    const leaderboard = await Leaderboard.find({ auctionId: id })
      .sort({ rank: 1 })
      .limit(10);

    res.json({
      success: true,
      auction,
      recentBids: bids.map(bid => ({
        id: bid._id,
        amount: bid.amount,
        isValid: bid.isValid,
        timestamp: bid.timestamp,
        bidder: bid.bidderId,
      })),
      leaderboard: leaderboard.map(entry => ({
        rank: entry.rank,
        bidderId: entry.bidderId,
        bidderName: entry.bidderName,
        highestBid: entry.highestBid,
        lastBidTime: entry.lastBidTime,
        totalBids: entry.totalBids,
      }))
    });
  } catch (error) {
    logger.error('Get auction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async joinAuction(req: AuthRequest, res: Response) {
  try {
    const auctionId = req.params.id;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const auction = await Auction.findById(auctionId);

    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    if (!['active', 'extended'].includes(auction.status)) {
      return res.status(400).json({ error: 'Auction is not currently active' });
    }


    const alreadySubscribed = auction.subscribers.some((id: any) => id.toString() === userId);
    if (alreadySubscribed) {
      return res.status(400).json({ error: 'You have already joined this auction' });
    }

    auction.subscribers.push(new Types.ObjectId(userId));
    await auction.save();

    const user = await User.findById(userId);

    if (user) {
      await emailService.sendJoinConfirmation(user.email, auction);
    }

    res.json({ success: true, message: 'Successfully joined the auction' });
  } catch (error) {
    logger.error('Join auction error:', error);
    res.status(500).json({ error: 'Internal server error' });
 
  }
}


}
