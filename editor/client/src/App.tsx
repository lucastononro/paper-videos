import React from 'react';
import { useRoute } from './router';
import { GalleryPage } from './gallery/GalleryPage';
import { EditorPage } from './editor/EditorPage';

export const App: React.FC = () => {
  const route = useRoute();
  if (route.kind === 'editor') {
    return <EditorPage slug={route.slug} />;
  }
  return <GalleryPage />;
};
