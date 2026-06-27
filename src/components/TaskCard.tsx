/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Calendar, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Trash2, Sliders, ListTodo, BookOpen, Clock } from "lucide-react";
import { Task } from "../types";

interface TaskCardProps {
  key?: string;
  task: Task;
  onUpdateCompletion: (taskId: string, newCompletion: number) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onStartEdit: () => void;
}

export default function TaskCard({ task, onUpdateCompletion, onDeleteTask, onStartEdit }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [sliderValue, setSliderValue] = useState(task.completion);

  React.useEffect(() => {
    setSliderValue(task.completion);
  }, [task.completion]);

  // Border and text styling based on status
  let borderStyle = "border-l-4 border-l-emerald-500";
  let statusBadgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-100";

  if (task.status === "Completed") {
    borderStyle = "border-l-4 border-l-slate-400";
    statusBadgeStyle = "bg-slate-50 text-slate-500 border-slate-100";
  } else if (task.status === "Behind") {
    borderStyle = "border-l-4 border-l-amber-500";
    statusBadgeStyle = "bg-amber-50 text-amber-700 border-amber-100";
  } else if (task.status === "Urgent") {
    borderStyle = "border-l-4 border-l-rose-500";
    statusBadgeStyle = "bg-rose-50 text-rose-700 border-rose-100";
  } else if (task.status === "Critical") {
    borderStyle = "border-l-4 border-l-rose-600";
    statusBadgeStyle = "bg-rose-100 text-rose-800 border-rose-200";
  }

  // Format deadline for reading: DD-MM-YYYY
  const formatDisplayDate = (isoStr: string) => {
    if (!isoStr) return "";
    const parts = isoStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return isoStr;
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onStartEdit(); // Disappear success message instantly
    const val = parseInt(e.target.value, 10);
    setSliderValue(val);
  };

  const handleSliderCommit = () => {
    if (sliderValue !== task.completion) {
      onUpdateCompletion(task.id!, sliderValue);
    }
  };

  const handleToggleComplete = () => {
    onStartEdit();
    const newCompletion = task.status === "Completed" ? 0 : 100;
    setSliderValue(newCompletion);
    onUpdateCompletion(task.id!, newCompletion);
  };

  return (
    <div className={`rounded-2xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md transition-all duration-300 ${borderStyle}`}>
      {/* Upper Content */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusBadgeStyle}`}>
              {task.status}
            </span>
            <span className="rounded-full bg-slate-100 border border-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {task.category === "Other" ? task.customCategory || "Other" : task.category}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              task.priority === "High" ? "bg-rose-50 text-rose-600" : task.priority === "Medium" ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-600"
            }`}>
              {task.priority} Priority
            </span>
          </div>
          <h3 className={`font-display text-base font-bold leading-tight ${task.status === "Completed" ? "text-slate-400 line-through" : "text-slate-800"}`}>
            {task.title}
          </h3>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleToggleComplete}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-teal-600 cursor-pointer transition-all duration-200"
            title={task.status === "Completed" ? "Mark incomplete" : "Mark completed"}
          >
            <CheckCircle2 className={`h-5 w-5 ${task.status === "Completed" ? "text-teal-600 fill-teal-50" : ""}`} />
          </button>
          <button
            onClick={() => onDeleteTask(task.id!)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-rose-600 cursor-pointer transition-all duration-200"
            title="Delete task"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Info Row */}
      <div className="grid grid-cols-2 gap-3 mb-4 text-xs text-slate-500 font-medium">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-slate-400" />
          <span>Due: {formatDisplayDate(task.deadline)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-slate-400" />
          <span>Effort: {task.effort}</span>
        </div>
      </div>

      {/* Completion Slider */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1.5">
          <span>Completion</span>
          <span className="font-mono text-slate-700">{sliderValue}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={sliderValue}
          onChange={handleSliderChange}
          onMouseUp={handleSliderCommit}
          onTouchEnd={handleSliderCommit}
          className="custom-slider w-full cursor-pointer appearance-none rounded-lg"
          style={{
            background: `linear-gradient(to right, #0d9488 0%, #0d9488 ${sliderValue}%, #e2e8f0 ${sliderValue}%, #e2e8f0 100%)`
          }}
        />
      </div>

      {/* Expand/Collapse coach plan */}
      {task.plan && (
        <div className="border-t border-slate-50 pt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex w-full cursor-pointer items-center justify-between text-xs font-semibold text-teal-600 hover:text-teal-700 transition-all duration-200"
          >
            <span className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" />
              {expanded ? "Hide Coach Plan" : "View Coach Plan"}
            </span>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {expanded && (
            <div className="mt-4 space-y-4 text-slate-600 text-xs leading-relaxed animate-fade-in max-h-[400px] overflow-y-auto pr-1">
              {/* Objective */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Coaching Objective</p>
                <div className="rounded-xl bg-slate-50/50 p-3 border border-slate-50">{task.plan.objective}</div>
              </div>

              {/* Prep & Exec */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Preparation</p>
                  <div className="rounded-xl bg-slate-50/50 p-3 border border-slate-50 h-full">{task.plan.preparation}</div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Execution</p>
                  <div className="rounded-xl bg-slate-50/50 p-3 border border-slate-50 h-full">{task.plan.execution}</div>
                </div>
              </div>

              {/* Time Allocation & Labels */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Time Allocation</p>
                  <div className="rounded-xl bg-slate-50/50 p-3 border border-slate-50">{task.plan.timeAllocation}</div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Priority Cues</p>
                  <div className="rounded-xl bg-slate-50/50 p-3 border border-slate-50">{task.plan.priorityLabels}</div>
                </div>
              </div>

              {/* Milestones */}
              {task.plan.milestones && task.plan.milestones.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Milestones</p>
                  <ul className="list-disc list-inside space-y-1 rounded-xl bg-slate-50/50 p-3 border border-slate-50">
                    {task.plan.milestones.map((m, idx) => (
                      <li key={idx} className="text-slate-600">{m}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Final Checklist */}
              {task.plan.finalChecklist && task.plan.finalChecklist.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Final Checklist</p>
                  <ul className="list-disc list-inside space-y-1 rounded-xl bg-slate-50/50 p-3 border border-slate-50">
                    {task.plan.finalChecklist.map((c, idx) => (
                      <li key={idx} className="text-slate-600">{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {task.plan.recommendations && task.plan.recommendations.length > 0 && (
                <div className="rounded-xl bg-teal-50/40 border border-teal-50 p-3">
                  <p className="text-[10px] font-bold text-teal-700 uppercase tracking-wider mb-1.5">Coach Recommendations</p>
                  <ul className="list-disc list-inside space-y-1">
                    {task.plan.recommendations.map((r, idx) => (
                      <li key={idx} className="text-teal-800 font-medium">{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
