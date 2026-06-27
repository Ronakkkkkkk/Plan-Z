/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { localDb } from "./server-db";
import { initializeApp as initializeClientApp } from "firebase/app";
import {
  initializeFirestore,
  collection as firestoreCollection,
  getDocs as firestoreGetDocs,
  addDoc as firestoreAddDoc,
  setDoc as firestoreSetDoc,
  updateDoc as firestoreUpdateDoc,
  deleteDoc as firestoreDeleteDoc,
  doc as firestoreDoc,
  query as firestoreQuery,
  where as firestoreWhere
} from "firebase/firestore";

const app = express();
const PORT = 3000;
const JWT_SECRET = "Plan-Z-super-secret-jwt-key-2026";
const PASSWORD_PEPPER = "Plan-Z-password-pepper-value";
const AUTH_PEPPER = "Plan-Z-firebase-auth-pepper";

// Load Firebase Config
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
if (!fs.existsSync(configPath)) {
  console.error("firebase-applet-config.json not found!");
  process.exit(1);
}
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

// Initialize client Firebase SDK with long polling for maximum reliability in Node.js
const firebaseApp = initializeClientApp(firebaseConfig);
const db = initializeFirestore(firebaseApp, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId);

app.use(express.json());

// Hash helper using HMAC SHA256
function hashHmac(str: string, pepper: string): string {
  return crypto.createHmac("sha256", pepper).update(str).digest("hex");
}

// --- JWT Middleware ---
interface AuthenticatedRequest extends express.Request {
  user?: {
    userId: string;
    username: string;
  };
}

const authenticateToken = (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction): void => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({ error: "Access denied." });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      res.status(403).json({ error: "Invalid token." });
      return;
    }
    req.user = decoded as { userId: string; username: string };
    next();
  });
};

// --- GEMINI HELPER ---
async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryWithKey(key: string, contents: string, responseSchema: any, systemInstruction?: string): Promise<any> {
  const ai = new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.1,
    }
  });

  if (!response.text) {
    throw new Error("Empty response");
  }

  return JSON.parse(response.text.trim());
}

async function callGemini(contents: string, responseSchema: any, systemInstruction?: string): Promise<any> {
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3
  ].filter(Boolean) as string[];

  if (keys.length === 0) {
    throw new Error("Plan-Z is facing high demand right now — try again in a moment.");
  }

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    try {
      const response = await tryWithKey(key, contents, responseSchema, systemInstruction);
      return response;
    } catch (err: any) {
      console.error(`Gemini call failed with key ${i + 1}:`, err.message || err);
      const is503 = err.status === 503 || (err.message && err.message.includes('503'));
      if (is503) {
        await delay(500);
        try {
          const response = await tryWithKey(key, contents, responseSchema, systemInstruction);
          return response;
        } catch (retryErr: any) {
          console.error(`Gemini retry failed with key ${i + 1}:`, retryErr.message || retryErr);
        }
      }
    }
  }

  throw new Error("Plan-Z is facing high demand right now — try again in a moment.");
}

