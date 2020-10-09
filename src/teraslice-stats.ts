import got from 'got';

// TODO: Get logging in here somehow
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

interface TerasliceQueryDuration {
  info: number,
  jobs: number,
  controllers: number
}

interface TerasliceStatsInterface {
    baseUrl: URL,
    info: TerasliceInfo,
    jobs: any[],
    controllers: any[]
    queryDuration: TerasliceQueryDuration
}

export default class TerasliceStats implements TerasliceStatsInterface {
  baseUrl: URL;

  info: any;

  jobs: any[];

  controllers: any[];

  queryDuration: TerasliceQueryDuration;

  constructor(baseUrl:string) {
    this.baseUrl = new URL(baseUrl);
    this.jobs = [];
    this.controllers = [];
    // FIXME: should I use something other than 0 here?
    this.queryDuration = { info: 0, jobs: 0, controllers: 0 };
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

  // I think I've been doing this sort of thing wrong in the past.
  // https://stackoverflow.com/questions/45285129/any-difference-between-await-promise-all-and-multiple-await
  async update() {
    // eslint-disable-next-line no-console
    const querySize = 200;
    // eslint-disable-next-line func-names
    const run = async () => {
      const [info, jobs, controllers] = await Promise.all([
        this.getTerasliceApi('/'),
        this.getTerasliceApi(`/v1/jobs?size=${querySize}`),
        this.getTerasliceApi('/v1/cluster/controllers'),
      ]);
      this.info = info.data;
      this.jobs = jobs.data;
      this.controllers = controllers.data;
      this.queryDuration = {
        info: info.queryDuration,
        jobs: jobs.queryDuration,
        controllers: controllers.queryDuration,
      };
    };
    await run().catch((err) => {
      // eslint-disable-next-line no-console
      console.log(err);
      // logger.error('Error updating Teraslice Info', err);
    });
  }
}

// async function main() {
//   const terasliceStats = new TerasliceStats('http://ts-prod3.tera1.lan');
//   await terasliceStats.update();

//   console.log(`info: ${JSON.stringify(terasliceStats.info, null, 2)}`);
//   console.log(`jobs: ${JSON.stringify(terasliceStats.jobs[0], null, 2)}`);
//   console.log(`controllers: ${JSON.stringify(terasliceStats.controllers[0], null, 2)}`);
// }

// main();
