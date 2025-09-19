# ProtoBuddy Deployment Guide

Complete guide for deploying ProtoBuddy to production environments.

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Node.js 18+ for local development
- API keys for Anthropic Claude and Apify

### 1. Clone and Setup
```bash
git clone https://github.com/yourusername/protobuddy-chat-ui
cd protobuddy-chat-ui
```

### 2. Configure Environment
```bash
# Copy production environment template
cp .env.production .env

# Edit .env with your API keys and configuration
# REQUIRED: ANTHROPIC_API_KEY, APIFY_API_TOKEN
```

### 3. Deploy with Docker Compose
```bash
./scripts/deploy.sh docker
```

That's it! ProtoBuddy will be running at:
- Frontend: http://localhost:8080
- Backend API: http://localhost:3001

## 🌐 Cloud Deployment Options

### 1. Railway (Recommended for Beginners)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
./scripts/deploy.sh railway
```

**Features:**
- Automatic database provisioning
- Free tier available
- Simple setup with render.yaml

### 2. Render.com
```bash
# Push render.yaml to your repository
git add render.yaml && git commit -m "Add Render configuration"
git push

# Connect repository to Render dashboard
./scripts/deploy.sh render
```

**Features:**
- Managed PostgreSQL and Redis
- Automatic SSL certificates
- Built-in monitoring

### 3. Vercel (Frontend) + Railway/Render (Backend)
```bash
# Deploy frontend to Vercel
npm install -g vercel
./scripts/deploy.sh vercel

# Deploy backend separately to Railway or Render
./scripts/deploy.sh railway
```

**Features:**
- Global CDN for frontend
- Serverless functions support
- Excellent performance

### 4. Fly.io (Advanced Users)
```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Deploy
./scripts/deploy.sh fly
```

**Features:**
- Global application deployment
- Edge computing capabilities
- Full control over infrastructure

### 5. Kubernetes (Enterprise)
```bash
# Ensure kubectl is configured
kubectl cluster-info

# Deploy to Kubernetes
./scripts/deploy.sh kubernetes
```

**Features:**
- Full container orchestration
- Horizontal scaling
- Production-grade reliability

## 🔧 Configuration

### Environment Variables

#### Required API Keys
```env
# Get from https://console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-...

# Get from https://console.apify.com
APIFY_API_TOKEN=apify_api_...
```

#### Database Configuration
```env
# PostgreSQL (automatically handled by cloud providers)
DATABASE_URL=postgresql://user:pass@host:5432/db

# Redis (automatically handled by cloud providers)
REDIS_URL=redis://user:pass@host:6379
```

#### Performance Tuning
```env
# Scraping performance
SCRAPE_DELAY_MS=2000          # Delay between requests
MAX_CONCURRENT_SCRAPES=2      # Concurrent scraping jobs
SCRAPE_TIMEOUT_MS=45000       # Request timeout

# Caching
CACHE_TTL_SECONDS=7200        # 2 hours
CACHE_MAX_SIZE=50000          # Max cached items

# Rate limiting
RATE_LIMIT_MAX_REQUESTS=100   # Requests per window
RATE_LIMIT_WINDOW_MS=900000   # 15 minutes
```

### Security Configuration
```env
# CORS (set to your frontend domain)
CORS_ORIGIN=https://your-domain.com

# Security keys (generate secure random strings)
JWT_SECRET=your-jwt-secret-here
ENCRYPTION_KEY=32-character-encryption-key
```

## 📊 Monitoring & Health Checks

### Setup Monitoring Stack
```bash
./scripts/deploy.sh monitoring
```

This sets up:
- **Prometheus** (metrics): http://localhost:9090
- **Grafana** (dashboards): http://localhost:3000

### Health Check Endpoints
- Backend: `GET /health`
- Frontend: `GET /health`
- Database: Built-in PostgreSQL health checks
- Cache: Built-in Redis health checks

### Application Metrics
The backend exposes metrics at `/metrics` including:
- API response times
- Database query performance
- Cache hit rates
- Scraping job success rates
- Component recommendation accuracy

## 🏗️ Architecture Overview

### Production Architecture
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Load Balancer │────│   Frontend       │────│   CDN/Cache     │
│   (Nginx/CF)    │    │   (React/Nginx)  │    │   (CloudFlare)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │
         ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Backend API   │────│   PostgreSQL     │────│   Redis Cache   │
│   (Node.js)     │    │   (Primary DB)   │    │   (Sessions)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │
         ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Scraping      │────│   External APIs  │────│   File Storage  │
│   Workers       │    │   (Claude/Apify) │    │   (Logs/Assets) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Container Architecture
- **Frontend Container**: Nginx serving React build + health checks
- **Backend Container**: Node.js API + scraping workers + OCR tools
- **Database Container**: PostgreSQL with initialization scripts
- **Cache Container**: Redis with persistence and authentication

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow
The included `.github/workflows/deploy.yml` provides:

1. **Testing**: Automated tests with PostgreSQL and Redis
2. **Building**: Multi-platform Docker image builds
3. **Security**: Container vulnerability scanning
4. **Deployment**: Automatic deployment to multiple platforms
5. **Notifications**: Slack/Discord deployment notifications

### Manual Deployment Steps
```bash
# 1. Test locally
docker-compose up -d
npm test

