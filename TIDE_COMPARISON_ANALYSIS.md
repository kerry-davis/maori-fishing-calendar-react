# Tide Provider Accuracy Analysis for Kawhia, NZ (Wed 15 Oct 2025)

## REFERENCE: MetService (Gold Standard)
```
HIGH: 05:30 (2.9m)
LOW: 11:22 (1.3m) 
HIGH: 18:09 (3.0m)
```

## MAREA API Results
```
=== TIDE COMPARISON FOR Marea API ===
HIGH TIDES: ["03:33 (0.89m)", "16:13 (0.69m)"]
LOW TIDES: ["10:02 (-0.83m)", "22:29 (-0.82m)"]
=======================================
```

## ACCURACY ANALYSIS

### MAREA API - POOR ACCURACY ❌
**Time Differences:**
- First High: 05:30 (MetService) vs 03:33 (Marea) = **1 hour 57 minutes early**
- Low: 11:22 (MetService) vs 10:02 (Marea) = **1 hour 20 minutes early** 
- Second High: 18:09 (MetService) vs 16:13 (Marea) = **1 hour 56 minutes early**

**Height Differences:**
- First High: 2.9m (MetService) vs 0.89m (Marea) = **2.01m UNDER**
- Low: 1.3m (MetService) vs -0.83m (Marea) = **2.13m UNDER (and NEGATIVE!)**
- Second High: 3.0m (MetService) vs 0.69m (Marea) = **2.31m UNDER**

### MAREA Problems:
1. **Severe Underestimation**: Heights off by 2+ meters
2. **Timing Issues**: Always 1.5-2 hours early
3. **Incorrect Low Tides**: Showing negative low tide (-0.83m) vs actual +1.3m
4. **Global Model Limitations**: FES2014 model not suitable for NZ harbors

## RECOMMENDATION

🚨 **SWITCH IMMEDIATELY** to Open-Meteo as primary provider.

Marea API is completely unreliable for NZ harbor fishing with:
- Height errors of 60-70% (off by over 2 meters)
- Timing errors of 1.5-2 hours early
- Completely wrong tide patterns (negative low tides)

This would make the fishing calendar dangerously inaccurate - showing low tide when it's actually high, and vice versa.

## NEEDED ACTIONS
1. Set Open-Meteo as primary provider (Priority 1)
2. Remove Marea API from providers (or keep as very distant backup)
3. Consider investigating NZ-specific tide APIs if Open-Meteo also has issues
4. The current fallback (original tide service) may be more accurate than either

The Marea API global FES2014 model is clearly not suitable for NZ harbor-specific tidal predictions.
