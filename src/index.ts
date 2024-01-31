import { URL } from 'url';

import express from 'express';
import bunyan from 'bunyan';

import TerasliceStats from './teraslice-stats';
import { metricsRegistry, updateTerasliceMetrics } from './metrics';

declare global {
    namespace NodeJS {
    interface ProcessEnv {
            DEBUG: string,
            PORT: number,
            TERASLICE_URL: string
            TERASLICE_DISPLAY_URL: string
            TERASLICE_QUERY_DELAY: number
        }
    }
}

async function main() {
    let baseUrl: string;
    let displayUrl: string;

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
    if (process.env.TERASLICE_DISPLAY_URL) {
    // I instantiate a URL, then immediately call toString() just to get the
    // URL validation but keep a string type
        displayUrl = new URL(process.env.TERASLICE_DISPLAY_URL).toString();
    } else {
        displayUrl = baseUrl;
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

    const terasliceStats = new TerasliceStats(baseUrl, displayUrl);

    try {
        await terasliceStats.update();
    } catch (error) {
        logger.warn(`Error encountered getting terasliceStats: ${error}`);
        terasliceStats.updateErrors('stats');
    }
    try {
        updateTerasliceMetrics(terasliceStats);
    } catch (error) {
        logger.warn(`Error processing Teraslice cluster state: ${error}`);
        terasliceStats.updateErrors('metrics');
    }

    setInterval(async () => {
        logger.info('Beginning update of Teraslice state');
        try {
            await terasliceStats.update();
        } catch (error) {
            logger.warn(`Error encountered getting terasliceStats: ${error}`);
            // TODO: record stats on the specific endpoint that had an error
            terasliceStats.updateErrors('stats');
            return;
        }
        try {
            updateTerasliceMetrics(terasliceStats);
        } catch (error) {
            logger.warn(`Error processing Teraslice cluster state: ${error}`);
            terasliceStats.updateErrors('metrics');
            return;
        }

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
