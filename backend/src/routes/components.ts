import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { validateRequest } from '../middleware';
import { ComponentService } from '../services/components';
import { CompatibilityService } from '../services/compatibility';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';

const router = Router();
const componentService = new ComponentService();
const compatibilityService = new CompatibilityService();

// Validation schemas
const searchSchema = Joi.object({
  query: Joi.string().optional().max(200),
  category: Joi.string().optional().max(100),
  manufacturer: Joi.string().optional().max(100),
  voltageRange: Joi.object({
    min: Joi.number().min(0).max(50),
    max: Joi.number().min(0).max(50),
  }).optional(),
  protocols: Joi.array().items(Joi.string()).optional(),
  maxPrice: Joi.number().min(0).optional(),
});

const advancedSearchSchema = Joi.object({
  query: Joi.string().optional().max(200),
  category: Joi.string().optional().max(100),
  manufacturer: Joi.string().optional().max(100),
  voltageMin: Joi.number().min(0).max(50).optional(),
  voltageMax: Joi.number().min(0).max(50).optional(),
  currentMax: Joi.number().min(0).optional(),
  protocols: Joi.array().items(Joi.string()).optional(),
  priceMin: Joi.number().min(0).optional(),
  priceMax: Joi.number().min(0).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  availability: Joi.array().items(Joi.string()).optional(),
  sortBy: Joi.string().valid('name', 'price', 'created_at', 'popularity').optional(),
  sortOrder: Joi.string().valid('ASC', 'DESC').optional(),
  limit: Joi.number().min(1).max(100).optional(),
  offset: Joi.number().min(0).optional(),
});

// GET /api/components/search - Basic component search
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { query, category, manufacturer, voltageRange, protocols, maxPrice } = req.query;

    const filters: any = {};
    if (category) filters.category = category as string;
    if (manufacturer) filters.manufacturer = manufacturer as string;
    if (voltageRange) filters.voltageRange = JSON.parse(voltageRange as string);
    if (protocols) filters.protocols = JSON.parse(protocols as string);
    if (maxPrice) filters.maxPrice = parseFloat(maxPrice as string);

    const components = await componentService.searchComponents(
      query as string || '',
      filters
    );

    const response: ApiResponse<typeof components> = {
      success: true,
      data: components,
      timestamp: new Date(),
    };

    res.json(response);

  } catch (error) {
    logger.error('Component search error:', error);

    const response: ApiResponse = {
      success: false,
      error: 'SearchError',
      message: 'Failed to search components',
      timestamp: new Date(),
    };

    res.status(500).json(response);
  }
});

// POST /api/components/search/advanced - Advanced component search
router.post('/search/advanced', validateRequest(advancedSearchSchema), async (req: Request, res: Response) => {
  try {
    const searchOptions = req.body;

    const result = await componentService.searchComponentsAdvanced(searchOptions);

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
      timestamp: new Date(),
    };

    res.json(response);

  } catch (error) {
    logger.error('Advanced component search error:', error);

    const response: ApiResponse = {
      success: false,
      error: 'SearchError',
      message: 'Failed to perform advanced search',
      timestamp: new Date(),
    };

    res.status(500).json(response);
  }
});

// GET /api/components/:id - Get component by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const component = await componentService.getComponent(id);

    if (!component) {
      const response: ApiResponse = {
        success: false,
        error: 'NotFound',
        message: 'Component not found',
        timestamp: new Date(),
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<typeof component> = {
      success: true,
      data: component,
      timestamp: new Date(),
    };

    res.json(response);

  } catch (error) {
    logger.error('Get component error:', error);

    const response: ApiResponse = {
      success: false,
      error: 'ComponentError',
      message: 'Failed to get component',
      timestamp: new Date(),
    };

    res.status(500).json(response);
  }
});

// GET /api/components/:id/compatibility/:boardId - Check component compatibility
router.get('/:id/compatibility/:boardId', async (req: Request, res: Response) => {
  try {
    const { id, boardId } = req.params;

    const compatibility = await compatibilityService.checkCompatibility(boardId, id);

    const response: ApiResponse<typeof compatibility> = {
      success: true,
      data: compatibility,
      timestamp: new Date(),
    };

    res.json(response);

  } catch (error) {
    logger.error('Component compatibility check error:', error);

    const response: ApiResponse = {
      success: false,
      error: 'CompatibilityError',
      message: 'Failed to check compatibility',
      timestamp: new Date(),
    };

    res.status(500).json(response);
  }
});

// GET /api/components/category/:category - Get components by category
router.get('/category/:category', async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    const components = await componentService.getComponentsByCategory(category, limit);

    const response: ApiResponse<typeof components> = {
      success: true,
      data: components,
      timestamp: new Date(),
    };

    res.json(response);

  } catch (error) {
    logger.error('Get components by category error:', error);

    const response: ApiResponse = {
      success: false,
      error: 'ComponentError',
      message: 'Failed to get components by category',
      timestamp: new Date(),
    };

    res.status(500).json(response);
  }
});

// GET /api/components/manufacturer/:manufacturer - Get components by manufacturer
router.get('/manufacturer/:manufacturer', async (req: Request, res: Response) => {
  try {
    const { manufacturer } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    const components = await componentService.getComponentsByManufacturer(manufacturer, limit);

    const response: ApiResponse<typeof components> = {
      success: true,
      data: components,
      timestamp: new Date(),
    };

    res.json(response);

  } catch (error) {
    logger.error('Get components by manufacturer error:', error);

    const response: ApiResponse = {
      success: false,
      error: 'ComponentError',
      message: 'Failed to get components by manufacturer',
      timestamp: new Date(),
    };

    res.status(500).json(response);
  }
});

// GET /api/components/compatible/:boardId - Get compatible components for board
router.get('/compatible/:boardId', async (req: Request, res: Response) => {
  try {
    const { boardId } = req.params;
    const { category } = req.query;

    const components = await componentService.getCompatibleComponents(
      boardId,
      category as string
    );

    const response: ApiResponse<typeof components> = {
      success: true,
      data: components,
      timestamp: new Date(),
    };

    res.json(response);

  } catch (error) {
    logger.error('Get compatible components error:', error);

    const response: ApiResponse = {
      success: false,
      error: 'ComponentError',
      message: 'Failed to get compatible components',
      timestamp: new Date(),
    };

    res.status(500).json(response);
  }
});

// GET /api/components/popular - Get popular components
router.get('/popular', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const components = await componentService.getPopularComponents(limit);

    const response: ApiResponse<typeof components> = {
      success: true,
      data: components,
      timestamp: new Date(),
    };

    res.json(response);

  } catch (error) {
    logger.error('Get popular components error:', error);

    const response: ApiResponse = {
      success: false,
      error: 'ComponentError',
      message: 'Failed to get popular components',
      timestamp: new Date(),
    };

    res.status(500).json(response);
  }
});

// GET /api/components/stats - Get component statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await componentService.getComponentStats();

    const response: ApiResponse<typeof stats> = {
      success: true,
      data: stats,
      timestamp: new Date(),
    };

    res.json(response);

  } catch (error) {
    logger.error('Get component stats error:', error);

    const response: ApiResponse = {
      success: false,
      error: 'StatsError',
      message: 'Failed to get component statistics',
      timestamp: new Date(),
    };

    res.status(500).json(response);
  }
});

export default router;