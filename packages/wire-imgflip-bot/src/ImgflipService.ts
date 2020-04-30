import {ImageContent} from '@wireapp/core/dist/conversation/content/';
import {Imgflip, Meme as ImgflipMeme, ImageCaptionWithTexts} from 'imgflip.com';
import axios from 'axios';
import * as logdown from 'logdown';

import * as ImageTools from './ImageTools';

export class ImgflipService {
  private readonly logger: logdown.Logger;
  private readonly Imgflip: Imgflip;

  constructor() {
    this.Imgflip = new Imgflip();
    this.logger = logdown('wire-imgflip-bot/ImgflipService', {
      logger: console,
      markdown: false,
    });
  }

  async getMemes(): Promise<ImgflipMeme[]> {
    const imgflipResult = await this.Imgflip.api.getMemes();
    if (imgflipResult.success) {
      this.logger.info(`Got ${imgflipResult.data.memes.length} memes from Imgflip.`);
      return imgflipResult.data.memes;
    }

    throw new Error(imgflipResult.error_message);
  }

  async downloadImage(url: string): Promise<Buffer> {
    const {data} = await axios.get<Buffer>(url, {responseType: 'arraybuffer'});
    return data;
  }

  async captionImageWithText(options: ImageCaptionWithTexts): Promise<ImageContent> {
    const imgflipResult = await this.Imgflip.api.captionImage(options);

    if (imgflipResult.success) {
      this.logger.info(`Created Imgflip meme:`, imgflipResult.data);
      const image = await this.downloadImage(imgflipResult.data.url);

      return ImageTools.parseImage(image);
    }

    throw new Error(imgflipResult.error_message);
  }
}
