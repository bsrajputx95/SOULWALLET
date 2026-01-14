# Requirements Document

## Introduction

Improve token display across the app to match DexScreener's presentation style. This includes showing profile images, simplifying the home screen token list to show only tickers, and enhancing the token detail page with proper price formatting and banner images.

## Glossary

- **Token_List**: The list of trending tokens displayed on the home screen
- **Token_Card**: Individual token item component in the list
- **Token_Detail_Page**: The full-screen view when a token is tapped
- **Profile_Image**: The token's logo/icon from DexScreener
- **Banner_Image**: The token's header/banner image from DexScreener
- **Ticker**: The short symbol for a token (e.g., LIQWHL, WIF, BONK)
- **Subscript_Price_Format**: Price format like $0.0₄1367 where subscript shows count of zeros

## Requirements

### Requirement 1: Display Token Profile Images

**User Story:** As a user, I want to see the actual token logo from DexScreener, so that I can visually identify tokens quickly.

#### Acceptance Criteria

1. WHEN a token has a profile image from DexScreener, THE Token_Card SHALL display that image
2. WHEN a token has no profile image, THE Token_Card SHALL display a letter avatar fallback
3. WHEN the profile image fails to load, THE Token_Card SHALL fallback to letter avatar

### Requirement 2: Simplify Home Screen Token List

**User Story:** As a user, I want to see a clean token list with just essential info, so that I can quickly scan trending tokens.

#### Acceptance Criteria

1. THE Token_Card SHALL display only the ticker symbol (not the full name)
2. THE Token_Card SHALL NOT display the token bio or description
3. THE Token_Card SHALL display the ticker in uppercase format
4. WHEN displaying the ticker, THE Token_Card SHALL show it prominently as the primary identifier

### Requirement 3: Format Long Prices with Subscript Notation

**User Story:** As a user, I want to see prices formatted like DexScreener, so that very small prices are readable.

#### Acceptance Criteria

1. WHEN a price has more than 4 leading zeros after decimal, THE System SHALL format it with subscript notation
2. THE subscript notation SHALL show the count of zeros as a subscript number (e.g., $0.0₄1367)
3. WHEN a price is greater than 0.0001, THE System SHALL display it in standard decimal format
4. THE Price_Formatter SHALL handle prices from 0.000000001 to 1000000000

### Requirement 4: Enhanced Token Detail Page Layout

**User Story:** As a user, I want to see the token detail page with logo, price movement, and banner image, so that I get a complete view of the token.

#### Acceptance Criteria

1. WHEN a token is clicked, THE Token_Detail_Page SHALL display the profile image on the left
2. THE Token_Detail_Page SHALL display price and percentage change on the right side of the header
3. WHEN a token has a banner image, THE Token_Detail_Page SHALL display it below the price/name section
4. THE Token_Detail_Page SHALL NOT display the bio/about section
5. THE Token_Detail_Page SHALL use subscript price formatting for small prices
