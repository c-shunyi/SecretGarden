import express from 'express';
import { protect } from '../middleware/auth.js';
import * as pairController from '../controllers/pairController.js';

const router = express.Router();

router.use(protect);

router.get('/status', pairController.getStatus);
router.post('/invite', pairController.createInvite);
router.post('/accept', pairController.acceptInvite);

export default router;
