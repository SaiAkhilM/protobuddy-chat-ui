import Anthropic from 'anthropic';
import { config } from '../config';
import { logger, logApiCall, logApiError } from '../utils/logger';
import { ChatMessage, Recommendation, CompatibilityCheck } from '../types';

export interface IntentAnalysis {
  type: 'component_search' | 'compatibility_check' | 'project_help' | 'troubleshooting' | 'general';
  confidence: number;
  parameters: {
    query?: string;
    filters?: any;
    board?: string;
    component?: string;
    projectType?: string;
    difficulty?: string;
    [key: string]: any;
  };
  entities: Array<{
    type: string;
    value: string;
    confidence: number;
  }>;
}

export class ClaudeService {
  private client: Anthropic;

  constructor() {
    if (!config.apis.anthropic.apiKey) {
      logger.warn('Anthropic API key not configured - Claude features will be limited');
    }

    this.client = new Anthropic({
      apiKey: config.apis.anthropic.apiKey || 'dummy-key',
    });
  }

  async analyzeIntent(message: string, context?: any): Promise<IntentAnalysis> {
    const startTime = Date.now();

    try {
      const prompt = `
Analyze the user's message and determine their intent for a hardware component assistant.

User message: "${message}"
${context ? `Context: ${JSON.stringify(context, null, 2)}` : ''}

Determine the intent type from:
- component_search: Looking for specific components or types of components
- compatibility_check: Asking about compatibility between components/boards
- project_help: Asking for help with a project or what components are needed
- troubleshooting: Having issues with existing setup/components
- general: General questions or conversation

Extract relevant parameters and entities (component names, board types, specifications, etc.).

Respond with JSON only:
{
  "type": "intent_type",
  "confidence": 0.8,
  "parameters": {
    "query": "extracted search terms",
    "board": "board type if mentioned",
    "component": "component if mentioned",
    "projectType": "project type if mentioned",
    "difficulty": "beginner/intermediate/advanced if mentioned"
  },
  "entities": [
    {"type": "board", "value": "Arduino Uno", "confidence": 0.9},
    {"type": "component", "value": "temperature sensor", "confidence": 0.8}
  ]
}`;

      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        temperature: 0.1,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        const analysis = JSON.parse(content.text);

        logApiCall('Claude', 'intent-analysis', Date.now() - startTime, true);

        return analysis;
      }

      throw new Error('Invalid response format from Claude');

    } catch (error) {
      logApiError('Claude', 'intent-analysis', error as Error);

      // Fallback intent analysis
      return this.fallbackIntentAnalysis(message);
    }
  }

  async generateComponentRecommendations(
    userMessage: string,
    recommendations: Recommendation[],
    parameters: any
  ): Promise<ChatMessage> {
    const startTime = Date.now();

    try {
      const prompt = `
You are ProtoBuddy, an expert hardware component assistant. Generate a helpful response about component recommendations.

User asked: "${userMessage}"
Search parameters: ${JSON.stringify(parameters, null, 2)}

Recommendations found:
${recommendations.map((rec, i) => `
${i + 1}. ${rec.component.name} by ${rec.component.manufacturer}
   - Score: ${rec.score}/100
   - Category: ${rec.component.category}
   - Voltage: ${JSON.stringify(rec.component.specifications?.voltage)}
   - Communication: ${rec.component.specifications?.communication?.map(c => c.type).join(', ') || 'None'}
   - Price: ${rec.component.price ? '$' + rec.component.price : 'Unknown'}
   - Description: ${rec.component.description}
`).join('')}

Provide a conversational, helpful response that:
1. Acknowledges their request
2. Explains the recommendations briefly
3. Highlights key differences or benefits
4. Suggests next steps (wiring, compatibility checks, tutorials)
5. Uses a friendly, knowledgeable tone

Keep response under 300 words and include specific technical details.`;

      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        logApiCall('Claude', 'component-recommendations', Date.now() - startTime, true);

        return {
          id: `msg-${Date.now()}`,
          content: content.text,
          sender: 'assistant',
          timestamp: new Date(),
        };
      }

      throw new Error('Invalid response format from Claude');

    } catch (error) {
      logApiError('Claude', 'component-recommendations', error as Error);

      return this.fallbackComponentResponse(userMessage, recommendations);
    }
  }

  async generateCompatibilityResponse(
    userMessage: string,
    compatibilityCheck: CompatibilityCheck,
    parameters: any
  ): Promise<ChatMessage> {
    const startTime = Date.now();

    try {
      const prompt = `
You are ProtoBuddy, an expert hardware component assistant. Generate a response about compatibility between components.

User asked: "${userMessage}"
Parameters: ${JSON.stringify(parameters, null, 2)}

Compatibility Analysis:
- Compatible: ${compatibilityCheck.compatible}
- Score: ${compatibilityCheck.score}/100
- Issues found: ${compatibilityCheck.issues.length}

Issues:
${compatibilityCheck.issues.map(issue => `
- ${issue.severity.toUpperCase()}: ${issue.message}
  ${issue.solution ? `Solution: ${issue.solution}` : ''}
`).join('')}

Suggestions:
${compatibilityCheck.suggestions.map(s => `- ${s}`).join('\n')}

Provide a clear, helpful response that:
1. Directly answers if they're compatible
2. Explains any issues in simple terms
3. Provides specific solutions or alternatives
4. Includes wiring or setup advice if relevant
5. Uses a supportive, educational tone

Keep response under 250 words.`;

      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1200,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        logApiCall('Claude', 'compatibility-response', Date.now() - startTime, true);

        return {
          id: `msg-${Date.now()}`,
          content: content.text,
          sender: 'assistant',
          timestamp: new Date(),
        };
      }

      throw new Error('Invalid response format from Claude');

    } catch (error) {
      logApiError('Claude', 'compatibility-response', error as Error);

      return this.fallbackCompatibilityResponse(userMessage, compatibilityCheck);
    }
  }

  async generateProjectResponse(
    userMessage: string,
    components: any[],
    parameters: any
  ): Promise<ChatMessage> {
    const startTime = Date.now();

    try {
      const prompt = `
You are ProtoBuddy, an expert hardware project assistant. Help with project planning and component selection.

User asked: "${userMessage}"
Project parameters: ${JSON.stringify(parameters, null, 2)}

Recommended components:
${components.map((comp, i) => `
${i + 1}. ${comp.name} - ${comp.category}
   - Purpose: ${comp.purpose}
   - Difficulty: ${comp.difficulty}
   - Price: ${comp.price ? '$' + comp.price : 'Unknown'}
`).join('')}

Provide a comprehensive project response that:
1. Acknowledges their project idea
2. Lists essential components with explanations
3. Suggests project phases or steps
4. Mentions difficulty level and time estimates
5. Includes learning resources or tutorials
6. Warns about potential challenges

Keep response under 400 words and be encouraging.`;

      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1800,
        temperature: 0.4,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        logApiCall('Claude', 'project-response', Date.now() - startTime, true);

        return {
          id: `msg-${Date.now()}`,
          content: content.text,
          sender: 'assistant',
          timestamp: new Date(),
        };
      }

      throw new Error('Invalid response format from Claude');

    } catch (error) {
      logApiError('Claude', 'project-response', error as Error);

      return this.fallbackProjectResponse(userMessage, components);
    }
  }

  async generateTroubleshootingResponse(
    userMessage: string,
    parameters: any,
    context?: any
  ): Promise<ChatMessage> {
    const startTime = Date.now();

    try {
      const prompt = `
You are ProtoBuddy, an expert hardware troubleshooting assistant. Help diagnose and solve hardware issues.

User's problem: "${userMessage}"
Parameters: ${JSON.stringify(parameters, null, 2)}
${context ? `Context: ${JSON.stringify(context, null, 2)}` : ''}

Provide a systematic troubleshooting response that:
1. Acknowledges the problem
2. Asks clarifying questions if needed
3. Lists most common causes in order of likelihood
4. Provides step-by-step debugging steps
5. Suggests tools or techniques for diagnosis
6. Offers alternative solutions
7. Uses clear, non-intimidating language

Keep response under 350 words and be methodical.`;

      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1600,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        logApiCall('Claude', 'troubleshooting-response', Date.now() - startTime, true);

        return {
          id: `msg-${Date.now()}`,
          content: content.text,
          sender: 'assistant',
          timestamp: new Date(),
        };
      }

      throw new Error('Invalid response format from Claude');

    } catch (error) {
      logApiError('Claude', 'troubleshooting-response', error as Error);

      return this.fallbackTroubleshootingResponse(userMessage);
    }
  }

  async generateGeneralResponse(
    userMessage: string,
    messageHistory: ChatMessage[],
    context?: any
  ): Promise<ChatMessage> {
    const startTime = Date.now();

    try {
      const prompt = `
You are ProtoBuddy, a friendly and knowledgeable hardware component assistant. Respond to general questions about electronics, Arduino, Raspberry Pi, and maker projects.

Current message: "${userMessage}"

Recent conversation:
${messageHistory.slice(-3).map(msg => `${msg.sender}: ${msg.content}`).join('\n')}

${context ? `Context: ${JSON.stringify(context, null, 2)}` : ''}

Provide a helpful, conversational response that:
1. Answers their question clearly
2. Provides relevant technical details
3. Suggests related topics or next steps
4. Uses encouraging, educational tone
5. Stays focused on hardware/electronics topics

Keep response under 200 words unless more detail is specifically needed.`;

      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        temperature: 0.5,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        logApiCall('Claude', 'general-response', Date.now() - startTime, true);

        return {
          id: `msg-${Date.now()}`,
          content: content.text,
          sender: 'assistant',
          timestamp: new Date(),
        };
      }

      throw new Error('Invalid response format from Claude');

    } catch (error) {
      logApiError('Claude', 'general-response', error as Error);

      return this.fallbackGeneralResponse(userMessage);
    }
  }

  async generateHelpResponse(userMessage: string, helpText: string): Promise<ChatMessage> {
    return {
      id: `msg-${Date.now()}`,
      content: helpText,
      sender: 'assistant',
      timestamp: new Date(),
    };
  }

  // Fallback methods for when Claude API is unavailable
  private fallbackIntentAnalysis(message: string): IntentAnalysis {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('compatible') || lowerMessage.includes('work with')) {
      return {
        type: 'compatibility_check',
        confidence: 0.7,
        parameters: {},
        entities: [],
      };
    }

    if (lowerMessage.includes('sensor') || lowerMessage.includes('component') || lowerMessage.includes('need')) {
      return {
        type: 'component_search',
        confidence: 0.7,
        parameters: { query: message },
        entities: [],
      };
    }

    if (lowerMessage.includes('project') || lowerMessage.includes('build')) {
      return {
        type: 'project_help',
        confidence: 0.7,
        parameters: {},
        entities: [],
      };
    }

    if (lowerMessage.includes('not working') || lowerMessage.includes('problem') || lowerMessage.includes('error')) {
      return {
        type: 'troubleshooting',
        confidence: 0.7,
        parameters: {},
        entities: [],
      };
    }

    return {
      type: 'general',
      confidence: 0.5,
      parameters: {},
      entities: [],
    };
  }

  private fallbackComponentResponse(userMessage: string, recommendations: Recommendation[]): ChatMessage {
    const topRec = recommendations[0];
    const content = topRec ?
      `I found ${recommendations.length} components for your request. The top recommendation is the ${topRec.component.name} by ${topRec.component.manufacturer}. It's a ${topRec.component.category} that should work well for your project. Would you like more details about any of these components?` :
      `I couldn't find specific components matching your request. Could you provide more details about what you're looking for? For example, what type of sensor or component, and what board are you using?`;

    return {
      id: `msg-${Date.now()}`,
      content,
      sender: 'assistant',
      timestamp: new Date(),
    };
  }

  private fallbackCompatibilityResponse(userMessage: string, check: CompatibilityCheck): ChatMessage {
    const content = check.compatible ?
      `Yes, these components should be compatible! I found a compatibility score of ${check.score}/100. ${check.suggestions.length > 0 ? 'Here are some suggestions: ' + check.suggestions.join(', ') : ''}` :
      `I found some compatibility issues. Score: ${check.score}/100. Main concerns: ${check.issues.map(i => i.message).join(', ')}. ${check.suggestions.length > 0 ? 'Suggestions: ' + check.suggestions.join(', ') : ''}`;

    return {
      id: `msg-${Date.now()}`,
      content,
      sender: 'assistant',
      timestamp: new Date(),
    };
  }

  private fallbackProjectResponse(userMessage: string, components: any[]): ChatMessage {
    const content = `For your project, you'll need several components including ${components.slice(0, 3).map(c => c.name).join(', ')}. This looks like a ${components[0]?.difficulty || 'moderate'} difficulty project. I recommend starting with the core components and building up from there.`;

    return {
      id: `msg-${Date.now()}`,
      content,
      sender: 'assistant',
      timestamp: new Date(),
    };
  }

  private fallbackTroubleshootingResponse(userMessage: string): ChatMessage {
    const content = `I understand you're having issues. Let's troubleshoot this step by step. First, check your connections and power supply. Then verify your code and library versions. Can you describe the specific symptoms you're seeing?`;

    return {
      id: `msg-${Date.now()}`,
      content,
      sender: 'assistant',
      timestamp: new Date(),
    };
  }

  private fallbackGeneralResponse(userMessage: string): ChatMessage {
    const content = `I'd be happy to help with your hardware question! I specialize in Arduino, Raspberry Pi, and component compatibility. Can you provide more specific details about what you're working on?`;

    return {
      id: `msg-${Date.now()}`,
      content,
      sender: 'assistant',
      timestamp: new Date(),
    };
  }
}