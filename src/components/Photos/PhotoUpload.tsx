import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { storage, firestore } from '../../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface PhotoUploadProps {
  onUploadSuccess?: () => void;
}

export const PhotoUpload: React.FC<PhotoUploadProps> = ({ onUploadSuccess }) => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.type.startsWith('image/')) {
        setError('Please select a valid image file.');
        return;
      }
      // Validate file size (e.g., max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB.');
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError('You must be logged in to upload photos.');
      return;
    }

    if (!file) {
      setError('Please select a photo to upload.');
      return;
    }

    if (!title.trim()) {
      setError('Please provide a title for the photo.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create storage reference: users/{uid}/photos/{filename}
      const storagePath = `users/${user.uid}/photos/${file.name}`;
      const storageRef = ref(storage, storagePath);

      // Upload file
      await uploadBytes(storageRef, file);

      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);

      // Save metadata to Firestore
      await addDoc(collection(firestore, 'photos'), {
        userId: user.uid,
        title: title.trim(),
        notes: notes.trim(),
        storagePath,
        downloadURL,
        createdAt: serverTimestamp(),
      });

      // Reset form
      setFile(null);
      setTitle('');
      setNotes('');
      (e.target as HTMLFormElement).reset();

      // Notify parent component
      onUploadSuccess?.();
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Upload Photo</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="photo" className="block text-sm font-medium text-gray-700 mb-2">
            Select Photo
          </label>
          <input
            type="file"
            id="photo"
            accept="image/*"
            onChange={handleFileChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
        </div>

        <div className="mb-4">
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
            Title *
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter photo title"
            disabled={loading}
            required
          />
        </div>

        <div className="mb-4">
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
            Notes
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Optional notes about the photo"
            rows={3}
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !file || !title.trim()}
          className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Uploading...' : 'Upload Photo'}
        </button>
      </form>
    </div>
  );
};