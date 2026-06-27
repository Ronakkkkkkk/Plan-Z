<div align="center">
<img width="1200" height="475" alt="Plan-Z Banner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />

# Plan-Z

**AI-Powered Multi-Agent Planning, Built to Beat Your Deadlines**

Built for [Vibe2Ship](https://blockseblock.com) — Coding Ninjas x Google for Developers
Problem Statement 1: *The Last-Minute Life Saver*

[Live App](https://plan-z-87224077387.us-west1.run.app) · [Project Description Doc](#)

</div>

---

## Overview

Plan-Z is an AI-powered productivity workspace that turns natural-language input into structured, actionable plans. Instead of passive reminders that are easy to ignore, Plan-Z runs a multi-agent Gemini pipeline that breaks down tasks, builds real plans, ranks your day by urgency, and proactively flags work that's falling behind — before a deadline is actually missed.

## Key Features

- **AI Task Intake** — Describe a task in plain language ("Finish DSA assignment by Friday, ~3 hours, high priority") and the Intake Agent extracts a structured task: title, deadline, priority, effort, and category.
- **Direct Entry Mode** — A manual task form for when you'd rather skip the AI and enter details yourself, with a custom strict `DD-MM-YYYY` date input and a category dropdown.
- **AI Planner Agent** — Every task gets a real, structured plan: objective, preparation, ordered execution steps, time allocation, priority labels, milestones, a final checklist, and recommendations — not a generic response.
- **Recommendation Engine ("Plan My Day")** — Ranks all active tasks by combining deadline urgency, priority, remaining effort, and completion percentage, and surfaces the single most important thing to do next.
- **Plan-Z Escalate Monitor** — Autonomously watches tasks against remaining time and completion percentage. When a task falls behind, it generates a Minimum Viable Plan and an Extension Request without being asked, and automatically retries generation if the AI call fails.
- **Habit Tracker** — Daily habit tracking based on local device date (not UTC), with streak tracking and the ability to undo an accidental same-day completion.
- **Feedback System** — A simple in-app feedback form stored per-user in Firestore.
- **Resilient AI Layer** — Every Gemini call automatically rotates across multiple API keys on failure (503/quota exhaustion) before falling back to a friendly "high demand" message — no raw errors, stack traces, or quota details are ever shown to the user.

## Technologies Used

**Frontend:** React, TypeScript, Vite, Tailwind CSS, Framer Motion
**Backend:** Node.js, Express, TypeScript
**Database:** Firebase Firestore
**Auth:** Custom username/password authentication with JWT (no email required), security question + answer for password recovery, HMAC SHA256 hashing for passwords and security answers

## Google Technologies Utilized

- **Gemini API** (`gemini-2.5-flash-lite`) — powers the Intake Agent, Planner Agent, and Plan-Z Escalate Monitor's mitigation/extension drafting
- **Firebase Firestore** — primary data store for users, tasks, habits, and feedback
- **Google AI Studio** — used as the core tool to build and deploy the application
- **Google Cloud Run** — hosts the deployed, publicly accessible application

## Live Application

🔗 **https://plan-z-87224077387.us-west1.run.app**

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set your Gemini API key(s) in [.env.local](.env.local):
GEMINI_API_KEY=your_key_here
GEMINI_API_KEY_2=optional_fallback_key
GEMINI_API_KEY_3=optional_fallback_key

3. Run the app:
   `npm run dev`

View this app in AI Studio: https://ai.studio/apps/f0310597-7e0a-4339-96c9-02612d992a1c

## Known Limitations

- Firestore rules currently allow backend-authenticated writes broadly rather than enforcing per-document rules via Firebase Auth; full per-user enforcement via an Admin SDK–based backend connection is planned as a post-submission hardening step.
