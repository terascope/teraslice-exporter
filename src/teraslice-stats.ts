import got from 'got';

// TODO: move these interfaces out into their own file

interface TerasliceInfo {
  arch: string,
  // eslint-disable-next-line camelcase
  clustering_type: string,
  name: string,
  // eslint-disable-next-line camelcase
  node_version: string,
  platform: string,
  // eslint-disable-next-line camelcase
  teraslice_version: string
}

/**
 * These are all in ms
 */
interface TerasliceQueryDuration {
  controllers: number,
  executions: number,
  info: number,
  jobs: number,
}

interface TerasliceStatsInterface {
    baseUrl: URL,
    controllers: any[],
    executions: any[],
    info: TerasliceInfo,
    jobs: any[],
    queryDuration: TerasliceQueryDuration
}

/** promisified setTimeout */
export function pDelay<T = undefined>(delay = 1, arg?: T): Promise<T> {
  return new Promise<T>((resolve) => {
    setTimeout(resolve, delay, arg);
  });
}

export default class TerasliceStats implements TerasliceStatsInterface {
  baseUrl: URL;

  controllers: any[];

  executions: any[];

  info: any;

  jobs: any[];

  queryDuration: TerasliceQueryDuration;

  constructor(baseUrl:string) {
    this.baseUrl = new URL(baseUrl);
    this.controllers = [];
    this.executions = [];
    this.jobs = [];
    // FIXME: should I use something other than 0 here?
    this.queryDuration = {
      controllers: 0,
      executions: 0,
      info: 0,
      jobs: 0,
    };
  }

  async getTerasliceApi(path:string) {
    const url = new URL(path, this.baseUrl);
    let r: {
        data: any,
        queryDuration: number
        };
    let response : {
        body: any,
        statusCode: number,
        timings: any
      };

    try {
      // FIXME: the .toString is to eliminate a 'No overload matches this call'
      response = await got(url.toString(), { responseType: 'json' });
      if (response && response.statusCode === 200 && response.body) {
        r = {
          data: response.body,
          queryDuration: response.timings.phases.total,
        };
      } else {
        throw new Error(`Error getting ${url}: ${response.statusCode}`);
      }
    } catch (error) {
      throw new Error(`Error getting ${url}: ${error}`);
    }
    return r;
  }

  async updateExecutions() {
    const time = process.hrtime();
    this.executions = [];
    const maxConcurrency = 10;

    for (let i = 0; i < this.controllers.length; i += maxConcurrency) {
      const controllersSlice = this.controllers.slice(i, i + maxConcurrency);

      // eslint-disable-next-line no-await-in-loop
      const r = await Promise.all(
        controllersSlice.map((x) => this.getTerasliceApi(`/v1/ex/${x.ex_id}`)),
      );

      // eslint-disable-next-line prefer-spread
      this.executions.push.apply(this.executions, r.map((x) => x.data));

      // eslint-disable-next-line no-await-in-loop
      await pDelay(25);
    }

    const NS_PER_SEC = 1e9;
    const diff = process.hrtime(time);
    this.queryDuration.executions = Math.round((diff[0] * NS_PER_SEC + diff[1]) / 1e6);
  }

  // FIXME: I don't think /jobs is even relevant here ... what I should really
  // do is get the ex_ids from the controllers, and then go get the ex for each
  // one of those.  Jobs are mostly irrelevant in this context.

  // I think I've been doing this sort of thing wrong in the past.
  // https://stackoverflow.com/questions/45285129/any-difference-between-await-promise-all-and-multiple-await
  async update() {
    // TODO: hard coding querySize is dumb
    const querySize = 200;
    const run = async () => {
      const [info, jobs, controllers] = await Promise.all([
        this.getTerasliceApi('/'),
        this.getTerasliceApi(`/v1/jobs?size=${querySize}`),
        this.getTerasliceApi('/v1/cluster/controllers'),
      ]);
      this.info = info.data;
      this.jobs = jobs.data;
      this.controllers = controllers.data;
      await this.updateExecutions();

      this.queryDuration.info = info.queryDuration;
      this.queryDuration.jobs = jobs.queryDuration;
      this.queryDuration.controllers = controllers.queryDuration;
    };
    await run().catch((err) => {
      throw new Error(`Error caught on run() ${this.baseUrl}: ${err}`);
    });
  }
}
