import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

export function PageBackground() {
  return (
    <View
      accessible={false}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.canvas]}
    >
      <View style={styles.lilacWash} />
      <View style={styles.blushWash} />

      <View style={styles.pinLarge}>
        <View style={[styles.pinTail, styles.pinLargeTail]} />
        <View style={[styles.pinHead, styles.pinLargeHead]}>
          <View style={[styles.pinCore, styles.pinLargeCore]} />
        </View>
      </View>

      <View style={styles.pinSmall}>
        <View style={[styles.pinTail, styles.pinSmallTail]} />
        <View style={[styles.pinHead, styles.pinSmallHead]}>
          <View style={[styles.pinCore, styles.pinSmallCore]} />
        </View>
      </View>

      <View style={styles.sparkleOne} />
      <View style={styles.sparkleTwo} />
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  lilacWash: {
    position: 'absolute',
    top: -188,
    left: -136,
    width: 390,
    height: 390,
    borderRadius: 195,
    backgroundColor: 'rgba(208, 188, 255, 0.28)',
  },
  blushWash: {
    position: 'absolute',
    right: -144,
    bottom: -170,
    width: 370,
    height: 370,
    borderRadius: 185,
    backgroundColor: 'rgba(252, 221, 236, 0.52)',
  },
  pinLarge: {
    position: 'absolute',
    right: -62,
    bottom: -36,
    width: 250,
    height: 292,
    opacity: 0.56,
  },
  pinSmall: {
    position: 'absolute',
    top: 128,
    left: -44,
    width: 132,
    height: 158,
    opacity: 0.34,
    transform: [{ rotate: '-12deg' }],
  },
  pinHead: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pin,
    zIndex: 2,
  },
  pinTail: {
    position: 'absolute',
    backgroundColor: colors.pin,
    transform: [{ rotate: '45deg' }],
    zIndex: 1,
  },
  pinCore: {
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  pinLargeHead: {
    top: 8,
    left: 20,
    width: 210,
    height: 210,
    borderRadius: 105,
  },
  pinLargeTail: {
    top: 134,
    left: 79,
    width: 92,
    height: 92,
    borderRadius: 18,
  },
  pinLargeCore: {
    width: 86,
    height: 86,
  },
  pinSmallHead: {
    top: 4,
    left: 12,
    width: 108,
    height: 108,
    borderRadius: 54,
  },
  pinSmallTail: {
    top: 70,
    left: 44,
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  pinSmallCore: {
    width: 42,
    height: 42,
  },
  sparkleOne: {
    position: 'absolute',
    top: '38%',
    right: 30,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(208, 188, 255, 0.66)',
  },
  sparkleTwo: {
    position: 'absolute',
    top: '43%',
    right: 50,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(236, 167, 206, 0.70)',
  },
});
