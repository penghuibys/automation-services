# Browser Automation Service

A powerful browser automation service using Playwright, integrated with OpenAI APIs and a PostgreSQL/Supabase backend. This service is designed for automating login-gated web portals, normalizing data, and exposing clean APIs.

## Features

- **Browser Automation**: Automate web interactions using Playwright
- **AI-Powered Data Processing**: Normalize and process extracted data using OpenAI
- **Persistent Storage**: Store automation tasks and results in PostgreSQL
- **RESTful API**: Clean API endpoints for integration with other services
- **Authentication**: Secure API key-based authentication
- **Task Scheduling**: Schedule automation tasks to run at specific times
- **Session Management**: Save and reuse browser sessions for login-gated websites

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- PostgreSQL database
- OpenAI API key

### Installation

1. Clone the repository

```bash
git clone https://github.com/penghuibys/automation-services.git
cd automation-services
```

2. Install dependencies

```bash
npm install
```

3. Set up environment variables

```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up the database

```bash
# Create the database
psql -c "CREATE DATABASE automation_service;"

# Run the schema
psql -d automation_service -f src/db/schema.sql
```

5. Start the server

```bash
npm start
```

## API Documentation

### Authentication

All API requests (except health check) require an API key to be included in the `X-API-Key` header.

### Endpoints

#### Tasks

- `POST /api/tasks` - Create a new automation task
- `GET /api/tasks` - Get all tasks for the authenticated user
- `GET /api/tasks/:id` - Get a specific task
- `PUT /api/tasks/:id` - Update a task
- `DELETE /api/tasks/:id` - Delete a task
- `POST /api/tasks/:id/execute` - Execute a task
- `GET /api/tasks/:id/result` - Get task result
- `GET /api/tasks/:id/logs` - Get task logs

#### OpenAI Integration

- `POST /api/ai/process` - Process data with OpenAI
- `POST /api/ai/generate-instructions` - Generate automation instructions
- `POST /api/ai/analyze-webpage` - Analyze a webpage for data extraction

### Example: Creating a Task

```json
POST /api/tasks
Content-Type: application/json
X-API-Key: your-api-key

{
  "name": "Extract Product Data",
  "description": "Extract product information from an e-commerce website",
  "url": "https://example.com/products",
  "config": {
    "selectors": [
      {
        "name": "productNames",
        "selector": ".product-name",
        "type": "text",
        "multiple": true
      },
      {
        "name": "productPrices",
        "selector": ".product-price",
        "type": "text",
        "multiple": true
      },
      {
        "name": "productImages",
        "selector": ".product-image img",
        "type": "attribute",
        "attribute": "src",
        "multiple": true
      }
    ],
    "processWithAI": true,
    "aiTask": "Extract and normalize product data into a structured format",
    "outputFormat": "json",
    "outputSchema": {
      "products": [
        {
          "name": "string",
          "price": "number",
          "imageUrl": "string"
        }
      ]
    }
  }
}
```

## Architecture

### Components

- **Browser Service**: Handles browser automation using Playwright
- **OpenAI Service**: Processes and normalizes extracted data
- **Task Manager**: Manages automation tasks and their execution
- **API Routes**: Exposes RESTful endpoints for service interaction
- **Database**: Stores tasks, results, logs, and user data

### Database Schema

- **tasks**: Stores automation task information
- **task_results**: Stores the output of automation tasks
- **task_logs**: Stores detailed logs for debugging
- **users**: Stores user information for authentication
- **api_keys**: Stores API keys for service access
- **credentials**: Stores encrypted credentials for website logins

## License

MIT