// --- AUTH API ENDPOINTS ---

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { username, password, securityQuestion, securityAnswer } = req.body;
    
    // Server-side logging for diagnostics
    console.log("[SERVER SIGNUP] Received signup payload for username:", username);

    if (!username || !password || !securityQuestion || !securityAnswer) {
      console.error("[SERVER SIGNUP ERROR] Missing fields in signup payload");
      res.status(400).json({ error: "All fields are required." });
      return;
    }

    const normUsername = username.toLowerCase().trim();
    if (normUsername.length < 3) {
      console.error("[SERVER SIGNUP ERROR] Username too short:", normUsername);
      res.status(400).json({ error: "Username must be at least 3 characters." });
      return;
    }

    // Check uniqueness using localDb
    const users = localDb.getCollection("users");
    const existing = users.find((u: any) => u.username === normUsername);
    if (existing) {
      console.error("[SERVER SIGNUP ERROR] Username already taken:", normUsername);
      res.status(400).json({ error: "Username already taken." });
      return;
    }

    const passwordHash = hashHmac(password, PASSWORD_PEPPER);
    const securityAnswerHash = hashHmac(securityAnswer.toLowerCase().trim(), PASSWORD_PEPPER);

    // Save Profile to localDb
    let userDoc: any;
    try {
      userDoc = localDb.insertItem("users", {
        username: normUsername,
        passwordHash,
        securityQuestion,
        securityAnswerHash,
        createdAt: new Date().toISOString()
      });
      console.log("[SERVER SIGNUP SUCCESS] User profile saved for user ID:", userDoc.id);
    } catch (dbErr: any) {
      console.error("[SERVER SIGNUP ERROR] Failed to save user profile to localDb:", dbErr);
      res.status(500).json({ error: "Failed to register credentials." });
      return;
    }

    const userId = userDoc.id;

    // Generate JWT
    const token = jwt.sign({ userId, username: normUsername }, JWT_SECRET, { expiresIn: "7d" });
    const firebaseEmail = `user_${normUsername}@planz.local`;
    const firebasePassword = hashHmac(normUsername, AUTH_PEPPER);

    res.json({
      token,
      userId,
      username: normUsername,
      firebaseEmail,
      firebasePassword
    });
  } catch (err: any) {
    console.error("[SERVER SIGNUP ERROR] Unexpected signup exception:", err);
    res.status(500).json({ error: "Failed to register credentials." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required." });
      return;
    }

    const normUsername = username.toLowerCase().trim();

    // Query User document using localDb
    const users = localDb.getCollection("users");
    const userData = users.find((u: any) => u.username === normUsername);
    if (!userData) {
      console.error("[SERVER LOGIN ERROR] User not found:", normUsername);
      res.status(401).json({ error: "Invalid username or password." });
      return;
    }

    const userId = userData.id;

    // Verify Password
    const passwordHash = hashHmac(password, PASSWORD_PEPPER);
    if (passwordHash !== userData.passwordHash) {
      console.error("[SERVER LOGIN ERROR] Password mismatch for user:", normUsername);
      res.status(401).json({ error: "Invalid username or password." });
      return;
    }

    // Generate JWT
    const token = jwt.sign({ userId, username: normUsername }, JWT_SECRET, { expiresIn: "7d" });
    const firebaseEmail = `user_${normUsername}@planz.local`;
    const firebasePassword = hashHmac(normUsername, AUTH_PEPPER);

    res.json({
      token,
      userId,
      username: normUsername,
      firebaseEmail,
      firebasePassword
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Invalid username or password." });
  }
});

app.get("/api/auth/forgot-password/question", async (req, res) => {
  try {
    const username = req.query.username as string;
    if (!username) {
      res.status(400).json({ error: "Username is required." });
      return;
    }

    const normUsername = username.toLowerCase().trim();
    const users = localDb.getCollection("users");
    const userData = users.find((u: any) => u.username === normUsername);
    if (!userData) {
      console.error("[SERVER FORGOT QUESTION ERROR] User not found:", normUsername);
      res.status(404).json({ error: "Username not found." });
      return;
    }

    res.json({ securityQuestion: userData.securityQuestion });
  } catch (err) {
    console.error("Forgot password question error:", err);
    res.status(500).json({ error: "Failed to retrieve security question." });
  }
});

app.post("/api/auth/forgot-password/reset", async (req, res) => {
  try {
    const { username, securityAnswer, newPassword } = req.body;
    if (!username || !securityAnswer || !newPassword) {
      res.status(400).json({ error: "All fields are required." });
      return;
    }

    const normUsername = username.toLowerCase().trim();
    const users = localDb.getCollection("users");
    const userData = users.find((u: any) => u.username === normUsername);
    if (!userData) {
      console.error("[SERVER FORGOT RESET ERROR] User not found:", normUsername);
      res.status(404).json({ error: "Username not found." });
      return;
    }

    const userId = userData.id;

    const answerHash = hashHmac(securityAnswer.toLowerCase().trim(), PASSWORD_PEPPER);
    if (answerHash !== userData.securityAnswerHash) {
      console.error("[SERVER FORGOT RESET ERROR] Security answer hash mismatch for user:", normUsername);
      res.status(400).json({ error: "Invalid security answer." });
      return;
    }

    // Reset password locally
    const newPasswordHash = hashHmac(newPassword, PASSWORD_PEPPER);
    try {
      localDb.updateItem("users", userId, {
        passwordHash: newPasswordHash
      });
      console.log("[SERVER FORGOT RESET SUCCESS] Password reset successfully for user ID:", userId);
    } catch (err: any) {
      console.error("[SERVER FORGOT RESET ERROR] Update password in localDb failed:", err);
      res.status(500).json({ error: "Failed to reset password." });
      return;
    }

    res.json({ success: true, message: "Password updated successfully." });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Failed to reset password." });
  }
});

app.get("/api/auth/me", authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Not authorized." });
    return;
  }
  const firebaseEmail = `user_${req.user.username}@planz.local`;
  const firebasePassword = hashHmac(req.user.username, AUTH_PEPPER);

  res.json({
    userId: req.user.userId,
    username: req.user.username,
    firebaseEmail,
    firebasePassword
  });
});

