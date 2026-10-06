// Two independent knobs:
//  - APP_MODE=sample  → serve fixture data only, never touch real Canvas/db. No password needed.
//  - APP_MODE=live (default) → serve real Canvas data, gated by SITE_PASSWORD in middleware.ts.
// E2E_TEST=1 (Playwright) also uses fixtures, same as sample mode, so tests never need a real token.

export const APP_MODE = process.env.APP_MODE === 'sample' ? 'sample' : 'live'
export const IS_SAMPLE_MODE = APP_MODE === 'sample'
export const IS_E2E_TEST = process.env.E2E_TEST === '1'
export const USE_FIXTURES = IS_SAMPLE_MODE || IS_E2E_TEST

// The real child's name is only shown in live mode. Sample mode is meant to be
// safe to leave publicly reachable, so it must not name a real minor.
export const DISPLAY_NAME = IS_SAMPLE_MODE ? 'Alex' : 'Landis'
