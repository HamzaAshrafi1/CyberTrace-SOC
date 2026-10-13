export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type IncidentStatus = "open" | "investigating" | "resolved";
export type ThreatStatus = "active" | "mitigated" | "whitelisted";

export interface Organization {
  id: string; // maps to Clerk org_id
  name: string;
  region: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  id: string; // maps to Clerk user_id
  email: string;
  name: string;
  organizationId: string;
  role: "admin" | "analyst";
  createdAt: Date;
}

export interface SecurityThreat {
  id: string;
  organizationId: string;
  timestamp: Date;
  sourceIp: string;
  targetNode: string;
  threatType: string;
  severity: Severity;
  status: ThreatStatus;
  payload: string;
}

export interface Incident {
  id: string;
  organizationId: string;
  title: string;
  category: string;
  threatCount: number;
  severity: "critical" | "high" | "medium";
  status: IncidentStatus;
  assignedTo: string;
  createdTime: Date;
  description: string;
}

export interface ComplianceCheck {
  id: string;
  organizationId: string;
  policy: string;
  category: string;
  status: "compliant" | "warning" | "failed";
  checkedDate: Date;
  remediation: string;
}
