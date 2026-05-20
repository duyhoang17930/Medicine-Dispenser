// ============================================================================
// shadcn-inspired Component Library
// Maintains the existing dark/neon cyber aesthetic
// ============================================================================

import React from 'react';

// -----------------------------------------------------------------------------
// Card Component
// -----------------------------------------------------------------------------
export function Card({ children, className = '', style = {} }) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--bg-card)',
        backdropFilter: 'blur(20px)',
        border: '1px solid var(--glass-border)',
        borderRadius: 16,
        padding: '20px 22px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.25s ease',
        ...style,
      }}
    >
      {/* Top border highlight */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: 'linear-gradient(90deg, transparent, var(--glass-highlight), transparent)',
          opacity: 0.5,
        }}
      />
      {children}
    </div>
  );
}

// CardHeader
export function CardHeader({ title, icon }) {
  return (
    <h2
      style={{
        fontSize: '0.8rem',
        fontWeight: 500,
        color: 'var(--text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      {/* Indicator dot */}
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 2,
          background: 'var(--neon-amber)',
          boxShadow: '0 0 10px var(--neon-amber-glow)',
          display: 'inline-block',
        }}
      />
      {title}
    </h2>
  );
}

// CardContent
export function CardContent({ children }) {
  return <div>{children}</div>;
}

// -----------------------------------------------------------------------------
// Button Component
// -----------------------------------------------------------------------------
export function Button({
  children,
  variant = 'primary',
  size = 'default',
  disabled = false,
  onClick,
  className = '',
  style = {},
}) {
  const baseStyle = {
    flex: 1,
    minWidth: 130,
    padding: '16px 24px',
    border: 'none',
    borderRadius: 12,
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    position: 'relative',
    overflow: 'hidden',
    opacity: disabled ? 0.5 : 1,
    ...style,
  };

  const variants = {
    primary: {
      background: 'var(--gradient-amber)',
      color: '#000',
      boxShadow: '0 4px 16px rgba(245, 158, 11, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
    },
    secondary: {
      background: 'var(--gradient-blue)',
      color: '#fff',
      boxShadow: '0 4px 16px rgba(59, 130, 246, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
    },
    ghost: {
      background: 'var(--glass-bg)',
      border: '1px solid var(--glass-border)',
      color: 'var(--text-secondary)',
    },
    outline: {
      background: 'transparent',
      border: '1px solid var(--glass-border)',
      color: 'var(--text-secondary)',
    },
  };

  const handleMouseEnter = (e) => {
    if (disabled) return;
    if (variant === 'primary') {
      e.target.style.transform = 'translateY(-2px)';
      e.target.style.boxShadow = '0 8px 24px rgba(245, 158, 11, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
    } else if (variant === 'secondary') {
      e.target.style.transform = 'translateY(-2px)';
      e.target.style.boxShadow = '0 8px 24px rgba(59, 130, 246, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.15)';
    } else if (variant === 'ghost' || variant === 'outline') {
      e.target.style.background = 'rgba(139, 92, 246, 0.1)';
      e.target.style.borderColor = 'var(--neon-purple)';
      e.target.style.color = 'var(--neon-purple)';
    }
  };

  const handleMouseLeave = (e) => {
    if (disabled) return;
    e.target.style.transform = 'translateY(0)';
    if (variant === 'ghost' || variant === 'outline') {
      e.target.style.background = 'var(--glass-bg)';
      e.target.style.borderColor = 'var(--glass-border)';
      e.target.style.color = 'var(--text-secondary)';
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={{ ...baseStyle, ...variants[variant] }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </button>
  );
}

// -----------------------------------------------------------------------------
// Badge Component
// -----------------------------------------------------------------------------
export function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: {
      background: 'var(--glass-bg)',
      color: 'var(--text-secondary)',
    },
    success: {
      background: 'var(--neon-green-dim)',
      color: 'var(--neon-green)',
    },
    error: {
      background: 'var(--neon-red-dim)',
      color: 'var(--neon-red)',
    },
    warning: {
      background: 'var(--neon-amber-dim)',
      color: 'var(--neon-amber)',
    },
    purple: {
      background: 'var(--neon-purple-dim)',
      color: 'var(--neon-purple)',
    },
  };

  return (
    <span
      className={className}
      style={{
        padding: '4px 10px',
        borderRadius: 6,
        fontSize: '0.7rem',
        fontWeight: 600,
        fontFamily: "'JetBrains Mono', monospace",
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        display: 'inline-block',
        ...variants[variant],
      }}
    >
      {children}
    </span>
  );
}

