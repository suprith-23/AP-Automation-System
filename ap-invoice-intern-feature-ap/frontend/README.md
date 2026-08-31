# AP Automation - Frontend

This is the Next.js frontend application for the AP Automation System. It provides a modern, responsive user interface for uploading invoices, managing approvals, and viewing real-time extraction data.

## Technology Stack

- **Framework**: Next.js 14 (App Router)
- **UI Library**: React 18
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Testing**: Vitest + React Testing Library

## Prerequisites

- Node.js (v20 or higher recommended)
- npm

## Getting Started

### 1. Install Dependencies

Navigate to the `frontend` directory and install the required dependencies:

```bash
cd frontend
npm install
```

### 2. Environment Variables

If necessary, configure any required environment variables (e.g., pointing to the local backend API). By default, the application is configured to connect to the backend running at `http://localhost:8000`.

### 3. Run the Development Server

Start the local development server:

```bash
npm run dev
```

The application will be accessible at [http://localhost:3000](http://localhost:3000).

### 4. Build for Production

To create an optimized production build:

```bash
npm run build
npm run start
```

## Testing

Unit and component tests are run using Vitest. Note that the testing configuration resides in the top-level `testing/frontend/unit/` directory.

To execute the tests:

```bash
cd ../testing/frontend/unit
npx vitest run
```
