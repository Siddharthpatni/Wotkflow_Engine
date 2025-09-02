import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';

export class WebSocketHandler {
  constructor(server, engine) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.engine = engine;
    this.clients = new Map();
    
    this.initialize();
  }

  initialize() {
    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      this.clients.set(clientId, { ws, subscriptions: new Set() });
      
      console.log(`WebSocket client connected: ${clientId}`);
      
      ws.on('message', (message) => {
        this.handleMessage(clientId, message);
      });
      
      ws.on('close', () => {
        this.clients.delete(clientId);
        console.log(`WebSocket client disconnected: ${clientId}`);
      });
      
      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
      });
      
      // Send initial connection success
      ws.send(JSON.stringify({
        type: 'connection',
        clientId,
        timestamp: new Date().toISOString()
      }));
    });
    
    // Setup engine event listeners
    this.setupEngineListeners();
  }

  setupEngineListeners() {
    this.engine.on('workflow:completed', (data) => {
      this.broadcast('workflow:completed', data);
    });
    
    this.engine.on('node:completed', (data) => {
      this.broadcast('node:completed', data);
    });
    
    this.engine.on('node:failed', (data) => {
      this.broadcast('node:failed', data);
    });
  }

  handleMessage(clientId, message) {
    try {
      const data = JSON.parse(message);
      const client = this.clients.get(clientId);
      
      switch (data.type) {
        case 'subscribe':
          this.handleSubscribe(clientId, data);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(clientId, data);
          break;
        case 'ping':
          client.ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
          break;
        default:
          console.warn(`Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error(`Error handling message from ${clientId}:`, error);
    }
  }

  handleSubscribe(clientId, data) {
    const client = this.clients.get(clientId);
    if (data.executionId) {
      client.subscriptions.add(`execution:${data.executionId}`);
      client.ws.send(JSON.stringify({
        type: 'subscribed',
        executionId: data.executionId,
        timestamp: new Date().toISOString()
      }));
    }
    if (data.workflowId) {
      client.subscriptions.add(`workflow:${data.workflowId}`);
      client.ws.send(JSON.stringify({
        type: 'subscribed',
        workflowId: data.workflowId,
        timestamp: new Date().toISOString()
      }));
    }
  }

  handleUnsubscribe(clientId, data) {
    const client = this.clients.get(clientId);
    if (data.executionId) {
      client.subscriptions.delete(`execution:${data.executionId}`);
    }
    if (data.workflowId) {
      client.subscriptions.delete(`workflow:${data.workflowId}`);
    }
  }

  broadcast(event, data) {
    const message = JSON.stringify({
      type: event,
      data,
      timestamp: new Date().toISOString()
    });
    
    for (const [clientId, client] of this.clients) {
      // Check if client is subscribed to this event
      const shouldSend = 
        client.subscriptions.has(`execution:${data.executionId}`) ||
        client.subscriptions.has(`workflow:${data.workflowId}`) ||
        client.subscriptions.has('*');
      
      if (shouldSend && client.ws.readyState === 1) {
        client.ws.send(message);
      }
    }
  }

  generateClientId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}