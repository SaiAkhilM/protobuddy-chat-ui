# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ProtoBuddy is a hardware component recommendation chat interface built as a React application with Vite. The current frontend provides a chat UI that's designed to be connected to a backend system for hardware component recommendations, compatibility checking, and technical guidance for makers and engineers.

## Development Commands

**Development Server**
```bash
npm run dev        # Start development server on port 8080
```

**Build Commands**
```bash
npm run build      # Production build
npm run build:dev  # Development build
npm run preview    # Preview production build
```

**Code Quality**
```bash
npm run lint       # Run ESLint for code quality checks
```

Note: There are currently no test scripts configured. When implementing the backend and additional features, consider adding test commands to package.json.

## Architecture

### Frontend Stack
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with SWC plugin for fast compilation
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom theme configuration
- **Router**: React Router DOM for client-side routing
- **State Management**: TanStack Query for server state, local useState for UI state

### Project Structure
```
src/
├── components/
│   ├── ProtoBuddy.tsx    # Main chat interface component
│   └── ui/               # shadcn/ui component library
├── pages/
│   ├── Index.tsx         # Home page with ProtoBuddy chat
│   └── NotFound.tsx      # 404 page
├── hooks/                # Custom React hooks (toast, mobile detection)
├── lib/                  # Utility functions
└── App.tsx               # App shell with routing and providers
```

### Key Components

**ProtoBuddy.tsx** (`src/components/ProtoBuddy.tsx`)
- Main chat interface with message history
- Currently mock implementation with placeholder responses
- Designed to accept `onSendMessage` callback prop for backend integration
- Uses Lucide React icons for hardware-themed UI elements
- Implements typing indicators and smooth scrolling

### Configuration Files

**Vite Configuration**
- Server runs on port 8080 with IPv6 support (`host: "::"`)
- Path alias `@` points to `./src`
- Lovable tagger plugin enabled in development mode

**TypeScript Configuration**
- Uses modern React 18 JSX transform
- Strict mode enabled with comprehensive type checking
- Path mapping configured for `@/*` imports

**ESLint Configuration**
- TypeScript ESLint with React hooks and refresh plugins
- Unused variables warnings disabled (`@typescript-eslint/no-unused-vars: "off"`)
- Modern flat config format

**Tailwind Configuration**
- Custom theme with CSS variables for theming
- Typography plugin enabled for rich text content
- Component aliases configured in `components.json`

### Development Notes

**Package Manager**: Project uses npm with package-lock.json. Also has bun.lockb, suggesting Bun compatibility.

**UI Components**: Extensive shadcn/ui component library available including:
- Form components (Input, Button, Select, etc.)
- Layout components (Card, Sheet, Dialog, etc.)
- Data display (Charts via Recharts, Tables, etc.)
- Navigation (Tabs, Pagination, Command palette)

**Styling Approach**:
- Tailwind utility classes for styling
- CSS custom properties for theme variables
- Dark mode support via next-themes
- Responsive design utilities

### Integration Points for Backend

The current frontend is prepared for backend integration with:

1. **Message Handler**: `onSendMessage` prop in ProtoBuddy component
2. **Message Interface**: Defined TypeScript interfaces for chat messages
3. **Query Client**: TanStack Query configured for server state management
4. **Environment**: No environment variables currently configured (add for API keys)

### Planned Backend Architecture (from user requirements)

The user intends to build:
- Node.js/Express or Python/FastAPI backend
- Claude API integration for natural conversation
- Apify for scraping component datasheets and tutorials
- Redis caching for component data
- Compatibility checking engine for Arduino/hardware components

**Suggested Environment Variables**:
```env
ANTHROPIC_API_KEY=    # For Claude API
APIFY_API_TOKEN=      # For web scraping
REDIS_URL=           # For caching
```

### Development Workflow

1. Frontend development can continue independently using the mock chat interface
2. Backend API can be developed in parallel and connected via the `onSendMessage` callback
3. The existing UI components support rich content display for component recommendations
4. TanStack Query is configured for efficient API state management once backend endpoints are available

### Code Style

- TypeScript strict mode enabled
- React functional components with hooks
- Tailwind utility classes preferred over custom CSS
- Component composition pattern with shadcn/ui
- Path aliases used for clean imports (`@/components`, `@/lib`, etc.)