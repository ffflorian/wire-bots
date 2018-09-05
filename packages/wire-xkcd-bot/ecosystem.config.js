module.exports = {
  apps: [{
    env: {
      NODE_DEBUG: '@wireapp/*,wire-xkcd-bot/*',
      NODE_ENV: 'production',
    },
    name: 'Wire xkcd Bot',
    script: 'dist/index.js',
  }],
};
