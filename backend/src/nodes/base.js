export class BaseNode {
  constructor(config = {}) {
    this.config = config;
    this.type = 'base';
    this.validateConfig();
  }

  validateConfig() {
    // Override in subclasses for specific validation
  }

  async execute(input, context = {}) {
    throw new Error('Execute method must be implemented by subclass');
  }

  async validate(input) {
    return true;
  }

  handleError(error) {
    return {
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
  }
}