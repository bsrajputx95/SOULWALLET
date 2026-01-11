import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import DOMPurify from 'isomorphic-dompurify';
import { COLORS } from '../constants/colors';
import { FONTS } from '../constants/theme';
import { logger } from '../lib/client-logger';

// Default allowed tags for safe HTML rendering
const DEFAULT_ALLOWED_TAGS: string[] = [];  // Default: strip all HTML

interface SafeHtmlProps {
  html: string;
  style?: any;
  textStyle?: any;
  maxLength?: number;
  fallbackText?: string;
  /** Custom allowed tags (default: empty array - strip all HTML) */
  allowedTags?: string[];
}

/**
 * SafeHtml component for securely rendering HTML content
 * Uses DOMPurify to sanitize HTML and prevents XSS attacks
 * Plan2 Step 3: Enhanced with custom allowed tags prop
 */
export const SafeHtml: React.FC<SafeHtmlProps> = ({
  html,
  style,
  textStyle,
  maxLength = 1000,
  fallbackText = 'Content unavailable',
  allowedTags = DEFAULT_ALLOWED_TAGS,
}) => {
  // Sanitize the HTML content
  const sanitizedHtml = React.useMemo(() => {
    if (!html || typeof html !== 'string') {
      return fallbackText;
    }

    try {
      // Truncate if too long
      const truncatedHtml = html.length > maxLength
        ? html.substring(0, maxLength) + '...'
        : html;

      // Sanitize the HTML with custom allowed tags
      // Plan2 Step 3: Use stricter DOMPurify config with custom tags
      const cleaned = DOMPurify.sanitize(truncatedHtml, {
        ALLOWED_TAGS: allowedTags,
        ALLOWED_ATTR: allowedTags.includes('a') ? ['href'] : [],  // Only allow href if 'a' tag is allowed
        ALLOW_DATA_ATTR: false,
        SAFE_FOR_TEMPLATES: true,
      });

      // If sanitization results in empty content, use fallback
      return cleaned.trim() || fallbackText;
    } catch (error) {
      logger.warn('SafeHtml: Error sanitizing content:', error);
      return fallbackText;
    }
  }, [html, maxLength, fallbackText, allowedTags]);

  // For React Native, we need to strip HTML tags for display
  // since React Native doesn't support HTML rendering natively
  const displayText = React.useMemo(() => {
    return sanitizedHtml
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .trim();
  }, [sanitizedHtml]);

  if (!displayText) {
    return (
      <View style={[styles.container, style]}>
        <Text style={[styles.fallbackText, textStyle]}>
          {fallbackText}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.text, textStyle]}>
        {displayText}
      </Text>
    </View>
  );
};

/**
 * SafeHtmlText component for simple text sanitization
 * Strips all HTML tags and returns clean text
 */
export const SafeHtmlText: React.FC<{
  html: string;
  style?: any;
  maxLength?: number;
  fallbackText?: string;
}> = ({ html, style, maxLength = 500, fallbackText = '' }) => {
  const cleanText = React.useMemo(() => {
    if (!html || typeof html !== 'string') {
      return fallbackText;
    }

    try {
      // First sanitize with no allowed tags, then strip any remaining HTML
      const sanitized = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
        KEEP_CONTENT: true,
      });
      const stripped = sanitized
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/')
        .trim();

      return stripped.length > maxLength
        ? stripped.substring(0, maxLength) + '...'
        : stripped;
    } catch (error) {
      logger.warn('SafeHtmlText: Error processing content:', error);
      return fallbackText;
    }
  }, [html, maxLength, fallbackText]);

  return (
    <Text style={[styles.text, style]}>
      {cleanText}
    </Text>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  text: {
    ...FONTS.sfProRegular,
    color: COLORS.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  fallbackText: {
    ...FONTS.sfProRegular,
    color: COLORS.textSecondary,
    fontSize: 14,
    fontStyle: 'italic',
  },
});