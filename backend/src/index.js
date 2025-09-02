import express from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Simple test route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Import and setup workflow engine
async function setupEngine() {
  try {
    const { WorkflowEngine } = await import('./core/engine.js');
    const { createRoutes } = await import('./api/routes.js');
    const { WebSocketHandler } = await import('./api/websocket.js');
    
    // Import node types
    const nodes = await import('./nodes/implementations.js');
    
    const engine = new WorkflowEngine();
    
    // Register nodes
    engine.registerNode('http', nodes.HTTPNode);
    engine.registerNode('database', nodes.DatabaseNode);
    engine.registerNode('python', nodes.PythonNode);
    engine.registerNode('conditional', nodes.ConditionalNode);
    engine.registerNode('transformer', nodes.TransformerNode);
    
    // Setup routes
    const apiRoutes = createRoutes(engine);
    app.use('/api', apiRoutes);
    
    // Setup WebSocket
    new WebSocketHandler(server, engine);
    
    console.log('✅ Engine setup complete');
  } catch (error) {
    console.error('❌ Engine setup failed:', error.message);
    // Server still runs even if engine fails
  }
}

// Start server
server.listen(port, async () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
  await setupEngine();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
