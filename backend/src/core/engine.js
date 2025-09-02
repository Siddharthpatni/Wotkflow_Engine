import { v4 as uuidv4 } from 'uuid';
import Queue from 'bull';
import Redis from 'redis';
import pino from 'pino';
import { EventEmitter } from 'events';

const logger = pino({ level: 'info' });

export class WorkflowEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      redis: { host: 'localhost', port: 6379 },
      maxConcurrency: 10,
      ...config
    };
    
    this.queue = new Queue('workflow-execution', {
      redis: this.config.redis
    });
    
    this.redis = Redis.createClient(this.config.redis);
    this.workflows = new Map();
    this.executions = new Map();
    this.nodes = new Map();
    
    this.initialize();
  }

  async initialize() {
    await this.redis.connect();
    this.setupQueueHandlers();
    logger.info('Workflow engine initialized');
  }

  setupQueueHandlers() {
    this.queue.process(this.config.maxConcurrency, async (job) => {
      const { workflowId, executionId, nodeId, input } = job.data;
      return await this.executeNode(workflowId, executionId, nodeId, input);
    });

    this.queue.on('completed', (job, result) => {
      this.emit('node:completed', { 
        executionId: job.data.executionId, 
        nodeId: job.data.nodeId, 
        result 
      });
    });

    this.queue.on('failed', (job, err) => {
      this.emit('node:failed', { 
        executionId: job.data.executionId, 
        nodeId: job.data.nodeId, 
        error: err.message 
      });
    });
  }

  registerNode(type, NodeClass) {
    this.nodes.set(type, NodeClass);
    logger.info(`Registered node type: ${type}`);
  }

  async createWorkflow(definition) {
    const workflowId = uuidv4();
    const workflow = {
      id: workflowId,
      name: definition.name,
      nodes: definition.nodes,
      edges: definition.edges,
      createdAt: new Date(),
      status: 'active'
    };
    
    this.workflows.set(workflowId, workflow);
    await this.redis.set(`workflow:${workflowId}`, JSON.stringify(workflow));
    
    logger.info(`Created workflow: ${workflowId}`);
    return workflow;
  }

  async executeWorkflow(workflowId, initialData = {}) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const executionId = uuidv4();
    const execution = {
      id: executionId,
      workflowId,
      status: 'running',
      startTime: new Date(),
      data: initialData,
      nodeResults: {},
      currentNodes: []
    };

    this.executions.set(executionId, execution);
    await this.redis.set(`execution:${executionId}`, JSON.stringify(execution));

    // Find start nodes (nodes with no incoming edges)
    const startNodes = workflow.nodes.filter(node => 
      !workflow.edges.some(edge => edge.target === node.id)
    );

    // Queue start nodes for execution
    for (const node of startNodes) {
      await this.queueNode(workflowId, executionId, node.id, initialData);
    }

    logger.info(`Started workflow execution: ${executionId}`);
    return { executionId, status: 'started' };
  }

  async queueNode(workflowId, executionId, nodeId, input) {
    await this.queue.add({
      workflowId,
      executionId,
      nodeId,
      input
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    });
  }

  async executeNode(workflowId, executionId, nodeId, input) {
    const workflow = this.workflows.get(workflowId);
    const execution = this.executions.get(executionId);
    const nodeConfig = workflow.nodes.find(n => n.id === nodeId);

    if (!nodeConfig) {
      throw new Error(`Node ${nodeId} not found in workflow`);
    }

    const NodeClass = this.nodes.get(nodeConfig.type);
    if (!NodeClass) {
      throw new Error(`Node type ${nodeConfig.type} not registered`);
    }

    logger.info(`Executing node: ${nodeId} (${nodeConfig.type})`);

    try {
      const node = new NodeClass(nodeConfig.config);
      const result = await node.execute(input, execution.nodeResults);

      // Store result
      execution.nodeResults[nodeId] = result;
      await this.redis.set(`execution:${executionId}`, JSON.stringify(execution));

      // Find and queue next nodes
      const nextEdges = workflow.edges.filter(edge => edge.source === nodeId);
      for (const edge of nextEdges) {
        const nextNode = workflow.nodes.find(n => n.id === edge.target);
        if (nextNode) {
          // Check if all dependencies are met
          const dependencies = workflow.edges
            .filter(e => e.target === nextNode.id)
            .map(e => e.source);
          
          const allDependenciesMet = dependencies.every(depId => 
            execution.nodeResults.hasOwnProperty(depId)
          );

          if (allDependenciesMet) {
            // Merge all dependency results as input
            const mergedInput = dependencies.reduce((acc, depId) => ({
              ...acc,
              [depId]: execution.nodeResults[depId]
            }), {});

            await this.queueNode(workflowId, executionId, nextNode.id, mergedInput);
          }
        }
      }

      // Check if workflow is complete
      const allNodesExecuted = workflow.nodes.every(node => 
        execution.nodeResults.hasOwnProperty(node.id)
      );

      if (allNodesExecuted) {
        execution.status = 'completed';
        execution.endTime = new Date();
        await this.redis.set(`execution:${executionId}`, JSON.stringify(execution));
        this.emit('workflow:completed', { executionId, results: execution.nodeResults });
      }

      return result;
    } catch (error) {
      logger.error(`Node execution failed: ${nodeId}`, error);
      execution.status = 'failed';
      execution.error = error.message;
      await this.redis.set(`execution:${executionId}`, JSON.stringify(execution));
      throw error;
    }
  }

  async getExecution(executionId) {
    const cached = await this.redis.get(`execution:${executionId}`);
    return cached ? JSON.parse(cached) : this.executions.get(executionId);
  }

  async getWorkflow(workflowId) {
    const cached = await this.redis.get(`workflow:${workflowId}`);
    return cached ? JSON.parse(cached) : this.workflows.get(workflowId);
  }

  async shutdown() {
    await this.queue.close();
    await this.redis.quit();
    logger.info('Workflow engine shutdown');
  }
}