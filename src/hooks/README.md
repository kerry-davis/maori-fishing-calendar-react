# React Hooks

This directory contains custom React hooks for the Māori Fishing Calendar application.

## useIndexedDB

A custom hook that provides a React interface to IndexedDB operations with proper error handling and loading states.

### Features

- **Automatic initialization**: Database is initialized when the hook is first used
- **Loading states**: Tracks loading state for all operations
- **Error handling**: Provides detailed error information with recovery options
- **Type safety**: Full TypeScript support with typed methods for each data store
- **Organized operations**: Separate namespaces for trips, weather, and fish operations

### Usage

```typescript
import { useIndexedDB } from '../hooks/useIndexedDB';

function MyComponent() {
  const { 
    isLoading, 
    error, 
    isReady, 
    trips, 
    weather, 
    fish 
  } = useIndexedDB();

  // Check if database is ready
  if (!isReady) {
    return <div>Initializing database...</div>;
  }

  // Handle errors
  if (error) {
    return <div>Database error: {error.message}</div>;
  }

  // Use the operations
  const handleCreateTrip = async () => {
    try {
      const tripId = await trips.create({
        date: '2024-01-15',
        water: 'Lake Taupo',
        location: 'Taupo',
        hours: 4,
        companions: 'John',
        notes: 'Great day fishing'
      });
      console.log('Created trip with ID:', tripId);
    } catch (error) {
      console.error('Failed to create trip:', error);
    }
  };

  const handleGetTrips = async () => {
    try {
      const allTrips = await trips.getAll();
      console.log('All trips:', allTrips);
    } catch (error) {
      console.error('Failed to get trips:', error);
    }
  };

  return (
    <div>
      {isLoading && <div>Loading...</div>}
      <button onClick={handleCreateTrip}>Create Trip</button>
      <button onClick={handleGetTrips}>Get All Trips</button>
    </div>
  );
}
```

### Available Operations

#### Trip Operations
- `trips.create(tripData)` - Create a new trip
- `trips.getById(id)` - Get trip by ID
- `trips.getByDate(date)` - Get trips for a specific date
- `trips.getAll()` - Get all trips
- `trips.update(trip)` - Update an existing trip
- `trips.delete(id)` - Delete a trip and all associated data
- `trips.hasTripsOnDate(date)` - Check if date has trips
- `trips.getDatesWithTrips()` - Get all dates that have trips

#### Weather Operations
- `weather.create(weatherData)` - Create a weather log
- `weather.getById(id)` - Get weather log by ID
- `weather.getByTripId(tripId)` - Get weather logs for a trip
- `weather.getAll()` - Get all weather logs
- `weather.update(weatherLog)` - Update a weather log
- `weather.delete(id)` - Delete a weather log

#### Fish Operations
- `fish.create(fishData)` - Create a fish caught record
- `fish.getById(id)` - Get fish record by ID
- `fish.getByTripId(tripId)` - Get fish records for a trip
- `fish.getAll()` - Get all fish records
- `fish.update(fishCaught)` - Update a fish record
- `fish.delete(id)` - Delete a fish record
- `fish.getCountForTrip(tripId)` - Get fish count for a trip

#### Utility Operations
- `clearAllData()` - Clear all data from the database
- `initialize()` - Manually initialize the database

### Error Handling

The hook provides comprehensive error handling:

```typescript
const { error } = useIndexedDB();

if (error) {
  switch (error.type) {
    case 'connection':
      // Database connection failed
      break;
    case 'transaction':
      // Transaction failed (usually recoverable)
      break;
    case 'data':
      // Data validation or format error
      break;
  }
  
  // Check if error is recoverable
  if (error.recoverable) {
    // Show retry option to user
  }
}
```

### Loading States

The hook tracks loading states for operations:

```typescript
const { isLoading, isReady } = useIndexedDB();

// isReady: true when database is initialized and ready to use
// isLoading: true during database operations
```

### Requirements Satisfied

