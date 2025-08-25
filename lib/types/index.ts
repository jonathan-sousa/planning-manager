// Types de base pour le planning manager

export interface Employee {
  id: string;
  name: string;
  email: string;
  positions: string[]; // Postes que l'employé peut occuper
  restrictions?: EmployeeRestriction[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EmployeeRestriction {
  type: 'unavailable' | 'max_hours' | 'prefer_not';
  dates?: string[]; // ISO date strings
  maxHours?: number;
  description?: string;
}

export interface Shift {
  id: string;
  date: string; // ISO date
  employeeId: string;
  position: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  isLocked?: boolean; // Manager a verrouillé cette affectation
  isForced?: boolean; // Manager a forcé malgré les règles
  violatedRules?: string[]; // IDs des règles violées si forced
}

export interface PlanningRule {
  id: string;
  name: string;
  type: 'min_rest' | 'max_hours' | 'required_positions' | 'custom';
  active: boolean;
  priority: number;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Planning {
  id: string;
  month: number;
  year: number;
  status: 'draft' | 'published' | 'archived';
  shifts: Shift[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}