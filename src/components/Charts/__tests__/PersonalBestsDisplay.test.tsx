import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PersonalBestsDisplay, { type PersonalBest } from '../PersonalBestsDisplay';
import type { Trip, FishCaught } from '../../../types';

describe('PersonalBestsDisplay', () => {
  const mockLargestFish: FishCaught = {
    id: 1,
    tripId: 1,
    species: 'Snapper',
    length: '45',
    weight: '3.5',
    time: '10:30',
    gear: ['Rod'],
    details: 'Personal best'
  };

  const mockLongestFish: FishCaught = {
    id: 2,
    tripId: 2,
    species: 'Kahawai',
    length: '52',
    weight: '2.8',
    time: '14:20',
    gear: ['Lure'],
    details: 'Long fish'
  };

  const mockMostFishTrip: Trip = {
    id: 1,
    date: '2024-01-15',
    water: 'Lake Taupo',
    location: 'Taupo Bay',
    hours: 6,
    companions: 'John',
    notes: 'Great day'
  };

  const mockPersonalBests: PersonalBest = {
    largestFish: mockLargestFish,
    longestFish: mockLongestFish,
    mostFishTrip: mockMostFishTrip,
    maxFish: 8
  };

  it('renders personal bests with all data', () => {
    render(<PersonalBestsDisplay personalBests={mockPersonalBests} />);

    expect(screen.getByText('Personal Bests')).toBeInTheDocument();
    expect(screen.getByText('Heaviest Fish')).toBeInTheDocument();
    expect(screen.getByText('Longest Fish')).toBeInTheDocument();
    expect(screen.getByText('Most Fish in a Trip')).toBeInTheDocument();
  });

  it('displays heaviest fish information correctly', () => {
    render(<PersonalBestsDisplay personalBests={mockPersonalBests} />);

    expect(screen.getByText('Snapper')).toBeInTheDocument();
    expect(screen.getByText('3.5 kg')).toBeInTheDocument();
    expect(screen.getByText('45 cm')).toBeInTheDocument();
  });

  it('displays longest fish information correctly', () => {
    render(<PersonalBestsDisplay personalBests={mockPersonalBests} />);

    expect(screen.getByText('Kahawai')).toBeInTheDocument();
    expect(screen.getByText('52 cm')).toBeInTheDocument();
    expect(screen.getByText('2.8 kg')).toBeInTheDocument();
  });

  it('displays most fish trip information correctly', () => {
    render(<PersonalBestsDisplay personalBests={mockPersonalBests} />);

    expect(screen.getByText('8 fish')).toBeInTheDocument();
    expect(screen.getByText('15 January 2024')).toBeInTheDocument();
    expect(screen.getByText('Taupo Bay')).toBeInTheDocument();
  });

  it('handles missing heaviest fish data', () => {
    const noBestsData: PersonalBest = {
      largestFish: null,
      longestFish: mockLongestFish,
      mostFishTrip: mockMostFishTrip,
      maxFish: 8
    };

    render(<PersonalBestsDisplay personalBests={noBestsData} />);

    expect(screen.getByText('No weight data recorded')).toBeInTheDocument();
  });

  it('handles missing longest fish data', () => {
    const noBestsData: PersonalBest = {
      largestFish: mockLargestFish,
      longestFish: null,
      mostFishTrip: mockMostFishTrip,
      maxFish: 8
    };

    render(<PersonalBestsDisplay personalBests={noBestsData} />);

    expect(screen.getByText('No length data recorded')).toBeInTheDocument();
  });

  it('handles missing trip data', () => {
    const noBestsData: PersonalBest = {
      largestFish: mockLargestFish,
      longestFish: mockLongestFish,
      mostFishTrip: null,
      maxFish: 0
    };

    render(<PersonalBestsDisplay personalBests={noBestsData} />);

    expect(screen.getByText('No trips with catches recorded')).toBeInTheDocument();
  });

  it('handles fish without weight data', () => {
    const fishWithoutWeight: FishCaught = {
      ...mockLargestFish,
      weight: ''
    };

    const personalBests: PersonalBest = {
      largestFish: fishWithoutWeight,
      longestFish: mockLongestFish,
      mostFishTrip: mockMostFishTrip,
      maxFish: 8
    };

    render(<PersonalBestsDisplay personalBests={personalBests} />);

    expect(screen.getByText('Weight not recorded')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <PersonalBestsDisplay 
        personalBests={mockPersonalBests} 
        className="custom-class" 
      />
    );

    expect(container.firstChild).toHaveClass('personal-bests-display', 'custom-class');
  });

  it('renders all empty states when no data available', () => {
    const emptyBests: PersonalBest = {
      largestFish: null,
      longestFish: null,
      mostFishTrip: null,
      maxFish: 0
    };

    render(<PersonalBestsDisplay personalBests={emptyBests} />);

    expect(screen.getByText('No weight data recorded')).toBeInTheDocument();
    expect(screen.getByText('No length data recorded')).toBeInTheDocument();
    expect(screen.getByText('No trips with catches recorded')).toBeInTheDocument();
  });
});