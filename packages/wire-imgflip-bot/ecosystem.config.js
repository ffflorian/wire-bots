module.exports = {
  apps: [{
    env: {
      NODE_DEBUG: '@wireapp/*,wire-imgflip-bot/*',
      NODE_ENV: 'production',
    },
    name: 'Wire Imgflip Bot',
    script: 'dist/index.js',
  }],
};
