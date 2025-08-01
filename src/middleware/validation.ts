import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export const validateSchema = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.details.map(d => d.message) 
      });
    }
    next();
  };
};


export const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  name: Joi.string().min(2).required(),
  role: Joi.string().valid('admin', 'user').optional()
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

export const createAuctionSchema = Joi.object({
  productName: Joi.string().min(2).max(200).required(),
  reservePrice: Joi.number().min(0).required(),
  durationHours: Joi.number().min(1).max(168).optional() // Max 1 week
});

export const placeBidSchema = Joi.object({
  auctionId: Joi.string().required(),
  amount: Joi.number().min(0).required()
});