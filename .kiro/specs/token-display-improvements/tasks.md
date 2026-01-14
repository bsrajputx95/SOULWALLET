# Implementation Plan: Token Display Improvements

## Overview

Implement token display improvements in 4 focused tasks: price formatter utility, TokenCard simplification, backend data flow for banner, and token detail page updates.

## Tasks

- [x] 1. Create subscript price formatter utility
  - [x] 1.1 Create `utils/formatPrice.ts` with `formatSubscriptPrice` function
    - Handle prices < 0.0001 with subscript notation
    - Use Unicode subscript digits (₀₁₂₃₄₅₆₇₈₉)
    - Return standard format for prices >= 0.0001
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 1.2 Write property tests for price formatter
    - **Property 1: Subscript Price Formatting**
    - **Property 2: Standard Price Formatting Threshold**
    - **Property 3: Price Formatter Range Handling**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

- [-] 2. Simplify TokenCard component
  - [ ] 2.1 Update TokenCard to show only uppercase ticker
    - Remove `name` from display (keep in props)
    - Display `symbol.toUpperCase()` as primary text
    - Remove any bio/description display
    - _Requirements: 2.1, 2.2, 2.3_
  - [ ] 2.2 Integrate subscript price formatter in TokenCard
    - Import and use `formatSubscriptPrice` for price display
    - _Requirements: 3.1_
  - [ ] 2.3 Write property test for uppercase ticker display
    - **Property 4: Ticker Uppercase Display**
    - **Validates: Requirements 2.3**

- [ ] 3. Update data flow for banner image
  - [ ] 3.1 Update home screen to pass `header` (banner URL) in navigation params
    - Add `header` field to topCoins mapping in index.tsx
    - Pass `header` in router.push params when navigating to token detail
    - _Requirements: 4.3_
  - [ ] 3.2 Update backend trending response to include header field
    - Verify `header` is already included in marketData.ts trending()
    - Ensure frontend receives and maps the header field
    - _Requirements: 4.3_

- [ ] 4. Update Token Detail Page layout
  - [ ] 4.1 Restructure header to show logo left, price/change right
    - Move logo to left side of header
    - Position price and change percentage on right
    - Use subscript price formatter
    - _Requirements: 4.1, 4.2, 4.5_
  - [ ] 4.2 Add banner image section below header
    - Read `header` param from navigation
    - Conditionally render banner Image if URL exists
    - Style banner with appropriate dimensions
    - _Requirements: 4.3_
  - [ ] 4.3 Remove bio/description section
    - Remove or hide the description text display
    - _Requirements: 4.4_
  - [ ] 4.4 Write property test for banner conditional rendering
    - **Property 6: Banner Image Conditional Rendering**
    - **Validates: Requirements 4.3**

- [ ] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks including tests are required
- The `header` field from DexScreener contains the banner image URL
- Unicode subscript digits: ₀₁₂₃₄₅₆₇₈₉ (U+2080 to U+2089)
- Profile images already flow through `info.imageUrl` in the backend
