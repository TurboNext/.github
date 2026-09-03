# ar-python-token

Mints a short-lived OAuth2 token for the `pypi-tn` GCP Artifact Registry
Python repos — the Devpi replacement — and assembles the matching index
URL. Works for both directions: pass the **publisher** key to upload, the
**reader** key to install.

## Publishing

Don't call this action directly for publishing — use
[`reusable_pypi_publish.yml`](../../workflows/reusable_pypi_publish.yml),
which wraps it with checkout/build/twine-upload:

```yaml
jobs:
  publish:
    uses: TurboNext/.github/.github/workflows/reusable_pypi_publish.yml@main
    with:
      repository: pypi-tn-cu129   # or pypi-tn / pypi-tn-cu130
    secrets:
      PYPI_TN_PUBLISHER_KEY: ${{ secrets.PYPI_TN_PUBLISHER_KEY }}
```

## Consuming (install)

There's no reusable workflow for this side — every current consumer installs
from inside a Dockerfile `RUN` line, which can't be "a workflow step". Call
the action directly, then pass `index-url` into the build:

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

## Inputs / outputs

See [`action.yml`](./action.yml).
