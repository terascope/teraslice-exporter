/* eslint-disable camelcase */
import got from 'got';

// TODO: move these interfaces out into their own file
/**
 * TerasliceWorker - The individual teraslice worker object in the
 * TerasliceWorkerNode.active array.  This corresponds to a k8s pod in k8s mode.
 *
 * Example:
 *  {
 *      "assets": [],
 *      "assignment": "worker",
 *      "ex_id": "5ba1da6a-0ba2-49f4-92c3-d436ba510111",
 *      "image": "teraslice:v0.70.0",
 *      "job_id": "7e6dfa3c-6665-455d-9d52-f11bd32ad111",
 *      "pod_name": "ts-wkr-my-job-name-1d940e75-58d9-74c54e7dc1-nxaaa",
 *      "pod_ip": "10.132.86.111",
 *      "worker_id": "ts-wkr-my-job-name-1d940e75-58d9-74c54e7dc1-nxaaa"
 *  }
 */
interface TerasliceWorker {
    assets: string[],
    assignment: string,
    ex_id: string,
    image: string,
    job_id: string,
    pod_name: string,
    pod_ip: string,
    worker_id: string
}

/**
 * {
 *  "node_id": "10.123.4.111",
 *  "hostname": "10.123.4.111",
 *  "pid": "N/A",
 *  "node_version": "N/A",
 *  "teraslice_version": "N/A",
 *  "total": "N/A",
 *  "state": "connected",
 *  "available": "N/A",
 *  "active": [...]
 * }
 */
interface TerasliceWorkerNodeInfo {
    node_id: string,
    hostname: string,
    pid: string,
    node_version: string,
    teraslice_version: string,
    total: string,
    state: string,
    available: string,
    active: TerasliceWorker[]
}

/**
 * "10.123.4.111": {
 *      "node_id": "10.123.4.111",
 *      "hostname": "10.123.4.111",
 *      "pid": "N/A",
 *      "node_version": "N/A",
 *      "teraslice_version": "N/A",
 *      "total": "N/A",
 *      "state": "connected",
 *      "available": "N/A",
 *      "active": [...]
 * }
 */
// interface TerasliceWorkerNode {
//   [key: string]: TerasliceWorkerNodeInfo
// }

interface TerasliceClusterState {
    [key: string]: TerasliceWorkerNodeInfo
}

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
    state: number,
}

interface TerasliceStatsInterface {
    baseUrl: URL,
    controllers: any[],
    executions: any[],
    info: TerasliceInfo,
    jobs: any[],
    state: TerasliceClusterState,
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

    state: TerasliceClusterState;

    queryDuration: TerasliceQueryDuration;

    constructor(baseUrl:string) {
        this.baseUrl = new URL(baseUrl);
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
        const queryDelay = 25;

        for (let i = 0; i < this.controllers.length; i += maxConcurrency) {
            const controllersSlice = this.controllers.slice(i, i + maxConcurrency);

            // eslint-disable-next-line no-await-in-loop
            const r = await Promise.all(
                controllersSlice.map((x) => this.getTerasliceApi(`/v1/ex/${x.ex_id}`)),
            );

            // eslint-disable-next-line prefer-spread
            this.executions.push.apply(this.executions, r.map((x) => x.data));

            // eslint-disable-next-line no-await-in-loop
            await pDelay(queryDelay);
        }

        const NS_PER_SEC = 1e9;
        const diff = process.hrtime(time);
        this.queryDuration.executions = Math.round((diff[0] * NS_PER_SEC + diff[1]) / 1e6);
    }

    // I think I've been doing this sort of thing wrong in the past.
    // https://stackoverflow.com/questions/45285129/any-difference-between-await-promise-all-and-multiple-await
    async update() {
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
        await run().catch((err) => {
            throw new Error(`Error caught on run() ${this.baseUrl}: ${err}`);
        });
    }
}
