# ProtoBuddy Backend

A comprehensive hardware component recommendation system with AI-powered chat interface, component compatibility checking, and advanced web scraping capabilities.

## Features

### 🧠 AI-Powered Chat
- Natural language processing with Claude API
- Intent analysis for component searches and compatibility checks
- Contextual recommendations and troubleshooting

### 🔍 Advanced Scraping
- **Arduino Documentation**: Scrapes official Arduino docs, hardware specs, and tutorials
- **PDF Processing**: Extracts text and performs OCR on schematics and datasheets
- **Image Analysis**: OCR for pinout diagrams and schematic analysis
- **Apify Integration**: Scalable web scraping with professional infrastructure

### ⚡ Compatibility Engine
- Voltage level compatibility checking
- Current requirement analysis
- Communication protocol validation (I2C, SPI, UART, etc.)
- Pin availability and conflict detection
- Library support verification

### 📊 Component Database
- Comprehensive component specifications
- Manufacturer data and availability
- Pricing information and alternatives
- Compatibility matrices and scores

### 🚀 Performance & Reliability
- Redis caching for fast responses
- Rate limiting and security middleware
- Comprehensive logging and monitoring
- PostgreSQL for robust data storage

## Quick Start

### Prerequisites
- Node.js 18+ and npm/yarn
- PostgreSQL 14+
- Redis 6+
- API Keys for Anthropic (Claude) and Apify

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Database setup**
   ```bash
   # Create PostgreSQL database
   createdb protobuddy

   # Run migrations
   npm run db:migrate

   # Seed with sample data
   npm run db:seed
   ```

4. **Start services**
   ```bash
   # Start Redis (if not running)
   redis-server

   # Start development server
   npm run dev
   ```

### Environment Variables

```env
# Server
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:8080

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/protobuddy

# Redis
REDIS_URL=redis://localhost:6379

# API Keys
ANTHROPIC_API_KEY=your_anthropic_key
APIFY_API_TOKEN=your_apify_token

# Scraping
SCRAPE_DELAY_MS=1000
MAX_CONCURRENT_SCRAPES=3

# Caching
CACHE_TTL_SECONDS=3600
```

## API Endpoints

### Chat API
```
POST   /api/chat                    # Send chat message
GET    /api/chat/sessions/:id       # Get session history
DELETE /api/chat/sessions/:id       # Clear session
GET    /api/chat/suggestions        # Get conversation starters
```

### Components API
```
GET    /api/components/search       # Search components
POST   /api/components/search/advanced # Advanced search
GET    /api/components/:id          # Get component details
GET    /api/components/:id/compatibility/:boardId # Check compatibility
GET    /api/components/category/:category # Get by category
GET    /api/components/popular      # Popular components
```

### Scraping API
```
POST   /api/scrape/url             # Scrape specific URL
POST   /api/scrape/arduino         # Scrape Arduino docs
GET    /api/scrape/queue           # View scraping queue
GET    /api/scrape/stats           # Scraping statistics
```

### Cache Management
```
GET    /api/cache/stats            # Cache statistics
GET    /api/cache/keys             # List cache keys
DELETE /api/cache/clear            # Clear cache patterns
```

## Architecture

### Core Services

**ClaudeService** (`src/services/claude.ts`)
- Intent analysis and conversation management
- Component recommendation generation
- Compatibility explanation and troubleshooting

**ComponentService** (`src/services/components.ts`)
- Component search and filtering
- Database operations and caching
- Statistics and analytics

**CompatibilityService** (`src/services/compatibility.ts`)
- Multi-factor compatibility analysis
- Scoring algorithms and issue detection
- Suggestion generation

**ArduinoScraper** (`src/scraping/actors/arduino-scraper.ts`)
- Arduino.cc documentation scraping
- Component datasheet extraction
- Tutorial and project parsing

### Data Processing

