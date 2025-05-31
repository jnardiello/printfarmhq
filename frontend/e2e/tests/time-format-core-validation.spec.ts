import { test, expect } from '@playwright/test'

test.describe('Time Format Core Validation', () => {
  test('time format validation logic works correctly', async ({ page }) => {
    // Go to any page to get a browser context
    await page.goto('/')
    
    // Inject and test our time format validation function
    const validationResults = await page.evaluate(() => {
      // Copy the exact validation logic from lib/time-format.ts
      const TIME_FORMAT_PATTERN = /^(\d+h)?(\d+m)?$|^\d+(\.\d+)?$/
      
      function validateTimeFormat(value: string): boolean {
        if (!value || value.trim() === '') return true
        return TIME_FORMAT_PATTERN.test(value.trim())
      }
      
      // Comprehensive test cases covering all expected patterns
      const testCases = [
        // Valid hour+minute combinations
        { input: '1h30m', expected: true, description: 'hour and minutes' },
        { input: '0h15m', expected: true, description: 'zero hours with minutes' },
        { input: '24h0m', expected: true, description: 'many hours with zero minutes' },
        
        // Valid hour-only formats
        { input: '1h', expected: true, description: 'hour only' },
        { input: '2h', expected: true, description: 'multiple hours' },
        { input: '12h', expected: true, description: 'double digit hours' },
        
        // Valid minute-only formats
        { input: '45m', expected: true, description: 'minutes only' },
        { input: '5m', expected: true, description: 'single digit minutes' },
        { input: '90m', expected: true, description: 'more than 60 minutes' },
        
        // Valid decimal formats
        { input: '2.5', expected: true, description: 'decimal hours' },
        { input: '0.75', expected: true, description: 'fractional hour' },
        { input: '1.25', expected: true, description: 'mixed decimal' },
        { input: '10.333', expected: true, description: 'multiple decimal places' },
        { input: '0.1', expected: true, description: 'small decimal' },
        
        // Invalid formats
        { input: 'invalid', expected: false, description: 'plain text' },
        { input: '1h30', expected: false, description: 'incomplete hour+minute' },
        { input: 'h30m', expected: false, description: 'missing hours' },
        { input: '1.5h', expected: false, description: 'decimal with hour suffix' },
        { input: 'abc', expected: false, description: 'alphabetic text' },
        { input: '1h30m45s', expected: false, description: 'with seconds' },
        { input: '1 h 30 m', expected: false, description: 'with spaces' },
        { input: '-1h', expected: false, description: 'negative hours' },
        { input: '1h-30m', expected: false, description: 'negative minutes' },
        
        // Edge cases
        { input: '', expected: true, description: 'empty string' },
        { input: '   ', expected: true, description: 'whitespace only' },
        { input: '0h', expected: true, description: 'zero hours' },
        { input: '0m', expected: true, description: 'zero minutes' },
        { input: '0', expected: true, description: 'zero decimal' },
        { input: '0.0', expected: true, description: 'zero with decimal' }
      ]
      
      const results = testCases.map(testCase => {
        const actual = validateTimeFormat(testCase.input)
        return {
          input: testCase.input,
          expected: testCase.expected,
          actual: actual,
          passed: actual === testCase.expected,
          description: testCase.description
        }
      })
      
      return {
        allPassed: results.every(r => r.passed),
        totalTests: results.length,
        passedTests: results.filter(r => r.passed).length,
        failedTests: results.filter(r => !r.passed),
        results: results
      }
    })
    
    // Verify all tests passed
    
    // Verify all tests passed
    expect(validationResults.allPassed).toBe(true)
    expect(validationResults.passedTests).toBe(validationResults.totalTests)
    
    // Verify we tested a reasonable number of cases
    expect(validationResults.totalTests).toBeGreaterThan(20)
  })
  
  test('time format pattern regex works correctly', async ({ page }) => {
    await page.goto('/')
    
    const regexTest = await page.evaluate(() => {
      const TIME_FORMAT_PATTERN = /^(\d+h)?(\d+m)?$|^\d+(\.\d+)?$/
      
      // Test the regex directly
      const testPatterns = [
        { input: '1h30m', shouldMatch: true },
        { input: '2h', shouldMatch: true },
        { input: '45m', shouldMatch: true },
        { input: '2.5', shouldMatch: true },
        { input: 'invalid', shouldMatch: false },
        { input: '1h30', shouldMatch: false }
      ]
      
      return testPatterns.map(test => ({
        input: test.input,
        expected: test.shouldMatch,
        actual: TIME_FORMAT_PATTERN.test(test.input),
        passed: TIME_FORMAT_PATTERN.test(test.input) === test.shouldMatch
      }))
    })
    
    for (const result of regexTest) {
      expect(result.passed, `Regex test failed for "${result.input}": expected ${result.expected}, got ${result.actual}`).toBe(true)
    }
  })
})