import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';
import { validateRequest } from '../middleware';
import { ClaudeService } from '../services/claude';
import { ComponentService } from '../services/components';
import { CompatibilityService } from '../services/compatibility';
import { cache } from '../database/connection';
import { cacheKeys } from '../config';
import { logger, logUserInteraction } from '../utils/logger';
import { ApiResponse, ChatMessage } from '../types';

const router = Router();
const claudeService = new ClaudeService();
const componentService = new ComponentService();
const compatibilityService = new CompatibilityService();

// Validation schemas
const chatMessageSchema = Joi.object({
  message: Joi.string().required().min(1).max(1000),
  sessionId: Joi.string().optional(),
  context: Joi.object({
    currentProject: Joi.string().optional(),
    selectedBoard: Joi.string().optional(),
    requirements: Joi.object().optional(),
  }).optional(),
});

// POST /api/chat - Main chat endpoint
router.post('/', validateRequest(chatMessageSchema), async (req: Request, res: Response) => {
  try {
    const { message, sessionId: providedSessionId, context } = req.body;
    const sessionId = providedSessionId || uuidv4();

    logUserInteraction(sessionId, 'chat_message', { message: message.substring(0, 100) });

    // Get or create session
    const sessionKey = cacheKeys.session(sessionId);
    let sessionData: any = {};

    try {
      const cachedSession = await cache.get(sessionKey);
      if (cachedSession) {
        sessionData = JSON.parse(cachedSession);
      }
    } catch (error) {
      logger.warn('Failed to load session data', { sessionId, error });
    }

    // Build conversation history
    const messages: ChatMessage[] = sessionData.messages || [];
    const userMessage: ChatMessage = {
      id: uuidv4(),
      content: message,
      sender: 'user',
      timestamp: new Date(),
    };

    messages.push(userMessage);

    // Analyze user intent and gather context
    const intent = await claudeService.analyzeIntent(message, context);
    logger.info('User intent analyzed', { sessionId, intent: intent.type });

    let assistantResponse: ChatMessage;
    let recommendations: any[] = [];
    let compatibilityCheck: any = null;

    // Handle different types of requests
    switch (intent.type) {
      case 'component_search':
        const searchResults = await componentService.searchComponents(
          intent.parameters.query,
          intent.parameters.filters
        );

        recommendations = await Promise.all(
          searchResults.slice(0, 5).map(async (component) => {
            const score = await compatibilityService.calculateCompatibilityScore(
              intent.parameters.board || 'arduino-uno',
              component.id
            );
            return {
              component,
              score,
              reason: `Compatible ${component.category} with ${component.specifications?.communication?.length || 0} communication protocols`,
            };
          })
        );

        assistantResponse = await claudeService.generateComponentRecommendations(
          message,
          recommendations,
          intent.parameters
        );
        break;

      case 'compatibility_check':
        if (intent.parameters.board && intent.parameters.component) {
          compatibilityCheck = await compatibilityService.checkCompatibility(
            intent.parameters.board,
            intent.parameters.component
          );

          assistantResponse = await claudeService.generateCompatibilityResponse(
            message,
            compatibilityCheck,
            intent.parameters
          );
        } else {
          assistantResponse = await claudeService.generateHelpResponse(
            message,
            'I need more information about the board and component you want to check for compatibility. Could you specify both?'
          );
        }
        break;

      case 'project_help':
        const projectComponents = await componentService.getProjectRecommendations(
          intent.parameters.projectType,
          intent.parameters.difficulty
        );

        assistantResponse = await claudeService.generateProjectResponse(
          message,
          projectComponents,
          intent.parameters
        );
        break;

      case 'troubleshooting':
        assistantResponse = await claudeService.generateTroubleshootingResponse(
          message,
          intent.parameters,
          sessionData.context
        );
        break;

      default:
        // General conversation
        assistantResponse = await claudeService.generateGeneralResponse(
          message,
          messages.slice(-5), // Last 5 messages for context
          context
        );
    }

    // Add context to response
    assistantResponse.context = {
      recommendations,
      compatibility: compatibilityCheck,
    };

    messages.push(assistantResponse);

    // Update session
    sessionData = {
      sessionId,
      messages: messages.slice(-20), // Keep last 20 messages
      context: { ...sessionData.context, ...context },
      lastActive: new Date(),
    };

    // Cache session data
    try {
      await cache.set(sessionKey, JSON.stringify(sessionData), 3600); // 1 hour TTL
    } catch (error) {
      logger.warn('Failed to cache session data', { sessionId, error });
    }

    logUserInteraction(sessionId, 'response_generated', {
      intent: intent.type,
      recommendationCount: recommendations.length,
      hasCompatibilityCheck: !!compatibilityCheck,
    });

    const response: ApiResponse<{
      message: ChatMessage;
      sessionId: string;
      recommendations?: any[];
      compatibility?: any;
    }> = {
      success: true,
      data: {
        message: assistantResponse,
        sessionId,
        recommendations: recommendations.length > 0 ? recommendations : undefined,
        compatibility: compatibilityCheck || undefined,
      },
      timestamp: new Date(),
    };

    res.json(response);

  } catch (error) {
    logger.error('Chat endpoint error', error);

    const response: ApiResponse = {
      success: false,
      error: 'ChatError',
      message: 'Failed to process chat message',
      timestamp: new Date(),
    };

    res.status(500).json(response);
  }
});

