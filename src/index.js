// Main application entry point
import express from 'express';
import cors from 'cors';
import config from './config/config.js';
import apiRoutes from './api/routes.js';
import { query } from './db/database.js';
import taskManager from './services/taskManager.js';

// Create Express application
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api', apiRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'Automation Service API',
    version: '1.0.0',
    status: 'running',
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: config.server.environment === 'development' ? err.message : undefined,
  });
});

// Start the server
const server = app.listen(config.server.port, () => {
  console.log(`Server running on port ${config.server.port} in ${config.server.environment} mode`);
});

// Test database connection
query('SELECT NOW()')
  .then(result => {
    console.log('Database connection successful:', result.rows[0]);
  })
  .catch(error => {
    console.error('Database connection failed:', error);
  });

// Task scheduler (runs every minute)
setInterval(async () => {
  try {
    // Get pending tasks
    const pendingTasks = await taskManager.getPendingTasks();
    
    if (pendingTasks.length > 0) {
      console.log(`Found ${pendingTasks.length} pending tasks to execute`);
      
      // Execute each task
      for (const task of pendingTasks) {
        console.log(`Executing task: ${task.id} - ${task.name}`);
        
        // Execute task asynchronously
        taskManager.executeTask(task.id).catch(error => {
          console.error(`Task execution error for task ${task.id}:`, error);
        });
      }
    }
  } catch (error) {
    console.error('Task scheduler error:', error);
  }
}, 60000); // 60 seconds

// Graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function shutdown() {
  console.log('Shutting down server...');
  
  // Close server
  server.close(() => {
    console.log('HTTP server closed');
  });
  
  // Close database pool
  try {
    const { pool } = await import('./db/database.js');
    await pool.end();
    console.log('Database connections closed');
  } catch (error) {
    console.error('Error closing database connections:', error);
  }
  
  // Close browser instances
  try {
    const browserService = await import('./services/browser.js');
    await browserService.default.close();
    console.log('Browser instances closed');
  } catch (error) {
    console.error('Error closing browser instances:', error);
  }
  
  process.exit(0);
}

export default app;
