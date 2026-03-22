module.exports = {
  preset: 'react-native',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-vector-icons|react-native-paper|react-native-tab-view|react-native-pager-view|react-native-markdown-display|react-native-svg)/)',
  ],
};
