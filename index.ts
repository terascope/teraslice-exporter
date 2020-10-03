import { URL } from 'url';

import { Gauge, Registry } from 'prom-client';
import got from 'got';
import express from 'express';
import bunyan from 'bunyan';

const server = express();

const metricsRegistry = new Registry();
const logger = bunyan.createLogger({ name: 'teraslice_exporter' });

const terasliceQueryDelay = 30000;
const metricPrefix = 'teraslice';
const standardLabelNames = ['ex_id', 'job_id', 'job_name'];

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

// The following Guages should be Counters by my reconing, but as far as
// prom-client is concerned, this usage is fine:
//   https://github.com/siimon/prom-client/issues/192
const guageSlicesProcessed = new Gauge({
  name: `${metricPrefix}_slices_processed`,
  help: 'Number of slices processed.',
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
function parseController(controller:any) {
  // p(controller);

  const standardLabels = {
    ex_id: controller.ex_id,
    job_id: controller.job_id,
    job_name: controller.name,
  };

  gaugeWorkersActive.set(standardLabels, controller.workers_active);
  gaugeWorkersAvailable.set(standardLabels, controller.workers_available);
  guageSlicesProcessed.set(standardLabels, controller.processed);
}

async function getTerasliceClusterState(baseUrl: URL) {
  const url = new URL('/v1/cluster/controllers', baseUrl);
  let response;
  try {
    response = await got(url);
  } catch (error) {
    logger.error(error);
  }

  if (response && response.statusCode === 200) {
    logger.debug(response.statusCode);

    const controllers = JSON.parse(response.body);

    // eslint-disable-next-line no-restricted-syntax
    for (const controller of controllers) {
      parseController(controller);
    }
  } else if (response) {
    logger.error(`Error getting ${url}: ${response.statusCode}`);
  }

  // p(response.timings)
}

async function getTerasliceClusterInfo(baseUrl:URL) {
  let response;
  let info;
  try {
    response = await got(baseUrl, { responseType: 'json' });
  } catch (error) {
    logger.error(error);
  }

  if (response && response.statusCode === 200 && response.body) {
    // p(response.body);
    info = response.body;
  } else if (response) {
    logger.error(`Error getting ${baseUrl}: ${response.statusCode}`);
  }
  return info;
}

async function updateTerasliceInfo(url:URL) {
  const clusterInfo = await getTerasliceClusterInfo(url);
  // console.log(clusterInfo);
  await getTerasliceClusterState(url);
}

function main() {
  const { DEBUG, TERASLICE_URL } = process.env;

  server.get('/metrics', (req, res) => {
    res.set('Content-Type', metricsRegistry.contentType);
    res.end(metricsRegistry.metrics());
  });

  if (DEBUG) {
    logger.level('debug');
  }
  logger.debug('DEBUG');

  const baseUrl = new URL(TERASLICE_URL);

  logger.info(`Getting intial Teraslice Cluster Information from ${baseUrl}`);
  updateTerasliceInfo(baseUrl);

  setInterval(() => {
    logger.debug(`Updating Teraslice Cluster Information from ${baseUrl}`);
    updateTerasliceInfo(baseUrl);
  }, terasliceQueryDelay);

  const port = process.env.PORT || 3000;
  logger.info(`Server listening to ${port}, metrics exposed on /metrics endpoint`);
  server.listen(port);
}

main();
