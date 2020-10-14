import { URL } from 'url';

import { Gauge, Registry } from 'prom-client';
import express from 'express';
import bunyan from 'bunyan';

import TerasliceStats from './teraslice-stats';

const server = express();

const metricsRegistry = new Registry();
const logger = bunyan.createLogger({ name: 'teraslice_exporter' });

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

declare let process : {
  env: {
    DEBUG: string,
    PORT: number,
    TERASLICE_URL: string
    TERASLICE_QUERY_DELAY: number
  }
};

const gaugeWorkersActive = new Gauge({
  name: `${metricPrefix}_workers_active`,
  help: 'Number of Teraslice workers actively processing slices.',
  labelNames: exLabelNames,
  registers: [metricsRegistry],
});

const gaugeWorkersAvailable = new Gauge({
  name: `${metricPrefix}_workers_available`,
  help: 'Number of Teraslice workers running and waiting for work.',
  labelNames: exLabelNames,
  registers: [metricsRegistry],
});

const gaugeWorkersJoined = new Gauge({
  name: `${metricPrefix}_workers_joined`,
  help: 'Total number of Teraslice workers that have joined the execution controller for this job.',
  labelNames: exLabelNames,
  registers: [metricsRegistry],
});

const gaugeWorkersReconnected = new Gauge({
  name: `${metricPrefix}_workers_reconnected`,
  help: 'Total number of Teraslice workers that have reconnected to the execution controller for this job.',
  labelNames: exLabelNames,
  registers: [metricsRegistry],
});

const gaugeWorkersDisconnected = new Gauge({
  name: `${metricPrefix}_workers_disconnected`,
  help: 'Total number of Teraslice workers that have disconnected from execution controller for this job.',
  labelNames: exLabelNames,
  registers: [metricsRegistry],
});

const guageTerasliceMasterInfo = new Gauge({
  name: `${metricPrefix}_master_info`,
  help: 'Information about the teraslice master node.',
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

const guageNumSlicers = new Gauge({
  name: `${metricPrefix}_number_of_slicers`,
  help: 'Number of execution controllers running for this execution.',
  labelNames: exLabelNames,
  registers: [metricsRegistry],
});

const guageQueryDuration = new Gauge({
  name: `${metricPrefix}_query_duration`,
  help: 'Total time to complete the named query, in ms.',
  labelNames: ['query_name', ...globalLabelNames],
  registers: [metricsRegistry],
});

// The following Guages should be Counters by my reconing, but as far as
// prom-client is concerned, this usage is fine:
//   https://github.com/siimon/prom-client/issues/192
const guageSlicesProcessed = new Gauge({
  name: `${metricPrefix}_slices_processed`,
  help: 'Number of slices processed.',
  labelNames: exLabelNames,
  registers: [metricsRegistry],
});

const guageSlicesFailed = new Gauge({
  name: `${metricPrefix}_slices_failed`,
  help: 'Number of slices failed.',
  labelNames: exLabelNames,
  registers: [metricsRegistry],
});

const guageSlicesQueued = new Gauge({
  name: `${metricPrefix}_slices_queued`,
  help: 'Number of slices queued for processing.',
  labelNames: exLabelNames,
  registers: [metricsRegistry],
});

/**
 * parseController adds the teraslice execution controller metrics to the
 * metricsRegistry for a single execution.
 *
 *    {
 *       "ex_id": "5ba1da6a-0ba2-49f4-92c3-d436ba510e59",
 *       "job_id": "7e6dfa3c-6665-455d-9d52-f11bd32ad18a",
 *       "name": "my_job_name",
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

  guageSlicesProcessed.set(controllerLabels, controller.processed);
  guageSlicesFailed.set(controllerLabels, controller.failed);
  guageSlicesQueued.set(controllerLabels, controller.queued);

  guageNumSlicers.set(controllerLabels, controller.slicers);
}

function generateControllerStats(terasliceStats:TerasliceStats, labels:any) {
  // FIXME: I should rethink this warning
  // eslint-disable-next-line no-restricted-syntax
  for (const controller of terasliceStats.controllers) {
    parseController(controller, labels);
  }
}

function updateTerasliceMetrics(terasliceStats: TerasliceStats) {
  const globalLabels = {
    url: terasliceStats.baseUrl.toString(),
    name: terasliceStats.info.name,
  };
  // NOTE: This set of labels expands out to including 'name' twice, right now
  // they reduce to a single 'name' label ... I could end up regretting this.
  guageTerasliceMasterInfo.set(
    { ...terasliceStats.info, ...globalLabels },
    1,
  );

  generateControllerStats(terasliceStats, globalLabels);

  guageQueryDuration.set(
    { query_name: 'info', ...globalLabels },
    terasliceStats.queryDuration.info,
  );
  guageQueryDuration.set(
    { query_name: 'jobs', ...globalLabels },
    terasliceStats.queryDuration.jobs,
  );
  guageQueryDuration.set(
    { query_name: 'controllers', ...globalLabels },
    terasliceStats.queryDuration.controllers,
  );
  guageQueryDuration.set(
    { query_name: 'executions', ...globalLabels },
    terasliceStats.queryDuration.executions,
  );
}

async function main() {
  let baseUrl: string;
  const metricsEndpoint = '/metrics';

  if (process.env.TERASLICE_URL) {
    // I instantiate a URL, then immediately call toString() just to get the
    // URL validation but keep a string type
    baseUrl = new URL(process.env.TERASLICE_URL).toString();
  } else {
    throw new Error('The TERASLICE_URL environment variable must be a valid URL to the root of your teraslice instance.');
  }
  const port = process.env.PORT || 3000;
  const terasliceQueryDelay = process.env.TERASLICE_QUERY_DELAY || 30000; // ms

  server.get(metricsEndpoint, (req, res) => {
    res.set('Content-Type', metricsRegistry.contentType);
    res.end(metricsRegistry.metrics());
  });

  server.get('/', (req, res) => {
    res.send(`See the '${metricsEndpoint}' endpoint for the teraslice exporter.`);
  });

  if (process.env.DEBUG) logger.level('debug');

  const terasliceStats = new TerasliceStats(baseUrl);
  await terasliceStats.update();
  updateTerasliceMetrics(terasliceStats);

  logger.debug(`executions: ${JSON.stringify(terasliceStats.executions.slice(0, 2), null, 2)}`);
  logger.debug(`controllers: ${JSON.stringify(terasliceStats.controllers.slice(0, 2), null, 2)}`);

  setInterval(async () => {
    logger.debug(`Updating Teraslice Cluster Information from ${baseUrl}`);
    await terasliceStats.update();
    updateTerasliceMetrics(terasliceStats);

    logger.debug(`queryDurations: ${JSON.stringify(terasliceStats.queryDuration)}`);
    logger.debug(`datasetSizes: ${JSON.stringify({
      info: terasliceStats.info.length,
      controllers: terasliceStats.controllers.length,
      executions: terasliceStats.executions.length,
      jobs: terasliceStats.jobs.length,
    })}`);
  }, terasliceQueryDelay);

  logger.info(`HTTP server listening to ${port}, metrics exposed on ${metricsEndpoint} endpoint`);
  server.listen(port);
}

main();
