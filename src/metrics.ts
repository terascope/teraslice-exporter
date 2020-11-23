import { Gauge, Registry } from 'prom-client';
import {
    StateExecutionList
} from './interfaces';
import TerasliceStats from './teraslice-stats';

export const metricsRegistry = new Registry();

const metricPrefix = 'teraslice';
const globalLabelNames = [
    'url',
    'name',
];
const exLabelNames = [
    'ex_id',
    'job_id',
    'job_name',
    ...globalLabelNames,
];

const gaugeWorkersActive = new Gauge({
    name: `${metricPrefix}_controller_workers_active`,
    help: 'Number of Teraslice workers actively processing slices.',
    labelNames: exLabelNames,
    registers: [metricsRegistry],
});

const gaugeWorkersAvailable = new Gauge({
    name: `${metricPrefix}_controller_workers_available`,
    help: 'Number of Teraslice workers running and waiting for work.',
    labelNames: exLabelNames,
    registers: [metricsRegistry],
});

const gaugeWorkersJoined = new Gauge({
    name: `${metricPrefix}_controller_workers_joined`,
    help: 'Total number of Teraslice workers that have joined the execution controller for this job.',
    labelNames: exLabelNames,
    registers: [metricsRegistry],
});

const gaugeWorkersReconnected = new Gauge({
    name: `${metricPrefix}_controller_workers_reconnected`,
    help: 'Total number of Teraslice workers that have reconnected to the execution controller for this job.',
    labelNames: exLabelNames,
    registers: [metricsRegistry],
});

const gaugeWorkersDisconnected = new Gauge({
    name: `${metricPrefix}_controller_workers_disconnected`,
    help: 'Total number of Teraslice workers that have disconnected from execution controller for this job.',
    labelNames: exLabelNames,
    registers: [metricsRegistry],
});

const gaugeTerasliceMasterInfo = new Gauge({
    name: `${metricPrefix}_master_info`,
    help: 'Information about the Teraslice master node.',
    labelNames: [
        'arch',
        'clustering_type',
        'name',
        'node_version',
        'platform',
        'teraslice_version',
        ...globalLabelNames,
    ],
    registers: [metricsRegistry],
});

const gaugeExecutionInfo = new Gauge({
    name: `${metricPrefix}_execution_info`,
    help: 'Information about Teraslice execution.',
    labelNames: [
        'ex_id',
        'job_id',
        'image',
        'version',
        ...globalLabelNames,
    ],
    registers: [metricsRegistry],
});

const gaugeNumSlicers = new Gauge({
    name: `${metricPrefix}_controller_slicers_count`,
    help: 'Number of execution controllers (slicers) running for this execution.',
    labelNames: exLabelNames,
    registers: [metricsRegistry],
});

const gaugeQueryDuration = new Gauge({
    name: `${metricPrefix}_query_duration_seconds`,
    help: 'Total time to complete the named query, in seconds.',
    labelNames: ['query_name', ...globalLabelNames],
    registers: [metricsRegistry],
});

// Execution Related Metrics

const gaugeCpuLimit = new Gauge({
    name: `${metricPrefix}_execution_cpu_limit`,
    help: 'CPU core limit for a Teraslice worker container.',
    labelNames: exLabelNames,
    registers: [metricsRegistry],
});

const gaugeCpuRequest = new Gauge({
    name: `${metricPrefix}_execution_cpu_request`,
    help: 'Requested number of CPU cores for a Teraslice worker container.',
    labelNames: exLabelNames,
    registers: [metricsRegistry],
});

const gaugeMemoryLimit = new Gauge({
    name: `${metricPrefix}_execution_memory_limit`,
    help: 'Memory limit for Teraslice a worker container.',
    labelNames: exLabelNames,
    registers: [metricsRegistry],
});

const gaugeMemoryRequest = new Gauge({
    name: `${metricPrefix}_execution_memory_request`,
    help: 'Requested amount of memory for a Teraslice worker container.',
    labelNames: exLabelNames,
    registers: [metricsRegistry],
});

const gaugeExStatus = new Gauge({
    name: `${metricPrefix}_execution_status`,
    help: 'Current status of the Teraslice execution.',
    labelNames: [...exLabelNames, 'status'],
    registers: [metricsRegistry],
});

// The following gauges should be Counters by my reconing, but as far as
// prom-client is concerned, this usage is fine:
//   https://github.com/siimon/prom-client/issues/192
const gaugeSlicesProcessed = new Gauge({
    name: `${metricPrefix}_controller_slices_processed`,
    help: 'Number of slices processed.',
    labelNames: exLabelNames,
    registers: [metricsRegistry],
});

const gaugeSlicesFailed = new Gauge({
    name: `${metricPrefix}_controller_slices_failed`,
    help: 'Number of slices failed.',
    labelNames: exLabelNames,
    registers: [metricsRegistry],
});

const gaugeSlicesQueued = new Gauge({
    name: `${metricPrefix}_controller_slices_queued`,
    help: 'Number of slices queued for processing.',
    labelNames: exLabelNames,
    registers: [metricsRegistry],
});

// Execution Related Metrics

