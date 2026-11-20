# Host integration and acceptance

[Open the Windows workstation](https://arlington-brakes-gradually-nelson.trycloudflare.com/open). A paired browser opens Studio directly. On a new browser, open the owner's private Likeness link once, then use the link here or the repository's Website link.

Open **Studio** to send a message to the workstation. The app uses the workstation's signed-in Codex CLI for live requests. The private pairing link, credentials, site data, and results are kept by the owner.

## Download and run a local copy

```sh
git clone --branch studio --single-branch https://github.com/1760139151lkh-ctrl/likeness-studio.git
cd likeness-studio
npm ci
npm run build
uv sync --locked
uv run likeness serve --engine codex --host 127.0.0.1
```

For a workstation of your own, sign in to Codex on that host. Set any outbound proxy in the server process environment. Owner access over HTTPS uses `LIKENESS_OWNER_LINK=1` and `LIKENESS_OWNER_SECRET_FILE` pointing to a random secret kept in the host's private storage. The tunnel forwards to the loopback listener. If the temporary gateway address changes, update the Website link and this guide.

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