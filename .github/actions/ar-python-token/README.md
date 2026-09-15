# ar-python-token

Mints a short-lived OAuth2 token for the `pypi-tn` GCP Artifact Registry
Python repos — the Devpi replacement — and assembles the matching index
URL. Works for both directions: pass the **publisher** key to upload, the
**reader** key to install.

`repository` (`pypi-tn`, `pypi-tn-cu129`, `pypi-tn-cu130`) can also be set
via the `channel` input instead — a convenience for TurboNext's devpi-era
channel names (`cu129`, `cu130`; anything else, including `stable`/`simple`/
empty, resolves to `pypi-tn`). `channel` takes precedence over `repository`
when both are set.

## Most consumers don't need to call this directly

For the two common shapes, use the higher-level actions that wrap this
one instead:

- **Publishing** (`twine upload`, one or two channels) —
  [`ar-python-publish`](../ar-python-publish/)
- **Installing a single pinned package** (`pip download PKG==VERSION
  --no-deps`) — [`ar-python-install`](../ar-python-install/)

Call `ar-python-token` directly only when you need the raw
`token`/`index-url` for something those don't cover — most commonly, a
Dockerfile `RUN` line, or a `uv`-based install with flags those actions
don't expose.

## Consuming inside a Dockerfile

There's no action for this side — a Dockerfile `RUN` line can't be "a
workflow step". Call this action directly, then pass `index-url` into
the build:

```yaml
- id: ar-token
  uses: TurboNext/.github/.github/actions/ar-python-token@main
  with:
    gcp-sa-key: ${{ secrets.PYPI_TN_READER_KEY }}
    repository: pypi-tn

- run: |
    docker build --secret id=pypi_index_url,env=INDEX_URL .
  env:
    INDEX_URL: ${{ steps.ar-token.outputs.index-url }}
```

Inside the Dockerfile, with `pip`:

```dockerfile
RUN --mount=type=secret,id=pypi_index_url \
    pip install --extra-index-url "$(cat /run/secrets/pypi_index_url)" some-package
```

With `uv`, two flags are required that `pip` doesn't need — `uv` won't
retry with the `oauth2accesstoken` username on a bare-host 401 the way
`pip` does, so it must be embedded in the URL explicitly (already done by
this action's `index-url` output), and `keyrings.google-artifactregistry-auth`
must be installed with `--keyring-provider subprocess`:

```dockerfile
RUN --mount=type=secret,id=pypi_index_url \
    pip install keyrings.google-artifactregistry-auth && \
    uv pip install --keyring-provider subprocess \
      --extra-index-url "$(cat /run/secrets/pypi_index_url)" some-package
```

## Non-GitHub-Actions consumers

This same direct-call pattern applies outside GitHub Actions too — a
developer's laptop, a baremetal node — just mint the token with `gcloud
auth print-access-token` or the Python `google-auth` library instead of
this action. See `tools/cluster/node/setup-tllm-dev.sh` and
`tests/e2e/baremetal-conformance/` in `vllm-tn` for worked examples.

## Inputs / outputs

See [`action.yml`](./action.yml).