// GET /api/chat/sessions/:sessionId - Get session history
router.get('/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const sessionKey = cacheKeys.session(sessionId);

    const cachedSession = await cache.get(sessionKey);

    if (!cachedSession) {
      const response: ApiResponse = {
        success: false,
        error: 'SessionNotFound',
        message: 'Session not found',
        timestamp: new Date(),
      };
      return res.status(404).json(response);
    }

    const sessionData = JSON.parse(cachedSession);

    const response: ApiResponse<any> = {
      success: true,
      data: sessionData,
      timestamp: new Date(),
    };

    res.json(response);

  } catch (error) {
    logger.error('Get session error', error);

    const response: ApiResponse = {
      success: false,
      error: 'SessionError',
      message: 'Failed to retrieve session',
      timestamp: new Date(),
    };

    res.status(500).json(response);
  }
});

// DELETE /api/chat/sessions/:sessionId - Clear session
router.delete('/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const sessionKey = cacheKeys.session(sessionId);

    await cache.del(sessionKey);

    logUserInteraction(sessionId, 'session_cleared');

    const response: ApiResponse = {
      success: true,
      message: 'Session cleared successfully',
      timestamp: new Date(),
    };

    res.json(response);

  } catch (error) {
    logger.error('Clear session error', error);

    const response: ApiResponse = {
      success: false,
      error: 'SessionError',
      message: 'Failed to clear session',
      timestamp: new Date(),
    };

    res.status(500).json(response);
  }
});

// GET /api/chat/suggestions - Get conversation starters
router.get('/suggestions', async (req: Request, res: Response) => {
  try {
    const suggestions = [
      {
        id: 1,
        text: "I need a temperature sensor for my Arduino Uno",
        category: "component_search",
        tags: ["arduino", "sensor", "temperature"]
      },
      {
        id: 2,
        text: "Can I connect a 5V relay to a 3.3V board?",
        category: "compatibility",
        tags: ["voltage", "relay", "compatibility"]
      },
      {
        id: 3,
        text: "Help me build a home automation system",
        category: "project",
        tags: ["project", "automation", "iot"]
      },
      {
        id: 4,
        text: "My I2C sensor isn't working properly",
        category: "troubleshooting",
        tags: ["troubleshooting", "i2c", "sensor"]
      },
      {
        id: 5,
        text: "What components do I need for a robotic car?",
        category: "project",
        tags: ["project", "robot", "car", "beginner"]
      },
      {
        id: 6,
        text: "Compare ESP32 vs Arduino for WiFi projects",
        category: "comparison",
        tags: ["esp32", "arduino", "wifi", "comparison"]
      }
    ];

    const response: ApiResponse<typeof suggestions> = {
      success: true,
      data: suggestions,
      timestamp: new Date(),
    };

    res.json(response);

  } catch (error) {
    logger.error('Get suggestions error', error);

    const response: ApiResponse = {
      success: false,
      error: 'SuggestionsError',
      message: 'Failed to get suggestions',
      timestamp: new Date(),
    };

    res.status(500).json(response);
  }
});

export default router;