**PDFProcessor** (`src/scraping/processors/pdf-processor.ts`)
- PDF text extraction and parsing
- Technical specification extraction
- Document classification

**ImageProcessor** (`src/scraping/processors/image-processor.ts`)
- OCR for schematics and pinouts
- Image classification and analysis
- Component identification

### Database Schema

**Components Table**
- Comprehensive component specifications
- JSON fields for flexible data storage
- Full-text search capabilities

**Boards Table**
- Development board specifications
- Pin configurations and protocols
- Compatibility matrices

**Compatibility Cache**
- Pre-computed compatibility scores
- Issue detection and resolution
- Performance optimization

## Compatibility Engine

The compatibility engine performs comprehensive analysis across multiple factors:

### Voltage Compatibility
- Operating voltage ranges
- I/O voltage levels
- Level shifter recommendations

### Current Requirements
- Per-pin current limits
- Total current budget
- External power suggestions

### Protocol Support
- I2C, SPI, UART, PWM validation
- Pin assignment conflicts
- Software implementation options

### Physical Constraints
- Pin availability and conflicts
- Component dimensions
- Mounting considerations

### Library Dependencies
- Required Arduino libraries
- Platform compatibility
- Installation instructions

## Scraping System

### Supported Sources
- **Arduino.cc**: Official documentation and hardware specs
- **Component Datasheets**: PDF processing with OCR
- **Tutorial Sites**: Instructables, Hackster.io integration
- **Manufacturer Sites**: Adafruit, SparkFun, etc.

### Processing Pipeline
1. **URL Queue**: Prioritized scraping queue with retry logic
2. **Content Extraction**: HTML parsing and PDF processing
3. **Data Analysis**: OCR, specification extraction, categorization
4. **Database Storage**: Normalized data with search indexing
5. **Cache Population**: Fast lookup optimization

### Advanced Features
- **Schematic OCR**: Extract pin configurations from diagrams
- **Specification Mining**: Parse technical specifications from text
- **Image Classification**: Identify schematics, pinouts, photos
- **Duplicate Detection**: Avoid redundant data storage

## Development

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run test         # Run test suite
npm run lint         # Code linting
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed database with sample data
npm run scrape       # Manual scraping trigger
```

### Code Structure
```
src/
├── config/          # Configuration and environment
├── database/        # Database connection and schemas
├── middleware/      # Express middleware
├── routes/          # API route handlers
├── services/        # Business logic services
├── scraping/        # Web scraping infrastructure
│   ├── actors/      # Scraping implementations
│   └── processors/  # Data processing pipelines
├── types/           # TypeScript type definitions
└── utils/           # Utility functions and helpers
```

### Testing

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --grep "compatibility"

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage
```

## Deployment

### Production Setup

1. **Environment Configuration**
   ```bash
   NODE_ENV=production
   # Configure production database and Redis
   # Set API keys and security settings
   ```

2. **Database Migrations**
   ```bash
   npm run db:migrate
   ```

3. **Process Management**
   ```bash
   # Using PM2
   pm2 start dist/index.js --name protobuddy-backend

   # Or using systemd service
   sudo systemctl start protobuddy-backend
   ```

4. **Monitoring**
   - Application logs via Winston
   - Performance monitoring
   - Error tracking and alerting

### Scaling Considerations

- **Database**: Read replicas for search queries
- **Redis**: Clustering for cache distribution
- **Scraping**: Distributed queue processing
- **API**: Load balancing and rate limiting

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Development Guidelines

- Follow TypeScript strict mode
- Write comprehensive tests
- Document API changes
- Update compatibility matrices
- Test scraping with rate limits

## License

MIT License - see LICENSE file for details

## Support

- **Documentation**: [ProtoBuddy Docs](https://docs.protobuddy.ai)
- **Issues**: [GitHub Issues](https://github.com/protobuddy/backend/issues)
- **Discussions**: [GitHub Discussions](https://github.com/protobuddy/backend/discussions)