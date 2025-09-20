#!/bin/bash

# ProtoBuddy Demo Startup Script

echo "🚀 Starting ProtoBuddy Demo..."

# Function to cleanup processes on exit
cleanup() {
    echo "🛑 Stopping ProtoBuddy Demo..."
    pkill -f "node.*demo-server.js" 2>/dev/null
    pkill -f "vite" 2>/dev/null
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM EXIT

# Start backend in background
echo "📡 Starting backend server..."
cd backend && node demo-server.js &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Check if backend started successfully
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ Backend is healthy at http://localhost:3001"
else
    echo "❌ Backend failed to start"
    exit 1
fi

# Start frontend
echo "🎨 Starting frontend server..."
cd .. && npm run dev &
FRONTEND_PID=$!

# Wait a moment for frontend to start
sleep 3

echo ""
echo "🎉 ProtoBuddy Demo is running!"
echo "👉 Frontend: http://localhost:8080"
echo "👉 Backend: http://localhost:3001"
echo ""
echo "💡 Try asking ProtoBuddy:"
echo "   - 'I need a temperature sensor for Arduino'"
echo "   - 'Are these components compatible?'"
echo "   - 'Help me build a weather station'"
echo ""
echo "Press Ctrl+C to stop both servers"

# Keep script running and monitor processes
while kill -0 $BACKEND_PID 2>/dev/null && kill -0 $FRONTEND_PID 2>/dev/null; do
    sleep 1
done

echo "❌ One of the servers stopped unexpectedly"