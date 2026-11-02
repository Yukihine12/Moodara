import fc from 'fast-check';

// Global fast-check configuration.
// Property-based tests must run a minimum of 100 iterations per property
// (Requirement 5.7 / design Testing Strategy). Setting numRuns here ensures
// every property test defaults to at least 100 runs without repeating the
// configuration in each file.
fc.configureGlobal({ numRuns: 100 });
