import { BaseNode } from './base.js';
import axios from 'axios';
import pg from 'pg';
import { VM } from 'vm2';
import { spawn } from 'child_process';

// HTTP Node - Make HTTP requests
export class HTTPNode extends BaseNode {
  constructor(config) {
    super(config);
    this.type = 'http';
  }

  validateConfig() {
    if (!this.config.url) {
      throw new Error('HTTP node requires url config');
    }
  }

  async execute(input, context) {
    try {
      const { url, method = 'GET', headers = {}, params = {}, data } = this.config;
      
      // Replace variables in URL
      const processedUrl = this.interpolate(url, { ...input, ...context });
      
      const response = await axios({
        url: processedUrl,
        method,
        headers: this.interpolate(headers, { ...input, ...context }),
        params: this.interpolate(params, { ...input, ...context }),
        data: data ? this.interpolate(data, { ...input, ...context }) : input,
        timeout: this.config.timeout || 30000,
        validateStatus: () => true
      });

      return {
        success: response.status < 400,
        status: response.status,
        headers: response.headers,
        data: response.data,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  interpolate(template, data) {
    if (typeof template === 'string') {
      return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return data[key] || match;
      });
    }
    if (typeof template === 'object') {
      const result = {};
      for (const [key, value] of Object.entries(template)) {
        result[key] = this.interpolate(value, data);
      }
      return result;
    }
    return template;
  }
}

// Database Node - Execute SQL queries
export class DatabaseNode extends BaseNode {
  constructor(config) {
    super(config);
    this.type = 'database';
    this.pool = null;
  }

  validateConfig() {
    if (!this.config.connectionString && !this.config.connection) {
      throw new Error('Database node requires connection config');
    }
    if (!this.config.query) {
      throw new Error('Database node requires query config');
    }
  }

