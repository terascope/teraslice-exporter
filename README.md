# Teraslice Job Exporter README

Note: This exporter is only meant for use with Teraslice using Kubernetes
clustering.  It hasn't been tested with Teraslice running in Native clustering
mode.

## Usage

So far it works like this:

```bash
TERASLICE_URL="https://localhost" \
  DEBUG=True \
  NODE_EXTRA_CA_CERTS=/path/to/ca.crt \
  node dist/index.js | bunyan
```

All options are passed as environment variables

```bash
TERASLICE_URL="https://localhost" \
  DEBUG=True \
  NODE_EXTRA_CA_CERTS=/path/to/ca.crt \
  PORT=4242 \
  TERASLICE_QUERY_DELAY=90000
  node dist/index.js | bunyan
```

The `TERASLICE_URL` is the only environment variable that is required.

### Environment variables

* `TERASLICE_URL` - URL to the Teraslice Instance to Monitor
* `DEBUG` - Enable debug logging
* `NODE_EXTRA_CA_CERTS` - Standard Node variable to specify CA cert for SSL
connections
* `PORT` - The port that the http express server will listen on
* `TERASLICE_QUERY_DELAY` - The delay between updating the Teraslice stats, this
value is in ms.

### Docker

Build the docker image:

```bash
docker build -t teraslice-exporter:v0.1.0 .
```

Run the docker image:

```bash
docker run --rm -p 3000:3000 \
    -e TERASLICE_URL="http://url.to.teraslice/" \
    teraslice-exporter:v0.1.0 | bunyan
```

## Design

The exporter will scrape several of the Teraslice API endpoints every
`TERASLICE_QUERY_DELAY` milliseconds and update it's exported metrics after that
update is completed.

```text
# HELP teraslice_controller_slicers_count Number of execution controllers (slicers) running for this execution.
# HELP teraslice_controller_slices_failed Number of slices failed.
# HELP teraslice_controller_slices_processed Number of slices processed.
# HELP teraslice_controller_slices_queued Number of slices queued for processing.
# HELP teraslice_controller_workers_active Number of Teraslice workers actively processing slices.
# HELP teraslice_controller_workers_available Number of Teraslice workers running and waiting for work.
# HELP teraslice_controller_workers_disconnected Total number of Teraslice workers that have disconnected from execution controller for this job.
# HELP teraslice_controller_workers_joined Total number of Teraslice workers that have joined the execution controller for this job.
# HELP teraslice_controller_workers_reconnected Total number of Teraslice workers that have reconnected to the execution controller for this job.
# HELP teraslice_execution_cpu_limit CPU core limit for a Teraslice worker container.
# HELP teraslice_execution_cpu_request Requested number of CPU cores for a Teraslice worker container.
# HELP teraslice_execution_created_timestamp_seconds Execution creation time.
# HELP teraslice_execution_info Information about Teraslice execution.
# HELP teraslice_execution_memory_limit Memory limit for Teraslice a worker container.
# HELP teraslice_execution_memory_request Requested amount of memory for a Teraslice worker container.
# HELP teraslice_execution_slicers Number of slicers defined on the execution.
# HELP teraslice_execution_status Current status of the Teraslice execution.
# HELP teraslice_execution_updated_timestamp_seconds Execution update time.
# HELP teraslice_execution_workers Number of workers defined on the execution.  Note that the number of actual workers can differ from this value.
# HELP teraslice_master_info Information about the Teraslice master node.
# HELP teraslice_query_duration Total time to complete the named query, in ms.
```
