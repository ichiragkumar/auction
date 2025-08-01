import { Router } from 'express';
import { authRoutes } from './auth';
import { auctionRoutes } from './auction';
import { bidRoutes } from './bid';

const router = Router();

router.use('/auth', authRoutes);
router.use('/auctions', auctionRoutes);
router.use('/bids', bidRoutes);


router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export { router as apiRoutes };