  async getConnection() {
    if (!this.pool) {
      const config = this.config.connectionString 
        ? { connectionString: this.config.connectionString }
        : this.config.connection;
      
      this.pool = new pg.Pool({
        ...config,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    }
    return this.pool;
  }

  async execute(input, context) {
    try {
      const pool = await this.getConnection();
      const query = this.interpolateQuery(this.config.query, { ...input, ...context });
      
      const result = await pool.query(query.text, query.values);
      
      return {
        success: true,
        rows: result.rows,
        rowCount: result.rowCount,
        fields: result.fields?.map(f => f.name),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  interpolateQuery(query, data) {
    if (typeof query === 'string') {
      // Simple string replacement for now
      let text = query;
      const values = [];
      let paramIndex = 1;
      
      text = text.replace(/\:(\w+)/g, (match, key) => {
        if (data.hasOwnProperty(key)) {
          values.push(data[key]);
          return `$${paramIndex++}`;
        }
        return match;
      });
      
      return { text, values };
    }
    return { text: query.text || query, values: query.values || [] };
  }

  async cleanup() {
    if (this.pool) {
      await this.pool.end();
    }
  }
}

// Python Node - Execute Python code
export class PythonNode extends BaseNode {
  constructor(config) {
    super(config);
    this.type = 'python';
  }

  validateConfig() {
    if (!this.config.code) {
      throw new Error('Python node requires code config');
    }
  }

  async execute(input, context) {
    try {
      const code = this.config.code;
      const timeout = this.config.timeout || 30000;
      
      return new Promise((resolve, reject) => {
        const python = spawn('python3', ['-c', this.wrapCode(code)]);
        
        let stdout = '';
        let stderr = '';
        let killed = false;
        
        const timer = setTimeout(() => {
          killed = true;
          python.kill();
          reject(new Error('Python execution timeout'));
        }, timeout);
        
        python.stdin.write(JSON.stringify({ input, context }));
        python.stdin.end();
        
        python.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        python.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        python.on('close', (code) => {
          clearTimeout(timer);
          
          if (killed) return;
          
          if (code !== 0) {
            reject(new Error(`Python process exited with code ${code}: ${stderr}`));
            return;
          }
          
          try {
            const result = JSON.parse(stdout);
            resolve({
              success: true,
              data: result,
              logs: stderr,
              timestamp: new Date().toISOString()
            });
          } catch (error) {
            reject(new Error(`Failed to parse Python output: ${stdout}`));
          }
        });
      });
    } catch (error) {
      return this.handleError(error);
    }
  }

  wrapCode(code) {
    return `
import sys
import json
import traceback

def execute():
    try:
        # Read input
        input_data = json.loads(sys.stdin.read())
        input_value = input_data.get('input', {})
        context = input_data.get('context', {})
        
        # User code execution context
        result = None
        ${code.split('\n').map(line => '        ' + line).join('\n')}
        
        # Output result
        print(json.dumps(result if result is not None else {}))
    except Exception as e:
        print(json.dumps({"error": str(e), "trace": traceback.format_exc()}))
        sys.exit(1)

execute()
`;
  }
}

// Conditional Node - Branch based on conditions
export class ConditionalNode extends BaseNode {
  constructor(config) {
    super(config);
    this.type = 'conditional';
  }

  validateConfig() {
    if (!this.config.condition) {
      throw new Error('Conditional node requires condition config');
    }
  }

  async execute(input, context) {
    try {
      const { condition, operator = 'equals', value, path } = this.config;
      
      // Get the value to test
      const testValue = path ? this.getValueByPath(input, path) : input;
      
      let result = false;
      
      switch (operator) {
        case 'equals':
          result = testValue == value;
          break;
        case 'strict_equals':
          result = testValue === value;
          break;
        case 'not_equals':
          result = testValue != value;
          break;
        case 'greater':
          result = testValue > value;
          break;
        case 'less':
          result = testValue < value;
          break;
        case 'greater_equal':
          result = testValue >= value;
          break;
        case 'less_equal':
          result = testValue <= value;
          break;
        case 'contains':
          result = testValue?.includes?.(value) || false;
          break;
        case 'regex':
          result = new RegExp(value).test(testValue);
          break;
        case 'exists':
          result = testValue !== undefined && testValue !== null;
          break;
        case 'javascript':
          result = this.evaluateJavaScript(condition, { input, context });
          break;
        default:
          throw new Error(`Unknown operator: ${operator}`);
      }
      
      return {
        success: true,
        condition: result,
        branch: result ? 'true' : 'false',
        tested: testValue,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  getValueByPath(obj, path) {
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
  }

  evaluateJavaScript(code, data) {
    const vm = new VM({
      timeout: 1000,
      sandbox: { input: data.input, context: data.context }
    });
    
    return vm.run(code);
  }
}

// Transformer Node - Transform data
export class TransformerNode extends BaseNode {
  constructor(config) {
    super(config);
    this.type = 'transformer';
  }

  validateConfig() {
    if (!this.config.transform && !this.config.template && !this.config.code) {
      throw new Error('Transformer node requires transform, template, or code config');
    }
  }

  async execute(input, context) {
    try {
      let result;
      
      if (this.config.template) {
        // Template-based transformation
        result = this.applyTemplate(this.config.template, { ...input, ...context });
      } else if (this.config.code) {
        // JavaScript code transformation
        result = this.executeCode(this.config.code, { input, context });
      } else if (this.config.transform) {
        // Field mapping transformation
        result = this.applyFieldMapping(this.config.transform, input);
      }
      
      return {
        success: true,
        data: result,
        original: this.config.includeOriginal ? input : undefined,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  applyTemplate(template, data) {
    const json = JSON.stringify(template);
    const processed = json.replace(/"\{\{(\w+)\}\}"/g, (match, key) => {
      const value = data[key];
      return JSON.stringify(value);
    });
    return JSON.parse(processed);
  }

  executeCode(code, data) {
    const vm = new VM({
      timeout: 5000,
      sandbox: { 
        input: data.input, 
        context: data.context,
        console: console,
        JSON: JSON,
        Math: Math,
        Date: Date,
        Object: Object,
        Array: Array,
        String: String,
        Number: Number,
        Boolean: Boolean
      }
    });
    
    return vm.run(`
      const transform = (function() {
        ${code}
      })();
      transform
    `);
  }

  applyFieldMapping(mapping, input) {
    const result = {};
    
    for (const [targetField, sourceConfig] of Object.entries(mapping)) {
      if (typeof sourceConfig === 'string') {
        // Simple field mapping
        result[targetField] = this.getValueByPath(input, sourceConfig);
      } else if (sourceConfig.type === 'static') {
        // Static value
        result[targetField] = sourceConfig.value;
      } else if (sourceConfig.type === 'expression') {
        // JavaScript expression
        const vm = new VM({
          timeout: 1000,
          sandbox: { input, value: this.getValueByPath(input, sourceConfig.field) }
        });
        result[targetField] = vm.run(sourceConfig.expression);
      }
    }
    
    return result;
  }

  getValueByPath(obj, path) {
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
  }
}