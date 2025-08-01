import mongoose, { Document, Schema } from 'mongoose';

export interface ILeaderboardEntry extends Document {
  auctionId: mongoose.Types.ObjectId;
  bidderId: mongoose.Types.ObjectId;
  bidderName: string;
  highestBid: number;
  rank: number;
  lastBidTime: Date;
  totalBids: number;
}

const leaderboardSchema = new Schema<ILeaderboardEntry>({
  auctionId: {
    type: Schema.Types.ObjectId,
    ref: 'Auction',
    required: true
  },
  bidderId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bidderName: {
    type: String,
    required: true
  },
  highestBid: {
    type: Number,
    required: true
  },
  rank: {
    type: Number,
    required: true
  },
  lastBidTime: {
    type: Date,
    required: true
  },
  totalBids: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

leaderboardSchema.index({ auctionId: 1, rank: 1 });
leaderboardSchema.index({ auctionId: 1, highestBid: -1 });

export const Leaderboard = mongoose.model<ILeaderboardEntry>('Leaderboard', leaderboardSchema);