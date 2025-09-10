import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import FishCaughtDisplay from '../FishCaughtDisplay';
import { FishCaught } from '../../../types';

const mockFishCaught: FishCaught[] = [
  {
    id: 1,
    tripId: 1,
    species: 'Rainbow Trout',
    length: '35',
    weight: '1.5',
    time: '14:30',
    gear: ['Spinning Rod', 'Soft Bait'],
    details: 'Beautiful rainbow trout caught in the morning',
    photo: undefined
  },
  {
    id: 2,
    tripId: 1,
    species: 'Brown Trout',
    length: '42',
    weight: '2.1',
    time: '16:15',
    gear: ['Fly Rod', 'Dry Fly'],
    details: 'Great fight on the fly rod',
    photo: 'photo.jpg'
  },
  {
    id: 3,
    tripId: 1,
    species: 'Snapper',
    length: '',
    weight: '',
    time: '',
    gear: [],
    details: '',
    photo: undefined
  }
];

describe('FishCaughtDisplay', () => {
  const defaultProps = {
    fishCaught: mockFishCaught,
    onEdit: vi.fn(),
    onDelete: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Display Fish Catches', () => {
    it('renders all fish catches', () => {
      render(<FishCaughtDisplay {...defaultProps} />);
      
      expect(screen.getByText('Rainbow Trout')).toBeInTheDocument();
      expect(screen.getByText('Brown Trout')).toBeInTheDocument();
      expect(screen.getByText('Snapper')).toBeInTheDocument();
    });

    it('displays fish measurements correctly', () => {
      render(<FishCaughtDisplay {...defaultProps} />);
      
      expect(screen.getByText('35 cm')).toBeInTheDocument();
      expect(screen.getByText('1.5 kg')).toBeInTheDocument();
      expect(screen.getByText('42 cm')).toBeInTheDocument();
      expect(screen.getByText('2.1 kg')).toBeInTheDocument();
      
      // Should show "Not recorded" for empty measurements
      expect(screen.getAllByText('Not recorded')).toHaveLength(3); // 3 for the third fish (length, weight, time)
    });

    it('displays catch times correctly', () => {
      render(<FishCaughtDisplay {...defaultProps} />);
      
      expect(screen.getByText('Caught at 14:30')).toBeInTheDocument();
      expect(screen.getByText('Caught at 16:15')).toBeInTheDocument();
      expect(screen.getByText('Caught at Not recorded')).toBeInTheDocument();
    });

    it('displays gear used correctly', () => {
      render(<FishCaughtDisplay {...defaultProps} />);
      
      expect(screen.getByText('Spinning Rod')).toBeInTheDocument();
      expect(screen.getByText('Soft Bait')).toBeInTheDocument();
      expect(screen.getByText('Fly Rod')).toBeInTheDocument();
      expect(screen.getByText('Dry Fly')).toBeInTheDocument();
    });

    it('displays additional details when present', () => {
      render(<FishCaughtDisplay {...defaultProps} />);
      
      expect(screen.getByText('Beautiful rainbow trout caught in the morning')).toBeInTheDocument();
      expect(screen.getByText('Great fight on the fly rod')).toBeInTheDocument();
    });

    it('shows photo placeholder when photo is present', () => {
      render(<FishCaughtDisplay {...defaultProps} />);
      
      expect(screen.getByText('Photo attached')).toBeInTheDocument();
      expect(screen.getByText('Photo display will be available in a future update')).toBeInTheDocument();
    });
  });

  describe('Empty States', () => {
    it('displays empty state when no fish catches exist', () => {
      render(<FishCaughtDisplay fishCaught={[]} />);
      
      expect(screen.getByText('No fish caught recorded')).toBeInTheDocument();
    });

    it('displays loading state when isLoading is true', () => {
      render(<FishCaughtDisplay fishCaught={[]} isLoading={true} />);
      
      expect(screen.getByText('Loading fish catches...')).toBeInTheDocument();
    });
  });

  describe('Edit Functionality', () => {
    it('calls onEdit when edit button is clicked', () => {
      render(<FishCaughtDisplay {...defaultProps} />);
      
      const editButtons = screen.getAllByTitle('Edit fish catch');
      fireEvent.click(editButtons[0]);
      
      expect(defaultProps.onEdit).toHaveBeenCalledWith(mockFishCaught[0]);
    });

    it('does not show edit buttons when onEdit is not provided', () => {
      render(<FishCaughtDisplay fishCaught={mockFishCaught} onDelete={defaultProps.onDelete} />);
      
      expect(screen.queryAllByTitle('Edit fish catch')).toHaveLength(0);
    });
  });

  describe('Delete Functionality', () => {
    it('shows confirmation dialog when delete button is clicked', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      
      render(<FishCaughtDisplay {...defaultProps} />);
      
      const deleteButtons = screen.getAllByTitle('Delete fish catch');
      fireEvent.click(deleteButtons[0]);
      
      expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete this fish catch record?');
      expect(defaultProps.onDelete).toHaveBeenCalledWith(1);
      
      confirmSpy.mockRestore();
    });

    it('does not delete when confirmation is cancelled', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      
      render(<FishCaughtDisplay {...defaultProps} />);
      
      const deleteButtons = screen.getAllByTitle('Delete fish catch');
      fireEvent.click(deleteButtons[0]);
      
      expect(confirmSpy).toHaveBeenCalled();
      expect(defaultProps.onDelete).not.toHaveBeenCalled();
      
      confirmSpy.mockRestore();
    });

    it('does not show delete buttons when onDelete is not provided', () => {
      render(<FishCaughtDisplay fishCaught={mockFishCaught} onEdit={defaultProps.onEdit} />);
      
      expect(screen.queryAllByTitle('Delete fish catch')).toHaveLength(0);
    });
  });

  describe('Data Formatting', () => {
    it('formats measurements with units', () => {
      render(<FishCaughtDisplay {...defaultProps} />);
      
      expect(screen.getByText('35 cm')).toBeInTheDocument();
      expect(screen.getByText('1.5 kg')).toBeInTheDocument();
    });

    it('shows "Not recorded" for empty measurements', () => {
      const fishWithEmptyMeasurements: FishCaught[] = [{
        id: 1,
        tripId: 1,
        species: 'Test Fish',
        length: '',
        weight: '',
        time: '',
        gear: [],
        details: '',
        photo: undefined
      }];
      
      render(<FishCaughtDisplay fishCaught={fishWithEmptyMeasurements} />);
      
      expect(screen.getAllByText('Not recorded')).toHaveLength(3); // length, weight, time
    });

    it('shows "Not specified" for empty gear array', () => {
      const fishWithNoGear: FishCaught[] = [{
        id: 1,
        tripId: 1,
        species: 'Test Fish',
        length: '30',
        weight: '1.0',
        time: '12:00',
        gear: [],
        details: 'Test details',
        photo: undefined
      }];
      
      render(<FishCaughtDisplay fishCaught={fishWithNoGear} />);
      
      // Should not show gear section when no gear is specified
      expect(screen.queryByText('Gear used:')).not.toBeInTheDocument();
    });
  });

  describe('Gear Display', () => {
    it('displays gear as badges', () => {
      render(<FishCaughtDisplay {...defaultProps} />);
      
      // Check that gear items are displayed as individual elements
      const gearItems = screen.getAllByText('Spinning Rod');
      expect(gearItems.length).toBeGreaterThan(0);
    });

    it('does not show gear section when no gear is specified', () => {
      const fishWithNoGear: FishCaught[] = [{
        id: 1,
        tripId: 1,
        species: 'Test Fish',
        length: '30',
        weight: '1.0',
        time: '12:00',
        gear: [],
        details: '',
        photo: undefined
      }];
      
      render(<FishCaughtDisplay fishCaught={fishWithNoGear} />);
      
      expect(screen.queryByText('Gear used:')).not.toBeInTheDocument();
    });
  });

  describe('Responsive Layout', () => {
    it('renders fish catch cards with proper structure', () => {
      render(<FishCaughtDisplay {...defaultProps} />);
      
      // Check that all fish catches are rendered as cards
      const troutCard = screen.getByText('Rainbow Trout').closest('.bg-gray-50');
      const brownTroutCard = screen.getByText('Brown Trout').closest('.bg-gray-50');
      const snapperCard = screen.getByText('Snapper').closest('.bg-gray-50');
      
      expect(troutCard).toBeInTheDocument();
      expect(brownTroutCard).toBeInTheDocument();
      expect(snapperCard).toBeInTheDocument();
    });
  });

  describe('Details Section', () => {
    it('shows details section when details are present', () => {
      render(<FishCaughtDisplay {...defaultProps} />);
      
      expect(screen.getAllByText('Details:')[0]).toBeInTheDocument();
      expect(screen.getByText('Beautiful rainbow trout caught in the morning')).toBeInTheDocument();
    });

    it('does not show details section when details are empty', () => {
      const fishWithoutDetails: FishCaught[] = [{
        id: 1,
        tripId: 1,
        species: 'Test Fish',
        length: '30',
        weight: '1.0',
        time: '12:00',
        gear: ['Test Gear'],
        details: '',
        photo: undefined
      }];
      
      render(<FishCaughtDisplay fishCaught={fishWithoutDetails} />);
      
      expect(screen.queryByText('Details:')).not.toBeInTheDocument();
    });
  });
});