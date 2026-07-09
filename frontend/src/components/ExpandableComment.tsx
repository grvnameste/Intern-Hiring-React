'use client';

import { useState } from 'react';

export function ExpandableComment({ comment }: { comment?: string | null }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!comment || comment.trim() === '') {
    return <span className="text-muted-foreground italic text-xs">No manager comment provided.</span>;
  }

  const MAX_LENGTH = 120;
  const isLong = comment.length > MAX_LENGTH;

  return (
    <div className="flex flex-col gap-1 w-full text-sm text-foreground align-middle" style={{ lineHeight: '1.6' }}>
      <div 
        className="whitespace-pre-wrap break-words" 
        style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}
      >
        {isLong && !isExpanded ? `${comment.slice(0, MAX_LENGTH)}...` : comment}
      </div>
      {isLong && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-primary hover:underline text-xs font-semibold self-start mt-1 transition-colors bg-transparent border-0 p-0 cursor-pointer"
        >
          {isExpanded ? 'Show Less' : 'Read More'}
        </button>
      )}
    </div>
  );
}
