import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { firestore, storage } from '../../services/firebase';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';

interface Photo {
  id: string;
  title: string;
  notes: string;
  downloadURL: string;
  storagePath: string;
  createdAt: any; // Firestore timestamp
}

interface PhotoGalleryProps {
  refreshTrigger?: number;
  onPhotoDeleted?: () => void;
}

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({ refreshTrigger, onPhotoDeleted }) => {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPhotos = async () => {
    if (!user) {
      setPhotos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const q = query(
        collection(firestore, 'photos'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const fetchedPhotos: Photo[] = [];

      querySnapshot.forEach((doc) => {
        fetchedPhotos.push({
          id: doc.id,
          ...doc.data(),
        } as Photo);
      });

      setPhotos(fetchedPhotos);
    } catch (err) {
      console.error('Failed to fetch photos:', err);
      setError(err instanceof Error ? err.message : 'Failed to load photos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPhotos();
  }, [user]);

  useEffect(() => {
    if (refreshTrigger !== undefined) {
      fetchPhotos();
    }
  }, [refreshTrigger]);

  const handleDeletePhoto = async (photo: Photo) => {
    if (!user || !window.confirm(`Are you sure you want to delete "${photo.title}"?`)) {
      return;
    }

    setDeletingId(photo.id);

    try {
      // Always try to delete from Firestore first
      await deleteDoc(doc(firestore, 'photos', photo.id));
      console.log('Deleted from Firestore successfully');

      // Try to delete from Storage, but don't fail if file doesn't exist
      try {
        const storageRef = ref(storage, photo.storagePath);
        await deleteObject(storageRef);
        console.log('Deleted from Storage successfully');
      } catch (storageError: any) {
        // If the file doesn't exist in Storage, that's okay - it might have been deleted already
        if (storageError.code === 'storage/object-not-found') {
          console.warn('Storage file not found (may have been deleted already):', photo.storagePath);
        } else {
          // Re-throw other storage errors
          throw storageError;
        }
      }

      // Remove from local state
      setPhotos(prev => prev.filter(p => p.id !== photo.id));

      // Notify parent
      onPhotoDeleted?.();
    } catch (err) {
      console.error('Failed to delete photo:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete photo.');
    } finally {
      setDeletingId(null);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Please log in to view your photos.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <p className="mt-2 text-gray-500">Loading photos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No photos uploaded yet. Upload your first photo above!</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h2 className="text-2xl font-semibold mb-6">Your Photos</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {photos.map((photo) => (
          <div key={photo.id} className="bg-white rounded-lg shadow-md overflow-hidden group relative">
            <img
              src={photo.downloadURL}
              alt={photo.title}
              className="w-full h-48 object-cover"
              loading="lazy"
              onError={(e) => {
                console.error('Failed to load image:', photo.downloadURL);
                e.currentTarget.src = '/placeholder-image.png'; // Fallback image
              }}
            />

            {/* Delete button - appears on hover */}
            <button
              onClick={() => handleDeletePhoto(photo)}
              disabled={deletingId === photo.id}
              className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600 disabled:opacity-50"
              title="Delete photo"
            >
              {deletingId === photo.id ? (
                <i className="fas fa-spinner fa-spin text-sm"></i>
              ) : (
                <i className="fas fa-trash text-sm"></i>
              )}
            </button>

            <div className="p-4">
              <h3 className="font-semibold text-lg mb-2">{photo.title}</h3>
              {photo.notes && (
                <p className="text-gray-600 text-sm">{photo.notes}</p>
              )}
              <p className="text-xs text-gray-400 mt-2">
                {photo.createdAt?.toDate?.()?.toLocaleDateString() || 'Date unknown'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};