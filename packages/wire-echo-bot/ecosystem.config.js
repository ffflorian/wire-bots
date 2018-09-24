module.exports = {
  apps: [{
    env: {
      NODE_DEBUG: '@wireapp/*,wire-echo-bot/*',
      NODE_ENV: 'production',
    },
    name: 'Wire Echo Bot',
    script: 'dist/index.js',
  }],
};
