import React, { useState, useCallback } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  ReactFlowProvider,
  Handle,
  Position,
  applyNodeChanges,
  applyEdgeChanges
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Play, Save, Globe, Database, Code, GitBranch, Shuffle, X, Settings, Trash2 } from 'lucide-react';

// Custom Node Component with Delete Button
const CustomNode = ({ data, selected, id }) => {
  const getIcon = () => {
    switch (data.nodeType) {
      case 'http': return <Globe className="w-3 h-3" />;
      case 'database': return <Database className="w-3 h-3" />;
      case 'python': return <Code className="w-3 h-3" />;
      case 'conditional': return <GitBranch className="w-3 h-3" />;
      case 'transformer': return <Shuffle className="w-3 h-3" />;
      default: return <Globe className="w-3 h-3" />;
    }
  };

  const getColor = () => {
    switch (data.nodeType) {
      case 'http': return 'from-green-400 to-green-600';
      case 'database': return 'from-blue-400 to-blue-600';
      case 'python': return 'from-yellow-400 to-yellow-600';
      case 'conditional': return 'from-orange-400 to-orange-600';
      case 'transformer': return 'from-purple-400 to-purple-600';
      default: return 'from-gray-400 to-gray-600';
    }
  };

  return (
    <div className={`px-3 py-2 shadow-lg rounded-lg bg-white border-2 transition-all ${
      selected ? 'border-blue-500 scale-105' : 'border-gray-200'
    } min-w-[140px]`}>
      <Handle
        type="target"
        position={Position.Left}
        className="w-2 h-2 bg-blue-500 border border-white"
        style={{ left: '-5px' }}
      />
      
      <div className="flex items-center gap-2">
        <div className={`bg-gradient-to-br ${getColor()} text-white p-1.5 rounded shadow`}>
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-gray-800 truncate">{data.label}</div>
          <div className="text-[10px] text-gray-500 capitalize">{data.nodeType}</div>
        </div>
        <div className="flex flex-col gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.onConfig();
            }}
            className="p-0.5 hover:bg-gray-100 rounded transition-colors"
            title="Configure"
          >
            <Settings className="w-3 h-3 text-gray-500" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.onDelete(id);
            }}
            className="p-0.5 hover:bg-red-50 rounded transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3 h-3 text-red-500" />
          </button>
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        className="w-2 h-2 bg-green-500 border border-white"
        style={{ right: '-5px' }}
      />
    </div>
  );
};

