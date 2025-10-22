import React from 'react';
import { Modal, ModalHeader, ModalBody } from './Modal';
import type { ModalProps } from '../../shared/types';

// TODO: Create PhotoUpload and PhotoGallery components
// import { PhotoUpload, PhotoGallery } from '../Photos';

export const PhotosModal: React.FC<ModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="3xl">
      <ModalHeader title="Photo Management" onClose={onClose} />

      <ModalBody className="space-y-6">
        <div className="text-center py-8">
          <i className="fas fa-camera text-4xl text-gray-400 mb-4"></i>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Photo Management Coming Soon
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Photo upload and gallery features are currently under development.
          </p>
        </div>
      </ModalBody>
    </Modal>
  );
};