import { Router } from 'express';

import { authenticateToken } from '../middleware/auth';
import { validateSchema, placeBidSchema } from '../middleware/validation';

const router = Router();
const bidController = new BidController();

router.post('/', authenticateToken, validateSchema(placeBidSchema), bidController.placeBid);
router.get('/:auctionId', bidController.getBids);
router.get('/:auctionId/leaderboard', bidController.getLeaderboard);

export { router as bidRoutes };