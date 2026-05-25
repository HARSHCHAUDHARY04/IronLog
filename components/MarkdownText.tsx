import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface MarkdownTextProps {
  content: string;
  colors: any;
  textColors: any;
  textStyles: any;
}

export default function MarkdownText({ content, colors, textColors, textStyles }: MarkdownTextProps) {
  if (!content) return null;

  // Split content by newlines
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  // Helper to parse inline styles (bold, italic, inline code) inside a text block
  const renderInlineText = (text: string, baseStyle: any) => {
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
    const splitParts = text.split(regex);

    splitParts.forEach((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        parts.push(
          <Text key={index} style={[baseStyle, { fontWeight: 'bold', color: textColors.primary }]}>
            {part.slice(2, -2)}
          </Text>
        );
      } else if (part.startsWith('*') && part.endsWith('*')) {
        parts.push(
          <Text key={index} style={[baseStyle, { fontStyle: 'italic' }]}>
            {part.slice(1, -1)}
          </Text>
        );
      } else if (part.startsWith('`') && part.endsWith('`')) {
        parts.push(
          <Text 
            key={index} 
            style={[
              baseStyle, 
              { 
                fontFamily: 'monospace', 
                backgroundColor: 'rgba(255,255,255,0.06)', 
                borderRadius: 4, 
                paddingHorizontal: 4,
                color: '#EAB308',
                fontSize: 12
              }
            ]}
          >
            {part.slice(1, -1)}
          </Text>
        );
      } else if (part) {
        parts.push(
          <Text key={index} style={baseStyle}>
            {part}
          </Text>
        );
      }
    });

    return parts;
  };

  let inList = false;

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();

    // 1. Horizontal Rule (Separator)
    if (trimmedLine === '---' || trimmedLine === '***') {
      elements.push(
        <View 
          key={`hr-${index}`} 
          style={{ 
            height: 1, 
            backgroundColor: colors.border || 'rgba(255,255,255,0.08)', 
            marginVertical: 12 
          }} 
        />
      );
      inList = false;
      return;
    }

    // 2. Headers
    if (trimmedLine.startsWith('# ')) {
      elements.push(
        <Text 
          key={`h1-${index}`} 
          style={[
            textStyles, 
            styles.h1, 
            { color: textColors.primary, marginTop: index > 0 ? 12 : 4 }
          ]}
        >
          {trimmedLine.slice(2)}
        </Text>
      );
      inList = false;
      return;
    }
    
    if (trimmedLine.startsWith('## ')) {
      elements.push(
        <Text 
          key={`h2-${index}`} 
          style={[
            textStyles, 
            styles.h2, 
            { color: textColors.primary, marginTop: index > 0 ? 10 : 4 }
          ]}
        >
          {trimmedLine.slice(3)}
        </Text>
      );
      inList = false;
      return;
    }

    if (trimmedLine.startsWith('### ')) {
      elements.push(
        <Text 
          key={`h3-${index}`} 
          style={[
            textStyles, 
            styles.h3, 
            { color: '#EAB308', marginTop: index > 0 ? 8 : 4 }
          ]}
        >
          {trimmedLine.slice(4)}
        </Text>
      );
      inList = false;
      return;
    }

    // 3. Blockquotes
    if (trimmedLine.startsWith('> ')) {
      elements.push(
        <View 
          key={`quote-${index}`} 
          style={{
            borderLeftWidth: 3,
            borderLeftColor: '#EAB308',
            paddingLeft: 10,
            marginVertical: 6,
            backgroundColor: 'rgba(234, 179, 8, 0.03)',
            borderRadius: 2,
            paddingVertical: 4
          }}
        >
          <Text style={[textStyles, { fontStyle: 'italic', color: textColors.secondary }]}>
            {renderInlineText(trimmedLine.slice(2), { color: textColors.secondary })}
          </Text>
        </View>
      );
      inList = false;
      return;
    }

    // 4. Unordered List Items
    const isUnorderedList = trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ');
    if (isUnorderedList) {
      const bulletText = trimmedLine.slice(2);
      elements.push(
        <View key={`li-${index}`} style={styles.listItem}>
          <Text style={[textStyles, { color: '#EAB308', marginRight: 6, fontWeight: 'bold' }]}>•</Text>
          <Text style={[textStyles, { flex: 1 }]}>
            {renderInlineText(bulletText, { color: textColors.primary })}
          </Text>
        </View>
      );
      inList = true;
      return;
    }

    // 5. Numbered List Items
    const numListMatch = trimmedLine.match(/^(\d+)\.\s(.*)/);
    if (numListMatch) {
      const num = numListMatch[1];
      const numText = numListMatch[2];
      elements.push(
        <View key={`nli-${index}`} style={styles.listItem}>
          <Text style={[textStyles, { color: '#EAB308', marginRight: 6, fontWeight: 'bold' }]}>{num}.</Text>
          <Text style={[textStyles, { flex: 1 }]}>
            {renderInlineText(numText, { color: textColors.primary })}
          </Text>
        </View>
      );
      inList = true;
      return;
    }

    // 6. Empty Line (Double newline breaks list context)
    if (trimmedLine === '') {
      inList = false;
      return;
    }

    // 7. Regular Paragraph Text
    elements.push(
      <Text 
        key={`p-${index}`} 
        style={[
          textStyles, 
          styles.paragraph, 
          { color: textColors.primary, marginTop: inList ? 4 : 8 }
        ]}
      >
        {renderInlineText(trimmedLine, { color: textColors.primary })}
      </Text>
    );
    inList = false;
  });

  return <View style={styles.container}>{elements}</View>;
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
  h1: {
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 26,
    marginBottom: 8,
  },
  h2: {
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 24,
    marginBottom: 6,
  },
  h3: {
    fontSize: 15,
    fontWeight: 'bold',
    lineHeight: 20,
    marginBottom: 4,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 3,
    paddingLeft: 6,
  },
});
