/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Sparkles, Calendar, ClipboardCheck, ArrowRight, Loader2, HelpCircle } from "lucide-react";

interface TaskEntryProps {
  token: string;
  onAddTask: (taskData: {
    title: string;
    deadline: string; // ISO date YYYY-MM-DD
    priority: "Low" | "Medium" | "High";
    effort: string;
    category: "General" | "Work" | "Education" | "Health" | "Finance" | "Personal" | "Other";
    customCategory?: string;
  }) => Promise<void>;
  onStartEdit: () => void;
  onActivity?: () => void;
}

export default function TaskEntry({ token, onAddTask, onStartEdit, onActivity }: TaskEntryProps) {
  const [mode, setMode] = useState<"ai" | "direct">("ai");

  // AI Intake
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Direct Entry Fields
  const [title, setTitle] = useState("");
  const [dateInput, setDateInput] = useState(""); // DD-MM-YYYY
  const [dateError, setDateError] = useState<string | null>(null);
  const [priority, setPriority] = useState<"Low" | "Medium" | "High">("Medium");
  const [effort, setEffort] = useState("");
  const [category, setCategory] = useState<"General" | "Work" | "Education" | "Health" | "Finance" | "Personal" | "Other">("General");
  const [customCategory, setCustomCategory] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Date Hyphen Auto-Formatter
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onStartEdit();
    if (onActivity) onActivity();
    const rawVal = e.target.value;
    
    // Only numbers
    const clean = rawVal.replace(/\D/g, "").slice(0, 8);
    let formatted = "";
    if (clean.length > 0) {
      formatted += clean.slice(0, 2);
    }
    if (clean.length > 2) {
      formatted += "-" + clean.slice(2, 4);
    }
    if (clean.length > 4) {
      formatted += "-" + clean.slice(4, 8);
    }
    setDateInput(formatted);
    setDateError(null);
  };

  // Date Validator
  const validateDateString = (str: string): string | null => {
    // Regex check
    const regex = /^\d{2}-\d{2}-\d{4}$/;
    if (!regex.test(str)) {
      return "Enter a valid date.";
    }

    const parts = str.split("-");
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return "Enter a valid date.";
    }

    // Month length check
    const monthLengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    // Leap year
    if (year % 400 === 0 || (year % 100 !== 0 && year % 4 === 0)) {
      monthLengths[1] = 29;
    }

    if (day > monthLengths[month - 1]) {
      return "Enter a valid date.";
    }

    // Check if past date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(year, month - 1, day);

    if (selectedDate < today) {
      return "Enter a valid date.";
    }

    return null;
  };

  // Convert DD-MM-YYYY to YYYY-MM-DD for storage
  const convertToISO = (str: string): string => {
    const parts = str.split("-");
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  };

  // AI Intake Analysis
  const handleAiIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onActivity) onActivity();
    if (!aiInput.trim()) return;

    setAiLoading(true);
    setAiError(null);
    onStartEdit();

    try {
      const res = await fetch("/api/tasks/intake", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ text: aiInput.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Plan-Z is facing high demand right now — try again in a moment.");
      }

      // Populate Direct Entry fields with AI result
      setTitle(data.title || "");
      setDateInput(data.deadline || "");
      setPriority(data.priority || "Medium");
      setEffort(data.effort || "");
      setCategory(data.category || "General");
      setCustomCategory(data.customCategory || "");

      // Switch to Direct Entry for approval / review
      setMode("direct");
      setAiInput("");
    } catch (err: any) {
      console.error("AI Intake error:", err);
      setAiError(err.message || "Plan-Z is facing high demand right now — try again in a moment.");
    } finally {
      setAiLoading(false);
    }
  };

  // Form Submission
  const handleSubmitDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onActivity) onActivity();
    onStartEdit();

    // Validate date
    const dError = validateDateString(dateInput);
    if (dError) {
      setDateError(dError);
      return;
    }

    setIsSubmitting(true);
    try {
      const isoDate = convertToISO(dateInput);
      await onAddTask({
        title: title.trim(),
        deadline: isoDate,
        priority,
        effort: effort.trim() || "1 hour",
        category,
        customCategory: category === "Other" ? customCategory.trim() : undefined
      });

      // Clear fields
      setTitle("");
      setDateInput("");
      setPriority("Medium");
      setEffort("");
      setCategory("General");
      setCustomCategory("");
      setMode("ai"); // reset to AI mode for next task
    } catch (err) {
      console.error("Add task direct error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      {/* Tab Selectors */}
      <div className="mb-4 flex border-b border-slate-100 pb-2">
        <button
          onClick={() => {
            setMode("ai");
            onStartEdit();
            if (onActivity) onActivity();
          }}
          className={`flex-1 cursor-pointer pb-2 text-sm font-semibold transition-all duration-200 ${
            mode === "ai"
              ? "border-b-2 border-b-teal-600 text-teal-600"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <Sparkles className="h-4 w-4" />
            AI Intake
          </span>
        </button>
        <button
          onClick={() => {
            setMode("direct");
            onStartEdit();
            if (onActivity) onActivity();
          }}
          className={`flex-1 cursor-pointer pb-2 text-sm font-semibold transition-all duration-200 ${
            mode === "direct"
              ? "border-b-2 border-b-teal-600 text-teal-600"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <ClipboardCheck className="h-4 w-4" />
            Direct Entry
          </span>
        </button>
      </div>

      {/* AI Intake View */}
      {mode === "ai" ? (
        <form onSubmit={handleAiIntake} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Natural Language Intake
            </label>
            <textarea
              value={aiInput}
              onChange={(e) => {
                setAiInput(e.target.value);
                if (onActivity) onActivity();
              }}
              placeholder="e.g. Finish DSA assignment by Friday. Around 3 hours. High priority."
              rows={3}
              className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all duration-200 resize-none text-slate-700 placeholder:text-slate-400"
              required
              disabled={aiLoading}
            />
          </div>

          {aiError && (
            <p className="text-xs text-rose-600 font-medium bg-rose-50 border border-rose-50 rounded-xl p-2.5">
              {aiError}
            </p>
          )}

          <button
            type="submit"
            disabled={aiLoading || !aiInput.trim()}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200"
          >
            {aiLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing with Gemini...
              </>
            ) : (
              <>
                Analyze Task
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      ) : (
        /* Direct Entry Form */
        <form onSubmit={handleSubmitDirect} className="space-y-4 animate-fade-in">
          {/* Title */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Task Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                onStartEdit();
                if (onActivity) onActivity();
              }}
              placeholder="Task name"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all duration-200 text-slate-700"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Custom Date Input */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Deadline (DD-MM-YYYY)
              </label>
              <input
                type="text"
                value={dateInput}
                onChange={handleDateChange}
                placeholder="DD-MM-YYYY"
                maxLength={10}
                className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-1 transition-all duration-200 text-slate-700 ${
                  dateError
                    ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500"
                    : "border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                }`}
                required
              />
              {dateError && <p className="text-[10px] text-rose-600 font-bold tracking-tight animate-fade-in">{dateError}</p>}
            </div>

            {/* Effort */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Effort (Estimate)
              </label>
              <input
                type="text"
                value={effort}
                onChange={(e) => {
                  setEffort(e.target.value);
                  onStartEdit();
                  if (onActivity) onActivity();
                }}
                placeholder="e.g. 3 hours, 2 days"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all duration-200 text-slate-700"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Priority */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => {
                  setPriority(e.target.value as any);
                  onStartEdit();
                  if (onActivity) onActivity();
                }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all duration-200 text-slate-700 bg-white"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>

            {/* Category */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value as any);
                  onStartEdit();
                  if (onActivity) onActivity();
                }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all duration-200 text-slate-700 bg-white"
              >
                <option value="General">General</option>
                <option value="Work">Work</option>
                <option value="Education">Education</option>
                <option value="Health">Health</option>
                <option value="Finance">Finance</option>
                <option value="Personal">Personal</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Animated Custom Category Input */}
          {category === "Other" && (
            <div className="space-y-1 animate-fade-in">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Custom Category Name
              </label>
              <input
                type="text"
                value={customCategory}
                onChange={(e) => {
                  setCustomCategory(e.target.value);
                  onStartEdit();
                  if (onActivity) onActivity();
                }}
                placeholder="Enter custom category"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all duration-200 text-slate-700"
                required
              />
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Planning and Creating...
              </>
            ) : (
              "Add Task"
            )}
          </button>
        </form>
      )}
    </div>
  );
}
