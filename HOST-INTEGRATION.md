# Host integration and acceptance

The Studio edition uses the OpenAI Codex CLI on the host for live image jobs.

    uv sync --locked
    uv run likeness probe codex --smoke
    uv run likeness serve --engine codex --host 127.0.0.1

Sign in to Codex on the host. Confirm the probe's synthetic create and edit outputs before relying on the live engine. Keep account state, images, pairing keys, and logs in ignored local storage. Set outbound proxy variables in the host process environment and keep the Codex listener local.

A shared deployment needs an authenticated TLS endpoint and an image service authorized for its audience. Keep credentials on the host. Enforce per-user access to assets and jobs, bounded queues, and upload limits.

## Acceptance scenarios

| Scenario | Evidence |
|---|---|
| Phone and tablet on Wi-Fi and cellular with client proxies off | Each device loads the same build, uploads a synthetic image, completes a real render, and opens the delivered image in the app. |
| Host proxy outage and recovery | Report a bounded failure, recover over the configured host route, and avoid duplicate jobs. |
| Interrupted stream | Disconnect for 15 seconds, reconnect to the same job, and compare the terminal status and delivered image bytes. |
| Concurrent uploads and renders | Record queue wait, completion latency, host memory, and overload behavior during concurrent image uploads. |
| Authentication and cancellation | Verify a clear failure on expired credentials, cancellation with no late result, and a successful subsequent job. |
| Private data isolation | Verify that unauthorized requests cannot see private assets or submit generation jobs. Inspect the shipped source and assets for identifying metadata. |
| Sustained use | Record resource growth and unexpected restarts before reporting reliability figures. |

Record browser emulation and physical-device results independently. A loopback result does not establish cellular reachability.
