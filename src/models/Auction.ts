import mongoose, { Document, Schema } from 'mongoose';

export interface IAuction extends Document {
  productName: string;
  reservePrice: number;
  createdBy: mongoose.Types.ObjectId;
  startTime: Date;
  endTime: Date;
  status: 'pending' | 'active' | 'extended' | 'completed' | 'cancelled';
  subscribers: mongoose.Types.ObjectId[];
  extensionCount: number;
  lastExtendedAt?: Date;
  winner?: mongoose.Types.ObjectId;
  winningBid?: number;
  createdAt: Date;
}

const auctionSchema = new Schema<IAuction>({
  productName: {
    type: String,
    required: true,
    trim: true
  },
  reservePrice: {
    type: Number,
    required: true,
    min: 0
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'extended', 'completed', 'cancelled'],
    default: 'pending'
  },
  subscribers: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  extensionCount: {
    type: Number,
    default: 0
  },
  lastExtendedAt: {
    type: Date
  },
  winner: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  winningBid: {
    type: Number
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});


export const Auction = mongoose.model<IAuction>('Auction', auctionSchema);