const gaugeCreatedTime = new Gauge({
    name: `${metricPrefix}_execution_created_timestamp_seconds`,
    help: 'Execution creation time.',
    labelNames: exLabelNames,
    registers: [metricsRegistry],
});

const gaugeUpdatedTime = new Gauge({
    name: `${metricPrefix}_execution_updated_timestamp_seconds`,
    help: 'Execution update time.',
    labelNames: exLabelNames,
    registers: [metricsRegistry],
});

const gaugeExSlicers = new Gauge({
    name: `${metricPrefix}_execution_slicers`,
    help: 'Number of slicers defined on the execution.',
    labelNames: exLabelNames,
    registers: [metricsRegistry],
});

const gaugeExWorkers = new Gauge({
    name: `${metricPrefix}_execution_workers`,
    help: 'Number of workers defined on the execution.  Note that the number of actual workers can differ from this value.',
    labelNames: exLabelNames,
    registers: [metricsRegistry],
});

/**
 * parseController adds the teraslice execution controller metrics to the
 * metricsRegistry for a single execution.
 *
 *    {
 *       "ex_id": "5ba1da6a-0ba2-49f4-92c3-d436ba510111",
 *       "job_id": "7e6dfa3c-6665-455d-9d52-f11bd32ad111",
 *       "name": "my-job-name",
 *       "workers_available": 0,
 *       "workers_active": 6,
 *       "workers_joined": 6,
 *       "workers_reconnected": 0,
 *       "workers_disconnected": 0,
 *       "job_duration": 0,
 *       "failed": 1,
 *       "subslices": 0,
 *       "queued": 7,
 *       "slice_range_expansion": 0,
 *       "processed": 204156,
 *       "slicers": 1,
 *       "subslice_by_key": 0,
 *       "started": "2020-09-17T21:08:58.905Z",
 *       "queuing_complete": ""
 *   }
 *
 * @param controller
 */
function parseController(controller:any, labels:any) {
    const controllerLabels = {
        ex_id: controller.ex_id,
        job_id: controller.job_id,
        job_name: controller.name,
        ...labels,
    };

    gaugeWorkersActive.set(controllerLabels, controller.workers_active);
    gaugeWorkersAvailable.set(controllerLabels, controller.workers_available);
    gaugeWorkersJoined.set(controllerLabels, controller.workers_joined);
    gaugeWorkersReconnected.set(controllerLabels, controller.workers_reconnected);
    gaugeWorkersDisconnected.set(controllerLabels, controller.workers_disconnected);

    gaugeSlicesProcessed.set(controllerLabels, controller.processed);
    gaugeSlicesFailed.set(controllerLabels, controller.failed);
    gaugeSlicesQueued.set(controllerLabels, controller.queued);

    gaugeNumSlicers.set(controllerLabels, controller.slicers);
}

function generateExecutionStatusMetrics(execution:any, executionLabels:any) {
    const statusList = [
        'completed',
        'failed',
        'failing',
        'initializing',
        'paused',
        'pending',
        'recovering',
        'rejected',
        'running',
        'scheduling',
        'stopped',
        'stopping',
        'terminated',
    ];

    for (const status of statusList) {
        const statusLabels = {
            ...executionLabels,
            status,
        };

        let state:number;

        if (status === execution._status) {
            state = 1;
        } else {
            state = 0;
        }
        gaugeExStatus.set(statusLabels, state);
    }
}

/**
 *    {
        "analytics": true,
        "performance_metrics": false,
        "assets": [
          "19b4f13148f64bc5a3fcfc53f96a5d646141a111",
          "b652a2d09f71e68dd0ca15f6b5a14136b181e111"
        ],
        "autorecover": false,
        "lifecycle": "persistent",
        "max_retries": 3,
        "name": "my-job-name",
        "operations": [
          {
            ...
          },
          ...
        ],
        "apis": [],
        "probation_window": 300000,
        "slicers": 1,
        "workers": 6,
        "labels": null,
        "env_vars": {},
        "targets": [
          {
            "key": "failure-domain.beta.kubernetes.io/zone",
            "value": "west"
          }
        ],
        "cpu": 1.5,
        "memory": 3221225472,
        "volumes": [],
        "job_id": "7e6dfa3c-6665-455d-9d52-f11bd32ad111",
        "ex_id": "5ba1da6a-0ba2-49f4-92c3-d436ba510111",
        "metadata": {},
        "slicer_port": 45680,
        "slicer_hostname": "10.32.97.23",
        "_context": "ex",
        "_created": "2020-07-09T21:30:34.537Z",
        "_updated": "2020-07-09T21:30:42.745Z",
        "_status": "running",
        "_has_errors": false,
        "_slicer_stats": {},
        "_failureReason": ""
      }
 * @param execution
 * @param labels
 */
