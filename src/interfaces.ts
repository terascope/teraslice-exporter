export interface StateExecution {
    exId: string,
    jobId: string,
    image: string
}

export interface StateExecutionList {
    [key: string]: StateExecution
}

export interface GetTerasliceApiResponse {
    data: any,
    queryDuration: number
}

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
export interface TerasliceWorker {
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
export interface TerasliceWorkerNodeInfo {
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
export interface TerasliceClusterState {
    [key: string]: TerasliceWorkerNodeInfo
}

export interface TerasliceInfo {
    arch: string,
    clustering_type: string,
    name: string,
    node_version: string,
    platform: string,
    teraslice_version: string
}

/**
 * These are all in ms
 */
export interface TerasliceQueryDuration {
    controllers: number,
    executions: number,
    info: number,
    jobs: number,
    state: number,
}

export interface TerasliceStatsInterface {
    baseUrl: URL,
    controllers: any[],
    executions: any[],
    info: TerasliceInfo,
    jobs: any[],
    state: TerasliceClusterState,
    queryDuration: TerasliceQueryDuration
}
