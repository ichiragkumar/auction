import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { validateSchema, registerSchema, loginSchema } from '../middleware/validation';

const router = Router();
const authController = new AuthController();

router.post('/register', validateSchema(registerSchema), authController.register);
router.post('/login', validateSchema(loginSchema), authController.login);

export { router as authRoutes };