// --- GENERIC DATABASE ENDPOINTS FOR PROXY ---

app.get("/api/db/tasks", authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const q = firestoreQuery(firestoreCollection(db, "tasks"), firestoreWhere("userId", "==", userId));
    const snapshot = await firestoreGetDocs(q);
    const tasks: any[] = [];
    snapshot.forEach((doc) => {
      tasks.push({ ...doc.data(), id: doc.id });
    });
    res.json(tasks);
  } catch (err: any) {
    console.error("[SERVER DB ERROR] Failed to fetch tasks from Firestore:", err);
    res.status(500).json({ error: "Failed to fetch tasks." });
  }
});

app.post("/api/db/tasks", authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const task = { ...req.body, userId };
    const docRef = await firestoreAddDoc(firestoreCollection(db, "tasks"), task);
    res.json({ ...task, id: docRef.id });
  } catch (err: any) {
    console.error("[SERVER DB ERROR] Failed to save task to Firestore:", err);
    res.status(500).json({ error: "Failed to save task." });
  }
});

app.put("/api/db/tasks/:id", authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const docRef = firestoreDoc(db, "tasks", id);
    await firestoreSetDoc(docRef, { ...req.body, userId });
    res.json({ ...req.body, id, userId });
  } catch (err: any) {
    console.error("[SERVER DB ERROR] Failed to update task (PUT) in Firestore:", err);
    res.status(500).json({ error: "Failed to update task." });
  }
});

app.patch("/api/db/tasks/:id", authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const docRef = firestoreDoc(db, "tasks", id);
    await firestoreUpdateDoc(docRef, req.body);
    res.json({ id });
  } catch (err: any) {
    console.error("[SERVER DB ERROR] Failed to update task (PATCH) in Firestore:", err);
    res.status(500).json({ error: "Failed to update task." });
  }
});

app.delete("/api/db/tasks/:id", authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const docRef = firestoreDoc(db, "tasks", id);
    await firestoreDeleteDoc(docRef);
    res.json({ success: true });
  } catch (err: any) {
    console.error("[SERVER DB ERROR] Failed to delete task in Firestore:", err);
    res.status(500).json({ error: "Failed to delete task." });
  }
});

app.get("/api/db/habits", authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const q = firestoreQuery(firestoreCollection(db, "habits"), firestoreWhere("userId", "==", userId));
    const snapshot = await firestoreGetDocs(q);
    const habits: any[] = [];
    snapshot.forEach((doc) => {
      habits.push({ ...doc.data(), id: doc.id });
    });
    res.json(habits);
  } catch (err: any) {
    console.error("[SERVER DB ERROR] Failed to fetch habits from Firestore:", err);
    res.status(500).json({ error: "Failed to fetch habits." });
  }
});

app.post("/api/db/habits", authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const habit = { ...req.body, userId };
    const docRef = await firestoreAddDoc(firestoreCollection(db, "habits"), habit);
    res.json({ ...habit, id: docRef.id });
  } catch (err: any) {
    console.error("[SERVER DB ERROR] Failed to save habit to Firestore:", err);
    res.status(500).json({ error: "Failed to save habit." });
  }
});

app.patch("/api/db/habits/:id", authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const docRef = firestoreDoc(db, "habits", id);
    await firestoreUpdateDoc(docRef, req.body);
    res.json({ id });
  } catch (err: any) {
    console.error("[SERVER DB ERROR] Failed to update habit in Firestore:", err);
    res.status(500).json({ error: "Failed to update habit." });
  }
});

app.delete("/api/db/habits/:id", authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const docRef = firestoreDoc(db, "habits", id);
    await firestoreDeleteDoc(docRef);
    res.json({ success: true });
  } catch (err: any) {
    console.error("[SERVER DB ERROR] Failed to delete habit in Firestore:", err);
    res.status(500).json({ error: "Failed to delete habit." });
  }
});

app.post("/api/db/feedback", authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const feedback = { ...req.body, userId };
    const docRef = await firestoreAddDoc(firestoreCollection(db, "feedback"), feedback);
    res.json({ ...feedback, id: docRef.id });
  } catch (err: any) {
    console.error("[SERVER DB ERROR] Failed to save feedback to Firestore:", err);
    res.status(500).json({ error: "Failed to send feedback." });
  }
});

