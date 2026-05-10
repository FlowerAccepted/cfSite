# Article System Project Structure

This document describes the directory structure and organization of the Article System implementation.

## Directory Structure

```
src/
├── types/              # TypeScript type definitions and error classes
│   ├── article.ts      # Core article system types
│   ├── errors.ts       # Custom error classes
│   ├── article.test.ts # Type definition tests
│   ├── errors.test.ts  # Error class tests
│   └── README.md       # Types documentation
│
├── services/           # Business logic services
│   ├── articleService.ts        # Article CRUD operations (planned)
│   ├── categoryService.ts       # Category management (planned)
│   ├── searchService.ts         # Search functionality (planned)
│   ├── externalLoaderService.ts # External content loading (planned)
│   └── README.md                # Services documentation
│
├── utils/              # Utility functions
│   ├── urlGenerator.ts    # URL name generation (planned)
│   ├── validation.ts      # Input validation (planned)
│   ├── textProcessing.ts  # Text processing utilities (planned)
│   └── README.md          # Utils documentation
│
├── tests/              # Test utilities and setup
│   └── setup.test.ts   # Testing framework verification
│
├── components/         # Astro UI components (existing)
├── pages/              # Astro pages (existing)
├── layouts/            # Astro layouts (existing)
└── styles/             # CSS/Tailwind styles (existing)
```

## Configuration Files

### `vitest.config.ts`
Vitest testing framework configuration:
- Test environment: Node.js
- Test file patterns: `src/**/*.{test,spec}.ts`
- Excludes: `node_modules`, `dist`, `fa-worker`

### `package.json`
Updated with test scripts:
- `npm test`: Run all tests once
- `npm run test:watch`: Run tests in watch mode
- `npm run test:ui`: Run tests with UI

## Testing Setup

### Testing Framework
- **Vitest**: Fast unit test framework
- **fast-check**: Property-based testing library
- **@vitest/ui**: Optional UI for test visualization

### Test Organization
- Unit tests: Co-located with source files (e.g., `article.test.ts`)
- Property-based tests: Integrated with unit tests
- Integration tests: In `src/tests/` directory

### Running Tests
```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui
```

## Type Definitions

### Core Types (`src/types/article.ts`)
- Article, Category, User entities
- Input/output types for operations
- Search and pagination types
- External content types

### Error Classes (`src/types/errors.ts`)
- Structured error hierarchy
- HTTP status code mapping
- Standard error response format

## Development Workflow

1. **Define Types**: Start with TypeScript interfaces in `src/types/`
2. **Implement Services**: Business logic in `src/services/`
3. **Create Utilities**: Helper functions in `src/utils/`
4. **Build UI Components**: Astro components in `src/components/`
5. **Create Pages**: Astro pages in `src/pages/`
6. **Write Tests**: Unit and property-based tests alongside code

## Next Steps

The following components will be implemented in subsequent tasks:

1. **Database Schema**: SQL schema for articles, categories, and associations
2. **URL Generation**: Utility for creating URL-safe article names
3. **Category Service**: Category management operations
4. **Article Service**: Core article CRUD operations
5. **Search Service**: Regex-based search functionality
6. **External Loader**: External content loading with timeout
7. **UI Components**: Astro components for article display and editing
8. **Pages**: Article plaza, detail, and editor pages

## Dependencies

### Production Dependencies
- `astro`: ^5.16.11 - Web framework
- `@astrojs/node`: ^9.5.5 - Node.js adapter
- `tailwindcss`: ^4.1.18 - CSS framework
- `@tailwindcss/vite`: ^4.1.18 - Tailwind Vite plugin
- `marked`: ^17.0.1 - Markdown parser
- `jsonwebtoken`: ^9.0.3 - JWT authentication

### Development Dependencies
- `vitest`: Testing framework
- `fast-check`: Property-based testing
- `@vitest/ui`: Test UI (optional)

## Design Principles

1. **Type Safety**: Comprehensive TypeScript types for all data structures
2. **Error Handling**: Structured error classes with proper HTTP status codes
3. **Testability**: Both unit and property-based tests for all components
4. **Separation of Concerns**: Clear separation between types, services, utilities, and UI
5. **Documentation**: README files in each major directory
6. **Incremental Development**: Build and test incrementally, task by task

## References

- Requirements: `.kiro/specs/article-system/requirements.md`
- Design: `.kiro/specs/article-system/design.md`
- Tasks: `.kiro/specs/article-system/tasks.md`
