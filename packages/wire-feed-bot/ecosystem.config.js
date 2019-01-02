module.exports = {
  apps: [{
    env: {
      NODE_DEBUG: '@wireapp/*,wire-feed-bot/*',
      NODE_ENV: 'production',
    },
    name: 'Wire Feed Bot',
    script: 'dist/index.js',
  }],
};
