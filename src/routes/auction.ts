import { Router } from 'express';
import { AuctionController } from '../controllers/auctionController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { validateSchema, createAuctionSchema } from '../middleware/validation';

const router = Router();
const auctionController = new AuctionController();

router.post(
  '/',
  authenticateToken,
  requireAdmin,
  validateSchema(createAuctionSchema),
  auctionController.createAuction
);

router.get('/', authenticateToken, auctionController.getAuctions);
router.get('/:id', auctionController.getAuction);
router.post('/:id/join', authenticateToken, auctionController.joinAuction);

export { router as auctionRoutes };