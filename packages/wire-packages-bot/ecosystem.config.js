module.exports = {
  apps: [{
    env: {
      NODE_DEBUG: '@wireapp/*,wire-packages-bot/*',
      NODE_ENV: 'production',
    },
    name: 'Wire Packages Bot',
    script: 'dist/index.js',
  }],
};
