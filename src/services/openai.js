// OpenAI integration service for data processing
import OpenAI from 'openai';
import config from '../config/config.js';

class OpenAIService {
  constructor() {
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
    });
    this.model = config.openai.model;
  }

  /**
   * Process and normalize extracted data using OpenAI
   * @param {Object} rawData - Raw data extracted from web pages
   * @param {Object} options - Processing options
   * @param {string} options.task - Task description for the AI
   * @param {string} options.format - Desired output format (json, text, etc.)
   * @param {Object} options.schema - Schema for the output data
   * @returns {Object} - Processed and normalized data
   */
  async processData(rawData, options = {}) {
    try {
      const task = options.task || 'Extract and normalize the key information from this data';
      const format = options.format || 'json';
      
      // Prepare the system message
      let systemMessage = `You are a data extraction and normalization assistant. `;
      systemMessage += `Your task is to: ${task}. `;
      
      if (format === 'json' && options.schema) {
        systemMessage += `Return the data in JSON format according to this schema: ${JSON.stringify(options.schema)}`;
      } else if (format === 'json') {
        systemMessage += 'Return the data in a clean, normalized JSON format.';
      } else {
        systemMessage += `Return the data in ${format} format.`;
      }

      // Make the API call
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: JSON.stringify(rawData) }
        ],
        temperature: 0.3, // Lower temperature for more deterministic results
      });

      // Parse the response
      const content = response.choices[0].message.content;
      
      // If JSON format is requested, parse the response
      if (format === 'json') {
        try {
          // Extract JSON if it's wrapped in markdown code blocks
          const jsonMatch = content.match(/```(?:json)?\n([\s\S]+?)\n```/) || 
                           content.match(/({[\s\S]*})/); 
          
          const jsonString = jsonMatch ? jsonMatch[1] : content;
          return JSON.parse(jsonString);
        } catch (parseError) {
          console.error('Failed to parse JSON response:', parseError);
          return { error: 'Failed to parse JSON response', content };
        }
      }
      
      return { content };
    } catch (error) {
      console.error('OpenAI processing error:', error);
      throw error;
    }
  }

  /**
   * Generate browser automation instructions based on a task description
   * @param {string} taskDescription - Description of the automation task
   * @returns {Object} - Structured automation instructions
   */
  async generateAutomationInstructions(taskDescription) {
    try {
      const systemMessage = `
        You are an expert in browser automation. Your task is to generate structured instructions 
        for automating web interactions based on the user's description. 
        
        Return a JSON object with the following structure:
        {
          "steps": [
            {
              "type": "navigate" | "click" | "input" | "extract" | "wait" | "condition",
              "description": "Human-readable description of this step",
              "selector": "CSS selector for the element" (if applicable),
              "value": "Value to input" (if applicable),
              "waitFor": "Condition to wait for" (if applicable),
              "extractAs": "Name for extracted data" (if applicable)
            }
          ],
          "expectedOutput": {
            "description": "Description of the expected output",
            "format": "json" | "text" | "image"
          }
        }
      `;

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: taskDescription }
        ],
        temperature: 0.5,
      });

      const content = response.choices[0].message.content;
      
      try {
        // Extract JSON if it's wrapped in markdown code blocks
        const jsonMatch = content.match(/```(?:json)?\n([\s\S]+?)\n```/) || 
                         content.match(/({[\s\S]*})/); 
        
        const jsonString = jsonMatch ? jsonMatch[1] : content;
        return JSON.parse(jsonString);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
        return { error: 'Failed to parse automation instructions', content };
      }
    } catch (error) {
      console.error('OpenAI instruction generation error:', error);
      throw error;
    }
  }

  /**
   * Analyze a webpage for potential data extraction points
   * @param {string} html - HTML content of the webpage
   * @param {string} url - URL of the webpage
   * @returns {Object} - Analysis of the webpage with potential data points
   */
  async analyzeWebpage(html, url) {
    try {
      const systemMessage = `
        You are a web scraping expert. Analyze the provided HTML and identify key data elements 
        that could be extracted. Focus on:
        1. Main content areas
        2. Data tables
        3. Lists of items
        4. Key-value pairs
        5. Navigation elements
        
        For each identified element, provide:
        1. A description of the data
        2. The CSS selector to target it
        3. The type of data (text, attribute, etc.)
        
        Return your analysis as a structured JSON object.
      `;

      // Truncate HTML if it's too large (OpenAI has token limits)
      const truncatedHtml = html.length > 100000 ? html.substring(0, 100000) + '...' : html;

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: `URL: ${url}\n\nHTML: ${truncatedHtml}` }
        ],
        temperature: 0.3,
      });

      const content = response.choices[0].message.content;
      
      try {
        // Extract JSON if it's wrapped in markdown code blocks
        const jsonMatch = content.match(/```(?:json)?\n([\s\S]+?)\n```/) || 
                         content.match(/({[\s\S]*})/); 
        
        const jsonString = jsonMatch ? jsonMatch[1] : content;
        return JSON.parse(jsonString);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
        return { error: 'Failed to parse webpage analysis', content };
      }
    } catch (error) {
      console.error('OpenAI webpage analysis error:', error);
      throw error;
    }
  }
}

export default new OpenAIService();