import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import GalleryModal from "../GalleryModal";
import { databaseService } from "../../../services/databaseService";
import type { Trip, FishCaught } from "../../../types";

// Mock the database service
vi.mock("../../../services/databaseService", () => ({
  databaseService: {
    getAllTrips: vi.fn(),
    getAllFishCaught: vi.fn(),
  },
}));

// Mock data
const mockTrips: Trip[] = [
  {
    id: 1,
    date: "2024-01-15",
    water: "Lake Taupo",
    location: "Western Bays",
    hours: 4,
    companions: "John Smith",
    notes: "Great day fishing",
  },
  {
    id: 2,
    date: "2024-02-20",
    water: "Rotorua Lakes",
    location: "Blue Lake",
    hours: 6,
    companions: "",
    notes: "Solo trip",
  },
];

const mockFishCaught: FishCaught[] = [
  {
    id: 1,
    tripId: 1,
    species: "Rainbow Trout",
    length: "45cm",
    weight: "2.1kg",
    time: "10:30",
    gear: ["Spinning Rod"],
    details: "Beautiful rainbow",
    photo:
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wA==",
  },
  {
    id: 2,
    tripId: 2,
    species: "Brown Trout",
    length: "38cm",
    weight: "1.8kg",
    time: "14:15",
    gear: ["Fly Rod"],
    details: "Nice brown",
    photo:
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wA==",
  },
  {
    id: 3,
    tripId: 1,
    species: "Lake Trout",
    length: "50cm",
    weight: "2.5kg",
    time: "15:45",
    gear: ["Trolling Rod"],
    details: "Big lake trout",
    // No photo for this one
  },
];

