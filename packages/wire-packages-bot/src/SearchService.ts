import {LibrariesIO, Project} from 'libraries.io';

const moreResults = (totalResults = 1, page: number, resultsPerPage: number) =>
  Math.max(Math.ceil(totalResults - page * resultsPerPage), 0);

interface SearchResult {
  moreResults: number;
  resultsPerPage: number;
  result: string;
}

class SearchService {
  private librariesIO: LibrariesIO;
  private readonly resultsPerPage: number;
  constructor(LIBRARIES_API_KEY: string) {
    this.resultsPerPage = 10;
    this.librariesIO = new LibrariesIO(LIBRARIES_API_KEY);
  }

  private static formatData(projects: Project[]): string {
    return projects.reduce((prev, project) => {
      const {description, homepage, name, language, stars} = project;
      const localeStarsCount = Number(stars.toLocaleString());
      const hasStars =
        localeStarsCount && localeStarsCount > 0
          ? `, ${localeStarsCount} star${localeStarsCount === 1 ? '' : 's'}`
          : '';
      const hasBrackets = language && hasStars ? ` (${language}${hasStars})` : '';
      const hasHomepage = homepage ? ` (${homepage})` : '';
      return prev + `\n- **${name}**${hasBrackets}: ${description || ''}${hasHomepage}`;
    }, '');
  }

  async searchBower(query: string, page: number): Promise<SearchResult> {
    const {data, totalResults} = await this.librariesIO.api.project.search(query, {
      page,
      perPage: this.resultsPerPage,
      filter: {
        platforms: ['bower'],
      },
    });

    return {
      moreResults: moreResults(totalResults, page, this.resultsPerPage),
      result: SearchService.formatData(data),
      resultsPerPage: this.resultsPerPage,
    };
  }

  async searchNpm(query: string, page: number): Promise<SearchResult> {
    const {data, totalResults} = await this.librariesIO.api.project.search(query, {
      page,
      perPage: this.resultsPerPage,
      filter: {
        platforms: ['npm'],
      },
    });

    return {
      moreResults: moreResults(totalResults, page, this.resultsPerPage),
      result: SearchService.formatData(data),
      resultsPerPage: this.resultsPerPage,
    };
  }

  async searchCrates(query: string, page: number): Promise<SearchResult> {
    const {data, totalResults} = await this.librariesIO.api.project.search(query, {
      page,
      perPage: this.resultsPerPage,
      filter: {
        platforms: ['cargo'],
      },
    });

    return {
      moreResults: moreResults(totalResults, page, this.resultsPerPage),
      result: SearchService.formatData(data),
      resultsPerPage: this.resultsPerPage,
    };
  }

  async searchTypes(query: string): Promise<string> {
    return '';
  }
}

export {SearchService};