function parseExecution(execution:any, labels:any) {
    const executionLabels = {
        ex_id: execution.ex_id,
        job_id: execution.job_id,
        job_name: execution.name,
        ...labels,
    };

    // NOTE: Optional settings that are undefined are just excluded with a
    // conditional below.

    // TODO: At some point workers will have different CPU Limits and Requests,
    // https://github.com/terascope/teraslice/issues/2202
    // for now, these are set to the same thing, but I split them since I know a
    // change is coming.
    if (execution.cpu) gaugeCpuRequest.set(executionLabels, execution.cpu);
    if (execution.cpu) gaugeCpuLimit.set(executionLabels, execution.cpu);
    if (execution.memory) gaugeMemoryRequest.set(executionLabels, execution.memory);
    if (execution.memory) gaugeMemoryLimit.set(executionLabels, execution.memory);

    gaugeCreatedTime.set(executionLabels, new Date(execution._created).getTime() / 1000);
    gaugeUpdatedTime.set(executionLabels, new Date(execution._updated).getTime() / 1000);

    gaugeExSlicers.set(executionLabels, execution.slicers);
    gaugeExWorkers.set(executionLabels, execution.workers);
    generateExecutionStatusMetrics(execution, executionLabels);
}

function generateControllerStats(terasliceStats:TerasliceStats, labels:any) {
    for (const controller of terasliceStats.controllers) {
        parseController(controller, labels);
    }
}

function generateExecutionStats(terasliceStats:TerasliceStats, labels:any) {
    for (const execution of terasliceStats.executions) {
        parseExecution(execution, labels);
    }
}

/**
 * NOTE: This assumes Teraslice is running in Kubernetes mode.
 *
 * generateExecutionVersions - takes the /cluster/state output, which looks like
 * this:
 *
 *    "10.123.4.111": {
 *      "node_id": "10.123.4.111",
 *      "hostname": "10.123.4.111",
 *      "pid": "N/A",
 *      "node_version": "N/A",
 *      "teraslice_version": "N/A",
 *      "total": "N/A",
 *      "state": "connected",
 *      "available": "N/A",
 *      "active": [
 *          {
 *              "assets": [],
 *              "assignment": "worker",
 *              "ex_id": "5ba1da6a-0ba2-49f4-92c3-d436ba510111",
 *              "image": "teraslice:v0.70.0",
 *              "job_id": "7e6dfa3c-6665-455d-9d52-f11bd32ad111",
 *              "pod_name": "ts-wkr-my-job-name-1d940e75-58d9-74c54e7dc1-nxaaa",
 *              "pod_ip": "10.132.86.111",
 *              "worker_id": "ts-wkr-my-job-name-1d940e75-58d9-74c54e7dc1-nxaaa"
 *          }
 *        ]
 *      }
 *
 * and makes something like this:
 *
 * {
 *  exId: {exId, jobId, image},
 *  exId: {exId, jobId, image}
 * }
 *
 * That then gets used to generate the metrics.
 *
 * @param terasliceStats
 * @param labels
 */
function generateExecutionVersions(terasliceStats:TerasliceStats, labels:any) {
    const executions:StateExecutionList = {};

    for (const [, workerNode] of Object.entries(terasliceStats.state)) {
        for (const worker of workerNode.active) {
            if (worker.ex_id && !Object.prototype.hasOwnProperty.call(executions, worker.ex_id)) {
                executions[worker.ex_id] = {
                    exId: worker.ex_id,
                    jobId: worker.job_id,
                    image: worker.image,
                };
            }
        }
    }

    for (const [, execution] of Object.entries(executions)) {
        const regex = /.*:(.*)_.*/g;
        const m = [...execution.image.matchAll(regex)];
        let version = '';
        if (m[0] !== []) {
            // eslint-disable-next-line prefer-destructuring
            version = m[0][1];
        }
        const executionLabels = {
            ex_id: execution.exId,
            job_id: execution.jobId,
            image: execution.image,
            version,
            ...labels,
        };
        gaugeExecutionInfo.set(executionLabels, 1);
    }
}

export function updateTerasliceMetrics(terasliceStats: TerasliceStats): void {
    metricsRegistry.resetMetrics();

    const globalLabels = {
        url: terasliceStats.displayUrl.toString(),
        name: terasliceStats.info.name,
    };
    // NOTE: This set of labels expands out to including 'name' twice, right now
    // they reduce to a single 'name' label ... I could end up regretting this.
    gaugeTerasliceMasterInfo.set(
        { ...terasliceStats.info, ...globalLabels },
        1,
    );

    generateControllerStats(terasliceStats, globalLabels);
    generateExecutionStats(terasliceStats, globalLabels);
    generateExecutionVersions(terasliceStats, globalLabels);

    gaugeQueryDuration.set(
        { query_name: 'info', ...globalLabels },
        terasliceStats.queryDuration.info,
    );
    gaugeQueryDuration.set(
        { query_name: 'jobs', ...globalLabels },
        terasliceStats.queryDuration.jobs,
    );
    gaugeQueryDuration.set(
        { query_name: 'controllers', ...globalLabels },
        terasliceStats.queryDuration.controllers,
    );
    gaugeQueryDuration.set(
        { query_name: 'executions', ...globalLabels },
        terasliceStats.queryDuration.executions,
    );
    gaugeQueryDuration.set(
        { query_name: 'state', ...globalLabels },
        terasliceStats.queryDuration.state,
    );
}
