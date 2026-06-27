/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface BrandingProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export default function Branding({ size = "md", className = "" }: BrandingProps) {
  let containerSize = "h-10 w-10";
  let iconSize = "h-6 w-6";
  let textSize = "text-xl";

  if (size === "sm") {
    containerSize = "h-8 w-8";
    iconSize = "h-5 w-5";
    textSize = "text-lg";
  } else if (size === "lg") {
    containerSize = "h-14 w-14";
    iconSize = "h-8 w-8";
    textSize = "text-3xl";
  } else if (size === "xl") {
    containerSize = "h-20 w-20";
    iconSize = "h-12 w-12";
    textSize = "text-4xl";
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Custom Teal Clipboard Logo with White Checkmark */}
      <div className={`relative flex items-center justify-center rounded-xl bg-teal-600 shadow-md shadow-teal-600/20 ${containerSize}`}>
        <svg
          className={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Clipboard body */}
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" stroke="white" />
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" fill="white" stroke="white" />
          {/* White checkmark inside */}
          <path d="m9 14 2 2 4-4" stroke="white" strokeWidth="3" />
        </svg>
      </div>
      <span className={`font-display font-bold tracking-tight text-slate-800 ${textSize}`}>
        Plan-<span className="text-teal-600">Z</span>
      </span>
    </div>
  );
}