// Compact Config Modal for Laptop
const ConfigModal = ({ node, onClose, onSave }) => {
  const [config, setConfig] = useState(node?.data?.config || {});

  if (!node) return null;

  const handleSave = () => {
    onSave(node.id, config);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold">Configure {node.data.label}</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 max-h-[50vh] overflow-y-auto">
          {node.data.nodeType === 'http' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">API URL</label>
                <input
                  type="text"
                  value={config.url || ''}
                  onChange={(e) => setConfig({ ...config, url: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                  placeholder="https://api.example.com/endpoint"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Method</label>
                  <select
                    value={config.method || 'GET'}
                    onChange={(e) => setConfig({ ...config, method: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Timeout (ms)</label>
                  <input
                    type="number"
                    value={config.timeout || 30000}
                    onChange={(e) => setConfig({ ...config, timeout: parseInt(e.target.value) })}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Headers (JSON)</label>
                <textarea
                  value={config.headers || '{"Content-Type": "application/json"}'}
                  onChange={(e) => setConfig({ ...config, headers: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 font-mono"
                  rows="3"
                />
              </div>

              {(config.method === 'POST' || config.method === 'PUT') && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Body (JSON)</label>
                  <textarea
                    value={config.body || '{}'}
                    onChange={(e) => setConfig({ ...config, body: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 font-mono"
                    rows="4"
                  />
                </div>
              )}
            </div>
          )}

          {node.data.nodeType === 'database' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Connection String</label>
                <input
                  type="password"
                  value={config.connectionString || ''}
                  onChange={(e) => setConfig({ ...config, connectionString: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                  placeholder="postgresql://user:pass@localhost/db"
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">SQL Query</label>
                <textarea
                  value={config.query || ''}
                  onChange={(e) => setConfig({ ...config, query: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 font-mono"
                  rows="5"
                  placeholder="SELECT * FROM users WHERE id = :id"
                />
              </div>
            </div>
          )}

          {node.data.nodeType === 'python' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Python Script</label>
                <textarea
                  value={config.code || '# input_value contains input data\nresult = {"output": input_value}'}
                  onChange={(e) => setConfig({ ...config, code: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 font-mono bg-gray-50"
                  rows="8"
                />
              </div>
            </div>
          )}

          {node.data.nodeType === 'conditional' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Field Path</label>
                <input
                  type="text"
                  value={config.path || ''}
                  onChange={(e) => setConfig({ ...config, path: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                  placeholder="status.code"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Operator</label>
                  <select
                    value={config.operator || 'equals'}
                    onChange={(e) => setConfig({ ...config, operator: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="equals">Equals</option>
                    <option value="not_equals">Not Equals</option>
                    <option value="greater">Greater Than</option>
                    <option value="less">Less Than</option>
                    <option value="contains">Contains</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Value</label>
                  <input
                    type="text"
                    value={config.value || ''}
                    onChange={(e) => setConfig({ ...config, value: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    placeholder="200"
                  />
                </div>
              </div>
            </div>
          )}

          {node.data.nodeType === 'transformer' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Transform Code</label>
                <textarea
                  value={config.code || 'return {...input, timestamp: Date.now()};'}
                  onChange={(e) => setConfig({ ...config, code: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 font-mono bg-gray-50"
                  rows="6"
                />
              </div>
            </div>
          )}
        </div>

        <div className="border-t px-4 py-3 bg-gray-50 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-sm bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded hover:from-blue-600 hover:to-purple-700 transition-all"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode
};

function WorkflowEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [workflowName, setWorkflowName] = useState('New Workflow');
  const [selectedNode, setSelectedNode] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  const deleteNode = useCallback((nodeId) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
  }, [setNodes, setEdges]);

  const addNode = (type) => {
    const id = `${type}_${Date.now()}`;
    const newNode = {
      id,
      type: 'custom',
      position: {
        x: 100 + Math.random() * 400,
        y: 100 + Math.random() * 200,
      },
      data: {
        label: `${type.charAt(0).toUpperCase() + type.slice(1)}`,
        nodeType: type,
        config: {},
        onConfig: () => setSelectedNode({ 
          id, 
          data: { 
            label: `${type.charAt(0).toUpperCase() + type.slice(1)}`, 
            nodeType: type, 
            config: {} 
          } 
        }),
        onDelete: deleteNode
      },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const updateNodeConfig = (nodeId, config) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return { 
            ...node, 
            data: { 
              ...node.data, 
              config,
              onConfig: () => setSelectedNode({ ...node, data: { ...node.data, config } }),
              onDelete: deleteNode
            } 
          };
        }
        return node;
      })
    );
  };

  const saveWorkflow = async () => {
    const workflow = {
      name: workflowName,
      nodes: nodes.map(n => ({
        id: n.id,
        type: n.data.nodeType,
        position: n.position,
        config: n.data.config || {}
      })),
      edges: edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target
      }))
    };

    try {
      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflow)
      });
      const data = await response.json();
      alert(`✅ Saved! ID: ${data.id}`);
      return data.id;
    } catch (error) {
      alert('❌ Failed to save');
    }
  };

  const executeWorkflow = async () => {
    setIsExecuting(true);
    try {
      const workflowId = await saveWorkflow();
      if (workflowId) {
        const response = await fetch(`/api/workflows/${workflowId}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: true })
        });
        alert('✅ Executed!');
      }
    } catch (error) {
      alert('❌ Execution failed');
    }
    setIsExecuting(false);
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Delete selected nodes
        const selectedNodes = nodes.filter(n => n.selected);
        selectedNodes.forEach(n => deleteNode(n.id));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, deleteNode]);

  return (
    <div className="w-screen h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Compact Header */}
      <div className="bg-white shadow-sm border-b px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Globe className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg hidden sm:block">Workflow</span>
            </div>
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="px-3 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 w-32 sm:w-48"
              placeholder="Name..."
            />
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={saveWorkflow}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              <Save className="w-3 h-3" />
              <span className="hidden sm:inline">Save</span>
            </button>
            <button
              onClick={executeWorkflow}
              disabled={isExecuting || nodes.length === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 transition-colors"
            >
              <Play className="w-3 h-3" />
              <span className="hidden sm:inline">{isExecuting ? 'Running...' : 'Execute'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Compact Sidebar */}
        <div className="w-48 bg-white border-r shadow-sm p-3 overflow-y-auto">
          <h3 className="font-semibold text-sm mb-3 text-gray-700">Add Nodes</h3>
          <div className="space-y-1.5">
            <button
              onClick={() => addNode('http')}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors"
            >
              <Globe className="w-3 h-3" />
              HTTP Request
            </button>
            <button
              onClick={() => addNode('database')}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
            >
              <Database className="w-3 h-3" />
              Database
            </button>
            <button
              onClick={() => addNode('python')}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs bg-yellow-50 text-yellow-700 rounded hover:bg-yellow-100 transition-colors"
            >
              <Code className="w-3 h-3" />
              Python
            </button>
            <button
              onClick={() => addNode('conditional')}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs bg-orange-50 text-orange-700 rounded hover:bg-orange-100 transition-colors"
            >
              <GitBranch className="w-3 h-3" />
              Conditional
            </button>
            <button
              onClick={() => addNode('transformer')}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs bg-purple-50 text-purple-700 rounded hover:bg-purple-100 transition-colors"
            >
              <Shuffle className="w-3 h-3" />
              Transformer
            </button>
          </div>
          
          <div className="mt-4 p-2 bg-gray-50 rounded text-xs text-gray-600">
            <div className="font-semibold mb-1">Tips:</div>
            <div>• Drag to connect</div>
            <div>• Click gear to config</div>
            <div>• Click trash to delete</div>
            <div>• Press Delete key</div>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode={['Delete', 'Backspace']}
            className="bg-gray-50"
          >
            <Background variant="dots" gap={16} size={1} color="#d1d5db" />
            <Controls className="bg-white shadow border rounded" position="bottom-right" />
            <MiniMap 
              className="bg-white shadow border rounded" 
              position="bottom-left"
              style={{ width: 100, height: 75 }}
            />
          </ReactFlow>
        </div>
      </div>

      {selectedNode && (
        <ConfigModal
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onSave={updateNodeConfig}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <WorkflowEditor />
    </ReactFlowProvider>
  );
}