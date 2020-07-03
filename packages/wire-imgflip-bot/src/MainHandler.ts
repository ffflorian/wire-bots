import * as logdown from 'logdown';

import {Connection, ConnectionStatus} from '@wireapp/api-client/dist/connection';
import {MessageHandler} from '@wireapp/bot-api';
import {PayloadBundle, PayloadBundleType, ReactionType} from '@wireapp/core/dist/conversation/';
import {TextContent} from '@wireapp/core/dist/conversation/content/';
import {QuotableMessage} from '@wireapp/core/dist/conversation/message/OtrMessage';

import {CommandService, CommandType, ParsedCommand} from './CommandService';
import {formatUptime} from './utils';
import {ImgflipService} from './ImgflipService';
import * as ImageTools from './ImageTools';

const {version}: {version: string} = require('../package.json');

interface Config {
  feedbackConversationId?: string;
  imgflipUsername: string;
  imgflipPassword: string;
}

export class MainHandler extends MessageHandler {
  private readonly answerCache: {
    [conversationId: string]: {
      type: CommandType;
      waitingForContent: boolean;
    };
  };
  private readonly feedbackConversationId?: string;
  private readonly helpText =
    `**Hello!** 😎 This is Imgflip bot v${version} speaking.\n\nAvailable commands:\n${CommandService.formatCommands()}\n\n` +
    `More information about this bot: https://github.com/ffflorian/wire-bots/tree/master/packages/wire-imgflip-bot.\n\n` +
    `Please also visit https://imgflip.com.`;
  private readonly logger: logdown.Logger;
  private readonly imgflipService: ImgflipService;
  private readonly imgflipCredentials: {username: string; password: string};

  constructor(config: Config) {
    super();
    this.feedbackConversationId = config.feedbackConversationId;
    this.imgflipCredentials = {username: config.imgflipUsername, password: config.imgflipPassword};
    this.answerCache = {};
    this.logger = logdown('wire-imgflip-bot/MainHandler', {
      logger: console,
      markdown: false,
    });
    this.imgflipService = new ImgflipService();

    if (!this.feedbackConversationId) {
      this.logger.warn('You did not specify a feedback conversation ID and will not be able to receive feedback.');
    }
  }

