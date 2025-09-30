// Browser automation service using Playwright
import { chromium } from 'playwright';
import config from '../config/config.js';
import { query } from '../db/database.js';

class BrowserService {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.config = config.browser;
  }

  /**
   * Initialize the browser instance
   */
  async initialize() {
    try {
      this.browser = await chromium.launch({
        headless: this.config.headless,
        slowMo: this.config.slowMo,
      });
      
      console.log('Browser initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize browser:', error);
      throw error;
    }
  }

  /**
   * Create a new browser context with optional stored cookies/localStorage
   * @param {Object} options - Context options
   * @param {string} options.userDataKey - Key to load stored user data
   */
  async createContext(options = {}) {
    try {
      if (!this.browser) {
        await this.initialize();
      }

      // Create a new context
      this.context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
      });

      // Load stored cookies if userDataKey is provided
      if (options.userDataKey) {
        await this.loadStoredUserData(options.userDataKey);
      }

      // Create a new page
      this.page = await this.context.newPage();
      
      // Set default timeout
      this.page.setDefaultTimeout(this.config.defaultTimeout);
      
      // Setup page event listeners
      this.setupPageListeners();
      
      return this.page;
    } catch (error) {
      console.error('Failed to create browser context:', error);
      throw error;
    }
  }

  /**
   * Setup page event listeners for logging
   */
  setupPageListeners() {
    // Log console messages
    this.page.on('console', (msg) => {
      console.log(`[Page Console] ${msg.type()}: ${msg.text()}`);
    });

    // Log page errors
    this.page.on('pageerror', (error) => {
      console.error('[Page Error]', error);
    });

    // Log request failures
    this.page.on('requestfailed', (request) => {
      console.error(`[Request Failed] ${request.url()}`);
    });
  }

  /**
   * Navigate to a URL
   * @param {string} url - The URL to navigate to
   */
  async navigate(url) {
    if (!this.page) {
      await this.createContext();
    }

    try {
      await this.page.goto(url, { waitUntil: 'networkidle' });
      console.log(`Navigated to ${url}`);
      return true;
    } catch (error) {
      console.error(`Failed to navigate to ${url}:`, error);
      throw error;
    }
  }

  /**
   * Login to a website
   * @param {Object} credentials - Login credentials
   * @param {string} credentials.url - Login page URL
   * @param {string} credentials.usernameSelector - CSS selector for username field
   * @param {string} credentials.passwordSelector - CSS selector for password field
   * @param {string} credentials.submitSelector - CSS selector for submit button
   * @param {string} credentials.username - Username
   * @param {string} credentials.password - Password
   * @param {string} credentials.successSelector - CSS selector to verify successful login
   */
  async login(credentials) {
    try {
      // Navigate to login page
      await this.navigate(credentials.url);

      // Fill username
      await this.page.fill(credentials.usernameSelector, credentials.username);
      
      // Fill password
      await this.page.fill(credentials.passwordSelector, credentials.password);
      
      // Click submit button
      await this.page.click(credentials.submitSelector);
      
      // Wait for navigation or success indicator
      if (credentials.successSelector) {
        await this.page.waitForSelector(credentials.successSelector, { timeout: this.config.defaultTimeout });
      } else {
        await this.page.waitForLoadState('networkidle');
      }
      
      // Save user data for future sessions
      if (credentials.saveSession) {
        await this.saveUserData(credentials.domain);
      }
      
      console.log(`Successfully logged in to ${credentials.url}`);
      return true;
    } catch (error) {
      console.error(`Login failed for ${credentials.url}:`, error);
      throw error;
    }
  }

  /**
   * Extract data from a page
   * @param {Object} extractionConfig - Data extraction configuration
   * @param {string} extractionConfig.url - URL to extract data from (optional if already on page)
   * @param {Object[]} extractionConfig.selectors - Array of selectors and their properties
   * @returns {Object} - Extracted data
   */
  async extractData(extractionConfig) {
    try {
      // Navigate to URL if provided
      if (extractionConfig.url) {
        await this.navigate(extractionConfig.url);
      }

      // Extract data based on selectors
      const result = {};
      
      for (const item of extractionConfig.selectors) {
        const { name, selector, type, attribute, multiple } = item;
        
        if (multiple) {
          // Extract multiple elements
          result[name] = await this.page.$$eval(selector, (elements, { type, attribute }) => {
            return elements.map(el => {
              if (type === 'text') return el.textContent.trim();
              if (type === 'html') return el.innerHTML.trim();
              if (type === 'attribute' && attribute) return el.getAttribute(attribute);
              return el.textContent.trim();
            });
          }, { type, attribute });
        } else {
          // Extract single element
          result[name] = await this.page.$eval(selector, (el, { type, attribute }) => {
            if (type === 'text') return el.textContent.trim();
            if (type === 'html') return el.innerHTML.trim();
            if (type === 'attribute' && attribute) return el.getAttribute(attribute);
            return el.textContent.trim();
          }, { type, attribute }).catch(() => null);
        }
      }
      
      console.log('Data extracted successfully');
      return result;
    } catch (error) {
      console.error('Data extraction failed:', error);
      throw error;
    }
  }

  /**
   * Save user data (cookies, localStorage) for future sessions
   * @param {string} domain - Domain key for storing the data
   */
  async saveUserData(domain) {
    try {
      if (!this.context) return false;
      
      // Get cookies
      const cookies = await this.context.cookies();
      
      // Get localStorage (requires page access)
      const localStorage = await this.page.evaluate(() => {
        const data = {};
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          data[key] = window.localStorage.getItem(key);
        }
        return data;
      });
      
      // Store in database
      const userData = { cookies, localStorage };
      
      // Check if user data already exists
      const existingData = await query(
        'SELECT id FROM user_data WHERE domain = $1',
        [domain]
      );
      
      if (existingData.rows.length > 0) {
        // Update existing data
        await query(
          'UPDATE user_data SET data = $1, updated_at = CURRENT_TIMESTAMP WHERE domain = $2',
          [JSON.stringify(userData), domain]
        );
      } else {
        // Insert new data
        await query(
          'INSERT INTO user_data (domain, data) VALUES ($1, $2)',
          [domain, JSON.stringify(userData)]
        );
      }
      
      console.log(`User data saved for domain: ${domain}`);
      return true;
    } catch (error) {
      console.error('Failed to save user data:', error);
      return false;
    }
  }

  /**
   * Load stored user data (cookies, localStorage)
   * @param {string} domain - Domain key for retrieving the data
   */
  async loadStoredUserData(domain) {
    try {
      if (!this.context) return false;
      
      // Get stored data from database
      const result = await query(
        'SELECT data FROM user_data WHERE domain = $1',
        [domain]
      );
      
      if (result.rows.length === 0) {
        console.log(`No stored user data found for domain: ${domain}`);
        return false;
      }
      
      const userData = result.rows[0].data;
      
      // Set cookies
      if (userData.cookies && Array.isArray(userData.cookies)) {
        await this.context.addCookies(userData.cookies);
      }
      
      // Set localStorage (requires page access)
      if (userData.localStorage && this.page) {
        await this.page.evaluate((storageData) => {
          for (const [key, value] of Object.entries(storageData)) {
            window.localStorage.setItem(key, value);
          }
        }, userData.localStorage);
      }
      
      console.log(`User data loaded for domain: ${domain}`);
      return true;
    } catch (error) {
      console.error('Failed to load user data:', error);
      return false;
    }
  }

  /**
   * Take a screenshot of the current page
   * @param {Object} options - Screenshot options
   * @returns {Buffer} - Screenshot buffer
   */
  async takeScreenshot(options = {}) {
    try {
      if (!this.page) {
        throw new Error('No active page');
      }
      
      const screenshot = await this.page.screenshot({
        fullPage: options.fullPage || false,
        path: options.path || null,
        type: options.type || 'png',
      });
      
      console.log('Screenshot taken successfully');
      return screenshot;
    } catch (error) {
      console.error('Failed to take screenshot:', error);
      throw error;
    }
  }

  /**
   * Close the browser instance
   */
  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.context = null;
        this.page = null;
        console.log('Browser closed successfully');
      }
    } catch (error) {
      console.error('Failed to close browser:', error);
    }
  }
}

export default new BrowserService();

