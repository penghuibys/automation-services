// API routes for the automation service
import express from 'express';
import taskManager from '../services/taskManager.js';
import browserService from '../services/browser.js';
import openaiService from '../services/openai.js';
import { authenticateApiKey } from '../utils/auth.js';

const router = express.Router();

// Middleware to authenticate API requests
router.use(authenticateApiKey);

// Health check endpoint (no authentication required)
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', version: '1.0.0' });
});

/**
 * Task endpoints
 */

// Create a new task
router.post('/tasks', async (req, res) => {
  try {
    const taskData = req.body;
    
    // Add user ID from authenticated request
    taskData.user_id = req.user.id;
    
    const task = await taskManager.createTask(taskData);
    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all tasks for the authenticated user
router.get('/tasks', async (req, res) => {
  try {
    const result = await taskManager.query(
      'SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error getting tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get a specific task
router.get('/tasks/:id', async (req, res) => {
  try {
    const task = await taskManager.getTask(req.params.id);
    
    // Check if the task belongs to the authenticated user
    if (task.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized access to this task' });
    }
    
    res.status(200).json(task);
  } catch (error) {
    console.error(`Error getting task ${req.params.id}:`, error);
    
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Update a task
router.put('/tasks/:id', async (req, res) => {
  try {
    // Check if the task belongs to the authenticated user
    const task = await taskManager.getTask(req.params.id);
    
    if (task.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized access to this task' });
    }
    
    const updatedTask = await taskManager.updateTask(req.params.id, req.body);
    res.status(200).json(updatedTask);
  } catch (error) {
    console.error(`Error updating task ${req.params.id}:`, error);
    
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Delete a task
router.delete('/tasks/:id', async (req, res) => {
  try {
    // Check if the task belongs to the authenticated user
    const task = await taskManager.getTask(req.params.id);
    
    if (task.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized access to this task' });
    }
    
    await taskManager.deleteTask(req.params.id);
    res.status(204).end();
  } catch (error) {
    console.error(`Error deleting task ${req.params.id}:`, error);
    
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Execute a task
router.post('/tasks/:id/execute', async (req, res) => {
  try {
    // Check if the task belongs to the authenticated user
    const task = await taskManager.getTask(req.params.id);
    
    if (task.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized access to this task' });
    }
    
    // Start task execution (non-blocking)
    res.status(202).json({ message: 'Task execution started', taskId: req.params.id });
    
    // Execute the task asynchronously
    taskManager.executeTask(req.params.id).catch(error => {
      console.error(`Async task execution error for task ${req.params.id}:`, error);
    });
  } catch (error) {
    console.error(`Error executing task ${req.params.id}:`, error);
    
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Get task result
router.get('/tasks/:id/result', async (req, res) => {
  try {
    // Check if the task belongs to the authenticated user
    const task = await taskManager.getTask(req.params.id);
    
    if (task.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized access to this task' });
    }
    
    const result = await taskManager.getTaskResult(req.params.id);
    
    if (!result) {
      return res.status(404).json({ error: 'No result found for this task' });
    }
    
    res.status(200).json(result);
  } catch (error) {
    console.error(`Error getting result for task ${req.params.id}:`, error);
    
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Get task logs
router.get('/tasks/:id/logs', async (req, res) => {
  try {
    // Check if the task belongs to the authenticated user
    const task = await taskManager.getTask(req.params.id);
    
    if (task.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized access to this task' });
    }
    
    const logs = await taskManager.getTaskLogs(req.params.id);
    res.status(200).json(logs);
  } catch (error) {
    console.error(`Error getting logs for task ${req.params.id}:`, error);
    
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

/**
 * OpenAI integration endpoints
 */

// Process data with OpenAI
router.post('/ai/process', async (req, res) => {
  try {
    const { data, options } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: 'Data is required' });
    }
    
    const result = await openaiService.processData(data, options);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error processing data with OpenAI:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate automation instructions
router.post('/ai/generate-instructions', async (req, res) => {
  try {
    const { taskDescription } = req.body;
    
    if (!taskDescription) {
      return res.status(400).json({ error: 'Task description is required' });
    }
    
    const instructions = await openaiService.generateAutomationInstructions(taskDescription);
    res.status(200).json(instructions);
  } catch (error) {
    console.error('Error generating automation instructions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Analyze webpage
router.post('/ai/analyze-webpage', async (req, res) => {
  try {
    const { html, url } = req.body;
    
    if (!html || !url) {
      return res.status(400).json({ error: 'HTML and URL are required' });
    }
    
    const analysis = await openaiService.analyzeWebpage(html, url);
    res.status(200).json(analysis);
  } catch (error) {
    console.error('Error analyzing webpage:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;