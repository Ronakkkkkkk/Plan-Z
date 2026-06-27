/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserProfile {
  username: string;
  passwordHash: string;
  securityQuestion: string;
  securityAnswerHash: string;
  createdAt: string;
}

export interface TaskPlan {
  objective: string;
  preparation: string;
  execution: string;
  timeAllocation: string;
  priorityLabels: string;
  milestones: string[];
  finalChecklist: string[];
  recommendations: string[];
}

export interface PlanZEscalation {
  status: 'On Track' | 'Behind' | 'Urgent' | 'Critical';
  backupMitigationPlan: string;
  extensionRequest: string;
  updatedAt: string;
}

export interface Task {
  id?: string;
  userId: string;
  title: string;
  deadline: string; // ISO date string YYYY-MM-DD
  priority: 'Low' | 'Medium' | 'High';
  effort: string; // e.g. "3 hours"
  category: 'General' | 'Work' | 'Education' | 'Health' | 'Finance' | 'Personal' | 'Other';
  customCategory?: string;
  completion: number; // 0 to 100
  status: 'On Track' | 'Behind' | 'Urgent' | 'Critical' | 'Completed';
  plan?: TaskPlan;
  planZ?: PlanZEscalation;
  completedAt?: string;
  createdAt: string;
}

export interface Habit {
  id?: string;
  userId: string;
  title: string;
  streak: number;
  history: string[]; // local dates: YYYY-MM-DD
  createdAt: string;
}

export interface Feedback {
  id?: string;
  userId: string;
  message: string;
  createdAt: string;
}
