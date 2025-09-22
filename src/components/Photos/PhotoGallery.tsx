import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { firestore } from '../../services/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';

interface Photo {
  id: string;
  title: string;
  notes: string;
  downloadURL: string;
  createdAt: any; // Firestore timestamp
}

export const PhotoGallery: React.FC = () => {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

    fetchPhotos();
  }, [user]);

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
          <div key={photo.id} className="bg-white rounded-lg shadow-md overflow-hidden">
            <img
              src={photo.downloadURL}
              alt={photo.title}
              className="w-full h-48 object-cover"
              loading="lazy"
            />
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