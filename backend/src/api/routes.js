import express from 'express';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const workflowSchema = Joi.object({
  name: Joi.string().required(),
  nodes: Joi.array().items(Joi.object({
    id: Joi.string().required(),
    type: Joi.string().required(),
    position: Joi.object({
      x: Joi.number().required(),
      y: Joi.number().required()
    }),
    config: Joi.object().required()
  })).required(),
  edges: Joi.array().items(Joi.object({
    id: Joi.string().required(),
    source: Joi.string().required(),
    target: Joi.string().required(),
    sourceHandle: Joi.string(),
    targetHandle: Joi.string()
  })).required()
});

export function createRoutes(engine) {
  // Health check
  router.get('/health', (req, res) => {
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      engine: 'running'
    });
  });

  // Create workflow
  router.post('/workflows', async (req, res) => {
    try {
      const { error, value } = workflowSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const workflow = await engine.createWorkflow(value);
      res.status(201).json(workflow);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get workflow
  router.get('/workflows/:id', async (req, res) => {
    try {
      const workflow = await engine.getWorkflow(req.params.id);
      if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found' });
      }
      res.json(workflow);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // List workflows
  router.get('/workflows', async (req, res) => {
    try {
      const workflows = Array.from(engine.workflows.values());
      res.json(workflows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Execute workflow
  router.post('/workflows/:id/execute', async (req, res) => {
    try {
      const result = await engine.executeWorkflow(req.params.id, req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get execution status
  router.get('/executions/:id', async (req, res) => {
    try {
      const execution = await engine.getExecution(req.params.id);
      if (!execution) {
        return res.status(404).json({ error: 'Execution not found' });
      }
      res.json(execution);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // List executions for workflow
  router.get('/workflows/:id/executions', async (req, res) => {
    try {
      const executions = Array.from(engine.executions.values())
        .filter(e => e.workflowId === req.params.id);
      res.json(executions);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Node types
  router.get('/nodes/types', (req, res) => {
    const types = [
      {
        type: 'http',
        name: 'HTTP Request',
        description: 'Make HTTP requests to external APIs',
        icon: '🌐',
        color: '#4CAF50',
        inputs: 1,
        outputs: 1,
        config: {
          url: { type: 'string', required: true },
          method: { type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE'], default: 'GET' },
          headers: { type: 'json', default: {} },
          timeout: { type: 'number', default: 30000 }
        }
      },
      {
        type: 'database',
        name: 'Database',
        description: 'Execute SQL queries',
        icon: '🗄️',
        color: '#2196F3',
        inputs: 1,
        outputs: 1,
        config: {
          connectionString: { type: 'string', required: true, encrypted: true },
          query: { type: 'sql', required: true }
        }
      },
      {
        type: 'python',
        name: 'Python Script',
        description: 'Execute Python code',
        icon: '🐍',
        color: '#FFD43B',
        inputs: 1,
        outputs: 1,
        config: {
          code: { type: 'code', language: 'python', required: true },
          timeout: { type: 'number', default: 30000 }
        }
    }
];
    res.json(types);
  });
  return router;
}