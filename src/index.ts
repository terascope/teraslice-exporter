import { URL } from 'url';

import express from 'express';
import bunyan from 'bunyan';

import TerasliceStats from './teraslice-stats';
import { metricsRegistry, updateTerasliceMetrics } from './metrics';

declare let process : {
    env: {
        DEBUG: string,
        PORT: number,
        TERASLICE_URL: string
        TERASLICE_QUERY_DELAY: number
    }
};

async function main() {
    let baseUrl: string;

    const server = express();
    const port = process.env.PORT || 3000;
    const metricsEndpoint = '/metrics';

    if (process.env.TERASLICE_URL) {
    // I instantiate a URL, then immediately call toString() just to get the
    // URL validation but keep a string type
        baseUrl = new URL(process.env.TERASLICE_URL).toString();
    } else {
        throw new Error('The TERASLICE_URL environment variable must be a valid URL to the root of your teraslice instance.');
    }
    const terasliceQueryDelay = process.env.TERASLICE_QUERY_DELAY || 30000; // ms
    const logger = bunyan.createLogger({
        name: 'teraslice_exporter',
        terasliceUrl: baseUrl
    });

    server.get(metricsEndpoint, (req, res) => {
        res.set('Content-Type', metricsRegistry.contentType);
        res.end(metricsRegistry.metrics());
    });

    server.get('/', (req, res) => {
        res.send(`See the '${metricsEndpoint}' endpoint for the teraslice exporter.`);
    });

    // Node 14 introduces the ?. operator, which can be chained.  This forces
    // node v14+
    if (process?.env?.DEBUG?.toLowerCase() === 'true') logger.level('debug');

    const terasliceStats = new TerasliceStats(baseUrl);
    await terasliceStats.update();
    updateTerasliceMetrics(terasliceStats);

    setInterval(async () => {
        logger.info('Begining update of Teraslice state');
        await terasliceStats.update();
        updateTerasliceMetrics(terasliceStats);

        const datasetSizes = {
            datasetSizes: {
                info: terasliceStats.info.length,
                controllers: terasliceStats.controllers.length,
                executions: terasliceStats.executions.length,
                jobs: terasliceStats.jobs.length,
            }
        };
        logger.debug({ queryDurations: terasliceStats.queryDuration }, 'Query Durations');
        logger.info(datasetSizes, 'Update complete.');
    }, terasliceQueryDelay);

    logger.info(`HTTP server listening to ${port}, metrics exposed on ${metricsEndpoint} endpoint`);
    server.listen(port);
}

main();
