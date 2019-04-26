module.exports = {
  apps: [{
    env: {
      NODE_DEBUG: '@wireapp/*,wire-absence-bot/*',
      NODE_ENV: 'production',
    },
    name: 'Wire Absence Bot',
    script: 'dist/index.js',
  }],
};
