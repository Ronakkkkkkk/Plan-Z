/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { AlertCircle, ChevronDown, ChevronUp, RefreshCw, Check, AlertTriangle } from "lucide-react";
import { Task } from "../types";

interface PlanZEscalateProps {
  tasks: Task[];
  onApprovePlanZ: (taskId: string, backupPlan: string) => Promise<void>;
  onRegenerate: (taskId: string) => Promise<void>;
  isGenerating: Record<string, boolean>;
  generationError: Record<string, string | null>;
  onActivity?: () => void;
}

export default function PlanZEscalate({
  tasks,
  onApprovePlanZ,
  onRegenerate,
  isGenerating,
  generationError,
  onActivity
}: PlanZEscalateProps) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Active (incomplete) tasks
  const activeTasks = tasks.filter((t) => t.status !== "Completed" && t.completion < 100);

  // Counts
  const onTrackCount = activeTasks.filter((t) => t.status === "On Track").length;
  const behindCount = activeTasks.filter((t) => t.status === "Behind").length;
  const urgentCount = activeTasks.filter((t) => t.status === "Urgent" || t.status === "Critical").length;
  const planZCount = activeTasks.filter((t) => t.planZ).length;

  // Tasks requiring intervention (Behind, Urgent, Critical)
  const interventionTasks = activeTasks.filter(
    (t) => t.status === "Behind" || t.status === "Urgent" || t.status === "Critical"
  );

  const toggleExpand = (taskId: string) => {
    if (onActivity) onActivity();
    setExpandedTaskId((prev) => (prev === taskId ? null : taskId));
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold text-slate-800">Plan-Z Escalate Monitor</h3>
          <p className="text-[10px] font-semibold text-teal-600 tracking-wider uppercase mt-0.5">Pipeline Active</p>
        </div>
        <AlertCircle className="h-5 w-5 text-teal-600 animate-pulse" />
      </div>

      {/* Grid of status counts */}
      <div className="mb-5 grid grid-cols-4 gap-2">
        <div className="rounded-xl bg-emerald-50/50 p-2 text-center border border-emerald-50">
          <p className="text-xs font-semibold text-emerald-700">On Track</p>
          <p className="font-display text-lg font-bold text-emerald-800 mt-0.5">{onTrackCount}</p>
        </div>
        <div className="rounded-xl bg-amber-50/50 p-2 text-center border border-amber-50">
          <p className="text-xs font-semibold text-amber-700">Behind</p>
          <p className="font-display text-lg font-bold text-amber-800 mt-0.5">{behindCount}</p>
        </div>
        <div className="rounded-xl bg-rose-50/50 p-2 text-center border border-rose-50">
          <p className="text-xs font-semibold text-rose-700">Urgent</p>
          <p className="font-display text-lg font-bold text-rose-800 mt-0.5">{urgentCount}</p>
        </div>
        <div className="rounded-xl bg-teal-50/50 p-2 text-center border border-teal-50">
          <p className="text-xs font-semibold text-teal-700">Plan-Z</p>
          <p className="font-display text-lg font-bold text-teal-800 mt-0.5">{planZCount}</p>
        </div>
      </div>

      {/* Intervention List */}
      <div className="space-y-3">
        {interventionTasks.length === 0 ? (
          <div className="py-4 text-center text-xs text-slate-400">
            All current systems stable. No tasks require escalation.
          </div>
        ) : (
          interventionTasks.map((task) => {
            const isExpanded = expandedTaskId === task.id;
            const generating = isGenerating[task.id!] || false;
            const error = generationError[task.id!] || null;

            return (
              <div
                key={task.id}
                className={`rounded-xl border transition-all duration-200 ${
                  isExpanded ? "border-teal-200 bg-teal-50/10" : "border-slate-100 bg-slate-50/30 hover:border-slate-200"
                }`}
              >
                {/* Header */}
                <div
                  onClick={() => toggleExpand(task.id!)}
                  className="flex cursor-pointer items-center justify-between p-3"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <h4 className="text-sm font-semibold text-slate-700 truncate">{task.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          task.status === "Critical"
                            ? "bg-rose-100 text-rose-700"
                            : task.status === "Urgent"
                            ? "bg-rose-50 text-rose-600"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {task.status}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        Progress: {task.completion}%
                      </span>
                    </div>
                  </div>
                  <div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-3 space-y-4 animate-fade-in">
                    {generating ? (
                      <div className="flex flex-col items-center justify-center py-6 gap-2">
                        <RefreshCw className="h-5 w-5 text-teal-600 animate-spin" />
                        <p className="text-xs text-slate-400">Drafting Escalation plans...</p>
                      </div>
                    ) : error ? (
                      <div className="rounded-xl bg-rose-50 p-3 border border-rose-100 text-center space-y-2">
                        <p className="text-xs text-rose-700 font-medium">{error}</p>
                        <button
                          onClick={() => {
                            if (onActivity) onActivity();
                            onRegenerate(task.id!);
                          }}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 transition-all duration-200"
                        >
                          Retry Draft Generation
                        </button>
                      </div>
                    ) : task.planZ ? (
                      <div className="space-y-3">
                        {/* Mitigation Plan */}
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Backup Mitigation Plan
                          </p>
                          <div className="rounded-xl bg-white p-3 border border-slate-100 text-xs text-slate-600 leading-relaxed max-h-40 overflow-y-auto">
                            {task.planZ.backupMitigationPlan}
                          </div>
                        </div>

                        {/* Extension Request */}
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Extension Request
                          </p>
                          <div className="rounded-xl bg-white p-3 border border-slate-100 text-xs text-slate-600 font-mono leading-relaxed max-h-40 overflow-y-auto">
                            {task.planZ.extensionRequest}
                          </div>
                        </div>

                        {/* Buttons */}
                        <div className="flex items-center gap-2 pt-2">
                          <button
                            onClick={() => {
                              if (onActivity) onActivity();
                              onApprovePlanZ(task.id!, task.planZ!.backupMitigationPlan);
                            }}
                            className="flex-1 inline-flex cursor-pointer items-center justify-center gap-1 rounded-xl bg-teal-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-700 transition-all duration-200"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              if (onActivity) onActivity();
                              onRegenerate(task.id!);
                            }}
                            className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all duration-200"
                            title="Regenerate Plans"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (onActivity) onActivity();
                              toggleExpand(task.id!);
                            }}
                            className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all duration-200"
                          >
                            Collapse
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 space-y-2">
                        <AlertTriangle className="h-5 w-5 text-amber-500 mx-auto" />
                        <p className="text-xs text-slate-400">No active plan. Let's run AI escalation analysis.</p>
                        <button
                          onClick={() => {
                            if (onActivity) onActivity();
                            onRegenerate(task.id!);
                          }}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-700 transition-all duration-200"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Generate Plan-Z Draft
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
