#!/bin/bash

# ProtoBuddy Deployment Script
# This script helps deploy ProtoBuddy to various cloud platforms

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check environment variables
check_env_vars() {
    local required_vars=("ANTHROPIC_API_KEY" "APIFY_API_TOKEN")
    local missing_vars=()

    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing_vars+=("$var")
        fi
    done

    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        print_error "Missing required environment variables:"
        printf '%s\n' "${missing_vars[@]}"
        return 1
    fi

    return 0
}

# Function to deploy with Docker Compose
deploy_docker_compose() {
    print_status "Deploying with Docker Compose..."

    if [[ ! -f "docker-compose.yml" ]]; then
        print_error "docker-compose.yml not found!"
        return 1
    fi

    # Check if .env.production exists
    if [[ -f ".env.production" ]]; then
        print_status "Using .env.production for environment variables"
        cp .env.production .env
    fi

    # Build and start services
    docker-compose down --remove-orphans
    docker-compose build --no-cache
    docker-compose up -d

    # Wait for services to be ready
    print_status "Waiting for services to start..."
    sleep 30

    # Check health
    if curl -f http://localhost:3001/health >/dev/null 2>&1; then
        print_success "Backend is healthy!"
    else
        print_error "Backend health check failed"
        docker-compose logs backend
        return 1
    fi

    if curl -f http://localhost:8080/health >/dev/null 2>&1; then
        print_success "Frontend is healthy!"
    else
        print_error "Frontend health check failed"
        docker-compose logs frontend
        return 1
    fi

    print_success "Docker Compose deployment completed!"
    echo ""
    echo "🎉 ProtoBuddy is now running!"
    echo "Frontend: http://localhost:8080"
    echo "Backend API: http://localhost:3001"
    echo ""
    echo "To view logs: docker-compose logs -f"
    echo "To stop: docker-compose down"
}

# Function to deploy to Railway
deploy_railway() {
    print_status "Deploying to Railway..."

    if ! command_exists railway; then
        print_error "Railway CLI not found. Install it from: https://docs.railway.app/develop/cli"
        return 1
    fi

    # Login check
    if ! railway whoami >/dev/null 2>&1; then
        print_warning "Not logged in to Railway. Please run: railway login"
        return 1
    fi

    # Deploy
    railway up --detach

    print_success "Railway deployment initiated!"
    echo "Check deployment status: railway status"
}

# Function to deploy to Render
deploy_render() {
    print_status "Deploying to Render..."

    if [[ -z "$RENDER_API_KEY" ]]; then
        print_error "RENDER_API_KEY environment variable not set"
        return 1
    fi

    print_status "Render deployment requires manual setup via render.yaml"
    print_status "Please commit render.yaml and connect your repository to Render"
    print_success "Render configuration is ready!"
}

# Function to deploy to Vercel (Frontend only)
deploy_vercel() {
    print_status "Deploying frontend to Vercel..."

    if ! command_exists vercel; then
        print_error "Vercel CLI not found. Install it: npm install -g vercel"
        return 1
    fi

    # Login check
    if ! vercel whoami >/dev/null 2>&1; then
        print_warning "Not logged in to Vercel. Please run: vercel login"
        return 1
    fi

    # Deploy
    vercel --prod

    print_success "Vercel deployment completed!"
}

# Function to deploy to Fly.io
deploy_fly() {
    print_status "Deploying to Fly.io..."

    if ! command_exists flyctl; then
        print_error "Fly.io CLI not found. Install it from: https://fly.io/docs/getting-started/installing-flyctl/"
        return 1
    fi

    # Check if logged in
    if ! flyctl auth whoami >/dev/null 2>&1; then
        print_warning "Not logged in to Fly.io. Please run: flyctl auth login"
        return 1
    fi

    # Deploy backend
    cd backend
    if [[ ! -f "fly.toml" ]]; then
        flyctl launch --no-deploy
    fi

    flyctl deploy

    cd ..
    print_success "Fly.io deployment completed!"
}

