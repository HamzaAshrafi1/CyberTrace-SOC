"use client";

import React, { useState, useCallback } from "react";
import { 
  Plus, ToggleLeft, ToggleRight, Trash2, Edit, 
  AlertTriangle, Radio, Activity, Network, X, Info
} from "lucide-react";
import ReactFlow, { 
  MiniMap, Controls, Background, useNodesState, useEdgesState, addEdge, Edge, Node, Connection
} from "reactflow";
import "reactflow/dist/style.css";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { 
  createPlaybookAction, updatePlaybookAction, 
  togglePlaybookEnabledAction, deletePlaybookAction 
} from "./actions";

interface Playbook {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  triggerType: string;
  conditions: any;
  actions: any;
  createdAt: string;
  updatedAt: string;
}

interface PlaybooksClientProps {
  initialPlaybooks: Playbook[];
}

export default function PlaybooksClient({ initialPlaybooks }: PlaybooksClientProps) {
  const [playbooks, setPlaybooks] = useState<Playbook[]>(initialPlaybooks);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPlaybook, setEditingPlaybook] = useState<Playbook | null>(null);

  // Form States
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState("threat_detected");
  const [severityFilter, setSeverityFilter] = useState("CRITICAL");
  const [attackFilter, setAttackFilter] = useState("ANY");

  // React Flow states
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Helper to count actions in a graph/flow structure
  const getActionCount = (actions: any) => {
    if (!actions) return 0;
    if (Array.isArray(actions)) return actions.length;
    if (actions.nodes) {
      return actions.nodes.filter((n: any) => n.type === "action").length;
    }
    return 0;
  };

  // Helper to load templates into the builder canvas
  const loadTemplate = (type: string) => {
    if (type === "sqli") {
      setName("SQL Injection Automated Response");
      setDescription("Triggers on SQL injection attempts. Automatically blocks IP, creates critical incident ticket, and alerts the lead analyst.");
      setSeverityFilter("CRITICAL");
      setAttackFilter("SQL_INJECTION");

      const initialNodes: Node[] = [
        {
          id: "1",
          type: "input",
          data: { label: "Trigger: Threat Ingested" },
          position: { x: 250, y: 20 },
          style: { background: "#0c0520", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.3)", borderRadius: "8px", fontFamily: "monospace", fontSize: "11px" }
        },
        {
          id: "2",
          type: "default",
          data: { label: "Condition: Class = SQL_INJECTION" },
          position: { x: 250, y: 120 },
          style: { background: "#0c0520", color: "#eab308", border: "1px solid rgba(234,179,8,0.3)", borderRadius: "8px", fontFamily: "monospace", fontSize: "11px" }
        },
        {
          id: "3",
          type: "output",
          data: { label: "Action: CREATE_INCIDENT" },
          position: { x: 100, y: 220 },
          style: { background: "#0c0520", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", fontFamily: "monospace", fontSize: "11px" }
        },
        {
          id: "4",
          type: "output",
          data: { label: "Action: SEND_SLACK_WEBHOOK" },
          position: { x: 400, y: 220 },
          style: { background: "#0c0520", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.3)", borderRadius: "8px", fontFamily: "monospace", fontSize: "11px" }
        }
      ];

      const initialEdges: Edge[] = [
        { id: "e1-2", source: "1", target: "2", animated: true },
        { id: "e2-3", source: "2", target: "3", label: "true", style: { stroke: "#22c55e" } },
        { id: "e2-4", source: "2", target: "4", label: "true", style: { stroke: "#22c55e" } }
      ];

      setNodes(initialNodes);
      setEdges(initialEdges);
    } else if (type === "bruteforce") {
      setName("Brute Force Containment Playbook");
      setDescription("Triggers on brute force alerts. Escalates ticket status, assigns a SOAR analyst, and adds an automated analysis comment.");
      setSeverityFilter("HIGH");
      setAttackFilter("BRUTE_FORCE");

      const initialNodes: Node[] = [
        {
          id: "1",
          type: "input",
          data: { label: "Trigger: Threat Ingested" },
          position: { x: 250, y: 20 },
          style: { background: "#0c0520", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.3)", borderRadius: "8px", fontFamily: "monospace", fontSize: "11px" }
        },
        {
          id: "2",
          type: "default",
          data: { label: "Condition: Class = BRUTE_FORCE" },
          position: { x: 250, y: 120 },
          style: { background: "#0c0520", color: "#eab308", border: "1px solid rgba(234,179,8,0.3)", borderRadius: "8px", fontFamily: "monospace", fontSize: "11px" }
        },
        {
          id: "3",
          type: "output",
          data: { label: "Action: CREATE_INCIDENT" },
          position: { x: 100, y: 220 },
          style: { background: "#0c0520", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", fontFamily: "monospace", fontSize: "11px" }
        },
        {
          id: "4",
          type: "output",
          data: { label: "Action: ASSIGN_ANALYST" },
          position: { x: 400, y: 220 },
          style: { background: "#0c0520", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "8px", fontFamily: "monospace", fontSize: "11px" }
        }
      ];

      const initialEdges: Edge[] = [
        { id: "e1-2", source: "1", target: "2", animated: true },
        { id: "e2-3", source: "2", target: "3", label: "true", style: { stroke: "#22c55e" } },
        { id: "e2-4", source: "2", target: "4", label: "true", style: { stroke: "#22c55e" } }
      ];

      setNodes(initialNodes);
      setEdges(initialEdges);
    }
  };

  // Add customized nodes to the React Flow canvas manually
  const addActionNode = (actionType: string) => {
    const id = (nodes.length + 1).toString();
    
    let color = "#ef4444"; // default red
    if (actionType === "ASSIGN_ANALYST" || actionType === "CREATE_AUDIT_LOG") color = "#10b981"; // green
    if (actionType === "SEND_SLACK_WEBHOOK" || actionType === "SEND_EMAIL") color = "#3b82f6"; // blue
    if (actionType === "CHANGE_SEVERITY" || actionType === "ADD_COMMENT") color = "#a855f7"; // purple

    const newNode: Node = {
      id,
      type: "output",
      data: { label: `Action: ${actionType}` },
      position: { x: 250 + (nodes.length * 20), y: 150 + (nodes.length * 30) },
      style: { background: "#0c0520", color: color, border: `1px solid ${color}40`, borderRadius: "8px", fontFamily: "monospace", fontSize: "11px" }
    };
    setNodes((nds) => nds.concat(newNode));
  };

  // Open creation workspace
  const handleNewPlaybook = () => {
    setEditingPlaybook(null);
    setName("");
    setDescription("");
    setTriggerType("threat_detected");
    setSeverityFilter("CRITICAL");
    setAttackFilter("SQL_INJECTION");
    
    // Set default trigger/condition nodes
    const defaultNodes: Node[] = [
      {
        id: "1",
        type: "input",
        data: { label: "Trigger: Threat Ingested" },
        position: { x: 250, y: 20 },
        style: { background: "#0c0520", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.3)", borderRadius: "8px", fontFamily: "monospace", fontSize: "11px" }
      }
    ];
    setNodes(defaultNodes);
    setEdges([]);
    setIsEditorOpen(true);
  };

  // Open editor workspace for selected playbook
  const handleEditPlaybook = (p: Playbook) => {
    setEditingPlaybook(p);
    setName(p.name);
    setDescription(p.description);
    setTriggerType(p.triggerType);
    setSeverityFilter(p.conditions?.severity?.[0] || "CRITICAL");
    setAttackFilter(p.conditions?.description?.[0] || "ANY");

    if (p.actions && p.actions.nodes) {
      setNodes(p.actions.nodes);
      setEdges(p.actions.edges || []);
    } else {
      // Create graph from sequential lists
      const defaultNodes: Node[] = [
        {
          id: "1",
          type: "input",
          data: { label: "Trigger: Threat Ingested" },
          position: { x: 250, y: 20 },
          style: { background: "#0c0520", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.3)", borderRadius: "8px", fontFamily: "monospace", fontSize: "11px" }
        }
      ];
      setNodes(defaultNodes);
      setEdges([]);
    }
    setIsEditorOpen(true);
  };

  const handleSavePlaybook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !description) return;

    // Build trigger conditions JSON
    const conditions: any = {};
    if (severityFilter !== "ANY") {
      conditions.severity = [severityFilter];
    }
    if (attackFilter !== "ANY") {
      conditions.description = [attackFilter];
    }

    // Capture nodes and edges from canvas
    const actionsGraph = {
      nodes: nodes.map(n => ({
        id: n.id,
        type: n.type,
        data: {
          label: n.data.label,
          actionType: n.data.label.startsWith("Action: ") ? n.data.label.replace("Action: ", "") : null,
          config: {}
        },
        position: n.position,
        style: n.style
      })),
      edges
    };

    try {
      if (editingPlaybook) {
        await updatePlaybookAction(editingPlaybook.id, {
          name,
          description,
          triggerType,
          conditions,
          actions: actionsGraph
        });
        setPlaybooks(prev => prev.map(c => c.id === editingPlaybook.id ? { 
          ...c, name, description, triggerType, conditions, actions: actionsGraph 
        } : c));
      } else {
        const newPlaybook = await createPlaybookAction({
          name,
          description,
          triggerType,
          conditions,
          actions: actionsGraph
        });
        
        const mapped: Playbook = {
          id: newPlaybook.id,
          name: newPlaybook.name,
          description: newPlaybook.description,
          enabled: newPlaybook.enabled,
          triggerType: newPlaybook.triggerType,
          conditions: typeof newPlaybook.conditions === "string" ? JSON.parse(newPlaybook.conditions) : newPlaybook.conditions,
          actions: typeof newPlaybook.actions === "string" ? JSON.parse(newPlaybook.actions) : newPlaybook.actions,
          createdAt: newPlaybook.createdAt.toISOString(),
          updatedAt: newPlaybook.updatedAt.toISOString()
        };
        setPlaybooks(prev => [mapped, ...prev]);
      }
      setIsEditorOpen(false);
    } catch (err) {
      console.error("Failed to save playbook:", err);
    }
  };

  const handleToggleEnabled = async (id: string, currentEnabled: boolean) => {
    try {
      await togglePlaybookEnabledAction(id, !currentEnabled);
      setPlaybooks(prev => prev.map(c => c.id === id ? { ...c, enabled: !currentEnabled } : c));
    } catch (err) {
      console.error("Failed to toggle playbook status:", err);
    }
  };

  const handleDeletePlaybook = async (id: string) => {
    if (!confirm("Are you sure you want to delete this automated playbook?")) return;
    try {
      await deletePlaybookAction(id);
      setPlaybooks(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error("Failed to delete playbook:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent flex items-center gap-2">
            <Network className="w-6 h-6 text-cyber-blue animate-pulse" />
            SOAR Automation Playbooks
          </h1>
          <p className="text-xs text-muted-foreground">
            Configure, visual-build, and deploy automated orchestration playbook models.
          </p>
        </div>
        <Button 
          size="sm" 
          onClick={handleNewPlaybook}
          className="bg-cyber-blue text-black hover:bg-cyber-blue/80 font-mono text-xs flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> CREATE PLAYBOOK
        </Button>
      </div>

      {/* Playbook Table */}
      <Card className="border-border bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyber-blue" />
            Automated Rules Matrix
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 font-mono text-[10px] text-muted-foreground">
                  <th className="p-3">Playbook Name</th>
                  <th className="p-3">Trigger Event</th>
                  <th className="p-3">Conditions Filter</th>
                  <th className="p-3">Actions Count</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Created Date</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono">
                {playbooks.length > 0 ? (
                  playbooks.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                      <td className="p-3 font-semibold text-foreground/90 font-sans text-xs max-w-[200px] truncate">
                        {p.name}
                        <span className="text-[10px] text-muted-foreground block font-mono mt-0.5 truncate max-w-[190px]">
                          {p.description}
                        </span>
                      </td>
                      <td className="p-3 uppercase text-cyber-blue text-[10px]">
                        {p.triggerType}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {p.conditions?.severity && (
                            <Badge variant="outline" className="text-[9px] border-cyber-orange/30 text-cyber-orange">
                              Sev: {p.conditions.severity.join(",")}
                            </Badge>
                          )}
                          {p.conditions?.description && (
                            <Badge variant="outline" className="text-[9px] border-cyber-yellow/30 text-cyber-yellow">
                              Class: {p.conditions.description.join(",")}
                            </Badge>
                          )}
                          {!p.conditions?.severity && !p.conditions?.description && (
                            <span className="text-white/40 italic text-[10px]">None (Always runs)</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-center text-white/80">
                        {getActionCount(p.actions)} Actions
                      </td>
                      <td className="p-3">
                        <button 
                          onClick={() => handleToggleEnabled(p.id, p.enabled)}
                          className="cursor-pointer focus:outline-none"
                        >
                          {p.enabled ? (
                            <ToggleRight className="w-6 h-6 text-cyber-green" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-white/30" />
                          )}
                        </button>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <Button 
                          variant="ghost" 
                          size="icon-sm" 
                          onClick={() => handleEditPlaybook(p)}
                          className="text-muted-foreground hover:text-cyber-blue"
                          title="Edit Playbook Flow"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon-sm" 
                          onClick={() => handleDeletePlaybook(p.id)}
                          className="text-muted-foreground hover:text-cyber-red"
                          title="Delete Playbook"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground text-[11px] font-sans">
                      No orchestration playbooks registered. Click + Create Playbook to construct an automated workflow.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Visual React Flow Canvas Editor Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-card border border-border w-full max-w-5xl h-[85vh] rounded-xl overflow-hidden flex flex-col relative shadow-2xl">
            <button 
              onClick={() => setIsEditorOpen(false)} 
              className="absolute top-4 right-4 z-20 text-muted-foreground hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex-1 flex flex-col md:flex-row min-h-0">
              {/* Left Configuration Form panel */}
              <div className="w-full md:w-80 border-r border-border p-5 overflow-y-auto space-y-4 text-xs shrink-0 bg-black/10">
                <div>
                  <h2 className="text-sm font-bold text-foreground">Playbook Configurator</h2>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Wire trigger properties to automated actions.</p>
                </div>

                <form onSubmit={handleSavePlaybook} className="space-y-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Playbook Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Automated Brute Force containment"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full bg-background border border-border rounded px-3 py-2 text-foreground focus:outline-none focus:border-cyber-blue"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Description</label>
                    <textarea
                      required
                      rows={2}
                      placeholder="Summary of response bounds..."
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      className="w-full bg-background border border-border rounded px-3 py-2 text-foreground focus:outline-none focus:border-cyber-blue"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Trigger Event Type</label>
                    <select
                      value={triggerType}
                      onChange={e => setTriggerType(e.target.value)}
                      className="w-full bg-background border border-border rounded px-3 py-2 text-foreground focus:outline-none focus:border-cyber-blue"
                    >
                      <option value="threat_detected">Threat Ingested</option>
                    </select>
                  </div>

                  {/* Condition logic filters */}
                  <div className="border-t border-border/40 pt-3 space-y-3">
                    <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1 font-bold">
                      <AlertTriangle className="w-3.5 h-3.5 text-cyber-yellow" /> Severity Trigger Filter
                    </h3>
                    <select
                      value={severityFilter}
                      onChange={e => setSeverityFilter(e.target.value)}
                      className="w-full bg-background border border-border rounded px-2 py-1.5 text-foreground focus:outline-none focus:border-cyber-blue"
                    >
                      <option value="ANY">ANY SEVERITY</option>
                      <option value="CRITICAL">CRITICAL</option>
                      <option value="HIGH">HIGH</option>
                      <option value="MEDIUM">MEDIUM</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1 font-bold">
                      <Radio className="w-3.5 h-3.5 text-cyber-blue" /> Attack Classification Filter
                    </h3>
                    <select
                      value={attackFilter}
                      onChange={e => setAttackFilter(e.target.value)}
                      className="w-full bg-background border border-border rounded px-2 py-1.5 text-foreground focus:outline-none focus:border-cyber-blue"
                    >
                      <option value="ANY">ANY CLASSIFICATION</option>
                      <option value="SQL_INJECTION">SQL_INJECTION</option>
                      <option value="COMMAND_INJECTION">COMMAND_INJECTION</option>
                      <option value="BRUTE_FORCE">BRUTE_FORCE</option>
                      <option value="DIRECTORY_TRAVERSAL">DIRECTORY_TRAVERSAL</option>
                    </select>
                  </div>

                  {/* Load template buttons */}
                  <div className="border-t border-border/40 pt-3 space-y-2">
                    <span className="text-[9px] font-mono uppercase text-muted-foreground block">Quick Start Templates</span>
                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => loadTemplate("sqli")} 
                        className="text-[9px] h-7 px-2 border-cyber-blue/30 text-cyber-blue hover:bg-cyber-blue/5 flex-1"
                      >
                        SQLi Temp
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => loadTemplate("bruteforce")} 
                        className="text-[9px] h-7 px-2 border-cyber-green/30 text-cyber-green hover:bg-cyber-green/5 flex-1"
                      >
                        Brute Temp
                      </Button>
                    </div>
                  </div>

                  <div className="border-t border-border/40 pt-4 flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsEditorOpen(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      className="bg-cyber-blue text-black hover:bg-cyber-blue/80 flex-1 font-semibold"
                    >
                      SAVE FLOW
                    </Button>
                  </div>
                </form>
              </div>

              {/* Center React Flow Canvas */}
              <div className="flex-1 relative bg-[#040108] h-full flex flex-col">
                {/* Node Options Bar */}
                <div className="h-12 border-b border-border bg-card/60 backdrop-blur-md px-4 flex items-center justify-between shrink-0 z-10">
                  <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-cyber-blue" /> Drag edges to connect triggers, severities, and actions.
                  </span>
                  
                  {/* Action Nodes Dropdown options */}
                  <div className="flex gap-1.5">
                    <Button 
                      onClick={() => addActionNode("CREATE_INCIDENT")} 
                      className="h-7 px-2 bg-cyber-red/10 border border-cyber-red/30 text-cyber-red hover:bg-cyber-red/20 font-mono text-[9px]"
                    >
                      + Create Incident
                    </Button>
                    <Button 
                      onClick={() => addActionNode("CREATE_CASE")} 
                      className="h-7 px-2 bg-cyber-blue/10 border border-cyber-blue/30 text-cyber-blue hover:bg-cyber-blue/20 font-mono text-[9px]"
                    >
                      + Create Case
                    </Button>
                    <Button 
                      onClick={() => addActionNode("SEND_SLACK_WEBHOOK")} 
                      className="h-7 px-2 bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 font-mono text-[9px]"
                    >
                      + Slack Webhook
                    </Button>
                  </div>
                </div>

                <div className="flex-1 min-h-0">
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    fitView
                  >
                    <Controls />
                    <MiniMap />
                    <Background color="rgba(255,255,255,0.05)" gap={16} />
                  </ReactFlow>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
