# Files Changed - Tide Data Integration 7

## Services
- `src/services/metOceanTideService.ts` - Major improvements including:
  - Updated supportsLocation to use harbour definitions map for expanded NZ coverage
  - Fixed getLunarDay to return actual days since reference new moon (not fractional cycles)
  - Replaced random tide-height jitter with deterministic harmonic model calculations
  - Synchronized extrema generation with harmonic series analysis
  - Implemented accurate NZ timezone logic with proper DST rules
  - Added comprehensive helper methods for UTC offsets, extrema detection, and synchronization

 Tests
- `src/test/tideStability.test.ts` - New comprehensive stability validation suite:
  - Deterministic output verification across multiple runs
  - Expanded harbour coverage testing
  - Realistic tide pattern validation
  - Consistent lunar day calculations
  - DST transition handling verification
  - UTC offset accuracy testing

## Summary of Key Improvements
- **Deterministic Tide Generation**: Eliminated all random variations, ensuring identical outputs for same input parameters
- **Accurate Timezone Handling**: Implemented proper NZ DST rules (last Sunday Sep to first Sunday Apr) with correct UTC offsets
- **Harmonic Model Integration**: Synchronized calculated extrema with actual harmonic series detection
- **Expanded Coverage**: Harbor-aware provider now supports Kawhia, Auckland, Tauranga, and Wellington regions
- **Comprehensive Testing**: Added 7 stability tests covering all critical functionality and edge cases
- **Lunar Cycle Accuracy**: Fixed lunar day calculations to use actual days since reference, improving long-term prediction consistency
