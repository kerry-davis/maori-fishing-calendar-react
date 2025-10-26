import React, { useState, useCallback } from 'react';
import { Modal } from './Modal';
import { createPlaceholderSVG } from '@shared/utils/photoPreviewUtils';

interface PhotoMetadata {
  species?: string;
  length?: string;
  weight?: string;
  time?: string;
  date?: string;
  location?: string;
  water?: string;
}

export interface PhotoViewerModalProps {
  isOpen: boolean;
  photoSrc?: string;
  requiresAuth?: boolean;
  metadata?: PhotoMetadata;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  resolveImageSrc?: (originalSrc: string) => string | undefined;
}

export const PhotoViewerModal: React.FC<PhotoViewerModalProps> = ({
  isOpen,
  photoSrc,
  requiresAuth = false,
  metadata,
  onClose,
  onNext,
  onPrevious,
  resolveImageSrc,
}) => {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(event.targetTouches[0]?.clientX ?? null);
  }, []);

  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    setTouchEnd(event.targetTouches[0]?.clientX ?? null);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchStart === null || touchEnd === null) return;
    const distance = touchStart - touchEnd;
    if (distance > 50 && onNext) {
      onNext();
    } else if (distance < -50 && onPrevious) {
      onPrevious();
    }
  }, [touchStart, touchEnd, onNext, onPrevious]);

  const handleImageError = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const target = event.currentTarget;
      if (resolveImageSrc) {
        const next = resolveImageSrc(target.src);
        if (next && next !== target.src && !target.dataset.retry) {
          target.dataset.retry = 'true';
          target.src = next;
          return;
        }
      }
      if (!target.dataset.fallbackApplied) {
        target.dataset.fallbackApplied = 'true';
        target.src = createPlaceholderSVG('Image not available');
      }
    },
    [resolveImageSrc]
  );

  const hasNavigation = Boolean(onNext || onPrevious);

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="3xl">
      <div className="relative">
        {hasNavigation && onPrevious && (
          <button
            onClick={onPrevious}
            className="icon-btn absolute left-4 top-1/2 -translate-y-1/2 z-10"
            aria-label="Previous photo"
          >
            <i className="fas fa-chevron-left"></i>
          </button>
        )}

        {hasNavigation && onNext && (
          <button
            onClick={onNext}
            className="icon-btn absolute right-4 top-1/2 -translate-y-1/2 z-10"
            aria-label="Next photo"
          >
            <i className="fas fa-chevron-right"></i>
          </button>
        )}

        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-gray-600 bg-opacity-70 text-white p-3 rounded-full hover:bg-opacity-90 transition-all duration-200"
          aria-label="Close photo viewer"
        >
          <i className="fas fa-times"></i>
        </button>

        <div
          className="flex items-center justify-center bg-gray-50 dark:bg-gray-600 p-2 overflow-auto"
          style={{ maxHeight: '70vh' }}
          onTouchStart={hasNavigation ? handleTouchStart : undefined}
          onTouchMove={hasNavigation ? handleTouchMove : undefined}
          onTouchEnd={hasNavigation ? handleTouchEnd : undefined}
        >
          {photoSrc ? (
            <img
              src={photoSrc}
              alt={metadata?.species ? `${metadata.species} catch photo` : 'Fish catch photo'}
              className="block object-contain bg-white dark:bg-gray-700 rounded-lg shadow-lg"
              style={{ maxWidth: '90vw', maxHeight: '68vh', width: 'auto', height: 'auto' }}
              loading="eager"
              onError={handleImageError}
            />
          ) : (
            <img
              src={createPlaceholderSVG('No Photo')}
              alt="No photo available"
              className="block object-contain bg-white dark:bg-gray-700 rounded-lg shadow-lg"
              style={{ maxWidth: '90vw', maxHeight: '68vh', width: 'auto', height: 'auto' }}
            />
          )}
          {requiresAuth && (
            <div
              className="absolute top-3 left-3 z-20 px-2 py-1 rounded text-xs font-medium"
              style={{ backgroundColor: 'rgba(17,24,39,0.7)', color: 'white' }}
            >
              🔒 Sign in to view
            </div>
          )}
        </div>

        {(metadata?.species || metadata?.length || metadata?.weight || metadata?.time || metadata?.date || metadata?.location || metadata?.water) && (
          <div className="bg-gray-800 dark:bg-gray-900 text-white p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1 text-sm">
                {metadata?.species && (
                  <h3 className="text-xl font-bold mb-2">{metadata.species}</h3>
                )}
                {metadata?.length && (
                  <p>
                    <span className="text-gray-300">Length:</span> {metadata.length}
                  </p>
                )}
                {metadata?.weight && (
                  <p>
                    <span className="text-gray-300">Weight:</span> {metadata.weight}
                  </p>
                )}
                {metadata?.time && (
                  <p>
                    <span className="text-gray-300">Time:</span> {metadata.time}
                  </p>
                )}
              </div>
              <div className="space-y-1 text-sm">
                {metadata?.date && (
                  <p>
                    <span className="text-gray-300">Date:</span> {metadata.date}
                  </p>
                )}
                {metadata?.location && (
                  <p>
                    <span className="text-gray-300">Location:</span> {metadata.location}
                  </p>
                )}
                {metadata?.water && (
                  <p>
                    <span className="text-gray-300">Water:</span> {metadata.water}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default PhotoViewerModal;