// --- AI API ENDPOINTS ---

app.post("/api/tasks/intake", authenticateToken as any, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "Valid text input is required." });
      return;
    }

    const systemInstruction = `You are the Intake Agent of the Plan-Z app. Extract title, deadline (DD-MM-YYYY), priority (Low, Medium, or High), effort (e.g. 3 hours), and category.
If category is not General, Work, Education, Health, Finance, or Personal, set category to 'Other' and specify customCategory.
Provide output STRICTLY according to the response schema.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        deadline: { type: Type.STRING, description: "Extract date in DD-MM-YYYY format, if no date is mentioned default to tomorrow or blank" },
        priority: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
        effort: { type: Type.STRING },
        category: { type: Type.STRING, enum: ["General", "Work", "Education", "Health", "Finance", "Personal", "Other"] },
        customCategory: { type: Type.STRING, description: "If category is Other, prefill custom category name" }
      },
      required: ["title", "deadline", "priority", "effort", "category"]
    };

    const result = await callGemini(text, responseSchema, systemInstruction);
    res.json(result);
  } catch (err: any) {
    console.error("Intake error:", err);
    res.status(500).json({ error: "Plan-Z is facing high demand right now — try again in a moment." });
  }
});

app.post("/api/tasks/plan", authenticateToken as any, async (req, res) => {
  try {
    const { title, deadline, priority, effort, category, customCategory } = req.body;
    if (!title) {
      res.status(400).json({ error: "Task title is required." });
      return;
    }

    const systemInstruction = `You are the Planner Agent, a top-tier SaaS productivity coach. Create an actionable, comprehensive plan to complete this task.
Include:
- objective: specific goals
- preparation: items/reading/materials needed
- execution: step-by-step phases
- timeAllocation: how to distribute effort
- priorityLabels: key prioritization cues
- milestones: check-in achievements
- finalChecklist: closing tasks
- recommendations: professional coaching advice.
Keep your tone encouraging, extremely professional, and precise.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        objective: { type: Type.STRING },
        preparation: { type: Type.STRING },
        execution: { type: Type.STRING },
        timeAllocation: { type: Type.STRING },
        priorityLabels: { type: Type.STRING },
        milestones: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        finalChecklist: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        recommendations: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      },
      required: ["objective", "preparation", "execution", "timeAllocation", "priorityLabels", "milestones", "finalChecklist", "recommendations"]
    };

    const taskText = `Task details:
Title: ${title}
Deadline: ${deadline}
Priority: ${priority}
Effort: ${effort}
Category: ${category} ${customCategory ? `(${customCategory})` : ""}`;

    const result = await callGemini(taskText, responseSchema, systemInstruction);
    res.json(result);
  } catch (err: any) {
    console.error("Planner error:", err);
    res.status(500).json({ error: "Plan-Z is facing high demand right now — try again in a moment." });
  }
});

app.post("/api/tasks/escalate", authenticateToken as any, async (req, res) => {
  try {
    const { title, deadline, priority, effort, completion } = req.body;
    if (!title) {
      res.status(400).json({ error: "Task title is required." });
      return;
    }

    const systemInstruction = `You are the Plan-Z Escalate Monitor. Generate a backup mitigation plan and extension request for a task that is falling behind.
The backup plan should be a "Minimum Viable Plan" to salvage progress.
The extension request should be a professional message requesting more time.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        status: { type: Type.STRING, enum: ["On Track", "Behind", "Urgent", "Critical"] },
        backupMitigationPlan: { type: Type.STRING },
        extensionRequest: { type: Type.STRING }
      },
      required: ["status", "backupMitigationPlan", "extensionRequest"]
    };

    const taskText = `Task falling behind:
Title: ${title}
Deadline: ${deadline}
Priority: ${priority}
Effort: ${effort}
Completion %: ${completion}`;

    const result = await callGemini(taskText, responseSchema, systemInstruction);
    res.json(result);
  } catch (err: any) {
    console.error("Escalation error:", err);
    res.status(500).json({ error: "Plan-Z is facing high demand right now — try again in a moment." });
  }
});

// --- VITE DEV AND PROD MIDDLEWARE SETUP ---

async function setupViteAndListen() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Plan-Z server running on http://localhost:${PORT}`);
  });
}

setupViteAndListen();
