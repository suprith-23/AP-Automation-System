"use client";
import React from "react";
import SystemCard, { SystemCardProps } from "./SystemCard";

type ConnectorCarouselProps = {
  connections: SystemCardProps[];
};

const STATUS_PRIORITY: Record<string, number> = {
  active: 1,
  online: 1,
  healthy: 2,
  degraded: 3,
  expired: 4,
  revoked: 4,
  offline: 5,
};

const CARD_WIDTH = 300; // px — matches SystemCard min-width

export default function ConnectorCarousel({ connections }: ConnectorCarouselProps) {
  const sortedConnections = [...connections].sort((a, b) => {
    const prioA = STATUS_PRIORITY[a.status] || 9;
    const prioB = STATUS_PRIORITY[b.status] || 9;
    return prioA - prioB;
  });

  // Only animate when there are ≥4 cards (avoid single card sliding off screen)
  const useMarquee = sortedConnections.length >= 4;

  if (!useMarquee) {
    // Static layout for < 4 cards
    return (
      <div className="flex gap-5 w-full pt-4 pb-4 -mt-4 px-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sortedConnections.map((conn, idx) => (
          <div key={conn.name} style={{ width: CARD_WIDTH, flexShrink: 0 }}>
            <SystemCard {...conn} index={idx} />
          </div>
        ))}
      </div>
    );
  }

  // Duplicate the list for seamless infinite loop
  const doubled = [...sortedConnections, ...sortedConnections];

  return (
    <div
      className="w-full overflow-hidden pt-4 pb-4"
      role="region"
      aria-label="Connected systems carousel"
    >
      <div className="flex gap-5 animate-marquee">
        {doubled.map((conn, idx) => (
          <div
            key={`${conn.name}-${idx}`}
            style={{ width: CARD_WIDTH, flexShrink: 0 }}
          >
            <SystemCard {...conn} index={idx} />
          </div>
        ))}
      </div>
    </div>
  );
}
