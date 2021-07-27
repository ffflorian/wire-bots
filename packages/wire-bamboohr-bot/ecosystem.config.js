module.exports = {
  apps: [{
    env: {
      NODE_DEBUG: '@wireapp/*,wire-bamboohr-bot/*',
      NODE_ENV: 'production',
    },
    name: 'Wire BambooHR Bot',
    script: 'dist/index.js',
  }],
};
