# Teraslice Job Exporter README

## Usage

So far it works like this:

```bash
TERASLICE_URL="https://localhost" \
  DEBUG=True \
  NODE_EXTRA_CA_CERTS=~/Downloads/ca.crt \
  node dist/index.js | bunyan
```

## Design

Scrape the `/v1/cluster/controllers` endpoint periodically to get an array of
active controllers, like this

```json
[
    {
        "ex_id": "5ba1da6a-0ba2-49f4-92c3-d436ba510e59",
        "job_id": "7e6dfa3c-6665-455d-9d52-f11bd32ad18a",
        "name": "my_job_name",
        "workers_available": 0,
        "workers_active": 6,
        "workers_joined": 6,
        "workers_reconnected": 0,
        "workers_disconnected": 0,
        "job_duration": 0,
        "failed": 1,
        "subslices": 0,
        "queued": 7,
        "slice_range_expansion": 0,
        "processed": 204156,
        "slicers": 1,
        "subslice_by_key": 0,
        "started": "2020-09-17T21:08:58.905Z",
        "queuing_complete": ""
    }
]
```

Labels?

```txt
cluster = ts-prod
ex_id = 5ba1da6a-0ba2-49f4-92c3-d436ba510e59,
job_id = 7e6dfa3c-6665-455d-9d52-f11bd32ad18a,
name = my_job_name,
```

The following metrics related to each job:

```txt
"workers_available": 0,
"workers_active": 6,
"workers_joined": 6,
"workers_reconnected": 0,
"workers_disconnected": 0,
"job_duration": 0,
"failed": 1,
"subslices": 0,
"queued": 7,
"slice_range_expansion": 0,
"processed": 204156,
"slicers": 1,
"subslice_by_key": 0,
"started": "2020-09-17T21:08:58.905Z",
"queuing_complete": ""
```

The following metrics related to the query response itself (timing info) derived
from this timing info:

```json
{
  start: 1601417492206,
  socket: 1601417492208,
  lookup: 1601417492213,
  connect: 1601417492247,
  secureConnect: 1601417492315,
  upload: 1601417492316,
  response: 1601417493491,
  end: 1601417493518,
  error: undefined,
  abort: undefined,
  phases: {
    wait: 2,
    dns: 5,
    tcp: 34,
    tls: 68,
    request: 1,
    firstByte: 1175,
    download: 27,
    total: 1312
  }
}
```

Use the following:

```txt
got_phase_firstByte: 1175,
got_phase_download: 27,
got_phase_total: 1312
```
