import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Defs, RadialGradient, Rect, Stop, Svg } from 'react-native-svg';
import { colors } from '../theme/colors';

export function PageBackground() {
  return (
    <View
      accessible={false}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.canvas]}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <RadialGradient
            id="pageLilacCorner"
            cx="0%"
            cy="0%"
            rx="78%"
            ry="64%"
          >
            <Stop offset="0%" stopColor={colors.lilac} stopOpacity={0.13} />
            <Stop offset="48%" stopColor={colors.lilac} stopOpacity={0.04} />
            <Stop offset="100%" stopColor={colors.lilac} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient
            id="pageBlushCorner"
            cx="100%"
            cy="100%"
            rx="80%"
            ry="66%"
          >
            <Stop offset="0%" stopColor={colors.blush} stopOpacity={0.15} />
            <Stop offset="50%" stopColor={colors.blush} stopOpacity={0.045} />
            <Stop offset="100%" stopColor={colors.blush} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#pageLilacCorner)" />
        <Rect width="100%" height="100%" fill="url(#pageBlushCorner)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
});
