import { z } from 'zod';

// Schémas de validation Zod

export const EmployeeSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  email: z.string().email(),
  positions: z.array(z.string()).min(1),
  restrictions: z.array(z.object({
    type: z.enum(['unavailable', 'max_hours', 'prefer_not']),
    dates: z.array(z.string()).optional(),
    maxHours: z.number().positive().optional(),
    description: z.string().optional(),
  })).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const ShiftSchema = z.object({
  id: z.string(),
  date: z.string(),
  employeeId: z.string(),
  position: z.string(),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  isLocked: z.boolean().optional(),
  isForced: z.boolean().optional(),
  violatedRules: z.array(z.string()).optional(),
});

export const PlanningSchema = z.object({
  id: z.string(),
  month: z.number().min(1).max(12),
  year: z.number().min(2024),
  status: z.enum(['draft', 'published', 'archived']),
  shifts: z.array(ShiftSchema),
  createdBy: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});