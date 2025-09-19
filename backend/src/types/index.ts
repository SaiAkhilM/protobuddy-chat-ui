export interface Component {
  id: string;
  name: string;
  manufacturer: string;
  category: string;
  description: string;
  specifications: ComponentSpec;
  compatibility: CompatibilityInfo;
  datasheetUrl?: string;
  imageUrl?: string;
  price?: number;
  availability: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ComponentSpec {
  voltage: {
    operating: { min: number; max: number; unit: string };
    input?: { min: number; max: number; unit: string };
    output?: { min: number; max: number; unit: string };
  };
  current: {
    operating: { typical: number; max: number; unit: string };
    standby?: { typical: number; unit: string };
  };
  communication: CommunicationProtocol[];
  pins: PinConfiguration[];
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: string;
  };
  temperature: {
    operating: { min: number; max: number; unit: string };
  };
  additional: Record<string, any>;
}

export interface CommunicationProtocol {
  type: 'I2C' | 'SPI' | 'UART' | 'PWM' | 'GPIO' | 'ADC' | 'OneWire' | 'CAN';
  details: {
    address?: string;
    speed?: string;
    pins?: string[];
    notes?: string;
  };
}

export interface PinConfiguration {
  number: number;
  name: string;
  type: 'power' | 'ground' | 'digital' | 'analog' | 'communication';
  function: string;
  voltage?: number;
  notes?: string;
}

export interface CompatibilityInfo {
  boards: string[];
  voltageCompatible: string[];
  conflictingComponents: string[];
  requiredLibraries: string[];
  notes: string[];
}

export interface Board {
  id: string;
  name: string;
  manufacturer: string;
  type: 'microcontroller' | 'sbc' | 'dev-board';
  specifications: BoardSpec;
  supportedProtocols: CommunicationProtocol[];
  pins: BoardPin[];
  compatibility: string[];
}

export interface BoardSpec {
  processor: string;
  clockSpeed: string;
  memory: {
    flash: string;
    sram: string;
    eeprom?: string;
  };
  voltage: {
    operating: number;
    io: number;
  };
  current: {
    input: { max: number; unit: string };
    output: { perPin: number; total: number; unit: string };
  };
}

export interface BoardPin {
  number: number;
  digitalPin?: number;
  analogPin?: number;
  name: string;
  functions: string[];
  voltage: number;
  currentMax: number;
  notes?: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  components: string[];
  board: string;
  tags: string[];
  tutorialUrl?: string;
  sourceUrl?: string;
  estimatedTime: string;
  cost: {
    min: number;
    max: number;
    currency: string;
  };
}

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  context?: {
    components?: Component[];
    recommendations?: Recommendation[];
    compatibility?: CompatibilityCheck;
  };
}

export interface Recommendation {
  component: Component;
  score: number;
  reason: string;
  alternatives: Component[];
  warnings?: string[];
  wiringInfo?: WiringInfo;
}

export interface CompatibilityCheck {
  compatible: boolean;
  issues: CompatibilityIssue[];
  suggestions: string[];
  score: number;
}

export interface CompatibilityIssue {
  type: 'voltage' | 'current' | 'protocol' | 'pins' | 'library';
  severity: 'error' | 'warning' | 'info';
  message: string;
  solution?: string;
}

export interface WiringInfo {
  connections: Connection[];
  diagram?: string;
  notes: string[];
}

export interface Connection {
  fromComponent: string;
  fromPin: string;
  toComponent: string;
  toPin: string;
  wireType?: string;
  notes?: string;
}

export interface ScrapedData {
  id: string;
  url: string;
  title: string;
  content: string;
  images: ScrapedImage[];
  pdfs: ScrapedPDF[];
  metadata: {
    scrapedAt: Date;
    source: string;
    type: 'datasheet' | 'tutorial' | 'product' | 'documentation';
  };
  processed: boolean;
  extractedData?: any;
}

export interface ScrapedImage {
  url: string;
  alt?: string;
  caption?: string;
  type: 'schematic' | 'pinout' | 'photo' | 'diagram';
  ocrText?: string;
  analyzed: boolean;
}

export interface ScrapedPDF {
  url: string;
  title?: string;
  pages: number;
  text: string;
  images: ScrapedImage[];
  metadata: {
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
}

export interface CacheKey {
  type: 'component' | 'compatibility' | 'project' | 'scrape';
  identifier: string;
  params?: Record<string, any>;
}

export interface RateLimitInfo {
  windowMs: number;
  maxRequests: number;
  remaining: number;
  resetTime: Date;
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';