  async answer(
    originalMessage: QuotableMessage,
    conversationId: string,
    parsedCommand: ParsedCommand,
    senderId: string
  ): Promise<void> {
    const {parsedArguments, rawCommand, commandType} = parsedCommand;
    switch (commandType) {
      case CommandType.HELP: {
        return this.sendReply(conversationId, originalMessage, this.helpText);
      }
      case CommandType.UPTIME: {
        return this.sendReply(conversationId, originalMessage, `Current uptime: ${formatUptime(process.uptime())}`);
      }
      case CommandType.CAPTION: {
        if (!parsedArguments) {
          this.answerCache[conversationId] = {
            type: commandType,
            waitingForContent: true,
          };

          return this.sendReply(conversationId, originalMessage, 'Please enter the template id, text 1 and text 2 separated by a space.');
        }

        let imgflipResult;

        try {
          const options = {
            template_id: parsedArguments[0] || '',
            text0: parsedArguments[1] || '',
            text1: parsedArguments[2] || '',
            ...this.imgflipCredentials,
          }

          imgflipResult = await this.imgflipService.captionImageWithText(options);
        } catch (error) {
          this.logger.error(error);
          return this.sendReply(conversationId, originalMessage, 'Sorry, an error occured. Please try again later.');
        }

        this.logger.info(`Sending created meme to "${senderId}".`);

        await this.sendImage(conversationId, imgflipResult);
        delete this.answerCache[conversationId];
        return;
      }
      case CommandType.MEMES: {
        const memeCount = parseInt(parsedArguments?.[0] || '', 10);

        if (!parsedArguments || isNaN(memeCount) || memeCount < 1) {
          this.answerCache[conversationId] = {
            type: commandType,
            waitingForContent: true,
          };
          return this.sendReply(conversationId, originalMessage, 'How many memes would you like to see?');
        }

        let imgflipResult;

        try {
          imgflipResult = await this.imgflipService.getMemes();
        } catch (error) {
          this.logger.error(error);
          return this.sendReply(conversationId, originalMessage, 'Sorry, an error occured. Please try again later.');
        }

        await this.sendText(conversationId, `Here are the top ${parsedArguments} memes:`);

        for (let index = 0; index < memeCount; index++) {
          this.logger.info(`Sending memes to "${senderId}".`);
          const {url, id, box_count, name} = imgflipResult[index];
          const imageData = await this.imgflipService.downloadImage(url);
          const parsedImage = ImageTools.parseImage(imageData);

          await this.sendText(conversationId, `"${name}": ${box_count} boxes, ID: \`${id}\``);
          await this.sendImage(conversationId, parsedImage);
        }

        delete this.answerCache[conversationId];
        return;
      }
      case CommandType.FEEDBACK: {
        if (!this.feedbackConversationId) {
          return this.sendReply(
            conversationId,
            originalMessage,
            `Sorry, the developer did not specify a feedback channel.`
          );
        }

        if (!parsedArguments) {
          this.answerCache[conversationId] = {
            type: commandType,
            waitingForContent: true,
          };
          return this.sendReply(conversationId, originalMessage, 'What would you like to tell the developer?');
        }

        this.logger.info(`Sending feedback from "${senderId}" to "${this.feedbackConversationId}".`);

        await this.sendText(this.feedbackConversationId, `Feedback from user "${senderId}":\n"${parsedArguments}"`);
        delete this.answerCache[conversationId];
        return this.sendReply(conversationId, originalMessage, 'Thank you for your feedback.');
      }
      case CommandType.UNKNOWN_COMMAND: {
        return this.sendReply(conversationId, originalMessage, `Sorry, I don't know the command "${rawCommand}" yet.`);
      }
      case CommandType.NO_COMMAND: {
        return;
      }
      default: {
        return this.sendReply(conversationId, originalMessage, `Sorry, "${rawCommand}" is not implemented yet.`);
      }
    }
  }

  async handleConnectionRequest(userId: string, conversationId: string): Promise<void> {
    await this.sendConnectionResponse(userId, true);
    await this.sendText(conversationId, this.helpText);
  }

  async handleEvent(payload: PayloadBundle): Promise<void> {
    switch (payload.type) {
      case PayloadBundleType.TEXT: {
        if (payload.conversation) {
          const messageContent = payload.content as TextContent;
          return this.handleText(
            payload as QuotableMessage,
            payload.conversation,
            messageContent.text,
            payload.id,
            payload.from
          );
        }
      }
      case PayloadBundleType.CONNECTION_REQUEST: {
        const connectRequest = payload.content as Connection;
        if (payload.conversation && connectRequest.status !== ConnectionStatus.CANCELLED) {
          return this.handleConnectionRequest(connectRequest.to, payload.conversation);
        }
      }
    }
  }

  async handleText(
    payload: QuotableMessage,
    conversationId: string,
    text: string,
    messageId: string,
    senderId: string
  ): Promise<void> {
    const {commandType, parsedArguments, rawCommand} = CommandService.parseCommand(text);

    switch (commandType) {
      case CommandType.NO_COMMAND:
      case CommandType.UNKNOWN_COMMAND: {
        if (this.answerCache[conversationId]) {
          const {type: cachedCommandType, waitingForContent} = this.answerCache[conversationId];
          if (waitingForContent) {
            await this.sendReaction(conversationId, messageId, ReactionType.LIKE);
            delete this.answerCache[conversationId];
            return this.answer(
              payload,
              conversationId,
              {commandType: cachedCommandType, parsedArguments, rawCommand},
              senderId
            );
          }
        }
        return this.answer(payload, conversationId, {commandType, parsedArguments, rawCommand}, senderId);
      }
      default: {
        await this.sendReaction(conversationId, messageId, ReactionType.LIKE);
        if (this.answerCache[conversationId]) {
          delete this.answerCache[conversationId];
        }
        return this.answer(payload, conversationId, {commandType, parsedArguments, rawCommand}, senderId);
      }
    }
  }
}
