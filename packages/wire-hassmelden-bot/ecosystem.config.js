module.exports = {
  apps: [{
    env: {
      NODE_DEBUG: '@wireapp/*,wire-hassmelden-bot/*',
      NODE_ENV: 'production',
    },
    name: 'Wire Hassmelden Bot',
    script: 'dist/index.js',
  }],
};