# 2. Build for production
docker build -t protobuddy-backend ./backend
docker build -t protobuddy-frontend .

# 3. Deploy to staging
./scripts/deploy.sh docker

# 4. Deploy to production
git tag v1.0.0
git push origin v1.0.0
# CI/CD pipeline automatically deploys
```

## 🛠️ Troubleshooting

### Common Issues

#### Backend Won't Start
```bash
# Check logs
docker-compose logs backend

# Common causes:
# - Missing API keys
# - Database connection issues
# - Port conflicts
```

#### Database Connection Issues
```bash
# Check database status
docker-compose exec postgres pg_isready -U protobuddy -d protobuddy

# Reset database
docker-compose down -v
docker-compose up -d postgres
docker-compose exec postgres psql -U protobuddy -d protobuddy -f /docker-entrypoint-initdb.d/01-schema.sql
```

#### Redis Connection Issues
```bash
# Check Redis status
docker-compose exec redis redis-cli ping

# Clear Redis cache
docker-compose exec redis redis-cli FLUSHALL
```

#### Scraping Not Working
```bash
# Check scraping queue
curl http://localhost:3001/api/scrape/queue

# Check Apify token
curl -H "Authorization: Bearer $APIFY_API_TOKEN" https://api.apify.com/v2/users/me
```

### Performance Optimization

#### Database Performance
```sql
-- Add indexes for frequently queried fields
CREATE INDEX CONCURRENTLY idx_components_search ON components USING gin(to_tsvector('english', name || ' ' || description));
CREATE INDEX CONCURRENTLY idx_compatibility_score ON compatibility_cache(score DESC) WHERE compatible = true;
```

#### Cache Optimization
```bash
# Monitor cache hit rates
redis-cli info stats | grep keyspace_hits

# Adjust TTL based on usage patterns
# High-frequency queries: longer TTL
# Real-time data: shorter TTL
```

#### Scraping Performance
- Increase `SCRAPE_DELAY_MS` if getting rate limited
- Decrease `MAX_CONCURRENT_SCRAPES` for stability
- Monitor Apify usage and quotas

## 🔐 Security Considerations

### Production Security Checklist
- [ ] Use strong, unique passwords for databases
- [ ] Enable SSL/TLS for all connections
- [ ] Set up firewall rules (only expose necessary ports)
- [ ] Regularly update Docker images
- [ ] Monitor for suspicious API usage
- [ ] Backup databases regularly
- [ ] Set up log aggregation and monitoring
- [ ] Use secrets management (not environment variables in production)

### API Rate Limiting
- Default: 100 requests per 15 minutes per IP
- Adjust based on expected traffic
- Consider implementing user-based rate limiting for authenticated users

### Data Privacy
- No personal data is stored by default
- Chat sessions are ephemeral (Redis TTL)
- Component data is publicly available technical information
- Consider GDPR compliance if serving EU users

## 📈 Scaling Considerations

### Horizontal Scaling
```yaml
# docker-compose.yml - scale backend
services:
  backend:
    # ... existing config
    deploy:
      replicas: 3

  # Add load balancer
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    # Configure upstream backends
```

### Database Scaling
- Read replicas for search queries
- Connection pooling with PgBouncer
- Consider moving to managed database (AWS RDS, Google Cloud SQL)

### Cache Scaling
- Redis Cluster for high availability
- Separate caches for different data types
- Consider Redis Enterprise for advanced features

### Monitoring at Scale
- Use Prometheus + Grafana for metrics
- Set up alerting for critical issues
- Log aggregation with ELK Stack or similar
- Application Performance Monitoring (APM) tools

## 🆘 Support

### Getting Help
- **Documentation**: Check this guide and README files
- **GitHub Issues**: Report bugs and request features
- **Community**: Join discussions in GitHub Discussions
- **Performance**: Monitor logs and metrics

### Professional Support
For enterprise deployments or custom modifications:
- Consulting services available
- Custom deployment assistance
- Performance optimization
- Security audits

---

**Next Steps**: Choose your deployment method and follow the specific guide above. Start with Docker Compose for local testing, then move to Railway or Render for production deployment.