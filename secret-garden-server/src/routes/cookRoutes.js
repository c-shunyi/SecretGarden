import express from 'express';
import { protect } from '../middleware/auth.js';
import * as cookController from '../controllers/cookController.js';

const router = express.Router();

router.use(protect);

router.get('/status', cookController.getStatus);
router.post('/record', cookController.createRecord);

export default router;
