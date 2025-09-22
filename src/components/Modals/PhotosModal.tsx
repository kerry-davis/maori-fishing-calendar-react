import React, { useState } from 'react';
import { Modal, ModalHeader, ModalBody } from './Modal';
import type { ModalProps } from '../../types';
import { PhotoUpload, PhotoGallery } from '../Photos';

export const PhotosModal: React.FC<ModalProps> = ({ isOpen, onClose }) => {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadSuccess = () => {
    // Trigger gallery refresh
    setRefreshKey(prev => prev + 1);
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
        <div key={refreshKey}>
          <PhotoGallery />
        </div>
      </ModalBody>
    </Modal>
  );
};