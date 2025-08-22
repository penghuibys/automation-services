// Authentication utilities
import { query } from '../db/database.js';

/**
 * Middleware to authenticate API requests using API key
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const authenticateApiKey = async (req, res, next) => {
  try {
    // Skip authentication for health check endpoint
    if (req.path === '/health') {
      return next();
    }
    
    // Get API key from header
    const apiKey = req.header('X-API-Key');
    
    if (!apiKey) {
      return res.status(401).json({ error: 'API key is required' });
    }
    
    // Check if API key exists and is active
    const result = await query(
      `SELECT api_keys.*, users.id as user_id, users.email, users.role 
       FROM api_keys 
       JOIN users ON api_keys.user_id = users.id 
       WHERE api_keys.key = $1 AND api_keys.is_active = true 
       AND (api_keys.expires_at IS NULL OR api_keys.expires_at > CURRENT_TIMESTAMP)`,
      [apiKey]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired API key' });
    }
    
    const apiKeyData = result.rows[0];
    
    // Update last_used timestamp
    await query(
      'UPDATE api_keys SET last_used = CURRENT_TIMESTAMP WHERE id = $1',
      [apiKeyData.id]
    );
    
    // Add user data to request object
    req.user = {
      id: apiKeyData.user_id,
      email: apiKeyData.email,
      role: apiKeyData.role,
    };
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Generate a new API key
 * @param {string} userId - User ID
 * @param {string} name - API key name
 * @param {Date} expiresAt - Expiration date (optional)
 * @returns {Object} - Generated API key data
 */
export const generateApiKey = async (userId, name, expiresAt = null) => {
  try {
    // Generate a random API key
    const key = Buffer.from(Math.random().toString(36).substring(2) + Date.now().toString(36))
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 32);
    
    // Insert API key into database
    const result = await query(
      'INSERT INTO api_keys (user_id, key, name, expires_at) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, key, name, expiresAt]
    );
    
    return result.rows[0];
  } catch (error) {
    console.error('Failed to generate API key:', error);
    throw error;
  }
};

/**
 * Revoke an API key
 * @param {string} keyId - API key ID
 * @param {string} userId - User ID (for authorization)
 * @returns {boolean} - Success status
 */
export const revokeApiKey = async (keyId, userId) => {
  try {
    // Check if the API key belongs to the user
    const checkResult = await query(
      'SELECT id FROM api_keys WHERE id = $1 AND user_id = $2',
      [keyId, userId]
    );
    
    if (checkResult.rows.length === 0) {
      throw new Error('API key not found or unauthorized');
    }
    
    // Update API key status
    await query(
      'UPDATE api_keys SET is_active = false WHERE id = $1',
      [keyId]
    );
    
    return true;
  } catch (error) {
    console.error('Failed to revoke API key:', error);
    throw error;
  }
};