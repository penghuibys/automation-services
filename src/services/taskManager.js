// Task manager service for handling automation tasks
import { query, transaction } from '../db/database.js';
import browserService from './browser.js';
import openaiService from './openai.js';

class TaskManager {
  /**
   * Create a new automation task
   * @param {Object} taskData - Task data
   * @returns {Object} - Created task
   */
  async createTask(taskData) {
    try {
      const { name, description, url, config, scheduled_for, user_id } = taskData;
      
      const result = await query(
        `INSERT INTO tasks 
         (name, description, url, config, scheduled_for, user_id, status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING *`,
        [name, description, url, config, scheduled_for, user_id, 'pending']
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Failed to create task:', error);
      throw error;
    }
  }

  /**
   * Get a task by ID
   * @param {string} taskId - Task ID
   * @returns {Object} - Task data
   */
  async getTask(taskId) {
    try {
      const result = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);
      
      if (result.rows.length === 0) {
        throw new Error(`Task with ID ${taskId} not found`);
      }
      
      return result.rows[0];
    } catch (error) {
      console.error(`Failed to get task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Update a task
   * @param {string} taskId - Task ID
   * @param {Object} updateData - Data to update
   * @returns {Object} - Updated task
   */
  async updateTask(taskId, updateData) {
    try {
      // Build the SET clause dynamically based on provided fields
      const allowedFields = ['name', 'description', 'url', 'status', 'config', 'scheduled_for'];
      const updates = [];
      const values = [];
      
      let paramIndex = 1;
      
      for (const [key, value] of Object.entries(updateData)) {
        if (allowedFields.includes(key)) {
          updates.push(`${key} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      }
      
      // Add updated_at timestamp
      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      
      // Add taskId as the last parameter
      values.push(taskId);
      
      const result = await query(
        `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );
      
      if (result.rows.length === 0) {
        throw new Error(`Task with ID ${taskId} not found`);
      }
      
      return result.rows[0];
    } catch (error) {
      console.error(`Failed to update task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a task
   * @param {string} taskId - Task ID
   * @returns {boolean} - Success status
   */
  async deleteTask(taskId) {
    try {
      const result = await query('DELETE FROM tasks WHERE id = $1 RETURNING id', [taskId]);
      
      if (result.rows.length === 0) {
        throw new Error(`Task with ID ${taskId} not found`);
      }
      
      return true;
    } catch (error) {
      console.error(`Failed to delete task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Execute an automation task
   * @param {string} taskId - Task ID
   * @returns {Object} - Task result
   */
  async executeTask(taskId) {
    try {
      // Get task data
      const task = await this.getTask(taskId);
      
      // Update task status to running
      await this.updateTask(taskId, { status: 'running' });
      
      // Log task start
      await this.logTask(taskId, 'info', 'Task execution started');
      
      const startTime = Date.now();
      let rawData = null;
      let normalizedData = null;
      let error = null;
      
      try {
        // Initialize browser if needed
        if (!browserService.browser) {
          await browserService.initialize();
        }
        
        // Create a new browser context
        await browserService.createContext({
          userDataKey: task.config.userDataKey,
        });
        
        // Handle login if credentials are provided
        if (task.config.credentials) {
          await browserService.login(task.config.credentials);
          await this.logTask(taskId, 'info', 'Login successful');
        }
        
        // Navigate to URL
        await browserService.navigate(task.url);
        
        // Extract data based on configuration
        rawData = await browserService.extractData({
          selectors: task.config.selectors || [],
        });
        
        await this.logTask(taskId, 'info', 'Data extraction completed', { dataSize: JSON.stringify(rawData).length });
        
        // Process data with OpenAI if needed
        if (task.config.processWithAI) {
          normalizedData = await openaiService.processData(rawData, {
            task: task.config.aiTask || 'Extract and normalize the key information',
            format: task.config.outputFormat || 'json',
            schema: task.config.outputSchema,
          });
          
          await this.logTask(taskId, 'info', 'AI processing completed', { dataSize: JSON.stringify(normalizedData).length });
        } else {
          normalizedData = rawData;
        }
        
        // Take screenshot if requested
        if (task.config.takeScreenshot) {
          const screenshot = await browserService.takeScreenshot({
            fullPage: task.config.fullPageScreenshot || false,
          });
          
          // Store screenshot in database or file system
          // This is a simplified example - in a real app, you'd store this properly
          await this.logTask(taskId, 'info', 'Screenshot captured', { screenshotSize: screenshot.length });
        }
      } catch (err) {
        error = err.message;
        await this.logTask(taskId, 'error', `Task execution failed: ${err.message}`, { stack: err.stack });
      } finally {
        // Close browser context
        if (browserService.context) {
          await browserService.context.close();
        }
      }
      
      const processingTime = Date.now() - startTime;
      
      // Store task result
      const taskResult = await transaction(async (client) => {
        // Insert task result
        const resultQuery = `
          INSERT INTO task_results 
          (task_id, raw_data, normalized_data, processing_time, status, error) 
          VALUES ($1, $2, $3, $4, $5, $6) 
          RETURNING *
        `;
        
        const resultValues = [
          taskId,
          rawData ? JSON.stringify(rawData) : null,
          normalizedData ? JSON.stringify(normalizedData) : null,
          processingTime,
          error ? 'failed' : 'completed',
          error,
        ];
        
        const resultRes = await client.query(resultQuery, resultValues);
        
        // Update task status
        const taskQuery = `
          UPDATE tasks 
          SET status = $1, completed_at = CURRENT_TIMESTAMP, error = $2, updated_at = CURRENT_TIMESTAMP 
          WHERE id = $3 
          RETURNING *
        `;
        
        const taskValues = [error ? 'failed' : 'completed', error, taskId];
        
        await client.query(taskQuery, taskValues);
        
        return resultRes.rows[0];
      });
      
      await this.logTask(
        taskId, 
        'info', 
        `Task execution ${error ? 'failed' : 'completed'}`, 
        { processingTime }
      );
      
      return {
        taskId,
        resultId: taskResult.id,
        status: error ? 'failed' : 'completed',
        processingTime,
        error,
        rawData,
        normalizedData,
      };
    } catch (error) {
      console.error(`Failed to execute task ${taskId}:`, error);
      
      // Update task status to failed
      await this.updateTask(taskId, { 
        status: 'failed', 
        error: error.message,
        completed_at: new Date(),
      });
      
      await this.logTask(taskId, 'error', `Task execution failed: ${error.message}`, { stack: error.stack });
      
      throw error;
    }
  }

  /**
   * Log a task event
   * @param {string} taskId - Task ID
   * @param {string} level - Log level (info, warning, error)
   * @param {string} message - Log message
   * @param {Object} metadata - Additional metadata
   */
  async logTask(taskId, level, message, metadata = {}) {
    try {
      await query(
        'INSERT INTO task_logs (task_id, level, message, metadata) VALUES ($1, $2, $3, $4)',
        [taskId, level, message, JSON.stringify(metadata)]
      );
    } catch (error) {
      console.error(`Failed to log task ${taskId}:`, error);
      // Don't throw here to prevent disrupting the main task flow
    }
  }

  /**
   * Get task logs
   * @param {string} taskId - Task ID
   * @returns {Array} - Task logs
   */
  async getTaskLogs(taskId) {
    try {
      const result = await query(
        'SELECT * FROM task_logs WHERE task_id = $1 ORDER BY created_at ASC',
        [taskId]
      );
      
      return result.rows;
    } catch (error) {
      console.error(`Failed to get logs for task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Get task result
   * @param {string} taskId - Task ID
   * @returns {Object} - Task result
   */
  async getTaskResult(taskId) {
    try {
      const result = await query(
        'SELECT * FROM task_results WHERE task_id = $1 ORDER BY created_at DESC LIMIT 1',
        [taskId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      console.error(`Failed to get result for task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Get pending tasks that are scheduled to run
   * @returns {Array} - Pending tasks
   */
  async getPendingTasks() {
    try {
      const result = await query(
        `SELECT * FROM tasks 
         WHERE status = 'pending' 
         AND (scheduled_for IS NULL OR scheduled_for <= CURRENT_TIMESTAMP) 
         ORDER BY scheduled_for ASC NULLS LAST`,
        []
      );
      
      return result.rows;
    } catch (error) {
      console.error('Failed to get pending tasks:', error);
      throw error;
    }
  }
}

export default new TaskManager();