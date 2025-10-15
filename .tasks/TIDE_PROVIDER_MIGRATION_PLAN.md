# Plan: Harbour-Aware Tide Provider Migration

## Current State
- Using Open-Meteo global marine API for tide predictions
- Implemented tideService abstraction layer
- Created MetOceanTideProvider prototype for Kawhia harbour
- Series data implemented in tideService but may need UI integration review

## Migration Plan

### Phase 1: Provider Architecture
- ✅ Completed: Abstract `TideProvider` interface with `supportsLocation()`, `fetchForecast()`, `checkCoverage()`
- ✅ Completed: MetOceanTideProvider prototype for Kawhia harbour bounds
- ✅ Completed: Provider factory logic in `getTideProvider()`
- ⏳ Complete: Enhanced harbour boundaries for additional NZ harbours
- ⏳ Complete: NIWA provider implementation as alternative

### Phase 2: Data Accuracy Improvements
- Replace prototype sine-wave interpolation with actual MetOcean/NZ maritime data
- Improve temporal resolution (hourly vs 6-minute intervals)
- Add seasonal and bathymetry effects for harbour-specific predictions
- Validate against official NZ tide tables

### Phase 3: Integration & Testing
- Validate all tide consumers use updated abstraction
- Add harbour-aware provider selection UI
- Implement fallback strategy when harbour data unavailable
- Comprehensive testing across NZ harbour locations

### Phase 4: Deployment & Monitoring
- Gradual rollout with Open-Meteo fallback
- Performance monitoring for provider switching
- User experience validation for different harbours

## Technical Considerations

### Provider Selection Logic
```typescript
// Priority order for NZ locations:
1. MetOcean (if location supported)
2. NIWA (if location supported) 
3. Open-Meteo (global fallback)
```

### Data Quality Metrics
- Accuracy comparison with official tide tables
- Update frequency (real-time vs daily predictions)
- Coverage validation for all NZ fishing locations

### Backward Compatibility
- Maintain existing tideService API
- Preserve caching strategy
- Keep error handling consistent

## Next Steps
1. Enhance Kawhia prototype with actual MetOcean API integration
2. Expand harbour boundary definitions
3. Add NIWA provider as backup
4. Implement provider health monitoring
5. Update UI to show active tide data source