# Function to deploy to Kubernetes
deploy_kubernetes() {
    print_status "Deploying to Kubernetes..."

    if ! command_exists kubectl; then
        print_error "kubectl not found. Please install Kubernetes CLI"
        return 1
    fi

    # Check cluster connection
    if ! kubectl cluster-info >/dev/null 2>&1; then
        print_error "Not connected to a Kubernetes cluster"
        return 1
    fi

    # Apply configurations
    kubectl apply -f kubernetes/namespace.yaml
    kubectl apply -f kubernetes/secrets.yaml
    kubectl apply -f kubernetes/postgres-deployment.yaml
    kubectl apply -f kubernetes/redis-deployment.yaml

    # Wait for databases to be ready
    print_status "Waiting for databases to be ready..."
    kubectl wait --for=condition=ready pod -l app=postgres -n protobuddy --timeout=300s
    kubectl wait --for=condition=ready pod -l app=redis -n protobuddy --timeout=300s

    # Deploy backend
    kubectl apply -f kubernetes/backend-deployment.yaml

    # Wait for backend to be ready
    kubectl wait --for=condition=ready pod -l app=protobuddy-backend -n protobuddy --timeout=300s

    print_success "Kubernetes deployment completed!"
    echo ""
    echo "To check status: kubectl get pods -n protobuddy"
    echo "To view logs: kubectl logs -l app=protobuddy-backend -n protobuddy"
}

# Function to setup monitoring
setup_monitoring() {
    print_status "Setting up monitoring..."

    # Create monitoring directory if it doesn't exist
    mkdir -p monitoring

    # Basic monitoring setup with docker-compose
    cat > monitoring/docker-compose.monitoring.yml << EOF
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    networks:
      - monitoring

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
    networks:
      - monitoring

volumes:
  grafana_data:

networks:
  monitoring:
    driver: bridge
EOF

    cat > monitoring/prometheus.yml << EOF
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'protobuddy-backend'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'protobuddy-frontend'
    static_configs:
      - targets: ['localhost:8080']
    metrics_path: '/metrics'
    scrape_interval: 30s
EOF

    print_success "Monitoring setup completed!"
    echo "Start monitoring: cd monitoring && docker-compose -f docker-compose.monitoring.yml up -d"
    echo "Prometheus: http://localhost:9090"
    echo "Grafana: http://localhost:3000 (admin/admin)"
}

# Main deployment function
main() {
    print_status "🚀 ProtoBuddy Deployment Script"
    echo ""

    # Parse command line arguments
    case "${1:-docker}" in
        docker)
            deploy_docker_compose
            ;;
        railway)
            deploy_railway
            ;;
        render)
            deploy_render
            ;;
        vercel)
            deploy_vercel
            ;;
        fly)
            deploy_fly
            ;;
        kubernetes|k8s)
            deploy_kubernetes
            ;;
        monitoring)
            setup_monitoring
            ;;
        all)
            print_status "Deploying to all platforms..."
            deploy_docker_compose
            setup_monitoring
            print_success "All deployments completed!"
            ;;
        *)
            echo "Usage: $0 [docker|railway|render|vercel|fly|kubernetes|monitoring|all]"
            echo ""
            echo "Available deployment targets:"
            echo "  docker      - Deploy with Docker Compose (default)"
            echo "  railway     - Deploy to Railway"
            echo "  render      - Deploy to Render"
            echo "  vercel      - Deploy frontend to Vercel"
            echo "  fly         - Deploy to Fly.io"
            echo "  kubernetes  - Deploy to Kubernetes"
            echo "  monitoring  - Setup monitoring stack"
            echo "  all         - Deploy locally with monitoring"
            exit 1
            ;;
    esac
}

# Check prerequisites
if ! command_exists docker; then
    print_error "Docker is required but not installed."
    exit 1
fi

if ! command_exists curl; then
    print_error "curl is required but not installed."
    exit 1
fi

# Run main function
main "$@"