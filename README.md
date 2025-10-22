# Browser Automation Service

A powerful browser automation service using Playwright, integrated with OpenAI APIs and a PostgreSQL backend. This service is designed for automating login-gated web portals, normalizing data, and exposing clean APIs for seamless integration.

![Node.js](https://img.shields.io/badge/Node.js-14%2B-brightgreen)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-latest-blue)
![License](https://img.shields.io/badge/license-MIT-blue)

## Table of Contents
- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Browser Automation**: Automate web interactions using Playwright for reliable and fast browser control
- **AI-Powered Data Processing**: Normalize and process extracted data using OpenAI models
- **Persistent Storage**: Store automation tasks and results in PostgreSQL with robust data modeling
- **RESTful API**: Clean API endpoints for integration with other services and applications
- **Secure Authentication**: API key-based authentication with user management
- **Task Scheduling**: Schedule automation tasks to run at specific times or intervals
- **Session Management**: Save and reuse browser sessions for login-gated websites
- **Detailed Logging**: Comprehensive logging for debugging and monitoring task execution
- **Extensible Design**: Modular architecture allowing easy addition of new features and integrations

## Architecture

### Components

- **Browser Service**: Handles browser automation using Playwright with session persistence
- **OpenAI Service**: Processes and normalizes extracted data with customizable prompts
- **Task Manager**: Manages automation tasks lifecycle, scheduling, and execution
- **API Layer**: RESTful endpoints with authentication and validation
- **Database Layer**: PostgreSQL storage with optimized schemas for performance

### Database Schema

The service uses PostgreSQL with the following tables:
- **tasks**: Stores automation task information with scheduling and status tracking
- **task_results**: Stores the output of automation tasks with raw and normalized data
- **task_logs**: Detailed logs for debugging and monitoring task execution
- **users**: User management for authentication and access control
- **api_keys**: API key management for secure service access
- **credentials**: Encrypted storage for website login credentials

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL database (v10 or higher)
- OpenAI API key
- Git (for cloning the repository)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/penghuibys/automation-services.git
   cd automation-services
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Set up the database:
   ```bash
   # Create the database
   psql -c "CREATE DATABASE automation_service;"
   
   # Run the schema
   psql -d automation_service -f src/db/schema.sql
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

## Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=automation_service
DB_SSL=false

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4

# Browser Configuration
BROWSER_HEADLESS=true
BROWSER_SLOW_MO=0
BROWSER_DEFAULT_TIMEOUT=30000
BROWSER_USER_DATA_DIR=.browser-data
```

## Usage

Start the production server:
```bash
npm start
```

Or start the development server with auto-reload:
```bash
npm run dev
```

Check the service health:
```bash
curl http://localhost:3000/api/health
```

## API Documentation

### Authentication

All API requests (except health check) require an API key to be included in the `X-API-Key` header:
```
X-API-Key: your-api-key-here
```

### Endpoints

#### Health Check
- `GET /api/health` - Service health status

#### Tasks Management
- `POST /api/tasks` - Create a new automation task
- `GET /api/tasks` - Get all tasks for the authenticated user
- `GET /api/tasks/:id` - Get a specific task
- `PUT /api/tasks/:id` - Update a task
- `DELETE /api/tasks/:id` - Delete a task

#### Task Execution
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

## Development

Install development dependencies:
```bash
npm install --also=dev
```

Run the development server with auto-reload:
```bash
npm run dev
```

Code linting:
```bash
# Not yet configured - coming soon
```

## Testing

Run the test suite:
```bash
npm test
```

## Deployment

### Production Build

1. Ensure all environment variables are set properly in production
2. Run the production server:
   ```bash
   npm start
   ```

### Docker Deployment (Coming Soon)

Docker support will be added in a future release.

### Cloud Deployment

The service can be deployed to any cloud platform that supports Node.js applications:
- AWS Elastic Beanstalk
- Heroku
- Google Cloud Run
- Azure App Service

Ensure the PostgreSQL database is accessible from your deployment environment.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a pull request

Please ensure your code follows the existing style and includes appropriate tests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.