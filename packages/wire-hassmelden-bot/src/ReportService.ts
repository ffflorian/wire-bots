import logdown from 'logdown';

class ReportService {
  private readonly logger: logdown.Logger;

  constructor() {
    this.logger = logdown('wire-hassmelden-bot/ReportService', {
      logger: console,
      markdown: false,
    });
  }

  async report(): Promise<void> {
    this.logger.info('Got result.');
  }
}

export {ReportService};
