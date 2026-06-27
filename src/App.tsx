/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { LogOut, RefreshCw, X, AlertTriangle, Sparkles, CheckCircle2, Trophy, Loader2, Calendar, Lightbulb } from "lucide-react";
import {
  db,
  auth as firebaseAuth,
  signInWithEmailAndPassword,
  collection,
  query,
  where,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  addDoc,
  setDoc
} from "./firebase";
import { Task, Habit } from "./types";
import Branding from "./components/Branding";
import TaskEntry from "./components/TaskEntry";
import TaskCard from "./components/TaskCard";
import HabitTracker from "./components/HabitTracker";
import PlanZEscalate from "./components/PlanZEscalate";
import FeedbackForm from "./components/FeedbackForm";

const PRESET_SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What is your mother's maiden name?",
  "What city were you born in?",
  "What was the make of your first car?",
  "What was the name of your elementary school?"
];

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("planz_jwt"));
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  // Authentication Forms State
  const [authMode, setAuthMode] = useState<"login" | "signup" | "forgot">("login");
  const [inputUsername, setInputUsername] = useState("");
  const [inputPassword, setInputPassword] = useState("");
  const [inputSecurityQuestion, setInputSecurityQuestion] = useState("");
  const [inputSecurityAnswer, setInputSecurityAnswer] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // App Content State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [highestRankedTask, setHighestRankedTask] = useState<Task | null>(null);
  const [recoLoading, setRecoLoading] = useState(false);

  // Success Toast for adding tasks
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Plan-Z Escalation generation state
  const [isGeneratingPlanZ, setIsGeneratingPlanZ] = useState<Record<string, boolean>>({});
  const [planZError, setPlanZError] = useState<Record<string, string | null>>({});

  // Fetch Current User on boot
  useEffect(() => {
    const restoreSession = async () => {
      if (!token) {
        setBootstrapping(false);
        return;
      }
      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          setUserId(data.userId);
          setUsername(data.username);
          // Sync with client-side Firebase Auth
          await signInWithEmailAndPassword(firebaseAuth, data.firebaseEmail, data.firebasePassword);
        } else {
          // Stale session
          handleLogout();
        }
      } catch (err) {
        console.error("Session restore failed:", err);
      } finally {
        setBootstrapping(false);
      }
    };
    restoreSession();
  }, [token]);

  // Fetch Tasks for user from Firestore
  const fetchTasks = async () => {
    if (!userId) return;
    setLoadingTasks(true);
    try {
      const q = query(collection(db, "tasks"), where("userId", "==", userId));
      const snap = await getDocs(q);
      const list: Task[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          userId: data.userId,
          title: data.title,
          deadline: data.deadline,
          priority: data.priority,
          effort: data.effort,
          category: data.category,
          customCategory: data.customCategory,
          completion: data.completion || 0,
          status: data.status || "On Track",
          plan: data.plan,
          planZ: data.planZ,
          createdAt: data.createdAt
        });
      });
      setTasks(list);
      evaluateRecommendations(list);
    } catch (err) {
      console.error("Error fetching tasks:", err);
    } finally {
      setLoadingTasks(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchTasks();
    }
  }, [userId]);

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem("planz_jwt");
    setToken(null);
    setUserId(null);
    setUsername(null);
    setTasks([]);
    setHighestRankedTask(null);
    setAuthMode("login");
  };

  // Reset success toast immediately when editing
  const handleStartEdit = () => {
    setSuccessMessage(null);
  };

  // Auth Submit Handlers
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: inputUsername, password: inputPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Invalid username or password.");
      }
      localStorage.setItem("planz_jwt", data.token);
      setToken(data.token);
      setUserId(data.userId);
      setUsername(data.username);

      // Sign in to client-side Firebase Auth as well
      await signInWithEmailAndPassword(firebaseAuth, data.firebaseEmail, data.firebasePassword);
    } catch (err: any) {
      console.error("Login failed:", err);
      setAuthError(err.message || "Invalid username or password.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: inputUsername,
          password: inputPassword,
          securityQuestion: inputSecurityQuestion,
          securityAnswer: inputSecurityAnswer
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Signup failed.");
      }
      localStorage.setItem("planz_jwt", data.token);
      setToken(data.token);
      setUserId(data.userId);
      setUsername(data.username);

      // Sign in to client-side Firebase Auth as well
      await signInWithEmailAndPassword(firebaseAuth, data.firebaseEmail, data.firebasePassword);
    } catch (err: any) {
      console.error("Signup failed:", err);
      setAuthError(err.message || "Signup failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: inputUsername,
          securityAnswer: inputSecurityAnswer,
          newPassword: inputPassword
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reset password.");
      }
      setAuthError(null);
      alert("Password updated successfully! Please log in.");
      setAuthMode("login");
      setInputPassword("");
      setInputSecurityAnswer("");
    } catch (err: any) {
      console.error("Forgot password failed:", err);
      setAuthError(err.message || "Failed to reset password.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleFetchForgotQuestion = async () => {
    if (!inputUsername.trim()) {
      setAuthError("Username is required to retrieve question.");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch(`/api/auth/forgot-password/question?username=${encodeURIComponent(inputUsername)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Username not found.");
      }
      setInputSecurityQuestion(data.securityQuestion);
    } catch (err: any) {
      console.error("Fetch question failed:", err);
      setAuthError(err.message || "Username not found.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Add a Task (AI Intaked or Direct)
  const handleAddTask = async (taskData: {
    title: string;
    deadline: string;
    priority: "Low" | "Medium" | "High";
    effort: string;
    category: "General" | "Work" | "Education" | "Health" | "Finance" | "Personal" | "Other";
    customCategory?: string;
  }) => {
    try {
      // 1. Write the initial task document using the client SDK
      const initialTask: Omit<Task, "id"> = {
        userId: userId!,
        title: taskData.title,
        deadline: taskData.deadline,
        priority: taskData.priority,
        effort: taskData.effort,
        category: taskData.category,
        customCategory: taskData.customCategory,
        completion: 0,
        status: "On Track",
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, "tasks"), initialTask);
      const taskId = docRef.id;

      // Optimistically append to tasks list
      const addedTask: Task = { ...initialTask, id: taskId };
      setTasks((prev) => [...prev, addedTask]);

      // 2. Generate Plan in background using Planner Agent
      fetch(`/api/tasks/plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(taskData)
      })
        .then(async (res) => {
          if (!res.ok) throw new Error();
          const planData = await res.json();
          // Update Firestore
          await updateDoc(doc(db, "tasks", taskId), { plan: planData });
          // Update state
          setTasks((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, plan: planData } : t))
          );
        })
        .catch(() => {
          console.error("Planner agent background execution failed");
        });

      // 3. Trigger Success message toast
      setSuccessMessage("Task added successfully!");
      // Automatically disappear after 5 seconds
      setTimeout(() => {
        setSuccessMessage((curr) => (curr === "Task added successfully!" ? null : curr));
      }, 5000);
    } catch (err) {
      console.error("Error creating task:", err);
    }
  };

  // Update Completion Slider
  const handleUpdateCompletion = async (taskId: string, newCompletion: number) => {
    // Determine status based on completion and deadline
    let status: Task["status"] = "On Track";
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    if (newCompletion === 100) {
      status = "Completed";
    } else {
      // Determine urgency
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const deadlineDate = new Date(task.deadline);
      const diffTime = deadlineDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        status = "Critical";
      } else if (diffDays <= 1) {
        status = "Urgent";
      } else if (diffDays <= 3) {
        status = "Behind";
      } else {
        status = "On Track";
      }
    }

    const completedAt = newCompletion === 100 ? new Date().toISOString() : "";

    try {
      await updateDoc(doc(db, "tasks", taskId), {
        completion: newCompletion,
        status,
        completedAt
      });

      setTasks((prev) => {
        const updated = prev.map((t) =>
          t.id === taskId ? { ...t, completion: newCompletion, status, completedAt } : t
        );
        evaluateRecommendations(updated);
        return updated;
      });
    } catch (err) {
      console.error("Error updating completion:", err);
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId: string) => {
    handleStartEdit();
    try {
      await deleteDoc(doc(db, "tasks", taskId));
      setTasks((prev) => {
        const updated = prev.filter((t) => t.id !== taskId);
        evaluateRecommendations(updated);
        return updated;
      });
    } catch (err) {
      console.error("Error deleting task:", err);
    }
  };

  // Plan My Day Recommendations Engine
  const evaluateRecommendations = (tasksList: Task[]) => {
    const active = tasksList.filter((t) => t.status !== "Completed" && t.completion < 100);
    if (active.length === 0) {
      setHighestRankedTask(null);
      return;
    }

    const scored = active.map((t) => {
      let score = 0;

      // Priority score
      if (t.priority === "High") score += 300;
      else if (t.priority === "Medium") score += 200;
      else score += 100;

      // Completion gap score
      score += (100 - t.completion) * 2;

      // Deadline urgency score
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const deadlineDate = new Date(t.deadline);
      const diffTime = deadlineDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        score += 2000; // Critical overdue
      } else if (diffDays === 0) {
        score += 1000; // Due today
      } else if (diffDays === 1) {
        score += 500; // Due tomorrow
      } else if (diffDays <= 3) {
        score += 300;
      } else if (diffDays <= 7) {
        score += 100;
      }

      return { task: t, score };
    });

    scored.sort((a, b) => b.score - a.score);
    setHighestRankedTask(scored[0].task);
  };

  const handleRerunPlanMyDay = async () => {
    handleStartEdit();
    setRecoLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 800)); // simulation of rerun logic
    evaluateRecommendations(tasks);
    setRecoLoading(false);
  };

  // Plan-Z Escalate Monitor Actions
  const handleApprovePlanZ = async (taskId: string, backupPlan: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    try {
      // Elevate the task title or append escalation details to plan
      const updatedPlan = task.plan ? {
        ...task.plan,
        objective: `${task.plan.objective}\n[Approved Plan-Z Mitigation]: ${backupPlan}`
      } : undefined;

      await updateDoc(doc(db, "tasks", taskId), {
        plan: updatedPlan,
        status: "On Track", // Bring back to on-track as mitigation is approved
        planZ: null // clear active escalation card as it's resolved
      });

      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, plan: updatedPlan, status: "On Track", planZ: undefined } : t
        )
      );
    } catch (err) {
      console.error("Failed to approve Plan-Z:", err);
    }
  };

  const handleRegeneratePlanZ = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    setIsGeneratingPlanZ((prev) => ({ ...prev, [taskId]: true }));
    setPlanZError((prev) => ({ ...prev, [taskId]: null }));

    try {
      const res = await fetch("/api/tasks/escalate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: task.title,
          deadline: task.deadline,
          priority: task.priority,
          effort: task.effort,
          completion: task.completion
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Plan-Z is facing high demand right now — try again in a moment.");
      }

      // Update Firestore
      await updateDoc(doc(db, "tasks", taskId), { planZ: data });

      // Update state
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, planZ: data } : t))
      );
    } catch (err: any) {
      console.error("Regenerate Plan-Z failed:", err);
      setPlanZError((prev) => ({
        ...prev,
        [taskId]: "Plan-Z is facing high demand right now — try again in a moment."
      }));
    } finally {
      setIsGeneratingPlanZ((prev) => ({ ...prev, [taskId]: false }));
    }
  };

  // Bootstrapping view
  if (bootstrapping) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#f2f6f5] gap-4">
        <Branding size="lg" className="animate-pulse" />
        <div className="flex items-center gap-2 text-slate-400 font-medium text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
          Synchronizing space...
        </div>
      </div>
    );
  }

  // --- UNAUTHENTICATED SCREENS ---
  if (!token) {
    return (
      <div className="flex min-h-screen w-screen items-center justify-center bg-[#f2f6f5] px-4 py-12">
        {authMode === "signup" ? (
          <div className="w-full max-w-md bg-white/70 backdrop-blur-md border border-white/40 shadow-xl rounded-3xl p-8 transition-all duration-300">
            <form onSubmit={handleSignupSubmit} className="space-y-6">
              {/* Branding and Logo */}
              <div className="flex flex-col items-center justify-center text-center">
                <Branding size="lg" />
                <p className="mt-2 text-xs text-slate-500 font-bold uppercase tracking-wider">
                  Aesthetic Multi-Agent Workspace
                </p>
              </div>

              <h2 className="font-display text-2xl font-bold text-slate-800 text-center">Create Account</h2>

              {/* Dismissible Inline Error Alert */}
              {authError && (
                <div className="flex items-start gap-2.5 rounded-xl border border-rose-100 bg-rose-50/80 p-3.5 text-xs text-rose-800 relative animate-fade-in backdrop-blur-sm shadow-sm">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1 pr-6 font-semibold leading-relaxed">
                    {authError}
                  </div>
                  <button
                    type="button"
                    onClick={() => setAuthError(null)}
                    className="absolute right-2 top-2 p-1 rounded-lg text-rose-500 hover:bg-rose-100/50 cursor-pointer transition-colors"
                    aria-label="Dismiss error"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Username</label>
                  <input
                    type="text"
                    placeholder="Username (unique, lowercase)"
                    value={inputUsername}
                    onChange={(e) => setInputUsername(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all duration-200 text-slate-700 shadow-sm"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Password</label>
                  <input
                    type="password"
                    placeholder="Password"
                    value={inputPassword}
                    onChange={(e) => setInputPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all duration-200 text-slate-700 shadow-sm"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Security Question</label>
                  <div className="relative">
                    <select
                      value={inputSecurityQuestion}
                      onChange={(e) => setInputSecurityQuestion(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white/50 pl-4 pr-10 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all duration-200 text-slate-700 shadow-sm appearance-none cursor-pointer"
                      required
                    >
                      {PRESET_SECURITY_QUESTIONS.map((q, idx) => (
                        <option key={idx} value={q} className="bg-white text-slate-700">
                          {q}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Security Answer</label>
                  <input
                    type="text"
                    placeholder="Answer"
                    value={inputSecurityAnswer}
                    onChange={(e) => setInputSecurityAnswer(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all duration-200 text-slate-700 shadow-sm"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white shadow-md hover:bg-teal-700 disabled:opacity-50 transition-all duration-200 hover:shadow-teal-600/10"
              >
                {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign Up"}
              </button>

              <div className="flex justify-center pt-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setAuthError(null);
                  }}
                  className="text-teal-600 hover:text-teal-700 cursor-pointer transition-colors font-medium"
                >
                  Already have an account? Sign In
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="w-full max-w-md space-y-8">
            <div className="flex flex-col items-center">
              <Branding size="lg" />
              <p className="mt-2 text-sm text-slate-500 font-semibold uppercase tracking-wider">
                Aesthetic Multi-Agent Workspace
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
              {authMode === "login" && (
                <form onSubmit={handleLoginSubmit} className="space-y-6">
                  <h2 className="font-display text-2xl font-bold text-slate-800">Welcome Back</h2>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Username</label>
                      <input
                        type="text"
                        placeholder="Username"
                        value={inputUsername}
                        onChange={(e) => setInputUsername(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all duration-200 text-slate-700"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Password</label>
                      <input
                        type="password"
                        placeholder="Password"
                        value={inputPassword}
                        onChange={(e) => setInputPassword(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all duration-200 text-slate-700"
                        required
                      />
                    </div>
                  </div>

                  {authError && <p className="text-xs text-rose-600 font-bold">{authError}</p>}

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50 transition-all duration-200"
                  >
                    {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
                  </button>

                  <div className="flex items-center justify-between pt-2 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("signup");
                        setAuthError(null);
                        if (!inputSecurityQuestion) {
                          setInputSecurityQuestion(PRESET_SECURITY_QUESTIONS[0]);
                        }
                      }}
                      className="text-teal-600 hover:text-teal-700 cursor-pointer"
                    >
                      Create Account
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("forgot");
                        setAuthError(null);
                      }}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                </form>
              )}

              {authMode === "forgot" && (
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                  <h2 className="font-display text-2xl font-bold text-slate-800">Reset Password</h2>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Username</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Enter your username"
                          value={inputUsername}
                          onChange={(e) => setInputUsername(e.target.value)}
                          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all duration-200 text-slate-700"
                          required
                        />
                        <button
                          type="button"
                          onClick={handleFetchForgotQuestion}
                          className="rounded-xl bg-slate-100 border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer transition-all duration-200"
                        >
                          Retrieve
                        </button>
                      </div>
                    </div>

                    {inputSecurityQuestion && (
                      <div className="space-y-3 animate-fade-in">
                        <div className="rounded-xl bg-teal-50/50 p-3.5 border border-teal-50 text-xs font-semibold text-slate-700">
                          <span className="text-teal-600">Question:</span> {inputSecurityQuestion}
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Security Answer</label>
                          <input
                            type="text"
                            placeholder="Your answer"
                            value={inputSecurityAnswer}
                            onChange={(e) => setInputSecurityAnswer(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all duration-200 text-slate-700"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">New Password</label>
                          <input
                            type="password"
                            placeholder="New Password"
                            value={inputPassword}
                            onChange={(e) => setInputPassword(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all duration-200 text-slate-700"
                            required
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {authError && <p className="text-xs text-rose-600 font-bold">{authError}</p>}

                  <button
                    type="submit"
                    disabled={authLoading || !inputSecurityQuestion}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset Password"}
                  </button>

                  <div className="flex justify-center pt-2 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("login");
                        setAuthError(null);
                        setInputSecurityQuestion("");
                      }}
                      className="text-teal-600 hover:text-teal-700 cursor-pointer"
                    >
                      Back to Sign In
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- AUTHENTICATED SaaS INTERFACE ---
  // A small set of actionable SaaS pro tips
  const proTips = [
    "Scale Focus: Align daily main priorities to 3 key items for hyper-efficiency.",
    "Contingency: When a task status slides 'Behind', review the AI-drafted Plan-Z immediately.",
    "Rhythm: Complete habits early in the morning to spark an initial dopamine wave.",
    "Friction: Convert ambiguous long tasks into smaller 30-minute milestones."
  ];
  // Select a consistent tip based on the user ID length / day
  const tipIndex = userId ? userId.length % proTips.length : 0;
  const selectedTip = proTips[tipIndex];

  return (
    <div className="min-h-screen bg-[#f2f6f5] pb-16">
      {/* Navbar Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <Branding />

          {/* User Profile & Logout */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs font-bold text-slate-800 leading-none">{username}</span>
                <span className="text-[9px] font-bold text-teal-600 tracking-wider uppercase mt-1">Pro Account</span>
              </div>
              <div className="h-9 w-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-display font-bold text-slate-600 text-sm shadow-sm">
                {(username || "U").charAt(0).toUpperCase()}
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 cursor-pointer rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-all duration-200 shadow-sm"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Success Message Banner */}
      {successMessage && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-4 animate-fade-in">
          <div className="flex items-center justify-between rounded-xl border border-teal-100 bg-teal-50/80 px-4 py-3 text-sm font-semibold text-teal-800 backdrop-blur-sm shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-teal-600" />
              <span>{successMessage}</span>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="rounded-lg p-1 text-teal-600 hover:bg-teal-100/50 cursor-pointer transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main SaaS Workspace */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          
          {/* Left Sidebar (Column span: 3) */}
          <div className="space-y-6 lg:col-span-3">
            {/* Escalate Monitor */}
            <PlanZEscalate
              tasks={tasks}
              onApprovePlanZ={handleApprovePlanZ}
              onRegenerate={handleRegeneratePlanZ}
              isGenerating={isGeneratingPlanZ}
              generationError={planZError}
              onActivity={handleStartEdit}
            />

            {/* Pro Tip Card */}
            <div className="relative overflow-hidden p-5 bg-teal-600 rounded-2xl text-white shadow-lg shadow-teal-600/10">
              <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-10">
                <Lightbulb className="h-24 w-24" />
              </div>
              <div className="flex items-center gap-2 mb-2.5">
                <Lightbulb className="h-4 w-4 text-teal-100" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-teal-100">Pro Tip</span>
              </div>
              <p className="text-xs font-medium leading-relaxed text-teal-50">
                {selectedTip}
              </p>
            </div>
          </div>

          {/* Center Column (Column span: 6) */}
          <div className="space-y-6 lg:col-span-6">
            
            {/* Do This Next - Recommendation Banner */}
            {highestRankedTask ? (
              <div className="relative overflow-hidden rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-500 to-teal-600 p-6 sm:p-7 text-white shadow-md shadow-teal-500/10">
                <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 opacity-10">
                  <Sparkles className="h-48 w-48" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-teal-100">
                  Do This Next
                </p>
                <h2 className="font-display text-xl sm:text-2xl font-bold mt-2 leading-snug">
                  {highestRankedTask.title}
                </h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-xs font-medium text-teal-50">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-teal-200" />
                    <span>Due: {highestRankedTask.deadline.split("-").reverse().join("-")}</span>
                  </div>
                  <span>•</span>
                  <span>Category: {highestRankedTask.category === "Other" ? highestRankedTask.customCategory || "Other" : highestRankedTask.category}</span>
                  <span>•</span>
                  <span>Priority: {highestRankedTask.priority}</span>
                  <span>•</span>
                  <span>Progress: {highestRankedTask.completion}%</span>
                </div>

                <div className="mt-6 flex items-center gap-3">
                  <button
                    onClick={handleRerunPlanMyDay}
                    disabled={recoLoading}
                    className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-teal-700 shadow-sm hover:bg-teal-50 transition-all duration-200"
                  >
                    <RefreshCw className={`h-4 w-4 ${recoLoading ? "animate-spin" : ""}`} />
                    Plan My Day
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
                <div className="rounded-2xl bg-teal-50 p-4 text-teal-600 mb-3.5">
                  <Trophy className="h-8 w-8" />
                </div>
                <h3 className="font-display font-bold text-slate-800 text-lg">You are all clear!</h3>
                <p className="text-slate-400 text-sm mt-1 max-w-sm">
                  No active tasks. Use the task intake to plan your next objective.
                </p>
                <button
                  onClick={handleRerunPlanMyDay}
                  disabled={recoLoading}
                  className="mt-4 flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all duration-200 shadow-sm"
                >
                  <RefreshCw className={`h-4 w-4 ${recoLoading ? "animate-spin" : ""}`} />
                  Plan My Day
                </button>
              </div>
            )}

            {/* Task Entry form */}
            <TaskEntry token={token!} onAddTask={handleAddTask} onStartEdit={handleStartEdit} />

            {/* Task Cards Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-slate-800">SaaS Task Pipeline</h2>
                <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-0.5 text-xs font-bold text-slate-600 shadow-sm">
                  {tasks.length} total
                </span>
              </div>

              {loadingTasks ? (
                <div className="py-12 text-center text-slate-400 font-medium flex flex-col items-center gap-2 justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
                  <span>Loading tasks...</span>
                </div>
              ) : tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
                  <Branding size="sm" className="opacity-30 mb-3" />
                  <p className="text-slate-400 text-sm font-semibold">Your workspace is empty.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onUpdateCompletion={handleUpdateCompletion}
                      onDeleteTask={handleDeleteTask}
                      onStartEdit={handleStartEdit}
                    />
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Right Sidebar (Column span: 3) */}
          <div className="space-y-6 lg:col-span-3">
            {/* Habit Tracker */}
            <HabitTracker userId={userId!} onActivity={handleStartEdit} />

            {/* Feedback Form */}
            <FeedbackForm userId={userId!} onActivity={handleStartEdit} />
          </div>

        </div>
      </main>
    </div>
  );
}
