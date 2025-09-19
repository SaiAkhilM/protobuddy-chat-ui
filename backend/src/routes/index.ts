import { Router } from 'express';
import chatRoutes from './chat';
import componentRoutes from './components';
import scrapeRoutes from './scrape';
import cacheRoutes from './cache';

const router = Router();

// API Routes
router.use('/chat', chatRoutes);
router.use('/components', componentRoutes);
router.use('/scrape', scrapeRoutes);
router.use('/cache', cacheRoutes);

export default router;