import React from 'react';

export default function NotificationBadge({ 
  count = 0, 
  maxCount = 99, 
  size = 'medium',
  color = 'primary',
  position = 'top-right',
  showZero = false,
  pulse = false,
  className = ''
}) {
  if (!showZero && count === 0) {
    return null;
  }

  const displayCount = count > maxCount ? `${maxCount}+` : count.toString();
  
  const badgeClasses = [
    'notification-badge',
    `badge-${size}`,
    `badge-${color}`,
    `badge-${position}`,
    pulse && count > 0 ? 'badge-pulse' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <span className={badgeClasses} data-count={count}>
      {displayCount}
    </span>
  );
}

// Specialized badge components
export function UnreadBadge({ count, ...props }) {
  return (
    <NotificationBadge 
      count={count}
      color="primary"
      pulse={count > 0}
      {...props}
    />
  );
}

export function MentionBadge({ count, ...props }) {
  return (
    <NotificationBadge 
      count={count}
      color="mention"
      pulse={count > 0}
      {...props}
    />
  );
}

export function PriorityBadge({ count, ...props }) {
  return (
    <NotificationBadge 
      count={count}
      color="priority"
      pulse={count > 0}
      size="small"
      {...props}
    />
  );
}

export function MutedBadge({ isMuted, ...props }) {
  if (!isMuted) return null;
  
  return (
    <span className="muted-badge" {...props}>
      🔕
    </span>
  );
}
