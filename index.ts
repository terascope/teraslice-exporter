import { URL } from 'url';

import { Gauge, Registry } from 'prom-client';
import got from 'got';
import express from 'express';
import bunyan from 'bunyan';

const server = express();

const metricsRegistry = new Registry();
const logger = bunyan.createLogger({ name: 'teraslice_exporter' });

const metricPrefix = 'teraslice';
const standardLabelNames = ['ex_id', 'job_id', 'job_name', 'teraslice_cluster_url'];

const gaugeWorkersActive = new Gauge({
  name: `${metricPrefix}_workers_active`,
  help: 'Number of Teraslice workers actively processing slices.',
  labelNames: standardLabelNames,
  registers: [metricsRegistry],
});

const gaugeWorkersAvailable = new Gauge({
  name: `${metricPrefix}_workers_available`,
  help: 'Number of Teraslice workers running and waiting for work.',
  labelNames: standardLabelNames,
  registers: [metricsRegistry],
});

const gaugeWorkersJoined = new Gauge({
  name: `${metricPrefix}_workers_joined`,
  help: 'Total number of Teraslice workers that have joined the execution controller for this job.',
  labelNames: standardLabelNames,
  registers: [metricsRegistry],
});

const gaugeWorkersReconnected = new Gauge({
  name: `${metricPrefix}_workers_reconnected`,
  help: 'Total number of Teraslice workers that have reconnected to the execution controller for this job.',
  labelNames: standardLabelNames,
  registers: [metricsRegistry],
});

const gaugeWorkersDisconnected = new Gauge({
  name: `${metricPrefix}_workers_disconnected`,
  help: 'Total number of Teraslice workers that have disconnected from execution controller for this job.',
  labelNames: standardLabelNames,
  registers: [metricsRegistry],
});

const guageTerasliceMasterInfo = new Gauge({
  name: `${metricPrefix}_master_info`,
  help: 'Information about the teraslice master node.',
  labelNames: ['arch', 'clustering_type', 'name', 'node_version', 'platform', 'teraslice_version'],
  registers: [metricsRegistry],
});

const guageNumSlicers = new Gauge({
  name: `${metricPrefix}_number_of_slicers`,
  help: 'Number of execution controllers running for this execution.',
  labelNames: standardLabelNames,
  registers: [metricsRegistry],
});

const guageControllerQueryDuration = new Gauge({
  name: `${metricPrefix}_controller_query_duration`,
  help: 'Total time in ms to query the Teraslice controller endpoint.',
  labelNames: ['teraslice_cluster_url'],
  registers: [metricsRegistry],
});

// The following Guages should be Counters by my reconing, but as far as
// prom-client is concerned, this usage is fine:
//   https://github.com/siimon/prom-client/issues/192
const guageSlicesProcessed = new Gauge({
  name: `${metricPrefix}_slices_processed`,
  help: 'Number of slices processed.',
  labelNames: standardLabelNames,
  registers: [metricsRegistry],
});

const guageSlicesFailed = new Gauge({
  name: `${metricPrefix}_slices_failed`,
  help: 'Number of slices failed.',
  labelNames: standardLabelNames,
  registers: [metricsRegistry],
});

const guageSlicesQueued = new Gauge({
  name: `${metricPrefix}_slices_queued`,
  help: 'Number of slices queued for processing.',
  labelNames: standardLabelNames,
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
function parseController(controller:any, url: string) {
  const standardLabels = {
    ex_id: controller.ex_id,
    job_id: controller.job_id,
    job_name: controller.name,
    teraslice_cluster_url: url,
  };

  gaugeWorkersActive.set(standardLabels, controller.workers_active);
  gaugeWorkersAvailable.set(standardLabels, controller.workers_available);
  gaugeWorkersJoined.set(standardLabels, controller.workers_joined);
  gaugeWorkersReconnected.set(standardLabels, controller.workers_reconnected);
  gaugeWorkersDisconnected.set(standardLabels, controller.workers_disconnected);

  guageSlicesProcessed.set(standardLabels, controller.processed);
  guageSlicesFailed.set(standardLabels, controller.failed);
  guageSlicesQueued.set(standardLabels, controller.queued);

  guageNumSlicers.set(standardLabels, controller.slicers);
}

async function getTerasliceClusterState(baseUrl: URL) {
  const url = new URL('/v1/cluster/controllers', baseUrl);
  let response;
  try {
    logger.debug(`Getting ${url}`);
    response = await got(url);
  } catch (error) {
    logger.error(`Error getting ${url}: ${error}`);
  }

  if (response && response.statusCode === 200) {
    const controllers = JSON.parse(response.body);

    // eslint-disable-next-line no-restricted-syntax
    for (const controller of controllers) {
      parseController(controller, baseUrl.toString());
    }
  } else if (response) {
    logger.error(`Error getting ${url}: ${response.statusCode}`);
  }

  logger.debug(JSON.stringify(response?.timings));
  guageControllerQueryDuration.set(
    { teraslice_cluster_url: baseUrl.toString() },
    response?.timings.phases.total,
  );
}

async function getTerasliceClusterInfo(baseUrl:URL) {
  let info;
  let response : {
    body: {
      arch: string,
      // eslint-disable-next-line camelcase
      clustering_type: string,
      name: string,
      // eslint-disable-next-line camelcase
      node_version: string,
      platform: string,
      // eslint-disable-next-line camelcase
      teraslice_version: string
    },
    statusCode: number
  };

  try {
    response = await got(baseUrl, { responseType: 'json' });
    if (response && response.statusCode === 200 && response.body) {
      info = response.body;
      guageTerasliceMasterInfo.set(info, 1);
    } else if (response) {
      logger.error(`Error getting ${baseUrl}: ${response.statusCode}`);
    }
  } catch (error) {
    logger.error(`Error getting ${baseUrl}: ${error}`);
  }
}

async function updateTerasliceInfo(url:URL) {
  await getTerasliceClusterInfo(url);
  await getTerasliceClusterState(url);
}

declare let process : {
  env: {
    DEBUG: string,
    PORT: number,
    TERASLICE_URL: string
    TERASLICE_QUERY_DELAY: number
  }
};

function main() {
  let baseUrl: URL;
  const metricsEndpoint = '/metrics';

  if (process.env.TERASLICE_URL) {
    baseUrl = new URL(process.env.TERASLICE_URL);
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

  if (process.env.DEBUG) {
    logger.level('debug');
  }

  logger.info(`Getting intial Teraslice Cluster Information from ${baseUrl}`);
  updateTerasliceInfo(baseUrl);

  setInterval(() => {
    logger.debug(`Updating Teraslice Cluster Information from ${baseUrl}`);
    updateTerasliceInfo(baseUrl);
  }, terasliceQueryDelay);

  logger.info(`HTTP server listening to ${port}, metrics exposed on ${metricsEndpoint} endpoint`);
  server.listen(port);
}

main();