This hook satisfies the following requirements:
- **3.3**: Provides React interface to IndexedDB operations
- **5.1**: Maintains data compatibility with existing storage schema

## useLocalStorage

A collection of custom hooks for localStorage operations with TypeScript support, serialization/deserialization, and error handling.

### Features

- **Generic hook**: `useLocalStorage<T>` for any data type
- **Type safety**: Full TypeScript support with proper typing
- **Error handling**: Graceful error handling with detailed error messages
- **Serialization**: Automatic JSON serialization/deserialization
- **Storage events**: Listens for changes from other tabs/windows
- **Specific hooks**: Pre-configured hooks for common use cases

### Generic useLocalStorage Hook

```typescript
import { useLocalStorage } from '../hooks/useLocalStorage';

function MyComponent() {
  const [value, setValue, removeValue, error] = useLocalStorage('my-key', 'default-value');

  const handleUpdate = () => {
    setValue('new-value');
  };

  const handleFunctionUpdate = () => {
    setValue(prev => prev + ' updated');
  };

  const handleRemove = () => {
    removeValue();
  };

  if (error) {
    return <div>Storage error: {error}</div>;
  }

  return (
    <div>
      <p>Current value: {value}</p>
      <button onClick={handleUpdate}>Update Value</button>
      <button onClick={handleFunctionUpdate}>Function Update</button>
      <button onClick={handleRemove}>Remove Value</button>
    </div>
  );
}
```

### Specific Hooks

#### useTheme

Manages theme state with automatic DOM class application:

```typescript
import { useTheme } from '../hooks/useLocalStorage';

function ThemeToggle() {
  const [isDark, toggleTheme, error] = useTheme();

  return (
    <button onClick={toggleTheme}>
      {isDark ? 'Switch to Light' : 'Switch to Dark'}
    </button>
  );
}
```

Features:
- Automatically applies/removes 'dark' class to document element
- Initializes based on system preference if no saved theme
- Stores theme as 'dark' or 'light' string (compatible with original app)

#### useLocationStorage

Manages user location data:

```typescript
import { useLocationStorage } from '../hooks/useLocalStorage';

function LocationManager() {
  const [userLocation, setUserLocation, removeLocation, error] = useLocationStorage();

  const handleSetLocation = () => {
    setUserLocation({
      lat: -36.8485,
      lon: 174.7633,
      name: 'Auckland'
    });
  };

  return (
    <div>
      {userLocation ? (
        <p>Location: {userLocation.name}</p>
      ) : (
        <p>No location set</p>
      )}
      <button onClick={handleSetLocation}>Set Auckland</button>
    </div>
  );
}
```

#### useTackleBoxStorage

Manages tackle box items:

```typescript
import { useTackleBoxStorage } from '../hooks/useLocalStorage';

function TackleBox() {
  const [tacklebox, setTacklebox, removeTacklebox, error] = useTackleBoxStorage();

  const addItem = () => {
    setTacklebox(prev => [...prev, {
      id: Date.now(),
      name: 'New Lure',
      brand: 'Test Brand',
      type: 'Lure',
      colour: 'Red'
    }]);
  };

  return (
    <div>
      <p>Items: {tacklebox.length}</p>
      <button onClick={addItem}>Add Item</button>
    </div>
  );
}
```

#### useGearTypesStorage

Manages gear types with default values:

```typescript
import { useGearTypesStorage } from '../hooks/useLocalStorage';

function GearTypes() {
  const [gearTypes, setGearTypes, removeGearTypes, error] = useGearTypesStorage();

  const addGearType = () => {
    setGearTypes(prev => [...prev, 'Net']);
  };

  return (
    <div>
      <p>Gear Types: {gearTypes.join(', ')}</p>
      <button onClick={addGearType}>Add Net</button>
    </div>
  );
}
```

### Error Handling

All hooks provide error handling:

```typescript
const [value, setValue, removeValue, error] = useLocalStorage('key', 'default');

if (error) {
  // Error contains detailed message about what went wrong
  console.error('localStorage error:', error);
}
```

Common error scenarios:
- Storage quota exceeded
- JSON parsing errors
- Browser storage disabled
- Invalid data types

### Storage Event Handling

The hooks automatically listen for storage events from other tabs:

```typescript
// Changes made in other tabs will automatically update the hook's value
const [theme] = useTheme();
// If another tab changes the theme, this component will re-render with the new value
```

### Data Compatibility

All hooks maintain compatibility with the original application's localStorage format:
- Theme stored as 'dark'/'light' strings
- Location stored as JSON object with lat, lon, name
- Tackle box stored as array of tackle items
- Gear types stored as array of strings

### Requirements Satisfied

These hooks satisfy the following requirements:
- **5.1**: Maintains data compatibility with existing localStorage schema
- **5.3**: Provides localStorage operations with TypeScript support and error handling

## useModal

A comprehensive modal management system with animation support, modal stacking, and typed modal identifiers.

### Features

- **Modal stack management**: Support for nested modals with proper stacking
- **Animation support**: Built-in animation states for smooth transitions
- **Typed modal identifiers**: Full TypeScript support for modal types and data
- **Keyboard accessibility**: Escape key handling and focus management
- **Body scroll prevention**: Automatically prevents background scrolling
- **Backdrop handling**: Click-outside-to-close functionality
- **Memory management**: Automatic cleanup of timeouts and event listeners

### Basic Usage

```typescript
import { useModal } from '../hooks/useModal';

function MyComponent() {
  const {
    currentModal,
    modalStack,
    openModal,
    closeModal,
    closeAllModals,
    isModalOpen,
    getModalData,
    isAnimating
  } = useModal();

  const handleOpenLunar = () => {
    const modalId = openModal('lunar', { date: '2024-01-15' });
    console.log('Opened modal with ID:', modalId);
  };

  const handleOpenTrip = () => {
    openModal('tripLog', { selectedDate: new Date() });
  };

  const handleClose = () => {
    closeModal(); // Closes the top modal
  };

  const handleCloseAll = () => {
    closeAllModals(); // Closes all modals with staggered animation
  };

  return (
    <div>
      <button onClick={handleOpenLunar}>Open Lunar Modal</button>
      <button onClick={handleOpenTrip}>Open Trip Modal</button>
      <button onClick={handleClose}>Close Top Modal</button>
      <button onClick={handleCloseAll}>Close All Modals</button>
      
      {currentModal && (
        <div>
          Current modal: {currentModal.type}
          {isAnimating && <span> (animating)</span>}
        </div>
      )}
      
      <div>Modal stack depth: {modalStack.length}</div>
    </div>
  );
}
```

### Modal Types

The hook supports the following modal types (defined in types/index.ts):

```typescript
type ModalType = 
  | 'lunar'
  | 'tripLog'
  | 'tripDetails'
  | 'tackleBox'
  | 'analytics'
  | 'settings'
  | 'search'
  | 'gallery'
  | 'weather'
  | 'gearSelection';
```

### Single Modal Management

For components that only need to manage one modal type:

```typescript
import { useSingleModal } from '../hooks/useModal';

function LunarComponent() {
  const { isOpen, data, open, close, isAnimating } = useSingleModal('lunar');

  const handleOpen = () => {
    open({ date: '2024-01-15', phase: 'full' });
  };

  return (
    <div>
      <button onClick={handleOpen}>Open Lunar Modal</button>
      {isOpen && (
        <div>
          Lunar modal is open with date: {data?.date}
          <button onClick={close}>Close</button>
        </div>
      )}
    </div>
  );
}
```

### Backdrop Management

For modal backdrop components:

