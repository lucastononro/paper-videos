import React from 'react';
import { Audio } from 'remotion';

export const Narration: React.FC<{ audioSrc: string }> = ({ audioSrc }) => {
  return <Audio src={audioSrc} />;
};