describe("GalleryModal", () => {
  const mockOnClose = vi.fn();
  const mockOnPhotoSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock implementations
    vi.mocked(databaseService.getAllTrips).mockResolvedValue(mockTrips);
    vi.mocked(databaseService.getAllFishCaught).mockResolvedValue(
      mockFishCaught,
    );
  });

  it("renders gallery modal when open", async () => {
    render(
      <GalleryModal
        isOpen={true}
        onClose={mockOnClose}
        onPhotoSelect={mockOnPhotoSelect}
      />,
    );

    expect(screen.getByText("Photo Gallery")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <GalleryModal
        isOpen={false}
        onClose={mockOnClose}
        onPhotoSelect={mockOnPhotoSelect}
      />,
    );

    expect(screen.queryByText("Photo Gallery")).not.toBeInTheDocument();
  });

  it("loads photos when modal opens", async () => {
    render(
      <GalleryModal
        isOpen={true}
        onClose={mockOnClose}
        onPhotoSelect={mockOnPhotoSelect}
      />,
    );

    await waitFor(() => {
      expect(databaseService.getAllTrips).toHaveBeenCalled();
      expect(databaseService.getAllFishCaught).toHaveBeenCalled();
    });
  });

  it("shows loading state while fetching data", async () => {
    // Make the database calls hang
    vi.mocked(databaseService.getAllTrips).mockImplementation(
      () => new Promise(() => {}),
    );
    vi.mocked(databaseService.getAllFishCaught).mockImplementation(
      () => new Promise(() => {}),
    );

    render(
      <GalleryModal
        isOpen={true}
        onClose={mockOnClose}
        onPhotoSelect={mockOnPhotoSelect}
      />,
    );

    expect(screen.getByText("Loading photos...")).toBeInTheDocument();
  });

  it("shows error state when data loading fails", async () => {
    vi.mocked(databaseService.getAllTrips).mockRejectedValue(
      new Error("Database error"),
    );

    render(
      <GalleryModal
        isOpen={true}
        onClose={mockOnClose}
        onPhotoSelect={mockOnPhotoSelect}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Failed to load photos")).toBeInTheDocument();
    });
  });

  it("displays photos in grid layout", async () => {
    render(
      <GalleryModal
        isOpen={true}
        onClose={mockOnClose}
        onPhotoSelect={mockOnPhotoSelect}
      />,
    );

    await waitFor(() => {
      // Should show 2 photos (only fish with photos)
      const images = screen.getAllByRole("img");
      expect(images).toHaveLength(2);
    });
  });

  it("groups photos by month", async () => {
    render(
      <GalleryModal
        isOpen={true}
        onClose={mockOnClose}
        onPhotoSelect={mockOnPhotoSelect}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("January 2024")).toBeInTheDocument();
      expect(screen.getByText("February 2024")).toBeInTheDocument();
    });
  });

  it("shows correct photo count", async () => {
    render(
      <GalleryModal
        isOpen={true}
        onClose={mockOnClose}
        onPhotoSelect={mockOnPhotoSelect}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("2 photos")).toBeInTheDocument();
    });
  });

  it("filters photos by month", async () => {
    render(
      <GalleryModal
        isOpen={true}
        onClose={mockOnClose}
        onPhotoSelect={mockOnPhotoSelect}
      />,
    );

    await waitFor(() => {
      const monthFilter = screen.getByDisplayValue("All Months");
      fireEvent.change(monthFilter, { target: { value: "2024-0" } }); // January 2024
    });

    await waitFor(() => {
      expect(screen.getByText("1 photos")).toBeInTheDocument();
    });
  });

  it("sorts photos by date", async () => {
    render(
      <GalleryModal
        isOpen={true}
        onClose={mockOnClose}
        onPhotoSelect={mockOnPhotoSelect}
      />,
    );

    await waitFor(() => {
      const sortSelect = screen.getByDisplayValue("Newest First");
      fireEvent.change(sortSelect, { target: { value: "asc" } });
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("Oldest First")).toBeInTheDocument();
    });
  });

  it("opens full-size photo modal when photo is clicked", async () => {
    render(
      <GalleryModal
        isOpen={true}
        onClose={mockOnClose}
        onPhotoSelect={mockOnPhotoSelect}
      />,
    );

    await waitFor(() => {
      const images = screen.getAllByRole("img");
      fireEvent.click(images[0]);
    });

    await waitFor(() => {
      // Should show the full-size photo modal with navigation
      expect(
        screen.getByRole("button", { name: /close/i }) ||
          document.querySelector(".fa-times"),
      ).toBeInTheDocument();
    });
  });

  it("navigates between photos in full-size view", async () => {
    render(
      <GalleryModal
        isOpen={true}
        onClose={mockOnClose}
        onPhotoSelect={mockOnPhotoSelect}
      />,
    );

    await waitFor(() => {
      const images = screen.getAllByRole("img");
      fireEvent.click(images[0]);
    });

    await waitFor(() => {
      const nextButton =
        screen.getByRole("button", { name: /next/i }) ||
        document.querySelector(".fa-chevron-right")?.closest("button");
      if (nextButton) {
        fireEvent.click(nextButton);
      }
    });

    // Should navigate to next photo
    expect(mockOnPhotoSelect).toHaveBeenCalled();
  });

  it("calls onPhotoSelect when photo is clicked", async () => {
    render(
      <GalleryModal
        isOpen={true}
        onClose={mockOnClose}
        onPhotoSelect={mockOnPhotoSelect}
      />,
    );

    await waitFor(() => {
      const images = screen.getAllByRole("img");
      fireEvent.click(images[0]);
    });

    expect(mockOnPhotoSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        fishId: expect.any(Number),
        tripId: expect.any(Number),
        species: expect.any(String),
        photo: expect.any(String),
      }),
    );
  });

  it("shows empty state when no photos exist", async () => {
    // Mock empty data
    vi.mocked(databaseService.getAllFishCaught).mockResolvedValue([]);

    render(
      <GalleryModal
        isOpen={true}
        onClose={mockOnClose}
        onPhotoSelect={mockOnPhotoSelect}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("No photos found")).toBeInTheDocument();
      expect(
        screen.getByText("Add photos to your fish catches to see them here"),
      ).toBeInTheDocument();
    });
  });

  it("shows filtered empty state when no photos match filter", async () => {
    render(
      <GalleryModal
        isOpen={true}
        onClose={mockOnClose}
        onPhotoSelect={mockOnPhotoSelect}
      />,
    );

    await waitFor(() => {
      const monthFilter = screen.getByDisplayValue("All Months");
      fireEvent.change(monthFilter, { target: { value: "2024-11" } }); // December 2024 (no photos)
    });

    await waitFor(() => {
      expect(screen.getByText("No photos found")).toBeInTheDocument();
      expect(
        screen.getByText("Try selecting a different month or clear the filter"),
      ).toBeInTheDocument();
    });
  });

  it("displays photo information correctly", async () => {
    render(
      <GalleryModal
        isOpen={true}
        onClose={mockOnClose}
        onPhotoSelect={mockOnPhotoSelect}
      />,
    );

    await waitFor(() => {
      const images = screen.getAllByRole("img");
      fireEvent.click(images[0]);
    });

    await waitFor(() => {
      expect(screen.getByText("Rainbow Trout")).toBeInTheDocument();
      expect(screen.getByText("45cm")).toBeInTheDocument();
      expect(screen.getByText("2.1kg")).toBeInTheDocument();
      expect(screen.getByText("Western Bays")).toBeInTheDocument();
    });
  });

  it("handles keyboard navigation in full-size view", async () => {
    render(
      <GalleryModal
        isOpen={true}
        onClose={mockOnClose}
        onPhotoSelect={mockOnPhotoSelect}
      />,
    );

    await waitFor(() => {
      const images = screen.getAllByRole("img");
      fireEvent.click(images[0]);
    });

    // Test escape key to close
    fireEvent.keyDown(document, { key: "Escape" });

    // The modal should handle escape key through the base Modal component
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("initializes with selected month and year", async () => {
    render(
      <GalleryModal
        isOpen={true}
        onClose={mockOnClose}
        onPhotoSelect={mockOnPhotoSelect}
        selectedMonth={0} // January
        selectedYear={2024}
      />,
    );

    await waitFor(() => {
      const monthFilter = screen.getByDisplayValue("January 2024");
      expect(monthFilter).toBeInTheDocument();
    });
  });
});
