# Host integration and acceptance

The Studio edition uses the OpenAI Codex CLI on the host for live image jobs.

    uv sync --locked
    uv run likeness probe codex --smoke
    uv run likeness serve --engine codex --host 127.0.0.1

Sign in to Codex on the host. Confirm the probe's synthetic create and edit outputs before relying on the live engine. Keep account state, images, pairing keys, and logs in ignored local storage. Set outbound proxy variables in the host process environment and keep the Codex listener local.

For owner access outside the home network, put the studio behind an authenticated HTTPS ingress with an outbound connection from the host. The ingress must authenticate every request before it reaches the loopback service. Keep the host address and the ingress configuration private. Client devices need no provider credentials or provider proxy.

For a temporary tunnel that cannot carry server-sent events, set LIKENESS_OWNER_SECRET_FILE to a local file containing a random ASCII password of at least 32 characters. Run the Studio on loopback and point the HTTPS tunnel at that listener. Open the HTTPS root URL in the device's browser and sign in as likeness with that password. This mode uses polling and requires the password on every request, including requests from the relay. Supply the URL and password separately. The URL changes when a temporary tunnel restarts.

## Phone handoff

Open the studio on a phone with its proxy off. Complete a turn with a synthetic attachment, leave while an image is running, and reopen the same session. Check that progress resumes, the image opens in the app, and a retransmission does not start a second job.

## Tablet handoff

Open the same studio on a tablet with its proxy off. Exercise the lookbook, reference image and mask in portrait and landscape, including rotation or locking the screen during upload and generation. Check that the draft, selected image and job survive and the result remains viewable while a second upload is pending.

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

Record browser emulation and physical-device results independently, including Wi-Fi and cellular results in the intended deployment region.
