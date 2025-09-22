import React, { useState } from 'react';
import { Modal, ModalHeader, ModalBody } from './Modal';
import type { ModalProps } from '../../types';
import { PhotoUpload, PhotoGallery } from '../Photos';

export const PhotosModal: React.FC<ModalProps> = ({ isOpen, onClose }) => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUploadSuccess = () => {
    // Trigger gallery refresh
    setRefreshTrigger(prev => prev + 1);
  };

  const handlePhotoDeleted = () => {
    // Trigger gallery refresh after deletion
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="3xl">
      <ModalHeader title="Photo Management" onClose={onClose} />

      <ModalBody className="space-y-6">
        {/* Upload Section */}
        <div className="border-b pb-6">
          <PhotoUpload onUploadSuccess={handleUploadSuccess} />
        </div>

        {/* Gallery Section */}
        <PhotoGallery
          refreshTrigger={refreshTrigger}
          onPhotoDeleted={handlePhotoDeleted}
        />
      </ModalBody>
    </Modal>
  );
};