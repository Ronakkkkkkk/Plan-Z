/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Sparkles, Plus, Check, Flame, Trash2 } from "lucide-react";
import { db, collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc } from "../firebase";
import { Habit } from "../types";

interface HabitTrackerProps {
  userId: string;
  onActivity?: () => void;
}

export default function HabitTracker({ userId, onActivity }: HabitTrackerProps) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  // Helper to get local date string YYYY-MM-DD
  const getLocalDateString = (d: Date = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Helper to calculate exact streak based on browser local date history
  const calculateStreak = (history: string[]): number => {
    if (history.length === 0) return 0;
    
    // De-duplicate and sort descending
    const sorted = [...new Set(history)].sort().reverse();
    const todayStr = getLocalDateString(new Date());
    const yesterdayStr = getLocalDateString(new Date(Date.now() - 86400000));

    const lastCompleted = sorted[0];
    
    // If last completed date is neither today nor yesterday, the streak is reset to 0
    if (lastCompleted !== todayStr && lastCompleted !== yesterdayStr) {
      return 0;
    }

    let streak = 1;
    let currentCheck = new Date(lastCompleted);

    for (let i = 1; i < sorted.length; i++) {
      const prevCheck = new Date(currentCheck.getTime() - 86400000);
      const prevCheckStr = getLocalDateString(prevCheck);
      if (sorted[i] === prevCheckStr) {
        streak++;
        currentCheck = prevCheck;
      } else {
        break;
      }
    }
    return streak;
  };

  // Fetch habits
  const fetchHabits = async () => {
    try {
      const q = query(collection(db, "habits"), where("userId", "==", userId));
      const snap = await getDocs(q);
      const list: Habit[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          userId: data.userId,
          title: data.title,
          streak: data.streak || 0,
          history: data.history || [],
          createdAt: data.createdAt
        });
      });
      // Synchronize streaks on load just in case days passed
      const updatedList = list.map((h) => {
        const correctStreak = calculateStreak(h.history);
        return { ...h, streak: correctStreak };
      });
      setHabits(updatedList);
    } catch (err) {
      console.error("Error fetching habits:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHabits();
  }, [userId]);

  const handleAddHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onActivity) onActivity();
    if (!newTitle.trim()) return;

    setIsAdding(true);
    try {
      const newHabit: Omit<Habit, "id"> = {
        userId,
        title: newTitle.trim(),
        streak: 0,
        history: [],
        createdAt: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, "habits"), newHabit);
      setHabits((prev) => [...prev, { ...newHabit, id: docRef.id }]);
      setNewTitle("");
    } catch (err) {
      console.error("Error adding habit:", err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleCompleteToday = async (habit: Habit) => {
    if (onActivity) onActivity();
    const todayStr = getLocalDateString();
    if (habit.history.includes(todayStr)) return; // Already completed today

    const updatedHistory = [...habit.history, todayStr];
    const updatedStreak = calculateStreak(updatedHistory);

    try {
      const habitRef = doc(db, "habits", habit.id!);
      await updateDoc(habitRef, {
        history: updatedHistory,
        streak: updatedStreak
      });

      setHabits((prev) =>
        prev.map((h) =>
          h.id === habit.id ? { ...h, history: updatedHistory, streak: updatedStreak } : h
        )
      );
    } catch (err) {
      console.error("Error completing habit:", err);
    }
  };

  const handleDeleteHabit = async (habitId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onActivity) onActivity();
    try {
      await deleteDoc(doc(db, "habits", habitId));
      setHabits((prev) => prev.filter((h) => h.id !== habitId));
    } catch (err) {
      console.error("Error deleting habit:", err);
    }
  };

  const todayStr = getLocalDateString();

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-teal-600" />
          <h3 className="font-display font-semibold text-slate-800">Habits</h3>
        </div>
        <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700">
          {habits.length} Active
        </span>
      </div>

      {/* Add Habit Form */}
      <form onSubmit={handleAddHabit} className="mb-4 flex gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => {
            setNewTitle(e.target.value);
            if (onActivity) onActivity();
          }}
          placeholder="New daily habit..."
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all duration-200 text-slate-700"
          required
        />
        <button
          type="submit"
          disabled={isAdding || !newTitle.trim()}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200"
        >
          <Plus className="h-5 w-5" />
        </button>
      </form>

      {/* Habits List */}
      {loading ? (
        <div className="py-6 text-center text-xs text-slate-400">Loading habits...</div>
      ) : habits.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-400">No habits added yet.</div>
      ) : (
        <div className="space-y-2.5">
          {habits.map((h) => {
            const isCompletedToday = h.history.includes(todayStr);
            return (
              <div
                key={h.id}
                className="group flex items-center justify-between rounded-xl border border-slate-50 bg-slate-50/50 p-2.5 hover:border-slate-100 hover:bg-slate-50 transition-all duration-200"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    onClick={() => handleCompleteToday(h)}
                    disabled={isCompletedToday}
                    className={`flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg border transition-all duration-200 ${
                      isCompletedToday
                        ? "border-teal-600 bg-teal-600 text-white"
                        : "border-slate-300 hover:border-teal-500 hover:bg-teal-50 text-transparent"
                    }`}
                  >
                    <Check className="h-4 w-4" />
                  </button>

                  <div className="min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${
                        isCompletedToday ? "text-slate-400 line-through" : "text-slate-700"
                      }`}
                    >
                      {h.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Flame className={`h-3.5 w-3.5 ${h.streak > 0 ? "text-orange-500 fill-orange-500" : "text-slate-300"}`} />
                      <span className="text-xs font-semibold text-slate-500">
                        {h.streak} day{h.streak !== 1 && "s"}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => handleDeleteHabit(h.id!, e)}
                  className="hidden cursor-pointer p-1 text-slate-400 hover:text-rose-600 group-hover:block transition-all duration-200"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
