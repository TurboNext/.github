# ar-python-install

Mints a short-lived `pypi-tn` reader token (via
[`ar-python-token`](../ar-python-token/)) and `pip download`s a single
package, optionally version-pinned, with `--no-deps`.

## Usage

```yaml
- uses: TurboNext/.github/.github/actions/ar-python-install@main
  with:
    gcp-sa-key: ${{ secrets.PYPI_TN_READER_KEY }}
    package: tier-coordinator
    version: ${{ inputs.dev_version }}   # omit for latest
```

`dest` defaults to `.`; set it if you want the download somewhere other
than the job's working directory.

## What it doesn't cover

Deliberately scoped to that one shape — the `uv`-based installs elsewhere
in the org (`--prerelease`, `--index-strategy`, keyring provider quirks,
multiple packages installed at once) vary too much per repo to force
through a single interface, and this action has no hook for custom error
handling (e.g. a promote workflow that needs to gracefully skip the rest
of the job when a dev wheel doesn't exist, rather than hard-failing).

For those cases, call [`ar-python-token`](../ar-python-token/) directly
and build your own `pip`/`uv` command around its `index-url`/`token`
output.

## Inputs / outputs

See [`action.yml`](./action.yml).
