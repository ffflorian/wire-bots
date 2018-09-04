import * as logdown from 'logdown';

import {MessageHandler} from '@wireapp/bot-api';
import {PayloadBundleIncoming, PayloadBundleType, ReactionType} from '@wireapp/core/dist/conversation/root';
import {TextContent} from '@wireapp/core/dist/conversation/content/';
import {Connection, ConnectionStatus} from '@wireapp/api-client/dist/commonjs/connection';
import {CommandService, CommandType, ParsedCommand} from './CommandService';
import {formatUptime} from './utils';
import {SearchService} from './SearchService';

const {version}: {version: string} = require('../package.json');

interface Config {
  feedbackConversationId?: string;
  librariesIOApiKey: string;
}

class MainHandler extends MessageHandler {
  private readonly logger: logdown.Logger;
  private searchService: SearchService;
  private readonly feedbackConversationId?: string;
  private readonly helpText = `**Hello!** 😎 This is packages bot v${version} speaking.\nHere you can search for all the packages on Bower, npm, TypeSearch and crates.io. 📦\n\nAvailable commands:\n${CommandService.formatCommands()}\n\nMore information about this bot: https://github.com/ffflorian/wire-bots/tree/master/packages/wire-packages-bot`;
  private answerCache: {
    [conversationId: string]: {
      parsedArguments?: string;
      page: number;
      type: CommandType;
      waitingForContent: boolean;
    };
  };

  constructor({feedbackConversationId, librariesIOApiKey}: Config) {
    super();
    this.feedbackConversationId = feedbackConversationId;
    this.searchService = new SearchService(librariesIOApiKey);
    this.answerCache = {};
    this.logger = logdown('wire-packages-bot/MainHandler', {
      logger: console,
      markdown: false,
    });

    if (!this.feedbackConversationId) {
      this.logger.warn('You did not specify a feedback conversation ID and will not be able to receive feedback.');
    }
  }

