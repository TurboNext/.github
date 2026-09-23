# ar-python-publish

Mints a short-lived `pypi-tn` publisher token (via
[`ar-python-token`](../ar-python-token/)) and `twine upload`s one or more
dist globs.

## Usage

```yaml
- uses: TurboNext/.github/.github/actions/ar-python-publish@main
  with:
    gcp-sa-key: ${{ secrets.PYPI_TN_PUBLISHER_KEY }}
```

`dist-glob` defaults to `dist/*`; pass it explicitly if your build output
lives elsewhere (e.g. `./*.whl` for a promote workflow working in the
job's root). `repository` defaults to `pypi-tn`, the one repo every
package publishes to now.

## What it doesn't cover

If your job has real build steps before the upload (PyArmor obfuscation,
a matrix build, retagging a wheel) — that's normal, keep those as their
own steps and just add this one at the end. If you have *no* custom
build step at all (checkout → `python -m build` → upload is enough),
[`reusable_pypi_publish.yml`](../../workflows/reusable_pypi_publish.yml)
wraps this whole job for you instead.

## Inputs / outputs

See [`action.yml`](./action.yml).
