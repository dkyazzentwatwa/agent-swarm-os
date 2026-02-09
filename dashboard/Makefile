.PHONY: help dev backend frontend install build clean stop test

# Default target - show help
help:
	@echo "Agent Squad Dashboard - Development Commands"
	@echo ""
	@echo "Usage:"
	@echo "  make dev          Start both backend and frontend in development mode"
	@echo "  make backend      Start only the backend server (port 3001)"
	@echo "  make frontend     Start only the frontend dev server (port 5173)"
	@echo "  make install      Install all dependencies (root, backend, frontend)"
	@echo "  make build        Build production frontend"
	@echo "  make test         Run backend tests"
	@echo "  make stop         Stop all running servers"
	@echo "  make clean        Clean node_modules and build artifacts"
	@echo ""

# Start both backend and frontend
dev:
	@echo "Starting Agent Squad Dashboard..."
	@echo "Backend will run on http://localhost:3001"
	@echo "Frontend will run on http://localhost:5173"
	@echo ""
	@npm run dev

# Start backend only
backend:
	@echo "Starting backend server on port 3001..."
	@cd backend && node server.js

# Start frontend only
frontend:
	@echo "Starting frontend dev server on port 5173..."
	@cd frontend && npm run dev

# Install all dependencies
install:
	@echo "Installing root dependencies..."
	@npm install
	@echo "Installing backend dependencies..."
	@cd backend && npm install
	@echo "Installing frontend dependencies..."
	@cd frontend && npm install
	@echo "✅ All dependencies installed!"

# Build production frontend
build:
	@echo "Building production frontend..."
	@cd frontend && npm run build
	@echo "✅ Build complete! Output in frontend/dist/"

# Run tests
test:
	@echo "Running backend tests..."
	@cd backend && npm test

# Stop all servers
stop:
	@echo "Stopping servers on ports 3001 and 5173..."
	@-lsof -ti:3001 | xargs kill -9 2>/dev/null || true
	@-lsof -ti:5173 | xargs kill -9 2>/dev/null || true
	@echo "✅ Servers stopped"

# Clean build artifacts and node_modules
clean:
	@echo "Cleaning build artifacts and dependencies..."
	@rm -rf node_modules
	@rm -rf backend/node_modules
	@rm -rf frontend/node_modules
	@rm -rf frontend/dist
	@echo "✅ Clean complete!"
