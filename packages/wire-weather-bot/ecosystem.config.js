module.exports = {
  apps: [{
    env: {
      NODE_DEBUG: '@wireapp/*,wire-weather-bot/*',
      NODE_ENV: 'production',
    },
    name: 'Wire Weather Bot',
    script: 'dist/index.js',
  }],
};
