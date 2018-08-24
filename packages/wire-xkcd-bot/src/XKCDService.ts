import {ImageContent} from '@wireapp/core/dist/conversation/content/';
import * as ImageTools from './ImageTools';

import {XKCD} from '@ffflorian/xkcdjs';
import * as logdown from 'logdown';

interface ComicResult extends ImageContent {
  comment: string;
  index: number;
  title: string;
}

class XKCDService {
  private readonly XKCD: XKCD;
  private readonly logger: logdown.Logger;

  constructor() {
    this.XKCD = new XKCD();
    this.logger = logdown('wire-xkcd-bot/XKCDService', {
      logger: console,
      markdown: false,
    });
  }

  async getRandomComic(): Promise<ComicResult> {
    const xkcdResult = await this.XKCD.getRandom({withData: true});
    this.logger.info(`Got random comic with data:`, xkcdResult);

    const {alt: comment, data, num: index, title} = xkcdResult;
    const imageMetaData = await ImageTools.parseImage(data);

    return {
      ...imageMetaData,
      comment,
      index,
      title,
    };
  }

  async getLatestComic(): Promise<ComicResult> {
    const xkcdResult = await this.XKCD.getLatest({withData: true});
    this.logger.info(`Got latest comic with data:`, xkcdResult);

    const {alt: comment, data, num: index, title} = xkcdResult;
    const imageMetaData = await ImageTools.parseImage(data);

    return {
      ...imageMetaData,
      comment,
      index,
      title,
    };
  }

  async getComic(index: number): Promise<ComicResult> {
    const xkcdResult = await this.XKCD.getByIndex(index, {withData: true});
    this.logger.info(`Got comic by ID ${index} with data:`, xkcdResult);

    const {alt: comment, data, title} = xkcdResult;
    const imageMetaData = await ImageTools.parseImage(data);

    return {
      ...imageMetaData,
      comment,
      index,
      title,
    };
  }
}

export {XKCDService};
