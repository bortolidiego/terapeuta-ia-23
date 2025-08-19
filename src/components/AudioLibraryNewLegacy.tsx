// Deprecated: Use AudioLibrarySimplified instead
import React from 'react';
import { AudioLibrarySimplified } from './AudioLibrarySimplified';

// Legacy component wrapper - redirect to new simplified version
export const AudioLibraryNew = () => {
  return <AudioLibrarySimplified />;
};