import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Svg, { Rect, Circle, G, Text as SvgText } from 'react-native-svg';
import { Colors, useThemeColor } from '../lib/theme';

export interface MuscleHeatmapProps {
  fatigueLevels: Record<string, number>; // 0 to 100 (0 = fully recovered/green, 100 = highly fatigued/red)
}

export default function MuscleHeatmap({ fatigueLevels }: MuscleHeatmapProps) {
  const { colors, text, accent, status, muscle } = useThemeColor();
  const styles = React.useMemo(() => getStyles(colors, text, accent, status, muscle), [colors, text, accent, status, muscle]);

  const getMuscleColor = (level: number) => {
    if (level === undefined || level === 0) return colors.surfaceHighlight;
    if (level < 30) return status.success; // Green
    if (level < 70) return status.warning; // Yellow
    return accent.red; // Red
  };

  return (
    <View style={styles.container}>
      {/* A stylized geometric representation of the human body for the heatmap */}
      <Svg width="200" height="400" viewBox="0 0 200 400">
        <G id="head">
          <Circle cx="100" cy="40" r="25" fill={colors.surfaceHighlight} />
        </G>
        
        <G id="torso">
          {/* Chest */}
          <Rect x="65" y="75" width="70" height="40" rx="10" fill={getMuscleColor(fatigueLevels.chest || 0)} />
          <SvgText x="100" y="100" fill="#fff" fontSize="10" textAnchor="middle">Chest</SvgText>
          
          {/* Core/Abs */}
          <Rect x="70" y="125" width="60" height="60" rx="8" fill={getMuscleColor(fatigueLevels.core || 0)} />
          <SvgText x="100" y="160" fill="#fff" fontSize="10" textAnchor="middle">Core</SvgText>
        </G>
        
        <G id="arms">
          {/* Shoulders */}
          <Circle cx="50" cy="85" r="18" fill={getMuscleColor(fatigueLevels.shoulders || 0)} />
          <Circle cx="150" cy="85" r="18" fill={getMuscleColor(fatigueLevels.shoulders || 0)} />
          
          {/* Biceps/Triceps */}
          <Rect x="35" y="110" width="22" height="50" rx="11" fill={getMuscleColor(Math.max(fatigueLevels.biceps || 0, fatigueLevels.triceps || 0))} />
          <Rect x="143" y="110" width="22" height="50" rx="11" fill={getMuscleColor(Math.max(fatigueLevels.biceps || 0, fatigueLevels.triceps || 0))} />
          
          {/* Forearms */}
          <Rect x="30" y="170" width="18" height="60" rx="9" fill={colors.surfaceHighlight} />
          <Rect x="152" y="170" width="18" height="60" rx="9" fill={colors.surfaceHighlight} />
        </G>
        
        <G id="legs">
          {/* Quads / Hamstrings */}
          <Rect x="65" y="200" width="30" height="80" rx="10" fill={getMuscleColor(Math.max(fatigueLevels.quadriceps || 0, fatigueLevels.hamstrings || 0))} />
          <Rect x="105" y="200" width="30" height="80" rx="10" fill={getMuscleColor(Math.max(fatigueLevels.quadriceps || 0, fatigueLevels.hamstrings || 0))} />
          <SvgText x="80" y="245" fill="#fff" fontSize="10" textAnchor="middle">Legs</SvgText>
          <SvgText x="120" y="245" fill="#fff" fontSize="10" textAnchor="middle">Legs</SvgText>

          {/* Calves */}
          <Rect x="68" y="290" width="24" height="60" rx="10" fill={getMuscleColor(fatigueLevels.calves || 0)} />
          <Rect x="108" y="290" width="24" height="60" rx="10" fill={getMuscleColor(fatigueLevels.calves || 0)} />
        </G>
      </Svg>
      
      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: colors.surfaceHighlight }]} />
          <Text style={styles.legendText}>Fresh</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: status.success }]} />
          <Text style={styles.legendText}>Light</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: status.warning }]} />
          <Text style={styles.legendText}>Moderate</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: accent.red }]} />
          <Text style={styles.legendText}>Heavy</Text>
        </View>
      </View>
    </View>
  );
}

const getStyles = (colors: any, text: any, accent: any, status: any, muscle: any) => StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  legend: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 15,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    color: text.secondary,
    fontSize: 12,
  },
});
