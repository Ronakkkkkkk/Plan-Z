/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { db, collection, addDoc } from "../firebase";

interface FeedbackFormProps {
  userId: string;
  onActivity?: () => void;
}

export default function FeedbackForm({ userId, onActivity }: FeedbackFormProps) {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onActivity) onActivity();
    if (!message.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await addDoc(collection(db, "feedback"), {
        userId,
        message: message.trim(),
        createdAt: new Date().toISOString()
      });
      setSubmitted(true);
      setMessage("");
      setTimeout(() => setSubmitted(false), 5000); // Reset message after 5 seconds
    } catch (err: any) {
      console.error("Feedback error:", err);
      setError("Failed to send feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-teal-600" />
        <h3 className="font-display font-semibold text-slate-800">Feedback</h3>
      </div>

      {submitted ? (
        <div className="rounded-xl bg-teal-50 p-4 text-center text-sm font-medium text-teal-700 animate-fade-in">
          Thanks for the feedback!
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              if (onActivity) onActivity();
            }}
            placeholder="Help us improve Plan-Z..."
            rows={3}
            maxLength={500}
            className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all duration-200 resize-none text-slate-700 placeholder:text-slate-400"
            required
          />

          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting || !message.trim()}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200"
          >
            <Send className="h-4 w-4" />
            {isSubmitting ? "Sending..." : "Send Feedback"}
          </button>
        </form>
      )}
    </div>
  );
}
