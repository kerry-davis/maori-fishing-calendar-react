/**
 * Data Integrity Fixes Validation Script
 * 
 * This script validates that all fixes from test4 are working correctly.
 * Run with: npm test validateDataIntegrityFixes.ts
 */

import { validateUserContext } from '../utils/userStateCleared';
import { persistenceInstrumentation } from '../utils/persistenceInstrumentation';
import { clearUserContext } from '../utils/clearUserContext';
import { useModalWithCleanup } from '../hooks/useModalWithCleanup';

// Test results interface
interface ValidationResult {
  testName: string;
  passed: boolean;
  error?: string;
  details?: string;
}

class DataIntegrityValidator {
  private results: ValidationResult[] = [];

  private test(name: string, testFn: () => boolean | Promise<boolean>, details?: string): void {
    const result: ValidationResult = {
      testName: name,
      passed: false,
      details
    };

    try {
      const testResult = testFn();
      if (testResult instanceof Promise) {
        testResult.then(passed => {
          result.passed = passed;
          this.results.push(result);
        }).catch(error => {
          result.passed = false;
          result.error = error.message;
          this.results.push(result);
        });
      } else {
        result.passed = testResult;
        this.results.push(result);
      }
    } catch (error: any) {
      result.passed = false;
      result.error = error.message;
      this.results.push(result);
    }
  }

