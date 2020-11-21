import got from 'got';
import {
    TerasliceStatsInterface,
    GetTerasliceApiResponse,
    TerasliceClusterState,
    TerasliceQueryDuration
} from './interfaces';
import { pDelay } from './util';

export default class TerasliceStats implements TerasliceStatsInterface {
    baseUrl: URL;

    displayUrl: string;

    controllers: any[];

    executions: any[];

    info: any;

    jobs: any[];

    state: TerasliceClusterState;

    queryDuration: TerasliceQueryDuration;

    constructor(baseUrl:string, displayUrl:string) {
        this.baseUrl = new URL(baseUrl);
        this.displayUrl = displayUrl;
        this.controllers = [];
        this.executions = [];
        this.jobs = [];
        this.state = {};

        this.queryDuration = {
            controllers: 0,
            executions: 0,
            info: 0,
            jobs: 0,
            state: 0,
        };
    }

    async getTerasliceApi(path:string):Promise<GetTerasliceApiResponse> {
        const url = new URL(path, this.baseUrl);
        let r:GetTerasliceApiResponse;
        let response: {
            body: any,
            statusCode: number,
            timings: any
        };

        try {
            response = await got(url, { responseType: 'json' });
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

    async updateExecutions():Promise<void> {
        const time = process.hrtime();
        this.executions = [];
        const maxConcurrency = 10;
        const queryDelay = 25;

        for (let i = 0; i < this.controllers.length; i += maxConcurrency) {
            const controllersSlice = this.controllers.slice(i, i + maxConcurrency);

            const r = await Promise.all(
                controllersSlice.map((x) => this.getTerasliceApi(`/v1/ex/${x.ex_id}`)),
            );

            // eslint-disable-next-line prefer-spread
            this.executions.push.apply(this.executions, r.map((x) => x.data));

            await pDelay(queryDelay);
        }

        const NS_PER_SEC = 1e9;
        const diff = process.hrtime(time);
        this.queryDuration.executions = Math.round((diff[0] * NS_PER_SEC + diff[1]) / 1e6);
    }

    // I think I've been doing this sort of thing wrong in the past.
    // https://stackoverflow.com/questions/45285129/any-difference-between-await-promise-all-and-multiple-await
    async update():Promise<void> {
    // TODO: hard coding querySize is dumb
        const querySize = 200;
        const run = async () => {
            const [info, jobs, controllers, state] = await Promise.all([
                this.getTerasliceApi('/'),
                this.getTerasliceApi(`/v1/jobs?size=${querySize}`),
                this.getTerasliceApi('/v1/cluster/controllers'),
                this.getTerasliceApi('/v1/cluster/state'),
            ]);
            this.info = info.data;
            this.jobs = jobs.data;
            this.controllers = controllers.data;
            this.state = state.data;
            await this.updateExecutions();

            this.queryDuration.info = info.queryDuration;
            this.queryDuration.jobs = jobs.queryDuration;
            this.queryDuration.controllers = controllers.queryDuration;
            this.queryDuration.state = state.queryDuration;
        };
        await run();
    }
}