// -----------------------------------------------------------------------------
// StatusDot Component
// -----------------------------------------------------------------------------
export function StatusDot({ online, className = '' }) {
  return (
    <span
      className={className}
      style={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: online ? 'var(--neon-green)' : 'var(--neon-red)',
        boxShadow: online
          ? '0 0 12px var(--neon-green-glow)'
          : '0 0 8px var(--neon-red-dim)',
        animation: online ? 'pulse-online 2s ease-in-out infinite' : 'none',
      }}
    />
  );
}

// -----------------------------------------------------------------------------
// StatusItem Component
// -----------------------------------------------------------------------------
export function StatusItem({ label, online }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '14px 16px',
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: 10,
        transition: 'all 0.2s ease',
      }}
    >
      <StatusDot online={online} />
      <span
        style={{
          fontSize: '0.85rem',
          fontWeight: 500,
          color: 'var(--text-primary)',
        }}
      >
        {label}
      </span>
    </div>
  );
}

// -----------------------------------------------------------------------------
// LogItem Component
// -----------------------------------------------------------------------------
export function LogItem({ slot, time, status }) {
  const statusVariant = {
    success: 'success',
    fail: 'error',
    'no-pill-detected': 'warning',
    pending: 'warning',
  };

  const statusLabels = {
    success: 'OK',
    fail: 'Lỗi',
    'no-pill-detected': 'None',
    pending: 'Đợi...',
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        background:
          status === 'success'
            ? 'var(--neon-green-dim)'
            : status === 'pending'
              ? 'rgba(251, 191, 36, 0.1)'
              : status === 'fail'
                ? 'var(--neon-red-dim)'
                : 'var(--neon-amber-dim)',
        border: '1px solid var(--glass-border)',
        borderRadius: 10,
        borderLeft: `3px solid ${
          status === 'success'
            ? 'var(--neon-green)'
            : status === 'pending'
              ? 'var(--neon-amber)'
              : status === 'fail'
                ? 'var(--neon-red)'
                : 'var(--neon-amber)'
        }`,
        transition: 'all 0.2s ease',
      }}
    >
      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
        Thuốc {slot}
      </span>
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.7rem',
          color: 'var(--text-muted)',
        }}
      >
        {time}
      </span>
      <Badge variant={statusVariant[status]}>{statusLabels[status]}</Badge>
    </div>
  );
}

// -----------------------------------------------------------------------------
// EmptyState Component
// -----------------------------------------------------------------------------
export function EmptyState({ message }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '40px 20px',
        color: 'var(--text-muted)',
        fontSize: '0.85rem',
      }}
    >
      {message}
    </div>
  );
}

// -----------------------------------------------------------------------------
// ActivityLog Component
// -----------------------------------------------------------------------------
export function ActivityLog({ logs }) {
  return (
    <div
      style={{
        background: '#0a0a0e',
        border: '1px solid var(--glass-border)',
        borderRadius: 10,
        padding: 14,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.7rem',
        color: 'var(--neon-green)',
        maxHeight: 140,
        overflowY: 'auto',
        lineHeight: 1.7,
        position: 'relative',
      }}
    >
      {logs.map((log, i) => (
        <div key={i}>{log}</div>
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------------
// VoiceButton Component
// -----------------------------------------------------------------------------
export function VoiceButton({ listening, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: listening ? 'var(--neon-purple-dim)' : 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        color: listening ? 'var(--neon-purple)' : 'var(--text-secondary)',
        width: '100%',
        marginTop: 14,
        padding: '16px 24px',
        borderRadius: 12,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.8rem',
        letterSpacing: '0.05em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.25s ease',
        animation: listening ? 'microphone-pulse 1s ease-in-out infinite' : 'none',
      }}
    >
      🎤 MIC
    </button>
  );
}