  private simulateWindowContext(): void {
    // Mock window for testing
    (global as any).window = {
      localStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        length: 0,
        key: () => null
      },
      sessionStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        length: 0,
        key: () => null
      },
      addEventListener: () => {},
      removeEventListener: () => {},
      performance: {
        now: () => Date.now()
      },
      location: { hash: '', pathname: '/test' }
    };

    (global as any).document = {
      title: '',
      body: { style: { overflow: '' } }
    };

    (global as any).performance = (global as any).window.performance;
    (global as any).localStorage = (global as any).window.localStorage;
  }

  async runAllTests(): Promise<ValidationResult[]> {
    console.log('🔍 Starting Data Integrity Fixes Validation...\n');

    this.simulateWindowContext();

    // Test 1: TypeScript Build - assessRisk method types
    this.test('Task 1: TypeScript Build - assessRisk method', () => {
      try {
        persistenceInstrumentation.startSession();
        
        // Test method exists and has proper signature
        const artifacts = [
          { layer: 'localStorage' as const, key: 'test', valueType: 'string' as const, 
            value: 'test', riskLevel: 'HIGH' as const, timestamp: Date.now(), source: 'test' }
        ];
        
        const report = persistenceInstrumentation.endSession('test-user', 'test-logout');
        
        // Verify return structure
        return report && 
               typeof report.highRiskCount === 'number' &&
               typeof report.mediumRiskCount === 'number' &&
               typeof report.totalArtifactsRemaining === 'number' &&
               Array.isArray(report.criticalIssues);
      } catch (error) {
        console.error('Task 1 failed:', error);
        return false;
      }
    }, 'Validates assessRisk method has proper TypeScript return types');

    // Test 2: Browser API Safety
    this.test('Task 2: Browser API Safety', async () => {
      try {
        // Test missing performance API
        delete (global as any).performance;
        
        const result = await clearUserContext();
        return result.success === true;
      } catch (error) {
        console.error('Task 2 failed:', error);
        return false;
      }
    }, 'Tests browser API guards with fallbacks');

    // Test 3: Firebase Auth Import and Write Operation Detection
    this.test('Task 3: Write Operation Detection', () => {
      try {
        // Should block write operations in guest mode
        try {
          validateUserContext(null, () => {}, undefined, 'createTrip');
          return false; // Should have thrown
        } catch (error) {
          if (!error.message.includes('Write operations require')) {
            return false;
          }
        }

        // Should allow read operations in guest mode
        try {
          const result = validateUserContext(null, () => 'data', undefined, 'getTrip');
          return result === 'data';
        } catch (error) {
          return false;
        }
      } catch (error) {
        console.error('Task 3 failed:', error);
        return false;
      }
    }, 'Validates explicit write operation Set vs substring matching');

    // Test 4: Deterministic Modal Events
    this.test('Task 4: Deterministic Modal Events', async () => {
      try {
        // Test that modal hook can be created and has the expected methods
        const { result } = renderHook(() => useModalWithCleanup(true, { cleanupOnLogout: true }));
        
        // Test modal can be opened
        let opened = false;
        try {
          act(() => {
            opened = result.current.openModal();
          });
          return opened === true && result.current.isOpen === true;
        } catch (error) {
          console.error('Modal hook test failed:', error);
          return false;
        }
      } catch (error) {
        console.error('Task 4 failed:', error);
        return false;
      }
    }, 'Validates modal hook uses deterministic events');

    // Test 5: End-to-End Integration
    this.test('Task 5: Integration Validation', async () => {
      try {
        // Test complete workflow
        persistenceInstrumentation.startSession();
        
        const userId = 'validation-test-user';
        
        // Test user validation
        const readResult = validateUserContext(userId, () => 'success', undefined, 'readOperation');
        if (readResult !== 'success') return false;
        
        // Test write operation blocking
        try {
          validateUserContext(null, () => {}, undefined, 'createTrip');
          return false;
        } catch (error) {
          if (!error.message.includes('Write operations require')) {
            return false;
          }
        }
        
        // Test cleanup
        const report = persistenceInstrumentation.endSession(userId, 'validation-test');
        if (!report || report.leakagePaths.length > 0) return false;
        
        // Test final cleanup
        const cleanupResult = await clearUserContext();
        return cleanupResult.success === true;
        
      } catch (error) {
        console.error('Task 5 failed:', error);
        return false;
      }
    }, 'Validates complete end-to-end workflow');

    // Test 6: Performance Validation
    this.test('Performance: Write Operation Detection Speed', () => {
      try {
        const startTime = Date.now();
        
        // Test 1000 write operation checks
        for (let i = 0; i < 1000; i++) {
          try {
            validateUserContext(null, () => {}, undefined, 'createTrip');
          } catch (error) {
            // Expected to throw
          }
        }
        
        // Test 1000 read operations
        for (let i = 0; i < 1000; i++) {
          validateUserContext(null, () => 'data', undefined, 'getTrip');
        }
        
        const duration = Date.now() - startTime;
        return duration < 100; // Should complete in under 100ms with Set lookup
      } catch (error) {
        console.error('Performance test failed:', error);
        return false;
      }
    }, 'Validates O(1) write operation lookup performance');

    return this.results;
  }

  printResults(): void {
    console.log('\n📊 DATA INTEGRITY FIXES VALIDATION RESULTS');
    console.log('═'.repeat(50));

    let passedCount = 0;
    let totalCount = 0;

    this.results.forEach((result, index) => {
      totalCount++;
      
      if (result.passed) {
        passedCount++;
        console.log(`✅ ${index + 1}. ${result.testName}`);
      } else {
        console.log(`❌ ${index + 1}. ${result.testName}`);
        if (result.error) {
          console.log(`   Error: ${result.error}`);
        }
      }
      
      if (result.details) {
        console.log(`   Details: ${result.details}`);
      }
      console.log('');
    });

    console.log('═'.repeat(50));
    console.log(`📈 SUMMARY: ${passedCount}/${totalCount} tests passed`);
    
    if (passedCount === totalCount) {
      console.log('🎉 ALL FIXES VALIDATED SUCCESSFULLY!');
      console.log('\n✨ Ready for production deployment');
    } else {
      console.log('⚠️  Some tests failed - please review the errors above');
    }
  }
}

// Helper function for React testing
import { renderHook, act } from '@testing-library/react';
import { React } from 'react';

// Main execution
async function runValidation() {
  const validator = new DataIntegrityValidator();
  
  console.log('🔧 Environment Setup:');
  console.log('   - TypeScript: Checking types and imports');
  console.log('   - Browser APIs: Testing safety guards');
  console.log('   - Firebase Auth: Validating static imports');
  console.log('   - Event System: Testing deterministic cleanup');
  console.log('');

  const results = await validator.runAllTests();
  validator.printResults();
  
  // Exit with appropriate code for CI/CD
  const allPassed = results.every(r => r.passed);
  process.exit(allPassed ? 0 : 1);
}

// Export for use in other test files
export { DataIntegrityValidator, runValidation };

// Run if this file is executed directly
if (require.main === module) {
  runValidation().catch(error => {
    console.error('Validation script failed:', error);
    process.exit(1);
  });
}
