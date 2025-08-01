import mongoose, { Document, Schema } from 'mongoose';

export interface IBid extends Document {
  auctionId: mongoose.Types.ObjectId;
  bidderId: mongoose.Types.ObjectId;
  amount: number;
  timestamp: Date;
  isValid: boolean;
}

const bidSchema = new Schema<IBid>({
  auctionId: {
    type: Schema.Types.ObjectId,
    ref: 'Auction',
    required: true
  },
  bidderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  isValid: {
    type: Boolean,
    default: true
  }
});

bidSchema.index({ auctionId: 1, amount: -1 });
bidSchema.index({ auctionId: 1, timestamp: -1 });

export const Bid = mongoose.model<IBid>('Bid', bidSchema);