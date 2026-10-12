import React from 'react';

interface PathForgeLogoProps {
  className?: string;
  size?: number;
}

export const PathForgeLogo: React.FC<PathForgeLogoProps> = ({
  className = 'w-6 h-6',
  size,
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-label="PathForge Logo"
      role="img"
    >
      <defs>
        <linearGradient id="pf-nav-shield-stroke" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#58a6ff" />
          <stop offset="100%" stopColor="#39c5bb" />
        </linearGradient>
        <linearGradient id="pf-nav-shield-fill" x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#161d27" />
          <stop offset="100%" stopColor="#0a0e14" />
        </linearGradient>
      </defs>
      {/* Geometric Shield Outer */}
      <path
        d="M16 3 L27 7.5 C27 18.5 16 29 16 29 C16 29 5 18.5 5 7.5 Z"
        fill="url(#pf-nav-shield-fill)"
        stroke="url(#pf-nav-shield-stroke)"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* Infrastructure Network Paths */}
      <path
        d="M16 10 L10.5 17 L16 23.5 L21.5 17 Z"
        stroke="#58a6ff"
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill="none"
        opacity="0.9"
      />
      {/* Network Nodes */}
      <circle cx="16" cy="10" r="2.5" fill="#39c5bb" />
      <circle cx="10.5" cy="17" r="2.2" fill="#58a6ff" />
      <circle cx="21.5" cy="17" r="2.2" fill="#58a6ff" />
      <circle cx="16" cy="23.5" r="2.4" fill="#e3b341" />
    </svg>
  );
};