```typescript
import { useModal, useModalBackdrop } from '../hooks/useModal';

function ModalBackdrop() {
  const modalState = useModal();
  const { isVisible, handleBackdropClick, isAnimating } = useModalBackdrop(modalState);

  if (!isVisible) return null;

  return (
    <div 
      className={`modal-backdrop ${isAnimating ? 'animating' : ''}`}
      onClick={handleBackdropClick}
    >
      <div className="modal-content">
        {/* Modal content here */}
      </div>
    </div>
  );
}
```

### Animation States

The hook provides detailed animation state tracking:

```typescript
const { currentModal, isAnimating, modalStack } = useModal();

// Check if any modal is animating
if (isAnimating) {
  console.log('Modal system is animating');
}

// Check individual modal animation states
modalStack.forEach(modal => {
  if (modal.isEntering) {
    console.log(`Modal ${modal.type} is entering`);
  }
  if (modal.isExiting) {
    console.log(`Modal ${modal.type} is exiting`);
  }
});

// Current modal animation state
if (currentModal?.isAnimating) {
  console.log('Current modal is animating');
}
```

### Modal Stack Operations

```typescript
const { modalStack, openModal, closeModal, isModalOpen, getModalData } = useModal();

// Open multiple modals (they stack)
openModal('lunar');
openModal('tripLog');
openModal('tackleBox');

// Check if specific modal type is open
if (isModalOpen('lunar')) {
  console.log('Lunar modal is somewhere in the stack');
}

// Get data from specific modal type (returns data from topmost instance)
const lunarData = getModalData('lunar');

// Close specific modal by ID
const modalId = openModal('settings');
closeModal(modalId);

// Close top modal (no ID needed)
closeModal();

// Modal stack information
console.log('Stack depth:', modalStack.length);
console.log('Modal types in stack:', modalStack.map(m => m.type));
```

### Keyboard and Accessibility

The hook automatically handles:

- **Escape key**: Closes the top modal when pressed (unless animating)
- **Body scroll**: Prevents background scrolling when modals are open
- **Focus management**: Maintains proper focus handling
- **Event cleanup**: Removes event listeners on unmount

```typescript
// Escape key behavior
const { closeModal, isAnimating } = useModal();

// The hook automatically adds this behavior:
// - Escape key closes top modal
// - Only works when not animating
// - Automatically cleaned up on unmount
```

### Animation Timing

The hook uses configurable animation timing:

```typescript
// Default timing constants (in useModal.ts)
const ANIMATION_DURATION = 300; // ms
const ANIMATION_DELAY = 50; // ms between stacked modal animations

// These control:
// - How long enter/exit animations take
// - Stagger delay when closing multiple modals
// - When animation states are updated
```

### Error Handling and Cleanup

The hook provides automatic cleanup:

```typescript
// Automatic cleanup on unmount:
// - All animation timeouts are cleared
// - Event listeners are removed
// - Body scroll is restored
// - Modal stack is cleared

// Memory management:
// - Timeouts are tracked and cleaned up
// - No memory leaks from abandoned animations
// - Proper cleanup of event listeners
```

### Integration with Components

Example of integrating with a modal component:

```typescript
import { useModal } from '../hooks/useModal';

function ModalSystem() {
  const modalState = useModal();
  const { currentModal } = modalState;

  const renderModal = () => {
    if (!currentModal) return null;

    switch (currentModal.type) {
      case 'lunar':
        return <LunarModal {...currentModal} onClose={() => modalState.closeModal()} />;
      case 'tripLog':
        return <TripLogModal {...currentModal} onClose={() => modalState.closeModal()} />;
      case 'tackleBox':
        return <TackleBoxModal {...currentModal} onClose={() => modalState.closeModal()} />;
      default:
        return null;
    }
  };

  return (
    <div>
      {/* Your app content */}
      
      {/* Modal overlay */}
      {currentModal && (
        <div className="modal-overlay">
          {renderModal()}
        </div>
      )}
    </div>
  );
}
```

### Requirements Satisfied

This hook satisfies the following requirements:
- **3.2**: Provides modal state management with animation support
- **4.4**: Implements modal stack management for nested modals with typed modal identifiers