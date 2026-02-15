import React from 'react';
import {StyleSheet, View} from 'react-native';

export function PageBackground() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.orbLeft} />
      <View style={styles.orbRight} />
    </View>
  );
}

const styles = StyleSheet.create({
  orbLeft: {
    position: 'absolute',
    top: -170,
    left: -120,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(122, 75, 143, 0.08)',
  },
  orbRight: {
    position: 'absolute',
    top: -160,
    right: -130,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(207, 125, 159, 0.08)',
  },
});