  async handleEvent(payload: PayloadBundleIncoming) {
    switch (payload.type) {
      case PayloadBundleType.TEXT: {
        if (payload.conversation) {
          const messageContent = payload.content as TextContent;
          return this.handleText(payload.conversation, messageContent.text, payload.id, payload.from);
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

  private static morePagesText(moreResults: number, resultsPerPage: number): string {
    const isOne = moreResults === 1;
    return `\n\nThere ${isOne ? 'is' : 'are'} ${moreResults} more result${
      isOne ? '' : 's'
    }. Would you like to see ${resultsPerPage > moreResults ? moreResults : resultsPerPage} more? Answer with "yes" or "no".`;
  }

  async handleText(conversationId: string, text: string, messageId: string, senderId: string): Promise<void> {
    const {commandType, parsedArguments, rawCommand} = CommandService.parseCommand(text);

    switch (commandType) {
      case CommandType.ANSWER_NO: {
        if (this.answerCache[conversationId]) {
          await this.sendReaction(conversationId, messageId, ReactionType.LIKE);
          delete this.answerCache[conversationId];
          return this.sendText(conversationId, 'Okay.');
        }
        break;
      }
      case CommandType.ANSWER_YES: {
        if (this.answerCache[conversationId]) {
          const {parsedArguments: cachedContent, type: cachedCommandType, page} = this.answerCache[conversationId];
          await this.sendReaction(conversationId, messageId, ReactionType.LIKE);
          return this.answer(
            conversationId,
            {parsedArguments: cachedContent, commandType: cachedCommandType, rawCommand},
            senderId,
            page + 1
          );
        }
        break;
      }
      case CommandType.NO_COMMAND:
      case CommandType.UNKNOWN_COMMAND: {
        if (this.answerCache[conversationId]) {
          const {type: cachedCommandType, waitingForContent} = this.answerCache[conversationId];
          if (waitingForContent) {
            await this.sendReaction(conversationId, messageId, ReactionType.LIKE);
            delete this.answerCache[conversationId];
            return this.answer(conversationId, {parsedArguments, commandType: cachedCommandType, rawCommand}, senderId);
          }
        }
        return;
      }
      default: {
        await this.sendReaction(conversationId, messageId, ReactionType.LIKE);
        if (this.answerCache[conversationId]) {
          delete this.answerCache[conversationId];
        }
        break;
      }
    }

    return this.answer(conversationId, {commandType, parsedArguments, rawCommand}, senderId);
  }

  async answer(conversationId: string, parsedCommand: ParsedCommand, senderId: string, page = 1) {
    const {parsedArguments, rawCommand, commandType} = parsedCommand;
    switch (commandType) {
      case CommandType.HELP: {
        return this.sendText(conversationId, this.helpText);
      }
      case CommandType.SERVICES: {
        return this.sendText(
          conversationId,
          'Available services:\n- **/bower**\n- **/npm**\n- **/crates**\n- **/types**'
        );
      }
      case CommandType.UPTIME: {
        return this.sendText(conversationId, `Current uptime: ${formatUptime(process.uptime())}`);
      }
      case CommandType.BOWER: {
        if (!parsedArguments) {
          this.answerCache[conversationId] = {
            page,
            type: CommandType.BOWER,
            waitingForContent: true,
          };
          return this.sendText(conversationId, 'What would you like to search on Bower?');
        }

        await this.sendText(conversationId, `Searching for "${parsedArguments}" on Bower ...`);

        let searchResult;

        try {
          searchResult = await this.searchService.searchBower(parsedArguments, page);
        } catch (error) {
          this.logger.error(error);
          return this.sendText(conversationId, 'Sorry, an error occured. Please try again later.');
        }

        let {result, moreResults, resultsPerPage} = searchResult;

        if (moreResults > 0) {
          result += MainHandler.morePagesText(moreResults, resultsPerPage);
          this.answerCache[conversationId] = {
            parsedArguments,
            page,
            type: CommandType.BOWER,
            waitingForContent: false,
          };
        } else {
          delete this.answerCache[conversationId];
        }
        return this.sendText(conversationId, result);
      }
      case CommandType.NPM: {
        if (!parsedArguments) {
          this.answerCache[conversationId] = {
            page,
            type: CommandType.NPM,
            waitingForContent: true,
          };
          return this.sendText(conversationId, 'What would you like to search on npm?');
        }

        await this.sendText(conversationId, `Searching for "${parsedArguments}" on npm ...`);

        let searchResult;

        try {
          searchResult = await this.searchService.searchNpm(parsedArguments, page);
        } catch (error) {
          this.logger.error(error);
          return this.sendText(conversationId, 'Sorry, an error occured. Please try again later.');
        }

        let {result, moreResults, resultsPerPage} = searchResult;

        if (moreResults > 0) {
          result += MainHandler.morePagesText(moreResults, resultsPerPage);
          this.answerCache[conversationId] = {
            parsedArguments,
            page,
            type: CommandType.NPM,
            waitingForContent: false,
          };
        } else {
          delete this.answerCache[conversationId];
        }
        return this.sendText(conversationId, result);
      }
      case CommandType.CRATES: {
        if (!parsedArguments) {
          this.answerCache[conversationId] = {
            page,
            type: CommandType.CRATES,
            waitingForContent: true,
          };
          return this.sendText(conversationId, 'What would you like to search on crates.io?');
        }

        await this.sendText(conversationId, `Searching for "${parsedArguments}" on crates.io ...`);

        let searchResult;

        try {
          searchResult = await this.searchService.searchCrates(parsedArguments, page);
        } catch (error) {
          this.logger.error(error);
          return this.sendText(conversationId, 'Sorry, an error occured. Please try again later.');
        }

        let {result, moreResults, resultsPerPage} = searchResult;

        if (moreResults > 0) {
          result += MainHandler.morePagesText(moreResults, resultsPerPage);
          this.answerCache[conversationId] = {
            parsedArguments,
            page,
            type: CommandType.CRATES,
            waitingForContent: false,
          };
        } else {
          delete this.answerCache[conversationId];
        }
        return this.sendText(conversationId, result);
      }
      case CommandType.TYPES: {
        return this.sendText(conversationId, `Sorry, not implemented yet.`);
      }
      case CommandType.FEEDBACK: {
        if (!this.feedbackConversationId) {
          return this.sendText(conversationId, `Sorry, the developer did not specify a feedback channel.`);
        }

        if (!parsedArguments) {
          this.answerCache[conversationId] = {
            page,
            type: CommandType.FEEDBACK,
            waitingForContent: true,
          };
          return this.sendText(conversationId, 'What would you like to tell the developer?');
        }

        await this.sendText(this.feedbackConversationId, `Feedback from user "${senderId}":\n"${parsedArguments}"`);
        delete this.answerCache[conversationId];
        return this.sendText(conversationId, 'Thank you for your feedback.');
      }
      case CommandType.UNKNOWN_COMMAND: {
        return this.sendText(conversationId, `Sorry, I don't know the command "${rawCommand}" yet.`);
      }
    }
  }

  async handleConnectionRequest(userId: string, conversationId: string): Promise<void> {
    await this.sendConnectionResponse(userId, true);
    await this.sendText(conversationId, this.helpText);
  }
}

export {MainHandler};
