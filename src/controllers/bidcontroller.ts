import { Request, Response } from 'express';
import { Auction } from '../models/Auction';
import { Bid } from '../models/Bid';
import { Leaderboard } from '../models/Leaderboard';
import { User } from '../models/User';
import { AuthRequest } from '../middleware/auth';





export class BidController {
  async placeBid(req: AuthRequest, res: Response) {
    try {
      const { auctionId, amount } = req.body;
      const userId = req?.user?.userId;
      if(!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }


      const auction = await Auction.findById(auctionId);
      if (!auction || auction.status !== 'active') {
        return res.status(400).json({ message: 'Auction is not active' });
      }


      if (amount < auction.reservePrice) {
        return res.status(400).json({ message: 'Bid amount is less than the reserve price' });
      }


      const bid = new Bid({
        auctionId,
        bidderId: userId,
        amount,
      });

      await bid.save();


      await this.updateLeaderboard(auctionId, userId, amount);

      return res.status(201).json({ message: 'Bid placed successfully' });
    } catch (error) {
      console.error('[placeBid]', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  async getBids(req: Request, res: Response) {
    try {
      const { auctionId } = req.params;


      const bids = await Bid.find({ auctionId }).sort({ amount: -1 });

      return res.status(200).json({ bids });
    } catch (error) {
      console.error('[getBids]', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  async getLeaderboard(req: Request, res: Response) {
    try {
      const { auctionId } = req.params;


      const leaderboard = await Leaderboard.find({ auctionId }).sort({ rank: 1 });

      return res.status(200).json({ leaderboard });
    } catch (error) {
      console.error('[getLeaderboard]', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  private async updateLeaderboard(auctionId: string, bidderId: string, amount: number) {
    let entry = await Leaderboard.findOne({ auctionId, bidderId });

    if (entry) {
      entry.highestBid = amount;
      entry.lastBidTime = new Date();
      entry.totalBids += 1;
    } else {
      const bidder = await User.findById(bidderId);
      entry = new Leaderboard({
        auctionId,
        bidderId,
        bidderName: bidder?.name,
        highestBid: amount,
        rank: 0, 
        lastBidTime: new Date(),
        totalBids: 1,
      });
    }

    await entry.save();

    const entries = await Leaderboard.find({ auctionId }).sort({ highestBid: -1 });
    for (let i = 0; i < entries.length; i++) {
      entries[i].rank = i + 1;
      await entries[i].save();
    }
  }
}
