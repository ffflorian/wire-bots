import * as logdown from 'logdown';

class FeedService {
  private readonly logger: logdown.Logger;

  constructor() {
    this.logger = logdown('wire-feed-bot/FeedService', {
      logger: console,
      markdown: false,
    });
  }

  getFeed(): void {
    this.logger.log('Getting feed');
  }
}

export {FeedService};
