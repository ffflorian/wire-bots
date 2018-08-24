import * as logdown from 'logdown';

interface BasicCommand {
  argumentName?: string;
  command: string;
  description: string;
  parseArguments: boolean;
  type: CommandType;
}

export interface ParsedCommand {
  commandType: CommandType;
  parsedArguments?: string;
  rawCommand: string;
}

enum CommandType {
  FEEDBACK,
  HELP,
  LATEST,
  NO_COMMAND,
  COMIC,
  RANDOM,
  UNKNOWN_COMMAND,
  UPTIME,
}

const logger = logdown('wire-xkcd-bot/CommandService', {
  logger: console,
  markdown: false,
});

const basicCommands: BasicCommand[] = [
  {
    command: 'help',
    description: 'Display this message.',
    parseArguments: false,
    type: CommandType.HELP,
  },
  {
    command: 'latest',
    description: 'Get the latest comic.',
    parseArguments: false,
    type: CommandType.LATEST,
  },
  {
    argumentName: 'number',
    command: 'comic',
    description: 'Get a comic.',
    parseArguments: true,
    type: CommandType.COMIC,
  },
  {
    command: 'uptime',
    description: 'Get the current uptime of this bot.',
    parseArguments: false,
    type: CommandType.UPTIME,
  },
  {
    command: 'random',
    description: 'Get a random comic.',
    parseArguments: false,
    type: CommandType.RANDOM,
  },
  {
    argumentName: 'text',
    command: 'feedback',
    description: 'Send feedback to the developer.',
    parseArguments: true,
    type: CommandType.FEEDBACK,
  },
];

const CommandService = {
  formatCommands(): string {
    return basicCommands.sort((a, b) => a.command.localeCompare(b.command)).reduce((prev, command) => {
      const {argumentName, command: commandName, description, parseArguments} = command;
      return (
        prev + `\n- **/${commandName}${parseArguments && argumentName ? ` <${argumentName}>` : ''}**: ${description}`
      );
    }, '');
  },
  parseCommand(message: string): ParsedCommand {
    const messageMatch = message.match(/\/(\w+)(?: (.*))?/);

    if (messageMatch && messageMatch.length) {
      const parsedCommand = messageMatch[1].toLowerCase();
      const parsedArguments = messageMatch[2];

      for (const command of basicCommands) {
        if (command.command === parsedCommand) {
          logger.info(`Found command "${command.command}" for "/${parsedCommand}".`);
          return {
            commandType: command.type,
            parsedArguments: command.parseArguments ? parsedArguments : '',
            rawCommand: parsedCommand,
          };
        }
      }
      logger.info(`Unknown command "${parsedCommand}".`);
      return {
        commandType: CommandType.UNKNOWN_COMMAND,
        rawCommand: parsedCommand,
      };
    }
    logger.info(`No command found for "${message.length > 10 ? message.substr(0, 10) + '...' : message}".`);
    return {
      parsedArguments: message,
      rawCommand: message,
      commandType: CommandType.NO_COMMAND,
    };
  },
};

export {CommandService, CommandType};
