import { useState } from 'react';

const COLLAPSE_AFTER = 500;

export default function ExpandableReviewText({ text = '' }) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = text.length > COLLAPSE_AFTER;

  return (
    <>
      <p className={`review-text${canExpand && !expanded ? ' review-text-collapsed' : ''}`}>
        {text}
      </p>
      {canExpand && (
        <button
          type="button"
          className="link review-text-toggle"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </>
  );
}
