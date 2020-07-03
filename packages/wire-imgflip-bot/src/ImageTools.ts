import {ImageContent} from '@wireapp/core/dist/conversation/content/';
import * as logdown from 'logdown';
import * as JPEGReader from 'jpeg-js';

const logger = logdown('wire-imgflip-bot/ImageTools', {
  logger: console,
  markdown: false,
});

export function parseImage(buffer: Buffer): ImageContent {
  let width = 0;
  let height = 0;

  try {
    const rawImageData = JPEGReader.decode(buffer);
    height = rawImageData.height;
    width = rawImageData.width;
    logger.info(`Decoded image as JPEG with size ${width}x${height}.`);
  } catch (error) {
    logger.error('Failed to decode image as JPEG.', error);
  }

  return {
    data: buffer,
    height,
    type: 'image/jpeg',
    width,
  };
}
