import React from 'react';
import { AbsoluteFill } from 'remotion';

/**
 * Silent breath beat. Renders a clean dark frame for the duration.
 * Comprehension lives in these gaps — the brain integrates the previous beat.
 */
export const PauseBeat: React.FC = () => {
  return <AbsoluteFill style={{ backgroundColor: '#0e1117' }} />;
};
