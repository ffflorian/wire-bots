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
  HELP,
  NO_COMMAND,
  REPORT,
  UNKNOWN_COMMAND,
}

const logger = logdown('wire-hassmelden-bot/CommandService', {
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
    command: 'hassmelden',
    description: 'Report hate speech',
    parseArguments: false,
    type: CommandType.REPORT,
  },
];

const CommandService = {
  formatCommands(): string {
    return basicCommands
      .sort((a, b) => a.command.localeCompare(b.command))
      .reduce((prev, command) => {
        const {argumentName, command: commandName, description, parseArguments} = command;
        return `${prev}\n- **/${commandName}${
          parseArguments && argumentName ? ` <${argumentName}>` : ''
        }**: ${description}`;
      }, '');
  },
  parseCommand(message: string): ParsedCommand {
    const messageMatch = message.match(/^\/(\w+)(?: (.*))?/);

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
    logger.info(`No command found for "${message.length > 10 ? `${message.substr(0, 10)}...` : message}".`);
    return {
      commandType: CommandType.NO_COMMAND,
      parsedArguments: message,
      rawCommand: message,
    };
  },
};

export {CommandService, CommandType};
